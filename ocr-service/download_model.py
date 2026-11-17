"""Download iapp/OpenThai2.0-OCR-Text (weights + runtime) into ./model and check SHA256SUMS.

Pinned to one Hugging Face revision so the runtime code we execute never changes underneath us.
Run once: python download_model.py
"""

from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

REPO = "iapp/OpenThai2.0-OCR-Text"
REVISION = "40e8e9ff752b65153b1a71d521ec9390882afd7e"
FILES = [
    "SHA256SUMS",
    "NOTICE",
    "config.json",
    "det.onnx",
    "det.yml",
    "rec.onnx",
    "rec_dict.txt",
    "runtime/__init__.py",
    "runtime/line_engine.py",
    "runtime/thai_norm.py",
]

MODEL_DIR = Path(__file__).resolve().parent / "model"


def download(name: str) -> None:
    target = MODEL_DIR / name
    target.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://huggingface.co/{REPO}/resolve/{REVISION}/{name}"
    print(f"  {name}")
    with urllib.request.urlopen(url, timeout=120) as response:
        target.write_bytes(response.read())


def verify() -> bool:
    sums = (MODEL_DIR / "SHA256SUMS").read_text(encoding="utf-8").splitlines()
    ok = True
    for line in sums:
        parts = line.split()
        if len(parts) != 2:
            continue
        digest, name = parts[0], parts[1].lstrip("*").removeprefix("./")
        path = MODEL_DIR / name
        if name not in FILES or not path.exists():
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != digest:
            print(f"  checksum mismatch: {name}")
            ok = False
    return ok


def main() -> int:
    print(f"Downloading {REPO}@{REVISION[:7]} into {MODEL_DIR}")
    for name in FILES:
        download(name)
    if not verify():
        print("Checksum check failed; delete ./model and try again.")
        return 1
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
