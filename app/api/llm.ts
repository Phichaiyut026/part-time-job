/**
 * ThaiLLM client (OpenAI-compatible chat completions API).
 * Config comes from THAILLM_API_KEY, THAILLM_BASE_URL and THAILLM_MODEL in .env — never from the browser.
 */

const DEFAULT_BASE_URL = "https://thaillm.or.th/api/v1";
const DEFAULT_MODEL = "typhoon-s-thaillm-8b-instruct";
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export type LLMRequest = {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
};

export type LLMResult = { ok: true; text: string } | { ok: false; status: number; error: string };

export function llmConfigured() {
  return Boolean(process.env.THAILLM_API_KEY);
}

export async function requestLLM(request: LLMRequest): Promise<LLMResult> {
  const apiKey = process.env.THAILLM_API_KEY;
  if (!apiKey) return { ok: false, status: 0, error: "Missing THAILLM_API_KEY" };

  const baseUrl = (process.env.THAILLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const body = JSON.stringify({
    model: process.env.THAILLM_MODEL || DEFAULT_MODEL,
    temperature: request.temperature ?? 0.2,
    max_tokens: request.maxTokens ?? 1200,
    ...(request.json ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.user },
    ],
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
      });
    } catch (error) {
      if (attempt === 2) return { ok: false, status: 0, error: error instanceof Error ? error.message : "network error" };
      continue;
    }

    if (response.ok) {
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      return typeof text === "string" ? { ok: true, text: text.trim() } : { ok: false, status: 502, error: "Empty reply" };
    }
    if (!RETRYABLE_STATUSES.has(response.status) || attempt === 2) {
      return { ok: false, status: response.status, error: (await response.text()).slice(0, 300) };
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  return { ok: false, status: 0, error: "unreachable" };
}

/** Small models sometimes wrap JSON in prose or code fences; take the outermost object. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const attempts = [text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // try next
    }
  }
  return null;
}

export function llmUnavailableMessage(status: number) {
  if (status === 0) return "ยังไม่ได้ตั้งค่า ThaiLLM หรือเชื่อมต่อไม่ได้ จึงค้นหาด้วยคำที่คุณกรอกโดยตรง";
  if (status === 401 || status === 403) return "ThaiLLM ปฏิเสธ API Key กรุณาตรวจสอบ THAILLM_API_KEY";
  if (status === 404) return "ไม่พบรุ่นโมเดลที่ตั้งไว้ใน THAILLM_MODEL";
  if (status === 429 || status === 503) return "ThaiLLM มีผู้ใช้งานจำนวนมาก ลองแล้ว 3 ครั้ง จึงค้นหาด้วยคำเดิม";
  return "ThaiLLM ติดต่อไม่ได้ จึงค้นหาด้วยคำที่คุณกรอกโดยตรง";
}
