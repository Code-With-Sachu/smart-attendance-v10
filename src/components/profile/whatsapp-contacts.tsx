"use client";

import * as React from "react";
import { MessageCircle, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { store } from "@/lib/store/store";
import { uid } from "@/lib/utils";
import { validateWhatsAppNumber } from "@/lib/validation";
import { SEND_MODE_LABEL } from "@/lib/whatsapp";
import type { WhatsAppContact, WhatsAppSendMode } from "@/lib/types";

const MAX_CONTACTS = 20;
const blank = (): WhatsAppContact => ({ id: uid("wa"), label: "", number: "", send: "both" });

export function WhatsAppContacts({ contacts }: { contacts: WhatsAppContact[] }) {
  const [rows, setRows] = React.useState<WhatsAppContact[]>(() => (contacts.length ? contacts : []));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const savedJson = JSON.stringify(contacts);
  const dirty = JSON.stringify(rows) !== savedJson;

  // Pick up changes made elsewhere (e.g. another tab) when there are no local edits.
  React.useEffect(() => {
    if (!dirty) setRows(contacts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedJson]);

  function patch(id: string, p: Partial<WhatsAppContact>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: "" }));
  }

  function add() {
    if (rows.length >= MAX_CONTACTS) return toast.error(`You can save up to ${MAX_CONTACTS} numbers.`);
    const row = blank();
    setRows((rs) => [...rs, row]);
    requestAnimationFrame(() => document.getElementById(`wa-num-${row.id}`)?.focus());
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const seen = new Map<string, string>();
    for (const r of rows) {
      const digits = r.number.replace(/\D/g, "");
      if (!r.number.trim()) errs[r.id] = "Enter a number or remove this row.";
      else {
        const err = validateWhatsAppNumber(r.number);
        if (err) errs[r.id] = err;
        else if (seen.has(digits)) errs[r.id] = "This number is already in the list.";
      }
      seen.set(digits, r.id);
    }
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    const res = store.setWhatsAppContacts(rows);
    if (!res.ok) return toast.error(res.error);
    setRows(res.data);
    toast.success(res.data.length ? `Saved ${res.data.length} WhatsApp number${res.data.length === 1 ? "" : "s"}` : "WhatsApp numbers cleared");
  }

  return (
    <Card id="whatsapp" className="scroll-mt-24 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <MessageCircle className="size-4 text-[#1FAF38]" aria-hidden /> WhatsApp sharing
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Add every number that should get the attendance lists — HOD, class group admin, parents’ coordinator… Choose what each one receives.
      </p>

      <form onSubmit={save} noValidate className="mt-4 space-y-3">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-ink-muted">
            No numbers yet. Reports will open WhatsApp so you can pick a chat.
          </p>
        )}

        {rows.map((r, i) => (
          <fieldset key={r.id} className="rounded-lg border border-border bg-slate-50/60 p-3">
            <legend className="sr-only">WhatsApp number {i + 1}</legend>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Number {i + 1}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                className="hover:text-danger"
                aria-label={`Remove number ${i + 1}`}
                onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="mt-1 grid gap-2">
              <div>
                <label htmlFor={`wa-num-${r.id}`} className="sr-only">Phone number</label>
                <Input
                  id={`wa-num-${r.id}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={r.number}
                  onChange={(e) => patch(r.id, { number: e.target.value })}
                  placeholder="+91 98765 43210"
                  invalid={!!errors[r.id]}
                  aria-describedby={errors[r.id] ? `wa-err-${r.id}` : undefined}
                  className="tabular"
                />
                {errors[r.id] && <p id={`wa-err-${r.id}`} role="alert" className="mt-1 text-xs font-medium text-danger">{errors[r.id]}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`wa-label-${r.id}`} className="sr-only">Label</label>
                  <Input id={`wa-label-${r.id}`} value={r.label} onChange={(e) => patch(r.id, { label: e.target.value })} placeholder="Label (e.g. HOD)" maxLength={40} />
                </div>
                <div>
                  <label htmlFor={`wa-send-${r.id}`} className="sr-only">What to send</label>
                  <select
                    id={`wa-send-${r.id}`}
                    value={r.send}
                    onChange={(e) => patch(r.id, { send: e.target.value as WhatsAppSendMode })}
                    className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-ink shadow-sm"
                  >
                    {(Object.keys(SEND_MODE_LABEL) as WhatsAppSendMode[]).map((m) => (
                      <option key={m} value={m}>{SEND_MODE_LABEL[m]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={add}>
            <Plus /> Add WhatsApp Number
          </Button>
          <Button type="submit" disabled={!dirty} className="ml-auto">
            <Save /> Save numbers
          </Button>
        </div>
        <p className="text-xs text-ink-muted">Include the country code. Messages open in WhatsApp one chat at a time and you confirm each before it sends.</p>
      </form>
    </Card>
  );
}
