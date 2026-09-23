# Releasing dot-fountain

Two channels, deliberately simple:

- **Development = `main`.** All work lands here. The shallow install URL
  serves the latest build; it may be unstable and changes with every push.
- **Stable = tags + GitHub Releases.** Cut only deliberately. Assets are
  immutable once published.

## Release procedure

1. Verify: `npx vitest run` green, `npx tsc --noEmit` clean,
   `hosts/markedit` typecheck + build clean, harness pass.
2. Pick the next semver (`0.x` pre-1.0; features bump minor, fixes bump patch).
3. Build from the exact commit being released:
   `cd hosts/markedit && npm run build` (root artifact updates too).
4. Tag and push: `git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z`.
5. Create the GitHub release; attach `dot-fountain.js` from that build.
6. Verify the asset: download the release asset URL and confirm its
   sha256 matches the local build. **Never re-tag or overwrite an asset.**
7. (Only with explicit approval, and only if publishing to the registry
   is wanted) add a `versions[]` block to the registry entry PR.

## Rules

- A release is frozen forever. A bad release is fixed by shipping the next
  one, never by rewriting the old one.
- The registry only ever points at release assets (sha256-pinned), so
  `main` can move freely without affecting installed users.