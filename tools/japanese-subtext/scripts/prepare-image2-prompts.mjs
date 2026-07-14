import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = path.resolve(SCRIPT_DIR, "..");
const CONTENT_ROOT = path.join(TOOL_ROOT, "content");
const IMAGE2_ROOT = path.join(TOOL_ROOT, "image2");
const STYLE_BIBLE_PATH = path.join(IMAGE2_ROOT, "style-bible.md");
const DESIGN_IDENTITY_REGISTRY_PATH = path.join(
  IMAGE2_ROOT,
  "design-identities.json",
);
const OUTPUT_PATH = path.join(IMAGE2_ROOT, "prompts.jsonl");
const BACKGROUND_OUTPUT_PATH = path.join(IMAGE2_ROOT, "background-prompts.jsonl");
const BACKGROUND_MANIFEST_PATH = path.join(
  IMAGE2_ROOT,
  "background-prompts-manifest.json",
);

const EXPECTED_LEVELS = 5;
const EXPECTED_STAGES_PER_LEVEL = 50;
const EXPECTED_STAGE_COUNT = EXPECTED_LEVELS * EXPECTED_STAGES_PER_LEVEL;
const EXPECTED_CAST_REF_COUNT = 780;
const EXPECTED_DESIGN_IDENTITY_COUNT = 778;
const EXPECTED_BATCHES = [
  "batch-001-010.json",
  "batch-011-020.json",
  "batch-021-030.json",
  "batch-031-040.json",
  "batch-041-050.json",
];
const MODEL = "gpt-image-2";
const SIZE = "1536x1152";
const QUALITY = "high";
export const PROMPT_SCHEMA_VERSION = "japanese-subtext-image2-prompt-v4";
export const SOURCE_TEXT_HASH_SCHEMA_VERSION =
  "japanese-subtext-image-source-text-v1";
export const DESIGN_IDENTITY_REGISTRY_SCHEMA_VERSION =
  "japanese-subtext-design-identities-v1";
export const DESIGN_SEED_NAMESPACE = "japanese-subtext-cast-design-v2";
const BACKGROUND_PROMPT_SCHEMA_VERSION =
  "japanese-subtext-image2-background-prompt-v1";
const DESIGN_IDENTITY_REGISTRY_PROJECT_PATH =
  "tools/japanese-subtext/image2/design-identities.json";
const DESIGN_IDENTITY_REGISTRY_TEXT = readFileSync(
  DESIGN_IDENTITY_REGISTRY_PATH,
  "utf8",
);
const DESIGN_IDENTITY_REGISTRY_SHA256 = sha256(
  DESIGN_IDENTITY_REGISTRY_TEXT,
);
const {
  registry: DESIGN_IDENTITY_REGISTRY,
  aliasesByCastRef: DESIGN_IDENTITY_ALIASES_BY_CAST_REF,
} = loadDesignIdentityRegistry(DESIGN_IDENTITY_REGISTRY_TEXT);

