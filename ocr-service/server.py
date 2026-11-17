"""Tiny HTTP wrapper around OpenThai2.0-OCR-Text for the job finder.

The web app runs on Cloudflare Workers, which cannot run Python, so OCR lives here as a separate process.
  POST /ocr     body = raw image bytes (PNG/JPEG/WebP)
                -> {"width", "height", "lines": [{"text", "confidence", "box", "cell"}]}
                   cell = [left, top, right, bottom] of the ruled table cell holding the line, or null
  GET  /health  -> {"ok": true}

Images are read in memory and never written to disk.
Run: python server.py   (OCR_HOST / OCR_PORT / OCR_TOKEN env vars are optional)
"""

from __future__ import annotations

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2
import numpy as np

MODEL_DIR = Path(__file__).resolve().parent / "model"
MAX_BYTES = 10 * 1024 * 1024
HOST = os.environ.get("OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("OCR_PORT", "8765"))
TOKEN = os.environ.get("OCR_TOKEN", "")

if not (MODEL_DIR / "runtime" / "line_engine.py").exists():
    sys.exit("Model not found. Run: python download_model.py")

sys.path.insert(0, str(MODEL_DIR))
from runtime.line_engine import LineOCR  # noqa: E402

# min_chars 1: timetables carry one-letter day codes (M T W H F S U) that the shipped config (2) drops.
ocr = LineOCR(MODEL_DIR, threads=max(1, min(4, os.cpu_count() or 1)), rec={"min_chars": 1})
ocr_lock = threading.Lock()  # one engine instance; keep calls serial

# Screenshots of registration pages have ~13 px monospace digits; at that size the recognizer mixes up
# 0/6/อ (e.g. "17:00-18:40" -> "17:60-18:46"). Reading small images at 2x fixes it.
UPSCALE_BELOW = 1800  # longest side in pixels


def read_page(image: np.ndarray) -> list[dict]:
    """OCR lines with boxes in the ORIGINAL image's coordinates."""
    scale = 2 if max(image.shape[:2]) < UPSCALE_BELOW else 1
    work = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC) if scale > 1 else image
    with ocr_lock:
        result = ocr.read(work)
    lines = []
    for line in result.get("lines", []):
        if not line.get("text"):
            continue
        box = np.asarray(line.get("box"), dtype=float).reshape(-1, 2) / scale if line.get("box") is not None else None
        lines.append({"text": line["text"], "confidence": to_plain(line.get("confidence")), "box": box})
    return lines


# Thai day colours (จันทร์ yellow, อังคาร pink, พุธ green, พฤหัส orange, ศุกร์ blue, เสาร์ purple, อาทิตย์ red).
# Registration systems often show the day as a small coloured square with a one-letter code in white,
# which OCR reads badly, so the square's colour is reported too. OpenCV hue runs 0-179.
HUE_NAMES = [(8, "red"), (22, "orange"), (35, "yellow"), (85, "green"), (100, "light-blue"), (130, "blue"), (150, "purple"), (170, "pink"), (180, "red")]


