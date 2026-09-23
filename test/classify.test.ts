import { describe, expect, it } from "vitest";
import { classify, detectFountain, type LineType } from "../src/classify";
import { spansFor } from "../src/spans";

// Helpers ---------------------------------------------------------------

function types(doc: string): LineType[] {
  return classify(doc).map(l => l.type);
}

/** Classify `doc`, return the type of the line containing the marker `**>` */
function lineAt(doc: string, needle: string): LineType {
  const idx = doc.indexOf(needle);
  if (idx < 0) throw new Error(`needle not found: ${needle}`);
  const line = classify(doc).find(l => idx >= l.from && idx <= l.to);
  if (!line) throw new Error(`no line for needle`);
  return line.type;
}

// Scene headings (fountain.io/syntax — "Scene Headings") -----------------

describe("scene headings", () => {
  it("recognises INT./EXT. prefixed headings after a blank line", () => {
    expect(types(`EXT. BRICK'S POOL - DAY\n\nAction here.\n`)).toEqual([
      "scene",
      "blank",
      "action",
      "blank",
    ]);
  });

  it("is case-insensitive", () => {
    expect(lineAt(`\next. brick's pool - day\n\nSome action`, "ext.")).toBe("scene");
  });

  it("supports INT/EXT, I/E and EST variants", () => {
    for (const h of ["INT/EXT. HOUSE - DAY", "I/E. HOUSE - DAY", "EST. ORBIT - NIGHT"]) {
      expect(lineAt(`\n${h}\n\nAction`, h)).toBe("scene");
    }
  });

  it("forced heading with leading period", () => {
    expect(lineAt(`STEEL\nThey're coming!\n\n.SNIPER SCOPE POV\nFrom inches away.`, "SNIPER")).toBe(
      "scene",
    );
  });

  it("does not treat '...ellipses' action as a forced heading", () => {
    expect(
      lineAt(`EXT. OLYMPIA CIRCUS - NIGHT\n...where the carnival is parked.`, "where"),
    ).toBe("action");
  });

  it("exclamation-forced action is not a scene heading even if uppercase", () => {
    expect(lineAt(`\n!SMASH CUT TO:\n`, "SMASH")).toBe("action");
  });

  it("scene numbers decorate the tail of a heading", () => {
    const lines = classify(`\nINT. HOUSE - DAY #12A#\n`);
    const scene = lines.find(l => l.type === "scene");
    expect(scene).toBeDefined();
    const spans = spansFor(scene!);
    expect(spans.some(s => s.cls === "sceneno")).toBe(true);
  });
});

// Character & dialogue ("Character", "Dialogue") -------------------------

describe("characters and dialogue", () => {
  it("uppercase line, blank before, text after → character + dialogue", () => {
    expect(types(`\nSTEEL\nThe man's a myth!\n`)).toEqual([
      "blank",
      "character",
      "dialogue",
      "blank",
    ]);
  });

  it("character extensions (V.O., O.S., CONT'D) stay characters", () => {
    for (const c of ["STEEL (V.O.)", "STEEL (O.S.)", "STEEL (CONT'D)"]) {
      expect(lineAt(`\n${c}\nSome line.`, c)).toBe("character");
    }
  });

  it("an uppercase line followed by blank is action, not character", () => {
    expect(lineAt(`\nHE GRABS THE CAN\n\nAnd shoots it.`, "CAN")).toBe("action");
  });

  it("forced character with @", () => {
    expect(lineAt(`\n@McCLANE\nYipee-ki-yo.\n`, "McCLANE")).toBe("character");
  });

  it("forced action with ! prevents character misread", () => {
    expect(types(`\n!THE MAN\nappears behind her.\n`)).toEqual([
      "blank",
      "action",
      "action",
      "blank",
    ]);
  });

  it("parentheticals inside dialogue", () => {
    expect(types(`\nSTEEL\n(pause)\nNo, everybody we've put away!\n`)).toEqual([
      "blank",
      "character",
      "parenthetical",
      "dialogue",
      "blank",
    ]);
  });

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
});

// Dual dialogue ("Dual Dialogue") ----------------------------------------

describe("dual dialogue", () => {
  it("two cues around an '=' separator", () => {
    const doc = `
STEEL
They're coming out of the woodwork!
=
BRICK
Who?!
`;
    expect(types(doc)).toEqual([
      "blank",
      "character",
      "dialogue",
      "dual_separator",
      "character",
      "dialogue",
      "blank",
    ]);
  });
});

// Transitions ("Transitions") ---------------------------------------------

describe("transitions", () => {
  it("uppercase line ending TO:", () => {
    expect(lineAt(`\nCUT TO:\n`, "CUT TO")).toBe("transition");
  });
  it("forced with >", () => {
    expect(lineAt(`\n> Even a gentle fade.\n`, "Even")).toBe("transition");
  });
  it("lowercase 'to:' line is NOT a transition", () => {
    expect(lineAt(`\nand then fade to:\n`, "fade")).toBe("action");
  });
});

// Notes ("Notes") ----------------------------------------------------------

describe("notes", () => {
  it("inline note", () => {
    expect(lineAt(`\n[[like this]]\n`, "like this")).toBe("note");
  });
  it("multiline note stays note-typed", () => {
    const lines = classify(`\n[[a note\nthat spans lines]]\nnext action.\n`);
    const noteLines = lines.filter(l => l.type === "note");
    expect(noteLines).toHaveLength(2);
    expect(lineAt(`\n[[a note\nthat spans lines]]\nnext action.\n`, "next")).toBe("action");
  });
});

// Sections / synopses / page breaks / lyrics --------------------------------

describe("structure elements", () => {
  it("sections and synopses", () => {
    expect(lineAt(`\n=== ACT ONE ===\n`, "ACT")).toBe("section");
    expect(lineAt(`\n== setup ==\n`, "setup")).toBe("synopsis");
  });
  it("page break", () => {
    expect(lineAt(`\n>>>\n`, ">>>")).toBe("page_break");
    expect(lineAt(`\n<<<\n`, "<<<")).toBe("page_break");
  });
  it("single-line lyric", () => {
    expect(lineAt(`\n% Here Lies Love %\n`, "Here")).toBe("lyric");
  });
});

// Inline emphasis ("Sections and Synopses" / emphasis rules) ---------------

describe("inline emphasis", () => {
  const text = `Action with _*underword*_ words, **strongword**, *emphasisword*, ***biword***.`;
  const cls = (needle: string) => {
    const line = classify(text)[0];
    return spansFor(line)
      .filter(s => text.slice(s.from, s.to).includes(needle))
      .map(s => s.cls);
  };
  it("underline via _*x*_", () => expect(cls("underword")).toEqual(["underline"]));
  it("bold via **x**", () => expect(cls("strongword")).toEqual(["bold"]));
  it("italic via *x*", () => expect(cls("emphasisword")).toEqual(["italic"]));
  it("bold-italic via ***x***", () => expect(cls("biword")).toEqual(["bolditalic"]));
});

// Auto-detection -----------------------------------------------------------

describe("detectFountain", () => {
  it("screenplay-like document", () => {
    expect(detectFountain(classify(`\nEXT. HOUSE - DAY\n\nSTEEL\nHello.`))).toBe(true);
  });
  it("plain prose is not a screenplay", () => {
    expect(detectFountain(classify(`The quick brown fox.\nJumps over the lazy dog.`))).toBe(false);
  });
  it("markdown notes file is not a screenplay", () => {
    const md = `# Heading\n\n- item one\n- item two\n\nSome prose with **bold**.`;
    expect(detectFountain(classify(md))).toBe(false);
  });
});
