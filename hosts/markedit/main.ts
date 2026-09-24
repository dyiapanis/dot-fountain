// MarkEdit host glue for dot-fountain.
// Builds to ONE self-contained file: dot-fountain.js
// Install: ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
//
// This is the ONLY file that imports markedit-api. Everything else is
// portable CM6 (works in Obsidian, web, tests).
//
// Features:
// - Live Preview Edit / Fountain (markdown) editor-mode toggle
// - Preview pane on the right: a screenplay-formatted page,
//   re-rendered live while typing (pattern from MarkEdit-preview).
// - Outline pane on the left: screenplay structure (sections + scenes),
//   click to navigate; refreshes live while typing.

import { MarkEdit } from "markedit-api";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import {
  detectFountain,
  fountainHighlight,
  getMode,
  modeField,
  setMode,
  type FountainMode,
} from "../../src";
import { fountainKeymap, fountainStats, gotoNextScene, gotoPrevScene } from "../../src/commands";
import { buildOutline } from "../../src/outline";
import { renderFountainHtml } from "../../src/render";
import editorCss from "../../src/style.css?inline";
import previewCss from "../../src/preview.css?inline";
import outlineCss from "../../src/outline.css?inline";
import Split from "split-grid";

// ---------- stylesheets ----------
function appendStyleOnce(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

appendStyleOnce("dot-fountain-style", editorCss);
appendStyleOnce("dot-fountain-preview-style", previewCss);
appendStyleOnce("dot-fountain-outline-style", outlineCss);

// Host layout: when the pane is open, body becomes a 2-column grid —
// the editor's own container falls into column 1 (same technique as
// MarkEdit-preview's side-by-side mode), our pane into column 2.
appendStyleOnce(
  "dot-fountain-pane-style",
  `
  #fountain-split {
    display: grid;
    /* NOTE: split-grid parses each track strictly (px | fr | % | auto).
       minmax() breaks its parser -> "n is null" crash, dead divider.
       Plain fr tracks behave identically here.
       Columns: [outline] [gutter] [editor] [gutter] [preview] — each
       side pane adds its own columns; absent tracks collapse via
       grid-template-columns set at open time. */
    height: 100vh;
  }
  #fountain-split > #fountain-outline-pane { min-width: 0; overflow-y: auto; grid-column: 1; grid-row: 1; }
  #fountain-split > #fountain-outline-gutter {
    grid-column: 2;
    grid-row: 1;
    cursor: col-resize;
    display: flex;
    justify-content: center;
  }
  #fountain-split > #fountain-outline-gutter > div {
    width: 1px;
    height: 100%;
    background: rgba(128, 128, 128, 0.45);
  }
  #fountain-split > #editor { min-width: 0; grid-column: 3; grid-row: 1; }
  #fountain-split > #fountain-preview-gutter {
    grid-column: 4;
    grid-row: 1;
    cursor: col-resize;
    display: flex;
    justify-content: center;
  }
  #fountain-split > #fountain-preview-gutter > div {
    width: 1px;
    height: 100%;
    background: rgba(128, 128, 128, 0.45);
  }
  #fountain-split > #fountain-preview-pane { min-width: 0; overflow-y: auto; grid-column: 5; grid-row: 1; }
  `,
);

// Track layout per pane combination. split-grid needs plain tracks.
// Fixed five tracks: outline(1) gutter(2) editor(3) gutter(4) preview(5).
// Absent panes' tracks collapse to 0 — the placed children are simply
// absent, so the columns close over seamlessly.
function splitColumns(): string {
  const o = outlineOpen ? "240px" : "0px";
  const og = outlineOpen ? "5px" : "0px";
  const p = paneOpen ? "1.2fr" : "0px";
  const pg = paneOpen ? "5px" : "0px";
  return `${o} ${og} 1fr ${pg} ${p}`;
}

// ---------- outline pane ----------
const OUTLINE_ID = "fountain-outline-pane";
const OUTLINE_GUTTER_ID = "fountain-outline-gutter";
let outlineOpen = false;
let outlineSplitter: ReturnType<typeof Split> | undefined;

// The split container, created on first pane open of either kind.
// #editor gets wrapped so the grid children are exactly known.
function ensureSplit(): HTMLElement | null {
  let split = document.getElementById("fountain-split");
  if (split) return split;
  const editorHost = document.getElementById("editor");
  if (!editorHost) return null;

  split = document.createElement("div");
  split.id = "fountain-split";
  editorHost.parentNode?.insertBefore(split, editorHost);
  split.appendChild(editorHost);
  return split;
}

function applySplitColumns(): void {
  const split = document.getElementById("fountain-split");
  if (split) split.style.gridTemplateColumns = splitColumns();
}

/** Escape a string for safe innerHTML insertion into the outline. */
function escOutline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOutline(view: EditorView): void {
  const pane = document.getElementById(OUTLINE_ID);
  if (!pane) return;
  const items = buildOutline(view.state.doc.toString());
  const keepScroll = pane.scrollTop;
  const parts: string[] = [];
  for (const it of items) {
    const cls =
      it.kind === "section"
        ? `fo-section fo-depth-${it.depth}`
        : `fo-${it.kind} fo-depth-${it.depth}`;
    const num = it.kind === "scene" ? `<span class="fo-num">${escOutline(it.sceneNumber)}</span>` : "";
    parts.push(
      `<div class="${cls}" data-from="${it.from}" data-kind="${it.kind}">${num}` +
      `<span class="fo-label">${escOutline(it.label)}</span></div>`,
    );
  }
  pane.innerHTML =
    `<div class="fo-title">Outline</div>` +
    (parts.length
      ? parts.join("")
      : `<div class="fo-empty">No sections or scenes yet.</div>`);
  pane.scrollTop = keepScroll;

  // Click a node -> cursor jumps to that heading, scrolled to the TOP
  // of the editor viewport.
  pane.querySelectorAll<HTMLElement>("[data-from]").forEach(el => {
    el.addEventListener("click", () => {
      const from = Number(el.dataset.from);
      if (Number.isFinite(from)) {
        view.focus();
        view.dispatch({
          selection: { anchor: from },
          effects: EditorView.scrollIntoView(from, { y: "start" }),
        });
      }
    });
  });
}

function openOutline(view: EditorView): void {
  const split = ensureSplit();
  if (!split) return;

  let pane = document.getElementById(OUTLINE_ID);
  if (!pane) {
    pane = document.createElement("div");
    pane.id = OUTLINE_ID;
    pane.className = "fo-outline-pane";
    // Outline is column 1: insert BEFORE the editor host.
    split.insertBefore(pane, document.getElementById("editor"));
  }
  let gutter = document.getElementById(OUTLINE_GUTTER_ID);
  if (!gutter) {
    gutter = document.createElement("div");
    gutter.id = OUTLINE_GUTTER_ID;
    gutter.appendChild(document.createElement("div"));
    split.insertBefore(gutter, document.getElementById("editor"));
  }

  renderOutline(view);
  outlineOpen = true;
  applySplitColumns();

  if (gutter && !outlineSplitter) {
    outlineSplitter = Split({
      columnGutters: [{ track: 1, element: gutter }],
      minSize: 140,
      onDragStart: () => {
        draggingStyle.disabled = false;
      },
      onDragEnd: () => {
        draggingStyle.disabled = true;
      },
    });
  }
}

function closeOutline(): void {
  outlineSplitter?.destroy();
  outlineSplitter = undefined;

  document.getElementById(OUTLINE_ID)?.remove();
  document.getElementById(OUTLINE_GUTTER_ID)?.remove();
  outlineOpen = false;
  applySplitColumns();

  // If nothing is open anymore, unwrap #editor entirely.
  if (!outlineOpen && !paneOpen) {
    const split = document.getElementById("fountain-split");
    const editorHost = document.getElementById("editor");
    if (split && editorHost) {
      split.parentNode?.insertBefore(editorHost, split);
      split.remove();
    }
  }
}

// ---------- preview pane ----------
const PANE_ID = "fountain-preview-pane";
const GUTTER_ID = "fountain-preview-gutter";
let paneOpen = false;
let splitter: ReturnType<typeof Split> | undefined;
// Editor mode to restore when the pane closes (the pane displaces
// Live Preview Edit, since the pane itself is the formatted view).
let modeBeforePane: FountainMode | null = null;

// Global cursor/selection lock while dragging the divider.
const draggingStyle = document.createElement("style");
draggingStyle.textContent =
  "* { cursor: col-resize !important; user-select: none !important; }";
draggingStyle.disabled = true;
document.head.appendChild(draggingStyle);

function getPane(): HTMLElement | null {
  return document.getElementById(PANE_ID);
}

function getGutter(): HTMLElement | null {
  return document.getElementById(GUTTER_ID);
}

function renderPreview(view: EditorView): void {
  const pane = getPane();
  if (!pane) return;
  // Safe: renderFountainHtml HTML-escapes every text run and builds
  // tags only from a fixed class whitelist — no raw input is injected.
  const keepScroll = pane.scrollTop;
  pane.innerHTML = renderFountainHtml(view.state.doc.toString());
  pane.scrollTop = keepScroll;
}

function openPane(view: EditorView): void {
  console.log("[dot-fountain] openPane: start");
  // Deterministic split: wrap MarkEdit's own #editor in our container so
  // the grid has exactly known children — no dependence on what else
  // lives in <body> (verified: CoreEditor/index.html has
  // <body><div id="editor">).
  const split = ensureSplit();
  if (!split) return;

  let pane = document.getElementById(PANE_ID);
  if (!pane) {
    pane = document.createElement("div");
    pane.id = PANE_ID;
    pane.className = "fp-preview-pane";
    // Preview is the LAST column: append after the editor.
    split.appendChild(pane);
  }
  let gutter = getGutter();
  if (!gutter) {
    gutter = document.createElement("div");
    gutter.id = GUTTER_ID;
    gutter.appendChild(document.createElement("div"));
    split.appendChild(gutter);
  }

  // The editor side becomes raw markdown — the pane is the formatted
  // view. Remember the current mode to restore on close.
  modeBeforePane = getMode(view.state);
  if (modeBeforePane === "preview") {
    view.dispatch({ effects: setMode.of("source") });
  }

  console.log("[dot-fountain] openPane: rendering");
  renderPreview(view);
  paneOpen = true;
  applySplitColumns();
  console.log("[dot-fountain] openPane: split-grid init");

  // Draggable divider — split-grid, the same library MarkEdit-preview
  // uses for its side-by-side mode. track index of the preview gutter
  // depends on whether the outline pane is also open.
  const trackIdx = outlineOpen ? 3 : 1;
  if (gutter && !splitter) {
    splitter = Split({
      columnGutters: [{ track: trackIdx, element: gutter }],
      minSize: 150,
      onDragStart: () => {
        draggingStyle.disabled = false;
      },
      onDragEnd: () => {
        draggingStyle.disabled = true;
      },
    });
  }
  console.log("[dot-fountain] openPane: done");
}

function closePane(): void {
  splitter?.destroy();
  splitter = undefined;

  document.getElementById(PANE_ID)?.remove();
  document.getElementById(GUTTER_ID)?.remove();
  paneOpen = false;
  applySplitColumns();

  // If nothing is open anymore, unwrap #editor entirely.
  if (!outlineOpen && !paneOpen) {
    const split = document.getElementById("fountain-split");
    const editorHost = document.getElementById("editor");
    if (split && editorHost) {
      split.parentNode?.insertBefore(editorHost, split);
      split.remove();
    }
  }

  // Restore the editor mode the pane displaced (only if the user didn't
  // change modes manually while the pane was open).
  const view = MarkEdit.editorView;
  if (view && getMode(view.state) === "source" && modeBeforePane === "preview") {
    view.dispatch({ effects: setMode.of("preview") });
  }

  paneOpen = false;
}

// Re-render the panes when the document changes while they're open.
const previewRefresh = EditorView.updateListener.of((update: ViewUpdate) => {
  if (update.docChanged) {
    if (paneOpen) renderPreview(update.view);
    if (outlineOpen) renderOutline(update.view);
  }
});

// ---------- activation ----------
const isFountain = (): boolean => detectFountain(MarkEdit.editorView.state.doc.toString());

MarkEdit.onEditorReady(() => {
  MarkEdit.addExtension([modeField, fountainHighlight(), fountainKeymap(), previewRefresh]);
});

// ---------- menu ----------
MarkEdit.addMainMenuItem({
  title: "Fountain",
  children: [
    {
      title: "Show Outline",
      key: "o",
      modifiers: ["Shift", "Command"],
      action: () => {
        const view = MarkEdit.editorView;
        if (isFountain() && outlineOpen) closeOutline();
        else if (isFountain()) openOutline(view);
      },
      state: () => ({
        isEnabled: isFountain(),
        isSelected: outlineOpen,
      }),
    },
    {
      title: "Show Preview Pane",
      key: "p",
      modifiers: ["Shift", "Command"],
      action: () => {
        const view = MarkEdit.editorView;
        if (isFountain() && paneOpen) closePane();
        else if (isFountain()) openPane(view);
      },
      state: () => ({
        isEnabled: isFountain(),
        isSelected: paneOpen,
      }),
    },
    { separator: true },
    {
      title: "Live Preview Edit",
      key: "p",
      modifiers: ["Option", "Shift"],
      action: () => {
        MarkEdit.editorView.dispatch({ effects: setMode.of("preview") });
      },
      state: () => ({
        isSelected: isFountain() && getMode(MarkEdit.editorView.state) === "preview",
        isEnabled: isFountain(),
      }),
    },
    {
      title: "Fountain (markdown)",
      key: "p",
      modifiers: ["Option", "Command"],
      action: () => {
        MarkEdit.editorView.dispatch({ effects: setMode.of("source") });
      },
      state: () => ({
        isSelected: isFountain() && getMode(MarkEdit.editorView.state) === "source",
        isEnabled: isFountain(),
      }),
    },
    { separator: true },
    {
      title: "Go to Next Scene",
      key: "→",
      modifiers: ["Option"],
      action: () => {
        gotoNextScene(MarkEdit.editorView);
      },
    },
    {
      title: "Go to Previous Scene",
      key: "←",
      modifiers: ["Option"],
      action: () => {
        gotoPrevScene(MarkEdit.editorView);
      },
    },
    { separator: true },
    {
      title: "Script Stats…",
      action: () => {
        const s = fountainStats(MarkEdit.editorView.state.doc.toString());
        void MarkEdit.showAlert({
          title: "Fountain Script Stats",
          message: `${s.scenes} scenes · ${s.words} words · ${s.dialogueWords} in dialogue`,
          buttons: ["OK"],
        });
      },
    },
  ],
});