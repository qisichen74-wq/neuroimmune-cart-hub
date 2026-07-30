import { readFile } from "node:fs/promises";
import { fetchChinaDrugTrials } from "./china-drug-trials.mjs";

const config = JSON.parse(await readFile(new URL("../data/discovery-config.json", import.meta.url), "utf8"));
const result = await fetchChinaDrugTrials({
  sourceConfig: config.china_drug_trials,
  headers: { "user-agent": "Mozilla/5.0 (compatible; NeuroimmuneIntelligence/0.1; research monitoring)" }
});

console.log(JSON.stringify({
  source: "CDE 药物临床试验登记与信息公示平台",
  status: result.status,
  access_method: result.access_method,
  records: result.records.length,
  cached: Boolean(result.cached),
  cache_date: result.cache_date || "",
  cache_ttl_days: result.cache_ttl_days || null,
  api_calls_this_run: result.api_calls_this_run || 0,
  credits_reserved_this_run: result.credits_reserved_this_run || 0,
  monthly_credit_limit: result.monthly_credit_limit || null,
  credits_per_call: result.credits_per_call || null,
  blocked_by_js_challenge: Boolean(result.blocked_by_js_challenge),
  errors: result.errors
}, null, 2));

if (!["ok", "disabled"].includes(result.status)) process.exitCode = 2;
