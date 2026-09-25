import { describe, expect, it } from "vitest";
import { classify, detectFountain, type LineType } from "../src/classify";
import { spansFor } from "../src/spans";

// Helpers --------------------------------------------------------------

/** Classify a doc and return just the element types per line. */
function types(doc: string): LineType[] {
  return classify(doc).map(l => l.type);
}

/** Extract the first classified line containing `needle`. */
function lineOf(doc: string, needle: string) {
  return classify(doc).find(l => l.text.includes(needle))!;
}

// Scene headings ---------------------------------------------------------

describe("scene headings", () => {
  it("recognises INT./EXT. prefixed headings after a blank line", () => {
    expect(types(`EXT. BRICK'S POOL - DAY\n\nAction here.\n`)).toEqual([
      "scene",
      "blank",
      "action",
      "blank",
    ]);
  });

  it("case-insensitive prefixes", () => {
    expect(types("ext. brick's pool - day\n\nAction.\n")).toContain("scene");
  });

  it("INT/EXT and I/E prefixes", () => {
    expect(types("INT/EXT. VAN - DAY\n\nAction.\n")).toContain("scene");
    expect(types("I/E. HOUSE - NIGHT\n\nAction.\n")).toContain("scene");
  });

  it("forced scene heading with leading period", () => {
    expect(types(`\n.SNIPER SCOPE POV\n\nFrom inches away.\n`)).toEqual([
      "blank",
      "scene",
      "blank",
      "action",
      "blank",
    ]);
  });

  it("scene number in #…# is extracted", () => {
    const line = lineOf(`\nINT. HOUSE - DAY #1A#\n\nx\n`, "HOUSE");
    expect(line.sceneNumber).toBe("1A");
  });

  it("an ellipsis line is action, not a forced heading", () => {
    expect(types(`\n...where we start.\n`)).toEqual(["blank", "action", "blank"]);
  });
});

// Characters and dialogue ------------------------------------------------

describe("characters and dialogue", () => {
  it("dialogue block ends at the blank line", () => {
    expect(types(`\nSTEEL\nA line of dialogue.\n\nNew action paragraph.\n`)).toEqual([
      "blank",
      "character",
      "dialogue",
      "blank",
      "action",
      "blank",
    ]);
  });

  it("forced character with @", () => {
    expect(types(`\n@McNulty\nHello there.\n`)).toEqual([
      "blank",
      "character",
      "dialogue",
      "blank",
    ]);
  });

  it("forced action with ! prevents character misread", () => {
    expect(types(`\n!THE MAN\nappears behind her.\n`)).toEqual([
      "blank",
      "action",
      "action",
      "blank",
    ]);
  });

  it("parentheticals inside dialogue blocks", () => {
    expect(types(`\nSTEEL\n(pause)\nA line.\n`)).toEqual([
      "blank",
      "character",
      "parenthetical",
      "dialogue",
      "blank",
    ]);
  });

  it("character extension like (V.O.) stays a cue", () => {
    const doc = `\nSTEEL (V.O.)\nWe were on the job.\n`;
    expect(types(doc)).toEqual([
      "blank",
      "character",
      "dialogue",
      "blank",
    ]);
  });

  it("dual dialogue second cue ends with ^", () => {
    const doc = `\nBRICK\nScrew retirement.\n\nSTEEL ^\nScrew retirement.\n`;
    const lines = classify(doc);
    const steel = lines.find(l => l.text.includes("STEEL"))!;
    expect(steel.dual).toBe(true);
  });
});

// Transitions ------------------------------------------------------------

describe("transitions", () => {
  it("uppercase ending TO: surrounded by blanks", () => {
    expect(types(`\nAction line.\n\nCUT TO:\n\nINT. X - DAY\n`)).toEqual([
      "blank",
      "action",
      "blank",
      "transition",
      "blank",
      "scene",
      "blank",
    ]);
  });

  it("forced transition with >", () => {
    expect(types(`\n>Burn to White.\n\nINT. X - DAY\n`)).toEqual([
      "blank",
      "transition",
      "blank",
      "scene",
      "blank",
    ]);
  });

  it("named transitions (SMASH CUT TO:, DISSOLVE TO:, FADE IN:)", () => {
    for (const tr of ["SMASH CUT TO:", "DISSOLVE TO:", "FADE IN:", "BACK TO:"]) {
      const ts = types(`\nAction.\n\n${tr}\n\nINT. X - DAY\n`);
      expect(ts[3]).toBe("transition");
    }
  });
});

// Page breaks, sections, synopses, notes, boneyard ------------------------

