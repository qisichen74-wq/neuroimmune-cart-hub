(() => {
  if (localStorage.getItem("intel-language") === "en") return;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const style = document.createElement("style");
  style.textContent = `
    .decision-board{padding:28px 0;border-bottom:1px solid var(--border)}
    .decision-head{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:16px}
    .decision-kicker{color:var(--accent2);font:700 10px var(--font-mono,monospace);letter-spacing:.1em;text-transform:uppercase}
    .decision-head h2{margin-top:5px;font-size:27px;line-height:1.2}
    .decision-head p{max-width:580px;color:var(--text2);font-size:12px}
    .decision-link{display:inline-flex;align-items:center;gap:6px;margin-top:8px;color:var(--accent);font-size:11px;font-weight:700;text-decoration:none}
    .decision-grid{display:grid;grid-template-columns:1.3fr repeat(2,minmax(0,1fr));gap:10px}
    .decision-card{min-height:164px;padding:16px;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:9px;background:var(--surface)}
    .decision-card:first-child{grid-row:span 2;min-height:338px;padding:21px;background:linear-gradient(155deg,#fff 0%,var(--accent-light) 145%);border-top:3px solid var(--accent)}
    .decision-type{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:13px}
    .decision-number{color:var(--text3);font:700 10px var(--font-mono,monospace)}
    .decision-badge{padding:4px 8px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.04em}
    .decision-badge.verified{background:#eaf7ef;color:#167044}
    .decision-badge.review{background:#fff1cf;color:#8a5b00}
    .decision-badge.risk{background:#fff0ee;color:#b42318}
    .decision-badge.watch{background:#e7f0f8;color:#315f84}
    .decision-card h3{font-size:15px;line-height:1.45}
    .decision-card:first-child h3{font-size:22px;line-height:1.35}
    .decision-card p{margin-top:7px;color:var(--text2);font-size:11px;line-height:1.65}
    .decision-card:first-child p{font-size:13px}
    .decision-action{display:flex;justify-content:space-between;gap:10px;align-items:end;margin-top:auto;padding-top:13px;border-top:1px solid var(--border);color:var(--text3);font:9px var(--font-mono,monospace)}
    .decision-action a{color:var(--accent);font:700 11px var(--font-sans,sans-serif);text-decoration:none}
    .decision-empty{grid-column:1/-1;padding:30px;border:1px dashed var(--border);border-radius:9px;color:var(--text3);text-align:center}
    .decision-foot{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px;color:var(--text3);font-size:10px}
    .decision-foot span{padding:4px 8px;border:1px solid var(--border);border-radius:999px;background:var(--surface)}
    @media(max-width:900px){.decision-head{align-items:start;flex-direction:column}.decision-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.decision-card:first-child{grid-row:auto;grid-column:1/-1;min-height:230px}}
    @media(max-width:620px){.decision-grid{grid-template-columns:1fr}.decision-card:first-child{grid-column:auto;min-height:220px}.decision-head h2{font-size:23px}}
  `;
  document.head.appendChild(style);
  Promise.all([
    fetch("data/daily-briefing.json").then((response) => response.json()),
    fetch("data/topics.json").then((response) => response.json()).catch(() => [])
  ]).then(([briefing, topics]) => {
    const dossierCount = topics.filter((topic) => topic.kind === "疾病专题").length;
    const statValues = { "stat-total": briefing.snapshot.formal_records, "stat-high": briefing.snapshot.active_priority_trials, "stat-reviewed": briefing.snapshot.externally_verified, "stat-disease": dossierCount };
    const applyStats = () => Object.entries(statValues).forEach(([id, value]) => { const element = document.getElementById(id); if (element && element.textContent !== String(value)) element.textContent = value; });
    applyStats();
    const statsRoot = document.querySelector(".hero-stats");
    if (statsRoot) new MutationObserver(applyStats).observe(statsRoot, { childList: true, subtree: true, characterData: true });
    const hero = document.querySelector("main .hero") || document.querySelector(".hero");
    if (!hero || document.getElementById("daily-briefing")) return;
    const section = document.createElement("section");
    section.className = "decision-board";
    section.id = "daily-briefing";
    const decisions = [];
    (briefing.verified_updates || []).slice(0, 5).forEach((item) => decisions.push({
      badge: "已核验", tone: "verified", title: item.title, copy: item.summary, meta: `${item.date} · ${item.topic}`, href: item.source_url, action: "查看一手来源", external: true, weight: 80
    }));
    const trial = (briefing.trial_watch || [])[0];
    if (trial) decisions.push({
      badge: "持续观察", tone: "watch", title: trial.name, copy: `${trial.product} · ${trial.indication} · ${trial.status} · 计划入组 ${trial.enrollment} 例`, meta: `注册更新 ${trial.last_update}`, href: `detail.html?type=trial&id=${encodeURIComponent(trial.id)}`, action: "打开试验档案", weight: 60
    });
    const topDecisions = decisions.sort((left, right) => right.weight - left.weight).slice(0, 5);
    const cards = topDecisions.map((item, index) => `<article class="decision-card"><div class="decision-type"><span class="decision-badge ${item.tone}">${esc(item.badge)}</span><span class="decision-number">0${index + 1}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.copy)}</p><div class="decision-action"><span>${esc(item.meta)}</span><a href="${esc(item.href)}"${item.external ? ' target="_blank" rel="noopener"' : ""}>${esc(item.action)} →</a></div></article>`).join("");
    section.innerHTML = `<div class="decision-head"><div><div class="decision-kicker">DECISION DESK · ${topDecisions.length}/5</div><h2>今天最需要知道的五件事</h2></div><div><p>仅展示已进入正式数据集的核验动态和重点试验，便于快速进入对应档案。</p><a class="decision-link" href="research.html">浏览研究情报 →</a></div></div><div class="decision-grid">${cards || '<div class="decision-empty">当前没有需要升级到决策层的事项。</div>'}</div><div class="decision-foot"><span>生成 ${new Date(briefing.generated_at).toLocaleString("zh-CN")}</span><span>正式记录 ${briefing.snapshot.formal_records}</span><span>外部核验 ${briefing.snapshot.externally_verified}</span><span>疾病专题 ${dossierCount}</span></div>`;
    hero.insertAdjacentElement("afterend", section);
  }).catch(() => {});
})();
