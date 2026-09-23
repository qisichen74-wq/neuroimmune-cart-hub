import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVerification } from "../lib/evidence-policy.mjs";
import { enrollmentLabel } from "../lib/registry-field-evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const readJson = async (name) => JSON.parse(await readFile(path.join(dataDir, name), "utf8"));
const recordsOf = (payload) => Array.isArray(payload) ? payload : payload.records || [];

const [topics, research, companies, trials, events, organizationsPayload, programsPayload, dealsPayload, dealEventsPayload, safety, relations, verification, sources] = await Promise.all([
  "topics.json", "feed.json", "landscape.json", "trials.json", "events.json", "organizations.json", "programs.json",
  "deals.json", "deal-events.json", "safety.json", "relations.json", "verification.json", "sources.json"
].map(readJson));

const sourceMap = new Map(recordsOf(sources).map((source) => [source.id, source]));
const verificationMap = new Map((verification.records || []).map((record) => [`${record.record_type}:${record.record_id}`, record]));
const fieldEvidence = await readJson("registry-field-evidence.json");
const fieldEvidenceMap = new Map(fieldEvidence.records.map((record) => [`${record.record_type}:${record.record_id}`, record]));
const relationMap = new Map();

const relate = (left, right) => {
  if (!left || !right) return;
  if (!relationMap.has(left)) relationMap.set(left, new Set());
  relationMap.get(left).add(right);
};

for (const relation of recordsOf(relations)) {
  const source = `${relation.source_type}:${relation.source_id}`;
  const target = `${relation.target_type}:${relation.target_id}`;
  relate(source, target);
  relate(target, source);
}
for (const topic of recordsOf(topics)) {
  const source = `topic:${topic.id}`;
  for (const [type, ids] of Object.entries(topic.related || {})) {
    for (const id of ids || []) {
      relate(source, `${type}:${id}`);
      relate(`${type}:${id}`, source);
    }
  }
}

const text = (...values) => values.flat(Infinity).filter((value) => value !== null && value !== undefined && value !== "").map((value) => {
  if (typeof value === "object") return Object.values(value).flat(Infinity).filter((part) => typeof part !== "object").join(" ");
  return String(value);
}).join(" · ");

const localUrl = (type, item) => ({
  topic: `topic.html?id=${encodeURIComponent(item.id)}`,
  research: `detail.html?type=research&id=${encodeURIComponent(item.id)}`,
  company: `detail.html?type=company&id=${encodeURIComponent(item.id)}`,
  trial: `detail.html?type=trial&id=${encodeURIComponent(item.id)}`,
  event: `search.html?q=${encodeURIComponent(item.title || item.id)}`,
  organization: `company.html?id=${encodeURIComponent(item.id)}`,
  program: `company.html?id=${encodeURIComponent(item.owner_org_id || "")}`,
  deal: `deal.html?id=${encodeURIComponent(item.id)}`,
  deal_event: `deal.html?id=${encodeURIComponent(item.deal_id)}`,
  safety: `search.html?q=${encodeURIComponent(item.signal || item.id)}`
}[type]);

