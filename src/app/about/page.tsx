import Link from "next/link";
import { CheckCircle2, Keyboard, ShieldCheck, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LogoMark } from "@/components/layout/logo";

export const metadata = { title: "About" };

const STEPS = [
  ["Create a Main Module", "A class or group such as CSE S3."],
  ["Add Sub Modules", "Subjects inside the class, such as Data Structures."],
  ["Add students", "Upload the class list (Excel, Google Sheet, PDF…) or generate roll numbers."],
  ["Take attendance", "Everyone starts present — tap only the absentees."],
  ["Apply & review", "Check the Absent and Present lists with each student’s overall %."],
  ["Submit & share", "Submit, then send to all WhatsApp numbers at once or share with any app."],
  ["Track history", "Attendance History shows every session and every student’s subject-wise %."],
  ["Ask the AI assistant", "Type or speak — it knows the app, your data and your uploaded files."],
];

const TIPS = [
  { icon: Keyboard, title: "Keyboard friendly", text: "Arrow keys move across the grid; Space or Enter toggles. Quick entry accepts “3, 8, 20-24”." },
  { icon: ShieldCheck, title: "Safe by design", text: "Confirmation before submitting or deleting, duplicate-session protection, and auto-saved drafts if the page reloads." },
  { icon: Smartphone, title: "Built for phones", text: "Large tap targets, a sticky header and a sticky submit bar — no pinch-zooming." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader title="About" description="How Smart Attendance works." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <LogoMark className="size-10" />
            <div>
              <h2 className="font-semibold text-ink">Smart Attendance</h2>
              <p className="text-sm text-ink-muted">Version 1.0</p>
            </div>
          </div>
          <ol className="mt-6 space-y-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink tabular">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-ink">{t}</p>
                  <p className="text-sm text-ink-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-5">
          {TIPS.map((t) => (
            <Card key={t.title} className="flex gap-3 p-5">
              <t.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
                <p className="mt-0.5 text-sm text-ink-muted">{t.text}</p>
              </div>
            </Card>
          ))}
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CheckCircle2 className="size-4 text-success" aria-hidden /> Where your data lives
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              This version keeps everything in your browser on this device. Download a backup from{" "}
              <Link href="/profile" className="font-medium text-primary-ink hover:underline">Profile</Link>. Accounts and cloud sync arrive in the next version.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
