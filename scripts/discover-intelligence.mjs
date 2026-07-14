import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const [research, trials, events, landscape, config] = await Promise.all([
  loadJson("data/feed.json"),
  loadJson("data/trials.json"),
  loadJson("data/events.json"),
  loadJson("data/landscape.json"),
  loadJson("data/discovery-config.json")
]);
let previousReport = null;
try { previousReport = await loadJson("data/candidate-report.json"); } catch {}

const knownPmids = new Set(research.map((item) => item.pmid).filter(Boolean).map(String));
const knownNcts = new Set(trials.map((item) => item.registry_id).filter(Boolean));
const generatedAt = new Date().toISOString();
const candidates = [];
const sourceRuns = [];
const maxRecordsPerQuery = config.max_records_per_query || 5000;
const sentinelsFor = (source) => (config.sentinels || []).filter((sentinel) => sentinel.source === source);
const sentinelCheck = (source, observedIds) => {
  const observed = new Set([...observedIds].map(normalizeUrl));
  const expected = sentinelsFor(source);
  return {
    expected: expected.map((sentinel) => sentinel.external_id),
    found: expected.filter((sentinel) => observed.has(normalizeUrl(sentinel.external_id))).map((sentinel) => sentinel.external_id),
    missing: expected.filter((sentinel) => !observed.has(normalizeUrl(sentinel.external_id))).map((sentinel) => ({ external_id: sentinel.external_id, reason: sentinel.reason }))
  };
};

const normalizeUrl = (value) => {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(value || "").trim();
  }
};
const knownUrls = new Set(
  [...research, ...trials, ...events, ...landscape]
    .flatMap((item) => [item.source_url, item.registry_url])
    .filter(Boolean)
    .map(normalizeUrl)
);
const previousOfficialRuns = new Map(
  (previousReport?.source_runs || [])
    .filter((run) => run.source_kind === "official_website" && run.source_id)
    .map((run) => [run.source_id, run])
);

