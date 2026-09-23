// Fountain → screenplay HTML renderer (portable core, no host imports).
// Geometry per AWG "Suggested Script Layout": margins 3.9cm left /
// 2.5cm others, Courier 12pt, dialogue 3.4cm in from both sides,
// character cue 5.4cm, parenthetical 4.4cm, numbered bold uppercase
// scene headings. The host injects this HTML into a pane styled by
// preview.css.

import { classify } from "./classify";
import { esc, inlineEmphasis } from "./render-escape";
import { parseTitlePage } from "./render-title";

/** Render a full screenplay (title page + body) as HTML. */
export function renderFountainHtml(text: string): string {
  const lines = classify(text);
  const { title, bodyStart } = parseTitlePage(lines);

  const parts: string[] = [];

  if (title) {
    parts.push('<div class="fp-titlepage">');
    for (const [key, value] of title.center) {
      const cls = key === "title" ? "fp-title-title" : "fp-title-center";
      for (const ln of value.split("\n")) {
        parts.push(`<p class="${cls}">${esc(ln)}</p>`);
      }
    }
    if (title.lower.length > 0) {
      parts.push('<div class="fp-title-lower">');
      for (const [, value] of title.lower) {
        for (const ln of value.split("\n")) {
          parts.push(`<p>${esc(ln)}</p>`);
        }
      }
      parts.push("</div>");
    }
    parts.push("</div>");
  }

  let sceneNo = 0;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.type === "blank") continue;
    const body = inlineEmphasis(line.text, line.type === "scene");

    switch (line.type) {
      case "scene": {
        const m = line.text.match(/#([^#\s]+)#[ \t]*$/);
        if (m && m.index !== undefined) {
          const heading = line.text.slice(0, m.index).trim();
          parts.push(
            `<p class="fp-scene"><span class="fp-sceneno">${esc(m[1])}.</span> ${esc(heading)}</p>`,
          );
        } else {
          sceneNo += 1;
          parts.push(
            `<p class="fp-scene"><span class="fp-sceneno">${sceneNo}.</span> ${esc(line.text)}</p>`,
          );
        }
        break;
      }
      case "character":
        parts.push(`<p class="fp-character">${body}</p>`);
        break;
      case "parenthetical":
        parts.push(`<p class="fp-parenthetical">${body}</p>`);
        break;
      case "dialogue":
        parts.push(`<p class="fp-dialogue">${body}</p>`);
        break;
      case "dual_separator":
        parts.push('<p class="fp-dual">=</p>');
        break;
      case "transition":
        parts.push(`<p class="fp-transition">${body}</p>`);
        break;
      case "section":
        parts.push(`<p class="fp-section">${body}</p>`);
        break;
      case "synopsis":
        parts.push(`<p class="fp-synopsis">${body}</p>`);
        break;
      case "note":
        parts.push(`<p class="fp-note">${body}</p>`);
        break;
      case "lyric":
        parts.push(`<p class="fp-lyric">${body}</p>`);
        break;
      case "page_break":
        parts.push('<hr class="fp-pagebreak">');
        break;
      default:
        parts.push(`<p class="fp-action">${body}</p>`);
    }
  }

  return `<div class="fp-script">${parts.join("")}</div>`;
}