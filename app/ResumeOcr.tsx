"use client";

import { useRef, useState, type DragEvent } from "react";
import type { ResumeProfile } from "./job-logic";

/** What the student chose to use from their resume. */
export type AppliedResume = {
  fileName: string;
  role: string;
  skills: string[];
  interests: string[];
  keywords: string[];
};

type ResumeState =
  | { status: "idle" }
  | { status: "reading"; fileName: string; step: string }
  | {
      status: "review";
      fileName: string;
      profile: ResumeProfile;
      role: string;
      skills: string[];
      interests: string[];
      keywords: string[];
      seconds: number;
      viaOcr: boolean;
    }
  | { status: "error"; message: string };

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/* ---------- PDF: real text if the PDF has it, else render pages to one picture for OCR ---------- */

async function loadPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    // Run the worker from its untouched source: the dev server injects its browser client (which needs
    // `window`) into served modules, and that breaks module workers.
    const { default: source } = await import("pdfjs-dist/build/pdf.worker.min.mjs?raw");
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(url, { type: "module" });
  }
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

type PdfDoc = Awaited<ReturnType<typeof loadPdf>>;

async function pdfText(pdf: PdfDoc) {
  const pages: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 3); n += 1) {
    const content = await (await pdf.getPage(n)).getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (item.str && !line.endsWith(" ")) line += " ";
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

/** Scanned or design-tool PDFs often have no usable text layer. */
function looksReadable(text: string) {
  const letters = text.match(/[A-Za-z฀-๿]/g)?.length ?? 0;
  const broken = text.match(/[�-]/g)?.length ?? 0;
  return letters >= 80 && broken < letters * 0.05;
}

async function pdfToImage(pdf: PdfDoc): Promise<File> {
  const count = Math.min(pdf.numPages, 2);
  const canvases: HTMLCanvasElement[] = [];
  for (let n = 1; n <= count; n += 1) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1400 / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    canvases.push(canvas);
  }
  const sheet = document.createElement("canvas");
  sheet.width = Math.max(...canvases.map((canvas) => canvas.width));
  sheet.height = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
  const context = sheet.getContext("2d");
  if (!context) throw new Error("canvas");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, sheet.width, sheet.height);
  let y = 0;
  for (const canvas of canvases) {
    context.drawImage(canvas, 0, y);
    y += canvas.height;
  }
  const blob = await new Promise<Blob | null>((resolve) => sheet.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("canvas");
  return new File([blob], "resume.jpg", { type: "image/jpeg" });
}

/**
 * "Read my resume": PDF or picture -> text (pdf.js, or OpenThai OCR for pictures/scans) -> AI picks roles,
 * skills and keywords -> the student reviews -> they shape the search and the ranking. Nothing is stored.
 */
