import { Bot, ClipboardCheck, FolderOpen, Folders, History, House, Info, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  /** Visual group divider before this item. */
  groupStart?: boolean;
}

/** Order here is also the order of the Back / Next section buttons. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/profile", label: "Profile", icon: UserRound, match: (p) => p.startsWith("/profile") },
  { href: "/", label: "Home", icon: House, match: (p) => p === "/", groupStart: true },
  { href: "/modules", label: "Main Modules", icon: Folders, match: (p) => p.startsWith("/modules") },
  { href: "/sub-modules", label: "Sub Modules", icon: FolderOpen, match: (p) => p.startsWith("/sub-modules") },
  { href: "/attendance", label: "Take Attendance", icon: ClipboardCheck, match: (p) => p.startsWith("/attendance") },
  { href: "/history", label: "Attendance History", icon: History, match: (p) => p.startsWith("/history") },
  { href: "/assistant", label: "AI Assistant", icon: Bot, match: (p) => p.startsWith("/assistant"), groupStart: true },
  { href: "/admin", label: "Admin", icon: ShieldCheck, match: (p) => p.startsWith("/admin") },
  { href: "/about", label: "About", icon: Info, match: (p) => p.startsWith("/about") },
];
