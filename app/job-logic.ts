
export type Day =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type Status = "verified" | "suspicious";
export type Shift = { day: Day; start: string; end: string };
export type ScheduleBlock = Shift & { id: number };

export type Job = {
  id: number;
  title: string;
  company: string;
  category: string;
  /** Working times stated in the job post. Empty = the post does not say. */
  shifts: Shift[];
  /** Baht per hour, null = not stated. */
  wage: number | null;
  /** Kilometres from the student, 0 = online, null = unknown. */
  distance: number | null;
  skills: string[];
  interests: string[];
  applyUrl: string;
  status: Status;
  location?: string;
  country?: string;
  source?: "openwebninja" | "serpapi" | "demo";
};

export type ScheduleStatus = "safe" | "conflict" | "unknown";
/** match = meets every requirement, relaxed = meets the loosened requirements, check = info missing, other = misses requirements */
export type Tier = "match" | "relaxed" | "check" | "other";
export type Thresholds = { minWage: number; maxDistance: number; maxHours: number };
export type DataSource = "live" | "demo";

export type StudentProfile = {
  name: string;
  major: string;
  skills: string[];
  interests: string[];
  minWage: number | "";
  maxDistance: number | "";
  maxHours: number | "";
};

export type MatchResult = {
  job: Job;
  score: number;
  reasons: string[];
  warnings: string[];
  scheduleStatus: ScheduleStatus;
  scheduleSafe: boolean;
  tier: Tier;
  isRelaxed: boolean;
  skillScore: number;
  timeScore: number;
  wageScore: number;
  distanceScore: number;
  weeklyHours: number;
};

export type JobSource = "idle" | "live" | "empty-live" | "error";

export type SearchOutcome = {
  results: MatchResult[];
  excludedConflicts: number;
  excludedSuspicious: number;
  relaxNote: string;
};

export const thaiDayNames: Record<Day, string> = {
  Monday: "จันทร์",
  Tuesday: "อังคาร",
  Wednesday: "พุธ",
  Thursday: "พฤหัสบดี",
  Friday: "ศุกร์",
  Saturday: "เสาร์",
  Sunday: "อาทิตย์",
};

