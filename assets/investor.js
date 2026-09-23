(() => {
  const page = document.body.dataset.investorPage;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const load = (name) => fetch(`data/${name}.json`).then((response) => { if (!response.ok) throw new Error(name); return response.json(); });
  const records = (payload) => Array.isArray(payload) ? payload : payload.records;
  const labels = { acquisition: "并购", reverse_merger: "反向合并", private_financing: "私募融资", debt_financing: "债务融资", ipo: "IPO", manufacturing_supply: "制造供应", active: "履约中", completed: "已完成" };
  const money = (value) => value == null ? "未披露" : value >= 1000 ? `$${(value / 1000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}B` : `$${value.toLocaleString("zh-CN")}M`;
  const valueLabel = (deal) => deal.terms.paid_or_funded_millions == null ? "金额未披露" : `${money(deal.terms.paid_or_funded_millions)} ${deal.deal_type === "debt_financing" ? "已到账" : "已支付/募资"}`;

  async function renderDeals() {
    const [dealPayload, summary] = await Promise.all([load("deals"), load("investor-summary")]);
    const deals = records(dealPayload).sort((a, b) => b.announced_date.localeCompare(a.announced_date));
    const metricRows = [[summary.metrics.transactions, "已核验交易"], [summary.metrics.active_transactions, "履约中协议"], [summary.metrics.organizations, "关联机构"], [summary.metrics.linked_programs, "关联项目"], [summary.metrics.undisclosed_transactions, "金额未披露"]];
    document.getElementById("deal-metrics").innerHTML = metricRows.map(([value, label]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join("");
    const types = ["all", ...new Set(deals.map((deal) => deal.deal_type))];
    document.getElementById("deal-filters").innerHTML = types.map((type) => `<button class="${type === "all" ? "is-active" : ""}" data-type="${type}">${type === "all" ? "全部" : labels[type]}</button>`).join("");
    const draw = (type = "all") => {
      const visible = type === "all" ? deals : deals.filter((deal) => deal.deal_type === type);
      document.getElementById("deal-list").innerHTML = visible.map((deal) => `<a class="deal-row" href="deal.html?id=${encodeURIComponent(deal.id)}"><time class="deal-date">${esc(deal.announced_date)}</time><div><div class="deal-title">${esc(deal.title)}</div><div class="deal-copy">${esc(deal.investor_relevance)}</div></div><div class="deal-value"><strong>${esc(valueLabel(deal))}</strong><span>${deal.terms.potential_total_millions != null && deal.terms.potential_total_millions !== deal.terms.paid_or_funded_millions ? `潜在总额 ${money(deal.terms.potential_total_millions)}` : labels[deal.deal_type]}</span></div><div class="deal-status">${labels[deal.status] || esc(deal.status)}</div></a>`).join("") || '<div class="empty-state">当前筛选下没有交易。</div>';
    };
    document.querySelectorAll("#deal-filters button").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("#deal-filters button").forEach((item) => item.classList.toggle("is-active", item === button)); draw(button.dataset.type); }));
    draw();
    document.getElementById("deal-method").textContent = summary.methodology;
  }

  async function renderDeal() {
    const id = new URLSearchParams(location.search).get("id");
    const [deals, organizations, programs, events] = await Promise.all([load("deals").then(records), load("organizations").then(records), load("programs").then(records), load("deal-events").then(records)]);
    const deal = deals.find((item) => item.id === id);
    if (!deal) throw new Error("deal-not-found");
    const orgMap = new Map(organizations.map((item) => [item.id, item]));
    const programMap = new Map(programs.map((item) => [item.id, item]));
    document.title = `${deal.title} - 交易详情`;
    document.getElementById("deal-detail").innerHTML = `<a class="back-link" href="deals.html">← 返回资本与交易</a><section class="investor-hero"><div class="eyebrow">${labels[deal.deal_type]} / ${labels[deal.status] || deal.status}</div><h1>${esc(deal.title)}</h1><p>${esc(deal.investor_relevance)}</p></section><div class="detail-grid"><div><section class="card"><h2>交易口径</h2><div class="term-grid"><div class="term"><strong>${money(deal.terms.paid_or_funded_millions)}</strong><span>已支付或已到账</span></div><div class="term"><strong>${money(deal.terms.potential_total_millions)}</strong><span>潜在总额</span></div><div class="term"><strong>${money(deal.terms.contingent_millions)}</strong><span>或有/条件金额</span></div></div><p>${esc(deal.terms.basis)}</p></section><section class="card" style="margin-top:18px"><h2>交易节点</h2><div class="timeline">${events.filter((event) => event.deal_id === deal.id).sort((a,b) => a.date.localeCompare(b.date)).map((event) => `<div class="timeline-item"><time>${esc(event.date)} · ${esc(event.event_type)}</time><div>${esc(event.title)}</div></div>`).join("")}</div></section><section class="card" style="margin-top:18px"><h2>一手来源</h2><div class="source-list">${deal.evidence.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener"><strong>${esc(source.title)}</strong><small>${esc(source.publication_date)} · ${esc(source.claim_scope)}</small></a>`).join("")}</div></section></div><aside><section class="card"><h2>参与方</h2>${deal.parties.map((party) => { const org = orgMap.get(party.org_id); return `<div class="party"><a href="company.html?id=${encodeURIComponent(party.org_id)}">${esc(org?.name || party.org_id)}</a><span>${esc(party.role)}</span></div>`; }).join("")}</section><section class="card" style="margin-top:18px"><h2>关联项目</h2>${deal.program_ids.map((programId) => `<span class="program-pill">${esc(programMap.get(programId)?.name || programId)}</span>`).join("") || "未关联具体项目"}</section></aside></div>`;
  }

  async function renderCompany() {
    const id = new URLSearchParams(location.search).get("id");
    const [organizations, programs, deals] = await Promise.all([load("organizations").then(records), load("programs").then(records), load("deals").then(records)]);
    const org = organizations.find((item) => item.id === id);
    if (!org) throw new Error("organization-not-found");
    const linkedPrograms = programs.filter((program) => program.owner_org_id === id);
    const linkedDeals = deals.filter((deal) => deal.parties.some((party) => party.org_id === id));
    document.title = `${org.name} - 公司详情`;
    document.getElementById("company-detail").innerHTML = `<a class="back-link" href="deals.html">← 返回资本与交易</a><section class="investor-hero"><div class="eyebrow">Organization / ${esc(org.kind)}</div><h1>${esc(org.name)}</h1><p>${[org.ticker, org.country, org.status].filter(Boolean).map(esc).join(" · ")}</p></section><div class="detail-grid"><section><div class="investor-toolbar"><div><div class="eyebrow">Transaction history</div><h2>关联交易</h2></div></div><div class="deal-list">${linkedDeals.sort((a,b) => b.announced_date.localeCompare(a.announced_date)).map((deal) => `<a class="deal-row" href="deal.html?id=${encodeURIComponent(deal.id)}"><time class="deal-date">${esc(deal.announced_date)}</time><div><div class="deal-title">${esc(deal.title)}</div><div class="deal-copy">${esc(deal.investor_relevance)}</div></div><div class="deal-value"><strong>${esc(valueLabel(deal))}</strong><span>${labels[deal.deal_type]}</span></div><div class="deal-status">${labels[deal.status] || esc(deal.status)}</div></a>`).join("") || '<div class="empty-state">暂无关联交易。</div>'}</div></section><aside><section class="card"><h2>研发项目</h2>${linkedPrograms.map((program) => `<div class="party"><div><strong>${esc(program.name)}</strong><br><span>${esc(program.technology)} · ${program.targets.map(esc).join("/")}</span></div><span>${program.indications.map(esc).join(" / ")}</span></div>`).join("") || "暂无关联项目"}</section></aside></div>`;
  }

  const run = page === "deals" ? renderDeals : page === "deal" ? renderDeal : renderCompany;
  run().catch(() => { const target = document.querySelector("main"); if (target) target.innerHTML = '<div class="empty-state">档案暂时无法打开，请返回交易总览重试。</div>'; });
})();
