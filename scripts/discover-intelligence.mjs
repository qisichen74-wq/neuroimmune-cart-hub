import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidatePoolDecision, candidateSummary } from "./candidate-policy.mjs";
import { chinaDrugTrialsOfficialUrl, fetchChinaDrugTrials } from "./china-drug-trials.mjs";
import { createJournalMetricLookup, withJournalMetric } from "./journal-metrics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const [research, trials, events, landscape, config, journalMetrics] = await Promise.all([
  loadJson("data/feed.json"),
  loadJson("data/trials.json"),
  loadJson("data/events.json"),
  loadJson("data/landscape.json"),
  loadJson("data/discovery-config.json"),
  loadJson("data/journal-metrics.json")
]);
const journalMetricLookup = createJournalMetricLookup(journalMetrics);
let previousReport = null;
try { previousReport = await loadJson("data/candidate-report.json"); } catch {}

const knownPmids = new Set(research.map((item) => item.pmid).filter(Boolean).map(String));
const knownTrialRegistryIds = new Set(trials.flatMap((item) => [item.registry_id, item.cde_registry_id]).filter(Boolean).map(String));
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

const browserHeaders = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.8,zh-CN;q=0.6"
};
const describeFetchError = (error) => [...new Set([
  error?.name,
  error?.cause?.code,
  error?.cause?.message,
  error?.message
].filter(Boolean))].join(" / ");
const fetchResponse = async (url, options = {}) => {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...browserHeaders, ...(options.headers || {}) },
        redirect: "follow",
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) return response;
      const error = new Error(`${response.status} ${response.statusText}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(describeFetchError(lastError) || "unknown fetch error");
};
const fetchJson = async (url, options) => (await fetchResponse(url, options)).json();
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const includesAlias = (text, alias) => {
  const value = String(text || "");
  if (/^[a-z0-9-]{2,5}$/i.test(alias)) return new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(value);
  return value.toLowerCase().includes(alias.toLowerCase());
};

const diseases = [
  { label: "multiple sclerosis", aliases: ["multiple sclerosis", "MS", "多发性硬化", "多发性硬化症"] },
  { label: "myasthenia gravis", aliases: ["myasthenia gravis", "generalized myasthenia gravis", "gMG", "MG", "重症肌无力", "全身型重症肌无力"] },
  { label: "neuromyelitis optica", aliases: ["neuromyelitis optica", "NMOSD", "视神经脊髓炎", "视神经脊髓炎谱系疾病"] },
  { label: "MOGAD", aliases: ["MOGAD", "myelin oligodendrocyte glycoprotein antibody-associated disease", "MOG抗体相关疾病"] },
  { label: "stiff person", aliases: ["stiff person", "SPS", "僵人综合征"] },
  { label: "autoimmune encephalitis", aliases: ["autoimmune encephalitis", "NMDAR encephalitis", "NMDA receptor encephalitis", "LGI1 encephalitis", "CASPR2 encephalitis", "GABA-B receptor encephalitis", "AMPAR encephalitis", "DPPX encephalitis", "DAGLA antibody-associated encephalitis", "GAD65 encephalitis", "自身免疫性脑炎"] },
  { label: "CIDP", aliases: ["CIDP", "chronic inflammatory demyelinating polyneuropathy", "慢性炎性脱髓鞘性多发性神经病"] },
  { label: "systemic lupus", aliases: ["systemic lupus", "SLE", "lupus nephritis", "系统性红斑狼疮", "狼疮性肾炎"] },
  { label: "systemic sclerosis", aliases: ["systemic sclerosis", "scleroderma", "系统性硬化症", "系统性硬化病", "硬皮病"] },
  { label: "myositis", aliases: ["myositis", "inflammatory myopathy", "idiopathic inflammatory myopathy", "dermatomyositis", "antisynthetase syndrome", "immune-mediated necrotizing myopathy", "IMNM", "IIM", "炎性肌病", "皮肌炎", "多发性肌炎", "免疫介导坏死性肌病"] },
  { label: "immune thrombocytopenia", aliases: ["immune thrombocytopenia", "ITP", "免疫性血小板减少症", "免疫性血小板减少性紫癜"] },
  { label: "rheumatoid arthritis", aliases: ["rheumatoid arthritis", "RA", "类风湿关节炎"] },
  { label: "autoimmune ILD", aliases: ["autoimmune interstitial lung disease", "connective tissue disease-associated interstitial lung disease", "CTD-ILD", "AI-ILD", "自身免疫性间质性肺病", "结缔组织病相关间质性肺病"] },
  { label: "autoimmune disease", aliases: ["autoimmune disease", "autoimmune diseases", "自身免疫性疾病", "自身免疫病"] }
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
const matchesPatterns = (value, patterns = []) => patterns.some((pattern) => String(value || "").includes(pattern));
const entityClause = (entity) => entity.aliases.map((alias) => `"${alias}"`).join(" OR ");
const trialModalityTerms = [
  "\"CAR-T\"",
  "\"CAR T\"",
  "\"chimeric antigen receptor\"",
  "\"cell therapy\"",
  "\"T-cell therapy\"",
  "\"T cell therapy\"",
  "\"engineered T cell\"",
  "\"engineered T-cell\""
];
const trialModalityPattern = /\b(?:CAR[- ]?T|chimeric antigen receptor|cell therapy|T[- ]cell therapy|engineered T[- ]cell)\b|嵌合抗原受体|细胞治疗|CAR[+＋]?T细胞|T细胞注射液/i;
const isEnglishRegistryAlias = (alias) => /^[\x20-\x7E]+$/.test(alias);
const diseaseQueryClause = (disease) => disease.aliases
  .filter((alias) => alias.length > 3 && isEnglishRegistryAlias(alias))
  .map((alias) => `"${alias}"`)
  .join(" OR ");
const diseaseClause = diseases
  .flatMap((disease) => disease.aliases.filter((alias) => alias.length > 3 && isEnglishRegistryAlias(alias)))
  .map((term) => `"${term}"`)
  .join(" OR ");

const fetchPubmedIds = async (term) => {
  const ids = [];
  let total = 0;
  const pageSize = 500;
  for (let retstart = 0; retstart < maxRecordsPerQuery; retstart += pageSize) {
    const params = new URLSearchParams({ db: "pubmed", term, retmode: "json", retmax: String(pageSize), retstart: String(retstart), sort: "pub date" });
    const payload = await fetchJson("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString()
    });
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
        review_status: "待处理"
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
  const modalityClause = trialModalityTerms.join(" OR ");
  const themeQuery = `(${modalityClause}) AND (${diseaseClause})`;
  const queryRuns = [];
  const studyMatches = new Map();
  const trialQueries = [
    { id: "theme", term: themeQuery, entityId: null },
    ...diseases.map((disease) => ({
      id: `disease:${disease.label}`,
      term: `(${diseaseQueryClause(disease)}) AND (${modalityClause})`,
      entityId: null
    })),
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
  const knownRecordsSeen = [...studyMatches.keys()].filter((nctId) => knownTrialRegistryIds.has(nctId));
  for (const [nctId, match] of studyMatches) {
    if (knownTrialRegistryIds.has(nctId)) continue;
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
    const modalityMatched = trialModalityPattern.test(searchable);
    const diseaseQueryHit = [...match.queryIds].some((queryId) => queryId.startsWith("disease:"));
    const matchedEntityIds = new Set([
      ...priorityEntities,
      ...(matchedDiseases.length ? [...match.entityIds, ...detectEntities(searchable)] : [])
    ]);
    if (!match.queryIds.has("theme") && !diseaseQueryHit && !matchedDiseases.length && !priorityEntities.length) continue;
    if (!modalityMatched && !priorityEntities.length) continue;
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
      review_status: "待处理"
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

try {
  const chinaResult = await fetchChinaDrugTrials({
    sourceConfig: config.china_drug_trials,
    headers: browserHeaders,
    maxRecords: maxRecordsPerQuery
  });
  const relevantRecords = [];
  const knownRecordsSeen = [];
  for (const item of chinaResult.records || []) {
    const registrationNumber = String(item.registration_number || "").toUpperCase();
    if (!registrationNumber) continue;
    if (knownTrialRegistryIds.has(registrationNumber)) {
      knownRecordsSeen.push(registrationNumber);
      continue;
    }
    const indications = clean(item.indications || item.indication || "");
    const title = clean(item.title || item.title_professional || item.trial_title || registrationNumber);
    const drugName = clean(item.drug_name || item.product || "");
    const searchable = `${title} ${drugName} ${indications}`;
    const matchedDiseases = detectDiseases(`${title} ${indications}`);
    const priorityEntities = detectPriorityEntities(searchable);
    if (!trialModalityPattern.test(searchable) || !matchedDiseases.length) continue;
    const matchedEntityIds = new Set([...priorityEntities, ...detectEntities(searchable)]);
    const sourceUrl = item.source_url || (item.trial_id
      ? `${chinaDrugTrialsOfficialUrl}/clinicaltrials.searchlistdetail.dhtml?id=${encodeURIComponent(item.trial_id)}`
      : `${chinaDrugTrialsOfficialUrl}/clinicaltrials.searchlist.dhtml?keywords=${registrationNumber}`);
    relevantRecords.push(registrationNumber);
    candidates.push({
      candidate_type: "trial",
      external_id: registrationNumber,
      registry: "CDE China Drug Trials",
      title,
      source: "CDE 药物临床试验登记与信息公示平台",
      source_url: sourceUrl,
      status: clean(item.status),
      last_update_posted: clean(item.last_update || item.update_date || item.first_publication_date || ""),
      phase: item.phase ? [clean(item.phase)] : [],
      enrollment: Number.isFinite(Number(item.enrollment)) ? Number(item.enrollment) : null,
      sponsor: clean(item.sponsor || item.applicant || ""),
      product: drugName,
      conditions: indications ? [indications] : [],
      matched_diseases: matchedDiseases,
      matched_entities: [...matchedEntityIds],
      query_matches: (item.query_ids || []).map((queryId) => `china-drug-trials:${queryId}`),
      access_method: chinaResult.access_method,
      review_status: "试验登记"
    });
  }
  sourceRuns.push({
    source: "CDE 药物临床试验登记与信息公示平台",
    source_id: "china-drug-trials",
    source_kind: "official_registry",
    official_url: chinaDrugTrialsOfficialUrl,
    status: chinaResult.status,
    access_method: chinaResult.access_method,
    results_scanned: chinaResult.records?.length || 0,
    relevant_records: relevantRecords.length,
    relevant_registry_ids: relevantRecords.sort(),
    known_records_seen: [...new Set(knownRecordsSeen)].sort(),
    query_runs: chinaResult.query_runs || [],
    truncated: Boolean(chinaResult.truncated),
    blocked_by_js_challenge: Boolean(chinaResult.blocked_by_js_challenge),
    errors: chinaResult.errors || [],
    setup_hint: chinaResult.blocked_by_js_challenge ? "Set CHINA_DRUG_TRIALS_API_KEY to enable the managed read-only registry wrapper." : undefined
  });
} catch (error) {
  sourceRuns.push({
    source: "CDE 药物临床试验登记与信息公示平台",
    source_id: "china-drug-trials",
    source_kind: "official_registry",
    official_url: chinaDrugTrialsOfficialUrl,
    status: "error",
    error: error.message
  });
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

const scanOfficialSource = async (officialSource) => {
  const startedAt = Date.now();
  const previous = previousOfficialRuns.get(officialSource.id);
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
        const candidateText = `${anchor.text} ${anchor.url}`;
        const matchedDiseases = detectDiseases(candidateText);
        const priorityEntities = detectPriorityEntities(candidateText);
        const matchedEntities = new Set([
          ...priorityEntities,
          ...detectEntities(candidateText)
        ]);
        const matchedCandidateLink = matchesPatterns(anchor.url, officialSource.candidate_link_patterns || []);
        // Company names appear in nearly every IR URL. Keep only links that
        // mention a tracked product alias or a target disease.
        if (!matchedDiseases.length && !priorityEntities.length) continue;
        discoveredLinks.set(anchor.url, {
          ...anchor,
          matchedEntities: [...matchedEntities],
          matchedDiseases,
          matchedCandidateLink
        });
      }
    } catch (error) {
      errors.push({ url: pageUrl, error: error.message });
    }
  }
  const previousRelevantUrls = new Set(previous?.relevant_urls || []);
  const hasLinkBaseline = Array.isArray(previous?.relevant_urls);
  for (const item of discoveredLinks.values()) {
    if (!hasLinkBaseline || previousRelevantUrls.has(item.url)) continue;
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
      review_status: "待处理"
    });
  }
  const fingerprintInput = JSON.stringify({
    pages: [...seen].sort(),
    links: [...discoveredLinks.keys()].sort(),
    assets: [...monitoredAssets].sort(),
    page_content: [...pageContentHashes].sort(([left], [right]) => left.localeCompare(right))
  });
  const fingerprint = createHash("sha256").update(fingerprintInput).digest("hex");
  const fingerprintVersion = 3;
  const runStatus = errors.length === seen.size ? "error" : errors.length ? "partial" : "ok";
  // Only compare complete snapshots. A failed or partial fetch changes the
  // fingerprint too, but that is a monitoring outage rather than a site update.
  const comparable = runStatus === "ok"
    && previous?.status === "ok"
    && previous?.fingerprint
    && previous.fingerprint_version === fingerprintVersion;
  const changed = comparable ? previous.fingerprint !== fingerprint : null;
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
      review_status: "待处理"
    });
  }
  sourceRuns.push({
    source: officialSource.name,
    source_id: officialSource.id,
    source_kind: "official_website",
    status: runStatus,
    pages_scanned: seen.size,
    successful_pages: pageContentHashes.size,
    relevant_links: discoveredLinks.size,
    relevant_urls: [...discoveredLinks.keys()].sort(),
    assets_monitored: monitoredAssets.size,
    fingerprint,
    fingerprint_version: fingerprintVersion,
    changed,
    duration_ms: Date.now() - startedAt,
    sentinel_check: sentinelCheck(`official:${officialSource.id}`, new Set([...seen, ...observedLinks])),
    errors
  });
};
await Promise.all((config.official_sources || []).map(scanOfficialSource));

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
const policyDecisions = [...uniqueCandidates.values()].map((candidate) => ({ candidate, decision: candidatePoolDecision(candidate) }));
const excludedResearch = policyDecisions.filter((entry) => entry.candidate.candidate_type === "research" && !entry.decision.eligible);
const rankedCandidates = policyDecisions.filter((entry) => entry.decision.eligible).map((entry) => withJournalMetric(entry.candidate, journalMetricLookup)).sort((a, b) =>
  b.relevance_score - a.relevance_score
  || String(b.publication_date || b.last_update_posted).localeCompare(String(a.publication_date || a.last_update_posted))
  || String(a.external_id).localeCompare(String(b.external_id))
);

sourceRuns.sort((a, b) =>
  String(a.source_kind).localeCompare(String(b.source_kind))
  || String(a.source_id || a.source).localeCompare(String(b.source_id || b.source))
);

const criticalSourceFailures = sourceRuns.filter((run) =>
  ["NCBI PubMed", "ClinicalTrials.gov"].includes(run.source) && run.status === "error"
);
const previousCandidates = previousReport?.candidates || [];
const preservePreviousCandidates = Boolean(
  criticalSourceFailures.length
  && previousCandidates.length >= 50
  && rankedCandidates.length < previousCandidates.length * 0.5
);
const effectiveCandidates = preservePreviousCandidates ? previousCandidates : rankedCandidates;
const effectiveExcludedResearch = preservePreviousCandidates
  ? Number(previousReport?.summary?.policy_excluded_research || 0)
  : excludedResearch.length;

const report = {
  generated_at: preservePreviousCandidates ? previousReport.generated_at : generatedAt,
  last_attempt_at: generatedAt,
  policy: "Research candidates must involve CAR-T or cell therapy and identify at least one disease or indication. High-scoring reviews and meta-analyses may be retained without a named disease. Registered clinical trials remain in the candidate pool as registry signals; eligible non-trial candidates enter the candidate desk for handling.",
  query_window: `Publications since ${config.publication_start_date}; complete paginated ClinicalTrials.gov results; CDE China Drug Trials registry queries; tracked official websites`,
  summary: {
    ...candidateSummary(effectiveCandidates),
    policy_excluded_research: effectiveExcludedResearch,
    source_failures: sourceRuns.filter((item) => item.status === "error").length,
    partial_sources: sourceRuns.filter((item) => item.status === "partial").length,
    truncated_sources: sourceRuns.filter((item) => item.truncated).length,
    missing_sentinels: sourceRuns.reduce((count, run) => count + (run.sentinel_check?.missing?.length || 0), 0)
  },
  degraded_run: preservePreviousCandidates ? {
    preserved_previous_candidates: true,
    reason: "Critical discovery sources failed and the new candidate set was abnormally small.",
    failed_sources: criticalSourceFailures.map((run) => run.source),
    attempted_candidates: rankedCandidates.length,
    preserved_candidates: previousCandidates.length
  } : null,
  source_runs: sourceRuns,
  candidates: effectiveCandidates
};

const radarData = {
  report: {
    generated_at: report.generated_at,
    summary: report.summary,
    source_runs: report.source_runs.filter((run) => run.source_kind === "official_website"),
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
console.log(`Discovery: ${report.summary.candidates} candidates | ${report.summary.research} research | ${report.summary.trials} trials | ${report.summary.official_updates} official | ${report.summary.source_failures} failures | ${report.summary.truncated_sources} truncated | ${report.summary.missing_sentinels} sentinels missing`);
if (preservePreviousCandidates) console.log(`Discovery safeguard: preserved ${previousCandidates.length} previous candidates after critical source failure; attempted set had ${rankedCandidates.length}.`);
if (report.summary.source_failures || report.summary.truncated_sources || report.summary.missing_sentinels) process.exitCode = 2;
