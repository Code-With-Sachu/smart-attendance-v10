"use client";

import * as React from "react";
import Link from "next/link";

/** Tiny, safe Markdown renderer for assistant replies (no HTML injection). */
export function Markdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return <div className="space-y-2 text-sm leading-relaxed">{blocks.map((b, i) => renderBlock(b, i, onNavigate))}</div>;
}

type Block =
  | { t: "p"; text: string }
  | { t: "h"; level: number; text: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "quote"; text: string }
  | { t: "code"; text: string }
  | { t: "table"; head: string[]; rows: string[][] };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const out: Block[] = [];
  let i = 0;
  const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) buf.push(lines[i++]!);
      i++;
      out.push({ t: "code", text: buf.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      out.push({ t: "h", level: h[1]!.length, text: h[2]! });
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().match(/^\|?\s*:?-{2,}/)) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      out.push({ t: "table", head, rows });
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*•]\s+/.test(lines[i]!) || (/^\s{2,}\S/.test(lines[i]!) && items.length))) {
        const l = lines[i++]!;
        if (/^\s*[-*•]\s+/.test(l)) items.push(l.replace(/^\s*[-*•]\s+/, ""));
        else items[items.length - 1] += "\n" + l.trim();
      }
      out.push({ t: "ul", items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && (/^\s*\d+[.)]\s+/.test(lines[i]!) || (/^\s{2,}\S/.test(lines[i]!) && items.length))) {
        const l = lines[i++]!;
        if (/^\s*\d+[.)]\s+/.test(l)) items.push(l.replace(/^\s*\d+[.)]\s+/, ""));
        else items[items.length - 1] += "\n" + l.trim();
      }
      out.push({ t: "ol", items });
      continue;
    }
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) buf.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push({ t: "quote", text: buf.join("\n") });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|```|\s*[-*•]\s|\s*\d+[.)]\s|>|\|)/.test(lines[i]!)) buf.push(lines[i++]!);
    if (!buf.length) buf.push(lines[i++]!);
    out.push({ t: "p", text: buf.join("\n") });
  }
  return out;
}

function renderBlock(b: Block, key: number, nav?: () => void): React.ReactNode {
  switch (b.t) {
    case "h":
      return <p key={key} className={b.level <= 2 ? "text-[15px] font-semibold text-ink" : "font-semibold text-ink"}>{inline(b.text, nav)}</p>;
    case "ul":
      return <ul key={key} className="ml-4 list-disc space-y-1 marker:text-ink-subtle">{b.items.map((it, i) => <li key={i} className="whitespace-pre-line">{inline(it, nav)}</li>)}</ul>;
    case "ol":
      return <ol key={key} className="ml-5 list-decimal space-y-1 marker:text-ink-subtle">{b.items.map((it, i) => <li key={i} className="whitespace-pre-line">{inline(it, nav)}</li>)}</ol>;
    case "quote":
      return <blockquote key={key} className="whitespace-pre-line border-l-2 border-primary/40 pl-3 text-ink-muted">{inline(b.text, nav)}</blockquote>;
    case "code":
      return <pre key={key} className="overflow-x-auto rounded-lg bg-slate-100 p-2.5 font-mono text-xs text-ink">{b.text}</pre>;
    case "table":
      return (
        <div key={key} className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left">
              <tr>{b.head.map((h, i) => <th key={i} className="whitespace-nowrap px-2 py-1.5 font-semibold text-ink">{inline(h, nav)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-1.5 text-ink">{inline(c, nav)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <p key={key} className="whitespace-pre-line">{inline(b.text, nav)}</p>;
  }
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(text: string, nav?: () => void): React.ReactNode[] {
  const parts = text.split(INLINE);
  return parts.map((p, i) => {
    if (!p) return null;
    if ((p.startsWith("**") && p.endsWith("**")) || (p.startsWith("__") && p.endsWith("__"))) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="rounded bg-slate-100 px-1 font-mono text-[0.85em]">{p.slice(1, -1)}</code>;
    const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = link[2]!;
      if (href.startsWith("/") && !href.startsWith("//"))
        return <Link key={i} href={href} onClick={nav} className="font-medium text-primary-ink underline underline-offset-2">{link[1]}</Link>;
      if (/^(https?:|mailto:)/.test(href))
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-ink underline underline-offset-2">{link[1]}</a>;
      return <span key={i}>{link[1]}</span>;
    }
    if ((p.startsWith("*") && p.endsWith("*")) || (p.startsWith("_") && p.endsWith("_"))) return <em key={i}>{p.slice(1, -1)}</em>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
