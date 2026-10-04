"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FolderX, Hash } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendanceTaker } from "@/components/attendance/attendance-taker";
import { resolveContext } from "@/lib/attendance-context";

function TakeAttendanceInner() {
  const { subId } = useParams<{ subId: string }>();
  const editId = useSearchParams().get("edit");
  const data = useAppData();
  if (!data) return null;
  const ctx = resolveContext(data, subId, editId);

  if ("error" in ctx) {
    if (ctx.error === "no-rolls")
      return (
        <EmptyState icon={Hash} title="No students yet" description="Upload the class’s student list (or add roll numbers) before taking attendance." action={<Button asChild><Link href={`/sub-modules/${subId}/roll-numbers`}><Hash /> Add Students</Link></Button>} />
      );
    return <EmptyState icon={FolderX} title={ctx.error === "missing-record" ? "Record not found" : "Sub module not found"} description="It may have been deleted." action={<Button asChild><Link href="/attendance">Choose a class</Link></Button>} />;
  }
  return <AttendanceTaker key={`${ctx.subModuleId}-${editId ?? "new"}`} ctx={ctx} />;
}

export default function TakeAttendancePage() {
  return (
    <Suspense>
      <TakeAttendanceInner />
    </Suspense>
  );
}
