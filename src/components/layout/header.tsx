"use client";

import Link from "next/link";
import { Menu, ClipboardCheck, Bot } from "lucide-react";
import { chat, useChat } from "@/lib/ai/chat";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar } from "./avatar";
import { LogoMark } from "./logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { formatLongDate, todayISO } from "@/lib/format";
import type { Profile } from "@/lib/types";

export function Header({ profile, onMenu }: { profile: Profile | null; onMenu: () => void }) {
  const { open } = useChat();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="-ml-1 grid size-10 place-items-center rounded-lg text-ink hover:bg-slate-100 lg:hidden">
        <Menu className="size-5" />
      </button>
      <Link href="/" className="lg:hidden" aria-label="Home">
        <LogoMark className="size-7" />
      </Link>
      <p className="hidden text-sm text-ink-muted sm:block lg:block" suppressHydrationWarning>
        {formatLongDate(todayISO())}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip content="AI Assistant">
          <button
            type="button"
            onClick={() => chat.toggle()}
            aria-pressed={open}
            aria-label="Ask the AI assistant"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-soft sm:px-3"
          >
            <Bot className="size-5" aria-hidden /> <span className="hidden md:inline">Ask AI</span>
          </button>
        </Tooltip>
        <ThemeToggle />
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/attendance">
            <ClipboardCheck /> Take Attendance
          </Link>
        </Button>
        <Link href="/profile" aria-label="Your profile" className="rounded-full">
          <Avatar name={profile?.name ?? ""} photo={profile?.photo ?? null} />
        </Link>
      </div>
    </header>
  );
}
