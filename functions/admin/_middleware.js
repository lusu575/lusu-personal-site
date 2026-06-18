const SESSION_COOKIE = "lusu_session";
export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response("D1 database binding DB is not configured.", { status: 500 });
  }

  const session = await getSession(request, env);
  if (session?.user?.role === "admin") {
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
  const hasDeniedAccount = Boolean(email);
  const escapedEmail = escapeHtml(email);
  const denied = hasDeniedAccount ? `<p class="error">当前账号 <strong>${escapedEmail}</strong> 没有后台权限。</p>` : "";
  const stateLabel = hasDeniedAccount ? "权限不足" : "需要登录";
  const stateText = hasDeniedAccount
    ? "请使用站长管理员账号重新登录；普通账号不能读取后台页面或后台数据。"
    : "后台入口固定为 /admin/，登录后会再次校验 users.role = admin。";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>鲁肃个人站后台登录</title>
  <style>
    :root { color-scheme: light; font-family: "Microsoft YaHei", "SimSun", system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 18px;
      color: #10213a;
      background:
        linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px) 0 0 / 18px 18px,
        linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px) 0 0 / 18px 18px,
        linear-gradient(180deg, #0b5fc7 0%, #5da5f2 58%, #7fcf65 100%);
    }
    .panel {
      width: min(460px, 100%);
      border: 2px solid #003c8f;
      background: #ece9d8;
      box-shadow: inset -2px -2px #9e9b86, inset 2px 2px #fff, 7px 7px 0 rgba(0,0,0,.28);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      color: #fff;
      font-weight: 700;
      background: linear-gradient(#2f8fff, #0054c8 52%, #003b9f);
      border-bottom: 1px solid #002f7f;
    }
    .bar span:last-child {
      padding: 2px 6px;
      color: #10213a;
      background: #ffdf5a;
      border: 1px solid #fff7be;
      font-size: 12px;
      white-space: nowrap;
    }
    form { padding: 16px; display: grid; gap: 12px; }
    label { display: grid; gap: 5px; font-size: 13px; font-weight: 700; }
    input { width: 100%; height: 36px; border: 2px inset #fff; padding: 0 9px; font: inherit; background: #fff; color: #10213a; }
    button { min-height: 38px; border: 2px outset #fff; background: linear-gradient(#fff, #d8d2bd); font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { cursor: wait; filter: grayscale(.45); opacity: .78; }
    button:active:not(:disabled) { border-style: inset; transform: translate(1px, 1px); }
    input:focus-visible,
    button:focus-visible {
      outline: 3px solid #ffdf5a;
      outline-offset: 2px;
    }
    p { margin: 0; font-size: 13px; line-height: 1.7; }
    .notice {
      padding: 10px;
      background: #fffef4;
      border: 2px inset #fff;
      box-shadow: inset 1px 1px #d7d0b6;
    }
    .error { color: #9f0016; font-weight: 700; overflow-wrap: anywhere; }
    .status { min-height: 26px; padding: 5px 0 0; color: #0b5fc7; font-weight: 700; overflow-wrap: anywhere; }
    .helper { color: #42506a; }
    @media (max-width: 420px) {
      body { padding: 10px; align-items: start; }
      .bar { align-items: flex-start; flex-direction: column; }
      form { padding: 12px; }
    }
  </style>
</head>
<body>
  <section class="panel">
    <div class="bar"><span>鲁肃个人站管理后台</span><span>${stateLabel}</span></div>
    <form id="login-form">
      ${denied}
      <p class="notice">${stateText}</p>
      <label>邮箱<input id="email" name="email" type="email" autocomplete="username" required></label>
      <label>密码<input id="password" name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit">登录后台</button>
      <p class="helper">不会在页面中展示密码、session token 或后台数据；登录成功后由服务端重新判断权限。</p>
      <p class="status" id="status" role="status" aria-live="polite" aria-atomic="true"></p>
    </form>
  </section>
  <script>
    document.getElementById("login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = document.getElementById("status");
      const button = event.currentTarget.querySelector("button[type='submit']");
      const buttonText = button.textContent;
      status.textContent = "正在登录...";
      button.disabled = true;
      button.textContent = "正在登录...";
      button.setAttribute("aria-busy", "true");
      try {
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
          button.disabled = false;
          button.textContent = buttonText;
          button.setAttribute("aria-busy", "false");
          return;
        }
        window.location.reload();
      } catch (error) {
        status.textContent = "登录请求失败，请检查网络后重试。";
        button.disabled = false;
        button.textContent = buttonText;
        button.setAttribute("aria-busy", "false");
      }
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
