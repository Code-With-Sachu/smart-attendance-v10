"use client";

import { useSyncExternalStore } from "react";
import type { AppData } from "@/lib/types";
import type { StoredFile } from "@/lib/files/types";
import { uid } from "@/lib/utils";
import { buildContext } from "./context";
import { localAnswer } from "./local";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  /** "ai" = answered by the model, "offline" = built-in helper. */
  source?: "ai" | "offline";
  /** Files the answer could draw on. */
  sources?: string[];
  attachment?: string;
  error?: boolean;
  pending?: boolean;
}

export interface ChatAttachment {
  name: string;
  mime: string;
  text?: string;
  base64?: string;
}

export interface Pos {
  x: number;
  y: number;
}

interface ChatState {
  messages: ChatMessage[];
  busy: boolean;
  open: boolean;
  pos: Pos | null;
  provider: "unknown" | "gemini" | "offline";
  model: string | null;
}

const MSG_KEY = "smart-attendance:assistant:messages";
const POS_KEY = "smart-attendance:assistant:pos";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Shared chat state for the floating agent and the full-page assistant. */
class ChatStore {
  private state: ChatState = { messages: [], busy: false, open: false, pos: null, provider: "unknown", model: null };
  private listeners = new Set<() => void>();
  private hydrated = false;
  private abort: AbortController | null = null;
  private statusPromise: Promise<void> | null = null;
  onReply: ((text: string) => void) | null = null;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    this.hydrate();
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.state;
  getServerSnapshot = () => this.state;

  private set(patch: Partial<ChatState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    this.state = { ...this.state, messages: load<ChatMessage[]>(MSG_KEY, []).filter((m) => !m.pending), pos: load<Pos | null>(POS_KEY, null) };
    queueMicrotask(() => this.listeners.forEach((l) => l()));
    void this.checkStatus();
  }

  checkStatus(force = false) {
    if (this.statusPromise && !force) return this.statusPromise;
    this.statusPromise = fetch("/api/agent")
      .then((r) => r.json())
      .then((j: { provider?: string; model?: string | null }) => this.set({ provider: j.provider === "gemini" ? "gemini" : "offline", model: j.model ?? null }))
      .catch(() => this.set({ provider: "offline" }));
    return this.statusPromise;
  }

  setOpen(open: boolean) {
    this.set({ open });
  }
  toggle() {
    this.set({ open: !this.state.open });
  }
  setPos(pos: Pos | null) {
    this.set({ pos });
    save(POS_KEY, pos);
  }
  clear() {
    this.stop();
    this.set({ messages: [] });
    save(MSG_KEY, []);
  }
  stop() {
    this.abort?.abort();
    this.abort = null;
  }

  private persist() {
    save(MSG_KEY, this.state.messages.filter((m) => !m.pending).slice(-40));
  }

  private patchMsg(id: string, patch: Partial<ChatMessage>) {
    this.set({ messages: this.state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  }

  async send(question: string, env: { data: AppData; files: StoredFile[]; page: string; attachment?: ChatAttachment; assistantName: string }) {
    const q = question.trim();
    if ((!q && !env.attachment) || this.state.busy) return;
    const text = q || `Analyse the attached file “${env.attachment!.name}”.`;
    const user: ChatMessage = { id: uid("m"), role: "user", content: text, at: new Date().toISOString(), ...(env.attachment ? { attachment: env.attachment.name } : {}) };
    const reply: ChatMessage = { id: uid("m"), role: "assistant", content: "", at: new Date().toISOString(), pending: true };
    const history = [...this.state.messages, user];
    this.set({ messages: [...history, reply], busy: true });

    await this.checkStatus();
    const ctx = buildContext(env.data, env.files, text, env.page);
    let context = ctx.text;
    if (env.attachment?.text) context += `\n\n# FILE ATTACHED IN THIS CHAT: “${env.attachment.name}” (not saved)\n${env.attachment.text.slice(0, 120_000)}`;

    const finishOffline = (note?: string) => {
      const answer = localAnswer(text, env.data, env.files);
      this.patchMsg(reply.id, { content: note ? `${answer}\n\n_${note}_` : answer, pending: false, source: "offline" });
    };

    if (this.state.provider !== "gemini") {
      finishOffline();
      this.done(reply.id);
      return;
    }

    try {
      const attachments = await Promise.all(ctx.images.map(async (f) => ({ name: f.name, mime: f.mime, data: await blobToBase64(f.blob!) })));
      if (env.attachment?.base64) attachments.push({ name: env.attachment.name, mime: env.attachment.mime, data: env.attachment.base64 });
      this.abort = new AbortController();
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((m) => !m.error).slice(-12).map((m) => ({ role: m.role, content: m.content })),
          context,
          attachments,
          assistantName: env.assistantName,
        }),
        signal: this.abort.signal,
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 501) this.set({ provider: "offline" });
        finishOffline(err.error && err.error !== "offline" ? `AI model unavailable (${err.error}) — answered by the offline helper.` : undefined);
        this.done(reply.id);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        this.patchMsg(reply.id, { content: acc });
      }
      if (!acc.trim()) finishOffline("The AI model returned an empty answer — answered by the offline helper.");
      else this.patchMsg(reply.id, { pending: false, source: "ai", sources: ctx.includedFiles.slice(0, 8) });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        const cur = this.state.messages.find((m) => m.id === reply.id);
        this.patchMsg(reply.id, { content: (cur?.content || "") + "\n\n_Stopped._", pending: false, source: "ai" });
      } else finishOffline("Couldn’t reach the AI model — answered by the offline helper.");
    }
    this.done(reply.id);
  }

  private done(id: string) {
    this.abort = null;
    this.set({ busy: false });
    this.persist();
    const m = this.state.messages.find((x) => x.id === id);
    if (m && this.onReply) this.onReply(m.content);
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export const chat = new ChatStore();

export function useChat() {
  return useSyncExternalStore(chat.subscribe, chat.getSnapshot, chat.getServerSnapshot);
}
