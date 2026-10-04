"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { Button } from "@/components/ui/button";

/** Pages that have their own sticky Back / Apply / Submit bar. */
const HIDDEN = [/^\/attendance\/[^/]+/];

/**
 * Back / Next buttons at the end of every section. Back returns to the previous page
 * (or the previous section when there is no history); Next moves to the next section in
 * the menu order.
 */
export function SectionPager() {
  const path = usePathname();
  const router = useRouter();
  if (HIDDEN.some((r) => r.test(path))) return null;

  const idx = Math.max(0, NAV_ITEMS.findIndex((n) => n.match(path)));
  const prev = NAV_ITEMS[(idx - 1 + NAV_ITEMS.length) % NAV_ITEMS.length]!;
  const next = NAV_ITEMS[(idx + 1) % NAV_ITEMS.length]!;

  function back() {
    if (window.history.length > 1) router.back();
    else router.push(prev.href);
  }

  return (
    <nav aria-label="Section navigation" className="mt-12 flex items-center justify-between gap-3 border-t border-border pt-5 print:hidden">
      <Button variant="secondary" onClick={back} aria-label="Go back">
        <ArrowLeft /> Back
      </Button>
      <Button asChild>
        <Link href={next.href} aria-label={`Next section: ${next.label}`}>
          <span className="hidden opacity-80 sm:inline">Next ·</span> {next.label} <ArrowRight />
        </Link>
      </Button>
    </nav>
  );
}
