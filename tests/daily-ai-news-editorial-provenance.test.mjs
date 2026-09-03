import assert from 'node:assert/strict';
import test from 'node:test';

import { candidateEditorialClass } from '../自动新闻/integrations/lusu-site/editorial-class-provenance.mjs';

test('Daily AI News keeps a rejected alias candidate class instead of inheriting the event class', () => {
  assert.equal(
    candidateEditorialClass(
      { editorialClass: 'capability-availability' },
      { editorialClass: 'strategic-hardware-infrastructure' },
    ),
    'capability-availability',
  );
});

test('Daily AI News falls back to the event class only when candidate provenance has no class', () => {
  assert.equal(
    candidateEditorialClass(
      { editorialClass: '' },
      { editorialClass: 'major-model-product' },
    ),
    'major-model-product',
  );
});
