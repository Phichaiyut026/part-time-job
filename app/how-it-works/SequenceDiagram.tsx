"use client";

import { useEffect, useState } from "react";
import type { SearchTrace, TraceEvent } from "../trace";

/* ---------- Lanes (who talks to whom) ---------- */

type LaneId = "user" | "browser" | "server" | "ai" | "web";

const LANES: Array<{ id: LaneId; name: string; sub: string; color: string; soft: string }> = [
  { id: "user", name: "นักศึกษา", sub: "คนใช้งาน", color: "#0ea5e9", soft: "#e0f2fe" },
  { id: "browser", name: "เบราว์เซอร์", sub: "หน้าเว็บ · คำนวณในเครื่อง", color: "#3b6cf6", soft: "#e8efff" },
  { id: "server", name: "เซิร์ฟเวอร์", sub: "/api/jobs · /api/explain", color: "#6366f1", soft: "#eceefe" },
  { id: "ai", name: "ThaiLLM", sub: "typhoon-s-thaillm-8b", color: "#a855f7", soft: "#f3e8ff" },
  { id: "web", name: "Google Jobs", sub: "ผ่าน SerpApi", color: "#10b981", soft: "#dcfce7" },
];

function LaneIcon({ id, className }: { id: LaneId; className?: string }) {
  switch (id) {
    case "user":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case "browser":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case "server":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" />
          <path d="M6 6h.01M6 18h.01" />
        </svg>
      );
    case "ai":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
        </svg>
      );
    case "web":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
  }
}

const laneIndex = (id: LaneId) => LANES.findIndex((lane) => lane.id === id);
const laneCenter = (id: LaneId) => ((laneIndex(id) + 0.5) / LANES.length) * 100;

/* ---------- Messages, in time order ---------- */

type Message = {
  from: LaneId;
  to: LaneId;
  label: string;
  title: string;
  detail: string;
  tag?: string;
  via?: string;
  live?: (trace: SearchTrace) => string | null;
};

