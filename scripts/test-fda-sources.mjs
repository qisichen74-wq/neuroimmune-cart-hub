import assert from "node:assert/strict";
import { extractFdaLinks, filterRelevantCberLinks, parseCberApprovedProducts } from "./fda-sources.mjs";

const approvedFixture = `
<html><body><main><table>
<tr><th>Product & Trade Name</th><th>Manufacturer</th></tr>
<tr><td><a href="/product/kymriah">KYMRIAH (tisagenlecleucel)</a></td><td>Novartis</td></tr>
<tr><td>TREGZI (allogeneic regulatory T cell immunotherapy)</td><td>Orca Biosystems</td></tr>
</table></main></body></html>`;

const approved = parseCberApprovedProducts(approvedFixture, "https://www.fda.gov/approved");
assert.equal(approved.length, 2);
assert.equal(approved[0].product_name, "KYMRIAH (tisagenlecleucel)");
assert.equal(approved[0].source_url, "https://www.fda.gov/product/kymriah");
assert.equal(approved[1].manufacturer, "Orca Biosystems");

const newsFixture = `<main>
<a href="/car-t-safety">FDA updates CAR-T safety labeling</a>
<a href="/food-recall">Food recall notice</a>
</main>`;
assert.equal(extractFdaLinks(newsFixture, "https://www.fda.gov/news").length, 2);
const relevant = filterRelevantCberLinks(newsFixture, "https://www.fda.gov/news", /CAR[- ]?T/i);
assert.equal(relevant.length, 1);
assert.equal(relevant[0].url, "https://www.fda.gov/car-t-safety");

console.log("FDA source parsers: OK");
