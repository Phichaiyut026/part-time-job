import { planSearch } from "./search-plan";
import { extractJobDetails } from "./extract-details";
import type { ExtractionRow, ServerTrace, SourceStat, TraceEvent } from "../../trace";

export const runtime = "edge";

const OPENWEBNINJA_URL = "https://api.openwebninja.com/jsearch/search-v2";
const SERPAPI_URL = "https://serpapi.com/search.json";

// SerpApi's free plan is 250 searches/month: reuse identical searches for an hour (per server process).
const CACHE_TTL_MS = 60 * 60 * 1000;
const searchCache = new Map<string, { at: number; data: unknown }>();

type Provider = { name: "serpapi" | "openwebninja"; apiKey: string };

function pickProvider(): Provider | null {
  if (process.env.SERPAPI_API_KEY) return { name: "serpapi", apiKey: process.env.SERPAPI_API_KEY };
  if (process.env.OPENWEBNINJA_API_KEY) return { name: "openwebninja", apiKey: process.env.OPENWEBNINJA_API_KEY };
  return null;
}

class UpstreamError extends Error {
  constructor(
    public provider: Provider["name"],
    public status: number,
    public details: unknown,
  ) {
    super(`${provider} request failed`);
  }
}

/** Call the job source once; returns raw JSON. Cached for an hour so demos don't burn quota. */
async function fetchJobs(provider: Provider, query: string, location: string): Promise<{ data: unknown; cached: boolean; ms: number }> {
  const cacheKey = `${provider.name}|${query.toLowerCase()}|${location.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { data: cached.data, cached: true, ms: 0 };
  const started = Date.now();

  let response: Response;
  if (provider.name === "serpapi") {
    const url = new URL(SERPAPI_URL);
    url.searchParams.set("engine", "google_jobs");
    url.searchParams.set("q", query);
    url.searchParams.set("location", location);
    url.searchParams.set("hl", "en");
    if (wantsThailand(location)) url.searchParams.set("gl", "th");
    url.searchParams.set("api_key", provider.apiKey);
    response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } else {
    const url = new URL(OPENWEBNINJA_URL);
    url.searchParams.set("query", buildLocationQuery(query, location));
    response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "X-API-Key": provider.apiKey } });
  }

  const data = await response.json().catch(() => null);
  // SerpApi answers 200 with {error: "Google hasn't returned any results..."} when nothing matches.
  const serpError = provider.name === "serpapi" && data && typeof data === "object" ? (data as { error?: string }).error : undefined;
  if (serpError && /hasn't returned any results/i.test(serpError)) {
    searchCache.set(cacheKey, { at: Date.now(), data: { jobs_results: [] } });
    return { data: { jobs_results: [] }, cached: false, ms: Date.now() - started };
  }
  if (!response.ok || serpError) {
    throw new UpstreamError(provider.name, response.ok ? 400 : response.status, serpError ?? data);
  }
  searchCache.set(cacheKey, { at: Date.now(), data });
  return { data, cached: false, ms: Date.now() - started };
}

/**
 * SerpApi gives salary as text, e.g. "฿15K–฿20K a month", "THB 60–80 an hour", "16.25–18.44 an hour".
 * Only baht amounts with a known period are converted; anything else stays unknown.
 */
function parseSalaryText(text: string): number | null {
  if (!/฿|thb|บาท/i.test(text)) return null;
  const lower = text.toLowerCase().replace(/,/g, "");
  const periods: Array<[RegExp, number]> = [
    [/hour|hr|ชั่วโมง|ชม/, 1],
    [/day|วัน/, 8],
    [/week|สัปดาห์/, 40],
    [/month|เดือน/, 173],
    [/year|ปี/, 2080],
  ];
  const hours = periods.find(([pattern]) => pattern.test(lower))?.[1];
  const match = lower.match(/(\d+(?:\.\d+)?)\s*(k)?/);
  if (!hours || !match) return null;
  const amount = Number(match[1]) * (match[2] ? 1000 : 1);
  return amount > 0 ? Math.round(amount / hours) : null;
}

function normalizeSerpJobs(data: unknown, location: string) {
  const list = data && typeof data === "object" ? (data as { jobs_results?: unknown }).jobs_results : null;
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .slice(0, 20)
    .map((item, index) => {
      const title = getText(item, ["title"], "Untitled job");
      const company = getText(item, ["company_name"], "Unknown company");
      const description = getText(item, ["description"], "");
      const extensions = (item.detected_extensions ?? {}) as Record<string, unknown>;
      const scheduleType = typeof extensions.schedule_type === "string" ? extensions.schedule_type : "";
      const salaryText = typeof extensions.salary === "string" ? extensions.salary : "";
      const isRemote = extensions.work_from_home === true || /remote|online|work from home/i.test(`${title} ${description}`);
      const interests = inferInterests(title, description, isRemote);
      const applyOptions = Array.isArray(item.apply_options) ? (item.apply_options as Array<Record<string, unknown>>) : [];
      const applyUrl =
        applyOptions.map((option) => option.link).find((link): link is string => typeof link === "string") ??
        getText(item, ["share_link"], "#");
      const jobLocation = getText(item, ["location"], location);
      const via = getText(item, ["via"], "").replace(/^via\s+/i, "");
      const applySites = applyOptions.map((option) => option.title).filter((title): title is string => typeof title === "string");

      return {
        id: 2000 + index,
        title,
        company,
        // Schedule type and salary text are part of what the AI and the verifier read.
        description: [scheduleType, salaryText, description].filter(Boolean).join("\n"),
        category: interests[0],
        shifts: [] as Array<{ day: string; start: string; end: string }>,
        wage: salaryText ? parseSalaryText(salaryText) : null,
        distance: isRemote ? 0 : null,
        skills: inferSkills(title, description),
        interests,
        applyUrl,
        status: isSuspicious(`${title} ${company} ${description}`) ? "suspicious" : "verified",
        location: jobLocation,
        country: wantsThailand(jobLocation) ? "Thailand" : "",
        source: "serpapi",
        via: via || applySites[0] || "Google Jobs",
        applySites,
      };
    });
}

function isSuspicious(text: string) {
  return /telegram|whatsapp|crypto|investment|quick cash|easy money|deposit|registration fee|โอนเงินก่อน|เงินมัดจำ/i.test(text);
}

// Hours used to turn a stated salary period into baht per hour.
const HOURS_PER_PERIOD: Record<string, number> = { HOUR: 1, DAY: 8, WEEK: 40, MONTH: 173, YEAR: 2080 };

/** Hourly wage in THB, only when the API gives a salary in baht with a known period. Otherwise null. */
function salaryPerHourThb(item: Record<string, unknown>) {
  const currency = getText(item, ["job_salary_currency", "salary_currency"], "").toUpperCase();
  const period = getText(item, ["job_salary_period", "salary_period"], "").toUpperCase();
  const amount = getNumber(item, ["job_min_salary", "salary_min"], 0);
  if (currency !== "THB" || !HOURS_PER_PERIOD[period] || amount <= 0) return null;
  return Math.round(amount / HOURS_PER_PERIOD[period]);
}

function getText(record: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function getNumber(record: Record<string, unknown>, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.]/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return fallback;
}

function toArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    const records = data.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
    );
    if (
      records.some((item) =>
        ["job_title", "title", "name", "employer_name", "company"].some(
          (key) => typeof item[key] === "string",
        ),
      )
    ) {
      return records;
    }
    for (const item of records) {
      const nested = toArray(item);
      if (nested.length) return nested;
    }
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["data", "jobs", "results", "items"]) {
      if (Array.isArray(record[key])) return toArray(record[key]);
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        const nested = toArray(value);
        if (nested.length) return nested;
      }
    }
  }
  return [];
}

function inferSkills(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  const skills = [];
  if (/english|language|support|customer/.test(text)) skills.push("English");
  if (/excel|spreadsheet|data|analyst|admin/.test(text)) skills.push("Excel");
  if (/sales|retail|cashier|store|marketing/.test(text)) skills.push("Sales");
  if (/teach|tutor|instructor|coach/.test(text)) skills.push("Teaching");
  if (/design|graphic|social|creative/.test(text)) skills.push("Design");
  if (/developer|software|web|code|program|engineer/.test(text)) skills.push("Coding");
  return skills.length ? skills : ["English"];
}

function inferInterests(title: string, description: string, isRemote: boolean) {
  const text = `${title} ${description}`.toLowerCase();
  const interests = [];
  if (/cafe|coffee|barista|restaurant|bakery/.test(text)) interests.push("Cafe");
  if (/teach|tutor|school|student|academy|coach/.test(text)) interests.push("Tutoring");
  if (/retail|store|cashier|sales/.test(text)) interests.push("Retail");
  if (isRemote || /online|remote|virtual|work from home/.test(text)) interests.push("Online");
  if (/event|expo|booth|conference|promo/.test(text)) interests.push("Event");
  return interests.length ? interests : ["Online"];
}

function formatLocation(item: Record<string, unknown>) {
  const city = getText(item, ["job_city", "city", "location_city"], "");
  const state = getText(item, ["job_state", "state", "location_state"], "");
  const country = getText(item, ["job_country", "country", "location_country"], "");
  const display = [city, state, country].filter(Boolean).join(", ");
  return {
    display: display || getText(item, ["job_location", "location"], "ไม่ระบุพื้นที่"),
    country,
  };
}

function wantsThailand(location: string) {
  return /thailand|thai|bangkok|กรุงเทพ|ประเทศไทย/i.test(location);
}

function isOutsideRequestedCountry(job: { country: string }, location: string) {
  if (!wantsThailand(location) || !job.country) return false;
  return !/thailand|thai|th|ประเทศไทย/i.test(job.country);
}

function buildLocationQuery(query: string, location: string) {
  const trimmedQuery = query.trim();
  if (!location.trim()) return trimmedQuery;
  if (trimmedQuery.toLowerCase().includes(location.toLowerCase())) return trimmedQuery;

  const queryWithoutOldLocation = trimmedQuery.replace(/\s+in\s+[^,]+(?:,\s*[^,]+)?$/i, "");
  return `${queryWithoutOldLocation} in ${location}`;
}

function normalizeJobs(data: unknown, location: string) {
  return toArray(data).slice(0, 40).map((item, index) => {
    const title = getText(item, ["job_title", "title", "name"], "Untitled job");
    const company = getText(item, ["employer_name", "company", "company_name"], "Unknown company");
    const description = getText(item, ["job_description", "description", "snippet"], "");
    const locationInfo = formatLocation(item);
    const isRemote =
      Boolean(item.job_is_remote) ||
      /remote|online|work from home/i.test(`${title} ${description}`);
    const interests = inferInterests(title, description, isRemote);
    const suspicious = isSuspicious(`${title} ${company} ${description}`);

    return {
      id: 1000 + index,
      title,
      company,
      description,
      category: interests[0],
      // Filled from the job post text below; empty means the post does not state working hours.
      shifts: [] as Array<{ day: string; start: string; end: string }>,
      wage: salaryPerHourThb(item),
      // JSearch has no distance from the student, so it stays unknown unless the job is remote.
      distance: isRemote ? 0 : null,
      skills: inferSkills(title, description),
      interests,
      applyUrl: getText(item, ["job_apply_link", "job_google_link", "url", "apply_url"], "#"),
      status: suspicious ? "suspicious" : "verified",
      location: locationInfo.display,
      country: locationInfo.country,
      source: "openwebninja",
      via: getText(item, ["job_publisher"], "JSearch"),
      applySites: [] as string[],
    };
  }).filter((job) => !isOutsideRequestedCountry(job, location)).slice(0, 20);
}

export async function GET(request: Request) {
  const provider = pickProvider();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "part time student jobs";
  const location = searchParams.get("location")?.trim() || "Bangkok, Thailand";
  const apiQuery = buildLocationQuery(query, location);

  if (!provider) {
    return Response.json({ error: "Missing job API key" }, { status: 500 });
  }

  const events: TraceEvent[] = [];
  const providerLabel = provider.name === "serpapi" ? "SerpApi · Google Jobs" : "OpenWebNinja · JSearch";
  events.push({
    actor: "server",
    title: "รับคำขอค้นหา",
    detail: `ตำแหน่ง "${query}" · พื้นที่ ${location} · แหล่งงาน ${providerLabel}`,
    status: "ok",
  });

  try {
    const planStarted = Date.now();
    const plan = await planSearch(query.slice(0, 300));
    events.push({
      actor: "ai",
      title: "ThaiLLM วางแผนคำค้น",
      detail: plan.aiUsed ? `ได้คำค้น ${plan.queries.length} แบบ (ตำแหน่งเดียวกัน)` : plan.message,
      ms: Date.now() - planStarted,
      status: plan.aiUsed ? "ok" : "skip",
      list: plan.queries,
    });

    const searchedQueries: string[] = [];
    let jobs: ReturnType<typeof normalizeJobs> = [];
    for (const searchQuery of plan.queries) {
      searchedQueries.push(searchQuery);
      const fetched = await fetchJobs(provider, searchQuery, location);
      jobs = provider.name === "serpapi" ? normalizeSerpJobs(fetched.data, location) : normalizeJobs(fetched.data, location);
      events.push({
        actor: "web",
        title: `${providerLabel} ค้นหา "${searchQuery}"`,
        detail: fetched.cached
          ? `ใช้ผลที่เก็บไว้ (ค้นคำนี้ไปแล้วภายใน 1 ชม.) · ${jobs.length} งาน · ไม่เสียโควตา`
          : `ได้ ${jobs.length} งาน · ใช้โควตา 1 ครั้ง`,
        ms: fetched.ms,
        status: fetched.cached ? "cached" : "ok",
      });
      // Stop at the first query that finds real (non-suspicious) jobs; each extra query costs quota.
      if (jobs.some((job) => job.status !== "suspicious")) break;
    }

    const suspicious = jobs.filter((job) => job.status === "suspicious");
    events.push({
      actor: "server",
      title: "แปลงข้อมูลและคัดงานน่าสงสัย",
      detail: `แปลงเงินเดือนเป็นบาท/ชม. · พบคำเสี่ยงหลอกลวง ${suspicious.length} งาน`,
      status: "ok",
      list: suspicious.map((job) => `${job.title} · ${job.company}`),
    });

    const sourceCounts = new Map<string, number>();
    for (const job of jobs) sourceCounts.set(job.via, (sourceCounts.get(job.via) ?? 0) + 1);
    const sources: SourceStat[] = [...sourceCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const extraction = await extractJobDetails(
      jobs.map((job) => ({ key: String(job.id), title: job.title, description: job.description })),
    );
    const extractionRows: ExtractionRow[] = jobs.map((job) => {
      const row = extraction.report.get(String(job.id));
      const verdict: ExtractionRow["verdict"] = !row
        ? "no-answer"
        : row.aiShifts === 0 && row.aiWage === null
          ? "nothing-stated"
          : row.keptShifts === row.aiShifts && (row.aiWage === null || row.keptWage !== null)
            ? "accepted"
            : "rejected";
      return {
        title: job.title,
        company: job.company,
        via: job.via,
        aiShifts: row?.aiShifts ?? 0,
        aiWage: row?.aiWage ?? null,
        keptShifts: row?.keptShifts ?? 0,
        keptWage: row?.keptWage ?? null,
        verdict,
      };
    });
    events.push({
      actor: "ai",
      title: "ThaiLLM อ่านประกาศงาน",
      detail: extraction.aiUsed
        ? `อ่าน ${jobs.length} ประกาศ แบ่ง ${extraction.batches} ชุด (ส่งพร้อมกัน)${extraction.failedBatches ? ` · ล้มเหลว ${extraction.failedBatches} ชุด` : ""}`
        : "AI ไม่พร้อม จึงถือว่าทุกงานไม่ระบุเวลา",
      ms: extraction.ms,
      status: extraction.aiUsed ? "ok" : "skip",
    });
    events.push({
      actor: "server",
      title: "ตรวจคำตอบของ AI กับข้อความในประกาศ",
      detail: `ยืนยันได้ ${extractionRows.filter((row) => row.verdict === "accepted").length} งาน · ไม่ผ่านการตรวจ ${extractionRows.filter((row) => row.verdict === "rejected").length} งาน · ประกาศไม่ระบุ ${extractionRows.filter((row) => row.verdict === "nothing-stated").length} งาน`,
      status: "ok",
    });

    const enrichedJobs = jobs.map((job) => {
      const found = extraction.details.get(String(job.id));
      const enriched: Partial<typeof job> & Omit<typeof job, "description"> = {
        ...job,
        shifts: found?.shifts ?? [],
        wage: job.wage ?? found?.wagePerHour ?? null,
      };
      delete enriched.description; // full post text stays on the server
      return enriched;
    });

    const trace: ServerTrace = { events, sources, extraction: extractionRows };
    return Response.json({
      source: provider.name,
      query: apiQuery,
      location,
      jobs: enrichedJobs,
      searchPlan: { aiUsed: plan.aiUsed, message: plan.message, searchedQueries },
      detailExtraction: {
        aiUsed: extraction.aiUsed,
        withSchedule: enrichedJobs.filter((job) => job.shifts.length > 0).length,
        withWage: enrichedJobs.filter((job) => job.wage !== null).length,
      },
      trace,
    });
  } catch (error) {
    if (error instanceof UpstreamError) {
      return Response.json(
        { error: `${error.provider} request failed`, details: error.details },
        { status: error.status >= 400 ? error.status : 502 },
      );
    }
    return Response.json(
      {
        error: "Could not fetch jobs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