const findEvent = (trace: SearchTrace, prefix: string) => trace.events.find((event) => event.title.startsWith(prefix));
const formatMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} วินาที`);
const msText = (event?: TraceEvent) => (event?.ms !== undefined ? formatMs(event.ms) : null);

const MESSAGES: Message[] = [
  {
    from: "user",
    to: "browser",
    label: "กรอกงาน + ระบายตารางเรียน",
    title: "นักศึกษาบอกงานที่อยากได้ และใส่ตารางเรียน",
    detail: "ตำแหน่ง จังหวัด ค่าจ้าง ระยะทาง ชั่วโมง ทักษะ และช่วงที่ติดเรียน (ระบายเอง หรืออัปโหลดรูปตารางให้ AI อ่าน)",
    live: (trace) => findEvent(trace, "อ่านข้อมูล")?.detail ?? null,
  },
  {
    from: "browser",
    to: "server",
    label: "GET /api/jobs",
    tag: "HTTPS",
    title: "ส่งคำขอค้นหางาน",
    detail: "ส่งแค่ชื่อตำแหน่งกับจังหวัด ตารางเรียนอยู่ในเครื่องเท่านั้น ไม่ถูกส่งออกไป",
    live: (trace) => (trace.mode === "demo" ? "ครั้งล่าสุดเป็นโหมดงานตัวอย่าง จึงไม่ได้เรียกเซิร์ฟเวอร์" : `"${trace.query}" · ${trace.locationName}`),
  },
  {
    from: "server",
    to: "ai",
    label: "วางแผนคำค้น ไทย/อังกฤษ",
    tag: "AI",
    title: "ThaiLLM วางแผนคำค้น",
    detail: "ขอชื่อตำแหน่งเดียวกันทั้งภาษาไทยและอังกฤษ ไว้ลองค้นต่อเมื่อคำแรกไม่เจองาน (ไม่เพิ่มตำแหน่งอื่นเอง)",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM วางแผน");
      return event ? `${event.list?.join(" → ") ?? event.detail} · ${msText(event)}` : null;
    },
  },
  {
    from: "server",
    to: "web",
    label: "ค้นประกาศงาน",
    tag: "cache 1 ชม.",
    title: "ค้นประกาศผ่าน SerpApi (Google Jobs)",
    detail: "ค้นทีละคำ หยุดทันทีที่เจองาน ผลเก็บไว้ 1 ชั่วโมงเพื่อไม่เปลืองโควตา · API key อยู่ที่เซิร์ฟเวอร์เท่านั้น",
    live: (trace) => {
      const calls = trace.events.filter((event) => event.actor === "web");
      if (!calls.length) return null;
      const cached = calls.filter((event) => event.status === "cached").length;
      return `เรียก ${calls.length} ครั้ง${cached ? ` (ใช้ผลที่เก็บไว้ ${cached})` : ""} · ${formatMs(calls.reduce((sum, event) => sum + (event.ms ?? 0), 0))}`;
    },
  },
  {
    from: "web",
    to: "server",
    label: "ประกาศงานจากหลายเว็บ",
    title: "ได้ประกาศงานกลับมา",
    detail: "Google Jobs รวมประกาศจาก JobThai, JobBKK, Indeed, LinkedIn ฯลฯ ได้ชื่องาน บริษัท รายละเอียด เงินเดือน และลิงก์สมัคร",
    live: (trace) => (trace.sources.length ? trace.sources.map((source) => `${source.name} ${source.count}`).join(" · ") : null),
  },
  {
    from: "server",
    to: "ai",
    label: "อ่านวัน-เวลาและค่าจ้าง",
    tag: "ทีละ 5",
    title: "ThaiLLM อ่านประกาศทีละ 5 ชิ้นพร้อมกัน",
    detail: "ให้ตอบเฉพาะวัน เวลา และค่าจ้างที่ประกาศเขียนไว้จริง ห้ามเดา",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM อ่านประกาศ");
      return event ? `${event.detail} · ${msText(event)}` : null;
    },
  },
  {
    from: "server",
    to: "server",
    label: "ตรวจคำตอบ AI + กรองงานหลอก",
    tag: "โค้ด",
    title: "โค้ดตรวจคำตอบของ AI ซ้ำ",
    detail: "วันและเวลาที่ AI ตอบต้องมีอยู่ในข้อความประกาศจริง ไม่งั้นถือว่า “ไม่ระบุเวลา” · ตัดงานที่มีคำเสี่ยงหลอกลวงออก",
    live: (trace) => findEvent(trace, "ตรวจคำตอบ")?.detail ?? null,
  },
  {
    from: "server",
    to: "browser",
    label: "รายการงาน (JSON)",
    title: "ส่งรายการงานกลับหน้าเว็บ",
    detail: "ส่งเฉพาะข้อมูลที่ใช้แสดงผล ไม่ส่งประกาศเต็ม และไม่มี API key",
  },
  {
    from: "browser",
    to: "browser",
    label: "เทียบตารางเรียน + จัดอันดับ",
    tag: "โค้ด",
    title: "เทียบเวลางานกับตารางเรียน แล้วจัดอันดับ",
    detail: "ตัดงานที่ชนคาบเรียนด้วยโค้ดในเครื่อง (ไม่ใช่ AI) · ให้คะแนนทักษะ ชั่วโมง ค่าจ้าง ระยะทาง · ถ้าได้ไม่ถึง 5 งานจะผ่อนเกณฑ์ (Repeat)",
    live: (trace) => findEvent(trace, "เทียบเวลางาน")?.detail ?? null,
  },
  {
    from: "browser",
    to: "ai",
    via: "ผ่านเซิร์ฟเวอร์",
    label: "POST /api/explain",
    tag: "AI",
    title: "ThaiLLM เขียนคำแนะนำ",
    detail: "ส่ง 3 อันดับแรกที่จัดแล้วให้ AI สรุปเป็นภาษาไทย (ผ่านเซิร์ฟเวอร์) โดยห้ามคำนวณตารางเวลาเอง",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM เขียนคำแนะนำ");
      return event ? `${event.status === "ok" ? "สำเร็จ" : "ใช้คำสรุปสำรอง"} · ${msText(event)}` : null;
    },
  },
];

/* ---------- Diagram ---------- */

export function SequenceDiagram({ trace }: { trace: SearchTrace | null }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % MESSAGES.length), 3400);
    return () => window.clearInterval(timer);
  }, [playing]);

  const pick = (index: number) => {
    setPlaying(false);
    setActive((index + MESSAGES.length) % MESSAGES.length);
  };

  const message = MESSAGES[active];
  const from = LANES[laneIndex(message.from)];
  const to = LANES[laneIndex(message.to)];
  const live = trace && message.live ? message.live(trace) : null;

  return (
    <section className="panel-glow overflow-hidden" aria-labelledby="diagram-title">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
        <div>
          <h3 id="diagram-title" className="text-lg font-semibold sm:text-xl">
            Sequence Diagram · ใครคุยกับใคร ตามลำดับเวลา
          </h3>
          <p className="text-sm text-muted">อ่านจากบนลงล่าง · แต่ละเส้นคือข้อมูลที่ส่งจากระบบหนึ่งไปอีกระบบ</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              playing ? "btn-primary" : "bg-sunken text-ink ring-1 ring-line hover:bg-surface"
            }`}
          >
            {playing ? "❚❚ หยุด" : "▶ เล่นอัตโนมัติ"}
          </button>
          <button type="button" onClick={() => pick(active - 1)} aria-label="ขั้นก่อนหน้า" className="grid h-9 w-9 place-items-center rounded-xl bg-sunken ring-1 ring-line transition hover:bg-surface">
            ‹
          </button>
          <span className="w-14 text-center text-sm font-semibold tabular-nums text-muted">
            {active + 1} / {MESSAGES.length}
          </span>
          <button type="button" onClick={() => pick(active + 1)} aria-label="ขั้นถัดไป" className="grid h-9 w-9 place-items-center rounded-xl bg-sunken ring-1 ring-line transition hover:bg-surface">
            ›
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Chart */}
        <div className="overflow-x-auto px-3 pb-6 pt-5 sm:px-6">
          <p className="mb-3 text-xs font-semibold text-faint md:hidden">← เลื่อนซ้าย-ขวาเพื่อดูครบทั้ง 5 ระบบ →</p>
          <div className="relative min-w-[680px]">
            {/* Lane heads */}
            <div className="grid grid-cols-5 gap-2">
              {LANES.map((lane) => {
                const involved = lane.id === message.from || lane.id === message.to;
                return (
                  <div
                    key={lane.id}
                    className="rounded-2xl border px-2 py-3 text-center transition duration-300"
                    style={{
                      borderColor: involved ? lane.color : "var(--line)",
                      background: involved ? lane.soft : "var(--surface)",
                      boxShadow: involved ? `0 12px 28px -16px ${lane.color}` : undefined,
                    }}
                  >
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl" style={{ color: lane.color, background: involved ? "rgb(255 255 255 / 0.7)" : lane.soft }} aria-hidden="true">
                      <LaneIcon id={lane.id} className="h-4 w-4" />
                    </div>
                    <p className="font-display mt-1.5 text-sm font-semibold">{lane.name}</p>
                    <p className="truncate text-[11px] text-faint">{lane.sub}</p>
                  </div>
                );
              })}
            </div>

            {/* Body: lifelines + messages */}
            <div className="relative mt-2">
              {LANES.map((lane) => (
                <span
                  key={lane.id}
                  className="absolute bottom-0 top-0 w-0 border-l-2 border-dashed"
                  style={{ left: `${laneCenter(lane.id)}%`, borderColor: `${lane.color}33` }}
                  aria-hidden="true"
                />
              ))}

              <ol>
                {MESSAGES.map((item, index) => (
                  <li key={index}>
                    <MessageRow item={item} index={index} active={index === active} onPick={() => pick(index)} />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Detail */}
        <aside className="border-t border-line bg-linear-to-br from-[#f6f8ff] via-white to-[#faf5ff] p-5 sm:p-7 xl:border-l xl:border-t-0" aria-live="polite">
          <div key={active} className="seq-detail">
            <span className="chapter-num text-7xl">{String(active + 1).padStart(2, "0")}</span>
            <h4 className="font-display mt-3 text-xl font-semibold leading-snug">{message.title}</h4>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: from.soft, color: from.color }}>
                <LaneIcon id={from.id} className="h-3.5 w-3.5" />
                {from.name}
              </span>
              <span className="text-faint">{message.from === message.to ? "↻ ทำเอง" : "→"}</span>
              {message.from !== message.to && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: to.soft, color: to.color }}>
                  <LaneIcon id={to.id} className="h-3.5 w-3.5" />
                  {to.name}
                </span>
              )}
              {message.via && <span className="rounded-full bg-sunken px-2.5 py-1 text-muted ring-1 ring-line">{message.via}</span>}
            </div>
            <p className="mt-4 text-sm leading-7 text-muted">{message.detail}</p>
            {live ? (
              <div className="mt-5 rounded-2xl bg-good-soft p-4 text-sm text-good ring-1 ring-good/20">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-good" /> ข้อมูลจริงจากการค้นหาล่าสุด
                </p>
                <p className="mt-1.5 break-words font-semibold">{live}</p>
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-sunken p-4 text-xs leading-5 text-faint ring-1 ring-line">
                ค้นหางานสักครั้ง แล้วกล่องนี้จะแสดงข้อมูลจริงของขั้นนี้ เช่น คำค้นที่ใช้ เวลาที่ใช้ และจำนวนประกาศ
              </p>
            )}
            {/* progress dots */}
            <div className="mt-6 flex gap-1.5" aria-hidden="true">
              {MESSAGES.map((_, index) => (
                <span key={index} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${index <= active ? "bg-brand" : "bg-line"}`} />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MessageRow({ item, index, active, onPick }: { item: Message; index: number; active: boolean; onPick: () => void }) {
  const fromLane = LANES[laneIndex(item.from)];
  const toLane = LANES[laneIndex(item.to)];
  const self = item.from === item.to;
  const a = laneCenter(item.from);
  const b = laneCenter(item.to);
  const left = Math.min(a, b);
  const width = Math.abs(b - a);
  const rightward = b >= a;
  const gradient = `linear-gradient(90deg, ${rightward ? fromLane.color : toLane.color}, ${rightward ? toLane.color : fromLane.color})`;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={active ? "step" : undefined}
      className={`relative block h-[4.25rem] w-full rounded-2xl text-left transition-colors duration-300 ${active ? "bg-accent-soft/70" : "hover:bg-sunken/80"}`}
    >
      <span className="sr-only">
        ขั้น {index + 1}: {fromLane.name} {self ? "ทำเอง" : `ส่งถึง ${toLane.name}`} · {item.label}
      </span>

      {self ? (
        /* Work done inside one system: a loop badge on its lifeline */
        <span className="absolute top-1/2 flex -translate-y-1/2 items-center" style={{ left: `${a}%` }} aria-hidden="true">
          <span
            className={`-ml-3 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white transition-transform duration-300 ${active ? "scale-110" : ""}`}
            style={{ background: fromLane.color }}
          >
            {index + 1}
          </span>
          <span
            className={`ml-2 whitespace-nowrap rounded-xl border-2 border-dashed px-3 py-1.5 text-xs font-semibold transition duration-300 ${active ? "bg-surface shadow-md" : "bg-surface/80"}`}
            style={{ borderColor: active ? fromLane.color : `${fromLane.color}55`, color: active ? fromLane.color : "var(--muted)" }}
          >
            ↻ {item.label}
            {item.tag ? <span className="ml-1.5 rounded-md bg-sunken px-1.5 py-0.5 text-[10px] text-faint">{item.tag}</span> : null}
          </span>
        </span>
      ) : (
        /* Arrow between two lifelines */
        <span className="absolute top-[58%] block" style={{ left: `${left}%`, width: `${width}%` }} aria-hidden="true">
          {/* label */}
          <span className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap">
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white transition-transform duration-300 ${active ? "scale-110" : ""}`}
              style={{ background: fromLane.color }}
            >
              {index + 1}
            </span>
            <span className={`text-xs font-semibold transition-colors duration-300 ${active ? "text-ink" : "text-muted"}`}>{item.label}</span>
            {item.tag ? <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-faint ring-1 ring-line">{item.tag}</span> : null}
            {item.via ? <span className="text-[10px] italic text-faint">{item.via}</span> : null}
          </span>
          {/* line */}
          <span
            className={`seq-line block rounded-full transition-all duration-300 ${active ? "h-[3px] opacity-100" : "h-0.5 opacity-45"}`}
            style={{ background: gradient }}
          >
            {active ? <span className={`seq-packet ${rightward ? "" : "seq-packet-left"}`} style={{ background: toLane.color, boxShadow: `0 0 12px 3px ${toLane.color}` }} /> : null}
          </span>
          {/* arrow head */}
          <span
            className="absolute top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-y-transparent"
            style={
              rightward
                ? { right: -2, borderLeft: `9px solid ${toLane.color}`, opacity: active ? 1 : 0.55 }
                : { left: -2, borderRight: `9px solid ${toLane.color}`, opacity: active ? 1 : 0.55 }
            }
          />
          {/* lifeline dots */}
          <span className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: rightward ? fromLane.color : toLane.color }} />
        </span>
      )}
    </button>
  );
}
