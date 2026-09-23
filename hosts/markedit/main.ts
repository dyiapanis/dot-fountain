// MarkEdit host glue for fountain-cm6.
// Builds to ONE self-contained file: markedit-fountain.js
// Install: ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
//
// This is the ONLY file that imports markedit-api. Everything else is
// portable CM6 (works in Obsidian, web, tests).

import { MarkEdit } from "markedit-api";
import { detectFountain, fountainHighlight, getMode, modeField, setMode } from "../../src";
import { fountainKeymap, fountainStats, gotoNextScene, gotoPrevScene } from "../../src/commands";
import css from "../../src/style.css?inline";

// Load the screenplay stylesheet once.
const style = document.createElement("style");
style.id = "fountain-cm6-style";
if (!document.getElementById(style.id)) document.head.appendChild(style);
style.textContent = css;

// Is the current document Fountain? (Both mode items disable on plain
// markdown, since the toggle would have no visible effect there.)
const isFountain = (): boolean => detectFountain(MarkEdit.editorView.state.doc.toString());

// Activate Fountain support when the editor becomes available. The plugin
// self-gates: it only decorates documents that look like Fountain, and the
// mode field lets the user flip styling off entirely.
MarkEdit.onEditorReady(() => {
  MarkEdit.addExtension([modeField, fountainHighlight(), fountainKeymap()]);
});

// "Fountain" submenu in MarkEdit's Extensions menu.
MarkEdit.addMainMenuItem({
  title: "Fountain",
  children: [
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