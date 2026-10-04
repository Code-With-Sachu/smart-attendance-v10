import { NextResponse } from "next/server";

/**
 * Fetches a Google Sheet (or a spreadsheet stored in Google Drive) server-side so the
 * browser can parse it without CORS issues. Only Google hosts are allowed.
 * The sheet must be shared as "Anyone with the link → Viewer" (or published to the web).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

function exportUrl(raw: string): { url: string; format: "xlsx" | "csv" } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.hostname === "docs.google.com") {
    // Published to the web: /spreadsheets/d/e/<pubId>/pubhtml
    const pub = u.pathname.match(/^\/spreadsheets\/d\/e\/([\w-]+)/);
    if (pub) return { url: `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=xlsx`, format: "xlsx" };
    const m = u.pathname.match(/^\/spreadsheets\/d\/([\w-]{20,})/);
    if (m) return { url: `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`, format: "xlsx" };
    return null;
  }
  if (u.hostname === "drive.google.com") {
    const id = u.pathname.match(/\/file\/d\/([\w-]{20,})/)?.[1] ?? u.searchParams.get("id");
    if (id && /^[\w-]{20,}$/.test(id)) return { url: `https://drive.google.com/uc?export=download&id=${id}`, format: "xlsx" };
  }
  return null;
}

export async function GET(req: Request) {
  const target = exportUrl(new URL(req.url).searchParams.get("url") ?? "");
  if (!target) return NextResponse.json({ error: "That doesn’t look like a Google Sheets link." }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(target.url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(15000) });
  } catch {
    return NextResponse.json({ error: "Google Sheets didn’t respond. Try again in a moment." }, { status: 502 });
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html")) {
    return NextResponse.json(
      { error: "This sheet isn’t shared publicly. In Google Sheets choose Share → General access → “Anyone with the link” (Viewer), or download it as .xlsx and upload the file." },
      { status: 403 },
    );
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: "That sheet is larger than 10 MB." }, { status: 413 });

  const disposition = res.headers.get("content-disposition") ?? "";
  const title = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? disposition.match(/filename="([^"]+)"/i)?.[1] ?? "Google Sheet";
  return new NextResponse(buf, {
    headers: {
      "content-type": type || "application/octet-stream",
      "x-sheet-title": encodeURIComponent(decodeURIComponent(title).replace(/\.(xlsx|csv)$/i, "")),
      "cache-control": "no-store",
    },
  });
}
