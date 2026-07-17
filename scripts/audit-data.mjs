import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date();
today.setHours(0, 0, 0, 0);

const definitions = {
  research: { file: "data/feed.json", label: "研究证据", required: ["id", "pmid", "title_cn", "official_title", "source_url", "publish_date", "date_added"] },
  company: { file: "data/landscape.json", label: "竞争对象", required: ["id", "company", "product", "priority", "status"] },
  trial: { file: "data/trials.json", label: "临床试验", required: ["id", "trial_name", "sponsor", "product", "indication", "priority", "status"] },
  safety: { file: "data/safety.json", label: "安全信号", required: ["id", "signal", "category", "severity", "status", "evidence_level", "related_trials", "source_refs", "verification_scope", "last_evidence_review"] },
  event: { file: "data/events.json", label: "动态事件", required: ["id", "date", "event_type", "title", "priority", "source_label", "entities"] },
  topic: { file: "data/topics.json", label: "专题档案", required: ["id", "name", "kind", "priority", "thesis", "related"] }
};

const loadJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const datasets = Object.fromEntries(await Promise.all(Object.entries(definitions).map(async ([type, definition]) => [type, await loadJson(definition.file)])));
const relations = await loadJson("data/relations.json");
const sources = await loadJson("data/sources.json");
const verification = await loadJson("data/verification.json");
let sourceSyncReport = null;
try { sourceSyncReport = await loadJson("data/source-sync-report.json"); }
catch { /* The first online source check creates this report. */ }
let candidateReport = null;
try { candidateReport = await loadJson("data/candidate-report.json"); }
catch { /* The first online discovery run creates this report. */ }
let regulatoryReport = null;
try { regulatoryReport = await loadJson("data/regulatory-watch-report.json"); }
catch { /* The first regulatory check creates this report. */ }
const issues = [];
const addIssue = (severity, code, message, recordType = "system", recordId = "-") => issues.push({ severity, code, record_type: recordType, record_id: recordId, message });
const isBlank = (value) => value == null || value === "" || (Array.isArray(value) && value.length === 0);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const parseDate = (value) => datePattern.test(value || "") ? new Date(`${value}T00:00:00`) : null;
const validUrl = (value) => { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } };

const idSets = {};
const globalIds = new Map();
for (const [type, records] of Object.entries(datasets)) {
  idSets[type] = new Set();
  for (const record of records) {
    for (const field of definitions[type].required) {
      if (isBlank(record[field])) addIssue("error", "required_missing", `缺少必填字段 ${field}`, type, record.id || "-");
    }
    if (record.id) {
      if (idSets[type].has(record.id)) addIssue("error", "duplicate_id", "同一数据集中出现重复ID", type, record.id);
      idSets[type].add(record.id);
      if (globalIds.has(record.id)) addIssue("error", "global_duplicate_id", `与 ${globalIds.get(record.id)} 数据集ID重复`, type, record.id);
      globalIds.set(record.id, type);
    }
  }
}

for (const record of datasets.research) {
  for (const field of ["publish_date", "date_added"]) {
    const parsed = parseDate(record[field]);
    if (!parsed) addIssue("error", "invalid_date", `${field} 不是 YYYY-MM-DD`, "research", record.id);
    else if (parsed > today) addIssue("error", "future_date", `${field} 晚于当前日期`, "research", record.id);
  }
  if (!validUrl(record.source_url)) addIssue("error", "invalid_source_url", "来源链接无效", "research", record.id);
  if (record.pmid && !record.source_url.includes(record.pmid)) addIssue("error", "pmid_url_mismatch", "PMID与来源链接不一致", "research", record.id);
  if (parseDate(record.publish_date) > parseDate(record.date_added)) addIssue("warning", "added_before_publication", "收录日期早于发布日期", "research", record.id);
}

for (const event of datasets.event) {
  const eventDate = parseDate(event.date);
  if (!eventDate) addIssue("error", "invalid_date", "事件日期不是 YYYY-MM-DD", "event", event.id);
  else if (eventDate > today) addIssue("error", "future_date", "事件日期晚于当前日期", "event", event.id);
  if (event.source_label !== "内部监测" && !validUrl(event.source_url)) addIssue("warning", "external_event_source_missing", "外部事件缺少可访问来源", "event", event.id);
  for (const entity of event.entities || []) {
    if (!idSets[entity.type]?.has(entity.id)) addIssue("error", "broken_event_reference", `事件关联对象不存在：${entity.type}/${entity.id}`, "event", event.id);
  }
  const researchRef = (event.entities || []).find((entity) => entity.type === "research");
  if (researchRef) {
    const research = datasets.research.find((record) => record.id === researchRef.id);
    if (research && research.publish_date !== event.date) addIssue("error", "event_publication_date_mismatch", `事件日期 ${event.date} 与文献发布日期 ${research.publish_date} 不一致`, "event", event.id);
  }
}

