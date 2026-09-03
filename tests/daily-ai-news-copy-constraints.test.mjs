import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertAiTakeFitsFact,
  countCopySentences,
  visibleCopyLength,
} from '../自动新闻/integrations/lusu-site/article-copy-constraints.mjs';

test('Daily AI News copy preflight accepts a concise one-sentence AI take', () => {
  const result = assertAiTakeFitsFact({
    fact: 'The company released a new coding model, published its weights, documented the license, and opened API access in three regions.',
    aiTake: 'The open weights lower adoption friction, while regional access remains the practical constraint.',
    label: 'fixture en AI take',
  });
  assert.equal(result.sentenceCount, 1);
  assert.ok(result.aiTakeLength < result.factLength * 0.8);
});

test('Daily AI News copy preflight rejects an AI take at or above eighty percent of the fact paragraph', () => {
  assert.throws(
    () => assertAiTakeFitsFact({
      fact: '公司发布新模型并开放 API。',
      aiTake: '开放 API 会直接改变用户使用方式。',
      label: 'fixture zh AI take',
    }),
    /shorter than 80%/,
  );
});

test('Daily AI News copy preflight rejects more than two sentences', () => {
  assert.equal(countCopySentences('One. Two. Three.'), 3);
  assert.throws(
    () => assertAiTakeFitsFact({
      fact: 'This sufficiently long fact paragraph explains the release, availability, pricing, evidence, and all other material details readers need to understand the event without opening another page.',
      aiTake: 'One implication matters. A second caveat matters. A third observation is unnecessary.',
      label: 'fixture en AI take',
    }),
    /one or two sentences/,
  );
  assert.equal(visibleCopyLength('**AI take:** useful'), 15);
});
