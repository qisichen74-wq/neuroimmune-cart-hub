import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Fetches only these high-impact public registry records; never changes production data.
const ids = ["NCT06451159", "NCT06193889", "NCT07403188", "NCT07006805", "NCT06220201"];
const folder = new URL("../evals/verification/2026-09-15/", import.meta.url);
const local = JSON.parse(await readFile(new URL("../data/trials.json", import.meta.url), "utf8"));
const normalize = (x) => String(x ?? "").trim().toLowerCase().replace(/[_,.]/g, " ").replace(/\s+/g, " ");

if (!process.argv.includes("--fetch")) throw new Error("Use --fetch to read five public ClinicalTrials.gov records");
await mkdir(folder, { recursive: true });
const results = [];
for (const id of ids) {
  const url = `https://clinicaltrials.gov/api/v2/studies/${id}`;
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const data = JSON.parse(raw);
    const p = data.protocolSection;
    if (p?.identificationModule?.nctId !== id) throw new Error("Registry identity mismatch");
    await writeFile(new URL(`${id}.json`, folder), raw + "\n");
    const record = local.find((item) => item.registry_id === id);
    const d = p.designModule || {};
    const s = p.statusModule || {};
    const remote = {
      official_title: p.identificationModule.officialTitle || p.identificationModule.briefTitle,
      sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
      status: s.overallStatus,
      phases: d.phases || [],
      study_type: d.studyType,
      enrollment: d.enrollmentInfo?.count,
      enrollment_type: d.enrollmentInfo?.type,
      study_start: s.startDateStruct?.date,
      start_date_type: s.startDateStruct?.type,
      estimated_completion: s.completionDateStruct?.date,
      completion_date_type: s.completionDateStruct?.type,
      registry_last_update: s.lastUpdatePostDateStruct?.date,
      has_results: data.hasResults,
      conditions: p.conditionsModule?.conditions,
      design: d.designInfo,
      primary_outcomes: p.outcomesModule?.primaryOutcomes,
      brief_summary: p.descriptionModule?.briefSummary
    };
    const fields = ["official_title", "sponsor", "status", "enrollment", "study_start", "estimated_completion", "registry_last_update"];
    const comparisons = fields.map((field) => ({ field, local: record?.[field] ?? null, remote: remote[field] ?? null, matches: normalize(record?.[field]) === normalize(remote[field]) }));
    const item = { registry_id: id, record_id: record?.id, checked_at: checkedAt, source_url: `https://clinicaltrials.gov/study/${id}`, api_url: url, sha256: createHash("sha256").update(raw + "\n").digest("hex"), status: "fetched", remote, comparisons };
    results.push(item);
    console.log(JSON.stringify(item));
  } catch (error) {
    const item = { registry_id: id, checked_at: checkedAt, status: "unavailable", error: error.message };
    results.push(item);
    console.log(JSON.stringify(item));
  }
}
await writeFile(new URL("registry-review.json", folder), JSON.stringify({ scope: "字段比对结果；不自动刷新整条记录的核验日期", records: results }, null, 2) + "\n");
if (results.some((item) => item.status !== "fetched")) process.exitCode = 1;
