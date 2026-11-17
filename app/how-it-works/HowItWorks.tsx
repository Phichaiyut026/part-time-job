"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { SiteHeader } from "../site-header";
import { Chapter, HowHero, OcrPipeline, Reveal, useRevealReady } from "./HowHero";
import { SequenceDiagram } from "./SequenceDiagram";
import {
  loadTraceRaw,
  parseTrace,
  subscribeTrace,
  type ExtractionRow,
  type SearchTrace,
  type TraceActor,
  type TraceEvent,
} from "../trace";

const noopSubscribe = () => () => {};

/* ---------- Actors ---------- */

const actors: Array<{ id: TraceActor; name: string; sub: string; badge: string; dot: string; line: string }> = [
  { id: "browser", name: "เบราว์เซอร์", sub: "หน้าเว็บที่ผู้ใช้เห็น", badge: "bg-accent-soft text-accent-strong", dot: "bg-accent", line: "bg-accent" },
  { id: "server", name: "เซิร์ฟเวอร์แอป", sub: "/api/jobs · /api/explain", badge: "bg-class-soft text-class", dot: "bg-class", line: "bg-class" },
  { id: "ai", name: "AI · ThaiLLM", sub: "typhoon-s-thaillm-8b", badge: "bg-ai-soft text-ai", dot: "bg-ai", line: "bg-ai" },
  { id: "web", name: "เว็บภายนอก", sub: "SerpApi → Google Jobs", badge: "bg-job-soft text-job", dot: "bg-job", line: "bg-job" },
];
const actorIndex = (id: TraceActor) => actors.findIndex((actor) => actor.id === id);
const actorOf = (id: TraceActor) => actors[actorIndex(id)];

/* ---------- Page ---------- */

export function HowItWorks() {
  // localStorage only exists in the browser: the server snapshot is null so hydration matches,
  // then React re-reads it on the client.
  const raw = useSyncExternalStore(subscribeTrace, loadTraceRaw, () => null);
  const loaded = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const trace = useMemo(() => parseTrace(raw), [raw]);

  useRevealReady();

  return (
    <div className="min-h-dvh text-ink">
      <SiteHeader active="how" />
      <HowHero />
      <main className="mx-auto grid max-w-[1560px] gap-14 px-4 py-12 sm:px-6 lg:gap-20 lg:py-16">
        <section className="grid min-w-0 gap-6">
          <Reveal>
            <Chapter
              n="01"
              kicker="System architecture"
              id="arch-title"
              title="ข้อมูลเดินทางยังไง"
              sub="5 ระบบ 10 ขั้น ตั้งแต่กดค้นหาจนได้คำแนะนำ · กดที่เส้นไหนก็ได้เพื่อหยุดดูขั้นนั้น"
            />
          </Reveal>
          <Reveal delay={120}>
            <SequenceDiagram trace={trace} />
          </Reveal>
        </section>

        <section className="grid min-w-0 gap-6" aria-labelledby="ocr-title">
          <Reveal>
            <Chapter
              n="02"
              kicker="Timetable OCR"
              id="ocr-title"
              title="อ่านตารางเรียนจากรูป"
              sub="แคปหน้าระบบทะเบียนมาวาง แล้วให้ OCR กับ AI ช่วยกันแปลงเป็นตารางเรียนให้"
            />
          </Reveal>
          <Reveal delay={120}>
            <OcrPipeline />
          </Reveal>
        </section>

        <section aria-labelledby="tracking-title" className="grid min-w-0 gap-6">
          <Reveal>
            <Chapter
              n="03"
              kicker="Live tracking"
              id="tracking-title"
              title="การค้นหาล่าสุดของคุณ"
              sub="บันทึกจากการกด “ให้ Agent หางานให้” ครั้งล่าสุดในเบราว์เซอร์นี้"
              right={trace ? <TraceSummary trace={trace} /> : null}
            />
          </Reveal>
          {!loaded ? null : trace ? (
            <>
              <Reveal>
                <Timeline events={trace.events} />
              </Reveal>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <Reveal>
                  <Sources trace={trace} />
                </Reveal>
                <Reveal delay={120}>
                  <Removed trace={trace} />
                </Reveal>
              </div>
              <Reveal>
                <Extraction rows={trace.extraction} mode={trace.mode} />
              </Reveal>
            </>
          ) : (
            <Reveal>
              <div className="panel-glow grid place-items-center gap-3 px-6 py-14 text-center">
                <span className="bg-brand grid h-16 w-16 place-items-center rounded-3xl text-white shadow-lg" aria-hidden="true">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <p className="font-display text-xl font-semibold">ยังไม่มีการค้นหาในเบราว์เซอร์นี้</p>
                <p className="max-w-md text-sm text-muted">ลองค้นหาสักครั้ง แล้วกลับมาดูว่าแต่ละขั้นทำอะไร ใช้เวลาเท่าไหร่ และ AI อ่านอะไรจากแต่ละประกาศ</p>
                <Link href="/" className="btn-primary font-display mt-2 rounded-2xl px-5 py-3 text-sm font-semibold">
                  ไปหน้าค้นหางาน →
                </Link>
              </div>
            </Reveal>
          )}
        </section>

        <p className="pb-4 text-xs leading-6 text-faint">
          * ตารางเรียนใช้คำนวณในเครื่องเท่านั้น ยกเว้นตอนขอคำแนะนำ ซึ่งจะส่งตารางเรียนกับงาน 3 อันดับแรกไปให้ AI สรุป
          และตอนอัปโหลดรูปตาราง ซึ่งส่งรูปไปที่ระบบ OCR และส่งข้อความที่อ่านได้ไปให้ DeepSeek ·
          บันทึกการติดตามเก็บไว้ในเบราว์เซอร์นี้เครื่องเดียว และจะถูกแทนที่เมื่อค้นหาครั้งใหม่
        </p>
      </main>
    </div>
  );
}