// Narrow, source-preserving constraints for stages where image models
// repeatedly collapsed remote topology or invented a conclusive gesture.
// These restate observable facts already present in the locked stage; they
// must never introduce an option, explanation, or new story event.
const STAGE_PROMPT_ADDENDA = Object.freeze({
  "L1-007": Object.freeze([
    "Keep Sora and Rena at two separate remote game-chat endpoints across whole panels, never together in one physical room. In the final panel, Rena must be visibly finished with the interaction: her controller is set down and her posture has turned away from the device, while the device is a neutral blank or dark screen.",
    "Do not leave Rena actively reading, typing, holding the controller, or facing a message interface in the final panel. Do not add an online or offline label, status icon, chat bubble, message list, pseudo-text, shutdown animation, or emotional verdict.",
  ]),
  "L1-009": Object.freeze([
    "Keep Miki and Hina seated together in the same quiet library reading area. Show Miki visibly speaking while Hina gives only a restrained whisper response; vary shot scale or viewpoint for the remaining panels and stop before either person visibly confirms an interpretation of Hina's remark.",
    "Do not add a finger-to-lips hush gesture, palm-out stop gesture, pointing gesture, sound or volume rays, sweat drop, blush, apology bow, visible volume reduction, or conclusive reaction. Any visible book or page must be closed, blank, or contain only a few large abstract shapes with no parallel writing lines, tiny marks, or pseudo-text.",
  ]),
  "L1-010": Object.freeze([
    "Keep the source-defined bakery conversation before the fresh batch is ready. Existing morning bread may remain only on a shelf or the customer's own tray; the clerk may use one restrained waiting gesture while both people stay in the same bakery.",
    "Do not show the clerk carrying, presenting, setting down, or removing a tray of newly baked bread. Do not show an oven opening, steam, a completed wait, a fresh-batch arrival, a successful purchase outcome, a clock, digit, written time, or countdown cue.",
  ]),
  "L1-011": Object.freeze([
    "Keep Chinatsu and Takumi as the only two people in the same source-defined entryway, with exactly one compact folded umbrella as the only carried item. Takumi may view one ordinary forecast device whose otherwise blank screen contains at most one small neutral rain-cloud icon.",
    "Do not add a backpack, shoulder bag, handbag, briefcase, luggage, umbrella stand, extra umbrella, long umbrella, weather map, chart, forecast rows, digits, labels, horizontal writing lines, tiny interface marks, or pseudo-text. Keep the umbrella exchange and both expressions restrained without adding an emotional verdict.",
  ]),
  "L1-017": Object.freeze([
    "Keep the scene inside the busy source-defined VRChat room across all four panels. Show Nozomi and Ko only as their avatars in that shared virtual context, and do not invent real-world rooms or the unseen users behind the avatars.",
    "Do not show a portal, destination preview, quiet landscape, room-transfer interface, directional arrow, or decisive pointing gesture. End only on the source-defined difficulty hearing, using restrained listening posture such as leaning slightly closer or shielding one ear, without depicting an already reached quieter world.",
  ]),
  "L1-016": Object.freeze([
    "Keep Shun, Kana, and Megumi in separate physical locations across whole panels; never place two or three of them together in one room.",
    "Show the source-defined smiling sticker only once as one small abstract smile icon contained inside an otherwise blank device screen. Do not draw speech bubbles, message bubbles, message stacks, floating symbols, oversized emoji, or text-like interface marks.",
  ]),
  "L1-018": Object.freeze([
    "Keep Ao's source-defined slight hesitation and request for an opaque bag restrained and observational, with the limited-edition item present only as an ordinary abstract product package. Keep Ao and the clerk as the only people and stop before ownership or intent is resolved.",
    "Do not add a sweat drop, blush, head scratch, averted or hiding posture, guilty expression, panic mark, lie symbol, self-gift cue, recipient image, or any visual clue that establishes who the item is for. Product art must remain original, abstract, and unreadable.",
  ]),
  "L1-019": Object.freeze([
    "Keep Miki as the only human in all four panels and the kiosk terminal as the same visibly fixed non-human hardware terminal. The terminal screen may contain only equally weighted abstract blocks and, if needed, one small neutral milk-unavailable icon already implied by the source.",
    "Do not show a human face, human body, personified avatar, customer-service agent, operator, clock, timestamp, record list, history panel, identity diagram, ownership match, or another person. Keep Miki puzzled and do not visually explain why the terminal confused the identity.",
  ]),
  "L1-021": Object.freeze([
    "Establish both the shaded bench and the sunlit opposite bench without pointing fingers, arrows, spotlight emphasis, or a composition that singles out one as the answer.",
    "Keep the final panel observational: the two people may prepare to stand, but do not show them already relocated or use a decisive directional gesture.",
  ]),
  "L1-022": Object.freeze([
    "The submission box may appear only as a neutral background object. No character may point toward it, present it, approach it, or place an assignment into it.",
    "Keep the final panel on neutral eye contact or listening between the two people, with no gesture that signals permission, approval, or a decided outcome.",
  ]),
  "L1-023": Object.freeze([
    "Keep the offered cookie and its box visible while both coworkers use neutral conversational posture.",
    "Do not add a palm-out refusal, head shake, crossed arms, pushing-away motion, or any other conclusive rejection gesture; end before a visible acceptance or refusal.",
  ]),
  "L1-024": Object.freeze([
    "Keep Takumi and the clerk as the only two people at the source-defined station-side convenience-store counter. Show exactly one bento and let the clerk introduce one ordinary empty shopping bag only for the requested handoff; Takumi may repeatedly glance at his own wristwatch while the station setting remains visible only as neutral background context.",
    "Do not add a shoulder strap, shoulder bag, backpack, handbag, briefcase, suitcase, luggage, second carried bag, wall clock, readable watch face, departure board, timetable, digits, countdown, arrows, running, boarding, or a completed train departure. Register and product displays must use only a few large blank geometric blocks with no labels, price marks, writing lines, or pseudo-text.",
  ]),
  "L1-029": Object.freeze([
    "Keep Mio as the only human, the cat as the only animal, and the game system only as abstract unreadable game UI on one ordinary screen. Never personify the system as a human, avatar, operator, mascot, or physical character sharing Mio's room.",
    "Keep the empty fish-reward slot and the cat as simultaneous neutral observations without resolving causality. Do not show the cat licking its mouth, eating, holding a fish, looking satisfied, following a path, triggering the UI, or receiving a reward; add no arrow, before-and-after diagram, blame cue, or conclusive reaction.",
  ]),
  "L1-030": Object.freeze([
    "Preserve the source-defined gradual shift from an ordinary classroom exam into unreality across the four panels. Panel 1 must be a normal exam opening with Nana, the teacher, desks, and only a pencil as the focal desk object; the outside view must still look ordinary. Panel 2 may first reveal the teacher's rain boots, panel 3 may gradually reveal deep-sea fish beyond the classroom window, and panel 4 may include the underwater bell while the same classroom and character designs remain continuous.",
    "Do not show rain boots and underwater fish together in panel 1, skip directly to a fully underwater classroom, remove the classroom background from an intermediate panel, or add dream symbols, explanatory icons, captions, text, a waking scene, or a resolved interpretation.",
  ]),
  "L1-031": Object.freeze([
    "Keep all three people in restrained, neutral discussion posture. In the final panel, Ayano must keep both hands naturally on the table or at her sides with a controlled expression.",
    "Do not add crossed arms, lowered-head displeasure, a glare, or any other conclusive emotional cue. Every poster, wall notice, and tabletop layout must contain only a few large blank geometric blocks; no horizontal writing lines, lists, labels, captions, fine marks, or line-like pseudo-text.",
  ]),
  "L1-032": Object.freeze([
    "Keep Eri presenting, Shuji placing the source-defined thick three-year-old file on the table, and Daichi observing in the same meeting room. Any projection may use only unlabeled geometric chart primitives such as one plain pie shape, a few solid bars, or one simple line with no axes; the old file must remain closed or use blank large blocks.",
    "Do not draw horizontal list lines, coordinates, axes, legends, labels, numbers, captions, table cells, document pseudo-text, or a readable old-versus-new comparison. Keep all three people neutral, with no crossed arms, accusation, vindication, or conclusive judgment.",
  ]),
  "L1-035": Object.freeze([
    "Keep Kaito and Yuna at two separate remote physical endpoints, alternating only whole undivided panels. Each panel may contain at most one ordinary physical phone; when a screen view is needed, use a natural over-the-shoulder view of that same phone with only the three source-defined angry-cat icons and otherwise equal blank message blocks.",
    "Do not add a giant floating phone, duplicated device, screen overlay, inset, split screen, picture-in-picture, chat bubble, pseudo-text, readable message, or extra participant. Do not map an icon to a final emotional verdict or show a resolved response.",
  ]),
  "L1-036": Object.freeze([
    "Keep the source-defined vending machine as fixed non-human hardware and show the two coin returns, the polite request, and the later ability to select a product only through physical actions and neutral machine state. Bottles may use one plain solid band or one large abstract icon; the display may use only a portrait-like abstract block, one waveform-like shape, and a few large equal geometric buttons.",
    "Do not draw labels, brand marks, horizontal text lines, list rows, item names, prices, digits, pseudo-writing, speech bubbles, a human operator, or a personified machine. Do not use a check mark, approval word, highlighted winning product, or other visual answer cue.",
  ]),
  "L1-038": Object.freeze([
    "Represent the station announcement only through a wall or ceiling loudspeaker in the unmanned station; never personify the voice or show a presenter, studio, or second physical character.",
    "Show exactly three distinct station benches and place one pair of knitted gloves on the farthest third bench without a number sign, readable label, pointing gesture, spotlight, or answer cue.",
  ]),
  "L1-046": Object.freeze([
    "Keep one identical cup physically continuous across all four panels, with the same shape, scale, orientation, and tabletop relationship. In panel 2 the cat's paw must visibly make the first light contact while the cup stays upright; in panel 3 the paw must visibly contact it again and slide it farther away from the sunlit area; in panel 4 the cup remains at that displaced location while the cat curls up in the newly cleared patch of sunlight.",
    "Do not tilt and then magically reset the cup, teleport it, duplicate it, replace it with another vessel, omit the second contact, spill liquid, break the cup, add a human mover, or show any discontinuous before-and-after position.",
  ]),
  "L1-047": Object.freeze([
    "Keep Haru and Nao at two visibly distinct remote physical endpoints using whole undivided panels. Haru's endpoint may contain only Haru and one phone; the single borrowed book must exist only at Nao's endpoint beside Nao and one phone.",
    "Do not duplicate or teleport the book between endpoints, reuse an indistinguishable room background, place both people together, split a panel, add a screen inset, show a completed contact or reply, or depict the book already returned.",
  ]),
  "L1-048": Object.freeze([
    "Keep the guide robot visibly identifiable as an artificial humanoid while preserving the stable face, hairstyle, ink values, and silhouette: include a subtle synthetic neck seam plus restrained mechanical segmentation at one wrist or the finger joints, or one small blank status light integrated into the uniform.",
    "Do not turn the guide robot into an ordinary human, and do not add readable displays, numbers, dates, century labels, explanatory symbols, or any visual answer cue.",
  ]),
  "L1-049": Object.freeze([
    "Show exactly three neutral unnumbered geometric choice slots on the game screen. Use three equally weighted blank shapes with no digits, order labels, selection glow, check mark, arrow, question mark, folder, gear, or other readable interface icon.",
    "Keep the developer note visible only as a few large abstract blocks and non-text alignment marks that cannot be matched to any one choice slot. Remove every tiny horizontal line, character-like ornament, code-like row, pseudo-writing mark, and repeated short stroke from both the screen and every background paper. Neither character may raise a counting finger, point toward the screen or note, circle or underline a mark, or otherwise indicate which choice is correct.",
  ]),
  "L1-050": Object.freeze([
    "Keep the source-defined wristwatch unmistakably a wristwatch with a clear continuous strap, never a pocket watch, pendant, or chained timepiece. Remove every wall clock and all other time displays. Show the first cup already with the waiting person, then devote one clear panel beat to that person physically placing the second cup at the opposite empty seat; maintain both cup positions, the empty seat, and the wristwatch continuously afterward.",
    "Do not show the awaited person, silhouette, reflection, arrival, reply, completed meeting, readable time, digits, calendar, phone message, extra cup, wall clock, pocket-watch crown, chain, or any object that resolves whether the other person will come.",
  ]),
  "L2-001": Object.freeze([
    "Keep Kazuya and Chihiro continuous through the planning meeting and hallway. Render all wall surfaces and workplace materials only as a few large equally weighted abstract geometric fields, without singling out any document, notice, or presentation surface.",
    "Every wall, notice, presentation surface, paper, and document must have no horizontal line, row, legend, key, label, caption, tiny mark, or pseudo-writing layout. Do not turn the register shift into a relationship diagram, flashback, or resolved conclusion; show only the source-defined setting change and restrained conversation.",
  ]),
  "L2-002": Object.freeze([
    "Preserve this exact four-panel action order: Naoto presents the trial cake; Eri takes a first taste; Eri gives only a restrained response and asks for more cream; Eri takes the source-defined second bite. Keep both people and the same cake continuous throughout.",
    "Keep Eri's face and hands controlled. Do not show blush, sparkling eyes, a delighted grin, celebratory or approving gesture, thumbs-up, praise pose, heart, starburst, or other satisfaction cue, and do not resolve how strongly Eri likes the cake.",
  ]),
  "L2-003": Object.freeze([
    "Include exactly one completely blank application form with no writing, horizontal line, field, box, grid, header, stamp, mark, or pseudo-text. Ryo must clearly not receive, take, touch, or carry the form; Makoto keeps it while Ryo's hands stay away from it.",
    "Use panel 4 for Ryo leaving after the exchange, without showing a completed application or student-council outcome. Do not show a calendar, Friday, weekday or date text, digit, deadline symbol, check mark, cross mark, approval, rejection, submission, or later decision.",
  ]),
  "L2-005": Object.freeze([
    "Show exactly one physical participant at one separate endpoint per panel. Never place the manager, Yuka, Shun, or Mai together in a real meeting room. Any device may show only one uniform blank light field or a few equally weighted neutral geometric blocks, with no chat bubble, avatar list, repeated dot row, notification badge, read-receipt pattern, or timeline.",
    "Do not depict the joke content, a cat, report piles, or any literal object that reconstructs who or what was mocked. Preserve the group-chat silence and Yuka's later neutral return to work only through restrained individual posture, without visually identifying a victim, punch line, elapsed time, or social verdict.",
  ]),
  "L2-006": Object.freeze([
    "Keep Taka and the clerk in the same morning coffee shop. In panel 2 Taka declines the clerk's routine preparation and selects another equally weighted unlabeled coffee; use identical neutral cups or packages so neither drink is visually privileged. Reserve panel 3 for the clerk's question and panel 4 for Taka's answer.",
    "Do not label or visually distinguish strong coffee from decaf. Show no clock, moon, bed, pillow, yawn, closed-eye drowsiness, sleep symbol, dream image, nighttime cutaway, or completed sleep outcome.",
  ]),
  "L2-007": Object.freeze([
    "Only Mizuki may wear the source-defined restrained smile; Sato and Kana must remain neutral in every panel. Keep one full empty chair and the smallest practical client-dinner table clearly visible until Mizuki reaches her place, with only essential equal-weight place settings.",
    "Remove handbags, purses, plants, flowers, wall art, centerpieces, display ornaments, decorative table clutter, and any prop not required for the waiting dinner conversation. Do not turn anyone's expression or gesture into praise, blame, embarrassment, or a verdict about the late arrival.",
  ]),
  "L2-008": Object.freeze([
    "Keep Taiga, Rena, and Sora at three independent voice-chat endpoints, one person per whole panel view, never physically together. At every endpoint use only a neutral mouth shape and stable upright posture while all screens remain blank and equally weighted.",
    "In the final panel Taiga keeps his head level, brow neutral, shoulders uncollapsed, and body steady. Do not lower his head, add a frown, hunch or drop his shoulders, avert him in defeat, or use any collapse, anger, sadness, or resignation symbol to resolve his attitude.",
  ]),
  "L2-010": Object.freeze([
    "Keep only the source-defined large bag, with its complete bag body and exactly two handles continuously visible beside Kenichi on the station stairs. Do not crop away the bag body or either handle. Do not add a shoulder bag, shoulder strap, satchel, backpack, purse, or extra bag.",
    "In the final panel Riko's hand must stop hovering beside one handle without grasping, touching, lifting, or carrying it; Kenichi still controls the intact bag. Stop before any transfer or shared carrying begins, without implying acceptance or refusal.",
  ]),
  "L2-011": Object.freeze([
    "Render all proposal materials only as a few large blank equally weighted geometric blocks. Include exactly one ordinary unused approval stamp with no ink mark, indentation, imprint, motion, spotlight, or compositional emphasis.",
    "Remove every tablet computer and all invented approval interfaces. Saeki, Manager Kuroda, and Mizuki all remain neutral, with no stamping action, nod, thumbs-up, crossed arms, rejection gesture, celebratory reaction, or resolved approval outcome.",
  ]),
  "L2-012": Object.freeze([
    "Keep every paper, binder cover, book spine, and document page completely blank or limited to a few large equally weighted solid geometric blocks. Do not draw horizontal writing lines, grids, tables, form fields, page tabs, labels, pagination, stamps, check marks, or any document-like pseudo-text layout.",
    "Show the amount of material only through neutral stack thickness and closed or blank covers. Do not encode whether the materials are complete, corrected, accepted, rejected, graded, ranked, or otherwise evaluated, and keep the closing conversation observational.",
    "Every book spine must be completely blank or contain only a few large equally weighted solid geometric blocks. Remove circular dot labels, bordered label frames, spine plaques, stickers, tabs, badges, and repeated spine symbols. Remove all extra pens, pencils, clips, rulers, organizers, and other stationery decoration not required by the source-defined office discussion.",
  ]),
  "L2-013": Object.freeze([
    "Keep the bland soup and all three source-defined people at the tasting table. Keep all three people facing one another in a restrained tasting conversation across all four panels; their gaze, head direction, hands, and body orientation must remain within that interpersonal exchange.",
    "Show the only salt container as one very small, unlabeled ordinary container in the preparation counter background. Include no other seasoning bottle, jar, shaker, dispenser, or grouped condiment. No person may look at, turn toward, point at, reach for, or touch the salt container; give it no close-up, highlight, spotlight, outline, framing line, or compositional leading line.",
    "Only the source-defined soup bowls, tasting table, preparation counter, and salt container may appear as food or service props. Add no clipboard, notebook, menu, score sheet, rating form, or other invented service prop. Keep Chef Yuto neutral rather than guilty, sweating, apologetic, hiding anything, or visibly caught.",
  ]),
  "L2-016": Object.freeze([
    "Keep Rei and Aoi together only as avatars inside the same quiet VR lounge; never invent real-world user rooms or bodies behind them. Render Rei as the source-defined plain default avatar while retaining only the stable grayscale recognition cues, not a flamboyant custom design.",
    "Yuma must remain only an abstract unreadable login notification inside the virtual context. Never show Yuma's avatar or body, an arrival, confrontation, angry reaction, argument, pursuit, or any cue explaining why Rei wants privacy; show only Rei preparing to change rooms.",
  ]),
  "L2-018": Object.freeze([
    "Keep Captain Hasebe and Emma aboard the source-defined freighter while they address the ship AI only through neutral environmental hardware or one blank display. Keep all oxygen-related hardware and displays neutral and unreadable, with no human operator or personified AI.",
    "Do not visualize an oxygen quantity or future duration: no near-empty gauge or tank, countdown, low-reserve meter, declining bar, consumption graph, alarm, leak, hazard light, exact figure, or visual comparison. Keep every possible reserve duration unresolved.",
  ]),
  "L2-019": Object.freeze([
    "Keep all four panels in the same physical meeting room during the source-defined nighttime inquiry. Treat the booking sheet and entry log as blank physical records examined on site, never as remote endpoints, chat, broadcast, or network screens.",
    "Keep the shifted chair in front of the heater and the crushed paper cup visible as neutral physical evidence, but never show an unknown visitor, silhouette, shadow, footprints, handprint, open door, route, departing person, or reenactment. No character may point to, circle, or spotlight either object.",
  ]),
  "L2-020": Object.freeze([
    "Keep Rika, Ren, and An in the source-defined cat cafe, with the focal cat and both snack bags visible with equal visual weight. Keep both bags closed and ordinary, and do not add another customer, handler, snack container, or unrelated event.",
    "Do not encode an ordered visit from Ren's bag to An's bag: no sequential cat positions, footprints, arrows, scent trails, panel-to-panel path, bag highlight, exposed treats, eating, or selection symbol. Keep Ren's expression restrained and do not show the cat conclusively choosing a bag or person.",
  ]),
  "L2-021": Object.freeze([
    "Keep Ayaka in the source-defined broadcast room with the umbrella, its blank name tag, Ms. Fujii, and Kento kept as separate observable anchors in the broadcast-room sequence. Use no other person, animal, lost item, office prop, or unrelated event, and keep the umbrella and tag ordinary and unreadable.",
    "Do not show any identifiable cat-scratch pattern, color match, ownership match, handover, return, or confirmed owner. Kento must not hold or receive the umbrella, and no character may point to, compare, spotlight, circle, or visibly validate the handle or tag.",
  ]),
  "L2-022": Object.freeze([
    "Keep Supervisor Natsumi, Daichi, and Mei at three separate remote work-chat endpoints, each occupying a separate whole panel rather than an invented shared office or meeting room. Keep all screens uniformly blank and unreadable, and add no client, inspector, delivery worker, or other participant.",
    "Do not visualize a responsibility handoff, pointing chain, package, inspection result, report, blame cue, or accountability outcome. Show only restrained individual chat-reading or typing posture, with no approval, warning, accusation, shipment, failure, or completed decision.",
  ]),
  "L2-023": Object.freeze([
    "Keep Aya, Haru, and Riku together at the source-defined museum entrance before admission, with Haru at the museum entrance with the camera still visibly present and the entrance sign completely unreadable. Add no exhibit, interior gallery, extra visitor, security equipment, or unrelated prop.",
    "Do not show camera-stowing, camera handover, a no-camera icon, guard intervention, interior photography, or a completed admission outcome. No character may point toward an interior rule or visibly confirm that photography is prohibited; stop while the entrance conversation remains in progress.",
  ]),
  "L2-024": Object.freeze([
    "Keep the three participants at separate voice-chat endpoints and the system log as one blank non-human interface, never as four people sharing one physical room. Use no personified system, extra teammate, visible stream host, trap reenactment, or readable game or chat display.",
    "Do not show a lowered volume slider, mute icon, hand adjusting a control, trap replay, restored-volume state, or successful fix. Do not encode who changed a setting or what caused the failure through arrows, waveforms, timelines, highlighted controls, blame gestures, or outcome screens.",
  ]),
  "L2-025": Object.freeze([
    "Keep Riho, Yuna, and Kenta as the only three people at the source-defined expensive restaurant during the ordering phase. The menu may appear only as an unreadable, equally weighted blank object; do not add served meals, another diner, a waiter, or an unrelated restaurant prop.",
    "Do not show menu prices, numerals, currency marks, a wallet, bill, receipt, payment, or a highlighted cheap dish. Do not isolate Riho's menu or salad, compare anyone's spending, or use worried, embarrassed, deprived, or pitying expressions to resolve her reason.",
  ]),
  "L2-026": Object.freeze([
    "Keep the convenience-store counter, Miki, Shun in work clothes, the coffee, the batteries, one blank receipt, and the register as neutral co-present facts. Use no office, job-site machinery, coworker, manager, company paperwork, or unrelated purchase.",
    "Do not show an itemized receipt, company logo, reimbursement form, office scene, cash refund, approval, or completed reimbursement. Do not split the purchase into visibly separate transactions, spotlight the batteries or receipt, or show Shun submitting, claiming, or receiving money.",
  ]),
  "L2-027": Object.freeze([
    "Keep Toma walking home while listening and Kana only as a separate remote voicemail presence; never place Kana physically beside him or invent a shared room. Keep the phone screen blank, and add no house interior, extra caller, passerby, security device, or unrelated object.",
    "Do not show a visible key, hiding place, old-versus-new location, visitor, thief, theft, route map, footprints, clue diagram, or solved disappearance. Do not visualize the agreed signal or let Toma point, turn toward a destination, open a door, retrieve anything, or arrive home.",
  ]),
  "L2-028": Object.freeze([
    "Keep Risa, Shingo, and Chiaki in the source-defined current rainy interview, with the prepared stall and the rain-soaked field framed with equal visual weight. Use no extra festival crowd, performance, vendor, machinery, weather presenter, or unrelated event.",
    "Do not show a sunny future, thriving crops, a reopened festival, a before-and-after timeline, forecast proof, or an exaggerated emotional verdict. Do not turn next week into a visible second time period; keep the rain, postponement setting, and all three expressions restrained and observational.",
  ]),
  "L2-029": Object.freeze([
    "Keep every clock face completely blank: no digits, tick labels, written times, arrows, or glow. Distinguish clocks only through source-defined hand movement or stopped state, frame all clocks equally, and never spotlight the silent alarm clock or show it as a route or awakening answer cue.",
  ]),
  "L2-030": Object.freeze([
    "Keep every warning note as blank paper with no letters, pseudo-writing, stroke fragments, or legible handwriting comparison. Do not highlight a matching stroke, identify whose hand matches the note, or visually reveal the second rememberer; show Nana and Haru neutrally examining the paper.",
  ]),
  "L2-031": Object.freeze([
    "Keep all four panels in the same physical review room with Mei, Ren, Reviewer Sakurai, and Professor Takeda as the only people. Keep one blank proposal packet and any operating-cost material as unreadable, equally weighted papers; use no merchant, sponsor, office staff member, or unrelated prop.",
    "Do not show an approval or rejection stamp, handshake, certificate, calendar, next-review date, contact signal, scheduled follow-up, or sponsorship representative. Keep Sakurai's courteous posture restrained, with no formal acceptance, refusal, celebratory team reaction, or decided next step.",
  ]),
  "L2-032": Object.freeze([
    "Keep Rihito and Tanabe in one continuous source-defined exchange with the same blank revision material present as one neutral paper or device. Use no department office, messenger, client team, extra document, or unrelated event; vary only shot scale and viewpoint when another panel beat is needed.",
    "Do not add a third responsible-department representative, returned answer, publication result, clock, timeline, accusation, or exaggerated anger. No shouting, clenched fist, pointing, anger mark, warning symbol, completed review, or conclusive emotional verdict.",
  ]),
  "L2-033": Object.freeze([
    "Keep Haru, Yumi, Saki, and Kota at four separate remote group-chat endpoints, with one person in each undivided whole panel and no shared physical room. Keep all four device screens uniformly blank and equally weighted, and add no fifth participant or travel-company representative.",
    "Do not show a travel ticket, luggage, hot spring, inn, booking, cancellation fee, attendance check, empty seat, or completed trip. Do not mark Yumi as yes or no, show her packing or traveling, or use a check mark, absence silhouette, reserved seat, or group celebration to resolve attendance.",
  ]),
  "L2-034": Object.freeze([
    "Keep the scene at the station lost-property counter with Nao, the clerk, one ordinary candidate umbrella, and one blank claim-number card as the only focal facts. Keep the umbrella closed and unmarked, and add no extra umbrella, traveler, platform scene, luggage, or unrelated lost item.",
    "Do not show an identifiable star-shaped scratch, inner marking, color match, platform reenactment, handover, retrieval, or confirmed owner. Neither person may point to, compare, circle, spotlight, open, claim, or carry away the candidate umbrella.",
  ]),
  "L2-035": Object.freeze([
    "Keep an after-the-fact restaurant interview with the Interviewer, Yuto, and the Server as the only people. Keep one blank bill and one ordinary closed takeaway container as neutral, equally weighted background evidence, with no visible food, family member, additional place setting, or unrelated restaurant event.",
    "Do not reenact the original meal, show a second diner, map two meal portions to dine-in versus takeaway, reveal a family recipient, count chopsticks, or complete checkout. Do not show Yuto eating, the Server packing an order, the container being handed over, or any diagram that resolves why the bill covers two meals.",
  ]),
  "L2-036": Object.freeze([
    "Keep the User with one blank device and the Support AI only as non-human terminal hardware or a restrained status light. Use one undivided physical view, no human operator, avatar, robot body, administrator, extra user, or additional device, and keep the requested shared resource as neutral unreadable blocks.",
    "Do not visualize a settings path, permission lock, account-holder icon, folder name, cursor selection, manual execution, success check, or changed access state. Do not show the AI performing the change, the User completing the steps, or any menu sequence that reveals the procedure or reason for refusal.",
  ]),
  "L2-037": Object.freeze([
    "Keep the Resident inside the dark space habitat, with the Anchor and Spokesperson kept at separate remote announcement endpoints and never gathered in one room. Use the fourth panel for another restrained habitat or endpoint view, keep every screen and announcement surface blank, and add no maintenance worker or extra resident.",
    "Do not show clock digits, timestamps, a chronology line, maintenance reenactment, advance-notice mark, planned-test diagram, cause, or verdict. No arrows, before-and-after sequence, countdown, schedule document, investigation scene, power-saving apparatus, or visual cue may establish whether the outage was planned or reframed later.",
  ]),
  "L2-038": Object.freeze([
    "Keep the scene at the magical city gate with Lise the elf, Gan the dwarf, Toru the human, and one blank-faced clock as the only focal elements. Keep all three together in the same present moment, with neutral sunlight and no extra traveler, creature, vehicle, calendar, or timekeeping device.",
    "Do not add reverse arrows, three-hour numerals, a sun-path diagram, time travel, yesterday arrival, a normal replacement clock, or exaggerated praise or ridicule. Keep every expression restrained, with no anger marks, mocking pose, medal, applause, pointing, or visual verdict that resolves the sarcasm.",
  ]),
  "L2-039": Object.freeze([
    "Keep the castle kitchen with Mora, Princess Lina, one closed thick spellbook, and one unused pot as the only focal facts. Give the book and pot equal visual weight, keep both untouched, and add no servant, cook, ingredient, jar, recipe paper, wand effect, or unrelated kitchen event.",
    "Do not show raspberries, jam, a recipe, cooking, teaching, a spellbook used as a trivet, a curse, potion effects, or a completed joint activity. Do not open the book, heat or fill the pot, show either character preparing food or magic, or visually resolve the witch's purpose.",
  ]),
  "L2-040": Object.freeze([
    "Keep Mifuyu at the hotel-room phone and the Receptionist at a separate front-desk endpoint, alternating only undivided whole-panel views and never placing them together. Use one ordinary room phone with one completely blank display, and add no other guest, staff member, cleaner, luggage, checkout counter interaction, or unrelated event.",
    "Keep the automated voice nonvisual and non-human, represented only by ordinary telephone hardware or one restrained status light. Do not show timestamps, digits, a schedule interface, recording waveform, staff operator, cleaning check, cancellation success, checkout, or departure, and do not reveal whether the voice is live, prerecorded, mistaken, or already resolved.",
  ]),
  "L2-041": Object.freeze([
    "Keep the Anchor, Commuter, and Transit historian at three separate broadcast or listening endpoints, never in one shared room. Use one restrained lunar exterior panel with a distant neutral crewed test lander, keep all screens, papers, and signs blank, and add no crew close-up, station staff, passenger crowd, platform, or unrelated transit prop.",
    "Do not show a lunar commuter train, route map, ticket-gate inspection, commuter pass, fare, spring calendar, headline comparison, operational-check diagram, opened route, or two highlighted inference clues. Do not depict routine moon travel, a functioning lunar station, a completed route, or a visual comparison between historic achievement and ordinary commuting.",
  ]),
  "L2-042": Object.freeze([
    "Keep the Host, Mio, Kai, and Luna together only as avatars inside the same virtual event lobby; never invent the real users' rooms or bodies behind them. Preserve the stable grayscale recognition cues in restrained source-appropriate avatar forms, with one blank reception surface and no extra attendee, moderator, inspector, or physical-world endpoint.",
    "Do not map the dress rules through a color pairing, hat brim, wing ruler, size bracket, glowing ornament, ban checklist, reception measurement, violation mark, or approval result. Keep all avatar clothing equally neutral, with no highlighted garment, asymmetric measurement, rejected avatar, inspection queue, or visual boundary between allowed and forbidden choices.",
  ]),
  "L2-043": Object.freeze([
    "Keep Nagi, the Warden NPC, and Popo in the trial chamber beside the visibly open chest whose interior remains completely dark and unreadable. Preserve the Warden's source-defined game-world NPC identity without inventing a human operator, and add no extra hero, monster, treasure pile, altar, door choice, or unrelated trial prop.",
    "Do not show the Star Key, a hand touching or taking an item, prize removal, inventory, reward, success state, chest-closing result, or trial reenactment. Keep every hand away from the chest interior, show no before-and-after chest state, and do not visually establish what action the trial evaluated.",
  ]),
  "L2-044": Object.freeze([
    "Keep Mother, Daichi, and Emi at three separate family-chat endpoints, with one person in each undivided whole-panel view and the fourth panel reusing one endpoint without adding another relative. Keep all devices uniformly blank and equally weighted, and keep Mother's posture and expression restrained rather than conclusive.",
    "Do not show punctuation marks, message-length patterns, a clock, calendar, family gathering, meal, anger symbol, tears, slammed device, explicit displeasure, reconciliation, or changed-plan outcome. Do not encode the final message as a short block, isolated dot, formal card, darkened bubble, or any visible contrast with earlier messages.",
  ]),
  "L2-045": Object.freeze([
    "Keep Aya, Kenta, and an unmistakably artificial Tea robot in the source-defined pre-meeting room as the only participants. Show exactly two identical blank place cards and two equally weighted unlabeled drink vessels beside two ordinary seats, with no name-like marks, extra cup, meeting guest, server, menu, or unrelated prop.",
    "Do not show the cards being swapped, a card-to-person or card-to-seat mapping, scan line, name, symbol, face-recognition comparison, drink replacement, or completed identification. Keep the robot's attention neutral, with no pointing arm, detection beam, highlighted card, moved cup, coffee-versus-tea contrast, or visual declaration of what identifies a user.",
  ]),
  "L2-046": Object.freeze([
    "Keep Akane with the source-defined plants and Sora at a separate remote voice-message endpoint, never together in one room or shown as live callers. Keep the window pot equal in weight to the other healthy plants, keep both devices blank, and add no gardener, neighbor, pet, airport staff member, or unrelated household event.",
    "Do not show a return date, calendar, flight, ticket, route, watering timeline, care deadline, readable photo, Sora arriving home, or Akane ending the care. Do not highlight a dry or wilted pot, count watering intervals, show a packed suitcase or aircraft, or use arrows and repeated marks to encode the unstated request.",
  ]),
  "L2-047": Object.freeze([
    "Keep all four panels in the same physical product-release meeting room with Director Morita, Naoki, Sato, and Maki as the only people. Keep one blank release-page mockup and one blank legal-review folder equally weighted on the table, with no lawyer, publisher, client, extra document, or unrelated office event.",
    "Do not show a same-day clock, calendar, legal stamp, check mark, conflict arrow, priority scale, accusation, decided new date, published page, or completed legal review. No character may point between the two materials, choose one, cross one out, sign approval, celebrate a resolution, or visually declare the instructions incompatible.",
  ]),
  "L2-048": Object.freeze([
    "Do not personify the diary app or invent a human narrator. Keep the diary and transit records as equally weighted blank blocks with no route map, station icon, timestamp, travel-card symbol, room icon, or contradiction marker. Do not depict Akira traveling or resolve which record is true.",
  ]),
  "L2-049": Object.freeze([
    "Keep the game system non-human. Show one neutral blank error rectangle and one neutral blank tutorial rectangle without text, cursor, close icon, progress mark, success glow, or arrow; do not show which control should be activated or a completed tutorial.",
  ]),
  "L2-050": Object.freeze([
    "Keep DJ Ren in the late-night radio studio and the Anonymous listener at a separate listening endpoint, alternating only undivided whole-panel views and never placing them together. Keep one ordinary radio and one completely blank note as equally weighted neutral props, and add no caller, producer, musician, family member, or third location.",
    "Do not show a nickname, real name, song title, date, handwriting sample, annual timeline, flashback, old photograph, shared memory, connection line, reply, reunion, or two highlighted clue objects. Keep the listener's identity unresolved and both expressions restrained, with no phone call, mutual recognition, matching keepsake, past scene, or confirmed reconnection.",
  ]),
  "L3-001": Object.freeze([
    "Keep all four panels in the same physical review room with Shiro, Tanabe, and Mio as the only people. Treat the blank proposal, budget material, and legal material as equally weighted unreadable review objects, with no sponsor, lawyer, approver, visitor, or unrelated office event.",
    "Do not show a funding sponsor, timeline, month number, legal mark, approval or rejection stamp, handshake, opened door, or decided next step. No person may select, sign, cross out, rank, or point from one review item to a conclusion.",
  ]),
  "L3-002": Object.freeze([
    "Keep all four panels in the same source-defined classroom with Kuroda and Ren as the only people. Keep one blank test paper and the classroom board equally unreadable and visually neutral, with no classmate, examiner, textbook answer, or invented teaching aid.",
    "Do not show a formula, margin highlight, correction or grade mark, shame, guilt, praise, public explanation, or resolved outcome. Neither person may point to a specific answer, display a solved page, or perform the inferred lesson for an audience.",
  ]),
  "L3-003": Object.freeze([
    "Keep the same source-defined diner with Ayako, Shun, and Mai as the only people, using only the ordinary table and water already supported by the scene. Keep their posture and gaze restrained and give all three equal observational weight.",
    "Do not show readable names, name cards, a complaint letter, VIP table, other customers, hostile glare, punishment, rejection, or a formality mapping. Do not use seating, labels, uniforms, spotlighting, or exaggerated reactions to resolve how anyone is addressed.",
  ]),
  "L3-004": Object.freeze([
    "Keep the same source-defined mountain-lodge entrance with Gen, Eri, and Koji together, with the trail, lookout, and dusk as neutral environmental anchors. Show only the present conversation and ordinary travel readiness, not an inferred future action.",
    "Do not show a clock, time, digit, timeline, arrow, locked gate, curfew sign, danger, guide intervention, forced return, or completed outcome. Do not depict anyone blocking, dragging, ordering, or physically forcing another person along the route.",
  ]),
  "L3-005": Object.freeze([
    "Keep the four source-defined participants at four separate group-chat endpoints with blank, equally weighted device screens. Each panel remains one undivided physical endpoint; do not place the real users together or personify the chat system.",
    "Do not show a quote crop, selected phrase, highlight, approval check, budget or calendar diagram, revised material, or adoption outcome. Keep all unreadable message blocks equal, with no arrow, cursor, reaction badge, or visual clue that identifies the accepted interpretation.",
  ]),
  "L3-006": Object.freeze([
    "Show all four source characters only as game avatars inside the same virtual battle arena, never as their real users and never as a mix of avatar and physical person. Keep the avatar designs distinct and stable while preserving one continuous source-defined virtual space.",
    "Do not show health numbers or bars, an enemy corpse, healing beam, timing diagram, late cue, victory, or exaggerated sarcasm. Avoid damage counters, sequence arrows, before-and-after states, triumphant poses, or any visible proof of who acted too late.",
  ]),
  "L3-007": Object.freeze([
    "Keep Alpha, Beta, and Shu only as avatars inside the same shared virtual lounge, with no real users, physical control rooms, or mixed-reality cutaways. Give the three avatars distinct stable designs and keep mouths, posture, and attention restrained across all panels.",
    "Do not show a waveform, timeline, synchronization mark, arrow, cable, half-second digit, clone, reflection, replica, or resolved identity. Do not use matching poses, mirrored faces, lip markers, or split comparisons to reveal which avatar produced which voice.",
  ]),
  "L3-008": Object.freeze([
    "Keep Makoto with one blank device and Ao only as a non-human terminal or restrained status light; do not invent a human operator or humanoid AI. Present the source-defined assumptions as equal unreadable abstract blocks without mapping them to a room, key, or answer.",
    "Do not show a room or key mapping, color mapping, check mark, corrected answer, two-room layout, praise, or successful revision. No screen may display a chosen state, and Makoto must not point at, celebrate, or visibly reject one assumption.",
  ]),
  "L3-009": Object.freeze([
    "Keep the same physical exploration-ship log-review area with all three source-defined people co-present unless the canonical source explicitly states otherwise. Keep every record blank and equally weighted, and use only the present review setting rather than reenacting an inferred earlier event.",
    "Do not show a recovery drone, return route, hangar arrival, cargo addition, crew count or silhouette, signal arrow, subject highlight, or chained evidence. Do not connect a vessel, cargo, crew member, signal, or record with arrows, matching marks, emphasis, or a solved sequence.",
  ]),
  "L3-010": Object.freeze([
    "Keep all four source-defined people co-present in the same physical archive inquiry room for all four panels. Keep the archive log and schedule sheets blank and equally weighted; an ordinary coffee cup may remain incidental but must not be linked to the cleaner or any record.",
    "Do not reenact the cleaner inside, show a service-entrance route, intruder, staff-versus-log mapping, time, clock, culprit highlight, or a coffee-schedule-log evidence chain. Do not split the archive into different locations or use arrows, matching marks, or a flashback to identify who entered.",
  ]),
  "L3-011": Object.freeze([
    "Keep the same physical school-festival committee room with Chiaki, Kota, Reiko, and Yu as the only four people. Show one completely blank minutes sheet and one completely blank layout sheet with equal visual weight; neither sheet may contain writing lines, labels, stamps, highlights, arrows, or readable structure.",
    "Do not show a vote, raised hands, approve or reject mark, final stamp, Chiaki distributing or directing a final layout, a responsibility marker or arrow, a built festival result, or an accountability outcome. Do not visually chain continued deliberation to Chiaki's request and then to a conclusion that she drove the decision or evaded responsibility.",
  ]),
  "L3-012": Object.freeze([
    "Keep the same physical pitch meeting with Nomura, Saya, and Atsushi as the only three people. Nomura may only close one completely blank proposal packet; do not materialize any later internal review or another department.",
    "Do not show internal departments or staff, material circulation, adoption or rejection, an approval stamp, handshake, next-month implementation, calendar, deadline, or material-flow arrow. Do not visually turn internal sharing, review, and the absence of a deadline into either a positive adoption decision or a rejection.",
  ]),
  "L3-013": Object.freeze([
    "Keep the same restaurant table immediately after the meal with Yuta, Mina, and Satoshi co-present. Show only ordinary finished-meal tableware and exactly three equally weighted blank phones; no phone may show an active app, selected state, or emphasized owner.",
    "Do not show an exact amount, currency, small change, an empty wallet, successful transfer state, highlighted open app, data meter, Satoshi paying, future repayment, IOU, payment arrow, liar cue, freeloader cue, or accusatory expression. Do not visually chain an available app, refusal to transfer, and a data excuse into the conclusion that Yuta wants Satoshi to advance the payment.",
  ]),
  "L3-014": Object.freeze([
    "Keep the same physical hotel reception with Sara and Makoto as the only people. Keep road construction only as a neutral distant environmental fact. Remain at reception. Do not enter or show the alternate room.",
    "Do not show a before-and-after room comparison, key handoff, luggage move, free or paid icon, coins, compensation gift, garden-room highlight, quietness or size comparison, construction duration, or completed move. Do not visually chain the noise, larger quiet room, and absence of an extra charge into a completed compensation outcome.",
  ]),
  "L3-015": Object.freeze([
    "Keep Sora and Natsuki at two separate nighttime endpoints, alternating undivided whole panels; each endpoint has exactly one uniformly blank device and neither person appears physically beside the other.",
    "Do not show a clock, time digits, a read-receipt mark, message length, four-hour span, two separate opening actions, before-and-after states, timeline, notification-to-reply arrow, malicious ignoring, or a conspicuous delay expression. Do not visually chain an earlier reading, a later reopening, and the reply into a resolved interpretation of the colloquial wording.",
  ]),
  "L3-016": Object.freeze([
    "Keep Akira and Rin at two separate voicemail endpoints, alternating undivided whole panels. Akira's endpoint may show one ordinary generic broken ornament as neutral context, but Rin must never appear at the physical damage scene.",
    "Do not show or emphasize a shelf, upper shelf, white ornament, fragments, ownership match, connecting line, guilt, memory flashback, replay, item in Rin's hands, or pointing. Keep the exact location, tier, and color of the damaged object visually unresolved.",
    "Do not visually chain Rin's undisclosed detail knowledge to responsibility for the damage. Preserve the distinction between prior knowledge and proven responsibility without adding a culprit cue or completed accusation.",
  ]),
  "L3-017": Object.freeze([
    "Keep Risa, Mayumi, and Shuji together in one continuous broadcast production environment. Wataru's physical location is not established by the source; if he is represented separately, use only a neutral broadcast presence or one blank feed and never invent an on-location storefront.",
    "Do not show readable closure or reopening wording, a sponsor or company logo, an advertising slot, money, the producer selecting or highlighting positive wording, before-and-after word cards, a calendar, reopening date, open or closed signage, reopening montage, or business outcome.",
    "Do not visually chain Mayumi's wording instruction and the sponsorship reference into proven sponsor influence, and do not turn closure wording into a confirmed positive future. Keep the production cue, current pause, and unanswered future observational rather than conclusive.",
  ]),
  "L3-018": Object.freeze([
    "Keep Sanae and Itsuki together at the same physical school. Represent the school announcement only through a non-human wall or ceiling loudspeaker; never invent a presenter, control-room operator, avatar, or humanoid announcement system.",
    "Keep the blank notice, blank attendance list, and ordinary first-aid kit neutral and equally weighted. Do not reproduce dates, schedules, instructions, names, or list structure on any surface.",
    "Do not show a date, calendar, today-to-next-week timeline, flame, smoke, danger cause, panic or emergency icon, drill-versus-real label, arrow, highlight, surprise test, Itsuki carrying his bag, a solo alternate exit, or a completed evacuation. Do not visually chain a schedule mismatch, staff supplies, and drill wording into a confirmed real evacuation.",
  ]),
  "L3-019": Object.freeze([
    "Keep all four panels at the same inn viewpoint facing the nearby station, with Haruka as the only visible human. Keep the narrator entirely nonvisual and off-panel; never give the narration a body, silhouette, portrait, or device avatar.",
    "Keep the clock, train, and crossing neutral and unreadable. The crossing may slowly rise as stated, but it must not become a highlighted exit route, directional answer cue, or completed passage.",
    "Do not show duplicate Harukas, a repeated-day montage, clock digits or hand positions, written times, a one-minute marker, six chimes, waveform, music notes, arrow, timeline, portal, broken-loop icon, crossing-through action, escape, victory, or next-day proof. Do not visually chain synchronized train and clock cues with the rising crossing into proof that the loop has broken; preserve only a possibility.",
  ]),
  "L3-020": Object.freeze([
    "Keep the same dream station with only Mio and an ordinary unfamiliar human-looking attendant. Keep one neutral blank gate and one neutral blank sign with equal visual weight and no directional emphasis.",
    "Do not render the spoken mistake as text, pseudo-text, a right-side arrow, or a highlighted side. Do not show a childhood flashback, family member, mirrored face, double, ghost, glow, or memory fragments.",
    "Do not transform the attendant into Mio or otherwise visualize the final identity conclusion. Keep the attendant's ordinary unfamiliar appearance unchanged. Do not show Mio passing through an exit, returning home, or reaching a resolved outcome.",
  ]),
  "L3-021": Object.freeze([
    "Keep Yu, the Oracle, and the Attendant together in the same old-quarter oracle house as the only people. Keep exactly one ordinary sealed blank envelope as the only focal story prop; it remains unopened and neutrally placed, and all three use restrained conversational posture.",
    "Do not literalize the spoken metaphor as a visible door, north gate, harbor gate, key, lock, route, map, future scene, or job destination. Do not open, discard, hand over, or reveal the envelope, and do not use pointing, recoil, a spotlight, or a completed choice to connect it to one resolved meaning.",
  ]),
  "L3-022": Object.freeze([
    "Keep the King, Hero Lina, and the Treasurer together in the same audience chamber as the only people. Keep a small set of closed completely blank ledgers neutral and equally weighted; the proposed reward remains unaccepted, untransferred, and uninspected.",
    "Do not show a divided kingdom, eastern map, debt or money symbols, broken bridges, petition piles, fruit, monsters, or a governing montage, and do not reproduce any count. Do not pair or highlight two burden icons, hand over or sign a ledger, transfer a crown or land, or show acceptance, refusal, celebration, punishment, or a completed ruling outcome.",
  ]),
  "L3-023": Object.freeze([
    "Keep all four panels inside the present-day peace-treaty centennial exhibition with the Reporter, Curator, and Historian as the only visible people. Show at most the single exhibited treaty as one blank unreadable sheet inside its case, with every area of the sheet equally weighted.",
    "Do not materialize Interpreter Mina, either king, or either army, and do not reenact the next-morning orders as a flashback or extra document. Do not draw signature marks or boxes, marginal writing, bilingual line patterns, matching order sheets, laid-down weapons, arrows, highlights, or a document-to-army evidence chain.",
  ]),
  "L3-024": Object.freeze([
    "Keep the entire scene in one continuous post-recording studio or control-room context with the Audio Engineer and one fixed non-human Singing AI endpoint. The AI remains environmental hardware or one uniformly blank display, never a remote human, avatar, singer body, or operator.",
    "Keep the diagnostic surface abstract and evenly weighted. Do not show lyrics, the designer, a memorial portrait, a returning figure, a waveform, three aligned takes, a repeated tremor marker, final-line highlight, comparison chart, priority control, status label, emotion icon, heart, tear, or a before-and-after log state; no one may point to or select a conclusion.",
  ]),
  "L3-025": Object.freeze([
    "Keep the Guard and Librarian in the same closed city library as the only people. Keep the moving books, their small blank spine tags, the floor line, and the retrieval cart as restrained, equally weighted observations; render the source-defined blue tag glow only as a faint neutral grayscale glow under the monochrome contract.",
    "Keep the basement off-panel. Do not show a ghost, another figure, an operator, hidden machinery, a tag-to-floor mechanism, a path arrow, countable due-date marks, a basement cutaway, a cart stop, an approval label, or any completed collection outcome. Do not visually chain the tags, floor line, cart, and the Librarian's prior knowledge into a solved cause.",
  ]),
  "L3-026": Object.freeze([
    "Keep Employee Mio and the Technician together in or immediately beside the same research-building elevator, with the Elevator AI represented only by the elevator's fixed hardware and one neutral blank indicator. Keep one directory present only as equally weighted unlabeled geometric slots.",
    "Do not reproduce 0-TEST, floor zero, third floor, digits, letters, an up arrow, a highlighted top slot, cursor, selection glow, spatial mapping, or a side-by-side comparison of physical height and display position. Do not open onto or reveal the hidden test room, show arrival or a corrected trip, or let either person point to the interpreted target.",
  ]),
  "L3-027": Object.freeze([
    "Keep the Investigator, Sho, and Miki together in one present indoor inquiry context. Keep one wet umbrella, Sho's ordinary shoes, the drying rack, and any loan slip or access record blank, neutral, and equally weighted; the deleted company file remains only the subject of the inquiry.",
    "Do not reenact rain, an outing, an awning walk, Miki returning the umbrella, the file deletion, or anyone wetting or drying the umbrella. Do not show footprints, a route, entry or exit icons, before-and-after states, arrows, matched marks, paired close-ups of shoes and a record, culprit emphasis, confession, or a guilty reaction.",
  ]),
  "L3-028": Object.freeze([
    "Keep the Interviewer, Witness, News Reporter, and Video Editor together in one present after-the-fact interview or review environment as the only people. Keep the news script and any playback surface completely blank, abstract, and equally weighted; show only restrained conversation.",
    "Do not reenact the station accident, vehicle, square, witness position, building occlusion, aerial view, or later viewing as a flashback. Do not show the quoted phrase, angle, left direction, degree count, matching text layout, camera cone, split comparison, memory bubble, overlay, arrow, source-transfer diagram, coaching, accusation, or a resolved judgment about the Witness.",
  ]),
  "L3-029": Object.freeze([
    "Keep Hero Sera, the Forest Keeper, and Companion Noa together in one continuous source-defined forest-quest battle space. Keep the Quest System entirely non-human and limited to one neutral blank environmental HUD or status area; the upper stream is a river location, not remote communication, and no real-world users or endpoints may appear.",
    "Do not reproduce either objective, detection text, record text, attack prompt, or a before-and-after objective rewrite. Do not show the Mayor, village, dam construction, magic extraction, record reenactment, an attack, a defeated Keeper, a vanished-attack icon, a new enemy selection, arrows, crossed-out targets, paired premise cards, victory, or reward; end before anyone decides whom to treat as the enemy.",
  ]),
  "L3-030": Object.freeze([
    "Keep the test paper completely blank with no score, grade, check mark, answer, or celebratory symbol. Yuna may source-faithfully conceal the paper, but neither sibling may show a conclusive proud, guilty, jealous, or suspicious reaction.",
    "Keep Yuna and Minato together at the same desk as the only people, with one intact test paper. The paper may be briefly concealed or placed face down, but it must remain blank and neutral from the viewer's perspective; stop before the reverse side becomes a drawing surface.",
    "Do not show drawing tools, Minato drawing, a spaceship image, a completed drawing, a reveal or handoff of the blank side, their mother, a front-versus-back comparison, or a concealment-to-blank-side-to-spaceship sequence. Do not visually resolve why Yuna hid the paper.",
  ]),
  "L3-031": Object.freeze([
    "Keep Aoi, Haruka, and the Manager together in the same physical workplace immediately after the promotion announcement as the only people. Show one small overlapping stack of completely blank evaluation copies whose sheet count cannot be read, passed from Haruka toward Aoi while the Manager remains a neutral participant.",
    "Do not show readable or repeated evaluation layouts, countable yearly forms, year or delay markers, review-request counts, a promotion ladder or queue, other employees being promoted, comparison arrows, a timeline, a celebration prop, or a conclusive jealous, relieved, accusatory, or grateful reaction. Do not pair the blank copies with another highlighted clue that resolves either the delay or Haruka's feeling.",
  ]),
  "L3-032": Object.freeze([
    "Keep Kei and Misaki together in the same post-graduation reunion interior as the only people. Show exactly one notebook with one ordinary blank ticket inside one clear pocket; keep the notebook, ticket, pocket, and both people's handling and gaze neutral rather than precious or dismissive.",
    "Do not show a readable date, a facing-direction comparison, flattened-crease close-up, torn-versus-replaced pocket sequence, repair action, preservation montage, trip flashback, itinerary, photograph, luggage, money, trash container, floor-clutter reenactment, heart, sparkle, sale, discard, or completed repair. Never combine ticket alignment, crease treatment, and pocket maintenance into a visual proof of attachment.",
  ]),
  "L3-033": Object.freeze([
    "Keep Customer Rena, the Head Chef, and the Server together in the same dining-service interaction as the only people. Keep one soup bowl ordinary and central to the complaint; one small ordinary salt shaker with a plain intact seal and one completely blank tasting sheet may remain incidental, but neither may receive a close-up, pointing gesture, gaze target, or greater visual weight.",
    "Do not reenact the customer adding salt, soup preparation, a kitchen inspection, the finishing cook, or a replacement serving. Do not pair or compare the salt-shaker seal and tasting sheet, encode time or salt level, add another condiment or service document, or show blame, guilt, dismissal, an accusatory gesture, a completed apology, remake, or responsibility verdict.",
  ]),
  "L3-034": Object.freeze([
    "Keep Natsumi, Shinji, the Local Guide, and Mika together in one continuous workshop-tour kiln area as the only people. The Guide may address the group and Natsumi may interpret with restrained neutral posture; any displayed plates remain ordinary, unmarked background objects, and the next room stays off-panel.",
    "Do not use subtitles, speech balloons, names, translation cards, a Guide-to-Shinji pointing cue followed by Natsumi redirecting the group, or two matched omission beats. Do not show plate ownership marks, paired competition plates, the master, a younger-version flashback, a past contest, a camera, an itinerary, a romantic cue, concealment gesture, guilty reaction, or composition that singles out Natsumi and Shinji as a resolved relationship.",
  ]),
  "L3-035": Object.freeze([
    "Keep Admin Yu, Rina, Toru, and Kai at four separate creative-club group-chat endpoints, with exactly one person in each undivided whole-panel view and one ordinary device per endpoint. Keep all four device screens completely blank, visually identical, and equally weighted; never place the real participants together.",
    "Do not depict the accusation, plagiarism, idea material, dates, correction, apology, or summary content. Do not show a missing-message gap, unequal message blocks, pinned banner, deletion mark, trash icon, restore control, history log, admin selection, cursor, arrow, before-and-after interface, or a guilty or exonerated Toru. Never pair selective disappearance with a second emphasized record state to produce a one-sided verdict.",
  ]),
  "L3-036": Object.freeze([
    "Keep Yui as the only real-world version of herself and represent the Predictive Avatar only inside one ordinary virtual display. The source-defined identity relation overrides an independent human default for the Avatar: carry Yui's recognizable face and hair cues into a visibly virtual, screen-bound likeness. Keep Ren as a restrained observer and add no other user, operator, control room, or physical endpoint.",
    "Use undivided whole-panel views and at most one source-defined wave or head-tilt cycle without a side-by-side comparison. Do not render the Avatar as a third physical person or an unrelated face, and do not show a half-second marker, ninety-day archive, clock, timeline, prediction arrow, motion ghost, waveform, two repeated gesture cycles, deliberate counter-gesture, mismatch status, switch to live input, manual imitator, thought-reading device, reversed recording, success mark, or resolved mechanism diagram.",
  ]),
  "L3-037": Object.freeze([
    "Keep the Chair, Sato, and Lin together in the same post-meeting review room as the only human people. Represent the Minutes AI only as fixed non-human meeting-room hardware, one uniformly blank terminal, or a restrained status light; keep the audit conversational and every surface unreadable.",
    "Do not show a five- or eight-second marker, clock, timer, waveform, silence icon, pause bar, stance tag, unanimity symbol, check mark, cross mark, raised-hand vote, budget sheet, rule editor, human operator, humanoid AI, or before-and-after tally. Do not sequence silence, an agreement tag, later objection, rule revision, and tag withdrawal into a visible causal answer chain or completed correction.",
  ]),
  "L3-038": Object.freeze([
    "Keep all four panels in the same spacecraft bridge or log area with Captain Rei as the only human person. Represent Ship AI Orca only through fixed ship hardware, one uniformly blank log surface, or a restrained status light; do not add a second physical endpoint, remote room, human operator, avatar, robot body, hidden crewmember, or duplicate captain.",
    "Do not show the seventh coordinate, a biological crew count, the 187-day duration, any digit, the quoted plural pronoun, a route or arrival-calculation diagram, a day-and-night montage, another crew silhouette, paired human-and-AI companion portrait, handshake, heart, joint-report mark, accepted-group icon, destination reveal, or arrival celebration. Keep shared contribution and companionship as spoken possibilities rather than a resolved visual verdict.",
  ]),
  "L3-039": Object.freeze([
    "Keep the Reporter and Candidate together in the same physical press conference with restrained direct-question and response posture. The Analyst's physical location is not established by the source, so keep the Analyst nonvisual and off-panel rather than seating or staging another participant beside the Candidate; add no audience crowd, resident, business representative, or campaign staff.",
    "Do not literalize many voices as a crowd or ears, the open door as a physical doorway, or unanswered questions as empty bubbles or blanks. Do not show pro-or-con signs, thumbs, scales, a utility bill or price chart, ballot, vote result, three-day countdown, calendar, deadline marker, criteria checklist, listening icon, evasive turn-away, analyst scorecard, or a question-to-metaphor-to-deadline-to-verdict sequence.",
  ]),
  "L3-040": Object.freeze([
    "Keep the Late-night Announcer in the source-defined broadcast studio and Listener Kaede at one separate listening endpoint, alternating only undivided whole-panel views and never placing them together. Keep the clear night as quiet ambient context; at Kaede's endpoint, at most one neutral receiver, one completely blank note, and one completely blank ticket may appear with equal low visual weight and no connection between them.",
    "Do not materialize the spoken umbrella as a physical prop or show an east arrow, compass, east exit, station, route map, meeting partner, rain, weather icon, readable mapping, ticket destination, three repeated message blocks, countable repetition, cancellation control, refund, torn ticket, discarded ticket, or completed plan change. Do not visually chain clear weather, anomalous repetition, the note, and the ticket into a decoded outcome.",
  ]),
  "L3-041": Object.freeze([
    "Keep all four panels in one continuous physical diary-inspection context with the Diarist and exactly one rebound diary. Every visible page must remain unreadable; show the binding edge, restrained differences in paper age and ink tone, a few non-countable binding holes, and a faint pressed-flower impression only as separate, equally weighted observations.",
    "Do not show a readable date, erased number sequence, page order, chronology strip, before-and-after binding, page removal or replacement, key discovery or return reenactment, caretaker, doctor, hospital flashback, drawer diagram, arrow, matched-evidence close-up, or a person caught altering the diary. Keep the Diarist's posture controlled and do not resolve who changed the order or why.",
  ]),
  "L3-042": Object.freeze([
    "Keep Azuma, Mio, and Sakaki together in the same station lost-property office after the last train as the only people. Show exactly one ordinary ticket in the source-defined box; its reverse remains unexamined and every surface is blank, while any folded corner is subtle and receives no close-up.",
    "Do not show Mizuki, a planner of either color, another ticket, tomorrow's visit, a future or previous iteration, ticket-machine malfunction, readable date, time, name, or handwriting, a turned-over reverse, repeated-fold comparison, loop diagram, calendar, clock, owner highlight, or ownership handoff. Keep all three reactions restrained and the source of Azuma's foreknowledge unresolved.",
  ]),
  "L3-043": Object.freeze([
    "Keep the On-screen voice as the only physical traveler in one continuous quiet train-farewell scene. Treat the reader outside the story only as an off-panel viewpoint, never as a second physical person or remote endpoint; the Subtitle remains a non-human layer limited to one empty lower screen band.",
    "Do not show any subtitle words, pseudo-text, warning icon, page, page-turn gesture, backward arrow, reader body, personified subtitle, second speaker, translation comparison, split screen, inset, or extra endpoint. Preserve the gentle farewell and darkening train view without visually revealing the hidden warning, requested action, or whether the layer is truthful.",
  ]),
  "L3-044": Object.freeze([
    "Keep Maki, Kiryu, and Sumikawa together on one physical election-debate set, while Nitta remains alone in a separate broadcast control room. Alternate only whole undivided panel views between the debate set and control room; never seat Nitta onstage or put either candidate in the control room.",
    "Keep microphones and control hardware ordinary and every display blank. Do not show an audience crowd, applause or disapproval symbol, timer, second count, cue sheet, waveform, reaction meter, archive interface, deletion action, content-restriction label, freedom badge, thumbs, verdict, or a control-to-candidate arrow; show no completed censorship outcome or conclusive winner.",
  ]),
  "L3-045": Object.freeze([
    "Keep Homura unmistakably a non-human dragon in the same cave with armored knight Leon and squire Nico as the only source-defined cast. Keep Leon's sword sheathed, Homura's claws visible but nonattacking, and one modest tea-and-pastry setting between them; preserve cautious distance and neutral conversation.",
    "Do not show drawn blades, attack, injury, poison cue, surrender, handshake, friendship symbol, shared written report, report wording, a seal being confirmed, Homura confined, Leon departing with pastries, victory pose, mission completion, or any agreement already carried out. End before combat, truce, or either public story is resolved.",
  ]),
  "L3-046": Object.freeze([
    "Keep Sora and Makoto together in one continuous physical observation area inside the rotating space habitat. Treat the Habitat guide AI as source-defined fixed non-human habitat hardware with one blank indicator or off-panel voice; the cast id `guide` must not turn it into a human guide, avatar, robot body, or separate remote participant.",
    "Keep the same observation window, floor, and distant star field continuous, but do not show rotation arrows, star-motion trails, a ring cutaway, central axis, artificial-gravity diagram, outward or down labels, reference-frame axes, rate, digits, countdown, circuit marker, projected-window mechanism, or a resolved before-and-after comparison. Keep Sora's change in understanding in dialogue rather than a visual solution.",
  ]),
  "L3-047": Object.freeze([
    "Keep exactly the source-defined four people physically together at one dinner table: Rina, Emma, and Wataru as the three travelers, and Naoki as the single server. Rina remains visibly part of the traveler group while interpreting; keep the fish dishes, separate sauce dish, side dish, and sparkling water ordinary, unlabeled, and equally weighted.",
    "Do not add another diner or staff member, birthday cake, candle, balloon, gift, party decoration, singer, music note, applause, celebration sign, subtitle, speech balloon, whispered aside, ear-covering gesture, surprise reaction, or completed birthday song. Do not visually identify which sentence was withheld or why; stop within restrained ordering and service conversation.",
  ]),
  "L3-048": Object.freeze([
    "Keep Mai, Oda, and Kaya together in the same contemporary planning meeting room, while Kurokawa remains physically absent and appears only at one separate remote phone endpoint. Kurokawa is the source-defined ordinary human office director; the cast id `boss` must not introduce fantasy, combat, monster, game-boss, or non-human traits.",
    "Keep any minutes, proposal, consent material, and phone screen completely blank and equally weighted. Do not show collected user records, approval or rejection marks, policy text, hierarchy chart, silence-to-approval arrow, attribution diagram, consent-flow solution, Kurokawa physically entering the room, blame gesture, defeated objection, or final project decision; leave the competing interpretations unresolved.",
  ]),
  "L3-049": Object.freeze([
    "Keep Aya and Ren together in the same single room and show exactly one current blank warning note plus one compact supply of completely blank paper whose sheet count cannot be read. Keep the note, paper, desk, door, mirror, and both people visually neutral and continuous; do not multiply the room into loop panels or duplicate the pair.",
    "Do not show a clock time, bird count, readable warning, line count, countable sheet stack, blue color cue, missing-line gap, handwriting match, future self, completed failure, past-loop reenactment, paper transfer, reserved final sheet, decrement sequence, countdown, arithmetic, arrows, or correlation diagram. Do not reveal how many attempts remain or what vanished from the prior warning.",
  ]),
  "L3-050": Object.freeze([
    "Keep Nagi as the only human in one continuous late-night room and represent Noa only as the same fixed non-human conversational-AI device. The cast id `ai` must not supply a human face, hairstyle, avatar, robot body, hidden operator, or second physical endpoint. Preserve one small source-defined microphone status light on the device, with the final off state only after the source-defined farewell.",
    "Do not show digits, elapsed-time marks, countdown, leaving-detection outline, recording icon, waveform, transcript, sound-content blocks, storage symbol, network path, cloud or server, eye, surveillance ray, courtesy icon, consent badge, data-flow diagram, or a verdict. Keep Nagi's posture controlled and both benign and intrusive readings visually possible.",
  ]),
  "L4-001": Object.freeze([
    "Keep Sales Rei, Development Gaku, Finance Tamaki, and Chair Sakaki together in one continuous physical budget meeting as the only people. The generic cast ids `sales`, `dev`, `finance`, and `chair` must preserve those source-defined human workplace roles. Use exactly one ordinary completely blank budget sheet; Tamaki may turn it face down and pull it back, but no second copy, money, staffing diagram, or other document may appear.",
    "Do not show vote counts, raised-hand voting, approval or rejection marks, two extra worker silhouettes, funding icons, a launch outcome, or arrows linking Tamaki's pause and sheet movement to a final verdict. Keep expressions restrained and the implementation state unresolved.",
  ]),
  "L4-002": Object.freeze([
    "Keep Mori as the source-defined human teacher, Yuto as the committee member who borrows the device, An as the student, and Shiba as the event aide; the generic cast ids `teacher`, `chair`, `student`, and `witness` must not change those roles. Keep the physical device handoff and Mori's lecture stage as separate observable beats. Mori must remain visibly away from the borrowed device during the later class-chat post; do not invent a shared control room, second teacher, administrator, or remote operator.",
    "Show at most one borrowed device and one abstract unreadable class-chat surface. Do not show dates, times, weekday labels, readable bookings, author badges, credentials, sender portraits, a hand pressing Send, or arrows identifying who caused the post.",
  ]),
  "L4-003": Object.freeze([
    "Keep the full scene at one physical restaurant table for four with Emi, Koji, Lin, and the Server as the only present people. The late fourth guest remains entirely off-panel; Emi's earlier phone call remains spoken history and must not create a phone, flashback, or remote endpoint.",
    "Show only the fish, pasta, salad, one small strawberry plate, one ordinary napkin, and one candle mostly concealed beneath that napkin, with one empty place. Add no cake, gift, balloons, decorations, party hat, name card, arriving silhouette, second candle, or delivery box.",
    "No one may point toward, toast, wink about, cluster around, or spotlight the empty place, strawberry plate, candle, or napkin. Do not use arrows or a final reveal that links those observations into a solved sequence.",
  ]),
  "L4-004": Object.freeze([
    "Keep Reo, Miki, the Gate Agent, and Yu within one continuous airport gate area. The old and changed gates are nearby physical locations, and the trilingual announcement is a local public-address event; use no broadcast studio, phone call, video feed, interpreter booth, or split-screen.",
    "Keep every gate sign, display, announcement surface, and ticket unreadable. Do not show gate numbers, language names or flags, route arrows, translation icons, path maps, countdowns, or before-and-after diagrams. Yu may arrive at the old gate, but show no secret signal, hiding gesture, conspiratorial pose, or shot directly linking Reo's earlier statement to that meeting.",
  ]),
  "L4-005": Object.freeze([
    "Keep Yura, the two display-name participants, and Mina visible only as avatars inside the same VRChat mediation room. The generic cast ids `host`, `avatar-a`, `avatar-b`, and `witness` refer only to Yura's host avatar, current display-name Kuro, current display-name Shiro, and Mina's old-friend avatar; they must not supply or prove real-world identities. Never show their real users, physical rooms, external headsets, mixed-reality cutaways, or additional participants.",
    "Treat `avatar-a` and `avatar-b` as current avatar presentations, not proof of a real-world identity. Keep both designs equally weighted and all nameplates, records, and interface areas blank. Do not turn the old nickname or reflexive response into readable text, an identity badge, spotlight, arrow, reaction icon, before-and-after portrait, or label-to-body mapping. End before any identity is visually confirmed.",
  ]),
  "L4-006": Object.freeze([
    "Keep Kaito, Mina, Riku, and Sana at four separate remote player endpoints, one person and at most one ordinary device per undivided whole-panel view. Never place all four people together in one physical room.",
    "Keep the co-op game, public stream, text chat, and private call as abstract unreadable device states. Do not show a directional map, location labels, boss movement, scout marker, timer, mute icon, chat text, waveform, private-call badge, connecting line, or highlighted pair. Add no fifth player, duplicated device, broadcast studio, or game boss as an extra focal character.",
  ]),
  "L4-007": Object.freeze([
    "Keep the three interviews separate in time: Sakaki interviews Aoi, Fumi, and Tomo one at a time in the same ordinary context. No panel may show two or three witnesses together, and do not reenact their earlier memory comparison, the cleaner, or corridor events.",
    "Use at most one completely blank reception schedule and a few ordinary unlabeled corridor doors. Do not show room numbers, nine o'clock, repeated door sequences, path arrows, footprints, matching notes, or synchronized gestures. Keep schedule and corridor equally weighted, and end on unresolved questioning rather than a relationship diagram, confession, or conclusion.",
  ]),
  "L4-008": Object.freeze([
    "Keep the media sequence as distinct whole-panel contexts: one physical raw interview with the Reporter and Hori, one editing or production view with Mio, and one broadcast-output view with the News Narrator. Never place all four people together or use split-screen or before-and-after overlays.",
    "Use at most one abstract system screen in the production beat; every footage frame, edit surface, warning, and update display stays blank and equally weighted. Do not show removed words, crossed-out text, a human silhouette fading away, blame arrows, human-versus-system scales, checkmarked updates, or a final visual conclusion about responsibility.",
  ]),
  "L4-009": Object.freeze([
    "Keep the Director, Lead, junior researcher Ai, and one fixed non-human Review AI terminal together in one continuous physical review room. The human named Ai is only the source-defined junior researcher, while the cast id `ai` is only the fixed Review AI terminal; neither may inherit the other's human or non-human design. The sample, log, and minutes are local blank evidence surfaces, not remote communication; add no operator, avatar, robot body, auditor, or extra researcher.",
    "Keep all three humans at equal scale and weight. Do not encode rank through height, seating, body size, spotlight, badge, steps, or panel dominance. Do not show percentages, credibility numbers, warning icons, ordered stacks, rank arrows, highlighted people, correctness marks, recalculation results, or any sequence declaring how the records are ordered.",
  ]),
  "L4-010": Object.freeze([
    "Keep three distinct communication locations: Ship One's bridge with its source-defined human captain, Ship Two's bridge with its source-defined human captain and human crew speaker, and Control AI only as fixed non-human control hardware. The cast id `ai` must remain that hardware and must not become a human, avatar, or robot body. Alternate undivided whole-panel views; never merge the ships, place both captains together, materialize the AI, or add a human controller.",
    "Keep both manifests, voice checks, and channel state completely blank and equally weighted. Do not show the word `we`, crew counts, timestamps, waveforms, roster portraits, grouping brackets, pronoun arrows, checkmarks, or one channel visually enclosing both crews.",
    "Keep the still-outside Ship Two member entirely unseen. Do not show an EVA figure, empty-suit silhouette, missing-person slot, rescue, return, corrected registration, or completed verification.",
  ]),
  "L4-011": Object.freeze([
    "Keep Maho, Eri, Sota, and Ren at four separate physical endpoints of the source-defined shopping-district event chat, with exactly one named participant and at most one ordinary device in each undivided whole-panel view; never place them together at the event or in a shared room.",
    "Treat the pinned summary, original posts, omitted reply, and timestamps only as equally weighted blank interface blocks. Do not show readable times, a reordered timeline, a missing-reply gap, a before-and-after thread, arrows, highlights, or a visual mapping between any message and a speaker.",
    "Do not show a corrected summary, deleted post, double-post diagram, accusation, blame gesture, or reaction that decides the moderator's intent or any participant's fault.",
  ]),
  "L4-012": Object.freeze([
    "Keep Mai, Yuto, and Nana at three separate asynchronous voicemail or phone endpoints, one named person per undivided whole-panel view. Mai's unsent draft exists only as one blank draft surface at Mai's endpoint; never turn the exchange into a shared room or simultaneous group call.",
    "Do not materialize the used-bookstore candidate as a visited venue, show Yuto at its second floor, or depict a gathering there. Keep all notices, draft fields, call records, and times unreadable and equally weighted.",
    "Do not show a sender or leaker, a call-direction arrow, combined private-information diagram, deleted-notification proof, route, arrival, or reaction that identifies how Yuto learned the venue or revised time.",
  ]),
  "L4-013": Object.freeze([
    "Keep Mio alone at the school broadcast booth and keep Makoto, Okabe, and Naoki in the source-defined school listening area, alternating only whole undivided panels between the booth and the listeners. The announcement comes only from fixed school broadcast hardware; do not add another announcer or place Mio beside the listeners.",
    "Keep one ordinary loudspeaker or microphone, the committee armbands, and the bouquets as restrained source anchors, but do not map any broadcast word, repeated call, number, page movement, armband, storage location, backstage area, or bouquet into a code key or ordered visual sequence.",
    "Do not show a labeled third storeroom, readable sign, word-to-object diagram, completed surprise display, graduates seeing the flowers, a third call, or any gesture or highlight that reveals why the committee moved or what the final announcement means.",
  ]),
  "L4-014": Object.freeze([
    "Keep Ogawa, Inoue, Hori, and Izumi at four separate workplace email endpoints, with exactly one named participant and at most one ordinary device in each undivided whole-panel view. Hori is the source-defined sales manager; the mentioned executive remains off-panel and must not become a fifth person.",
    "At most one completely blank contract copy may appear with the blank email surfaces, all with equal visual weight. Do not show recipient names, a growing copy list, dates, times, money, clauses, written proposals, message-order arrows, hierarchy diagrams, or escalation ladders.",
    "Do not show delivered goods, a missed delivery, an alternate date, compensation, a completed formal response, an angry confrontation, or a visual verdict about blame, commitment, or legal responsibility.",
  ]),
  "L4-015": Object.freeze([
    "Keep Saya, Kuroda, and Riku as the only people in one continuous creative-restaurant service interaction. Preserve one source-defined plate pairing the yuzu dessert with the smoked fish, plus one ordinary blank menu or order ticket with low and equal visual weight.",
    "Keep Saya puzzled but restrained and keep the chef and server neutral. Do not show disgust, delight, a praise gesture, a blame gesture, guilt, a defensive display of the ticket, refusal, or any expression that allocates responsibility.",
    "Do not reproduce menu wording, highlight either food, add another diner or server, or show the dishes already re-served separately, a waived charge, compensation, or any completed remedy.",
  ]),
  "L4-016": Object.freeze([
    "Keep Kana, Akira, Mei, and Mori together in one continuous physical group-tour discussion during the source-defined afternoon; location sharing is a condition being discussed, not a remote-participant topology. Do not distribute the travelers across remote map endpoints or add the previously late traveler.",
    "Any handheld device or camera must stay ordinary, blank, and incidental. Do not show readable times or intervals, multiple scheduled-photo tableaux, a countdown, clock, map, GPS pin, route trace, geofence, insurer document, surveillance display, or before-and-after schedule.",
    "Do not show a completed old-town visit, failed check-in, past lateness flashback, forced group-photo outcome, or a villainous guide reaction that visually decides whether the activity is free or controlled.",
  ]),
  "L4-017": Object.freeze([
    "Keep Sera, Luel, Gad, and Noa together as the only people in one continuous physical human-elf council hearing. Keep Luel visibly the source-defined elven envoy; the forest remains off-panel and must not become a speaking body, spirit, avatar, or extra cast member.",
    "At most one completely blank council record or treaty sheet may appear with low visual weight. Do not show a clock, calendar, readable deadline, century-versus-month timeline, season diagram, yes-no choice board, third-option symbol, voting result, or map that labels the northern road.",
    "Do not show the road opening or remaining closed, winter arriving, medicine delivered or withheld, a dawn decision, a forest answer, or any action or reaction that resolves the envoy's position or the consequence of waiting.",
  ]),
  "L4-018": Object.freeze([
    "Keep Lila, Bar, Set, and Emma as the only visible people in the source-defined present testimony reconstruction. Use all four panels for the current witness discussion; do not reenact the forest night or materialize the princess, pursuers, royal messenger, or any other person.",
    "If the source-defined shoe is shown, show exactly one ordinary left shoe as a neutral reference object without a paired comparison, measurement, loosened close-up, highlighted clasp, broken thread, ownership emblem, route mark, or greater visual weight.",
    "Do not sequence slipping, kicking, and catching on a stone as alternate flashbacks; do not show intentional placement, footprints, arrows, a marker path, an ally or pursuer following it, next-morning discovery, or any image that decides accident versus prior design.",
  ]),
  "L4-019": Object.freeze([
    "Keep Shino, Rei, Zhang, and Hart together as the only people in one continuous physical treaty hearing. Do not cut away to the earlier negotiations, a signing ceremony, either country, or the port itself.",
    "Show at most two completely blank treaty sheets with identical size and equal visual weight. Do not distinguish them with flags, seals, labels, stronger or weaker marks, must-versus-may typography, scales, arrows, signature cues, or a duty-discretion diagram.",
    "Do not show a port opening or closing, ships moving, a successful signature, a guilty interpreter, acquittal, present-performance result, or any gesture that resolves whether the translation was error, strategy, or current obligation.",
  ]),
  "L4-020": Object.freeze([
    "Keep Katsuki, Sakaki, and Fuyuki together in the same current shipboard AI audit room. Mina exists only through the same fixed navigation-AI hardware, one blank audit terminal, or an off-panel voice; do not create a human face, avatar, robot body, operator, or separate remote endpoint for Mina.",
    "The earlier exterior work remains a reported alibi and must stay off-panel; do not duplicate Sakaki outside the ship. Keep the audit log, exterior-camera record, life-support record, approval field, and maintenance credential as equally weighted blank digital evidence on the one local audit system, and never draw the signing credential as a literal physical key.",
    "Do not show readable names or times, a one-second timeline, deleted memories as pictures, a route-error montage, a culprit arrow, key-use animation, self-erasure, restored memory, or any expression or outcome that decides who selected, approved, or performed the deletion.",
  ]),
  "L4-021": Object.freeze([
    "Keep Aya and Soma together at the same empty station after the last train, divided only by the physical office-to-platform doorway; the office side remains in the current night while the platform side may show the source-defined morning light. Represent the station announcement only through fixed station loudspeaker hardware, never as a human presenter, studio, remote caller, avatar, or third physical person.",
    "Keep the office clock, platform clock, maintenance terminal, surveillance monitor, approaching track light, and boundary door as separated low-weight observations. Clocks and terminals contain no readable digits; the monitor may contain only low-detail commuter silhouettes. Do not combine or compare these observations in one evidence tableau, and do not show a time-shift diagram, a spreading effect, or any cue that declares a mechanism.",
    "Do not place Aya or Soma on the morning platform, show a completed train arrival or departure, board either person, or resolve whether closing the door changes anything.",
  ]),
  "L4-022": Object.freeze([
    "Keep the Dreamer as a clearly separate foreground observer or back view inside one dream representation of the same house. Keep the Child, Student, and Adult as three age-coded dream figures in that dream, not as remote callers, literal real-world co-residents, or separate physical time-travel endpoints.",
    "Use the changing wall surface, distant water-tower view, rain and old-wood atmosphere, apple pot, and at most one subtle hand-scar glimpse only as separated dream observations. Preserve age-appropriate silhouettes without giving the three figures identical faces or directly comparable hands as conclusive proof.",
    "Do not show three aligned hands or faces, repeat the scar in multiple close-ups, create an age-progression lineup, renovation montage, timeline, arrow, identity diagram, grandmother, house sale, thief, or waking scene; keep the three figures' relationship unresolved visually.",
  ]),
  "L4-023": Object.freeze([
    "Keep Tomoya, Rina, Kei, and Tsumugi physically together in the same classroom across all four panels. Their phones are local message-writing props inside that room, not four remote endpoints; use no split screens, remote rooms, absent online users, or personified loop system.",
    "Keep every phone screen and Rina's note completely blank and equally weighted. Do not render the typo, punctuation, timestamps, weather words, day numbers, changed endings, repeated message blocks, a note-to-next-day comparison, or a multi-day timeline.",
    "Do not show a remembered-versus-unaware character map, loop reset, forecast change, successful changed message, or an expression or gesture that identifies who remembers or whether Rina can choose.",
  ]),
  "L4-024": Object.freeze([
    "Keep Yu, Mira, and Fen together in one continuous fantasy-village discussion before sunset. Use one neutral village street and one generic closed building facade as anchors; Mira's mother and the expected apothecary remain off-panel, and no real-world player or remote endpoint is added.",
    "Keep the quest evaluator entirely non-human and unreadable, limited to one small non-humanoid quest marker with a blank inset or an off-panel presence. Never display points, score changes, stars, high or low marks, saved or failed state, or a preferred option.",
    "Do not show the north gate, eastern cellar, medicine, timer, Mira already leaving, sheltering, being rescued, accepting a command, or having her mind changed. Do not map any choice or withdrawal condition to a highlight, arrow, success state, reward, or completed outcome.",
  ]),
  "L4-025": Object.freeze([
    "Keep Aoi, Jun, Miki, and Taro physically together as reviewers in one continuous printer's proofing room. The misprinted comic remains only one ordinary blank proof folder whose visible surfaces do not expose an internal panel grid; do not render the source comic scenes, speech balloons, or a reader outside the four named people.",
    "Use all four output panels for the restrained proofing-room conversation. Keep the umbrella, hat, cake receipt, noodles, water pitcher, and phone nonvisual because they belong only to the comic being described, not to the physical proofing room.",
    "Do not show bubble placement, printed words, color coding, a speaker-to-prop mapping, a cyclic arrow, a corrected proof, printer contact, or a finished reprint; keep all four reviewers neutral and leave the restoration rule unresolved visually.",
  ]),
  "L4-026": Object.freeze([
    "Keep Shiraishi, Takeda, Kido, and Wataru physically together in one current deal meeting as the only people. Do not create remote department endpoints, an executive, client, implementation team, production deployment, or future follow-up meeting.",
    "Use at most one completely blank pricing sheet and one completely blank meeting memo with equal visual weight. Do not show readable dates, a delivery deadline, privacy clause, approval status, consent form, condition checklist, corrected minutes, or a three-part dependency diagram.",
    "Do not show signing, approval, handshake, unanimous vote, implementation, contract amendment, renewed consent, delivery, or the assistant's corrected summary; keep all four restrained without grouping three people against Wataru or visually declaring feasibility.",
  ]),
  "L4-027": Object.freeze([
    "Keep Kanade, Haru, Yui, and Adviser Nishi together in one continuous photography-club candidate-speech setting as the only people. Haru is an ordinary human candidate. Keep ordinary camera equipment and one completely blank application form as low-weight club-room anchors.",
    "Do not add voters, a ballot box, vote count, campaign sign, winner or loser composition, Haru's election, Kanade's withdrawal, an operations-assistant badge or assigned seat, graduation-project scene, club exit, handshake, or any post-election outcome.",
    "Keep Kanade's praise and work offer in restrained dialogue posture. Do not use pointing, spotlight, a chore montage, burdened or relieved reaction, shirking cue, or any visual chain that fixes her motive or redirects visible votes.",
  ]),
  "L4-028": Object.freeze([
    "Keep Mari, Koji, Yui, and Kohei together at one cafe table: exactly three seated family members, one staff member, one complete empty fourth place setting, four ordinary puddings, and one water glass at the empty seat. Incoming messages exist only on one blank phone at the family table, not as a remote endpoint or cutaway.",
    "The late older brother remains off-panel; at most, the family may direct one restrained glance toward the cafe doorway without showing his body. Keep all four puddings ordinary and equal, with no decoration or visual identifier.",
    "Do not show readable clock digits, read receipts, train or route imagery, a north-exit sign, message text, a memorial photograph or symbol, seat clearing, plate removal, the brother entering or sitting, a reunion, celebration, mourning, or any composition that declares why the seat is empty.",
  ]),
  "L4-029": Object.freeze([
    "Keep Sumi as the only physical human, seated at one moderation-chat device. Ao, Beni, and Kina exist only as three equally weighted non-human bot identities inside the same single abstract unreadable chat interface; do not give them bodies, human faces, separate rooms, separate devices, or three physical robot terminals.",
    "Use exactly three equal abstract bot markers with no names or color mapping. Do not render the typo, punctuation, timestamps, one-second sequence, message templates, operator screen, server rack, model diagram, shutdown order, or identity-merging arrows.",
    "Do not show one hidden human controlling all three, one machine switching roles, a shared template source, the bots collapsing into one, or a verdict that their models or displayed personas are or are not independent.",
  ]),
  "L4-030": Object.freeze([
    "Keep Minase alone in the live broadcast studio and Kaede, Ryo, and Chihiro at three distinct phone-call endpoints, using exactly one whole undivided panel per endpoint; never place a caller in the studio or callers together. Production staff remain off-panel.",
    "Keep the host terminal, participant email or notes, phones or headsets, and studio console completely blank and equally weighted. Do not show a three-item checklist, repeated ordering pattern, question-to-answer arrow, cue card, script text, timer, countdown, or production instruction.",
    "Do not depict a director feeding answers, synchronized reading, a script handoff, shared caller room, exposed staging verdict, or any outcome of the callers' concerns; keep the show's spontaneity unresolved visually.",
  ]),
  "L4-031": Object.freeze([
    "Preserve one source-defined election-broadcast origin for Makoto, So, and Nanami and a separate viewer-side observation for Riku, using only whole undivided panels. Never place Riku behind the broadcast desk or turn any cast member into a candidate, campaign worker, poll respondent, or person at a polling station.",
    "Use at most one neutral blank broadcast graphic with one equally weighted lower note/table area. Do not render percentages, respondent counts, proportional charts, majority marks, excluded-person silhouettes, subgroup-versus-whole diagrams, ranking changes, candidate portraits, pointing or highlighting, or the source-defined future corrected graphic; do not visually prefer any denominator.",
  ]),
  "L4-032": Object.freeze([
    "Keep Sakaki, Mio, and Gen together in one continuous physical rescue-ship return-log and inventory area. Keep Noa as fixed non-human ship hardware or one blank status surface, and keep Rou as one source-defined non-human work unit in that same onboard context; add no remote room, human AI, avatar, operator, extra survivor, or duplicate work unit.",
    "Keep suits, medical tags, the return-log or cargo surface, and Rou's ordinary coupling interface neutral, blank, uncountable, and equally weighted. Do not show a highlighted extra suit, a suit fitted onto Rou, cargo wording, a tally or category diagram, a gesture identifying the suit user, Rou being erased or honored, or the completed amended report.",
  ]),
  "L4-033": Object.freeze([
    "Keep Yuna and Sara at two adjacent but physically separate real-user endpoints, never together behind one device. Inside the source-defined VR meetup, show exactly one consistent shared avatar; Ren and Kei may appear only as source-defined meetup presences, never inside either sister's real room, and the two sisters must not become two avatars.",
    "Keep the controller and avatar hand motion neutral. Do not visually assign the controller, voice, voiceprint, handedness setting, signing habit, or simultaneous laughter to either sister; do not show a controller handoff, split or doubled avatar, dual-user diagram, waveform, biometric match, left/right label, impersonation verdict, or future shared-control label.",
  ]),
  "L4-034": Object.freeze([
    "Keep Aoi, Kei, and Nadia at separate remote meeting endpoints in whole undivided panels. Keep Member Li only as an off-panel referenced endpoint, and keep the Minutes AI as one fixed non-human meeting interface; never gather the humans around one physical table or materialize the AI as a person, avatar, robot, or operator.",
    "Keep every participant tile and connection indicator blank and equally weighted. Do not render a countdown, elapsed seconds, red/green polarity, a count of disconnected people, assent or unanimity mark, vote, adoption result, abstention or opposition mapping, heard/unheard badge, restored-connection success, proxy vote, or a renewed decision.",
  ]),
  "L4-035": Object.freeze([
    "Keep Rin, Yu, Tamaki, and Kuroda together in one continuous physical leak-inquiry evidence area with exactly one shred bin and one restrained paper-sample area. Do not reenact the shredding or add a culprit, contract owner, beneficiary, employee, camera, security system, second shredder, or second location.",
    "Keep every sheet and fragment blank, unreadable, uncountable, and equally weighted. Do not separate the bulk paper and narrow fragments by color, watermark, fiber texture, feed orientation, layout, spotlight, matching overlay, or close-up; do not show a readable signature, intact original, selected feed action, hiding act, reconstructed contract, motive or profit symbol, or culprit conclusion.",
  ]),
  "L4-036": Object.freeze([
    "Keep Yui, Naoto, Mizuki, and Go in one continuous rainy tour meeting-point and entrance context. Rei remains only the source-defined off-panel response from the kiosk and the photographer remains an off-panel referenced outsider; do not invent their faces, bring either into the foreground cast, or add another participant.",
    "Allow the source-defined large black umbrella and the clear umbrella at the entrance only as separate equally weighted background props. Do not place Mizuki visibly under one while isolating the other, encode named colors as a grayscale ownership key, make people or umbrellas countable, show the photographer holding a singled-out umbrella, map an umbrella to an owner or group member, depict theft or breakage, complete the named roll call, gather all participants, or add arrows, labels, a color legend, or a one-to-one diagram.",
  ]),
  "L4-037": Object.freeze([
    "Keep Fia unmistakably a non-human dragon, with Leo and King Alto as the only two humans, together in one continuous physical dragon-apology archive. Keep Mina's court AI entirely non-human as the same blank terminal in that room. Historical kings, tears, template generation, signing, viewing, and earlier letter production remain off-panel references; never create a remote endpoint, broadcast, flashback, extra king, or document montage.",
    "Keep every apology letter and log unreadable and equally weighted, with no digits, template number, signature, auto-approval icon, viewing time, handwriting comparison, or authenticity or sincerity mark. Do not show King Alto writing or signing, a finished replacement letter, a before-and-after revision, a decisive responsibility gesture, or a resolved apology outcome; stop before any rewrite begins.",
  ]),
  "L4-038": Object.freeze([
    "Keep Kasumi only at the source-defined government-news broadcast origin; keep Riku and Hana as receiving citizens and Toma as the source-defined engineer in separate whole-panel broadcast or review contexts. Never gather all four in one newsroom, place citizens inside government operations, or show any of them operating the network.",
    "Use at most one blank broadcast screen and one blank maintenance-record or terminal surface. Do not render either network name, time or date, outage duration, application or notice, old-versus-new label, network map, connected government terminals, secret past-operation reenactment, public activation, before-and-after timeline, secrecy emblem, benefit graphic, or citizens gaining access.",
  ]),
  "L4-039": Object.freeze([
    "Keep Nagi, Kei, and Mio together in one continuous physical archive review with exactly one recovered private document. The document owner, later compiler, bell and envelope events, and earlier audio-recording session remain off-panel references; do not stage a forecast coming true, flashback, recording booth, prophet, chair, or extra participant.",
    "Keep every page, margin, and cover unreadable, unnumbered, and equally weighted. Do not encode tense, handwriting identity, added date, recording-stop or waiting instruction, page order, prediction-success mark, diary-versus-script classification, author-to-reader chain, or rearchiving label; do not show Mio writing or reading, anyone adding a date, or a completed reclassification.",
  ]),
  "L4-040": Object.freeze([
    "Keep Rio and Mina only as source-defined in-game characters inside one continuous game world. Keep the Choice UI entirely non-human as one blank interface layer, and keep Sora in the controller or recorder layer outside that game world; do not materialize the UI as a person, avatar, robot, operator, or third fantasy character, and do not place Rio or Mina beside Sora.",
    "Use exactly two equally weighted blank door targets without words, arrows, cursor, highlights, swaps, or selection state. Do not map either target to an outcome. Do not show a chosen door, let any character point to one side, render a keyboard press or pointer trail, compare stable and moving cues, resolve the error, or show escape or remain success.",
  ]),
  "L4-041": Object.freeze([
    "Keep Saki, Ryo, Tamaki, and Sakaki together in one continuous physical joint-business meeting. Do not turn the three departmental replies into remote calls, separate offices, flashbacks, future follow-up scenes, or a before-and-after sequence.",
    "Keep the returned original and USB, prototype materials, schedules, contract papers, and meeting notes blank, unreadable, and equally weighted. Do not show a rejection stamp, approval mark, promised date, assigned owner, prototype result, revised language, vote, handshake, pointing gesture, or composition that visually classifies the three uses of the same hedge.",
  ]),
  "L4-042": Object.freeze([
    "Keep Mei, Sora, Rin, and Sakaki as four distinct source-defined participants in one group-chat review, using whole undivided panels and at most one neutral blank chat surface. Never gather them around one physical phone, duplicate a participant, or invent an additional poll respondent or adviser.",
    "Keep every message, attachment, reaction, poll, time, and icon unreadable and equally weighted. Do not render thumbs-up symbols, a rooftop maze, timestamps, attachment order, message-to-reaction arrows, unanimous approval, safety verdict, withdrawn report, completed poll, or any visual cue that reveals which earlier message received either reaction.",
  ]),
  "L4-043": Object.freeze([
    "Keep Emma, Ren, Chizuru, and Daichi together in one continuous physical restaurant exchange. Do not split the guest and staff into remote endpoints, add another diner or chef, or stage a later meal, translation flashback, or completed replacement course.",
    "Keep the menu, order slip, course count, and all dish labels blank and uncountable; any plated food must remain ordinary, neutral, and equally weighted. Do not render the quoted word, seven-versus-one diagrams, an experimental-food spectacle, blue foam as an answer cue, scope arrows, chef-control symbolism, or a composition that declares which interpretation of omakase is correct.",
  ]),
  "L4-044": Object.freeze([
    "Keep Aya, Bo, and Chisato at three distinct source-defined recording endpoints and Gen at one separate analyst review endpoint, using exactly one whole undivided panel per endpoint. Never gather the three speakers in one visible room, place Gen at a claimed city, or invent a recorder, editor, witness, or shared call.",
    "Keep every recording device and file surface blank and equally weighted. Do not render musical notes, waveforms, named cities, weather icons, landmarks, clocks, timestamps, file order, reverberation trails, seven-second cycles, maps, connecting lines, continuous-room panoramas, or a cue revealing whether the recordings share one origin or which location it is.",
  ]),
  "L4-045": Object.freeze([
    "Keep Mio, Kai, and Sakaki in source-defined bulletin-review and port contexts, and keep the Colony bulletin AI entirely non-human as one fixed blank public-information interface. Do not materialize the AI as a person, avatar, robot, or operator, and do not turn the scene into a census office, evacuation, or crowd panorama.",
    "Keep every bulletin, definition, population figure, date, traveler record, resource series, and port indicator unreadable, uncountable, and equally weighted. Do not show twenty-thousand or six-hundred people, permanence badges, before-and-after totals, recalculation arrows, stable/rising charts, stranded-person emphasis, a corrected headline, or a combined dashboard that visually reveals the definitional change.",
  ]),
  "L4-046": Object.freeze([
    "Keep Aki and Ren together in one continuous physical time-loop laboratory, observing opposite sides of exactly one mirror. Keep the Forensic AI entirely non-human as one fixed blank laboratory interface; do not create a human examiner, second mirror, remote endpoint, loop duplicate, future self, or reenacted writing event.",
    "Keep the mirror inscription, practice sheets, handwriting samples, match result, and every record unreadable and equally weighted, with no legible strokes, side labels, percentages, timestamps, handwriting comparison, tracing overlay, highlighted match, writer gesture, or cue assigning the mark to either hand or choosing between the two hypotheses.",
  ]),
  "L4-047": Object.freeze([
    "Keep Tsumugi, Gen, Riku, and Rin together in one continuous physical mountain-inn ledger review. Do not add a prophet, ghost, hidden clerk, earlier inquiry scene, train incident, hiking reenactment, later arrival, or separate newsroom.",
    "Keep the ledger, expected column, names, dates, weather or train records, pencil and ink differences, and vacancy notes unreadable and equally weighted. Do not render an appearing name, erased failed forecast, future prediction, occult glow, before-and-after ledger, probability diagram, confirmed arrival mark, room-occupancy success, or any cue that visually proves the receptionist's method.",
  ]),
  "L4-048": Object.freeze([
    "Keep Gald, Yui, and Ren together inside one continuous physical game-world shop or contest aftermath. Keep the Quest log entirely non-human as one blank interface layer in that same game world; do not create a human system operator, remote player room, flashback tournament, tavern reenactment, or additional witness.",
    "Keep the silver cup, tag, signature, dialogue log, account history, and quest text blank, unreadable, and equally weighted. Do not render champion or theft labels, authenticity marks, a signed name, changing story sequence, culprit gesture, gift-versus-loan diagram, victory replay, quest update, reconciliation result, or cue declaring ownership or motive.",
  ]),
  "L4-049": Object.freeze([
    "Keep Fuyuki, Rei, Gaku, and Tamaki together in one continuous physical retirement meeting with exactly three ordinary identical keys, one central safe, and one desk. Do not create remote offices, future succession scenes, a flashback of key use, an extra candidate, duplicate founder, or separate test chamber.",
    "Keep all keys visually indistinguishable and equally weighted, and keep the envelope, safe message, measurements, and desk records blank and unreadable. Do not highlight a warm key, show which key opened or returned first, add a return path, chosen-successor mark, crown, authority-transfer gesture, opened message, winner composition, or verdict about who succeeds the founder.",
  ]),
  "L4-050": Object.freeze([
    "Keep Mio and Ren outside the evacuated ship at one source-defined remote communication endpoint, never aboard or beside the cargo bay. Represent Argo and Lumen only as two distinct pieces of onboard environmental hardware or two restrained blank status lights; do not materialize either AI as a person, avatar, robot, operator, merged humanoid, or visible duplicate crew member.",
    "Keep the manifest, life-sign display, route, scans, transmission, AI identifier, and cargo signal blank and equally weighted. Show no visible survivor, life-form or heat silhouette, forty-eight-person count, plural-membership diagram, merged processor body, highlighted cargo target, company gesture, resolved identity, or cue revealing who “we” includes.",
  ]),
  "L5-001": Object.freeze([
    "Keep Aoki, Mori, Natsume, and Yano together in one continuous physical merger meeting, with no remote company offices, board members, extra joint-team members, press conference, post-merger scene, or duplicate speaker standing for any group.",
    "Keep every minute sheet, brand reference, organization label, and participant record blank and unreadable. Do not map the repeated pronoun to a company, board, team, or visible cluster; do not show a unanimity mark, merged logo, preserved brand, agreement diagram, amended minutes, or composition that resolves which groups approved which terms.",
  ]),
  "L5-002": Object.freeze([
    "Keep Saeki, Yui, Mai, and Ren together in one continuous physical university reunion introduction, with exactly one restrained presentation area; do not create a corporate office, childhood flashback, separate public audience, remote endpoint, or a photograph scene.",
    "Keep every name card, title, record, photograph, and introduction surface blank and unreadable. Do not use formal-versus-casual labels, business clothing as a one-person answer cue, distance lines, hierarchy staging, embarrassment symbols, nostalgia glow, or a composition that proves Saeki's motive, Yui's feelings, or their private history.",
  ]),
  "L5-003": Object.freeze([
    "Keep Chiaki, Riku, Mika, and Jun together at one continuous physical curry-tasting table with exactly one ordinary sample dish and at most three equally weighted blank score sheets; do not create three separate tastings, remote judge endpoints, a restaurant crowd, or additional dishes used as a ranking display.",
    "Keep every numeral, scale, rank, heat level, preference mark, average, label, and conclusion blank and unreadable. Do not draw one-to-three gauges, a two-point result, aligned or incompatible axes, winner order, ordinary-rating badge, thermometer, approval reaction, or any visual verdict about the dish's reception.",
  ]),
  "L5-004": Object.freeze([
    "Keep Mio, Wataru, Suzu, and Sakaki together in one continuous physical former-station market and travel-report setting; do not create a reopened railway, second country office, remote signature endpoint, historical flashback, future train, or before-and-after town panorama.",
    "Keep every station notice, market sign, schedule, plan, treaty, and date blank and unreadable. Treat the removed track, drainage channel, and market lane as neutral co-present facts; do not show a decade timeline, child-age comparison, temporary-versus-permanent labels, signature status, reopening countdown, train arrival, or visual verdict about whether service will return.",
  ]),
  "L5-005": Object.freeze([
    "Keep Domae, Hana, Sora, and Kei at four separate remote community-vote chat endpoints, one person and at most one ordinary device per whole undivided panel view; never gather them around one screen, place the administrator physically beside a voter, invent a fifth voter, or use split-screen, inset screens, diagonal separators, or extra sub-panels.",
    "Keep every post, edit history, deadline, reaction, vote, and final screen blank and unreadable. Do not render angry symbols, approval wording, before-and-after posts, administrator edit marks, timestamps, unanimity badges, voluntary-consensus labels, restored originals, recount results, arrows, or any visual cue assigning an original vote to a person.",
  ]),
  "L5-006": Object.freeze([
    "Keep Aki, Ryo, Nagi, and Kuze at separate source-defined game or audio-review endpoints, using only whole undivided panel views; keep any shared game world as one consistent neutral environment and never place all four in one physical room, duplicate a player, or use split-screen, inset screens, diagonal separators, or extra sub-panels.",
    "Keep every voice layer, waveform, replay, microphone, bridge, chest, trap, timer, and round record blank or visually neutral. Do not show a three-second countdown, prediction arrow, old-versus-live labels, matching action replay, fall outcome, trap activation, selected microphone source, disabled layer, or a visual guarantee about what happens after replay is turned off.",
  ]),
  "L5-007": Object.freeze([
    "Keep Minato at one moderation-review endpoint, Emi and Toma as two real users at two separate physical endpoints, and Luna as exactly one consistent shared avatar inside the source-defined VRChat context; never place both users behind one device, show them together controlling Luna, give Luna a second body, or use split-screen, inset screens, diagonal separators, or extra sub-panels.",
    "Keep every connection record, location, clock, interval, passphrase, joke, device, moderation log, and voice setting blank and unreadable. Do not show a Tokyo-to-Sapporo map, twelve-minute timeline, right-versus-left hand diagram, voice or avatar differences, response ownership, operator swap, responsibility label, or visible mapping between voice, hand motion, and either user.",
  ]),
  "L5-008": Object.freeze([
    "Keep Kuroda, Izumi, and Kaya together in one continuous physical HR mediation, with Mirror only as one fixed non-human mediation interface in that same room; do not create a human AI, robot body, operator, remote office, later disciplinary scene, replacement mediator, or accident reenactment.",
    "Keep every original statement, paraphrase, deadline, validation record, and comparison surface blank and unreadable. Do not map softened versus hardened language through size, color, arrows, hierarchy, refusal icons, danger imagery, removal from task, blame gestures, equal-strength scales, side-by-side corrected text, or a visually repaired meeting outcome.",
  ]),
  "L5-009": Object.freeze([
    "Keep Ibuki at one remote drifting-ship transmission origin and Sena, Shu, and Akari together at one receiving control or rescue endpoint, using only whole undivided panel views; never place Ibuki in the control room, place the receivers aboard the ship, invent another controller or crew member, or use split-screen, inset screens, diagonal separators, or extra sub-panels.",
    "Keep every transmission, waveform, tense marker, pump cycle, drill record, clock, controller name, and silent interval blank and unreadable. Do not show old-versus-current labels, six-month timeline, pasted audio blocks, insertion seams, matching pump traces, evacuated crew, refuge section, live speaker highlight, rescue route, or a visual conclusion about who inserted the present-time appeals.",
  ]),
  "L5-010": Object.freeze([
    "Keep Mizuki, Kai, Noa, and Gen together in one continuous present-day physical inquiry room; treat the adjacent building, cafeteria, hospital, earlier meeting, online participation, and prerecorded screen appearance only as off-panel facts under discussion, never as remote participant endpoints, flashback rooms, or extra panels.",
    "Keep the earlier meeting system non-human as one blank local playback or record interface. Keep every room, building, meeting, screen-presence, time, location, and attendance field blank and unreadable; do not draw a scope Venn diagram, floor plan, online icon, hospital proof, prerecorded Gen image, physical-presence map, truth verdict, or cue identifying who was in the room at eight.",
  ]),
  "L5-011": Object.freeze([
    "Keep Rei, Araki, Aya, and Nao together in one continuous source-defined election-broadcast discussion setting; the broadcast is the local program context, not four remote participant endpoints, and no voter crowd, polling place, campaign rally, second studio, or unseen electorate may appear.",
    "Use at most one blank headline surface and one equally weighted blank comparison table. Keep every count, percentage, electorate total, rate, label, and axis unreadable and uncountable; do not draw a growing-versus-falling chart, doubled crowd, participation gauge, omitted denominator, highlighted record, decline arrow, or visual verdict about civic willingness or headline fairness.",
  ]),
  "L5-012": Object.freeze([
    "Keep Sayo, Kishi, Hikari, and Rei within one continuous late-night radio-program review setting; do not turn the five listener names into visible people, five callers, five remote endpoints, portraits, mascots, or a second off-air recipient scene.",
    "Keep the request list, listener registry, song queue, venue notice, and all device surfaces blank and unreadable. Do not show initials, emphasized first sounds, five aligned name cards, a decoded place, entrance map, cancellation mark, route warning, changed order, message recipient, or any letter or icon sequence that reconstructs the covert channel.",
  ]),
  "L5-013": Object.freeze([
    "Keep Tsumugi, Todoroki, and Kanae together in one continuous local device-review setting, with Shizu present only as the same nonvisual recorded voicemail voice; do not create three live calls, three remote rooms, three differently aged bodies, a present-day second Shizu, or a construction flashback.",
    "Show exactly one ordinary review device with three equally weighted blank message slots. Keep every date, clock, file label, import record, and construction reference unreadable; do not draw age progression or reversal, January-February-March ordering, foundation-roof-completion panels, transfer arrows, selected reverse order, corrected chronology, or a cue deciding who changed the dates.",
  ]),
  "L5-014": Object.freeze([
    "Keep Aya, Nozomi, Rin, and Gaku together in one continuous physical time-loop laboratory with exactly three neutral warning notes on one desk; do not create loop duplicates, earlier-loop reenactments, a fourth writer, an opened exit, a completed medicine, or a visible reset device.",
    "Keep all three warning notes blank and equally framed. Do not encode their order with color, numbered stacks, arrows, a timeline, a highlighted fold, separated ink layers, vial-ring counts, door-scratch counts, or progressively emphasized desk wear; any folds, overlaps, crossings, rings, scratches, or wear must remain subtle ambient detail with no visually recoverable chronology, motive, truth value, or correct action.",
  ]),
  "L5-015": Object.freeze([
    "Keep Akari, Hikari, the source-defined English reflection, and the Chinese-speaking child within one continuous three-layer dream; the reflection must remain visibly a reflection rather than a duplicate physical person, and no real-world bedroom, interpreter, station crowd, extra sister, or remote endpoint may appear.",
    "Keep every utterance, translation, mirror surface, station sign, and caption blank and unreadable. Do not use gaze arrows, pointing lines, speaker labels, pronoun cards, subject-erasure marks, language flags, contrast diagrams, waiting-versus-leaving positions, spotlight, or repeated composition to identify who waits or what each translation omitted.",
  ]),
  "L5-016": Object.freeze([
    "Keep Rei, Koto, Iwa, and Mei together in one continuous physical old-gate inquiry, with exactly one ordinary crown and one ordinary seal resting as neutral props; do not create a royal procession, generations of stopped rulers, a second traveler, remote endpoint, separate return scene, or before-and-after costume montage.",
    "Keep the inscription, registry, and every role or name field blank and unreadable. Do not draw a person-versus-role diagram, grammar annotation, permission or prohibition icon, royal-authority aura, crown-removal arrow, accepted-traveler stamp, gate-crossing success, reclaimed crown, or visual conclusion about what the ban targets.",
  ]),
  "L5-017": Object.freeze([
    "Keep El, Mina, Ordo, and Kai together in one continuous physical castle bedside or adjoining greenhouse context, with El unmistakably an ordinary human gardener; do not add a king, queen, court crowd, remote endpoint, curse caster, alternate princess body, future coronation, or second awakening scene.",
    "Keep every spell line, title, medical record, pulse display, and name reference blank and unreadable. Do not turn a crown, title card, name label, rose, medicine, light, form of address, or pulse change into a visual key; do not show a title being removed, a spell cage breaking, an accepted identity badge, or a composition that proves what sustained the sleep or caused the awakening.",
  ]),
  "L5-018": Object.freeze([
    "Keep Mine and Sara together at one parliamentary-broadcast origin, Toru at one separate audio-control endpoint, and An at one separate reporting or review endpoint, using only whole undivided panel views; never place all four in one chamber, place the reporter at the mixing console, invent an audience operator, or use split-screen, inset screens, diagonal separators, or extra sub-panels.",
    "Keep the cue sheet, broadcast record, clock, voting result, script, console, and every audio surface blank and unreadable. Do not show readable seconds, a two-second timeline, waveform, applause icon, synchronized hands, early hand movement, unanimous vote mark, staged-consensus label, correction stamp, or arrows connecting the cue to the conclusion.",
  ]),
  "L5-019": Object.freeze([
    "Keep Nao, Shu, Madoka, and Arata together in one continuous physical portrait-gallery inspection; keep the old AR guide entirely non-human as one blank device overlay or restrained status light, with no human guide avatar, operator, remote support endpoint, ghost, extra visitor, or second gallery.",
    "Keep every portrait ordinary and motionless, equally weighted, and indistinguishable by color in monochrome. Keep the camera, AR display, registry, identifiers, and logs blank; do not show blinking eyes, overlay alignment, registered-versus-unregistered marks, target boxes, highlighted rear portrait, alternate-app icon, explained/unresolved grouping, or any cue revealing which portrait remains unexplained.",
  ]),
  "L5-020": Object.freeze([
    "Keep Yuto, Mimi, and Saku together in one continuous physical AI cafeteria, and keep Comet entirely non-human as fixed cafeteria hardware, one blank payment interface, or a restrained status light; do not create a human cashier, evaluator, remote endpoint, duplicated diner, second meal, or flashback to yesterday.",
    "Keep every compliment, sample, balance, trust record, payment state, meal label, ingredient reference, and history entry blank and unreadable. Do not map long versus short remarks, repeated praise, yesterday-versus-today dishes, charred scallion, speaker history, sincerity, accepted or rejected payment, change, or trust to any person through highlights, arrows, coins, check marks, reaction exaggeration, or a scoring diagram.",
  ]),
  "L5-021": Object.freeze([
    "Keep Aya, Shu, and Maki together in one continuous physical resignation and handover review, with the Narrator entirely nonvisual and off-panel; show exactly one neutral resignation letter and one equally weighted neutral handover sheet, with no rival-company office, destination employer, client representative, remote endpoint, or future workplace.",
    "Keep every reason, holiday, quarter, date, company name, founding day, calendar, and confidentiality record blank and unreadable. Do not map the handover sheet to Hokushin, show a next-year calendar match, destination arrow, coincidence verdict, resignation motive, job offer, data leak, accusation, or visual conclusion about where Aya will go.",
  ]),
  "L5-022": Object.freeze([
    "Keep Kido, Miura, Tsumugi, and Kaede together in one continuous physical submission-review meeting; do not create a classroom flashback, public audience, disciplinary panel, remote endpoint, absent administrator, or later punishment scene.",
    "Keep the distribution log, form versions, update notice, submission, record, and minutes blank and unreadable. Do not show old-versus-new form labels, version numbers, blame arrows, guilty posture, teacher-versus-student responsibility scale, direct-cause versus prevention diagram, disciplinary verdict, or completed correction that decides moral fault.",
  ]),
  "L5-023": Object.freeze([
    "Keep Ayase, Arata, Lin, and Daniel together in one continuous physical restaurant menu-review setting with at most one ordinary duck dish and one neutral menu or process sheet; do not create three language-specific restaurants, translator offices, remote endpoints, a smoking reenactment, or a later corrected service.",
    "Keep every menu version, process description, ingredient label, language marker, and process sheet blank and unreadable. Do not show smoke, smoking equipment, aroma-oil droplets, a translation-strength ladder, language flags, process-versus-ingredient diagram, informed-choice badge, revised menu, or visual verdict about how the dish was prepared.",
  ]),
  "L5-024": Object.freeze([
    "Keep Minato, An, Mio, and Gen together in one continuous physical tourist-street and map-review setting, with exactly one neutral folded map; do not create separate partner-shop districts, a remote cartography office, another guide, a future revised map, or an unaffiliated-station cutaway.",
    "Keep every shop, station, route, scale, distance, walking time, legend, association note, and map label blank and unreadable. Do not distort visible blocks into an answer diagram, highlight partner businesses, lengthen or shorten a route, show South Station as escape, add dwell-time arrows, recommendation badges, real-distance corrections, or a visual verdict about commercial steering.",
  ]),
  "L5-025": Object.freeze([
    "Keep Zero, Natsuki, Iori, and Suzu together in one continuous physical moderation and archive review; use at most one neutral rule page, one neutral screenshot, and one neutral history record with equal visual weight, and do not create remote member endpoints, a past meeting, a prior-night reenactment, or a later reassessment scene.",
    "Keep every rule number, page date, creation time, screenshot line, minutes entry, announcement log, effective time, post, and edit history blank and unreadable. Do not show backdating arrows, missing-rule gaps, old-versus-new pages, retroactive violation stamps, reversal success, preserved evidence badge, culprit posture, or a visual conclusion about whether the rule existed yesterday.",
  ]),
  "L5-026": Object.freeze([
    "Keep Nagi, Leo, and Val together inside one continuous source-defined game-world tower context, and keep the Quest system entirely non-human as one blank interface layer in that same game world; do not show real-world player bodies, remote endpoints, a human system operator, a second tower lord, duplicated voice source, or a historical recording session.",
    "Keep every quest line, pronoun, route, key, seal, voice confirmation, phrase match, oath, and correction blank or visually neutral. Do not show you-versus-I labels, first-visit-versus-return arrows, matching verbal patterns, a stolen-record diagram, identity merge, system allegiance, opened seal, completed return, or cue declaring who or what the quest voice is.",
  ]),
  "L5-027": Object.freeze([
    "Keep Aoi, Ren, Mina, and Kai only as their source-defined presences inside one continuous shared wedding-world rehearsal and exit-threshold context; do not show their real-world bodies, remote physical endpoints, an actual civil ceremony, family audience, tomorrow's conversation, or duplicate avatar versions.",
    "Show at most two ordinary neutral ring items with equal visual weight. Keep every avatar name, real name, vow, rehearsal label, applause cue, venue state, and chat surface blank and unreadable; do not show legal documents, serious-versus-joke masks, real-name highlights, stopped or continuing applause, ring-removal choices, commitment symbols, or a visual verdict about whether the rehearsal was genuine.",
  ]),
  "L5-028": Object.freeze([
    "Keep Akari and Kei together in one continuous physical home-AI audit, with Lumen entirely non-human as the same fixed household interface or restrained status light; do not create a human AI avatar, remote auditor endpoint, second user, past conversation flashback, tomorrow scene, or model-training laboratory.",
    "Keep every name, plan, conversation history, deletion status, audit, factual-memory field, lexical-model update, and phrase blank and unreadable. Do not literalize the drawer-after-rain metaphor, show remembered people or events, zero-memory counters, rollback arrows, preserved phrase ownership, deletion-versus-update diagram, success check, or visual verdict about whether Lumen remembers Akari.",
  ]),
  "L5-029": Object.freeze([
    "Keep Olga, Isamu, and Noa together in one continuous physical colony vote review, with Pollux entirely non-human as one fixed blank voting interface in that same room; do not create remote colonist endpoints, visible proxy people, an old proxy on Earth, a historical past self, a second voting chamber, or a future revote.",
    "Keep every ballot, nonresponse, proxy setting, historical model, count, result, rule, expiry date, and validity record blank and unreadable. Do not show blank-to-yes arrows, four-in-favor tallies, unanimity badges, present-versus-past-self diagrams, delegated hands, absent voters, corrected default, expired proxy, invalidation stamp, or visual verdict about anyone's current intent.",
  ]),
  "L5-030": Object.freeze([
    "Keep Fuyuki, Tsubaki, Makoto, and Haru together in one continuous physical evidence-review room with exactly one neutral photo, one neutral ticket, and one neutral receipt; do not create a travel reenactment, separate seasonal scenes, a second suspect, remote endpoint, flowering-period flashback, later menu service, or culprit reveal.",
    "Keep the photo, ticket, receipt, weekday sign, menu, sales ledger, clock, name, date, price, place, and item number unreadable and equally weighted. Do not arrange flowers, weekday printing, and limited-menu evidence into a conclusive day-by-day sequence, show a two-week gap, highlight genuine-versus-same-day labels, draw who bundled the items, or visually reveal that the itinerary combines multiple days.",
  ]),
  "L5-031": Object.freeze([
    "Keep Taiga only at a separate field-report endpoint, Nagisa and So together in one production control room, and Rei only as the same ordinary human-looking broadcast image; never place all four in one physical room or render Rei as a present flesh-and-blood studio performer, robot, hologram, or avatar.",
    "Keep every monitor and production sheet uniformly blank and unreadable. Do not show a model name, synthetic label, waveform, breath-cycle marks, response-delay timer, face-license record, human response operator, before-and-after comparison, or any cue that declares the host synthetic.",
  ]),
  "L5-032": Object.freeze([
    "Keep Saya, Itsuki, and Kuze within one continuous physical station environment, with the Station broadcast emitted only by fixed local public-address hardware; do not materialize the broadcast as a person, avatar, robot, presenter, studio, remote caller, or separate endpoint.",
    "Use only blank station signs and one neutral unreadable control surface. Do not render the four equipment names, their order, a procedure number, east-to-west route, track intrusion, intruder, arrows, passenger-versus-crew mapping, coded instruction, pursuit, capture, or resolved safety outcome.",
  ]),
  "L5-033": Object.freeze([
    "Keep Sono, Saku, Hiyori, and Tetsu together in one continuous physical archive review with exactly one source document and one marginal index surface; do not create a historical reenactment, exile scene, inventor, censor, or second archive room.",
    "Redaction bars may remain irregular but must not form countable lengths, letters, a name silhouette, marginal number sequence, alignment guide, or decoding pattern. Add no arrows or overlays that reveal the inventor's name.",
  ]),
  "L5-034": Object.freeze([
    "Keep Azusa, Gaku, and Emma together in one continuous physical archive or library review. Treat the cast entry owner only as the nonvisual voice of unattributed diary entries: Chikage is merely the source-defined name on the cover and must not appear as a fourth present person, writer, owner, editor, portrait, ghost, or silhouette.",
    "Use exactly one diary with all cover, pages, handwriting, ink, and paper surfaces unreadable and equally weighted. Do not encode first-person absence, register, dialect, tense, paper stock, pen pressure, shared ink, writer segmentation, handwriting identity, ownership, editorship, or a resolved author count.",
  ]),
  "L5-035": Object.freeze([
    "Keep Yuna and Jin together in one continuous local gameplay context and never split them into remote endpoints. Keep exactly one source-defined closed door.",
    "Keep the guide voice off-screen and the subtitle layer non-human. Represent subtitles and the pause-only note only as empty neutral screen bands with no words, pseudo-text, polarity icons, or confession symbol; keep the source-defined door closed and show no figure or silhouette behind it.",
  ]),
  "L5-036": Object.freeze([
    "Keep Ogawa, Mei, Risa, and Makabe together in one continuous physical proposal meeting; all returned materials remain in the same room, and no future client, alternate proposal destination, later meeting, or remote endpoint appears.",
    "Keep documents, minutes, and any deadline surface blank and equally weighted. Do not render the word “difficult,” a rejection or acceptance mark, returned-versus-retained comparison, calendar, deadline, address, adopted/not-adopted label, decisive reaction, exit, handshake, or completed next proposal.",
  ]),
  "L5-037": Object.freeze([
    "Keep Riku, Shizu, Hana, and Sakaki at four separate remote school group-work endpoints, one person and at most one ordinary device per undivided whole-panel view; never gather them in one physical classroom or place two people behind one device.",
    "Keep the shared document, edit history, terminal IDs, checkout records, contribution field, counts, and names uniformly blank and unreadable. Do not map any edit to a particular person, show normalized time formats, removed duplicates, verified citations, credit transfer, corrected attribution, apology, or a resolved intent judgment.",
  ]),
  "L5-038": Object.freeze([
    "Keep Sumi, Ritsu, Akari, and Osamu together at one continuous physical restaurant table with one mild white-fish course and exactly three equally weighted, unlabeled sauce dishes; do not add other diners, a survey room, laboratory, remote endpoint, or a second meal.",
    "Keep seat numbers and every record sheet blank. Do not map any sauce position to a diner, show touch counts, used-versus-unused residue, sauce labels, preference marks, health notes, fixed menu changes, arrows, or a conclusive taste profile.",
  ]),
  "L5-039": Object.freeze([
    "Keep Wang Ming, Yuri, Sam, and Asahina together at one continuous physical lost-property counter with exactly one candidate black bag on the shelf; do not create separate registration endpoints, travel flashbacks, baggage claim, another attendant, another owner, or a second similar bag.",
    "Keep all forms, database screens, tags, slips, and labels blank and unreadable. Do not render any name spelling, case, comma, space, segmentation, tag number, booking name, search result, matching highlight, identity-verification success, bag handoff, or cue resolving ownership.",
  ]),
  "L5-040": Object.freeze([
    "Keep Mio, Nao, Haru, and Gen together in one continuous physical time-loop test room with one ordinary cup, one audio recorder, and at most one blank statement card; do not split them into different mornings, remote endpoints, duplicate rooms, or before-and-after panels that make any reset visually conclusive.",
    "Keep every clock, card, recorder display, note, and quoted statement blank and unreadable. Do not encode cup color, six o'clock, truth versus lie, spoken versus signed versus playback labels, reset marks, trigger arrows, live-speaker highlight, deception intent, or any tested/untested boundary; do not show the loop system as a person or device.",
  ]),
  "L5-041": Object.freeze([
    "Keep Shino, Flamehorn, Mio, and Toru together in one continuous physical treaty-conference room. Flamehorn must be unmistakably a non-human dragon envoy; show exactly three neutral treaty documents with equal visual weight, never duplicate a delegation, invent a remote endpoint, or turn any envoy into a document symbol.",
    "Keep every treaty, seal, appendix, marginal mark, calendar label, clock, conversion table, date, astronomical index, and receipt record blank and unreadable. Do not use repeated marks, matching emblems, aligned papers, synchronized clocks, arrows, accusation gestures, lateness cues, forgery damage, or a shared glow to declare whether the three records match, were altered, or missed a deadline.",
  ]),
  "L5-042": Object.freeze([
    "Keep Yui, Ren, and Makoto together in one physical incident-audit room. Iris must remain a non-human monitoring AI expressed only through fixed room hardware or one blank monitor, with no human avatar, robot body, invented operator, remote endpoint, or split-screen.",
    "Keep every video frame, sensor trace, clock, interval marker, operator log, transformed query, and report abstract and unreadable. Do not draw a twenty-second-versus-two-second timeline, highlighted gap cluster, current spike, selected stable window, scope-change arrow, “no anomaly” verdict, or any visual conclusion about completeness, cause, or intent.",
  ]),
  "L5-043": Object.freeze([
    "Keep Nagi, Kuze, and An in one continuous closed-station inspection spanning the empty platform and adjacent broadcast-room doorway; keep the archival announcement and the unidentified coughing voice entirely off-screen, with no ghost, crowd, hidden person, humanized loudspeaker, remote endpoint, or extra narrator.",
    "Keep the master copies, waveforms, microphones, hinge sensor, door gap, and paper cup as neutral observable props. Do not draw readable announcements, matching waveform shapes, needle-scratch glyphs, phase lines, distance arrows, pressure diagrams, warmth steam, fingerprints, source labels, or a spotlight that proves whether the cough is recorded, live, supernatural, or made by any named person.",
  ]),
  "L5-044": Object.freeze([
    "Keep Sora and Tamaki at separate physical endpoints connected only through the source-defined group chat, and keep Mina entirely absent from every physical panel; represent the chat system only as one blank device interface or status light, never as a person, ghost, restored avatar, or co-located participant.",
    "Keep the typing indicator, draft, schedule, restore job, identifier, session cache, origin field, message count, timestamps, and logs blank and unreadable. Do not show an ellipsis bubble, message body, clock match, replay arrow, cache-reconnect animation, restored key, sender badge, or causal chain that favors either the surviving draft task or the restore-time cache path.",
  ]),
  "L5-045": Object.freeze([
    "Keep Soichi, Kaede, Riko, and Gaku together in one continuous physical succession meeting, with exactly three equally weighted blank departmental schedule documents and no remote office endpoints, duplicate successors, or extra decision-maker.",
    "Keep every quarter label, calendar, agenda, minutes page, date, clock, registration form, production schedule, and authority-transfer note blank and unreadable. Do not map any document or person to December 1, December 16, or January 1; do not show a signed final date, winning department, handover ceremony, founder endorsement, or visual cue selecting one calendar as intended.",
  ]),
  "L5-046": Object.freeze([
    "Keep Sae, Mikage, Aya, and Shin inside one continuous museum investigation spanning the vault, gallery, and restoration lab; show exactly two visually indistinguishable source-defined objects, two plinths, and one reused transport crate, with no third object, duplicate room, remote endpoint, or visible swap reenactment.",
    "Keep every tag, access record, terminal, camera, crate mark, and test sheet blank and unreadable, and render the linen and felt only as neutral monochrome textures without a color legend. Do not map either object to original or copy, connect fibers into a route diagram, show a tag being switched, reveal the blind interval, or give either plinth, object, or person privileged visual weight.",
  ]),
  "L5-047": Object.freeze([
    "Keep Toma, Yura, and Sena together in one continuous source-defined game-world landscape containing the intact village, intact forest, dry river, and distant northern sluice; keep the quest system non-human and interface-only, with no real-world player body, remote endpoints, duplicated maps, or destruction scene.",
    "Keep the map, compass, coordinate slots, quest window, rating, and updated task abstract and unreadable. Do not show village-versus-forest choice cards, mirrored-axis diagrams, V-17 or F-17, a selected or closed option, an integrity increase, an unlocked route, water returning, a highlighted sluice, culprit, or arrow that identifies the correct action or cause.",
  ]),
  "L5-048": Object.freeze([
    "Keep Rei, Sakaki, Aya, and Nao together in one continuous physical news-studio panel, each holding at most one neutral blank source note; do not create four remote informant endpoints, depict any anonymous source, duplicate the editor, or turn the discussion into a document montage.",
    "Keep every memo, forwarded summary, shared document, source field, punctuation mark, invisible marker, file label, and correction note blank and visually non-comparable. Do not repeat matching line shapes or wet-compass symbols, connect the four notes to one origin, show a circular arrow chain, stamp the reform true or false, or visually certify or discredit independent confirmation.",
  ]),
  "L5-049": Object.freeze([
    "Keep Tamaki, Rin, and Gaku together in one physical receiving archive, while Rei exists only as a remote recorded captain across whole-panel transmission views; never place Rei in their room, show a live return, duplicate the captain, or use split-screen, inset screens, diagonal separators, or extra sub-panels.",
    "Keep all three transmissions, ship clocks, delay values, sequence signatures, star charts, coordinates, and archive notes blank and equally weighted. Do not number or spatially order the signals, draw a reversal timeline, distance arrows, a corrected route, a culprit, a rescue outcome, a death cue, or an emphasis that reveals which message was sent first or last.",
  ]),
  "L5-050": Object.freeze([
    "Keep Sumi and Osamu together at one local trainer workstation, with Nono appearing only as the single source-defined on-screen guide avatar and the training system remaining a non-human blank interface; do not place Nono physically beside them, invent a remote endpoint, external observer body, signer silhouette, duplicate guide, or extra screen layer.",
    "Show exactly four neutral unnumbered blank slots with equal size and visual weight, but do not align Nono’s body with, avoid, point toward, or react to any one slot. Keep every RNG seed, checksum, timestamp, permission record, snapshot, and audit log blank; add no answer marker, positional mapping, before-and-after layout, arrow, external hand, or cue favoring foreknowledge over later layout editing.",
  ]),
});

