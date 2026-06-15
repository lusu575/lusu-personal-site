const SESSION_COOKIE = "lusu_session";
const OWNER_ADMIN_EMAILS = new Set(["630739094@qq.com"]);

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response("D1 database binding DB is not configured.", { status: 500 });
  }

  const session = await getSession(request, env);
  if (session?.user?.role === "admin" || OWNER_ADMIN_EMAILS.has(String(session?.user?.email || "").toLowerCase())) {
    return context.next();
  }

  const acceptsHtml = (request.headers.get("Accept") || "").includes("text/html");
  if (acceptsHtml) {
    return new Response(adminLoginHtml(session?.user?.email || ""), {
      status: session ? 403 : 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  return new Response("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "no-store" }
  });
}

async function getSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`
    select sessions.token_hash, users.id, users.email, users.role
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ? and sessions.expires_at > ?
  `).bind(tokenHash, new Date().toISOString()).first();
  if (!row) {
    return null;
  }
  return { tokenHash, user: { id: row.id, email: row.email, role: row.role || "user" } };
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  return cookie.split(";").map((item) => item.trim()).reduce((found, item) => {
    if (found) {
      return found;
    }
    const [key, ...rest] = item.split("=");
    return key === name ? decodeURIComponent(rest.join("=")) : "";
  }, "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function adminLoginHtml(email) {
  const denied = email ? `<p class="error">当前账号 ${escapeHtml(email)} 没有后台权限。</p>` : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>鲁肃个人站后台登录</title>
  <style>
    :root { color-scheme: light; font-family: "Microsoft YaHei", "SimSun", system-ui, sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #0b5fc7; color: #10213a; }
    .panel { width: min(420px, calc(100vw - 28px)); border: 2px solid #003c8f; background: #ece9d8; box-shadow: 6px 6px 0 rgba(0,0,0,.28); }
    .bar { padding: 8px 10px; color: #fff; font-weight: 700; background: linear-gradient(#2f8fff, #0054c8 52%, #003b9f); border-bottom: 1px solid #002f7f; }
    form { padding: 18px; display: grid; gap: 12px; }
    label { display: grid; gap: 5px; font-size: 13px; font-weight: 700; }
    input { height: 34px; border: 2px inset #fff; padding: 0 9px; font: inherit; background: #fff; }
    button { height: 36px; border: 2px outset #fff; background: linear-gradient(#fff, #d8d2bd); font-weight: 700; cursor: pointer; }
    p { margin: 0; font-size: 13px; line-height: 1.7; }
    .error { color: #b00020; font-weight: 700; }
    .status { min-height: 20px; color: #0b5fc7; }
  </style>
</head>
<body>
  <section class="panel">
    <div class="bar">鲁肃个人站管理后台</div>
    <form id="login-form">
      ${denied}
      <p>后台只允许站长账号进入。这里复用主站账号系统，登录后会重新检查 admin 权限。</p>
      <label>邮箱<input id="email" name="email" type="email" autocomplete="email" required></label>
      <label>密码<input id="password" name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit">登录后台</button>
      <p class="status" id="status"></p>
    </form>
  </section>
  <script>
    document.getElementById("login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = document.getElementById("status");
      status.textContent = "正在登录...";
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: document.getElementById("email").value,
          password: document.getElementById("password").value
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        status.textContent = payload.error || "登录失败。";
        return;
      }
      window.location.reload();
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
