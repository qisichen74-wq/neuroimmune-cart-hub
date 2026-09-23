import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidatePoolDecision, requiresCandidateDesk } from "./candidate-policy.mjs";
import { createJournalMetricLookup, withJournalMetric } from "./journal-metrics.mjs";
import { answerQuestion } from "../lib/assistant-answer.mjs";
import { resolveAssistantModelConfig } from "../lib/assistant-model-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || "127.0.0.1";
const isLocalHost = ["127.0.0.1", "localhost", "::1"].includes(host);
const workspaceUser = process.env.INTEL_WORKSPACE_USER || process.env.INTEL_REVIEW_USER || "operator";
const workspacePassword = process.env.INTEL_WORKSPACE_PASSWORD || process.env.INTEL_REVIEW_PASSWORD || (isLocalHost ? "workspace2026" : "");
const sessionTtlMs = 8 * 60 * 60 * 1000;
const sessions = new Map();
const protectedPages = new Set(["/desk.html", "/review.html", "/candidates.html", "/quality.html"]);
const protectedData = new Set(["/data/candidate-report.json", "/data/review-decisions.json", "/data/review-workflow.json", "/data/source-sync-report.json"]);
const decisionsPath = path.join(root, "data", "review-decisions.json");
const assistantIndexPath = path.join(root, "data", "assistant-index.json");
const sessionCookie = "intel_workspace_session";
const assistantRateLimits = new Map();
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

