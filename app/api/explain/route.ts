import { llmConfigured, requestLLM } from "../llm";

export const runtime = "edge";

type ExplainPayload = {
  profile?: {
    name?: string;
    major?: string;
    skills?: string[];
    interests?: string[];
    minWage?: number;
    maxDistance?: number;
    maxHours?: number;
  };
  schedule?: Array<{
    day: string;
    start: string;
    end: string;
  }>;
  results?: Array<{
    title: string;
    company: string;
    score: number;
    wage: number | null;
    distance: number | null;
    weeklyHours: number;
    scheduleSafe?: boolean;
    scheduleStatus?: "safe" | "unknown";
    isRelaxed?: boolean;
    reasons: string[];
    warnings?: string[];
  }>;
  suggestions?: string[];
};

function buildPrompt(payload: ExplainPayload) {
  const results = payload.results ?? [];
  const topJobs = results.slice(0, 3);

  return `
You are an explanation writer for a student part-time job finder.
The app has already filtered scam/suspicious jobs, checked class-time conflicts with deterministic code, and scored jobs with deterministic code.
Do not recalculate schedules. Do not claim a job is safe or conflict-free unless scheduleSafe is true.
Jobs that clash with classes were already removed. scheduleStatus "unknown" means the job post does not state working hours: tell the student to ask the employer before applying.
wage or distance null means the post does not state it: say it is not stated, never invent a number.
If isRelaxed is true or warnings exist, clearly say it is a near match and mention the main warning.

Write one concise Thai paragraph (at most 4 sentences), friendly and useful for a university student.
Plain text only: no markdown, no bullet points, no asterisks. Never mention field names such as scheduleSafe, isRelaxed or score keys; say it in natural Thai instead.
${
  topJobs.length
    ? "Mention the best job first and why it fits. Do not give search tips."
    : "No jobs were found: suggest searching the same position with another Thai/English title or a clearer location before changing wage, distance, or hours."
}

Student:
${JSON.stringify(payload.profile ?? {}, null, 2)}

Class schedule:
${JSON.stringify(payload.schedule ?? [], null, 2)}

Filtered and scored results:
${JSON.stringify(topJobs, null, 2)}

${topJobs.length ? "" : `Suggestions:\n${JSON.stringify(payload.suggestions ?? [], null, 2)}`}
`.trim();
}

export async function POST(request: Request) {
  if (!llmConfigured()) {
    return Response.json({ error: "Missing THAILLM_API_KEY" }, { status: 500 });
  }

  try {
    const payload = (await request.json()) as ExplainPayload;
    const result = await requestLLM({
      system: "คุณเป็นผู้ช่วยหางานพาร์ทไทม์สำหรับนักศึกษา ตอบเป็นภาษาไทย สั้น กระชับ เป็นกันเอง และพูดเฉพาะข้อมูลที่ได้รับเท่านั้น",
      user: buildPrompt(payload),
      temperature: 0.4,
      maxTokens: 600,
    });

    if (!result.ok) {
      return Response.json({ error: "ThaiLLM request failed", details: result.error }, { status: result.status || 502 });
    }

    // Small models still slip in markdown or internal field names — strip them before showing students.
    const explanation = result.text
      .replace(/\*\*|__|`|^#+\s*/gm, "")
      .replace(/\s*\((?:scheduleSafe|scheduleStatus|isRelaxed|warnings|score)[^)]*\)/gi, "")
      .trim();
    return Response.json({ explanation });
  } catch (error) {
    return Response.json(
      {
        error: "Could not generate explanation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
