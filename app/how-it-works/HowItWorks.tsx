"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { SiteHeader } from "../site-header";
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

/* ---------- Diagram steps ---------- */

type Step = {
  from: TraceActor;
  to: TraceActor;
  title: string;
  detail: string;
  /** Live value from the latest trace, if any. */
  live?: (trace: SearchTrace) => string | null;
};

const findEvent = (trace: SearchTrace, prefix: string) => trace.events.find((event) => event.title.startsWith(prefix));
const msText = (event?: TraceEvent) => (event?.ms !== undefined ? formatMs(event.ms) : null);

const steps: Step[] = [
  {
    from: "browser",
    to: "browser",
    title: "ผู้ใช้กรอกงานที่อยากได้ และระบายตารางเรียน",
    detail: "ตำแหน่ง · จังหวัด · ค่าจ้าง/ระยะทาง/ชั่วโมง · ทักษะ · ช่วงเวลาที่ติดเรียน",
    live: (trace) => findEvent(trace, "อ่านข้อมูล")?.detail ?? null,
  },
  {
    from: "browser",
    to: "server",
    title: "ส่งคำขอค้นหา  GET /api/jobs",
    detail: "ส่งแค่ตำแหน่งกับจังหวัด ตารางเรียนไม่ถูกส่งออกไป",
    live: (trace) => (trace.mode === "demo" ? "ครั้งล่าสุดเป็นโหมดงานตัวอย่าง จึงไม่ได้เรียกเซิร์ฟเวอร์" : `"${trace.query}" · ${trace.locationName}`),
  },
  {
    from: "server",
    to: "ai",
    title: "AI วางแผนคำค้น",
    detail: "ขอชื่อตำแหน่งเดียวกันแบบไทย/อังกฤษ (ไม่เพิ่มตำแหน่งอื่น) ไว้ลองเมื่อคำแรกไม่เจองาน",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM วางแผน");
      return event ? `${event.list?.join(" → ") ?? event.detail} · ${msText(event)}` : null;
    },
  },
  {
    from: "server",
    to: "web",
    title: "ค้นประกาศงานผ่าน SerpApi (Google Jobs)",
    detail: "ค้นทีละคำ หยุดทันทีที่เจองาน · ผลเก็บไว้ 1 ชม. เพื่อไม่เปลืองโควตา · API key อยู่ที่เซิร์ฟเวอร์เท่านั้น",
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
    title: "ได้ประกาศงานจากหลายเว็บ",
    detail: "Google Jobs รวมประกาศจาก JobThai, JobBKK, Indeed, LinkedIn ฯลฯ · ได้ชื่องาน บริษัท รายละเอียด เงินเดือน ลิงก์สมัคร",
    live: (trace) =>
      trace.sources.length ? trace.sources.map((source) => `${source.name} ${source.count}`).join(" · ") : null,
  },
  {
    from: "server",
    to: "ai",
    title: "AI อ่านประกาศ หาวัน-เวลาทำงานและค่าจ้าง",
    detail: "ส่งทีละ 5 ประกาศพร้อมกัน ให้ตอบเฉพาะที่ประกาศเขียนไว้จริง ห้ามเดา",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM อ่านประกาศ");
      return event ? `${event.detail} · ${msText(event)}` : null;
    },
  },
  {
    from: "server",
    to: "server",
    title: "โค้ดตรวจคำตอบของ AI กับข้อความในประกาศ",
    detail: "วันและเวลาที่ AI ตอบต้องมีอยู่ในประกาศจริง ไม่งั้นถือว่า \"ไม่ระบุเวลา\" · คัดงานที่มีคำเสี่ยงหลอกลวงออก",
    live: (trace) => findEvent(trace, "ตรวจคำตอบ")?.detail ?? null,
  },
  {
    from: "server",
    to: "browser",
    title: "ส่งรายการงานกลับหน้าเว็บ",
    detail: "ส่งเฉพาะข้อมูลที่ใช้แสดงผล ไม่ส่งรายละเอียดประกาศเต็ม และไม่ส่ง API key",
  },
  {
    from: "browser",
    to: "browser",
    title: "เทียบเวลางานกับตารางเรียน แล้วจัดอันดับ",
    detail: "ตัดงานที่ชนคาบเรียนทิ้ง (โค้ด ไม่ใช่ AI) · ให้คะแนนทักษะ ชั่วโมง ค่าจ้าง ระยะทาง · ถ้าตรงเกณฑ์ไม่ถึง 5 งาน จะผ่อนระยะทาง/ค่าจ้าง (Repeat)",
    live: (trace) => findEvent(trace, "เทียบเวลางาน")?.detail ?? null,
  },
  {
    from: "browser",
    to: "ai",
    title: "AI เขียนคำแนะนำ  POST /api/explain",
    detail: "ส่งผลที่จัดอันดับแล้ว 3 อันดับแรก ให้ AI สรุปเป็นภาษาไทย (ผ่านเซิร์ฟเวอร์) โดยห้ามคำนวณตารางเวลาเอง",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM เขียนคำแนะนำ");
      return event ? `${event.status === "ok" ? "สำเร็จ" : "ใช้คำสรุปสำรอง"} · ${msText(event)}` : null;
    },
  },
];

/* ---------- Page ---------- */