export function ResumeOcr({
  applied,
  onApply,
  onClear,
}: {
  applied: AppliedResume | null;
  onApply: (resume: AppliedResume) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ResumeState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const busy = state.status === "reading";

  async function readFile(file: File) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf && !IMAGE_TYPES.includes(file.type)) {
      setState({ status: "error", message: "รองรับไฟล์ PDF, PNG, JPG หรือ WebP" });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ status: "error", message: "ไฟล์ใหญ่เกิน 10 MB" });
      return;
    }

    const fileName = file.name || "เรซูเม่";
    const started = performance.now();
    const form = new FormData();
    let viaOcr = !isPdf;
    try {
      if (isPdf) {
        setState({ status: "reading", fileName, step: "กำลังเปิดไฟล์ PDF…" });
        const pdf = await loadPdf(file);
        const text = await pdfText(pdf);
        if (looksReadable(text)) {
          form.append("text", text);
        } else {
          viaOcr = true;
          setState({ status: "reading", fileName, step: "PDF นี้เป็นภาพ กำลังให้ OCR อ่านตัวอักษร…" });
          form.append("image", await pdfToImage(pdf));
        }
        void pdf.destroy();
      } else {
        form.append("image", file);
      }
    } catch {
      setState({ status: "error", message: "เปิดไฟล์ PDF ไม่ได้ ไฟล์อาจเสียหรือมีรหัสผ่าน" });
      return;
    }

    setState({
      status: "reading",
      fileName,
      step: viaOcr ? "OCR อ่านตัวอักษร แล้ว AI สรุปทักษะและตำแหน่งที่เหมาะ…" : "AI กำลังสรุปทักษะและตำแหน่งที่เหมาะกับคุณ…",
    });
    try {
      const response = await fetch("/api/resume", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as { profile?: ResumeProfile; error?: string } | null;
      if (!response.ok || !data?.profile) {
        setState({ status: "error", message: data?.error ?? "อ่านเรซูเม่ไม่สำเร็จ ลองใหม่อีกครั้ง" });
        return;
      }
      const profile = data.profile;
      setState({
        status: "review",
        fileName,
        profile,
        role: profile.roles[0] ?? "",
        skills: profile.skills,
        interests: profile.interests,
        keywords: profile.keywords,
        seconds: Math.round((performance.now() - started) / 100) / 10,
        viaOcr,
      });
    } catch {
      setState({ status: "error", message: "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" });
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !busy) void readFile(file);
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
      className="sr-only"
      aria-label="เลือกไฟล์เรซูเม่"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void readFile(file);
      }}
    />
  );

  /* Already applied: a compact summary the student can replace or remove */
  if (applied && state.status !== "reading" && state.status !== "review") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-good/25 bg-good-soft px-3.5 py-3">
        {fileInput}
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-good ring-1 ring-good/20">
          <DocIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">ใช้ข้อมูลจากเรซูเม่แล้ว</p>
          <p className="truncate text-xs text-muted">
            {applied.role ? `ค้นหา "${applied.role}" · ` : ""}
            จัดอันดับด้วย {applied.keywords.length + (applied.role ? 1 : 0)} คำจากเรซูเม่
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-accent-strong hover:bg-surface"
        >
          เปลี่ยน
        </button>
        <button type="button" onClick={onClear} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface hover:text-bad">
          เอาออก
        </button>
      </div>
    );
  }

  return (
    <div>
      {fileInput}

      {(state.status === "idle" || state.status === "error") && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-wrap items-center gap-3.5 rounded-2xl border-2 border-dashed px-4 py-3.5 transition ${
            dragging ? "border-ai bg-ai-soft" : "border-line bg-sunken hover:border-line-strong"
          }`}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-ai shadow-sm ring-1 ring-line">
            <DocIcon />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-sm font-bold">{dragging ? "ปล่อยไฟล์ที่นี่ได้เลย" : "มีเรซูเม่? ให้ AI ช่วยหางานที่ตรงกับคุณ"}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">PDF หรือรูปภาพ · AI ดึงทักษะและตำแหน่งที่เหมาะ ไปใช้ค้นหาและจัดอันดับ · ไม่เก็บไฟล์</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ai/30 bg-surface px-3.5 py-2 text-sm font-semibold text-ai transition hover:border-ai hover:bg-ai-soft"
          >
            <UploadIcon />
            อัปโหลดเรซูเม่
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
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ai-soft text-ai">
            <DocIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">กำลังอ่าน {state.fileName}</p>
            <p className="mt-0.5 text-xs text-muted">{state.step}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className="ocr-progress h-full w-1/3 rounded-full bg-ai" />
            </div>
          </div>
        </div>
      )}

      {state.status === "review" && (
        <ResumeReview
          state={state}
          onChange={(next) => setState({ ...state, ...next })}
          onCancel={() => setState({ status: "idle" })}
          onApply={() => {
            onApply({
              fileName: state.fileName,
              role: state.role,
              skills: state.skills,
              interests: state.interests,
              keywords: state.keywords,
            });
            setState({ status: "idle" });
          }}
        />
      )}
    </div>
  );
}

function ResumeReview({
  state,
  onChange,
  onApply,
  onCancel,
}: {
  state: Extract<ResumeState, { status: "review" }>;
  onChange: (next: Partial<Pick<Extract<ResumeState, { status: "review" }>, "role" | "skills" | "interests" | "keywords">>) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { profile } = state;
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const nothing = !state.role && !state.skills.length && !state.interests.length && !state.keywords.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" aria-live="polite">
      <div className="flex items-center gap-3 border-b border-line bg-ai-soft/60 px-3.5 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-ai ring-1 ring-ai/20">
          <DocIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-good text-[10px] text-white" aria-hidden="true">✓</span>
            AI อ่านเรซูเม่แล้ว
          </h3>
          <p className="truncate text-xs text-muted">
            {state.fileName} · {state.viaOcr ? "อ่านด้วย OCR · " : ""}
            {state.seconds} วินาที · กดเพื่อเลือก/ไม่เลือก
          </p>
        </div>
      </div>

      <div className="grid gap-3.5 p-3.5">
        {profile.summary && <p className="rounded-xl bg-sunken px-3 py-2 text-sm leading-6 text-ink">{profile.summary}</p>}

        {profile.roles.length > 0 && (
          <Group title="ตำแหน่งที่ใช้ค้นหา" hint="เลือก 1 ตำแหน่ง จะใส่ในช่องตำแหน่งงานให้">
            {profile.roles.map((role) => (
              <Pill key={role} active={state.role === role} onClick={() => onChange({ role: state.role === role ? "" : role })} radio>
                {role}
              </Pill>
            ))}
          </Group>
        )}

        {(profile.skills.length > 0 || profile.interests.length > 0) && (
          <Group title="ทักษะและความสนใจ" hint="เพิ่มเข้าไปในตัวเลือกด้านล่าง">
            {profile.skills.map((skill) => (
              <Pill key={`s-${skill}`} active={state.skills.includes(skill)} onClick={() => onChange({ skills: toggle(state.skills, skill) })}>
                {skill}
              </Pill>
            ))}
            {profile.interests.map((interest) => (
              <Pill
                key={`i-${interest}`}
                active={state.interests.includes(interest)}
                onClick={() => onChange({ interests: toggle(state.interests, interest) })}
              >
                {interest}
              </Pill>
            ))}
          </Group>
        )}

        {profile.keywords.length > 0 && (
          <Group title="คำสำคัญจากเรซูเม่" hint="งานที่ประกาศพูดถึงคำเหล่านี้จะได้อันดับสูงขึ้น">
            {profile.keywords.map((keyword) => (
              <Pill key={`k-${keyword}`} active={state.keywords.includes(keyword)} onClick={() => onChange({ keywords: toggle(state.keywords, keyword) })}>
                {keyword}
              </Pill>
            ))}
          </Group>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-3">
        <button type="button" onClick={onApply} disabled={nothing} className="btn-primary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">
          ใช้ข้อมูลนี้หางาน
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-sunken hover:text-ink">
          ยกเลิก
        </button>
        <p className="ml-auto text-[11px] leading-4 text-faint">ไม่เก็บไฟล์และไม่ส่งชื่อ/เบอร์โทรไปค้นหา</p>
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-ink">
        {title} <span className="font-normal text-faint">· {hint}</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, radio, children }: { active: boolean; onClick: () => void; radio?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-transparent bg-ai text-white shadow-[0_6px_14px_-8px_rgb(124_58_237/0.9)]"
          : `border-line bg-surface text-muted hover:border-ai/40 hover:text-ai ${radio ? "" : "opacity-70"}`
      }`}
    >
      {active && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}

function DocIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <circle cx="12" cy="12.5" r="2" />
      <path d="M8.5 18a3.5 3.5 0 0 1 7 0" />
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
