(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const style = document.createElement("style");
  style.textContent = `.briefing{padding:24px 0;border-bottom:1px solid var(--border)}.briefing-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:13px}.briefing-head h2{font-size:24px}.briefing-head p{max-width:620px;color:var(--text2);font-size:12px}.briefing-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:9px}.briefing-panel{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:15px}.briefing-panel h3{font-size:13px;margin-bottom:9px}.briefing-item{padding:8px 0;border-bottom:1px solid var(--border)}.briefing-item:last-child{border:0}.briefing-item a{text-decoration:none;font-weight:700;font-size:12px}.briefing-item a:hover{color:var(--accent)}.briefing-item p{margin-top:3px;color:var(--text2);font-size:10px}.briefing-meta{color:var(--text3);font:9px var(--mono)}.briefing-foot{margin-top:9px;color:var(--text3);font-size:10px}@media(max-width:900px){.briefing-grid{grid-template-columns:1fr}.briefing-head{align-items:start;flex-direction:column}}`;
  document.head.appendChild(style);
  fetch("data/daily-briefing.json").then((response) => response.json()).then((briefing) => {
    const statValues = { "stat-total": briefing.snapshot.formal_records, "stat-high": briefing.snapshot.active_priority_trials, "stat-reviewed": briefing.snapshot.externally_verified, "stat-disease": briefing.snapshot.candidate_items };
    const applyStats = () => Object.entries(statValues).forEach(([id, value]) => { const element = document.getElementById(id); if (element && element.textContent !== String(value)) element.textContent = value; });
    applyStats();
    const statsRoot = document.querySelector(".hero-stats");
    if (statsRoot) new MutationObserver(applyStats).observe(statsRoot, { childList: true, subtree: true, characterData: true });
    const hero = document.querySelector("main .hero") || document.querySelector(".hero");
    if (!hero || document.getElementById("daily-briefing")) return;
    const section = document.createElement("section");
    section.className = "briefing";
    section.id = "daily-briefing";
    const updates = briefing.verified_updates.slice(0, 4).map((item) => `<div class="briefing-item"><a href="${esc(item.source_url)}" target="_blank" rel="noopener">${esc(item.title)}</a><p>${esc(item.summary)}</p><span class="briefing-meta">${esc(item.date)} · ${esc(item.topic)}</span></div>`).join("");
    const trials = briefing.trial_watch.slice(0, 4).map((item) => `<div class="briefing-item"><a href="detail.html?type=trial&id=${encodeURIComponent(item.id)}">${esc(item.product)}</a><p>${esc(item.indication)} · ${esc(item.status)} · ${esc(item.enrollment)}例</p><span class="briefing-meta">注册更新 ${esc(item.last_update)}</span></div>`).join("");
    section.innerHTML = `<div class="briefing-head"><div><div class="eyebrow">DAILY BRIEFING</div><h2>今日决策摘要</h2></div><p>${esc(briefing.editorial_note)} 当前正式记录 ${briefing.snapshot.formal_records} 条，外部核验 ${briefing.snapshot.externally_verified} 条。</p></div><div class="briefing-grid"><article class="briefing-panel"><h3>已核验动态</h3>${updates || "暂无新增动态"}</article><article class="briefing-panel"><h3>重点试验</h3>${trials || "暂无重点试验"}</article></div><div class="briefing-foot">生成于 ${new Date(briefing.generated_at).toLocaleString("zh-CN")} · 质量 ${briefing.snapshot.quality_score} · 候选池 ${briefing.snapshot.candidate_items}</div>`;
    hero.insertAdjacentElement("afterend", section);
  }).catch(() => {});
})();
