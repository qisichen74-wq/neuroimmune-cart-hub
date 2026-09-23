import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractEvidenceIdentifiers, retrieveEvidence } from "./lib/assistant-retrieval.mjs";
import { answerQuestion } from "./lib/assistant-answer.mjs";

const index = JSON.parse(await readFile(new URL("./data/assistant-index.json", import.meta.url), "utf8"));
const options = { now: new Date("2026-09-15T04:00:00Z"), limit: 10 };
const identifiers = (record) => extractEvidenceIdentifiers([record.id, record.title, record.search_text,
  record.summary, record.content, ...(record.tags || []), record.source_url, ...(record.additional_source_urls || [])].join(" "));
const scoped = (question, expected, extra = {}) => {
  const results = retrieveEvidence(index, question, { ...options, ...extra });
  assert.ok(results.length, question);
  for (const record of results) assert.ok(identifiers(record).some((id) => expected.includes(id)), `Unrelated evidence: ${record.id}`);
  for (const id of expected) assert.ok(results.some((record) => identifiers(record).includes(id)), `Missing ${id}`);
  return results;
};

const exact = scoped("NCT07006805的状态与入组人数是什么？人数是实际还是计划？登记平台未发布结果能说明没有论文吗？", ["nct07006805"]);
assert.ok(exact.some((record) => record.id === "cabaletta-resecel-ms-phase12"));
scoped("nct 07006805 的临床状态和论文结果？", ["nct07006805"]);
scoped("比较 NCT07006805 和 NCT06451159 的实际入组及研究结果", ["nct07006805", "nct06451159"]);
scoped("PMID: 42028700 有哪些发现和局限？", ["pmid42028700"]);
scoped("比较 PMID 40706586 和 PMID 42028700，是两位患者吗？", ["pmid40706586", "pmid42028700"]);
scoped("这项试验的入组人数呢？", ["nct07006805"], { history: [{ role: "user", content: "NCT07006805是什么？" }] });
scoped("这项试验的入组人数呢？", ["nct07006805"], { context: { type: "trial", id: "cabaletta-resecel-ms-phase12" } });
scoped("NCT06451159和它的入组情况", ["nct06451159"], { history: [{ role: "user", content: "NCT07006805是什么？" }] });
scoped("NCT07006805 和 NCT99999999 的临床状态？", ["nct07006805"]);
assert.deepEqual(retrieveEvidence(index, "NCT99999999的临床研究入组人数与论文结果是什么？", options), []);
assert.deepEqual(retrieveEvidence(index, "PMID99999999 的病例报告和疗效", options), []);
assert.deepEqual(extractEvidenceIdentifiers("NCT070068050 PMID420287000 XNCT07006805"), []);

let called = false;
const none = await answerQuestion({ index, question: "NCT99999999的临床入组与论文？", now: options.now,
  apiKey: "mock-key", fetchImpl: async () => { called = true; throw new Error("No network allowed"); } });
assert.equal(none.mode, "no-evidence");
assert.equal(called, false, "Unknown identifiers must not call a model using unrelated evidence");

let prompt;
await answerQuestion({ index, question: "比较 PMID40706586 和 PMID42028700", now: options.now,
  apiKey: "mock-key", fetchImpl: async (_url, request) => {
    prompt = JSON.parse(request.body).messages;
    return Response.json({ choices: [{ message: { content: "同一患者的延长随访不应重复计数。[S1]" }, finish_reason: "stop" }] });
  } });
assert.match(prompt[0].content, /同一患者或队列的延长随访不是新增独立样本/);
assert.match(prompt[0].content, /影像结构结局/);
assert.match(prompt.at(-1).content, /同一患者/);
console.log(`Retrieval scope: 14 regression scenarios passed; exact NCT question returns ${exact.length} relevant records (was 10 mixed records). Mock calls only; not a clinical accuracy evaluation.`);
