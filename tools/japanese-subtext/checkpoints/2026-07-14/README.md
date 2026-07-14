# 2026-07-14 candidate checkpoint

This directory preserves reviewable outputs from the paused `1.0.3` candidate work. It is a source-control checkpoint, not a published asset bundle and not a release manifest.

- `image2/` contains 13 unreferenced 960×720 WebP snapshots mechanically derived from raw PNGs whose current canonical prompt, Codex review, tool run, source SHA and normalized SHA all matched at checkpoint time.
- `image2-manifest.json` records the evidence chain for those snapshots.
- L1-003 is excluded because an interrupted copy left its stable source SHA out of sync with its review and raw sidecar.
- The desktop/mobile backgrounds and every review without a matching current-v4 raw sidecar are excluded.
- Runtime code must not load these files. A later release must still publish exactly 250 stages and two backgrounds through `publish-image2-assets.mjs`.

The validated Aivis candidate is checkpointed separately in the branch's normal `audio/` tree. Its manifest remains a pre-migration `contentVersion: 1.0.2` candidate and must be reconciled with `--all` after the eventual image/content migration before it can become a public release.
