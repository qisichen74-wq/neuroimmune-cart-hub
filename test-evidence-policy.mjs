import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessFreshness, resolveVerification } from "./lib/evidence-policy.mjs";
import { assessEvidence, retrieveEvidence, extractQueryTerms } from "./lib/assistant-retrieval.mjs";
import { answerQuestion } from "./lib/assistant-answer.mjs";

const now = new Date("2026-09-15T12:00:00+08:00");
const fresh = { verification_status: "已核验", confidence: "高", last_verified_at: "2026-09-08", freshness_policy_days: 7, next_review_at: "2026-09-15" };
assert.equal(assessFreshness(fresh, now).current_verified, true, "Deadline remains valid throughout the Shanghai calendar day");
assert.equal(assessFreshness(fresh, new Date("2026-09-15T16:00:00Z")).stale, true, "Next calendar day expires the record");
assert.equal(assessFreshness({ ...fresh, last_verified_at: "2026-09-07", next_review_at: "" }, now).stale, true, "Type-specific age expires records without an explicit deadline");
assert.equal(assessFreshness({ ...fresh, last_verified_at: "2026-09-14", next_review_at: "2026-09-14" }, now).stale, true, "Earlier explicit deadline wins");
for (const date of ["", "2026-02-30", "2026-10-01"]) {
  assert.equal(assessFreshness({ ...fresh, last_verified_at: date }, now).current_verified, false, "Missing, invalid or future dates cannot count as verified-current");
}
assert.equal(assessFreshness({ ...fresh, next_review_at: "invalid" }, now).freshness_state, "invalid");
assert.equal(assessEvidence(Array(5).fill({ ...fresh, last_verified_at: "2026-08-01" }), now).confidence, "低", "Many stale sources must not inflate confidence");
assert.equal(assessEvidence([fresh, fresh], now).confidence, "高");
assert.equal(assessEvidence([fresh, { ...fresh, verification_status: "存在冲突" }], now).confidence, "中");

const resolved = resolveVerification({ type: "trial", record: { id: "trial-1", source_ids: ["registry"] }, payload: { verified_at: "2026-09-01" }, policy: { defaults: { trial: { status: "待外部核验" } }, freshness_policy_days: { trial: 7 } }, override: { status: "存在冲突", last_verified_at: "2026-08-01" } });
assert.equal(resolved.status, "存在冲突", "Explicit verification overrides collection metadata");
assert.equal(resolved.last_verified_at, "2026-08-01");
assert.equal(resolveVerification({ type: "trial", record: { id: "x" }, payload: { verified_at: "2026-09-01" }, policy: { defaults: { trial: { status: "待外部核验" } } } }).status, "待外部核验", "Collection date alone does not prove a record's sources");

const index = JSON.parse(await readFile(new URL("./data/assistant-index.json", import.meta.url)));
const audit = JSON.parse(await readFile(new URL("./data/quality-report.json", import.meta.url)));
const auditedAt = new Date(audit.generated_at);
const rows = new Map(audit.verification.map((row) => [`${row.record_type}:${row.record_id}`, row]));
assert.equal(index.documents.length, rows.size, "Index covers all audited formal records");
for (const item of index.documents) {
  const row = rows.get(`${item.type}:${item.id}`);
  assert.ok(row, `Missing audit record ${item.id}`);
  const actual = assessFreshness(item, auditedAt);
  assert.equal(actual.stale, row.stale, `Audit/index stale mismatch: ${item.id}`);
  assert.equal(actual.current_verified, row.current_verified, `Audit/index verified mismatch: ${item.id}`);
}
assert.equal(audit.summary.stale, audit.verification.filter((row) => row.stale).length);
for (const dataset of audit.datasets) assert.ok(dataset.stale <= dataset.records, "Stale count must be unique records, not summed warning categories");
assert.ok(extractQueryTerms("Cartesian Cellares").includes("cellares"), "English stop words must not corrupt company names");
assert.ok(retrieveEvidence(index, "KYV-101 CABA-201", { limit: 1, now }).length <= 1, "Identifier preservation respects the evidence limit");

let calls = 0;
const historicalIndex = { ...index, documents: index.documents.map((item) => ({ ...item, field_verification: null, last_verified_at: "2026-08-01", next_review_at: "2026-08-02" })) };
const invoke = (payload) => answerQuestion({ index: historicalIndex, question: "KYV-101有哪些临床试验？", apiKey: "fake", now, fetchImpl: async () => { calls++; return new Response(JSON.stringify(payload)); } });
for (const content of ["没有引用。", "一个结论[S1]。另一个结论[S999]。", "全部来自虚构证据[S999]。"]) {
  assert.equal((await invoke({ choices: [{ message: { content }, finish_reason: "stop" }] })).mode, "retrieval-fallback");
}
assert.equal((await invoke({ choices: [{ message: { content: "截断答案[S1]" }, finish_reason: "length" }] })).mode, "retrieval-fallback");
const accepted = await invoke({ choices: [{ message: { content: "历史记录中有关联试验[S1]。" }, finish_reason: "stop" }] });
assert.equal(accepted.mode, "grounded-answer");
assert.equal(accepted.confidence, "低");
assert.ok(accepted.answer.startsWith("当前命中资料没有"), "All-stale disclaimer is enforced outside model prompting");
assert.equal(accepted.validation_scope, "citation-ids-only", "Do not represent identifier checks as semantic verification");
const before = calls;
const empty = await answerQuestion({ index, question: "量子香蕉飞船", apiKey: "fake", now, fetchImpl: () => { calls++; throw Error("Must not call"); } });
assert.equal(empty.mode, "no-evidence");
assert.equal(calls, before);
const timedOut = await answerQuestion({ index, question: "KYV-101有哪些临床试验？", apiKey: "fake", now, timeoutMs: 5, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))) });
assert.equal(timedOut.mode, "retrieval-fallback");
console.log("Evidence policy tests: calendar boundaries, all-record audit parity, confidence, citation rejection and timeout passed");
