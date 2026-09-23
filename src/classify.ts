// fountain-cm6 — core classifier for Fountain (fountain.io) syntax.
// Pure logic: no CodeMirror or host imports, unit-testable anywhere.
//
// Element rules per the official spec at https://fountain.io/syntax/
// (reviewed September 2026):
//   scene         INT/EXT/EST/I/E… prefix, or forced with a leading `.`;
//                 optional trailing scene number `#12A#`
//   action        anything else; forced with `!`; centered with `>text<`
//   character     uppercase line, blank before, text after; forced with
//                 `@`; dual-dialogue second cue ends with `^`
//   parenthetical `(...)` inside a dialogue block
//   dialogue      lines after a character, until a blank line
//   transition    uppercase ending in TO:, blank-surrounded; forced with `>`
//   section       ATX `#`/`##`/`###` — writing tool, ignored in output
//   synopsis      `= text` — ignored in output
//   note          `[[...]]` — ignored in output
//   boneyard      `/* ... */` — ignored in output
//   lyric         `~` prefix
//   page break    `===` (three or more, alone on the line)

export type LineType =
  | "blank"
  | "action"
  | "scene"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "centered"
  | "section"
  | "synopsis"
  | "note"
  | "boneyard"
  | "page_break"
  | "lyric";

export interface LineInfo {
  /** absolute offset of the line start in the document */
  from: number;
  /** absolute offset of the line end (excludes the newline) */
  to: number;
  text: string;
  type: LineType;
  /** dual-dialogue cue (trailing `^` per spec) */
  dual?: boolean;
  /** section nesting level: `#` = 1, `##` = 2, … */
  level?: number;
  /** explicit scene number extracted from `#12A#` */
  sceneNumber?: string;
}

