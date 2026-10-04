"use client";

import * as React from "react";
import { RollNumberButton } from "./roll-number-button";
import { formatRoll, rollWidth } from "@/lib/format";

/**
 * Responsive grid of roll-number toggles.
 * Keyboard: arrow keys move focus (roving tabindex), Space/Enter toggles, Home/End jump.
 */
export function RollNumberGrid({ rolls, names, absent, onToggle }: { rolls: number[]; names?: Record<number, string>; absent: Set<number>; onToggle: (roll: number) => void }) {
  const withNames = !!names && Object.keys(names).length > 0;
  const ref = React.useRef<HTMLDivElement>(null);
  const [focusRoll, setFocusRoll] = React.useState<number | undefined>(rolls[0]);
  const width = rollWidth(rolls);

  const columns = () => {
    const btns = ref.current?.querySelectorAll<HTMLButtonElement>("button[data-roll]");
    if (!btns || btns.length === 0) return 1;
    const top = btns[0]!.offsetTop;
    let c = 0;
    for (const b of btns) {
      if (b.offsetTop !== top) break;
      c++;
    }
    return Math.max(1, c);
  };

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, roll: number) => {
      const i = rolls.indexOf(roll);
      let next = i;
      switch (e.key) {
        case "ArrowRight": next = i + 1; break;
        case "ArrowLeft": next = i - 1; break;
        case "ArrowDown": next = i + columns(); break;
        case "ArrowUp": next = i - columns(); break;
        case "Home": next = 0; break;
        case "End": next = rolls.length - 1; break;
        default: return;
      }
      e.preventDefault();
      next = Math.min(rolls.length - 1, Math.max(0, next));
      const target = rolls[next]!;
      setFocusRoll(target);
      ref.current?.querySelector<HTMLButtonElement>(`button[data-roll="${target}"]`)?.focus();
    },
    [rolls],
  );

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Roll numbers. Tap a number to mark the student absent; tap again to mark present."
      className={withNames ? "grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:gap-2.5" : "grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(76px,1fr))] sm:gap-2.5"}
    >
      {rolls.map((n) => (
        <RollNumberButton
          key={n}
          roll={n}
          label={formatRoll(n, width)}
          name={withNames ? (names?.[n] ?? "") : undefined}
          absent={absent.has(n)}
          onToggle={(r) => {
            setFocusRoll(r);
            onToggle(r);
          }}
          tabIndex={n === (focusRoll ?? rolls[0]) ? 0 : -1}
          onKeyDown={onKeyDown}
        />
      ))}
    </div>
  );
}
