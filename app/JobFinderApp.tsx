"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import {
  agentExplanation,
  days,
  defaultSchedule,
  filterAndScoreJobs,
  formatDistance,
  formatWage,
  getSuggestions,
  initialProfile,
  interestOptions,
  scheduleStatus,
  searchDemoJobs,
  shiftsOverlap,
  skillOptions,
  thaiDayNames,
  timeToMinutes,
  type DataSource,
  type Day,
  type Job,
  type JobSource,
  type MatchResult,
  type ScheduleBlock,
  type SearchOutcome,
  type Shift,
  type StudentProfile,
  type Tier,
} from "./job-logic";
import { ALL_THAILAND, DEFAULT_LOCATION, provinceByLocation, provinces, regions } from "./thai-provinces";
import { saveTrace, type RemovedJob, type SearchTrace, type ServerTrace } from "./trace";
import { SiteHeader } from "./site-header";
import { ResumeOcr, type AppliedResume } from "./ResumeOcr";
import { ScheduleOcr } from "./ScheduleOcr";

/* ---------- Week grid helpers ---------- */

const HOURS = Array.from({ length: 15 }, (_, index) => index + 7); // cells 07:00–22:00
const GRID_START = 7 * 60;
const GRID_END = 22 * 60;

const dayShort: Record<Day, string> = {
  Monday: "จ.",
  Tuesday: "อ.",
  Wednesday: "พ.",
  Thursday: "พฤ.",
  Friday: "ศ.",
  Saturday: "ส.",
  Sunday: "อา.",
};

const dayLong = thaiDayNames;

const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
const cellKey = (day: Day, hour: number) => `${day}-${hour}`;

function scheduleToCells(schedule: ScheduleBlock[]) {
  const cells = new Set<string>();
  for (const block of schedule) {
    const first = Math.floor(timeToMinutes(block.start) / 60);
    const last = Math.ceil(timeToMinutes(block.end) / 60);
    for (let hour = first; hour < last; hour += 1) {
      if (HOURS.includes(hour)) cells.add(cellKey(block.day, hour));
    }
  }
  return cells;
}

/** Merge painted hour cells into class blocks for the conflict checker. */
function cellsToSchedule(cells: Set<string>): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];
  let id = 1;
  for (const day of days) {
    let runStart: number | null = null;
    for (const hour of [...HOURS, 99]) {
      const filled = hour !== 99 && cells.has(cellKey(day, hour));
      if (filled && runStart === null) runStart = hour;
      if (!filled && runStart !== null) {
        blocks.push({ id: id++, day, start: pad(runStart), end: pad(hour === 99 ? 22 : hour) });
        runStart = null;
      }
    }
  }
  return blocks;
}

function formatShiftsThai(shifts: Shift[]) {
  if (!shifts.length) return "ประกาศไม่ระบุวัน-เวลา";
  return shifts.map((shift) => `${dayShort[shift.day]} ${shift.start}–${shift.end}`).join(" · ");
}

/* ---------- API responses ---------- */

/** Parse a JSON body; returns null for HTML error pages (e.g. dev server restarting) instead of throwing. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Turn a server error into a short message for students. Technical details (which key, which provider)
 * go to the browser console for developers only.
 */
function describeApiError(error: string | undefined, status: number, details?: unknown) {
  console.error("[job search]", { error, status, details });
  const reason = typeof details === "string" ? details : "";
  if (/run out of searches|limit/i.test(reason) || status === 429) return "ค้นหางานจริงครบจำนวนที่ใช้ได้แล้ว ลองใหม่ภายหลัง";
  if (/location/i.test(reason)) return `ไม่รู้จักพื้นที่นี้ ลองพิมพ์ เช่น "Bangkok, Thailand"`;
  if (error === "Could not fetch jobs") return "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
  if (error === "Missing job API key") return "ยังไม่ได้ใส่ API key ของระบบค้นหางาน (SERPAPI_API_KEY ในไฟล์ .env)";
  return "ระบบค้นหางานจริงยังไม่พร้อมใช้งานในขณะนี้";
}

/* ---------- Trace helpers ---------- */

/** Jobs the browser drops before ranking, with a human reason (for the /how-it-works tracking page). */
function removedJobs(jobs: Job[], schedule: ScheduleBlock[]): RemovedJob[] {
  const removed: RemovedJob[] = [];
  for (const job of jobs) {
    if (job.status === "suspicious") {
      removed.push({ title: job.title, company: job.company, reason: "มีคำเสี่ยงหลอกลวง (เช่น ให้โอนเงินก่อน / ติดต่อทาง Telegram)" });
      continue;
    }
    if (scheduleStatus(job, schedule) !== "conflict") continue;
    const clash = job.shifts
      .flatMap((shift) => schedule.filter((block) => shiftsOverlap(shift, block)).map((block) => ({ shift, block })))
      .at(0);
    removed.push({
      title: job.title,
      company: job.company,
      reason: clash
        ? `เวลางาน ${dayShort[clash.shift.day]} ${clash.shift.start}–${clash.shift.end} ชนคาบเรียน ${clash.block.start}–${clash.block.end}`
        : "ชนคาบเรียน",
    });
  }
  return removed;
}

/* ---------- Tier presentation ---------- */

const tierInfo: Record<Tier, { title: string; hint: string; pill: string; pillClass: string }> = {
  match: {
    title: "ตรงทุกเกณฑ์",
    hint: "ไม่ชนคาบเรียน และผ่านค่าจ้าง ระยะทาง ชั่วโมงที่คุณตั้งไว้",
    pill: "ตรงเกณฑ์",
    pillClass: "bg-good-soft text-good",
  },
  relaxed: {
    title: "ผ่านเกณฑ์ที่ Agent ผ่อนให้",
    hint: "ไม่ชนคาบเรียน แต่ใช้ระยะทาง/ค่าจ้างที่ผ่อนลงจากที่คุณตั้ง",
    pill: "ผ่อนเกณฑ์",
    pillClass: "bg-accent-soft text-accent-strong",
  },
  check: {
    title: "ข้อมูลไม่ครบ ต้องสอบถามนายจ้าง",
    hint: "ประกาศไม่บอกเวลา ค่าจ้าง หรือระยะทาง จึงยังยืนยันไม่ได้",
    pill: "ต้องสอบถาม",
    pillClass: "bg-warn-soft text-warn",
  },
  other: {
    title: "ไม่ตรงบางเกณฑ์",
    hint: "ไม่ชนคาบเรียน แต่ค่าจ้าง ระยะทาง หรือชั่วโมงไม่ผ่าน",
    pill: "ไม่ตรงบางข้อ",
    pillClass: "bg-class-soft text-muted",
  },
};
const tierOrder: Tier[] = ["match", "relaxed", "check", "other"];

