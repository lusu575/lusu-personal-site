export function questionActionState({ submitted = false, attemptCleared = false } = {}) {
  const hasResult = Boolean(submitted);
  const showNext = hasResult && Boolean(attemptCleared);
  return {
    showRetry: hasResult && !showNext,
    showNext
  };
}
