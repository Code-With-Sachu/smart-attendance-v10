"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Eraser, FileText, Loader2, Maximize2, Mic, MicOff, Paperclip, SendHorizontal, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { useFiles } from "@/lib/files/store";
import { extractFile, FILE_ACCEPT, sheetToCsv } from "@/lib/files/extract";
import { blobToBase64, chat, useChat, type ChatAttachment } from "@/lib/ai/chat";
import { cancelSpeech, speak, useVoiceInput } from "@/lib/ai/speech";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";

let lastInputWasVoice = false;

function suggestionsFor(path: string): string[] {
  if (path.startsWith("/attendance")) return ["How do I mark absentees quickly?", "What does Apply Section do?", "How do I change the period?"];
  if (path.startsWith("/history")) return ["Which students are below 75%?", "Who was absent today?", "Summarise this week’s attendance"];
  if (path.startsWith("/profile")) return ["Summarise my files", "How do I add WhatsApp numbers?", "How do I edit an uploaded file?"];
  if (path.startsWith("/sub-modules")) return ["Analyse the files in this subject", "Who has the lowest attendance here?", "How do I upload students?"];
  if (path.startsWith("/admin")) return ["How do I back up my data?", "How do I export to Excel?", "What does the threshold do?"];
  return ["How do I use this website?", "Give me an attendance summary", "Which students are below 75%?", "What’s in my uploaded files?"];
}