// Scene-heading prefixes per spec, followed by a dot or a space.
const SCENE_PREFIX = /^(INT\.?\/EXT\.?|I\/E|EST|INT|EXT)(?=[.\s])/i;
// Forced scene heading: exactly one leading period, then alphanumeric.
const FORCED_SCENE = /^\.(?![.\s])[A-Za-z0-9]/;
const CHARACTER_BODY = /^[A-Z][A-Z0-9 .'\u2019()\-]*$/;
const TRANSITION_TO = /TO:[ \t]*$/;
// Named transitions real scripts use (pattern set adopted from
// dethbird/fountain-writer, Apache-2.0 — broader than bare "TO:").
const TRANSITION_NAMED =
  /^(?:FADE(?: IN| OUT| TO BLACK)?[:.]|CUT TO BLACK\.|SMASH CUT TO:|MATCH CUT TO:|DISSOLVE TO:|WIPE TO:|BACK TO:)/i;
const PAGE_BREAK = /^={3,}$/; // three or more, alone
const SECTION = /^(#{1,})[ \t]+\S/;
const SYNOPSIS = /^=(?!=)[ \t]*\S/;
const LYRIC = /^~[ \t]*\S/;
const CENTERED = /^>.+<$/;
const SCENE_NUMBER = /#([^#\s]+)#[ \t]*$/;
const DUAL_MARK = /\^[ \t]*$/;

const isBlank = (s: string) => s.trim() === "";

function isCharacterBody(trimmed: string): boolean {
  const body = trimmed.replace(DUAL_MARK, "").trim();
  if (TRANSITION_TO.test(body)) return false;
  if (!/[A-Z]/.test(body)) return false;
  return CHARACTER_BODY.test(body);
}

interface Classified {
  type: LineType;
  dual?: boolean;
  level?: number;
  sceneNumber?: string;
}

function classifyOutside(t: string, prevBlank: boolean, nextBlank: boolean): Classified {
  if (t.startsWith("/*")) return { type: "boneyard" };
  if (t.startsWith("[[")) return { type: "note" };
  if (PAGE_BREAK.test(t)) return { type: "page_break" };

  const sec = SECTION.exec(t);
  if (sec) return { type: "section", level: sec[1].length };

  if (SYNOPSIS.test(t)) return { type: "synopsis" };
  if (LYRIC.test(t)) return { type: "lyric" };
  if (CENTERED.test(t)) return { type: "centered" };

  if (t.startsWith("!")) return { type: "action" }; // forced action
  if (t.startsWith("@")) return { type: "character", dual: DUAL_MARK.test(t) };
  if (FORCED_SCENE.test(t)) {
    return { type: "scene", sceneNumber: SCENE_NUMBER.exec(t)?.[1] };
  }
  if (t.startsWith(">")) return { type: "transition" }; // forced transition

  if (prevBlank && nextBlank && SCENE_PREFIX.test(t)) {
    return { type: "scene", sceneNumber: SCENE_NUMBER.exec(t)?.[1] };
  }
  if (
    prevBlank && nextBlank &&
    (TRANSITION_TO.test(t) || TRANSITION_NAMED.test(t)) &&
    /[A-Z]/.test(t) && t === t.toUpperCase()
  ) {
    return { type: "transition" };
  }
  if (prevBlank && !nextBlank && isCharacterBody(t)) {
    return { type: "character", dual: DUAL_MARK.test(t) };
  }
  return { type: "action" };
}

// Forced/block constructs break out of a dialogue block (matches the
// reference parsers: a forced element is honored anywhere).
function isBlockConstruct(t: string): boolean {
  return (
    FORCED_SCENE.test(t) ||
    PAGE_BREAK.test(t) ||
    /^[>!@~#]|\/\*|\[\[/.test(t)
  );
}

/**
 * Classify every physical line of a Fountain document.
 * State machine: dialogue blocks and multi-line notes/boneyards depend
 * on preceding context, exactly like the reference parsers.
 */
export function classify(doc: string): LineInfo[] {
  const raw = doc.split(/\r\n|\r|\n/);
  const out: LineInfo[] = [];

  let offset = 0;
  let inDialogue = false;
  let inNote = false;
  let inBoneyard = false;

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const from = offset;
    const to = offset + line.length;
    offset = to + 1;

    const t = line.trim();
    const prevT = i === 0 ? "" : raw[i - 1].trim();
    // `===`, `*/`, `]]` act as structural separators: an element after
    // them is still "preceded by a blank" for spec purposes.
    const prevBlank =
      i === 0 || isBlank(prevT) ||
      PAGE_BREAK.test(prevT) || prevT === "*/" || prevT === "]]";
    const nextBlank = i === raw.length - 1 || isBlank(raw[i + 1]);

    let type: LineType = "action";
    let dual: boolean | undefined;
    let level: number | undefined;
    let sceneNumber: string | undefined;

    if (inBoneyard) {
      type = "boneyard";
      if (t.includes("*/")) inBoneyard = false;
    } else if (inNote) {
      type = "note";
      if (t.includes("]]")) inNote = false;
    } else if (t === "") {
      type = "blank";
      inDialogue = false;
    } else if (t.startsWith("/*") && !t.slice(2).includes("*/")) {
      type = "boneyard"; // multi-line boneyard opener
      inBoneyard = true;
    } else if (t.startsWith("[[") && !t.slice(2).includes("]]")) {
      type = "note"; // multi-line note opener
      inNote = true;
    } else if (inDialogue) {
      if (/^\(.*\)$/.test(t)) {
        type = "parenthetical";
      } else if (isBlockConstruct(t)) {
        const r = classifyOutside(t, prevBlank, nextBlank);
        type = r.type;
        dual = r.dual;
        level = r.level;
        sceneNumber = r.sceneNumber;
        inDialogue = type === "character";
      } else {
        type = "dialogue";
      }
    } else {
      const r = classifyOutside(t, prevBlank, nextBlank);
      type = r.type;
      dual = r.dual;
      level = r.level;
      sceneNumber = r.sceneNumber;
      if (type === "character") inDialogue = true;
    }

    out.push({
      from,
      to,
      text: line,
      type,
      ...(dual && { dual }),
      ...(level && { level }),
      ...(sceneNumber && { sceneNumber }),
    });
  }

  return out;
}

/**
 * Heuristic: does this document look like a screenplay?
 * Accepts raw text (classifies internally) or pre-classified lines.
 */
export function detectFountain(input: string | LineInfo[]): boolean {
  const lines = typeof input === "string" ? classify(input) : input;
  let cues = 0;
  for (const l of lines) {
    switch (l.type) {
      case "scene":
      case "page_break":
      case "synopsis":
      case "lyric":
        return true;
      case "character":
        if (++cues >= 2) return true;
        break;
      default:
        break;
    }
  }
  return false;
}