import { readFile, mkdir, writeFile } from "node:fs/promises";
import { retrieveEvidence } from "../lib/assistant-retrieval.mjs";
import { assessFreshness } from "../lib/evidence-policy.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../${name}`, import.meta.url), "utf8"));
const index = await read("data/assistant-index.json");
const suite = await read("evals/assistant-cases.json");
const now = new Date(`${suite.as_of}T12:00:00+08:00`);
const rows = suite.cases.map((test) => {
  const results = retrieveEvidence(index, test.question, { context: test.context, history: test.history, limit: 10, now });
  const keys = results.map((item) => `${item.type}:${item.id}`);
  const missing = (test.required || []).filter((key) => !keys.includes(key));
  const missingTerms = (test.required_terms || []).filter((term) => !results.some((item) => item.search_text.toLowerCase().includes(term)));
  const passed = !missing.length && !missingTerms.length && (!test.expect_empty || results.length === 0) && results.length <= 10;
  return { id: test.id, question: test.question, passed, missing, missing_terms: missingTerms, retrieved: keys };
});
const states = index.documents.map((item) => assessFreshness(item, now));
const usage = new Map();
for (const row of rows) for (const key of row.retrieved) usage.set(key, (usage.get(key) || 0) + 1);
const reviewQueue = index.documents.filter((item) => !assessFreshness(item, now).current_verified)
  .map((item) => ({ key: `${item.type}:${item.id}`, title: item.title, hits: usage.get(`${item.type}:${item.id}`) || 0, last_verified_at: item.last_verified_at, source_url: item.source_url }))
  .sort((a, b) => b.hits - a.hits || a.key.localeCompare(b.key));
const report = {
  generated_at: new Date().toISOString(), evaluated_at: suite.as_of, scope: suite.scope,
  total: rows.length, passed: rows.filter((row) => row.passed).length,
  evidence: { total: states.length, stale: states.filter((state) => state.stale).length, current_verified: states.filter((state) => state.current_verified).length },
  cases: rows,
  review_queue: reviewQueue
};
const folder = new URL("../evals/results/", import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(new URL("latest.json", folder), JSON.stringify(report, null, 2) + "\n");
const markdown = `# AI 助手离线检索评测\n\n评测日期：${suite.as_of}；数据截至：${index.data_as_of}。\n\n${suite.scope}。仅要求预先指定的关键记录出现在前十条，不测量全部相关资料的召回率。\n\n通过 ${report.passed}/${report.total}。时效统计：${report.evidence.stale} 条超过复核期，${report.evidence.current_verified} 条当前已核验，共 ${report.evidence.total} 条。\n\n| 用例 | 问题 | 结果 |\n| --- | --- | --- |\n${rows.map((row) => `| ${row.id} | ${row.question} | ${row.passed ? "通过" : "未通过"} |`).join("\n")}\n\n模型内容正确性、逐句引用支持、矛盾来源处理和医学结论需要另行人工验收，不包含在上述通过率中。\n`;
await writeFile(new URL("latest.md", folder), markdown);
await writeFile(new URL("review-priority.md", folder), `# 优先复核清单\n\n按固定问题集命中次数排序；未调用外部来源，未更新原始核验日期。此处的排序表示对问答的影响范围，不代表临床重要性。\n\n| 记录 | 命中问题数 | 上次核验 | 来源入口 |\n| --- | --- | --- | --- |\n${reviewQueue.filter((item) => item.hits).slice(0, 20).map((item) => `| ${item.title.replaceAll("|", " / ")} | ${item.hits} | ${item.last_verified_at || "缺失"} | ${/^https?:\/\//.test(item.source_url || "") ? `[查看来源](${item.source_url})` : "需定位一手来源"} |`).join("\n")}\n\n复核时应逐字段记录来源、差异和时间；网页可访问或资料被重新索引不等于事实已重新核验。\n`);
console.log(`Assistant retrieval evaluation: ${report.passed}/${report.total} passed`);
for (const row of rows.filter((row) => !row.passed)) console.log(JSON.stringify(row));
if (report.passed !== report.total) process.exitCode = 1;
