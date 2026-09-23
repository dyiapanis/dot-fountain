// fountain-cm6 — core classifier for Fountain (fountain.io) syntax.
// Pure logic: no CodeMirror or host imports, unit-testable anywhere.
//
// Element detection follows the official spec at https://fountain.io/syntax/
// (reviewed September 2026). The golden rule: "make it look like a
// screenplay" — detection is line/paragraph-block oriented.

export type LineType =
  | "blank"
  | "action"
  | "scene"
  | "character"
  | "dual_separator"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "section"
  | "synopsis"
  | "note"
  | "page_break"
  | "lyric";

export interface LineInfo {
  /** absolute offset of the line start in the document */
  from: number;
  /** absolute offset of the line end (excludes the newline) */
  to: number;
  text: string;
  type: LineType;
}

// Scene-heading prefixes per spec, followed by a dot or a space.
// Longest alternatives first. Case-insensitive.
const SCENE_PREFIX = /^(INT\.?\/EXT\.|INT\/EXT|I\/E|I\.E|EST|INT|EXT)(?=[.\s])/i;
// Forced scene heading: exactly one leading period, then alphanumeric.
const FORCED_SCENE = /^\.(?![.\s])[A-Za-z0-9]/;
// Character cues may contain uppercase letters, digits and screenplay
// punctuation, and must contain at least one letter. Extensions like
// (V.O.), (O.S.), (CONT'D) are common.
const CHARACTER_BODY = /^[A-Z][A-Z0-9 .'\u2019()\-]*$/;
const TRANSITION_TO = /TO:[ \t]*$/;
const DUAL_SEPARATOR = /^=[ \t]*$/; // standalone '=' line
const PAGE_BREAK = /^[<>]{3,}[ \t]*$/; // '>>>' / '<<<' (3 or more)
const SECTION = /^={3,}[ \t]*\S/;
const SYNOPSIS = /^={2}[^=]/;
const LYRIC_BLOCK_START = /^%[^%]*$/; // opens until a closing %
const LYRIC_INLINE = /^%[^%]+%[ \t]*$/;

const isBlank = (s: string) => s.trim() === "";

function isCharacterBody(trimmed: string): boolean {
  if (TRANSITION_TO.test(trimmed)) return false;
  if (trimmed.toUpperCase() !== trimmed) return false;
  if (!/[A-Z]/.test(trimmed)) return false;
  return CHARACTER_BODY.test(trimmed);
}

/**
 * Classify every physical line of a Fountain document.
 * State machine: dialogue blocks, lyric blocks and multi-line notes
 * depend on preceding context, exactly like the reference parsers.
 */
export function classify(doc: string): LineInfo[] {
  const raw = doc.split(/\r\n|\r|\n/);
  const out: LineInfo[] = [];

  let offset = 0;
  let inDialogue = false;
  let inNote = false;
  let inLyric = false;
  let afterDual = false; // '=' separator seen: next line is the 2nd speaker
  let dialogueRecently = false; // last non-blank line was dialogue-ish

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const from = offset;
    const to = offset + line.length;
    offset = to + 1;

    const t = line.trim();
    const prevBlank = i === 0 || isBlank(raw[i - 1]);
    const nextBlank = i === raw.length - 1 || isBlank(raw[i + 1]);

    let type: LineType = "action";

    if (inNote) {
      type = "note";
      if (t.includes("]]")) inNote = false;
    } else if (inLyric) {
      type = "lyric";
      if (t.includes("%")) inLyric = false;
    } else if (t === "") {
      type = "blank";
      inDialogue = false;
    } else if (afterDual) {
      // second speaker of dual dialogue — cue regardless of case rules
      type = "character";
      afterDual = false;
      inDialogue = true;
    } else if (DUAL_SEPARATOR.test(t) && dialogueRecently) {
      // '=' between the two Character elements, no blank lines required
      type = "dual_separator";
      afterDual = true;
    } else if (inDialogue) {
      if (/^\(.*\)$/.test(t)) {
        type = "parenthetical";
      } else if (
        FORCED_SCENE.test(t) ||
        t.startsWith(">") ||
        t.startsWith("!") ||
        t.startsWith("@") ||
        t.startsWith("==") ||
        PAGE_BREAK.test(t)
      ) {
        // block-level constructs break out of the dialogue block
        inDialogue = false;
        type = classifyOutside(t, prevBlank, nextBlank);
      } else {
        type = "dialogue";
      }
    } else {
      type = classifyOutside(t, prevBlank, nextBlank);
      if (type === "character") inDialogue = true;
      if (type === "note" && t.startsWith("[[") && !t.endsWith("]]")) inNote = true;
      if (type === "lyric" && LYRIC_BLOCK_START.test(t)) inLyric = true;
    }

    if (type !== "blank") {
      dialogueRecently =
        type === "character" ||
        type === "dialogue" ||
        type === "parenthetical" ||
        type === "dual_separator";
    }

    out.push({ from, to, text: line, type });
  }

  return out;
}

// Classification of a non-blank line outside dialogue blocks.
function classifyOutside(t: string, prevBlank: boolean, nextBlank: boolean): LineType {
  if (t.startsWith("[[")) return "note";
  if (SECTION.test(t)) return "section";
  if (SYNOPSIS.test(t)) return "synopsis";
  if (PAGE_BREAK.test(t)) return "page_break";
  if (LYRIC_INLINE.test(t) || LYRIC_BLOCK_START.test(t)) return "lyric";
  if (t.startsWith("!")) return "action"; // forced action
  if (t.startsWith("@")) return "character"; // forced character
  if (FORCED_SCENE.test(t)) return "scene"; // forced scene heading
  if (t.startsWith(">")) return "transition"; // forced transition
  if (prevBlank && SCENE_PREFIX.test(t)) return "scene";
  if (prevBlank && TRANSITION_TO.test(t) && t.toUpperCase() === t) return "transition";
  if (prevBlank && !nextBlank && isCharacterBody(t)) return "character";
  return "action";
}

/** Heuristic: does this document look like a screenplay? */
export function detectFountain(lines: LineInfo[]): boolean {
  let cues = 0;
  for (const l of lines) {
    switch (l.type) {
      case "scene":
      case "dual_separator":
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
