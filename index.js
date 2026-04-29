const COOKIE_NAME = "gaband323_tech_watch_session";

const DEFAULT_SOURCES = [
  { id: "cloudflare-blog", name: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", category: "cloudflare", enabled: 1 },
  { id: "openai-news", name: "OpenAI News", url: "https://openai.com/news/rss.xml", category: "ai-models", enabled: 1 },
  { id: "github-blog", name: "GitHub Blog", url: "https://github.blog/feed/", category: "hosting", enabled: 1 },
  { id: "discord-status-rss", name: "Discord Status RSS", url: "https://discordstatus.com/history.rss", category: "status", enabled: 1 },
  { id: "github-status-rss", name: "GitHub Status RSS", url: "https://www.githubstatus.com/history.rss", category: "status", enabled: 1 }
];

const STATUS_SERVICES = [
  { id: "cloudflare", name: "Cloudflare", type: "statuspage", urls: ["https://www.cloudflarestatus.com/api/v2/summary.json","https://www.cloudflarestatus.com/api/v2/status.json"], fallbackUrl: "https://www.cloudflarestatus.com", homepage: "https://www.cloudflarestatus.com" },
  { id: "discord", name: "Discord", type: "statuspage", urls: ["https://discordstatus.com/api/v2/summary.json","https://discordstatus.com/api/v2/status.json"], fallbackUrl: "https://discordstatus.com", homepage: "https://discordstatus.com" },
  { id: "github", name: "GitHub", type: "statuspage", urls: ["https://www.githubstatus.com/api/v2/summary.json","https://www.githubstatus.com/api/v2/status.json"], fallbackUrl: "https://www.githubstatus.com", homepage: "https://www.githubstatus.com" },
  { id: "openai", name: "OpenAI", type: "statuspage", urls: ["https://status.openai.com/api/v2/summary.json","https://status.openai.com/api/v2/status.json"], fallbackUrl: "https://status.openai.com", homepage: "https://status.openai.com" },
  { id: "railway", name: "Railway", type: "railway", urls: ["https://status.railway.com/summary.json"], fallbackUrl: "https://status.railway.com", homepage: "https://status.railway.com" },
  { id: "roblox", name: "Roblox", type: "roblox", urls: ["https://4277980205320394.hostedstatus.com/1.0/status/59db90dbcdeb2f04dadcf16d","http://hostedstatus.com/1.0/status/59db90dbcdeb2f04dadcf16d","https://status.roblox.com/api/v2/summary.json","https://status.roblox.com/api/v2/status.json"], fallbackUrl: "https://status.roblox.com", homepage: "https://status.roblox.com" }
];

const STARTER_POSTS = [
  { title: "OpenRouter model watch: track new models, pricing, and free options", category: "ai-models", tags: "openrouter,ai-models,pricing", summary: "Use this section to track OpenRouter model launches, price changes, free models, and models worth testing for coding or general use.", url: "https://openrouter.ai/models", pinned: 1 },
  { title: "Cloudflare Workers AI watch: model availability and platform changes", category: "ai-models", tags: "cloudflare,workers-ai,models", summary: "Track Cloudflare Workers AI model changes, pricing updates, and useful deployment patterns for small AI apps.", url: "https://developers.cloudflare.com/workers-ai/", pinned: 1 },
  { title: "Developer free-tier watch: Cloudflare Workers remains a strong default", category: "deal", tags: "cloudflare,free-tier,hosting", summary: "Cloudflare Workers is still one of the best places to start for tiny APIs, dashboards, and automation projects with low operating cost.", url: "https://developers.cloudflare.com/workers/", pinned: 1 },
  { title: "Hosting watch: Railway is useful for quick API and bot deployments", category: "deal", tags: "railway,hosting,deployment", summary: "Railway is a convenient option for quick backend deployments, especially when a project does not fit into a pure Worker setup.", url: "https://railway.com", pinned: 0 },
  { title: "Status board enabled", category: "status", tags: "status,automation,outage", summary: "The status page checks major developer platforms automatically and records their current status.", url: "/status", pinned: 1 }
];

export default {
  async fetch(request, env, ctx) {
    try {
      await ensureDatabase(env);
      await ensurePresetAdmin(env);
      await seedDefaultSources(env);
      env.__viewer = await currentUser(request, env).catch(() => null);

      const url = new URL(request.url);
      const path = url.pathname;
      const publicPaths = ["/", "/login", "/signup", "/health"];
      const isPublicApi = path.startsWith("/api/");

      if (!env.__viewer && !publicPaths.includes(path) && !isPublicApi) return authPromptPage(env);

      if (path === "/") return home(request, env);
      if (path === "/health") return json({ ok: true, site: siteName(env) });

      if (path === "/models") {
        if (!userCan(env.__viewer, "models")) return accessDeniedPage(env, "AI Model Watch");
        return listingPage(request, env, "ai-models", "AI Model Watch", "No AI model watch posts yet.");
      }

      if (path === "/deals") {
        if (!userCan(env.__viewer, "deals")) return accessDeniedPage(env, "Dev Deals");
        return listingPage(request, env, "deal", "Dev Deals & Free-Tier Watch", "No dev deals & free-tier watch posts yet.");
      }

      if (path === "/status") {
        if (!userCan(env.__viewer, "status")) return accessDeniedPage(env, "Status Board");
        return statusPage(request, env);
      }

      if (path === "/post") return postPage(request, env);

      if (path === "/subscribe") {
        if (!userCan(env.__viewer, "subscribe")) return accessDeniedPage(env, "Subscriptions");
        return subscribePage(request, env);
      }

      if (path === "/login") return loginPage(request, env);
      if (path === "/signup") return signupPage(request, env);
      if (path === "/logout") return logout(request, env);

      if (path === "/admin") return adminPage(request, env);
      if (path === "/admin/post/save") return adminSavePost(request, env);
      if (path === "/admin/post/delete") return adminDeletePost(request, env);
      if (path === "/admin/source/save") return adminSaveSource(request, env);
      if (path === "/admin/source/delete") return adminDeleteSource(request, env);
      if (path === "/admin/user/update") return adminUpdateUser(request, env);
      if (path === "/admin/user/delete") return adminDeleteUser(request, env);
      if (path === "/admin/sync") return adminSync(request, env);
      if (path === "/admin/status/sync") return adminSyncStatus(request, env);
      if (path === "/admin/seed") return adminSeedContent(request, env);
      if (path === "/admin/digest") return adminDigest(request, env);

      if (path === "/api/feed") return apiFeed(request, env);
      if (path === "/api/status") return apiStatus(request, env);
      if (path === "/api/sync") return apiSync(request, env);

      return htmlPage("Not Found", `<section class="panel"><h1>404</h1><p>That page does not exist.</p></section>`, env, 404);
    } catch (err) {
      console.error(err);
      return htmlPage("Error", `<section class="panel"><h1>Something broke</h1><p class="error">${escapeHtml(err.message || String(err))}</p><pre>${escapeHtml(err.stack || "")}</pre></section>`, env, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureDatabase(env);
      await ensurePresetAdmin(env);
      await seedDefaultSources(env);
      await seedStarterContent(env);
      await syncSources(env);
      await syncServiceStatuses(env);
      if (event.cron && event.cron.includes("0 14")) await sendDigest(env);
    })());
  }
};