export const days: Day[] =["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const skillOptions = ["English", "Excel", "Sales", "Teaching", "Design", "Coding"];
export const interestOptions = ["Cafe", "Tutoring", "Retail", "Online", "Event"];

/**
 * Sample jobs for class demos (no API key needed). All employers are fictional.
 * Some are deliberately tricky: clashes with the default class schedule, posts without hours or pay, and one scam post.
 */
export const mockJobs: Job[] = [
  { id: 1, title: "บาริสต้าพาร์ทไทม์ (Barista)", company: "ร้านกาแฟใบชา", category: "Cafe", shifts: [{ day: "Saturday", start: "08:00", end: "14:00" }, { day: "Sunday", start: "08:00", end: "14:00" }], wage: 60, distance: 1.2, skills: ["Sales"], interests: ["Cafe"], applyUrl: "#", status: "verified", location: "ลาดกระบัง, กรุงเทพฯ", source: "demo" },
  { id: 2, title: "ติวเตอร์ภาษาอังกฤษ ม.ต้น (English Tutor)", company: "สถาบันกวดวิชาก้าวหน้า", category: "Tutoring", shifts: [{ day: "Thursday", start: "17:00", end: "19:00" }, { day: "Saturday", start: "09:00", end: "12:00" }], wage: 150, distance: 3.5, skills: ["English", "Teaching"], interests: ["Tutoring"], applyUrl: "#", status: "verified", location: "หัวหมาก, กรุงเทพฯ", source: "demo" },
  { id: 3, title: "แอดมินเพจออนไลน์ (Online Admin)", company: "ร้านเสื้อผ้ามือสองดีดี", category: "Online", shifts: [{ day: "Monday", start: "19:00", end: "22:00" }, { day: "Wednesday", start: "19:00", end: "22:00" }, { day: "Friday", start: "19:00", end: "22:00" }], wage: 70, distance: 0, skills: ["Sales", "English"], interests: ["Online", "Retail"], applyUrl: "#", status: "verified", location: "ทำงานที่บ้าน", source: "demo" },
  { id: 4, title: "พนักงานขายหน้าร้าน (Retail Staff)", company: "ร้านเครื่องเขียนสมใจ", category: "Retail", shifts: [{ day: "Monday", start: "10:00", end: "14:00" }, { day: "Thursday", start: "10:00", end: "14:00" }], wage: 55, distance: 2, skills: ["Sales"], interests: ["Retail"], applyUrl: "#", status: "verified", location: "บางนา, กรุงเทพฯ", source: "demo" },
  { id: 5, title: "ผู้ช่วยกรอกข้อมูล Excel (Data Entry)", company: "บริษัท สยามบัญชีดี จำกัด", category: "Online", shifts: [{ day: "Tuesday", start: "18:00", end: "21:00" }, { day: "Thursday", start: "18:00", end: "21:00" }], wage: 80, distance: 0, skills: ["Excel"], interests: ["Online"], applyUrl: "#", status: "verified", location: "ทำงานออนไลน์", source: "demo" },
  { id: 6, title: "สตาฟงานอีเวนต์ (Event Staff)", company: "ทีมจัดงานแฮปปี้อีเวนต์", category: "Event", shifts: [{ day: "Saturday", start: "10:00", end: "18:00" }], wage: 75, distance: 12, skills: ["English", "Sales"], interests: ["Event"], applyUrl: "#", status: "verified", location: "บางนา, กรุงเทพฯ", source: "demo" },
  { id: 7, title: "นักออกแบบกราฟิกฟรีแลนซ์ (Graphic Designer)", company: "สตูดิโอสีสัน", category: "Online", shifts: [{ day: "Sunday", start: "13:00", end: "18:00" }], wage: 120, distance: 0, skills: ["Design"], interests: ["Online"], applyUrl: "#", status: "verified", location: "ทำงานออนไลน์", source: "demo" },
  { id: 8, title: "ผู้ช่วยสอนเขียนโปรแกรมเด็ก (Coding Tutor)", company: "โรงเรียนโค้ดดิ้งจิ๋ว", category: "Tutoring", shifts: [{ day: "Tuesday", start: "14:00", end: "17:00" }], wage: 140, distance: 4, skills: ["Coding", "Teaching"], interests: ["Tutoring"], applyUrl: "#", status: "verified", location: "ประเวศ, กรุงเทพฯ", source: "demo" },
  { id: 9, title: "พนักงานร้านเบเกอรี่ (Bakery Staff)", company: "ร้านขนมปังบ้านอุ่น", category: "Cafe", shifts: [{ day: "Friday", start: "17:00", end: "21:00" }, { day: "Saturday", start: "15:00", end: "21:00" }], wage: 58, distance: 6.5, skills: ["Sales"], interests: ["Cafe"], applyUrl: "#", status: "verified", location: "มีนบุรี, กรุงเทพฯ", source: "demo" },
  { id: 10, title: "แปลเอกสารอังกฤษ-ไทย (Translator)", company: "ศูนย์แปลภาษาเพื่อนแปล", category: "Online", shifts: [], wage: 100, distance: 0, skills: ["English"], interests: ["Online"], applyUrl: "#", status: "verified", location: "ทำงานออนไลน์", source: "demo" },
  { id: 11, title: "พนักงานเสิร์ฟร้านอาหาร (Waiter)", company: "ครัวคุณยาย", category: "Cafe", shifts: [], wage: null, distance: 1.8, skills: ["Sales"], interests: ["Cafe"], applyUrl: "#", status: "verified", location: "ลาดกระบัง, กรุงเทพฯ", source: "demo" },
  { id: 12, title: "แคชเชียร์มินิมาร์ท (Cashier)", company: "มินิมาร์ทหน้ามอ", category: "Retail", shifts: [{ day: "Wednesday", start: "13:00", end: "17:00" }, { day: "Friday", start: "13:00", end: "17:00" }], wage: 52, distance: 0.5, skills: ["Sales", "Excel"], interests: ["Retail"], applyUrl: "#", status: "verified", location: "ลาดกระบัง, กรุงเทพฯ", source: "demo" },
  { id: 13, title: "ผู้ช่วยดูแลโซเชียลมีเดีย (Social Media Assistant)", company: "แบรนด์สบู่ธรรมชาติใจดี", category: "Online", shifts: [{ day: "Sunday", start: "10:00", end: "13:00" }, { day: "Wednesday", start: "18:00", end: "20:00" }], wage: 90, distance: 0, skills: ["Design", "English"], interests: ["Online"], applyUrl: "#", status: "verified", location: "ทำงานออนไลน์", source: "demo" },
  { id: 14, title: "ติวเตอร์คณิตศาสตร์ ป.6 (Math Tutor)", company: "บ้านเรียนพี่สอนน้อง", category: "Tutoring", shifts: [{ day: "Sunday", start: "09:00", end: "11:00" }], wage: 200, distance: 9, skills: ["Teaching"], interests: ["Tutoring"], applyUrl: "#", status: "verified", location: "สวนหลวง, กรุงเทพฯ", source: "demo" },
  { id: 15, title: "พนักงานจัดเรียงสินค้า (Stock Staff)", company: "ร้านวัสดุก่อสร้างมั่นคง", category: "Retail", shifts: [{ day: "Saturday", start: "07:00", end: "12:00" }], wage: 50, distance: 15, skills: [], interests: ["Retail"], applyUrl: "#", status: "verified", location: "ฉะเชิงเทรา", source: "demo" },
  { id: 16, title: "พนักงานต้อนรับบูธงานแสดงสินค้า (Booth Promoter)", company: "เอ็กซ์โปพาร์ทเนอร์", category: "Event", shifts: [{ day: "Saturday", start: "11:00", end: "19:00" }, { day: "Sunday", start: "11:00", end: "19:00" }], wage: 85, distance: 25, skills: ["English", "Sales"], interests: ["Event"], applyUrl: "#", status: "verified", location: "นนทบุรี", source: "demo" },
  { id: 17, title: "ผู้ช่วยพัฒนาเว็บไซต์ (Junior Web Developer)", company: "สตาร์ทอัพเล็กเล็ก", category: "Online", shifts: [{ day: "Thursday", start: "13:00", end: "17:00" }, { day: "Saturday", start: "13:00", end: "17:00" }], wage: 130, distance: 0, skills: ["Coding", "English"], interests: ["Online"], applyUrl: "#", status: "verified", location: "ทำงานออนไลน์ (Hybrid)", source: "demo" },
  { id: 18, title: "งานพิมพ์เอกสารที่บ้าน รายได้ดี วันละ 3,000", company: "ไม่ระบุบริษัท (ติดต่อทาง Telegram)", category: "Online", shifts: [{ day: "Sunday", start: "10:00", end: "12:00" }], wage: 400, distance: 0, skills: [], interests: ["Online"], applyUrl: "#", status: "suspicious", location: "ออนไลน์ · ต้องโอนค่าสมัครก่อน", source: "demo" },
];

export const defaultSchedule: ScheduleBlock[] = [
  { id: 1, day: "Monday", start: "09:00", end: "12:00" },
  { id: 2, day: "Tuesday", start: "13:00", end: "16:00" },
  { id: 3, day: "Wednesday", start: "10:00", end: "12:00" },
];

export const initialProfile: StudentProfile = {
  name: "",
  major: "",
  skills: [],
  interests: [],
  minWage: "",
  maxDistance: "",
  maxHours: "",
};

export function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function shiftHours(shift: Shift) {
  return Math.max(0, timeToMinutes(shift.end) - timeToMinutes(shift.start)) / 60;
}

export function shiftsOverlap(a: Shift, b: Shift) {
  if (a.day !== b.day) return false;
  return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(a.end) > timeToMinutes(b.start);
}

export function hasClassConflict(job: Job, schedule: ScheduleBlock[]) {
  return job.shifts.some((jobShift) =>
    schedule.some((classBlock) => shiftsOverlap(jobShift, classBlock)),
  );
}

export function scheduleStatus(job: Job, schedule: ScheduleBlock[]): ScheduleStatus {
  if (!job.shifts.length) return "unknown";
  return hasClassConflict(job, schedule) ? "conflict" : "safe";
}

export function weeklyHours(job: Job) {
  return job.shifts.reduce((total, shift) => total + shiftHours(shift), 0);
}

export function formatShifts(shifts: Shift[]) {
  if (!shifts.length) return "ประกาศไม่ระบุวัน-เวลา ต้องสอบถาม";
  return shifts.map((shift) => `${shift.day} ${shift.start}-${shift.end}`).join(", ");
}

export function formatWage(wage: number | null) {
  return wage === null ? "ไม่ระบุค่าจ้าง" : `${wage} บาท/ชม.`;
}

export function formatDistance(distance: number | null) {
  if (distance === null) return "ไม่ทราบระยะทาง";
  return distance === 0 ? "Online" : `${distance} กม.`;
}

export function thresholdsOf(profile: StudentProfile): Thresholds {
  return {
    minWage: Number(profile.minWage) || 0,
    maxDistance: Number(profile.maxDistance) || 0,
    maxHours: Number(profile.maxHours) || 0,
  };
}

/** Compare a job with the student's limits. failures = clearly misses, unknowns = the post does not say. */
export function checkRequirements(job: Job, limits: Thresholds) {
  const failures: string[] = [];
  const unknowns: string[] = [];
  const hours = weeklyHours(job);

  if (limits.minWage > 0) {
    if (job.wage === null) unknowns.push("ประกาศไม่ระบุค่าจ้าง ต้องสอบถาม");
    else if (job.wage < limits.minWage) failures.push(`ค่าจ้างต่ำกว่าเป้า ${limits.minWage} บาท/ชม.`);
  }
  if (limits.maxDistance > 0) {
    if (job.distance === null) unknowns.push("ไม่ทราบระยะทางจากที่พัก ต้องเช็กแผนที่");
    else if (job.distance > limits.maxDistance) failures.push(`ระยะทางเกินเป้า ${limits.maxDistance} กม.`);
  }
  if (limits.maxHours > 0 && job.shifts.length && hours > limits.maxHours) {
    failures.push(`ชั่วโมงต่อสัปดาห์เกินเป้า ${limits.maxHours} ชม.`);
  }
  return { failures, unknowns };
}

export function scoreJob(job: Job, profile: StudentProfile): MatchResult {
  const { minWage, maxDistance, maxHours } = thresholdsOf(profile);
  const matchedSkills = job.skills.filter((skill) => profile.skills.includes(skill));
  const matchedInterests = job.interests.filter((interest) => profile.interests.includes(interest));
  const skillBase = job.skills.length ? matchedSkills.length / job.skills.length : 1;
  const interestBoost = matchedInterests.length ? 0.2 : 0;
  const skillScore = Math.min(35, Math.round((skillBase + interestBoost) * 35));
  const hours = Number(weeklyHours(job).toFixed(1));
  const knownShifts = job.shifts.length > 0;
  // Unknown values get half marks: not rewarded, not punished. Tiers still put them below known matches.
  const timeScore = !knownShifts
    ? 12
    : Math.round(Math.max(0, 1 - Math.abs(maxHours - hours) / Math.max(maxHours, 1)) * 25);
  const wageScore = job.wage === null ? 10 : Math.round(Math.min(1, job.wage / Math.max(minWage * 1.6, 1)) * 20);
  const distanceScore =
    job.distance === null ? 10 : Math.round(Math.max(0, 1 - job.distance / Math.max(maxDistance, 1)) * 20);
  const score = Math.min(100, skillScore + timeScore + wageScore + distanceScore);

  const reasons = [
    "ไม่ชนกับตารางเรียน",
    matchedSkills.length ? `ทักษะตรงกัน: ${matchedSkills.join(", ")}` : "ไม่ต้องใช้ทักษะที่คุณเลือกโดยตรงมากนัก",
    matchedInterests.length ? `ตรงกับความสนใจด้าน ${matchedInterests.join(", ")}` : "ประเภทงานยังอยู่ในเกณฑ์ที่ทำได้",
    knownShifts
      ? `${hours} ชั่วโมง/สัปดาห์${maxHours ? ` จากเพดาน ${maxHours} ชั่วโมง` : ""}`
      : "ยังไม่ทราบจำนวนชั่วโมงต่อสัปดาห์",
    job.distance === 0
      ? "ทำงานออนไลน์ ไม่มีระยะทางเดินทาง"
      : job.distance === null
        ? "ยังไม่ทราบระยะทาง"
        : `อยู่ห่าง ${job.distance} กม.`,
  ];

  return {
    job,
    score,
    reasons,
    warnings: [],
    scheduleStatus: knownShifts ? "safe" : "unknown",
    scheduleSafe: knownShifts,
    tier: "match",
    isRelaxed: false,
    skillScore,
    timeScore,
    wageScore,
    distanceScore,
    weeklyHours: hours,
  };
}

export const TARGET_MATCHES = 5;
// Repeat step: loosen distance and minimum wage step by step. Working hours and class times are never loosened.
export const RELAX_STEPS = [
  { distance: 1.5, wage: 0.9 },
  { distance: 2, wage: 0.8 },
];

export function filterAndScoreJobs(jobs: Job[], profile: StudentProfile, schedule: ScheduleBlock[]): SearchOutcome {
  const safeJobs = jobs.filter((job) => job.status !== "suspicious");
  const withStatus = safeJobs.map((job) => ({ job, status: scheduleStatus(job, schedule) }));
  // Jobs that clash with a class are removed, never just penalised.
  const candidates = withStatus.filter((item) => item.status !== "conflict");
  const strict = thresholdsOf(profile);

  const passes = (job: Job, status: ScheduleStatus, limits: Thresholds) => {
    const check = checkRequirements(job, limits);
    return status === "safe" && !check.failures.length && !check.unknowns.length;
  };

  const strictCount = candidates.filter((item) => passes(item.job, item.status, strict)).length;
  let relaxed: Thresholds | null = null;
  let relaxNote = "";
  if (strictCount < TARGET_MATCHES && (strict.minWage > 0 || strict.maxDistance > 0)) {
    for (const step of RELAX_STEPS) {
      relaxed = {
        minWage: Math.round(strict.minWage * step.wage),
        maxDistance: Number((strict.maxDistance * step.distance).toFixed(1)),
        maxHours: strict.maxHours,
      };
      const count = candidates.filter((item) => passes(item.job, item.status, relaxed as Thresholds)).length;
      if (count >= TARGET_MATCHES) break;
    }
    if (relaxed) {
      const relaxedCount = candidates.filter((item) => passes(item.job, item.status, relaxed as Thresholds)).length;
      const changes = [
        strict.maxDistance > 0 ? `ขยายระยะทางเป็น ${relaxed.maxDistance} กม.` : "",
        strict.minWage > 0 ? `ลดค่าจ้างขั้นต่ำเป็น ${relaxed.minWage} บาท/ชม.` : "",
      ].filter(Boolean);
      relaxNote =
        relaxedCount > strictCount
          ? `เจองานตรงเกณฑ์ ${strictCount} งาน (น้อยกว่า ${TARGET_MATCHES}) Agent จึง${changes.join(" และ ")} แล้วได้งานเพิ่ม ${relaxedCount - strictCount} งาน`
          : `เจองานตรงเกณฑ์ ${strictCount} งาน Agent ลอง${changes.join(" และ ")}แล้ว แต่ไม่ได้งานเพิ่ม`;
    }
  }

  const tierOrder: Record<Tier, number> = { match: 0, relaxed: 1, check: 2, other: 3 };
  const results = candidates
    .map(({ job, status }) => {
      const base = scoreJob(job, profile);
      const strictCheck = checkRequirements(job, strict);
      let tier: Tier;
      if (status === "unknown" || strictCheck.unknowns.length) tier = "check";
      else if (!strictCheck.failures.length) tier = "match";
      else if (relaxed && !checkRequirements(job, relaxed).failures.length) tier = "relaxed";
      else tier = "other";

      const warnings = [
        ...(status === "unknown" ? ["ประกาศไม่ระบุวัน-เวลาทำงาน ต้องถามนายจ้างว่าไม่ชนคาบเรียน"] : []),
        ...strictCheck.unknowns,
        ...strictCheck.failures,
        ...(tier === "relaxed" ? ["ผ่านเกณฑ์ที่ Agent ผ่อนให้ ไม่ใช่เกณฑ์เดิมของคุณ"] : []),
      ];
      const penalty = strictCheck.failures.length * 8;

      return {
        ...base,
        score: Math.max(1, base.score - penalty),
        warnings,
        scheduleStatus: status,
        scheduleSafe: status === "safe",
        tier,
        isRelaxed: tier !== "match",
        reasons: [
          status === "safe" ? "ไม่ชนกับตารางเรียน" : "ยังยืนยันไม่ได้ว่าไม่ชนตารางเรียน",
          ...base.reasons.slice(1),
        ],
      };
    })
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || b.score - a.score);

  return {
    results,
    excludedConflicts: withStatus.length - candidates.length,
    excludedSuspicious: jobs.length - safeJobs.length,
    relaxNote,
  };
}

