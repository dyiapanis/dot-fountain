// Fountain → paginated screenplay PDF (portable core, no host imports).
//
// Screenplay geometry matches the editor/preview design: A4, Courier 12
// (a PDF base-14 font — no bytes to embed), margins 3.9cm left / 2.5cm
// others, dialogue/parenthetical/character indents as in preview.css.
// Title page, top-right page numbers ("2." from the second script page),
// scene numbers at both margins when enabled, element-granular widow
// control. MORE/CONT'D dialogue splitting is future work.

import { classify } from "./classify";
import { parseTitlePage } from "./render-title";

// ---------- geometry (pt; 1cm = 28.3465) ----------
const CM = 28.3465;
export const PAGE_W = 595.28; // A4
export const PAGE_H = 841.89;
const M_LEFT = 3.9 * CM;
const M_RIGHT = 2.5 * CM;
const M_TOP = 2.5 * CM;
const M_BOTTOM = 2.5 * CM;
const FONT = 12;
const LINE_H = 12; // single-spaced Courier 12
const CHAR_W = 7.2; // 10 cpi
const TEXT_W = PAGE_W - M_LEFT - M_RIGHT; // ~416pt
const MAX_LINES = Math.floor((PAGE_H - M_TOP - M_BOTTOM) / LINE_H); // 56

// element x offsets (left edge, pt) + wrap measures (chars)
const IND = {
  scene: 0,
  action: 0,
  dialogue: 3.4 * CM,
  parenthetical: 4.4 * CM,
  character: 5.4 * CM,
  transition: 0, // right-aligned, computed per line
  lyric: 3.4 * CM,
  centered: 0, // centered, computed per line
};
const MEASURE = {
  scene: Math.floor(TEXT_W / CHAR_W), // 57
  action: Math.floor(TEXT_W / CHAR_W),
  dialogue: Math.floor((TEXT_W - 2 * 3.4 * CM) / CHAR_W), // 30
  parenthetical: Math.floor((TEXT_W - 4.4 * CM - 2.5 * CM) / CHAR_W), // 32
  character: Math.floor((TEXT_W - 5.4 * CM - 2.5 * CM) / CHAR_W), // 28
  transition: Math.floor(TEXT_W / CHAR_W),
  lyric: Math.floor((TEXT_W - 2 * 3.4 * CM) / CHAR_W),
  centered: Math.floor(TEXT_W / CHAR_W),
};

/** A rendered output line: text plus where/how to draw it. */
export interface PrintLine {
  text: string;
  x: number;       // left edge in pt
  align: "left" | "right" | "center";
  bold: boolean;
  sceneNumber?: string; // drawn at BOTH margins beside this line
}

/** One page of output lines (title page is pages[0] when present). */
export interface PrintPage {
  lines: PrintLine[];
  isTitlePage: boolean;
}