for (const trial of datasets.trial) {
  if (trial.record_kind === "registered_trial") {
    if (!/^NCT\d{8}$/.test(trial.registry_id || "")) addIssue("error", "invalid_registry_id", "注册试验缺少合法NCT号", "trial", trial.id);
    if (!validUrl(trial.registry_url) || !trial.registry_url.includes(trial.registry_id)) addIssue("error", "registry_url_mismatch", "注册链接与NCT号不一致", "trial", trial.id);
    const registryUpdate = parseDate(trial.registry_last_update);
    if (!registryUpdate) addIssue("error", "invalid_registry_update_date", "注册库更新时间格式错误", "trial", trial.id);
    else if ((today - registryUpdate) / 86400000 > 180) addIssue("warning", "registry_record_stale", "注册库记录超过180天未更新，当前状态需谨慎解释", "trial", trial.id);
  }
}

for (const company of datasets.company) {
  if (company.source_url && !validUrl(company.source_url)) addIssue("error", "invalid_company_source", "公司一手来源链接无效", "company", company.id);
}

for (const signal of datasets.safety) {
  const reviewDate = parseDate(signal.last_evidence_review);
  if (!reviewDate) addIssue("error", "invalid_safety_review_date", "安全证据复核日期格式错误", "safety", signal.id);
  else if ((today - reviewDate) / 86400000 > verification.freshness_policy_days.safety) addIssue("warning", "safety_evidence_stale", "安全证据已超过复核周期", "safety", signal.id);
  for (const trialId of signal.related_trials || []) {
    if (!idSets.trial.has(trialId)) addIssue("error", "broken_safety_trial_reference", `安全信号关联试验不存在：${trialId}`, "safety", signal.id);
  }
}

for (const relation of relations) {
  if (!idSets[relation.source_type]?.has(relation.source_id)) addIssue("error", "broken_relation_source", `关系源对象不存在：${relation.source_type}/${relation.source_id}`, "relation", relation.id);
  if (!idSets[relation.target_type]?.has(relation.target_id)) addIssue("error", "broken_relation_target", `关系目标对象不存在：${relation.target_type}/${relation.target_id}`, "relation", relation.id);
}

for (const topic of datasets.topic) {
  for (const [type, ids] of Object.entries(topic.related || {})) {
    if (new Set(ids).size !== ids.length) addIssue("error", "duplicate_topic_reference", `专题内存在重复关联：${type}`, "topic", topic.id);
    for (const id of ids) if (!idSets[type]?.has(id)) addIssue("error", "broken_topic_reference", `专题关联对象不存在：${type}/${id}`, "topic", topic.id);
  }
}

const topicIndicationPatterns = {
  MS: /(^|\W)(MS|multiple sclerosis|多发性硬化)(\W|$)/i,
  MG: /(^|\W)(g?MG|myasthenia gravis|重症肌无力)(\W|$)/i,
  SSc: /(^|\W)(SSc|systemic sclerosis|系统性硬化)(\W|$)/i,
  NMOSD: /(^|\W)(NMOSD|neuromyelitis optica|视神经脊髓炎)(\W|$)/i,
  AE: /(^|\W)(AE|AiE|autoimmune encephalitis|自身免疫性脑炎)(\W|$)/i,
  CIDP: /(^|\W)(CIDP|chronic inflammatory demyelinating polyneuropathy|慢性炎性脱髓鞘)(\W|$)/i,
  IIM: /(^|\W)(IIM|idiopathic inflammatory myopath(?:y|ies)|inflammatory myositis|dermatomyositis|antisynthetase|IMNM|特发性炎性肌病|特发性肌炎|皮肌炎|抗合成酶|坏死性肌病)(\W|$)/i
};
const topicShortNames = new Set();
for (const topic of datasets.topic.filter((record) => record.kind === "疾病专题")) {
  if (topicShortNames.has(topic.short_name)) addIssue("error", "duplicate_indication_topic", `适应症专题缩写重复：${topic.short_name}`, "topic", topic.id);
  topicShortNames.add(topic.short_name);
  const indicationPattern = topicIndicationPatterns[topic.short_name];
  if (!indicationPattern) continue;
  for (const trialId of topic.related?.trial || []) {
    const trial = datasets.trial.find((record) => record.id === trialId);
    if (trial && !indicationPattern.test(trial.indication || "")) addIssue("error", "topic_trial_indication_mismatch", `试验适应症不包含 ${topic.short_name}：${trialId}`, "topic", topic.id);
  }
}

