(() => {
  Promise.all([
    fetch("data/investor-summary.json").then((response) => response.json()),
    fetch("data/deals.json").then((response) => response.json())
  ]).then(([summary, payload]) => {
    const dealMap = new Map(payload.records.map((deal) => [deal.id, deal]));
    const latest = summary.latest_deal_ids.map((id) => dealMap.get(id)).filter(Boolean).slice(0, 3);
    const section = document.createElement("section");
    section.className = "investor-home";
    section.innerHTML = `<style>
      .investor-home{max-width:1200px;margin:32px auto;padding:28px;border:1px solid var(--border,#d6ddd8);border-radius:14px;background:linear-gradient(120deg,#fff 0 70%,#e6f2ec)}
      .investor-home-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:16px}.investor-home-kicker{color:#0f766e;font:700 10px var(--mono,monospace);letter-spacing:.12em;text-transform:uppercase}.investor-home h2{margin:4px 0 0;font:600 27px "Iowan Old Style","Baskerville",serif}.investor-home-link{color:#176049;font-weight:700;text-decoration:none}
      .investor-home-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.investor-home-card{padding:15px;border:1px solid var(--border,#d6ddd8);border-radius:9px;background:#fff;color:inherit;text-decoration:none}.investor-home-card time{color:#707b73;font:10px var(--mono,monospace)}.investor-home-card strong{display:block;margin:6px 0 4px;font-size:14px}.investor-home-card span{color:#707b73;font-size:11px}@media(max-width:760px){.investor-home{margin:24px 16px;padding:20px}.investor-home-grid{grid-template-columns:1fr}}
    </style><div class="investor-home-head"><div><div class="investor-home-kicker">Capital intelligence</div><h2>资本与交易</h2></div><a class="investor-home-link" href="deals.html">查看全部 ${summary.metrics.transactions} 笔 →</a></div><div class="investor-home-grid">${latest.map((deal) => `<a class="investor-home-card" href="deal.html?id=${encodeURIComponent(deal.id)}"><time>${deal.announced_date}</time><strong>${deal.title}</strong><span>${deal.investor_relevance}</span></a>`).join("")}</div>`;
    const footer = document.querySelector("body > footer");
    if (footer) footer.before(section); else document.body.append(section);
  }).catch(() => {});
})();