export interface PrintOptions {
  sceneNumbers: boolean;
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Marker cleanup mirroring render.ts (same output text). */
function cleanBody(
  type: string,
  text: string,
): string {
  let body = text;
  if (type === "scene" && body.startsWith(".")) body = body.slice(1);
  if (type === "transition" && body.startsWith(">")) body = body.slice(1);
  if (type === "centered") body = body.slice(1, -1);
  if (type === "character" && body.startsWith("@")) body = body.slice(1);
  if (type === "character") body = body.replace(/\^[ \t]*$/, "");
  if (type === "action" && body.startsWith("!")) body = body.slice(1);
  if (type === "lyric") body = body.replace(/^~[ \t]?/, "");
  if (type === "scene") body = body.replace(/#[^#\s]+#[ \t]*$/, "");
  if (type === "synopsis") body = body.replace(/^[ \t]*=[ \t]?/, "");
  if (type === "note") body = body.replace(/^\[\[[ \t]?|[ \t]?\]\]$/, "");
  // Strip inline emphasis markers, exactly like the HTML renderer:
  // ***x*** **x** *x* _x_ (underline renders as plain text in print;
  // the markers still go).
  body = body
    .replace(/\*\*\*(?=\S)([^*]*?\S)\*\*\*/g, "$1")
    .replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, "$1")
    .replace(/\*(?=\S)([^*]*?\S)\*(?!\*)/g, "$1")
    .replace(/_(?=\S)([^_]*?\S)_(?![A-Za-z0-9_])/g, "$1");
  return body.trim();
}

function pushElem(
  pages: PrintPage[],
  lines: PrintLine[],
  type: string,
  body: string,
  sceneNumber?: string,
): void {
  const measure = MEASURE[type as keyof typeof MEASURE] ?? MEASURE.action;
  const wrapped = wrap(body, measure);
  for (const t of wrapped) {
    lines.push({
      text: t,
      x: IND[type as keyof typeof IND] ?? 0,
      align:
        type === "transition" ? "right"
        : type === "centered" ? "center"
        : "left",
      bold: type === "scene",
      sceneNumber: sceneNumber,
    });
    sceneNumber = undefined; // only on the first line of the element
  }
}

/**
 * Paginate a Fountain document into screenplay pages.
 * Exported for tests; buildPdf consumes this.
 */
export function paginate(text: string, opts: PrintOptions): PrintPage[] {
  const linesInfo = classify(text);
  const { title, bodyStart } = parseTitlePage(linesInfo);
  const pages: PrintPage[] = [];

  // ---- title page ----
  if (title) {
    const tLines: PrintLine[] = [];
    // centered block ~1/3 down; empty spacer lines pad it out
    const center: [string, string][] = title.center;
    const pad = (n: number) => {
      for (let i = 0; i < n; i++) tLines.push({ text: "", x: 0, align: "left", bold: false });
    };
    pad(10);
    for (const [key, value] of center) {
      for (const ln of value.split("\n")) {
        tLines.push({
          text: key === "title" ? ln.toUpperCase() : ln,
          x: 0,
          align: "center",
          bold: key === "title",
        });
        tLines.push({ text: "", x: 0, align: "left", bold: false });
      }
    }
    pad(10);
    for (const [, value] of title.lower) {
      for (const ln of value.split("\n")) {
        tLines.push({ text: ln, x: 0, align: "left", bold: false });
      }
    }
    pages.push({ lines: tLines, isTitlePage: true });
  }

  // ---- body: flow elements into pages ----
  let cur: PrintLine[] = [];
  let sceneNo = 0;

  const flush = (): void => {
    pages.push({ lines: cur, isTitlePage: false });
    cur = [];
  };

  const room = (): number => MAX_LINES - cur.length;

  for (let i = bodyStart; i < linesInfo.length; i++) {
    const line = linesInfo[i];
    if (line.type === "blank") continue;
    // Explicit page break (=== / ====): flush the current page. Never
    // rendered as content.
    if (line.type === "page_break") {
      flush();
      continue;
    }
    // spec-excluded in formatted output
    if (
      line.type === "section" || line.type === "synopsis" ||
      line.type === "note" || line.type === "boneyard"
    ) {
      continue;
    }

    const body = cleanBody(line.type, line.text);
    if (!body) continue;

    let sceneNumber: string | undefined;
    if (line.type === "scene") {
      sceneNo += 1;
      sceneNumber = line.sceneNumber ?? String(sceneNo);
    }

    const type = line.type;
    const measure = MEASURE[type as keyof typeof MEASURE] ?? MEASURE.action;
    const height = wrap(body, measure).length;

    // widow control: a scene heading keeps 2 lines of context; any
    // element taller than the remaining room but shorter than a full
    // page moves to the next page whole.
    const need = type === "scene" ? height + 2 : height;
    if (cur.length > 0 && room() < Math.min(need, height) && height <= MAX_LINES) {
      flush();
    }
    if (type === "scene" && room() < height + 2 && height + 2 <= MAX_LINES) {
      flush();
    }

    pushElem(pages, cur, type, body, opts.sceneNumbers ? sceneNumber : undefined);

    // a "first body page" always flushes at MAX_LINES naturally via room()
    while (cur.length >= MAX_LINES) flush();
  }
  if (cur.length > 0 || (pages.length === 0 && !title)) {
    if (cur.length > 0) flush();
    else if (pages.length === 0) pages.push({ lines: [], isTitlePage: false });
  }

  return pages;
}

// ---------- minimal PDF writer (base-14 Courier, WinAnsi) ----------

/** CP1252-encode; unknown chars become '?'. charCode<=255 binary string. */
function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 256) out += String.fromCharCode(c);
    else {
      // common Unicode → CP1252 approximations
      if (ch === "—" || ch === "–") out += "-";
      else if (ch === "’" || ch === "'") out += "'";
      else if (ch === "“" || ch === "”" || ch === "„") out += '"';
      else if (ch === "…") out += "...";
      else if (ch === "•") out += "-";
      else out += "?";
    }
  }
  return out;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Build the PDF bytes for paginated pages. */
