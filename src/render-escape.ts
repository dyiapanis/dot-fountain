// Rendering helpers: escaping and line-local emphasis extraction.

import { spansFor } from "./spans";

const ESC: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
};

/** HTML-escape a text run. All screenplay text goes through this. */
export function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ESC[c]);
}

const TAGS: Record<string, [string, string]> = {
  bold: ["<b>", "</b>"],
  italic: ["<i>", "</i>"],
  bolditalic: ["<b><i>", "</i></b>"],
  underline: ["<u>", "</u>"],
  boldunderline: ["<b><u>", "</u></b>"],
  note: ['<span class="fp-note">', "</span>"],
  sceneno: ['<span class="fp-sceneno">', "</span>"],
};

/**
 * Render one line's text with inline emphasis.
 * spansFor returns offsets relative to the synthetic line (from: 0),
 * so slicing is local to this string.
 */
export function inlineEmphasis(text: string, isScene: boolean): string {
  const spans = spansFor({
    from: 0,
    to: text.length,
    text,
    type: isScene ? "scene" : "action",
  });
  if (spans.length === 0) return esc(text);
  let out = "";
  let pos = 0;
  for (const s of spans) {
    if (s.from < pos) continue; // defensive: overlap mask
    out += esc(text.slice(pos, s.from));
    const [open, close] = TAGS[s.cls] ?? ["", ""];
    out += open + esc(text.slice(s.from, s.to)) + close;
    pos = s.to;
  }
  out += esc(text.slice(pos));
  return out;
}