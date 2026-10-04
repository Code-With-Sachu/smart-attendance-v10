"use client";

import * as React from "react";
import Link from "next/link";
import { FolderOpen, SearchX, FolderPlus } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput, useDebounced, matches } from "@/components/ui/search";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ColorDot } from "@/components/ui/card";
import { SubModuleCard } from "@/components/modules/sub-module-card";
import { useModuleActions } from "@/components/modules/module-actions";
import { sortedMainModules, subModulesOf } from "@/lib/store/selectors";

export default function SubModulesPage() {
  const data = useAppData();
  const a = useModuleActions();
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q);
  if (!data) return null;

  const groups = sortedMainModules(data)
    .map((m) => ({ main: m, subs: subModulesOf(data, m.id).filter((s) => !dq.trim() || matches(s.name, dq)) }))
    .filter((g) => !dq.trim() || g.subs.length > 0);
  const total = data.subModules.length;

  return (
    <>
      <PageHeader title="Sub Modules" description="Subjects inside each main module." />
      {total > 0 && <SearchInput className="mb-6 max-w-md" value={q} onChange={setQ} placeholder="Search sub modules…" label="Search sub modules" />}
      {data.mainModules.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No Main Modules Yet" description="Sub modules live inside a main module. Create one first." action={<Button onClick={a.createMain}><FolderPlus /> Create Main Module</Button>} />
      ) : groups.length === 0 ? (
        <EmptyState compact icon={SearchX} title="No sub modules found" description={`Nothing matches “${dq.trim()}”.`} />
      ) : (
        <div className="space-y-8">
          {groups.map(({ main, subs }) => (
            <section key={main.id} aria-labelledby={`g-${main.id}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id={`g-${main.id}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ColorDot color={main.color} />
                  <Link href={`/modules/${main.id}`} className="hover:underline">{main.name}</Link>
                  <span className="font-normal text-ink-muted">· {subs.length}</span>
                </h2>
                <Button variant="ghost" size="sm" onClick={() => a.createSub(main.id)}>
                  <FolderPlus /> Add
                </Button>
              </div>
              {subs.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {subs.map((s) => (
                    <SubModuleCard key={s.id} sub={s} data={data} />
                  ))}
                </div>
              ) : (
                <EmptyState compact icon={FolderOpen} title="No Sub Modules" description="Create a subject or sub module inside this module." action={<Button size="sm" onClick={() => a.createSub(main.id)}><FolderPlus /> Create Sub Module</Button>} />
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