/** Chat UI shared by the floating agent and the AI Assistant page. */
export function ChatPanel({
  variant,
  onClose,
  headerProps,
}: {
  variant: "floating" | "page";
  onClose?: () => void;
  /** Pointer handlers that make the header a drag handle (floating only). */
  headerProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const data = useAppData();
  const files = useFiles();
  const state = useChat();
  const path = usePathname();
  const [input, setInput] = React.useState("");
  const [attachment, setAttachment] = React.useState<ChatAttachment | null>(null);
  const [reading, setReading] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const attachRef = React.useRef<HTMLInputElement>(null);
  const settings = data?.settings;
  const lang = settings?.assistantLang ?? "en-IN";
  const voice = useVoiceInput(lang);

  // Speak replies (when enabled, or when the question was spoken).
  React.useEffect(() => {
    chat.onReply = (text) => {
      const s = store.getSnapshot()?.settings;
      if (s?.assistantVoiceReplies || lastInputWasVoice) speak(text, s?.assistantLang ?? "en-IN");
      lastInputWasVoice = false;
    };
  }, []);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages]);

  React.useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  function send(text = input) {
    if (!data || state.busy) return;
    if (!text.trim() && !attachment) return;
    void chat.send(text, { data, files: files ?? [], page: path, attachment: attachment ?? undefined, assistantName: data.settings.assistantName });
    setInput("");
    setAttachment(null);
  }

  async function attach(file: File | undefined) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("That file is larger than 15 MB.");
    setReading(true);
    try {
      const ex = await extractFile(file);
      const text = ex.sheets?.length ? ex.sheets.map((s) => `[Sheet: ${s.name}]\n${sheetToCsv(s.rows)}`).join("\n\n") : ex.text;
      const binary = (ex.kind === "image" || (ex.kind === "pdf" && !text.trim())) && file.size < 2_500_000 ? await blobToBase64(file) : undefined;
      if (!text.trim() && !binary) toast.message("I can’t read the content of that file type.");
      setAttachment({ name: file.name, mime: file.type || "application/octet-stream", text: text || undefined, base64: binary });
      inputRef.current?.focus();
    } finally {
      setReading(false);
    }
  }

  const toggleVoiceReplies = () => {
    const next = !settings?.assistantVoiceReplies;
    store.updateAdminSettings({ assistantVoiceReplies: next });
    if (!next) cancelSpeech();
    toast.success(next ? "Replies will be read aloud" : "Voice replies off");
  };

  if (!data) return null;
  const name = settings!.assistantName || "Attendance Assistant";
  const online = state.provider === "gemini";

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", variant === "floating" && "rounded-2xl")}>
      {/* Header */}
      <div
        {...headerProps}
        className={cn(
          "flex shrink-0 items-center gap-2.5 border-b border-border px-3 py-2.5",
          variant === "floating" && "cursor-grab touch-none select-none rounded-t-2xl active:cursor-grabbing",
          headerProps?.className,
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-white shadow-sm">
          <Bot className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className={cn("size-1.5 rounded-full", online ? "bg-success" : state.provider === "unknown" ? "bg-slate-400" : "bg-amber-500")} aria-hidden />
            {online ? "AI model · reads your data & files" : state.provider === "unknown" ? "Connecting…" : "Offline helper · built-in answers"}
          </p>
        </div>
        <div className="flex items-center" onPointerDown={(e) => e.stopPropagation()}>
          <IconBtn label={settings!.assistantVoiceReplies ? "Turn off voice replies" : "Read replies aloud"} onClick={toggleVoiceReplies} active={settings!.assistantVoiceReplies}>
            {settings!.assistantVoiceReplies ? <Volume2 /> : <VolumeX />}
          </IconBtn>
          <IconBtn label="Clear conversation" onClick={() => chat.clear()} disabled={!state.messages.length}>
            <Eraser />
          </IconBtn>
          {variant === "floating" && (
            <Link href="/assistant" onClick={onClose} aria-label="Open full screen" title="Open full screen" className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-ink [&_svg]:size-4">
              <Maximize2 />
            </Link>
          )}
          {onClose && (
            <IconBtn label="Close assistant" onClick={onClose}>
              <X />
            </IconBtn>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {state.messages.length === 0 ? (
          <div className="flex flex-col items-center px-2 py-4 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">Hi{data.profile.name ? `, ${data.profile.name.split(" ")[0]}` : ""}! How can I help?</p>
            <p className="mt-1 max-w-xs text-xs text-ink-muted">Ask how to use any section, check a student’s attendance, or analyse your uploaded files. Type or tap the mic.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {suggestionsFor(path).map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink hover:border-primary/40 hover:bg-primary-soft">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          state.messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-white shadow-sm">
                  {m.attachment && (
                    <p className="mb-1 flex items-center gap-1 text-[11px] opacity-85">
                      <FileText className="size-3" aria-hidden /> {m.attachment}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Bot className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-md border border-border bg-slate-50 px-3 py-2 text-ink">
                  {m.pending && !m.content ? (
                    <span className="flex items-center gap-1 py-1" aria-label="Thinking">
                      <span className="size-1.5 animate-bounce rounded-full bg-ink-subtle [animation-delay:-0.2s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-ink-subtle [animation-delay:-0.1s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-ink-subtle" />
                    </span>
                  ) : (
                    <Markdown text={m.content} onNavigate={variant === "floating" && typeof window !== "undefined" && window.innerWidth < 640 ? onClose : undefined} />
                  )}
                  {!m.pending && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-ink-subtle">
                      <span>{m.source === "offline" ? "Offline helper" : "AI"}</span>
                      {m.sources?.length ? <span title={m.sources.join(", ")}>· {m.sources.length} file{m.sources.length === 1 ? "" : "s"} read</span> : null}
                      <button type="button" className="hover:text-ink" onClick={() => speak(m.content, lang)}>· Listen</button>
                      <button type="button" className="hover:text-ink" onClick={() => navigator.clipboard?.writeText(m.content).then(() => toast.success("Copied"))}>· Copy</button>
                    </div>
                  )}
                </div>
              </div>
            ),
          )
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-2.5">
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs text-primary-ink">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X className="size-3.5" /></button>
          </div>
        )}
        {voice.listening && (
          <p className="mb-2 flex items-center gap-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
            <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden /> Listening… {voice.interim && <span className="truncate text-ink">“{voice.interim}”</span>}
          </p>
        )}
        <form
          className="flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <IconBtn label="Attach a file to analyse" onClick={() => attachRef.current?.click()} disabled={reading}>
            {reading ? <Loader2 className="animate-spin" /> : <Paperclip />}
          </IconBtn>
          <input ref={attachRef} type="file" accept={FILE_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ""; }} />
          <label htmlFor={`chat-input-${variant}`} className="sr-only">Message</label>
          <textarea
            id={`chat-input-${variant}`}
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={voice.listening ? "Listening…" : "Ask anything…"}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {voice.supported && (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stop() : voice.start((t) => { lastInputWasVoice = true; send(t); }))}
              aria-label={voice.listening ? "Stop listening" : "Speak your question"}
              title={voice.listening ? "Stop" : "Voice input"}
              className={cn("grid size-10 shrink-0 place-items-center rounded-xl transition-colors [&_svg]:size-[18px]", voice.listening ? "bg-danger text-white" : "bg-slate-100 text-ink-muted hover:text-ink")}
            >
              {voice.listening ? <MicOff /> : <Mic />}
            </button>
          )}
          {state.busy ? (
            <button type="button" onClick={() => chat.stop()} aria-label="Stop answer" className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-card [&_svg]:size-4">
              <Square />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() && !attachment} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white transition-opacity disabled:opacity-40 [&_svg]:size-[18px]">
              <SendHorizontal />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink disabled:opacity-40 [&_svg]:size-4", active && "text-primary")}
    >
      {children}
    </button>
  );
}
