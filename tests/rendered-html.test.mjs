import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("app source includes required MVP logic and data", async () => {
  const source =
    (await readFile(new URL("../app/JobFinderApp.tsx", import.meta.url), "utf8")) +
    (await readFile(new URL("../app/job-logic.ts", import.meta.url), "utf8"));

  assert.match(source, /const mockJobs: Job\[\]/);
  assert.match(source, /function shiftsOverlap/);
  assert.match(source, /function hasClassConflict/);
  assert.match(source, /function scoreJob/);
  assert.match(source, /function filterAndScoreJobs/);
  assert.match(source, /filter\(\(job\) => job\.status !== "suspicious"\)/);
  assert.match(source, /\/api\/jobs\?query=/);
  assert.match(source, /fetch\("\/api\/explain"/);

  const jobCount = [...source.matchAll(/id: \d+, title:/g)].length;
  assert.ok(jobCount >= 15, `expected at least 15 mock jobs, found ${jobCount}`);
});

test("route metadata is specific to Part-time Job Finder", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(page, /title: "Part-time Job Finder"/);
  assert.match(page, /<JobFinderApp \/>/);
  assert.match(layout, /<html lang="th">/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);
  assert.doesNotMatch(layout, /Starter Project/);
});

test("ThaiLLM explanation route keeps LLM usage behind the server", async () => {
  const route = await readFile(new URL("../app/api/explain/route.ts", import.meta.url), "utf8");
  const llm = await readFile(new URL("../app/api/llm.ts", import.meta.url), "utf8");

  assert.match(route, /requestLLM/);
  assert.match(route, /Do not recalculate schedules/);
  assert.match(llm, /process\.env\.THAILLM_API_KEY/);
  assert.match(llm, /\/chat\/completions/);
  assert.match(llm, /Authorization: `Bearer/);
});

test("AI-extracted shifts are checked against the post text", async () => {
  const extract = await readFile(new URL("../app/api/jobs/extract-details.ts", import.meta.url), "utf8");

  assert.match(extract, /function verifiedShifts/);
  assert.match(extract, /function verifiedWage/);
  assert.match(extract, /daysInPost/);
});

test("job shifts come from the post, not invented", async () => {
  const route = await readFile(new URL("../app/api/jobs/route.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../app/job-logic.ts", import.meta.url), "utf8");

  assert.doesNotMatch(route, /fallbackShifts/);
  assert.match(route, /extractJobDetails/);
  assert.match(app, /item\.status !== "conflict"/);
});

test("live jobs route normalizes OpenWebNinja results on the server", async () => {
  const route = await readFile(new URL("../app/api/jobs/route.ts", import.meta.url), "utf8");

  assert.match(route, /process\.env\.OPENWEBNINJA_API_KEY/);
  assert.match(route, /normalizeJobs/);
  assert.match(route, /source: "openwebninja"/);
  assert.match(route, /job_apply_link/);
});

test("live jobs route prefers SerpApi Google Jobs when its key is set", async () => {
  const route = await readFile(new URL("../app/api/jobs/route.ts", import.meta.url), "utf8");

  assert.match(route, /process\.env\.SERPAPI_API_KEY/);
  assert.match(route, /"engine", "google_jobs"/);
  assert.match(route, /normalizeSerpJobs/);
  assert.match(route, /searchCache/);
});

test("how-it-works page shows the diagram and the latest search trace", async () => {
  const page = await readFile(new URL("../app/how-it-works/HowItWorks.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/jobs/route.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../app/JobFinderApp.tsx", import.meta.url), "utf8");

  assert.match(page, /function Diagram/);
  assert.match(page, /function Timeline/);
  assert.match(page, /useSyncExternalStore/); // localStorage read without breaking hydration
  assert.match(route, /trace,/);
  assert.match(app, /saveTrace\(trace\)/);
  // the trace must never carry the API key
  assert.doesNotMatch(route, /events\.push\([^)]*apiKey/s);
});
