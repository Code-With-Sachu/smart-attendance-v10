"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { store } from "@/lib/store/store";
import { WhatsAppContacts } from "./whatsapp-contacts";
import { ThemeSwitch } from "@/components/theme/theme-toggle";
import { todayISO } from "@/lib/format";
import type { AppData } from "@/lib/types";

export function SettingsPanel({ data }: { data: AppData }) {
  const router = useRouter();
  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `smart-attendance-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="space-y-5">
      <WhatsAppContacts contacts={data.settings.whatsappContacts} />

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink">Appearance</h2>
        <p className="mt-1 text-sm text-ink-muted">Choose light or dark mode. You can also use the sun/moon button in the top bar.</p>
        <div className="mt-4">
          <ThemeSwitch />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink">Attendance rules</h2>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={data.settings.allowDuplicateSessions}
            onChange={(e) => {
              const r = store.updateSettings({ allowDuplicateSessions: e.target.checked });
              if (!r.ok) toast.error(r.error);
            }}
          />
          <span>
            <span className="block text-sm font-medium text-ink">Allow duplicate records</span>
            <span className="block text-sm text-ink-muted">Off by default. When off, a subject can have only one record per date and session.</span>
          </span>
        </label>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink">Data on this device</h2>
        <p className="mt-1 text-sm text-ink-muted">
          In this version your modules and attendance are stored in this browser. Download a backup regularly — clearing browser data removes them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportBackup}>
            <Download /> Download backup (JSON)
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              store.updateSettings({ onboarded: false });
              router.push("/welcome");
            }}
          >
            <RotateCcw /> Show welcome screen again
          </Button>
        </div>
      </Card>
    </div>
  );
}
