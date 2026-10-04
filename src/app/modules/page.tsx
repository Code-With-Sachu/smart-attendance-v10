"use client";

import * as React from "react";
import { FolderPlus, Folders, SearchX } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput, useDebounced, matches } from "@/components/ui/search";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MainModuleCard } from "@/components/modules/main-module-card";
import { useModuleActions } from "@/components/modules/module-actions";
import { sortedMainModules } from "@/lib/store/selectors";

export default function MainModulesPage() {
  const data = useAppData();
  const a = useModuleActions();
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q);
  if (!data) return null;
  const list = sortedMainModules(data).filter((m) => !dq.trim() || matches(m.name, dq));

  return (
    <>
      <PageHeader
        title="Main Modules"
        description="Classes or groups. Each one holds its own sub modules."
        actions={
          <Button onClick={a.createMain}>
            <FolderPlus /> Create Main Module
          </Button>
        }
      />
      {data.mainModules.length > 0 && (
        <SearchInput className="mb-5 max-w-md" value={q} onChange={setQ} placeholder="Search main modules…" label="Search main modules" />
      )}
      {data.mainModules.length === 0 ? (
        <EmptyState icon={Folders} title="No Main Modules Yet" description="Create your first module to start managing attendance." action={<Button onClick={a.createMain}><FolderPlus /> Create Main Module</Button>} />
      ) : list.length === 0 ? (
        <EmptyState compact icon={SearchX} title="No main modules found" description={`Nothing matches “${dq.trim()}”.`} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <MainModuleCard key={m.id} mod={m} data={data} />
          ))}
        </div>
      )}
    </>
  );
}
