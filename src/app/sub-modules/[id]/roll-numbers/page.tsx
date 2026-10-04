"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClipboardCheck, FolderX } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RollNumberManager } from "@/components/modules/roll-number-manager";

export default function RollNumbersPage() {
  const { id } = useParams<{ id: string }>();
  const data = useAppData();
  const router = useRouter();
  if (!data) return null;
  const sub = data.subModules.find((s) => s.id === id);
  if (!sub) return <EmptyState icon={FolderX} title="Sub module not found" description="It may have been deleted." action={<Button onClick={() => router.push("/sub-modules")}>Back to Sub Modules</Button>} />;
  const main = data.mainModules.find((m) => m.id === sub.mainModuleId);

  return (
    <>
      <PageHeader
        back={{ href: `/sub-modules/${sub.id}`, label: sub.name }}
        eyebrow={`${main?.name ?? ""} / ${sub.name}`}
        title="Manage Roll Numbers"
        actions={
          sub.rollNumbers.length > 0 && (
            <Button asChild>
              <Link href={`/attendance/${sub.id}`}>
                <ClipboardCheck /> Take Attendance
              </Link>
            </Button>
          )
        }
      />
      <RollNumberManager sub={sub} studentLists={data.studentLists} />
    </>
  );
}
