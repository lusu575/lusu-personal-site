import test from "node:test";
import assert from "node:assert/strict";

import {
  JapaneseSubtextAgentEvaluationError,
  canonicalJapaneseSubtextAgentPayload,
  evaluateJapaneseSubtextAgentAttempt,
  normalizeJapaneseSubtextAgentOperationId,
  parseJapaneseSubtextAgentAttempt
} from "../functions/api/japanese-subtext-agent-evaluator.mjs";

const CONTENT_HASH = "a".repeat(64);

function makeStage() {
  return {
    id: "L2-006",
    revision: 3,
    contentHash: CONTENT_HASH,
    questions: [
      {
        id: "q1",
        type: "single",
        options: [{ id: "a" }, { id: "b" }, { id: "c" }],
        correctOptionIds: ["a"]
      },
      {
        id: "q2",
        type: "multiple",
        options: [{ id: "a" }, { id: "b" }, { id: "c" }],
        correctOptionIds: ["a", "c"]
      }
    ]
  };
}

function makePayload(overrides = {}) {
  return {
    stageId: "L2-006",
    stageRevision: 3,
    contentHash: CONTENT_HASH,
    answers: [
      { questionId: "q2", optionIds: ["c", "a"] },
      { questionId: "q1", optionIds: ["a"] }
    ],
    expectedRevision: 7,
    operationId: "agent_attempt_0001",
    ...overrides
  };
}

function expectEvaluationError(callback, code, status) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof JapaneseSubtextAgentEvaluationError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test("strict parser normalizes operation, question order, and option order", () => {
  const parsed = parseJapaneseSubtextAgentAttempt(
    makePayload({ operationId: "  agent_attempt_0001  " }),
    makeStage()
  );

  assert.deepEqual(parsed, {
    stageId: "L2-006",
    stageRevision: 3,
    contentHash: CONTENT_HASH,
    answers: [
      { questionId: "q1", optionIds: ["a"] },
      { questionId: "q2", optionIds: ["a", "c"] }
    ],
    expectedRevision: 7,
    operationId: "agent_attempt_0001"
  });
});

test("canonical idempotency payload excludes operationId and is order independent", () => {
  const stage = makeStage();
  const first = parseJapaneseSubtextAgentAttempt(makePayload(), stage);
  const second = parseJapaneseSubtextAgentAttempt(makePayload({
    operationId: "agent_attempt_9999",
    answers: [
      { questionId: "q1", optionIds: ["a"] },
      { questionId: "q2", optionIds: ["a", "c"] }
    ]
  }), stage);

  const firstCanonical = canonicalJapaneseSubtextAgentPayload(first);
  const secondCanonical = canonicalJapaneseSubtextAgentPayload(second);
  assert.deepEqual(firstCanonical, secondCanonical);
  assert.deepEqual(Object.keys(firstCanonical), [
    "stageId",
    "stageRevision",
    "contentHash",
    "answers",
    "expectedRevision"
  ]);
});

test("all exact answer sets clear with the fixed Agent bilingual result and bronze cap", () => {
  assert.deepEqual(evaluateJapaneseSubtextAgentAttempt(makePayload(), makeStage()), {
    score: 100,
    cleared: true,
    medal: "bronze",
    attemptMode: "bilingual",
    usedTranslation: true,
    usedKana: true,
    usedListeningMode: false,
    replayCount: 0,
    hintCount: 0
  });
});

test("partial and superset selections do not count as exact matches", () => {
  const partial = evaluateJapaneseSubtextAgentAttempt(makePayload({
    answers: [
      { questionId: "q1", optionIds: ["a"] },
      { questionId: "q2", optionIds: ["a"] }
    ]
  }), makeStage());
  const superset = evaluateJapaneseSubtextAgentAttempt(makePayload({
    answers: [
      { questionId: "q1", optionIds: ["a"] },
      { questionId: "q2", optionIds: ["a", "b", "c"] }
    ]
  }), makeStage());

  assert.deepEqual(partial, {
    score: 50,
    cleared: false,
    medal: "none",
    attemptMode: "bilingual",
    usedTranslation: true,
    usedKana: true,
    usedListeningMode: false,
    replayCount: 0,
    hintCount: 0
  });
  assert.equal(superset.score, 50);
  assert.equal(superset.cleared, false);
  assert.equal(superset.medal, "none");
});

test("payload must be a plain object with exactly the six supported fields", () => {
  const stage = makeStage();
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt(null, stage),
    "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    400
  );
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt([], stage),
    "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    400
  );

  const missing = makePayload();
  delete missing.expectedRevision;
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt(missing, stage),
    "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    400
  );
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt({ ...makePayload(), localDate: "2026-08-06" }, stage),
    "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    400
  );
});

test("answer objects reject extra fields, duplicate questions, missing questions, and unknown questions", () => {
  const stage = makeStage();
  const invalidAnswers = [
    [
      { questionId: "q1", optionIds: ["a"], correct: true },
      { questionId: "q2", optionIds: ["a", "c"] }
    ],
    [
      { questionId: "q1", optionIds: ["a"] },
      { questionId: "q1", optionIds: ["a"] }
    ],
    [{ questionId: "q1", optionIds: ["a"] }],
    [
      { questionId: "q1", optionIds: ["a"] },
      { questionId: "q9", optionIds: ["a"] }
    ]
  ];

  invalidAnswers.forEach((answers) => {
    expectEvaluationError(
      () => parseJapaneseSubtextAgentAttempt(makePayload({ answers }), stage),
      "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
      400
    );
  });
});

