# fountain-cm6

> [Fountain](https://fountain.io) screenplay syntax for [CodeMirror 6](https://codemirror.net) — live element highlighting, inline emphasis, and screenplay typography — with ready-made host glue for [MarkEdit](https://github.com/MarkEdit-app/MarkEdit) on macOS.

Fountain is plain text: write screenplays in any editor, everywhere. `fountain-cm6` makes a *minimal* editor understand them: scene headings, character cues, dialogue, parentheticals, transitions, dual dialogue, notes, synopses, sections, lyrics and page breaks — recognized per the [official syntax spec](https://fountain.io/syntax/) and styled as you type. The text itself is never modified.

**Status:** v0.1 in development — core classifier complete and spec-tested; MarkEdit integration is the next milestone.

## Why this design

The project is split into two layers:

```
src/     pure CodeMirror 6 — classify.ts, spans.ts, highlight.ts, commands.ts
hosts/   thin per-host glue — markedit/, web/, (future: obsidian/)
```

`src/` never imports a host package. The same core powers the MarkEdit extension, a browser playground, and any future CM6 host.

## Architecture

- **`classify.ts`** — line-oriented classifier implementing the Fountain spec: forced headings (`.INT. X`), scene numbers (`#12#`), dual dialogue (`=`), blocks (`[[note]]`, `== synopsis ==`, `~ lyric`), radiobutton titles, and auto-detection of Fountain documents.
- **`spans.ts`** — inline spans with markdown-style lookbehind guards so emphasis (`*i*`, `**b**`, `***bi***`, `_*u*_`, `_**bu**_`, nested combos), notes and scene numbers never mis-pair.
- **`highlight.ts`** — a single `ViewPlugin` producing line + mark + widget decorations from the visible document. Fountain scripts are small (a 120-page screenplay is ~50 KB); a full re-classify per doc change is cheap and keeps context-sensitive rules exact.
- **`hosts/markedit/`** — builds to one self-contained `markedit-fountain.js` for MarkEdit's scripts folder.

## Installing (MarkEdit, macOS)

1. Download the latest `markedit-fountain.js` from [Releases](../../releases).
2. Place it in:
   ```
   ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
   ```
3. Relaunch MarkEdit. Open a `.fountain` file — it comes alive.

Or with the dev workflow (auto-build + copy on save):

```sh
cd hosts/markedit && npm run watch
```

## Development

```sh
npm install
npm test          # vitest — spec fixtures from fountain.io/syntax
npm run typecheck
```

## Roadmap

- [x] Core classifier + inline spans, spec-tested
- [x] CM6 decoration layer
- [ ] MarkEdit host glue + menu commands (jump to next scene, scene count)
- [ ] Screenplay typography theme (dialogue indent, centred cues)
- [ ] v0.1 release → submit to [MarkEdit extensions registry](https://github.com/MarkEdit-app/extensions)
- [ ] v0.2: HTML preview pane (Fountain.js), page-count estimation, dual-dialogue columns
- [ ] Later: browser playground (`hosts/web`), Obsidian plugin

## License

MIT — see [LICENSE](LICENSE). Fountain is a spec by [Final Draft](https://finaldraft.com); this project implements the public syntax description and is not affiliated with Final Draft or MarkEdit.
