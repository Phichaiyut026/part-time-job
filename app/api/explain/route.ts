import { requestGemini } from "../gemini";

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
    wage: number;
    distance: number;
    weeklyHours: number;
    scheduleSafe?: boolean;
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
If isRelaxed is true or warnings exist, clearly say it is a near match and mention the main warning.

Write one concise Thai paragraph, friendly and useful for a university student.
Mention the best job first when results exist. If no results exist, suggest searching the same position with another Thai/English title or a clearer location before changing wage, distance, or hours.

Student:
${JSON.stringify(payload.profile ?? {}, null, 2)}

Class schedule:
${JSON.stringify(payload.schedule ?? [], null, 2)}

Filtered and scored results:
${JSON.stringify(topJobs, null, 2)}

Suggestions when no exact match:
${JSON.stringify(payload.suggestions ?? [], null, 2)}
`.trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY" },
      { status: 500 },
    );
  }

  try {
    const payload = (await request.json()) as ExplainPayload;
    const response = await requestGemini(apiKey, {
        contents: [
          {
            parts: [{ text: buildPrompt(payload) }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200,
        },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: "Gemini request failed", details: data },
        { status: response.status },
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("")
        .trim() ?? "";

    return Response.json({ explanation: text });
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
