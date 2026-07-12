import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const trials = await loadJson("data/trials.json");
const research = await loadJson("data/feed.json");
const checkedAt = new Date().toISOString();
let previousSnapshots = { records: {} };
let changeHistory = { generated_at: checkedAt, changes: [] };
try { previousSnapshots = await loadJson("data/source-snapshots.json"); } catch {}
try { changeHistory = await loadJson("data/change-history.json"); } catch {}
const nextSnapshots = { generated_at: checkedAt, records: {} };

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { "user-agent": "neuroimmune-cart-hub/0.1 source-audit" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
};

const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const comparable = (value) => clean(value).replace(/[.。]$/, "");
const normalizeStatus = (value) => clean(value).split("（")[0].toUpperCase().replaceAll(" ", "_").replaceAll(",", "");
const normalizeMonth = (value) => clean(value).slice(0, 7);
const differences = [];
const checks = [];

const recordDifference = (recordType, recordId, field, localValue, remoteValue, sourceUrl) => {
  if (comparable(localValue) === comparable(remoteValue)) return;
  differences.push({ record_type: recordType, record_id: recordId, field, local_value: localValue, remote_value: remoteValue, source_url: sourceUrl });
};

for (const trial of trials.filter((record) => record.record_kind === "registered_trial" && record.registry_id)) {
  const sourceUrl = `https://clinicaltrials.gov/study/${trial.registry_id}`;
  try {
    const payload = await fetchJson(`https://clinicaltrials.gov/api/v2/studies/${trial.registry_id}`);
    const protocol = payload.protocolSection || {};
    const identification = protocol.identificationModule || {};
    const status = protocol.statusModule || {};
    const design = protocol.designModule || {};
    const sponsor = protocol.sponsorCollaboratorsModule?.leadSponsor?.name || "";
    const remote = {
      official_title: identification.officialTitle || identification.briefTitle || "",
      sponsor,
      status: status.overallStatus || "",
      enrollment: design.enrollmentInfo?.count ?? null,
      study_start: status.startDateStruct?.date || "",
      estimated_completion: status.completionDateStruct?.date || "",
      registry_last_update: status.lastUpdatePostDateStruct?.date || ""
    };
    recordDifference("trial", trial.id, "official_title", trial.official_title, remote.official_title, sourceUrl);
    if (!clean(trial.sponsor).toLowerCase().includes(clean(remote.sponsor).toLowerCase()) && !clean(remote.sponsor).toLowerCase().includes(clean(trial.sponsor).toLowerCase())) {
      recordDifference("trial", trial.id, "sponsor", trial.sponsor, remote.sponsor, sourceUrl);
    }
    if (normalizeStatus(trial.status) !== normalizeStatus(remote.status)) recordDifference("trial", trial.id, "status", trial.status, remote.status, sourceUrl);
    recordDifference("trial", trial.id, "enrollment", trial.enrollment, remote.enrollment, sourceUrl);
    recordDifference("trial", trial.id, "study_start", trial.study_start, remote.study_start, sourceUrl);
    if (normalizeMonth(trial.estimated_completion) !== normalizeMonth(remote.estimated_completion)) recordDifference("trial", trial.id, "estimated_completion", trial.estimated_completion, remote.estimated_completion, sourceUrl);
    recordDifference("trial", trial.id, "registry_last_update", trial.registry_last_update, remote.registry_last_update, sourceUrl);
    checks.push({ record_type: "trial", record_id: trial.id, external_id: trial.registry_id, status: "ok", source_url: sourceUrl, remote });
    nextSnapshots.records[`trial:${trial.id}`] = remote;
  } catch (error) {
    checks.push({ record_type: "trial", record_id: trial.id, external_id: trial.registry_id, status: "error", source_url: sourceUrl, error: error.message });
  }
}

const pmids = research.map((record) => record.pmid).filter(Boolean);
if (pmids.length) {
  const chunks = [];
  for (let index = 0; index < pmids.length; index += 100) chunks.push(pmids.slice(index, index + 100));
  for (const chunk of chunks) {
    try {
      const params = new URLSearchParams({ db: "pubmed", id: chunk.join(","), retmode: "json" });
      const payload = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${params}`);
      for (const pmid of chunk) {
        const record = research.find((item) => item.pmid === pmid);
        const remote = payload.result?.[pmid];
        const sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
        if (!remote) {
          checks.push({ record_type: "research", record_id: record.id, external_id: pmid, status: "error", source_url: sourceUrl, error: "PMID missing from ESummary response" });
          continue;
        }
        const doi = remote.articleids?.find((item) => item.idtype === "doi")?.value || "";
        recordDifference("research", record.id, "official_title", record.official_title, remote.title, sourceUrl);
        recordDifference("research", record.id, "doi", record.doi, doi, sourceUrl);
        const snapshot = { official_title: remote.title, doi, publication_date: remote.epubdate || remote.pubdate || "" };
        checks.push({ record_type: "research", record_id: record.id, external_id: pmid, status: "ok", source_url: sourceUrl, remote: snapshot });
        nextSnapshots.records[`research:${record.id}`] = snapshot;
      }
    } catch (error) {
      for (const pmid of chunk) {
        const record = research.find((item) => item.pmid === pmid);
        checks.push({ record_type: "research", record_id: record.id, external_id: pmid, status: "error", source_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, error: error.message });
      }
    }
  }
}

const report = {
  generated_at: checkedAt,
  source_policy: "Official APIs are compared with local structured fields; differences require editorial review and are never auto-applied.",
  summary: {
    records_checked: checks.length,
    successful: checks.filter((item) => item.status === "ok").length,
    failed: checks.filter((item) => item.status === "error").length,
    differences: differences.length
  },
  differences,
  checks
};

const trackedFields = ["official_title", "doi", "publication_date", "sponsor", "status", "enrollment", "study_start", "estimated_completion", "registry_last_update"];
for (const [key, snapshot] of Object.entries(nextSnapshots.records)) {
  const previous = previousSnapshots.records?.[key];
  if (!previous) continue;
  const [recordType, recordId] = key.split(":");
  for (const field of trackedFields) {
    if (previous[field] == null || snapshot[field] == null || String(previous[field]) === String(snapshot[field])) continue;
    changeHistory.changes.push({ detected_at: checkedAt, record_type: recordType, record_id: recordId, field, previous_value: previous[field], current_value: snapshot[field] });
  }
}
changeHistory.generated_at = checkedAt;
changeHistory.changes = changeHistory.changes.slice(-1000);

await writeFile(path.join(root, "data/source-sync-report.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(root, "data/source-snapshots.json"), `${JSON.stringify(nextSnapshots, null, 2)}\n`);
await writeFile(path.join(root, "data/change-history.json"), `${JSON.stringify(changeHistory, null, 2)}\n`);
console.log(`Source check: ${report.summary.successful}/${report.summary.records_checked} reached | ${report.summary.differences} differences | ${report.summary.failed} failures`);
if (report.summary.failed) process.exitCode = 2;
