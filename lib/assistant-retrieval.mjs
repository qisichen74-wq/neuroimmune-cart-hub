import { assessFreshness } from "./evidence-policy.mjs";
import { fieldEvidenceState } from "./registry-field-evidence.mjs";
const HAN = /[\u3400-\u9fff]/;

const STOP_PHRASES = [
  "请问", "请帮我", "帮我", "我想知道", "告诉我", "目前", "当前", "一下", "有哪些", "哪些", "有什么", "有没有", "是什么",
  "分别", "如何", "为什么", "是否", "关于", "相关", "领域", "情况", "信息", "进行", "回答", "这个", "那个",
  "比较", "站内记录了", "站内记录", "记录了", "以及", "的", "与", "和",
  "the", "what", "which", "show", "tell", "about", "please", "are", "is", "of", "in", "and", "for"
];

const TYPE_INTENTS = [
  { type: "trial", words: ["试验", "临床", "入组", "招募", "nct", "ctr", "phase", "终点", "trial", "enrollment", "recruiting"] },
  { type: "research", words: ["研究", "文献", "论文", "pmid", "病例", "队列", "综述", "证据"] },
  { type: "company", words: ["竞争", "公司", "管线", "玩家"] },
  { type: "program", words: ["项目", "产品", "靶点", "技术路线"] },
  { type: "deal", words: ["交易", "收购", "并购", "融资", "许可", "合作", "金额"] },
  { type: "safety", words: ["安全", "毒性", "风险", "crs", "icans", "不良事件"] },
  { type: "event", words: ["动态", "进展", "变化", "更新", "最近", "最新", "过去"] },
  { type: "topic", words: ["专题", "疾病", "未满足需求", "证据缺口"] }
];

const RECENCY_WORDS = ["最新", "最近", "目前", "当前", "过去", "进展", "更新", "today", "latest", "recent"];
const GENERIC_TERMS = new Set(["car-t", "cart", "项目", "产品", "试验", "临床", "研究", "证据", "信息", "阶段"]);
const DISEASE_ALIASES = [
  [/\b(?:ms|multiple sclerosis)\b/gi, "多发性硬化"],
  [/\b(?:mg|gmg|myasthenia gravis)\b/gi, "重症肌无力"],
  [/\b(?:sle|systemic lupus erythematosus)\b/gi, "系统性红斑狼疮"],
  [/\b(?:ssc|systemic sclerosis)\b/gi, "系统性硬化症"],
  [/\b(?:nmosd)\b/gi, "视神经脊髓炎谱系病"],
  [/\b(?:cidp)\b/gi, "慢性炎性脱髓鞘性多发性神经病"]
];
const REFERS_TO_CONTEXT = /这个|这(?:项|个|篇)(?:试验|项目|研究|论文)|该试验|该项目|该研究|它|其(?:中|的)|上述|前者|后者|\b(?:it|its|this|that)\b/i;

function expandedQuestion(question, options) {
  let text = String(question || "");
  if (REFERS_TO_CONTEXT.test(text) && !options.context) {
    const previous = (Array.isArray(options.history) ? options.history : []).filter((message) => message?.role === "user").at(-1);
    if (previous) text = `${String(previous.content || "").slice(0, 800)} ${text}`;
  }
  for (const [pattern, name] of DISEASE_ALIASES) text = text.replace(pattern, name);
  return text;
}

function searchableText(value) {
  // Apply the same aliases to both sides; Chinese questions must find English records.
  return normalizeText(expandedQuestion(value, {}));
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

// Explicit registry/publication IDs define scope, not just another ranking term.
export function extractEvidenceIdentifiers(value) {
  const text = normalizeText(value);
  return unique([
    ...[...text.matchAll(/(?<![a-z0-9])nct[\s:-]*(\d{8})(?![a-z0-9])/g)].map((match) => `nct${match[1]}`),
    ...[...text.matchAll(/(?<![a-z0-9])pmid[\s:-]*(\d{1,8})(?![a-z0-9])/g)].map((match) => `pmid${match[1]}`),
    ...[...text.matchAll(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,8})(?!\d)/g)].map((match) => `pmid${match[1]}`)
  ]);
}

function documentIdentifiers(document) {
  return extractEvidenceIdentifiers([document.id, document.title, document.search_text, document.summary,
    document.content, ...(document.tags || []), document.source_url, ...(document.additional_source_urls || [])].join(" "));
}

export function extractQueryTerms(question) {
  const normalized = normalizeText(question);
  let cleaned = ` ${normalized} `;
  for (const phrase of STOP_PHRASES.sort((a, b) => b.length - a.length)) {
    cleaned = /^[a-z]+$/.test(phrase)
      ? cleaned.replace(new RegExp(`\\b${phrase}\\b`, "g"), " ")
      : cleaned.replaceAll(normalizeText(phrase), " ");
  }
  const segments = cleaned.match(/[a-z0-9][a-z0-9.+/_-]*|[\u3400-\u9fff]{2,}/g) || [];
  const terms = [];
  for (const segment of segments) {
    if (!HAN.test(segment) || segment.length <= 6) {
      terms.push(segment);
      continue;
    }
    terms.push(segment);
    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= segment.length - size; index += 1) terms.push(segment.slice(index, index + size));
    }
  }
  return unique(terms).filter((term) => term.length >= 2);
}

