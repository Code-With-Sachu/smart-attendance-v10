"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderTree, Hand, History, ListChecks } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { toast } from "sonner";

const FEATURES = [
  { icon: FolderTree, title: "Organise classes", text: "Main modules for classes, sub modules for subjects." },
  { icon: Hand, title: "Tap only the absentees", text: "Everyone starts present. One tap marks absent." },
  { icon: ListChecks, title: "Review before saving", text: "Check both lists, then confirm and submit." },
  { icon: History, title: "Keep every record", text: "Browse history and share reports on WhatsApp." },
];

const STEPS = ["Create a class", "Add a subject", "Set roll numbers", "Tap absentees", "Review & submit"];

export default function WelcomePage() {
  const data = useAppData();
  const router = useRouter();
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    if (data?.profile.name) setName(data.profile.name);
  }, [data?.profile.name]);

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() && data) {
      const r = store.updateProfile({ ...data.profile, name });
      if (!r.ok) return toast.error(r.error);
    }
    const r = store.updateSettings({ onboarded: true });
    if (!r.ok) return toast.error(r.error);
    router.replace("/");
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.10),transparent_60%)]" />
      <ThemeToggle className="absolute right-4 top-4 z-10" />
      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-5 py-12">
        <div className="animate-fade-in">
          <LogoMark className="size-12" />
          <p className="mt-6 text-sm font-medium text-primary-ink">Welcome to</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Smart Attendance</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-muted">
            A fast and simple attendance management workspace for teachers.
          </p>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Create classes, organise subjects, mark attendance, review results, and share attendance reports.
          </p>

          <ol className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink-muted" aria-label="How it works">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full border border-border bg-card text-xs font-semibold text-ink tabular">{i + 1}</span>
                <span className="text-ink">{s}</span>
                {i < STEPS.length - 1 && <ArrowRight className="size-3.5 text-ink-subtle" aria-hidden />}
              </li>
            ))}
          </ol>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <f.icon className="size-[18px]" aria-hidden />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink">{f.title}</h2>
                  <p className="mt-0.5 text-sm text-ink-muted">{f.text}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={start} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 sm:max-w-xs">
              <label htmlFor="teacher-name" className="mb-1.5 block text-sm font-medium text-ink">
                What should we call you? <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <Input id="teacher-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sachu" autoComplete="name" maxLength={60} />
            </div>
            <Button type="submit" size="lg" disabled={!data}>
              Get Started <ArrowRight />
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