export const GENERIC_WORDS = new Set(["part", "time", "part-time", "parttime", "student", "students", "job", "jobs", "งาน", "พาร์ทไทม์", "พาร์ทไทม์นักศึกษา", "นักศึกษา"]);

/** Demo mode: simple keyword filter over the sample jobs. Generic queries return every sample job. */
export function searchDemoJobs(query: string) {
  const words = query
    .toLowerCase()
    .split(/[\s,/]+/)
    .filter((word) => word.length > 1 && !GENERIC_WORDS.has(word));
  if (!words.length) return { jobs: mockJobs, matched: true };
  const found = mockJobs.filter((job) => {
    const text = `${job.title} ${job.company} ${job.category} ${job.skills.join(" ")} ${job.interests.join(" ")}`.toLowerCase();
    return words.some((word) => text.includes(word));
  });
  return found.length ? { jobs: found, matched: true } : { jobs: mockJobs, matched: false };
}

export function getSuggestions(query: string, location: string) {
  const suggestions = [];
  suggestions.push(`ค้นหาตำแหน่ง "${query || "part time student jobs"}" ใน${location || "ทั่วประเทศไทย"} ก่อน แล้วค่อยดูเงื่อนไขประกอบ`);
  suggestions.push("ลองใช้ชื่อภาษาไทยและอังกฤษของตำแหน่งเดียวกัน เช่น Barista / พนักงานร้านกาแฟ");
  suggestions.push("ลองเลือกจังหวัดใกล้เคียง หรือเลือก \"ทั่วประเทศไทย\"");
  return suggestions.slice(0, 3);
}

