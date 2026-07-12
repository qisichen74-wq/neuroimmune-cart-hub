import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const research = await loadJson("data/feed.json");
const trials = await loadJson("data/trials.json");
const knownPmids = new Set(research.map((item) => item.pmid).filter(Boolean));
const knownNcts = new Set(trials.map((item) => item.registry_id).filter(Boolean));
const generatedAt = new Date().toISOString();

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { "user-agent": "neuroimmune-cart-hub/0.1 discovery" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
};

const diseaseTerms = [
  "multiple sclerosis", "myasthenia gravis", "neuromyelitis optica", "MOGAD",
  "stiff person", "autoimmune encephalitis", "CIDP", "systemic lupus",
  "systemic sclerosis", "myositis", "autoimmune disease"
];
const detectDiseases = (text) => {
  const value = String(text || "").toLowerCase();
  return diseaseTerms.filter((term) => value.includes(term.toLowerCase()));
};
const candidates = [];
const sourceRuns = [];

try {
  const term = `(("CAR T"[Title/Abstract] OR "CAR-T"[Title/Abstract] OR "chimeric antigen receptor"[Title/Abstract]) AND (${diseaseTerms.map((item) => `"${item}"[Title/Abstract]`).join(" OR ")})) AND ("2025/01/01"[Date - Publication] : "3000"[Date - Publication])`;
  const searchParams = new URLSearchParams({ db: "pubmed", term, retmode: "json", retmax: "100", sort: "pub date" });
  const search = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`);
  const ids = search.esearchresult?.idlist || [];
  if (ids.length) {
    const summaryParams = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json" });
    const summary = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`);
    for (const pmid of ids) {
      if (knownPmids.has(pmid)) continue;
      const item = summary.result?.[pmid];
      if (!item) continue;
      const doi = item.articleids?.find((entry) => entry.idtype === "doi")?.value || "";
      candidates.push({
        candidate_type: "research",
        external_id: pmid,
        title: item.title,
        source: "NCBI PubMed",
        source_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        publication_date: item.epubdate || item.pubdate || "",
        journal: item.fulljournalname || item.source || "",
        doi,
        publication_type: item.pubtype || [],
        matched_diseases: detectDiseases(item.title),
        review_status: "待人工核验"
      });
    }
  }
  sourceRuns.push({ source: "NCBI PubMed", status: "ok", results_scanned: ids.length });
} catch (error) {
  sourceRuns.push({ source: "NCBI PubMed", status: "error", error: error.message });
}

try {
  const query = `(CAR-T OR "CAR T" OR "chimeric antigen receptor") AND (${diseaseTerms.map((item) => `"${item}"`).join(" OR ")})`;
  const params = new URLSearchParams({ "query.term": query, pageSize: "100", format: "json", countTotal: "true" });
  const payload = await fetchJson(`https://clinicaltrials.gov/api/v2/studies?${params}`);
  for (const study of payload.studies || []) {
    const protocol = study.protocolSection || {};
    const identification = protocol.identificationModule || {};
    const status = protocol.statusModule || {};
    const design = protocol.designModule || {};
    const conditions = protocol.conditionsModule?.conditions || [];
    const nctId = identification.nctId;
    if (!nctId || knownNcts.has(nctId)) continue;
    candidates.push({
      candidate_type: "trial",
      external_id: nctId,
      title: identification.officialTitle || identification.briefTitle || "",
      source: "ClinicalTrials.gov",
      source_url: `https://clinicaltrials.gov/study/${nctId}`,
      status: status.overallStatus || "",
      last_update_posted: status.lastUpdatePostDateStruct?.date || "",
      phase: design.phases || [],
      enrollment: design.enrollmentInfo?.count ?? null,
      sponsor: protocol.sponsorCollaboratorsModule?.leadSponsor?.name || "",
      conditions,
      matched_diseases: detectDiseases(conditions.join(" ")),
      review_status: "待人工核验"
    });
  }
  sourceRuns.push({ source: "ClinicalTrials.gov", status: "ok", results_scanned: payload.studies?.length || 0, total_results: payload.totalCount ?? null });
} catch (error) {
  sourceRuns.push({ source: "ClinicalTrials.gov", status: "error", error: error.message });
}

const rank = (item) => {
  let score = item.matched_diseases.length * 2;
  if (item.candidate_type === "trial") score += 4;
  if ((item.publication_type || []).some((type) => /clinical trial|randomized|meta-analysis|systematic review/i.test(type))) score += 5;
  if (!/not_yet_recruiting/i.test(item.status || "") && /recruiting|active_not_recruiting/i.test(item.status || "")) score += 2;
  return score;
};
const triage = (item) => {
  const strongEvidence = (item.publication_type || []).some((type) => /clinical trial|randomized|meta-analysis|systematic review/i.test(type));
  const reasons = [];
  if (item.candidate_type === "trial") reasons.push("正式注册试验");
  if (strongEvidence) reasons.push("高等级研究类型");
  if (item.matched_diseases.length) reasons.push(`命中${item.matched_diseases.length}个重点病种`);
  if (!/not_yet_recruiting/i.test(item.status || "") && /recruiting|active_not_recruiting/i.test(item.status || "")) reasons.push("当前处于活跃状态");
  let tier = "低相关";
  if ((item.candidate_type === "trial" && item.relevance_score >= 10) || (item.candidate_type === "research" && strongEvidence && item.relevance_score >= 7)) tier = "立即核验";
  else if (item.relevance_score >= 6) tier = "持续观察";
  else if (item.relevance_score >= 3) tier = "背景材料";
  return { tier, reasons: reasons.length ? reasons : ["仅命中宽泛检索词"] };
};
candidates.forEach((item) => {
  item.relevance_score = rank(item);
  const result = triage(item);
  item.triage_tier = result.tier;
  item.triage_reasons = result.reasons;
});
candidates.sort((a, b) => b.relevance_score - a.relevance_score || String(b.publication_date || b.last_update_posted).localeCompare(String(a.publication_date || a.last_update_posted)));

const report = {
  generated_at: generatedAt,
  policy: "Candidates are discovery leads only. They must be verified against primary records before entering production datasets.",
  query_window: "Publications since 2025-01-01; current ClinicalTrials.gov records",
  summary: {
    candidates: candidates.length,
    research: candidates.filter((item) => item.candidate_type === "research").length,
    trials: candidates.filter((item) => item.candidate_type === "trial").length,
    immediate_review: candidates.filter((item) => item.triage_tier === "立即核验").length,
    watchlist: candidates.filter((item) => item.triage_tier === "持续观察").length,
    background: candidates.filter((item) => item.triage_tier === "背景材料").length,
    low_relevance: candidates.filter((item) => item.triage_tier === "低相关").length,
    source_failures: sourceRuns.filter((item) => item.status === "error").length
  },
  source_runs: sourceRuns,
  candidates
};

await writeFile(path.join(root, "data/candidate-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Discovery: ${report.summary.candidates} candidates | ${report.summary.research} research | ${report.summary.trials} trials | ${report.summary.source_failures} source failures`);
if (report.summary.source_failures) process.exitCode = 2;
