import { describe, expect, it } from "vitest";
import { renderFountainHtml } from "../src/render";

const script = `Title: THE DEMO
Credit: written by
Author: dot-fountain

===

# Act One

= Our hero arrives.

INT. MARKEDIT WINDOW - DAY

A blinking cursor waits. The writer cracks their knuckles.

STEEL
They're coming out of the woodwork!
(pause)
Point Blank Sniper?

[[This is a note that must not appear.]]

/* Dead scene
that must not appear either. */

EXT. GARDEN - NIGHT #7#

BRICK
Who?!
`;

describe("renderFountainHtml", () => {
  const html = renderFountainHtml(script);

  it("renders a title page", () => {
    expect(html).toContain('class="fp-titlepage"');
    expect(html).toContain("THE DEMO");
  });

  it("numbers scene headings sequentially with bold left+right numbers", () => {
    expect(html).toContain('class="fp-scene"');
    expect(html).toContain('fp-sceneno">1</span>');
    // explicit #7# overrides auto-numbering:
    expect(html).toContain('fp-sceneno">7</span>');
  });

  it("right-hand scene number class present", () => {
    expect(html).toContain("fp-sceneno-r");
  });

  it("renders character cues uppercase with indent class", () => {
    expect(html).toContain('class="fp-character"');
    expect(html).toContain("STEEL");
  });

  it("renders dialogue and parentheticals with their classes", () => {
    expect(html).toContain('class="fp-dialogue"');
    expect(html).toContain('class="fp-parenthetical"');
  });

  it("sections, synopses, notes and boneyard are absent from output", () => {
    expect(html).not.toContain("Act One");
    expect(html).not.toContain("Our hero arrives");
    expect(html).not.toContain("must not appear");
    expect(html).not.toContain("Dead scene");
  });

  it("renders === page break as a rule", () => {
    const paged = renderFountainHtml("INT. A - DAY\n\nAction.\n\n===\n\nINT. B - NIGHT\n");
    expect(paged).toContain('hr class="fp-pagebreak"');
  });

  it("escapes HTML in script text", () => {
    const hostile = renderFountainHtml("EXT. X - DAY\n\n<script>alert(1)</script>\n");
    expect(hostile).not.toContain("<script>alert");
  });

  it("strips emphasis markers in title and nests emphasis (Big Fish case)", () => {
    const html = renderFountainHtml("Title: _Big Fish_\n\n====\n\nINT. A - DAY\n");
    // underline rendered, markers NOT visible
    expect(html).toContain("<u>Big Fish</u>");
    expect(html).not.toContain("_Big Fish_");
  });

  it("nested emphasis inside underline renders both tags", () => {
    const html = renderFountainHtml(
      "Title: _an *italic* word_\n\n====\n\nINT. A - DAY\n",
    );
    expect(html).toContain("<u>an <i>italic</i> word</u>");
  });
});