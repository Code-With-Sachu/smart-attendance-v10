"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, FileX, House, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { RollList } from "@/components/attendance/roll-list";
import { WhatsAppShare } from "@/components/attendance/whatsapp-share";
import { formatLongDate, formatTime, percent } from "@/lib/format";
import { recordNames } from "@/lib/names";
import { rollRatesForSub } from "@/lib/store/selectors";
import { parseISODate } from "@/lib/format";

function DetailInner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const submitted = sp.get("submitted");
  const autoShare = sp.get("share") === "1";
  const data = useAppData();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  if (!data) return null;

  const r = data.records.find((x) => x.id === id);
  if (!r) return <EmptyState icon={FileX} title="Record not found" description="It may have been deleted." action={<Button asChild><Link href="/history">Back to Attendance History</Link></Button>} />;

  const subExists = data.subModules.some((s) => s.id === r.subModuleId);
  const total = r.rollNumbers.length;
  const names = recordNames(r);
  const rates = rollRatesForSub(data, r.subModuleId, { upTo: r });
  const low = data.settings.lowThreshold;
  const d = parseISODate(r.date);
  const lowCount = r.rollNumbers.filter((n) => rates[n] != null && rates[n]! < low / 100).length;

  const details = [
    { label: "Date", value: formatLongDate(r.date) },
    { label: "Day", value: d.toLocaleDateString("en-GB", { weekday: "long" }) },
    { label: "Year", value: String(d.getFullYear()) },
    { label: "Time", value: formatTime(r.takenAt) },
    { label: "Period / Session", value: String(r.session) },
    { label: "Main Module", value: r.mainModuleName },
    { label: "Sub Module", value: r.subModuleName },
    { label: "Total Students", value: String(total) },
    { label: "Present", value: String(r.present.length) },
    { label: "Absent", value: String(r.absent.length) },
    { label: "Attendance", value: percent(r.present.length, total) },
    { label: `Below ${low}% overall`, value: String(lowCount) },
  ];

  const shareCard = (
    <Card className={submitted ? "border-[#1FAF38]/40 p-5 ring-1 ring-[#1FAF38]/20" : "p-5"}>
      <h2 className="mb-3 text-sm font-semibold text-ink">{submitted ? "Send the absent & present lists" : "Share report"}</h2>
      <WhatsAppShare record={r} data={data} compact rates={rates} autoOpenSheet={autoShare} />
    </Card>
  );

  return (
    <>
      {submitted && (
        <div role="status" className="mb-6 flex flex-col gap-4 rounded-xl border border-success/30 bg-success-soft p-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <CircleCheck className="size-7 shrink-0 text-success" aria-hidden />
            <div>
              <p className="font-semibold text-success-ink">{submitted === "edited" ? "Attendance updated" : "Attendance submitted successfully"}</p>
              <p className="text-sm text-success-ink/80">Saved on this device. Send the lists on WhatsApp below or head back home.</p>
            </div>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/"><House /> Back to Home</Link>
          </Button>
        </div>
      )}

      <PageHeader
        back={{ href: "/history", label: "Attendance History" }}
        title="Attendance Details"
        description={`${r.mainModuleName} / ${r.subModuleName}`}
        actions={
          <>
            {subExists && (
              <Button variant="secondary" asChild>
                <Link href={`/attendance/${r.subModuleId}?edit=${r.id}`}><Pencil /> Edit</Link>
              </Button>
            )}
            <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          {submitted && shareCard}
          <Card className="p-5">
            <dl className="space-y-3">
              {details.map((d) => (
                <div key={d.label} className="flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                  <dt className="text-sm text-ink-muted">{d.label}</dt>
                  <dd className="text-right text-sm font-medium text-ink tabular">{d.value}</dd>
                </div>
              ))}
            </dl>
            {r.editCount > 0 && <p className="mt-4 text-xs text-ink-subtle">Edited {r.editCount}× · last change {formatLongDate(r.updatedAt.slice(0, 10))} {formatTime(r.updatedAt)}</p>}
          </Card>
          {!submitted && shareCard}
        </div>

        <div className="space-y-5">
          <p className="text-xs text-ink-muted">% = each student’s overall attendance in {r.subModuleName} up to this session. Tap a student in Attendance History → Students for their full report.</p>
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-absent-ink">
              <UserX className="size-4" aria-hidden /> Absent Students — {r.absent.length}
            </h2>
            <RollList rolls={r.absent} all={r.rollNumbers} variant="absent" names={names} rates={rates} lowThreshold={low} emptyText="No absentees." />
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <UserCheck className="size-4" aria-hidden /> Present Students — {r.present.length}
            </h2>
            <RollList rolls={r.present} all={r.rollNumbers} variant="present" names={names} rates={rates} lowThreshold={low} emptyText="No one was present." />
          </Card>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Delete this attendance record?"
        description={`${r.subModuleName} on ${formatLongDate(r.date)} will be permanently removed from history. This can’t be undone.`}
        confirmLabel="Delete record"
        onConfirm={() => {
          const res = store.deleteAttendance(r.id);
          if (res.ok) {
            toast.success("Attendance record deleted");
            router.replace("/history");
          } else toast.error(res.error);
        }}
      />
    </>
  );
}

export default function AttendanceDetailPage() {
  return (
    <Suspense>
      <DetailInner />
    </Suspense>
  );
}