export function agentExplanation(profile: StudentProfile, schedule: ScheduleBlock[], results: MatchResult[], query: string, location: string) {
  if (!results.length) {
    const suggestions = getSuggestions(query, location);
    return suggestions.length
      ? `ระบบยังไม่เจอตำแหน่งงานจากคำค้นนี้โดยตรง ควรลองค้นด้วยชื่อเรียกอื่นของตำแหน่งเดิมก่อน เช่น ${suggestions.join(" และ ")}`
      : "ระบบยังไม่เจอตำแหน่งงานจากคำค้นนี้โดยตรง";
  }

  const freeDays = days.filter((day) => !schedule.some((block) => block.day === day));
  const top = results[0];
  const freeText = freeDays.length
    ? `คุณไม่มีคาบเรียนในวัน${freeDays.map((day) => thaiDayNames[day]).join(" ")}`
    : "คุณมีตารางเรียนกระจายหลายวัน ระบบจึงเลือกงานที่ไม่ทับช่วงเรียนโดยตรง";
  const caution = top.scheduleSafe ? "" : " แต่ประกาศไม่ระบุเวลาทำงาน ควรสอบถามนายจ้างก่อนสมัคร";
  return `${freeText} งานที่ตรงกับการค้นหาและน่าสนใจที่สุดคือ ${top.job.title} ที่ ${top.job.company} ได้ ${top.score}/100 คะแนน ${top.reasons[1]} ค่าจ้าง ${formatWage(top.job.wage)} ระยะทาง ${formatDistance(top.job.distance)}${caution}`;
}

