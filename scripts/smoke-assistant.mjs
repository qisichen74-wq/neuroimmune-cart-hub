import { mkdir, writeFile } from "node:fs/promises";

// Explicit opt-in: this calls the locally running assistant and its configured provider.
if (!process.argv.includes("--live")) throw new Error("Use --live to send two questions and retrieved public evidence to the configured model");
const registryMode = process.argv.includes("--registry");
const questions = registryMode
  ? ["NCT07006805的状态与入组人数是什么？人数是实际还是计划？登记平台未发布结果能说明没有论文吗？"]
  : ["KYV-101有哪些临床试验？请区分登记信息与已完成结果。", "比较 KYV-101 和 CABA-201 的技术路线，说明证据时效限制。"];
const results = [];
for (const question of questions) {
  const start = Date.now();
  const response = await fetch("http://127.0.0.1:8765/api/assistant", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }), signal: AbortSignal.timeout(40000)
  });
  const payload = await response.json();
  const allowed = new Set((payload.sources || []).map((source) => source.citation_id));
  const citations = [...String(payload.answer || "").matchAll(/\[(S\d+)\]/g)].map((match) => match[1]);
  const passed = response.ok && payload.mode === "grounded-answer" && citations.length > 0 && citations.every((id) => allowed.has(id))
    && (!registryMode || payload.sources?.some((item) => item.field_verification?.registry_id === "NCT07006805" && item.field_verification?.current_verified));
  results.push({ question, passed, elapsed_ms: Date.now() - start, ...payload });
  console.log(JSON.stringify({ passed, mode: payload.mode, fallback_reason: payload.fallback_reason, source_count: payload.sources?.length, elapsed_ms: Date.now() - start }));
}
const folder = new URL("../evals/results/", import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(new URL(registryMode ? "live-registry-smoke.json" : "live-smoke.json", folder), JSON.stringify({ tested_at: new Date().toISOString(), scope: "真实调用与引用编号检查，不代表逐句事实核验", results }, null, 2) + "\n");
if (results.some((result) => !result.passed)) process.exitCode = 1;