const sourceIds = new Set();
for (const source of sources) {
  if (sourceIds.has(source.id)) addIssue("error", "duplicate_source_id", "来源ID重复", "source", source.id);
  sourceIds.add(source.id);
  if (source.url && !validUrl(source.url) && !source.url.endsWith(".html")) addIssue("warning", "invalid_registry_url", "来源登记链接无效", "source", source.id);
}

const overrides = new Map(verification.records.map((record) => [`${record.record_type}:${record.record_id}`, record]));
const verificationRows = [];
let staleCount = 0;
for (const [type, records] of Object.entries(datasets)) {
  for (const record of records) {
    const override = overrides.get(`${type}:${record.id}`);
    const resolved = { record_type: type, record_id: record.id, ...(verification.defaults[type] || {}), ...(override || {}) };
    const maxAge = verification.freshness_policy_days[type];
    let stale = false;
    if (resolved.last_verified_at) {
      const checked = parseDate(resolved.last_verified_at);
      if (!checked) addIssue("error", "invalid_verification_date", "核验日期格式错误", type, record.id);
      else stale = (today - checked) / 86400000 > maxAge;
    }
    if (resolved.next_review_at && parseDate(resolved.next_review_at) < today) stale = true;
    if (stale) {
      staleCount += 1;
      addIssue("warning", "verification_stale", `已超过 ${maxAge} 天复核周期`, type, record.id);
    }
    if (resolved.status === "待外部核验") addIssue("warning", "external_verification_pending", "尚未完成一手来源逐字段核验", type, record.id);
    for (const sourceId of resolved.source_ids || []) if (!sourceIds.has(sourceId)) addIssue("error", "unknown_verification_source", `核验来源未登记：${sourceId}`, type, record.id);
    verificationRows.push({ ...resolved, stale });
  }
}

for (const record of verification.records) {
  if (!idSets[record.record_type]?.has(record.record_id)) addIssue("error", "orphan_verification_record", "核验记录对应对象不存在", record.record_type, record.record_id);
}

if (!sourceSyncReport) {
  addIssue("warning", "source_sync_missing", "尚未生成官方API来源差异报告，请运行 npm run check:sources");
} else {
  const generatedAt = new Date(sourceSyncReport.generated_at);
  const ageDays = Number.isNaN(generatedAt.getTime()) ? Infinity : (Date.now() - generatedAt.getTime()) / 86400000;
  if (ageDays > 2) addIssue("warning", "source_sync_stale", "官方API来源差异报告已超过2天未刷新");
  for (const check of sourceSyncReport.checks || []) {
    if (check.status === "error") addIssue("warning", "source_check_failed", `官方来源访问失败：${check.error || "未知错误"}`, check.record_type, check.record_id);
  }
  for (const difference of sourceSyncReport.differences || []) {
    addIssue("warning", "official_source_difference", `官方来源字段已变化：${difference.field}`, difference.record_type, difference.record_id);
  }
}

if (!candidateReport) {
  addIssue("warning", "candidate_report_missing", "尚未生成候选情报报告，请运行 npm run discover:sources");
} else {
  const generatedAt = new Date(candidateReport.generated_at);
  const ageDays = Number.isNaN(generatedAt.getTime()) ? Infinity : (Date.now() - generatedAt.getTime()) / 86400000;
  if (ageDays > 2) addIssue("warning", "candidate_report_stale", "候选情报报告已超过2天未刷新");
  for (const run of candidateReport.source_runs || []) {
    if (run.status === "error") addIssue("warning", "discovery_source_failed", `候选情报来源访问失败：${run.source} / ${run.error || "未知错误"}`);
    if (run.status === "partial") addIssue("warning", "discovery_source_partial", `候选情报来源仅部分访问成功：${run.source}`);
    if (run.truncated) addIssue("warning", "discovery_source_truncated", `候选情报来源结果被上限截断：${run.source}`);
    for (const sentinel of run.sentinel_check?.missing || []) addIssue("warning", "discovery_sentinel_missing", `漏检哨兵未命中：${run.source} / ${sentinel.external_id}`);
  }
}

