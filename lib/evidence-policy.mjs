const DAY = 86_400_000;

// Date-only review deadlines use the site's Asia/Shanghai calendar day.
export function policyDay(now = new Date()) {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function assessFreshness(record, now = new Date()) {
  const today = dateValue(policyDay(now));
  const checked = dateValue(record.last_verified_at);
  const deadline = dateValue(record.next_review_at);
  const days = Number(record.freshness_policy_days);
  const status = record.verification_status || record.status;
  const reasons = [];
  if (status === "已过期") reasons.push("marked_expired");
  if (checked !== null && Number.isFinite(days) && days > 0 && today - checked > days * DAY) reasons.push("review_age_exceeded");
  if (deadline !== null && deadline < today) reasons.push("review_deadline_passed");
  const invalid = (Boolean(record.last_verified_at) && checked === null)
    || (Boolean(record.next_review_at) && deadline === null) || (checked !== null && checked > today);
  const stale = reasons.length > 0;
  return {
    stale,
    freshness_state: invalid ? "invalid" : checked === null ? "unknown" : stale ? "stale" : "current",
    freshness_reasons: reasons,
    current_verified: status === "已核验" && !stale && !invalid && checked !== null
  };
}

export function resolveVerification({ type, record, payload, policy, override = {} }) {
  const embedded = payload?.verified_at && record.source_ids?.length
    ? { status: "已核验", confidence: "高", source_ids: record.source_ids, last_verified_at: payload.verified_at }
    : {};
  return {
    record_type: type,
    record_id: record.id,
    ...(policy.defaults?.[type] || {}),
    ...embedded,
    ...override,
    freshness_policy_days: policy.freshness_policy_days?.[type] ?? null
  };
}
