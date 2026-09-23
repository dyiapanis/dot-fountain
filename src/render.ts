// Fountain → screenplay HTML renderer (portable core, no host imports).
// Geometry per AWG "Suggested Script Layout": margins 3.9cm left /
// 2.5cm others, Courier 12pt, dialogue 3.4cm in from both sides,
// character cue 5.4cm, parenthetical 4.4cm. Scene numbers left AND
// right (bold), per user preference / AWG layout.
//
// Spec-excluded elements (sections, synopses, notes, boneyard) do NOT
// appear in formatted output — fountain.io: "ignored completely".

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
        parts.push(`<p class="${cls}">${inlineEmphasis(ln, false)}</p>`);
    }
    }
    if (title.lower.length > 0) {
      parts.push('<div class="fp-title-lower">');
      for (const [, value] of title.lower) {
        for (const ln of value.split("\n")) {
          parts.push(`<p>${inlineEmphasis(ln, false)}</p>`);
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

    // Spec: sections, synopses, notes and boneyard are ignored in
    // formatted output entirely.
    if (
      line.type === "section" ||
      line.type === "synopsis" ||
      line.type === "note" ||
      line.type === "boneyard"
    ) {
      continue;
    }

    // Forced-prefix cleanup for output: strip leading marker chars.
    let body = line.text;
    if (line.type === "scene" && body.startsWith(".")) body = body.slice(1);
    if (line.type === "transition" && body.startsWith(">")) body = body.slice(1);
    if (line.type === "centered") body = body.slice(1, -1);
    if (line.type === "character" && body.startsWith("@")) body = body.slice(1);
    if (line.type === "character") body = body.replace(/\^[ \t]*$/, "");
    if (line.type === "action" && body.startsWith("!")) body = body.slice(1);
    if (line.type === "lyric") body = body.replace(/^~[ \t]?/, "");

    const numbered = line.sceneNumber ?? String(sceneNo + 1);
    if (line.type === "scene") sceneNo += 1;

    switch (line.type) {
      case "scene": {
        const text2 = body.replace(/#[^#\s]+#[ \t]*$/, "").trim();
        const html = inlineEmphasis(text2, false);
        parts.push(
          `<p class="fp-scene">` +
          `<span class="fp-sceneno">${esc(numbered)}</span>` +
          `${html}` +
          `<span class="fp-sceneno fp-sceneno-r">${esc(numbered)}</span>` +
          `</p>`,
        );
        break;
      }
      case "character":
        parts.push(`<p class="fp-character">${inlineEmphasis(body, false)}</p>`);
        break;
      case "parenthetical":
        parts.push(`<p class="fp-parenthetical">${inlineEmphasis(body, false)}</p>`);
        break;
      case "dialogue":
        parts.push(`<p class="fp-dialogue">${inlineEmphasis(body, false)}</p>`);
        break;
      case "transition":
        parts.push(`<p class="fp-transition">${inlineEmphasis(body, false)}</p>`);
        break;
      case "centered":
        parts.push(`<p class="fp-centered">${inlineEmphasis(body, false)}</p>`);
        break;
      case "lyric":
        parts.push(`<p class="fp-dialogue fp-lyric">${inlineEmphasis(body, false)}</p>`);
        break;
      case "page_break":
        parts.push('<hr class="fp-pagebreak">');
        break;
      default:
        parts.push(`<p class="fp-action">${inlineEmphasis(body, false)}</p>`);
    }
  }

  return `<div class="fp-script">${parts.join("")}</div>`;
}