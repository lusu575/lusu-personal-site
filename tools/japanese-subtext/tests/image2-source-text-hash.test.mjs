import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOURCE_TEXT_HASH_SCHEMA_VERSION,
  buildStageImageJob,
  computeStageSourceTextHash,
  extractStyleContract,
  stageSourceTextProjection,
} from "../scripts/prepare-image2-prompts.mjs";
import * as image2PromptTools from "../scripts/prepare-image2-prompts.mjs";

function stageFixture() {
  return {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    id: "L1-001",
    revision: 3,
    title: {
      ja: "昼休みの誘い",
      zh: "午休邀约",
      en: "A Lunch Invitation",
    },
    setting: {
      ja: "昼休み前の廊下で二人が話す。",
      zh: "两人在午休前的走廊说话。",
      en: "Two people talk in a hallway before lunch.",
    },
    illustration: {
      enabled: true,
      src: "assets/stages/l1-001.webp",
      sha256: "a".repeat(64),
    },
    cast: [
      {
        id: "misaki",
        name: { ja: "美咲", zh: "美咲", en: "Misaki" },
        voiceKey: "female-bright",
      },
      {
        id: "ryo",
        name: { ja: "亮", zh: "亮", en: "Ryo" },
        voiceKey: "male-casual",
      },
    ],
    lines: [
      {
        id: "line-001",
        speaker: "misaki",
        text: {
          ja: "一緒に行かない？",
          zh: "要不要一起去？",
          en: "Would you like to go together?",
        },
        readingJa: "いっしょにいかない",
        audioId: "L1-001-line-001",
      },
      {
        id: "line-002",
        speaker: "ryo",
        text: {
          ja: "今日はちょっと……。",
          zh: "今天有点……",
          en: "Today is a bit difficult…",
        },
        readingJa: "きょうはちょっと",
        audioId: "L1-001-line-002",
      },
    ],
    questions: [
      {
        id: "q1",
        prompt: {
          ja: "亮の意図は何ですか。",
          zh: "亮的意图是什么？",
          en: "What does Ryo intend?",
        },
        options: [
          {
            id: "a",
            text: { ja: "断っている。", zh: "在拒绝。", en: "He declines." },
          },
        ],
        correctOptionIds: ["a"],
        explanation: {
          intent: { ja: "やわらかい断り。", zh: "委婉拒绝。", en: "A soft refusal." },
        },
      },
    ],
    textLocked: true,
    contentHash: "b".repeat(64),
  };
}

const clone = (value) => structuredClone(value);
const TOOL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("image2 source text hash ignores revision, illustration, and non-prompt content", () => {
  const stage = stageFixture();
  const expected = computeStageSourceTextHash(stage);
  const changed = clone(stage);
  changed.contentVersion = "99.0.0";
  changed.revision = 999;
  changed.contentHash = "f".repeat(64);
  changed.illustration = {
    enabled: false,
    src: "assets/stages/v-next/l1-001.webp",
    sha256: "e".repeat(64),
  };
  changed.title.zh = "另一个中文标题";
  changed.setting.zh = "另一个中文场景";
  changed.cast[0].name.zh = "另一个中文名";
  changed.cast[0].voiceKey = "another-voice";
  changed.lines[0].id = "renumbered-line";
  changed.lines[0].text.zh = "另一个中文台词";
  changed.lines[0].readingJa = "まったくちがうよみ";
  changed.lines[0].audioId = "another-audio-id";
  changed.questions[0].id = "renumbered-question";
  changed.questions[0].prompt.zh = "另一个中文问题";
  changed.questions[0].options[0].text.ja = "別の選択肢。";
  changed.questions[0].correctOptionIds = [];
  changed.questions[0].explanation.intent.en = "A different explanation.";
  changed.textLocked = false;

  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.equal(computeStageSourceTextHash(changed), expected);
  assert.notEqual(expected, stage.contentHash);
});

test("image2 source text hash changes for every drawing-source field", () => {
  const stage = stageFixture();
  const expected = computeStageSourceTextHash(stage);
  const mutations = [
    (value) => { value.id = "L1-002"; },
    (value) => { value.title.ja = "変更された題名"; },
    (value) => { value.title.en = "Changed title"; },
    (value) => { value.setting.ja = "変更された場面。"; },
    (value) => { value.setting.en = "Changed scene."; },
    (value) => {
      value.cast[0].id = "another-misaki";
      value.lines[0].speaker = "another-misaki";
    },
    (value) => { value.cast[0].name.ja = "みさき"; },
    (value) => { value.cast[0].name.en = "Another Misaki"; },
    (value) => { value.lines[0].speaker = "ryo"; },
    (value) => { value.lines[0].text.ja = "変更された台詞。"; },
    (value) => { value.lines[0].text.en = "Changed dialogue."; },
    (value) => { value.questions[0].prompt.ja = "変更された質問。"; },
    (value) => { value.questions[0].prompt.en = "Changed question."; },
  ];

  for (const mutate of mutations) {
    const changed = clone(stage);
    mutate(changed);
    assert.notEqual(computeStageSourceTextHash(changed), expected);
  }
});

test("image2 source text projection is explicit and versioned", () => {
  const projection = stageSourceTextProjection(stageFixture());
  assert.equal(projection.schemaVersion, SOURCE_TEXT_HASH_SCHEMA_VERSION);
  assert.deepEqual(Object.keys(projection), [
    "schemaVersion",
    "stageId",
    "title",
    "setting",
    "cast",
    "lines",
    "questions",
  ]);
  assert.equal("illustration" in projection, false);
  assert.equal("contentHash" in projection, false);
  assert.equal("contentVersion" in projection, false);
  assert.equal("revision" in projection, false);
});

test("image2 v4 jobs publish the stable source text hash instead of stage contentHash", () => {
  const stage = stageFixture();
  const styleContract = [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ].join("\n");
  const job = buildStageImageJob(stage, styleContract, "c".repeat(64));

  assert.equal(job.sourceTextHash, computeStageSourceTextHash(stage));
  assert.equal(
    job.sourceTextHashSchemaVersion,
    SOURCE_TEXT_HASH_SCHEMA_VERSION,
  );
  assert.equal("sourceContentHash" in job, false);
  assert.equal(
    job.generatorProvenance.promptSchemaVersion,
    "japanese-subtext-image2-prompt-v4",
  );
  assert.equal(
    job.generatorProvenance.sourceHashField,
    "sourceTextHash",
  );
});

test("remote image2 jobs forbid split screens while local prompts stay unchanged", () => {
  const styleContract = [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ].join("\n");
  const localJob = buildStageImageJob(stageFixture(), styleContract, "c".repeat(64));
  const remoteStage = stageFixture();
  remoteStage.id = "L1-007";
  remoteStage.setting.ja = "オンライン対戦後、相手がすぐオフラインになる。";
  remoteStage.setting.en = "After an online match, the other player goes offline.";
  const remoteJob = buildStageImageJob(remoteStage, styleContract, "c".repeat(64));

  assert.doesNotMatch(localJob.prompt, /Remote-layout hard rule:/);
  assert.match(remoteJob.prompt, /Remote-layout hard rule:/);
  assert.match(remoteJob.prompt, /one undivided rectangular camera view/);
  assert.match(remoteJob.prompt, /explicitly shared virtual world/);
  assert.match(remoteJob.prompt, /Never use split-screen, a diagonal separator/);
});

test("remote image2 topology also covers virtual and delayed communication wording", () => {
  const styleContract = [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ].join("\n");
  const remotePhrases = [
    "They meet in VRChat.",
    "They speak in a virtual room.",
    "They use a voice channel.",
    "A radio transmission arrives.",
    "A subtitle changes during the stream.",
    "An email thread is reopened.",
    "A delayed stream reaches the viewer.",
  ];

  for (const [index, phrase] of remotePhrases.entries()) {
    const stage = stageFixture();
    stage.id = `L2-${String(index + 1).padStart(3, "0")}`;
    stage.setting.en = phrase;
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    assert.match(job.prompt, /Remote-layout hard rule:/, phrase);
  }
});

test("canonical L3 log-review rooms stay local while actual virtual exchanges stay remote", async () => {
  const styleContract = [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ].join("\n");
  const payload = JSON.parse(
    await readFile(
      path.join(TOOL_ROOT, "content", "level-3", "batch-001-010.json"),
      "utf8",
    ),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));

  for (const stageId of ["L3-005", "L3-007"]) {
    const job = buildStageImageJob(stages.get(stageId), styleContract, "c".repeat(64));
    assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
  }
  for (const stageId of ["L3-009", "L3-010"]) {
    const job = buildStageImageJob(stages.get(stageId), styleContract, "c".repeat(64));
    assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
  }
});

test("L3-009 classifies canonical source collisions separately from inserted option and explanation text", async () => {
  const payload = JSON.parse(
    await readFile(
      path.join(TOOL_ROOT, "content", "level-3", "batch-001-010.json"),
      "utf8",
    ),
  );
  const stage = payload.stages.find(({ id }) => id === "L3-009");
  const styleContract = [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ].join("\n");
  for (const canonicalStage of payload.stages) {
    const canonicalJob = buildStageImageJob(
      canonicalStage,
      styleContract,
      "c".repeat(64),
    );
    assert.deepEqual(
      image2PromptTools.classifyPromptQuestionText(
        canonicalStage,
        canonicalJob.prompt,
      ).leaks,
      [],
      canonicalStage.id,
    );
  }
  const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
  const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);

  assert.deepEqual(audit.leaks, []);
  assert.ok(
    audit.sourceCollisions.some(
      (entry) => entry.kind === "option"
        && entry.language === "ja"
        && entry.value === "船長",
    ),
  );
  assert.ok(
    audit.sourceCollisions.some(
      (entry) => entry.kind === "option"
        && entry.language === "ja"
        && entry.value === "回収用ドローン"
        && entry.isCorrect === true,
    ),
  );

  const leakedStage = clone(stage);
  const injectedOption = "An invented warehouse answer absent from the canonical source.";
  const injectedExplanation = "A hidden operator confirms that invented answer.";
  leakedStage.questions[1].options.push({
    id: "leak",
    text: { ja: "題面にない倉庫の答え。", en: injectedOption },
  });
  leakedStage.questions[1].correctOptionIds = ["leak"];
  leakedStage.questions[1].explanation.evidenceLeak = {
    ja: "題面にない証拠で答えを確定する。",
    en: injectedExplanation,
  };
  const injected = image2PromptTools.classifyPromptQuestionText(
    leakedStage,
    `${job.prompt}\n${injectedOption}\n${injectedExplanation}`,
  );
  assert.ok(
    injected.leaks.some(
      (entry) => entry.kind === "option"
        && entry.value === injectedOption
        && entry.isCorrect === true,
    ),
  );
  assert.ok(
    injected.leaks.some(
      (entry) => entry.kind === "explanation"
        && entry.section === "evidenceLeak"
        && entry.value === injectedExplanation,
    ),
  );
});

