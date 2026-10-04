"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { FolderX } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendanceReview } from "@/components/attendance/attendance-review";
import { resolveContext } from "@/lib/attendance-context";

function ReviewInner() {
  const { subId } = useParams<{ subId: string }>();
  const editId = useSearchParams().get("edit");
  const data = useAppData();
  if (!data) return null;
  const ctx = resolveContext(data, subId, editId);
  if ("error" in ctx)
    return <EmptyState icon={FolderX} title="Nothing to review" description="This class or record is no longer available." action={<Button asChild><Link href="/attendance">Choose a class</Link></Button>} />;
  return <AttendanceReview ctx={ctx} data={data} />;
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewInner />
    </Suspense>
  );
}
