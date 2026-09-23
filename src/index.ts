// dot-fountain public API.
// Hosts (MarkEdit glue, web playground, future Obsidian plugin) import
// ONLY from here. The core never imports a host.

export { classify, detectFountain } from "./classify";
export type { LineInfo, LineType } from "./classify";
export { spansFor } from "./spans";
export type { Span, SpanClass } from "./spans";
export { fountainHighlight, fountainDecorations, lineClass, spanClass } from "./highlight";
export { modeField, setMode, getMode, toggleMode } from "./mode";
export type { FountainMode } from "./mode";
