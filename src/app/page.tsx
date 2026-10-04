"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Bot, ClipboardCheck, FolderPlus, Folders, SearchX, TriangleAlert, Users, History as HistoryIcon, Percent } from "lucide-react";
import { chat } from "@/lib/ai/chat";
import { mainOptionsWithHistory, recordRate, studentReportsForMain } from "@/lib/store/selectors";
import { formatRoll, percent } from "@/lib/format";
import { useAppData } from "@/lib/store/hooks";
import { SearchInput, useDebounced, matches } from "@/components/ui/search";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MainModuleCard } from "@/components/modules/main-module-card";
import { SubModuleCard } from "@/components/modules/sub-module-card";
import { useModuleActions } from "@/components/modules/module-actions";
import { byNewest, byNumber, sortedMainModules } from "@/lib/store/selectors";
import { formatLongDate, greeting, relativeDay, todayISO, formatTime } from "@/lib/format";

export default function HomePage() {
  const data = useAppData();
  const a = useModuleActions();
  const [mainQ, setMainQ] = React.useState("");
  const [subQ, setSubQ] = React.useState("");
  const mq = useDebounced(mainQ);
  const sq = useDebounced(subQ);

  if (!data) return null;

  const mains = sortedMainModules(data).filter((m) => !mq.trim() || matches(m.name, mq));
  const subs = sq.trim() ? data.subModules.filter((s) => matches(s.name, sq)).sort(byNumber) : [];
  const recent = [...data.records].sort(byNewest).slice(0, 4);
  const today = todayISO();
  const todayCount = data.records.filter((r) => r.date === today).length;
  const name = data.profile.name.split(" ")[0];
  const low = data.settings.lowThreshold;
  const reports = mainOptionsWithHistory(data).flatMap((m) => studentReportsForMain(data, m.id));
  const atRisk = reports.filter((r) => r.rate !== null && r.rate * 100 < low).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));
  const avg = data.records.length ? data.records.reduce((sum, r) => sum + recordRate(r), 0) / data.records.length : null;
  const kpis = [
    { label: "Students", value: String(new Set(data.subModules.flatMap((x) => x.rollNumbers.map((n) => `${x.mainModuleId}:${n}`))).size), icon: Users, href: "/history?view=students" },
    { label: "Sessions recorded", value: String(data.records.length), icon: HistoryIcon, href: "/history" },
    { label: "Average attendance", value: avg === null ? "—" : percent(avg, 1), icon: Percent, href: "/history" },
    { label: `Below ${low}%`, value: String(atRisk.length), icon: TriangleAlert, href: "/history?view=students", warn: atRisk.length > 0 },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-ink-muted" suppressHydrationWarning>{formatLongDate(today)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl" suppressHydrationWarning>
          {greeting()}{name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {todayCount > 0 ? `You’ve recorded ${todayCount} attendance session${todayCount === 1 ? "" : "s"} today.` : "Ready for class? Pick a module to take attendance."}
        </p>
      </section>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className={`rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-pop ${k.warn ? "border-danger/30" : "border-border"}`}>
            <k.icon className={`size-4 ${k.warn ? "text-danger" : "text-primary"}`} aria-hidden />
            <p className="mt-2 text-xs font-medium text-ink-muted">{k.label}</p>
            <p className={`mt-0.5 text-2xl font-semibold tabular ${k.warn ? "text-danger" : "text-ink"}`}>{k.value}</p>
          </Link>
        ))}
      </section>

      {atRisk.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Students below {low}%</h2>
            <Link href="/history?view=students" className="inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
              All students <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {atRisk.slice(0, 12).map((r) => (
              <Link key={`${r.mainModuleId}-${r.roll}`} href={`/history/student?main=${r.mainModuleId}&roll=${r.roll}`} className="min-w-[160px] rounded-xl border border-danger/25 bg-danger-soft/50 px-3 py-2.5 hover:bg-danger-soft">
                <p className="truncate text-sm font-medium text-ink">{r.name || `Roll ${formatRoll(r.roll)}`}</p>
                <p className="text-xs text-ink-muted">{r.mainName} · Roll {formatRoll(r.roll)}</p>
                <p className="mt-1 text-lg font-semibold text-danger tabular">{percent(r.rate!, 1)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <button type="button" onClick={() => chat.setOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary-soft to-card px-4 py-3 text-left transition-shadow hover:shadow-pop">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-white"><Bot className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">Ask the AI assistant</span>
          <span className="block truncate text-xs text-ink-muted">“Who was absent today?” · “Anu’s attendance” · “Summarise my syllabus file” — type or speak</span>
        </span>
        <ArrowRight className="size-4 text-ink-subtle" aria-hidden />
      </button>

      <section className="grid gap-3 md:grid-cols-2" aria-label="Search">
        <SearchInput size="lg" value={mainQ} onChange={setMainQ} placeholder="Search main modules…" label="Search main modules" />
        <SearchInput size="lg" value={subQ} onChange={setSubQ} placeholder="Search sub modules…" label="Search sub modules" />
      </section>

      {sq.trim() && (
        <section aria-live="polite">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Sub modules matching “{sq.trim()}” <span className="font-normal text-ink-muted">· {subs.length}</span>
          </h2>
          {subs.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subs.map((s) => (
                <SubModuleCard key={s.id} sub={s} data={data} showParent />
              ))}
            </div>
          ) : (
            <EmptyState compact icon={SearchX} title="No sub modules found" description="Try a shorter or different name." />
          )}
        </section>
      )}

      <section aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">
            Main Modules <span className="font-normal text-ink-muted">· {mains.length}</span>
          </h2>
          <Button size="sm" onClick={a.createMain}>
            <FolderPlus /> Create Main Module
          </Button>
        </div>
        {data.mainModules.length === 0 ? (
          <EmptyState
            icon={Folders}
            title="No Main Modules Yet"
            description="Create your first module to start managing attendance."
            action={
              <Button onClick={a.createMain}>
                <FolderPlus /> Create Main Module
              </Button>
            }
          />
        ) : mains.length === 0 ? (
          <EmptyState compact icon={SearchX} title="No main modules found" description={`Nothing matches “${mq.trim()}”.`} action={<Button variant="secondary" size="sm" onClick={() => setMainQ("")}>Clear search</Button>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mains.map((m) => (
              <MainModuleCard key={m.id} mod={m} data={data} />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Recent attendance</h2>
            <Link href="/history" className="inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <Card className="divide-y divide-border">
            {recent.map((r) => (
              <Link key={r.id} href={`/history/${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <ClipboardCheck className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{r.subModuleName}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {r.mainModuleName} · {relativeDay(r.date)} · {formatTime(r.takenAt)}{r.session > 1 ? ` · Session ${r.session}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs tabular">
                  <p className="font-medium text-ink">{r.present.length} present</p>
                  <p className="text-absent-strong">{r.absent.length} absent</p>
                </div>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
