"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, ClipboardList, Eye, MessageCircle, Pencil, Plus, Send, Share2, TriangleAlert, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/dialog";
import { AttendanceSummary } from "./attendance-summary";
import { RollList } from "./roll-list";
import { draftKey, finishDraft, readLiveDraft } from "@/lib/use-attendance-draft";
import { formatLongDate, formatTime } from "@/lib/format";
import { store } from "@/lib/store/store";
import type { AppData, AttendanceDraft, AttendanceRecord } from "@/lib/types";
import { rollRatesForSub } from "@/lib/store/selectors";
import { buildAttendanceMessage, whatsappLink } from "@/lib/whatsapp";
import { messageOptionsFor } from "@/lib/report";
import { openAllChats, sendToAllViaCloud, systemShare, useWhatsAppCloud } from "./whatsapp-share";

type Intent = "submit" | "whatsapp" | "share";
import type { TakerContext } from "./attendance-taker";

export function AttendanceReview({ ctx, data }: { ctx: TakerContext; data: AppData }) {
  const allowDuplicates = data.settings.allowDuplicateSessions;
  const cloud = useWhatsAppCloud();
  const [intent, setIntent] = React.useState<Intent>("submit");
  const router = useRouter();
  const key = draftKey(ctx.subModuleId, ctx.editing?.id);
  const [draft, setDraft] = React.useState<AttendanceDraft | null | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [dup, setDup] = React.useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setDraft(readLiveDraft(key)), [key]);

  const gridHref = `/attendance/${ctx.subModuleId}${ctx.editing ? `?edit=${ctx.editing.id}` : ""}`;

  if (draft === undefined) return null;
  if (draft === null)
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nothing to review"
        description="Your selection wasn’t found. Start from the attendance grid."
        action={<Button asChild><Link href={gridHref}>Go to attendance</Link></Button>}
      />
    );

  const rollSet = new Set(ctx.rolls);
  const absent = draft.absent.filter((n) => rollSet.has(n)).sort((a, b) => a - b);
  const absentSet = new Set(absent);
  const present = ctx.rolls.filter((n) => !absentSet.has(n));
  const existing = !ctx.editing && !allowDuplicates ? store.findDuplicate(ctx.subModuleId, draft.date, draft.session) : undefined;

  const rates = rollRatesForSub(data, ctx.subModuleId, { exclude: ctx.editing?.id, extra: { rolls: ctx.rolls, absent } });
  const low = data.settings.lowThreshold;

  /** After saving: send/share straight away (still inside the user's tap, so pop-ups are allowed). */
  function afterSave(rec: AttendanceRecord, how: Intent): string {
    if (how === "submit") return "";
    const opts = (mode: "both" | "absent" | "present" = "both") => messageOptionsFor(store.getSnapshot() ?? data, rec, mode);
    if (how === "share") {
      const text = buildAttendanceMessage(rec, opts());
      void systemShare(`Attendance · ${rec.subModuleName} · ${rec.date}`, text).then((r) => {
        if (r === "unsupported") router.replace(`/history/${rec.id}?submitted=1&share=1`);
      });
      return "";
    }
    const contacts = data.settings.whatsappContacts;
    if (!contacts.length) {
      window.open(whatsappLink(buildAttendanceMessage(rec, opts())), "_blank", "noopener,noreferrer");
      return "";
    }
    const messageFor = (c: (typeof contacts)[number]) => buildAttendanceMessage(rec, opts(c.send));
    if (cloud) {
      sendToAllViaCloud(contacts, messageFor)
        .then((res) => {
          const bad = res.filter((x) => !x.ok);
          if (!bad.length) toast.success(`Sent to all ${res.length} WhatsApp numbers`);
          else toast.warning(`Sent to ${res.length - bad.length} of ${res.length}`, { description: bad.map((b) => `${b.to}: ${b.error}`).join("\n") });
        })
        .catch((e: Error) => toast.error("WhatsApp API failed", { description: e.message }));
      return "";
    }
    const { blocked } = openAllChats(contacts, messageFor);
    if (blocked) toast.message("Some chats were blocked by the browser", { description: "Allow pop-ups for this site, or use “Send to next” on the next screen." });
    return "";
  }

  function submit(session = draft!.session, how: Intent = intent) {
    setBusy(true);
    try {
      // Store actions are synchronous in V1, so sharing below still counts as part of the tap.
      const r = ctx.editing
        ? store.updateAttendance(ctx.editing.id, absent)
        : store.submitAttendance({ subModuleId: ctx.subModuleId, date: draft!.date, session, takenAt: draft!.startedAt, absent });
      if (!r.ok) {
        if (r.error === "DUPLICATE") {
          setConfirmOpen(false);
          setDup(store.findDuplicate(ctx.subModuleId, draft!.date, session) ?? null);
          return;
        }
        toast.error("Something went wrong while saving attendance.", { description: r.error, action: { label: "Try again", onClick: () => submit(session, how) } });
        return;
      }
      finishDraft(key);
      toast.success(ctx.editing ? "Attendance updated" : "Attendance submitted successfully");
      afterSave(r.data, how);
      router.replace(`/history/${r.data.id}?submitted=${ctx.editing ? "edited" : "1"}`);
    } finally {
      setBusy(false);
    }
  }

  function start(how: Intent) {
    setIntent(how);
    if (existing) setDup(existing);
    else setConfirmOpen(true);
  }

  const nextSession = store.nextFreeSession(ctx.subModuleId, draft.date);

  return (
    <div className="pb-28">
      <Link href={gridHref} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to Attendance
      </Link>
      <div className="mb-5">
        <p className="text-sm text-ink-muted">
          {ctx.mainName} / {ctx.subName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{ctx.editing ? "Review changes" : "Review attendance"}</h1>
        <p className="mt-1 inline-flex items-center gap-2 text-sm text-ink-muted">
          <CalendarDays className="size-4" aria-hidden />
          {formatLongDate(draft.date)} · {formatTime(draft.startedAt)}
          {draft.session > 1 || ctx.editing ? ` · Session ${draft.session}` : ""}
        </p>
      </div>

      {existing && (
        <div role="alert" className="mb-4 flex gap-3 rounded-xl border border-warn-border bg-warn-soft p-4 text-sm text-warn-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Attendance already exists for this session.</p>
            <p className="mt-0.5">
              {ctx.subName} on {formatLongDate(draft.date)} (session {draft.session}) was submitted at {formatTime(existing.takenAt)}.{" "}
              <Link href={`/history/${existing.id}`} className="font-medium underline">View existing</Link>
            </p>
          </div>
        </div>
      )}

      <AttendanceSummary total={ctx.rolls.length} absent={absent.length} className="mb-5" />

      <p className="mb-3 text-xs text-ink-muted">
        The % next to each student is their <strong className="font-semibold text-ink">overall attendance in {ctx.subName}</strong> including this session. Below {low}% is shown in red.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-absent-ink">
            <UserX className="size-4" aria-hidden /> ABSENT STUDENTS — {absent.length}
          </h2>
          <RollList rolls={absent} all={ctx.rolls} variant="absent" names={ctx.names} rates={rates} lowThreshold={low} emptyText="No absentees — everyone is present." />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <UserCheck className="size-4" aria-hidden /> PRESENT STUDENTS — {present.length}
          </h2>
          <RollList rolls={present} all={ctx.rolls} variant="present" names={ctx.names} rates={rates} lowThreshold={low} emptyText="No one is marked present." />
        </Card>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pt-3 backdrop-blur lg:left-auto lg:w-[calc(100%-var(--sidebar-w,16rem))]">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 sm:px-2 lg:px-4">
          <Button variant="secondary" size="lg" asChild className="px-3 sm:px-5">
            <Link href={gridHref} aria-label="Back to Attendance">
              <ArrowLeft /> <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>
          <Button variant="secondary" size="lg" className="px-3 sm:px-5" onClick={() => start("share")} title="Submit and share with any app">
            <Share2 /> <span className="hidden sm:inline">Share</span>
          </Button>
          <Button variant="whatsapp" size="lg" className="px-3 sm:px-5" onClick={() => start("whatsapp")} title="Submit and send on WhatsApp">
            <MessageCircle /> <span className="hidden sm:inline">WhatsApp</span>
          </Button>
          <Button size="lg" className="flex-1 sm:flex-none" onClick={() => start("submit")}>
            <Send /> {ctx.editing ? "Save" : "Submit"}
          </Button>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={ctx.editing ? "Save changes?" : "Confirm Attendance"}
        confirmLabel={busy ? "Saving…" : intent === "whatsapp" ? (ctx.editing ? "Save & WhatsApp" : "Submit & WhatsApp") : intent === "share" ? (ctx.editing ? "Save & Share" : "Submit & Share") : ctx.editing ? "Confirm & Save" : "Confirm & Submit"}
        busy={busy}
        onConfirm={() => submit()}
        description={
          <div className="space-y-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
              <dt className="text-ink-muted">Present</dt>
              <dd className="font-semibold text-ink tabular">{present.length}</dd>
              <dt className="text-ink-muted">Absent</dt>
              <dd className="font-semibold text-absent-ink tabular">{absent.length}</dd>
              <dt className="text-ink-muted">Date</dt>
              <dd className="text-ink">{formatLongDate(draft.date)}{draft.session > 1 ? ` · Session ${draft.session}` : ""}</dd>
              <dt className="text-ink-muted">Module</dt>
              <dd className="text-ink">{ctx.mainName}</dd>
              <dt className="text-ink-muted">Subject</dt>
              <dd className="text-ink">{ctx.subName}</dd>
            </dl>
            <p>
              {ctx.editing ? "The saved record will be updated with this selection." : "Once submitted, this attendance record will be saved."}
              {intent === "whatsapp" && (data.settings.whatsappContacts.length ? ` Then it goes to all ${data.settings.whatsappContacts.length} saved WhatsApp number${data.settings.whatsappContacts.length === 1 ? "" : "s"}.` : " Then WhatsApp opens so you can pick a chat.")}
              {intent === "share" && " Then your device’s share options open."}
            </p>
          </div>
        }
      />

      <Modal
        open={dup !== null}
        onOpenChange={(o) => !o && setDup(null)}
        title="Attendance Already Exists"
        description={dup ? `Attendance for ${ctx.subName} on ${formatLongDate(dup.date)}${dup.session > 1 ? ` (session ${dup.session})` : ""} has already been submitted.` : undefined}
      >
        {dup && (
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start" onClick={() => router.push(`/history/${dup.id}`)}>
              <Eye /> View Existing
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => router.push(`/attendance/${ctx.subModuleId}?edit=${dup.id}`)}>
              <Pencil /> Edit Existing Record
            </Button>
            <Button className="w-full justify-start" disabled={busy} onClick={() => { setDup(null); submit(nextSession, intent); }}>
              <Plus /> Save as Session {nextSession} instead
            </Button>
            <p className="pt-1 text-xs text-ink-muted">Your current selection stays saved as a draft if you leave.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