def day_badges(image: np.ndarray) -> list[dict]:
    """Small solid squares of saturated colour (day badges). Returns [{"box", "colour"}]."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = ((hsv[:, :, 1] > 120) & (hsv[:, :, 2] > 120)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))  # close over the white letter
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    badges = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if not (14 <= h <= 60 and 0.6 <= w / h <= 1.6) or cv2.contourArea(contour) < 0.75 * w * h:
            continue
        region = hsv[y:y + h, x:x + w]
        solid = region[(region[:, :, 1] > 120) & (region[:, :, 2] > 120)]
        hue = float(np.median(solid[:, 0])) if len(solid) else 0.0
        colour = next(name for limit, name in HUE_NAMES if hue < limit)
        badges.append({"box": [x, y, x + w, y + h], "colour": colour})
    return badges


def attach_badges(lines: list[dict], badges: list[dict]) -> list[dict]:
    """Merge each badge with the OCR text inside it (if any), or add it as its own line."""
    for badge in badges:
        x0, y0, x1, y1 = badge["box"]
        inside = [
            line for line in lines
            if line["box"] is not None
            and x0 - 2 <= line["box"][:, 0].mean() <= x1 + 2 and y0 - 2 <= line["box"][:, 1].mean() <= y1 + 2
        ]
        letter = " ".join(line["text"] for line in inside)
        for line in inside:
            lines.remove(line)
        lines.append({
            "text": f"[day badge: colour {badge['colour']}{f', letter {letter}' if letter else ', letter unreadable'}]",
            "confidence": 1.0,
            "box": np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=float),
        })
    # top-to-bottom, left-to-right so a badge sits with the rest of its row
    lines.sort(key=lambda line: (round(line["box"][:, 1].mean() / 12), line["box"][:, 0].min()) if line["box"] is not None else (0, 0))
    return lines


def to_plain(value):
    if isinstance(value, np.ndarray):
        return value.round(1).tolist()
    if isinstance(value, (np.floating, np.integer)):
        return value.item()
    if isinstance(value, (list, tuple)):
        return [to_plain(item) for item in value]
    return value


def table_cells(image: np.ndarray) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Find ruled table cells. Returns (label image, per-label [x, y, w, h]) or (None, None) without a ruled table.

    Text in a merged timetable cell is centred, so its own box does not show how many time columns the
    class spans; the cell's borders do.
    """
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    ink = cv2.adaptiveThreshold(255 - gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, -2)
    horizontal = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, width // 30), 1)))
    vertical = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(15, height // 30))))
    grid = cv2.dilate(horizontal | vertical, np.ones((3, 3), np.uint8))
    if cv2.countNonZero(horizontal) == 0 or cv2.countNonZero(vertical) == 0:
        return None, None
    count, labels, stats, _ = cv2.connectedComponentsWithStats(255 - grid, connectivity=4)
    boxes = stats[:, :4].copy()
    min_area = 0.0004 * width * height
    for label in range(count):
        x, y, w, h, area = stats[label]
        touches_edge = x == 0 or y == 0 or x + w >= width or y + h >= height
        if label == 0 or touches_edge or area < min_area:
            boxes[label] = -1  # background, page margin or noise: not a cell
        elif w > 0.55 * width:
            boxes[label] = -1  # a whole row between horizontal rules (list-style table), not a grid cell
    if (boxes[:, 0] >= 0).sum() < 4:
        return None, None
    return labels, boxes


def cell_for(box, labels: np.ndarray | None, boxes: np.ndarray | None):
    if labels is None or boxes is None or box is None:
        return None
    points = np.asarray(box, dtype=float).reshape(-1, 2)
    cx, cy = points.mean(axis=0)
    y, x = int(np.clip(cy, 0, labels.shape[0] - 1)), int(np.clip(cx, 0, labels.shape[1] - 1))
    x0, y0, w, h = boxes[labels[y, x]]
    return None if x0 < 0 else [int(x0), int(y0), int(x0 + w), int(y0 + h)]


class Handler(BaseHTTPRequestHandler):
    server_version = "openthai-ocr/1"

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self.send_json(200, {"ok": True, "backend": ocr.backend})
        else:
            self.send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/ocr":
            self.send_json(404, {"error": "not found"})
            return
        if TOKEN and self.headers.get("Authorization") != f"Bearer {TOKEN}":
            self.send_json(401, {"error": "unauthorized"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES:
            self.send_json(413, {"error": "image must be between 1 byte and 10 MB"})
            return

        data = np.frombuffer(self.rfile.read(length), dtype=np.uint8)
        image = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if image is None:
            self.send_json(415, {"error": "not a readable image"})
            return

        try:
            raw = attach_badges(read_page(image), day_badges(image))
        except Exception as error:  # noqa: BLE001
            self.send_json(500, {"error": "ocr failed", "details": str(error)[:300]})
            return

        labels, cell_boxes = table_cells(image)
        lines = [
            {
                "text": line["text"],
                "confidence": line["confidence"],
                "box": to_plain(line["box"]),
                "cell": cell_for(line["box"], labels, cell_boxes),
            }
            for line in raw
        ]
        height, width = image.shape[:2]
        self.send_json(200, {"width": width, "height": height, "lines": lines})

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write(f"[ocr] {self.address_string()} {fmt % args}\n")


if __name__ == "__main__":
    print(f"OpenThai OCR ({ocr.backend}) listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
