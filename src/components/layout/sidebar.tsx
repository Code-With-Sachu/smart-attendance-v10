"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "./logo";
import { NAV_ITEMS } from "./nav-items";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item, i) => {
        const active = item.match(pathname);
        return (
          <div key={item.href}>
            {item.groupStart && i > 0 && <div className="my-2 h-px bg-border" aria-hidden />}
            <Tooltip content={item.label} disabled={!collapsed}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-primary-soft text-primary-ink" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-ink-subtle group-hover:text-ink-muted")} aria-hidden />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </Tooltip>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/" aria-label="Smart Attendance home">
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <div className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-3" : "px-3")}>
        <NavList collapsed={collapsed} />
      </div>
      <div className={cn("border-t border-border p-3", collapsed && "flex justify-center")}>
        <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-ink-muted hover:bg-slate-100 hover:text-ink", collapsed && "w-10 justify-center px-0")}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && "Collapse"}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
