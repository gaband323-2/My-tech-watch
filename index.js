const COOKIE_NAME = "gaband323_techwatch_session";
const POST_CATEGORIES = [
  "ai-models",
  "pricing",
  "free-tier",
  "hosting",
  "cloudflare",
  "openrouter",
  "openai",
  "anthropic",
  "discord",
  "roblox",
  "github",
  "outage",
  "deal",
  "status"
];

const DEFAULT_SOURCES = [
  {
    name: "Cloudflare Blog",
    url: "https://blog.cloudflare.com/rss/",
    category: "cloudflare"
  },
  {
    name: "Cloudflare Changelog",
    url: "https://developers.cloudflare.com/changelog/index.xml",
    category: "cloudflare"
  },
  {
    name: "GitHub Blog",
    url: "https://github.blog/feed/",
    category: "github"
  }
];

const DEFAULT_STATUS_SERVICES = [
  ["OpenAI", "unknown", "https://status.openai.com/"],
  ["Cloudflare", "unknown", "https://www.cloudflarestatus.com/"],
  ["Discord", "unknown", "https://discordstatus.com/"],
  ["Roblox", "unknown", "https://status.roblox.com/"],
  ["GitHub", "unknown", "https://www.githubstatus.com/"],
  ["Railway", "unknown", "https://status.railway.com/"]
];

export default {
  async fetch(request, env) {
    try {
      await ensureDatabase(env);
      await ensurePresetAdmin(env);
      await ensureDefaults(env);
      env.__viewer = await currentUser(request, env).catch(() => null);

      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/") return home(request, env);
      if (path === "/health") return json({ ok: true, name: siteName(env) });
      if (path === "/feed.json") return feedJson(request, env);
      if (path === "/models") return categoryPage(request, env, "ai-models", "AI Model Watch");
      if (path === "/deals") return categoryPage(request, env, "deal", "Dev Deals & Free-Tier Watch");
      if (path === "/status") return statusPage(request, env);
      if (path === "/post") return postPage(request, env);

      if (path === "/login") return login(request, env);
      if (path === "/logout") return logout(request, env);
      if (path === "/signup") return signup(request, env);
      if (path === "/subscribe") return subscribe(request, env);

      if (path === "/admin") return admin(request, env);
      if (path === "/admin/post/save") return adminSavePost(request, env);
      if (path === "/admin/post/delete") return adminDeletePost(request, env);
      if (path === "/admin/source/save") return adminSaveSource(request, env);
      if (path === "/admin/source/delete") return adminDeleteSource(request, env);
      if (path === "/admin/status/save") return adminSaveStatus(request, env);
      if (path === "/admin/sync") return adminSync(request, env);
      if (path === "/admin/digest") return adminDigest(request, env);

      return page("Not found", "<section class='panel'><h1>404</h1><p>That page does not exist.</p></section>", env, 404);
    } catch (err) {
      console.error(err);
      return page("Error", `<section class="panel"><h1>Something broke</h1><p class="error">${esc(err.message || String(err))}</p><pre>${esc(err.stack || "")}</pre></section>`, env, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureDatabase(env);
      await ensurePresetAdmin(env);
      await ensureDefaults(env);
      await runSourceSync(env);
      if (event.cron && event.cron.includes("0 15")) await sendDigest(env);
    })());
  }
};