test("difficult stage addenda preserve source topology without changing source hashes", () => {
  const styleContract = [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ].join("\n");
  const fixtures = [
    ["L1-007", /two separate remote game-chat endpoints/, /neutral blank or dark screen/],
    ["L1-010", /bakery conversation before the fresh batch is ready/, /Do not show the clerk carrying, presenting, setting down, or removing a tray of newly baked bread/],
    ["L1-017", /Keep the scene inside the busy source-defined VRChat room/, /Do not show a portal, destination preview, quiet landscape/],
    ["L1-016", /separate physical locations/, /Do not draw speech bubbles/],
    ["L1-018", /slight hesitation and request for an opaque bag restrained and observational/, /Do not add a sweat drop, blush, head scratch/],
    ["L1-019", /Miki as the only human in all four panels/, /same visibly fixed non-human hardware terminal/],
    ["L1-021", /both the shaded bench and the sunlit opposite bench/, /do not show them already relocated/],
    ["L1-022", /submission box may appear only as a neutral background object/, /no gesture that signals permission/],
    ["L1-023", /neutral conversational posture/, /Do not add a palm-out refusal/],
    ["L1-029", /Mio as the only human, the cat as the only animal, and the game system only as abstract unreadable game UI/, /Do not show the cat licking its mouth, eating, holding a fish, looking satisfied/],
    ["L1-030", /gradual shift from an ordinary classroom exam into unreality across the four panels/, /Do not show rain boots and underwater fish together in panel 1/],
    ["L1-031", /all three people in restrained, neutral discussion posture/, /Every poster, wall notice, and tabletop layout must contain only a few large blank geometric blocks/],
    ["L1-032", /Shuji placing the source-defined thick three-year-old file on the table/, /Do not draw horizontal list lines, coordinates, axes, legends, labels, numbers, captions, table cells, document pseudo-text/],
    ["L1-035", /Kaito and Yuna at two separate remote physical endpoints/, /Do not add a giant floating phone, duplicated device, screen overlay, inset, split screen, picture-in-picture/],
    ["L1-036", /vending machine as fixed non-human hardware/, /Do not draw labels, brand marks, horizontal text lines, list rows, item names, prices, digits, pseudo-writing/],
    ["L1-038", /only through a wall or ceiling loudspeaker/, /exactly three distinct station benches/],
    ["L1-046", /one identical cup physically continuous across all four panels/, /Do not tilt and then magically reset the cup, teleport it, duplicate it/],
    ["L1-047", /Haru and Nao at two visibly distinct remote physical endpoints/, /single borrowed book must exist only at Nao's endpoint/],
    ["L1-048", /guide robot visibly identifiable as an artificial humanoid/, /Do not turn the guide robot into an ordinary human/],
    ["L1-049", /three neutral unnumbered geometric choice slots/, /Remove every tiny horizontal line, character-like ornament, code-like row, pseudo-writing mark/],
    ["L1-050", /wristwatch unmistakably a wristwatch with a clear continuous strap/, /devote one clear panel beat to that person physically placing the second cup at the opposite empty seat/],
    ["L2-005", /exactly one physical participant at one separate endpoint per panel/, /Do not depict the joke content, a cat, report piles/],
    ["L2-012", /Keep every paper, binder cover, book spine, and document page completely blank/, /Show the amount of material only through neutral stack thickness/],
    ["L2-013", /bland soup and all three source-defined people at the tasting table/, /No person may look at, turn toward, point at, reach for, or touch the salt container/],
    ["L2-016", /Rei and Aoi together only as avatars inside the same quiet VR lounge/, /Yuma must remain only an abstract unreadable login notification/],
    ["L2-018", /oxygen-related hardware and displays neutral and unreadable/, /Do not visualize an oxygen quantity or future duration/],
    ["L2-019", /all four panels in the same physical meeting room/, /never show an unknown visitor, silhouette, shadow, footprints/],
    ["L2-020", /focal cat and both snack bags visible with equal visual weight/, /Do not encode an ordered visit from Ren's bag to An's bag/],
    ["L2-021", /Ayaka in the source-defined broadcast room with the umbrella, its blank name tag, Ms\. Fujii, and Kento kept as separate observable anchors/, /Do not show any identifiable cat-scratch pattern, color match, ownership match, handover, return, or confirmed owner/],
    ["L2-022", /Supervisor Natsumi, Daichi, and Mei at three separate remote work-chat endpoints/, /Do not visualize a responsibility handoff, pointing chain, package, inspection result, report, blame cue, or accountability outcome/],
    ["L2-023", /Haru at the museum entrance with the camera still visibly present/, /Do not show camera-stowing, camera handover, a no-camera icon, guard intervention, interior photography, or a completed admission outcome/],
    ["L2-024", /three participants at separate voice-chat endpoints and the system log as one blank non-human interface/, /Do not show a lowered volume slider, mute icon, hand adjusting a control, trap replay, restored-volume state, or successful fix/],
    ["L2-025", /three people at the source-defined expensive restaurant during the ordering phase/, /Do not show menu prices, numerals, currency marks, a wallet, bill, receipt, payment, or a highlighted cheap dish/],
    ["L2-026", /convenience-store counter, Miki, Shun in work clothes, the coffee, the batteries, one blank receipt, and the register as neutral co-present facts/, /Do not show an itemized receipt, company logo, reimbursement form, office scene, cash refund, approval, or completed reimbursement/],
    ["L2-027", /Toma walking home while listening and Kana only as a separate remote voicemail presence/, /Do not show a visible key, hiding place, old-versus-new location, visitor, thief, theft, route map, footprints, clue diagram, or solved disappearance/],
    ["L2-028", /current rainy interview, with the prepared stall and the rain-soaked field framed with equal visual weight/, /Do not show a sunny future, thriving crops, a reopened festival, a before-and-after timeline, forecast proof, or an exaggerated emotional verdict/],
    ["L2-029", /clock face completely blank/, /never spotlight the silent alarm clock/],
    ["L2-030", /warning note as blank paper/, /visually reveal the second rememberer/],
    ["L2-031", /same physical review room with Mei, Ren, Reviewer Sakurai, and Professor Takeda/, /Do not show an approval or rejection stamp, handshake, certificate, calendar, next-review date, contact signal, scheduled follow-up, or sponsorship representative/],
    ["L2-032", /Rihito and Tanabe in one continuous source-defined exchange with the same blank revision material/, /Do not add a third responsible-department representative, returned answer, publication result, clock, timeline, accusation, or exaggerated anger/],
    ["L2-033", /Haru, Yumi, Saki, and Kota at four separate remote group-chat endpoints/, /Do not show a travel ticket, luggage, hot spring, inn, booking, cancellation fee, attendance check, empty seat, or completed trip/],
    ["L2-034", /station lost-property counter with Nao, the clerk, one ordinary candidate umbrella, and one blank claim-number card/, /Do not show an identifiable star-shaped scratch, inner marking, color match, platform reenactment, handover, retrieval, or confirmed owner/],
    ["L2-035", /after-the-fact restaurant interview with the Interviewer, Yuto, and the Server/, /Do not reenact the original meal, show a second diner, map two meal portions to dine-in versus takeaway, reveal a family recipient, count chopsticks, or complete checkout/],
    ["L2-036", /User with one blank device and the Support AI only as non-human terminal hardware or a restrained status light/, /Do not visualize a settings path, permission lock, account-holder icon, folder name, cursor selection, manual execution, success check, or changed access state/],
    ["L2-037", /Resident inside the dark space habitat, with the Anchor and Spokesperson kept at separate remote announcement endpoints/, /Do not show clock digits, timestamps, a chronology line, maintenance reenactment, advance-notice mark, planned-test diagram, cause, or verdict/],
    ["L2-038", /magical city gate with Lise the elf, Gan the dwarf, Toru the human, and one blank-faced clock/, /Do not add reverse arrows, three-hour numerals, a sun-path diagram, time travel, yesterday arrival, a normal replacement clock, or exaggerated praise or ridicule/],
    ["L2-039", /castle kitchen with Mora, Princess Lina, one closed thick spellbook, and one unused pot/, /Do not show raspberries, jam, a recipe, cooking, teaching, a spellbook used as a trivet, a curse, potion effects, or a completed joint activity/],
    ["L2-040", /Mifuyu at the hotel-room phone and the Receptionist at a separate front-desk endpoint/, /Keep the automated voice nonvisual and non-human.*Do not show timestamps, digits, a schedule interface, recording waveform, staff operator, cleaning check, cancellation success, checkout, or departure/],
    ["L2-041", /Anchor, Commuter, and Transit historian at three separate broadcast or listening endpoints/, /Do not show a lunar commuter train, route map, ticket-gate inspection, commuter pass, fare, spring calendar, headline comparison, operational-check diagram, opened route, or two highlighted inference clues/],
    ["L2-042", /Host, Mio, Kai, and Luna together only as avatars inside the same virtual event lobby/, /Do not map the dress rules through a color pairing, hat brim, wing ruler, size bracket, glowing ornament, ban checklist, reception measurement, violation mark, or approval result/],
    ["L2-043", /Nagi, the Warden NPC, and Popo in the trial chamber beside the visibly open chest whose interior remains completely dark and unreadable/, /Do not show the Star Key, a hand touching or taking an item, prize removal, inventory, reward, success state, chest-closing result, or trial reenactment/],
    ["L2-044", /Mother, Daichi, and Emi at three separate family-chat endpoints/, /Do not show punctuation marks, message-length patterns, a clock, calendar, family gathering, meal, anger symbol, tears, slammed device, explicit displeasure, reconciliation, or changed-plan outcome/],
    ["L2-045", /Aya, Kenta, and an unmistakably artificial Tea robot in the source-defined pre-meeting room/, /Do not show the cards being swapped, a card-to-person or card-to-seat mapping, scan line, name, symbol, face-recognition comparison, drink replacement, or completed identification/],
    ["L2-046", /Akane with the source-defined plants and Sora at a separate remote voice-message endpoint/, /Do not show a return date, calendar, flight, ticket, route, watering timeline, care deadline, readable photo, Sora arriving home, or Akane ending the care/],
    ["L2-047", /same physical product-release meeting room with Director Morita, Naoki, Sato, and Maki/, /Do not show a same-day clock, calendar, legal stamp, check mark, conflict arrow, priority scale, accusation, decided new date, published page, or completed legal review/],
    ["L2-048", /Do not personify the diary app/, /Do not depict Akira traveling/],
    ["L2-049", /Keep the game system non-human/, /completed tutorial/],
    ["L2-050", /DJ Ren in the late-night radio studio and the Anonymous listener at a separate listening endpoint/, /Do not show a nickname, real name, song title, date, handwriting sample, annual timeline, flashback, old photograph, shared memory, connection line, reply, reunion, or two highlighted clue objects/],
    ["L3-001", /same physical review room with Shiro, Tanabe, and Mio/, /Do not show a funding sponsor, timeline, month number, legal mark, approval or rejection stamp, handshake, opened door, or decided next step/],
    ["L3-002", /classroom with Kuroda and Ren as the only people/, /Do not show a formula, margin highlight, correction or grade mark, shame, guilt, praise, public explanation, or resolved outcome/],
    ["L3-003", /same source-defined diner with Ayako, Shun, and Mai/, /Do not show readable names, name cards, a complaint letter, VIP table, other customers, hostile glare, punishment, rejection, or a formality mapping/],
    ["L3-004", /mountain-lodge entrance with Gen, Eri, and Koji/, /Do not show a clock, time, digit, timeline, arrow, locked gate, curfew sign, danger, guide intervention, forced return, or completed outcome/],
    ["L3-005", /four separate group-chat endpoints with blank, equally weighted device screens/, /Do not show a quote crop, selected phrase, highlight, approval check, budget or calendar diagram, revised material, or adoption outcome/],
    ["L3-006", /all four source characters only as game avatars inside the same virtual battle arena/, /Do not show health numbers or bars, an enemy corpse, healing beam, timing diagram, late cue, victory, or exaggerated sarcasm/],
    ["L3-007", /Alpha, Beta, and Shu only as avatars inside the same shared virtual lounge/, /Do not show a waveform, timeline, synchronization mark, arrow, cable, half-second digit, clone, reflection, replica, or resolved identity/],
    ["L3-008", /Makoto with one blank device and Ao only as a non-human terminal or restrained status light/, /Do not show a room or key mapping, color mapping, check mark, corrected answer, two-room layout, praise, or successful revision/],
    ["L3-009", /same physical exploration-ship log-review area with all three source-defined people co-present/, /Do not show a recovery drone, return route, hangar arrival, cargo addition, crew count or silhouette, signal arrow, subject highlight, or chained evidence/],
    ["L3-010", /all four source-defined people co-present in the same physical archive inquiry room/, /Do not reenact the cleaner inside, show a service-entrance route, intruder, staff-versus-log mapping, time, clock, culprit highlight, or a coffee-schedule-log evidence chain/],
    ["L3-011", /same physical school-festival committee room with Chiaki, Kota, Reiko, and Yu as the only four people/, /Do not show a vote, raised hands, approve or reject mark, final stamp/],
    ["L3-012", /same physical pitch meeting with Nomura, Saya, and Atsushi as the only three people/, /Do not show internal departments or staff, material circulation, adoption or rejection/],
    ["L3-013", /same restaurant table immediately after the meal with Yuta, Mina, and Satoshi co-present/, /Do not show an exact amount, currency, small change, an empty wallet/],
    ["L3-014", /same physical hotel reception with Sara and Makoto as the only people/, /Do not show a before-and-after room comparison, key handoff, luggage move/],
    ["L3-015", /Sora and Natsuki at two separate nighttime endpoints/, /Do not show a clock, time digits, a read-receipt mark, message length/],
    ["L3-016", /Akira and Rin at two separate voicemail endpoints/, /Do not show or emphasize a shelf, upper shelf, white ornament, fragments, ownership match/],
    ["L3-017", /Risa, Mayumi, and Shuji together in one continuous broadcast production environment/, /never invent an on-location storefront/],
    ["L3-018", /Sanae and Itsuki together at the same physical school/, /school announcement only through a non-human wall or ceiling loudspeaker/],
    ["L3-019", /Haruka as the only visible human/, /Keep the narrator entirely nonvisual and off-panel/],
    ["L3-020", /same dream station with only Mio and an ordinary unfamiliar human-looking attendant/, /Do not render the spoken mistake as text/],
    ["L3-030", /test paper completely blank/, /conclusive proud, guilty, jealous, or suspicious reaction/],
    ["L3-043", /On-screen voice as the only physical traveler/, /reader body, personified subtitle/],
    ["L3-050", /Nagi as the only human.*Noa only as the same fixed non-human/, /both benign and intrusive readings visually possible/],
    ["L4-024", /quest evaluator entirely non-human and unreadable/, /Do not show the north gate, eastern cellar, medicine, timer/],
    ["L4-025", /reviewers in one continuous printer's proofing room/, /do not render the source comic scenes, speech balloons/],
    ["L4-037", /Fia unmistakably a non-human dragon/, /Mina's court AI entirely non-human as the same blank terminal/],
    ["L4-040", /two equally weighted blank door targets/, /do not show a chosen door/i],
    ["L4-041", /one continuous physical joint-business meeting/, /visually classifies the three uses of the same hedge/],
    ["L4-042", /four distinct source-defined participants in one group-chat review/, /which earlier message received either reaction/],
    ["L4-043", /one continuous physical restaurant exchange/, /declares which interpretation of omakase is correct/],
    ["L4-044", /three distinct source-defined recording endpoints/, /whether the recordings share one origin or which location it is/],
    ["L4-045", /Colony bulletin AI entirely non-human/, /visually reveals the definitional change/],
    ["L4-046", /one continuous physical time-loop laboratory/, /choosing between the two hypotheses/],
    ["L4-047", /one continuous physical mountain-inn ledger review/, /visually proves the receptionist's method/],
    ["L4-048", /inside one continuous physical game-world shop or contest aftermath/, /cue declaring ownership or motive/],
    ["L4-049", /one continuous physical retirement meeting with exactly three ordinary identical keys/, /verdict about who succeeds the founder/],
    ["L4-050", /Mio and Ren outside the evacuated ship/, /revealing who “we” includes/],
    ["L5-001", /one continuous physical merger meeting/, /which groups approved which terms/],
    ["L5-002", /one continuous physical university reunion introduction/, /Saeki's motive, Yui's feelings, or their private history/],
    ["L5-003", /one continuous physical curry-tasting table/, /visual verdict about the dish's reception/],
    ["L5-004", /one continuous physical former-station market and travel-report setting/, /visual verdict about whether service will return/],
    ["L5-005", /four separate remote community-vote chat endpoints/, /assigning an original vote to a person/],
    ["L5-006", /separate source-defined game or audio-review endpoints/, /visual guarantee about what happens after replay is turned off/],
    ["L5-007", /two real users at two separate physical endpoints/, /visible mapping between voice, hand motion, and either user/],
    ["L5-008", /one continuous physical HR mediation/, /visually repaired meeting outcome/],
    ["L5-009", /one remote drifting-ship transmission origin/, /who inserted the present-time appeals/],
    ["L5-010", /one continuous present-day physical inquiry room/, /who was in the room at eight/],
    ["L5-011", /one continuous source-defined election-broadcast discussion setting/, /visual verdict about civic willingness or headline fairness/],
    ["L5-012", /one continuous late-night radio-program review setting/, /letter or icon sequence that reconstructs the covert channel/],
    ["L5-013", /one continuous local device-review setting/, /cue deciding who changed the dates/],
    ["L5-014", /one continuous physical time-loop laboratory/, /visually recoverable chronology, motive, truth value, or correct action/],
    ["L5-015", /one continuous three-layer dream/, /identify who waits or what each translation omitted/],
    ["L5-016", /one continuous physical old-gate inquiry/, /visual conclusion about what the ban targets/],
    ["L5-017", /one continuous physical castle bedside or adjoining greenhouse context/, /proves what sustained the sleep or caused the awakening/],
    ["L5-018", /one parliamentary-broadcast origin/, /arrows connecting the cue to the conclusion/],
    ["L5-019", /one continuous physical portrait-gallery inspection/, /cue revealing which portrait remains unexplained/],
    ["L5-020", /one continuous physical AI cafeteria/, /reaction exaggeration, or a scoring diagram/],
    ["L5-021", /one continuous physical resignation and handover review/, /where Aya will go/],
    ["L5-022", /one continuous physical submission-review meeting/, /completed correction that decides moral fault/],
    ["L5-023", /one continuous physical restaurant menu-review setting/, /how the dish was prepared/],
    ["L5-024", /one continuous physical tourist-street and map-review setting/, /visual verdict about commercial steering/],
    ["L5-025", /one continuous physical moderation and archive review/, /whether the rule existed yesterday/],
    ["L5-026", /one continuous source-defined game-world tower context/, /who or what the quest voice is/],
    ["L5-027", /one continuous shared wedding-world rehearsal and exit-threshold context/, /whether the rehearsal was genuine/],
    ["L5-028", /one continuous physical home-AI audit/, /whether Lumen remembers Akari/],
    ["L5-029", /one continuous physical colony vote review/, /visual verdict about anyone's current intent/],
    ["L5-030", /one continuous physical evidence-review room/, /itinerary combines multiple days/],
    ["L5-031", /Taiga only at a separate field-report endpoint/, /declares the host synthetic/],
    ["L5-032", /one continuous physical station environment/, /resolved safety outcome/],
    ["L5-033", /one continuous physical archive review/, /reveal the inventor's name/],
    ["L5-034", /owner only as the nonvisual voice of unattributed diary entries/, /resolved author count/],
    ["L5-035", /one continuous local gameplay context/, /show no figure or silhouette behind it/],
    ["L5-036", /one continuous physical proposal meeting/, /completed next proposal/],
    ["L5-037", /four separate remote school group-work endpoints/, /resolved intent judgment/],
    ["L5-038", /one continuous physical restaurant table/, /conclusive taste profile/],
    ["L5-039", /one continuous physical lost-property counter/, /cue resolving ownership/],
    ["L5-040", /one continuous physical time-loop test room/, /tested\/untested boundary/],
    ["L5-041", /one continuous physical treaty-conference room/, /whether the three records match, were altered, or missed a deadline/],
    ["L5-042", /one physical incident-audit room/, /visual conclusion about completeness, cause, or intent/],
    ["L5-043", /one continuous closed-station inspection/, /whether the cough is recorded, live, supernatural, or made by any named person/],
    ["L5-044", /separate physical endpoints connected only through the source-defined group chat/, /favors either the surviving draft task or the restore-time cache path/],
    ["L5-045", /one continuous physical succession meeting/, /visual cue selecting one calendar as intended/],
    ["L5-046", /one continuous museum investigation/, /give either plinth, object, or person privileged visual weight/],
    ["L5-047", /one continuous source-defined game-world landscape/, /identifies the correct action or cause/],
    ["L5-048", /one continuous physical news-studio panel/, /visually certify or discredit independent confirmation/],
    ["L5-049", /one physical receiving archive/, /which message was sent first or last/],
    ["L5-050", /one local trainer workstation/, /favoring foreknowledge over later layout editing/],
  ];

  for (const [stageId, firstRule, secondRule] of fixtures) {
    const stage = stageFixture();
    stage.id = stageId;
    const before = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    assert.match(job.prompt, /Stage-specific source-preserving constraints:/);
    assert.match(job.prompt, firstRule);
    assert.match(job.prompt, secondRule);
    assert.equal(job.sourceTextHash, before);
  }

  const ordinary = buildStageImageJob(stageFixture(), styleContract, "c".repeat(64));
  assert.doesNotMatch(ordinary.prompt, /Stage-specific source-preserving constraints:/);
});

test("L1 second-pass addenda keep endpoint, bakery, hesitation, and kiosk evidence unresolved", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const stages = new Map();
  for (const batch of ["batch-001-010.json", "batch-011-020.json"]) {
    const payload = JSON.parse(
      await readFile(path.join(TOOL_ROOT, "content", "level-1", batch), "utf8"),
    );
    for (const stage of payload.stages) stages.set(stage.id, stage);
  }
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L1-007", [
      /two separate remote game-chat endpoints/,
      /final panel.*controller is set down and her posture has turned away from the device/i,
      /neutral blank or dark screen/,
      /Do not add an online or offline label, status icon, chat bubble, message list, pseudo-text/i,
    ]],
    ["L1-010", [
      /Existing morning bread may remain only on a shelf or the customer's own tray/,
      /clerk carrying, presenting, setting down, or removing a tray of newly baked bread/,
      /restrained waiting gesture/,
      /Do not show an oven opening, steam, a completed wait, a fresh-batch arrival, a successful purchase outcome, a clock, digit, written time, or countdown cue/,
    ]],
    ["L1-018", [
      /slight hesitation and request for an opaque bag restrained and observational/,
      /ordinary abstract product package/,
      /Do not add a sweat drop, blush, head scratch, averted or hiding posture, guilty expression/,
      /recipient image, or any visual clue that establishes who the item is for/,
    ]],
    ["L1-019", [
      /Miki as the only human in all four panels/,
      /same visibly fixed non-human hardware terminal/,
      /Do not show a human face, human body, personified avatar, customer-service agent, operator/i,
      /only equally weighted abstract blocks/,
      /one small neutral milk-unavailable icon/,
      /clock, timestamp, record list, history panel, identity diagram, ownership match/,
    ]],
  ]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const before = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, before, stageId);

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted an option or explanation leak`);
    assert.deepEqual(
      audit.sourceCollisions,
      [],
      `${stageId} should not misclassify canonical source text as an inserted leak`,
    );

    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.sourceTextHash, before, stageId);
  }
});

test("L2-001 through L2-012 second-pass addenda preserve reviewed panel beats", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const stages = new Map();
  for (const batch of ["batch-001-010.json", "batch-011-020.json"]) {
    const payload = JSON.parse(
      await readFile(path.join(TOOL_ROOT, "content", "level-2", batch), "utf8"),
    );
    for (const stage of payload.stages) stages.set(stage.id, stage);
  }
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L2-001", [
      /wall surfaces and workplace materials.*few large equally weighted abstract geometric fields/i,
      /no horizontal line, row, legend, key, label, caption, tiny mark, or pseudo-writing layout/i,
      /Do not turn the register shift into a relationship diagram, flashback, or resolved conclusion/,
    ]],
    ["L2-002", [
      /Naoto presents the trial cake; Eri takes a first taste; Eri gives only a restrained response and asks for more cream; Eri takes the source-defined second bite/,
      /Do not show blush, sparkling eyes, a delighted grin, celebratory or approving gesture, thumbs-up, praise pose/,
      /do not resolve how strongly Eri likes the cake/,
    ]],
    ["L2-003", [
      /one completely blank application form with no writing, horizontal line, field, box, grid, header, stamp, mark, or pseudo-text/,
      /Ryo must clearly not receive, take, touch, or carry the form/,
      /Use panel 4 for Ryo leaving after the exchange/,
      /Do not show a calendar, Friday, weekday or date text, digit, deadline symbol, check mark, cross mark/,
    ]],
    ["L2-006", [
      /panel 2 Taka declines the clerk's routine preparation and selects another equally weighted unlabeled coffee/,
      /Reserve panel 3 for the clerk's question and panel 4 for Taka's answer/,
      /Do not label or visually distinguish strong coffee from decaf/,
      /no clock, moon, bed, pillow, yawn, closed-eye drowsiness, sleep symbol/,
    ]],
    ["L2-007", [
      /Only Mizuki may wear the source-defined restrained smile/,
      /Sato and Kana must remain neutral/,
      /full empty chair and the smallest practical client-dinner table/,
      /Remove handbags, purses, plants, flowers, wall art, centerpieces/,
    ]],
    ["L2-008", [
      /three independent voice-chat endpoints/,
      /neutral mouth shape and stable upright posture/,
      /final panel Taiga keeps his head level, brow neutral, shoulders uncollapsed/,
      /Do not lower his head, add a frown, hunch or drop his shoulders/,
    ]],
    ["L2-010", [
      /only the source-defined large bag, with its complete bag body and exactly two handles continuously visible/,
      /Do not add a shoulder bag, shoulder strap, satchel, backpack, purse, or extra bag/,
      /final panel Riko's hand must stop hovering beside one handle without grasping, touching, lifting, or carrying it/,
    ]],
    ["L2-011", [
      /proposal materials only as a few large blank equally weighted geometric blocks/,
      /exactly one ordinary unused approval stamp.*no ink mark/i,
      /Remove every tablet computer/,
      /Saeki, Manager Kuroda, and Mizuki all remain neutral/,
    ]],
    ["L2-012", [
      /Every book spine must be completely blank or contain only a few large equally weighted solid geometric blocks/,
      /Remove circular dot labels, bordered label frames, spine plaques, stickers/,
      /Remove all extra pens, pencils, clips, rulers, organizers, and other stationery decoration/,
      /Do not draw horizontal writing lines, grids, tables, form fields/,
    ]],
  ]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (stageId === "L2-008") {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(
      audit.sourceCollisions,
      [],
      `${stageId} should have no canonical option or explanation collision`,
    );

    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.promptHash, job.promptHash, `${stageId} prompt hash is stale`);
    assert.equal(canonical.sourceTextHash, sourceTextHash, stageId);
  }
});

test("L3-011 through L3-015 addenda preserve evidence topology without leaking conclusions", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(
      path.join(TOOL_ROOT, "content", "level-3", "batch-011-020.json"),
      "utf8",
    ),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L3-011", [
      /same physical school-festival committee room with Chiaki, Kota, Reiko, and Yu as the only four people/,
      /one completely blank minutes sheet and one completely blank layout sheet with equal visual weight/,
      /Do not show a vote, raised hands, approve or reject mark, final stamp/,
      /Do not visually chain continued deliberation to Chiaki's request and then to a conclusion that she drove the decision or evaded responsibility/,
    ]],
    ["L3-012", [
      /same physical pitch meeting with Nomura, Saya, and Atsushi as the only three people/,
      /Nomura may only close one completely blank proposal packet/,
      /Do not show internal departments or staff, material circulation, adoption or rejection/,
      /Do not visually turn internal sharing, review, and the absence of a deadline into either a positive adoption decision or a rejection/,
    ]],
    ["L3-013", [
      /same restaurant table immediately after the meal with Yuta, Mina, and Satoshi co-present/,
      /tableware and exactly three equally weighted blank phones/,
      /Do not show an exact amount, currency, small change, an empty wallet/,
      /Do not visually chain an available app, refusal to transfer, and a data excuse into the conclusion that Yuta wants Satoshi to advance the payment/,
    ]],
    ["L3-014", [
      /same physical hotel reception with Sara and Makoto as the only people/,
      /road construction only as a neutral distant environmental fact/,
      /Do not enter or show the alternate room/,
      /Do not show a before-and-after room comparison, key handoff, luggage move/,
      /Do not visually chain the noise, larger quiet room, and absence of an extra charge into a completed compensation outcome/,
    ]],
    ["L3-015", [
      /Sora and Natsuki at two separate nighttime endpoints/,
      /each endpoint has exactly one uniformly blank device/,
      /Do not show a clock, time digits, a read-receipt mark, message length/,
      /Do not visually chain an earlier reading, a later reopening, and the reply into a resolved interpretation of the colloquial wording/,
    ]],
  ]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (stageId === "L3-015") {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(
      audit.sourceCollisions,
      [],
      `${stageId} should not misclassify canonical source text as an inserted leak`,
    );

    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.sourceTextHash, sourceTextHash, stageId);
  }
});

test("L3-016 through L3-020 addenda preserve broadcast, school, narrator, and dream topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(
      path.join(TOOL_ROOT, "content", "level-3", "batch-011-020.json"),
      "utf8",
    ),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L3-016", [
      /Akira and Rin at two separate voicemail endpoints/,
      /Akira's endpoint may show one ordinary generic broken ornament/,
      /Rin must never appear at the physical damage scene/,
      /Do not show or emphasize a shelf, upper shelf, white ornament, fragments, ownership match/,
      /Do not visually chain Rin's undisclosed detail knowledge to responsibility for the damage/,
    ]],
    ["L3-017", [
      /Risa, Mayumi, and Shuji together in one continuous broadcast production environment/,
      /Wataru's physical location is not established by the source/,
      /neutral broadcast presence or one blank feed/,
      /never invent an on-location storefront/,
      /Do not show readable closure or reopening wording, a sponsor or company logo, an advertising slot, money/,
      /Do not visually chain Mayumi's wording instruction and the sponsorship reference into proven sponsor influence/,
    ]],
    ["L3-018", [
      /Sanae and Itsuki together at the same physical school/,
      /school announcement only through a non-human wall or ceiling loudspeaker/,
      /blank notice, blank attendance list, and ordinary first-aid kit neutral and equally weighted/,
      /Do not show a date, calendar, today-to-next-week timeline, flame, smoke/,
      /Do not visually chain a schedule mismatch, staff supplies, and drill wording into a confirmed real evacuation/,
    ]],
    ["L3-019", [
      /same inn viewpoint facing the nearby station/,
      /Haruka as the only visible human/,
      /Keep the narrator entirely nonvisual and off-panel/,
      /clock, train, and crossing neutral and unreadable/,
      /crossing may slowly rise as stated, but it must not become a highlighted exit route/,
      /Do not show duplicate Harukas, a repeated-day montage, clock digits or hand positions/,
      /Do not visually chain synchronized train and clock cues with the rising crossing into proof that the loop has broken/,
    ]],
    ["L3-020", [
      /same dream station with only Mio and an ordinary unfamiliar human-looking attendant/,
      /one neutral blank gate and one neutral blank sign/,
      /Do not render the spoken mistake as text, pseudo-text, a right-side arrow, or a highlighted side/,
      /Do not show a childhood flashback, family member, mirrored face, double, ghost, glow, or memory fragments/,
      /Do not transform the attendant into Mio or otherwise visualize the final identity conclusion/,
      /Do not show Mio passing through an exit, returning home, or reaching a resolved outcome/,
    ]],
  ]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (["L3-016", "L3-017"].includes(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(
      audit.sourceCollisions,
      [],
      `${stageId} should not misclassify canonical source text as an inserted leak`,
    );

    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.sourceTextHash, sourceTextHash, stageId);
  }
});

test("L3-021 through L3-030 addenda preserve local evidence without resolving the questions", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(
      path.join(TOOL_ROOT, "content", "level-3", "batch-021-030.json"),
      "utf8",
    ),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L3-021", [
      /same old-quarter oracle house as the only people/,
      /exactly one ordinary sealed blank envelope/,
      /Do not literalize.*visible door, north gate, harbor gate, key, lock/i,
      /Do not open, discard, hand over, or reveal the envelope/,
    ]],
    ["L3-022", [
      /same audience chamber as the only people/,
      /closed completely blank ledgers neutral and equally weighted/,
      /Do not show a divided kingdom, eastern map, debt or money symbols, broken bridges, petition piles, fruit, monsters/,
      /Do not pair or highlight two burden icons/,
    ]],
    ["L3-023", [
      /present-day peace-treaty centennial exhibition/,
      /single exhibited treaty as one blank unreadable sheet inside its case/,
      /Do not materialize Interpreter Mina, either king, or either army/,
      /signature marks or boxes, marginal writing, bilingual line patterns, matching order sheets/,
    ]],
    ["L3-024", [
      /one continuous post-recording studio or control-room context/,
      /one fixed non-human Singing AI endpoint/,
      /never a remote human, avatar, singer body, or operator/,
      /waveform, three aligned takes, a repeated tremor marker, final-line highlight, comparison chart/,
    ]],
    ["L3-025", [
      /same closed city library as the only people/,
      /moving books, their small blank spine tags, the floor line, and the retrieval cart/,
      /blue tag glow only as a faint neutral grayscale glow/,
      /Do not visually chain the tags, floor line, cart, and the Librarian's prior knowledge into a solved cause/,
    ]],
    ["L3-026", [
      /in or immediately beside the same research-building elevator/,
      /Elevator AI represented only by the elevator's fixed hardware/,
      /Do not reproduce 0-TEST, floor zero, third floor, digits, letters, an up arrow/,
      /Do not open onto or reveal the hidden test room/,
    ]],
    ["L3-027", [
      /together in one present indoor inquiry context/,
      /one wet umbrella, Sho's ordinary shoes, the drying rack/,
      /Do not reenact rain, an outing, an awning walk, Miki returning the umbrella, the file deletion/,
      /paired close-ups of shoes and a record, culprit emphasis, confession, or a guilty reaction/,
    ]],
    ["L3-028", [
      /one present after-the-fact interview or review environment as the only people/,
      /news script and any playback surface completely blank, abstract, and equally weighted/,
      /Do not reenact the station accident, vehicle, square, witness position, building occlusion, aerial view/,
      /matching text layout, camera cone, split comparison, memory bubble, overlay, arrow/,
    ]],
    ["L3-029", [
      /one continuous source-defined forest-quest battle space/,
      /Quest System entirely non-human and limited to one neutral blank environmental HUD or status area/,
      /upper stream is a river location, not remote communication/,
      /Do not reproduce either objective, detection text, record text, attack prompt, or a before-and-after objective rewrite/,
    ]],
    ["L3-030", [
      /same desk as the only people, with one intact test paper/,
      /stop before the reverse side becomes a drawing surface/,
      /Do not show drawing tools, Minato drawing, a spaceship image, a completed drawing/,
      /concealment-to-blank-side-to-spaceship sequence/,
    ]],
  ]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (["L3-024", "L3-027", "L3-029"].includes(stageId)) {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(
      audit.sourceCollisions,
      [],
      `${stageId} should have no canonical option or explanation collision`,
    );

    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.promptHash, job.promptHash, `${stageId} prompt hash is stale`);
    assert.equal(canonical.sourceTextHash, sourceTextHash, stageId);
  }
});

test("L3-031 through L3-040 addenda preserve physical evidence, avatar identity, and communication topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(
      path.join(TOOL_ROOT, "content", "level-3", "batch-031-040.json"),
      "utf8",
    ),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L3-031", [
      /same physical workplace immediately after the promotion announcement as the only people/,
      /one small overlapping stack of completely blank evaluation copies whose sheet count cannot be read/,
      /Do not show readable or repeated evaluation layouts, countable yearly forms, year or delay markers/,
      /promotion ladder or queue, other employees being promoted, comparison arrows, a timeline/,
      /Do not pair the blank copies with another highlighted clue/,
    ]],
    ["L3-032", [
      /same post-graduation reunion interior as the only people/,
      /exactly one notebook with one ordinary blank ticket inside one clear pocket/,
      /Do not show a readable date, a facing-direction comparison, flattened-crease close-up/,
      /torn-versus-replaced pocket sequence, repair action, preservation montage/,
      /Never combine ticket alignment, crease treatment, and pocket maintenance/,
    ]],
    ["L3-033", [
      /same dining-service interaction as the only people/,
      /one small ordinary salt shaker with a plain intact seal and one completely blank tasting sheet/,
      /neither may receive a close-up, pointing gesture, gaze target, or greater visual weight/,
      /Do not reenact the customer adding salt, soup preparation, a kitchen inspection, the finishing cook/,
      /Do not pair or compare the salt-shaker seal and tasting sheet/,
    ]],
    ["L3-034", [
      /one continuous workshop-tour kiln area as the only people/,
      /displayed plates remain ordinary, unmarked background objects, and the next room stays off-panel/,
      /Guide-to-Shinji pointing cue followed by Natsumi redirecting the group/,
      /Do not show plate ownership marks, paired competition plates, the master, a younger-version flashback/,
      /composition that singles out Natsumi and Shinji as a resolved relationship/,
    ]],
    ["L3-035", [
      /four separate creative-club group-chat endpoints/,
      /exactly one person in each undivided whole-panel view and one ordinary device per endpoint/,
      /all four device screens completely blank, visually identical, and equally weighted/,
      /Do not show a missing-message gap, unequal message blocks, pinned banner, deletion mark/,
      /Never pair selective disappearance with a second emphasized record state/,
    ]],
    ["L3-036", [
      /Yui as the only real-world version of herself/,
      /Predictive Avatar only inside one ordinary virtual display/,
      /carry Yui's recognizable face and hair cues into a visibly virtual, screen-bound likeness/,
      /at most one source-defined wave or head-tilt cycle without a side-by-side comparison/,
      /Do not render the Avatar as a third physical person or an unrelated face/,
      /half-second marker, ninety-day archive, clock, timeline, prediction arrow/,
      /deliberate counter-gesture, mismatch status, switch to live input/,
    ]],
    ["L3-037", [
      /same post-meeting review room as the only human people/,
      /Minutes AI only as fixed non-human meeting-room hardware/,
      /Do not show a five- or eight-second marker, clock, timer, waveform, silence icon/,
      /unanimity symbol, check mark, cross mark, raised-hand vote/,
      /Do not sequence silence, an agreement tag, later objection, rule revision, and tag withdrawal/,
    ]],
    ["L3-038", [
      /same spacecraft bridge or log area with Captain Rei as the only human person/,
      /Ship AI Orca only through fixed ship hardware/,
      /do not add a second physical endpoint, remote room, human operator, avatar, robot body/,
      /Do not show the seventh coordinate, a biological crew count, the 187-day duration/,
      /paired human-and-AI companion portrait, handshake, heart, joint-report mark/,
      /Keep shared contribution and companionship as spoken possibilities/,
    ]],
    ["L3-039", [
      /Reporter and Candidate together in the same physical press conference/,
      /Analyst's physical location is not established by the source/,
      /keep the Analyst nonvisual and off-panel/,
      /Do not literalize many voices as a crowd or ears, the open door as a physical doorway/,
      /Do not show pro-or-con signs, thumbs, scales, a utility bill or price chart, ballot/,
      /question-to-metaphor-to-deadline-to-verdict sequence/,
    ]],
    ["L3-040", [
      /Late-night Announcer in the source-defined broadcast studio and Listener Kaede at one separate listening endpoint/,
      /alternating only undivided whole-panel views and never placing them together/,
      /one completely blank note, and one completely blank ticket may appear with equal low visual weight/,
      /Do not materialize the spoken umbrella as a physical prop or show an east arrow, compass, east exit/,
      /three repeated message blocks, countable repetition, cancellation control/,
      /Do not visually chain clear weather, anomalous repetition, the note, and the ticket/,
    ]],
  ]);
  const remoteStageIds = new Set(["L3-035", "L3-036", "L3-040"]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(
      audit.sourceCollisions,
      [],
      `${stageId} should have no canonical option or explanation collision`,
    );

    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.promptHash, job.promptHash, `${stageId} prompt hash is stale`);
    assert.equal(canonical.sourceTextHash, sourceTextHash, stageId);
  }
});

test("L3-041 through L3-050 addenda preserve source topology without revealing evidence chains", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(
      path.join(TOOL_ROOT, "content", "level-3", "batch-041-050.json"),
      "utf8",
    ),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  assert.equal(stages.get("L3-047")?.revision, 5);
  assert.equal(
    stages.get("L3-047")?.setting?.ja,
    "旅行者三人と店員が同席する夕食。通訳は注文を正確に訳すが、誕生日の歌を予告する店員の一文だけを意図的に伏せる。",
  );
  assert.equal(
    stages.get("L3-047")?.setting?.en,
    "Dinner with three travelers and a server present, where an interpreter relays every order accurately but deliberately withholds the server's announcement of a birthday song.",
  );
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L3-041", [
      /one continuous physical diary-inspection context/,
      /exactly one rebound diary/,
      /non-countable binding holes, and a faint pressed-flower impression/,
      /Do not show a readable date, erased number sequence, page order, chronology strip/,
      /do not resolve who changed the order or why/,
    ]],
    ["L3-042", [
      /same station lost-property office after the last train as the only people/,
      /exactly one ordinary ticket.*reverse remains unexamined/,
      /Do not show Mizuki, a planner of either color, another ticket/,
      /readable date, time, name, or handwriting/,
      /source of Azuma's foreknowledge unresolved/,
    ]],
    ["L3-043", [
      /only physical traveler in one continuous quiet train-farewell scene/,
      /reader outside the story only as an off-panel viewpoint/,
      /Subtitle remains a non-human layer/,
      /personified subtitle, second speaker, translation comparison/,
      /without visually revealing the hidden warning, requested action/,
    ]],
    ["L3-044", [
      /Maki, Kiryu, and Sumikawa together on one physical election-debate set/,
      /Nitta remains alone in a separate broadcast control room/,
      /Alternate only whole undivided panel views/,
      /audience crowd, applause or disapproval symbol, timer, second count/,
      /archive interface, deletion action.*completed censorship outcome/,
    ]],
    ["L3-045", [
      /Homura unmistakably a non-human dragon/,
      /Leon's sword sheathed, Homura's claws visible but nonattacking/,
      /one modest tea-and-pastry setting/,
      /Do not show drawn blades, attack, injury, poison cue/,
      /End before combat, truce/,
    ]],
    ["L3-046", [
      /one continuous physical observation area inside the rotating space habitat/,
      /Habitat guide AI as source-defined fixed non-human habitat hardware/,
      /cast id `guide` must not turn it into a human guide/,
      /do not show rotation arrows, star-motion trails, a ring cutaway/,
      /change in understanding in dialogue rather than a visual solution/,
    ]],
    ["L3-047", [
      /exactly the source-defined four people physically together at one dinner table/,
      /Rina, Emma, and Wataru as the three travelers, and Naoki as the single server/,
      /fish dishes, separate sauce dish, side dish, and sparkling water/,
      /Do not add another diner or staff member, birthday cake/,
      /completed birthday song.*Do not visually identify which sentence was withheld or why/,
    ]],
    ["L3-048", [
      /Mai, Oda, and Kaya together in the same contemporary planning meeting room/,
      /Kurokawa remains physically absent and appears only at one separate remote phone endpoint/,
      /source-defined ordinary human office director.*cast id `boss`/,
      /minutes, proposal, consent material, and phone screen completely blank/,
      /silence-to-approval arrow, attribution diagram, consent-flow solution/,
    ]],
    ["L3-049", [
      /same single room and show exactly one current blank warning note/,
      /compact supply of completely blank paper whose sheet count cannot be read/,
      /do not multiply the room into loop panels/,
      /Do not show a clock time, bird count, readable warning, line count/,
      /Do not reveal how many attempts remain or what vanished/,
    ]],
    ["L3-050", [
      /Nagi as the only human.*Noa only as the same fixed non-human conversational-AI device/,
      /cast id `ai` must not supply a human face/,
      /microphone status light.*final off state.*source-defined farewell/,
      /Do not show digits, elapsed-time marks, countdown, leaving-detection outline/,
      /both benign and intrusive readings visually possible/,
    ]],
  ]);
  const remoteStageIds = new Set(["L3-044", "L3-048"]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(
      audit.sourceCollisions,
      [],
      `${stageId} should have no canonical option or explanation collision`,
    );

    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.promptHash, job.promptHash, `${stageId} prompt hash is stale`);
    assert.equal(canonical.sourceTextHash, sourceTextHash, stageId);
  }
});

test("L4-001 through L4-010 addenda preserve local, remote, media, and non-human topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-4", "batch-001-010.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  assert.equal(stages.get("L4-003")?.revision, 5);
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L4-001", [
      /Sales Rei, Development Gaku, Finance Tamaki, and Chair Sakaki together/,
      /generic cast ids `sales`, `dev`, `finance`, and `chair` must preserve those source-defined human workplace roles/,
      /exactly one ordinary completely blank budget sheet/,
      /no second copy, money, staffing diagram, or other document/,
      /Do not show vote counts, raised-hand voting, approval or rejection marks/,
      /implementation state unresolved/,
    ]],
    ["L4-002", [
      /Mori as the source-defined human teacher, Yuto as the committee member/,
      /cast ids `teacher`, `chair`, `student`, and `witness` must not change those roles/,
      /physical device handoff and Mori's lecture stage as separate observable beats/,
      /Mori must remain visibly away from the borrowed device/,
      /one abstract unreadable class-chat surface/,
      /Do not show dates, times, weekday labels, readable bookings, author badges/,
      /arrows identifying who caused the post/,
    ]],
    ["L4-003", [
      /one physical restaurant table for four with Emi, Koji, Lin, and the Server/,
      /late fourth guest remains entirely off-panel/,
      /earlier phone call remains spoken history/,
      /one candle mostly concealed beneath that napkin, with one empty place/,
      /No one may point toward, toast, wink about, cluster around, or spotlight/,
      /Do not use arrows or a final reveal/,
    ]],
    ["L4-004", [
      /Reo, Miki, the Gate Agent, and Yu within one continuous airport gate area/,
      /trilingual announcement is a local public-address event/,
      /use no broadcast studio, phone call, video feed, interpreter booth, or split-screen/,
      /Do not show gate numbers, language names or flags, route arrows/,
      /no secret signal, hiding gesture, conspiratorial pose/,
    ]],
    ["L4-005", [
      /visible only as avatars inside the same VRChat mediation room/,
      /cast ids `host`, `avatar-a`, `avatar-b`, and `witness` refer only to/,
      /Never show their real users, physical rooms, external headsets/,
      /Treat `avatar-a` and `avatar-b` as current avatar presentations/,
      /all nameplates, records, and interface areas blank/,
      /End before any identity is visually confirmed/,
    ]],
    ["L4-006", [
      /four separate remote player endpoints/,
      /one person and at most one ordinary device per undivided whole-panel view/,
      /Never place all four people together in one physical room/,
      /co-op game, public stream, text chat, and private call as abstract unreadable device states/,
      /game boss as an extra focal character/,
    ]],
    ["L4-007", [
      /three interviews separate in time/,
      /interviews Aoi, Fumi, and Tomo one at a time/,
      /do not reenact their earlier memory comparison, the cleaner, or corridor events/,
      /one completely blank reception schedule/,
      /end on unresolved questioning rather than a relationship diagram, confession, or conclusion/,
    ]],
    ["L4-008", [
      /media sequence as distinct whole-panel contexts/,
      /one physical raw interview with the Reporter and Hori/,
      /one editing or production view with Mio/,
      /one broadcast-output view with the News Narrator/,
      /Never place all four people together or use split-screen or before-and-after overlays/,
      /final visual conclusion about responsibility/,
    ]],
    ["L4-009", [
      /Director, Lead, junior researcher Ai, and one fixed non-human Review AI terminal together/,
      /human named Ai.*cast id `ai` is only the fixed Review AI terminal/,
      /local blank evidence surfaces, not remote communication/,
      /add no operator, avatar, robot body, auditor, or extra researcher/,
      /Do not encode rank through height, seating, body size, spotlight/,
      /Do not show percentages, credibility numbers, warning icons/,
    ]],
    ["L4-010", [
      /three distinct communication locations/,
      /Control AI only as fixed non-human control hardware/,
      /cast id `ai` must remain that hardware/,
      /Alternate undivided whole-panel views/,
      /Keep both manifests, voice checks, and channel state completely blank/,
      /Do not show the word `we`, crew counts, timestamps, waveforms/,
      /still-outside Ship Two member entirely unseen/,
      /corrected registration, or completed verification/,
    ]],
  ]);
  const remoteStageIds = new Set(["L4-002", "L4-005", "L4-006", "L4-010"]);
  const computedJobs = new Map();

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(audit.sourceCollisions, [], `${stageId} should have no canonical collision`);

    computedJobs.set(stageId, { job, sourceTextHash });
  }

  for (const [stageId, { job, sourceTextHash }] of computedJobs) {
    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.promptHash, job.promptHash, `${stageId} prompt hash is stale`);
    assert.equal(canonical.sourceTextHash, sourceTextHash, stageId);
  }
});

test("L4-011 through L4-020 addenda preserve source topology without revealing evidence chains", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-4", "batch-011-020.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L4-011", [
      /four separate physical endpoints.*event chat/,
      /pinned summary, original posts, omitted reply, and timestamps only as equally weighted blank interface blocks/,
      /corrected summary, deleted post, double-post diagram/,
    ]],
    ["L4-012", [
      /three separate asynchronous voicemail or phone endpoints/,
      /unsent draft exists only as one blank draft surface/,
      /Do not materialize the used-bookstore candidate as a visited venue/,
    ]],
    ["L4-013", [
      /Mio alone at the school broadcast booth.*Makoto, Okabe, and Naoki.*school listening area/,
      /announcement comes only from fixed school broadcast hardware/,
      /Do not show a labeled third storeroom.*completed surprise display/,
    ]],
    ["L4-014", [
      /four separate workplace email endpoints/,
      /Hori is the source-defined sales manager.*executive remains off-panel/,
      /Do not show recipient names, a growing copy list, dates, times, money, clauses/,
    ]],
    ["L4-015", [
      /Saya, Kuroda, and Riku as the only people.*creative-restaurant service interaction/,
      /one source-defined plate pairing the yuzu dessert with the smoked fish/,
      /Do not show disgust, delight, a praise gesture, a blame gesture, guilt/,
    ]],
    ["L4-016", [
      /one continuous physical group-tour discussion/,
      /location sharing is a condition being discussed, not a remote-participant topology/,
      /Do not show readable times or intervals.*GPS pin, route trace, geofence/,
    ]],
    ["L4-017", [
      /one continuous physical human-elf council hearing/,
      /forest remains off-panel.*must not become a speaking body, spirit, avatar/,
      /Do not show the road opening or remaining closed, winter arriving, medicine delivered or withheld/,
    ]],
    ["L4-018", [
      /source-defined present testimony reconstruction/,
      /do not reenact the forest night or materialize the princess/,
      /exactly one ordinary left shoe as a neutral reference object/,
      /Do not sequence slipping, kicking, and catching on a stone as alternate flashbacks/,
    ]],
    ["L4-019", [
      /one continuous physical treaty hearing/,
      /at most two completely blank treaty sheets with identical size and equal visual weight/,
      /Do not show a port opening or closing, ships moving, a successful signature/,
    ]],
    ["L4-020", [
      /same current shipboard AI audit room/,
      /Mina exists only through the same fixed navigation-AI hardware/,
      /earlier exterior work remains a reported alibi and must stay off-panel/,
      /never draw the signing credential as a literal physical key/,
    ]],
  ]);
  const remoteStageIds = new Set(["L4-011", "L4-012", "L4-013", "L4-014"]);

  assert.equal(computeStageSourceTextHash(stages.get("L4-014")), "ee2e57a8bd28948df06bedbbac5c709f61877df35584a40ab67cecb7880cdb42");

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(audit.sourceCollisions, [], `${stageId} should have no canonical collision`);

    const canonical = canonicalJobs.get(stageId);
    assert.ok(canonical, `missing canonical image2 job ${stageId}`);
    assert.equal(canonical.prompt, job.prompt, `${stageId} canonical prompt is stale`);
    assert.equal(canonical.promptHash, job.promptHash, `${stageId} prompt hash is stale`);
    assert.equal(canonical.sourceTextHash, sourceTextHash, stageId);
  }
});

test("L4-031 through L4-040 computed addenda preserve evidence, cast, and communication topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-4", "batch-031-040.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const requirements = new Map([
    ["L4-031", [
      /one source-defined election-broadcast origin for Makoto, So, and Nanami.*separate viewer-side observation for Riku/,
      /Never place Riku behind the broadcast desk/,
      /Do not render percentages, respondent counts, proportional charts, majority marks/,
      /do not visually prefer any denominator/,
    ]],
    ["L4-032", [
      /one continuous physical rescue-ship return-log and inventory area/,
      /Noa as fixed non-human ship hardware.*Rou as one source-defined non-human work unit/,
      /Do not show a highlighted extra suit, a suit fitted onto Rou/,
      /completed amended report/,
    ]],
    ["L4-033", [
      /two adjacent but physically separate real-user endpoints/,
      /exactly one consistent shared avatar/,
      /Ren and Kei.*never inside either sister's real room/,
      /Do not visually assign the controller, voice, voiceprint, handedness setting/,
      /split or doubled avatar, dual-user diagram, waveform, biometric match/,
    ]],
    ["L4-034", [
      /Aoi, Kei, and Nadia at separate remote meeting endpoints in whole undivided panels/,
      /Member Li only as an off-panel referenced endpoint/,
      /Minutes AI as one fixed non-human meeting interface/,
      /Do not render a countdown, elapsed seconds, red\/green polarity/,
      /heard\/unheard badge, restored-connection success, proxy vote/,
    ]],
    ["L4-035", [
      /one continuous physical leak-inquiry evidence area with exactly one shred bin/,
      /Do not reenact the shredding or add a culprit/,
      /every sheet and fragment blank, unreadable, uncountable, and equally weighted/,
      /Do not separate the bulk paper and narrow fragments by color, watermark, fiber texture/,
      /reconstructed contract, motive or profit symbol, or culprit conclusion/,
    ]],
    ["L4-036", [
      /one continuous rainy tour meeting-point and entrance context/,
      /Rei remains only the source-defined off-panel response.*photographer remains an off-panel referenced outsider/,
      /large black umbrella and the clear umbrella.*separate equally weighted background props/,
      /Do not place Mizuki visibly under one while isolating the other/,
      /map an umbrella to an owner or group member/,
    ]],
    ["L4-037", [
      /Fia unmistakably a non-human dragon/,
      /one continuous physical dragon-apology archive/,
      /Mina's court AI entirely non-human as the same blank terminal in that room/,
      /Historical kings, tears, template generation, signing, viewing, and earlier letter production remain off-panel/,
      /Do not show King Alto writing or signing, a finished replacement letter/,
      /stop before any rewrite begins/,
    ]],
    ["L4-038", [
      /Kasumi only at the source-defined government-news broadcast origin/,
      /Riku and Hana as receiving citizens.*Toma as the source-defined engineer/,
      /Never gather all four in one newsroom/,
      /Do not render either network name, time or date, outage duration/,
      /secret past-operation reenactment, public activation, before-and-after timeline/,
    ]],
    ["L4-039", [
      /one continuous physical archive review with exactly one recovered private document/,
      /document owner, later compiler, bell and envelope events, and earlier audio-recording session remain off-panel/,
      /Do not encode tense, handwriting identity, added date/,
      /diary-versus-script classification, author-to-reader chain, or rearchiving label/,
      /completed reclassification/,
    ]],
    ["L4-040", [
      /Rio and Mina only as source-defined in-game characters inside one continuous game world/,
      /Choice UI entirely non-human as one blank interface layer/,
      /Sora in the controller or recorder layer outside that game world/,
      /exactly two equally weighted blank door targets/,
      /Do not map either target to an outcome.*Do not show a chosen door.*render a keyboard press or pointer trail/,
      /resolve the error, or show escape or remain success/,
    ]],
  ]);
  const remoteStageIds = new Set(["L4-031", "L4-033", "L4-034", "L4-038"]);
  const expectedSourceCollisionCounts = new Map([
    ["L4-032", 4],
    ["L4-033", 1],
    ["L4-034", 2],
    ["L4-040", 2],
  ]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);

    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }
    if (stageId === "L4-035") {
      assert.match(job.prompt, /Do not reproduce, transliterate, or spatially encode any quoted words/, stageId);
    }
    if (stageId === "L4-040") {
      assert.match(job.prompt, /Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.equal(
      audit.sourceCollisions.length,
      expectedSourceCollisionCounts.get(stageId) ?? 0,
      `${stageId} introduced a source collision beyond the audited canonical source text`,
    );

    const nonPromptChange = clone(stage);
    nonPromptChange.revision += 1000;
    nonPromptChange.illustration = {
      ...nonPromptChange.illustration,
      sha256: "e".repeat(64),
    };
    nonPromptChange.questions[0].options[0].text.en = "Synthetic non-prompt option change";
    assert.equal(computeStageSourceTextHash(nonPromptChange), sourceTextHash, stageId);
  }
});

test("L4-041 through L4-050 computed addenda preserve evidence, cast, and communication topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-4", "batch-041-050.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const requirements = new Map([
    ["L4-041", [
      /one continuous physical joint-business meeting/,
      /returned original and USB.*blank, unreadable, and equally weighted/,
      /visually classifies the three uses of the same hedge/,
    ]],
    ["L4-042", [
      /four distinct source-defined participants in one group-chat review/,
      /every message, attachment, reaction, poll, time, and icon unreadable and equally weighted/,
      /which earlier message received either reaction/,
    ]],
    ["L4-043", [
      /one continuous physical restaurant exchange/,
      /menu, order slip, course count, and all dish labels blank and uncountable/,
      /declares which interpretation of omakase is correct/,
    ]],
    ["L4-044", [
      /three distinct source-defined recording endpoints.*one separate analyst review endpoint/,
      /exactly one whole undivided panel per endpoint/,
      /whether the recordings share one origin or which location it is/,
    ]],
    ["L4-045", [
      /Colony bulletin AI entirely non-human as one fixed blank public-information interface/,
      /population figure, date, traveler record, resource series, and port indicator unreadable/,
      /visually reveals the definitional change/,
    ]],
    ["L4-046", [
      /one continuous physical time-loop laboratory.*opposite sides of exactly one mirror/,
      /Forensic AI entirely non-human as one fixed blank laboratory interface/,
      /choosing between the two hypotheses/,
    ]],
    ["L4-047", [
      /one continuous physical mountain-inn ledger review/,
      /ledger, expected column, names, dates, weather or train records.*unreadable and equally weighted/,
      /visually proves the receptionist's method/,
    ]],
    ["L4-048", [
      /inside one continuous physical game-world shop or contest aftermath/,
      /Quest log entirely non-human as one blank interface layer/,
      /cue declaring ownership or motive/,
    ]],
    ["L4-049", [
      /one continuous physical retirement meeting with exactly three ordinary identical keys/,
      /all keys visually indistinguishable and equally weighted/,
      /verdict about who succeeds the founder/,
    ]],
    ["L4-050", [
      /Mio and Ren outside the evacuated ship at one source-defined remote communication endpoint/,
      /Argo and Lumen only as two distinct pieces of onboard environmental hardware/,
      /revealing who “we” includes/,
    ]],
  ]);
  const remoteStageIds = new Set(["L4-042", "L4-044", "L4-050"]);
  const nonHumanStageIds = new Set(["L4-045", "L4-046", "L4-048", "L4-050"]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    assert.match(job.prompt, /Do not reproduce, transliterate, or spatially encode/, stageId);
    assert.match(job.prompt, /Do not attempt to literalize every dialogue line/, stageId);

    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }
    if (nonHumanStageIds.has(stageId)) {
      assert.match(job.prompt, /Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(audit.sourceCollisions, [], `${stageId} introduced a source collision`);

    const nonPromptChange = clone(stage);
    nonPromptChange.revision += 1000;
    nonPromptChange.illustration = {
      ...nonPromptChange.illustration,
      sha256: "e".repeat(64),
    };
    nonPromptChange.questions[0].options[0].text.en = "Synthetic non-prompt option change";
    assert.equal(computeStageSourceTextHash(nonPromptChange), sourceTextHash, stageId);
  }
});

test("L5-001 through L5-010 computed addenda preserve evidence, cast, and communication topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-5", "batch-001-010.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const requirements = new Map([
    ["L5-001", [/one continuous physical merger meeting/, /minute sheet, brand reference, organization label/, /which groups approved which terms/]],
    ["L5-002", [/one continuous physical university reunion introduction/, /name card, title, record, photograph/, /Saeki's motive, Yui's feelings, or their private history/]],
    ["L5-003", [/one continuous physical curry-tasting table/, /exactly one ordinary sample dish/, /visual verdict about the dish's reception/]],
    ["L5-004", [/one continuous physical former-station market and travel-report setting/, /removed track, drainage channel, and market lane as neutral co-present facts/, /whether service will return/]],
    ["L5-005", [/four separate remote community-vote chat endpoints/, /one person and at most one ordinary device per whole undivided panel view/, /assigning an original vote to a person/]],
    ["L5-006", [/separate source-defined game or audio-review endpoints/, /shared game world as one consistent neutral environment/, /what happens after replay is turned off/]],
    ["L5-007", [/two real users at two separate physical endpoints/, /Luna as exactly one consistent shared avatar/, /visible mapping between voice, hand motion, and either user/]],
    ["L5-008", [/one continuous physical HR mediation/, /Mirror only as one fixed non-human mediation interface/, /visually repaired meeting outcome/]],
    ["L5-009", [/one remote drifting-ship transmission origin/, /one receiving control or rescue endpoint/, /who inserted the present-time appeals/]],
    ["L5-010", [/one continuous present-day physical inquiry room/, /earlier meeting system non-human as one blank local playback or record interface/, /who was in the room at eight/]],
  ]);
  const remoteStageIds = new Set(["L5-005", "L5-006", "L5-007", "L5-009"]);
  const nonHumanStageIds = new Set(["L5-008", "L5-010"]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    assert.match(job.prompt, /Do not reproduce, transliterate, or spatially encode/, stageId);
    assert.doesNotMatch(job.prompt, /Do not attempt to literalize every dialogue line/, stageId);

    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }
    if (nonHumanStageIds.has(stageId)) {
      assert.match(job.prompt, /Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(audit.sourceCollisions, [], `${stageId} introduced a source collision`);

    const nonPromptChange = clone(stage);
    nonPromptChange.revision += 1000;
    nonPromptChange.illustration = {
      ...nonPromptChange.illustration,
      sha256: "e".repeat(64),
    };
    nonPromptChange.questions[0].options[0].text.en = "Synthetic non-prompt option change";
    assert.equal(computeStageSourceTextHash(nonPromptChange), sourceTextHash, stageId);
  }
});

test("L5-011 through L5-020 computed addenda preserve evidence, cast, and communication topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-5", "batch-011-020.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const requirements = new Map([
    ["L5-011", [/one continuous source-defined election-broadcast discussion setting/, /one blank headline surface and one equally weighted blank comparison table/, /civic willingness or headline fairness/]],
    ["L5-012", [/one continuous late-night radio-program review setting/, /five listener names into visible people/, /reconstructs the covert channel/]],
    ["L5-013", [/one continuous local device-review setting/, /Shizu present only as the same nonvisual recorded voicemail voice/, /cue deciding who changed the dates/]],
    ["L5-014", [/one continuous physical time-loop laboratory/, /exactly three neutral warning notes/, /chronology, motive, truth value, or correct action/]],
    ["L5-015", [/one continuous three-layer dream/, /reflection must remain visibly a reflection/, /identify who waits or what each translation omitted/]],
    ["L5-016", [/one continuous physical old-gate inquiry/, /exactly one ordinary crown and one ordinary seal/, /visual conclusion about what the ban targets/]],
    ["L5-017", [/one continuous physical castle bedside or adjoining greenhouse context/, /El unmistakably an ordinary human gardener/, /what sustained the sleep or caused the awakening/]],
    ["L5-018", [/one parliamentary-broadcast origin/, /one separate audio-control endpoint/, /arrows connecting the cue to the conclusion/]],
    ["L5-019", [/one continuous physical portrait-gallery inspection/, /old AR guide entirely non-human/, /which portrait remains unexplained/]],
    ["L5-020", [/one continuous physical AI cafeteria/, /Comet entirely non-human as fixed cafeteria hardware/, /reaction exaggeration, or a scoring diagram/]],
  ]);
  const remoteStageIds = new Set(["L5-018"]);
  const nonHumanStageIds = new Set(["L5-019", "L5-020"]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    assert.match(job.prompt, /Do not reproduce, transliterate, or spatially encode/, stageId);
    assert.match(job.prompt, /Do not attempt to literalize every dialogue line/, stageId);

    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }
    if (nonHumanStageIds.has(stageId)) {
      assert.match(job.prompt, /Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(audit.sourceCollisions, [], `${stageId} introduced a source collision`);

    const nonPromptChange = clone(stage);
    nonPromptChange.revision += 1000;
    nonPromptChange.illustration = {
      ...nonPromptChange.illustration,
      sha256: "e".repeat(64),
    };
    nonPromptChange.questions[0].options[0].text.en = "Synthetic non-prompt option change";
    assert.equal(computeStageSourceTextHash(nonPromptChange), sourceTextHash, stageId);
  }
});

test("L5-021 through L5-030 computed addenda preserve evidence, cast, and communication topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-5", "batch-021-030.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const requirements = new Map([
    ["L5-021", [/one continuous physical resignation and handover review/, /one neutral resignation letter and one equally weighted neutral handover sheet/, /where Aya will go/]],
    ["L5-022", [/one continuous physical submission-review meeting/, /direct-cause versus prevention diagram/, /completed correction that decides moral fault/]],
    ["L5-023", [/one continuous physical restaurant menu-review setting/, /at most one ordinary duck dish/, /how the dish was prepared/]],
    ["L5-024", [/one continuous physical tourist-street and map-review setting/, /exactly one neutral folded map/, /visual verdict about commercial steering/]],
    ["L5-025", [/one continuous physical moderation and archive review/, /one neutral rule page, one neutral screenshot, and one neutral history record/, /whether the rule existed yesterday/]],
    ["L5-026", [/one continuous source-defined game-world tower context/, /Quest system entirely non-human/, /who or what the quest voice is/]],
    ["L5-027", [/one continuous shared wedding-world rehearsal and exit-threshold context/, /at most two ordinary neutral ring items/, /whether the rehearsal was genuine/]],
    ["L5-028", [/one continuous physical home-AI audit/, /Lumen entirely non-human/, /whether Lumen remembers Akari/]],
    ["L5-029", [/one continuous physical colony vote review/, /Pollux entirely non-human/, /visual verdict about anyone's current intent/]],
    ["L5-030", [/one continuous physical evidence-review room/, /exactly one neutral photo, one neutral ticket, and one neutral receipt/, /itinerary combines multiple days/]],
  ]);
  const nonHumanStageIds = new Set(["L5-026", "L5-028", "L5-029"]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    assert.match(job.prompt, /Do not reproduce, transliterate, or spatially encode/, stageId);
    assert.match(job.prompt, /Do not attempt to literalize every dialogue line/, stageId);
    assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);

    if (nonHumanStageIds.has(stageId)) {
      assert.match(job.prompt, /Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(audit.sourceCollisions, [], `${stageId} introduced a source collision`);

    const nonPromptChange = clone(stage);
    nonPromptChange.revision += 1000;
    nonPromptChange.illustration = {
      ...nonPromptChange.illustration,
      sha256: "e".repeat(64),
    };
    nonPromptChange.questions[0].options[0].text.en = "Synthetic non-prompt option change";
    assert.equal(computeStageSourceTextHash(nonPromptChange), sourceTextHash, stageId);
  }
});

test("L5-031 through L5-040 computed addenda preserve evidence, cast, and communication topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-5", "batch-031-040.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const requirements = new Map([
    ["L5-031", [/Taiga only at a separate field-report endpoint/, /Nagisa and So together in one production control room/, /declares the host synthetic/]],
    ["L5-032", [/one continuous physical station environment/, /Station broadcast emitted only by fixed local public-address hardware/, /resolved safety outcome/]],
    ["L5-033", [/one continuous physical archive review/, /exactly one source document and one marginal index surface/, /reveal the inventor's name/]],
    ["L5-034", [/one continuous physical archive or library review/, /owner only as the nonvisual voice of unattributed diary entries/, /resolved author count/]],
    ["L5-035", [/one continuous local gameplay context/, /guide voice off-screen and the subtitle layer non-human/, /show no figure or silhouette behind it/]],
    ["L5-036", [/one continuous physical proposal meeting/, /all returned materials remain in the same room/, /completed next proposal/]],
    ["L5-037", [/four separate remote school group-work endpoints/, /one person and at most one ordinary device per undivided whole-panel view/, /resolved intent judgment/]],
    ["L5-038", [/one continuous physical restaurant table/, /exactly three equally weighted, unlabeled sauce dishes/, /conclusive taste profile/]],
    ["L5-039", [/one continuous physical lost-property counter/, /exactly one candidate black bag/, /cue resolving ownership/]],
    ["L5-040", [/one continuous physical time-loop test room/, /one ordinary cup, one audio recorder/, /tested\/untested boundary/]],
  ]);
  const remoteStageIds = new Set(["L5-031", "L5-037"]);
  const nonHumanStageIds = new Set(["L5-032", "L5-035"]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    assert.match(job.prompt, /Do not reproduce, transliterate, or spatially encode/, stageId);
    assert.match(job.prompt, /Do not attempt to literalize every dialogue line/, stageId);

    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }
    if (nonHumanStageIds.has(stageId)) {
      assert.match(job.prompt, /Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(audit.sourceCollisions, [], `${stageId} introduced a source collision`);

    const nonPromptChange = clone(stage);
    nonPromptChange.revision += 1000;
    nonPromptChange.illustration = {
      ...nonPromptChange.illustration,
      sha256: "e".repeat(64),
    };
    nonPromptChange.questions[0].options[0].text.en = "Synthetic non-prompt option change";
    assert.equal(computeStageSourceTextHash(nonPromptChange), sourceTextHash, stageId);
  }
});

test("L5-041 through L5-050 computed addenda preserve evidence, cast, and communication topology", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-5", "batch-041-050.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const requirements = new Map([
    ["L5-041", [/one continuous physical treaty-conference room/, /exactly three neutral treaty documents/, /whether the three records match, were altered, or missed a deadline/]],
    ["L5-042", [/one physical incident-audit room/, /Iris must remain a non-human monitoring AI/, /visual conclusion about completeness, cause, or intent/]],
    ["L5-043", [/one continuous closed-station inspection/, /unidentified coughing voice entirely off-screen/, /whether the cough is recorded, live, supernatural, or made by any named person/]],
    ["L5-044", [/separate physical endpoints connected only through the source-defined group chat/, /Mina entirely absent from every physical panel/, /surviving draft task or the restore-time cache path/]],
    ["L5-045", [/one continuous physical succession meeting/, /exactly three equally weighted blank departmental schedule documents/, /visual cue selecting one calendar as intended/]],
    ["L5-046", [/one continuous museum investigation/, /exactly two visually indistinguishable source-defined objects/, /give either plinth, object, or person privileged visual weight/]],
    ["L5-047", [/one continuous source-defined game-world landscape/, /quest system non-human and interface-only/, /identifies the correct action or cause/]],
    ["L5-048", [/one continuous physical news-studio panel/, /at most one neutral blank source note/, /visually certify or discredit independent confirmation/]],
    ["L5-049", [/one physical receiving archive/, /remote recorded captain across whole-panel transmission views/, /which message was sent first or last/]],
    ["L5-050", [/one local trainer workstation/, /single source-defined on-screen guide avatar/, /favoring foreknowledge over later layout editing/]],
  ]);
  const remoteStageIds = new Set(["L5-044", "L5-049"]);
  const nonHumanStageIds = new Set(["L5-042", "L5-043", "L5-044", "L5-047", "L5-050"]);
  const expectedSourceTextHashes = new Map([
    ["L5-041", "74fa619a746e9ec3db2a6449b6e37ec6bda3dc3a1e3d0a7ec2a474b4e4e5ecfd"],
    ["L5-042", "f650f751a3be545967644bbe1c575af31f0e3fe43b403bd190c2b1ec8167e6c4"],
    ["L5-043", "9770f4b0ea57bcf2dd1aa12ddc93c1653c90466d635a09f35cb84e00e3ce5bbc"],
    ["L5-044", "7663b8d0123bbebdecfb73de61fd0cff77151774217cda0d27c59d879e003ece"],
    ["L5-045", "2cd404dea4c3a48172930b2c2d1de8ee1732a6f2cfda30ca9391dd42a9edc6e3"],
    ["L5-046", "15d4884327eb849f193040b0419f4edacd5cd4c57898b41b3379e62d5aabf165"],
    ["L5-047", "efff339512488fa30cb832eb8448db2e6675d4f5129cc16e5232fb6fd0c9b9bb"],
    ["L5-048", "6f211499a0079ed850fdaee19eba691178111f0fda737dc2a05eb77e6b00483f"],
    ["L5-049", "7a14dbae3c8151cf406c8e7725f23ac25e96e6ab77408a47a632f66e8406c139"],
    ["L5-050", "d41e441f98c897eb7dd5699ac5e26ce6024238e079305c5c531c741d1641ab6f"],
  ]);

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(sourceTextHash, expectedSourceTextHashes.get(stageId), stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    assert.match(job.prompt, /Do not reproduce, transliterate, or spatially encode/, stageId);
    assert.match(job.prompt, /Do not attempt to literalize every dialogue line/, stageId);

    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }
    if (nonHumanStageIds.has(stageId)) {
      assert.match(job.prompt, /Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    assert.deepEqual(audit.sourceCollisions, [], `${stageId} introduced a source collision`);

    const nonPromptChange = clone(stage);
    nonPromptChange.revision += 1000;
    nonPromptChange.illustration = {
      ...nonPromptChange.illustration,
      sha256: "e".repeat(64),
    };
    nonPromptChange.questions[0].options[0].text.en = "Synthetic non-prompt option change";
    assert.equal(computeStageSourceTextHash(nonPromptChange), sourceTextHash, stageId);
  }
});

test("L4-021 through L4-030 addenda preserve local, dream, virtual, and remote topology without revealing answers", async () => {
  const styleContract = extractStyleContract(
    await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(TOOL_ROOT, "content", "level-4", "batch-021-030.json"), "utf8"),
  );
  const stages = new Map(payload.stages.map((stage) => [stage.id, stage]));
  const canonicalJobs = new Map(
    (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse)
      .map((job) => [job.stageId, job]),
  );
  const requirements = new Map([
    ["L4-021", [
      /Aya and Soma together at the same empty station/,
      /station announcement only through fixed station loudspeaker hardware/,
      /Clocks and terminals contain no readable digits/,
      /Do not place Aya or Soma on the morning platform/,
      /source-defined AI, system, log, or disembodied voice an ordinary human body/,
    ]],
    ["L4-022", [
      /Dreamer as a clearly separate foreground observer or back view inside one dream/,
      /Child, Student, and Adult as three age-coded dream figures/,
      /at most one subtle hand-scar glimpse/,
      /Do not show three aligned hands or faces/,
    ]],
    ["L4-023", [
      /Tomoya, Rina, Kei, and Tsumugi physically together in the same classroom/,
      /phones are local message-writing props.*not four remote endpoints/,
      /every phone screen and Rina's note completely blank/,
      /remembered-versus-unaware character map/,
    ]],
    ["L4-024", [
      /Yu, Mira, and Fen together in one continuous fantasy-village discussion/,
      /quest evaluator entirely non-human and unreadable/,
      /Never display points, score changes, stars/,
      /Do not show the north gate, eastern cellar, medicine, timer/,
    ]],
    ["L4-025", [
      /Aoi, Jun, Miki, and Taro physically together as reviewers.*printer's proofing room/,
      /misprinted comic remains only one ordinary blank proof folder/,
      /Keep the umbrella, hat, cake receipt, noodles, water pitcher, and phone nonvisual/,
      /Do not show bubble placement, printed words, color coding/,
    ]],
    ["L4-026", [
      /Shiraishi, Takeda, Kido, and Wataru physically together in one current deal meeting/,
      /one completely blank pricing sheet and one completely blank meeting memo/,
      /Do not show signing, approval, handshake, unanimous vote/,
    ]],
    ["L4-027", [
      /Kanade, Haru, Yui, and Adviser Nishi together/,
      /Haru is an ordinary human candidate/,
      /Do not add voters, a ballot box, vote count/,
      /visual chain that fixes her motive or redirects visible votes/,
    ]],
    ["L4-028", [
      /exactly three seated family members, one staff member, one complete empty fourth place setting/,
      /Incoming messages exist only on one blank phone.*not as a remote endpoint/,
      /late older brother remains off-panel/,
      /Do not show readable clock digits, read receipts, train or route imagery/,
    ]],
    ["L4-029", [
      /Sumi as the only physical human/,
      /three equally weighted non-human bot identities inside the same single abstract unreadable chat interface/,
      /exactly three equal abstract bot markers with no names or color mapping/,
      /Do not render the typo, punctuation, timestamps/,
      /Do not show one hidden human controlling all three/,
    ]],
    ["L4-030", [
      /Minase alone in the live broadcast studio.*three distinct phone-call endpoints/,
      /exactly one whole undivided panel per endpoint/,
      /Do not show a three-item checklist, repeated ordering pattern/,
      /Do not depict a director feeding answers, synchronized reading/,
    ]],
  ]);
  const remoteStageIds = new Set(["L4-030"]);
  const expectedL4025NameCollisions = [
    ["ja", "葵", false],
    ["en", "Aoi", false],
    ["ja", "淳", true],
    ["en", "Jun", true],
    ["ja", "美紀", false],
    ["en", "Miki", false],
    ["ja", "太郎", false],
    ["en", "Taro", false],
  ];

  for (const [stageId, rules] of requirements) {
    const stage = stages.get(stageId);
    assert.ok(stage, `missing canonical stage ${stageId}`);
    const sourceTextHash = computeStageSourceTextHash(stage);
    const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
    for (const rule of rules) assert.match(job.prompt, rule, stageId);
    assert.equal(job.sourceTextHash, sourceTextHash, stageId);
    if (remoteStageIds.has(stageId)) {
      assert.match(job.prompt, /Remote-layout hard rule:/, stageId);
    } else {
      assert.doesNotMatch(job.prompt, /Remote-layout hard rule:/, stageId);
    }

    const audit = image2PromptTools.classifyPromptQuestionText(stage, job.prompt);
    assert.deepEqual(audit.leaks, [], `${stageId} inserted a true option or explanation leak`);
    if (stageId === "L4-025") {
      assert.equal(audit.sourceCollisions.length, expectedL4025NameCollisions.length);
      for (const [language, value, isCorrect] of expectedL4025NameCollisions) {
        assert.ok(
          audit.sourceCollisions.some(
            (entry) => entry.kind === "option"
              && entry.language === language
              && entry.value === value
              && entry.isCorrect === isCorrect,
          ),
          `L4-025 missing expected ${language} source collision ${value}`,
        );
      }
    } else {
      assert.deepEqual(audit.sourceCollisions, [], `${stageId} should have no canonical collision`);
    }

  }
});

test("L2-013 keeps the salt container incidental and forbids invented service props", () => {
  const styleContract = [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ].join("\n");
  const stage = stageFixture();
  stage.id = "L2-013";
  const sourceTextHash = computeStageSourceTextHash(stage);
  const job = buildStageImageJob(stage, styleContract, "c".repeat(64));

  for (const rule of [
    /only salt container.*very small.*unlabeled ordinary container.*preparation counter background/i,
    /no other seasoning bottle, jar, shaker, dispenser, or grouped condiment/i,
    /No person may look at, turn toward, point at, reach for, or touch the salt container/i,
    /no close-up, highlight, spotlight, outline, framing line, or compositional leading line/i,
    /all three people facing one another.*restrained tasting conversation.*all four panels/i,
    /Only the source-defined soup bowls, tasting table, preparation counter, and salt container/i,
    /no clipboard, notebook, menu, score sheet, rating form, or other invented service prop/i,
  ]) {
    assert.match(job.prompt, rule);
  }
  assert.equal(job.sourceTextHash, sourceTextHash);
});

test("shared high-risk image2 constraints are stage-scoped, deduplicated, and source-preserving", () => {
  const styleContract = [
    "exactly four 2-by-2 panels",
    "Black, white, and neutral grayscale only",
    "rich ink, shading, and screentone rather than sparse line art",
  ].join("\n");
  const groups = [
    {
      ids: [
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
        "L4-032", "L4-034", "L4-037", "L4-038", "L4-039", "L4-040",
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
      ],
      rule: /Do not reproduce, transliterate, or spatially encode/,
    },
    {
      ids: [
        "L2-017", "L2-018", "L2-024", "L2-036", "L2-049",
        "L3-008", "L3-024", "L3-026", "L3-029", "L3-037", "L3-038",
        "L3-046", "L3-050",
        "L4-009", "L4-010", "L4-020", "L4-021", "L4-024", "L4-029", "L4-032",
        "L4-034", "L4-037", "L4-040", "L4-045", "L4-046", "L4-048", "L4-050",
        "L5-008", "L5-010", "L5-019", "L5-020", "L5-026", "L5-028", "L5-029", "L5-042",
        "L5-043", "L5-044", "L5-047", "L5-050",
      ],
      rule: /Do not give the source-defined AI, system, log, or disembodied voice an ordinary human body/,
    },
    {
      ids: [
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
      ],
      rule: /Do not attempt to literalize every dialogue line or every evidence item/,
    },
  ];

  for (const { ids, rule } of groups) {
    for (const stageId of ids) {
      const stage = stageFixture();
      stage.id = stageId;
      const before = computeStageSourceTextHash(stage);
      const job = buildStageImageJob(stage, styleContract, "c".repeat(64));
      assert.match(job.prompt, rule, stageId);
      assert.equal(job.prompt.match(new RegExp(rule.source, "g"))?.length, 1, stageId);
      assert.equal(job.sourceTextHash, before, stageId);
    }
  }

  const ordinary = buildStageImageJob(stageFixture(), styleContract, "c".repeat(64));
  assert.doesNotMatch(ordinary.prompt, /Do not reproduce, transliterate, or spatially encode/);
  assert.doesNotMatch(ordinary.prompt, /Do not give the source-defined AI/);
  assert.doesNotMatch(ordinary.prompt, /Do not attempt to literalize every dialogue line/);
});

test("checked-in image2 jobs are regenerated with the v4 source text contract", async () => {
  const jobs = (await readFile(path.join(TOOL_ROOT, "image2", "prompts.jsonl"), "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  const levelOne = JSON.parse(
    await readFile(
      path.join(TOOL_ROOT, "content", "level-1", "batch-001-010.json"),
      "utf8",
    ),
  );
  const firstStage = levelOne.stages[0];

  assert.equal(jobs.length, 250);
  assert.equal(jobs[0].stageId, firstStage.id);
  assert.equal(
    jobs[0].sourceTextHash,
    computeStageSourceTextHash(firstStage),
  );
  for (const job of jobs) {
    assert.match(job.sourceTextHash, /^[a-f0-9]{64}$/);
    assert.equal(
      job.sourceTextHashSchemaVersion,
      SOURCE_TEXT_HASH_SCHEMA_VERSION,
    );
    assert.equal(
      job.generatorProvenance.promptSchemaVersion,
      "japanese-subtext-image2-prompt-v4",
    );
    assert.equal("sourceContentHash" in job, false);
  }
});
