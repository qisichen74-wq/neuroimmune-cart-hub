import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || "127.0.0.1";
const isLocalHost = ["127.0.0.1", "localhost", "::1"].includes(host);
const reviewUser = process.env.INTEL_REVIEW_USER || "reviewer";
const reviewPassword = process.env.INTEL_REVIEW_PASSWORD || (isLocalHost ? "review2026" : "");
const sessionTtlMs = 8 * 60 * 60 * 1000;
const sessions = new Map();
const protectedPages = new Set(["/review.html", "/candidates.html", "/quality.html"]);
const protectedData = new Set(["/data/candidate-report.json", "/data/review-decisions.json", "/data/review-workflow.json", "/data/source-sync-report.json"]);
const decisionsPath = path.join(root, "data", "review-decisions.json");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

if (!reviewPassword) {
  throw new Error("Set INTEL_REVIEW_PASSWORD before exposing the site beyond localhost.");
}

const json = (response, status, body, extraHeaders = {}) => {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders });
  response.end(JSON.stringify(body));
};

const redirect = (response, location) => {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  response.end();
};

const cookies = (request) => Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter(([key]) => key));

const getSession = (request) => {
  const token = cookies(request).intel_review_session;
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + sessionTtlMs;
  return { token, ...session };
};

const sameText = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
};

const readBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
};

const readJsonFile = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const writeDecisions = async (payload) => {
  const temporaryPath = `${decisionsPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(temporaryPath, decisionsPath);
};

const candidateId = (candidate) => `${candidate.candidate_type}:${candidate.external_id}`;

const requireApiSession = (request, response) => {
  const session = getSession(request);
  if (!session) json(response, 401, { error: "请先登录" });
  return session;
};

const handleApi = async (request, response, requestUrl) => {
  if (requestUrl.pathname === "/api/login" && request.method === "POST") {
    const body = await readBody(request);
    if (!sameText(body.username, reviewUser) || !sameText(body.password, reviewPassword)) {
      json(response, 401, { error: "账号或密码不正确" });
      return true;
    }
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { user: reviewUser, expiresAt: Date.now() + sessionTtlMs });
    json(response, 200, { user: reviewUser }, { "Set-Cookie": `intel_review_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionTtlMs / 1000}` });
    return true;
  }

  if (requestUrl.pathname === "/api/logout" && request.method === "POST") {
    const session = getSession(request);
    if (session) sessions.delete(session.token);
    json(response, 200, { ok: true }, { "Set-Cookie": "intel_review_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
    return true;
  }

  if (requestUrl.pathname === "/api/session" && request.method === "GET") {
    const session = getSession(request);
    json(response, session ? 200 : 401, session ? { authenticated: true, user: session.user } : { authenticated: false });
    return true;
  }

  if (requestUrl.pathname === "/api/review-queue" && request.method === "GET") {
    const session = requireApiSession(request, response);
    if (!session) return true;
    const report = await readJsonFile(path.join(root, "data", "candidate-report.json"), { candidates: [] });
    const saved = await readJsonFile(decisionsPath, { decisions: [] });
    const completed = new Map((saved.decisions || []).map((decision) => [decision.candidate_id, decision]));
    const query = String(requestUrl.searchParams.get("q") || "").trim().toLowerCase();
    const type = String(requestUrl.searchParams.get("type") || "all");
    const status = String(requestUrl.searchParams.get("status") || "pending");
    const offset = Math.max(0, Number(requestUrl.searchParams.get("offset") || 0));
    const limit = Math.min(100, Math.max(1, Number(requestUrl.searchParams.get("limit") || 40)));
    const all = (report.candidates || []).map((candidate) => ({ ...candidate, candidate_id: candidateId(candidate), review_decision: completed.get(candidateId(candidate)) || null }));
    const filtered = all.filter((candidate) => {
      if (type !== "all" && candidate.candidate_type !== type) return false;
      if (status === "pending" && candidate.review_decision) return false;
      if (status === "completed" && !candidate.review_decision) return false;
      return !query || JSON.stringify(candidate).toLowerCase().includes(query);
    });
    json(response, 200, {
      user: session.user,
      summary: { total: all.length, pending: all.filter((item) => !item.review_decision).length, completed: completed.size, filtered: filtered.length },
      candidates: filtered.slice(offset, offset + limit),
      offset,
      limit
    });
    return true;
  }

  if (requestUrl.pathname.startsWith("/api/reviews/") && request.method === "POST") {
    const session = requireApiSession(request, response);
    if (!session) return true;
    const id = decodeURIComponent(requestUrl.pathname.slice("/api/reviews/".length));
    const body = await readBody(request);
    if (!["confirm", "modify", "exclude"].includes(body.action)) {
      json(response, 400, { error: "无效的审核操作" });
      return true;
    }
    const report = await readJsonFile(path.join(root, "data", "candidate-report.json"), { candidates: [] });
    const candidate = (report.candidates || []).find((item) => candidateId(item) === id);
    if (!candidate) {
      json(response, 404, { error: "未找到候选记录" });
      return true;
    }
    if (body.action === "exclude" && !String(body.reason || "").trim()) {
      json(response, 400, { error: "排除候选时必须填写理由" });
      return true;
    }
    const saved = await readJsonFile(decisionsPath, { generated_at: null, decisions: [] });
    const now = new Date().toISOString();
    const decision = {
      candidate_id: id,
      candidate_type: candidate.candidate_type,
      external_id: candidate.external_id,
      source_url: candidate.source_url,
      reviewer: session.user,
      decision: body.action === "exclude" ? "排除" : "发布",
      action: body.action,
      decision_at: now,
      decision_reason: String(body.reason || (body.action === "modify" ? "核对并修改后确认" : "核对原始来源后确认")).trim(),
      fields: {
        title: String(body.fields?.title || candidate.title || "").trim(),
        entity: String(body.fields?.entity || candidate.sponsor || candidate.journal || candidate.source || "").trim(),
        disease: String(body.fields?.disease || (candidate.matched_diseases || []).join(" / ") || (candidate.conditions || []).join(" / ") || "").trim(),
        note: String(body.fields?.note || "").trim()
      },
      next_review_at: body.action === "exclude" ? null : String(body.next_review_at || "").trim() || null
    };
    const decisions = (saved.decisions || []).filter((item) => item.candidate_id !== id);
    decisions.push(decision);
    await writeDecisions({ generated_at: now, decisions });
    json(response, 200, { ok: true, decision });
    return true;
  }

  return false;
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || host}`);
    if (requestUrl.pathname.startsWith("/api/")) {
      if (await handleApi(request, response, requestUrl)) return;
      json(response, 404, { error: "Not found" });
      return;
    }

    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const requested = decodedPath === "/" ? "/index.html" : decodedPath;
    if (protectedPages.has(requested) && !getSession(request)) {
      redirect(response, `/login.html?next=${encodeURIComponent(requested.slice(1))}`);
      return;
    }
    if (protectedData.has(requested) && !getSession(request)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      response.end("Not Found");
      return;
    }
    const filePath = path.resolve(root, `.${requested}`);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      ...(protectedPages.has(requested) || protectedData.has(requested) ? { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" } : {})
    });
    response.end(body);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 404;
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(status === 400 ? "Bad Request" : "Not Found");
  }
});

server.listen(port, host, () => {
  console.log(`Intelligence hub ready at http://${host}:${port}/`);
  console.log(`Internal review login: ${reviewUser} (password set by INTEL_REVIEW_PASSWORD${process.env.INTEL_REVIEW_PASSWORD ? "" : "; local default enabled"})`);
});
