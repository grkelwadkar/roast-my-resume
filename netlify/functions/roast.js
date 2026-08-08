// netlify/functions/roast.js
import { connectLambda, getStore } from "@netlify/blobs";

const LIMIT = 5; // max roasts
const WINDOW_MS = 60 * 60 * 1000; // per 1 hour, per IP

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const ip =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    "unknown";

  try {
    connectLambda(event);

    // --- Rate limit check ---
    const store = getStore("rate-limits");
    const key = `roast:${ip}`;
    const now = Date.now();

    const existing = await store.get(key, { type: "json" });
    let timestamps = Array.isArray(existing) ? existing : [];
    timestamps = timestamps.filter((t) => now - t < WINDOW_MS);

    if (timestamps.length >= LIMIT) {
      const retryAfterMs = WINDOW_MS - (now - timestamps[0]);
      const retryMinutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
      return {
        statusCode: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
        body: JSON.stringify({
          error: `Too many roasts from this device. Try again in ${retryMinutes} minute${
            retryMinutes === 1 ? "" : "s"
          }.`,
        }),
      };
    }

    // --- Parse & validate body ---
    const { resumeText } = JSON.parse(event.body);

    if (!resumeText || resumeText.trim().split(/\s+/).length < 30) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Resume text too short" }),
      };
    }

    if (resumeText.length > 20000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Resume text too long" }),
      };
    }

    // Reserve this request against the rate limit BEFORE calling the API,
    // so a burst of simultaneous requests can't slip past the check above.
    timestamps.push(now);
    await store.set(key, JSON.stringify(timestamps));

    const prompt = buildPrompt(resumeText);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || "API error" }),
      };
    }

    const textBlocks = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const cleaned = textBlocks.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

function buildPrompt(resumeText) {
  return `You are a veteran hiring manager and technical recruiter with a sharp, funny, slightly savage sense of humor — think a witty senior engineer who has read ten thousand resumes and lost patience for fluff, but still genuinely wants people to get hired. You are grading a resume like a teacher marking an exam paper: brutal in the margins, but fair, and always leaving one real, specific, actionable fix.

Rules:
- Be specific to THIS resume. Quote or closely reference actual phrases, sections, or omissions from the text below. Never write a generic roast that could apply to any resume.
- Funny and sharp, not cruel. No insults about the person, only about resume choices (vague bullet points, buzzwords, weak structure, missing numbers, etc).
- Keep every line short and punchy — these get read as captions on a phone screen.
- The "fix" must be one concrete, doable action referencing something specific in their resume (e.g. rewrite a specific bullet, not "add more detail").
- The "strength" must be a genuine, specific positive — not generic flattery.

Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this shape:
{
  "score": <integer 0-100>,
  "verdict": "<a punchy 2-4 word verdict label>",
  "roastLines": ["<roast line 1>", "<roast line 2>", "<roast line 3>"],
  "redFlag": "<the single biggest problem, one sharp sentence>",
  "strength": "<one genuine specific strength, one sentence>",
  "fix": "<one concrete actionable fix referencing specific resume content, 1-2 sentences>"
}

Resume text:
"""
${resumeText}
"""`;
}
