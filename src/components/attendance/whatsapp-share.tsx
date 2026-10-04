"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Download, Loader2, Mail, MessageCircle, MessageSquareText, Printer, Send, Settings2, Share2, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { buildAttendanceMessage, recordCsv, SEND_MODE_LABEL, whatsappLink } from "@/lib/whatsapp";
import { downloadText, messageOptionsFor, safeFileName } from "@/lib/report";
import type { AttendanceRecord, AppData, WhatsAppContact } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Helpers shared with the Review (apply) page                         */
/* ------------------------------------------------------------------ */

let cloudStatus: Promise<boolean> | null = null;
/** Whether the server has WhatsApp Cloud API credentials (sends to all numbers at once). */
export function whatsappCloudConfigured(): Promise<boolean> {
  if (!cloudStatus)
    cloudStatus = fetch("/api/whatsapp")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((j: { configured?: boolean }) => !!j.configured)
      .catch(() => false);
  return cloudStatus;
}

export function useWhatsAppCloud() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    whatsappCloudConfigured().then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

/** Send to every contact at the same moment through the server (Cloud API). */
export async function sendToAllViaCloud(contacts: WhatsAppContact[], messageFor: (c: WhatsAppContact) => string) {
  const res = await fetch("/api/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: contacts.map((c) => ({ to: c.number, text: messageFor(c) })) }),
  });
  const json = (await res.json().catch(() => ({}))) as { results?: { to: string; ok: boolean; error?: string }[]; error?: string };
  if (!res.ok || !json.results) throw new Error(json.error ?? "Sending failed.");
  return json.results;
}

/**
 * Open a WhatsApp chat for every contact in one tap. Browsers allow this only when pop-ups
 * are permitted for the site; returns how many tabs were blocked.
 */
export function openAllChats(contacts: WhatsAppContact[], messageFor: (c: WhatsAppContact) => string): { opened: string[]; blocked: number } {
  const opened: string[] = [];
  let blocked = 0;
  contacts.forEach((c, i) => {
    const w = window.open(whatsappLink(messageFor(c), c.number), i === 0 ? "_blank" : `wa_${c.id}`);
    if (w) opened.push(c.id);
    else blocked++;
  });
  return { opened, blocked };
}

/** System share sheet (any app) with a graceful fallback. Returns false when unsupported. */
export async function systemShare(title: string, text: string, csv?: { name: string; content: string }): Promise<"shared" | "cancelled" | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.share) return "unsupported";
  try {
    if (csv && navigator.canShare) {
      const file = new File(["﻿" + csv.content], csv.name, { type: "text/csv" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return "shared";
      }
    }
    await navigator.share({ title, text });
    return "shared";
  } catch (err) {
    return (err as Error)?.name === "AbortError" ? "cancelled" : "unsupported";
  }
}

/* ------------------------------------------------------------------ */
/* Share sheet fallback                                                */
/* ------------------------------------------------------------------ */

