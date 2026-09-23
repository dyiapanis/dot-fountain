// MarkEdit host glue for fountain-cm6.
// Builds to ONE self-contained file: markedit-fountain.js
// Install: ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
//
// This is the ONLY file that imports markedit-api. Everything else is
// portable CM6 (works in Obsidian, web, tests).

import { MarkEdit } from "markedit-api";
import { fountainHighlight } from "../../src";
import { fountainKeymap, fountainStats, gotoNextScene, gotoPrevScene } from "../../src/commands";
import css from "../../src/style.css?inline";

// Load the screenplay stylesheet once.
const style = document.createElement("style");
style.id = "fountain-cm6-style";
if (!document.getElementById(style.id)) document.head.appendChild(style);
style.textContent = css;

// Activate Fountain mode when the editor becomes available. The plugin
// self-gates: it only decorates documents that look like Fountain, so
// ordinary markdown files are untouched.

MarkEdit.onEditorReady(() => {
  MarkEdit.addExtension([fountainHighlight(), fountainKeymap()]);
});

// "Fountain" submenu in MarkEdit's Extensions menu.
MarkEdit.addMainMenuItem({
  title: "Fountain",
  children: [
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