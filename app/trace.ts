/**
 * Search trace: a step-by-step record of what the system did for one search.
 * The server fills the parts it sees (AI calls, job-source calls, verification); the browser adds
 * its own steps (filtering, ranking, explanation) and saves the latest trace for the /how-it-works page.
 * Never put API keys, full job descriptions or personal data in a trace.
 */

export type TraceActor = "browser" | "server" | "ai" | "web";

export type TraceEvent = {
  actor: TraceActor;
  title: string;
  detail: string;
  /** Time this step took, in milliseconds. */
  ms?: number;
  status: "ok" | "cached" | "skip" | "error";
  /** Extra lines, e.g. queries tried or job titles removed. */
  list?: string[];
};

export type SourceStat = { name: string; count: number };

export type ExtractionRow = {
  title: string;
  company: string;
  via: string;
  /** What the AI said it found in the post. */
  aiShifts: number;
  aiWage: number | null;
  /** What survived the check against the post text. */
  keptShifts: number;
  keptWage: number | null;
  verdict: "accepted" | "rejected" | "nothing-stated" | "no-answer";
};

export type RemovedJob = { title: string; company: string; reason: string };

export type ServerTrace = {
  events: TraceEvent[];
  sources: SourceStat[];
  extraction: ExtractionRow[];
};

export type SearchTrace = ServerTrace & {
  at: string;
  mode: "live" | "demo";
  query: string;
  locationName: string;
  totalMs: number;
  ok: boolean;
  removed: RemovedJob[];
};

const STORAGE_KEY = "findjob:last-trace";

/** Per-viewer convenience only: the latest trace lives in this browser and may be missing. */
export function saveTrace(trace: SearchTrace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trace));
  } catch {
    // storage blocked (private mode etc.) — the page still works without it
  }
}

/** Raw stored JSON (a stable string, so it can be used as a useSyncExternalStore snapshot). */
export function loadTraceRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseTrace(raw: string | null): SearchTrace | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SearchTrace;
  } catch {
    return null;
  }
}

/** Re-render when another tab saves a new trace. */
export function subscribeTrace(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
