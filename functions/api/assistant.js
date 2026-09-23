import { answerQuestion } from "../../lib/assistant-answer.mjs";
import { resolveAssistantModelConfig } from "../../lib/assistant-model-config.mjs";

const rateLimits = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function allowRequest(request) {
  const now = Date.now();
  if (rateLimits.size > 5000) {
    for (const [key, value] of rateLimits) if (value.resetAt <= now) rateLimits.delete(key);
  }
  const key = request.headers.get("CF-Connecting-IP") || "anonymous";
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  current.count += 1;
  return current.count <= 30;
}

async function loadIndex(request, env) {
  const url = new URL("/data/assistant-index.json", request.url);
  const assetRequest = new Request(url, { headers: { Accept: "application/json" } });
  const response = env?.ASSETS ? await env.ASSETS.fetch(assetRequest) : await fetch(assetRequest);
  if (!response.ok) throw new Error("Assistant index is unavailable");
  return response.json();
}

export async function onRequestGet({ request, env }) {
  try {
    const index = await loadIndex(request, env);
    const modelConfig = resolveAssistantModelConfig(env);
    return json({
      available: Array.isArray(index.documents) && index.documents.length > 0,
      model_configured: modelConfig.configured,
      model_provider: modelConfig.configured ? modelConfig.provider : null,
      data_as_of: index.data_as_of || "",
      records: index.documents?.length || 0
    });
  } catch {
    const modelConfig = resolveAssistantModelConfig(env);
    return json({ available: false, model_configured: modelConfig.configured, model_provider: modelConfig.configured ? modelConfig.provider : null, data_as_of: "", records: 0 }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!allowRequest(request)) return json({ error: "请求过于频繁，请稍后再试。" }, 429);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64 * 1024) return json({ error: "请求内容过大。" }, 413);
  try {
    const body = await request.json();
    const question = String(body.question || "").trim();
    if (question.length < 2 || question.length > 800) return json({ error: "问题长度应为 2–800 个字符。" }, 400);
    const index = await loadIndex(request, env);
    const context = body.context && typeof body.context === "object" ? {
      type: String(body.context.type || "").slice(0, 40),
      id: String(body.context.id || "").slice(0, 160)
    } : null;
    const modelConfig = resolveAssistantModelConfig(env);
    const answer = await answerQuestion({
      index,
      question,
      history: Array.isArray(body.history) ? body.history.slice(-6) : [],
      context,
      apiKey: modelConfig.apiKey,
      provider: modelConfig.provider,
      apiProtocol: modelConfig.protocol,
      model: modelConfig.model,
      apiBase: modelConfig.apiBase,
      thinking: modelConfig.thinking
    });
    return json(answer);
  } catch {
    return json({ error: "问答服务暂时不可用，请稍后重试。" }, 500);
  }
}