export function ShareSheet({ open, onOpenChange, title, text, csv }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; text: string; csv?: { name: string; content: string } }) {
  const enc = encodeURIComponent;
  const plain = text.replace(/\*/g, "").replace(/_/g, "");
  const options = [
    { label: "WhatsApp", icon: MessageCircle, href: whatsappLink(text), cls: "text-[#1FAF38]" },
    { label: "Telegram", icon: Send, href: `https://t.me/share/url?url=${enc(" ")}&text=${enc(plain)}`, cls: "text-sky-500" },
    { label: "Email", icon: Mail, href: `mailto:?subject=${enc(title)}&body=${enc(plain)}`, cls: "text-primary" },
    { label: "SMS", icon: MessageSquareText, href: `sms:?&body=${enc(plain)}`, cls: "text-success" },
  ];
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Report copied");
    } catch {
      toast.error("Couldn’t copy — select the text and copy it manually.");
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Share report" description="Choose an app, copy the text or download a file.">
      <div className="grid grid-cols-4 gap-2">
        {options.map((o) => (
          <a key={o.label} href={o.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-xs font-medium text-ink hover:bg-slate-50">
            <o.icon className={cn("size-5", o.cls)} aria-hidden />
            {o.label}
          </a>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" onClick={copy}><Copy /> Copy</Button>
        {csv && <Button variant="secondary" size="sm" onClick={() => downloadText(csv.content, csv.name, "text/csv;charset=utf-8")}><Download /> CSV</Button>}
        <Button variant="secondary" size="sm" onClick={() => downloadText(plain, `${csv?.name.replace(/\.csv$/, "") ?? "report"}.txt`)}><Download /> Text</Button>
      </div>
      <details className="mt-4 rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink">Preview message</summary>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border px-3 py-2 font-sans text-xs text-ink-muted">{text}</pre>
      </details>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

/**
 * Share the absent / present lists. With saved numbers, "Send to all" reaches every number
 * at once (Cloud API when configured, otherwise one tap opens every chat). A Share button
 * offers any other app via the system share sheet.
 */
export function WhatsAppShare({ record, data, compact, rates, autoOpenSheet }: { record: AttendanceRecord; data: AppData; compact?: boolean; rates?: Record<number, number | null>; autoOpenSheet?: boolean }) {
  const contacts = data.settings.whatsappContacts ?? [];
  const cloud = useWhatsAppCloud();
  const [sent, setSent] = React.useState<Set<string>>(() => new Set());
  const [busy, setBusy] = React.useState(false);
  const [sheet, setSheet] = React.useState(!!autoOpenSheet);

  const messageFor = React.useCallback((c?: WhatsAppContact) => buildAttendanceMessage(record, messageOptionsFor(data, record, c?.send ?? "both", rates)), [record, data, rates]);
  const fullMessage = messageFor();
  const title = `Attendance · ${record.subModuleName} · ${record.date}`;
  const csv = { name: `${safeFileName(`attendance-${record.subModuleName}-${record.date}-p${record.session}`)}.csv`, content: recordCsv(record, rates ?? messageOptionsFor(data, record).rates) };

  const markSent = (ids: string[]) => setSent((s) => new Set([...s, ...ids]));
  const nextIdx = contacts.findIndex((c) => !sent.has(c.id));
  const allSent = contacts.length > 0 && nextIdx === -1;

  async function sendAll() {
    if (allSent) return setSent(new Set());
    if (cloud) {
      setBusy(true);
      try {
        const results = await sendToAllViaCloud(contacts, messageFor);
        const okIds = contacts.filter((c) => results.find((r) => r.to === c.number)?.ok).map((c) => c.id);
        markSent(okIds);
        const failed = results.filter((r) => !r.ok);
        if (!failed.length) toast.success(`Sent to all ${results.length} numbers`);
        else toast.warning(`Sent to ${okIds.length} of ${results.length}`, { description: failed.map((f) => `${f.to}: ${f.error}`).join("\n") });
      } catch (err) {
        toast.error("Couldn’t send through WhatsApp API", { description: (err as Error).message });
      } finally {
        setBusy(false);
      }
      return;
    }
    const pending = contacts.filter((c) => !sent.has(c.id));
    if (pending.length === 1 || sent.size > 0) {
      window.open(whatsappLink(messageFor(pending[0]), pending[0]!.number), "_blank", "noopener,noreferrer");
      return markSent([pending[0]!.id]);
    }
    const { opened, blocked } = openAllChats(pending, messageFor);
    markSent(opened);
    if (blocked) toast.message(`Opened ${opened.length} of ${pending.length} chats`, { description: "Your browser blocked the other pop-ups. Allow pop-ups for this site to open all chats at once, or tap “Send to next”." });
    else toast.success(`Opened ${opened.length} WhatsApp chats — press send in each`);
  }

  async function share() {
    const r = await systemShare(title, fullMessage, csv);
    if (r === "unsupported") setSheet(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullMessage);
      toast.success("Report copied to clipboard");
    } catch {
      toast.error("Couldn’t copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="space-y-3">
      {contacts.length > 0 ? (
        <>
          <Button variant="whatsapp" size={compact ? "md" : "lg"} className="w-full" onClick={sendAll} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : allSent ? <Check /> : cloud ? <Zap /> : <Users />}
            {busy
              ? "Sending…"
              : allSent
                ? "Sent to everyone · send again"
                : contacts.length === 1
                  ? `WhatsApp ${contacts[0]!.label || contacts[0]!.number}`
                  : sent.size === 0
                    ? `WhatsApp all ${contacts.length} numbers${cloud ? " at once" : ""}`
                    : `Send to next (${nextIdx + 1} of ${contacts.length})`}
          </Button>
          {!cloud && contacts.length > 1 && !allSent && (
            <p className="text-xs text-ink-muted">One tap opens every chat (allow pop-ups if asked). Press send in each chat.</p>
          )}

          <ul className="divide-y divide-border rounded-lg border border-border">
            {contacts.map((c) => {
              const done = sent.has(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", done ? "bg-success-soft text-success" : "bg-slate-100 text-ink-muted")}>
                    {done ? <Check className="size-3.5" aria-label="Sent" /> : <MessageCircle className="size-3.5" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{c.label || c.number}</p>
                    <p className="truncate text-xs text-ink-muted tabular">
                      {c.label ? `${c.number} · ` : ""}
                      {SEND_MODE_LABEL[c.send]}
                    </p>
                  </div>
                  <Button size="sm" variant={done ? "ghost" : "secondary"} asChild>
                    <a href={whatsappLink(messageFor(c), c.number)} target="_blank" rel="noopener noreferrer" onClick={() => markSent([c.id])} aria-label={`Send to ${c.label || c.number}`}>
                      <Send /> {done ? "Resend" : "Send"}
                    </a>
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <Button variant="whatsapp" size={compact ? "md" : "lg"} className="w-full" asChild>
          <a href={whatsappLink(fullMessage)} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Share on WhatsApp
          </a>
        </Button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="md" onClick={share}>
          <Share2 /> Share
        </Button>
        <Button variant="secondary" size="md" onClick={copy}>
          <Copy /> Copy
        </Button>
        <Button variant="secondary" size="md" onClick={() => downloadText(csv.content, csv.name, "text/csv;charset=utf-8")}>
          <Download /> CSV
        </Button>
        <Button variant="secondary" size="md" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      </div>
      {contacts.length > 0 && (
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <a href={whatsappLink(fullMessage)} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Pick another WhatsApp chat
          </a>
        </Button>
      )}

      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-muted">Preview message</summary>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-border px-3 py-2 font-sans text-xs text-ink">{fullMessage}</pre>
      </details>

      <p className="text-xs text-ink-muted">
        {cloud ? "Messages go straight from your WhatsApp Business number. " : contacts.length ? "You confirm each message in WhatsApp before it sends. " : "Save numbers in Profile to send to all of them in one tap. "}
        <Link href="/profile#whatsapp" className="inline-flex items-center gap-1 font-medium text-primary-ink hover:underline">
          <Settings2 className="size-3" aria-hidden /> {contacts.length ? "Manage numbers" : "Add WhatsApp numbers"}
        </Link>
      </p>
      <ShareSheet open={sheet} onOpenChange={setSheet} title={title} text={fullMessage} csv={csv} />
    </div>
  );
}
