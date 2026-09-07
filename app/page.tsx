import type { Metadata } from "next";
import { JobFinderApp } from "./JobFinderApp";

export const metadata: Metadata = {
  title: "Part-time Job Finder",
  description:
    "Find student part-time jobs that fit class schedules, skills, pay, distance, and weekly hours.",
};

export default function Home() {
  return <JobFinderApp />;
}
