import { cn } from "@/lib/utils";

export function Avatar({ name, photo, className }: { name: string; photo: string | null; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "T";
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" className={cn("size-9 rounded-full object-cover ring-1 ring-border", className)} />
  ) : (
    <span aria-hidden className={cn("grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-ink ring-1 ring-primary/20", className)}>
      {initials}
    </span>
  );
}
