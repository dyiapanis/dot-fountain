// MarkEdit host glue for fountain-cm6.
// Builds to ONE self-contained file: markedit-fountain.js
// Install: ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
//
// This is the ONLY file that imports markedit-api. Everything else is
// portable CM6 (works in Obsidian, web, tests).
//
// Features:
// - Live Preview Edit / Fountain (markdown) editor-mode toggle
// - Preview pane on the right: an AWG-geometry screenplay page,
//   re-rendered live while typing (pattern from MarkEdit-preview).

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
import { renderFountainHtml } from "../../src/render";
import editorCss from "../../src/style.css?inline";
import previewCss from "../../src/preview.css?inline";
import Split from "split-grid";

// ---------- stylesheets ----------
function appendStyleOnce(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

appendStyleOnce("fountain-cm6-style", editorCss);
appendStyleOnce("fountain-cm6-preview-style", previewCss);

// Host layout: when the pane is open, body becomes a 2-column grid —
// the editor's own container falls into column 1 (same technique as
// MarkEdit-preview's side-by-side mode), our pane into column 2.
appendStyleOnce(
  "fountain-cm6-pane-style",
  `
  #fountain-split {
    display: grid;
    /* NOTE: split-grid parses each track strictly (px | fr | % | auto).
       minmax() breaks its parser -> "n is null" crash, dead divider.
       Plain fr tracks behave identically here. */
    grid-template-columns: 1fr 5px 1.2fr;
    height: 100vh;
  }
  #fountain-split > #editor { min-width: 0; }
  #fountain-split > #fountain-preview-gutter {
    grid-row: 1/-1;
    grid-column: 2;
    cursor: col-resize;
    display: flex;
    justify-content: center;
  }
  #fountain-split > #fountain-preview-gutter > div {
    width: 1px;
    height: 100%;
    background: rgba(128, 128, 128, 0.45);
  }
  #fountain-split > #fountain-preview-pane { min-width: 0; }
  `,
);

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
  console.log("[fountain-cm6] openPane: start");
  // Deterministic split: wrap MarkEdit's own #editor in our container so
  // the grid has exactly three known children — no dependence on what
  // else lives in <body> (verified: CoreEditor/index.html has
  // <body><div id="editor">).
  let split = document.getElementById("fountain-split");
  if (!split) {
    const editorHost = document.getElementById("editor");
    console.log("[fountain-cm6] openPane: editorHost?", !!editorHost);
    if (!editorHost) return;

    split = document.createElement("div");
    split.id = "fountain-split";
    editorHost.parentNode?.insertBefore(split, editorHost);
    split.appendChild(editorHost);

    const gutter = document.createElement("div");
    gutter.id = GUTTER_ID;
    gutter.appendChild(document.createElement("div"));
    split.appendChild(gutter);

    const pane = document.createElement("div");
    pane.id = PANE_ID;
    pane.className = "fp-preview-pane";
    split.appendChild(pane);
  }

  // The editor side becomes raw markdown — the pane is the formatted
  // view. Remember the current mode to restore on close.
  modeBeforePane = getMode(view.state);
  if (modeBeforePane === "preview") {
    view.dispatch({ effects: setMode.of("source") });
  }

  console.log("[fountain-cm6] openPane: rendering");
  renderPreview(view);
  paneOpen = true;
  console.log("[fountain-cm6] openPane: split-grid init");

  // Draggable divider — split-grid, the same library MarkEdit-preview
  // uses for its side-by-side mode. track 1 = the 5px gutter column.
  const gutter = getGutter();
  if (gutter && !splitter) {
    splitter = Split({
      columnGutters: [{ track: 1, element: gutter }],
      minSize: 150,
      onDragStart: () => {
        draggingStyle.disabled = false;
      },
      onDragEnd: () => {
        draggingStyle.disabled = true;
      },
    });
  }
  console.log("[fountain-cm6] openPane: done");
}

function closePane(): void {
  splitter?.destroy();
  splitter = undefined;

  const split = document.getElementById("fountain-split");
  if (split) {
    // Unwrap: put #editor back where MarkEdit expects it.
    const editorHost = document.getElementById("editor");
    if (editorHost) {
      split.parentNode?.insertBefore(editorHost, split);
    }
    split.remove();
  }

  // Restore the editor mode the pane displaced (only if the user didn't
  // change modes manually while the pane was open).
  const view = MarkEdit.editorView;
  if (view && getMode(view.state) === "source" && modeBeforePane === "preview") {
    view.dispatch({ effects: setMode.of("preview") });
  }

  paneOpen = false;
}

// Re-render the pane when the document changes while it's open.
const previewRefresh = EditorView.updateListener.of((update: ViewUpdate) => {
  if (paneOpen && update.docChanged) {
    renderPreview(update.view);
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