/* ---------- Tracking ---------- */

function TraceSummary({ trace }: { trace: SearchTrace }) {
  const when = new Date(trace.at);
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <Pill className={trace.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}>{trace.ok ? "สำเร็จ" : "ไม่สำเร็จ"}</Pill>
      <Pill className="bg-class-soft text-ink">{trace.mode === "demo" ? "งานตัวอย่าง" : "งานจริง"}</Pill>
      <Pill className="bg-class-soft text-ink">
        “{trace.query}” · {trace.locationName}
      </Pill>
      <Pill className="bg-class-soft text-ink">รวม {formatMs(trace.totalMs)}</Pill>
      <Pill className="bg-class-soft text-muted">
        {when.toLocaleDateString("th-TH")} {when.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
      </Pill>
    </div>
  );
}

function Timeline({ events }: { events: TraceEvent[] }) {
  const maxMs = Math.max(1, ...events.map((event) => event.ms ?? 0));
  return (
    <div className="panel p-4 sm:p-6">
      <h3 className="font-bold">ลำดับเหตุการณ์ ({events.length} ขั้น)</h3>
      <ol className="mt-4 grid gap-0">
        {events.map((event, index) => {
          const actor = actorOf(event.actor);
          return (
            <li key={`${index}-${event.title}`} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
              {index < events.length - 1 ? (
                <span className="absolute bottom-0 left-[0.8rem] top-7 w-0.5 rounded-full bg-line" aria-hidden="true" />
              ) : null}
              <span className={`relative z-10 mt-0.5 grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white ${statusDot(event, actor.dot)}`}>
                {event.status === "error" ? "!" : index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ActorTag id={event.actor} />
                  <span className="font-semibold">{event.title}</span>
                  <StatusTag status={event.status} />
                  {event.ms !== undefined ? <span className="ml-auto text-xs tabular-nums text-muted">{formatMs(event.ms)}</span> : null}
                </div>
                <p className="mt-0.5 break-words text-sm leading-6 text-muted">{event.detail}</p>
                {event.ms ? (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-line/70">
                    <div className={`h-full rounded-full ${actor.line}`} style={{ width: `${Math.max(3, (event.ms / maxMs) * 100)}%` }} />
                  </div>
                ) : null}
                {event.list?.length ? (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {event.list.map((item) => (
                      <li key={item} className="rounded-md bg-sunken px-2 py-0.5 text-xs text-ink ring-1 ring-line">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Sources({ trace }: { trace: SearchTrace }) {
  const total = trace.sources.reduce((sum, source) => sum + source.count, 0);
  return (
    <div className="panel p-4 sm:p-6">
      <h3 className="font-bold">แหล่งที่มาของประกาศ</h3>
      <p className="text-sm text-muted">
        {trace.mode === "demo" ? "โหมดงานตัวอย่างใช้ข้อมูลสมมติในแอป" : "เว็บต้นทางที่ Google Jobs ดึงประกาศมาให้"}
      </p>
      {trace.sources.length ? (
        <ul className="mt-4 grid gap-2.5">
          {trace.sources.map((source) => (
            <li key={source.name}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate font-semibold">{source.name}</span>
                <span className="tabular-nums text-muted">{source.count} งาน</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-job-soft">
                <div className="h-full rounded-full bg-job" style={{ width: `${(source.count / Math.max(total, 1)) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-faint">ไม่มีข้อมูลแหล่งที่มา</p>
      )}
    </div>
  );
}

function Removed({ trace }: { trace: SearchTrace }) {
  return (
    <div className="panel p-4 sm:p-6">
      <h3 className="font-bold">งานที่ถูกตัดออก ({trace.removed.length})</h3>
      <p className="text-sm text-muted">ตัดก่อนจัดอันดับ จึงไม่แสดงในรายการงานที่แนะนำ</p>
      {trace.removed.length ? (
        <ul className="mt-4 grid gap-2">
          {trace.removed.map((job) => (
            <li key={`${job.title}-${job.company}`} className="rounded-lg bg-bad-soft/60 px-3 py-2">
              <div className="text-sm font-semibold">
                {job.title} <span className="font-normal text-muted">· {job.company}</span>
              </div>
              <div className="text-xs text-bad">{job.reason}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-faint">ไม่มีงานที่ถูกตัดออก</p>
      )}
    </div>
  );
}

const verdictInfo: Record<ExtractionRow["verdict"], { label: string; className: string }> = {
  accepted: { label: "ยืนยันแล้ว", className: "bg-good-soft text-good" },
  rejected: { label: "ไม่ผ่านการตรวจ", className: "bg-bad-soft text-bad" },
  "nothing-stated": { label: "ประกาศไม่ระบุ", className: "bg-warn-soft text-warn" },
  "no-answer": { label: "AI ไม่ได้ตอบ", className: "bg-class-soft text-muted" },
};

function Extraction({ rows, mode }: { rows: ExtractionRow[]; mode: SearchTrace["mode"] }) {
  return (
    <div className="panel @container p-4 sm:p-6">
      <h3 className="font-bold">AI อ่านอะไรจากแต่ละประกาศ</h3>
      <p className="text-sm text-muted">
        เทียบสิ่งที่ AI บอกว่าเจอ กับสิ่งที่โค้ดยืนยันได้จากข้อความในประกาศจริง (ใช้เฉพาะที่ยืนยันได้)
      </p>
      {rows.length ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_7.5rem] gap-3 border-b border-line bg-sunken px-4 py-2 text-xs font-semibold text-muted @3xl:grid">
            <span>ประกาศ</span>
            <span>จากเว็บ</span>
            <span>AI บอกว่าเจอ</span>
            <span>ใช้ได้จริง</span>
            <span>ผลตรวจ</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((row, index) => (
              <li
                key={`${index}-${row.title}`}
                className="grid gap-1 px-4 py-2.5 text-sm @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_7.5rem] @3xl:items-center @3xl:gap-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{row.title}</span>
                  <span className="block truncate text-xs text-muted">{row.company}</span>
                </span>
                <span className="truncate text-muted">{row.via}</span>
                <span className="text-muted">
                  <span className="@3xl:hidden">AI: </span>
                  {describeFound(row.aiShifts, row.aiWage)}
                </span>
                <span>
                  <span className="text-muted @3xl:hidden">ใช้ได้: </span>
                  {describeFound(row.keptShifts, row.keptWage)}
                </span>
                <span>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${verdictInfo[row.verdict].className}`}>
                    {verdictInfo[row.verdict].label}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-faint">
          {mode === "demo" ? "โหมดงานตัวอย่างมีวัน-เวลาอยู่แล้ว จึงไม่ต้องให้ AI อ่าน" : "ไม่มีข้อมูลการอ่านประกาศ"}
        </p>
      )}
    </div>
  );
}

/* ---------- Small pieces ---------- */

function describeFound(shifts: number, wage: number | null) {
  const parts = [shifts ? `${shifts} กะ` : "ไม่มีเวลา", wage !== null ? `${wage} บาท/ชม.` : "ไม่มีค่าจ้าง"];
  return parts.join(" · ");
}

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} วิ` : `${Math.round(ms)} ms`;
}

function statusDot(event: TraceEvent, actorDot: string) {
  if (event.status === "error") return "bg-bad";
  if (event.status === "skip") return "bg-faint";
  return actorDot;
}

function ActorTag({ id }: { id: TraceActor }) {
  const actor = actorOf(id);
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${actor.badge}`}>{actor.name}</span>;
}

function StatusTag({ status }: { status: TraceEvent["status"] }) {
  if (status === "ok") return null;
  const info = {
    cached: { label: "ใช้ผลที่เก็บไว้", className: "bg-job-soft text-job" },
    skip: { label: "ข้าม", className: "bg-class-soft text-muted" },
    error: { label: "ผิดพลาด", className: "bg-bad-soft text-bad" },
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${info.className}`}>{info.label}</span>;
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-3 py-1 font-semibold ${className}`}>{children}</span>;
}
