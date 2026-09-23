import { describe, expect, it } from "vitest";
import { renderFountainHtml } from "../src/render";

const script = `Title: THE DEMO
Credit: written by
Author: fountain-cm6

===

INT. MARKEDIT WINDOW - DAY

A blinking cursor waits. The writer cracks their knuckles.

STEEL
They're coming out of the woodwork!
(pause)
Point Blank Sniper?

EXT. GARDEN - NIGHT

BRICK
Who?!
`;

describe("renderFountainHtml", () => {
  const html = renderFountainHtml(script);

  it("renders a title page", () => {
    expect(html).toContain('class="fp-titlepage"');
    expect(html).toContain("THE DEMO");
  });

  it("numbers scene headings sequentially and bolds them", () => {
    expect(html).toContain('class="fp-scene"');
    expect(html).toContain('fp-sceneno">1.</span>');
    expect(html).toContain('fp-sceneno">2.</span>');
  });

  it("renders character cues uppercase with AWG indent class", () => {
    expect(html).toContain('class="fp-character"');
    expect(html).toContain("STEEL");
  });

  it("renders dialogue and parentheticals with their classes", () => {
    expect(html).toContain('class="fp-dialogue"');
    expect(html).toContain('class="fp-parenthetical"');
  });

  it("escapes HTML in script text", () => {
    const hostile = renderFountainHtml("EXT. X - DAY\n\n<script>alert(1)</script>\n");
    expect(hostile).not.toContain("<script>alert");
  });
});