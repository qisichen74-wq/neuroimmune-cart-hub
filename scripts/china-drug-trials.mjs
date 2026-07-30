import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const officialBaseUrl = "https://www.chinadrugtrials.org.cn";
const defaultManagedApiBase = "https://api.parse.bot/scraper/0b80c465-d3c2-495c-ba35-cf0bcd0e0c7e";

const chinaDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const readJsonIfExists = async (file) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};

const writeJson = async (file, value) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
};

const decodeHtml = (value) => String(value || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, "\"")
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/\s+/g, " ")
  .trim();

const absoluteUrl = (href, baseUrl) => {
  try { return new URL(href, baseUrl).toString(); }
  catch { return ""; }
};

export const isChinaDrugTrialsChallenge = (status, html) =>
  status === 202
  || /9DhefwqGPrzGxEp9hPaoag|FSSBBIl1UgzbN7N80|r=['"]m['"]/.test(String(html || ""))
  || (!/药物临床试验登记与信息公示平台/.test(String(html || "")) && String(html || "").length < 1500);

export const parseChinaDrugTrialsSearch = (html, pageUrl) => {
  const items = [];
  for (const row of String(html || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = row[1];
    const cells = [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => decodeHtml(match[1]));
    const registrationNumber = cells.find((cell) => /\bCTR\d{8}\b/i.test(cell))?.match(/\bCTR\d{8}\b/i)?.[0]?.toUpperCase();
    if (!registrationNumber) continue;
    const detailHref = [...rowHtml.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)]
      .map((match) => match[1])
      .find((href) => /clinicaltrials\.searchlistdetail\.dhtml/i.test(href));
    const registrationIndex = cells.findIndex((cell) => cell.includes(registrationNumber));
    items.push({
      registration_number: registrationNumber,
      status: cells[registrationIndex + 1] || "",
      drug_name: cells[registrationIndex + 2] || "",
      indications: cells[registrationIndex + 3] || "",
      title: cells[registrationIndex + 4] || cells[registrationIndex + 3] || registrationNumber,
      trial_id: detailHref?.match(/[?&]id=([^&#]+)/i)?.[1] || "",
      source_url: detailHref ? absoluteUrl(detailHref, pageUrl) : `${officialBaseUrl}/clinicaltrials.searchlist.dhtml?keywords=${registrationNumber}`
    });
  }
  const pageText = decodeHtml(html);
  const totals = pageText.match(/共\s*(\d+)\s*页[^\d]+共\s*(\d+)\s*条记录/);
  return {
    items,
    total_pages: Number(totals?.[1] || (items.length ? 1 : 0)),
    total: Number(totals?.[2] || items.length)
  };
};

const normalizeManagedPayload = (payload) => {
  const data = payload?.data || payload || {};
  return {
    page: Number(data.page || 1),
    total: Number(data.total || 0),
    items: Array.isArray(data.items) ? data.items : []
  };
};

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const fetchChinaDrugTrials = async ({
  sourceConfig = {},
  headers = {},
  maxRecords = 5000,
  fetchImpl = fetch
} = {}) => {
  const queries = sourceConfig.queries || [];
  const apiKey = process.env.CHINA_DRUG_TRIALS_API_KEY || process.env.PARSE_API_KEY || "";
  const queryRuns = [];
  const records = new Map();
  const errors = [];

  if (!sourceConfig.enabled) {
    return { status: "disabled", access_method: "disabled", records: [], query_runs: [], errors: [] };
  }

  if (apiKey) {
    const apiBase = sourceConfig.managed_api_base || defaultManagedApiBase;
    const maxPages = Math.max(1, Number(sourceConfig.max_pages_per_query || 3));
    const requestDelay = Math.max(0, Number(sourceConfig.managed_api_request_delay_ms || 13000));
    const monthlyCreditLimit = Math.min(100, Math.max(1, Number(sourceConfig.monthly_credit_limit || 80)));
    const creditsPerCall = Math.max(1, Number(sourceConfig.credits_per_call || 2));
    const cacheTtlDays = Math.max(1, Number(sourceConfig.cache_ttl_days || 7));
    const useCache = sourceConfig.cache_enabled !== false && fetchImpl === globalThis.fetch;
    const date = chinaDate();
    const month = date.slice(0, 7);
    const cacheDir = path.resolve(process.cwd(), sourceConfig.cache_dir || ".cache/china-drug-trials");
    const resultCacheFile = path.join(cacheDir, "latest.json");
    const usageFile = path.join(cacheDir, `${month}-usage.json`);

    if (useCache && process.env.CDE_FORCE_REFRESH !== "1") {
      const cached = await readJsonIfExists(resultCacheFile);
      const cacheAgeDays = cached?.saved_at ? (Date.now() - new Date(cached.saved_at).getTime()) / 86_400_000 : Infinity;
      if (cached?.result && cacheAgeDays >= 0 && cacheAgeDays < cacheTtlDays) {
        return {
          ...cached.result,
          cached: true,
          cache_date: cached.date || date,
          cache_ttl_days: cacheTtlDays,
          monthly_credit_limit: monthlyCreditLimit,
          credits_per_call: creditsPerCall
        };
      }
    }

    const reserveMonthlyCredits = async () => {
      if (!useCache) return;
      const usage = await readJsonIfExists(usageFile) || { month, credits: 0, calls: 0 };
      if (usage.credits + creditsPerCall > monthlyCreditLimit) {
        throw new Error(`monthly API credit safety limit reached (${usage.credits}/${monthlyCreditLimit})`);
      }
      usage.calls += 1;
      usage.credits += creditsPerCall;
      usage.updated_at = new Date().toISOString();
      await writeJson(usageFile, usage);
    };

    let requestCount = 0;
    for (const query of queries) {
      let scanned = 0;
      let total = 0;
      let truncated = false;
      try {
        for (let page = 1; page <= maxPages && records.size < maxRecords; page += 1) {
          if (requestCount && requestDelay) await pause(requestDelay);
          await reserveMonthlyCredits();
          requestCount += 1;
          const params = new URLSearchParams({ page: String(page), query: query.term });
          const response = await fetchImpl(`${apiBase}/search_trials?${params}`, {
            headers: { ...headers, "X-API-Key": apiKey },
            signal: AbortSignal.timeout(30000)
          });
          if (!response.ok) throw new Error(`managed API ${response.status} ${response.statusText}`);
          const result = normalizeManagedPayload(await response.json());
          total = result.total;
          for (const item of result.items) {
            const registrationNumber = String(item.registration_number || item.reg_no || "").toUpperCase();
            if (!/^CTR\d{8}$/.test(registrationNumber)) continue;
            const trialId = item.trial_id || "";
            const sourceUrl = trialId
              ? `${officialBaseUrl}/clinicaltrials.searchlistdetail.dhtml?id=${encodeURIComponent(trialId)}`
              : `${officialBaseUrl}/clinicaltrials.searchlist.dhtml?keywords=${registrationNumber}`;
            const existing = records.get(registrationNumber) || { ...item, registration_number: registrationNumber, source_url: sourceUrl, query_ids: [] };
            existing.query_ids = [...new Set([...(existing.query_ids || []), query.id])];
            records.set(registrationNumber, existing);
          }
          scanned += result.items.length;
          if (!result.items.length || scanned >= total) break;
          if (page === maxPages) truncated = scanned < total;
        }
        queryRuns.push({ query_id: query.id, term: query.term, total_results: total, results_scanned: scanned, truncated });
      } catch (error) {
        errors.push(`${query.id}: ${error.message}`);
        queryRuns.push({ query_id: query.id, term: query.term, total_results: total, results_scanned: scanned, status: "error", error: error.message });
      }
    }
    const result = {
      status: errors.length ? (records.size ? "partial" : "error") : "ok",
      access_method: "managed_readonly_wrapper",
      records: [...records.values()],
      query_runs: queryRuns,
      errors,
      truncated: queryRuns.some((run) => run.truncated),
      cached: false,
      cache_date: date,
      api_calls_this_run: requestCount,
      credits_reserved_this_run: requestCount * creditsPerCall,
      cache_ttl_days: cacheTtlDays,
      monthly_credit_limit: monthlyCreditLimit,
      credits_per_call: creditsPerCall
    };
    if (useCache) await writeJson(resultCacheFile, { date, saved_at: new Date().toISOString(), result });
    return result;
  }

  const firstQuery = queries[0];
  if (!firstQuery) return { status: "partial", access_method: "direct_official_html", records: [], query_runs: [], errors: ["未配置 CDE 检索词"] };
  try {
    const url = `${officialBaseUrl}/clinicaltrials.searchlist.dhtml?keywords=${encodeURIComponent(firstQuery.term)}`;
    const response = await fetchImpl(url, { headers, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const html = await response.text();
    if (isChinaDrugTrialsChallenge(response.status, html)) {
      return {
        status: "partial",
        access_method: "direct_official_html",
        records: [],
        query_runs: [{ query_id: firstQuery.id, term: firstQuery.term, results_scanned: 0, status: "blocked_by_js_challenge" }],
        errors: ["CDE 官网返回 JavaScript 防护页；配置 CHINA_DRUG_TRIALS_API_KEY 后可自动切换结构化只读代理"],
        blocked_by_js_challenge: true
      };
    }
    const parsed = parseChinaDrugTrialsSearch(html, url);
    return {
      status: parsed.total_pages > 1 ? "partial" : "ok",
      access_method: "direct_official_html",
      records: parsed.items.map((item) => ({ ...item, query_ids: [firstQuery.id] })),
      query_runs: [{ query_id: firstQuery.id, term: firstQuery.term, total_results: parsed.total, results_scanned: parsed.items.length, truncated: parsed.total_pages > 1 }],
      errors: parsed.total_pages > 1 ? ["CDE 直连模式只读取第一页；建议配置结构化只读代理以完成分页"] : [],
      truncated: parsed.total_pages > 1
    };
  } catch (error) {
    return { status: "partial", access_method: "direct_official_html", records: [], query_runs: [], errors: [error.message] };
  }
};

export const chinaDrugTrialsOfficialUrl = officialBaseUrl;