const fetchResponse = async (url) => {
  const response = await fetch(url, {
    headers: { "user-agent": "neuroimmune-cart-hub/0.2 discovery" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
};
const fetchJson = async (url) => (await fetchResponse(url)).json();
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const includesAlias = (text, alias) => {
  const value = String(text || "");
  if (/^[a-z0-9-]{2,5}$/i.test(alias)) return new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(value);
  return value.toLowerCase().includes(alias.toLowerCase());
};

const diseases = [
  { label: "multiple sclerosis", aliases: ["multiple sclerosis", "MS"] },
  { label: "myasthenia gravis", aliases: ["myasthenia gravis", "MG"] },
  { label: "neuromyelitis optica", aliases: ["neuromyelitis optica", "NMOSD"] },
  { label: "MOGAD", aliases: ["MOGAD", "myelin oligodendrocyte glycoprotein antibody-associated disease"] },
  { label: "stiff person", aliases: ["stiff person", "SPS"] },
  { label: "autoimmune encephalitis", aliases: ["autoimmune encephalitis"] },
  { label: "CIDP", aliases: ["CIDP", "chronic inflammatory demyelinating polyneuropathy"] },
  { label: "systemic lupus", aliases: ["systemic lupus", "SLE", "lupus nephritis"] },
  { label: "systemic sclerosis", aliases: ["systemic sclerosis", "scleroderma"] },
  { label: "myositis", aliases: ["myositis", "inflammatory myopathy", "IIM"] },
  { label: "immune thrombocytopenia", aliases: ["immune thrombocytopenia", "ITP"] },
  { label: "autoimmune disease", aliases: ["autoimmune disease", "autoimmune diseases"] }
];
const detectDiseases = (text) => diseases
  .filter((disease) => disease.aliases.some((alias) => includesAlias(text, alias)))
  .map((disease) => disease.label);
const entityById = new Map(config.entities.map((entity) => [entity.id, entity]));
const detectEntities = (text) => config.entities
  .filter((entity) => entity.aliases.some((alias) => includesAlias(text, alias)))
  .map((entity) => entity.id);
const detectPriorityEntities = (text) => config.entities
  .filter((entity) => (entity.priority_aliases || []).some((alias) => includesAlias(text, alias)))
  .map((entity) => entity.id);
const entityClause = (entity) => entity.aliases.map((alias) => `"${alias}"`).join(" OR ");
const diseaseClause = diseases
  .flatMap((disease) => disease.aliases.filter((alias) => alias.length > 3))
  .map((term) => `"${term}"`)
  .join(" OR ");

const fetchPubmedIds = async (term) => {
  const ids = [];
  let total = 0;
  const pageSize = 500;
  for (let retstart = 0; retstart < maxRecordsPerQuery; retstart += pageSize) {
    const params = new URLSearchParams({ db: "pubmed", term, retmode: "json", retmax: String(pageSize), retstart: String(retstart), sort: "pub date" });
    const payload = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`);
    total = Number(payload.esearchresult?.count || 0);
    const page = payload.esearchresult?.idlist || [];
    ids.push(...page);
    if (!page.length || ids.length >= total) break;
  }
  return { ids, total, truncated: ids.length < total };
};

try {
  const dateRange = `("${config.publication_start_date}"[Date - Publication] : "3000"[Date - Publication])`;
  const themeTerm = `(("CAR T"[Title/Abstract] OR "CAR-T"[Title/Abstract] OR "chimeric antigen receptor"[Title/Abstract]) AND (${diseaseClause.split(" OR ").map((term) => `${term}[Title/Abstract]`).join(" OR ")})) AND ${dateRange}`;
  const queryRuns = [];
  const pmidMatches = new Map();
  const pubmedQueries = [
    { id: "theme", term: themeTerm, entityId: null },
    ...config.entities.map((entity) => ({
      id: `entity:${entity.id}`,
      term: `((${entity.aliases.map((alias) => `"${alias}"[Title/Abstract]`).join(" OR ")})) AND ${dateRange}`,
      entityId: entity.id
    }))
  ];
  for (const query of pubmedQueries) {
    const result = await fetchPubmedIds(query.term);
    queryRuns.push({ query_id: query.id, total_results: result.total, results_scanned: result.ids.length, truncated: result.truncated });
    for (const pmid of result.ids) {
      const match = pmidMatches.get(pmid) || { queryIds: new Set(), entityIds: new Set() };
      match.queryIds.add(query.id);
      if (query.entityId) match.entityIds.add(query.entityId);
      pmidMatches.set(pmid, match);
    }
  }
  const ids = [...pmidMatches.keys()];
  const knownRecordsSeen = ids.filter((pmid) => knownPmids.has(pmid));
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const params = new URLSearchParams({ db: "pubmed", id: chunk.join(","), retmode: "json" });
    const summary = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${params}`);
    for (const pmid of chunk) {
      if (knownPmids.has(pmid)) continue;
      const item = summary.result?.[pmid];
      if (!item) continue;
      const match = pmidMatches.get(pmid);
      const matchedDiseases = detectDiseases(item.title);
      const priorityEntities = detectPriorityEntities(item.title);
      const matchedEntityIds = new Set([
        ...priorityEntities,
        ...(matchedDiseases.length ? [...match.entityIds, ...detectEntities(item.title)] : [])
      ]);
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
        matched_diseases: matchedDiseases,
        matched_entities: [...matchedEntityIds],
        query_matches: [...match.queryIds],
        review_status: "待人工核验"
      });
    }
  }
  sourceRuns.push({
    source: "NCBI PubMed",
    source_kind: "official_api",
    status: "ok",
    results_scanned: ids.length,
    known_records_seen: knownRecordsSeen,
    sentinel_check: sentinelCheck("pubmed", ids),
    query_runs: queryRuns,
    truncated: queryRuns.some((run) => run.truncated)
  });
} catch (error) {
  sourceRuns.push({ source: "NCBI PubMed", source_kind: "official_api", status: "error", error: error.message });
}

