// Fountain outline model: the screenplay's structure as a cascade tree.
// Sections (#, ##, ###) are depth 1-3 tree nodes; scenes, synopses and
// notes nest under them with indentation. Scene numbering matches the
// preview pane exactly (auto 1,2,3…; explicit #N# overrides).
// Pure core — no host imports.

import { classify } from "./classify";
import { parseTitlePage } from "./render-title";

export interface OutlineItem {
  kind: "section" | "scene" | "synopsis" | "note";
  depth: number;          // section: 1..3; others: parent section depth + 1
  label: string;         // display text (marker chars stripped)
  sceneNumber: string;   // scenes only: "1", "2A", …
  from: number;          // absolute doc offset (click-to-jump target)
  to: number;            // end of the heading line
}

const MAX_SECTION_DEPTH = 3;

/** Clean a section heading: "#  Act One" -> "Act One". */
function sectionLabel(text: string): string {
  return text.replace(/^[ \t]*#+[ \t]*/, "").trim();
}

/** Clean a scene heading for the outline label (mirrors render.ts). */
function sceneLabel(text: string, forced: boolean): string {
  let body = text;
  if (forced && body.startsWith(".")) body = body.slice(1);
  return body.replace(/#[^#\s]+#[ \t]*$/, "").trim();
}

/** Was this scene classified as forced (.INT. ...) vs auto (INT. ...)? */
function isForcedScene(text: string): boolean {
  return /^\.(?![.\s])[A-Za-z0-9]/.test(text);
}

/**
 * Build the screenplay outline. Scene numbering matches renderFountainHtml
 * exactly: scenes counted from the first body line (after the title page),
 * explicit #N# numbers take precedence.
 */
export function buildOutline(text: string): OutlineItem[] {
  const lines = classify(text);
  const { bodyStart } = parseTitlePage(lines);

  const out: OutlineItem[] = [];
  let sceneNo = 0;
  let currentSectionDepth = 0;

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.type === "section") {
      const hashes = line.text.match(/^[ \t]*(#+)/)?.[1].length ?? 1;
      const depth = Math.min(hashes, MAX_SECTION_DEPTH);
      currentSectionDepth = depth;
      out.push({
        kind: "section",
        depth,
        label: sectionLabel(line.text),
        sceneNumber: "",
        from: line.from,
        to: line.to,
      });
    } else if (line.type === "scene") {
      sceneNo += 1;
      const numbered = line.sceneNumber ?? String(sceneNo);
      out.push({
        kind: "scene",
        depth: currentSectionDepth + 1,
        label: sceneLabel(line.text, isForcedScene(line.text)),
        sceneNumber: numbered,
        from: line.from,
        to: line.to,
      });
    } else if (line.type === "synopsis") {
      // Cascade tree: synopses and notes nest under their section
      // (or at top level before any section appears).
      out.push({
        kind: "synopsis",
        depth: currentSectionDepth + 1,
        label: line.text.replace(/^[ \t]*=?[ \t]*/, "").trim(),
        sceneNumber: "",
        from: line.from,
        to: line.to,
      });
    } else if (line.type === "note") {
      out.push({
        kind: "note",
        depth: currentSectionDepth + 1,
        label: line.text.replace(/^[ \t]*\[\[|[ \t]*\]\][ \t]*$/g, "").trim(),
        sceneNumber: "",
        from: line.from,
        to: line.to,
      });
    }
  }
  return out;
}