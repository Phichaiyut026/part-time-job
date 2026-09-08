"use client";

import { useState } from "react";

type Day =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type Status = "verified" | "suspicious";
type Shift = { day: Day; start: string; end: string };
type ScheduleBlock = Shift & { id: number };

type Job = {
  id: number;
  title: string;
  company: string;
  category: string;
  shifts: Shift[];
  wage: number;
  distance: number;
  skills: string[];
  interests: string[];
  applyUrl: string;
  status: Status;
  location?: string;
  country?: string;
  source?: "openwebninja";
};

type StudentProfile = {
  name: string;
  major: string;
  skills: string[];
  interests: string[];
  minWage: number | "";
  maxDistance: number | "";
  maxHours: number | "";
};

type MatchResult = {
  job: Job;
  score: number;
  reasons: string[];
  warnings: string[];
  scheduleSafe: boolean;
  isRelaxed: boolean;
  skillScore: number;
  timeScore: number;
  wageScore: number;
  distanceScore: number;
  weeklyHours: number;
};

type JobSource = "idle" | "live" | "empty-live" | "error";

const days: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const skillOptions = ["English", "Excel", "Sales", "Teaching", "Design", "Coding"];
const interestOptions = ["Cafe", "Tutoring", "Retail", "Online", "Event"];

const defaultSchedule: ScheduleBlock[] = [
  { id: 1, day: "Monday", start: "09:00", end: "12:00" },
  { id: 2, day: "Tuesday", start: "13:00", end: "16:00" },
  { id: 3, day: "Wednesday", start: "10:00", end: "12:00" },
];

const initialProfile: StudentProfile = {
  name: "",
  major: "",
  skills: [],
  interests: [],
  minWage: "",
  maxDistance: "",
  maxHours: "",
};

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function shiftHours(shift: Shift) {
  return Math.max(0, timeToMinutes(shift.end) - timeToMinutes(shift.start)) / 60;
}

function shiftsOverlap(a: Shift, b: Shift) {
  if (a.day !== b.day) return false;
  return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(a.end) > timeToMinutes(b.start);
}

function hasClassConflict(job: Job, schedule: ScheduleBlock[]) {
  return job.shifts.some((jobShift) =>
    schedule.some((classBlock) => shiftsOverlap(jobShift, classBlock)),
  );
}

function weeklyHours(job: Job) {
  return job.shifts.reduce((total, shift) => total + shiftHours(shift), 0);
}

function formatShifts(shifts: Shift[]) {
  return shifts.map((shift) => `${shift.day} ${shift.start}-${shift.end}`).join(", ");
}

function scoreJob(job: Job, profile: StudentProfile): MatchResult {
  const minWage = Number(profile.minWage);
  const maxDistance = Number(profile.maxDistance);
  const maxHours = Number(profile.maxHours);
  const matchedSkills = job.skills.filter((skill) => profile.skills.includes(skill));
  const matchedInterests = job.interests.filter((interest) => profile.interests.includes(interest));
  const skillBase = job.skills.length ? matchedSkills.length / job.skills.length : 1;
  const interestBoost = matchedInterests.length ? 0.2 : 0;
  const skillScore = Math.min(35, Math.round((skillBase + interestBoost) * 35));
  const hours = Number(weeklyHours(job).toFixed(1));
  const timeScore = Math.round(Math.max(0, 1 - Math.abs(maxHours - hours) / Math.max(maxHours, 1)) * 25);
  const wageScore = Math.round(Math.min(1, job.wage / Math.max(minWage * 1.6, 1)) * 20);
  const distanceScore = Math.round(Math.max(0, 1 - job.distance / Math.max(maxDistance, 1)) * 20);
  const score = Math.min(100, skillScore + timeScore + wageScore + distanceScore);

  const reasons = [
    "ไม่ชนกับตารางเรียน",
    matchedSkills.length ? `ทักษะตรงกัน: ${matchedSkills.join(", ")}` : "ไม่ต้องใช้ทักษะที่คุณเลือกโดยตรงมากนัก",
    matchedInterests.length ? `ตรงกับความสนใจด้าน ${matchedInterests.join(", ")}` : "ประเภทงานยังอยู่ในเกณฑ์ที่ทำได้",
    `${hours} ชั่วโมง/สัปดาห์${maxHours ? ` จากเพดาน ${maxHours} ชั่วโมง` : ""}`,
    job.distance === 0 ? "ทำงานออนไลน์ ไม่มีระยะทางเดินทาง" : `อยู่ห่าง ${job.distance} กม.`,
  ];

  return {
    job,
    score,
    reasons,
    warnings: [],
    scheduleSafe: true,
    isRelaxed: false,
    skillScore,
    timeScore,
    wageScore,
    distanceScore,
    weeklyHours: hours,
  };
}