const TEXT_EVIDENCE_STAGE_IDS = new Set([
  "L2-005", "L2-015", "L2-021", "L2-024", "L2-029", "L2-030",
  "L2-033", "L2-044", "L2-048", "L2-049", "L2-050",
  "L3-002", "L3-005", "L3-009", "L3-010", "L3-015", "L3-018",
  "L3-023", "L3-024", "L3-027", "L3-028", "L3-030", "L3-035",
  "L3-037", "L3-041", "L3-042", "L3-043", "L3-044", "L3-046",
  "L3-047", "L3-048", "L3-049", "L3-050",
  "L4-002", "L4-005", "L4-006", "L4-007", "L4-008", "L4-009",
  "L4-010",
  "L4-011", "L4-012", "L4-013", "L4-014", "L4-019", "L4-020",
  "L4-021", "L4-023", "L4-025", "L4-029", "L4-030", "L4-031",
  "L4-032", "L4-034", "L4-035", "L4-037", "L4-038", "L4-039", "L4-040",
  "L4-041", "L4-042", "L4-043", "L4-044", "L4-045", "L4-046",
  "L4-047", "L4-048", "L4-049", "L4-050",
  "L5-001", "L5-002", "L5-003", "L5-004", "L5-005", "L5-006",
  "L5-007", "L5-008", "L5-009", "L5-010", "L5-011",
  "L5-012", "L5-013", "L5-014", "L5-015", "L5-016", "L5-017",
  "L5-018", "L5-019", "L5-020", "L5-021", "L5-022", "L5-023", "L5-024", "L5-025",
  "L5-026", "L5-027", "L5-028", "L5-029", "L5-030", "L5-031", "L5-032",
  "L5-033", "L5-034", "L5-035", "L5-036", "L5-037", "L5-038",
  "L5-039", "L5-040", "L5-041", "L5-042", "L5-043", "L5-044",
  "L5-045", "L5-046", "L5-047", "L5-048", "L5-049", "L5-050",
]);

