import { assessFreshness } from "./evidence-policy.mjs";

export function fieldEvidenceState(evidence, now = new Date()) {
  if (!evidence || evidence.scope !== "registry-fields-only") return null;
  return assessFreshness({ ...evidence, verification_status: "已核验" }, now);
}

export function enrollmentLabel(value) {
  return value === "ACTUAL" ? "实际入组" : value === "ESTIMATED" ? "计划入组" : "登记入组数（类型未注明）";
}

export function fieldEvidenceSummary(evidence) {
  const f = evidence.fields;
  const phases = f.phases.length ? f.phases.map((phase) => phase.replace("PHASE", "Phase ")).join("/") : "不适用临床分期";
  const status = ({ ACTIVE_NOT_RECRUITING: "进行中，停止招募", RECRUITING: "招募中", WITHDRAWN: "已撤回" })[f.status] || f.status;
  return `${evidence.registry_id}；${phases}；登记状态：${status}；${enrollmentLabel(f.enrollment_type)} ${f.enrollment} 例；登记平台${f.registry_has_results === true ? "已" : f.registry_has_results === false ? "未" : "未明确是否"}发布结果。不代表论文或其他披露情况。`;
}
