"use client";

import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { EllipsisVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
  disabled?: boolean;
}

export function MoreMenu({ items, label }: { items: MenuItem[]; label: string }) {
  return (
    <M.Root modal={false}>
      <M.Trigger
        aria-label={label}
        className="grid size-8 place-items-center rounded-md text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink data-[state=open]:bg-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <EllipsisVertical className="size-4" />
      </M.Trigger>
      <M.Portal>
        <M.Content
          align="end"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-50 min-w-[200px] rounded-xl border border-border bg-card p-1 shadow-pop data-[state=open]:animate-scale-in"
        >
          {items.map((item) => (
            <React.Fragment key={item.label}>
              {item.separatorBefore && <M.Separator className="my-1 h-px bg-border" />}
              <M.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  item.destructive ? "text-danger data-[highlighted]:bg-danger-soft" : "text-ink data-[highlighted]:bg-slate-100",
                )}
              >
                <item.icon className="size-4 opacity-80" aria-hidden />
                {item.label}
              </M.Item>
            </React.Fragment>
          ))}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
