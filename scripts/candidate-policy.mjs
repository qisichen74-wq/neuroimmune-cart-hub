const cellTherapyPattern = /\bCAR[- ]?T(?:[- ]?cells?)?\b|chimeric antigen receptor|cell(?:ular)? therap|T[- ]?cell therap|engineered T[- ]?cells?|adoptive cell therap|CAR[- ]?NK|stem cell transplant|stem cell therap|NK cell therap/i;
const reviewPattern = /review|meta-analysis|meta analysis/i;

export const undifferentiatedReviewMinScore = 7;

export const hasDiseaseOrIndication = (candidate) =>
  Boolean((candidate.matched_diseases || []).length || (candidate.conditions || []).length);

export const hasCellTherapyEvidence = (candidate) =>
  cellTherapyPattern.test(String(candidate.title || ""))
  || Boolean((candidate.matched_entities || []).length);

export const isReviewOrMetaAnalysis = (candidate) =>
  (candidate.publication_type || []).some((type) => reviewPattern.test(String(type)))
  || /\b(?:systematic review|scoping review|meta-analysis|meta analysis)\b/i.test(String(candidate.title || ""));

export const isUndifferentiatedHighValueReview = (candidate) =>
  !hasDiseaseOrIndication(candidate)
  && hasCellTherapyEvidence(candidate)
  && isReviewOrMetaAnalysis(candidate)
  && Number(candidate.relevance_score || 0) >= undifferentiatedReviewMinScore;

export const candidatePoolDecision = (candidate) => {
  if (candidate.candidate_type !== "research") return { eligible: true, reason: "非文献候选" };
  if (!hasCellTherapyEvidence(candidate)) return { eligible: false, reason: "文献未涉及 CAR-T 或细胞治疗" };
  if (hasDiseaseOrIndication(candidate)) return { eligible: true, reason: "已定位疾病或适应症" };
  if (isUndifferentiatedHighValueReview(candidate)) return { eligible: true, reason: "高分综述或 Meta-analysis 例外" };
  return { eligible: false, reason: "文献未定位疾病或适应症" };
};

export const isCandidatePoolEligible = (candidate) => candidatePoolDecision(candidate).eligible;

export const requiresHumanReview = (candidate) =>
  candidate.candidate_type !== "trial" && isCandidatePoolEligible(candidate);

export const candidateSummary = (candidates, excludedResearch = []) => ({
  candidates: candidates.length,
  research: candidates.filter((item) => item.candidate_type === "research").length,
  trials: candidates.filter((item) => item.candidate_type === "trial").length,
  official_updates: candidates.filter((item) => item.candidate_type === "official_update").length,
  immediate_review: candidates.filter((item) => item.triage_tier === "立即核验").length,
  watchlist: candidates.filter((item) => item.triage_tier === "持续观察").length,
  background: candidates.filter((item) => item.triage_tier === "背景材料").length,
  low_relevance: candidates.filter((item) => item.triage_tier === "低相关").length,
  trials_exempt_from_review: candidates.filter((item) => item.candidate_type === "trial").length,
  human_review_required: candidates.filter(requiresHumanReview).length,
  policy_excluded_research: excludedResearch.length,
  undifferentiated_review_exceptions: candidates.filter(isUndifferentiatedHighValueReview).length
});
