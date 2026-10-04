/**
 * AI assistant endpoint (Google Gemini). The browser sends the conversation plus a text
 * snapshot of the relevant app data and file contents; the reply is streamed back as text.
 *
 *   GEMINI_API_KEY   required to enable the AI model (without it the app uses its offline helper)
 *   GEMINI_MODEL     optional, default "gemini-flash-latest"
 *   AGENT_RATE_LIMIT optional, requests per IP per 10 minutes (default 40)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CONTEXT = 500_000;
const MAX_ATTACH_BYTES = 3_500_000;

type Msg = { role: "user" | "assistant"; content: string };
type Attachment = { mime: string; data: string; name: string };

const model = () => process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
const key = () => process.env.GEMINI_API_KEY?.trim();

// Best-effort per-instance rate limit — the site has no login, so protect the API key.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const max = Number(process.env.AGENT_RATE_LIMIT) || 40;
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

export async function GET() {
  return Response.json({ provider: key() ? "gemini" : "offline", model: key() ? model() : null });
}

function systemPrompt(name: string, context: string) {
  return `You are "${name}", the built-in AI assistant of the Smart Attendance website (a free attendance tool for teachers; no login).

Your jobs:
1. Explain how to use the website and each section, step by step, using the APP GUIDE.
2. Answer questions about classes, subjects, students and attendance using ONLY the DATA below (percentages, absent/present dates, periods/times, sessions).
3. Read, summarise, compare and analyse the user's uploaded files (Profile files and sub module files) included below, and cross-reference them with attendance data when useful.

Rules:
- Be accurate. Never invent students, numbers, dates or file content. If something is not in the data, say so and suggest where to add it.
- Do arithmetic carefully; percentages = present ÷ total classes × 100, one decimal.
- Be concise and well-formatted (Markdown: short paragraphs, bullet lists, tables for lists of students). Mention the file name when you use a file.
- Link to pages with Markdown links using the internal paths given in the data (e.g. [Open report](/history/student?main=...&roll=...)), never invent paths.
- Reply in the same language the user writes or speaks (English, Malayalam, Hindi, etc.).
- When asked to draft a message (e.g. to parents or HOD), write it ready to send.
- You cannot change data yourself; tell the user exactly which button to press.

==================== DATA ====================
${context}
==================== END DATA ====================`;
}

export async function POST(req: Request) {
  if (!key()) return Response.json({ error: "offline" }, { status: 501 });
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]!.trim();
  if (limited(ip)) return Response.json({ error: "Too many requests — wait a few minutes." }, { status: 429 });

  let body: { messages?: Msg[]; context?: string; attachments?: Attachment[]; assistantName?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const messages = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-12);
  if (!messages.length || messages[messages.length - 1]!.role !== "user") return Response.json({ error: "No question." }, { status: 400 });
  const context = String(body.context ?? "").slice(0, MAX_CONTEXT);

  let attachBytes = 0;
  const attachments = (body.attachments ?? []).filter((a) => {
    if (!a?.data || !/^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(a.mime)) return false;
    attachBytes += a.data.length * 0.75;
    return attachBytes <= MAX_ATTACH_BYTES;
  });

  const contents = messages.map((m, i) => {
    const parts: Record<string, unknown>[] = [{ text: m.content.slice(0, 20_000) }];
    if (i === messages.length - 1) for (const a of attachments) parts.push({ text: `[Attached file: ${a.name}]` }, { inline_data: { mime_type: a.mime, data: a.data } });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });

  let upstream: Response;
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key()! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(String(body.assistantName ?? "Attendance Assistant").slice(0, 40), context) }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    return Response.json({ error: "The AI service didn’t respond." }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("[agent] Gemini error", upstream.status, detail.slice(0, 500));
    const msg = upstream.status === 429 ? "The AI quota is used up for now." : upstream.status === 400 || upstream.status === 404 ? "The AI model rejected the request (check GEMINI_MODEL)." : upstream.status === 403 ? "The Gemini API key is invalid or not allowed." : "The AI service returned an error.";
    return Response.json({ error: msg }, { status: 502 });
  }

  // Convert Gemini's SSE into a plain text stream.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            try {
              const json = JSON.parse(line.slice(5).trim()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
              const text = json.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              /* partial line */
            }
          }
        }
      } catch (err) {
        console.error("[agent] stream error", err);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-ai-model": model() } });
}