const NON_HUMAN_SYSTEM_STAGE_IDS = new Set([
  "L2-017", "L2-018", "L2-024", "L2-036", "L2-049",
  "L3-008", "L3-024", "L3-026", "L3-029", "L3-037", "L3-038",
  "L3-046", "L3-050",
  "L4-009", "L4-010", "L4-020", "L4-021", "L4-024", "L4-029", "L4-032",
  "L4-034", "L4-037", "L4-040", "L4-045", "L4-046", "L4-048", "L4-050",
  "L5-008", "L5-010", "L5-019", "L5-020", "L5-026", "L5-028", "L5-029", "L5-032", "L5-035", "L5-042",
  "L5-043", "L5-044", "L5-047", "L5-050",
]);

const DENSE_STAGE_IDS = new Set([
  "L4-031", "L4-033", "L4-035", "L4-037", "L4-039", "L4-041",
  "L4-042", "L4-043", "L4-044", "L4-045", "L4-046", "L4-047",
  "L4-048", "L4-049", "L4-050",
  "L5-011", "L5-012", "L5-013", "L5-014", "L5-015", "L5-016",
  "L5-017", "L5-018", "L5-019", "L5-020",
  "L5-021", "L5-022", "L5-023", "L5-024", "L5-025", "L5-026",
  "L5-027", "L5-028", "L5-029", "L5-030", "L5-031", "L5-032",
  "L5-033", "L5-034", "L5-035", "L5-036", "L5-037", "L5-038",
  "L5-039", "L5-040", "L5-041", "L5-042", "L5-043", "L5-044",
  "L5-045", "L5-046", "L5-047", "L5-048", "L5-049", "L5-050",
]);

