# Japanese Subtext Trainer Override

## Product pattern

- Education workflow: launch dashboard -> level picker -> stage map -> scene/listening workspace -> answers -> nuance review -> next stage.
- Desktop stage view uses a bounded two-column learning window: scene/player first, questions second. Mobile uses one readable vertical flow; short landscape keeps scene text and transport/questions reachable side by side without covering content.
- Load only the catalog, selected level index, current ten-stage batch, current audio, and one preloaded next stage.

## Visual direction

- Keep LuSu's Neo-XP / Pixel Glass shell, then evoke a friendly 2000s language-learning CD-ROM inside the tool: cobalt title bars, warm cream reading paper, mint progress, sun-yellow focus, and chunky one-pixel edges. Every stage uses one scene-matched 960×720 black-and-white four-panel manga with consistent characters, panel borders, line work, and screentones; do not revert to the former full-color crayon/chibi set.
- Content surfaces stay opaque and calm. Avoid modern SaaS cards, large white marketing panels, excessive glass, emoji UI icons, and illustrations that reveal answers.
- Japanese text is the visual priority. Use Tahoma / Verdana / Yu Gothic / MS PGothic / Microsoft YaHei fallbacks; body copy is at least 16px on mobile with 1.55 line height.

## Interaction and accessibility

- Every button, sentence row, option row, token, range control, and map tile is keyboard reachable with a visible high-contrast focus state. Main touch targets are at least 44x44 CSS px.
- The first-use mode dialog offers listening, Japanese, and bilingual entry exactly once per browser. Later changes live in Settings; stage entry never autoplays.
- Public transport exposes only play/pause, timeline seek, and speed. Sentence and token text remain the direct playback targets; do not add duplicate line buttons, previous/next, replay, or mute controls.
- Answer submission opens a focused result dialog with score, medal, analysis, and next/retry actions. Do not insert visible correctness labels inside option rows.
- Color never acts alone: locked/current/cleared stages, medals, correct/incorrect answers, loading, audio error, and cloud status all have text or icons plus accessible labels.
- The first sound action is an explicit user gesture. Audio failures expose Retry and Continue in text mode; cloud failures never block local play.
- Only one audio source may play. Route changes, map return, page hide, and unload stop or pause it.

## Responsive and media rules

- Verify 359x500, 375x667, 390x844, 844x390, and 1365x900 with zero page-level horizontal scrolling.
- The compact transport and range input retain 44px interaction lanes; question options and result-dialog actions remain fully contained and never intersect adjacent cards.
- Illustration containers reserve a 4:3 space, use `object-fit: contain`, and cap themselves to 30vh on portrait and 42vh on landscape/desktop. Decorative images use empty alt text; meaningful stage art uses localized alt text.
- Respect `prefers-reduced-motion`; animate only transform/opacity for 160-260ms and remove nonessential travel in reduced mode.