const fetchClinicalTrials = async (term) => {
  const studies = [];
  let pageToken = "";
  let total = 0;
  do {
    const params = new URLSearchParams({ "query.term": term, pageSize: "100", format: "json", countTotal: "true" });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await fetchJson(`https://clinicaltrials.gov/api/v2/studies?${params}`);
    total = payload.totalCount ?? total;
    studies.push(...(payload.studies || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken && studies.length < maxRecordsPerQuery);
  return { studies, total, truncated: Boolean(pageToken) || studies.length < total };
};

try {
  const themeQuery = `(CAR-T OR "CAR T" OR "chimeric antigen receptor") AND (${diseaseClause})`;
  const queryRuns = [];
  const studyMatches = new Map();
  const trialQueries = [
    { id: "theme", term: themeQuery, entityId: null },
    ...config.entities.map((entity) => ({ id: `entity:${entity.id}`, term: `(${entityClause(entity)})`, entityId: entity.id }))
  ];
  for (const query of trialQueries) {
    const result = await fetchClinicalTrials(query.term);
    queryRuns.push({ query_id: query.id, total_results: result.total, results_scanned: result.studies.length, truncated: result.truncated });
    for (const study of result.studies) {
      const nctId = study.protocolSection?.identificationModule?.nctId;
      if (!nctId) continue;
      const match = studyMatches.get(nctId) || { study, queryIds: new Set(), entityIds: new Set() };
      match.queryIds.add(query.id);
      if (query.entityId) match.entityIds.add(query.entityId);
      studyMatches.set(nctId, match);
    }
  }
  const knownRecordsSeen = [...studyMatches.keys()].filter((nctId) => knownNcts.has(nctId));
  for (const [nctId, match] of studyMatches) {
    if (knownNcts.has(nctId)) continue;
    const protocol = match.study.protocolSection || {};
    const identification = protocol.identificationModule || {};
    const status = protocol.statusModule || {};
    const design = protocol.designModule || {};
    const conditions = protocol.conditionsModule?.conditions || [];
    const searchable = [
      identification.officialTitle,
      identification.briefTitle,
      conditions.join(" "),
      protocol.descriptionModule?.briefSummary,
      ...(protocol.armsInterventionsModule?.interventions || []).flatMap((intervention) => [intervention.name, intervention.description]),
      protocol.sponsorCollaboratorsModule?.leadSponsor?.name,
      ...(protocol.sponsorCollaboratorsModule?.collaborators || []).map((collaborator) => collaborator.name)
    ].filter(Boolean).join(" ");
    const matchedDiseases = detectDiseases(`${conditions.join(" ")} ${identification.officialTitle || ""} ${identification.briefTitle || ""}`);
    const priorityEntities = detectPriorityEntities(searchable);
    const matchedEntityIds = new Set([
      ...priorityEntities,
      ...(matchedDiseases.length ? [...match.entityIds, ...detectEntities(searchable)] : [])
    ]);
    if (!match.queryIds.has("theme") && !matchedDiseases.length && !priorityEntities.length) continue;
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
      matched_diseases: matchedDiseases,
      matched_entities: [...matchedEntityIds],
      query_matches: [...match.queryIds],
      review_status: "待人工核验"
    });
  }
  sourceRuns.push({
    source: "ClinicalTrials.gov",
    source_kind: "official_api",
    status: "ok",
    results_scanned: studyMatches.size,
    known_records_seen: knownRecordsSeen,
    sentinel_check: sentinelCheck("clinicaltrials", studyMatches.keys()),
    query_runs: queryRuns,
    truncated: queryRuns.some((run) => run.truncated)
  });
} catch (error) {
  sourceRuns.push({ source: "ClinicalTrials.gov", source_kind: "official_api", status: "error", error: error.message });
}

