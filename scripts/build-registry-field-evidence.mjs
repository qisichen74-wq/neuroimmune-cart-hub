import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const folder = new URL("../evals/verification/2026-09-15/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("reviewed-registry.json", folder)));
const checks = JSON.parse(await readFile(new URL("registry-review.json", folder)));
const trials = JSON.parse(await readFile(new URL("../data/trials.json", import.meta.url)));
const records = [];
for (const reviewed of manifest.records) {
  if (!/^NCT\d{8}$/.test(reviewed.registry_id)) throw Error("Invalid registry identity");
  const raw = await readFile(new URL(`${reviewed.registry_id}.json`, folder));
  if (createHash("sha256").update(raw).digest("hex") !== reviewed.sha256) throw Error("Snapshot changed; review is required again");
  const trial = trials.find((item) => item.id === reviewed.record_id);
  if (trial?.registry_id !== reviewed.registry_id) throw Error("Local trial identity changed");
  const data = JSON.parse(raw);
  const p = data.protocolSection;
  if (p.identificationModule.nctId !== reviewed.registry_id) throw Error("Source identity mismatch");
  const check = checks.records.find((item) => item.registry_id === reviewed.registry_id && item.sha256 === reviewed.sha256 && item.status === "fetched");
  if (!check || check.checked_at.slice(0, 10) !== manifest.reviewed_at) throw Error("Missing same-day source receipt");
  const d = p.designModule;
  const s = p.statusModule;
  records.push({
    record_type: "trial", record_id: trial.id, registry_id: reviewed.registry_id,
    scope: manifest.scope, last_verified_at: manifest.reviewed_at, freshness_policy_days: 7,
    source_url: `https://clinicaltrials.gov/study/${reviewed.registry_id}`, snapshot_sha256: reviewed.sha256,
    checked_at: check.checked_at,
    fields: {
      official_title: p.identificationModule.officialTitle || p.identificationModule.briefTitle,
      sponsor: p.sponsorCollaboratorsModule.leadSponsor.name,
      status: s.overallStatus, phases: d.phases || [], study_type: d.studyType,
      enrollment: d.enrollmentInfo.count, enrollment_type: d.enrollmentInfo.type,
      study_start: s.startDateStruct, completion: s.completionDateStruct,
      registry_last_update: s.lastUpdatePostDateStruct.date,
      registry_has_results: data.hasResults
    },
    limitations: "仅核对所列登记字段；不代表整条档案或编辑判断重新核验。登记平台未发布结果不等于没有论文、会议数据或企业披露。"
  });
}
await writeFile(new URL("../data/registry-field-evidence.json", import.meta.url), JSON.stringify({ schema_version: "1.0", reviewed_at: manifest.reviewed_at, records }, null, 2) + "\n");
console.log(`Registry field evidence: ${records.length} reviewed snapshots; whole-record verification dates unchanged`);
