// Fountain title-page parsing.
// Leading `Key: value` block before the first blank/`===` separator.
// Multi-line values via continuation lines; unknown keys (e.g. `Ph:`)
// fold into the lower contact block, matching Final Draft / Fountain.js
// de-facto behavior.

import type { LineInfo } from "./classify";

export interface TitlePage {
  center: [string, string][]; // title/credit/author/source — centered
  lower: [string, string][];  // contact-ish keys — lower-left block
}

const CENTER_KEYS = new Set(["title", "credit", "author", "authors", "source"]);

export function parseTitlePage(
  lines: LineInfo[],
): { title: TitlePage | null; bodyStart: number } {
  const entries: [string, string][] = [];
  let i = 0;

  while (i < lines.length) {
    const text = lines[i].text;
    const t = text.trim();
    if (t === "" || t === "===") break;
    const colon = text.indexOf(":");
    if (colon < 1) break; // no title page
    const key = text.slice(0, colon).trim().toLowerCase();
    let value = text.slice(colon + 1).trim();
    i++;
    while (i < lines.length) {
      const nt = lines[i].text.trim();
      if (nt === "" || nt === "===" || lines[i].text.indexOf(":") >= 1) break;
      value += "\n" + nt;
      i++;
    }
    entries.push([key, value]);
  }

  if (entries.length === 0) return { title: null, bodyStart: 0 };

  while (i < lines.length && lines[i].type === "blank") i++;
  if (i < lines.length && lines[i].text.trim() === "===") i++;
  while (i < lines.length && lines[i].type === "blank") i++;

  const center: [string, string][] = [];
  const lower: [string, string][] = [];
  for (const [k, v] of entries) {
    if (CENTER_KEYS.has(k)) center.push([k, v]);
    else lower.push([k, v]);
  }
  return { title: { center, lower }, bodyStart: i };
}