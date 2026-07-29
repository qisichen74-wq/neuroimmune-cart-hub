import assert from "node:assert/strict";
import { fetchChinaDrugTrials, isChinaDrugTrialsChallenge, parseChinaDrugTrialsSearch } from "./china-drug-trials.mjs";

const fixture = `
<html><body><h1>药物临床试验登记与信息公示平台</h1><table>
  <tr><th>序号</th><th>登记号</th><th>试验状态</th><th>药物名称</th><th>适应症</th><th>试验通俗题目</th></tr>
  <tr><td>1</td><td><a href="/clinicaltrials.searchlistdetail.dhtml?id=abc123">CTR20261234</a></td><td>进行中 尚未招募</td><td>CD19 CAR-T细胞注射液</td><td>系统性红斑狼疮</td><td>评价CD19 CAR-T治疗系统性红斑狼疮的临床试验</td></tr>
</table><div>当前第 1 页，共 1 页，共 1 条记录</div></body></html>`;

const parsed = parseChinaDrugTrialsSearch(fixture, "https://www.chinadrugtrials.org.cn/clinicaltrials.searchlist.dhtml?keywords=CAR-T");
assert.equal(parsed.total, 1);
assert.equal(parsed.items.length, 1);
assert.equal(parsed.items[0].registration_number, "CTR20261234");
assert.equal(parsed.items[0].status, "进行中 尚未招募");
assert.equal(parsed.items[0].indications, "系统性红斑狼疮");
assert.equal(parsed.items[0].source_url, "https://www.chinadrugtrials.org.cn/clinicaltrials.searchlistdetail.dhtml?id=abc123");
assert.equal(isChinaDrugTrialsChallenge(202, "<html></html>"), true);
assert.equal(isChinaDrugTrialsChallenge(200, fixture), false);

process.env.CHINA_DRUG_TRIALS_API_KEY = "test-only";
const managed = await fetchChinaDrugTrials({
  sourceConfig: {
    enabled: true,
    managed_api_base: "https://example.invalid",
    max_pages_per_query: 1,
    managed_api_request_delay_ms: 0,
    queries: [{ id: "sle", term: "CAR-T 系统性红斑狼疮" }]
  },
  fetchImpl: async () => new Response(JSON.stringify({
    status: "success",
    data: {
      page: 1,
      total: 1,
      items: [{
        registration_number: "CTR20261234",
        trial_id: "abc123",
        status: "进行中 尚未招募",
        drug_name: "CD19 CAR-T细胞注射液",
        indications: "系统性红斑狼疮",
        title: "评价CD19 CAR-T治疗系统性红斑狼疮的临床试验"
      }]
    }
  }), { status: 200, headers: { "content-type": "application/json" } })
});
delete process.env.CHINA_DRUG_TRIALS_API_KEY;
assert.equal(managed.status, "ok");
assert.equal(managed.access_method, "managed_readonly_wrapper");
assert.equal(managed.records.length, 1);
assert.equal(managed.records[0].registration_number, "CTR20261234");
assert.deepEqual(managed.records[0].query_ids, ["sle"]);

console.log("China Drug Trials parser: OK");
