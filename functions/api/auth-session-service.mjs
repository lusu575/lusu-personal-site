// D1 batch is atomic: registration never commits an account without its first
// session. The caller only issues the cookie after every statement succeeds.
export async function persistAuthenticationSession(env, { userStatement = null, tokenHash, userId, createdAt, expiresAt }) {
  const sessionStatement = env.DB.prepare(
    "insert into sessions (token_hash, user_id, created_at, expires_at) values (?, ?, ?, ?)"
  ).bind(tokenHash, userId, createdAt, expiresAt);
  if (userStatement) {
    await env.DB.batch([userStatement, sessionStatement]);
  } else {
    await sessionStatement.run();
  }
}

export function scheduleAuthenticationSideEffects(context, tasks) {
  // No request, identity, email, credentials, or database errors enter logs.
  const settled = Promise.all(tasks.map(async (task) => {
    try { await task(); } catch { console.warn("Authentication telemetry or maintenance deferred."); }
  }));
  if (typeof context?.waitUntil === "function") {
    context.waitUntil(settled);
    return undefined;
  }
  // Non-Workers/test callers can await the same failure-isolated completion.
  return settled;
}
