import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidatePoolDecision, requiresHumanReview } from "./candidate-policy.mjs";
import { createJournalMetricLookup, withJournalMetric } from "./journal-metrics.mjs";

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

const buildDecision = ({ candidate, session, action, reason, fields = {}, nextReviewAt = "", now }) => ({
  candidate_id: candidateId(candidate),
  candidate_type: candidate.candidate_type,
  external_id: candidate.external_id,
  source_url: candidate.source_url,
  reviewer: session.user,
  decision: action === "exclude" ? "排除" : "发布",
  action,
  decision_at: now,
  decision_reason: String(reason || (action === "modify" ? "核对并修改后确认" : "核对原始来源后确认")).trim(),
  fields: {
    title: String(fields.title || candidate.title || "").trim(),
    entity: String(fields.entity || candidate.sponsor || candidate.journal || candidate.source || "").trim(),
    disease: String(fields.disease || (candidate.matched_diseases || []).join(" / ") || (candidate.conditions || []).join(" / ") || "").trim(),
    note: String(fields.note || "").trim()
  },
  next_review_at: action === "exclude" ? null : String(nextReviewAt || "").trim() || null
});

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
    const journalMetrics = await readJsonFile(path.join(root, "data", "journal-metrics.json"), { journals: [] });
    const journalMetricLookup = createJournalMetricLookup(journalMetrics);
    const saved = await readJsonFile(decisionsPath, { decisions: [] });
    const completed = new Map((saved.decisions || []).map((decision) => [decision.candidate_id, decision]));
    const query = String(requestUrl.searchParams.get("q") || "").trim().toLowerCase();
    const type = String(requestUrl.searchParams.get("type") || "all");
    const status = String(requestUrl.searchParams.get("status") || "pending");
    const offset = Math.max(0, Number(requestUrl.searchParams.get("offset") || 0));
    const limit = Math.min(100, Math.max(1, Number(requestUrl.searchParams.get("limit") || 40)));
    const all = (report.candidates || []).filter(requiresHumanReview).map((candidate) => ({ ...withJournalMetric(candidate, journalMetricLookup), candidate_id: candidateId(candidate), review_decision: completed.get(candidateId(candidate)) || null }));
    const filtered = all.filter((candidate) => {
      if (type !== "all" && candidate.candidate_type !== type) return false;
      if (status === "pending" && candidate.review_decision) return false;
      if (status === "completed" && !candidate.review_decision) return false;
      return !query || JSON.stringify(candidate).toLowerCase().includes(query);
    });
    json(response, 200, {
      user: session.user,
      summary: {
        total: all.length,
        pending: all.filter((item) => !item.review_decision).length,
        completed: all.filter((item) => item.review_decision).length,
        filtered: filtered.length,
        trials_exempt: (report.candidates || []).filter((item) => item.candidate_type === "trial").length
      },
      candidates: filtered.slice(offset, offset + limit),
      offset,
      limit
    });
    return true;
  }

  if (requestUrl.pathname === "/api/reviews/batch" && request.method === "POST") {
    const session = requireApiSession(request, response);
    if (!session) return true;
    const body = await readBody(request);
    if (!["confirm", "exclude"].includes(body.action)) {
      json(response, 400, { error: "批量操作只支持确认或排除" });
      return true;
    }
    const ids = [...new Set((Array.isArray(body.candidate_ids) ? body.candidate_ids : []).map(String).filter(Boolean))];
    if (!ids.length || ids.length > 100) {
      json(response, 400, { error: "每次请选择 1–100 条候选" });
      return true;
    }
    if (body.action === "exclude" && !String(body.reason || "").trim()) {
      json(response, 400, { error: "批量排除时必须填写统一理由" });
      return true;
    }
    const report = await readJsonFile(path.join(root, "data", "candidate-report.json"), { candidates: [] });
    const candidates = new Map((report.candidates || []).map((candidate) => [candidateId(candidate), candidate]));
    const selected = ids.map((id) => candidates.get(id));
    if (selected.some((candidate) => !candidate)) {
      json(response, 404, { error: "部分候选已不存在，请刷新后重试" });
      return true;
    }
    const blocked = selected.find((candidate) => !requiresHumanReview(candidate));
    if (blocked) {
      json(response, 400, { error: blocked.candidate_type === "trial" ? "临床试验无需人工审核" : candidatePoolDecision(blocked).reason });
      return true;
    }
    const saved = await readJsonFile(decisionsPath, { generated_at: null, decisions: [] });
    const now = new Date().toISOString();
    const replacements = selected.map((candidate) => buildDecision({ candidate, session, action: body.action, reason: body.reason, now }));
    const replacementIds = new Set(replacements.map((decision) => decision.candidate_id));
    const decisions = (saved.decisions || []).filter((decision) => !replacementIds.has(decision.candidate_id));
    decisions.push(...replacements);
    await writeDecisions({ generated_at: now, decisions });
    json(response, 200, { ok: true, count: replacements.length, decisions: replacements });
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
    if (!requiresHumanReview(candidate)) {
      json(response, 400, { error: candidate.candidate_type === "trial" ? "临床试验无需人工审核" : candidatePoolDecision(candidate).reason });
      return true;
    }
    if (body.action === "exclude" && !String(body.reason || "").trim()) {
      json(response, 400, { error: "排除候选时必须填写理由" });
      return true;
    }
    const saved = await readJsonFile(decisionsPath, { generated_at: null, decisions: [] });
    const now = new Date().toISOString();
    const decision = buildDecision({ candidate, session, action: body.action, reason: body.reason, fields: body.fields, nextReviewAt: body.next_review_at, now });
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

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Cannot start the review service: http://${host}:${port}/ is already in use.`);
    console.error(`Stop the old process using port ${port}, then run npm start again.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`Intelligence hub ready at http://${host}:${port}/`);
  console.log(`Internal review login: ${reviewUser} (password set by INTEL_REVIEW_PASSWORD${process.env.INTEL_REVIEW_PASSWORD ? "" : "; local default enabled"})`);
});
