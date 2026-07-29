const apiBase = "https://api.fda.gov";
const fdaBase = "https://www.fda.gov";

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const decodeHtml = (value) => String(value || "")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, "\"")
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const stripHtml = (value) => clean(decodeHtml(String(value || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")));

const mainHtml = (html) => String(html || "").match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || String(html || "");

const absoluteUrl = (href, base = fdaBase) => {
  try { return new URL(href, base).toString(); }
  catch { return ""; }
};

const first = (value) => Array.isArray(value) ? value[0] || "" : value || "";
const truncate = (value, length) => clean(value).slice(0, length);

const formatFdaDate = (value) => {
  const text = String(value || "");
  return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` : text;
};

export const extractFdaLinks = (html, pageUrl) => {
  const seen = new Set();
  const links = [];
  for (const match of mainHtml(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = stripHtml(match[2]);
    const url = absoluteUrl(match[1], pageUrl);
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);
    links.push({ title, url });
  }
  return links;
};

export const parseCberApprovedProducts = (html, pageUrl) => {
  const products = [];
  for (const row of mainHtml(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => stripHtml(match[1]));
    if (cells.length < 2 || /product.*trade name/i.test(cells[0])) continue;
    const link = extractFdaLinks(row[1], pageUrl)[0];
    if (!cells[0] || !cells[1]) continue;
    products.push({ product_name: cells[0], manufacturer: cells[1], source_url: link?.url || pageUrl });
  }
  return products;
};

export const filterRelevantCberLinks = (html, pageUrl, pattern) => extractFdaLinks(html, pageUrl)
  .filter((item) => pattern.test(item.title))
  .map((item) => ({ ...item, source: "FDA/CBER" }));

const fetchJson = async (url, fetchImpl, headers) => {
  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(45000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
};

const fetchText = async (url, fetchImpl, headers) => {
  const response = await fetchImpl(url, { headers, redirect: "follow", signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { text: await response.text(), resolved_url: response.url || url };
};

const buildApiUrl = (pathname, params = {}) => {
  const url = new URL(pathname, apiBase);
  const apiKey = process.env.OPENFDA_API_KEY || "";
  if (apiKey) url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) if (value !== "") url.searchParams.set(key, String(value));
  return url.toString();
};

const publicApiUrl = (value) => {
  const url = new URL(value);
  url.searchParams.delete("api_key");
  return url.toString();
};

export const fetchFdaSources = async ({ sourceConfig = {}, fetchImpl = fetch } = {}) => {
  const headers = { "user-agent": "neuroimmune-cart-hub/0.1 FDA regulatory monitoring", accept: "application/json,text/html" };
  const sources = [];
  const labels = [];
  const approvedCellGeneProducts = [];
  const regulatoryUpdates = [];
  let faersSummary = { status: "not_run", reactions: [] };

  try {
    const payload = await fetchJson(buildApiUrl("/drug/drugsfda.json", { limit: 1 }), fetchImpl, headers);
    sources.push({
      id: "drugsfda-api",
      name: "Drugs@FDA / openFDA",
      source_kind: "official_api",
      status: payload ? "ok" : "error",
      url: "https://open.fda.gov/apis/drug/drugsfda/",
      last_updated: payload?.meta?.last_updated || "",
      records_available: payload?.meta?.results?.total || 0,
      scope_note: "Drugs@FDA并不完整覆盖所有细胞和基因治疗产品；相关批准以FDA/CBER产品页为主。"
    });
  } catch (error) {
    sources.push({ id: "drugsfda-api", name: "Drugs@FDA / openFDA", source_kind: "official_api", status: "error", url: "https://open.fda.gov/apis/drug/drugsfda/", error: error.message });
  }

  let labelLastUpdated = "";
  const labelResults = await Promise.all((sourceConfig.cart_label_brands || []).map(async (brand) => {
    try {
      const search = `openfda.brand_name:\"${brand}\"`;
      const url = buildApiUrl("/drug/label.json", { search, limit: 1 });
      const payload = await fetchJson(url, fetchImpl, headers);
      const item = payload?.results?.[0];
      if (!item) {
        return { item: { brand_name: brand, status: "not_found", source_url: publicApiUrl(url) }, last_updated: payload?.meta?.last_updated || "" };
      }
      return {
        last_updated: payload?.meta?.last_updated || "",
        item: {
          brand_name: first(item.openfda?.brand_name) || brand,
          generic_name: first(item.openfda?.generic_name),
          manufacturer: first(item.openfda?.manufacturer_name),
          application_number: first(item.openfda?.application_number),
          product_type: first(item.openfda?.product_type),
          effective_date: formatFdaDate(item.effective_time),
          version: item.version || "",
          recent_major_changes: truncate(first(item.recent_major_changes), 1200),
          boxed_warning: truncate(first(item.boxed_warning), 3000),
          indications_and_usage: truncate(first(item.indications_and_usage), 2400),
          status: "ok",
          source_url: publicApiUrl(url)
        }
      };
    } catch (error) {
      return { item: { brand_name: brand, status: "error", error: error.message }, last_updated: "" };
    }
  }));
  labels.push(...labelResults.map((result) => result.item));
  labelLastUpdated = labelResults.find((result) => result.last_updated)?.last_updated || "";
  const labelErrors = labels.filter((item) => item.status === "error").length;
  sources.push({
    id: "openfda-label",
    name: "openFDA Drug Labeling",
    source_kind: "official_api",
    status: labelErrors ? (labels.some((item) => item.status === "ok") ? "partial" : "error") : "ok",
    url: "https://open.fda.gov/apis/drug/label/",
    last_updated: labelLastUpdated,
    records_checked: labels.length,
    records_found: labels.filter((item) => item.status === "ok").length,
    errors: labelErrors
  });

  try {
    const brands = (sourceConfig.faers_cart_brands || sourceConfig.cart_label_brands || []).slice(0, 8);
    const search = brands.map((brand) => `patient.drug.openfda.brand_name:\"${brand}\"`).join(" ");
    const url = buildApiUrl("/drug/event.json", { search, count: "patient.reaction.reactionmeddrapt.exact", limit: 20 });
    const payload = brands.length ? await fetchJson(url, fetchImpl, headers) : null;
    faersSummary = {
      status: payload ? "ok" : "not_run",
      source_url: publicApiUrl(url),
      last_updated: payload?.meta?.last_updated || "",
      products: brands,
      reactions: (payload?.results || []).map((item) => ({ term: item.term, report_count: item.count })),
      interpretation: "FAERS为自发报告信号，不能证明因果关系、发生率或产品间风险差异。"
    };
    sources.push({ id: "openfda-faers", name: "openFDA / FAERS", source_kind: "official_api", status: faersSummary.status === "ok" ? "ok" : "partial", url: "https://open.fda.gov/apis/drug/event/", last_updated: faersSummary.last_updated });
  } catch (error) {
    faersSummary = { status: "error", reactions: [], error: error.message, interpretation: "FAERS为自发报告信号，不能证明因果关系、发生率或产品间风险差异。" };
    sources.push({ id: "openfda-faers", name: "openFDA / FAERS", source_kind: "official_api", status: "error", url: "https://open.fda.gov/apis/drug/event/", error: error.message });
  }

  const approvedUrl = sourceConfig.cber_approved_products_url || `${fdaBase}/vaccines-blood-biologics/cellular-gene-therapy-products/approved-cellular-and-gene-therapy-products`;
  try {
    const page = await fetchText(approvedUrl, fetchImpl, headers);
    approvedCellGeneProducts.push(...parseCberApprovedProducts(page.text, page.resolved_url));
    sources.push({ id: "fda-cber-approved", name: "FDA/CBER Approved Cellular and Gene Therapy Products", source_kind: "official_page", status: approvedCellGeneProducts.length ? "ok" : "partial", url: approvedUrl, records_found: approvedCellGeneProducts.length });
  } catch (error) {
    sources.push({ id: "fda-cber-approved", name: "FDA/CBER Approved Cellular and Gene Therapy Products", source_kind: "official_page", status: "error", url: approvedUrl, error: error.message });
  }

  const relevantPattern = new RegExp(sourceConfig.relevant_cber_pattern || "CAR[- ]?T|chimeric antigen|cellular therap|gene therap|T[- ]?cell|BLA|biologic|autoimmune|lupus|myasthen|multiple sclerosis|scleroderma|myositis", "i");
  const cberPages = [
    { id: "fda-cber-news", name: "FDA/CBER What's New for Biologics", url: sourceConfig.cber_news_url || `${fdaBase}/vaccines-blood-biologics/news-events-biologics/whats-new-biologics`, category: "CBER news" },
    ...[0, 1, 2].map((offset) => {
      const year = new Date().getUTCFullYear() - offset;
      return { id: `fda-cber-safety-${year}`, name: `FDA/CBER ${year} Safety and Availability Communications`, url: `${fdaBase}/vaccines-blood-biologics/safety-availability-biologics/${year}-safety-and-availability-communications`, category: "CBER safety" };
    })
  ];
  await Promise.all(cberPages.map(async (pageConfig) => {
    try {
      const page = await fetchText(pageConfig.url, fetchImpl, headers);
      const items = filterRelevantCberLinks(page.text, page.resolved_url, relevantPattern).map((item) => ({ ...item, category: pageConfig.category }));
      regulatoryUpdates.push(...items);
      sources.push({ id: pageConfig.id, name: pageConfig.name, source_kind: "official_page", status: "ok", url: pageConfig.url, relevant_links: items.length });
    } catch (error) {
      sources.push({ id: pageConfig.id, name: pageConfig.name, source_kind: "official_page", status: "error", url: pageConfig.url, error: error.message });
    }
  }));

  sources.sort((a, b) => a.id.localeCompare(b.id));
  const dedupedUpdates = [...new Map(regulatoryUpdates.map((item) => [item.url, item])).values()]
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  const failures = sources.filter((item) => item.status === "error").length;
  return {
    generated_at: new Date().toISOString(),
    policy: {
      trial_registration: "ClinicalTrials.gov记录只证明试验登记，不等同于FDA IND获准。",
      ind_authorization: "IND信息只有FDA正式公告可直接记为FDA确认；企业披露必须标明公司口径。",
      marketing_approval: "FDA/CBER批准产品页、批准函或Drugs@FDA正式记录才能支持上市批准表述。",
      label_information: "openFDA标签来自企业向FDA提交的SPL；应与FDA批准文件及当前标签交叉核验。",
      faers_signal: "FAERS自发报告不能建立因果关系，也不能估算发生率或进行产品间风险比较。"
    },
    summary: {
      sources: sources.length,
      available: sources.filter((item) => item.status === "ok").length,
      partial: sources.filter((item) => item.status === "partial").length,
      failed: failures,
      labels_found: labels.filter((item) => item.status === "ok").length,
      approved_cell_gene_products: approvedCellGeneProducts.length,
      relevant_cber_updates: dedupedUpdates.length
    },
    sources,
    cart_labels: labels,
    approved_cell_gene_products: approvedCellGeneProducts,
    cber_updates: dedupedUpdates,
    faers_summary: faersSummary
  };
};