if (!workspacePassword) {
  throw new Error("Set INTEL_WORKSPACE_PASSWORD or INTEL_REVIEW_PASSWORD before exposing the site beyond localhost.");
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
  const sessionCookies = cookies(request);
  const token = sessionCookies[sessionCookie] || sessionCookies.intel_review_session;
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
  operator: session.user,
  reviewer: session.user,
  decision: action === "exclude" ? "排除" : "发布",
  action,
  decision_at: now,
  decision_reason: String(reason || (action === "modify" ? "校正字段后收录" : "核对原始来源后收录")).trim(),
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

const allowAssistantRequest = (request) => {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const limit = 30;
  if (assistantRateLimits.size > 5000) {
    for (const [key, value] of assistantRateLimits) if (value.resetAt <= now) assistantRateLimits.delete(key);
  }
  const address = String(request.headers["cf-connecting-ip"] || request.headers["x-forwarded-for"] || request.socket.remoteAddress || "local").split(",")[0].trim();
  const existing = assistantRateLimits.get(address);
  if (!existing || existing.resetAt <= now) {
    assistantRateLimits.set(address, { count: 1, resetAt: now + windowMs });
    return true;
  }
  existing.count += 1;
  return existing.count <= limit;
};

const handleApi = async (request, response, requestUrl) => {
  if (requestUrl.pathname === "/api/assistant" && request.method === "GET") {
    const index = await readJsonFile(assistantIndexPath, { documents: [], data_as_of: "" });
    const modelConfig = resolveAssistantModelConfig(process.env);
    json(response, 200, {
      available: index.documents.length > 0,
      model_configured: modelConfig.configured,
      model_provider: modelConfig.configured ? modelConfig.provider : null,
      data_as_of: index.data_as_of || "",
      records: index.documents.length
    });
    return true;
  }

  if (requestUrl.pathname === "/api/assistant" && request.method === "POST") {
    if (!allowAssistantRequest(request)) {
      json(response, 429, { error: "请求过于频繁，请稍后再试。" });
      return true;
    }
    const body = await readBody(request);
    const question = String(body.question || "").trim();
    if (question.length < 2 || question.length > 800) {
      json(response, 400, { error: "问题长度应为 2–800 个字符。" });
      return true;
    }
    const index = await readJsonFile(assistantIndexPath, { documents: [], data_as_of: "", policy: {} });
    if (!index.documents.length) {
      json(response, 503, { error: "问答索引尚未生成，请先运行站点构建。" });
      return true;
    }
    const context = body.context && typeof body.context === "object" ? {
      type: String(body.context.type || "").slice(0, 40),
      id: String(body.context.id || "").slice(0, 160)
    } : null;
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    const modelConfig = resolveAssistantModelConfig(process.env);
    const answer = await answerQuestion({
      index,
      question,
      history,
      context,
      apiKey: modelConfig.apiKey,
      provider: modelConfig.provider,
      apiProtocol: modelConfig.protocol,
      model: modelConfig.model,
      apiBase: modelConfig.apiBase,
      thinking: modelConfig.thinking
    });
    json(response, 200, answer);
    return true;
  }

  if (requestUrl.pathname === "/api/login" && request.method === "POST") {
    const body = await readBody(request);
    if (!sameText(body.username, workspaceUser) || !sameText(body.password, workspacePassword)) {
      json(response, 401, { error: "账号或密码不正确" });
      return true;
    }
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { user: workspaceUser, expiresAt: Date.now() + sessionTtlMs });
    json(response, 200, { user: workspaceUser }, { "Set-Cookie": `${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionTtlMs / 1000}` });
    return true;
  }

  if (requestUrl.pathname === "/api/logout" && request.method === "POST") {
    const session = getSession(request);
    if (session) sessions.delete(session.token);
    json(response, 200, { ok: true }, { "Set-Cookie": `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
    return true;
  }

  if (requestUrl.pathname === "/api/session" && request.method === "GET") {
    const session = getSession(request);
    json(response, session ? 200 : 401, session ? { authenticated: true, user: session.user } : { authenticated: false });
    return true;
  }

  if (["/api/candidate-desk", "/api/review-queue"].includes(requestUrl.pathname) && request.method === "GET") {
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
    const all = (report.candidates || []).filter(requiresCandidateDesk).map((candidate) => ({ ...withJournalMetric(candidate, journalMetricLookup), candidate_id: candidateId(candidate), review_decision: completed.get(candidateId(candidate)) || null }));
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

  if (["/api/decisions/batch", "/api/reviews/batch"].includes(requestUrl.pathname) && request.method === "POST") {
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
    const blocked = selected.find((candidate) => !requiresCandidateDesk(candidate));
    if (blocked) {
      json(response, 400, { error: blocked.candidate_type === "trial" ? "临床试验作为登记线索保留，无需进入处理台" : candidatePoolDecision(blocked).reason });
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

  if ((requestUrl.pathname.startsWith("/api/decisions/") || requestUrl.pathname.startsWith("/api/reviews/")) && request.method === "POST") {
    const session = requireApiSession(request, response);
    if (!session) return true;
    const prefix = requestUrl.pathname.startsWith("/api/decisions/") ? "/api/decisions/" : "/api/reviews/";
    const id = decodeURIComponent(requestUrl.pathname.slice(prefix.length));
    const body = await readBody(request);
    if (!["confirm", "modify", "exclude"].includes(body.action)) {
      json(response, 400, { error: "无效的处理操作" });
      return true;
    }
    const report = await readJsonFile(path.join(root, "data", "candidate-report.json"), { candidates: [] });
    const candidate = (report.candidates || []).find((item) => candidateId(item) === id);
    if (!candidate) {
      json(response, 404, { error: "未找到候选记录" });
      return true;
    }
    if (!requiresCandidateDesk(candidate)) {
      json(response, 400, { error: candidate.candidate_type === "trial" ? "临床试验作为登记线索保留，无需进入处理台" : candidatePoolDecision(candidate).reason });
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
    console.error(`Cannot start the workspace service: http://${host}:${port}/ is already in use.`);
    console.error(`Stop the old process using port ${port}, then run npm start again.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`Intelligence hub ready at http://${host}:${port}/`);
  console.log(`Internal workspace login: ${workspaceUser} (password set by INTEL_WORKSPACE_PASSWORD${process.env.INTEL_WORKSPACE_PASSWORD ? "" : process.env.INTEL_REVIEW_PASSWORD ? "; legacy env enabled" : "; local default enabled"})`);
});
