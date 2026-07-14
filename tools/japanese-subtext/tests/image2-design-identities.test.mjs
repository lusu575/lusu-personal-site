import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  DESIGN_IDENTITY_REGISTRY_SCHEMA_VERSION,
  DESIGN_SEED_NAMESPACE,
  PROMPT_SCHEMA_VERSION,
  auditDesignIdentityRegistry,
  buildStageImageJob,
  computeDesignSeed,
  computeStageSourceTextHash,
  extractStyleContract,
  resolveDesignIdentity,
  stageSourceTextProjection,
} from "../scripts/prepare-image2-prompts.mjs";
import { loadAllStages } from "../scripts/content-utils.mjs";

const stages = await loadAllStages();
const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
const styleBible = await readFile(
  new URL("../image2/style-bible.md", import.meta.url),
  "utf8",
);
const styleContract = extractStyleContract(styleBible);
const styleBibleHash = createHash("sha256")
  .update(styleBible, "utf8")
  .digest("hex");
const registryText = await readFile(
  new URL("../image2/design-identities.json", import.meta.url),
  "utf8",
);
const registry = JSON.parse(registryText);

function cast(stageId, castId) {
  return stagesById.get(stageId)?.cast.find((member) => member.id === castId);
}

function job(stageId) {
  return buildStageImageJob(stagesById.get(stageId), styleContract, styleBibleHash);
}

test("design identity registry is explicit, source-backed, and exhaustively resolved", () => {
  assert.equal(registry.schemaVersion, DESIGN_IDENTITY_REGISTRY_SCHEMA_VERSION);
  assert.equal(registry.seedNamespace, DESIGN_SEED_NAMESPACE);
  assert.equal(
    registry.defaultIdentityPattern,
    "stage:<lowercase-stage-id>:cast:<cast-id>",
  );
  assert.deepEqual(
    registry.aliases.map(({ designIdentity, kind, members }) => ({
      designIdentity,
      kind,
      members: members.map(({ stageId, castId, expectedName, variant }) => ({
        stageId,
        castId,
        expectedName,
        variant,
      })),
    })),
    [
      {
        designIdentity: "person:l4-hori",
        kind: "same-character",
        members: [
          {
            stageId: "L4-008",
            castId: "manager",
            expectedName: { ja: "責任者・堀", en: "Hori, manager" },
            variant: "manager",
          },
          {
            stageId: "L4-014",
            castId: "manager",
            expectedName: { ja: "営業部長・堀", en: "Hori, sales manager" },
            variant: "sales-manager",
          },
        ],
      },
      {
        designIdentity: "appearance:l3-036-yui",
        kind: "shared-appearance",
        members: [
          {
            stageId: "L3-036",
            castId: "yui",
            expectedName: { ja: "ユイ", en: "Yui" },
            variant: "human",
          },
          {
            stageId: "L3-036",
            castId: "avatar",
            expectedName: { ja: "予測アバター", en: "Predictive Avatar" },
            variant: "predictive-avatar",
          },
        ],
      },
    ],
  );

  assert.deepEqual(auditDesignIdentityRegistry(stages), {
    castRefCount: 780,
    designIdentityCount: 778,
    designSeedCount: 778,
    sharedIdentityCount: 2,
  });
});

test("Hori keeps one core identity across role variants", () => {
  const first = resolveDesignIdentity("L4-008", cast("L4-008", "manager"));
  const second = resolveDesignIdentity("L4-014", cast("L4-014", "manager"));
  assert.equal(first.designIdentity, "person:l4-hori");
  assert.equal(second.designIdentity, first.designIdentity);
  assert.equal(first.kind, "same-character");
  assert.equal(second.kind, first.kind);
  assert.notEqual(first.variant, second.variant);
  assert.equal(computeDesignSeed(first.designIdentity).length, 16);
  assert.equal(
    computeDesignSeed(first.designIdentity),
    computeDesignSeed(second.designIdentity),
  );

  const firstCard = job("L4-008").castDesigns.find(
    (design) => design.castId === "manager",
  );
  const secondCard = job("L4-014").castDesigns.find(
    (design) => design.castId === "manager",
  );
  assert.equal(firstCard.designSeed, secondCard.designSeed);
  assert.equal(firstCard.designIdentity, secondCard.designIdentity);
  assert.notEqual(firstCard.variant, secondCard.variant);
});