async function ensureDatabase(env) {
  if (!env.DB) throw new Error("Missing D1 binding named DB.");

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    url TEXT,
    source_name TEXT,
    category TEXT NOT NULL DEFAULT 'ai-models',
    tags TEXT,
    importance TEXT NOT NULL DEFAULT 'normal',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_auto INTEGER NOT NULL DEFAULT 0,
    published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_url ON posts(url)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at)`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'ai-models',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    categories TEXT NOT NULL DEFAULT 'ai-models,deal,outage,hosting,cloudflare,openrouter,openai,anthropic',
    verified INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS service_status (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'unknown',
    url TEXT,
    note TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function ensurePresetAdmin(env) {
  if (!env.ADMIN_PRESET_EMAIL || !env.ADMIN_PRESET_PASSWORD) return;
  const email = String(env.ADMIN_PRESET_EMAIL).trim().toLowerCase();
  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
  if (existing) {
    await env.DB.prepare(`UPDATE users SET role = 'admin' WHERE email = ?`).bind(email).run();
    return;
  }
  const id = crypto.randomUUID();
  const hash = await hashPassword(String(env.ADMIN_PRESET_PASSWORD));
  await env.DB.prepare(`INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, 'admin')`).bind(id, email, hash).run();
}

async function ensureDefaults(env) {
  for (const s of DEFAULT_SOURCES) {
    await env.DB.prepare(`INSERT INTO sources (id, name, url, category, enabled) VALUES (?, ?, ?, ?, 1) ON CONFLICT(url) DO NOTHING`)
      .bind(crypto.randomUUID(), s.name, s.url, s.category).run();
  }
  for (const [name, status, url] of DEFAULT_STATUS_SERVICES) {
    await env.DB.prepare(`INSERT INTO service_status (id, name, status, url) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO NOTHING`)
      .bind(crypto.randomUUID(), name, status, url).run();
  }
}

async function home(request, env) {
  const posts = await env.DB.prepare(`SELECT * FROM posts ORDER BY is_pinned DESC, COALESCE(published_at, created_at) DESC LIMIT 30`).all();
  const status = await env.DB.prepare(`SELECT * FROM service_status ORDER BY name ASC`).all();
  return page("Home", `
    <section class="hero">
      <div>
        <p class="eyebrow">AI, dev tools, outages, and deals</p>
        <h1>${esc(siteName(env))}</h1>
        <p>Your live watchboard for model releases, pricing/free-tier changes, cloud platforms, and developer service status.</p>
      </div>
      <div class="hero-actions">
        ${env.__viewer?.role === "admin" ? `<a class="button" href="/admin">Admin</a>` : ""}
        <a class="button secondary" href="/models">Models</a>
        <a class="button secondary" href="/deals">Deals</a>
        <a class="button secondary" href="/status">Status</a>
      </div>
    </section>

    <section class="panel">
      <h2>Service status</h2>
      <div class="statusgrid">${(status.results || []).map(statusCard).join("")}</div>
    </section>

    <section class="panel">
      <h2>Latest updates</h2>
      <div class="postlist">${(posts.results || []).map(postCard).join("") || "<p>No updates yet. Sync sources or add a post from admin.</p>"}</div>
    </section>
  `, env);
}

async function categoryPage(request, env, category, title) {
  const posts = await env.DB.prepare(`SELECT * FROM posts WHERE category = ? ORDER BY is_pinned DESC, COALESCE(published_at, created_at) DESC LIMIT 60`).bind(category).all();
  return page(title, `<section class="panel"><h1>${esc(title)}</h1><div class="postlist">${(posts.results || []).map(postCard).join("") || `<p>No ${esc(title.toLowerCase())} posts yet.</p>`}</div></section>`, env);
}

async function statusPage(request, env) {
  const rows = await env.DB.prepare(`SELECT * FROM service_status ORDER BY name ASC`).all();
  return page("Status", `<section class="panel"><h1>Status board</h1><p class="muted">Manual status notes for key developer platforms.</p><div class="statusgrid">${(rows.results || []).map(statusCard).join("")}</div></section>`, env);
}

async function postPage(request, env) {
  const id = new URL(request.url).searchParams.get("id");
  const p = await env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first();
  if (!p) return page("Not found", `<section class="panel"><h1>Post not found</h1></section>`, env, 404);
  return page(p.title, `
    <article class="panel article">
      <p><a href="/">← Back</a></p>
      <p class="meta">${esc(label(p.category))} · ${esc(p.source_name || "Gaband323")}${p.is_pinned ? " · pinned" : ""}</p>
      <h1>${esc(p.title)}</h1>
      <p class="lead">${esc(p.summary || "")}</p>
      <div>${paragraphs(p.content || p.summary || "")}</div>
      ${p.url ? `<p><a class="button" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Open source</a></p>` : ""}
    </article>
  `, env);
}

async function login(request, env) {
  if (request.method === "POST") {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const user = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return page("Login", loginForm("Invalid email or password."), env, 401);
    }
    return createSession(env, user.id, user.role === "admin" ? "/admin" : "/");
  }
  return page("Login", loginForm(""), env);
}

function loginForm(error) {
  return `<section class="panel auth"><h1>Login</h1>${error ? `<p class="error">${esc(error)}</p>` : ""}<form method="POST" action="/login" class="stack"><label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" required><button>Login</button></form><p><a href="/signup">Create account</a></p></section>`;
}

