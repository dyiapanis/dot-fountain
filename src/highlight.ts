// CodeMirror 6 layer: turn the pure classifier into decorations.
// One ViewPlugin, recomputed on doc/viewport change. Fountain files are
// line-oriented and small (a 120-page script is ~50KB); a full re-parse
// per update is cheap and keeps context-sensitive elements correct.
//
// NOTE: this module imports @codemirror/* but NEVER any host package —
// it runs in MarkEdit, Obsidian, the browser playground, or tests alike.

import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { classify, detectFountain } from "./classify";
import { spansFor } from "./spans";
import { getMode, setMode } from "./mode";

/** Line class names: `mf-scene`, `mf-character`, … */
export const lineClass = (type: string) => `mf-${type}`;
/** Span class names: `mf-note`, `mf-bold`, … */
export const spanClass = (cls: string) => `mf-${cls}`;

class PageBreakWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "mf-pagebreak";
    el.setAttribute("role", "presentation");
    return el;
  }
  override get estimatedHeight(): number {
    return 26;
  }
}

const lineDecos = new Map<string, Decoration>();
function lineDeco(type: string): Decoration | null {
  if (type === "blank" || type === "action") return null; // no decoration
  let d = lineDecos.get(type);
  if (!d) {
    d = Decoration.line({ class: lineClass(type) });
    lineDecos.set(type, d);
  }
  return d;
}

const spanDecos = new Map<string, Decoration>();
function markDeco(cls: string): Decoration {
  let d = spanDecos.get(cls);
  if (!d) {
    d = Decoration.mark({ class: spanClass(cls) });
    spanDecos.set(cls, d);
  }
  return d;
}

export function fountainDecorations(view: EditorView, force = false): DecorationSet {
  const text = view.state.doc.toString();
  if (!force && !detectFountain(text)) return Decoration.none;
  if (getMode(view.state) === "source") return Decoration.none;
  const lines = classify(text);
  const builder = new RangeSetBuilder<Decoration>();
  let lastPos = -1;
  const add = (from: number, to: number, deco: Decoration) => {
    // RangeSetBuilder requires strictly increasing ranges; classification
    // yields line decos (point, at line start) before marks for the same
    // line, and marks never overlap (coverage mask), so this holds —
    // guard anyway against regressions.
    if (from < lastPos) return;
    builder.add(from, to, deco);
    lastPos = to === from ? from : to;
  };

  for (const line of lines) {
    const ld = lineDeco(line.type);
    if (ld) add(line.from, line.from, ld);
    if (line.type === "page_break") {
      add(line.to, line.to, Decoration.widget({ widget: new PageBreakWidget(), side: 1 }));
    }
    for (const s of spansFor(line)) {
      if (s.from === s.to) continue;
      add(s.from, s.to, markDeco(s.cls));
    }
  }
  return builder.finish();
}

/**
 * Fountain highlighting extension: colors scene headings, character
 * cues, dialogue, parentheticals, transitions, notes, sections,
 * synopses, lyrics, page breaks and inline emphasis.
 *
 * By default the plugin auto-detects whether the current document is
 * Fountain and stays silent on ordinary markdown. Pass `{ force: true }`
 * to decorate unconditionally (e.g. a dedicated .fountain playground).
 */
export function fountainHighlight(opts: { force?: boolean } = {}): Extension {
  const force = opts.force ?? false;
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = fountainDecorations(view, force);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.transactions.some(tr => tr.effects.some(e => e.is(setMode)))) {
          this.decorations = fountainDecorations(update.view, force);
        }
      }
    },
    { decorations: v => v.decorations },
  );
}
