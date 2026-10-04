"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck2, CalendarX2, Download, MessageCircle, Share2, UserRound } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ShareSheet, systemShare } from "@/components/attendance/whatsapp-share";
import { formatLongDate, formatRoll, formatShortDate, formatTime, percent } from "@/lib/format";
import { studentReport, type StudentReport } from "@/lib/store/selectors";
import { downloadText, safeFileName } from "@/lib/report";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

function buildStudentMessage(r: StudentReport, low: number, teacher?: string) {
  const lines = [
    "📋 *STUDENT ATTENDANCE REPORT*",
    "━━━━━━━━━━━━━━━━━━",
    `👤 *Student:* ${r.name || "—"} (Roll ${formatRoll(r.roll)})`,
    `🏫 *Class:* ${r.mainName}`,
    `📊 *Overall:* ${r.rate === null ? "—" : percent(r.rate, 1)} (${r.present}/${r.total} classes)`,
    "━━━━━━━━━━━━━━━━━━",
  ];
  for (const s of r.subjects) {
    lines.push(`📘 *${s.subName}:* ${s.rate === null ? "no classes yet" : `${percent(s.rate, 1)} · ${s.present}/${s.total}`}${s.rate !== null && s.rate < low / 100 ? " ⚠️" : ""}`);
    const absents = s.sessions.filter((x) => x.status === "absent");
    if (absents.length) lines.push(`   ❌ Absent: ${absents.map((x) => `${formatShortDate(x.date)} (P${x.session})`).join(", ")}`);
  }
  lines.push("━━━━━━━━━━━━━━━━━━");
  if (teacher) lines.push(`👤 ${teacher}`);
  lines.push("_Sent via Smart Attendance_");
  return lines.join("\n");
}

function StudentInner() {
  const sp = useSearchParams();
  const main = sp.get("main") ?? "";
  const roll = Number(sp.get("roll"));
  const data = useAppData();
  const [sheet, setSheet] = React.useState(false);
  const [tab, setTab] = React.useState<"all" | "absent" | "present">("all");
  if (!data) return null;
  if (!main || !Number.isInteger(roll) || roll < 1)
    return <EmptyState icon={UserRound} title="Student not found" action={<Button asChild><Link href="/history?view=students">All students</Link></Button>} />;

  const r = studentReport(data, main, roll);
  const low = data.settings.lowThreshold;
  const message = buildStudentMessage(r, low, data.profile.name);
  const title = `Attendance · ${r.name || `Roll ${roll}`}`;

  function csv() {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = [["Subject", "Date", "Day", "Time", "Period", "Status"]];
    for (const s of r.subjects) for (const x of s.sessions) rows.push([s.subName, x.date, new Date(x.date).toLocaleDateString("en-GB", { weekday: "short" }), formatTime(x.takenAt), String(x.session), x.status === "absent" ? "Absent" : "Present"]);
    return [`Student,${esc(r.name)}`, `Roll,${roll}`, `Class,${esc(r.mainName)}`, `Overall %,${r.rate === null ? "" : (r.rate * 100).toFixed(1)}`, "", ...rows.map((x) => x.map(esc).join(","))].join("\n");
  }
  const csvFile = { name: `${safeFileName(`attendance-${r.name || roll}-${r.mainName}`)}.csv`, content: csv() };

  return (
    <>
      <PageHeader
        back={{ href: `/history?view=students&main=${encodeURIComponent(main)}`, label: "All students" }}
        eyebrow={`${r.mainName} · Roll ${formatRoll(roll)}`}
        title={r.name || `Roll ${formatRoll(roll)}`}
        description={r.details ? Object.entries(r.details).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ") : undefined}
        actions={
          <>
            <Button variant="whatsapp" asChild>
              <a href={whatsappLink(message)} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a>
            </Button>
            <Button variant="secondary" onClick={async () => (await systemShare(title, message, csvFile)) === "unsupported" && setSheet(true)}>
              <Share2 /> Share
            </Button>
            <Button variant="secondary" onClick={() => downloadText(csvFile.content, csvFile.name, "text/csv;charset=utf-8")} aria-label="Download CSV">
              <Download />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Overall attendance", value: r.rate === null ? "—" : percent(r.rate, 1), warn: r.rate !== null && r.rate < low / 100 },
          { label: "Classes attended", value: String(r.present) },
          { label: "Classes missed", value: String(r.absent) },
          { label: "Total classes", value: String(r.total) },
        ].map((t) => (
          <Card key={t.label} className={cn("p-4", t.warn && "border-danger/40 bg-danger-soft")}>
            <p className="text-xs font-medium text-ink-muted">{t.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular", t.warn ? "text-danger" : "text-ink")}>{t.value}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">Subject-wise attendance</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {r.subjects.map((s) => {
          const isLow = s.rate !== null && s.rate < low / 100;
          return (
            <Card key={s.subModuleId} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-medium text-ink">{s.subName}</p>
                <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tabular", isLow ? "bg-danger-soft text-danger" : s.rate === null ? "bg-slate-100 text-ink-muted" : "bg-success-soft text-success-ink")}>
                  {s.rate === null ? "—" : percent(s.rate, 1)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={cn("h-full rounded-full", isLow ? "bg-danger" : "bg-primary")} style={{ width: `${(s.rate ?? 0) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-ink-muted tabular">
                {s.present} present · {s.absent} absent · {s.total} classes
              </p>
            </Card>
          );
        })}
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Date-wise record</h2>
        <div role="tablist" className="inline-flex rounded-lg border border-border bg-slate-50 p-1 text-sm">
          {(["all", "absent", "present"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 font-medium capitalize", tab === t ? "bg-card text-ink shadow-sm" : "text-ink-muted")}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {r.subjects.filter((s) => s.sessions.length).map((s) => {
          const rows = s.sessions.filter((x) => tab === "all" || x.status === tab).slice().reverse();
          if (!rows.length) return null;
          return (
            <Card key={s.subModuleId} className="overflow-hidden">
              <p className="border-b border-border bg-slate-50 px-4 py-2 text-sm font-semibold text-ink">{s.subName}</p>
              <ul className="divide-y divide-border">
                {rows.map((x) => (
                  <li key={x.recordId}>
                    <Link href={`/history/${x.recordId}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                      {x.status === "absent" ? <CalendarX2 className="size-4 text-danger" aria-hidden /> : <CalendarCheck2 className="size-4 text-success" aria-hidden />}
                      <span className="flex-1 text-ink">{formatLongDate(x.date)} <span className="text-ink-muted">· {new Date(x.takenAt).toLocaleDateString("en-GB", { weekday: "short" })}</span></span>
                      <span className="text-ink-muted tabular">{formatTime(x.takenAt)} · P{x.session}</span>
                      <span className={cn("w-16 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold", x.status === "absent" ? "bg-danger-soft text-danger" : "bg-success-soft text-success-ink")}>
                        {x.status === "absent" ? "Absent" : "Present"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
        {r.total === 0 && <EmptyState compact icon={CalendarCheck2} title="No attendance recorded yet" />}
      </div>
      <ShareSheet open={sheet} onOpenChange={setSheet} title={title} text={message} csv={csvFile} />
    </>
  );
}

export default function StudentReportPage() {
  return (
    <Suspense>
      <StudentInner />
    </Suspense>
  );
}