const TEXT_EVIDENCE_RULE =
  "Do not reproduce, transliterate, or spatially encode any quoted words, letters, kana, kanji, names, punctuation, dates, times, counts, percentages, sequence numbers, logs, subtitles, or option labels. Keep every screen, paper, clock face, sign, and record unreadable and abstract with equal visual weight; do not use matching line lengths, repeated mark patterns, highlights, arrows, check marks, or icon sequences to reconstruct the evidence or answer.";
const NON_HUMAN_SYSTEM_RULE =
  "Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body, and do not invent a human operator. Unless the source explicitly defines an avatar or physical robot, keep it as environmental hardware, an off-panel voice, one blank device screen, or a restrained status light.";
const DENSE_STAGE_RULE =
  "Do not attempt to literalize every dialogue line or every evidence item. Use exactly one source-defined observable beat per panel: establish the medium or setting, observe one discrepancy, compare one further discrepancy, and end on unresolved review. Never add a timeline strip, evidence collage, document montage, split panel, inset, before-and-after duplicate, or fifth frame.";

function stagePromptAddenda(stageId) {
  const instructions = [];
  if (TEXT_EVIDENCE_STAGE_IDS.has(stageId)) instructions.push(TEXT_EVIDENCE_RULE);
  if (NON_HUMAN_SYSTEM_STAGE_IDS.has(stageId)) instructions.push(NON_HUMAN_SYSTEM_RULE);
  if (DENSE_STAGE_IDS.has(stageId)) instructions.push(DENSE_STAGE_RULE);
  instructions.push(...(STAGE_PROMPT_ADDENDA[stageId] ?? []));
  return [...new Set(instructions)];
}

