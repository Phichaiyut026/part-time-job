/**
 * Client for the OpenThai OCR service (ocr-service/, a separate Python process).
 * OCR_SERVICE_URL, OCR_SERVICE_TOKEN
 */

export type OcrLine = { text: string; confidence?: number; box?: unknown; cell?: unknown };
export type OcrResult = { width: number; height: number; lines: OcrLine[] };

export async function runOcr(image: File): Promise<{ ok: true; data: OcrResult } | { ok: false; status: number; error: string }> {
  const baseUrl = (process.env.OCR_SERVICE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": image.type || "application/octet-stream" };
  if (process.env.OCR_SERVICE_TOKEN) headers.Authorization = `Bearer ${process.env.OCR_SERVICE_TOKEN}`;
  try {
    const response = await fetch(`${baseUrl}/ocr`, {
      method: "POST",
      headers,
      body: await image.arrayBuffer(),
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await response.json().catch(() => null)) as (OcrResult & { error?: string }) | null;
    if (!response.ok || !data || !Array.isArray(data.lines)) {
      return { ok: false, status: response.status || 502, error: data?.error ?? "OCR service error" };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, status: 503, error: error instanceof Error ? error.message : "OCR service unreachable" };
  }
}

/** Lines in reading order (top to bottom, then left to right), joined as plain text. */
export function ocrPlainText(ocr: OcrResult) {
  const top = (line: OcrLine) => {
    const box = line.box;
    if (!Array.isArray(box)) return 0;
    const ys = box.flatMap((point) => (Array.isArray(point) ? [Number(point[1])] : [])).filter(Number.isFinite);
    return ys.length ? Math.min(...ys) : Number(box[1]) || 0;
  };
  return [...ocr.lines]
    .sort((a, b) => top(a) - top(b))
    .map((line) => line.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
