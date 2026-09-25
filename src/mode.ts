// Mode toggle: "Live Preview Edit" (screenplay styling) ↔ "Fountain
// (markdown)" (raw source, styling off). Portable CM6 — no host imports.
// Hosts add `modeField` and dispatch `setMode`; menus read `getMode`.

import { StateEffect, StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/** Fountain render mode. */
export type FountainMode = "preview" | "source";

export const setMode = StateEffect.define<FountainMode>();

export const modeField: StateField<FountainMode> & { [k: string]: any } = StateField.define<FountainMode>({
  create: () => "preview",
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setMode)) return e.value;
    }
    return value;
  },
});

/**
 * Current mode. Robust when the host didn't add modeField to its
 * extensions: CM6's state.field() throws on an absent field even with
 * a default argument — so guard and fall back to "preview".
 */
export function getMode(state: { field: (f: StateField<FountainMode>, default_: FountainMode) => FountainMode }): FountainMode {
  try {
    return state.field(modeField, "preview");
  } catch {
    return "preview";
  }
}

/** Dispatch a mode flip (preview ↔ source). */
export function toggleMode(view: EditorView): boolean {
  const next = getMode(view.state) === "preview" ? "source" : "preview";
  view.dispatch({ effects: setMode.of(next) });
  return true;
}