// PDF export tests: pagination, scene-number toggle, PDF structure.

import { describe, expect, it } from "vitest";
import { paginate, buildPdf, fountainToPdf } from "../src/print";

const DOC = `Title: THE DEMO
Credit: written by
Author: dot-fountain

====

INT. ROOM - DAY

A man types. $(1)$ He pauses.

WILL
(quietly)
It works.

> CUT TO:

EXT. YARD - NIGHT

Stars everywhere.

FADE OUT.
`;

describe("paginate", () => {
  it("produces a title page first, then body pages", () => {
    const pages = paginate(DOC, { sceneNumbers: false });
    expect(pages[0].isTitlePage).toBe(true);
    expect(pages[1].isTitlePage).toBe(false);
    // title text centered on the title page
    const title = pages[0].lines.find(l => l.text === "THE DEMO");
    expect(title?.align).toBe("center");
  });

  it("strips emphasis markers from body text", () => {
    const pages = paginate("INT. A - DAY\n\n**FADE IN:** the *quick* _brown_ fox.\n", { sceneNumbers: false });
    const all = pages.flatMap(p => p.lines);
    expect(all.some(l => l.text.includes("FADE IN: the quick brown fox"))).toBe(true);
    expect(all.some(l => l.text.includes("**"))).toBe(false);
    expect(all.some(l => l.text.includes("_brown_"))).toBe(false);
  });

  it("=== page breaks flush the page and render nothing", () => {
    const pages = paginate("INT. A - DAY\n\nAction one.\n\n====\n\nINT. B - NIGHT\n\nAction two.\n", { sceneNumbers: false });
    expect(pages.length).toBeGreaterThanOrEqual(2);
    const all = pages.flatMap(p => p.lines);
    expect(all.some(l => l.text.includes("===="))).toBe(false);
    expect(all.some(l => l.text.includes("---"))).toBe(false);
    expect(all.some(l => l.text === "Action one.")).toBe(true);
    expect(all.some(l => l.text === "Action two.")).toBe(true);
  });

  it("standard spacing: 1 blank between blocks, 2 before scene headings", () => {
    const pages = paginate(DOC, { sceneNumbers: false });
    const lines = pages.flatMap(p => p.lines).map(l => l.text);
    const idx = (t: string) => lines.indexOf(t);

    // action -> scene (EXT. YARD): two blanks
    const yard = idx("EXT. YARD - NIGHT");
    expect(yard).toBeGreaterThan(0);
    expect(lines[yard - 1]).toBe("");
    expect(lines[yard - 2]).toBe("");
    expect(lines[yard - 3]).not.toBe("");
    // dialogue block internal: cue and its dialogue contiguous
    expect(lines[idx("WILL") + 1]).toBe("(quietly)");
    expect(lines[idx("(quietly)") + 1]).toBe("It works.");
    // dialogue -> transition: one blank
    const cut = idx("CUT TO:");
    expect(lines[cut - 1]).toBe("");
    expect(lines[cut - 2]).not.toBe("");
  });

  it("no leading blank on a fresh page; blanks never exceed 2", () => {
    const doc = Array.from({ length: 120 }, (_, n) =>
      `INT. ROOM ${n} - DAY\n\nAction line number ${n}. Some words to fill.`,
    ).join("\n\n");
    const pages = paginate(doc, { sceneNumbers: false });
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) {
      expect(p.lines[0]?.text).not.toBe("");
      let run = 0;
      for (const ln of p.lines) {
        run = ln.text === "" ? run + 1 : 0;
        if (run > 2) throw new Error("3+ consecutive blanks in output");
      }
    }
  });

  it("uppercases the title, keeps author mixed case", () => {
    const pages = paginate(DOC, { sceneNumbers: false });
    expect(pages[0].lines.some(l => l.text === "THE DEMO")).toBe(true);
    // author stays exactly as written (mixed case)
    expect(pages[0].lines.some(l => l.text === "dot-fountain")).toBe(true);
    // credit stays mixed case
    expect(pages[0].lines.some(l => l.text === "written by")).toBe(true);
  });

  it("paper size: A4 default, Letter option changes MediaBox", () => {
    const a4 = fountainToPdf(DOC, "demo", { sceneNumbers: false });
    const letter = fountainToPdf(DOC, "demo", { sceneNumbers: false, paperSize: "Letter" });
    const box = (b: Uint8Array) => /MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(Array.from(b, c => String.fromCharCode(c)).join(""))?.slice(1);
    expect(box(a4)).toEqual(["595.28", "841.89"]);
    expect(box(letter)).toEqual(["612", "792"]);
    // pagination differs: Letter fits more per page
    const long = "INT. A - DAY\n\n" + "Action line.\n\n".repeat(400);
    expect(paginate(long, { sceneNumbers: false, paperSize: "Letter" }).length)
      .toBeLessThan(paginate(long, { sceneNumbers: false, paperSize: "A4" }).length);
  });

  it("scene numbers toggle: left+right when on, absent when off", () => {
    const on = paginate(DOC, { sceneNumbers: true });
    const body = on.slice(1); // skip title page
    const sceneLines = body.flatMap(p => p.lines).filter(l => l.sceneNumber);
    expect(sceneLines.length).toBeGreaterThanOrEqual(2);
    expect(sceneLines[0].sceneNumber).toBe("1");
    expect(sceneLines[1].sceneNumber).toBe("2");

    const off = paginate(DOC, { sceneNumbers: false });
    const offScene = off.flatMap(p => p.lines).filter(l => l.sceneNumber);
    expect(offScene.length).toBe(0);
  });

  it("elements land at their screenplay indents", () => {
    const pages = paginate(DOC, { sceneNumbers: false });
    const all = pages.flatMap(p => p.lines);
    const scene = all.find(l => l.text.startsWith("INT. ROOM"));
    const char = all.find(l => l.text === "WILL");
    const paren = all.find(l => l.text === "(quietly)");
    const dial = all.find(l => l.text === "It works.");
    const trans = all.find(l => l.text === "CUT TO:");
    expect(scene?.x).toBe(0);
    expect(scene?.bold).toBe(true);
    const charX = char?.x ?? -1;
    const parenX = paren?.x ?? -1;
    expect(charX).toBeGreaterThan(0);
    expect(parenX).toBeGreaterThan(0);
    // parenthetical (4.4cm) sits LEFT of character (5.4cm)
    expect(parenX).toBeLessThan(charX);
    expect(dial && dial.x > 0).toBe(true);
    expect(trans?.align).toBe("right");
  });

  it("long scripts paginate into multiple pages", () => {
    const scene = "INT. ROOM - DAY\n\nAction line.\n\n";
    let long = "";
    for (let i = 0; i < 200; i++) long += scene;
    const pages = paginate(long, { sceneNumbers: false });
    expect(pages.length).toBeGreaterThan(5);
    // every body page fits within MAX_LINES
    for (const p of pages.slice(1)) {
      expect(p.lines.length).toBeLessThanOrEqual(56);
    }
  });
});

describe("buildPdf", () => {
  it("emits valid PDF structure", () => {
    const bytes = fountainToPdf(DOC, "demo", { sceneNumbers: true });
    const s = Array.from(bytes.slice(0, 8), b => String.fromCharCode(b)).join("");
    expect(s).toBe("%PDF-1.4");
    const tail = Array.from(bytes.slice(-6), b => String.fromCharCode(b)).join("");
    expect(tail).toContain("%%EOF");
    // page objects present
    const str = Array.from(bytes, b => String.fromCharCode(b)).join("");
    expect(str).toContain("/Type /Catalog");
    expect(str).toContain("/BaseFont /Courier");
    expect(str).toContain("/BaseFont /Courier-Bold");
    // two content fonts referenced
    expect(str).toContain("/F2 12 Tf");
  });

  it("PDF page count matches pagination", () => {
    const pages = paginate(DOC, { sceneNumbers: true });
    const bytes = buildPdf(pages, "demo");
    const str = Array.from(bytes, b => String.fromCharCode(b)).join("");
    const count = /\/Count (\d+)/.exec(str)?.[1];
    expect(Number(count)).toBe(pages.length);
  });
});