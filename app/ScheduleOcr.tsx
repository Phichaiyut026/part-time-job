"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { thaiDayNames, type Day, type Shift } from "./job-logic";

type OcrBlock = Shift & { subject: string };

type OcrState =
  | { status: "idle" }
  | { status: "reading"; fileName: string; preview: string }
  | { status: "review"; blocks: OcrBlock[]; notes: string[]; selected: boolean[]; seconds: number; preview: string }
  | { status: "error"; message: string };

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/** Thai day colours, so each class row is easy to scan (and matches how many registration pages colour days). */
const DAY_TONE: Record<Day, { dot: string; chip: string }> = {
  Monday: { dot: "bg-[#eab308]", chip: "bg-[#fef9c3] text-[#854d0e]" },
  Tuesday: { dot: "bg-[#ec4899]", chip: "bg-[#fce7f3] text-[#9d174d]" },
  Wednesday: { dot: "bg-[#16a34a]", chip: "bg-[#dcfce7] text-[#166534]" },
  Thursday: { dot: "bg-[#f97316]", chip: "bg-[#ffedd5] text-[#9a3412]" },
  Friday: { dot: "bg-[#0ea5e9]", chip: "bg-[#e0f2fe] text-[#075985]" },
  Saturday: { dot: "bg-[#8b5cf6]", chip: "bg-[#ede9fe] text-[#5b21b6]" },
  Sunday: { dot: "bg-[#ef4444]", chip: "bg-[#fee2e2] text-[#991b1b]" },
};

/**
 * "Read my timetable from a picture": upload, drop or paste -> OCR (OpenThai2.0-OCR-Text) -> DeepSeek
 * -> the student reviews -> apply. Nothing replaces the painted grid until the student presses "ใช้ตารางนี้".
 */
export function ScheduleOcr({ onApply }: { onApply: (blocks: Shift[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<OcrState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const busy = state.status === "reading";

  // Free the preview image when it is no longer shown.
  const preview = state.status === "reading" || state.status === "review" ? state.preview : null;
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function readImage(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      setState({ status: "error", message: "รองรับเฉพาะรูป PNG, JPG หรือ WebP" });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setState({ status: "reading", fileName: file.name || "ภาพที่วาง", preview: previewUrl });
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/schedule/ocr", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as
        | { blocks?: OcrBlock[]; notes?: string[]; totalMs?: number; error?: string }
        | null;
      if (!response.ok || !data?.blocks) {
        setState({ status: "error", message: data?.error ?? "อ่านตารางไม่สำเร็จ ลองใหม่อีกครั้ง" });
        return;
      }
      if (!data.blocks.length) {
        setState({ status: "error", message: ["อ่านรูปได้ แต่ไม่พบช่วงเวลาเรียนที่แน่ชัด", ...(data.notes ?? [])].join(" · ") });
        return;
      }
      setState({
        status: "review",
        blocks: data.blocks,
        notes: data.notes ?? [],
        selected: data.blocks.map(() => true),
        seconds: Math.round((data.totalMs ?? 0) / 100) / 10,
        preview: previewUrl,
      });
    } catch {
      setState({ status: "error", message: "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" });
    }
  }

  // Ctrl+V a screenshot anywhere on the page (except while typing in a field).
  const readRef = useRef(readImage);
  useEffect(() => {
    readRef.current = readImage;
  });
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      void readRef.current(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !busy) void readImage(file);
  }

  function apply() {
    if (state.status !== "review") return;
    onApply(state.blocks.filter((_, index) => state.selected[index]).map(({ day, start, end }) => ({ day, start, end })));
    setState({ status: "idle" });
  }

  const outsideGrid = (block: OcrBlock) => block.start < "07:00" || block.end > "22:00";

  return (
    <div className="mt-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        aria-label="เลือกรูปตารางเรียน"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void readImage(file);
        }}
      />

      {(state.status === "idle" || state.status === "error") && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`group flex flex-wrap items-center gap-3.5 rounded-2xl border-2 border-dashed px-4 py-3.5 transition ${
            dragging ? "border-accent bg-accent-soft" : "border-line bg-sunken hover:border-line-strong"
          }`}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-accent shadow-sm ring-1 ring-line">
            <ImageIcon />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-sm font-bold">{dragging ? "ปล่อยรูปที่นี่ได้เลย" : "มีรูปตารางเรียน? ให้ AI อ่านให้"}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              ลากรูปมาวาง, กด <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> วางภาพแคป หรือเลือกไฟล์ · ตรวจก่อนใช้ทุกครั้ง
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-surface px-3.5 py-2 text-sm font-semibold text-accent-strong transition hover:border-accent hover:bg-accent-soft"
          >
            <UploadIcon />
            เลือกรูป
          </button>
          {state.status === "error" && (
            <p role="alert" className="flex w-full items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-xs leading-5 text-bad">
              <span aria-hidden="true" className="mt-px font-bold">!</span>
              <span>{state.message}</span>
            </p>
          )}
        </div>
      )}

      {state.status === "reading" && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-3" role="status" aria-live="polite">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={state.preview} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover object-top ring-1 ring-line" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">กำลังอ่าน {state.fileName}</p>
            <p className="mt-0.5 text-xs text-muted">OCR อ่านตัวอักษร แล้ว AI แปลงเป็นวันและเวลาเรียน · ใช้เวลาไม่กี่วินาที</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className="ocr-progress h-full w-1/3 rounded-full bg-accent" />
            </div>
          </div>
        </div>
      )}

      {state.status === "review" && (
        <ReviewPanel
          state={state}
          onToggle={(index) => setState({ ...state, selected: state.selected.map((value, i) => (i === index ? !value : value)) })}
          onToggleAll={(value) => setState({ ...state, selected: state.selected.map(() => value) })}
          onApply={apply}
          onCancel={() => setState({ status: "idle" })}
          outsideGrid={outsideGrid}
        />
      )}
    </div>
  );
}

