const TOP_LEVEL_KEYS = Object.freeze([
  "stageId",
  "stageRevision",
  "contentHash",
  "answers",
  "expectedRevision",
  "operationId"
]);
const ANSWER_KEYS = Object.freeze(["questionId", "optionIds"]);

const MAX_REVISION = 1_000_000;
const MAX_QUESTIONS = 20;
const MAX_OPTIONS_PER_QUESTION = 10;
const STAGE_ID_PATTERN = /^L[1-5]-(?:00[1-9]|0[1-4][0-9]|050)$/;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;

export class JapaneseSubtextAgentEvaluationError extends Error {
  constructor(message, {
    code = "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    status = 400,
    details = null
  } = {}) {
    super(message);
    this.name = "JapaneseSubtextAgentEvaluationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function normalizeJapaneseSubtextAgentOperationId(value) {
  if (typeof value !== "string") {
    throw inputError("operationId must be a string.", { field: "operationId" });
  }

  const normalized = value.trim();
  if (!OPERATION_ID_PATTERN.test(normalized)) {
    throw inputError(
      "operationId must contain 8 to 80 safe ASCII identifier characters.",
      { field: "operationId" }
    );
  }

  return normalized;
}

/**
 * Strictly validates and normalizes an Agent answer payload against one
 * server-loaded, locked Japanese Subtext stage.
 */
export function parseJapaneseSubtextAgentAttempt(payload, stage) {
  const normalizedStage = normalizeStage(stage);
  return parseAgainstStage(payload, normalizedStage);
}

/**
 * Produces the semantic payload used for an idempotency hash. operationId is
 * deliberately excluded because it is the idempotency lookup key itself.
 * Call parseJapaneseSubtextAgentAttempt first when a stage is available.
 */
export function canonicalJapaneseSubtextAgentPayload(parsed) {
  assertPlainRecord(parsed, "The parsed Agent attempt must be an object.");
  assertExactKeys(parsed, TOP_LEVEL_KEYS, "The parsed Agent attempt");

  validateStageId(parsed.stageId, "stageId");
  validateRevision(parsed.stageRevision, "stageRevision");
  validateContentHash(parsed.contentHash, "contentHash");
  validateRevision(parsed.expectedRevision, "expectedRevision");
  normalizeJapaneseSubtextAgentOperationId(parsed.operationId);

  if (!Array.isArray(parsed.answers)
    || !hasDenseEntries(parsed.answers)
    || parsed.answers.length < 1
    || parsed.answers.length > MAX_QUESTIONS) {
    throw inputError(`answers must contain 1 to ${MAX_QUESTIONS} questions.`, { field: "answers" });
  }

  const seenQuestionIds = new Set();
  const answers = parsed.answers.map((answer, answerIndex) => {
    assertPlainRecord(answer, `answers[${answerIndex}] must be an object.`);
    assertExactKeys(answer, ANSWER_KEYS, `answers[${answerIndex}]`);
    validateItemId(answer.questionId, `answers[${answerIndex}].questionId`);

    if (seenQuestionIds.has(answer.questionId)) {
      throw inputError("answers contains a duplicate questionId.", {
        field: `answers[${answerIndex}].questionId`,
        questionId: answer.questionId
      });
    }
    seenQuestionIds.add(answer.questionId);

    if (!Array.isArray(answer.optionIds)
      || !hasDenseEntries(answer.optionIds)
      || answer.optionIds.length < 1
      || answer.optionIds.length > MAX_OPTIONS_PER_QUESTION) {
      throw inputError(
        `answers[${answerIndex}].optionIds must contain 1 to ${MAX_OPTIONS_PER_QUESTION} options.`,
        { field: `answers[${answerIndex}].optionIds` }
      );
    }

    const seenOptionIds = new Set();
    const optionIds = answer.optionIds.map((optionId, optionIndex) => {
      validateItemId(optionId, `answers[${answerIndex}].optionIds[${optionIndex}]`);
      if (seenOptionIds.has(optionId)) {
        throw inputError("An answer contains a duplicate optionId.", {
          field: `answers[${answerIndex}].optionIds[${optionIndex}]`,
          questionId: answer.questionId,
          optionId
        });
      }
      seenOptionIds.add(optionId);
      return optionId;
    });

    return {
      questionId: answer.questionId,
      optionIds: optionIds.sort(compareAscii)
    };
  });

  answers.sort((left, right) => compareAscii(left.questionId, right.questionId));

  return {
    stageId: parsed.stageId,
    stageRevision: parsed.stageRevision,
    contentHash: parsed.contentHash,
    answers,
    expectedRevision: parsed.expectedRevision
  };
}

export function evaluateJapaneseSubtextAgentAttempt(payload, stage) {
  const normalizedStage = normalizeStage(stage);
  const parsed = parseAgainstStage(payload, normalizedStage);
  let correctCount = 0;

  normalizedStage.questions.forEach((question, questionIndex) => {
    const selected = parsed.answers[questionIndex].optionIds;
    if (selected.length === question.correctOptionIds.length
      && question.correctOptionIds.every((optionId) => selected.includes(optionId))) {
      correctCount += 1;
    }
  });

  const score = Math.round((correctCount / normalizedStage.questions.length) * 100);
  const cleared = correctCount === normalizedStage.questions.length;

  return {
    score,
    cleared,
    medal: cleared ? "bronze" : "none",
    attemptMode: "bilingual",
    usedTranslation: true,
    usedKana: true,
    usedListeningMode: false,
    replayCount: 0,
    hintCount: 0
  };
}

function parseAgainstStage(payload, stage) {
  assertPlainRecord(payload, "The Agent attempt payload must be an object.");
  assertExactKeys(payload, TOP_LEVEL_KEYS, "The Agent attempt payload");

  validateStageId(payload.stageId, "stageId");
  validateRevision(payload.stageRevision, "stageRevision");
  validateContentHash(payload.contentHash, "contentHash");
  validateRevision(payload.expectedRevision, "expectedRevision");
  const operationId = normalizeJapaneseSubtextAgentOperationId(payload.operationId);

  if (payload.stageId !== stage.id) {
    throw conflictError(
      "JAPANESE_SUBTEXT_AGENT_STAGE_MISMATCH",
      "stageId does not match the server-loaded stage.",
      { field: "stageId", expected: stage.id }
    );
  }
  if (payload.stageRevision !== stage.revision) {
    throw conflictError(
      "JAPANESE_SUBTEXT_AGENT_STAGE_REVISION_MISMATCH",
      "stageRevision is stale or does not match the server-loaded stage.",
      { field: "stageRevision", expected: stage.revision }
    );
  }
  if (payload.contentHash !== stage.contentHash) {
    throw conflictError(
      "JAPANESE_SUBTEXT_AGENT_CONTENT_HASH_MISMATCH",
      "contentHash is stale or does not match the server-loaded stage.",
      { field: "contentHash", expected: stage.contentHash }
    );
  }

  if (!Array.isArray(payload.answers)
    || !hasDenseEntries(payload.answers)
    || payload.answers.length < 1
    || payload.answers.length > MAX_QUESTIONS) {
    throw inputError(`answers must contain 1 to ${MAX_QUESTIONS} questions.`, { field: "answers" });
  }
  if (payload.answers.length !== stage.questions.length) {
    throw inputError("answers must contain exactly one answer for every stage question.", {
      field: "answers",
      expectedCount: stage.questions.length
    });
  }

  const answersByQuestionId = new Map();
  payload.answers.forEach((answer, answerIndex) => {
    assertPlainRecord(answer, `answers[${answerIndex}] must be an object.`);
    assertExactKeys(answer, ANSWER_KEYS, `answers[${answerIndex}]`);
    validateItemId(answer.questionId, `answers[${answerIndex}].questionId`);

    if (answersByQuestionId.has(answer.questionId)) {
      throw inputError("answers contains a duplicate questionId.", {
        field: `answers[${answerIndex}].questionId`,
        questionId: answer.questionId
      });
    }

    const question = stage.questionById.get(answer.questionId);
    if (!question) {
      throw inputError("answers contains an unknown questionId.", {
        field: `answers[${answerIndex}].questionId`,
        questionId: answer.questionId
      });
    }

    if (!Array.isArray(answer.optionIds)
      || !hasDenseEntries(answer.optionIds)
      || answer.optionIds.length < 1
      || answer.optionIds.length > MAX_OPTIONS_PER_QUESTION
      || answer.optionIds.length > question.optionIds.length) {
      throw inputError("optionIds has an invalid number of selected options.", {
        field: `answers[${answerIndex}].optionIds`,
        questionId: answer.questionId
      });
    }
    if (question.type === "single" && answer.optionIds.length !== 1) {
      throw inputError("A single-choice question must select exactly one option.", {
        field: `answers[${answerIndex}].optionIds`,
        questionId: answer.questionId
      });
    }

    const selected = new Set();
    answer.optionIds.forEach((optionId, optionIndex) => {
      validateItemId(optionId, `answers[${answerIndex}].optionIds[${optionIndex}]`);
      if (!question.optionIdSet.has(optionId)) {
        throw inputError("An answer contains an unknown optionId.", {
          field: `answers[${answerIndex}].optionIds[${optionIndex}]`,
          questionId: answer.questionId,
          optionId
        });
      }
      if (selected.has(optionId)) {
        throw inputError("An answer contains a duplicate optionId.", {
          field: `answers[${answerIndex}].optionIds[${optionIndex}]`,
          questionId: answer.questionId,
          optionId
        });
      }
      selected.add(optionId);
    });

    answersByQuestionId.set(answer.questionId, {
      questionId: answer.questionId,
      optionIds: question.optionIds.filter((optionId) => selected.has(optionId))
    });
  });

  const answers = stage.questions.map((question) => {
    const answer = answersByQuestionId.get(question.id);
    if (!answer) {
      throw inputError("answers is missing a stage question.", {
        field: "answers",
        questionId: question.id
      });
    }
    return answer;
  });

  return {
    stageId: payload.stageId,
    stageRevision: payload.stageRevision,
    contentHash: payload.contentHash,
    answers,
    expectedRevision: payload.expectedRevision,
    operationId
  };
}

function normalizeStage(stage) {
  if (!isPlainRecord(stage)) {
    throw stageError("The server-loaded stage must be an object.");
  }

  try {
    validateStageId(stage.id, "stage.id");
    validateRevision(stage.revision, "stage.revision");
    validateContentHash(stage.contentHash, "stage.contentHash");
  } catch (error) {
    if (error instanceof JapaneseSubtextAgentEvaluationError) {
      throw stageError(error.message, error.details);
    }
    throw error;
  }

  if (!Array.isArray(stage.questions)
    || !hasDenseEntries(stage.questions)
    || stage.questions.length < 1
    || stage.questions.length > MAX_QUESTIONS) {
    throw stageError(`The server-loaded stage must contain 1 to ${MAX_QUESTIONS} questions.`);
  }

  const seenQuestionIds = new Set();
  const questions = stage.questions.map((question, questionIndex) => {
    if (!isPlainRecord(question)) {
      throw stageError(`stage.questions[${questionIndex}] must be an object.`);
    }
    if (typeof question.id !== "string"
      || !ITEM_ID_PATTERN.test(question.id)
      || seenQuestionIds.has(question.id)) {
      throw stageError(`stage.questions[${questionIndex}].id is invalid or duplicated.`);
    }
    seenQuestionIds.add(question.id);

    if (question.type !== "single" && question.type !== "multiple") {
      throw stageError(`stage.questions[${questionIndex}].type is invalid.`);
    }
    if (!Array.isArray(question.options)
      || !hasDenseEntries(question.options)
      || question.options.length < 2
      || question.options.length > MAX_OPTIONS_PER_QUESTION) {
      throw stageError(
        `stage.questions[${questionIndex}].options must contain 2 to ${MAX_OPTIONS_PER_QUESTION} options.`
      );
    }

    const optionIds = [];
    const optionIdSet = new Set();
    question.options.forEach((option, optionIndex) => {
      if (!isPlainRecord(option)
        || typeof option.id !== "string"
        || !ITEM_ID_PATTERN.test(option.id)
        || optionIdSet.has(option.id)) {
        throw stageError(
          `stage.questions[${questionIndex}].options[${optionIndex}].id is invalid or duplicated.`
        );
      }
      optionIds.push(option.id);
      optionIdSet.add(option.id);
    });

    if (!Array.isArray(question.correctOptionIds)
      || !hasDenseEntries(question.correctOptionIds)
      || question.correctOptionIds.length < 1
      || question.correctOptionIds.length > optionIds.length
      || (question.type === "single" && question.correctOptionIds.length !== 1)) {
      throw stageError(`stage.questions[${questionIndex}].correctOptionIds is invalid.`);
    }

    const correctOptionIdSet = new Set();
    question.correctOptionIds.forEach((optionId, optionIndex) => {
      if (typeof optionId !== "string"
        || !ITEM_ID_PATTERN.test(optionId)
        || !optionIdSet.has(optionId)
        || correctOptionIdSet.has(optionId)) {
        throw stageError(
          `stage.questions[${questionIndex}].correctOptionIds[${optionIndex}] is invalid or duplicated.`
        );
      }
      correctOptionIdSet.add(optionId);
    });

    return {
      id: question.id,
      type: question.type,
      optionIds,
      optionIdSet,
      correctOptionIds: optionIds.filter((optionId) => correctOptionIdSet.has(optionId))
    };
  });

  return {
    id: stage.id,
    revision: stage.revision,
    contentHash: stage.contentHash,
    questions,
    questionById: new Map(questions.map((question) => [question.id, question]))
  };
}

function validateStageId(value, field) {
  if (typeof value !== "string" || !STAGE_ID_PATTERN.test(value)) {
    throw inputError(`${field} must be a canonical Japanese Subtext stage ID.`, { field });
  }
}

function validateRevision(value, field) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_REVISION) {
    throw inputError(`${field} must be an integer from 1 through ${MAX_REVISION}.`, { field });
  }
}

function validateContentHash(value, field) {
  if (typeof value !== "string" || !CONTENT_HASH_PATTERN.test(value)) {
    throw inputError(`${field} must be a lowercase SHA-256 hash.`, { field });
  }
}

function validateItemId(value, field) {
  if (typeof value !== "string" || !ITEM_ID_PATTERN.test(value)) {
    throw inputError(`${field} is invalid.`, { field });
  }
}

function assertPlainRecord(value, message) {
  if (!isPlainRecord(value)) throw inputError(message);
}

function assertExactKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw inputError(`${label} contains missing or unsupported fields.`);
  }
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasDenseEntries(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function compareAscii(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function inputError(message, details = null) {
  return new JapaneseSubtextAgentEvaluationError(message, {
    code: "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID",
    status: 400,
    details
  });
}

function conflictError(code, message, details = null) {
  return new JapaneseSubtextAgentEvaluationError(message, { code, status: 409, details });
}

function stageError(message, details = null) {
  return new JapaneseSubtextAgentEvaluationError(message, {
    code: "JAPANESE_SUBTEXT_AGENT_STAGE_INVALID",
    status: 500,
    details
  });
}
