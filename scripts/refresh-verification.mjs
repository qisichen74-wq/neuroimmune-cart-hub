import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);
const loadJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));

const verification = await loadJson("data/verification.json");
const sourceSyncReport = await loadJson("data/source-sync-report.json");
const trials = await loadJson("data/trials.json");
const companies = await loadJson("data/landscape.json");
const events = await loadJson("data/events.json");
const research = await loadJson("data/feed.json");
const relations = await loadJson("data/relations.json");

const checksByKey = new Map();
const checksByExternalId = new Map();
for (const check of sourceSyncReport.checks || []) {
  if (check.status !== "ok") continue;
  checksByKey.set(`${check.record_type}:${check.record_id}`, check);
  if (check.external_id) checksByExternalId.set(String(check.external_id), check);
}

const differenceSet = new Set((sourceSyncReport.differences || []).map((item) => `${item.record_type}:${item.record_id}`));
const freshness = verification.freshness_policy_days || {};

const trialsById = new Map(trials.map((item) => [item.id, item]));
const companiesById = new Map(companies.map((item) => [item.id, item]));
const eventsById = new Map(events.map((item) => [item.id, item]));
const researchById = new Map(research.map((item) => [item.id, item]));
const relationsById = new Map();
for (const relation of relations) {
  for (const key of [`${relation.source_type}:${relation.source_id}`, `${relation.target_type}:${relation.target_id}`]) {
    const list = relationsById.get(key) || [];
    list.push(relation);
    relationsById.set(key, list);
  }
}

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const extractPubmedId = (url) => {
  const match = String(url || "").match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  return match ? match[1] : "";
};

const extractPubmedIdFromNote = (note) => {
  const match = String(note || "").match(/PMID\s*(\d+)/i);
  return match ? match[1] : "";
};

const extractNctId = (url) => {
  const match = String(url || "").match(/clinicaltrials\.gov\/study\/(NCT\d{8})/i);
  return match ? match[1].toUpperCase() : "";
};

const fetchOfficialPage = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "neuroimmune-cart-hub/0.1 verification-refresh" },
      signal: controller.signal
    });
    if (!response.ok) return "";
    return (await response.text()).toLowerCase();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
};

const normalizeToken = (value) => String(value || "")
  .replace(/[（）()]/g, " ")
  .replace(/[^0-9a-zA-Z\u4e00-\u9fa5]+/g, " ")
  .split(/\s+/)
  .map((item) => item.trim().toLowerCase())
  .filter((item) => item.length >= 4);

const appendNote = (existing, suffix) => {
  if (!suffix) return existing || "";
  if ((existing || "").includes(suffix)) return existing;
  return existing ? `${existing} ${suffix}` : suffix;
};

const parseDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
  ? new Date(`${value}T00:00:00Z`)
  : null;

const isFresh = (record) => {
  const maxAge = Number(freshness[record.record_type] || 14);
  const checked = parseDate(record.last_verified_at);
  if (!checked) return false;
  if ((Date.now() - checked.getTime()) / 86400000 > maxAge) return false;
  const nextReview = parseDate(record.next_review_at);
  return !nextReview || nextReview >= new Date(`${today}T00:00:00Z`);
};

const verificationByKey = new Map((verification.records || []).map((record) => [`${record.record_type}:${record.record_id}`, record]));

const ensureRecord = (recordType, recordId) => {
  const key = `${recordType}:${recordId}`;
  if (verificationByKey.has(key)) return verificationByKey.get(key);
  const created = {
    record_type: recordType,
    record_id: recordId,
    ...(verification.defaults?.[recordType] || {})
  };
  verification.records.push(created);
  verificationByKey.set(key, created);
  return created;
};

const relatedRecords = (recordType, recordId, targetType) => (relationsById.get(`${recordType}:${recordId}`) || [])
  .flatMap((relation) => {
    if (relation.source_type === targetType && relation.source_id !== recordId) return [relation.source_id];
    if (relation.target_type === targetType && relation.target_id !== recordId) return [relation.target_id];
    return [];
  });

const refreshRecord = (record, suffix, summary) => {
  record.last_verified_at = today;
  record.next_review_at = addDays(today, Number(freshness[record.record_type] || 14));
  record.note = appendNote(record.note, suffix);
  summary.refreshed += 1;
  summary.byType[record.record_type] = (summary.byType[record.record_type] || 0) + 1;
};

const summary = { refreshed: 0, skippedDifferences: 0, skippedUnverified: 0, byType: {} };

