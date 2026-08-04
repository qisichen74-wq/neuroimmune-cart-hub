import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidatePoolDecision, candidateSummary } from "./candidate-policy.mjs";
import { createJournalMetricLookup, withJournalMetric } from "./journal-metrics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const report = await loadJson("data/candidate-report.json");
const config = await loadJson("data/discovery-config.json");
const journalMetrics = await loadJson("data/journal-metrics.json");
const journalMetricLookup = createJournalMetricLookup(journalMetrics);
const decisions = (report.candidates || []).map((candidate) => ({ candidate, decision: candidatePoolDecision(candidate) }));
const normalizeCandidateStatus = (candidate, decision) => {
  if (candidate.candidate_type === "trial") return "试验登记";
  if (decision.eligible) return "待处理";
  return candidate.review_status;
};
const candidates = decisions
  .filter((entry) => entry.decision.eligible)
  .map((entry) => withJournalMetric({
    ...entry.candidate,
    review_status: normalizeCandidateStatus(entry.candidate, entry.decision)
  }, journalMetricLookup));
const excludedResearch = decisions.filter((entry) => entry.candidate.candidate_type === "research" && !entry.decision.eligible);
const {
  trials_exempt_from_review: legacyTrialsExemptFromReview,
  human_review_required: legacyHumanReviewRequired,
  trials_exempt_from_hermes_review: legacyTrialsExemptFromHermesReview,
  hermes_review_required: legacyHermesReviewRequired,
  ...existingSummary
} = report.summary || {};
void legacyTrialsExemptFromReview;
void legacyHumanReviewRequired;
void legacyTrialsExemptFromHermesReview;
void legacyHermesReviewRequired;
const previousExcludedResearch = Number(existingSummary.policy_excluded_research || 0);
const policySummary = candidateSummary(candidates, excludedResearch);

report.policy = "Research candidates must involve CAR-T or cell therapy and identify at least one disease or indication. High-scoring reviews and meta-analyses may be retained without a named disease. Registered clinical trials remain in the candidate pool as registry signals; eligible non-trial candidates enter the candidate desk for handling.";
report.summary = {
  ...existingSummary,
  ...policySummary,
  policy_excluded_research: previousExcludedResearch + policySummary.policy_excluded_research,
  source_failures: existingSummary.source_failures || 0,
  partial_sources: existingSummary.partial_sources || 0,
  truncated_sources: existingSummary.truncated_sources || 0,
  missing_sentinels: existingSummary.missing_sentinels || 0
};
report.candidates = candidates;

const radarData = {
  report: {
    generated_at: report.generated_at,
    summary: report.summary,
    source_runs: (report.source_runs || []).filter((run) => run.source_kind === "official_website"),
    candidates: report.candidates.filter((candidate) => candidate.candidate_type === "official_update")
  },
  config: {
    official_sources: config.official_sources || [],
    entities: config.entities || []
  }
};

await Promise.all([
  writeFile(path.join(root, "data/candidate-report.json"), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(path.join(root, "assets/radar-data.js"), `globalThis.NEUROIMMUNE_RADAR_DATA = ${JSON.stringify(radarData)};\n`)
]);

console.log(`Candidate policy: ${candidates.length} kept | ${report.summary.policy_excluded_research} research excluded | ${report.summary.trials_registry_only} registry trials`);
