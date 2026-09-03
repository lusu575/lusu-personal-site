export const AI_TAKE_MIN_LENGTH = 12;
export const AI_TAKE_MAX_LENGTH = 240;
export const AI_TAKE_MAX_FACT_RATIO = 0.8;

export function visibleCopyLength(value) {
  return String(value || '')
    .replace(/[*_`#>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .length;
}

export function countCopySentences(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  const endings = text.match(/[。！？!?]+|\.(?=\s|$)/g);
  return endings?.length || 1;
}

export function assertAiTakeFitsFact({ fact, aiTake, label = 'AI take' }) {
  const factLength = visibleCopyLength(fact);
  const aiTakeLength = visibleCopyLength(aiTake);
  if (aiTakeLength < AI_TAKE_MIN_LENGTH || aiTakeLength > AI_TAKE_MAX_LENGTH) {
    throw new Error(
      `${label} must be ${AI_TAKE_MIN_LENGTH}-${AI_TAKE_MAX_LENGTH} visible characters; got ${aiTakeLength}.`,
    );
  }
  const sentenceCount = countCopySentences(aiTake);
  if (sentenceCount < 1 || sentenceCount > 2) {
    throw new Error(`${label} must contain one or two sentences; got ${sentenceCount}.`);
  }
  if (!factLength || aiTakeLength >= factLength * AI_TAKE_MAX_FACT_RATIO) {
    throw new Error(
      `${label} must be shorter than ${AI_TAKE_MAX_FACT_RATIO * 100}% of its fact paragraph; got ${aiTakeLength}/${factLength}.`,
    );
  }
  return { factLength, aiTakeLength, sentenceCount };
}
