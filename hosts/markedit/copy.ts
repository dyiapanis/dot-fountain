import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

/** Copy the built bundle to a path relative to this file. */
export function copyFileSynchronously(from: string, to: string): void {
  const src = resolve(__dirname, from);
  const dst = resolve(__dirname, to);
  copyFileSync(src, dst);
  console.log(`[dot-fountain] copied ${from} -> ${to}`);
}