const decodeHtml = (value) => clean(String(value || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, "\"")
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">"));
const extractAnchors = (html, pageUrl) => {
  const anchors = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(match[1], pageUrl);
      if (!/^https?:$/.test(url.protocol)) continue;
      anchors.push({ url: normalizeUrl(url), text: decodeHtml(match[2]) });
    } catch {}
  }
  return anchors;
};
const extractAssets = (html, pageUrl) => {
  const assets = [];
  for (const match of html.matchAll(/<(?:img|source)\b[^>]*(?:src|srcset)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    try { assets.push(normalizeUrl(new URL(match[1].split(/\s+/)[0], pageUrl))); } catch {}
  }
  return assets;
};

for (const officialSource of config.official_sources || []) {
  const queue = [...officialSource.urls];
  const seen = new Set();
  const discoveredLinks = new Map();
  const observedLinks = new Set();
  const monitoredAssets = new Set();
  const pageContentHashes = new Map();
  const errors = [];
  while (queue.length && seen.size < officialSource.max_pages) {
    const pageUrl = normalizeUrl(queue.shift());
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);
    try {
      const html = await (await fetchResponse(pageUrl)).text();
      pageContentHashes.set(pageUrl, createHash("sha256").update(decodeHtml(html)).digest("hex"));
      const anchors = extractAnchors(html, pageUrl);
      if (officialSource.monitor_assets) extractAssets(html, pageUrl).forEach((asset) => monitoredAssets.add(asset));
      for (const anchor of anchors) {
        observedLinks.add(anchor.url);
        const sameOrigin = new URL(anchor.url).origin === new URL(pageUrl).origin;
        if (sameOrigin && (officialSource.follow_link_patterns || []).some((pattern) => anchor.url.includes(pattern)) && !seen.has(anchor.url)) queue.push(anchor.url);
        if (!sameOrigin || !anchor.text || knownUrls.has(anchor.url)) continue;
        const matchedDiseases = detectDiseases(anchor.text);
        const priorityEntities = detectPriorityEntities(anchor.text);
        const matchedEntities = new Set([
          ...priorityEntities,
          ...(matchedDiseases.length ? detectEntities(anchor.text) : [])
        ]);
        if (!matchedDiseases.length) continue;
        discoveredLinks.set(anchor.url, { ...anchor, matchedEntities: [...matchedEntities], matchedDiseases });
      }
    } catch (error) {
      errors.push({ url: pageUrl, error: error.message });
    }
  }
  for (const item of discoveredLinks.values()) {
    candidates.push({
      candidate_type: "official_update",
      external_id: item.url,
      title: item.text,
      source: officialSource.name,
      source_url: item.url,
      publication_date: "",
      matched_diseases: item.matchedDiseases,
      matched_entities: item.matchedEntities,
      query_matches: [`official:${officialSource.id}`],
      review_status: "待人工核验"
    });
  }
  const fingerprintInput = JSON.stringify({
    pages: [...seen].sort(),
    links: [...discoveredLinks.keys()].sort(),
    assets: [...monitoredAssets].sort(),
    page_content: [...pageContentHashes].sort(([left], [right]) => left.localeCompare(right))
  });
  const fingerprint = createHash("sha256").update(fingerprintInput).digest("hex");
  const previous = previousOfficialRuns.get(officialSource.id);
  const fingerprintVersion = 2;
  const changed = previous?.fingerprint && previous.fingerprint_version === fingerprintVersion ? previous.fingerprint !== fingerprint : null;
  if (changed) {
    candidates.push({
      candidate_type: "official_update",
      external_id: `official-change:${officialSource.id}:${fingerprint.slice(0, 12)}`,
      title: `${officialSource.name} 页面或管线资产发生变化`,
      source: officialSource.name,
      source_url: officialSource.urls[0],
      publication_date: generatedAt.slice(0, 10),
      matched_diseases: [],
      matched_entities: officialSource.entity_ids || [],
      query_matches: [`official:${officialSource.id}:change`],
      review_status: "待人工核验"
    });
  }
  sourceRuns.push({
    source: officialSource.name,
    source_id: officialSource.id,
    source_kind: "official_website",
    status: errors.length === seen.size ? "error" : errors.length ? "partial" : "ok",
    pages_scanned: seen.size,
    relevant_links: discoveredLinks.size,
    assets_monitored: monitoredAssets.size,
    fingerprint,
    fingerprint_version: fingerprintVersion,
    changed,
    sentinel_check: sentinelCheck(`official:${officialSource.id}`, new Set([...seen, ...observedLinks])),
    errors
  });
}