async function signup(request, env) {
  if (env.__viewer) return redirect("/");
  if (request.method === "POST") {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    if (!email || password.length < 8) return page("Signup", signupForm("Use a valid email and an 8+ character password."), env, 400);
    const id = crypto.randomUUID();
    const role = isAdminEmail(env, email) ? "admin" : "user";
    const hash = await hashPassword(password);
    try {
      await env.DB.prepare(`INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)`).bind(id, email, hash, role).run();
      return createSession(env, id, role === "admin" ? "/admin" : "/");
    } catch {
      return page("Signup", signupForm("That email is probably already registered."), env, 400);
    }
  }
  return page("Signup", signupForm(""), env);
}

function signupForm(error) {
  return `<section class="panel auth"><h1>Create account</h1>${error ? `<p class="error">${esc(error)}</p>` : ""}<form method="POST" action="/signup" class="stack"><label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" minlength="8" required><button>Create account</button></form><p><a href="/login">Already have an account?</a></p></section>`;
}

async function logout(request, env) {
  const sid = getCookie(request, COOKIE_NAME);
  if (sid) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run();
  return redirect("/", { "Set-Cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
}

async function subscribe(request, env) {
  if (request.method === "POST") {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const cats = form.getAll("categories").map(String).filter(Boolean).join(",") || "ai-models,deal,outage,hosting,cloudflare,openrouter,openai,anthropic";
    if (!email) return page("Subscribe", subscribeForm("Enter an email."), env, 400);
    await env.DB.prepare(`INSERT INTO subscriptions (id, email, categories, verified) VALUES (?, ?, ?, 1) ON CONFLICT(email) DO UPDATE SET categories = excluded.categories, verified = 1`).bind(crypto.randomUUID(), email, cats).run();
    return page("Subscribed", `<section class="panel"><h1>Subscribed</h1><p>${esc(email)} is subscribed.</p><p><a href="/">Back</a></p></section>`, env);
  }
  return page("Subscribe", subscribeForm(""), env);
}

function subscribeForm(error) {
  const checks = ["ai-models", "deal", "pricing", "free-tier", "hosting", "outage", "cloudflare", "openrouter", "openai", "anthropic"].map(c => `<label><input type="checkbox" name="categories" value="${esc(c)}" checked> ${esc(label(c))}</label>`).join("");
  return `<section class="panel auth"><h1>Email updates</h1>${error ? `<p class="error">${esc(error)}</p>` : ""}<form method="POST" action="/subscribe" class="stack"><label>Email</label><input name="email" type="email" required><div class="checks">${checks}</div><button>Subscribe</button></form></section>`;
}

async function admin(request, env) {
  const user = await requireAdmin(request, env); if (user instanceof Response) return user;
  const posts = await env.DB.prepare(`SELECT * FROM posts ORDER BY COALESCE(published_at, created_at) DESC LIMIT 100`).all();
  const sources = await env.DB.prepare(`SELECT * FROM sources ORDER BY name ASC`).all();
  const statuses = await env.DB.prepare(`SELECT * FROM service_status ORDER BY name ASC`).all();
  return page("Admin", `
    <section class="hero"><h1>Admin</h1><p>Logged in as ${esc(user.email)}</p><p><a class="button secondary" href="/">Site</a> <a class="button secondary" href="/logout">Logout</a></p></section>
    <section class="panel"><h2>Sync sources</h2><form method="POST" action="/admin/sync"><button>Sync RSS sources now</button></form><form method="POST" action="/admin/digest" style="margin-top:10px"><button class="secondary">Send email digest</button></form></section>
    <section class="panel"><h2>Add / update post</h2>${postForm()}</section>
    <section class="panel"><h2>Posts</h2><div class="tablewrap"><table><thead><tr><th>Title</th><th>Category</th><th>Source</th><th></th></tr></thead><tbody>${(posts.results || []).map(adminPostRow).join("")}</tbody></table></div></section>
    <section class="panel"><h2>RSS sources</h2>${sourceForm()}<div class="tablewrap"><table><thead><tr><th>Name</th><th>Category</th><th>URL</th><th></th></tr></thead><tbody>${(sources.results || []).map(adminSourceRow).join("")}</tbody></table></div></section>
    <section class="panel"><h2>Status services</h2>${(statuses.results || []).map(statusForm).join("")}</section>
  `, env);
}

function postForm(p = {}) {
  return `<form method="POST" action="/admin/post/save" class="stack"><input name="id" placeholder="Optional ID for update" value="${esc(p.id || "")}"><input name="title" placeholder="Title" value="${esc(p.title || "")}" required><input name="summary" placeholder="Summary" value="${esc(p.summary || "")}"><textarea name="content" placeholder="Content">${esc(p.content || "")}</textarea><input name="url" placeholder="Source URL" value="${esc(p.url || "")}"><input name="source_name" placeholder="Source name" value="${esc(p.source_name || "Gaband323")}"><select name="category">${POST_CATEGORIES.map(c => `<option value="${c}" ${p.category === c ? "selected" : ""}>${label(c)}</option>`).join("")}</select><input name="tags" placeholder="Tags, comma-separated" value="${esc(p.tags || "")}"><select name="importance"><option value="normal">Normal</option><option value="important">Important</option><option value="critical">Critical</option></select><label><input type="checkbox" name="is_pinned" value="1" ${p.is_pinned ? "checked" : ""}> Pin post</label><button>Save post</button></form>`;
}

function sourceForm() {
  return `<form method="POST" action="/admin/source/save" class="stack"><input name="name" placeholder="Source name" required><input name="url" placeholder="RSS URL" required><select name="category">${POST_CATEGORIES.map(c => `<option value="${c}">${label(c)}</option>`).join("")}</select><label><input type="checkbox" name="enabled" value="1" checked> Enabled</label><button>Add source</button></form>`;
}

function statusForm(s) {
  return `<form method="POST" action="/admin/status/save" class="statusform"><input type="hidden" name="id" value="${esc(s.id)}"><b>${esc(s.name)}</b><select name="status"><option ${s.status === "operational" ? "selected" : ""} value="operational">Operational</option><option ${s.status === "degraded" ? "selected" : ""} value="degraded">Degraded</option><option ${s.status === "outage" ? "selected" : ""} value="outage">Outage</option><option ${s.status === "unknown" ? "selected" : ""} value="unknown">Unknown</option></select><input name="note" placeholder="Note" value="${esc(s.note || "")}"><button>Save</button></form>`;
}

function adminPostRow(p) {
  return `<tr><td><a href="/post?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a></td><td>${esc(label(p.category))}</td><td>${esc(p.source_name || "")}</td><td><form method="POST" action="/admin/post/delete"><input type="hidden" name="id" value="${esc(p.id)}"><button class="danger">Delete</button></form></td></tr>`;
}

function adminSourceRow(s) {
  return `<tr><td>${esc(s.name)} ${s.enabled ? "" : "(off)"}</td><td>${esc(label(s.category))}</td><td><a href="${esc(s.url)}" target="_blank">${esc(s.url)}</a></td><td><form method="POST" action="/admin/source/delete"><input type="hidden" name="id" value="${esc(s.id)}"><button class="danger">Delete</button></form></td></tr>`;
}

async function adminSavePost(request, env) {
  const user = await requireAdmin(request, env); if (user instanceof Response) return user;
  const f = await request.formData();
  const id = String(f.get("id") || "").trim() || crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO posts (id,title,summary,content,url,source_name,category,tags,importance,is_pinned,is_auto,published_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title=excluded.title, summary=excluded.summary, content=excluded.content, url=excluded.url, source_name=excluded.source_name, category=excluded.category, tags=excluded.tags, importance=excluded.importance, is_pinned=excluded.is_pinned, updated_at=CURRENT_TIMESTAMP`)
    .bind(id, String(f.get("title") || "").trim(), String(f.get("summary") || "").trim(), String(f.get("content") || "").trim(), String(f.get("url") || "").trim(), String(f.get("source_name") || "Gaband323").trim(), cleanCategory(f.get("category") || "ai-models"), String(f.get("tags") || "").trim(), String(f.get("importance") || "normal"), f.get("is_pinned") === "1" ? 1 : 0, new Date().toISOString()).run();
  return redirect("/admin");
}

async function adminDeletePost(request, env) {
  const user = await requireAdmin(request, env); if (user instanceof Response) return user;
  const f = await request.formData();
  await env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(String(f.get("id") || "")).run();
  return redirect("/admin");
}

async function adminSaveSource(request, env) {
  const user = await requireAdmin(request, env); if (user instanceof Response) return user;
  const f = await request.formData();
  await env.DB.prepare(`INSERT INTO sources (id,name,url,category,enabled) VALUES (?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET name=excluded.name, category=excluded.category, enabled=excluded.enabled`)
    .bind(crypto.randomUUID(), String(f.get("name") || "").trim(), String(f.get("url") || "").trim(), cleanCategory(f.get("category") || "ai-models"), f.get("enabled") === "1" ? 1 : 0).run();
  return redirect("/admin");
}

async function adminDeleteSource(request, env) {
  const user = await requireAdmin(request, env); if (user instanceof Response) return user;
  const f = await request.formData();
  await env.DB.prepare(`DELETE FROM sources WHERE id = ?`).bind(String(f.get("id") || "")).run();
  return redirect("/admin");
}

async function adminSaveStatus(request, env) {
  const user = await requireAdmin(request, env); if (user instanceof Response) return user;
  const f = await request.formData();
  await env.DB.prepare(`UPDATE service_status SET status = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(String(f.get("status") || "unknown"), String(f.get("note") || "").trim(), String(f.get("id") || "")).run();
  return redirect("/admin");
}

async function adminSync(request, env) {
  const user = await requireAdmin(request, env); if (user instanceof Response) return user;
  const result = await runSourceSync(env);
  return page("Sync result", `<section class="panel"><h1>Sync result</h1><pre>${esc(JSON.stringify(result, null, 2))}</pre><p><a class="button" href="/admin">Back</a></p></section>`, env);
}

async function adminDigest(request, env) {
  const user = await requireAdmin(request, env); if (user instanceof Response) return user;
  const result = await sendDigest(env);
  return page("Digest result", `<section class="panel"><h1>Digest result</h1><pre>${esc(JSON.stringify(result, null, 2))}</pre><p><a class="button" href="/admin">Back</a></p></section>`, env);
}

async function runSourceSync(env) {
  const sources = await env.DB.prepare(`SELECT * FROM sources WHERE enabled = 1`).all();
  let inserted = 0, updated = 0;
  const failed = [];
  for (const s of sources.results || []) {
    try {
      const res = await fetch(s.url, { headers: { "User-Agent": "Gaband323TechWatch/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const items = parseFeedItems(xml).slice(0, 10);
      for (const item of items) {
        const result = await saveSourcePost(env, item, s);
        if (result === "inserted") inserted++;
        if (result === "updated") updated++;
      }
    } catch (e) {
      failed.push({ source: s.name, url: s.url, error: e.message });
    }
  }
  return { ok: failed.length === 0, inserted, updated, failed };
}

async function saveSourcePost(env, item, source) {
  if (!item.title || !item.url) return "skipped";
  const existing = await env.DB.prepare(`SELECT id FROM posts WHERE url = ?`).bind(item.url).first();
  const id = existing?.id || crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO posts (id,title,summary,content,url,source_name,category,tags,importance,is_pinned,is_auto,published_at,updated_at) VALUES (?,?,?,?,?,?,?,?, 'normal',0,1,?,CURRENT_TIMESTAMP) ON CONFLICT(url) DO UPDATE SET title=excluded.title, summary=excluded.summary, content=excluded.content, source_name=excluded.source_name, category=excluded.category, published_at=excluded.published_at, updated_at=CURRENT_TIMESTAMP`)
    .bind(id, item.title, item.summary, item.summary, item.url, source.name, cleanCategory(source.category), source.category, item.published_at || new Date().toISOString()).run();
  return existing ? "updated" : "inserted";
}

async function sendDigest(env) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "Missing RESEND_API_KEY secret." };
  const subs = await env.DB.prepare(`SELECT * FROM subscriptions WHERE verified = 1 LIMIT 200`).all();
  const posts = await env.DB.prepare(`SELECT * FROM posts ORDER BY COALESCE(published_at, created_at) DESC LIMIT 10`).all();
  const list = (posts.results || []).map(p => `<li><a href="${siteOrigin(env)}/post?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a><br><small>${esc(label(p.category))} · ${esc(p.source_name || "")}</small></li>`).join("");
  let sent = 0; const failed = [];
  for (const sub of subs.results || []) {
    try {
      const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM || "Gaband323 Tech Watch <updates@tech.gaband323.dev>", to: sub.email, subject: env.DIGEST_SUBJECT || "Gaband323 Tech Watch Update", html: `<h1>${esc(siteName(env))}</h1><ul>${list}</ul><p><a href="${siteOrigin(env)}">Open dashboard</a></p>` }) });
      if (!res.ok) throw new Error(await res.text());
      sent++;
    } catch (e) { failed.push({ email: sub.email, error: e.message }); }
  }
  return { ok: failed.length === 0, sent, failed };
}

function postCard(p) {
  return `<article class="post"><p class="meta">${esc(label(p.category))} · ${esc(p.source_name || "Gaband323")} ${p.is_pinned ? "· pinned" : ""}</p><h3><a href="/post?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3><p>${esc(p.summary || "")}</p>${p.url ? `<p><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Source ↗</a></p>` : ""}</article>`;
}

function statusCard(s) {
  const status = String(s.status || "unknown").toLowerCase();
  return `<a class="status ${esc(status)}" href="${esc(s.url || "#")}" target="_blank" rel="noopener noreferrer"><b>${esc(s.name)}</b><span>${esc(label(status))}</span>${s.note ? `<small>${esc(s.note)}</small>` : ""}</a>`;
}

async function feedJson(request, env) {
  const posts = await env.DB.prepare(`SELECT * FROM posts ORDER BY COALESCE(published_at, created_at) DESC LIMIT 50`).all();
  return json({ ok: true, posts: posts.results || [] });
}

async function requireAdmin(request, env) {
  const user = await currentUser(request, env);
  if (!user || user.role !== "admin") return redirect("/login");
  return user;
}

async function currentUser(request, env) {
  const sid = getCookie(request, COOKIE_NAME);
  if (!sid) return null;
  return await env.DB.prepare(`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > ?`).bind(sid, new Date().toISOString()).first();
}

async function createSession(env, userId, location) {
  const sid = crypto.randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).bind(sid, userId, expires.toISOString()).run();
  return redirect(location, { "Set-Cookie": `${COOKIE_NAME}=${sid}; Path=/; Expires=${expires.toUTCString()}; HttpOnly; Secure; SameSite=Lax` });
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

function parseFeedItems(xml) {
  const items = String(xml || "").match(/<item>[\s\S]*?<\/item>/g) || String(xml || "").match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return items.map(raw => {
    const title = decodeHtml(stripCdata(getXmlTag(raw, "title")));
    const link = getXmlTag(raw, "link") || getXmlAttribute(raw, "link", "href");
    const summary = cleanDescription(getXmlTag(raw, "description") || getXmlTag(raw, "summary") || getXmlTag(raw, "content"));
    const dateRaw = decodeHtml(stripCdata(getXmlTag(raw, "pubDate") || getXmlTag(raw, "updated") || getXmlTag(raw, "published")));
    const d = new Date(dateRaw);
    return { title: cleanTitle(title), url: decodeHtml(stripCdata(link)), summary, published_at: Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString() };
  }).filter(x => x.title && x.url);
}

function getXmlTag(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1] : "";
}

function getXmlAttribute(xml, tag, attr) {
  const match = String(xml || "").match(new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? match[1] : "";
}

function stripCdata(value) { return String(value || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim(); }
function decodeHtml(value) { return String(value || "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&#039;", "'").replaceAll("&nbsp;", " "); }
function cleanDescription(value) { return decodeHtml(stripCdata(value)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800); }
function cleanTitle(value) { return decodeHtml(stripCdata(value)).replace(/\s+/g, " ").trim(); }
function paragraphs(text) { return String(text || "").split(/\n{2,}/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join(""); }
function siteName(env) { return env.SITE_NAME || "Gaband323 Tech Watch"; }
function siteOrigin(env) { return env.SITE_ORIGIN || "https://tech.gaband323.dev"; }
function cleanCategory(value) { const c = String(value || "").toLowerCase().trim(); return POST_CATEGORIES.includes(c) ? c : "ai-models"; }
function label(value) { return String(value || "").replaceAll("-", " ").replace(/\b\w/g, c => c.toUpperCase()); }
function isAdminEmail(env, email) { return String(env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).includes(String(email || "").toLowerCase()); }
function getCookie(request, name) { const cookie = request.headers.get("Cookie") || ""; for (const part of cookie.split(";")) { const [k, ...v] = part.trim().split("="); if (k === name) return decodeURIComponent(v.join("=")); } return ""; }
function hex(buffer) { return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function redirect(location, headers = {}) { return new Response(null, { status: 302, headers: { Location: location, ...headers } }); }
function json(data, status = 200) { return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

function page(title, body, env, status = 200) {
  const viewer = env.__viewer;
  const nav = `<nav><a href="/">Home</a><a href="/models">Models</a><a href="/deals">Deals</a><a href="/status">Status</a><a href="/subscribe">Subscribe</a>${viewer?.role === "admin" ? `<a href="/admin">Admin</a>` : ""}${viewer ? `<a href="/logout">Logout</a>` : `<a href="/login">Login</a>`}</nav>`;
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${esc(siteName(env))}</title><style>
    body{margin:0;background:#09090b;color:#f4f4f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}a:hover{color:#4ade80}header{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:16px 24px;background:#111114;border-bottom:1px solid #27272a}header b,.eyebrow{color:#4ade80}nav{display:flex;gap:14px;color:#a1a1aa;flex-wrap:wrap}.wrap{max-width:1180px;margin:0 auto;padding:28px 18px}.hero,.panel,.post,.status{background:#111114;border:1px solid #27272a;border-radius:18px;padding:20px;margin-bottom:16px}.hero{display:flex;justify-content:space-between;gap:16px;align-items:center}.hero h1,h1{font-size:clamp(34px,6vw,64px);line-height:1;margin:0 0 12px}p,.meta,.muted{color:#a1a1aa}.button,button{background:#4ade80;color:#09090b;border:0;border-radius:999px;padding:10px 14px;font-weight:800;display:inline-block;cursor:pointer}.secondary{background:#18181b;color:#f4f4f5;border:1px solid #27272a}.danger{background:#fb7185;color:#09090b}.hero-actions{display:flex;gap:10px;flex-wrap:wrap}.postlist{display:grid;gap:12px}.post h3{margin:.2rem 0;font-size:1.2rem}.statusgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}.status{display:grid;gap:6px}.status span{font-weight:800}.status.operational span{color:#4ade80}.status.degraded span{color:#fbbf24}.status.outage span{color:#fb7185}input,textarea,select{width:100%;box-sizing:border-box;background:#0c0c0f;color:#f4f4f5;border:1px solid #27272a;border-radius:12px;padding:11px;font:inherit}input[type="checkbox"]{width:auto}textarea{min-height:120px}.stack{display:grid;gap:10px}.auth{max-width:460px;margin:30px auto}.tablewrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:700px}th,td{border-bottom:1px solid #27272a;padding:10px;text-align:left;vertical-align:top}pre{white-space:pre-wrap;background:#050507;border:1px solid #27272a;border-radius:12px;padding:12px;overflow:auto}.error{color:#fb7185}.checks{display:grid;gap:6px}@media(max-width:760px){header,.hero{align-items:flex-start;flex-direction:column}}
  </style></head><body><header><a href="/"><b>G</b> ${esc(siteName(env))}</a>${nav}</header><main class="wrap">${body}</main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
