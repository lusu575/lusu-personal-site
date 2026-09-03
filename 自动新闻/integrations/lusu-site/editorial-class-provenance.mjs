export function candidateEditorialClass(candidateDecision, eventRecord) {
  const candidateClass = String(candidateDecision?.editorialClass || '').trim();
  if (candidateClass) {
    return candidateClass;
  }
  return String(eventRecord?.editorialClass || '').trim();
}