export function HowItWorks() {
  // localStorage only exists in the browser: the server snapshot is null so hydration matches,
  // then React re-reads it on the client.
  const raw = useSyncExternalStore(subscribeTrace, loadTraceRaw, () => null);
  const loaded = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const trace = useMemo(() => parseTrace(raw), [raw]);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader active="how" />
      <main className="mx-auto grid max-w-[1560px] gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <section>
          <h1 className="text-2xl font-bold sm:text-3xl">ระบบทำงานยังไง</h1>
          <p className="mt-2 max-w-4xl leading-7 text-muted">
            ภาพรวมสถาปัตยกรรมการทำงานทั้งหมดของ Agent ตั้งแต่ผู้ใช้กดค้นหา จนถึงตอนที่ AI ไปหาข้อมูลจากเว็บต่าง ๆ
            และด้านล่างคือการติดตาม (tracking) ว่าการค้นหาครั้งล่าสุดในเบราว์เซอร์นี้ทำอะไรไปบ้าง
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Pill className="bg-good-soft text-good">ตรวจการชนคาบเรียนด้วยโค้ด ไม่ใช่ AI</Pill>
            <Pill className="bg-ai-soft text-ai">AI อ่านประกาศ แล้วโค้ดตรวจซ้ำ</Pill>
            <Pill className="bg-class-soft text-class">API key อยู่ที่เซิร์ฟเวอร์เท่านั้น</Pill>
            <Pill className="bg-accent-soft text-accent-strong">ตารางเรียนไม่ถูกส่งออกนอกเครื่อง*</Pill>
          </div>
        </section>

        <Diagram trace={trace} />

        <section aria-labelledby="tracking-title" className="grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="tracking-title" className="text-xl font-bold">
                การติดตามการค้นหาล่าสุด
              </h2>
              <p className="text-sm text-muted">บันทึกจากการกด “ให้ Agent หางานให้” ครั้งล่าสุดในเบราว์เซอร์นี้</p>
            </div>
            {trace ? <TraceSummary trace={trace} /> : null}
          </div>
          {!loaded ? null : trace ? (
            <>
              <Timeline events={trace.events} />
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <Sources trace={trace} />
                <Removed trace={trace} />
              </div>
              <Extraction rows={trace.extraction} mode={trace.mode} />
            </>
          ) : (
            <div className="panel grid place-items-center gap-3 p-10 text-center">
              <p className="font-semibold">ยังไม่มีการค้นหาในเบราว์เซอร์นี้</p>
              <p className="text-sm text-muted">ลองค้นหาสักครั้ง แล้วกลับมาดูว่าแต่ละขั้นทำอะไรและใช้เวลาเท่าไหร่</p>
              <Link href="/" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-strong">
                ไปหน้าค้นหางาน
              </Link>
            </div>
          )}
        </section>

        <p className="pb-4 text-xs leading-6 text-faint">
          * ตารางเรียนใช้คำนวณในเครื่องเท่านั้น ยกเว้นตอนขอคำแนะนำ ซึ่งจะส่งตารางเรียนกับงาน 3 อันดับแรกไปให้ AI สรุป ·
          บันทึกการติดตามเก็บไว้ในเบราว์เซอร์นี้เครื่องเดียว และจะถูกแทนที่เมื่อค้นหาครั้งใหม่
        </p>
      </main>
    </div>
  );
}

/* ---------- Architecture Diagram Steps ---------- */

type ArchStep = {
  id: number;
  title: string;
  shortLabel: string;
  fromDesc: string;
  toDesc: string;
  detail: string;
  sourceNode: string;
  targetNode: string;
  live?: (trace: SearchTrace) => string | null;
};