describe("structural elements", () => {
  it("=== alone is a page break", () => {
    expect(types(`INT. X - DAY\n\n===\n\nINT. Y - NIGHT\n`)).toEqual([
      "scene",
      "blank",
      "page_break",
      "blank",
      "scene",
      "blank",
    ]);
  });

  it("# ATX section, with nesting level", () => {
    const line = lineOf(`# Act\n\n## Sequence\n`, "Sequence");
    expect(line.type).toBe("section");
    expect(line.level).toBe(2);
  });

  it("sections without a space after the hashes are still sections", () => {
    const doc = `#Act One\n\n##The Setup\n`;
    const lines = classify(doc);
    expect(lines[0].type).toBe("section");
    expect(lines[0].level).toBe(1);
    expect(lines[2].type).toBe("section");
    expect(lines[2].level).toBe(2);
  });

  it("= text is a synopsis", () => {
    expect(types(`= Something happens here.\n`)).toEqual([
      "synopsis",
      "blank",
    ]);
  });

  it("[[...]] is a note", () => {
    expect(types(`[[Did we think of names?]]\n`)).toEqual(["note", "blank"]);
  });

  it("multi-line notes", () => {
    const doc = `[[First line\nSecond line]]\n`;
    expect(types(doc)).toEqual(["note", "note", "blank"]);
  });

  it("/* ... */ boneyard is ignored content", () => {
    const doc = `/*\nINT. GARAGE - DAY\n\nBRICK\nThis is everybody.\n*/\nEXT. MANSION - DAY\n`;
    const ts = types(doc);
    expect(ts[0]).toBe("boneyard");
    expect(ts[5]).toBe("boneyard");
    // The scene after the closing */ is classified normally:
    expect(ts[6]).toBe("scene");
  });

  it("lyric with ~", () => {
    expect(types(`~Willy Wonka!\n`)).toEqual(["lyric", "blank"]);
  });
});

// Title page --------------------------------------------------------------

describe("title page", () => {
  it("title-page keys are not misclassified as action garbage in body", () => {
    const doc = `Title: THE DEMO\nCredit: written by\nAuthor: dot-fountain\n\n===\n\nINT. X - DAY\n`;
    const lines = classify(doc);
    // The title-page block is consumed by parseTitlePage in render;
    // classifier just sees text — but it must NOT flip into dialogue
    // state and swallow the body.
    const bodyFirst = lines.find(l => l.type === "scene");
    expect(bodyFirst?.text).toContain("INT. X");
  });
});

// Auto-detection -----------------------------------------------------------

describe("auto-detection", () => {
  it("detects a screenplay", () => {
    expect(detectFountain(`INT. X - DAY\n\nAction.\n`)).toBe(true);
  });
  it("detects dialogue-only scripts", () => {
    expect(detectFountain(`STEEL\nThe man's a myth!\n\nBRICK\nSays you.\n`)).toBe(true);
  });
  it("ordinary markdown is not a screenplay", () => {
    expect(detectFountain(`# Heading\n\nSome *emphasis* text.\n`)).toBe(false);
  });
});

// Inline emphasis ------------------------------------------------------------

describe("inline emphasis", () => {
  const text = `Action with *emphasisword*, **strongword**, ***biword***, _underword_.`;
  const cls = (needle: string) => {
    const line = classify(text)[0];
    return spansFor(line)
      .filter(s => text.slice(s.from, s.to).includes(needle))
      .map(s => s.cls);
  };
  it("italic via *x*", () => expect(cls("emphasisword")).toEqual(["italic"]));
  it("bold via **x**", () => expect(cls("strongword")).toEqual(["bold"]));
  it("bold-italic via ***x***", () => expect(cls("biword")).toEqual(["bolditalic"]));
  it("underline via _x_", () => expect(cls("underword")).toEqual(["underline"]));
});

describe("nested emphasis", () => {
  it("nested italic inside underline", () => {
    const text = `_an *italicized* word_`;
    const line = classify(text)[0];
    const spans = spansFor(line);
    expect(spans.filter(s => s.cls === "underline").length).toBe(1);
    expect(spans.filter(s => s.cls === "italic").length).toBe(1);
  });
});

// Scene numbers in output ------------------------------------------------------------

describe("scene numbers", () => {
  it("left and right scene numbers on output scene headings", () => {
    // renderer-level test; see render.test.ts for full checks
    const line = lineOf(`\nINT. HOUSE - DAY #3#\n\nx\n`, "HOUSE");
    expect(line.sceneNumber).toBe("3");
  });
});