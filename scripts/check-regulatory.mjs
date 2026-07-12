import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const endpoints = [
  { id: "nmpa-home", name: "国家药品监督管理局", url: "https://www.nmpa.gov.cn/", scope: "上市批准、监管公告与安全信息" },
  { id: "nmpa-trial-approval", name: "NMPA药物临床试验审批", url: "https://zwfw.nmpa.gov.cn/web/taskview/11100000MB0341032Y100017210200001", scope: "临床试验行政许可与60工作日默示许可制度" },
  { id: "nmpa-trial-registration", name: "NMPA药物临床试验登记", url: "https://zwfw.nmpa.gov.cn/web/taskview/11100000MB0341032Y100207202900001", scope: "境内药物临床试验登记义务与平台入口" },
  { id: "cde-home", name: "国家药监局药品审评中心", url: "https://www.cde.org.cn/", scope: "受理品种、审评任务、指导原则与年度报告" },
  { id: "china-drug-trials", name: "药物临床试验登记与信息公示平台", url: "http://www.chinadrugtrials.org.cn/", scope: "境内药物临床试验方案与结果公示" }
];

const checks = [];
for (const endpoint of endpoints) {
  try {
    const response = await fetch(endpoint.url, { redirect: "follow", headers: { "user-agent": "neuroimmune-cart-hub/0.1 regulatory-watch" } });
    const text = await response.text();
    checks.push({ ...endpoint, status: response.ok ? "available" : "error", http_status: response.status, resolved_url: response.url, content_bytes: Buffer.byteLength(text), checked_at: new Date().toISOString() });
  } catch (error) {
    checks.push({ ...endpoint, status: "error", error: error.message, checked_at: new Date().toISOString() });
  }
}

const report = {
  generated_at: new Date().toISOString(),
  policy: {
    trial_registration: "登记平台存在试验记录，只能证明试验已登记公示。",
    clinical_trial_authorization: "临床试验获准或默示许可，不等同于产品获准上市。",
    marketing_authorization: "只有NMPA正式上市批准信息才能记为获批上市。",
    company_disclosure: "企业新闻仅作发现线索，不能替代NMPA/CDE监管记录。"
  },
  summary: { endpoints: checks.length, available: checks.filter((item) => item.status === "available").length, failed: checks.filter((item) => item.status === "error").length },
  checks
};
await writeFile(path.join(root, "data/regulatory-watch-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Regulatory watch: ${report.summary.available}/${report.summary.endpoints} official endpoints available | ${report.summary.failed} failures`);
