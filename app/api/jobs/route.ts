export const runtime = "edge";

const OPENWEBNINJA_URL = "https://api.openwebninja.com/jsearch/search-v2";
const fallbackShifts = [
  [
    { day: "Monday", start: "18:00", end: "21:00" },
    { day: "Wednesday", start: "18:00", end: "21:00" },
  ],
  [
    { day: "Tuesday", start: "17:30", end: "20:30" },
    { day: "Thursday", start: "17:30", end: "20:30" },
  ],
  [{ day: "Saturday", start: "09:00", end: "15:00" }],
  [{ day: "Sunday", start: "10:00", end: "16:00" }],
  [
    { day: "Friday", start: "18:00", end: "22:00" },
    { day: "Saturday", start: "13:00", end: "17:00" },
  ],
] as const;

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
    const suspiciousText = `${title} ${company} ${description}`.toLowerCase();
    const suspicious =
      /telegram|whatsapp|crypto|investment|quick cash|easy money|deposit|registration fee/.test(
        suspiciousText,
      );

    return {
      id: 1000 + index,
      title,
      company,
      category: interests[0],
      shifts: fallbackShifts[index % fallbackShifts.length],
      wage: getNumber(item, ["job_min_salary", "job_salary", "salary_min", "salary"], 100),
      distance: isRemote ? 0 : getNumber(item, ["distance", "job_distance"], 5),
      skills: inferSkills(title, description),
      interests,
      applyUrl: getText(item, ["job_apply_link", "job_google_link", "url", "apply_url"], "#"),
      status: suspicious ? "suspicious" : "verified",
      location: locationInfo.display,
      country: locationInfo.country,
      source: "openwebninja",
    };
  }).filter((job) => !isOutsideRequestedCountry(job, location)).slice(0, 20);
}

export async function GET(request: Request) {
  const apiKey = process.env.OPENWEBNINJA_API_KEY;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "part time student jobs";
  const location = searchParams.get("location")?.trim() || "Bangkok, Thailand";
  const apiQuery = buildLocationQuery(query, location);

  if (!apiKey) {
    return Response.json(
      { error: "Missing OPENWEBNINJA_API_KEY" },
      { status: 500 },
    );
  }

  try {
    const upstreamUrl = new URL(OPENWEBNINJA_URL);
    upstreamUrl.searchParams.set("query", apiQuery);

    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: "OpenWebNinja request failed", details: data },
        { status: response.status },
      );
    }

    return Response.json({
      source: "openwebninja",
      query: apiQuery,
      location,
      jobs: normalizeJobs(data, location),
      raw: data,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Could not fetch jobs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
