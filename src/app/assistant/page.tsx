"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Database, FileText, GraduationCap, Mic, Move, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { useFiles } from "@/lib/files/store";
import { chat, useChat } from "@/lib/ai/chat";
import { VOICE_LANGS } from "@/lib/ai/speech";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/components/ai/chat-panel";

export default function AssistantPage() {
  const data = useAppData();
  const files = useFiles();
  const state = useChat();
  if (!data) return null;
  const s = data.settings;
  const profileFiles = (files ?? []).filter((f) => f.owner.kind === "profile").length;
  const subFiles = (files ?? []).length - profileFiles;

  const set = (patch: Parameters<typeof store.updateAdminSettings>[0]) => {
    const r = store.updateAdminSettings(patch);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <>
      <PageHeader title="AI Assistant" description="Ask about any section, any student or any uploaded file — by typing or by voice." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="h-[calc(100dvh-15rem)] min-h-[480px] overflow-hidden p-0">
          <ChatPanel variant="page" />
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">What it can read</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <Source icon={BookOpen} label="How to use every section" value="Built-in guide" />
              <Source icon={GraduationCap} label="Classes & students" value={`${data.mainModules.length} classes · ${data.subModules.length} subjects`} />
              <Source icon={Database} label="Attendance History" value={`${data.records.length} sessions`} />
              <Source icon={FileText} label="Profile files" value={String(profileFiles)} href="/profile#files" />
              <Source icon={FileText} label="Sub module files" value={String(subFiles)} href="/sub-modules" />
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Assistant settings</h2>
            <div className="mt-3 space-y-3 text-sm">
              <label className="flex items-center justify-between gap-3">
                <span className="text-ink">Floating assistant on every page</span>
                <input type="checkbox" className="size-4 accent-primary" checked={s.assistantEnabled} onChange={(e) => set({ assistantEnabled: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-ink">Read replies aloud</span>
                <input type="checkbox" className="size-4 accent-primary" checked={s.assistantVoiceReplies} onChange={(e) => set({ assistantVoiceReplies: e.target.checked })} />
              </label>
              <div className="space-y-1">
                <label htmlFor="as-lang" className="text-xs font-medium text-ink-muted">Voice language</label>
                <select id="as-lang" value={s.assistantLang} onChange={(e) => set({ assistantLang: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm text-ink">
                  {VOICE_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" size="sm" className="w-full" onClick={() => { chat.setPos(null); toast.success("Assistant moved back to the top-right corner"); }}>
                <Move /> Reset floating position
              </Button>
            </div>
          </Card>

          <Card className="p-5 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Status</h2>
              <Button variant="ghost" size="icon-sm" aria-label="Recheck" onClick={() => chat.checkStatus(true)}><RefreshCw /></Button>
            </div>
            <p className="mt-2 text-ink-muted">
              {state.provider === "gemini" ? (
                <>Connected to Google Gemini ({state.model}).</>
              ) : (
                <>Offline helper — answers common questions from your data. Set <code className="rounded bg-slate-100 px-1 text-xs">GEMINI_API_KEY</code> on the server for full AI analysis.</>
              )}
            </p>
            <p className="mt-3 flex gap-2 text-xs text-ink-muted"><Mic className="size-3.5 shrink-0" /> Voice input works in Chrome, Edge and Safari.</p>
            <p className="mt-2 flex gap-2 text-xs text-ink-muted"><ShieldCheck className="size-3.5 shrink-0" /> When you ask a question, the relevant data and file contents are sent to the AI model to answer it.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Source({ icon: Icon, label, value, href }: { icon: typeof FileText; label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-3.5" aria-hidden /></span>
      <span className="flex-1 text-ink">{label}</span>
      <span className="text-xs text-ink-muted tabular">{value}</span>
    </>
  );
  return <li>{href ? <Link href={href} className="flex items-center gap-2.5 hover:underline">{body}</Link> : <div className="flex items-center gap-2.5">{body}</div>}</li>;
}
