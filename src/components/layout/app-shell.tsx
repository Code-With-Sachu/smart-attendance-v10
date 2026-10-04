"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { MobileNavigation } from "./mobile-navigation";
import { Header } from "./header";
import { useAppData } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { Skeleton } from "@/components/ui/card";
import { ModuleActionsProvider } from "@/components/modules/module-actions";
import { SectionPager } from "./section-pager";

export function AppShell({ children }: { children: React.ReactNode }) {
  const data = useAppData();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isWelcome = pathname === "/welcome";
  const needsOnboarding = data && !data.settings.onboarded && !isWelcome;

  React.useEffect(() => {
    if (needsOnboarding) router.replace("/welcome");
  }, [needsOnboarding, router]);

  if (isWelcome) return <>{children}</>;

  if (!data || needsOnboarding) return <ShellSkeleton />;

  const collapsed = data.settings.sidebarCollapsed;

  return (
    <div className="flex min-h-dvh" style={{ ["--sidebar-w" as string]: collapsed ? "72px" : "16rem" }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => store.updateSettings({ sidebarCollapsed: !collapsed })} />
      <MobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header profile={data.profile} onMenu={() => setMobileOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <ModuleActionsProvider>{children}</ModuleActionsProvider>
          <SectionPager />
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="hidden w-64 border-r border-border bg-card p-4 lg:block">
        <Skeleton className="h-8 w-40" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-16 border-b border-border bg-card" />
        <div className="mx-auto max-w-6xl space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Renders children only once data is loaded. Pages use this to avoid null checks. */
export function WithData({ children }: { children: (d: NonNullable<ReturnType<typeof useAppData>>) => React.ReactNode }) {
  const data = useAppData();
  if (!data) return null;
  return <>{children(data)}</>;
}
