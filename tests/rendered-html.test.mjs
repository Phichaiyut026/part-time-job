import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("app source includes required MVP logic and data", async () => {
  const source = await readFile(new URL("../app/JobFinderApp.tsx", import.meta.url), "utf8");

  assert.match(source, /const mockJobs: Job\[\]/);
  assert.match(source, /function shiftsOverlap/);
  assert.match(source, /function hasClassConflict/);
  assert.match(source, /function scoreJob/);
  assert.match(source, /filter\(\(job\) => job\.status !== "suspicious"\)/);

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