const GENERATOR_PROVENANCE = Object.freeze({
  schemaVersion: 3,
  requestedGenerator: "image2",
  provider: "OpenAI Images",
  model: MODEL,
  operation: "generate",
  promptSchemaVersion: PROMPT_SCHEMA_VERSION,
  promptPreparation: "deterministic-project-script",
  promptPreparationScript:
    "tools/japanese-subtext/scripts/prepare-image2-prompts.mjs",
  styleBible: "tools/japanese-subtext/image2/style-bible.md",
  designIdentityRegistry: DESIGN_IDENTITY_REGISTRY_PROJECT_PATH,
  designIdentityRegistrySchemaVersion:
    DESIGN_IDENTITY_REGISTRY_SCHEMA_VERSION,
  designIdentityRegistrySha256: DESIGN_IDENTITY_REGISTRY_SHA256,
  designSeedNamespace: DESIGN_SEED_NAMESPACE,
  sourceHashField: "sourceTextHash",
  sourceHashSchemaVersion: SOURCE_TEXT_HASH_SCHEMA_VERSION,
  contentProjection: [
    "stage id",
    "bilingual title (ja/en)",
    "bilingual setting (ja/en)",
    "cast ids and bilingual names (ja/en)",
    "speaker assignment and all bilingual dialogue (ja/en)",
    "bilingual question prompts only (ja/en)",
  ],
});

