"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClipboardCheck, FolderPlus, FolderX, Hash, History, Pencil, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, ColorDot } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MoreMenu } from "@/components/ui/dropdown";
import { useModuleActions } from "@/components/modules/module-actions";
import { StatTiles, AttendanceTrend, PerStudentTable } from "@/components/attendance/sub-module-stats";
import { studentNames } from "@/lib/names";
import { RecordRow } from "@/components/attendance/record-row";
import { recordsOfSub, subModuleStats } from "@/lib/store/selectors";
import { FileManager } from "@/components/files/file-manager";

export default function SubModuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useAppData();
  const router = useRouter();
  const a = useModuleActions();
  if (!data) return null;
  const sub = data.subModules.find((s) => s.id === id);
  if (!sub) return <EmptyState icon={FolderX} title="Sub module not found" description="It may have been deleted." action={<Button onClick={() => router.push("/sub-modules")}>Back to Sub Modules</Button>} />;
  const main = data.mainModules.find((m) => m.id === sub.mainModuleId);
  const stats = subModuleStats(data, sub);
  const records = recordsOfSub(data, sub.id);
  const hasRolls = sub.rollNumbers.length > 0;
  const filesCard = (
    <FileManager
      id="files"
      owner={{ kind: "sub", subModuleId: sub.id }}
      title={`${sub.name} files`}
      description="Notes, question papers, lab lists, marks… Upload several files at once, then open any file to edit it. The AI assistant can read them."
      className="mt-6"
    />
  );

  return (
    <>
      <PageHeader
        back={main ? { href: `/modules/${main.id}`, label: main.name } : { href: "/sub-modules", label: "Sub Modules" }}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <ColorDot color={sub.color} /> Sub Module #{sub.number} · {sub.rollNumbers.length} students
          </span>
        }
        title={sub.name}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={`/sub-modules/${sub.id}/roll-numbers`}>
                <Hash /> Roll Numbers
              </Link>
            </Button>
            {hasRolls && (
              <Button asChild>
                <Link href={`/attendance/${sub.id}`}>
                  <ClipboardCheck /> Take Attendance
                </Link>
              </Button>
            )}
            <div className="grid place-items-center rounded-lg border border-border bg-card">
              <MoreMenu
                label={`More actions for ${sub.name}`}
                items={[
                  { label: "Edit", icon: Pencil, onSelect: () => a.editSub(sub) },
                  { label: "Attendance History", icon: History, onSelect: () => router.push(`/history?sub=${sub.id}`) },
                  { label: "Create Sub Module", icon: FolderPlus, onSelect: () => a.createSub(sub.mainModuleId) },
                  { label: "Delete", icon: Trash2, onSelect: () => a.deleteSub(sub), destructive: true, separatorBefore: true },
                ]}
              />
            </div>
          </>
        }
      />

      {!hasRolls ? (
        <EmptyState
          icon={Hash}
          title="Add roll numbers to begin"
          description="Set up the class list once — for example roll numbers 1 to 37 — and you can start taking attendance."
          action={
            <Button asChild>
              <Link href={`/sub-modules/${sub.id}/roll-numbers`}>
                <Hash /> Upload Students
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <StatTiles stats={stats} />
          {records.length === 0 ? (
            <EmptyState compact icon={History} title="No Attendance Records" description="Attendance records will appear here after you submit your first session." action={<Button asChild><Link href={`/attendance/${sub.id}`}><ClipboardCheck /> Take Attendance</Link></Button>} />
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <AttendanceTrend records={records} />
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4">
                    <h3 className="text-sm font-semibold text-ink">Recent sessions</h3>
                    <Link href={`/history?sub=${sub.id}`} className="text-sm font-medium text-primary-ink hover:underline">View all</Link>
                  </div>
                  <div className="divide-y divide-border border-t border-border">
                    {records.slice(0, 5).map((r) => (
                      <RecordRow key={r.id} r={r} showModule={false} />
                    ))}
                  </div>
                </Card>
              </div>
              <PerStudentTable stats={stats} names={studentNames(sub.students)} />
            </>
          )}
        </div>
      )}
      {filesCard}
    </>
  );
}
