import { NextResponse } from "next/server";

/**
 * Optional: send the attendance report to every saved number AT THE SAME TIME through the
 * WhatsApp Business Cloud API (Meta). Without these env vars the app falls back to wa.me
 * links, which open one chat per tap.
 *
 *   WHATSAPP_TOKEN            permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID  the sender phone-number ID from Meta's WhatsApp Manager
 *   WHATSAPP_API_VERSION      optional, default v23.0
 *
 * Note: Meta only delivers free-form text to people who messaged your business number in the
 * last 24 hours; otherwise an approved template is required (error 131047 is reported back).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const token = () => process.env.WHATSAPP_TOKEN?.trim();
const phoneId = () => process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

export async function GET() {
  return NextResponse.json({ configured: Boolean(token() && phoneId()) });
}

interface OutMessage {
  to: string;
  text: string;
}

export async function POST(req: Request) {
  if (!token() || !phoneId()) return NextResponse.json({ error: "WhatsApp Cloud API is not configured on the server." }, { status: 501 });
  let body: { messages?: OutMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const messages = (body.messages ?? []).slice(0, 20).filter((m) => typeof m?.to === "string" && typeof m?.text === "string");
  if (!messages.length) return NextResponse.json({ error: "No messages to send." }, { status: 400 });

  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v23.0";
  const url = `https://graph.facebook.com/${version}/${phoneId()}/messages`;

  const results = await Promise.all(
    messages.map(async (m) => {
      const to = m.to.replace(/\D/g, "");
      if (to.length < 8 || to.length > 15) return { to: m.to, ok: false, error: "Invalid number" };
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: m.text.slice(0, 4096) } }),
          signal: AbortSignal.timeout(15000),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } };
        if (!res.ok) {
          const code = json.error?.code;
          const msg = code === 131047 ? "Outside the 24-hour window — this number must message you first (or use a template)." : json.error?.message ?? `HTTP ${res.status}`;
          return { to: m.to, ok: false, error: msg };
        }
        return { to: m.to, ok: true };
      } catch {
        return { to: m.to, ok: false, error: "WhatsApp didn’t respond." };
      }
    }),
  );
  return NextResponse.json({ results });
}