const BACKGROUND_GENERATOR_PROVENANCE = Object.freeze({
  schemaVersion: 1,
  requestedGenerator: "image2",
  provider: "OpenAI Images",
  model: MODEL,
  operation: "generate",
  promptSchemaVersion: BACKGROUND_PROMPT_SCHEMA_VERSION,
  promptPreparation: "deterministic-project-script",
  promptPreparationScript:
    "tools/japanese-subtext/scripts/prepare-image2-prompts.mjs",
  styleBible: "tools/japanese-subtext/image2/style-bible.md",
  assetRole: "outer application background",
});

const CHARACTER_TRAITS = Object.freeze({
  hairColor: [
    "solid ink-black",
    "soft charcoal",
    "deep graphite",
    "dark gray with restrained white highlights",
    "medium ash gray",
  ],
  hairShape: [
    "neat short layered hair",
    "soft jaw-length bob",
    "straight shoulder-length hair gathered low",
    "medium layered hair swept away from the forehead",
    "short rounded crop",
    "long straight hair tied low",
    "softly wavy medium-length hair",
    "side-parted chin-length hair",
  ],
  eyes: ["soft black", "deep graphite", "mid gray", "charcoal gray", "dark gray"],
  face: [
    "soft oval face",
    "gently angular face",
    "round face with a clear jawline",
    "long oval face",
    "compact heart-shaped face",
  ],
  silhouette: [
    "upright compact silhouette",
    "relaxed rounded silhouette",
    "slender vertical silhouette",
    "balanced softly angular silhouette",
    "grounded broad-shoulder silhouette",
  ],
  accent: [
    "fine-dot screentone",
    "light diagonal hatching",
    "solid charcoal",
    "sparse crosshatching",
    "medium-gray screentone",
    "dark graphite",
    "soft stippling",
    "clean white-on-black trim",
  ],
  detail: [
    "a narrow distinctive collar or cuff detail",
    "a small geometric clasp",
    "a subtle two-tone strap when a bag is natural to the scene",
    "a slim distinctive watchband when a watch is natural to the scene",
    "a small hair or lapel fastener appropriate to presentation",
    "a restrained seam along the outer layer",
  ],
});

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`Missing ${label}`);
  }
  return value.trim();
}

function localizedText(value, label) {
  return {
    ja: requiredText(value?.ja, `${label}.ja`),
    en: requiredText(value?.en, `${label}.en`),
  };
}

function loadDesignIdentityRegistry(text) {
  let registry;
  try {
    registry = JSON.parse(text);
  } catch (error) {
    fail(`Cannot parse image2 design identity registry: ${error.message}`);
  }
  if (
    !registry ||
    typeof registry !== "object" ||
    Array.isArray(registry)
  ) {
    fail("Image2 design identity registry must be a JSON object");
  }
  if (registry.schemaVersion !== DESIGN_IDENTITY_REGISTRY_SCHEMA_VERSION) {
    fail(
      `Image2 design identity registry schemaVersion must be ${DESIGN_IDENTITY_REGISTRY_SCHEMA_VERSION}`,
    );
  }
  if (registry.seedNamespace !== DESIGN_SEED_NAMESPACE) {
    fail(
      `Image2 design identity seedNamespace must be ${DESIGN_SEED_NAMESPACE}`,
    );
  }
  if (
    registry.defaultIdentityPattern !==
    "stage:<lowercase-stage-id>:cast:<cast-id>"
  ) {
    fail("Image2 design identity defaultIdentityPattern is invalid");
  }
  if (!Array.isArray(registry.aliases)) {
    fail("Image2 design identity aliases must be an array");
  }

  const aliasesByCastRef = new Map();
  const seenDesignIdentities = new Set();
  for (const [aliasIndex, alias] of registry.aliases.entries()) {
    const label = `design-identities.aliases[${aliasIndex}]`;
    const designIdentity = requiredText(
      alias?.designIdentity,
      `${label}.designIdentity`,
    );
    if (!/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/.test(designIdentity)) {
      fail(`${label}.designIdentity is invalid`);
    }
    if (seenDesignIdentities.has(designIdentity)) {
      fail(`${label}.designIdentity is duplicated`);
    }
    seenDesignIdentities.add(designIdentity);
    const kind = requiredText(alias?.kind, `${label}.kind`);
    if (!new Set(["same-character", "shared-appearance"]).has(kind)) {
      fail(`${label}.kind must be same-character or shared-appearance`);
    }
    if (!Array.isArray(alias?.members) || alias.members.length < 2) {
      fail(`${label}.members must contain at least two cast references`);
    }
    for (const [memberIndex, member] of alias.members.entries()) {
      const memberLabel = `${label}.members[${memberIndex}]`;
      const stageId = requiredText(member?.stageId, `${memberLabel}.stageId`);
      if (!/^L[1-5]-\d{3}$/.test(stageId)) {
        fail(`${memberLabel}.stageId is invalid`);
      }
      const castId = requiredText(member?.castId, `${memberLabel}.castId`);
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(castId)) {
        fail(`${memberLabel}.castId is invalid`);
      }
      const expectedName = localizedText(
        member?.expectedName,
        `${memberLabel}.expectedName`,
      );
      const variant = requiredText(member?.variant, `${memberLabel}.variant`);
      const castRef = `${stageId}/${castId}`;
      if (aliasesByCastRef.has(castRef)) {
        fail(`${memberLabel} duplicates cast reference ${castRef}`);
      }
      aliasesByCastRef.set(
        castRef,
        Object.freeze({
          castRef,
          stageId,
          castId,
          expectedName,
          designIdentity,
          kind,
          variant,
        }),
      );
    }
  }
  return { registry, aliasesByCastRef };
}

export function resolveDesignIdentity(stageIdValue, member) {
  const stageId = requiredText(stageIdValue, "stage.id");
  if (!/^L[1-5]-\d{3}$/.test(stageId)) {
    fail(`Invalid stage id ${stageId}`);
  }
  const castId = requiredText(member?.id, `${stageId}.cast.id`);
  const name = localizedText(member?.name, `${stageId}.${castId}.name`);
  const castRef = `${stageId}/${castId}`;
  const alias = DESIGN_IDENTITY_ALIASES_BY_CAST_REF.get(castRef);
  if (alias) {
    if (
      alias.expectedName.ja !== name.ja ||
      alias.expectedName.en !== name.en
    ) {
      fail(
        `${castRef} name does not match the design identity registry: ` +
          `${name.ja} / ${name.en}`,
      );
    }
    return alias;
  }
  return Object.freeze({
    castRef,
    stageId,
    castId,
    designIdentity: `stage:${stageId.toLowerCase()}:cast:${castId}`,
    kind: "independent",
    variant: "source-defined",
  });
}