const archSteps: ArchStep[] = [
  {
    id: 1,
    title: "ผู้ใช้ระบายตารางเรียน และตั้งค่าเงื่อนไขงาน",
    shortLabel: "ตั้งค่า & ระบายตารางเรียน",
    fromDesc: "ผู้ใช้ (User)",
    toDesc: "Front-end (Schedule Grid)",
    detail: "เลือกตำแหน่งงาน จังหวัด อัตราค่าจ้าง ระยะทาง และระบายช่วงเวลาที่ติดเรียนบนตารางสล็อต",
    sourceNode: "node-user",
    targetNode: "node-schedule",
    live: (trace) => findEvent(trace, "อ่านข้อมูล")?.detail ?? null,
  },
  {
    id: 2,
    title: "ส่งคำขอค้นหางาน  GET /api/jobs",
    shortLabel: "GET /api/jobs (HTTPS)",
    fromDesc: "Front-end Client",
    toDesc: "Backend API Gateway",
    detail: "ส่งเฉพาะชื่อตำแหน่งงานและจังหวัดไปยังเซิร์ฟเวอร์ โดยตารางเรียนจะไม่ถูกส่งออกนอกเครื่อง",
    sourceNode: "node-client-box",
    targetNode: "node-api-gateway",
    live: (trace) => (trace.mode === "demo" ? "ครั้งล่าสุดเป็นโหมดงานตัวอย่าง จึงไม่ได้เรียกเซิร์ฟเวอร์" : `"${trace.query}" · ${trace.locationName}`),
  },
  {
    id: 3,
    title: "AI วางแผนคำค้นหา (Query Expansion)",
    shortLabel: "วางแผนคำค้น (ไทย/อังกฤษ)",
    fromDesc: "Backend Gateway",
    toDesc: "Workflow: Query Plan",
    detail: "ส่งตำแหน่งงานให้ ThaiLLM ช่วยคิดคำค้นคู่ขนานทั้งภาษาไทยและอังกฤษ เพื่อใช้ค้นหาเมื่อคำแรกไม่เจองาน",
    sourceNode: "node-api-gateway",
    targetNode: "node-wf-plan",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM วางแผน");
      return event ? `${event.list?.join(" → ") ?? event.detail} · ${msText(event)}` : null;
    },
  },
  {
    id: 4,
    title: "ค้นหาประกาศงานผ่าน SerpApi (Google Jobs)",
    shortLabel: "Search API (Google Jobs)",
    fromDesc: "Backend Gateway",
    toDesc: "SerpApi & Job Sources",
    detail: "ค้นหาตามคำค้นและพิกัดจังหวัดที่เลือก ผลลัพธ์ถูกเก็บในแคช 1 ชั่วโมงเพื่อประหยัดโควตา",
    sourceNode: "node-api-gateway",
    targetNode: "node-serpapi",
    live: (trace) => {
      const calls = trace.events.filter((event) => event.actor === "web");
      if (!calls.length) return null;
      const cached = calls.filter((event) => event.status === "cached").length;
      return `เรียก ${calls.length} ครั้ง${cached ? ` (ใช้ผลที่แคชไว้ ${cached})` : ""} · ${formatMs(calls.reduce((sum, event) => sum + (event.ms ?? 0), 0))}`;
    },
  },
  {
    id: 5,
    title: "รวบรวมประกาศงานสดจากแหล่งจัดหางานต่างๆ",
    shortLabel: "ดึงประกาศงานดิบ",
    fromDesc: "Job Boards (JobThai, Indeed)",
    toDesc: "Backend Server",
    detail: "Google Jobs รวมประกาศงานจาก JobThai, JobBKK, Indeed, LinkedIn ฯลฯ ได้ชื่องาน บริษัท ข้อความรายละเอียด และลิงก์สมัคร",
    sourceNode: "node-job-boards",
    targetNode: "node-api-gateway",
    live: (trace) => (trace.sources.length ? trace.sources.map((s) => `${s.name} (${s.count})`).join(" · ") : null),
  },
  {
    id: 6,
    title: "AI สกัดเวลากะและค่าจ้างจากข้อความประกาศ",
    shortLabel: "สกัดเวลากะ & ค่าจ้าง",
    fromDesc: "Workflow: Batch Extract",
    toDesc: "ThaiLLM API",
    detail: "ส่งประกาศงานทีละ 5 งานพร้อมกันให้ ThaiLLM อ่าน โดยบังคับให้ตอบเฉพาะข้อมูลที่มีเขียนจริงในประกาศเท่านั้น ห้ามเดา",
    sourceNode: "node-wf-extract",
    targetNode: "node-thaillm",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM อ่านประกาศ");
      return event ? `${event.detail} · ${msText(event)}` : null;
    },
  },
  {
    id: 7,
    title: "ตรวจความถูกต้องของคำตอบ AI ซ้ำ และคัดกรองงานเสี่ยง",
    shortLabel: "Cross-Verify & Safety",
    fromDesc: "Workflow: Verification",
    toDesc: "Backend Safety Guard",
    detail: "วันและเวลาที่ AI ตอบต้องปรากฏในเนื้อหาประกาศจริง ไม่งั้นถือว่าไม่ระบุเวลา พร้อมคัดกรองคำเตือนความเสี่ยงหลอกลวงออก",
    sourceNode: "node-wf-verify",
    targetNode: "node-safety",
    live: (trace) => findEvent(trace, "ตรวจคำตอบ")?.detail ?? null,
  },
  {
    id: 8,
    title: "ส่งรายการงานที่คัดกรองแล้วกลับไปยังเบราว์เซอร์",
    shortLabel: "ส่งรายการงานกลับ (JSON)",
    fromDesc: "Backend API",
    toDesc: "Front-end Client",
    detail: "ส่งเฉพาะข้อมูลที่ใช้แสดงผล ไม่ส่งรายละเอียดดิบทั้งหมด และไม่มีการเปิดเผย API Key เด็ดขาด",
    sourceNode: "node-api-gateway",
    targetNode: "node-client-box",
    live: (trace) => `ได้งานพร้อมแสดงผล ${trace.extraction.filter((r) => r.verdict === "accepted").length} ตำแหน่ง`,
  },
  {
    id: 9,
    title: "เทียบเวลางานกับตารางเรียน และจัดอันดับคะแนน",
    shortLabel: "ตรวจชนตารางเรียน & จัดอันดับ",
    fromDesc: "Local Matching Engine",
    toDesc: "Job Results View",
    detail: "ตรวจสอบการชนคาบเรียนด้วยโค้ด Logic บนเครื่องผู้ใช้ (ไม่ใช่ AI) พร้อมคำนวณคะแนนทักษะ ชั่วโมง และระยะทาง",
    sourceNode: "node-schedule",
    targetNode: "node-client-box",
    live: (trace) => findEvent(trace, "เทียบเวลางาน")?.detail ?? null,
  },
  {
    id: 10,
    title: "AI เขียนบทวิเคราะห์สรุปคำแนะนำ  POST /api/explain",
    shortLabel: "AI สรุปคำแนะนำ Top 3",
    fromDesc: "Front-end Client",
    toDesc: "ThaiLLM via Server",
    detail: "ส่งผลลัพธ์ที่จัดอันดับแล้ว 3 อันดับแรกให้ ThaiLLM ช่วยเขียนสรุปคำแนะนำภาษาไทย โดยห้ามคำนวณตารางเวลาเอง",
    sourceNode: "node-client-box",
    targetNode: "node-wf-explain",
    live: (trace) => {
      const event = findEvent(trace, "ThaiLLM เขียนคำแนะนำ");
      return event ? `${event.status === "ok" ? "สรุปสำเร็จ" : "ใช้โหมดสำรอง"} · ${msText(event)}` : null;
    },
  },
];

/* ---------- Architecture Diagram Component ---------- */

