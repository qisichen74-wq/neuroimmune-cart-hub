(() => {
  const navigation = [
    ["首页", "index.html"],
    ["专题档案", "topics.html"],
    ["研究情报", "research.html"],
    ["竞争格局", "landscape.html"],
    ["安全信号", "safety.html"]
    ,["项目对比", "comparison.html"],
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
      return { research: "research.html", company: "landscape.html", trial: "comparison.html", safety: "safety.html" }[type] || "";
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

  const candidateLink = document.createElement("a");
  candidateLink.className = "app-shell-health app-shell-candidates";
  candidateLink.href = "candidates.html";
  candidateLink.textContent = "候选池";
  if (currentFile === "candidates.html") candidateLink.setAttribute("aria-current", "page");
  actions.appendChild(candidateLink);

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
})();
