import { llmConfigured, parseJsonObject, requestLLM } from "../../llm";
import { runOcr, type OcrResult } from "../../ocr-client";

export const runtime = "edge";

/**
 * Timetable picture -> class blocks.
 * 1. OpenThai2.0-OCR-Text (ocr-service/, a separate Python process) reads the text lines and their boxes.
 * 2. DeepSeek reads those lines and returns class blocks as JSON.
 * 3. This code validates every block; the student reviews them before they replace the schedule.
 * The image is only held in memory for this request.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type Day = (typeof DAYS)[number];


export type OcrScheduleBlock = { day: Day; start: string; end: string; subject: string };

const DAY_ALIASES: Array<[RegExp, Day]> = [
  [/^(mon|monday|จ|จ\.|จันทร์|วันจันทร์)$/i, "Monday"],
  [/^(tue|tues|tuesday|อ|อ\.|อังคาร|วันอังคาร)$/i, "Tuesday"],
  [/^(wed|wednesday|พ|พ\.|พุธ|วันพุธ)$/i, "Wednesday"],
  [/^(thu|thur|thurs|thursday|พฤ|พฤ\.|พฤหัส|พฤหัสบดี|วันพฤหัสบดี)$/i, "Thursday"],
  [/^(fri|friday|ศ|ศ\.|ศุกร์|วันศุกร์)$/i, "Friday"],
  [/^(sat|saturday|ส|ส\.|เสาร์|วันเสาร์)$/i, "Saturday"],
  [/^(sun|sunday|อา|อา\.|อาทิตย์|วันอาทิตย์)$/i, "Sunday"],
];

function toDay(value: unknown): Day | null {
  const text = String(value ?? "").trim();
  return DAY_ALIASES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** "8.00", "8:00", "08:00 น." -> "08:00"; null if not a real time. */