function ReviewPanel({
  state,
  onToggle,
  onToggleAll,
  onApply,
  onCancel,
  outsideGrid,
}: {
  state: Extract<OcrState, { status: "review" }>;
  onToggle: (index: number) => void;
  onToggleAll: (value: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
  outsideGrid: (block: OcrBlock) => boolean;
}) {
  const chosen = state.selected.filter(Boolean).length;
  const allChosen = chosen === state.blocks.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" aria-live="polite">
      <div className="flex items-center gap-3 border-b border-line bg-sunken px-3.5 py-3">
        <a href={state.preview} target="_blank" rel="noreferrer" className="shrink-0" title="ดูรูปเต็ม">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={state.preview} alt="รูปตารางที่อัปโหลด" className="h-11 w-16 rounded-lg object-cover object-top ring-1 ring-line" />
        </a>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-good text-[10px] text-white" aria-hidden="true">✓</span>
            AI อ่านได้ {state.blocks.length} ช่วง
          </h3>
          <p className="text-xs text-muted">ติ๊กออกช่วงที่อ่านผิด · ใช้เวลา {state.seconds} วินาที</p>
        </div>
        <button
          type="button"
          onClick={() => onToggleAll(!allChosen)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-accent-strong hover:bg-accent-soft"
        >
          {allChosen ? "ไม่เลือกเลย" : "เลือกทั้งหมด"}
        </button>
      </div>

      <ul className="grid max-h-72 grid-cols-[minmax(0,1fr)] gap-0.5 overflow-y-auto p-1.5">
        {state.blocks.map((block, index) => {
          const tone = DAY_TONE[block.day as Day];
          const on = state.selected[index];
          return (
            <li key={`${block.day}-${block.start}-${index}`}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition ${
                  on ? "hover:bg-sunken" : "opacity-50 hover:opacity-80"
                }`}
              >
                <input type="checkbox" checked={on} onChange={() => onToggle(index)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
                <span className={`inline-flex w-[5.5rem] shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${tone.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                  {thaiDayNames[block.day as Day]}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {block.start}–{block.end}
                </span>
                <span className={`min-w-0 flex-1 truncate text-xs text-muted ${on ? "" : "line-through"}`}>{block.subject}</span>
                {outsideGrid(block) && (
                  <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">นอก 07–22 น.</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {state.notes.length > 0 && (
        <div className="mx-3.5 mb-3 rounded-xl bg-warn-soft px-3 py-2.5 text-xs leading-5 text-warn">
          <p className="mb-0.5 font-bold">ควรตรวจอีกครั้ง</p>
          <ul className="grid gap-0.5">
            {state.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-3">
        <button
          type="button"
          onClick={onApply}
          disabled={!chosen}
          className="btn-primary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
        >
          ใช้ตารางนี้ ({chosen})
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-sunken hover:text-ink"
        >
          ยกเลิก
        </button>
        <p className="ml-auto text-[11px] leading-4 text-faint">แทนที่ตารางเดิม · ปัดเป็นรายชั่วโมง · ไม่เก็บรูป</p>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface px-1 font-sans text-[10px] font-semibold text-ink">{children}</kbd>;
}

function ImageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M9 4v16" />
      <path d="M13 14h4M13 17h2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
