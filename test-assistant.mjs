import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { answerQuestion } from "./lib/assistant-answer.mjs";
import { resolveAssistantModelConfig } from "./lib/assistant-model-config.mjs";
import { extractQueryTerms, retrieveEvidence } from "./lib/assistant-retrieval.mjs";
import { onRequestPost } from "./functions/api/assistant.js";

const index = JSON.parse(await readFile(new URL("./data/assistant-index.json", import.meta.url), "utf8"));

assert.ok(index.documents.length > 0, "Assistant index must contain formal records");
assert.equal(index.policy.candidate_records_included, false, "Candidate records must remain excluded");
assert.ok(!index.documents.some((document) => document.type === "candidate"), "Candidate documents leaked into the public index");

const ms = retrieveEvidence(index, "目前多发性硬化领域有哪些 CAR-T 项目？分别处于什么阶段？", { now: new Date("2026-09-12"), limit: 10 });
assert.ok(ms.some((result) => result.id === "multiple-sclerosis"), "MS dossier should be retrieved");
assert.ok(ms.some((result) => result.type === "trial"), "MS question should retrieve trials");

const comparison = retrieveEvidence(index, "比较 KYV-101 和 CABA-201 的技术路线、适应症与临床进展。", { now: new Date("2026-09-12"), limit: 10 });
assert.ok(comparison.some((result) => result.search_text.toLowerCase().includes("kyv-101")), "Comparison should retrieve KYV-101 evidence");
assert.ok(comparison.some((result) => result.search_text.toLowerCase().includes("caba-201")), "Comparison should retrieve CABA-201 evidence");

const deals = retrieveEvidence(index, "站内记录了哪些自身免疫 CAR-T 相关资本交易？", { now: new Date("2026-09-12"), limit: 5 });
assert.equal(deals[0]?.type, "deal", "Capital question should prioritize deal evidence");

assert.deepEqual(retrieveEvidence(index, "量子香蕉飞船", { now: new Date("2026-09-12") }), [], "Unrelated questions should not fabricate evidence");
assert.ok(extractQueryTerms("比较 KYV-101 和 CABA-201").includes("kyv-101"), "Product identifiers should remain intact");

const fallback = await answerQuestion({ index, question: "KYV-101 有哪些临床试验？", apiKey: "", now: new Date("2026-09-12") });
assert.equal(fallback.mode, "retrieval-only");
assert.ok(fallback.answer.includes("[S1]"), "Retrieval fallback must cite evidence");
assert.ok(fallback.sources.length > 0, "Retrieval fallback must expose evidence cards");

const modelConfig = resolveAssistantModelConfig({ DEEPSEEK_API_KEY: "secret", DEEPSEEK_THINKING: "disabled" });
assert.equal(modelConfig.provider, "deepseek");
assert.equal(modelConfig.protocol, "chat-completions");
assert.equal(modelConfig.model, "deepseek-v4-flash");
assert.equal(resolveAssistantModelConfig({ DEEPSEEK_API_KEY: "secret", ASSISTANT_DISABLE_MODEL: "1" }).configured, false);
assert.equal(resolveAssistantModelConfig({ AI_API_KEY: "secret" }).configured, false, "Generic keys need an explicit model and base URL");

let deepseekRequest;
const grounded = await answerQuestion({
  index,
  question: "KYV-101 有哪些临床试验？",
  apiKey: "test-key",
  provider: "deepseek",
  apiProtocol: "chat-completions",
  model: "deepseek-v4-flash",
  apiBase: "https://api.deepseek.com",
  thinking: "disabled",
  now: new Date("2026-09-12"),
  fetchImpl: async (url, options) => {
    deepseekRequest = { url, body: JSON.parse(options.body), authorization: options.headers.Authorization };
    return new Response(JSON.stringify({ choices: [{ message: { content: "站内记录显示 KYV-101 已有关联临床研究。[S1]" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
assert.equal(grounded.mode, "grounded-answer");
assert.deepEqual(grounded.cited_source_ids, ["S1"]);
assert.equal(deepseekRequest.url, "https://api.deepseek.com/chat/completions");
assert.equal(deepseekRequest.body.model, "deepseek-v4-flash");
assert.equal(deepseekRequest.body.messages[0].role, "system");
assert.deepEqual(deepseekRequest.body.thinking, { type: "disabled" });
assert.equal(deepseekRequest.authorization, "Bearer test-key");

const uncited = await answerQuestion({
  index,
  question: "KYV-101 有哪些临床试验？",
  apiKey: "test-key",
  provider: "openai",
  apiProtocol: "responses",
  now: new Date("2026-09-12"),
  fetchImpl: async () => new Response(JSON.stringify({ output_text: "这是一个没有证据编号的回答。" }), { status: 200, headers: { "Content-Type": "application/json" } })
});
assert.equal(uncited.mode, "retrieval-fallback", "Uncited model output must be rejected");

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (request) => {
  if (String(request.url || request).includes("/data/assistant-index.json")) return new Response(JSON.stringify(index), { status: 200, headers: { "Content-Type": "application/json" } });
  throw new Error("Unexpected external request in Cloudflare function test");
};
const edgeResponse = await onRequestPost({
  request: new Request("https://assistant.test/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
    body: JSON.stringify({ question: "KYV-101 有哪些临床试验？" })
  }),
  env: { ASSISTANT_DISABLE_MODEL: "1" }
});
globalThis.fetch = nativeFetch;
assert.equal(edgeResponse.status, 200, "Cloudflare function should serve retrieval-only answers");
assert.equal((await edgeResponse.json()).mode, "retrieval-only");

console.log("Assistant tests: retrieval, isolation, citations and fallback passed");