function toTime(value: unknown): string | null {
  const match = String(value ?? "").match(/(\d{1,2})\s*[:.]\s*(\d{2})/) ?? String(value ?? "").match(/^\s*(\d{1,2})\s*$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/** Box from the OCR runtime: 4 corner points or [x1, y1, x2, y2] -> rounded [left, top, right, bottom]. */
function boxBounds(box: unknown): [number, number, number, number] | null {
  if (!Array.isArray(box)) return null;
  const points = box.every((point) => Array.isArray(point))
    ? (box as number[][])
    : box.length === 4
      ? [[box[0], box[1]], [box[2], box[3]]] as number[][]
      : null;
  if (!points) return null;
  const xs = points.map((point) => Number(point[0]));
  const ys = points.map((point) => Number(point[1]));
  if ([...xs, ...ys].some((n) => !Number.isFinite(n))) return null;
  return [Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.max(...xs)), Math.round(Math.max(...ys))];
}

/**
 * One entry per table cell (lines wrapped inside a cell are joined), or per text line when the picture has
 * no ruled table. "cell" bounds tell exactly which time columns a merged class cell covers.
 */
function ocrEntries(ocr: OcrResult) {
  const entries: Array<{ kind: "cell" | "text"; bounds: number[] | null; text: string }> = [];
  const byCell = new Map<string, (typeof entries)[number]>();
  for (const line of ocr.lines.slice(0, 400)) {
    const text = line.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const cell = boxBounds(line.cell);
    if (cell) {
      const key = cell.join(",");
      const existing = byCell.get(key);
      if (existing) existing.text += ` ${text}`;
      else {
        const entry = { kind: "cell" as const, bounds: cell, text };
        byCell.set(key, entry);
        entries.push(entry);
      }
    } else {
      entries.push({ kind: "text", bounds: boxBounds(line.box), text });
    }
  }
  return entries;
}

function buildPrompt(ocr: OcrResult) {
  const entries = ocrEntries(ocr);
  const hasCells = entries.some((entry) => entry.kind === "cell");
  const lines = entries.map((entry) => `${entry.bounds ? `${entry.kind}[${entry.bounds.join(",")}] ` : ""}${entry.text}`).join("\n");

  return `
The entries below were read by OCR from a picture of a Thai student's weekly class timetable (school or university).
Coordinates are pixels [left,top,right,bottom] on a ${ocr.width}x${ocr.height} image. OCR can misread characters.
${
  hasCells
    ? `"cell[...]" = the ruled table cell that holds the text (its true borders, so a merged cell is wide).
"text[...]" = text outside any ruled cell.`
    : `"text[...]" = the box around the text itself. The picture has no ruled table lines.`
}

Your job: list every class meeting as day + start time + end time.
- Timetables are often a grid: days down the left side and times across the top (or the opposite).
  Match each course cell to its day row (same vertical position) and to every time column it overlaps horizontally.
  A header like "8:00" or "8:00-9:00" names one column; a class covering columns 8:00, 9:00 and 10:00 of one-hour columns runs 08:00-11:00.
  Work out the column length from the headers; if a header gives a range, use it.
- Other timetables are lists (common in university registration systems): one row per class meeting with
  columns such as course code, name, credits, section, day, time (e.g. 09:00-10:40), room, teacher.
  Group text into rows by vertical position, then read the day and time columns of each row.
  A row without a course code is another meeting of the course above it (e.g. lecture + lab): list it too.
- Thai days: จ/จันทร์=Monday, อ/อังคาร=Tuesday, พ/พุธ=Wednesday, พฤ/พฤหัสบดี=Thursday, ศ/ศุกร์=Friday, ส/เสาร์=Saturday, อา/อาทิตย์=Sunday.
- Day letter codes: M=Monday, T=Tuesday, W=Wednesday, H or R=Thursday, F=Friday, S or Sa=Saturday, U or Su=Sunday.
- "[day badge: colour X, letter Y]" is a coloured square in the day column. Thai day colours:
  yellow=Monday, pink=Tuesday, green=Wednesday, orange=Thursday, light-blue or blue=Friday, purple=Saturday, red=Sunday.
  The OCR letter in a badge is often wrong or missing; when letter and colour disagree, trust a letter that is a valid
  day code, otherwise the colour, and add a note asking the student to check that day.
- Ignore columns that are not class meetings: exam dates/times (สอบกลางภาค, สอบปลายภาค), online links, contacts.
- OCR may misread digits in times (0 vs 6 vs อ, 1 vs l): fix to a sensible time, and note it if unsure.
- If the timetable uses periods (คาบ 1, คาบ 2...) and the picture states each period's time, convert them.
  If period times are not in the picture, do not guess: leave those classes out and say so in notes.
- subject: a short course code or name for the student to recognise it (may be empty).
- Never invent classes, days or times that are not supported by the text.

Answer with JSON only:
{"blocks":[{"day":"Monday","start":"09:00","end":"12:00","subject":"01076001 Math"}],"notes":["short Thai note"]}
notes: only about class days and times the student must check (a guessed day, an unclear time, a class left out).
Never about rooms, teachers, course names, exams or empty days. Use [] when everything was clear.

OCR entries:
${lines}
`.trim();
}

function cleanBlocks(raw: unknown): { blocks: OcrScheduleBlock[]; dropped: number } {
  const blocks: OcrScheduleBlock[] = [];
  let dropped = 0;
  for (const item of Array.isArray(raw) ? raw : []) {
    const record = (item ?? {}) as Record<string, unknown>;
    const day = toDay(record.day);
    const start = toTime(record.start);
    const end = toTime(record.end);
    if (!day || !start || !end || minutes(end) <= minutes(start) || minutes(end) - minutes(start) > 12 * 60) {
      dropped += 1;
      continue;
    }
    const subject = String(record.subject ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (blocks.some((block) => block.day === day && block.start === start && block.end === end)) continue;
    blocks.push({ day, start, end, subject });
  }
  blocks.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || minutes(a.start) - minutes(b.start));
  return { blocks, dropped };
}

export async function POST(request: Request) {
  if (!llmConfigured("deepseek")) {
    return Response.json({ error: "ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY", code: "no-llm" }, { status: 500 });
  }

  let image: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("image");
    image = value instanceof File ? value : null;
  } catch {
    // handled below
  }
  if (!image || image.size === 0) return Response.json({ error: "กรุณาเลือกรูปตารางเรียน" }, { status: 400 });
  if (!/^image\/(png|jpe?g|webp|bmp)$/.test(image.type)) {
    return Response.json({ error: "รองรับเฉพาะรูป PNG, JPG หรือ WebP" }, { status: 415 });
  }
  if (image.size > MAX_IMAGE_BYTES) return Response.json({ error: "รูปใหญ่เกิน 10 MB" }, { status: 413 });

  const started = Date.now();
  const ocr = await runOcr(image);
  if (!ocr.ok) {
    console.error("[schedule ocr] OCR failed", ocr);
    return Response.json(
      { error: ocr.status === 503 ? "ระบบอ่านรูป (OCR) ยังไม่เปิด หรือเชื่อมต่อไม่ได้" : "อ่านข้อความจากรูปไม่สำเร็จ", code: "ocr" },
      { status: 502 },
    );
  }
  const ocrMs = Date.now() - started;
  if (!ocr.data.lines.length) {
    return Response.json({ error: "ไม่พบตัวอักษรในรูป ลองใช้รูปที่ชัดขึ้นหรือแคปหน้าจอแทนการถ่ายรูป", code: "empty" }, { status: 422 });
  }

  const llm = await requestLLM({
    provider: "deepseek",
    system: "You turn OCR text of class timetables into structured JSON. Be literal and careful. Notes must be in Thai.",
    user: buildPrompt(ocr.data),
    json: true,
    temperature: 0,
    maxTokens: 2000,
  });
  if (!llm.ok) {
    console.error("[schedule ocr] DeepSeek failed", llm);
    return Response.json({ error: "AI อ่านตารางไม่สำเร็จ ลองใหม่อีกครั้ง", code: "llm" }, { status: 502 });
  }

  const parsed = parseJsonObject(llm.text);
  const { blocks, dropped } = cleanBlocks(parsed?.blocks);
  const notes = (Array.isArray(parsed?.notes) ? parsed.notes : [])
    .map((note) => String(note).trim())
    .filter(Boolean)
    .slice(0, 5);
  if (dropped) notes.push(`ตัดช่วงที่วันหรือเวลาไม่ถูกต้องออก ${dropped} ช่วง`);

  return Response.json({
    blocks,
    notes,
    ocr: { lines: ocr.data.lines.length, ms: ocrMs },
    totalMs: Date.now() - started,
  });
}
