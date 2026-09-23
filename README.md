# dot-fountain

> [Fountain](https://fountain.io) screenplay syntax for [CodeMirror 6](https://codemirror.net) — live element highlighting, screenplay typography, and scene navigation — with ready-made host glue for [MarkEdit](https://github.com/MarkEdit-app/MarkEdit) on macOS.

Fountain is plain text: write screenplays in any editor, everywhere. `dot-fountain` makes a minimal editor *understand* them — scene headings, character cues, dialogue, parentheticals, transitions, dual dialogue, notes, synopses, sections, lyrics and page breaks — recognized per the [official syntax spec](https://fountain.io/syntax/) and styled live as you type. **The text itself is never modified.**

## Installing (MarkEdit, macOS)

**Via "Install from URL"** (MarkEdit → Settings → Extensions):

```
https://raw.githubusercontent.com/dyiapanis/dot-fountain/main/hosts/markedit/dist/dot-fountain.js
```

**Or manually:**

1. Download [`dot-fountain.js`](hosts/markedit/dist/dot-fountain.js)
2. Place it in:
   ```
   ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
   ```
3. Relaunch MarkEdit and open a `.fountain` file — it comes alive.

## What you get

- **Element highlighting** — bold scene headings, indented dialogue and character cues, italic parentheticals, right-aligned transitions, tinted `[[notes]]`, `== synopses ==`, `~ lyrics`, sections, and a dashed page-break rule under `> > >`
- **Preview pane** — Extensions → Fountain → *Show Preview Pane* (⇧⌘P): a live screenplay page beside the editor, rendered to the [AWG *Suggested Script Layout*](https://www.awg.com.au) geometry (A4, Courier 12, dialogue 3.4cm in, cues 5.4cm), with a **draggable divider** (uses [split-grid](https://github.com/nathancahill/split-grid), the same library as MarkEdit's own side-by-side preview). Renders the title page too: `Title/Credit/Author/Source` centered, contact keys in the lower-left block
- **Live Preview Edit / Fountain (markdown)** — editor-mode toggle: screenplay styling in the editor surface, or raw source with everything off
- **Inline emphasis** — `*italic*`, `**bold**`, `***bold italic***`, `_*underline*`_ and combinations, styled as you type
- **Scene navigation** — Extensions → Fountain → *Go to Next/Previous Scene*, also bound to Option+↓ / Option+↑
- **Script stats** — Extensions → Fountain → *Script Stats…* (scenes, word count, dialogue words)
- **Auto-detection** — ordinary Markdown files are untouched; the extension only activates on documents that look like a screenplay (a scene heading, or two or more character cues)

Want different colors? The stylesheet reads CSS variables (`--mf-scene`, `--mf-dialogue`, `--mf-character`, `--mf-parenthetical`, `--mf-transition`, `--mf-note`, `--mf-synopsis`, `--mf-section`, `--mf-lyric`) — set them in MarkEdit's custom CSS to re-theme.

## Why this design

The project is split into two layers:

```
src/     pure CodeMirror 6 — classify.ts, spans.ts, highlight.ts, commands.ts,
         mode.ts, render.ts (+render-title.ts, render-escape.ts), style.css, preview.css
hosts/   thin per-host glue — markedit/ (built), web/ (planned)
```

`src/` never imports a host package. The same core powers the MarkEdit extension, a browser playground, and any future CM6 host (an Obsidian plugin maps naturally, since its editor *is* CodeMirror 6).

- **`classify.ts`** — line-oriented classifier implementing the Fountain spec: forced headings (`.INT. X`), `!` action escapes, scene numbers (`#12A#`), dual dialogue (`=`), multi-line `[[notes]]`, `== synopses ==`, `~ lyrics`, title-page keys, and document auto-detection.
- **`spans.ts`** — inline spans with lookaround guards so emphasis runs (`**, *` between two) never mis-pair.
- **`highlight.ts`** — a single `ViewPlugin` producing line + mark + widget decorations. Fountain scripts are small (a 120-page screenplay is ~50 KB); a full re-classify per change is cheap and keeps context-sensitive rules exact.
- **`hosts/markedit/`** — ~60 lines of glue building to one self-contained `dot-fountain.js`, sharing MarkEdit's own CodeMirror modules.

## Development

```sh
git clone https://github.com/dyiapanis/dot-fountain
cd dot-fountain
npm install
npm test          # vitest — fixtures taken from the fountain.io/syntax examples
npm run typecheck

# build the MarkEdit extension:
cd hosts/markedit && npm install && npm run build
```

## Contributing

Issues and PRs welcome. The classifier is the heart of the project — if a line of your screenplay is misclassified, that's a bug: open an issue with the exact text (plus a line or two of surrounding context) and what element it should be. Style/theme contributions should stick to the CSS-variable contract above.

## Roadmap

- [x] Core classifier + inline spans, spec-tested
- [x] CM6 decoration layer + screenplay typography
- [x] MarkEdit host glue, menu commands, script stats
- [ ] v0.1 release → submit to the [MarkEdit extensions registry](https://github.com/MarkEdit-app/extensions)
- [ ] v0.2: HTML preview pane (Fountain.js), page-count estimation, dual-dialogue columns
- [ ] Later: browser playground (`hosts/web`), Obsidian plugin

## Credits & license

Fountain was created by [John August](https://johnaugust.com) and [Stu Maschwitz](https://prolost.com), merging their Scrippets and Screenplay Markdown projects. This package implements the public syntax description and is not affiliated with the Fountain authors or with MarkEdit.

MIT — see [LICENSE](LICENSE).