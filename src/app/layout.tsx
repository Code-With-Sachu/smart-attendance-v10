import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemedToaster } from "@/components/theme/theme-toggle";
import { themeInitScript } from "@/lib/theme-script";
import { FloatingAgent } from "@/components/ai/floating-agent";

export const metadata: Metadata = {
  title: { default: "Smart Attendance", template: "%s · Smart Attendance" },
  description: "A fast and simple attendance management workspace for teachers.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { color: "#F8FAFC" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <TooltipProvider delayDuration={250}>
          <AppShell>{children}</AppShell>
          <FloatingAgent />
        </TooltipProvider>
        <ThemedToaster />
      </body>
    </html>
  );
}
