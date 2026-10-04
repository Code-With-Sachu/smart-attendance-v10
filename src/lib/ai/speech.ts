"use client";

import * as React from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all browsers). */
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative; length: number }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function recognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Voice input. `onFinal` gets the full transcript when the user stops speaking. */
export function useVoiceInput(lang: string) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const rec = React.useRef<SpeechRec | null>(null);

  React.useEffect(() => setSupported(!!recognitionCtor()), []);
  React.useEffect(() => () => rec.current?.abort(), []);

  const start = React.useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = recognitionCtor();
      if (!Ctor) return setError("Voice input isn’t supported in this browser. Try Chrome or Edge.");
      rec.current?.abort();
      const r = new Ctor();
      r.lang = lang || "en-IN";
      r.interimResults = true;
      r.continuous = false;
      let finalText = "";
      r.onresult = (e) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]!;
          if (res.isFinal) finalText += res[0].transcript;
          else live += res[0].transcript;
        }
        setInterim((finalText + " " + live).trim());
      };
      r.onerror = (e) => {
        setError(e.error === "not-allowed" ? "Microphone permission was denied." : e.error === "no-speech" ? "Didn’t catch that — try again." : `Voice error: ${e.error}`);
      };
      r.onend = () => {
        setListening(false);
        setInterim("");
        if (finalText.trim()) onFinal(finalText.trim());
      };
      rec.current = r;
      setError(null);
      setListening(true);
      cancelSpeech();
      try {
        r.start();
      } catch {
        setListening(false);
      }
    },
    [lang],
  );

  const stop = React.useCallback(() => rec.current?.stop(), []);
  return { supported, listening, interim, error, start, stop };
}

/** Strip Markdown so text-to-speech reads naturally. */
function plain(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>|]/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain(text).slice(0, 3000));
  u.lang = lang || "en-IN";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === u.lang) ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
  if (voice) u.voice = voice;
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export const VOICE_LANGS = [
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (US)" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "kn-IN", label: "Kannada" },
  { code: "te-IN", label: "Telugu" },
];