function filterAndScoreJobs(jobs: Job[], profile: StudentProfile, schedule: ScheduleBlock[]) {
  return jobs
    .filter((job) => job.status !== "suspicious")
    .map((job) => scoreJobWithWarnings(job, profile, schedule))
    .sort((a, b) => b.score - a.score);
}

function scoreJobWithWarnings(job: Job, profile: StudentProfile, schedule: ScheduleBlock[]) {
  const result = scoreJob(job, profile);
  const minWage = Number(profile.minWage);
  const maxDistance = Number(profile.maxDistance);
  const maxHours = Number(profile.maxHours);
  const hours = weeklyHours(job);
  const warnings = [];
  const scheduleSafe = !hasClassConflict(job, schedule);

  if (!scheduleSafe) warnings.push("เวลางานอาจชนกับตารางเรียน");
  if (minWage > 0 && job.wage < minWage) warnings.push(`ค่าจ้างต่ำกว่าเป้า ${minWage} บาท/ชม.`);
  if (maxDistance > 0 && job.distance > maxDistance) warnings.push(`ระยะทางเกินเป้า ${maxDistance} กม.`);
  if (maxHours > 0 && hours > maxHours) warnings.push(`ชั่วโมงต่อสัปดาห์เกินเป้า ${maxHours} ชม.`);

  const penalty = warnings.length * 8 + (scheduleSafe ? 0 : 12);
  return {
    ...result,
    score: Math.max(1, result.score - penalty),
    warnings,
    scheduleSafe,
    isRelaxed: warnings.length > 0,
    reasons: [
      scheduleSafe ? "ไม่ชนกับตารางเรียน" : "ตำแหน่งงานตรงกับที่ค้นหา แต่ต้องตรวจเวลาซ้ำ",
      ...result.reasons.slice(1),
    ],
  };
}

function getSuggestions(query: string, location: string) {
  const suggestions = [];
  suggestions.push(`ค้นหาตำแหน่ง "${query || "part time student jobs"}" ในพื้นที่ ${location || "Thailand"} ก่อน แล้วค่อยดูเงื่อนไขประกอบ`);
  suggestions.push("ลองใช้ชื่อภาษาไทยและอังกฤษของตำแหน่งเดียวกัน เช่น Barista / พนักงานร้านกาแฟ");
  suggestions.push("ใส่พื้นที่ให้ชัดขึ้น เช่น Bangkok, Chiang Mai หรือชื่อเขตที่ต้องการ");
  return suggestions.slice(0, 3);
}

function agentExplanation(profile: StudentProfile, schedule: ScheduleBlock[], results: MatchResult[], query: string, location: string) {
  if (!results.length) {
    const suggestions = getSuggestions(query, location);
    return suggestions.length
      ? `ระบบยังไม่เจอตำแหน่งงานจากคำค้นนี้โดยตรง ควรลองค้นด้วยชื่อเรียกอื่นของตำแหน่งเดิมก่อน เช่น ${suggestions.join(" และ ")}`
      : "ระบบยังไม่เจอตำแหน่งงานจากคำค้นนี้โดยตรง";
  }

  const freeDays = days.filter((day) => !schedule.some((block) => block.day === day));
  const top = results[0];
  const freeText = freeDays.length
    ? `คุณไม่มีเวลาเรียนที่กรอกไว้ในวัน ${freeDays.slice(0, 3).join(", ")}`
    : "คุณมีตารางเรียนกระจายหลายวัน ระบบจึงเลือกงานที่ไม่ทับช่วงเรียนโดยตรง";
  return `${freeText} งานที่ตรงกับการค้นหาและน่าสนใจที่สุดคือ ${top.job.title} ที่ ${top.job.company} ได้ ${top.score}/100 คะแนน ${top.reasons[1]} ค่าจ้าง ${top.job.wage} บาท/ชม. และระยะทาง ${top.job.distance} กม.`;
}

function TogglePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-teal-500 bg-teal-50 text-teal-800"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

export function JobFinderApp() {
  const [profile, setProfile] = useState<StudentProfile>(initialProfile);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>(defaultSchedule);
  const [jobQuery, setJobQuery] = useState("part time student jobs");
  const [jobLocation, setJobLocation] = useState("Bangkok, Thailand");
  const [jobSource, setJobSource] = useState<JobSource>("idle");
  const [sourceMessage, setSourceMessage] = useState("กรอกตำแหน่งและพื้นที่เพื่อเริ่มค้นหางานจริง");
  const [liveJobCount, setLiveJobCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [searchPlanMessage, setSearchPlanMessage] = useState("");
  const [results, setResults] = useState<MatchResult[]>([]);
  const updateArray = (field: "skills" | "interests", value: string) => {
    setProfile((current) => {
      const exists = current[field].includes(value);
      return {
        ...current,
        [field]: exists ? current[field].filter((item) => item !== value) : [...current[field], value],
      };
    });
  };

  const updateSchedule = (id: number, field: keyof Shift, value: string) => {
    setSchedule((blocks) => blocks.map((block) => (block.id === id ? { ...block, [field]: value } : block)));
  };

  const explainResults = (nextResults: MatchResult[]) => {
    setIsExplaining(true);

    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        schedule,
        suggestions: getSuggestions(jobQuery, jobLocation),
          results: nextResults.map((result) => ({
            title: result.job.title,
            company: result.job.company,
            score: result.score,
            wage: result.job.wage,
            distance: result.job.distance,
            weeklyHours: result.weeklyHours,
            scheduleSafe: result.scheduleSafe,
            isRelaxed: result.isRelaxed,
            reasons: result.reasons,
            warnings: result.warnings,
          })),
      }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data: { explanation?: string }) => {
        setAiExplanation(data.explanation?.trim() ?? "");
      })
      .catch(() => {
        setAiExplanation("");
      })
      .finally(() => {
        setIsExplaining(false);
      });
  };

  const runSearch = async () => {
    if (isSearching || isExplaining) return;
    setHasSearched(true);
    setIsSearching(true);
    setIsExplaining(false);
    setAiExplanation("");
    setLiveJobCount(0);
    setSearchPlanMessage("");
    setSourceMessage("กำลังเตรียมคำค้นด้วย AI และค้นหาตำแหน่งงาน อาจลองคำค้นไทย/อังกฤษเพิ่มเติมเมื่อไม่พบงาน...");

    try {
      const response = await fetch(
        `/api/jobs?query=${encodeURIComponent(jobQuery)}&location=${encodeURIComponent(jobLocation)}`,
      );
      const data = (await response.json()) as { jobs?: Job[]; error?: string; searchPlan?: { message: string; searchedQueries: string[] } };
      if (!response.ok) {
        throw new Error(data.error || "Job API unavailable");
      }
      const liveJobs = Array.isArray(data.jobs) ? data.jobs : [];
      if (data.searchPlan) setSearchPlanMessage(`${data.searchPlan.message} • คำที่ค้น: ${data.searchPlan.searchedQueries.join(" → ")}`);
      setLiveJobCount(liveJobs.length);

      if (!liveJobs.length) {
        setResults([]);
        setJobSource("empty-live");
        setSourceMessage("เรียก OpenWebNinja สำเร็จ แต่ API ไม่ส่งรายการงานที่แปลงเป็น card ได้ในครั้งนี้");
        setIsSearching(false);
        explainResults([]);
        return;
      }

      const displayResults = filterAndScoreJobs(liveJobs, profile, schedule);
      setResults(displayResults);
      setJobSource("live");
      setSourceMessage(
        `ใช้ Live API จาก OpenWebNinja ในพื้นที่ ${jobLocation}: เจอตำแหน่งงาน ${liveJobs.length} รายการ แล้วจัดอันดับตามความเหมาะสม ${displayResults.length} รายการ`,
      );
      setIsSearching(false);
      explainResults(displayResults);
    } catch (error) {
      setResults([]);
      setJobSource("error");
      setSourceMessage(
        `เรียก API ไม่สำเร็จ (${error instanceof Error ? error.message : "unknown error"}) กรุณาตรวจสอบ API Key หรือการเชื่อมต่อ แล้วลองใหม่`,
      );
      setIsSearching(false);
      setIsExplaining(false);
    }
  };

  const fallbackExplanation = agentExplanation(profile, schedule, results, jobQuery, jobLocation);
  const explanation = aiExplanation || fallbackExplanation;
  const suggestions = getSuggestions(jobQuery, jobLocation);

  return (
    <main className="h-dvh overflow-hidden bg-[#f7fbfa] text-slate-900">
      <div className="flex h-full w-full flex-col gap-4 px-4 py-4 sm:px-6 lg:gap-6 lg:px-8 lg:py-5">
        <header className="z-10 flex shrink-0 flex-col gap-3 rounded-2xl border border-teal-100 bg-white px-5 py-3 shadow-sm md:flex-row md:items-center md:justify-between lg:py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Student work planner</p>
            <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950 sm:text-4xl">Part-time Job Finder</h1>
            <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-slate-600 md:block">
              หาและจัดอันดับงานพาร์ทไทม์ที่ไม่ชนตารางเรียน พร้อมกรองงานเสี่ยง scam ออกก่อนแนะนำ
            </p>
          </div>
          <div className="hidden shrink-0 grid-cols-2 gap-2 text-center sm:grid">
            <StatCard value={liveJobCount} label="Live jobs" color="teal" />
            <StatCard value={results.length} label="Matches" color="sky" />
          </div>
        </header>

        <section className="app-scrollbar grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside aria-label="ข้อมูลและเงื่อนไขค้นหางาน" className="app-scrollbar min-w-0 space-y-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-black text-slate-950">ข้อมูลนักศึกษา</h2>
                <p className="text-sm text-slate-500">ตั้งเงื่อนไขพื้นฐานสำหรับการจับคู่งาน</p>
              </div>
              <div className="grid gap-4">
                <TextInput label="ชื่อ" value={profile.name} onChange={(value) => setProfile({ ...profile, name: value })} />
                <TextInput label="คณะ/สาขา" value={profile.major} onChange={(value) => setProfile({ ...profile, major: value })} />

                <OptionGroup title="ทักษะ" options={skillOptions} selected={profile.skills} onToggle={(skill) => updateArray("skills", skill)} />
                <OptionGroup title="ความสนใจ" options={interestOptions} selected={profile.interests} onToggle={(interest) => updateArray("interests", interest)} />
                <TextInput label="คำค้นหางานจาก API" value={jobQuery} onChange={setJobQuery} />
                <TextInput label="พื้นที่ค้นหา" value={jobLocation} onChange={setJobLocation} />

                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberInput label="บาท/ชม. ขั้นต่ำ" value={profile.minWage} min={0} onChange={(value) => setProfile({ ...profile, minWage: value })} />
                  <NumberInput label="ระยะทางสูงสุด" value={profile.maxDistance} min={0} step={0.5} onChange={(value) => setProfile({ ...profile, maxDistance: value })} />
                  <NumberInput label="ชม./สัปดาห์" value={profile.maxHours} min={1} onChange={(value) => setProfile({ ...profile, maxHours: value })} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">ตารางเรียน</h2>
                  <p className="text-sm text-slate-500">ระบบใช้ logic overlap เพื่อตรวจเวลาชนกัน</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSchedule((blocks) => [...blocks, { id: Date.now(), day: "Thursday", start: "09:00", end: "12:00" }])}
                  className="rounded-full bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  + เพิ่ม
                </button>
              </div>

              <div className="grid gap-3">
                {schedule.map((block) => (
                  <div key={block.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <select value={block.day} onChange={(event) => updateSchedule(block.id, "day", event.target.value)} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-sm outline-none focus:border-teal-500" aria-label="Class day">
                      {days.map((day) => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <input type="time" value={block.start} onChange={(event) => updateSchedule(block.id, "start", event.target.value)} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-sm outline-none focus:border-teal-500" aria-label="Class start time" />
                    <input type="time" value={block.end} onChange={(event) => updateSchedule(block.id, "end", event.target.value)} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-sm outline-none focus:border-teal-500" aria-label="Class end time" />
                    <button type="button" onClick={() => setSchedule((blocks) => blocks.filter((item) => item.id !== block.id))} className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700" aria-label="Remove class block">×</button>
                  </div>
                ))}
              </div>

              <button type="button" onClick={runSearch} disabled={isSearching || isExplaining} className="mt-5 w-full rounded-xl bg-teal-600 px-4 py-3 text-base font-black text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:cursor-wait disabled:opacity-60">
                {isSearching ? "กำลังค้นหางาน..." : isExplaining ? "กำลังสรุปผล..." : "ค้นหางานด้วย AI"}
              </button>
            </section>
          </aside>

          {/* Keyboard users need to focus this independently scrolling region. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div role="region" aria-label="ผลการค้นหางาน" tabIndex={0} className="app-scrollbar min-w-0 space-y-6 rounded-2xl focus-visible:outline-2 focus-visible:outline-teal-600 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-950">ผู้ช่วย AI ค้นหางาน</h2>
                  <p className="text-sm text-slate-500">ช่วยเลือกคำค้นตำแหน่งงานและสรุปผลที่พบ</p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">deterministic schedule check</span>
              </div>
              <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
                  jobSource === "live"
                  ? "bg-emerald-50 text-emerald-800"
                  : jobSource === "empty-live"
                    ? "bg-sky-50 text-sky-800"
                  : jobSource === "error"
                    ? "bg-rose-50 text-rose-800"
                    : "bg-slate-50 text-slate-600"
              }`}>
                {sourceMessage}
              </div>
              {searchPlanMessage && <p className="mt-3 break-words text-sm leading-6 text-teal-800" role="status">{searchPlanMessage}</p>}
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {!hasSearched
                  ? "กรอกข้อมูลแล้วกดค้นหา ระบบจะตัดงาน suspicious ตรวจเวลาชนเรียนด้วย logic และจัดอันดับงานที่เหมาะที่สุดให้"
                  : isExplaining
                    ? "ระบบคำนวณผลลัพธ์เสร็จแล้ว กำลังให้ Gemini ช่วยเรียบเรียงคำอธิบาย..."
                    : explanation}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-950">งานที่แนะนำ</h2>
                  <p className="text-sm text-slate-500">เรียงจากคะแนนความเหมาะสมสูงสุด</p>
                </div>
                {hasSearched && !isSearching ? (
                  <div className="text-sm font-bold text-slate-600">
                    {results.some((result) => result.isRelaxed) ? `${results.length} งานพร้อมข้อควรเช็ก` : `${results.length} งานที่เหมาะมาก`}
                  </div>
                ) : null}
              </div>

              {!hasSearched ? (
                <EmptyState />
              ) : isSearching ? (
                <LoadingState />
              ) : jobSource === "error" ? (
                <ErrorState message={sourceMessage} />
              ) : results.length === 0 ? (
                <NoResults suggestions={suggestions} message={sourceMessage} />
              ) : (
                <div className="grid gap-4">
                  {results.map((result) => <JobCard key={result.job.id} result={result} />)}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: "teal" | "amber" | "sky" }) {
  const classes = {
    teal: "bg-teal-50 text-teal-800",
    amber: "bg-amber-50 text-amber-800",
    sky: "bg-sky-50 text-sky-800",
  };
  return (
    <div className={`rounded-xl px-3 py-3 ${classes[color]}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-semibold">{label}</div>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
    </label>
  );
}

function NumberInput({ label, value, min, step, onChange }: { label: string; value: number | ""; min: number; step?: number; onChange: (value: number | "") => void }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input type="number" min={min} step={step} value={value} placeholder="กรอกค่า" onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} className="min-w-0 w-full max-w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
    </label>
  );
}

function OptionGroup({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => <TogglePill key={option} label={option} active={selected.includes(option)} onClick={() => onToggle(option)} />)}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-teal-100 text-2xl">↗</div>
        <h3 className="text-lg font-black text-slate-950">พร้อมค้นหางานแรกของคุณ</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          ระบบจะค้นหาตำแหน่งงานก่อน แล้วค่อยจัดอันดับพร้อมเตือนเรื่องตารางเรียน ค่าจ้าง ระยะทาง และชั่วโมงทำงาน
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-80 place-items-center rounded-2xl bg-slate-50 px-6 text-center">
      <div>
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />
        <p className="mt-4 text-sm font-bold text-slate-600">กำลังตรวจตารางเรียนและให้คะแนนงาน...</p>
      </div>
    </div>
  );
}

function NoResults({ suggestions, message }: { suggestions: string[]; message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="text-lg font-black text-amber-950">ยังไม่พบตำแหน่งงานจากคำค้นนี้</h3>
      <p className="mt-2 text-sm leading-6 text-amber-900">
        {message}
      </p>
      <div className="mt-4 grid gap-2">
        {(suggestions.length ? suggestions : ["ลองใช้ชื่อเรียกอื่นของตำแหน่งงานเดิม หรือระบุพื้นที่ให้ชัดขึ้น"]).map((suggestion) => (
          <div key={suggestion} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-amber-900">{suggestion}</div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
      <h3 className="text-lg font-black text-rose-950">เกิดข้อผิดพลาดในการค้นหา</h3>
      <p className="mt-2 text-sm leading-6 text-rose-900">{message}</p>
    </div>
  );
}

function JobCard({ result }: { result: MatchResult }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${
              result.scheduleSafe ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-800"
            }`}>
              {result.scheduleSafe ? "ไม่ชนตารางเรียน" : "ต้องเช็กเวลา"}
            </span>
            {result.isRelaxed ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">งานใกล้เคียง</span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{result.job.category}</span>
          </div>
          <h3 className="mt-3 text-xl font-black text-slate-950">{result.job.title}</h3>
          <p className="text-sm font-semibold text-slate-500">{result.job.company}</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-slate-950 px-4 py-3 text-center text-white">
          <div className="text-3xl font-black">{result.score}</div>
          <div className="text-xs font-bold text-slate-300">match score</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoBlock label="เวลา" value={formatShifts(result.job.shifts)} />
        <InfoBlock label="ค่าจ้าง" value={`${result.job.wage} บาท/ชม.`} strong />
        <InfoBlock label="พื้นที่/ระยะทาง" value={`${result.job.location ? `${result.job.location} · ` : ""}${result.job.distance === 0 ? "Online" : `${result.job.distance} กม.`}`} strong />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="text-sm font-black text-slate-800">เหตุผลที่เหมาะ</div>
          <ul className="mt-2 grid gap-1 text-sm leading-6 text-slate-600">
            {[...result.reasons.slice(0, 4), ...result.warnings].map((reason) => <li key={reason}>• {reason}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">Skills {result.skillScore}/35</span>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Time {result.timeScore}/25</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Wage {result.wageScore}/20</span>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">Distance {result.distanceScore}/20</span>
          </div>
        </div>
        <a href={result.job.applyUrl} target="_blank" rel="noreferrer" className="inline-flex justify-center rounded-xl bg-teal-600 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
          สมัครงาน
        </a>
      </div>
    </article>
  );
}

function InfoBlock({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
      <div className={`mt-1 text-sm leading-5 text-slate-800 ${strong ? "font-black" : "font-semibold"}`}>{value}</div>
    </div>
  );
}