function queryTypeBoosts(question) {
  const normalized = normalizeText(question);
  const boosts = new Map();
  for (const intent of TYPE_INTENTS) {
    if (intent.words.some((word) => normalized.includes(normalizeText(word)))) boosts.set(intent.type, 24);
  }
  return boosts;
}

function dateValue(document) {
  const candidate = document.date || document.last_verified_at || document.data_as_of || "";
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isStale(document, today = new Date()) {
  return assessFreshness(document, today).stale;
}

function neighborKeys(documents, seedKeys) {
  const neighbors = new Set();
  const byKey = new Map(documents.map((document) => [`${document.type}:${document.id}`, document]));
  for (const key of seedKeys) {
    const document = byKey.get(key);
    for (const related of document?.related || []) neighbors.add(related);
  }
  return neighbors;
}

export function retrieveEvidence(index, question, options = {}) {
  const documents = Array.isArray(index?.documents) ? index.documents : [];
  const useContext = REFERS_TO_CONTEXT.test(question);
  const explicitIdentifiers = extractEvidenceIdentifiers(question);
  question = expandedQuestion(question, options);
  const normalizedQuestion = normalizeText(question);
  const terms = extractQueryTerms(question);
  const typeBoosts = queryTypeBoosts(question);
  const wantsRecent = RECENCY_WORDS.some((word) => normalizedQuestion.includes(normalizeText(word)));
  const contextKey = useContext && options.context?.type && options.context?.id ? `${options.context.type}:${options.context.id}` : "";
  const contextDocument = contextKey ? documents.find((document) => `${document.type}:${document.id}` === contextKey) : null;
  const scopeIdentifiers = explicitIdentifiers.length ? explicitIdentifiers : extractEvidenceIdentifiers(question);
  if (!scopeIdentifiers.length && contextDocument) {
    scopeIdentifiers.push(...extractEvidenceIdentifiers(`${contextDocument.id} ${contextDocument.source_url}`));
  }
  const candidates = scopeIdentifiers.length
    ? documents.filter((document) => documentIdentifiers(document).some((id) => scopeIdentifiers.includes(id)))
    : documents;
  const now = options.now instanceof Date ? options.now : new Date();

  const firstPass = candidates.map((document) => {
    const title = searchableText(document.title);
    const tags = searchableText((document.tags || []).join(" "));
    const body = searchableText(document.search_text || `${document.title} ${document.summary || ""} ${document.content || ""}`);
    let score = scopeIdentifiers.length ? 120 : 0;
    let matched = 0;
    let specificMatched = 0;

    if (normalizedQuestion.length >= 4 && body.includes(normalizedQuestion)) score += 36;
    for (const term of terms) {
      let termScore = 0;
      const isIdentifier = /[a-z]/.test(term) && /[0-9]/.test(term);
      const isGeneric = GENERIC_TERMS.has(term);
      const isLongTerm = term.length >= 4;
      if (title.includes(term)) termScore = Math.max(termScore, isGeneric ? 4 : isIdentifier ? 34 : isLongTerm ? 18 : 6);
      if (tags.includes(term)) termScore = Math.max(termScore, isGeneric ? 3 : isIdentifier ? 28 : isLongTerm ? 12 : 4);
      if (body.includes(term)) termScore = Math.max(termScore, isGeneric ? 1 : isIdentifier ? 17 : isLongTerm ? 7 : 2);
      if (termScore) {
        score += termScore;
        matched += 1;
        if (!isGeneric) specificMatched += 1;
      }
    }

    score += typeBoosts.get(document.type) || 0;
    if (contextKey === `${document.type}:${document.id}`) score += 120;
    if (wantsRecent && dateValue(document)) {
      const ageDays = Math.max(0, (now.getTime() - dateValue(document)) / 86_400_000);
      score += Math.max(0, 8 - ageDays / 90);
    }
    if (document.priority === "高") score += 2;
    if (document.verification_status === "已核验") score += 3;
    if (isStale(document, now)) score -= wantsRecent ? 12 : 3;
    if (wantsRecent && fieldEvidenceState(document.field_verification, now)?.current_verified) score += 12;

    return { document, score, matched, specificMatched, stale: isStale(document, now) };
  }).filter((result) => result.score > 0 && (scopeIdentifiers.length || result.specificMatched > 0 || contextKey === `${result.document.type}:${result.document.id}`));

  firstPass.sort((left, right) => right.score - left.score || dateValue(right.document) - dateValue(left.document));
  const seeds = firstPass.slice(0, 4).map((result) => `${result.document.type}:${result.document.id}`);
  const neighbors = neighborKeys(documents, seeds);
  const existingKeys = new Set(firstPass.map((result) => `${result.document.type}:${result.document.id}`));
  for (const document of candidates) {
    const key = `${document.type}:${document.id}`;
    if (!neighbors.has(key) || existingKeys.has(key)) continue;
    firstPass.push({
      document,
      score: 11 + (typeBoosts.get(document.type) || 0) + (document.priority === "高" ? 2 : 0),
      matched: 0,
      specificMatched: 0,
      stale: isStale(document, now)
    });
    existingKeys.add(key);
  }
  for (const result of firstPass) {
    if (neighbors.has(`${result.document.type}:${result.document.id}`)) result.score += 7;
  }
  firstPass.sort((left, right) => right.score - left.score || dateValue(right.document) - dateValue(left.document));

  const limit = Math.min(12, Math.max(1, Number(options.limit || 8)));
  const selected = [];
  const selectedKeys = new Set();
  const typeCounts = new Map();
  const identifierTerms = scopeIdentifiers.length ? scopeIdentifiers : terms.filter((term) => /[a-z]/.test(term) && /[0-9]/.test(term));
  for (const term of identifierTerms) {
    if (selected.length >= limit) break;
    const result = scopeIdentifiers.length
      ? firstPass.find((candidate) => extractEvidenceIdentifiers(`${candidate.document.id} ${candidate.document.source_url}`).includes(term))
        || firstPass.find((candidate) => documentIdentifiers(candidate.document).includes(term))
      : firstPass.find((candidate) => normalizeText(candidate.document.search_text).includes(term));
    if (!result) continue;
    const key = `${result.document.type}:${result.document.id}`;
    if (selectedKeys.has(key)) continue;
    selected.push(result);
    selectedKeys.add(key);
    typeCounts.set(result.document.type, (typeCounts.get(result.document.type) || 0) + 1);
  }
  // Keep the disease dossier alongside individual records for disease-wide questions.
  if (!identifierTerms.length && selected.length < limit) {
    const dossier = firstPass.find((result) => result.document.type === "topic"
      && terms.some((term) => term.length >= 4 && !GENERIC_TERMS.has(term) && searchableText(result.document.title).split(/[（(]/)[0].trim() === term));
    if (dossier) {
      selected.push(dossier);
      selectedKeys.add(`${dossier.document.type}:${dossier.document.id}`);
      typeCounts.set("topic", 1);
    }
  }
  for (const result of firstPass) {
    if (selected.length >= limit) break;
    const key = `${result.document.type}:${result.document.id}`;
    if (selectedKeys.has(key)) continue;
    const count = typeCounts.get(result.document.type) || 0;
    if (count >= 4 && selected.length >= 4) continue;
    selected.push(result);
    selectedKeys.add(key);
    typeCounts.set(result.document.type, count + 1);
    if (selected.length >= limit) break;
  }

  return selected.map((result, indexNumber) => ({
    citation_id: `S${indexNumber + 1}`,
    score: Math.round(result.score * 10) / 10,
    ...result.document,
    ...assessFreshness(result.document, now),
    field_freshness: fieldEvidenceState(result.document.field_verification, now)
  }));
}

export function assessEvidence(results, now = new Date()) {
  if (!results.length) {
    return { confidence: "低", limitations: ["正式数据中没有找到足以回答该问题的证据。"] };
  }
  const states = results.map((result) => assessFreshness(result, now));
  const currentVerified = states.filter((state) => state.current_verified).length;
  const stale = states.filter((state) => state.stale).length;
  const unknown = states.filter((state) => ["unknown", "invalid"].includes(state.freshness_state)).length;
  const fieldVerified = results.filter((result) => fieldEvidenceState(result.field_verification, now)?.current_verified).length;
  const lowConfidence = results.filter((result) => ["低", "待判断"].includes(result.confidence)).length;
  const limitations = [];
  if (stale) limitations.push(`${stale} 条档案的整条核验已超过复核周期；除单独标注的近期复核字段外，其余内容仅作历史参考。`);
  if (fieldVerified) limitations.push(`${fieldVerified} 条档案含近期复核的登记字段；仅这些字段已核对，不代表整条档案、疗效或编辑判断重新核验。`);
  if (unknown) limitations.push(`${unknown} 条证据缺少有效核验日期，无法确认时效。`);
  if (lowConfidence) limitations.push(`${lowConfidence} 条证据的核验置信度较低或尚待判断。`);
  if (results.length === 1) limitations.push("当前回答主要依赖单一记录，尚缺少交叉来源支持。");
  const confidence = currentVerified === results.length && currentVerified >= 2 && lowConfidence === 0 ? "高" : currentVerified >= 1 || fieldVerified >= 1 ? "中" : "低";
  return { confidence, limitations };
}
