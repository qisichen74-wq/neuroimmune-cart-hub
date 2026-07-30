import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFdaSources } from "./fda-sources.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(root, "data/discovery-config.json"), "utf8"));
const report = await fetchFdaSources({ sourceConfig: config.fda || {} });
await writeFile(path.join(root, "data/fda-watch-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`FDA watch: ${report.summary.available}/${report.summary.sources} official sources available | ${report.summary.labels_found} CAR-T labels | ${report.summary.approved_cell_gene_products} CBER products | ${report.summary.failed} failures`);
