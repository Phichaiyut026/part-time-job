export const GEMINI_MODEL = "gemini-3.6-flash";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export async function requestGemini(apiKey: string, body: unknown) {
  let response: Response | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!RETRYABLE_STATUSES.has(response.status) || attempt === 2) return response;
    await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
  }

  return response as Response;
}

export function geminiUnavailableMessage(status: number) {
  if (status === 401 || status === 403) return "Gemini ปฏิเสธ API Key กรุณาตรวจสอบ GEMINI_API_KEY";
  if (status === 404) return "รุ่น Gemini ที่ตั้งค่าไว้ไม่พร้อมใช้งาน";
  if (status === 429 || status === 503) return "Gemini มีผู้ใช้งานจำนวนมาก ระบบลองให้แล้ว 3 ครั้ง จึงค้นหาด้วยคำเดิม";
  return "Gemini ติดต่อไม่ได้ จึงค้นหาด้วยคำที่คุณกรอกโดยตรง";
}
