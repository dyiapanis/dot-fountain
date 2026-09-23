// Inline span extraction for Fountain: notes, emphasis and scene numbers.
// Fountain emphasis per spec:
//   *italic*  **bold**  ***bold italics***  _underline_
// Underscores are reserved for underlining and may nest other emphasis
// inside (spec example: `_an *italicized* word within an underlined
// phrase_`), so underline spans carry nested inner spans.

import type { LineInfo } from "./classify";

export type SpanClass =
  | "note"
  | "bolditalic"
  | "bold"
  | "italic"
  | "underline"
  | "sceneno";

export interface Span {
  /** absolute offsets in the document */
  from: number;
  to: number;
  cls: SpanClass;
}

const SCENE_NUMBER = /#[^#\s]+#[ \t]*$/;

// Inner emphasis patterns, ordered: most-wrapped first. The coverage
// mask plus pattern order prevents double-decoration.
const INNER: [RegExp, SpanClass][] = [
  [/\[\[[^\]]+\]\]/g, "note"],
  [/\*{3}(?=\S)([^*]*?[^\s*])\*{3}/g, "bolditalic"], // ***x***
  [/\*{2}(?=\S)([^*]*?[^\s*])\*{2}(?!\*)/g, "bold"], // **x**
  [/\*(?=\S)([^*]*?[^\s*])\*(?!\*)/g, "italic"], // *x*
];
// Underline: `_x_`, non-space just inside the markers; trailing
// punctuation after the close (e.g. `_word_.`) is allowed.
const UNDERLINE = /_(?=\S)([^_]*?[^\s_])_(?![A-Za-z0-9_])/g;

function scan(
  text: string,
  base: number,
  patterns: [RegExp, SpanClass][],
  covered: Uint8Array,
  spans: Span[],
): void {
  for (const [src, cls] of patterns) {
    const re = new RegExp(src.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const mFrom = m.index;
      const mTo = m.index + m[0].length;
      let blocked = false;
      for (let k = mFrom; k < mTo; k++) {
        if (covered[k]) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (let k = mFrom; k < mTo; k++) covered[k] = 1;
      spans.push({ from: base + mFrom, to: base + mTo, cls });
    }
  }
}

/**
 * Extract inline spans for a classified line.
 * Scene numbers are only matched on scene headings.
 */
export function spansFor(line: LineInfo): Span[] {
  const spans: Span[] = [];
  const text = line.text;
  const base = line.from;
  const covered = new Uint8Array(text.length);

  if (line.type === "scene") {
    const re = new RegExp(SCENE_NUMBER.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      for (let k = m.index; k < m.index + m[0].length; k++) covered[k] = 1;
      spans.push({ from: base + m.index, to: base + m.index + m[0].length, cls: "sceneno" });
    }
  }

  // Underline spans first — their contents get a nested inner pass.
  const ulRanges: [number, number][] = [];
  const ul = new RegExp(UNDERLINE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = ul.exec(text)) !== null) {
    let blocked = false;
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (covered[k]) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (let k = m.index; k < m.index + m[0].length; k++) covered[k] = 1;
    spans.push({ from: base + m.index, to: base + m.index + m[0].length, cls: "underline" });
    ulRanges.push([m.index, m.index + m[0].length]);
  }

  // Top-level emphasis (underline regions already masked out).
  scan(text, base, INNER, covered, spans);

  // Nested emphasis inside each underline region, fresh mask.
  for (const [f, t] of ulRanges) {
    const inner = text.slice(f + 1, t - 1);
    scan(inner, base + f + 1, INNER, new Uint8Array(inner.length), spans);
  }

  spans.sort((a, b) => a.from - b.from || b.to - a.to);
  return spans;
}