function Diagram({ trace }: { trace: SearchTrace | null }) {
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSelectedStep((prev) => (prev >= archSteps.length ? 1 : prev + 1));
    }, 3800);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const active = archSteps.find((s) => s.id === selectedStep) ?? archSteps[0];
  const liveVal = trace && active.live ? active.live(trace) : null;

  return (
    <section className="panel overflow-hidden p-4 sm:p-6 lg:p-8" aria-labelledby="diagram-title">
      {/* Top Header & Interactive Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white shadow-sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </span>
            <h2 id="diagram-title" className="text-xl font-bold tracking-tight sm:text-2xl">
              System Architecture Diagram
            </h2>
            <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-strong">
              Interactive Live Flow
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            แผนภาพสถาปัตยกรรมระบบจริงและการไหลของข้อมูล (Data Flow) ตามหมายเลขลำดับ 1 ถึง 10
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs ${
              isPlaying
                ? "bg-accent text-white hover:bg-accent-strong"
                : "bg-sunken text-ink ring-1 ring-line hover:bg-surface"
            }`}
          >
            {isPlaying ? (
              <>
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                พักแอนิเมชั่น
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                เล่นต่อเนื่อง
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setSelectedStep((prev) => (prev > 1 ? prev - 1 : archSteps.length));
            }}
            aria-label="ขั้นตอนก่อนหน้า"
            className="grid h-9 w-9 place-items-center rounded-xl bg-sunken text-ink ring-1 ring-line hover:bg-surface transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="min-w-[5rem] text-center text-xs font-bold tabular-nums text-muted">
            ลำดับ {selectedStep} / {archSteps.length}
          </span>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setSelectedStep((prev) => (prev < archSteps.length ? prev + 1 : 1));
            }}
            aria-label="ขั้นตอนถัดไป"
            className="grid h-9 w-9 place-items-center rounded-xl bg-sunken text-ink ring-1 ring-line hover:bg-surface transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick Step Buttons */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
        {archSteps.map((step) => {
          const isCurrent = step.id === selectedStep;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setSelectedStep(step.id);
              }}
              className={`group flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                isCurrent
                  ? "bg-accent text-white shadow-md ring-2 ring-accent ring-offset-1"
                  : "bg-sunken text-muted ring-1 ring-line hover:bg-surface hover:text-ink"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-md text-[11px] font-bold ${
                  isCurrent ? "bg-white text-accent" : "bg-line text-muted"
                }`}
              >
                {step.id}
              </span>
              <span className="truncate max-w-[150px]">{step.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* SVG Canvas Area: Expanded Width & Real Flow Animation */}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface p-2 sm:p-4 shadow-inner">
        <div className="min-w-[1100px] select-none">
          <svg viewBox="0 0 1200 660" className="w-full h-auto text-xs font-sans">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
              </marker>
              <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
              </marker>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="glow-strong" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Main System Boundary (Enterprise Box) */}
            <rect
              x="160"
              y="20"
              width="1015"
              height="620"
              rx="14"
              fill="#ffffff"
              stroke="#1e293b"
              strokeWidth="2"
            />
            {/* Header label badge */}
            <rect x="160" y="20" width="220" height="34" rx="14" fill="#1e293b" />
            <text x="175" y="42" fill="#ffffff" fontWeight="bold" fontSize="13">
              Part-time Job Finder Architecture
            </text>

            {/* Leftmost outside: User & Mobile Client */}
            <g transform="translate(18, 250)">
              {/* User group icon (clean vector) */}
              <circle cx="20" cy="18" r="9" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
              <path d="M 7 42 A 13 13 0 0 1 33 42 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
              <circle cx="34" cy="14" r="7" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
              <path d="M 24 38 A 10 10 0 0 1 44 38 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />

              {/* Arrow to mobile */}
              <path d="M 46 28 L 68 28" stroke="#475569" strokeWidth="1.5" markerEnd="url(#arrow)" />

              {/* Mobile device icon */}
              <rect x="74" y="4" width="38" height="66" rx="7" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="79" y="12" width="28" height="46" rx="3" fill="#e2e8f0" />
              <circle cx="93" cy="63" r="2.5" fill="#94a3b8" />
              <text x="93" y="85" textAnchor="middle" fill="#475569" fontSize="11" fontWeight="600">
                mobile client
              </text>
            </g>

            {/* Connection: Mobile -> Front-end boundary */}
            <path
              id="path-user-entry"
              d="M 112 284 L 185 284"
              stroke={selectedStep === 1 ? "#2563eb" : "#475569"}
              strokeWidth={selectedStep === 1 ? "2.5" : "1.5"}
              markerEnd={selectedStep === 1 ? "url(#arrow-active)" : "url(#arrow)"}
            />

            {/* ================= ZONE 1: Front-end (Dashed grey box) ================= */}
            <rect
              x="185"
              y="75"
              width="265"
              height="545"
              rx="10"
              fill="#f8fafc"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text x="317" y="102" textAnchor="middle" fill="#1e293b" fontSize="14" fontWeight="bold">
              Front end
            </text>
            <text x="317" y="120" textAnchor="middle" fill="#64748b" fontSize="11">
              HTML, React, TypeScript (Client-side)
            </text>

            {/* Front-end Card 1: Job Finder UI Form */}
            <g transform="translate(202, 140)">
              <rect
                x="0"
                y="0"
                width="230"
                height="80"
                rx="8"
                fill="#ffffff"
                stroke={selectedStep === 1 ? "#2563eb" : "#cbd5e1"}
                strokeWidth={selectedStep === 1 ? "2.5" : "1"}
                filter={selectedStep === 1 ? "url(#glow)" : undefined}
                className="transition-all"
              />
              <rect x="12" y="18" width="44" height="44" rx="8" fill="#e11d48" />
              {/* Search Vector Icon */}
              <circle cx="34" cy="38" r="9" fill="none" stroke="#ffffff" strokeWidth="2.2" />
              <line x1="41" y1="45" x2="47" y2="51" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              <text x="68" y="36" fill="#0f172a" fontSize="12" fontWeight="bold">
                Job Preferences UI
              </text>
              <text x="68" y="52" fill="#64748b" fontSize="10.5">
                ตำแหน่ง · จังหวัด · ค่าจ้าง
              </text>
            </g>

            {/* Front-end Card 2: Schedule Matrix */}
            <g transform="translate(202, 240)">
              <rect
                x="0"
                y="0"
                width="230"
                height="80"
                rx="8"
                fill="#ffffff"
                stroke={selectedStep === 1 || selectedStep === 9 ? "#2563eb" : "#cbd5e1"}
                strokeWidth={selectedStep === 1 || selectedStep === 9 ? "2.5" : "1"}
                filter={selectedStep === 1 || selectedStep === 9 ? "url(#glow)" : undefined}
              />
              <rect x="12" y="18" width="44" height="44" rx="8" fill="#d97706" />
              {/* Calendar Vector Icon */}
              <rect x="23" y="29" width="22" height="22" rx="3" fill="none" stroke="#ffffff" strokeWidth="2" />
              <line x1="23" y1="36" x2="45" y2="36" stroke="#ffffff" strokeWidth="2" />
              <line x1="29" y1="26" x2="29" y2="30" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <line x1="39" y1="26" x2="39" y2="30" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <text x="68" y="36" fill="#0f172a" fontSize="12" fontWeight="bold">
                Schedule Slots Matrix
              </text>
              <text x="68" y="52" fill="#64748b" fontSize="10.5">
                ระบายคาบเรียน (เก็บในเครื่อง)
              </text>
            </g>

            {/* Front-end Card 3: Local Matching Engine */}
            <g transform="translate(202, 340)">
              <rect
                x="0"
                y="0"
                width="230"
                height="85"
                rx="8"
                fill="#ffffff"
                stroke={selectedStep === 9 ? "#2563eb" : "#cbd5e1"}
                strokeWidth={selectedStep === 9 ? "2.5" : "1"}
                filter={selectedStep === 9 ? "url(#glow)" : undefined}
              />
              <rect x="12" y="20" width="44" height="44" rx="8" fill="#16a34a" />
              {/* CPU Chip Vector Icon */}
              <rect x="25" y="33" width="18" height="18" rx="2" fill="none" stroke="#ffffff" strokeWidth="2" />
              <rect x="30" y="38" width="8" height="8" fill="#ffffff" />
              <line x1="34" y1="28" x2="34" y2="32" stroke="#ffffff" strokeWidth="2" />
              <line x1="34" y1="52" x2="34" y2="56" stroke="#ffffff" strokeWidth="2" />
              <line x1="20" y1="42" x2="24" y2="42" stroke="#ffffff" strokeWidth="2" />
              <line x1="44" y1="42" x2="48" y2="42" stroke="#ffffff" strokeWidth="2" />
              <text x="68" y="35" fill="#0f172a" fontSize="12" fontWeight="bold">
                Client-side Matcher
              </text>
              <text x="68" y="50" fill="#64748b" fontSize="10">
                ตัดงานชนคาบเรียนด้วยโค้ด
              </text>
              <text x="68" y="65" fill="#16a34a" fontSize="9.5" fontWeight="bold">
                ตารางเรียนไม่ส่งออกนอก
              </text>
            </g>

            {/* Front-end Card 4: Top Results View */}
            <g transform="translate(202, 445)">
              <rect
                x="0"
                y="0"
                width="230"
                height="90"
                rx="8"
                fill="#ffffff"
                stroke={selectedStep === 8 || selectedStep === 10 ? "#2563eb" : "#cbd5e1"}
                strokeWidth={selectedStep === 8 || selectedStep === 10 ? "2.5" : "1"}
                filter={selectedStep === 8 || selectedStep === 10 ? "url(#glow)" : undefined}
              />
              <rect x="12" y="23" width="44" height="44" rx="8" fill="#2563eb" />
              {/* Checklist / Document Vector Icon */}
              <rect x="24" y="34" width="20" height="22" rx="2" fill="none" stroke="#ffffff" strokeWidth="2" />
              <line x1="29" y1="40" x2="39" y2="40" stroke="#ffffff" strokeWidth="1.8" />
              <line x1="29" y1="45" x2="39" y2="45" stroke="#ffffff" strokeWidth="1.8" />
              <line x1="29" y1="50" x2="35" y2="50" stroke="#ffffff" strokeWidth="1.8" />
              <text x="68" y="38" fill="#0f172a" fontSize="12" fontWeight="bold">
                Job Matches & Advice
              </text>
              <text x="68" y="54" fill="#64748b" fontSize="10.5">
                แสดงผลงาน & AI สรุปแนะ
              </text>
              <text x="68" y="69" fill="#2563eb" fontSize="9.5" fontWeight="bold">
                จัดอันดับตามคะแนน
              </text>
            </g>

            {/* ================= ZONE 2: Backend API Gateway ================= */}
            <g transform="translate(470, 210)">
              <rect
                x="0"
                y="0"
                width="165"
                height="225"
                rx="10"
                fill="#ffffff"
                stroke={selectedStep === 2 || selectedStep === 7 || selectedStep === 8 ? "#2563eb" : "#cbd5e1"}
                strokeWidth={selectedStep === 2 || selectedStep === 7 || selectedStep === 8 ? "2.5" : "1"}
                filter={selectedStep === 2 || selectedStep === 7 || selectedStep === 8 ? "url(#glow)" : undefined}
              />
              <rect x="58" y="16" width="48" height="48" rx="8" fill="#db2777" />
              {/* Server Vector Icon */}
              <rect x="71" y="29" width="22" height="7" rx="1.5" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <rect x="71" y="42" width="22" height="7" rx="1.5" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <circle cx="75" cy="32.5" r="1.2" fill="#ffffff" />
              <circle cx="75" cy="45.5" r="1.2" fill="#ffffff" />
              <text x="82" y="84" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
                Next.js Backend
              </text>
              <text x="82" y="100" textAnchor="middle" fill="#db2777" fontSize="10.5" fontWeight="bold">
                /api/jobs Gateway
              </text>
              <line x1="18" y1="112" x2="147" y2="112" stroke="#e2e8f0" />
              <text x="82" y="130" textAnchor="middle" fill="#475569" fontSize="10">
                Key Vault Protection
              </text>
              <text x="82" y="148" textAnchor="middle" fill="#475569" fontSize="10">
                Scam Keywords Guard
              </text>
              <text x="82" y="166" textAnchor="middle" fill="#475569" fontSize="10">
                1-Hour Search Cache
              </text>
              <line x1="18" y1="178" x2="147" y2="178" stroke="#e2e8f0" />
              <text x="82" y="196" textAnchor="middle" fill="#16a34a" fontSize="10" fontWeight="bold">
                /api/explain Route
              </text>
            </g>

            {/* ================= ZONE 3: Workflow Box (Magenta outline) ================= */}
            <rect
              x="670"
              y="55"
              width="285"
              height="565"
              rx="10"
              fill="#ffffff"
              stroke="#e11d48"
              strokeWidth="2"
            />
            {/* Workflow Header Banner */}
            <rect x="670" y="55" width="285" height="42" rx="10" fill="#e11d48" />
            {/* Workflow Icon */}
            <circle cx="695" cy="76" r="3.5" fill="#ffffff" />
            <circle cx="710" cy="70" r="3.5" fill="#ffffff" />
            <circle cx="710" cy="82" r="3.5" fill="#ffffff" />
            <line x1="695" y1="76" x2="710" y2="70" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="695" y1="76" x2="710" y2="82" stroke="#ffffff" strokeWidth="1.5" />
            <text x="725" y="74" fill="#ffffff" fontSize="13" fontWeight="bold">
              AI & Processing Workflow
            </text>
            <text x="725" y="88" fill="#ffe4e6" fontSize="10">
              Typhoon LLM Pipeline
            </text>

            {/* Parallel / Processing sub-box */}
            <rect
              x="682"
              y="110"
              width="261"
              height="255"
              rx="8"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1.2"
              strokeDasharray="5 4"
            />
            <text x="812" y="128" textAnchor="middle" fill="#475569" fontSize="10.5" fontWeight="bold">
              AI Extraction & Guard Pipeline
            </text>

            {/* Box 1: Plan Search */}
            <g transform="translate(695, 142)">
              <rect
                x="0"
                y="0"
                width="235"
                height="50"
                rx="6"
                fill="#ffffff"
                stroke={selectedStep === 3 ? "#2563eb" : "#94a3b8"}
                strokeWidth={selectedStep === 3 ? "2" : "1"}
              />
              <text x="117" y="24" textAnchor="middle" fill="#0f172a" fontSize="11.5" fontWeight="bold">
                query expansion
              </text>
              <text x="117" y="39" textAnchor="middle" fill="#64748b" fontSize="10">
                วางแผนคำค้นไทยและอังกฤษ
              </text>
            </g>

            {/* Down arrow 1 */}
            <path d="M 812 192 L 812 210" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Box 2: Batch Extract */}
            <g transform="translate(695, 210)">
              <rect
                x="0"
                y="0"
                width="235"
                height="50"
                rx="6"
                fill="#ffffff"
                stroke={selectedStep === 6 ? "#2563eb" : "#94a3b8"}
                strokeWidth={selectedStep === 6 ? "2" : "1"}
              />
              <text x="117" y="24" textAnchor="middle" fill="#0f172a" fontSize="11.5" fontWeight="bold">
                extract shifts & wage
              </text>
              <text x="117" y="39" textAnchor="middle" fill="#64748b" fontSize="10">
                ส่ง 5 งานพร้อมกัน สกัดเวลากะจริง
              </text>
            </g>

            {/* Down arrow 2 */}
            <path d="M 812 260 L 812 278" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Box 3: Cross Verify */}
            <g transform="translate(695, 278)">
              <rect
                x="0"
                y="0"
                width="235"
                height="50"
                rx="6"
                fill="#ffffff"
                stroke={selectedStep === 7 ? "#2563eb" : "#94a3b8"}
                strokeWidth={selectedStep === 7 ? "2" : "1"}
              />
              <text x="117" y="24" textAnchor="middle" fill="#0f172a" fontSize="11.5" fontWeight="bold">
                verify against text
              </text>
              <text x="117" y="39" textAnchor="middle" fill="#64748b" fontSize="10">
                ตรวจคำตอบ AI กับเนื้อหาประกาศ
              </text>
            </g>

            {/* Down arrow 3 */}
            <path d="M 812 365 L 812 385" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Box 4: Filter Scam */}
            <g transform="translate(695, 385)">
              <rect
                x="0"
                y="0"
                width="235"
                height="50"
                rx="6"
                fill="#ffffff"
                stroke={selectedStep === 7 ? "#2563eb" : "#94a3b8"}
                strokeWidth={selectedStep === 7 ? "2" : "1"}
              />
              <text x="117" y="24" textAnchor="middle" fill="#0f172a" fontSize="11.5" fontWeight="bold">
                scam keywords guard
              </text>
              <text x="117" y="39" textAnchor="middle" fill="#64748b" fontSize="10">
                คัดกรองงานที่มีคำเสี่ยงหลอกลวงออก
              </text>
            </g>

            {/* Down arrow 4 */}
            <path d="M 812 435 L 812 455" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Box 5: Synthesize & Explain */}
            <g transform="translate(695, 455)">
              <rect
                x="0"
                y="0"
                width="235"
                height="55"
                rx="6"
                fill="#ffffff"
                stroke={selectedStep === 10 ? "#2563eb" : "#94a3b8"}
                strokeWidth={selectedStep === 10 ? "2" : "1"}
              />
              <text x="117" y="26" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
                synthesize & explain
              </text>
              <text x="117" y="42" textAnchor="middle" fill="#64748b" fontSize="10">
                AI สรุปคำแนะนำงาน 3 อันดับแรก
              </text>
            </g>

            {/* Down arrow 5 */}
            <path d="M 812 510 L 812 530" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Box 6: Cache store */}
            <g transform="translate(695, 530)">
              <rect x="0" y="0" width="235" height="48" rx="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
              <text x="117" y="28" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="bold">
                store cache & emit JSON
              </text>
            </g>

            {/* ================= ZONE 4: External Services (Right column) ================= */}

            {/* External 1: ThaiLLM (Typhoon) */}
            <g transform="translate(985, 140)">
              <rect
                x="0"
                y="0"
                width="160"
                height="75"
                rx="8"
                fill="#ffffff"
                stroke={selectedStep === 3 || selectedStep === 6 || selectedStep === 10 ? "#7c3aed" : "#cbd5e1"}
                strokeWidth={selectedStep === 3 || selectedStep === 6 || selectedStep === 10 ? "2.5" : "1"}
                filter={selectedStep === 3 || selectedStep === 6 || selectedStep === 10 ? "url(#glow)" : undefined}
              />
              <rect x="12" y="15" width="44" height="44" rx="8" fill="#7c3aed" />
              {/* Brain / AI Vector Icon */}
              <circle cx="34" cy="37" r="12" fill="none" stroke="#ffffff" strokeWidth="2" />
              <path d="M 28 37 Q 34 31 40 37" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <circle cx="34" cy="37" r="2.5" fill="#ffffff" />
              <text x="68" y="36" fill="#0f172a" fontSize="12" fontWeight="bold">
                ThaiLLM
              </text>
              <text x="68" y="52" fill="#64748b" fontSize="10">
                typhoon-s-8b
              </text>
            </g>

            {/* External 2: SerpApi Google Jobs */}
            <g transform="translate(985, 245)">
              <rect
                x="0"
                y="0"
                width="160"
                height="75"
                rx="8"
                fill="#ffffff"
                stroke={selectedStep === 4 ? "#16a34a" : "#cbd5e1"}
                strokeWidth={selectedStep === 4 ? "2.5" : "1"}
                filter={selectedStep === 4 ? "url(#glow)" : undefined}
              />
              <rect x="12" y="15" width="44" height="44" rx="8" fill="#16a34a" />
              {/* Globe Vector Icon */}
              <circle cx="34" cy="37" r="12" fill="none" stroke="#ffffff" strokeWidth="2" />
              <line x1="22" y1="37" x2="46" y2="37" stroke="#ffffff" strokeWidth="1.8" />
              <ellipse cx="34" cy="37" rx="6" ry="12" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <text x="68" y="36" fill="#0f172a" fontSize="12" fontWeight="bold">
                SerpApi
              </text>
              <text x="68" y="52" fill="#64748b" fontSize="10">
                Google Jobs API
              </text>
            </g>

            {/* External 3: Job Boards Aggregator */}
            <g transform="translate(985, 350)">
              <rect
                x="0"
                y="0"
                width="160"
                height="75"
                rx="8"
                fill="#ffffff"
                stroke={selectedStep === 5 ? "#d97706" : "#cbd5e1"}
                strokeWidth={selectedStep === 5 ? "2.5" : "1"}
                filter={selectedStep === 5 ? "url(#glow)" : undefined}
              />
              <rect x="12" y="15" width="44" height="44" rx="8" fill="#d97706" />
              {/* Briefcase Vector Icon */}
              <rect x="25" y="30" width="18" height="15" rx="2" fill="none" stroke="#ffffff" strokeWidth="2" />
              <path d="M 29 30 L 29 27 Q 29 25 31 25 L 37 25 Q 39 25 39 27 L 39 30" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <text x="68" y="35" fill="#0f172a" fontSize="12" fontWeight="bold">
                Job Sources
              </text>
              <text x="68" y="51" fill="#64748b" fontSize="9.5">
                JobThai · Indeed ฯลฯ
              </text>
            </g>

            {/* External 4: Cache Storage */}
            <g transform="translate(985, 460)">
              <rect x="0" y="0" width="160" height="75" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="12" y="15" width="44" height="44" rx="8" fill="#65a30d" />
              {/* Database Cylinder Vector Icon */}
              <ellipse cx="34" cy="30" rx="10" ry="4" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <path d="M 24 30 L 24 44 A 10 4 0 0 0 44 44 L 44 30" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <path d="M 24 37 A 10 4 0 0 0 44 37" fill="none" stroke="#ffffff" strokeWidth="1.8" />
              <text x="68" y="36" fill="#0f172a" fontSize="12" fontWeight="bold">
                Fast Cache
              </text>
              <text x="68" y="52" fill="#64748b" fontSize="10">
                เก็บผล 1 ชั่วโมง
              </text>
            </g>

            {/* ================= FLOW CONNECTORS & NUMBERED BADGES (1 to 10) ================= */}

            {/* Path 1: Front-end internal - Form to Schedule slots */}
            <path
              id="flow-path-1"
              d="M 317 220 L 317 240"
              stroke={selectedStep === 1 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 1 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 1 ? "6 4" : undefined}
              className={selectedStep === 1 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 1 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 1 Particle Motion */}
            <circle r={selectedStep === 1 ? "6" : "3.5"} fill={selectedStep === 1 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 1 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.4s" repeatCount="indefinite">
                <mpath href="#flow-path-1" />
              </animateMotion>
            </circle>
            {/* Step 1 Badge */}
            <g transform="translate(305, 222)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 1 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 1 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                1
              </text>
            </g>

            {/* Path 2: Front-end to Backend API Gateway (GET /api/jobs) */}
            <path
              id="flow-path-2"
              d="M 432 280 L 470 280"
              stroke={selectedStep === 2 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 2 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 2 ? "6 4" : undefined}
              className={selectedStep === 2 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 2 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 2 Particle Motion */}
            <circle r={selectedStep === 2 ? "6" : "3.5"} fill={selectedStep === 2 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 2 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.5s" repeatCount="indefinite">
                <mpath href="#flow-path-2" />
              </animateMotion>
            </circle>
            {/* Step 2 Badge */}
            <g transform="translate(440, 269)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 2 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 2 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                2
              </text>
            </g>
            <text x="428" y="267" textAnchor="end" fill="#64748b" fontSize="9.5" fontStyle="italic">
              GET /api/jobs
            </text>

            {/* Path 3: Backend Gateway to Workflow Plan */}
            <path
              id="flow-path-3"
              d="M 635 250 L 655 250 L 655 167 L 695 167"
              fill="none"
              stroke={selectedStep === 3 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 3 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 3 ? "6 4" : undefined}
              className={selectedStep === 3 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 3 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 3 Particle Motion */}
            <circle r={selectedStep === 3 ? "6" : "3.5"} fill={selectedStep === 3 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 3 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.8s" repeatCount="indefinite">
                <mpath href="#flow-path-3" />
              </animateMotion>
            </circle>
            {/* Step 3 Badge */}
            <g transform="translate(643, 195)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 3 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 3 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                3
              </text>
            </g>

            {/* Path 4: Workflow Plan to SerpApi */}
            <path
              id="flow-path-4"
              d="M 930 167 L 965 167 L 965 270 L 985 270"
              fill="none"
              stroke={selectedStep === 4 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 4 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 4 ? "6 4" : undefined}
              className={selectedStep === 4 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 4 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 4 Particle Motion */}
            <circle r={selectedStep === 4 ? "6" : "3.5"} fill={selectedStep === 4 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 4 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.8s" repeatCount="indefinite">
                <mpath href="#flow-path-4" />
              </animateMotion>
            </circle>
            {/* Step 4 Badge */}
            <g transform="translate(953, 205)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 4 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 4 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                4
              </text>
            </g>

            {/* Path 5: SerpApi to Job Boards */}
            <path
              id="flow-path-5"
              d="M 1065 320 L 1065 350"
              stroke={selectedStep === 5 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 5 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 5 ? "6 4" : undefined}
              className={selectedStep === 5 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 5 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 5 Particle Motion */}
            <circle r={selectedStep === 5 ? "6" : "3.5"} fill={selectedStep === 5 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 5 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.2s" repeatCount="indefinite">
                <mpath href="#flow-path-5" />
              </animateMotion>
            </circle>
            {/* Step 5 Badge */}
            <g transform="translate(1053, 324)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 5 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 5 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                5
              </text>
            </g>

            {/* Path 6: Job raw posts back to Extract Step */}
            <path
              id="flow-path-6"
              d="M 985 385 L 955 385 L 955 235 L 930 235"
              fill="none"
              stroke={selectedStep === 6 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 6 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 6 ? "6 4" : undefined}
              className={selectedStep === 6 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 6 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 6 Particle Motion */}
            <circle r={selectedStep === 6 ? "6" : "3.5"} fill={selectedStep === 6 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 6 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.9s" repeatCount="indefinite">
                <mpath href="#flow-path-6" />
              </animateMotion>
            </circle>
            {/* Step 6 Badge */}
            <g transform="translate(943, 295)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 6 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 6 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                6
              </text>
            </g>

            {/* Path 7: Extract to ThaiLLM & Verify */}
            <path
              id="flow-path-7"
              d="M 930 180 L 985 180"
              stroke={selectedStep === 7 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 7 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 7 ? "6 4" : undefined}
              className={selectedStep === 7 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 7 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 7 Particle Motion */}
            <circle r={selectedStep === 7 ? "6" : "3.5"} fill={selectedStep === 7 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 7 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.3s" repeatCount="indefinite">
                <mpath href="#flow-path-7" />
              </animateMotion>
            </circle>
            {/* Step 7 Badge */}
            <g transform="translate(948, 169)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 7 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 7 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                7
              </text>
            </g>

            {/* Path 8: Return filtered jobs from Gateway to Front-end View */}
            <path
              id="flow-path-8"
              d="M 470 375 L 432 375"
              stroke={selectedStep === 8 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 8 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 8 ? "6 4" : undefined}
              className={selectedStep === 8 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 8 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 8 Particle Motion */}
            <circle r={selectedStep === 8 ? "6" : "3.5"} fill={selectedStep === 8 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 8 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.3s" repeatCount="indefinite">
                <mpath href="#flow-path-8" />
              </animateMotion>
            </circle>
            {/* Step 8 Badge */}
            <g transform="translate(440, 364)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 8 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 8 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                8
              </text>
            </g>
            <text x="428" y="362" textAnchor="end" fill="#64748b" fontSize="9.5" fontStyle="italic">
              JSON Results
            </text>

            {/* Path 9: Schedule slots to Ranker */}
            <path
              id="flow-path-9"
              d="M 317 320 L 317 340"
              stroke={selectedStep === 9 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 9 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 9 ? "6 4" : undefined}
              className={selectedStep === 9 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 9 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 9 Particle Motion */}
            <circle r={selectedStep === 9 ? "6" : "3.5"} fill={selectedStep === 9 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 9 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.2s" repeatCount="indefinite">
                <mpath href="#flow-path-9" />
              </animateMotion>
            </circle>
            {/* Step 9 Badge */}
            <g transform="translate(305, 322)">
              <rect
                x="0"
                y="0"
                width="24"
                height="22"
                rx="5"
                fill={selectedStep === 9 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 9 ? "url(#glow)" : undefined}
              />
              <text x="12" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                9
              </text>
            </g>

            {/* Path 10: Ranker to Explain Workflow */}
            <path
              id="flow-path-10"
              d="M 432 490 L 695 490"
              stroke={selectedStep === 10 ? "#2563eb" : "#64748b"}
              strokeWidth={selectedStep === 10 ? "3" : "1.8"}
              strokeDasharray={selectedStep === 10 ? "6 4" : undefined}
              className={selectedStep === 10 ? "animate-dash-flow" : undefined}
              markerEnd={selectedStep === 10 ? "url(#arrow-active)" : "url(#arrow)"}
            />
            {/* Step 10 Particle Motion */}
            <circle r={selectedStep === 10 ? "6" : "3.5"} fill={selectedStep === 10 ? "#3b82f6" : "#60a5fa"} filter={selectedStep === 10 ? "url(#glow)" : undefined}>
              <animateMotion dur="1.7s" repeatCount="indefinite">
                <mpath href="#flow-path-10" />
              </animateMotion>
            </circle>
            {/* Step 10 Badge */}
            <g transform="translate(545, 479)">
              <rect
                x="0"
                y="0"
                width="28"
                height="22"
                rx="5"
                fill={selectedStep === 10 ? "#2563eb" : "#0284c7"}
                filter={selectedStep === 10 ? "url(#glow)" : undefined}
              />
              <text x="14" y="15" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="12">
                10
              </text>
            </g>
            <text x="560" y="474" textAnchor="middle" fill="#64748b" fontSize="9.5" fontStyle="italic">
              POST /api/explain
            </text>
          </svg>
        </div>
      </div>

      {/* Selected Step Description Card */}
      <div className="mt-5 rounded-2xl border border-line bg-sunken p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-bold text-white shadow-xs">
              {active.id}
            </span>
            <div>
              <h3 className="text-lg font-bold text-ink sm:text-xl">{active.title}</h3>
              <p className="text-xs text-muted">
                {active.fromDesc} ───▶ {active.toDesc}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-surface px-3.5 py-1 text-xs font-bold text-muted ring-1 ring-line">
            ลำดับ {active.id} จาก {archSteps.length}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted">{active.detail}</p>

        {liveVal && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-good-soft px-4 py-2.5 text-xs font-medium text-good">
            <span className="h-2 w-2 rounded-full bg-good animate-ping" />
            <span className="font-bold">ข้อมูลจริงจากการค้นหาล่าสุด:</span>
            <span className="break-words font-semibold">{liveVal}</span>
          </div>
        )}
      </div>

      {/* Bottom Architecture Legend */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-4 text-xs text-muted">
        <div className="flex flex-wrap gap-5">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-dashed border-slate-400 bg-slate-100" />
            <span>Front end (Client Boundary)</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border-2 border-rose-600 bg-white" />
            <span>AI Processing Workflow</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-sky-600" />
            <span>ลำดับการทำงาน (1-10 Data Flow)</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-purple-600" />
            <span>ThaiLLM Engine</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-emerald-600" />
            <span>Google Jobs (SerpApi)</span>
          </span>
        </div>
        <span className="text-[11px] text-faint">
          คำแนะนำ: คลิกที่หมายเลขสเต็ป 1-10 ด้านบน เพื่อดูการทำงานของข้อมูลในแต่ละขั้น
        </span>
      </div>
    </section>
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
