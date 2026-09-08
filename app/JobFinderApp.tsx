"use client";

import { useMemo, useState } from "react";

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
  source?: "mock" | "openwebninja";
};

type StudentProfile = {
  name: string;
  major: string;
  skills: string[];
  interests: string[];
  minWage: number;
  maxDistance: number;
  maxHours: number;
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

type JobSource = "mock" | "live" | "empty-live" | "fallback";

const days: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const skillOptions = ["English", "Excel", "Sales", "Teaching", "Design", "Coding"];
const interestOptions = ["Cafe", "Tutoring", "Retail", "Online", "Event"];

const mockJobs: Job[] = [
  { id: 1, title: "Barista Part-time", company: "Bright Bean Cafe", category: "Cafe", shifts: [{ day: "Monday", start: "17:00", end: "21:00" }, { day: "Wednesday", start: "17:00", end: "21:00" }, { day: "Friday", start: "16:00", end: "20:00" }], wage: 75, distance: 1.2, skills: ["English", "Sales"], interests: ["Cafe"], applyUrl: "https://example.com/apply/bright-bean", status: "verified" },
  { id: 2, title: "Math Tutor Assistant", company: "Smart Path Tutor", category: "Tutoring", shifts: [{ day: "Tuesday", start: "17:30", end: "20:30" }, { day: "Thursday", start: "17:30", end: "20:30" }], wage: 140, distance: 2.4, skills: ["Teaching", "English"], interests: ["Tutoring"], applyUrl: "https://example.com/apply/smart-path", status: "verified" },
  { id: 3, title: "Retail Sales Crew", company: "Campus Mall Store", category: "Retail", shifts: [{ day: "Saturday", start: "10:00", end: "16:00" }, { day: "Sunday", start: "10:00", end: "16:00" }], wage: 80, distance: 3.6, skills: ["Sales"], interests: ["Retail"], applyUrl: "https://example.com/apply/campus-mall", status: "verified" },
  { id: 4, title: "Online Data Entry", company: "Northstar Admin", category: "Online", shifts: [{ day: "Monday", start: "20:00", end: "23:00" }, { day: "Wednesday", start: "20:00", end: "23:00" }, { day: "Thursday", start: "20:00", end: "23:00" }], wage: 95, distance: 0, skills: ["Excel"], interests: ["Online"], applyUrl: "https://example.com/apply/northstar-admin", status: "verified" },
  { id: 5, title: "Event Registration Staff", company: "Metro Expo Team", category: "Event", shifts: [{ day: "Friday", start: "18:00", end: "22:00" }, { day: "Saturday", start: "09:00", end: "17:00" }], wage: 100, distance: 5.5, skills: ["English", "Sales"], interests: ["Event"], applyUrl: "https://example.com/apply/metro-expo", status: "verified" },
  { id: 6, title: "Graphic Design Intern", company: "Studio Little Dot", category: "Online", shifts: [{ day: "Tuesday", start: "19:00", end: "22:00" }, { day: "Thursday", start: "19:00", end: "22:00" }], wage: 120, distance: 0, skills: ["Design"], interests: ["Online"], applyUrl: "https://example.com/apply/little-dot", status: "verified" },
  { id: 7, title: "Junior Web Content Helper", company: "EduSpark Labs", category: "Online", shifts: [{ day: "Monday", start: "18:00", end: "21:00" }, { day: "Thursday", start: "18:00", end: "21:00" }], wage: 135, distance: 0, skills: ["Coding", "English"], interests: ["Online"], applyUrl: "https://example.com/apply/eduspark", status: "verified" },
  { id: 8, title: "Bookstore Cashier", company: "UniBooks", category: "Retail", shifts: [{ day: "Monday", start: "13:00", end: "17:00" }, { day: "Wednesday", start: "13:00", end: "17:00" }], wage: 70, distance: 0.8, skills: ["Sales", "Excel"], interests: ["Retail"], applyUrl: "https://example.com/apply/unibooks", status: "verified" },
  { id: 9, title: "English Conversation Coach", company: "SpeakUp Center", category: "Tutoring", shifts: [{ day: "Wednesday", start: "18:00", end: "20:00" }, { day: "Saturday", start: "13:00", end: "17:00" }], wage: 160, distance: 4.2, skills: ["English", "Teaching"], interests: ["Tutoring"], applyUrl: "https://example.com/apply/speakup", status: "verified" },
  { id: 10, title: "Campus Cafe Cashier", company: "Fresh Cup Kiosk", category: "Cafe", shifts: [{ day: "Tuesday", start: "16:00", end: "20:00" }, { day: "Thursday", start: "16:00", end: "20:00" }], wage: 72, distance: 0.4, skills: ["Sales"], interests: ["Cafe", "Retail"], applyUrl: "https://example.com/apply/fresh-cup", status: "verified" },
  { id: 11, title: "Survey Booth Staff", company: "Insight Fieldwork", category: "Event", shifts: [{ day: "Sunday", start: "11:00", end: "18:00" }], wage: 110, distance: 6.8, skills: ["English", "Sales"], interests: ["Event"], applyUrl: "https://example.com/apply/insight-fieldwork", status: "verified" },
  { id: 12, title: "Spreadsheet Support Assistant", company: "FinLite Office", category: "Online", shifts: [{ day: "Tuesday", start: "18:00", end: "21:00" }, { day: "Friday", start: "18:00", end: "21:00" }], wage: 125, distance: 1.7, skills: ["Excel"], interests: ["Online"], applyUrl: "https://example.com/apply/finlite", status: "verified" },
  { id: 13, title: "Premium Promo Recruit", company: "Fast Cash Network", category: "Event", shifts: [{ day: "Monday", start: "19:00", end: "22:00" }, { day: "Tuesday", start: "19:00", end: "22:00" }], wage: 320, distance: 1.5, skills: ["Sales"], interests: ["Event"], applyUrl: "https://example.com/apply/fast-cash", status: "suspicious" },
  { id: 14, title: "Weekend Bakery Helper", company: "Sunny Oven", category: "Cafe", shifts: [{ day: "Saturday", start: "07:00", end: "12:00" }, { day: "Sunday", start: "07:00", end: "12:00" }], wage: 78, distance: 2.1, skills: ["Sales"], interests: ["Cafe"], applyUrl: "https://example.com/apply/sunny-oven", status: "verified" },
  { id: 15, title: "Code Lab Teaching Aide", company: "KidCode Academy", category: "Tutoring", shifts: [{ day: "Saturday", start: "09:00", end: "15:00" }], wage: 180, distance: 5.0, skills: ["Coding", "Teaching"], interests: ["Tutoring"], applyUrl: "https://example.com/apply/kidcode", status: "verified" },
  { id: 16, title: "Social Media Design Crew", company: "Campus Live Club", category: "Event", shifts: [{ day: "Friday", start: "17:00", end: "21:00" }, { day: "Sunday", start: "14:00", end: "17:00" }], wage: 115, distance: 1.1, skills: ["Design", "English"], interests: ["Event", "Online"], applyUrl: "https://example.com/apply/campus-live", status: "verified" },
  { id: 17, title: "Restaurant Service Staff", company: "Bowl & Spoon", category: "Retail", shifts: [{ day: "Monday", start: "18:00", end: "22:00" }, { day: "Wednesday", start: "18:00", end: "22:00" }, { day: "Saturday", start: "18:00", end: "22:00" }], wage: 85, distance: 3.2, skills: ["Sales", "English"], interests: ["Retail", "Cafe"], applyUrl: "https://example.com/apply/bowl-spoon", status: "verified" },
  { id: 18, title: "Night Chat Support", company: "HelpDesk Mini", category: "Online", shifts: [{ day: "Tuesday", start: "21:00", end: "23:59" }, { day: "Thursday", start: "21:00", end: "23:59" }, { day: "Sunday", start: "21:00", end: "23:59" }], wage: 130, distance: 0, skills: ["English", "Excel"], interests: ["Online"], applyUrl: "https://example.com/apply/helpdesk-mini", status: "verified" },
];

const defaultSchedule: ScheduleBlock[] = [
  { id: 1, day: "Monday", start: "09:00", end: "12:00" },
  { id: 2, day: "Tuesday", start: "13:00", end: "16:00" },
  { id: 3, day: "Wednesday", start: "10:00", end: "12:00" },
];

const initialProfile: StudentProfile = {
  name: "Nicha",
  major: "Business English",
  skills: ["English", "Sales"],
  interests: ["Cafe", "Online"],
  minWage: 75,
  maxDistance: 5,
  maxHours: 15,
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
  const matchedSkills = job.skills.filter((skill) => profile.skills.includes(skill));
  const matchedInterests = job.interests.filter((interest) => profile.interests.includes(interest));
  const skillBase = job.skills.length ? matchedSkills.length / job.skills.length : 1;
  const interestBoost = matchedInterests.length ? 0.2 : 0;
  const skillScore = Math.min(35, Math.round((skillBase + interestBoost) * 35));
  const hours = Number(weeklyHours(job).toFixed(1));
  const timeScore = Math.round(Math.max(0, 1 - Math.abs(profile.maxHours - hours) / Math.max(profile.maxHours, 1)) * 25);
  const wageScore = Math.round(Math.min(1, job.wage / Math.max(profile.minWage * 1.6, 1)) * 20);
  const distanceScore = Math.round(Math.max(0, 1 - job.distance / Math.max(profile.maxDistance, 1)) * 20);
  const score = Math.min(100, skillScore + timeScore + wageScore + distanceScore);

  const reasons = [
    "ไม่ชนกับตารางเรียน",
    matchedSkills.length ? `ทักษะตรงกัน: ${matchedSkills.join(", ")}` : "ไม่ต้องใช้ทักษะที่คุณเลือกโดยตรงมากนัก",
    matchedInterests.length ? `ตรงกับความสนใจด้าน ${matchedInterests.join(", ")}` : "ประเภทงานยังอยู่ในเกณฑ์ที่ทำได้",
    `${hours} ชั่วโมง/สัปดาห์ จากเพดาน ${profile.maxHours} ชั่วโมง`,
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

function filterAndScore(profile: StudentProfile, schedule: ScheduleBlock[]) {
  return filterAndScoreJobs(mockJobs, profile, schedule);
}

function filterAndScoreJobs(jobs: Job[], profile: StudentProfile, schedule: ScheduleBlock[]) {
  return jobs
    .filter((job) => job.status !== "suspicious")
    .filter((job) => !hasClassConflict(job, schedule))
    .filter((job) => job.wage >= profile.minWage)
    .filter((job) => job.distance <= profile.maxDistance)
    .filter((job) => weeklyHours(job) <= profile.maxHours)
    .map((job) => scoreJob(job, profile))
    .sort((a, b) => b.score - a.score);
}

function scoreApproximateJobs(jobs: Job[], profile: StudentProfile, schedule: ScheduleBlock[]) {
  return jobs
    .filter((job) => job.status !== "suspicious")
    .map((job) => {
      const result = scoreJob(job, profile);
      const hours = weeklyHours(job);
      const warnings = [];
      const scheduleSafe = !hasClassConflict(job, schedule);

      if (!scheduleSafe) warnings.push("เวลางานอาจชนกับตารางเรียน");
      if (job.wage < profile.minWage) warnings.push(`ค่าจ้างต่ำกว่าเป้า ${profile.minWage} บาท/ชม.`);
      if (job.distance > profile.maxDistance) warnings.push(`ระยะทางเกินเป้า ${profile.maxDistance} กม.`);
      if (hours > profile.maxHours) warnings.push(`ชั่วโมงต่อสัปดาห์เกินเป้า ${profile.maxHours} ชม.`);

      const penalty = warnings.length * 8 + (scheduleSafe ? 0 : 12);
      return {
        ...result,
        score: Math.max(1, result.score - penalty),
        warnings,
        scheduleSafe,
        isRelaxed: warnings.length > 0,
        reasons: [
          scheduleSafe ? "ไม่ชนกับตารางเรียน" : "เป็นงานใกล้เคียง แต่ต้องตรวจเวลาซ้ำ",
          ...result.reasons.slice(1),
        ],
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function getSuggestions(profile: StudentProfile, schedule: ScheduleBlock[]) {
  const verified = mockJobs.filter((job) => job.status !== "suspicious");
  const suggestions = [];
  if (verified.some((job) => hasClassConflict(job, schedule))) {
    suggestions.push("เพิ่มช่วงเวลาว่างตอนเย็นหรือเสาร์-อาทิตย์ หากตารางเรียนยืดหยุ่นได้");
  }
  if (verified.filter((job) => job.wage >= profile.minWage).length < 6) {
    suggestions.push("ลดค่าจ้างขั้นต่ำเล็กน้อยเพื่อเปิดตัวเลือกงานมากขึ้น");
  }
  if (verified.filter((job) => job.distance <= profile.maxDistance).length < 6) {
    suggestions.push("เพิ่มระยะทางสูงสุด หรือเลือกงาน Online เพิ่ม");
  }
  if (verified.filter((job) => weeklyHours(job) <= profile.maxHours).length < 6) {
    suggestions.push("เพิ่มจำนวนชั่วโมงสูงสุดต่อสัปดาห์อีก 2-4 ชั่วโมง");
  }
  if (profile.skills.length === 0 || profile.interests.length === 0) {
    suggestions.push("เลือกทักษะและความสนใจเพิ่ม เพื่อให้ระบบจับคู่งานได้แม่นขึ้น");
  }
  return suggestions.slice(0, 3);
}

function agentExplanation(profile: StudentProfile, schedule: ScheduleBlock[], results: MatchResult[]) {
  if (!results.length) {
    const suggestions = getSuggestions(profile, schedule);
    return suggestions.length
      ? `ระบบตัดงานที่น่าสงสัยออกก่อน แล้วตรวจเวลาเรียนแบบช่วงเวลาชนกัน ผลลัพธ์ยังไม่มีงานที่ผ่านทุกเงื่อนไข คำแนะนำหลักคือ ${suggestions.join(" และ ")}`
      : "ระบบยังไม่พบงานที่ผ่านทุกเงื่อนไขหลังตัดงานเสี่ยงและตรวจตารางเรียน";
  }

  const freeDays = days.filter((day) => !schedule.some((block) => block.day === day));
  const top = results[0];
  const freeText = freeDays.length
    ? `คุณไม่มีเวลาเรียนที่กรอกไว้ในวัน ${freeDays.slice(0, 3).join(", ")}`
    : "คุณมีตารางเรียนกระจายหลายวัน ระบบจึงเลือกงานที่ไม่ทับช่วงเรียนโดยตรง";
  return `${freeText} งานที่แนะนำมากที่สุดคือ ${top.job.title} ที่ ${top.job.company} เพราะไม่ชนเรียน ได้ ${top.score}/100 คะแนน ${top.reasons[1]} ค่าจ้าง ${top.job.wage} บาท/ชม. และระยะทาง ${top.job.distance} กม.`;
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
  const [jobSource, setJobSource] = useState<JobSource>("mock");
  const [sourceMessage, setSourceMessage] = useState("ยังไม่ได้ค้นหา ระบบพร้อมใช้ mock data สำหรับ MVP");
  const [liveJobCount, setLiveJobCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [results, setResults] = useState<MatchResult[]>([]);
  const suspiciousCount = useMemo(() => mockJobs.filter((job) => job.status === "suspicious").length, []);

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
        suggestions: getSuggestions(profile, schedule),
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
    setHasSearched(true);
    setIsSearching(true);
    setIsExplaining(false);
    setAiExplanation("");
    setLiveJobCount(0);
    setSourceMessage("กำลังเรียก OpenWebNinja Job Search API...");

    try {
      const response = await fetch(
        `/api/jobs?query=${encodeURIComponent(jobQuery)}&location=${encodeURIComponent(jobLocation)}`,
      );
      const data = (await response.json()) as { jobs?: Job[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Job API unavailable");
      }
      const liveJobs = Array.isArray(data.jobs) ? data.jobs : [];
      setLiveJobCount(liveJobs.length);

      if (!liveJobs.length) {
        setResults([]);
        setJobSource("empty-live");
        setSourceMessage("เรียก OpenWebNinja สำเร็จ แต่ API ไม่ส่งรายการงานที่แปลงเป็น card ได้ในครั้งนี้");
        setIsSearching(false);
        explainResults([]);
        return;
      }

      const nextResults = filterAndScoreJobs(liveJobs, profile, schedule);
      const displayResults = nextResults.length
        ? nextResults
        : scoreApproximateJobs(liveJobs, profile, schedule);
      setResults(displayResults);
      setJobSource("live");
      setSourceMessage(
        nextResults.length
          ? `ใช้ Live API จาก OpenWebNinja ในพื้นที่ ${jobLocation}: ได้งานมา ${liveJobs.length} รายการ แล้วผ่านเงื่อนไข ${nextResults.length} รายการ`
          : `ใช้ Live API จาก OpenWebNinja ในพื้นที่ ${jobLocation}: ได้งานมา ${liveJobs.length} รายการ แต่ไม่มีงานที่ผ่านทุกเงื่อนไข จึงแสดงงานใกล้เคียง ${displayResults.length} รายการ`,
      );
      setIsSearching(false);
      explainResults(displayResults);
    } catch (error) {
      const nextResults = filterAndScore(profile, schedule);
      setResults(nextResults);
      setJobSource("fallback");
      setSourceMessage(
        `เรียก OpenWebNinja ไม่สำเร็จ (${error instanceof Error ? error.message : "unknown error"}) จึงใช้ mock data fallback เพื่อให้ MVP ยังทดสอบได้`,
      );
      setIsSearching(false);
      explainResults(nextResults);
    }
  };

  const fallbackExplanation = agentExplanation(profile, schedule, results);
  const explanation = aiExplanation || fallbackExplanation;
  const suggestions = getSuggestions(profile, schedule);

  return (
    <main className="min-h-screen bg-[#f7fbfa] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-teal-100 bg-white px-5 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Student work planner</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">Part-time Job Finder</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              หาและจัดอันดับงานพาร์ทไทม์ที่ไม่ชนตารางเรียน พร้อมกรองงานเสี่ยง scam ออกก่อนแนะนำ
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatCard value={mockJobs.length} label="Mock jobs" color="teal" />
            <StatCard value={liveJobCount || suspiciousCount} label={liveJobCount ? "Live jobs" : "Blocked"} color="amber" />
            <StatCard value={results.length} label="Matches" color="sky" />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-6">
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

              <button type="button" onClick={runSearch} className="mt-5 w-full rounded-xl bg-teal-600 px-4 py-3 text-base font-black text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200">
                ค้นหางานที่เหมาะกับฉัน
              </button>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-950">AI Agent Explanation</h2>
                  <p className="text-sm text-slate-500">ข้อความนี้สรุปจากผลลัพธ์ของ rules และ scoring ใน code</p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">deterministic schedule check</span>
              </div>
              <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
                jobSource === "live"
                  ? "bg-emerald-50 text-emerald-800"
                  : jobSource === "empty-live"
                    ? "bg-sky-50 text-sky-800"
                  : jobSource === "fallback"
                    ? "bg-amber-50 text-amber-900"
                    : "bg-slate-50 text-slate-600"
              }`}>
                {sourceMessage}
              </div>
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
                    {results.some((result) => result.isRelaxed) ? `${results.length} งานใกล้เคียง` : `${results.length} งานผ่านทุกเงื่อนไข`}
                  </div>
                ) : null}
              </div>

              {!hasSearched ? (
                <EmptyState />
              ) : isSearching ? (
                <LoadingState />
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

function NumberInput({ label, value, min, step, onChange }: { label: string; value: number; min: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
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
          ระบบมี mock data 18 งาน พร้อมตัวกรองตารางเรียน ค่าจ้าง ระยะทาง ชั่วโมง และสถานะความน่าเชื่อถือ
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
      <h3 className="text-lg font-black text-amber-950">ยังไม่พบงานที่ตรงทั้งหมด</h3>
      <p className="mt-2 text-sm leading-6 text-amber-900">
        {message}
      </p>
      <div className="mt-4 grid gap-2">
        {(suggestions.length ? suggestions : ["ลองลดเงื่อนไขค่าจ้าง ระยะทาง หรือชั่วโมงต่อสัปดาห์"]).map((suggestion) => (
          <div key={suggestion} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-amber-900">{suggestion}</div>
        ))}
      </div>
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