async function ensureDatabase(env) {
  if (!env.DB) throw new Error("Missing D1 binding named DB.");

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await safeAlter(env, `ALTER TABLE users ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1`);
  await safeAlter(env, `ALTER TABLE users ADD COLUMN can_models INTEGER NOT NULL DEFAULT 1`);
  await safeAlter(env, `ALTER TABLE users ADD COLUMN can_deals INTEGER NOT NULL DEFAULT 1`);
  await safeAlter(env, `ALTER TABLE users ADD COLUMN can_status INTEGER NOT NULL DEFAULT 1`);
  await safeAlter(env, `ALTER TABLE users ADD COLUMN can_subscribe INTEGER NOT NULL DEFAULT 1`);

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'general', tags TEXT, summary TEXT, content TEXT, url TEXT, source_name TEXT, pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await safeAlter(env, `ALTER TABLE posts ADD COLUMN tags TEXT`);
  await safeAlter(env, `ALTER TABLE posts ADD COLUMN summary TEXT`);
  await safeAlter(env, `ALTER TABLE posts ADD COLUMN content TEXT`);
  await safeAlter(env, `ALTER TABLE posts ADD COLUMN url TEXT`);
  await safeAlter(env, `ALTER TABLE posts ADD COLUMN source_name TEXT`);
  await safeAlter(env, `ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(env, `ALTER TABLE posts ADD COLUMN updated_at TEXT`);
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts(updated_at)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_url ON posts(url)`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, category TEXT NOT NULL DEFAULT 'general', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await safeAlter(env, `ALTER TABLE sources ADD COLUMN category TEXT NOT NULL DEFAULT 'general'`);
  await safeAlter(env, `ALTER TABLE sources ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`);

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, categories TEXT NOT NULL DEFAULT 'ai-models,deal,status,cloudflare,openai,hosting,outage', verified INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS service_status (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'Unknown', indicator TEXT NOT NULL DEFAULT 'unknown', url TEXT, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, raw TEXT)`).run();
  await safeAlter(env, `ALTER TABLE service_status ADD COLUMN indicator TEXT NOT NULL DEFAULT 'unknown'`);
  await safeAlter(env, `ALTER TABLE service_status ADD COLUMN url TEXT`);
  await safeAlter(env, `ALTER TABLE service_status ADD COLUMN checked_at TEXT`);
  await safeAlter(env, `ALTER TABLE service_status ADD COLUMN raw TEXT`);
}

async function safeAlter(env, sql) {
  try {
    await env.DB.prepare(sql).run();
  } catch (e) {
    const message = String(e.message || e);
    if (message.includes("duplicate column name") || message.includes("already exists")) return;
    throw e;
  }
}

async function ensurePresetAdmin(env) {
  if (!env.ADMIN_PRESET_EMAIL || !env.ADMIN_PRESET_PASSWORD) return;

  const email = String(env.ADMIN_PRESET_EMAIL).trim().toLowerCase();
  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();

  if (existing) {
    await env.DB.prepare(`UPDATE users SET role = 'admin', is_enabled = 1, can_models = 1, can_deals = 1, can_status = 1, can_subscribe = 1 WHERE email = ?`).bind(email).run();
    return;
  }

  const hash = await hashPassword(String(env.ADMIN_PRESET_PASSWORD));
  await env.DB.prepare(`INSERT INTO users (id, email, password_hash, role, is_enabled, can_models, can_deals, can_status, can_subscribe) VALUES (?, ?, ?, 'admin', 1, 1, 1, 1, 1)`).bind(crypto.randomUUID(), email, hash).run();
}

async function seedDefaultSources(env) {
  for (const source of DEFAULT_SOURCES) {
    await env.DB.prepare(`INSERT INTO sources (id, name, url, category, enabled) VALUES (?, ?, ?, ?, ?) ON CONFLICT(url) DO UPDATE SET id = excluded.id, name = excluded.name, category = excluded.category, enabled = excluded.enabled`).bind(source.id, source.name, source.url, source.category, source.enabled).run();
  }
}

async function seedStarterContent(env) {
  let inserted = 0;
  let updated = 0;

  for (const post of STARTER_POSTS) {
    const id = slugify(post.title);
    const existing = await env.DB.prepare(`SELECT id FROM posts WHERE url = ?`).bind(normalizeUrl(post.url)).first();
    const finalId = existing?.id || id;

    await env.DB.prepare(`
      INSERT INTO posts (id, title, category, tags, summary, content, url, pinned, source_name, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Starter Content', CURRENT_TIMESTAMP)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        tags = excluded.tags,
        summary = excluded.summary,
        content = excluded.content,
        pinned = excluded.pinned,
        source_name = excluded.source_name,
        updated_at = CURRENT_TIMESTAMP
    `).bind(finalId, post.title, post.category, post.tags, post.summary, post.summary, normalizeUrl(post.url), post.pinned || 0).run();

    if (existing) updated++;
    else inserted++;
  }

  return { ok: true, inserted, updated };
}

function authPromptPage(env) {
  return htmlPage("Sign in required", `
    <section class="hero">
      <p class="eyebrow">Private dashboard</p>
      <h1>Sign in to access ${escapeHtml(siteName(env))}</h1>
      <p>This site is for registered users. Create an account or sign in to view models, deals, status pages, posts, and subscriptions.</p>
      <div class="actions">
        <a class="button" href="/signup">Create account</a>
        <a class="button secondary" href="/login">Sign in</a>
      </div>
    </section>
  `, env, 401);
}

function accessDeniedPage(env, sectionName = "this section") {
  return htmlPage("Access denied", `
    <section class="panel auth">
      <h1>Access denied</h1>
      <p>Your account does not currently have access to ${escapeHtml(sectionName)}.</p>
      <p>An admin can change this from the admin panel.</p>
      <p><a class="button" href="/">Back home</a></p>
    </section>
  `, env, 403);
}

async function home(request, env) {
  if (!env.__viewer) return authPromptPage(env);

  const posts = await env.DB.prepare(`SELECT * FROM posts ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC LIMIT 12`).all();
  const statuses = await getStatuses(env);

  return htmlPage("Home", `
    <section class="hero">
      <p class="eyebrow">Models · Deals · Status</p>
      <h1>${escapeHtml(siteName(env))}</h1>
      <p>Track AI model updates, developer free tiers, hosting deals, and platform outages.</p>
      <div class="actions">
        ${userCan(env.__viewer, "models") ? `<a class="button" href="/models">Models</a>` : ""}
        ${userCan(env.__viewer, "deals") ? `<a class="button secondary" href="/deals">Deals</a>` : ""}
        ${userCan(env.__viewer, "status") ? `<a class="button secondary" href="/status">Status</a>` : ""}
      </div>
    </section>

    <section class="panel">
      <h2>Service status</h2>
      <div class="status-grid">${renderStatusCards(statuses)}</div>
    </section>

    <section class="panel">
      <h2>Latest watch posts</h2>
      <div class="grid">${renderPostCards(posts.results || []) || `<p>No posts yet. Log into admin and seed starter content.</p>`}</div>
    </section>
  `, env);
}

async function listingPage(request, env, category, title, emptyMessage) {
  const posts = await env.DB.prepare(`SELECT * FROM posts WHERE category = ? OR tags LIKE ? ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC LIMIT 60`).bind(category, `%${category}%`).all();

  return htmlPage(title, `
    <section class="panel">
      <h1>${escapeHtml(title)}</h1>
      <div class="grid">
        ${renderPostCards(posts.results || []) || `<p>${escapeHtml(emptyMessage)}</p>`}
      </div>
    </section>
  `, env);
}

async function statusPage(request, env) {
  const statuses = await getStatuses(env);

  return htmlPage("Status", `
    <section class="panel">
      <h1>Status Board</h1>
      <p>Automatic status checks for developer platforms.</p>
      <div class="status-grid">${renderStatusCards(statuses)}</div>
    </section>
  `, env);
}

async function postPage(request, env) {
  const id = new URL(request.url).searchParams.get("id");
  const post = await env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first();

  if (!post) return htmlPage("Post not found", `<section class="panel"><h1>Post not found</h1></section>`, env, 404);

  return htmlPage(post.title, `
    <article class="panel">
      <p><a href="/">← Back</a></p>
      <p class="meta">${escapeHtml(label(post.category))} · ${escapeHtml(post.source_name || "Manual")}</p>
      <h1>${escapeHtml(post.title)}</h1>
      <p>${escapeHtml(post.summary || "")}</p>
      <div>${paragraphs(post.content || post.summary || "")}</div>
      ${post.url ? `<p><a class="button" href="${escapeAttr(post.url)}" target="_blank" rel="noopener noreferrer">Open source</a></p>` : ""}
    </article>
  `, env);
}

async function subscribePage(request, env) {
  if (request.method === "POST") {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const categories = form.getAll("categories").map(String).join(",") || "ai-models,deal,status";

    if (!email) return htmlPage("Subscribe", subscribeForm("Enter a valid email."), env, 400);

    await env.DB.prepare(`INSERT INTO subscriptions (id, email, categories, verified) VALUES (?, ?, ?, 1) ON CONFLICT(email) DO UPDATE SET categories = excluded.categories, verified = 1`).bind(crypto.randomUUID(), email, categories).run();

    return htmlPage("Subscribed", `
      <section class="panel auth">
        <h1>Subscribed</h1>
        <p>${escapeHtml(email)} is subscribed.</p>
        <p><a href="/">Back home</a></p>
      </section>
    `, env);
  }

  return htmlPage("Subscribe", subscribeForm(""), env);
}

function subscribeForm(error = "") {
  const cats = [
    ["ai-models", "AI model updates"],
    ["deal", "Deals & free-tier changes"],
    ["status", "Status/outages"],
    ["cloudflare", "Cloudflare"],
    ["hosting", "Hosting"],
    ["pricing", "Pricing"]
  ];

  return `
    <section class="panel auth">
      <h1>Subscribe</h1>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="POST" action="/subscribe" class="stack">
        <label>Email</label>
        <input name="email" type="email" required>
        <label>Categories</label>
        ${cats.map(([value, text]) => `<label><input type="checkbox" name="categories" value="${value}" checked> ${escapeHtml(text)}</label>`).join("")}
        <button>Subscribe</button>
      </form>
    </section>
  `;
}

async function loginPage(request, env) {
  if (env.__viewer) return redirect("/");

  if (request.method === "POST") {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const user = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return htmlPage("Login", loginForm("Invalid email or password."), env, 401);
    }

    if (Number(user.is_enabled ?? 1) !== 1 && user.role !== "admin") {
      return htmlPage("Login", loginForm("Your account is disabled."), env, 403);
    }

    return createSession(env, user.id, user.role === "admin" ? "/admin" : "/");
  }

  return htmlPage("Login", loginForm(""), env);
}

function loginForm(error = "") {
  return `
    <section class="panel auth">
      <h1>Login</h1>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="POST" action="/login" class="stack">
        <label>Email</label>
        <input name="email" type="email" required>
        <label>Password</label>
        <input name="password" type="password" required>
        <button>Login</button>
      </form>
      <p>No account yet? <a href="/signup">Create one</a>.</p>
    </section>
  `;
}

async function signupPage(request, env) {
  if (env.__viewer) return redirect("/");

  if (request.method === "POST") {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirm_password") || "");

    if (!email || !email.includes("@")) return htmlPage("Create account", signupForm("Enter a valid email address."), env, 400);
    if (!password || password.length < 8) return htmlPage("Create account", signupForm("Password must be at least 8 characters."), env, 400);
    if (password !== confirmPassword) return htmlPage("Create account", signupForm("Passwords do not match."), env, 400);

    const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
    if (existing) return htmlPage("Create account", signupForm("That email already has an account. Try signing in."), env, 400);

    const role = isAdminEmail(env, email) ? "admin" : "user";
    const id = crypto.randomUUID();
    const hash = await hashPassword(password);

    await env.DB.prepare(`INSERT INTO users (id, email, password_hash, role, is_enabled, can_models, can_deals, can_status, can_subscribe) VALUES (?, ?, ?, ?, 1, 1, 1, 1, 1)`).bind(id, email, hash, role).run();

    return createSession(env, id, role === "admin" ? "/admin" : "/");
  }

  return htmlPage("Create account", signupForm(""), env);
}

function signupForm(error = "") {
  return `
    <section class="panel auth">
      <h1>Create account</h1>
      <p>Sign up to access the Tech Watch dashboard.</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="POST" action="/signup" class="stack">
        <label>Email</label>
        <input name="email" type="email" required>
        <label>Password</label>
        <input name="password" type="password" minlength="8" required>
        <label>Confirm password</label>
        <input name="confirm_password" type="password" minlength="8" required>
        <button>Create account</button>
      </form>
      <p>Already have an account? <a href="/login">Sign in</a>.</p>
    </section>
  `;
}

async function logout(request, env) {
  const sid = getCookie(request, COOKIE_NAME);
  if (sid) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run();

  return redirect("/", {
    "Set-Cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  });
}

async function adminPage(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const posts = await env.DB.prepare(`SELECT * FROM posts ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC LIMIT 80`).all();
  const sources = await env.DB.prepare(`SELECT * FROM sources ORDER BY created_at DESC`).all();
  const statuses = await getStatuses(env);
  const users = await env.DB.prepare(`SELECT id, email, role, created_at, COALESCE(is_enabled, 1) AS is_enabled, COALESCE(can_models, 1) AS can_models, COALESCE(can_deals, 1) AS can_deals, COALESCE(can_status, 1) AS can_status, COALESCE(can_subscribe, 1) AS can_subscribe FROM users ORDER BY created_at DESC LIMIT 200`).all();

  return htmlPage("Admin", `
    <section class="hero">
      <p class="eyebrow">Admin</p>
      <h1>${escapeHtml(siteName(env))}</h1>
      <p>Logged in as ${escapeHtml(user.email)}</p>
      <div class="actions">
        <form method="POST" action="/admin/sync"><button>Sync RSS sources</button></form>
        <form method="POST" action="/admin/status/sync"><button>Sync service statuses</button></form>
        <form method="POST" action="/admin/seed"><button class="secondary">Seed starter content</button></form>
        <form method="POST" action="/admin/digest"><button class="secondary">Send digest</button></form>
      </div>
    </section>

    <section class="panel">
      <h2>Users</h2>
      <p class="meta">Manage site access, section permissions, subscription access, and admin role.</p>
      <div class="tablewrap">
        <table>
          <thead><tr><th>Email</th><th>Role</th><th>Access</th><th>Actions</th></tr></thead>
          <tbody>
            ${(users.results || []).map(u => `
              <tr>
                <td><b>${escapeHtml(u.email)}</b><br><small>${escapeHtml(formatDateTime(u.created_at))}</small></td>
                <td>
                  <form method="POST" action="/admin/user/update" class="stack">
                    <input type="hidden" name="id" value="${escapeAttr(u.id)}">
                    <select name="role">
                      <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
                      <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                    </select>
                </td>
                <td>
                  <label><input type="checkbox" name="is_enabled" value="1" ${Number(u.is_enabled) === 1 ? "checked" : ""}> Site access</label><br>
                  <label><input type="checkbox" name="can_models" value="1" ${Number(u.can_models) === 1 ? "checked" : ""}> Models</label><br>
                  <label><input type="checkbox" name="can_deals" value="1" ${Number(u.can_deals) === 1 ? "checked" : ""}> Deals</label><br>
                  <label><input type="checkbox" name="can_status" value="1" ${Number(u.can_status) === 1 ? "checked" : ""}> Status</label><br>
                  <label><input type="checkbox" name="can_subscribe" value="1" ${Number(u.can_subscribe) === 1 ? "checked" : ""}> Subscribe</label>
                </td>
                <td>
                    <button>Save</button>
                  </form>
                  ${u.id !== user.id ? `<form method="POST" action="/admin/user/delete" onsubmit="return confirm('Delete this user?')"><input type="hidden" name="id" value="${escapeAttr(u.id)}"><button class="danger">Delete user</button></form>` : `<small>Current admin</small>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Add / update post</h2>
      <form method="POST" action="/admin/post/save" class="stack">
        <input name="id" placeholder="Optional ID. Leave blank for new post.">
        <input name="title" placeholder="Title" required>
        <select name="category">
          <option value="ai-models">AI Models</option>
          <option value="deal">Deal / Free Tier</option>
          <option value="status">Status</option>
          <option value="pricing">Pricing</option>
          <option value="hosting">Hosting</option>
          <option value="cloudflare">Cloudflare</option>
          <option value="openai">OpenAI</option>
          <option value="discord">Discord</option>
          <option value="roblox">Roblox</option>
          <option value="github">GitHub</option>
          <option value="outage">Outage</option>
        </select>
        <input name="tags" placeholder="Tags, comma-separated">
        <input name="url" placeholder="Source URL">
        <label><input type="checkbox" name="pinned" value="1"> Pin post</label>
        <textarea name="summary" placeholder="Short summary"></textarea>
        <textarea name="content" placeholder="Full content"></textarea>
        <button>Save post</button>
      </form>
    </section>

    <section class="panel">
      <h2>RSS sources</h2>
      <form method="POST" action="/admin/source/save" class="stack">
        <input name="name" placeholder="Source name" required>
        <input name="url" placeholder="RSS feed URL" required>
        <input name="category" placeholder="Category, e.g. ai-models, deal, status, cloudflare" required>
        <label><input type="checkbox" name="enabled" value="1" checked> Enabled</label>
        <button>Add source</button>
      </form>

      <div class="tablewrap">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>URL</th><th>Enabled</th><th></th></tr></thead>
          <tbody>
            ${(sources.results || []).map(s => `
              <tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.category)}</td>
                <td><small>${escapeHtml(s.url)}</small></td>
                <td>${Number(s.enabled) === 1 ? "Yes" : "No"}</td>
                <td><form method="POST" action="/admin/source/delete" onsubmit="return confirm('Delete this source?')"><input type="hidden" name="id" value="${escapeAttr(s.id)}"><button class="danger">Delete</button></form></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel"><h2>Status snapshot</h2><div class="status-grid">${renderStatusCards(statuses)}</div></section>

    <section class="panel">
      <h2>Posts</h2>
      <div class="tablewrap">
        <table>
          <thead><tr><th>Title</th><th>Category</th><th>Source</th><th></th></tr></thead>
          <tbody>
            ${(posts.results || []).map(p => `
              <tr>
                <td><a href="/post?id=${encodeURIComponent(p.id)}">${escapeHtml(p.title)}</a></td>
                <td>${escapeHtml(p.category)}</td>
                <td>${escapeHtml(p.source_name || "Manual")}</td>
                <td><form method="POST" action="/admin/post/delete" onsubmit="return confirm('Delete this post?')"><input type="hidden" name="id" value="${escapeAttr(p.id)}"><button class="danger">Delete</button></form></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `, env);
}

async function adminUpdateUser(request, env) {
  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const form = await request.formData();
  const id = String(form.get("id") || "");
  if (!id) return redirect("/admin");

  const role = String(form.get("role") || "user") === "admin" ? "admin" : "user";
  const isEnabled = form.get("is_enabled") === "1" ? 1 : 0;
  const canModels = form.get("can_models") === "1" ? 1 : 0;
  const canDeals = form.get("can_deals") === "1" ? 1 : 0;
  const canStatus = form.get("can_status") === "1" ? 1 : 0;
  const canSubscribe = form.get("can_subscribe") === "1" ? 1 : 0;

  await env.DB.prepare(`UPDATE users SET role = ?, is_enabled = ?, can_models = ?, can_deals = ?, can_status = ?, can_subscribe = ? WHERE id = ?`).bind(role, isEnabled, canModels, canDeals, canStatus, canSubscribe, id).run();

  if (isEnabled !== 1) await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id).run();

  return redirect("/admin");
}

async function adminDeleteUser(request, env) {
  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const form = await request.formData();
  const id = String(form.get("id") || "");
  if (!id || id === adminUser.id) return redirect("/admin");

  await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();

  return redirect("/admin");
}

async function adminSavePost(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  if (!title) return redirect("/admin");

  const id = String(form.get("id") || "").trim() || slugify(title);
  const category = String(form.get("category") || "general").trim();
  const tags = String(form.get("tags") || "").trim();
  const summary = String(form.get("summary") || "").trim();
  const content = String(form.get("content") || summary).trim();
  const url = normalizeUrl(String(form.get("url") || "").trim());
  const pinned = form.get("pinned") === "1" ? 1 : 0;

  await env.DB.prepare(`INSERT INTO posts (id, title, category, tags, summary, content, url, source_name, pinned, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Manual', ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title = excluded.title, category = excluded.category, tags = excluded.tags, summary = excluded.summary, content = excluded.content, url = excluded.url, source_name = excluded.source_name, pinned = excluded.pinned, updated_at = CURRENT_TIMESTAMP`).bind(id, title, category, tags, summary, content, url, pinned).run();

  return redirect("/admin");
}

async function adminDeletePost(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const form = await request.formData();
  await env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(String(form.get("id") || "")).run();
  return redirect("/admin");
}

async function adminSaveSource(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const url = String(form.get("url") || "").trim();
  const category = String(form.get("category") || "general").trim();
  const enabled = form.get("enabled") === "1" ? 1 : 0;
  if (!name || !url) return redirect("/admin");
  const id = slugify(name);
  await env.DB.prepare(`INSERT INTO sources (id, name, url, category, enabled) VALUES (?, ?, ?, ?, ?) ON CONFLICT(url) DO UPDATE SET id = excluded.id, name = excluded.name, category = excluded.category, enabled = excluded.enabled`).bind(id, name, url, category, enabled).run();
  return redirect("/admin");
}

async function adminDeleteSource(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const form = await request.formData();
  await env.DB.prepare(`DELETE FROM sources WHERE id = ?`).bind(String(form.get("id") || "")).run();
  return redirect("/admin");
}

async function adminSync(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const result = await syncSources(env);
  return htmlPage("Sync result", `<section class="panel"><h1>Sync result</h1><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre><p><a class="button" href="/admin">Back</a></p></section>`, env);
}

async function adminSyncStatus(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const result = await syncServiceStatuses(env);
  return htmlPage("Status sync result", `<section class="panel"><h1>Status sync result</h1><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre><p><a class="button" href="/admin">Back</a></p></section>`, env);
}

async function adminSeedContent(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const result = await seedStarterContent(env);
  return htmlPage("Seed result", `<section class="panel"><h1>Seed result</h1><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre><p><a class="button" href="/admin">Back</a></p></section>`, env);
}

async function adminDigest(request, env) {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const result = await sendDigest(env);
  return htmlPage("Digest result", `<section class="panel"><h1>Digest result</h1><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre><p><a class="button" href="/admin">Back</a></p></section>`, env);
}

async function syncSources(env) {
  const sources = await env.DB.prepare(`SELECT * FROM sources WHERE enabled = 1`).all();
  let inserted = 0;
  let updated = 0;
  const failed = [];

  for (const source of sources.results || []) {
    try {
      const res = await fetch(source.url, { headers: { "User-Agent": "Gaband323TechWatch/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const items = parseRssItems(xml).slice(0, 10);

      for (const item of items) {
        if (!item.url || !item.title) continue;
        const existing = await env.DB.prepare(`SELECT id FROM posts WHERE url = ?`).bind(item.url).first();
        const id = existing?.id || stableId(item.url || item.title);
        await env.DB.prepare(`INSERT INTO posts (id, title, category, tags, summary, content, url, source_name, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP) ON CONFLICT(url) DO UPDATE SET title = excluded.title, category = excluded.category, tags = excluded.tags, summary = excluded.summary, content = excluded.content, source_name = excluded.source_name, updated_at = CURRENT_TIMESTAMP`).bind(id, item.title, source.category, source.category, item.description, item.description, item.url, source.name, item.published_at).run();
        if (existing) updated++;
        else inserted++;
      }
    } catch (e) {
      failed.push({ source: source.name, url: source.url, error: e.message });
    }
  }

  return { ok: failed.length === 0, inserted, updated, failed };
}

async function syncServiceStatuses(env) {
  let updated = 0;
  const failed = [];

  for (const service of STATUS_SERVICES) {
    let data = null;
    let html = "";
    let lastError = "";

    for (const statusUrl of service.urls || []) {
      try {
        const res = await fetch(statusUrl, {
          headers: {
            "User-Agent": "Gaband323TechWatch/1.0",
            "Accept": "application/json,text/html,*/*"
          }
        });

        if (!res.ok) throw new Error(`${statusUrl} HTTP ${res.status}`);
        const contentType = res.headers.get("content-type") || "";
        const text = await res.text();

        if (contentType.includes("application/json") || statusUrl.includes("/api/") || statusUrl.includes("hostedstatus.com") || text.trim().startsWith("{")) {
          try {
            data = JSON.parse(text);
            break;
          } catch {
            html = text;
            break;
          }
        } else {
          html = text;
          break;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!data && !html && service.fallbackUrl) {
      try {
        const fallback = await fetch(service.fallbackUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 Gaband323TechWatch/1.0",
            "Accept": "text/html,*/*"
          }
        });
        if (!fallback.ok) throw new Error(`${service.fallbackUrl} HTTP ${fallback.status}`);
        html = await fallback.text();
      } catch (e) {
        lastError = e.message;
      }
    }

    try {
      let normalized;
      if (data) normalized = normalizeStatus(service, data);
      else if (html) normalized = normalizeStatusFromHtml(service, html);
      else throw new Error(lastError || "No status data returned");

      const existing = await env.DB.prepare(`SELECT id FROM service_status WHERE id = ? OR name = ? LIMIT 1`).bind(service.id, service.name).first();
      const finalId = existing?.id || service.id;

      await env.DB.prepare(`INSERT INTO service_status (id, name, status, indicator, url, checked_at, raw) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, indicator = excluded.indicator, url = excluded.url, checked_at = CURRENT_TIMESTAMP, raw = excluded.raw`).bind(finalId, service.name, normalized.status, normalized.indicator, service.homepage, JSON.stringify(data || { html_status: normalized.status }).slice(0, 10000)).run();
      updated++;
    } catch (e) {
      failed.push({ service: service.name, error: e.message });
      const existing = await env.DB.prepare(`SELECT id FROM service_status WHERE id = ? OR name = ? LIMIT 1`).bind(service.id, service.name).first();
      const finalId = existing?.id || service.id;

      await env.DB.prepare(`INSERT INTO service_status (id, name, status, indicator, url, checked_at, raw) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, indicator = excluded.indicator, url = excluded.url, checked_at = CURRENT_TIMESTAMP, raw = excluded.raw`).bind(finalId, service.name, "Status unavailable", "unknown", service.homepage, JSON.stringify({ error: e.message }).slice(0, 10000)).run();
    }
  }

  return { ok: failed.length === 0, updated, failed };
}

function normalizeStatus(service, data) {
  if (service.type === "railway") {
    const activeIncidents = data.activeIncidents || [];
    const activeMaintenances = data.activeMaintenances || [];

    if (activeIncidents.length > 0) {
      const first = activeIncidents[0];
      return { status: `Incident: ${first.name || "Active incident"}`, indicator: railwayImpactToIndicator(first.impact || first.status || "minor") };
    }

    if (activeMaintenances.length > 0) {
      const first = activeMaintenances[0];
      return { status: `Maintenance: ${first.name || "Active maintenance"}`, indicator: "maintenance" };
    }

    const pageStatus = String(data.page?.status || "").toUpperCase();
    if (pageStatus === "UP") return { status: "All Systems Operational", indicator: "none" };
    if (pageStatus) return { status: pageStatus, indicator: "minor" };
    return { status: "Unknown", indicator: "unknown" };
  }

  if (service.type === "roblox") return normalizeRobloxStatus(data);

  return { status: data.status?.description || "Unknown", indicator: data.status?.indicator || "unknown" };
}

function normalizeRobloxStatus(data) {
  const text = JSON.stringify(data || {}).toLowerCase();

  if (text.includes("major") || text.includes("outage") || text.includes("disruption") || text.includes("degraded") || text.includes("investigating")) {
    return { status: "Service issue reported", indicator: "minor" };
  }

  if (text.includes("operational") || text.includes("all systems operational") || text.includes('"status":"up"') || text.includes('"status":"operational"')) {
    return { status: "All Systems Operational", indicator: "none" };
  }

  return { status: "Status page reachable", indicator: "unknown" };
}

function normalizeStatusFromHtml(service, html) {
  const text = cleanText(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).toLowerCase();

  if (text.includes("all systems operational") || text.includes("all services are online") || text.includes("all systems go")) return { status: "All Systems Operational", indicator: "none" };
  if (text.includes("major outage") || text.includes("critical") || text.includes("service disruption")) return { status: "Major service issue", indicator: "major" };
  if (text.includes("degraded") || text.includes("partial outage") || text.includes("incident") || text.includes("investigating")) return { status: "Service issue reported", indicator: "minor" };
  if (text.includes("operational")) return { status: "All Systems Operational", indicator: "none" };
  if (service.id === "railway" || service.id === "roblox") return { status: "Status page reachable", indicator: "unknown" };

  return { status: "Unknown", indicator: "unknown" };
}

function railwayImpactToIndicator(impact) {
  const value = String(impact || "").toLowerCase();
  if (value.includes("major") || value.includes("critical")) return "major";
  if (value.includes("minor") || value.includes("degraded")) return "minor";
  return "minor";
}

async function getStatuses(env) {
  const rows = await env.DB.prepare(`SELECT * FROM service_status ORDER BY name ASC`).all();

  if ((rows.results || []).length > 0) return rows.results;

  return STATUS_SERVICES.map(service => ({
    id: service.id,
    name: service.name,
    status: "Unknown",
    indicator: "unknown",
    url: service.homepage,
    checked_at: ""
  }));
}

async function sendDigest(env) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "Missing RESEND_API_KEY secret." };

  const subs = await env.DB.prepare(`SELECT * FROM subscriptions WHERE verified = 1 LIMIT 200`).all();
  const posts = await env.DB.prepare(`SELECT * FROM posts ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 10`).all();

  if (!subs.results?.length) return { ok: true, sent: 0, message: "No subscribers." };

  const site = siteOrigin(env);
  const items = (posts.results || []).map(post => `
    <li>
      <a href="${escapeAttr(site)}/post?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a>
      <br><small>${escapeHtml(label(post.category))} · ${escapeHtml(post.source_name || "Manual")}</small>
    </li>
  `).join("");

  let sent = 0;
  const failed = [];

  for (const sub of subs.results) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || "Gaband323 Tech Watch <updates@tech.gaband323.dev>",
          to: sub.email,
          subject: env.DIGEST_SUBJECT || "Your Gaband323 Tech Watch Update",
          html: `
            <h1>${escapeHtml(siteName(env))}</h1>
            <p>Here are the latest model, deal, and status updates.</p>
            <ul>${items}</ul>
            <p><a href="${escapeAttr(site)}">Open ${escapeHtml(siteName(env))}</a></p>
          `
        })
      });

      if (!res.ok) throw new Error(await res.text());
      sent++;
    } catch (e) {
      failed.push({ email: sub.email, error: e.message });
    }
  }

  return { ok: failed.length === 0, sent, failed };
}

async function apiFeed(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");

  let sql = `SELECT * FROM posts`;
  const params = [];

  if (category) {
    sql += ` WHERE category = ? OR tags LIKE ?`;
    params.push(category, `%${category}%`);
  }

  sql += ` ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC LIMIT 50`;

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return json({ ok: true, posts: rows.results || [] });
}

async function apiStatus(request, env) {
  return json({ ok: true, statuses: await getStatuses(env) });
}

async function apiSync(request, env) {
  const result = {
    sources: await syncSources(env),
    statuses: await syncServiceStatuses(env),
    seed: await seedStarterContent(env)
  };

  return json({ ok: result.sources.ok && result.statuses.ok && result.seed.ok, result });
}

async function requireAdmin(request, env) {
  const user = await currentUser(request, env);
  if (!user || user.role !== "admin") return redirect("/login");
  return user;
}

async function currentUser(request, env) {
  const sid = getCookie(request, COOKIE_NAME);
  if (!sid) return null;

  const user = await env.DB.prepare(`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > ?`).bind(sid, new Date().toISOString()).first();

  if (user && Number(user.is_enabled ?? 1) !== 1 && user.role !== "admin") return null;

  return user;
}

async function createSession(env, userId, location) {
  const sid = crypto.randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).bind(sid, userId, expires.toISOString()).run();

  return redirect(location, {
    "Set-Cookie": `${COOKIE_NAME}=${sid}; Path=/; Expires=${expires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`
  });
}

async function hashPassword(password) {
  const salt = crypto.randomUUID();
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `${salt}:${hex(digest)}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(digest) === hash;
}

function userCan(user, section) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (Number(user.is_enabled ?? 1) !== 1) return false;
  if (section === "models") return Number(user.can_models ?? 1) === 1;
  if (section === "deals") return Number(user.can_deals ?? 1) === 1;
  if (section === "status") return Number(user.can_status ?? 1) === 1;
  if (section === "subscribe") return Number(user.can_subscribe ?? 1) === 1;
  return true;
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function parseRssItems(xml) {
  const matches = String(xml || "").match(/<item>[\s\S]*?<\/item>/g) || [];

  return matches.map(raw => {
    const title = decodeHtml(stripCdata(getXmlTag(raw, "title")));
    const link = decodeHtml(stripCdata(getXmlTag(raw, "link")));
    const pubDateRaw = decodeHtml(stripCdata(getXmlTag(raw, "pubDate")));
    const descriptionRaw = decodeHtml(stripCdata(getXmlTag(raw, "description")));

    const publishedAt = (() => {
      const d = new Date(pubDateRaw);
      return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    })();

    return {
      title: cleanText(title),
      url: link,
      description: cleanDescription(descriptionRaw),
      published_at: publishedAt
    };
  }).filter(item => item.title && item.url);
}

function getXmlTag(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1] : "";
}

function stripCdata(value) {
  return String(value || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#160;", " ");
}

function cleanDescription(value) {
  return decodeHtml(String(value || ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim()
    .slice(0, 900);
}

function cleanText(value) {
  return decodeHtml(String(value || "")).replace(/\s+/g, " ").trim();
}

function renderPostCards(posts) {
  return posts.map(post => `
    <article class="card">
      <div class="pad">
        <p class="meta">${escapeHtml(label(post.category))} · ${escapeHtml(post.source_name || "Manual")}</p>
        <h2><a href="/post?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(post.summary || "")}</p>
        ${post.pinned ? `<p><span class="badge">Pinned</span></p>` : ""}
      </div>
    </article>
  `).join("");
}

function renderStatusCards(statuses) {
  return (statuses || []).map(s => `
    <a class="status-card ${escapeAttr(statusClass(s.indicator))}" href="${escapeAttr(s.url || "#")}" target="_blank" rel="noopener noreferrer">
      <h3>${escapeHtml(s.name)}</h3>
      <p>${escapeHtml(s.status || "Unknown")}</p>
      ${s.checked_at ? `<small>Checked ${escapeHtml(formatDateTime(s.checked_at))}</small>` : ""}
    </a>
  `).join("");
}

function statusClass(indicator) {
  const value = String(indicator || "").toLowerCase();
  if (value === "none" || value === "up") return "ok";
  if (value === "minor" || value === "maintenance") return "warn";
  if (value === "major" || value === "critical") return "bad";
  return "unknown";
}

function htmlPage(title, body, env, status = 200) {
  const viewer = env.__viewer;

  const nav = `
    <nav>
      <a href="/">Home</a>
      ${viewer && userCan(viewer, "models") ? `<a href="/models">Models</a>` : ""}
      ${viewer && userCan(viewer, "deals") ? `<a href="/deals">Deals</a>` : ""}
      ${viewer && userCan(viewer, "status") ? `<a href="/status">Status</a>` : ""}
      ${viewer && userCan(viewer, "subscribe") ? `<a href="/subscribe">Subscribe</a>` : ""}
      ${viewer?.role === "admin" ? `<a href="/admin">Admin</a>` : ""}
      ${viewer ? `<a href="/logout">Logout</a>` : `<a href="/login">Login</a> <a href="/signup">Sign up</a>`}
    </nav>
  `;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} · ${escapeHtml(siteName(env))}</title>
  <style>
    body{margin:0;background:#09090b;color:#f4f4f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    a{color:inherit;text-decoration:none}
    a:hover{color:#4ade80}
    header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#111114;border-bottom:1px solid #27272a;gap:16px}
    header b{color:#4ade80}
    nav{display:flex;gap:14px;color:#a1a1aa;flex-wrap:wrap}
    .wrap{max-width:1120px;margin:0 auto;padding:28px 18px 60px}
    .hero,.panel,.card,.status-card{background:#111114;border:1px solid #27272a;border-radius:18px;padding:20px;margin-bottom:16px}
    .hero h1,h1{font-size:clamp(34px,7vw,64px);line-height:1;margin:0 0 12px}
    h2,h3{margin-top:0}
    p,.meta,small{color:#a1a1aa}
    .eyebrow{color:#4ade80;text-transform:uppercase;letter-spacing:.12em;font-weight:800;font-size:13px}
    .button,button{background:#4ade80;color:#09090b;border:0;border-radius:999px;padding:10px 14px;font-weight:800;display:inline-block;cursor:pointer}
    .secondary{background:#18181b;color:#f4f4f5;border:1px solid #27272a}
    .danger{background:#fb7185;color:#09090b}
    .actions{display:flex;gap:10px;flex-wrap:wrap}
    input,textarea,select{width:100%;box-sizing:border-box;background:#0c0c0f;color:#f4f4f5;border:1px solid #27272a;border-radius:12px;padding:11px;font:inherit}
    input[type="checkbox"]{width:auto}
    textarea{min-height:120px}
    label{color:#a1a1aa}
    .stack{display:grid;gap:10px}
    .auth{max-width:480px;margin:30px auto}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
    .status-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
    .card{padding:0;overflow:hidden}
    .pad{padding:16px}
    .status-card{display:block}
    .status-card.ok{border-color:rgba(74,222,128,.5)}
    .status-card.warn{border-color:rgba(251,191,36,.65)}
    .status-card.bad{border-color:rgba(251,113,133,.7)}
    .status-card.unknown{border-color:#27272a}
    .badge{background:#4ade80;color:#09090b;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:800}
    .error{color:#fb7185}
    .tablewrap{overflow:auto}
    table{width:100%;border-collapse:collapse;min-width:720px}
    th,td{border-bottom:1px solid #27272a;padding:10px;text-align:left;vertical-align:top}
    pre{white-space:pre-wrap;background:#050507;border:1px solid #27272a;border-radius:12px;padding:12px;overflow:auto}
    @media(max-width:700px){header{align-items:flex-start;flex-direction:column}.wrap{padding:20px 14px}}
  </style>
</head>
<body>
  <header>
    <a href="/"><b>G</b> ${escapeHtml(siteName(env))}</a>
    ${nav}
  </header>
  <main class="wrap">${body}</main>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, ...headers }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function paragraphs(text) {
  return String(text || "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${escapeHtml(p)}</p>`).join("");
}

function siteName(env) {
  return env.SITE_NAME || "Gaband323 Tech Watch";
}

function siteOrigin(env) {
  return env.SITE_ORIGIN || "https://tech.gaband323.dev";
}

function label(value) {
  const v = String(value || "");
  if (v === "ai-models") return "AI Models";
  if (v === "deal") return "Deal";
  if (v === "free-tier") return "Free Tier";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function isAdminEmail(env, email) {
  return String(env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean).includes(String(email || "").toLowerCase());
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || crypto.randomUUID();
}

function stableId(input) {
  let hash = 0;
  const text = String(input || "");
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return `item-${Math.abs(hash)}`;
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  return text ? text : null;
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