if (!regulatoryReport) {
  addIssue("warning", "regulatory_report_missing", "尚未生成监管来源监测报告，请运行 npm run check:regulatory");
} else {
  const generatedAt = new Date(regulatoryReport.generated_at);
  const ageDays = Number.isNaN(generatedAt.getTime()) ? Infinity : (Date.now() - generatedAt.getTime()) / 86400000;
  if (ageDays > 2) addIssue("warning", "regulatory_report_stale", "监管来源监测报告已超过2天未刷新");
  for (const check of regulatoryReport.checks || []) if (check.status === "error") addIssue("warning", "regulatory_source_failed", `监管来源访问失败：${check.name}`);
}

const htmlFiles = (await readdir(root)).filter((file) => file.endsWith(".html"));
const htmlFileSet = new Set(htmlFiles);
for (const file of htmlFiles) {
  const html = await readFile(path.join(root, file), "utf8");
  if (!html.includes('src="assets/app-shell.js"')) addIssue("error", "shared_shell_missing", "页面未接入共享导航与质量状态", "page", file);
  for (const match of html.matchAll(/href="([^"#]+\.html)(?:\?[^"#]*)?"/g)) {
    const target = match[1].replace(/^\.\//, "");
    if (!htmlFileSet.has(target)) addIssue("error", "broken_internal_page_link", `内部页面链接不存在：${target}`, "page", file);
  }
  for (const match of html.matchAll(/src="([^":]+)"/g)) {
    try { await access(path.join(root, match[1])); }
    catch { addIssue("error", "missing_local_asset", `本地资源不存在：${match[1]}`, "page", file); }
  }
}

const errors = issues.filter((issue) => issue.severity === "error").length;
const warnings = issues.filter((issue) => issue.severity === "warning").length;
const verified = verificationRows.filter((row) => row.status === "已核验" && !row.stale).length;
const internallyReviewed = verificationRows.filter((row) => row.status === "内部审核" && !row.stale).length;
const pending = verificationRows.filter((row) => row.status === "待外部核验").length;
const registryStaleCount = issues.filter((issue) => issue.code === "registry_record_stale").length;
const totalRecords = Object.values(datasets).reduce((sum, records) => sum + records.length, 0);
const score = Math.max(0, 100 - errors * 12 - warnings);
const report = {
  generated_at: new Date().toISOString(),
  as_of: verification.as_of,
  policy_version: verification.policy_version,
  status: errors ? "阻断" : warnings ? "需关注" : "通过",
  score,
  summary: { total_records: totalRecords, datasets: Object.keys(datasets).length, errors, warnings, verified, internally_reviewed: internallyReviewed, pending_external_verification: pending, stale: staleCount + registryStaleCount, source_checks: sourceSyncReport?.summary || null, discovery: candidateReport?.summary || null, regulatory: regulatoryReport?.summary || null },
  datasets: Object.entries(datasets).map(([type, records]) => ({ type, label: definitions[type].label, records: records.length, verified: verificationRows.filter((row) => row.record_type === type && row.status === "已核验" && !row.stale).length, pending: verificationRows.filter((row) => row.record_type === type && row.status === "待外部核验").length, stale: verificationRows.filter((row) => row.record_type === type && row.stale).length + issues.filter((issue) => issue.record_type === type && issue.code === "registry_record_stale").length })),
  checks: ["必填字段", "重复ID", "日期格式与未来日期", "来源链接与PMID一致性", "试验注册号与注册页一致性", "注册记录更新时间", "专题适应症与试验匹配", "专题关联去重", "官方API逐字段差异", "官方来源检查时效", "候选情报发现时效", "候选来源可用性", "NMPA/CDE监管入口可用性", "监管状态分级", "文献与事件日期一致性", "跨表引用完整性", "来源登记完整性", "核验覆盖与过期策略", "页面内部链接", "共享导航与本地资源"],
  issues,
  verification: verificationRows
};

await writeFile(path.join(root, "data/quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Data audit: ${report.status} | score ${score} | ${errors} errors | ${warnings} warnings | ${verified}/${totalRecords} externally verified`);
if (errors) process.exitCode = 1;
