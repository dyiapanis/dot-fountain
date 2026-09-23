// Editor commands built on the classifier: scene navigation + stats.
// Pure CM6 — no host imports.

import { EditorSelection, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { classify, detectFountain } from "./classify";

export interface FountainStats {
  scenes: number;
  words: number;      // action + dialogue words, excl. notes/synopses
  dialogueWords: number;
}

/** Classify once and collect stats. O(doc) — fine for real scripts. */
export function fountainStats(docText: string): FountainStats {
  const lines = classify(docText);
  let scenes = 0;
  let words = 0;
  let dialogueWords = 0;
  for (const line of lines) {
    if (line.type === "scene") scenes++;
    if (line.type === "action" || line.type === "dialogue") {
      const w = line.text.trim().length ? line.text.trim().split(/\s+/).length : 0;
      words += w;
      if (line.type === "dialogue") dialogueWords += w;
    }
  }
  return { scenes, words, dialogueWords };
}

/** All positions where a scene heading starts. */
export function scenePositions(view: EditorView): number[] {
  return classify(view.state.doc.toString())
    .filter(l => l.type === "scene")
    .map(l => l.from);
}

function gotoScene(view: EditorView, forward: boolean): boolean {
  // Silent on non-Fountain documents: return false so the next handler
  // in the keymap chain (or the host's default binding) runs instead.
  if (!detectFountain(view.state.doc.toString())) return false;
  const cursor = view.state.selection.main.head;
  const scenes = scenePositions(view);
  if (scenes.length === 0) return false;
  const target = forward
    ? scenes.find(p => p > cursor)
    : [...scenes].reverse().find(p => p < cursor);
  if (target === undefined) return false;
  view.dispatch({
    selection: EditorSelection.cursor(target),
    scrollIntoView: true,
  });
  return true;
}

export const gotoNextScene = (view: EditorView): boolean => gotoScene(view, true);
export const gotoPrevScene = (view: EditorView): boolean => gotoScene(view, false);

/** Keymap usable by any CM6 host. MarkEdit glue registers its own menu. */
export function fountainKeymap(): Extension {
  return keymap.of([
    { key: "Alt-ArrowDown", run: gotoNextScene },
    { key: "Alt-ArrowUp", run: gotoPrevScene },
  ]);
}