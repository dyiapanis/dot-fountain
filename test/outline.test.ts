// Outline model tests: structure, numbering parity with the renderer,
// section nesting, explicit scene numbers, empty docs.

import { describe, expect, it } from "vitest";
import { buildOutline } from "../src/outline";
import { renderFountainHtml } from "../src/render";

const DOC = `Title: THE DEMO

===

# Act One

## The Setup

INT. WAREHOUSE - NIGHT

Action.

EXT. DOCKS - DAY

# Act Two

INT. OFFICE - NIGHT #7#

More action.
`;

describe("buildOutline", () => {
  const items = buildOutline(DOC);

  it("lists sections and scenes in document order", () => {
    expect(items.map(i => i.kind)).toEqual([
      "section", "section", "scene", "scene", "section", "scene",
    ]);
    expect(items.map(i => i.label)).toEqual([
      "Act One", "The Setup", "INT. WAREHOUSE - NIGHT",
      "EXT. DOCKS - DAY", "Act Two", "INT. OFFICE - NIGHT",
    ]);
  });

  it("scene numbering matches the preview renderer", () => {
    const outlineNums = items.filter(i => i.kind === "scene").map(i => i.sceneNumber);
    const htmlNums = [...renderFountainHtml(DOC).matchAll(/fp-sceneno">([^<]+)</g)].map(m => m[1]);
    // each scene renders number left AND right; outline matches the unique set
    expect(new Set(outlineNums)).toEqual(new Set(htmlNums));
  });

  it("explicit scene numbers override auto-numbering", () => {
    const last = items[items.length - 1];
    expect(last.sceneNumber).toBe("7");
  });

  it("depths nest: section 1, subsection 2, scenes below", () => {
    expect(items[0].depth).toBe(1);          // # Act One
    expect(items[1].depth).toBe(2);          // ## The Setup
    expect(items[2].depth).toBe(2 + 1);     // scene under ## The Setup
    expect(items[4].depth).toBe(1);          // # Act Two
  });

  it("offsets point at real heading lines", () => {
    for (const it of items) {
      expect(it.from).toBeLessThan(it.to);
      expect(it.from).toBeGreaterThanOrEqual(0);
    }
  });

  it("empty and title-only docs produce no items", () => {
    expect(buildOutline("")).toEqual([]);
    expect(buildOutline("Title: X\n\n===\n")).toEqual([]);
  });
});