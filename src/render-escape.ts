// Rendering helpers: escaping and recursive inline-emphasis rendering.
//
// Spans from spansFor() INCLUDE their marker characters (e.g. the span
// for `_Big Fish_` covers the underscores). For rendering we strip the
// class-specific markers and recurse into nested spans, so
//   `_Big Fish_`         -> <u>Big Fish</u>
//   `_an *italic* word_` -> <u>an <i>italic</i> word</u>

import { spansFor } from "./spans";
import type { Span } from "./spans";

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
  note: ['<span class="fp-note">', "</span>"],
  sceneno: ['<span class="fp-sceneno">', "</span>"],
};

/** Marker widths per span class: [open, close]. */
const MARKERS: Record<string, [number, number]> = {
  bolditalic: [3, 3], // ***x***
  bold: [2, 2],        // **x**
  italic: [1, 1],      // *x*
  underline: [1, 1],   // _x_
  note: [2, 2],        // [[x]]
  sceneno: [1, 1],     // #x#
};

/**
 * Render the spans inside [from, to) of `text` as HTML, recursively:
 * a span's markers are stripped, and spans fully contained within it
 * render inside its tags (nested emphasis).
 */
function renderRange(
  text: string,
  spans: Span[],
  from: number,
  to: number,
): string {
  let out = "";
  let pos = from;
  for (const s of spans) {
    if (s.from < pos || s.to > to) continue; // not a child of this range
    const [open, close] = TAGS[s.cls] ?? ["", ""];
    const [mOpen, mClose] = MARKERS[s.cls] ?? [0, 0];
    const innerFrom = s.from + mOpen;
    const innerTo = s.to - mClose;
    if (innerFrom > innerTo) {
      // Degenerate span (lone marker): render raw, never happens with
      // our patterns, but stay safe.
      out += esc(text.slice(pos, s.to));
      pos = s.to;
      continue;
    }
    out += esc(text.slice(pos, s.from));
    // Nested spans: strictly inside this span's inner range.
    const children = spans.filter(
      x => x !== s && x.from >= innerFrom && x.to <= innerTo,
    );
    out += open + renderRange(text, children, innerFrom, innerTo) + close;
    pos = s.to;
  }
  out += esc(text.slice(pos, to));
  return out;
}

/**
 * Render one line's text with inline emphasis.
 * spansFor returns offsets relative to the synthetic line (from: 0),
 * so slicing is local to this string.
 */
export function inlineEmphasis(text: string, isScene: boolean): string {
  const spans: Span[] = spansFor({
    from: 0,
    to: text.length,
    text,
    type: isScene ? "scene" : "action",
  });
  return renderRange(text, spans, 0, text.length);
}