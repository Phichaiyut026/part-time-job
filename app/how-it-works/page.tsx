import type { Metadata } from "next";
import { HowItWorks } from "./HowItWorks";

export const metadata: Metadata = {
  title: "ระบบทำงานยังไง · Part-time Job Finder",
  description: "Diagram of how the part-time job agent works, and a step-by-step trace of the latest search.",
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