const rank = (item) => {
  let score = item.matched_diseases.length * 2;
  if (item.candidate_type === "trial") score += 4;
  if (item.candidate_type === "official_update") score += 4;
  if (item.matched_entities.length) score += 6;
  if ((item.publication_type || []).some((type) => /clinical trial|randomized|meta-analysis|systematic review/i.test(type))) score += 5;
  if (!/not_yet_recruiting/i.test(item.status || "") && /recruiting|active_not_recruiting/i.test(item.status || "")) score += 2;
  return score;
};
const triage = (item) => {
  const strongEvidence = (item.publication_type || []).some((type) => /clinical trial|randomized|meta-analysis|systematic review/i.test(type));
  const reasons = [];
  if (item.candidate_type === "trial") reasons.push("正式注册试验");
  if (item.candidate_type === "official_update") reasons.push("企业官网一手披露");
  if (strongEvidence) reasons.push("高等级研究类型");
  if (item.matched_entities.length) reasons.push(`命中重点实体：${item.matched_entities.map((id) => entityById.get(id)?.label || id).join("、")}`);
  if (item.matched_diseases.length) reasons.push(`命中${item.matched_diseases.length}个重点病种`);
  if (!/not_yet_recruiting/i.test(item.status || "") && /recruiting|active_not_recruiting/i.test(item.status || "")) reasons.push("当前处于活跃状态");
  let tier = "低相关";
  if (item.matched_entities.length || item.candidate_type === "official_update" || (item.candidate_type === "trial" && item.relevance_score >= 10) || (item.candidate_type === "research" && strongEvidence && item.relevance_score >= 7)) tier = "立即核验";
  else if (item.relevance_score >= 6) tier = "持续观察";
  else if (item.relevance_score >= 3) tier = "背景材料";
  return { tier, reasons: reasons.length ? reasons : ["仅命中宽泛检索词"] };
};

const uniqueCandidates = new Map();
for (const item of candidates) {
  item.matched_entities ||= [];
  item.relevance_score = rank(item);
  const result = triage(item);
  item.triage_tier = result.tier;
  item.triage_reasons = result.reasons;
  const key = `${item.candidate_type}:${item.external_id}`;
  const existing = uniqueCandidates.get(key);
  if (!existing || item.relevance_score > existing.relevance_score) uniqueCandidates.set(key, item);
}
const rankedCandidates = [...uniqueCandidates.values()].sort((a, b) =>
  b.relevance_score - a.relevance_score
  || String(b.publication_date || b.last_update_posted).localeCompare(String(a.publication_date || a.last_update_posted))
);

const report = {
  generated_at: generatedAt,
  policy: "Candidates are discovery leads only. They must be verified against primary records before entering production datasets.",
  query_window: `Publications since ${config.publication_start_date}; complete paginated ClinicalTrials.gov results; tracked official websites`,
  summary: {
    candidates: rankedCandidates.length,
    research: rankedCandidates.filter((item) => item.candidate_type === "research").length,
    trials: rankedCandidates.filter((item) => item.candidate_type === "trial").length,
    official_updates: rankedCandidates.filter((item) => item.candidate_type === "official_update").length,
    immediate_review: rankedCandidates.filter((item) => item.triage_tier === "立即核验").length,
    watchlist: rankedCandidates.filter((item) => item.triage_tier === "持续观察").length,
    background: rankedCandidates.filter((item) => item.triage_tier === "背景材料").length,
    low_relevance: rankedCandidates.filter((item) => item.triage_tier === "低相关").length,
    source_failures: sourceRuns.filter((item) => item.status === "error").length,
    partial_sources: sourceRuns.filter((item) => item.status === "partial").length,
    truncated_sources: sourceRuns.filter((item) => item.truncated).length,
    missing_sentinels: sourceRuns.reduce((count, run) => count + (run.sentinel_check?.missing?.length || 0), 0)
  },
  source_runs: sourceRuns,
  candidates: rankedCandidates
};

await writeFile(path.join(root, "data/candidate-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Discovery: ${report.summary.candidates} candidates | ${report.summary.research} research | ${report.summary.trials} trials | ${report.summary.official_updates} official | ${report.summary.source_failures} failures | ${report.summary.truncated_sources} truncated | ${report.summary.missing_sentinels} sentinels missing`);
if (report.summary.source_failures || report.summary.truncated_sources || report.summary.missing_sentinels) process.exitCode = 2;
