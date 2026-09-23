// Inline span extraction for Fountain: notes, emphasis and scene numbers.
// Fountain emphasis (per spec) differs from markdown:
//   *italic*   **bold**   ***bold italic***   _*underline*_
//   combinations like _*__bold underline__*_ also exist; we cover the
//   common forms and never double-decorate (first match wins).

import type { LineInfo } from "./classify";

export type SpanClass =
  | "note"
  | "bolditalic"
  | "bold"
  | "italic"
  | "underline"
  | "boldunderline"
  | "sceneno";

export interface Span {
  /** absolute document offsets */
  from: number;
  to: number;
  cls: SpanClass;
}

const SCENE_NUMBER = /#[^#\s]+#[ \t]*$/;

// Longest / most-wrapped pattern first: the coverage mask prevents
// inner emphasis from re-decorating an outer span.
// Per fountain.io: `_*x*_` is underline; combinations nest inside it.
// Lookarounds require non-space just inside the markers, so stray
// punctuation between two emphasis runs (e.g. `**, *`) never matches.
const PATTERNS: [RegExp, SpanClass][] = [
  [/\[\[[^\]]+\]\]/g, "note"],
  [/_(?=\*{3})\*{3}(?=\S)([^*]*?[^\s*])\*{3}_(?!\S)/g, "bolditalic"], // _***x***_
  [/_(?=\*{2})\*{2}(?=\S)([^*]*?[^\s*])\*{2}_(?!\S)/g, "boldunderline"], // _**x**_
  [/_(?=\*)\*(?=\S)([^*]*?[^\s*])\*_(?!\S)/g, "underline"], // _*x*_
  [/\*\*\*(?=\S)([^*]*?[^\s*])\*\*\*/g, "bolditalic"], // ***x***
  [/\*\*(?=\S)([^*]*?[^\s*])\*\*/g, "bold"], // **x**
  [/\*(?=\S)([^*]*?[^\s*])\*/g, "italic"], // *x*
];

/**
 * Extract inline spans for a classified line.
 * Scene numbers are only matched on scene headings.
 */
export function spansFor(line: LineInfo): Span[] {
  const spans: Span[] = [];
  const text = line.text;
  const start = line.from;
  const covered = new Uint8Array(text.length);

  const mark = (mFrom: number, mTo: number, cls: SpanClass) => {
    for (let k = mFrom; k < mTo; k++) if (covered[k]) return;
    for (let k = mFrom; k < mTo; k++) covered[k] = 1;
    spans.push({ from: start + mFrom, to: start + mTo, cls });
  };

  if (line.type === "scene") {
    const re = new RegExp(SCENE_NUMBER.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) mark(m.index, m.index + m[0].length, "sceneno");
  }

  for (const [re, cls] of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) mark(m.index, m.index + m[0].length, cls);
  }

  spans.sort((a, b) => a.from - b.from || b.to - a.to);
  return spans;
}
