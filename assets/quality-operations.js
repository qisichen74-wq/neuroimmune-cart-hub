(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

  const render = async () => {
    const app = document.getElementById("app");
    if (!app || app.querySelector("#operations-section") || !app.querySelector(".hero")) return;
    try {
      const [quality, candidates, sourceSync, regulatory] = await Promise.all([
        fetch("data/quality-report.json").then((response) => response.json()),
        fetch("data/candidate-report.json").then((response) => response.json()),
        fetch("data/source-sync-report.json").then((response) => response.json()),
        fetch("data/regulatory-watch-report.json").then((response) => response.json())
      ]);
      const section = document.createElement("section");
      section.className = "section";
      section.id = "operations-section";
      section.innerHTML = `<div class="section-head"><div><div class="eyebrow">Intelligence Operations</div><h2>每日情报流水线</h2></div><p class="section-desc">发现、核验、监管监测与结构审计彼此分离；候选不会未经人工核验直接进入正式数据集。</p></div><div class="dataset-grid"><article class="dataset"><div class="dataset-top"><h3>候选发现</h3><span class="dataset-count">${candidates.summary.candidates}</span></div><div class="dataset-meta"><span>文献 ${candidates.summary.research}</span><span>试验 ${candidates.summary.trials}</span><span>失败 ${candidates.summary.source_failures}</span></div></article><article class="dataset"><div class="dataset-top"><h3>官方字段同步</h3><span class="dataset-count">${sourceSync.summary.successful}/${sourceSync.summary.records_checked}</span></div><div class="dataset-meta"><span>差异 ${sourceSync.summary.differences}</span><span>失败 ${sourceSync.summary.failed}</span></div></article><article class="dataset"><div class="dataset-top"><h3>NMPA / CDE</h3><span class="dataset-count">${regulatory.summary.available}/${regulatory.summary.endpoints}</span></div><div class="dataset-meta"><span>入口可用</span><span>失败 ${regulatory.summary.failed}</span></div></article></div><div class="panel" style="margin-top:10px"><div class="eyebrow">Regulatory Semantics</div><div class="policy-list">${Object.entries(regulatory.policy).map(([key, value]) => `<div class="policy"><span>${esc(key)}</span><strong>${esc(value)}</strong></div>`).join("")}</div></div><p class="section-desc" style="margin-top:10px">最近运行：发现 ${new Date(candidates.generated_at).toLocaleString("zh-CN")} · 来源核对 ${new Date(sourceSync.generated_at).toLocaleString("zh-CN")} · 监管监测 ${new Date(regulatory.generated_at).toLocaleString("zh-CN")} · 当前质量 ${quality.score}</p>`;
      app.appendChild(section);
    } catch {
      // The base quality page remains usable if an operational report is unavailable.
    }
  };

  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  render();
})();
