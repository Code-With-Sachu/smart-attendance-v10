import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#4F46E5" />
      <rect x="7" y="7" width="5" height="5" rx="1.5" fill="#fff" opacity=".95" />
      <rect x="13.5" y="7" width="5" height="5" rx="1.5" fill="#fff" opacity=".95" />
      <rect x="20" y="7" width="5" height="5" rx="1.5" fill="#C4B5FD" />
      <rect x="7" y="13.5" width="5" height="5" rx="1.5" fill="#fff" opacity=".95" />
      <rect x="13.5" y="13.5" width="5" height="5" rx="1.5" fill="#C4B5FD" />
      <rect x="20" y="13.5" width="5" height="5" rx="1.5" fill="#fff" opacity=".95" />
      <path d="M8.5 22.5l2.6 2.6 5-5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-ink">Smart Attendance</div>
          <div className="text-[11px] text-ink-muted">Teacher workspace</div>
        </div>
      )}
    </div>
  );
}
