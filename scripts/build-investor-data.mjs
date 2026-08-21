import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const loadRecords = async (name) => (JSON.parse(await readFile(path.join(dataDir, name), "utf8"))).records;
const [deals, organizations, programs, dealEvents] = await Promise.all([
  loadRecords("deals.json"), loadRecords("organizations.json"), loadRecords("programs.json"), loadRecords("deal-events.json")
]);

const byDate = [...deals].sort((a, b) => b.announced_date.localeCompare(a.announced_date));
const summary = {
  schema_version: "1.0.0",
  as_of: JSON.parse(await readFile(path.join(dataDir, "deals.json"), "utf8")).as_of,
  metrics: {
    transactions: deals.length,
    active_transactions: deals.filter((deal) => deal.status === "active").length,
    organizations: organizations.length,
    linked_programs: new Set(deals.flatMap((deal) => deal.program_ids || [])).size,
    undisclosed_transactions: deals.filter((deal) => deal.terms.disclosure === "undisclosed").length
  },
  by_type: Object.entries(deals.reduce((groups, deal) => {
    groups[deal.deal_type] = [...(groups[deal.deal_type] || []), deal];
    return groups;
  }, {})).map(([deal_type, rows]) => ({ deal_type, count: rows.length })),
  latest_deal_ids: byDate.slice(0, 5).map((deal) => deal.id),
  methodology: "金额均按公司或监管一手披露口径录入；已到账、潜在总额与未披露严格分列，不汇总为单一总交易额。"
};

const searchIndex = [
  ...organizations.map((item) => ({ type: "organization", id: item.id, title: item.name, copy: [item.kind, item.country, item.ticker].filter(Boolean).join(" · "), tags: [item.status, item.kind, item.country].filter(Boolean), url: `company.html?id=${encodeURIComponent(item.id)}` })),
  ...programs.map((item) => ({ type: "program", id: item.id, title: item.name, copy: `${item.technology} · ${item.targets.join("/")}`, tags: [...item.aliases, ...item.indications, item.status], url: `company.html?id=${encodeURIComponent(item.owner_org_id)}` })),
  ...deals.map((item) => ({ type: "deal", id: item.id, title: item.title, copy: item.investor_relevance, tags: [item.deal_type, item.status, item.announced_date, item.terms.disclosure], url: `deal.html?id=${encodeURIComponent(item.id)}` }))
];

await writeFile(path.join(dataDir, "investor-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(path.join(dataDir, "search-index.json"), `${JSON.stringify({ schema_version: "1.0.0", as_of: summary.as_of, records: searchIndex }, null, 2)}\n`);

const manifestFiles = ["daily-briefing.json", "deal-events.json", "deals.json", "events.json", "feed.json", "investor-summary.json", "landscape.json", "organizations.json", "programs.json", "relations.json", "safety.json", "search-index.json", "sources.json", "topics.json", "trials.json", "verification.json"];
const files = [];
for (const name of manifestFiles) {
  const content = await readFile(path.join(dataDir, name));
  files.push({ path: `data/${name}`, sha256: createHash("sha256").update(content).digest("hex"), bytes: content.byteLength });
}
let git_revision = "unavailable";
try { git_revision = (await promisify(execFile)("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim(); } catch { /* Builds outside git remain valid. */ }
await writeFile(path.join(dataDir, "release-manifest.json"), `${JSON.stringify({ schema_version: "1.0.0", generated_at: new Date().toISOString(), git_revision, files }, null, 2)}\n`);
console.log(`Investor data: ${deals.length} deals, ${organizations.length} organizations, ${programs.length} programs`);