test("answers reject empty, duplicate, unknown, and invalid single-choice option selections", () => {
  const stage = makeStage();
  const invalidAnswers = [
    [
      { questionId: "q1", optionIds: [] },
      { questionId: "q2", optionIds: ["a", "c"] }
    ],
    [
      { questionId: "q1", optionIds: ["a"] },
      { questionId: "q2", optionIds: ["a", "a"] }
    ],
    [
      { questionId: "q1", optionIds: ["a"] },
      { questionId: "q2", optionIds: ["z"] }
    ],
    [
      { questionId: "q1", optionIds: ["a", "b"] },
      { questionId: "q2", optionIds: ["a", "c"] }
    ]
  ];

  invalidAnswers.forEach((answers) => {
    expectEvaluationError(
      () => parseJapaneseSubtextAgentAttempt(makePayload({ answers }), stage),
      "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
      400
    );
  });
});

test("question and option collection lengths are bounded", () => {
  const tooManyAnswers = Array.from({ length: 21 }, (_, index) => ({
    questionId: `q${index + 1}`,
    optionIds: ["a"]
  }));
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt(makePayload({ answers: tooManyAnswers }), makeStage()),
    "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    400
  );

  const tooManyOptions = Array.from({ length: 11 }, (_, index) => ({ id: `o${index + 1}` }));
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt(makePayload(), {
      ...makeStage(),
      questions: [{
        id: "q1",
        type: "multiple",
        options: tooManyOptions,
        correctOptionIds: ["o1"]
      }]
    }),
    "JAPANESE_SUBTEXT_AGENT_STAGE_INVALID",
    500
  );
});

test("sparse collections and non-string server IDs fail closed", () => {
  const sparseAnswers = makePayload().answers.slice();
  delete sparseAnswers[0];
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt(makePayload({ answers: sparseAnswers }), makeStage()),
    "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    400
  );

  const sparseOptionIds = ["a", "c"];
  delete sparseOptionIds[0];
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt(makePayload({
      answers: [
        { questionId: "q1", optionIds: ["a"] },
        { questionId: "q2", optionIds: sparseOptionIds }
      ]
    }), makeStage()),
    "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    400
  );

  const numericQuestionIdStage = makeStage();
  numericQuestionIdStage.questions[0].id = 1;
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt(makePayload(), numericQuestionIdStage),
    "JAPANESE_SUBTEXT_AGENT_STAGE_INVALID",
    500
  );

  const numericOptionIdStage = makeStage();
  numericOptionIdStage.questions[0].options[0].id = 1;
  expectEvaluationError(
    () => parseJapaneseSubtextAgentAttempt(makePayload(), numericOptionIdStage),
    "JAPANESE_SUBTEXT_AGENT_STAGE_INVALID",
    500
  );
});

test("stage identity, revision, and hash conflicts use stable 409 errors", () => {
  const stage = makeStage();
  const conflicts = [
    [
      makePayload({ stageId: "L2-007" }),
      "JAPANESE_SUBTEXT_AGENT_STAGE_MISMATCH"
    ],
    [
      makePayload({ stageRevision: 2 }),
      "JAPANESE_SUBTEXT_AGENT_STAGE_REVISION_MISMATCH"
    ],
    [
      makePayload({ contentHash: "b".repeat(64) }),
      "JAPANESE_SUBTEXT_AGENT_CONTENT_HASH_MISMATCH"
    ]
  ];

  conflicts.forEach(([payload, code]) => {
    expectEvaluationError(
      () => parseJapaneseSubtextAgentAttempt(payload, stage),
      code,
      409
    );
  });
});

test("stage IDs and hashes must use their canonical forms", () => {
  const stage = makeStage();
  const invalidPayloads = [
    makePayload({ stageId: "l2-006" }),
    makePayload({ stageId: "L2-051" }),
    makePayload({ contentHash: CONTENT_HASH.toUpperCase() }),
    makePayload({ contentHash: "a".repeat(63) })
  ];

  invalidPayloads.forEach((payload) => {
    expectEvaluationError(
      () => parseJapaneseSubtextAgentAttempt(payload, stage),
      "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
      400
    );
  });
});

test("stageRevision and expectedRevision accept only integers from 1 through 1,000,000", () => {
  const invalidPayloads = [
    makePayload({ stageRevision: 0 }),
    makePayload({ stageRevision: 1.5 }),
    makePayload({ expectedRevision: 0 }),
    makePayload({ expectedRevision: 1_000_001 })
  ];

  invalidPayloads.forEach((payload) => {
    expectEvaluationError(
      () => parseJapaneseSubtextAgentAttempt(payload, makeStage()),
      "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
      400
    );
  });
});

test("operationId normalization permits only bounded safe ASCII IDs", () => {
  assert.equal(normalizeJapaneseSubtextAgentOperationId("  abcdefgh  "), "abcdefgh");

  ["short", "a".repeat(81), "unsafe value", "操作编号0001", null].forEach((operationId) => {
    expectEvaluationError(
      () => normalizeJapaneseSubtextAgentOperationId(operationId),
      "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
      400
    );
  });
});

test("malformed server-loaded stages fail closed with a stable 500 error", () => {
  const invalidStages = [
    { ...makeStage(), revision: 0 },
    { ...makeStage(), contentHash: CONTENT_HASH.toUpperCase() },
    {
      ...makeStage(),
      questions: [makeStage().questions[0], makeStage().questions[0]]
    },
    {
      ...makeStage(),
      questions: [{
        ...makeStage().questions[0],
        options: [{ id: "a" }, { id: "a" }]
      }]
    },
    {
      ...makeStage(),
      questions: [{
        ...makeStage().questions[0],
        correctOptionIds: ["z"]
      }]
    }
  ];

  invalidStages.forEach((stage) => {
    expectEvaluationError(
      () => parseJapaneseSubtextAgentAttempt(makePayload(), stage),
      "JAPANESE_SUBTEXT_AGENT_STAGE_INVALID",
      500
    );
  });
});
