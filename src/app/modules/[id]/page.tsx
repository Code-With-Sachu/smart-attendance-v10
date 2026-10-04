"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ClipboardCheck, Copy, FolderPlus, FolderOpen, FolderX, Pencil, Trash2, SearchX } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MoreMenu } from "@/components/ui/dropdown";
import { SearchInput, useDebounced, matches } from "@/components/ui/search";
import { SubModuleCard } from "@/components/modules/sub-module-card";
import { useModuleActions } from "@/components/modules/module-actions";
import { ColorDot } from "@/components/ui/card";
import { studentCountForMain, subModulesOf } from "@/lib/store/selectors";
import { pluralize } from "@/lib/utils";

export default function MainModuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useAppData();
  const router = useRouter();
  const a = useModuleActions();
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q);
  if (!data) return null;

  const mod = data.mainModules.find((m) => m.id === id);
  if (!mod)
    return (
      <EmptyState icon={FolderX} title="Module not found" description="It may have been deleted." action={<Button onClick={() => router.push("/modules")}>Back to Main Modules</Button>} />
    );

  const subs = subModulesOf(data, mod.id);
  const list = subs.filter((s) => !dq.trim() || matches(s.name, dq));

  return (
    <>
      <PageHeader
        back={{ href: "/", label: "Home" }}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <ColorDot color={mod.color} /> Main Module #{mod.number}
          </span>
        }
        title={mod.name}
        description={`${pluralize(subs.length, "sub module")} · ${pluralize(studentCountForMain(data, mod.id), "student")}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => a.createSub(mod.id)}>
              <FolderPlus /> Create Sub Module
            </Button>
            {subs.length > 0 && (
              <Button onClick={() => a.takeAttendanceForMain(mod)}>
                <ClipboardCheck /> Take Attendance
              </Button>
            )}
            <div className="grid place-items-center rounded-lg border border-border bg-card">
              <MoreMenu
                label={`More actions for ${mod.name}`}
                items={[
                  { label: "Edit", icon: Pencil, onSelect: () => a.editMain(mod) },
                  { label: "Duplicate", icon: Copy, onSelect: () => a.duplicateMain(mod) },
                  { label: "Delete", icon: Trash2, onSelect: () => a.deleteMain(mod), destructive: true, separatorBefore: true },
                ]}
              />
            </div>
          </>
        }
      />
      {subs.length > 3 && <SearchInput className="mb-5 max-w-md" value={q} onChange={setQ} placeholder="Search sub modules…" label="Search sub modules" />}
      {subs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No Sub Modules"
          description="Create a subject or sub module inside this module."
          action={
            <Button onClick={() => a.createSub(mod.id)}>
              <FolderPlus /> Create Sub Module
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState compact icon={SearchX} title="No sub modules found" description={`Nothing matches “${dq.trim()}”.`} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <SubModuleCard key={s.id} sub={s} data={data} />
          ))}
        </div>
      )}
    </>
  );
}
