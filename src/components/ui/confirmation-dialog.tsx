"use client";

import * as React from "react";
import * as A from "@radix-ui/react-alert-dialog";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "./button";
import { cn } from "@/lib/utils";

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  /** Called only when the Cancel button itself is pressed. */
  onCancel?: () => void;
  busy?: boolean;
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <A.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-5 shadow-pop focus:outline-none data-[state=open]:animate-scale-in">
          <div className="flex gap-3">
            {destructive && (
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                <TriangleAlert className="size-5" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <A.Title className="text-base font-semibold text-ink">{title}</A.Title>
              <A.Description asChild>
                <div className="mt-1.5 text-sm text-ink-muted">{description}</div>
              </A.Description>
            </div>
          </div>
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <A.Cancel onClick={onCancel} className={buttonVariants({ variant: "secondary" })}>{cancelLabel}</A.Cancel>
            <A.Action
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              className={cn(buttonVariants({ variant: destructive ? "danger" : "primary" }))}
            >
              {confirmLabel}
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
