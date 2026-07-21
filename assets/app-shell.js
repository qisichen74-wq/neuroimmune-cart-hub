(() => {
  const language = localStorage.getItem("intel-language") === "en" ? "en" : "zh";
  const isEnglish = language === "en";
  document.documentElement.lang = isEnglish ? "en" : "zh-CN";

  const englishUi = {
    "神经免疫 CAR-T 情报工作台": "Neuroimmune CAR-T Intelligence Hub",
    "首页": "Home", "专题档案": "Dossiers", "研究情报": "Research", "竞争格局": "Landscape",
    "项目对比": "Compare", "变化历史": "Changes", "候选池": "Watchlist", "检索": "Search",
    "全局检索": "Global search", "数据质量": "Data quality", "质量未知": "Quality unavailable",
    "适应症档案": "Indication dossiers", "研究证据": "Research evidence", "竞争对象": "Programs",
    "临床试验": "Clinical trials", "竞争项目": "Development programs", "核心判断": "Core assessment",
    "未满足需求": "Unmet need", "下一关键催化剂": "Next catalyst", "抗体分层证据地图": "Antibody-stratified evidence map",
    "竞争项目与试验": "Programs and trials", "专题覆盖": "Dossier coverage", "关键问题": "Critical questions",
    "证据缺口": "Evidence gaps", "当前尚无直接研究证据。": "No direct research evidence yet.",
    "当前尚无关联项目。": "No linked program yet.", "专题暂时无法打开": "Dossier unavailable",
    "返回专题库": "Back to dossiers", "当前没有适应症档案。": "No indication dossiers available.",
    "高优先级": "High priority", "中优先级": "Medium priority", "低优先级": "Low priority",
    "高优先级条目": "High-priority items", "已审核": "Reviewed", "待审核": "Pending review", "已忽略": "Excluded",
    "全部": "All", "查看原文": "Source", "发布时间": "Published", "判断依据": "Rationale",
    "本轮最值得盯的三条情报": "Three intelligence items to watch", "情报覆盖概览": "Intelligence coverage",
    "最新研究情报流": "Latest research intelligence", "关键玩家与产品线快照": "Key programs and pipelines",
    "权威来源与核验方法": "Authoritative sources and verification", "监测面板": "Monitoring",
    "热门标签": "Trending tags", "覆盖适应症": "Indications covered", "高优先级占比": "High-priority share",
    "已审核占比": "Reviewed share", "原始研究占比": "Primary-evidence share", "抓取公开来源": "Collect public sources",
    "做结构化摘要": "Create structured summaries", "沉淀专题判断": "Build indication assessments",
    "今日决策摘要": "Daily decision brief", "已核验动态": "Verified updates", "重点试验": "Priority trials",
    "暂无新增动态": "No new verified update", "暂无重点试验": "No priority trial",
    "研究证据库": "Research evidence library", "格局概览": "Landscape overview",
    "公司与项目矩阵": "Company and program matrix", "重点项目": "Priority programs", "格局判断": "Landscape assessment",
    "项目对比矩阵": "Program comparison matrix", "候选情报池": "Intelligence candidate pool", "官网更新雷达": "Official update radar",
    "官方字段变化历史": "Official-field change history", "变化记录": "Change log",
    "数据质量与自我核查": "Data quality and self-audit", "分数据集核验覆盖": "Verification coverage by dataset",
    "当前核查事项": "Current audit items", "复核周期": "Review cadence", "自动检查范围": "Automated checks",
    "来源登记表": "Source registry", "跨研究、项目、试验与动态统一检索": "Search across research, programs, trials, and events",
    "全部情报对象": "All intelligence objects", "结构化档案": "Structured profile", "持续观察点": "Watch points",
    "核验状态": "Verification status", "相关动态": "Related events", "关联情报": "Related intelligence",
    "详情暂时无法打开": "Detail unavailable", "打开导航": "Open navigation", "关闭导航": "Close navigation", "切换到中文": "Switch to Chinese",
    "网站导航": "Site navigation", "质量报告载入中": "Loading quality report", "个错误": " errors", "个警告": " warnings",
    "错误": "errors", "警告": "warnings", "条情报": " items", "个适应症": " indications", "项": "items",
    "个亚型": "subtypes", "研究": "Evidence", "项目": "Programs", "试验": "Trials", "更新于": "Updated",
    "状态：正在同步最新情报": "Status: syncing latest intelligence", "未分类": "Unclassified", "证据待补": "Evidence pending",
    "关键判断": "Key assessment", "聚焦": "Focus", "阶段": "Stage", "生成于": "Generated",
    "最近核查": "Last checked", "注册更新": "Registry update", "计划入组": "Planned enrollment",
    "注册试验": "Registered trials", "活跃项目": "Active programs", "技术路线": "Technology routes",
    "试验快照": "Trial snapshots", "文献快照": "Literature snapshots", "累计字段变化": "Field changes",
    "变更前": "Previous", "变更后": "Current", "当前没有检测到官方字段变化。": "No official-field change detected.",
    "变化历史尚未生成。": "Change history is not available yet.", "来源": "Source", "专题": "Dossier"
  };
  const dataTranslations = [];
  const addPair = (source, target) => {
    if (typeof source !== "string" || typeof target !== "string" || !source.trim() || source === target) return;
    dataTranslations.push([source, target]);
  };
  const collectPairs = (source, target) => {
    if (typeof source === "string" && typeof target === "string") return addPair(source, target);
    if (Array.isArray(source) && Array.isArray(target)) return source.forEach((value, index) => collectPairs(value, target[index]));
    if (!source || !target || typeof source !== "object" || typeof target !== "object") return;
    Object.keys(target).forEach((key) => collectPairs(source[key], target[key]));
  };
  const translateValue = (value) => {
    const leading = value.match(/^\s*/)?.[0] || "";
    const trailing = value.match(/\s*$/)?.[0] || "";
    let text = value.trim();
    if (!text) return value;
    if (englishUi[text]) text = englishUi[text];
    else {
      for (const [source, target] of dataTranslations) {
        if (source.length >= 4 && text.includes(source)) text = text.split(source).join(target);
      }
      for (const [source, target] of Object.entries(englishUi).sort((a, b) => b[0].length - a[0].length)) {
        if (source.length >= 4 && text.includes(source)) text = text.split(source).join(target);
      }
    }
    text = text
      .replace(/^共\s*(\d+)\s*indications$/, "$1 indications")
      .replace(/^共\s*(\d+)\s*个适应症$/, "$1 indications")
      .replace(/研究\s+(\d+)/g, "Evidence $1")
      .replace(/项目\s+(\d+)/g, "Programs $1")
      .replace(/试验\s+(\d+)/g, "Trials $1")
      .replace(/(\d+)\s*项/g, "$1 items")
      .replace(/(\d+)\s*items/g, "$1 items")
      .replace(/质量\s*(\d+)/g, "Quality $1")
      .replace(/(\d+)\s*例/g, "$1 participants")
      .replace(/高优先级/g, "High priority")
      .replace(/中优先级/g, "Medium priority")
      .replace(/低优先级/g, "Low priority");
    return `${leading}${text}${trailing}`;
  };
  const translateNode = (root) => {
    if (!isEnglish || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement?.tagName || "")) return;
      const translated = translateValue(node.nodeValue || "");
      if (translated !== node.nodeValue) node.nodeValue = translated;
    });
    root.querySelectorAll?.("[title],[aria-label],[placeholder]").forEach((element) => {
      ["title", "aria-label", "placeholder"].forEach((attribute) => {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, translateValue(element.getAttribute(attribute)));
      });
    });
  };
  const navigation = [
    ["首页", "index.html"],
    ["专题档案", "topics.html"],
    ["研究情报", "research.html"],
    ["竞争格局", "landscape.html"],
    ["项目对比", "comparison.html"],
    ["官网雷达", "radar.html"],
    ["变化历史", "history.html"],
    ["候选池", "candidates.html"]
  ];

  const style = document.createElement("style");
  style.textContent = `
    :root { --bg: #f4f6f4 !important; --surface: #ffffff !important; --soft: #eef2ef !important; --border: #d6ddd8 !important; --text: #172019 !important; --text2: #465149 !important; --text3: #707b73 !important; --accent: #176049 !important; --accent2: #0f766e !important; --accent-light: #e7f3ed !important; }
    body { background: var(--bg) !important; letter-spacing: 0 !important; }
    nav { z-index: 1000 !important; }
    .app-shell-actions { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
    .app-shell-actions > a { text-decoration: none !important; }
    .app-shell-health {
      display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px;
      border: 1px solid var(--border, #d8ddd7); border-radius: 999px;
      background: var(--surface, #fff); color: var(--text3, #737d75);
      font: 700 10px var(--font-mono, var(--mono, monospace)); white-space: nowrap;
    }
    .app-shell-health::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #9a6700; }
    .app-shell-health.app-shell-candidates { background: var(--accent-light, #e6f3ed); color: var(--accent, #176049); }
    .app-shell-health.app-shell-candidates::before { display: none; }
    .app-shell-health.is-good::before { background: #167044; }
    .app-shell-health.is-blocked::before { background: #b42318; }
    .app-shell-language {
      width: 58px; height: 30px; padding: 2px; display: grid; grid-template-columns: 1fr 1fr; align-items: center;
      border: 1px solid var(--border, #d8ddd7); border-radius: 7px; background: var(--soft, #eef2ef);
      color: var(--text3, #737d75); cursor: pointer; font: 700 9px var(--font-mono, var(--mono, monospace));
    }
    .app-shell-language span { height: 24px; display: grid; place-items: center; border-radius: 5px; }
    .app-shell-language span.is-active { background: var(--surface, #fff); color: var(--accent, #176049); box-shadow: 0 1px 3px rgba(20,28,23,.12); }
    .app-shell-menu-button {
      width: 36px; height: 36px; display: none; place-items: center; gap: 4px;
      border: 1px solid var(--border, #d8ddd7); border-radius: 7px;
      background: var(--surface, #fff); color: var(--text, #172019); cursor: pointer;
    }
    .app-shell-menu-button span { width: 16px; height: 1px; display: block; background: currentColor; transition: .16s ease; }
    .app-shell-menu-button[aria-expanded="true"] span:nth-child(1) { transform: translateY(5px) rotate(45deg); }
    .app-shell-menu-button[aria-expanded="true"] span:nth-child(2) { opacity: 0; }
    .app-shell-menu-button[aria-expanded="true"] span:nth-child(3) { transform: translateY(-5px) rotate(-45deg); }
    .app-shell-backdrop { position: fixed; inset: 60px 0 0; z-index: 998; background: rgba(20, 28, 23, .28); opacity: 0; pointer-events: none; transition: opacity .18s ease; }
    .app-shell-drawer {
      position: fixed; top: 60px; right: 0; bottom: 0; z-index: 999; width: min(340px, calc(100vw - 24px));
      padding: 14px; background: var(--surface, #fff); border-left: 1px solid var(--border, #d8ddd7);
      box-shadow: -18px 0 38px rgba(20, 28, 23, .12); transform: translateX(102%); transition: transform .18s ease;
      overflow-y: auto;
    }
    .app-shell-drawer nav { height: auto; padding: 0; display: flex; flex-direction: column; align-items: stretch; gap: 5px; position: static; border: 0; background: transparent; backdrop-filter: none; }
    .app-shell-mobile-link { padding: 11px 12px; border-radius: 7px; color: var(--text2, #465049); text-decoration: none; font-size: 13px; }
    .app-shell-mobile-link:hover, .app-shell-mobile-link.is-active { background: var(--accent-light, #e6f3ed); color: var(--accent, #176049); font-weight: 700; }
    .app-shell-mobile-divider { height: 1px; margin: 8px 0; background: var(--border, #d8ddd7); }
    .app-shell-mobile-meta { padding: 10px 12px; color: var(--text3, #7a837c); font: 10px var(--font-mono, var(--mono, monospace)); }
    body.app-shell-open { overflow: hidden; }
    body.app-shell-open .app-shell-backdrop { opacity: 1; pointer-events: auto; }
    body.app-shell-open .app-shell-drawer { transform: translateX(0); }
    @media (max-width: 1120px) {
      nav { padding-left: 18px !important; padding-right: 18px !important; }
      nav .nav-links a { padding-left: 7px !important; padding-right: 7px !important; font-size: 11px !important; }
      .app-shell-actions .global-search-link { display: none; }
    }
    @media (max-width: 860px) {
      nav .nav-links { display: none !important; }
      .app-shell-menu-button { display: grid; }
      .app-shell-actions .app-shell-health { padding: 5px 8px; }
    }
    @media (max-width: 700px) {
      .hero-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
      .hero-stats .stat { min-height: 116px !important; padding: 14px !important; }
    }
    @media (max-width: 480px) {
      nav { padding-left: 14px !important; padding-right: 14px !important; gap: 8px !important; }
      nav .nav-logo { min-width: 0; max-width: calc(100vw - 150px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px !important; }
      .app-shell-health { font-size: 9px; }
      .app-shell-actions .app-shell-candidates { display: none; }
      .app-shell-actions .app-shell-health:not(.app-shell-candidates) { display: none; }
      .hero-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
      .hero-stats .stat { min-height: 116px !important; padding: 14px !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      .app-shell-drawer, .app-shell-backdrop, .app-shell-menu-button span { transition: none; }
    }
  `;
  document.head.appendChild(style);

  const currentFile = location.pathname.split("/").pop() || "index.html";
  const activeFile = (() => {
    if (currentFile === "detail.html") {
      const type = new URLSearchParams(location.search).get("type");
      return { research: "research.html", company: "landscape.html", trial: "comparison.html" }[type] || "";
    }
    if (currentFile === "topic.html") return "topics.html";
    return currentFile;
  })();

  const pageNav = document.querySelector("body > nav");
  if (!pageNav) return;

  pageNav.querySelectorAll(".nav-links a").forEach((link) => {
    const isActive = link.getAttribute("href") === activeFile;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const searchLink = pageNav.querySelector(':scope > a[href="search.html"]');
  const actions = document.createElement("div");
  actions.className = "app-shell-actions";
  if (searchLink) {
    searchLink.classList.add("global-search-link");
    searchLink.textContent = "检索";
    actions.appendChild(searchLink);
  }

  const languageButton = document.createElement("button");
  languageButton.className = "app-shell-language";
  languageButton.type = "button";
  languageButton.title = isEnglish ? "切换到中文" : "Switch to English";
  languageButton.setAttribute("aria-label", isEnglish ? "切换到中文" : "Switch to English");
  languageButton.innerHTML = `<span class="${isEnglish ? "" : "is-active"}">中</span><span class="${isEnglish ? "is-active" : ""}">EN</span>`;
  languageButton.addEventListener("click", () => {
    localStorage.setItem("intel-language", isEnglish ? "zh" : "en");
    location.reload();
  });
  actions.appendChild(languageButton);

  const candidateLink = document.createElement("a");
  candidateLink.className = "app-shell-health app-shell-candidates";
  candidateLink.href = "candidates.html";
  candidateLink.textContent = "候选池";
  if (currentFile === "candidates.html") candidateLink.setAttribute("aria-current", "page");
  actions.appendChild(candidateLink);

  const radarLink = document.createElement("a");
  radarLink.className = "app-shell-health app-shell-candidates";
  radarLink.href = "radar.html";
  radarLink.textContent = "官网雷达";
  if (currentFile === "radar.html") radarLink.setAttribute("aria-current", "page");
  actions.insertBefore(radarLink, candidateLink);

  const comparisonLink = document.createElement("a");
  comparisonLink.className = "app-shell-health app-shell-candidates";
  comparisonLink.href = "comparison.html";
  comparisonLink.textContent = "对比";
  if (currentFile === "comparison.html") comparisonLink.setAttribute("aria-current", "page");
  actions.insertBefore(comparisonLink, candidateLink);

  const healthLink = document.createElement("a");
  healthLink.className = "app-shell-health";
  healthLink.href = "quality.html";
  healthLink.textContent = "质量 --";
  if (currentFile === "quality.html") healthLink.setAttribute("aria-current", "page");
  actions.appendChild(healthLink);

  const menuButton = document.createElement("button");
  menuButton.className = "app-shell-menu-button";
  menuButton.type = "button";
  menuButton.title = "打开导航";
  menuButton.setAttribute("aria-label", "打开导航");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-controls", "app-shell-drawer");
  menuButton.innerHTML = "<span></span><span></span><span></span>";
  actions.appendChild(menuButton);
  pageNav.appendChild(actions);

  const backdrop = document.createElement("div");
  backdrop.className = "app-shell-backdrop";
  const drawer = document.createElement("aside");
  drawer.className = "app-shell-drawer";
  drawer.id = "app-shell-drawer";
  drawer.setAttribute("aria-label", "网站导航");
  drawer.innerHTML = `
    <nav>${navigation.map(([label, href]) => `<a class="app-shell-mobile-link${href === activeFile ? " is-active" : ""}" href="${href}"${href === activeFile ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
    <div class="app-shell-mobile-divider"></div>
    <nav>
      <a class="app-shell-mobile-link${currentFile === "search.html" ? " is-active" : ""}" href="search.html">全局检索</a>
      <a class="app-shell-mobile-link${currentFile === "quality.html" ? " is-active" : ""}" href="quality.html">数据质量</a>
    </nav>
    <div class="app-shell-mobile-meta" id="app-shell-mobile-meta">质量报告载入中</div>
  `;
  document.body.append(backdrop, drawer);

  let returnFocus = null;
  const setOpen = (open) => {
    document.body.classList.toggle("app-shell-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    menuButton.title = open ? "关闭导航" : "打开导航";
    if (open) {
      returnFocus = document.activeElement;
      drawer.querySelector("a")?.focus();
    } else if (returnFocus instanceof HTMLElement) {
      returnFocus.focus();
    }
  };
  menuButton.addEventListener("click", () => setOpen(menuButton.getAttribute("aria-expanded") !== "true"));
  backdrop.addEventListener("click", () => setOpen(false));
  drawer.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.body.classList.contains("app-shell-open")) setOpen(false); });
  addEventListener("resize", () => { if (innerWidth > 860 && document.body.classList.contains("app-shell-open")) setOpen(false); });

  fetch("data/quality-report.json")
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((report) => {
      healthLink.textContent = `质量 ${report.score}`;
      healthLink.classList.toggle("is-good", report.status === "通过" || report.score >= 95);
      healthLink.classList.toggle("is-blocked", report.status === "阻断");
      healthLink.title = `${report.status} · ${report.summary.errors}个错误 · ${report.summary.warnings}个警告`;
      const mobileMeta = document.getElementById("app-shell-mobile-meta");
      if (mobileMeta) mobileMeta.textContent = `质量 ${report.score} · ${report.summary.errors} 错误 · ${report.summary.warnings} 警告`;
    })
    .catch(() => {
      healthLink.textContent = "质量未知";
      healthLink.classList.add("is-blocked");
    });

  if (isEnglish) {
    const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => translateNode(node.nodeType === Node.TEXT_NODE ? node.parentElement : node));
    }));
    observer.observe(document.body, { childList: true, subtree: true });
    translateNode(document.body);
    Promise.all([
      fetch("data/topics.json").then((response) => response.ok ? response.json() : []),
      fetch("data/feed.json").then((response) => response.ok ? response.json() : []),
      fetch("data/trials.json").then((response) => response.ok ? response.json() : [])
    ]).then(([topics, research, trials]) => {
      topics.forEach((item) => collectPairs(item, item.i18n?.en));
      research.forEach((item) => {
        addPair(item.title_cn, item.official_title);
        collectPairs(item, item.i18n?.en);
      });
      trials.forEach((item) => {
        addPair(item.trial_name, item.official_title);
        collectPairs(item, item.i18n?.en);
      });
      dataTranslations.sort((a, b) => b[0].length - a[0].length);
      translateNode(document.body);
    }).catch(() => {});
  }
})();
