"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Logo } from "./logo";
import { NavList } from "./sidebar";

export function MobileNavigation({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in lg:hidden" />
        <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-[300px] flex-col bg-card shadow-pop focus:outline-none data-[state=open]:animate-slide-in-left lg:hidden">
          <D.Title className="sr-only">Navigation</D.Title>
          <D.Description className="sr-only">Move between sections of the app</D.Description>
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Logo />
            <D.Close aria-label="Close menu" className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-slate-100">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <NavList onNavigate={() => onOpenChange(false)} />
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
