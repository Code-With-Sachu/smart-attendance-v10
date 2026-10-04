"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { chat, useChat, type Pos } from "@/lib/ai/chat";
import { ChatPanel } from "./chat-panel";
import { cn } from "@/lib/utils";

const SIZE = 56;
const MARGIN = 12;
const HEADER_OFFSET = 76; // default: just below the 64px top bar, top-right corner
const PANEL_W = 400;

function defaultPos(): Pos {
  return { x: window.innerWidth - SIZE - 16, y: HEADER_OFFSET };
}

function clamp(p: Pos): Pos {
  return {
    x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - SIZE - MARGIN),
    y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - SIZE - MARGIN),
  };
}

/**
 * Floating AI agent, available on every page to everyone. Drag the bubble (or the chat
 * header) anywhere; the position is remembered. Double-click the bubble to reset it to the
 * top-right corner.
 */
export function FloatingAgent() {
  const data = useAppData();
  const state = useChat();
  const path = usePathname();
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<Pos>({ x: 0, y: HEADER_OFFSET });
  const [vw, setVw] = React.useState(1024);
  const [vh, setVh] = React.useState(768);
  const drag = React.useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  React.useEffect(() => {
    setMounted(true);
    const sync = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      setPos((p) => clamp(p));
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Apply the saved position (or the default top-right corner).
  React.useEffect(() => {
    if (!mounted) return;
    setPos(clamp(state.pos ?? defaultPos()));
  }, [state.pos, mounted]);

  React.useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && chat.setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setPos(clamp({ x: d.ox + dx, y: d.oy + dy }));
  };
  const endDrag = (clickToggles: boolean) => (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!d) return;
    if (d.moved) chat.setPos(clamp({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
    else if (clickToggles) chat.toggle();
  };

  if (!mounted || !data || !data.settings.assistantEnabled || path === "/assistant") return null;

  const mobile = vw < 640;
  const panelW = Math.min(PANEL_W, vw - 2 * MARGIN);
  const right = pos.x + SIZE / 2 > vw / 2;
  const spaceBelow = vh - (pos.y + SIZE + 8) - MARGIN;
  const spaceAbove = pos.y - 8 - MARGIN;
  const ideal = Math.min(620, vh - 2 * MARGIN);
  let panelStyle: React.CSSProperties = {};
  if (!mobile) {
    if (Math.max(spaceAbove, spaceBelow) >= Math.min(ideal, 420)) {
      // Open above or below the bubble, whichever has more room.
      const below = spaceBelow >= spaceAbove;
      const h = Math.min(ideal, below ? spaceBelow : spaceAbove);
      panelStyle = {
        width: panelW,
        height: h,
        left: Math.min(Math.max(MARGIN, right ? pos.x + SIZE - panelW : pos.x), vw - panelW - MARGIN),
        top: below ? pos.y + SIZE + 8 : pos.y - 8 - h,
      };
    } else {
      // Not enough vertical room: open beside the bubble.
      const h = ideal;
      const left = right ? pos.x - 8 - panelW : pos.x + SIZE + 8;
      panelStyle = {
        width: panelW,
        height: h,
        left: Math.min(Math.max(MARGIN, left), vw - panelW - MARGIN),
        top: Math.min(Math.max(MARGIN, pos.y + SIZE / 2 - h / 2), vh - h - MARGIN),
      };
    }
  }

  return (
    <>
      {state.open && (
        <div
          role="dialog"
          aria-label={`${data.settings.assistantName} chat`}
          style={panelStyle}
          className={cn(
            "fixed z-[45] flex flex-col overflow-hidden border border-border bg-card shadow-[0_24px_60px_-12px_rgb(var(--shadow)/0.35)] animate-scale-in",
            mobile ? "inset-0 rounded-none pt-[env(safe-area-inset-top)]" : "rounded-2xl",
          )}
        >
          <ChatPanel
            variant="floating"
            onClose={() => chat.setOpen(false)}
            headerProps={mobile ? undefined : { onPointerDown, onPointerMove, onPointerUp: endDrag(false), onPointerCancel: endDrag(false) }}
          />
        </div>
      )}

      {!(mobile && state.open) && (
        <button
          type="button"
          aria-label={state.open ? "Close AI assistant" : `Open ${data.settings.assistantName} (drag to move)`}
          aria-expanded={state.open}
          title="AI Assistant — drag to move, double-click to reset"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag(true)}
          onPointerCancel={endDrag(false)}
          onDoubleClick={() => chat.setPos(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              chat.toggle();
            }
          }}
          style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
          className={cn(
            "print-hide group fixed z-[46] grid touch-none select-none place-items-center rounded-full text-white shadow-[0_10px_30px_-6px_rgb(79_70_229/0.55)] ring-4 ring-white/70 transition-transform hover:scale-105 active:scale-95 dark:ring-white/10",
            "bg-gradient-to-br from-primary via-indigo-500 to-violet-500",
          )}
        >
          {state.open ? <X className="size-6" aria-hidden /> : <Bot className="size-7" aria-hidden />}
          {!state.open && state.busy && <span className="absolute -right-0.5 -top-0.5 size-3.5 animate-pulse rounded-full border-2 border-white bg-amber-400" aria-hidden />}
          {!state.open && !state.busy && <span className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full border-2 border-white bg-success" aria-hidden />}
        </button>
      )}
    </>
  );
}
