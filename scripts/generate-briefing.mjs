import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const [research, trials, events, candidates, quality] = await Promise.all([
  load("data/feed.json"), load("data/trials.json"), load("data/events.json"),
  load("data/candidate-report.json"), load("data/quality-report.json")
]);
const priority = { 高: 3, 中: 2, 低: 1 };
const isActive = (status) => !/^Not yet recruiting/i.test(status || "") && /Recruiting|Active/i.test(status || "");
const byDate = (a, b) => String(b.publish_date || b.registry_last_update || b.date || "").localeCompare(String(a.publish_date || a.registry_last_update || a.date || ""));
const latestResearch = research.filter((item) => item.priority === "高").sort(byDate).slice(0, 5);
const activeTrials = trials.filter((item) => isActive(item.status) && item.priority === "高").sort((a, b) => byDate(a, b) || (b.enrollment || 0) - (a.enrollment || 0)).slice(0, 6);
const latestEvents = events.filter((item) => item.source_label !== "内部监测").sort(byDate).slice(0, 5);
const candidateQueue = candidates.candidates.filter((item) => item.triage_tier === "立即核验").slice(0, 6);
const headline = latestResearch[0] || research.sort((a, b) => (priority[b.priority] || 0) - (priority[a.priority] || 0) || byDate(a, b))[0];

const report = {
  generated_at: new Date().toISOString(),
  as_of: quality.as_of,
  headline: headline ? { id: headline.id, title: headline.title_cn, summary: headline.takeaway, source_url: headline.source_url, date: headline.publish_date, evidence_level: headline.evidence_level } : null,
  snapshot: {
    formal_records: quality.summary.total_records,
    externally_verified: quality.summary.verified,
    active_priority_trials: trials.filter((item) => isActive(item.status) && item.priority === "高").length,
    candidate_items: candidates.summary.candidates,
    quality_score: quality.score
  },
  verified_updates: latestEvents.map((item) => ({ id: item.id, title: item.title, summary: item.summary, date: item.date, source_url: item.source_url, topic: item.topic })),
  trial_watch: activeTrials.map((item) => ({ id: item.id, name: item.trial_name, product: item.product, indication: item.indication, status: item.status, enrollment: item.enrollment, last_update: item.registry_last_update, registry_url: item.registry_url })),
  risks: quality.issues.map((item) => ({ code: item.code, record_type: item.record_type, record_id: item.record_id, message: item.message })),
  candidate_queue: candidateQueue.map((item) => ({ type: item.candidate_type, external_id: item.external_id, title: item.title, score: item.relevance_score, tier: item.triage_tier, reasons: item.triage_reasons, source_url: item.source_url })),
  editorial_note: "头条、动态和试验均来自正式核验数据；候选队列仅表示下一步核验优先级。"
};
await writeFile(path.join(root, "data/daily-briefing.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Daily briefing: ${report.verified_updates.length} updates | ${report.trial_watch.length} trials | ${report.risks.length} risks | ${report.candidate_queue.length} candidates`);
