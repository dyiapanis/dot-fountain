import { defineConfig, mergeConfig } from "vite";
import { defaultViteConfig } from "markedit-vite";

// defaultViteConfig handles the critical externals so the built script
// shares MarkEdit's own CodeMirror/Lezer modules (single instance), builds
// to dist/ as one CJS file, and can auto-copy to the scripts folder.
export default defineConfig(
  mergeConfig(defaultViteConfig({ copyDistFile: false }), {
    build: {
      lib: {
        entry: "main.ts",
        name: "dot-fountain",
        formats: ["cjs"],
        fileName: () => "dot-fountain.js",
      },
      // CSS is inlined into the JS bundle (imported as a string), so the
      // build output is exactly one file.
    },
  }),
);