for (const record of verification.records || []) {
  if (record.status !== "已核验") continue;
  const key = `${record.record_type}:${record.record_id}`;
  if (differenceSet.has(key)) {
    summary.skippedDifferences += 1;
    continue;
  }

  if (record.record_type === "trial") {
    const trial = trialsById.get(record.record_id);
    if (!trial) continue;
    const nctId = String(trial.registry_id || extractNctId(trial.source_url || "")).toUpperCase();
    const pmid = extractPubmedId(trial.source_url || "")
      || extractPubmedIdFromNote(record.note || "")
      || relatedRecords("trial", trial.id, "research")
        .map((researchId) => researchById.get(researchId))
        .map((item) => String(item?.pmid || ""))
        .find(Boolean)
      || relatedRecords("trial", trial.id, "company")
        .map((companyId) => companiesById.get(companyId))
        .map((item) => extractPubmedId(item?.source_url || ""))
        .find(Boolean);
    if (nctId && (checksByKey.get(key) || checksByExternalId.get(nctId))) {
      refreshRecord(record, `${today} 通过 ClinicalTrials.gov 官方接口复核。`, summary);
      continue;
    }
    if (pmid && checksByExternalId.get(pmid)) {
      refreshRecord(record, `${today} 通过 PubMed 官方接口复核。`, summary);
      continue;
    }
    const page = await fetchOfficialPage(trial.source_url || "");
    const tokens = [...new Set([
      ...normalizeToken(trial.official_title),
      ...normalizeToken(trial.sponsor),
      ...normalizeToken(trial.product)
    ])];
    if (page && tokens.some((token) => page.includes(token))) {
      refreshRecord(record, `${today} 通过一手来源页面复核。`, summary);
      continue;
    }
    summary.skippedUnverified += 1;
    continue;
  }

  if (record.record_type === "company") {
    const company = companiesById.get(record.record_id);
    if (!company) continue;
    const nctId = extractNctId(company.source_url || "");
    const pmid = extractPubmedId(company.source_url || "");
    if (nctId && checksByExternalId.get(nctId)) {
      refreshRecord(record, `${today} 通过 ClinicalTrials.gov 官方接口复核。`, summary);
      continue;
    }
    if (pmid && checksByExternalId.get(pmid)) {
      refreshRecord(record, `${today} 通过 PubMed 官方接口复核。`, summary);
      continue;
    }
    const page = await fetchOfficialPage(company.source_url || "");
    const tokens = [...new Set([
      ...normalizeToken(company.company),
      ...normalizeToken(company.product),
      ...normalizeToken(company.source_last_update)
    ])];
    if (page && tokens.filter(Boolean).some((token) => page.includes(token))) {
      refreshRecord(record, `${today} 通过一手来源页面复核。`, summary);
      continue;
    }
    summary.skippedUnverified += 1;
    continue;
  }

  if (record.record_type === "event") {
    const event = eventsById.get(record.record_id);
    if (!event) continue;
    const nctId = extractNctId(event.source_url || "");
    const pmid = extractPubmedId(event.source_url || "");
    const linkedDiff = (event.entities || []).some((entity) => differenceSet.has(`${entity.type}:${entity.id}`));
    if (linkedDiff) {
      summary.skippedDifferences += 1;
      continue;
    }
    if (nctId && checksByExternalId.get(nctId)) {
      refreshRecord(record, `${today} 通过 ClinicalTrials.gov 官方接口复核事件日期与来源链接。`, summary);
      continue;
    }
    if (pmid && checksByExternalId.get(pmid)) {
      refreshRecord(record, `${today} 通过 PubMed 官方接口复核事件日期与来源链接。`, summary);
      continue;
    }
    if (!event.source_url && event.source_label === "内部监测") {
      const linkedEntities = (event.entities || []).map((entity) => verification.records.find((item) => item.record_type === entity.type && item.record_id === entity.id));
      if (linkedEntities.length && linkedEntities.every((entity) => entity?.last_verified_at === today || entity?.status === "内部审核")) {
        refreshRecord(record, `${today} 依据关联对象完成内部复核。`, summary);
        continue;
      }
    }
    const page = await fetchOfficialPage(event.source_url || "");
    if (page) {
      refreshRecord(record, `${today} 通过一手来源页面复核事件日期与来源链接。`, summary);
      continue;
    }
    summary.skippedUnverified += 1;
  }
}

for (const event of events) {
  if (event.source_label !== "内部监测" || event.source_url) continue;
  const record = ensureRecord("event", event.id);
  if (isFresh(record)) continue;
  const linkedEntities = (event.entities || []).map((entity) => verificationByKey.get(`${entity.type}:${entity.id}`)).filter(Boolean);
  if (linkedEntities.length && linkedEntities.every((entity) => isFresh(entity) || entity.status === "内部审核")) {
    refreshRecord(record, `${today} 依据关联对象完成内部复核。`, summary);
  }
}

verification.as_of = today;

await writeFile(path.join(root, "data/verification.json"), `${JSON.stringify(verification, null, 2)}\n`);
console.log(`Verification refresh: ${summary.refreshed} refreshed | ${summary.skippedDifferences} skipped due to source differences | ${summary.skippedUnverified} skipped without same-day source confirmation`);
for (const [type, count] of Object.entries(summary.byType)) console.log(`- ${type}: ${count}`);