test("Yui and the predictive avatar share core appearance but retain distinct variants", () => {
  const cards = job("L3-036").castDesigns;
  const yui = cards.find((design) => design.castId === "yui");
  const avatar = cards.find((design) => design.castId === "avatar");
  assert.equal(yui.designIdentity, "appearance:l3-036-yui");
  assert.equal(avatar.designIdentity, yui.designIdentity);
  assert.equal(yui.kind, "shared-appearance");
  assert.equal(avatar.kind, yui.kind);
  assert.equal(yui.designSeed, avatar.designSeed);
  assert.equal(yui.variant, "human");
  assert.equal(avatar.variant, "predictive-avatar");
  assert.equal(
    yui.description.split(". Preserve these grayscale traits")[0],
    avatar.description.split(". Preserve these grayscale traits")[0],
  );
  assert.notEqual(yui.description, avatar.description);
});

test("L5-043 keeps the unidentified cough as an independent nonvisual source identity", () => {
  const member = cast("L5-043", "cough");
  assert.deepEqual(member?.name, {
    ja: "咳をした声",
    zh: "咳嗽声",
    en: "unidentified coughing voice",
  });
  const identity = resolveDesignIdentity("L5-043", member);
  assert.deepEqual(identity, {
    castRef: "L5-043/cough",
    stageId: "L5-043",
    castId: "cough",
    designIdentity: "stage:l5-043:cast:cough",
    kind: "independent",
    variant: "source-defined",
  });
  assert.equal(computeDesignSeed(identity.designIdentity), "ca14fd258f5b60c9");
  assert.equal(job("L5-043").castDesigns.find((design) => design.castId === "cough")?.designSeed,
    "ca14fd258f5b60c9");
});

test("generic cast ids remain independent across unrelated vignettes", () => {
  for (const castId of ["ai", "clerk", "engineer", "system"]) {
    const refs = stages.flatMap((stage) => stage.cast
      .filter((member) => member.id === castId)
      .map((member) => resolveDesignIdentity(stage.id, member)));
    assert.ok(refs.length > 1, `${castId} has multiple source refs`);
    assert.equal(
      new Set(refs.map((identity) => identity.designIdentity)).size,
      refs.length,
      `${castId} does not share an identity across unrelated stages`,
    );
    assert.equal(
      new Set(refs.map((identity) => computeDesignSeed(identity.designIdentity))).size,
      refs.length,
      `${castId} does not share a seed across unrelated stages`,
    );
  }
});

test("design alias metadata changes prompt identity without entering sourceTextHash", () => {
  const stage = stagesById.get("L4-008");
  const imageJob = job("L4-008");
  const card = imageJob.castDesigns.find((design) => design.castId === "manager");
  const projection = stageSourceTextProjection(stage);
  const sourceTextHash = computeStageSourceTextHash(stage);

  assert.equal(imageJob.generatorProvenance.promptSchemaVersion, PROMPT_SCHEMA_VERSION);
  assert.equal(imageJob.sourceTextHash, sourceTextHash);
  assert.doesNotMatch(JSON.stringify(projection), /designIdentity|designSeed|variant/u);
  assert.match(imageJob.prompt, /design identity: person:l4-hori/);
  assert.match(imageJob.prompt, new RegExp(card.designSeed));

  const hypotheticalIdentity = "person:l4-hori-revised";
  const hypotheticalPrompt = imageJob.prompt
    .replaceAll(card.designIdentity, hypotheticalIdentity)
    .replaceAll(card.designSeed, computeDesignSeed(hypotheticalIdentity));
  const hypotheticalPromptHash = createHash("sha256")
    .update(hypotheticalPrompt, "utf8")
    .digest("hex");
  assert.notEqual(hypotheticalPromptHash, imageJob.promptHash);
  assert.equal(computeStageSourceTextHash(stage), sourceTextHash);
});