export function buildPdf(pages: PrintPage[], baseName: string): Uint8Array {
  const objects: string[] = []; // 1-indexed
  const pageObjIds: number[] = [];

  // reserve: 1 catalog, 2 pages, 3 F1, 4 F2, then pages+streams
  const N_START = 5; // first page object id
  const pageIds = pages.map((_, i) => N_START + i * 2);
  const streamIds = pages.map((_, i) => N_START + i * 2 + 1);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] =
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>";

  pages.forEach((page, pi) => {
    const pageId = pageIds[pi];
    const streamId = streamIds[pi];
    pageObjIds.push(pageId);

    const parts: string[] = [];
    const textW = PAGE_W - M_LEFT - M_RIGHT;

    if (!page.isTitlePage) {
      // page number: "N." top-right, from script page 2 (title = unnumbered;
      // the first body page is page 1)
      const pageNo = pi - (pages[0]?.isTitlePage ? 1 : 0) + 1;
      if (pageNo >= 2) {
        const label = `${pageNo}.`;
        const w = label.length * CHAR_W;
        const x = PAGE_W - M_RIGHT - w;
        const y = PAGE_H - 40;
        parts.push(`BT /F1 ${FONT} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(label)}) Tj ET`);
      }
    }

    page.lines.forEach((ln, li) => {
      if (!ln.text) return;
      const y = PAGE_H - M_TOP - li * LINE_H - FONT; // baseline
      let x = M_LEFT + ln.x;
      if (ln.align === "right") {
        x = PAGE_W - M_RIGHT - ln.text.length * CHAR_W;
      } else if (ln.align === "center") {
        x = M_LEFT + (textW - ln.text.length * CHAR_W) / 2;
      }
      const f = ln.bold ? "F2" : "F1";
      parts.push(
        `BT /${f} ${FONT} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(toWinAnsi(ln.text))}) Tj ET`,
      );
      if (ln.sceneNumber) {
        const n = ln.sceneNumber;
        const lx = M_LEFT - 28 - n.length * CHAR_W + CHAR_W; // in left margin
        const rx = PAGE_W - M_RIGHT + 10; // in right margin
        parts.push(
          `BT /F2 ${FONT} Tf ${lx.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(n)}) Tj ET`,
        );
        parts.push(
          `BT /F2 ${FONT} Tf ${rx.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(n)}) Tj ET`,
        );
      }
    });

    const content = parts.join("\n");
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  // assemble with xref
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 1; i < objects.length; i++) {
    if (!objects[i]) continue;
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const maxId = objects.reduce((m, o, i) => (o ? Math.max(m, i) : m), 0);
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= maxId; i++) {
    const off = offsets[i] ?? 0;
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  // to bytes (binary string → Uint8Array)
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

/** Convenience: Fountain text → PDF bytes. */
export function fountainToPdf(
  text: string,
  baseName: string,
  opts: PrintOptions,
): Uint8Array {
  return buildPdf(paginate(text, opts), baseName);
}