const configs = [
  { type: "topic", payload: topics, title: (x) => x.name, summary: (x) => x.summary, date: () => topics.as_of || "", tags: (x) => [x.short_name, x.kind, x.maturity, x.priority, ...(x.keywords || [])], content: (x) => text(x.summary, x.thesis, x.unmet_need, x.next_catalyst, x.key_questions, x.evidence_gaps), sourceIds: () => ["internal-curation"] },
  { type: "research", payload: research, title: (x) => x.title_cn || x.official_title, summary: (x) => x.one_liner, date: (x) => x.publish_date, tags: (x) => [x.pmid, x.doi, x.journal, x.disease, x.evidence_level, x.entity, x.region, x.priority, ...(x.tags || [])], content: (x) => text(x.official_title, x.one_liner, x.takeaway, x.priority_reason, x.publication_type), sourceIds: () => ["ncbi-pubmed"] },
  { type: "company", payload: companies, title: (x) => `${x.company} · ${x.product}`, summary: (x) => x.evidence_anchor || x.recent_update, date: (x) => x.source_last_update, tags: (x) => [x.company, x.product, x.technology, x.stage, x.region, x.priority, x.status, x.study_sponsorship, x.development_band, ...(x.focus || [])], content: (x) => text(x.evidence_anchor, x.recent_update, x.watch_points), sourceIds: () => ["company-primary"] },
  { type: "trial", payload: trials, title: (x) => x.trial_name || x.official_title, summary: (x) => x.evidence_goal, date: (x) => x.registry_last_update, tags: (x) => [x.registry_id, x.sponsor, x.product, x.indication, x.phase, x.region, x.status, x.priority, x.study_sponsorship, x.development_band, ...(x.collaborators || [])], content: (x) => text(x.official_title, x.design, x.evidence_goal, x.key_question, x.watch_points, `${enrollmentLabel(fieldEvidenceMap.get(`trial:${x.id}`)?.fields.enrollment_type || x.enrollment_type)} ${x.enrollment ?? "未披露"}`, x.study_start, x.estimated_completion), sourceIds: () => ["clinicaltrials-gov"] },
  { type: "event", payload: events, title: (x) => x.title, summary: (x) => x.summary, date: (x) => x.date, tags: (x) => [x.event_type, x.topic, x.status, x.priority, x.source_label], content: (x) => text(x.summary, x.impact, x.entities), sourceIds: () => ["internal-curation"] },
  { type: "organization", payload: organizationsPayload, title: (x) => x.name, summary: (x) => text(x.kind, x.country, x.ticker), date: () => organizationsPayload.verified_at || organizationsPayload.as_of, tags: (x) => [x.name, x.kind, x.status, x.ticker, x.country], content: (x) => text(x.name, x.kind, x.status, x.ticker, x.country), sourceIds: (x) => x.source_ids || [] },
  { type: "program", payload: programsPayload, title: (x) => x.name, summary: (x) => text(x.technology, x.targets, x.indications, x.status), date: () => programsPayload.verified_at || programsPayload.as_of, tags: (x) => [x.name, ...(x.aliases || []), x.technology, ...(x.targets || []), ...(x.indications || []), x.status], content: (x) => text(x.name, x.aliases, x.technology, x.targets, x.indications, x.status), sourceIds: (x) => x.source_ids || [] },
  { type: "deal", payload: dealsPayload, title: (x) => x.title, summary: (x) => x.investor_relevance, date: (x) => x.announced_date, tags: (x) => [x.deal_type, x.status, x.announced_date, ...(x.program_ids || [])], content: (x) => text(x.investor_relevance, x.terms, x.evidence?.map((evidence) => [evidence.title, evidence.claim_scope, evidence.publication_date])), sourceIds: (x) => x.source_ids || [] },
  { type: "deal_event", payload: dealEventsPayload, title: (x) => x.title, summary: (x) => text(x.event_type, x.date), date: (x) => x.date, tags: (x) => [x.deal_id, x.event_type, x.date], content: (x) => text(x.title, x.event_type, x.date, x.deal_id), sourceIds: (x) => x.source_ids || [] },
  { type: "safety", payload: safety, title: (x) => x.signal, summary: (x) => x.signal_summary, date: (x) => x.last_evidence_review, tags: (x) => [x.category, x.mechanism, x.severity, x.status, x.evidence_level, x.population, ...(x.source_refs || [])], content: (x) => text(x.signal_summary, x.verification_scope, x.management_focus, x.watch_points, x.time_window), sourceIds: () => ["regulatory-primary"] }
];

const documents = [];
for (const config of configs) {
  for (const item of recordsOf(config.payload)) {
    const verificationRecord = resolveVerification({ type: config.type, record: item, payload: config.payload, policy: verification, override: verificationMap.get(`${config.type}:${item.id}`) });
    const sourceIds = [...new Set([...(config.sourceIds(item) || []), ...(verificationRecord.source_ids || [])])];
    const registeredSources = sourceIds.map((id) => sourceMap.get(id)).filter(Boolean);
    const sourceUrl = item.source_url || item.registry_url || item.website || item.evidence?.[0]?.url || registeredSources.find((source) => source.url)?.url || "";
    const title = config.title(item);
    const summary = config.summary(item) || "";
    const content = config.content(item) || summary;
    const tags = config.tags(item).flat(Infinity).filter(Boolean).map(String);
    documents.push({
      type: config.type,
      id: item.id,
      title,
      summary,
      content,
      tags,
      priority: item.priority || item.severity || "中",
      date: config.date(item) || "",
      data_as_of: config.payload.as_of || verification.as_of || "",
      record_url: localUrl(config.type, item),
      source_url: sourceUrl,
      additional_source_urls: item.additional_source_urls || [],
      source_ids: sourceIds,
      source_label: registeredSources.map((source) => source.name).join(" / ") || item.source_name || item.source_label || "站内正式记录",
      source_authority: registeredSources.map((source) => source.authority).filter(Boolean).join(" / ") || "编辑判断",
      verification_status: verificationRecord.status || "待外部核验",
      confidence: verificationRecord.confidence || "待判断",
      last_verified_at: verificationRecord.last_verified_at || "",
      freshness_policy_days: verificationRecord.freshness_policy_days,
      next_review_at: verificationRecord.next_review_at || "",
      verification_note: verificationRecord.note || "",
      field_verification: fieldEvidenceMap.get(`${config.type}:${item.id}`) || null,
      related: [...(relationMap.get(`${config.type}:${item.id}`) || [])],
      search_text: text(title, summary, content, tags)
    });
  }
}

const payload = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  data_as_of: verification.as_of || dealsPayload.as_of || "",
  policy: {
    visibility: "public-formal-records-only",
    candidate_records_included: false,
    disclaimer: "仅供科研与产业情报参考，不构成临床诊疗建议。"
  },
  documents
};

await writeFile(path.join(dataDir, "assistant-index.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Assistant index: ${documents.length} formal records, candidates excluded`);