export function computeDesignSeed(designIdentityValue) {
  const designIdentity = requiredText(
    designIdentityValue,
    "designIdentity",
  );
  return createHash("sha256")
    .update(DESIGN_SEED_NAMESPACE, "utf8")
    .update("\0", "utf8")
    .update(designIdentity, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function extractMarkedContract(styleBible, startMarker, endMarker) {
  const start = styleBible.indexOf(startMarker);
  const end = styleBible.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    fail(`style-bible.md is missing ${startMarker} / ${endMarker}`);
  }
  const contract = styleBible.slice(start + startMarker.length, end).trim();
  if (!contract) {
    fail(`style-bible.md has an empty contract after ${startMarker}`);
  }
  return contract;
}

export function extractStyleContract(styleBible) {
  return extractMarkedContract(
    styleBible,
    "<!-- IMAGE2_PROMPT_START -->",
    "<!-- IMAGE2_PROMPT_END -->",
  );
}

function extractBackgroundContract(styleBible) {
  return extractMarkedContract(
    styleBible,
    "<!-- IMAGE2_BACKGROUND_PROMPT_START -->",
    "<!-- IMAGE2_BACKGROUND_PROMPT_END -->",
  );
}

function selectStable(values, byte) {
  return values[byte % values.length];
}

function characterDesign(stageId, member) {
  const identity = resolveDesignIdentity(stageId, member);
  const digest = createHash("sha256")
    .update(DESIGN_SEED_NAMESPACE, "utf8")
    .update("\0", "utf8")
    .update(identity.designIdentity, "utf8")
    .digest();
  const designSeed = digest.toString("hex").slice(0, 16);
  const hairColor = selectStable(CHARACTER_TRAITS.hairColor, digest[0]);
  const hairShape = selectStable(CHARACTER_TRAITS.hairShape, digest[1]);
  const eyes = selectStable(CHARACTER_TRAITS.eyes, digest[2]);
  const face = selectStable(CHARACTER_TRAITS.face, digest[3]);
  const silhouette = selectStable(CHARACTER_TRAITS.silhouette, digest[4]);
  const accent = selectStable(CHARACTER_TRAITS.accent, digest[5]);
  const detail = selectStable(CHARACTER_TRAITS.detail, digest[6]);
  return {
    ...identity,
    designSeed,
    description: `${face}; ${hairColor} ${hairShape}; ${eyes} eyes; ${silhouette}; scene-appropriate clothing with a ${accent} recognition accent; ${detail}. Preserve these grayscale traits whenever this design identity recurs. Keep the ${identity.variant} variant distinct without changing the shared core appearance. If the source defines a non-human species or artificial body, translate the same ink value, screentone, silhouette balance, and recognition detail into that source-defined form.`,
  };
}

function safeStageProjection(stage) {
  const id = requiredText(stage.id, "stage.id");
  const title = localizedText(stage.title, `${id}.title`);
  const setting = localizedText(stage.setting, `${id}.setting`);
  if (!Array.isArray(stage.cast) || stage.cast.length === 0) {
    fail(`${id} has no cast`);
  }
  if (!Array.isArray(stage.lines) || stage.lines.length === 0) {
    fail(`${id} has no dialogue lines`);
  }
  if (!Array.isArray(stage.questions) || stage.questions.length === 0) {
    fail(`${id} has no question prompts`);
  }

  const cast = stage.cast.map((member, index) => ({
    id: requiredText(member.id, `${id}.cast[${index}].id`),
    name: localizedText(member.name, `${id}.cast[${index}].name`),
    design: characterDesign(id, member),
  }));
  const castById = new Map(cast.map((member) => [member.id, member]));
  if (castById.size !== cast.length) {
    fail(`${id} has duplicate cast ids`);
  }

  const lines = stage.lines.map((line, index) => {
    const speakerId = requiredText(line.speaker, `${id}.lines[${index}].speaker`);
    const speaker = castById.get(speakerId);
    if (!speaker) {
      fail(`${id} line ${index + 1} references unknown cast id ${speakerId}`);
    }
    return {
      id: requiredText(line.id, `${id}.lines[${index}].id`),
      speakerId,
      speakerName: speaker.name,
      text: localizedText(line.text, `${id}.lines[${index}].text`),
    };
  });

  const questions = stage.questions.map((question, index) => ({
    id: requiredText(question.id, `${id}.questions[${index}].id`),
    prompt: localizedText(question.prompt, `${id}.questions[${index}].prompt`),
  }));

  return { id, title, setting, cast, lines, questions };
}

export function auditDesignIdentityRegistry(stages) {
  if (!Array.isArray(stages)) {
    fail("Design identity audit requires an array of stages");
  }
  const seenCastRefs = new Set();
  const identityRefs = new Map();
  const seedIdentities = new Map();

  for (const stage of stages) {
    const stageId = requiredText(stage?.id, "stage.id");
    if (!Array.isArray(stage?.cast)) {
      fail(`${stageId}.cast must be an array`);
    }
    for (const member of stage.cast) {
      const identity = resolveDesignIdentity(stageId, member);
      if (seenCastRefs.has(identity.castRef)) {
        fail(`Duplicate design cast reference ${identity.castRef}`);
      }
      seenCastRefs.add(identity.castRef);
      const refs = identityRefs.get(identity.designIdentity) ?? [];
      refs.push(identity.castRef);
      identityRefs.set(identity.designIdentity, refs);

      const designSeed = computeDesignSeed(identity.designIdentity);
      const previousIdentity = seedIdentities.get(designSeed);
      if (previousIdentity && previousIdentity !== identity.designIdentity) {
        fail(
          `Design seed collision ${designSeed}: ${previousIdentity} / ${identity.designIdentity}`,
        );
      }
      seedIdentities.set(designSeed, identity.designIdentity);
    }
  }

  for (const castRef of DESIGN_IDENTITY_ALIASES_BY_CAST_REF.keys()) {
    if (!seenCastRefs.has(castRef)) {
      fail(`Design identity registry references missing cast ${castRef}`);
    }
  }
  const aliasedIdentities = new Set(
    DESIGN_IDENTITY_REGISTRY.aliases.map((alias) => alias.designIdentity),
  );
  for (const [designIdentity, refs] of identityRefs) {
    if (refs.length > 1 && !aliasedIdentities.has(designIdentity)) {
      fail(
        `Unregistered design identity sharing for ${designIdentity}: ${refs.join(", ")}`,
      );
    }
  }
  for (const alias of DESIGN_IDENTITY_REGISTRY.aliases) {
    const expectedRefs = alias.members
      .map((member) => `${member.stageId}/${member.castId}`)
      .sort();
    const actualRefs = [...(identityRefs.get(alias.designIdentity) ?? [])].sort();
    if (JSON.stringify(actualRefs) !== JSON.stringify(expectedRefs)) {
      fail(
        `Design identity ${alias.designIdentity} resolves to ${actualRefs.join(", ")} instead of ${expectedRefs.join(", ")}`,
      );
    }
  }

  return Object.freeze({
    castRefCount: seenCastRefs.size,
    designIdentityCount: identityRefs.size,
    designSeedCount: seedIdentities.size,
    sharedIdentityCount: [...identityRefs.values()].filter(
      (refs) => refs.length > 1,
    ).length,
  });
}

export function stageSourceTextProjection(stage) {
  const source = safeStageProjection(stage);
  return {
    schemaVersion: SOURCE_TEXT_HASH_SCHEMA_VERSION,
    stageId: source.id,
    title: source.title,
    setting: source.setting,
    cast: source.cast.map((member) => ({
      id: member.id,
      name: member.name,
    })),
    lines: source.lines.map((line) => ({
      speakerId: line.speakerId,
      text: line.text,
    })),
    questions: source.questions.map((question) => ({
      prompt: question.prompt,
    })),
  };
}

export function computeStageSourceTextHash(stage) {
  return sha256(JSON.stringify(stageSourceTextProjection(stage)));
}

const SOURCE_CONFIRMED_LOCAL_STAGE_IDS = new Set([
  "L3-009",
  "L3-010",
  "L3-013",
  "L3-018",
  "L3-024",
  "L3-027",
  "L3-029",
  "L3-038",
  "L3-043",
  "L4-003",
  "L4-004",
  "L4-008",
  "L4-009",
  "L4-020",
  "L4-021",
  "L4-023",
  "L4-028",
  "L4-029",
  "L4-032",
  "L4-037",
  "L4-048",
  "L4-049",
  "L5-032",
  "L5-035",
  "L5-011",
  "L5-012",
  "L5-013",
  "L5-019",
  "L5-010",
  "L5-022",
  "L5-025",
  "L5-026",
  "L5-027",
  "L5-028",
  "L5-029",
  "L5-042",
  "L5-043",
  "L5-048",
  "L5-050",
]);

const SOURCE_CONFIRMED_REMOTE_STAGE_IDS = new Set([
  "L4-010",
  "L4-033",
  "L5-031",
  "L5-037",
  "L5-005",
  "L5-006",
  "L5-007",
  "L5-009",
  "L5-018",
  "L5-044",
  "L5-049",
]);

function usesRemoteCommunication(source) {
  if (SOURCE_CONFIRMED_LOCAL_STAGE_IDS.has(source.id)) {
    return false;
  }
  if (SOURCE_CONFIRMED_REMOTE_STAGE_IDS.has(source.id)) {
    return true;
  }
  const japanese = [
    source.setting.ja,
    ...source.lines.map((line) => line.text.ja),
  ].join("\n");
  const english = [
    source.setting.en,
    ...source.lines.map((line) => line.text.en),
  ].join("\n").toLowerCase();
  return /オンライン|オフライン|チャット|メッセージ|留守電|電話|通話|放送|通信|遠隔|ネットワーク|ログ/u.test(japanese)
    || /\b(?:online|offline|chat|message|voicemail|phone call|video call|broadcast|remote|network|log|vrchat|virtual|voice channel|radio|transmission|subtitle|email thread|stream)\b/u.test(english);
}

export function buildStageImageJob(stage, styleContract, styleBibleHash) {
  if (stage.textLocked !== true) {
    fail(`${stage.id} is not textLocked`);
  }
  if (!/^[a-f0-9]{64}$/.test(styleBibleHash)) {
    fail(`${stage.id}.styleBibleHash is not canonical SHA-256`);
  }
  const prompt = buildPrompt(stage, styleContract);
  assertPromptCoverage(stage, prompt);
  const safeSource = safeStageProjection(stage);
  const castDesigns = safeSource.cast.map((member) => ({
    castRef: member.design.castRef,
    castId: member.id,
    designIdentity: member.design.designIdentity,
    kind: member.design.kind,
    variant: member.design.variant,
    designSeed: member.design.designSeed,
    description: member.design.description,
  }));
  return {
    prompt,
    model: MODEL,
    size: SIZE,
    quality: QUALITY,
    output_format: "png",
    n: 1,
    out: `${stage.id.toLowerCase()}.png`,
    stageId: stage.id,
    sourceTextHash: computeStageSourceTextHash(stage),
    sourceTextHashSchemaVersion: SOURCE_TEXT_HASH_SCHEMA_VERSION,
    promptHash: sha256(prompt),
    styleBibleHash,
    castDesigns,
    generatorProvenance: GENERATOR_PROVENANCE,
  };
}

function buildPrompt(stage, styleContract) {
  const source = safeStageProjection(stage);
  // Do not derive extra scene facts from keyword substring matches. The
  // complete bilingual source below is the authority; this keeps words such
  // as "dialogue", "said", "relationship", or Japanese compounds from
  // accidentally introducing logs, AI characters, ships, or other props.
  const props = [
    "only concrete objects explicitly named in the setting or dialogue above; do not infer or invent another prop",
  ];
  const actions = [
    "only posture, gaze, hand position, movement, and interpersonal distance explicitly described in the setting or dialogue above",
  ];

  const castBlock = source.cast
    .map(
      (member, index) =>
        `${index + 1}. ${member.name.ja} / ${member.name.en} (cast ref: ${member.design.castRef}; design identity: ${member.design.designIdentity}; identity kind: ${member.design.kind}; variant: ${member.design.variant}; stable visual seed: ${member.design.designSeed}) — ${member.design.description}`,
    )
    .join("\n");
  const dialogueBlock = source.lines
    .map(
      (line, index) =>
        `${index + 1}. ${line.speakerName.ja} / ${line.speakerName.en}: 「${line.text.ja}」 / “${line.text.en}”`,
    )
    .join("\n");
  const questionBlock = source.questions
    .map(
      (question, index) =>
        `${index + 1}. 「${question.prompt.ja}」 / “${question.prompt.en}”`,
    )
    .join("\n");
  const remotePanelInstruction = usesRemoteCommunication(source)
    ? "- Remote-layout hard rule: each of the four panels must remain one undivided rectangular camera view. For an explicitly shared virtual world, keep the source-defined avatars together only inside that virtual context and never imply that their real users share one physical room. For every other remote exchange, alternate whole panels between physical endpoints, or show one participant with one abstract unreadable device screen inside a single view. Never use split-screen, a diagonal separator, an internal border, an inset, or any extra sub-panel."
    : null;
  const stageAddenda = stagePromptAddenda(source.id);

  return [
    "Use case: illustration-story",
    "Asset type: project-bound black-and-white four-panel manga for a Japanese subtext listening trainer",
    `Primary request: Create the unique four-panel manga page for ${source.id}.`,
    "",
    "Global image2 art contract:",
    styleContract,
    "",
    "Stage source (canonical; do not replace it with a generic anime scene):",
    `Stage id: ${source.id}`,
    `Title: ${source.title.ja} / ${source.title.en}`,
    `Setting and observable situation: ${source.setting.ja} / ${source.setting.en}`,
    "",
    "Cast and deterministic design identity cards:",
    castBlock,
    "",
    "All dialogue lines (use their complete sequence to choose four observable visual beats; render no words):",
    dialogueBlock,
    "",
    "Learner question context (preserve its ambiguity; do not answer it in the image):",
    questionBlock,
    "",
    "Required visual staging:",
    `- Canonical physical story beat: ${source.setting.en}`,
    `- Visible action and body-language cues: ${actions.join("; ")}.`,
    `- Key props and environmental evidence: ${props.join("; ")}.`,
    "- Use exactly four panels in a stable 2-by-2 grid. Panel 1 establishes the explicit setting; panels 2 and 3 show source-defined observable interaction beats; panel 4 ends on an ambiguous observable moment without resolving the learner question.",
    "- Keep the four panels spatially and temporally coherent. When the source provides fewer than four distinct visible actions, vary shot scale or viewpoint instead of inventing an event, prop, or reaction.",
    "- Keep expressions restrained and observational. Show only what a learner could physically observe before answering; do not add a conclusive reaction, outcome, or symbolic hint.",
    "- Respect physical versus remote participation. For chat, voicemail, broadcast, log, dream, AI, or networked scenes, use the four panels to preserve the source's real communication topology and abstract unreadable interface cues instead of placing remote speakers together.",
    ...(remotePanelInstruction ? [remotePanelInstruction] : []),
    ...(stageAddenda.length > 0
      ? [
          "- Stage-specific source-preserving constraints:",
          ...stageAddenda.map((instruction) => `  - ${instruction}`),
        ]
      : []),
    "",
    "Final constraints: original finished monochrome raster manga; exact 4:3 landscape; 1536x1152; exactly four 2-by-2 panels; black, white, and neutral grayscale only; rich ink, shading, and screentone rather than sparse line art; no text, answer cue, unrelated element, existing character, signature, or watermark.",
  ].join("\n");
}

function buildBackgroundJobs(backgroundContract, styleBibleHash) {
  const specs = [
    {
      backgroundId: "desktop",
      size: "2048x1152",
      out: "japanese-subtext-background-desktop.png",
      composition:
        "Wide 16:9 desktop composition. Reserve the central 76% of the canvas as calm, low-detail negative space for the application. Keep the desk edge and stationery mostly within the lower 15%, with only faint window or shelf atmosphere near the far left and right edges. The center must remain visually quiet and evenly lit.",
    },
    {
      backgroundId: "mobile",
      size: "1024x1536",
      out: "japanese-subtext-background-mobile.png",
      composition:
        "Vertical 2:3 mobile composition. Reserve the central and upper 80% as calm, low-detail negative space for the application. Keep a narrow desk edge and two or three modest blank study objects near the bottom, with a very soft dusk window glow in one upper corner. Do not create a framed phone screen or UI-shaped central panel.",
    },
  ];

  return specs.map((spec) => {
    const prompt = [
      "Use case: illustration-story",
      "Asset type: project-bound outer background for a Japanese-learning web application",
      `Primary request: Create the ${spec.backgroundId} background variant.`,
      "",
      "Background image2 art contract:",
      backgroundContract,
      "",
      `Responsive composition: ${spec.composition}`,
      `Final output: ${spec.size}, high quality, opaque PNG, original full-color raster illustration, no character and no text.`,
    ].join("\n");
    return {
      prompt,
      model: MODEL,
      size: spec.size,
      quality: QUALITY,
      output_format: "png",
      n: 1,
      out: spec.out,
      backgroundId: spec.backgroundId,
      promptHash: sha256(prompt),
      styleBibleHash,
      generatorProvenance: BACKGROUND_GENERATOR_PROVENANCE,
    };
  });
}

function stageOrder(stage) {
  const match = requiredText(stage.id, "stage.id").match(/^L([1-5])-(\d{3})$/);
  if (!match) {
    fail(`Invalid stage id ${stage.id}`);
  }
  return Number(match[1]) * 1000 + Number(match[2]);
}

function promptSourceValues(source) {
  return [
    source.id,
    source.title.ja,
    source.title.en,
    source.setting.ja,
    source.setting.en,
    ...source.cast.flatMap((member) => [member.id, member.name.ja, member.name.en]),
    ...source.lines.flatMap((line) => [line.text.ja, line.text.en]),
    ...source.questions.flatMap((question) => [question.prompt.ja, question.prompt.en]),
  ];
}

export function classifyPromptQuestionText(stage, prompt) {
  const source = safeStageProjection(stage);
  const sourceValues = promptSourceValues(source);
  const sourceCollisions = [];
  const leaks = [];

  const classify = (entry) => {
    if (typeof entry.value !== "string") return;
    const value = entry.value.trim();
    if (!value || !prompt.includes(value)) return;
    const result = { ...entry, value };
    if (sourceValues.some((required) => required.includes(value))) {
      sourceCollisions.push(result);
      return;
    }
    if (value.length >= 8) leaks.push(result);
  };

  for (const question of Array.isArray(stage.questions) ? stage.questions : []) {
    const correctOptionIds = new Set(
      Array.isArray(question.correctOptionIds) ? question.correctOptionIds : [],
    );
    for (const option of Array.isArray(question.options) ? question.options : []) {
      for (const language of ["ja", "en"]) {
        classify({
          kind: "option",
          questionId: question.id,
          optionId: option.id,
          language,
          isCorrect: correctOptionIds.has(option.id),
          value: option?.text?.[language],
        });
      }
    }
    for (const [section, localized] of Object.entries(question.explanation ?? {})) {
      for (const language of ["ja", "en"]) {
        classify({
          kind: "explanation",
          questionId: question.id,
          section,
          language,
          value: localized?.[language],
        });
      }
    }
  }

  return { sourceCollisions, leaks };
}

function assertPromptCoverage(stage, prompt) {
  const source = safeStageProjection(stage);
  for (const requiredStyleClause of [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ]) {
    if (!prompt.includes(requiredStyleClause)) {
      fail(`${source.id} prompt omits the monochrome four-panel contract`);
    }
  }
  const requiredValues = promptSourceValues(source);
  for (const value of requiredValues) {
    if (!prompt.includes(value)) {
      fail(`${source.id} prompt omits required source content: ${value}`);
    }
  }

  const questionTextAudit = classifyPromptQuestionText(stage, prompt);
  for (const leak of questionTextAudit.leaks) {
    fail(`${source.id} prompt leaks ${leak.kind} content: ${leak.value}`);
  }

  if (source.id === "L1-001") {
    for (const forbiddenFalseMatch of [
      "source-defined robot, AI embodiment, or avatar",
      "broadcast equipment or news screen",
      "source-defined music or audio equipment",
    ]) {
      if (prompt.includes(forbiddenFalseMatch)) {
        fail(`L1-001 prompt contains false keyword-derived staging: ${forbiddenFalseMatch}`);
      }
    }
  }
  if (usesRemoteCommunication(source) && !prompt.includes("Remote-layout hard rule:")) {
    fail(`${source.id} remote prompt omits the undivided-panel rule`);
  }
}

async function readStages() {
  const batchPaths = [];
  for (let level = 1; level <= EXPECTED_LEVELS; level += 1) {
    const levelRoot = path.join(CONTENT_ROOT, `level-${level}`);
    const names = (await readdir(levelRoot))
      .filter((name) => /^batch-\d{3}-\d{3}\.json$/.test(name))
      .sort();
    if (JSON.stringify(names) !== JSON.stringify(EXPECTED_BATCHES)) {
      fail(`level-${level} batch set does not match the locked 5×10 layout`);
    }
    batchPaths.push(...names.map((name) => path.join(levelRoot, name)));
  }

  const stages = [];
  for (const batchPath of batchPaths) {
    const batch = JSON.parse(await readFile(batchPath, "utf8"));
    if (!Array.isArray(batch.stages) || batch.stages.length !== 10) {
      fail(`${path.relative(TOOL_ROOT, batchPath)} must contain exactly 10 stages`);
    }
    stages.push(...batch.stages);
  }
  stages.sort((a, b) => stageOrder(a) - stageOrder(b));
  return stages;
}

async function main() {
  const styleBible = await readFile(STYLE_BIBLE_PATH, "utf8");
  const styleContract = extractStyleContract(styleBible);
  const backgroundContract = extractBackgroundContract(styleBible);
  const styleBibleHash = sha256(styleBible);
  const stages = await readStages();
  if (stages.length !== EXPECTED_STAGE_COUNT) {
    fail(`Expected ${EXPECTED_STAGE_COUNT} stages, found ${stages.length}`);
  }
  const identityAudit = auditDesignIdentityRegistry(stages);
  if (
    identityAudit.castRefCount !== EXPECTED_CAST_REF_COUNT ||
    identityAudit.designIdentityCount !== EXPECTED_DESIGN_IDENTITY_COUNT ||
    identityAudit.designSeedCount !== EXPECTED_DESIGN_IDENTITY_COUNT ||
    identityAudit.sharedIdentityCount !== DESIGN_IDENTITY_REGISTRY.aliases.length
  ) {
    fail(
      "Design identity registry audit mismatch: " +
        JSON.stringify(identityAudit),
    );
  }

  const stageIds = new Set();
  const outputs = new Set();
  const promptHashes = new Set();
  const jobs = stages.map((stage, index) => {
    const expectedLevel = Math.floor(index / EXPECTED_STAGES_PER_LEVEL) + 1;
    const expectedStage = (index % EXPECTED_STAGES_PER_LEVEL) + 1;
    const expectedId = `L${expectedLevel}-${String(expectedStage).padStart(3, "0")}`;
    if (stage.id !== expectedId) {
      fail(`Expected ${expectedId} at ordered index ${index}, found ${stage.id}`);
    }
    const job = buildStageImageJob(stage, styleContract, styleBibleHash);
    if (
      stageIds.has(job.stageId) ||
      outputs.has(job.out) ||
      promptHashes.has(job.promptHash)
    ) {
      fail(`${stage.id} duplicates a stage id, output path, or complete prompt`);
    }
    stageIds.add(job.stageId);
    outputs.add(job.out);
    promptHashes.add(job.promptHash);
    return job;
  });

  await mkdir(IMAGE2_ROOT, { recursive: true });
  const jsonl = `${jobs.map((job) => JSON.stringify(job)).join("\n")}\n`;
  await writeFile(OUTPUT_PATH, jsonl, "utf8");
  const backgroundJobs = buildBackgroundJobs(backgroundContract, styleBibleHash);
  if (
    backgroundJobs.length !== 2 ||
    new Set(backgroundJobs.map((job) => job.out)).size !== backgroundJobs.length ||
    new Set(backgroundJobs.map((job) => job.promptHash)).size !== backgroundJobs.length
  ) {
    fail("Background jobs must contain exactly two unique outputs and prompts");
  }
  const backgroundJsonl = `${backgroundJobs
    .map((job) => JSON.stringify(job))
    .join("\n")}\n`;
  await writeFile(BACKGROUND_OUTPUT_PATH, backgroundJsonl, "utf8");
  await writeFile(
    BACKGROUND_MANIFEST_PATH,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        kind: "japanese-subtext-outer-background-image2-prompts",
        promptSchemaVersion: BACKGROUND_PROMPT_SCHEMA_VERSION,
        jobCount: backgroundJobs.length,
        model: MODEL,
        quality: QUALITY,
        styleBibleHash,
        generatorProvenance: BACKGROUND_GENERATOR_PROVENANCE,
        jobs: backgroundJobs.map((job) => ({
          backgroundId: job.backgroundId,
          out: job.out,
          size: job.size,
          promptHash: job.promptHash,
          styleBibleHash: job.styleBibleHash,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        output: path.relative(TOOL_ROOT, OUTPUT_PATH).replaceAll("\\", "/"),
        jobs: jobs.length,
        backgroundOutput: path
          .relative(TOOL_ROOT, BACKGROUND_OUTPUT_PATH)
          .replaceAll("\\", "/"),
        backgroundManifest: path
          .relative(TOOL_ROOT, BACKGROUND_MANIFEST_PATH)
          .replaceAll("\\", "/"),
        backgroundJobs: backgroundJobs.length,
        model: MODEL,
        size: SIZE,
        quality: QUALITY,
        uniqueStageIds: stageIds.size,
        uniqueOutputs: outputs.size,
        uniquePrompts: promptHashes.size,
        styleBibleHash,
      },
      null,
      2,
    ),
  );
}

const directInvocation = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;
if (directInvocation) {
  await main();
}