/* ---------- App ---------- */

export function JobFinderApp() {
  const [profile, setProfile] = useState<StudentProfile>(initialProfile);
  const [cells, setCells] = useState<Set<string>>(() => scheduleToCells(defaultSchedule));
  const [jobQuery, setJobQuery] = useState("");
  const [jobLocation, setJobLocation] = useState(DEFAULT_LOCATION);
  const locationName = provinceByLocation(jobLocation)?.th ?? jobLocation;
  const [dataSource, setDataSource] = useState<DataSource>("live");
  const [jobSource, setJobSource] = useState<JobSource>("idle");
  const [sourceMessage, setSourceMessage] = useState("");
  const [foundCount, setFoundCount] = useState(0);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [mobileStep, setMobileStep] = useState<MobileStep>(1);
  const [resume, setResume] = useState<AppliedResume | null>(null);
  const resumeKeywords = useMemo(
    () => (resume ? [...new Set([resume.role, ...resume.keywords].filter(Boolean))] : []),
    [resume],
  );

  const applyResume = (next: AppliedResume) => {
    setResume(next);
    if (next.role) setJobQuery(next.role);
    setProfile((current) => ({
      ...current,
      skills: [...new Set([...current.skills, ...next.skills])],
      interests: [...new Set([...current.interests, ...next.interests])],
    }));
  };
  const autoAdvanceRef = useRef(false);
  const searchStartedAt = useRef(0);
  const traceRef = useRef<SearchTrace | null>(null);

  const goToMobileStep = (step: MobileStep) => {
    autoAdvanceRef.current = false;
    setMobileStep(step);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!hasSearched || isSearching || !autoAdvanceRef.current) return;
    const timer = window.setTimeout(() => {
      if (!autoAdvanceRef.current) return;
      autoAdvanceRef.current = false;
      setMobileStep(4);
      if (window.innerWidth < 1024) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [hasSearched, isSearching]);

  const schedule = useMemo(() => cellsToSchedule(cells), [cells]);
  const results = useMemo(() => outcome?.results ?? [], [outcome]);
  const busy = isSearching || isExplaining;

  /* Painting class hours with click-and-drag */
  const paintMode = useRef<boolean | null>(null);
  useEffect(() => {
    const stop = () => {
      paintMode.current = null;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const setCell = (key: string, filled: boolean) => {
    setCells((current) => {
      if (current.has(key) === filled) return current;
      const next = new Set(current);
      if (filled) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const onCellPointerDown = (event: PointerEvent<HTMLButtonElement>, key: string) => {
    if (event.pointerType === "mouse") event.preventDefault(); // no text selection while dragging
    const mode = !cells.has(key);
    paintMode.current = mode;
    setCell(key, mode);
  };
  const onCellPointerEnter = (key: string) => {
    if (paintMode.current !== null) setCell(key, paintMode.current);
  };
  const onCellClick = (event: MouseEvent<HTMLButtonElement>, key: string) => {
    if (event.detail === 0) setCell(key, !cells.has(key)); // keyboard Enter/Space
  };

  const toggleChip = (field: "skills" | "interests", value: string) => {
    setProfile((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  };

  const finishTrace = () => {
    const trace = traceRef.current;
    if (!trace) return;
    trace.totalMs = Math.round(performance.now() - searchStartedAt.current);
    saveTrace(trace);
  };

  const explainResults = (nextResults: MatchResult[]) => {
    setIsExplaining(true);
    const explainStarted = performance.now();
    let explainOk = false;
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        schedule,
        suggestions: getSuggestions(jobQuery, locationName),
        results: nextResults.map((result) => ({
          title: result.job.title,
          company: result.job.company,
          score: result.score,
          wage: result.job.wage,
          distance: result.job.distance,
          weeklyHours: result.weeklyHours,
          scheduleSafe: result.scheduleSafe,
          scheduleStatus: result.scheduleStatus,
          isRelaxed: result.isRelaxed,
          reasons: result.reasons,
          warnings: result.warnings,
        })),
      }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data: { explanation?: string }) => {
        explainOk = Boolean(data.explanation?.trim());
        setAiExplanation(data.explanation?.trim() ?? "");
      })
      .catch(() => setAiExplanation(""))
      .finally(() => {
        setIsExplaining(false);
        setElapsedMs(performance.now() - searchStartedAt.current);
        traceRef.current?.events.push({
          actor: "ai",
          title: "ThaiLLM เขียนคำแนะนำ",
          detail: explainOk
            ? `สรุปจาก ${Math.min(nextResults.length, 3)} งานอันดับต้น (ไม่คำนวณตารางเวลาเอง)`
            : "AI ไม่พร้อม ใช้คำสรุปที่ระบบเขียนเองแทน",
          ms: Math.round(performance.now() - explainStarted),
          status: explainOk ? "ok" : "skip",
        });
        finishTrace();
      });
  };

  const runSearch = async () => {
    if (busy) return;
    autoAdvanceRef.current = true;
    setMobileStep(3);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setHasSearched(true);
    setIsSearching(true);
    setElapsedMs(null);
    searchStartedAt.current = performance.now();
    setAiExplanation("");
    setOutcome(null);
    setOpenId(null);
    setFoundCount(0);
    setJobSource("idle");
    setSourceMessage("กำลังค้นหางาน…");
    const trace: SearchTrace = {
      at: new Date().toISOString(),
      mode: dataSource,
      query: jobQuery.trim() || "งานพาร์ทไทม์ทั่วไป",
      locationName,
      totalMs: 0,
      ok: true,
      events: [
        {
          actor: "browser",
          title: "อ่านข้อมูลจากหน้าเว็บ",
          detail: `ตารางเรียน ${schedule.length} ช่วง · ทักษะ ${profile.skills.length} อย่าง${resumeKeywords.length ? ` · คำจากเรซูเม่ ${resumeKeywords.length} คำ` : ""} · ${dataSource === "demo" ? "โหมดงานตัวอย่าง" : `ส่งคำขอไปเซิร์ฟเวอร์ (${locationName})`}`,
          status: "ok",
        },
      ],
      sources: [],
      extraction: [],
      removed: [],
    };
    traceRef.current = trace;

    try {
      let foundJobs: Job[];
      let foundMessage: string;

      if (dataSource === "demo") {
        const demo = searchDemoJobs(jobQuery);
        foundJobs = demo.jobs;
        foundMessage = demo.matched
          ? `พบงานตัวอย่าง ${foundJobs.length} งาน`
          : `ไม่พบ "${jobQuery}" ในงานตัวอย่าง จึงแสดงทั้งหมด ${foundJobs.length} งาน`;
        trace.events.push({ actor: "browser", title: "ค้นในงานตัวอย่าง (ในเครื่อง ไม่ใช้อินเทอร์เน็ต)", detail: foundMessage, ms: 0, status: "ok" });
        trace.sources = [{ name: "ข้อมูลตัวอย่าง (สมมติ)", count: foundJobs.length }];
      } else {
        const response = await fetch(
          `/api/jobs?query=${encodeURIComponent(jobQuery)}&location=${encodeURIComponent(jobLocation)}${
            resumeKeywords.length ? `&resume=${encodeURIComponent(resumeKeywords.join("|"))}` : ""
          }`,
        );
        const data = (await readJson(response)) as {
          jobs?: Job[];
          error?: string;
          details?: unknown;
          trace?: ServerTrace;
        } | null;
        if (!data) throw new Error("ระบบขัดข้องชั่วคราว ลองกดค้นหาอีกครั้ง");
        if (!response.ok) throw new Error(describeApiError(data.error, response.status, data.details));
        foundJobs = Array.isArray(data.jobs) ? data.jobs : [];
        foundMessage = `พบ ${foundJobs.length} งานใน${locationName}`;
        if (data.trace) {
          trace.events.push(...data.trace.events);
          trace.sources = data.trace.sources;
          trace.extraction = data.trace.extraction;
        }
      }

      setFoundCount(foundJobs.length);
      setSourceMessage(foundMessage);

      if (!foundJobs.length) {
        setJobSource("empty-live");
        setOutcome({ results: [], excludedConflicts: 0, excludedSuspicious: 0, relaxNote: "" });
        setIsSearching(false);
        explainResults([]);
        return;
      }

      const filterStarted = performance.now();
      const next = filterAndScoreJobs(foundJobs, { ...profile, resumeKeywords }, schedule);
      trace.removed = removedJobs(foundJobs, schedule);
      trace.events.push({
        actor: "browser",
        title: "เทียบเวลางานกับตารางเรียน และจัดอันดับ (โค้ด ไม่ใช่ AI)",
        detail: `ตัดงานชนคาบเรียน ${next.excludedConflicts} · ตัดงานน่าสงสัย ${next.excludedSuspicious} · เหลือจัดอันดับ ${next.results.length} งาน (ตรงเกณฑ์ ${next.results.filter((result) => result.tier === "match").length})`,
        ms: Math.round(performance.now() - filterStarted),
        status: "ok",
      });
      trace.events.push({
        actor: "browser",
        title: "Repeat: ปรับเกณฑ์ถ้างานน้อย",
        detail: next.relaxNote || "ไม่ต้องผ่อนเกณฑ์",
        status: next.relaxNote ? "ok" : "skip",
      });
      saveTrace(trace);
      setOutcome(next);
      setJobSource("live");
      setOpenId(next.results[0]?.job.id ?? null);
      setIsSearching(false);
      explainResults(next.results);
    } catch (error) {
      trace.ok = false;
      trace.events.push({ actor: "browser", title: "ค้นหาไม่สำเร็จ", detail: error instanceof Error ? error.message : "ไม่ทราบสาเหตุ", status: "error" });
      finishTrace();
      setJobSource("error");
      setSourceMessage(
        `${error instanceof Error ? error.message : "ค้นหาไม่สำเร็จ"} · ระหว่างนี้ดู "งานตัวอย่าง" ได้`,
      );
      setIsSearching(false);
      setIsExplaining(false);
    }
  };

  const freeHours = HOURS.length * days.length - cells.size;
  const matchCount = results.filter((result) => result.tier === "match").length;
  const explanation = aiExplanation || agentExplanation(profile, schedule, results, jobQuery, locationName);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader active="search">
        <Segmented
          label="แหล่งข้อมูลงาน"
          value={dataSource}
          onChange={(value) => setDataSource(value as DataSource)}
          options={[
            { value: "live", label: "งานจริง" },
            { value: "demo", label: "งานตัวอย่าง" },
          ]}
        />
      </SiteHeader>
      <MobileStepper
        step={mobileStep}
        onSelect={goToMobileStep}
        isSearching={isSearching}
        hasSearched={hasSearched}
        resultsCount={results.length}
      />
      <Hero hiddenOnMobile={mobileStep !== 1} />

      <main className="page-layout mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:py-7">
          {/* 2. Class schedule (middle column on wide screens) */}
          <section
            className={`area-schedule mobile-screen panel p-4 sm:p-5 ${mobileStep === 2 ? "block" : "hidden lg:block"}`}
            aria-labelledby="schedule-title"
          >
            <SectionHead
              step="2"
              id="schedule-title"
              title="ตารางเรียนของคุณ"
              sub="คลิกหรือลากเพื่อระบายชั่วโมงที่ติดเรียน"
              right={
                <div className="flex shrink-0 gap-2">
                  <SmallButton onClick={() => setCells(scheduleToCells(defaultSchedule))}>ตัวอย่าง</SmallButton>
                  <SmallButton onClick={() => setCells(new Set())}>ล้าง</SmallButton>
                </div>
              }
            />
            <ScheduleOcr onApply={(blocks) => setCells(scheduleToCells(blocks.map((block, index) => ({ ...block, id: index + 1 }))))} />
            <div className="mt-4 grid select-none grid-cols-[2.6rem_repeat(7,minmax(0,1fr))] gap-1" role="group" aria-label="ตารางเรียนรายสัปดาห์">
              <span />
              {days.map((day) => (
                <span key={day} className="pb-1 text-center text-xs font-semibold text-muted">
                  {dayShort[day]}
                </span>
              ))}
              {HOURS.map((hour) => (
                <WeekRow key={hour} hour={hour}>
                  {days.map((day) => {
                    const key = cellKey(day, hour);
                    return (
                      <button
                        key={key}
                        type="button"
                        className="slot"
                        aria-pressed={cells.has(key)}
                        aria-label={`${dayLong[day]} ${pad(hour)}–${pad(hour + 1)} ${cells.has(key) ? "ติดเรียน" : "ว่าง"}`}
                        onPointerDown={(event) => onCellPointerDown(event, key)}
                        onPointerEnter={() => onCellPointerEnter(key)}
                        onClick={(event) => onCellClick(event, key)}
                      />
                    );
                  })}
                </WeekRow>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <Legend swatch="bg-class" label="ติดเรียน" />
              <Legend swatch="bg-sunken ring-1 ring-line" label="ว่าง" />
              <span className="ml-auto font-semibold text-ink">
                ว่าง {freeHours} ชม./สัปดาห์ (ช่วง 07:00–22:00)
              </span>
            </div>
          </section>

          {/* 1. Preferences (left column on wide screens) */}
          <section
            className={`area-prefs mobile-screen panel flex-col p-4 sm:p-5 ${mobileStep === 1 ? "flex" : "hidden lg:flex"}`}
            aria-labelledby="prefs-title"
          >
            <SectionHead step="1" id="prefs-title" title="งานแบบไหนที่อยากได้" sub="Agent ใช้ข้อมูลนี้คัดกรองและจัดอันดับ" />
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
              <ResumeOcr applied={resume} onApply={applyResume} onClear={() => setResume(null)} />
              <Field label="ตำแหน่งงาน">
                <input className="field" value={jobQuery} onChange={(event) => setJobQuery(event.target.value)} placeholder="เช่น ติวเตอร์, barista" />
              </Field>
              <Field label="จังหวัด">
                <select className="field" value={jobLocation} onChange={(event) => setJobLocation(event.target.value)}>
                  <option value={ALL_THAILAND.location}>{ALL_THAILAND.th}</option>
                  {regions.map((region) => (
                    <optgroup key={region.id} label={region.th}>
                      {provinces
                        .filter((province) => province.region === region.id)
                        .map((province) => (
                          <option key={province.location} value={province.location}>
                            {province.th}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <NumberField label="ค่าจ้างขั้นต่ำ" unit="บาท/ชม." value={profile.minWage} onChange={(value) => setProfile({ ...profile, minWage: value })} />
                <NumberField label="ระยะทางสูงสุด" unit="กม." step={0.5} value={profile.maxDistance} onChange={(value) => setProfile({ ...profile, maxDistance: value })} />
                <NumberField label="ทำได้สูงสุด" unit="ชม./สัปดาห์" value={profile.maxHours} onChange={(value) => setProfile({ ...profile, maxHours: value })} />
              </div>
              <Chips title="ทักษะ" options={skillOptions} selected={profile.skills} onToggle={(value) => toggleChip("skills", value)} />
              <Chips title="สนใจงานด้าน" options={interestOptions} selected={profile.interests} onToggle={(value) => toggleChip("interests", value)} />
            </div>
            <button
              type="button"
              onClick={runSearch}
              disabled={busy}
              className="btn-primary font-display mt-5 hidden w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-semibold disabled:cursor-wait disabled:opacity-70 lg:flex xl:mt-auto"
            >
              <Icon name="spark" className="h-5 w-5" />
              {isSearching ? "Agent กำลังค้นหา…" : isExplaining ? "Agent กำลังสรุปผล…" : "ให้ Agent หางานให้"}
            </button>
          </section>

        {/* 3. Agent loop — right column, stays in view while scrolling results */}
        <section
          className={`area-agent mobile-screen panel overflow-hidden lg:sticky lg:top-[5.25rem] lg:block lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto ${mobileStep === 3 ? "block" : "hidden"}`}
          aria-labelledby="agent-title"
          aria-live="polite"
        >
          <AgentPanel
            hasSearched={hasSearched}
            isSearching={isSearching}
            isExplaining={isExplaining}
            jobSource={jobSource}
            freeHours={freeHours}
            classBlocks={schedule.length}
            sourceMessage={sourceMessage}
            foundCount={foundCount}
            outcome={outcome}
            elapsedMs={elapsedMs}
            explanation={explanation}
          />
        </section>

        {/* 4. Results */}
        <div className={`area-results mobile-screen gap-4 ${mobileStep === 4 ? "grid" : "hidden lg:grid"}`}>
        {hasSearched && !isSearching && jobSource !== "error" && (isExplaining || explanation) && (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm lg:hidden">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-strong">
              สรุปจาก AI Agent
            </p>
            <p className="mt-1 text-sm leading-6 text-ink">
              {isExplaining ? "กำลังสรุปคำแนะนำให้เข้ากับตารางเรียนของคุณ…" : explanation}
            </p>
          </div>
        )}
        <section className="@container panel p-4 sm:p-5" aria-labelledby="results-title">
          <SectionHead
            step="4"
            id="results-title"
            title="งานที่แนะนำ"
            sub="เรียงจากเหมาะที่สุด กดที่แถวเพื่อดูเหตุผลและเวลางานเทียบกับตารางเรียน"
            right={
              outcome && results.length ? (
                <span className="text-sm font-semibold text-muted">
                  ตรงเกณฑ์ {matchCount} · ทั้งหมด {results.length}
                </span>
              ) : null
            }
          />
          <div className="mt-4">
            {!hasSearched ? (
              <EmptyStart />
            ) : isSearching ? (
              <LoadingRows />
            ) : jobSource === "error" ? (
              <Notice tone="bad" title="ค้นหาไม่สำเร็จ">{sourceMessage}</Notice>
            ) : !results.length ? (
              <Notice tone="warn" title="ยังไม่พบงานที่ไม่ชนคาบเรียน">
                <ul className="mt-1 grid gap-1">
                  {getSuggestions(jobQuery, locationName).map((tip) => <li key={tip}>• {tip}</li>)}
                </ul>
              </Notice>
            ) : (
              <ResultsTable results={results} schedule={schedule} openId={openId} onToggle={(id) => setOpenId(openId === id ? null : id)} />
            )}
          </div>
        </section>

        <p className="pb-4 text-center text-xs text-faint">
          ตรวจสอบรายละเอียดกับนายจ้างทุกครั้งก่อนเริ่มงาน และอย่าโอนเงินค่าสมัครใด ๆ
        </p>
        </div>
      </main>
      <MobileBottomBar
        step={mobileStep}
        onSelect={goToMobileStep}
        onSearch={runSearch}
        busy={busy}
        isSearching={isSearching}
        hasSearched={hasSearched}
        resultsCount={results.length}
      />
    </div>
  );
}

/* ---------- Agent panel ---------- */

type StepState = "pending" | "running" | "done" | "error";
type StepName = "Think" | "Act" | "Observe" | "Repeat";

function AgentPanel({
  hasSearched,
  isSearching,
  isExplaining,
  jobSource,
  freeHours,
  classBlocks,
  sourceMessage,
  foundCount,
  outcome,
  elapsedMs,
  explanation,
}: {
  hasSearched: boolean;
  isSearching: boolean;
  isExplaining: boolean;
  jobSource: JobSource;
  freeHours: number;
  classBlocks: number;
  sourceMessage: string;
  foundCount: number;
  outcome: SearchOutcome | null;
  elapsedMs: number | null;
  explanation: string;
}) {
  const matched = outcome?.results.filter((result) => result.tier === "match").length ?? 0;
  const failed = jobSource === "error";
  const working = isSearching || isExplaining;

  const steps: Array<{ name: StepName; thai: string; detail: React.ReactNode; state: StepState }> = [
    {
      name: "Think",
      thai: "คิด",
      detail: hasSearched
        ? `อ่านตารางเรียน ${classBlocks} ช่วง ว่าง ${freeHours} ชม./สัปดาห์`
        : "รอข้อมูลตารางเรียนและงานที่อยากได้",
      state: hasSearched ? "done" : "pending",
    },
    {
      name: "Act",
      thai: "ค้นหา",
      detail: hasSearched ? sourceMessage : "ค้นหางานตามที่คุณต้องการ",
      state: !hasSearched ? "pending" : failed ? "error" : isSearching ? "running" : "done",
    },
    {
      name: "Observe",
      thai: "ตรวจ",
      detail: outcome ? (
        <span className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone="neutral">พบ {foundCount}</Chip>
          <Chip tone="bad">ชนคาบเรียน −{outcome.excludedConflicts}</Chip>
          <Chip tone="warn">น่าสงสัย −{outcome.excludedSuspicious}</Chip>
          <Chip tone="good">ตรงเกณฑ์ {matched}</Chip>
        </span>
      ) : (
        "ตรวจเวลาชนคาบ งานน่าสงสัย และเกณฑ์ที่ตั้งไว้"
      ),
      state: outcome ? "done" : "pending",
    },
    {
      name: "Repeat",
      thai: "ปรับ",
      detail: outcome ? (
        outcome.relaxNote ? (
          <span className="mt-1 block rounded-lg bg-accent-soft px-2.5 py-1.5 text-accent-strong">{outcome.relaxNote}</span>
        ) : matched >= 5 ? (
          "เจองานตรงเกณฑ์พอแล้ว ไม่ต้องผ่อนเกณฑ์"
        ) : (
          "ไม่ได้ตั้งค่าจ้าง/ระยะทาง จึงไม่มีเกณฑ์ให้ผ่อน"
        )
      ) : (
        "ถ้าได้น้อยกว่า 5 งาน จะขยายระยะทางและลดค่าจ้างขั้นต่ำ"
      ),
      state: outcome ? "done" : "pending",
    },
  ];

  const doneCount = steps.filter((step) => step.state === "done").length;
  const progress = failed ? 100 : (doneCount / steps.length) * 100;
  const status = failed
    ? { label: "มีปัญหา", dot: "bg-bad", pill: "bg-bad/20 text-[#ffb4ab]", pulse: false }
    : isSearching
      ? { label: "กำลังค้นหา", dot: "bg-highlight", pill: "bg-highlight/15 text-highlight", pulse: true }
      : isExplaining
        ? { label: "กำลังสรุปผล", dot: "bg-highlight", pill: "bg-highlight/15 text-highlight", pulse: true }
        : hasSearched
          ? {
              label: `เสร็จแล้ว${elapsedMs !== null ? ` · ${(elapsedMs / 1000).toFixed(1)} วิ` : ""}`,
              dot: "bg-job",
              pill: "bg-job/20 text-[#86efac]",
              pulse: false,
            }
          : { label: "พร้อมทำงาน", dot: "bg-white/60", pill: "bg-white/10 text-white/80", pulse: false };

  return (
    <>
      {/* Header bar */}
      <div className="bg-topbar px-4 pb-4 pt-4 text-white sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-brand relative grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-white/20">
              <Icon name="spark" className="h-5 w-5" />
              {working ? (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-highlight" aria-hidden="true" />
              ) : null}
            </span>
            <div>
              <h2 id="agent-title" className="font-bold leading-6">
                Agent กำลังทำอะไร
              </h2>
              <p className="text-xs text-white/60">Think → Act → Observe → Repeat</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot} ${status.pulse ? "animate-pulse" : ""}`} aria-hidden="true" />
            {status.label}
          </span>
          <span className="text-xs tabular-nums text-white/60">
            {doneCount}/{steps.length} ขั้น
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="ความคืบหน้าของ Agent"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${failed ? "bg-bad" : working ? "bg-highlight" : "bg-job"}`}
            style={{ width: `${Math.max(progress, working ? 12 : 0)}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ol className="px-4 pt-4 sm:px-5">
        {steps.map((step, index) => (
          <li key={step.name} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                className={`absolute bottom-0 left-[1.06rem] top-10 w-0.5 rounded-full ${step.state === "done" ? "bg-accent" : "bg-line"}`}
                aria-hidden="true"
              />
            ) : null}
            <StepIcon name={step.name} state={step.state} />
            <div
              className={`min-w-0 rounded-xl px-3 py-2 transition ${
                step.state === "running"
                  ? "bg-accent-soft ring-1 ring-accent/40"
                  : step.state === "error"
                    ? "bg-bad-soft ring-1 ring-bad/40"
                    : ""
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className={`font-bold ${step.state === "pending" ? "text-faint" : ""}`}>{step.name}</span>
                <span className="text-sm text-muted">· {step.thai}</span>
                {step.state === "running" ? (
                  <span className="ml-auto text-xs font-semibold text-accent">
                    กำลังทำงาน<span className="animate-pulse">…</span>
                  </span>
                ) : null}
              </div>
              <div className={`mt-0.5 break-words text-sm leading-6 ${step.state === "pending" ? "text-faint" : "text-muted"}`}>
                {step.detail}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Advice */}
      <div className="p-4 sm:p-5">
        {hasSearched && !isSearching && !failed ? (
          <div className="rounded-xl border border-accent/20 bg-accent-soft/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-accent-strong">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
                <Icon name="spark" className="h-3.5 w-3.5" />
              </span>
              {isExplaining ? "กำลังสรุปคำแนะนำ…" : "คำแนะนำ"}
            </div>
            {isExplaining ? (
              <div className="grid gap-2" aria-hidden="true">
                <span className="h-3 w-full animate-pulse rounded bg-accent/15" />
                <span className="h-3 w-11/12 animate-pulse rounded bg-accent/15" />
                <span className="h-3 w-3/4 animate-pulse rounded bg-accent/15" />
              </div>
            ) : (
              <p className="text-sm leading-7 text-ink">{explanation}</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-faint">
            {failed ? "แก้ปัญหาแล้วลองกดค้นหาอีกครั้ง" : "คำแนะนำจะแสดงที่นี่หลังค้นหาเสร็จ"}
          </div>
        )}
      </div>
    </>
  );
}

function StepIcon({ name, state }: { name: StepName; state: StepState }) {
  const iconName: Record<StepName, IconName> = { Think: "bulb", Act: "search", Observe: "eye", Repeat: "repeat" };
  const style =
    state === "done"
      ? "bg-accent text-white"
      : state === "running"
        ? "bg-accent-soft text-accent"
        : state === "error"
          ? "bg-bad-soft text-bad"
          : "bg-sunken text-faint ring-1 ring-line";
  return (
    <span className={`relative z-10 grid h-9 w-9 place-items-center rounded-full ${style}`}>
      <Icon name={iconName[name]} className="h-[18px] w-[18px]" />
      {state === "running" ? (
        <span className="absolute -inset-1 animate-spin rounded-full border-2 border-accent/15 border-t-accent" aria-hidden="true" />
      ) : null}
      {state === "done" ? (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-job text-white ring-2 ring-surface">
          <Icon name="check" className="h-2.5 w-2.5" />
        </span>
      ) : null}
      {state === "error" ? (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-bad text-[10px] font-bold text-white ring-2 ring-surface">
          !
        </span>
      ) : null}
      <span className="sr-only">
        {state === "done" ? "เสร็จแล้ว" : state === "running" ? "กำลังทำงาน" : state === "error" ? "มีปัญหา" : "รอ"}
      </span>
    </span>
  );
}

function Chip({ tone, children }: { tone: "neutral" | "good" | "warn" | "bad"; children: React.ReactNode }) {
  const style = {
    neutral: "bg-class-soft text-ink",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{children}</span>;
}

type IconName = "bulb" | "search" | "eye" | "repeat" | "spark" | "check";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    bulb: (
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
        <circle cx="12" cy="12" r="2.8" />
      </>
    ),
    repeat: (
      <>
        <path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.5" />
        <path d="M20 3.5v5h-5" />
      </>
    ),
    spark: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "check" ? 3.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/* ---------- Results ---------- */

function ResultsTable({
  results,
  schedule,
  openId,
  onToggle,
}: {
  results: MatchResult[];
  schedule: ScheduleBlock[];
  openId: number | null;
  onToggle: (id: number) => void;
}) {
  return (
    <div className="grid gap-6">
      {tierOrder.map((tier) => {
        const group = results.filter((result) => result.tier === tier);
        if (!group.length) return null;
        return (
          <div key={tier}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <h3 className="font-bold">{tierInfo[tier].title}</h3>
              <span className="text-sm text-muted">{group.length} งาน · {tierInfo[tier].hint}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="hidden grid-cols-[3rem_minmax(0,2.2fr)_minmax(0,1.7fr)_6.5rem_minmax(0,1.3fr)_6.5rem] gap-3 border-b border-line bg-sunken px-4 py-2 text-xs font-semibold text-muted @3xl:grid">
                <span>คะแนน</span>
                <span>ตำแหน่ง</span>
                <span>วัน-เวลา</span>
                <span>ค่าจ้าง</span>
                <span>สถานที่</span>
                <span>สถานะ</span>
              </div>
              <div className="divide-y divide-line">
                {group.map((result) => {
                  return (
                    <JobRow
                      key={result.job.id}
                      rank={results.indexOf(result) + 1}
                      result={result}
                      schedule={schedule}
                      open={openId === result.job.id}
                      onToggle={() => onToggle(result.job.id)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobRow({
  rank,
  result,
  schedule,
  open,
  onToggle,
}: {
  rank: number;
  result: MatchResult;
  schedule: ScheduleBlock[];
  open: boolean;
  onToggle: () => void;
}) {
  const { job } = result;
  const info = tierInfo[result.tier];
  const panelId = `job-${job.id}`;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`grid w-full grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-sunken @3xl:grid-cols-[3rem_minmax(0,2.2fr)_minmax(0,1.7fr)_6.5rem_minmax(0,1.3fr)_6.5rem] @3xl:items-center ${open ? "bg-sunken" : ""}`}
      >
        <span className="row-span-5 @3xl:row-span-1">
          <span className="block text-xl font-bold leading-none">{result.score}</span>
          <span className="text-[11px] text-faint">#{rank}</span>
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{job.title}</span>
          <span className="block truncate text-sm text-muted">
            {job.company}
            {job.source === "demo" ? " · ตัวอย่าง" : ""}
          </span>
        </span>
        <span className={`text-sm ${job.shifts.length ? "" : "text-warn"}`}>{formatShiftsThai(job.shifts)}</span>
        <span className={`text-sm font-semibold ${job.wage === null ? "text-warn" : ""}`}>{formatWage(job.wage)}</span>
        <span className="min-w-0 text-sm text-muted">
          <span className="block truncate">{job.location ?? "-"}</span>
          <span className={job.distance === null ? "text-warn" : ""}>{formatDistance(job.distance)}</span>
        </span>
        <span>
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${info.pillClass}`}>{info.pill}</span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="grid gap-5 border-t border-line bg-surface px-4 py-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-4">
            <div>
              <h4 className="text-sm font-bold">ทำไมถึงแนะนำ</h4>
              <ul className="mt-1.5 grid gap-1 text-sm leading-6 text-muted">
                {result.reasons.slice(0, 4).map((reason) => <li key={reason}>✓ {reason}</li>)}
              </ul>
            </div>
            {result.warnings.length ? (
              <div className="rounded-lg bg-warn-soft p-3">
                <h4 className="text-sm font-bold text-warn">ควรเช็กก่อนสมัคร</h4>
                <ul className="mt-1 grid gap-1 text-sm leading-6 text-warn">
                  {result.warnings.map((warning) => <li key={warning}>! {warning}</li>)}
                </ul>
              </div>
            ) : null}
            <ScoreBars result={result} />
            {job.source === "demo" ? (
              <span className="w-fit rounded-lg bg-class-soft px-4 py-2.5 text-sm font-semibold text-muted">งานตัวอย่าง ไม่มีลิงก์สมัคร</span>
            ) : (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="w-fit rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-class"
              >
                ดูประกาศและสมัคร ↗
              </a>
            )}
          </div>
          <MiniWeek schedule={schedule} shifts={job.shifts} />
        </div>
      ) : null}
    </div>
  );
}

function ScoreBars({ result }: { result: MatchResult }) {
  const parts = [
    { label: "ทักษะ", value: result.skillScore, max: 35 },
    { label: "ชั่วโมง", value: result.timeScore, max: 25 },
    { label: "ค่าจ้าง", value: result.wageScore, max: 20 },
    { label: "ระยะทาง", value: result.distanceScore, max: 20 },
  ];
  return (
    <div>
      <h4 className="text-sm font-bold">คะแนน {result.score}/100</h4>
      <div className="mt-2 grid gap-1.5">
        {parts.map((part) => (
          <div key={part.label} className="grid grid-cols-[4rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs text-muted">
            <span>{part.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-class-soft">
              <span className="block h-full rounded-full bg-class" style={{ width: `${(part.value / part.max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{part.value}/{part.max}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Each day as a 07–22 timeline: class blocks in navy, this job's shifts in emerald. */
function MiniWeek({ schedule, shifts }: { schedule: ScheduleBlock[]; shifts: Shift[] }) {
  const span = GRID_END - GRID_START;
  const bar = (start: string, end: string) => {
    const from = Math.max(GRID_START, timeToMinutes(start));
    const to = Math.min(GRID_END, timeToMinutes(end));
    return { left: `${((from - GRID_START) / span) * 100}%`, width: `${(Math.max(0, to - from) / span) * 100}%` };
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold">เวลางานเทียบตารางเรียน</h4>
        <div className="flex gap-3 text-xs text-muted">
          <Legend swatch="bg-class" label="เรียน" />
          <Legend swatch="bg-job" label="งานนี้" />
        </div>
      </div>
      {!shifts.length ? (
        <p className="mt-2 rounded-lg bg-warn-soft p-3 text-sm text-warn">
          ประกาศนี้ไม่ระบุวัน-เวลาทำงาน จึงยังแสดงเทียบไม่ได้ ถามนายจ้างก่อนว่าเวลาไม่ชนคาบเรียน
        </p>
      ) : null}
      <div className="mt-2 grid gap-1">
        {days.map((day) => (
          <div key={day} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2">
            <span className="text-xs text-muted">{dayShort[day]}</span>
            <span className="relative h-5 rounded bg-sunken ring-1 ring-line">
              {schedule.filter((block) => block.day === day).map((block) => (
                <span key={`c-${block.id}`} className="absolute inset-y-0 rounded bg-class" style={bar(block.start, block.end)} />
              ))}
              {shifts.filter((shift) => shift.day === day).map((shift) => (
                <span
                  key={`s-${shift.start}`}
                  className="absolute inset-y-0.5 rounded bg-job"
                  style={bar(shift.start, shift.end)}
                  title={`${shift.start}–${shift.end}`}
                />
              ))}
            </span>
          </div>
        ))}
        <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 text-[11px] text-faint">
          <span />
          <span className="flex justify-between">
            <span>07</span>
            <span>12</span>
            <span>17</span>
            <span>22</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Small pieces ---------- */

function WeekRow({ hour, children }: { hour: number; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center text-[11px] tabular-nums text-faint">{pad(hour)}</span>
      {children}
    </>
  );
}

function SectionHead({ step, id, title, sub, right }: { step: string; id: string; title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="bg-brand font-display grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-[0_6px_14px_-8px_rgb(59_108_246/0.9)]">{step}</span>
        <div>
          <h2 id={id} className="text-[1.05rem] font-semibold leading-7">{title}</h2>
          <p className="text-sm text-muted">{sub}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-bar-soft p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition sm:px-3.5 sm:py-1.5 sm:text-sm ${
            value === option.value ? "bg-highlight text-ink" : "text-white/75 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted transition hover:border-line-strong hover:text-ink">
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

function NumberField({
  label,
  unit,
  value,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | "";
  step?: number;
  onChange: (value: number | "") => void;
}) {
  return (
    <label className="grid min-w-0 content-start gap-1.5 text-sm font-semibold">
      <span className="leading-5">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        placeholder="-"
        onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
        className="field"
      />
      <span className="text-xs font-normal text-faint">{unit}</span>
    </label>
  );
}

function Chips({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active ? "border-transparent bg-brand text-white shadow-[0_6px_14px_-8px_rgb(59_108_246/0.9)]" : "border-line bg-surface text-muted hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Notice({ tone, title, children }: { tone: "neutral" | "warn" | "bad"; title: string; children: React.ReactNode }) {
  const style = tone === "bad" ? "bg-bad-soft text-bad" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-sunken text-muted";
  return (
    <div className={`rounded-xl p-5 text-sm leading-6 ${style}`}>
      <h3 className="mb-1 font-bold">{title}</h3>
      {children}
    </div>
  );
}

type MobileStep = 1 | 2 | 3 | 4;

function MobileStepper({
  step,
  onSelect,
  isSearching,
  hasSearched,
  resultsCount,
}: {
  step: MobileStep;
  onSelect: (step: MobileStep) => void;
  isSearching: boolean;
  hasSearched: boolean;
  resultsCount: number;
}) {
  const items: Array<{ id: MobileStep; label: string; badge?: string }> = [
    { id: 1, label: "ข้อมูลงาน" },
    { id: 2, label: "ตารางเรียน" },
    { id: 3, label: isSearching ? "กำลังทำงาน" : "AI Agent" },
    {
      id: 4,
      label: "งานที่แนะนำ",
      badge: hasSearched && !isSearching ? String(resultsCount) : undefined,
    },
  ];
  const current = items.find((item) => item.id === step);

  return (
    <nav
      className="mobile-stepper sticky z-20 border-b border-line/80 bg-paper/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:hidden"
      aria-label="ขั้นตอนการใช้งาน"
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-bold text-ink">
          ขั้นที่ {step} จาก 4 · {current?.label}
        </span>
        <span className="font-semibold tabular-nums text-muted">
          {Math.round((step / 4) * 100)}%
        </span>
      </div>
      <ol className="grid grid-cols-4 gap-1.5">
        {items.map((item) => {
          const active = step === item.id;
          const done =
            item.id < step ||
            (item.id === 3 && hasSearched && !isSearching) ||
            (item.id === 4 && hasSearched && !isSearching && resultsCount > 0 && step === 4);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? "step" : undefined}
                className="flex w-full flex-col gap-1 text-left"
              >
                <span
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    active ? "bg-brand" : done ? "bg-good" : "bg-line"
                  }`}
                />
                <span
                  className={`flex items-center justify-center gap-1 truncate text-[11px] font-semibold ${
                    active ? "text-accent-strong" : "text-muted"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="rounded-full bg-accent-soft px-1 text-[10px] tabular-nums text-accent-strong">
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function MobileBottomBar({
  step,
  onSelect,
  onSearch,
  busy,
  isSearching,
  hasSearched,
  resultsCount,
}: {
  step: MobileStep;
  onSelect: (step: MobileStep) => void;
  onSearch: () => void;
  busy: boolean;
  isSearching: boolean;
  hasSearched: boolean;
  resultsCount: number;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line/90 bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-16px_rgb(15_23_42/0.18)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2.5">
        {step === 1 && (
          <>
            <button
              type="button"
              onClick={onSearch}
              disabled={busy}
              className="rounded-2xl bg-sunken px-4 py-3.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-white disabled:opacity-50"
            >
              ค้นหาเลย
            </button>
            <button
              type="button"
              onClick={() => onSelect(2)}
              className="btn-primary font-display flex-1 rounded-2xl px-4 py-3.5 text-base font-semibold"
            >
              ถัดไป: ตารางเรียน →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <button
              type="button"
              onClick={() => onSelect(1)}
              className="rounded-2xl bg-sunken px-4 py-3.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-white"
            >
              ← ข้อมูลงาน
            </button>
            <button
              type="button"
              onClick={onSearch}
              disabled={busy}
              className="btn-primary font-display flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-semibold disabled:cursor-wait disabled:opacity-70"
            >
              <Icon name="spark" className="h-5 w-5" />
              {isSearching ? "Agent กำลังค้นหา…" : "ให้ Agent หางานให้"}
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <button
              type="button"
              onClick={() => onSelect(2)}
              className="rounded-2xl bg-sunken px-4 py-3.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-white"
            >
              ← ตารางเรียน
            </button>
            {hasSearched && !isSearching ? (
              <button
                type="button"
                onClick={() => onSelect(4)}
                className="btn-primary font-display flex-1 rounded-2xl px-4 py-3.5 text-base font-semibold"
              >
                ดูงานที่แนะนำ ({resultsCount}) →
              </button>
            ) : isSearching ? (
              <button
                type="button"
                disabled
                className="btn-primary font-display flex-1 cursor-wait rounded-2xl px-4 py-3.5 text-base font-semibold opacity-80"
              >
                AI Agent กำลังทำงาน…
              </button>
            ) : (
              <button
                type="button"
                onClick={onSearch}
                disabled={busy}
                className="btn-primary font-display flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-semibold"
              >
                <Icon name="spark" className="h-5 w-5" />
                ให้ Agent หางานให้
              </button>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <button
              type="button"
              onClick={() => onSelect(3)}
              className="rounded-2xl bg-sunken px-4 py-3.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-white"
            >
              ← ดู Agent
            </button>
            <button
              type="button"
              onClick={() => onSelect(1)}
              className="btn-primary font-display flex-1 rounded-2xl px-4 py-3.5 text-base font-semibold"
            >
              ค้นหาใหม่
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Hero({ hiddenOnMobile }: { hiddenOnMobile?: boolean }) {
  const perks = [
    {
      label: "ไม่ชนคาบเรียน",
      icon: (
        <svg className="h-4 w-4 text-accent-strong" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      label: "กรองงานน่าสงสัย",
      icon: (
        <svg className="h-4 w-4 text-accent-strong" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      label: "อ่านตารางจากรูป",
      icon: (
        <svg className="h-4 w-4 text-accent-strong" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      ),
    },
  ];
  return (
    <div className={`mx-auto max-w-[1440px] px-4 pt-4 sm:px-6 lg:pt-8 ${hiddenOnMobile ? "hidden lg:block" : "block"}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="hidden text-sm font-semibold text-accent-strong lg:block">สำหรับนักเรียน นักศึกษา</p>
          <h1 className="text-xl font-bold leading-tight sm:text-2xl lg:mt-1 lg:text-[2rem]">
            หางานพาร์ทไทม์ที่ <span className="text-brand">ลงตัวกับตารางเรียน</span>
          </h1>
          <p className="mt-1 text-sm text-muted sm:text-base lg:mt-1.5">บอกงานที่อยากได้ ใส่ตารางเรียน แล้วให้ AI Agent คัดงานที่ทำได้จริงให้คุณ</p>
        </div>
        <ul className="hidden flex-wrap gap-2 lg:flex" aria-label="จุดเด่น">
          {perks.map((perk) => (
            <li
              key={perk.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-sm font-semibold text-ink shadow-sm backdrop-blur"
            >
              <span aria-hidden="true">{perk.icon}</span>
              {perk.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyStart() {
  const steps = [
    { n: "1", title: "บอกงานที่อยากได้", detail: "ตำแหน่ง จังหวัด ค่าจ้าง" },
    { n: "2", title: "ใส่ตารางเรียน", detail: "ระบายเอง หรืออัปโหลดรูปตาราง" },
    { n: "3", title: "ให้ Agent หางาน", detail: "คัดงานที่ไม่ชนคาบเรียนให้" },
  ];
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-sunken px-5 py-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <div>
          <h3 className="font-bold">ยังไม่ได้เริ่มค้นหา</h3>
          <p className="text-sm text-muted">3 ขั้นตอนก็ได้งานที่เข้ากับเวลาว่างของคุณ</p>
        </div>
      </div>
      <ol className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step.n} className="flex items-start gap-2.5 rounded-xl bg-surface p-3 ring-1 ring-line">
            <span className="bg-brand grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white">{step.n}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{step.title}</span>
              <span className="block text-xs text-muted">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="grid gap-2" aria-label="กำลังโหลด">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-sunken" />
      ))}
    </div>
  );
}
