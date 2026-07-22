(() => {
  const language = localStorage.getItem("intel-language") === "en" ? "en" : "zh";
  const isEnglish = language === "en";
  document.documentElement.lang = isEnglish ? "en" : "zh-CN";

  const englishUi = {
    "神经免疫 CAR-T 情报工作台": "Autoimmune CAR-T Intelligence Hub", "自身免疫 CAR-T 情报工作台": "Autoimmune CAR-T Intelligence Hub", "自身免疫CAR-T情报工作台": "Autoimmune CAR-T Intelligence Hub",
    "首页": "Home", "专题档案": "Dossiers", "疾病专题": "Disease dossiers", "自身免疫疾病专题": "Autoimmune disease dossiers", "专题报道与档案": "Special reports and dossiers", "专题报道": "Special report", "人工审核": "Human review", "人工审核中心": "Human Review Center", "研究情报": "Research", "竞争格局": "Landscape",
    "项目对比": "Category Search", "分类检索": "Category Search", "变化历史": "Changes", "候选池": "Watchlist", "检索": "Search", "内部登录": "Staff login",
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
    "项目对比矩阵": "Category search", "分类检索": "Category search", "候选情报池": "Intelligence candidate pool", "官网更新雷达": "Official update radar", "官网雷达": "Official radar",
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
    "变化历史尚未生成。": "Change history is not available yet.", "来源": "Source", "专题": "Dossier",
    "数据更新": "Data updated", "复核周期": "Review cadence", "30天": "30 days", "共 10 个疾病专题": "10 disease dossiers",
    "从神经免疫扩展到全谱系自身免疫疾病，按疾病持续聚合研究、项目、试验、关键判断与证据缺口。": "Expanding from neuroimmunology to the full autoimmune spectrum, with continuously curated evidence, programs, trials, assessments, and gaps by disease.",
    "当前已建立 SLE、AI-ILD、RA 等专题；其余自身免疫病将按证据密度和人工审核进度持续建档。覆盖范围代表情报监测范围，不代表CAR-T已获得相应适应症批准。": "SLE, AI-ILD, RA, and other dossiers are now available. Additional autoimmune diseases will be added according to evidence density and review progress. Coverage indicates monitoring scope, not regulatory approval.",
    "疾病专题用于组织情报判断，不替代原始证据审阅或临床决策。": "Disease dossiers organize intelligence assessments and do not replace primary-evidence review or clinical decisions.",
    "专题内容由结构化数据聚合生成，关联关系代表情报上下文，不自动等同于临床因果。": "Special reports are generated from structured data. Links represent intelligence context and do not imply clinical causality.",
    "当前没有疾病专题。": "No disease dossier is currently available.", "正在构建疾病专题...": "Building disease dossiers...",
    "高优先级": "High priority", "中优先级": "Medium priority", "低优先级": "Low priority",
    "神经免疫 CAR-T 研发情报工作台": "Autoimmune CAR-T R&D Intelligence Hub", "自身免疫": "Autoimmune", "研发情报工作台": "R&D Intelligence Hub", "其他自免": "Other autoimmune", "病例系列": "Case series",
    "汇总经核验的研究、临床试验、竞争项目与安全信号，持续识别关键变化、证据缺口和下一步催化剂。": "Curating verified research, clinical trials, development programs, and safety signals across autoimmune diseases to identify material changes, evidence gaps, and upcoming catalysts.",
    "覆盖适应症：MS / MG / NMOSD / CIDP / AE / IIM / SSc / 其他自免": "Coverage: SLE / RA / AI-ILD / SSc / IIM / MS / MG / NMOSD and other autoimmune diseases",
    "核心来源：PubMed、ClinicalTrials.gov、NMPA / CDE、公司正式披露": "Primary sources: PubMed, ClinicalTrials.gov, NMPA / CDE, and official company disclosures",
    "今日重点": "Today's focus", "正在加载重点情报...": "Loading priority intelligence...", "等待数据": "Waiting for data", "进入研究情报": "Open research intelligence",
    "正式记录": "Formal records", "活跃重点试验": "Active priority trials", "外部已核验": "Externally verified", "候选情报": "Candidate intelligence",
    "进入生产数据集的结构化对象": "Structured objects in the production dataset", "处于招募或活跃随访的高优先级试验": "High-priority trials recruiting or in active follow-up", "完成一手来源逐字段核查": "Field-level checks completed against primary sources", "等待编辑核验的主动发现结果": "Proactively discovered items awaiting editorial verification",
    "最新研究情报流": "Latest research intelligence", "关键玩家与产品线快照": "Key programs and pipelines", "人工审核中心展示流程、队列与闭环条件；医学和监管判断仍以一手来源及具名审核记录为准。": "The review center shows workflow, queues, and closure criteria. Medical and regulatory judgments remain grounded in primary sources and named review records.",
    "汇总经核验的研究、临床试验、竞争项目与安全信号，覆盖神经、风湿、肌肉、肺与多器官自身免疫疾病。": "Curating verified research, clinical trials, development programs, and safety signals across neurological, rheumatic, muscular, pulmonary, and multi-organ autoimmune diseases.",
    "覆盖专题：SLE / RA / AI-ILD / SSc / IIM / MS / MG / NMOSD / 其他自免": "Dossiers: SLE / RA / AI-ILD / SSc / IIM / MS / MG / NMOSD / other autoimmune diseases",
    "状态：最新同步时间": "Latest synchronization", "条重点": " priority items",
    "暂无符合条件的情报": "No intelligence matches these filters", "正在读取最新情报...": "Loading the latest intelligence...",
    "尚无补充说明。": "No additional note.", "暂无明确结论。": "No conclusion yet.", "暂无摘要": "No summary",
    "聚焦：": "Focus: ", "阶段：": "Stage: ", "标签待补": "Tags pending",
    "仅供科研与产业情报参考，不构成临床诊疗建议。请以原始来源和正式披露信息为准。": "For research and industry intelligence only; not clinical advice. Refer to primary sources and official disclosures."
    ,"审核中心展示流程、队列与闭环条件；医学和监管判断仍以一手来源及具名审核记录为准。": "The review center shows workflow, queues, and closure criteria. Medical and regulatory judgments remain grounded in primary sources and named review records."
    ,"按证据等级、适应症、优先级与核验状态整理临床研究、病例系列、队列和系统综述。": "Clinical studies, case series, cohorts, and systematic reviews organized by evidence level, indication, priority, and verification status."
    ,"数据状态": "Data status", "数据覆盖": "Data coverage", "搜索": "Search", "优先级": "Priority", "适应症": "Indication", "证据类型": "Evidence type", "审核状态": "Review status"
    ,"原始研究 / 临床": "Primary / clinical research", "综述": "Review", "研究情报总数": "Research records"
    ,"当前接入 feed.json 的全部条目": "All records currently loaded from feed.json", "适合先读完并进入专题追踪": "Read first and consider for dossier tracking", "已经形成初步判断的条目": "Records with an initial editorial assessment", "比综述更适合直接支撑判断": "More suitable than reviews for direct assessment"
    ,"按优先级排序": "Sort by priority", "按发布时间排序": "Sort by publication date", "按PMID排序": "Sort by PMID", "按审核状态排序": "Sort by review status", "情报详情": "Intelligence profile"
    ,"最近同步": "Last synchronized", "仅供科研与产业情报参考，不构成临床诊疗建议。请以原始来源与正式披露信息为准。": "For research and industry intelligence only; not clinical advice. Refer to primary sources and official disclosures."
    ,"追踪中的重点玩家": "Programs tracked", "当前已纳入竞争格局页的公司与学术中心": "Companies and academic centers currently included in the landscape", "高优先级对象": "High-priority programs", "适合进入周报和专题跟踪的核心玩家": "Core programs for weekly and dossier tracking", "区域分布": "Regions", "帮助快速判断竞争热点主要落在哪些市场": "Shows where competitive activity is concentrated", "竞争格局已经触达的专题范围": "Disease areas represented in the landscape"
    ,"开发阶段": "Development stage", "区域": "Region", "观察面板": "Monitoring", "IIT项目": "IIT programs", "中国相关对象": "China-linked programs"
    ,"按开发成熟度排序": "Sort by development maturity", "按区域排序": "Sort by region", "按公司名排序": "Sort by company", "公司 / 产品": "Company / product", "路线": "Platform", "重点适应症": "Priority indications", "判断": "Assessment", "技术待补": "Technology pending", "阶段待补": "Stage pending", "发起类型待补": "Sponsor type pending", "区域待补": "Region pending"
    ,"汇总PubMed、ClinicalTrials.gov和重点企业官网的自动发现结果，并按证据类型、病种与项目状态分级。": "Automatically discovered records from PubMed, ClinicalTrials.gov, and priority company websites, triaged by evidence type, disease, and program status."
    ,"候选总数": "Candidates", "立即核验": "Immediate review", "持续观察": "Watch", "背景材料": "Background", "低相关": "Low relevance", "核心候选": "Core candidates", "研究文献": "Research", "官网更新": "Official update", "相关度": "Relevance", "待分级": "Untriaged", "发现于": "Discovered", "全部类型": "All types", "全部相关度": "All relevance", "全部分级": "All tiers", "高相关度（8+）": "High relevance (8+)", "核心候选（10+）": "Core candidates (10+)", "当前筛选条件下没有候选记录。": "No candidate matches the current filters.", "候选报告尚未生成。": "Candidate report is not available.", "候选记录不代表疗效、安全性、注册状态或监管结论已经获得本网站确认。": "Candidate records do not mean efficacy, safety, registration status, or regulatory conclusions have been verified by this site."
    ,"每次网站启动前自动检查数据结构、来源、日期、跨表引用和核验时效；阻断错误会阻止启动，待核验事项会保留为明确警告。": "Each site start checks data structure, sources, dates, cross-dataset references, and verification freshness. Blocking errors stop startup; pending items remain explicit warnings."
    ,"质量策略": "Quality policy", "截止": "as of", "报告生成": "Report generated", "结构化对象": "Structured objects", "内部已审核": "Internally reviewed", "待外部核验": "Pending external verification", "阻断错误": "Blocking errors", "已过期": "Overdue"
    ,"绿色进度只表示完成外部逐字段核验；内部编辑判断单独计数，不与外部事实混合。": "Green progress means field-level external verification only. Internal editorial assessments are counted separately from external facts."
    ,"已核验": "Verified", "待核验": "Pending", "过期": "Overdue", "没有发现问题。": "No issue found.", "只有登记过的来源才能进入核验记录；内部判断不能冒充权威外部来源。": "Only registered sources can enter verification records; internal assessments cannot be presented as authoritative external sources.", "权威度": "Authority", "天复核": "-day review", "质量面板展示结构完整性、来源核验和数据时效性；“无错误”不等同于所有业务判断均已被外部证实。": "The quality panel shows structural integrity, source verification, and freshness. No errors does not mean every business assessment is externally confirmed."
    ,"横向比较正式核验项目的技术路线、靶点、阶段、病种、状态、规模和更新时间。矩阵用于研发与竞争判断，不替代原始试验方案。": "Compare verified programs across platform, target, stage, disease, status, enrollment, and update date. The matrix supports R&D and competitive assessment and does not replace the primary protocol."
    ,"全部技术路线": "All platforms", "全部状态": "All statuses", "全部地区": "All regions", "体内CAR-T": "In vivo CAR-T", "异体/现货CAR-T": "Allogeneic / off-the-shelf CAR-T", "自体CAR-T": "Autologous CAR-T", "待分类": "Unclassified", "未注明": "Not stated", "靶点": "Target", "状态": "Status", "规模": "Enrollment", "地区": "Region", "最近更新": "Last updated", "关键问题": "Key question", "仅纳入正式数据集；候选池项目需完成核验后才会出现在矩阵中。": "Only formal records are included. Candidate programs appear after verification."
    ,"记录ClinicalTrials.gov和NCBI官方字段变化，包括状态、入组数、关键日期、标题和DOI。": "Tracks official ClinicalTrials.gov and NCBI field changes, including status, enrollment, key dates, titles, and DOI.", "变化日志最多保留最近1000项；每条变化仍需结合原始记录解释。": "The log retains up to 1,000 recent changes; each change must still be interpreted against the primary record."
    ,"搜索疾病、产品、机构、机制或结论。结果直接来自当前结构化数据，不需要逐页查找。": "Search diseases, products, organizations, mechanisms, or assessments across the current structured dataset.", "对象类型": "Object type", "动态事件": "Events", "长期随访": "Long-term follow-up"
    ,"关键产品官网更新雷达": "Priority product official-update radar", "同时监测 pipeline、press release 与 news 入口。系统只负责发现页面、链接和资产变化；产品阶段、适应症和监管含义仍由人工逐字段确认。": "Monitors pipeline, press-release, and news sources. The system detects page, link, and asset changes; product stage, indication, and regulatory meaning still require field-level human review.", "本轮监测脉冲": "Current monitoring pulse", "重点官网": "Priority websites", "可靠变化线索": "Reliable change signals", "访问异常": "Access issues", "哨兵未命中": "Missing sentinels"
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
      .replace(/：/g, ": ")
      .replace(/^共\s*(\d+)\s*indications$/, "$1 indications")
      .replace(/^共\s*(\d+)\s*个适应症$/, "$1 indications")
      .replace(/研究\s+(\d+)/g, "Evidence $1")
      .replace(/项目\s+(\d+)/g, "Programs $1")
      .replace(/试验\s+(\d+)/g, "Trials $1")
      .replace(/(\d+)\s*项/g, "$1 items")
      .replace(/(\d+)\s*items/g, "$1 items")
      .replace(/(\d+)\s*条重点/g, "$1 priority items")
      .replace(/(\d+)\s*条情报/g, "$1 intelligence items")
      .replace(/(\d+)\s*条研究记录/g, "$1 research records")
      .replace(/当前已接入\s*(\d+)\s*条研究情报/g, "$1 research records currently available")
      .replace(/显示\s*(\d+)\s*\/\s*(\d+)\s*条研究情报/g, "Showing $1 / $2 research records")
      .replace(/当前已接入\s*(\d+)\s*条Research/g, "$1 research records currently available")
      .replace(/显示\s*(\d+)\s*\/\s*(\d+)\s*条Research/g, "Showing $1 / $2 research records")
      .replace(/显示\s*(\d+)\s*\/\s*(\d+)\s*个重点对象/g, "Showing $1 / $2 priority programs")
      .replace(/当前筛选结果\s*(\d+)\s*个/g, "$1 programs in the current filter")
      .replace(/(\d+)\s*个/g, "$1 programs")
      .replace(/显示\s*(\d+)\s*\/\s*(\d+)\s*条候选/g, "Showing $1 / $2 candidates")
      .replace(/^发布\s*/, "Published ")
      .replace(/^发现于\s*/, "Discovered ")
      .replace(/^更新于\s*/, "Updated ")
      .replace(/质量\s*(\d+)/g, "Quality $1")
      .replace(/(\d+)\s*例/g, "$1 participants")
      .replace(/(\d+)\s*天/g, "$1 days")
      .replace(/错误/g, "errors")
      .replace(/警告/g, "warnings")
      .replace(/已核验\s*(\d+)/g, "Verified $1")
      .replace(/待核验\s*(\d+)/g, "Pending $1")
      .replace(/过期\s*(\d+)/g, "Overdue $1")
      .replace(/权威度\s*/g, "Authority ")
      .replace(/截止\s*/g, "as of ")
      .replace(/(\d+) days复核/g, "$1-day review")
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
  const sanitizeUntranslatedEnglish = (root) => {
    if (!isEnglish || !root) return;
    if ((location.pathname.split("/").pop() || "") === "candidates.html") return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement?.tagName || "") || !/[\u3400-\u9fff]/.test(node.nodeValue || "")) return;
      const raw = (node.nodeValue || "").trim();
      if (raw === "中") return;
      const retained = raw.replace(/[\u3400-\u9fff]+/g, " ").replace(/[，。；：“”‘’（）]/g, " ").replace(/\s+/g, " ").trim();
      node.nodeValue = retained && /[A-Za-z0-9]/.test(retained) ? retained : "See source record for details.";
    });
  };
  const navigation = [
    ["首页", "index.html", "primary"],
    ["疾病专题", "topics.html", "primary"],
    ["研究情报", "research.html", "primary"],
    ["竞争格局", "landscape.html", "primary"],
    ["分类检索", "comparison.html", "primary"]
  ];
  const internalNavigation = [
    ["人工审核", "review.html", "internal"],
    ["候选池", "candidates.html", "internal"],
    ["数据质量", "quality.html", "internal"]
  ];

  const style = document.createElement("style");
  style.textContent = `
    :root { --bg: #f4f6f4 !important; --surface: #ffffff !important; --soft: #eef2ef !important; --border: #d6ddd8 !important; --text: #172019 !important; --text2: #465149 !important; --text3: #707b73 !important; --accent: #176049 !important; --accent2: #0f766e !important; --accent-light: #e7f3ed !important; }
    body { background: var(--bg) !important; letter-spacing: 0 !important; }
    nav { z-index: 1000 !important; }
    nav .nav-links { align-items: center !important; gap: 5px !important; }
    nav .nav-links a {
      display: inline-flex !important; align-items: center; min-height: 34px; padding: 7px 10px !important;
      border: 1px solid var(--border, #d8ddd7) !important; border-radius: 7px !important;
      background: var(--surface, #fff) !important; color: var(--text2, #465049) !important;
      font-size: 11px !important; font-weight: 650; text-decoration: none !important;
    }
    nav .nav-links a:hover { border-color: #9fc5b4 !important; background: var(--accent-light, #e6f3ed) !important; color: var(--accent, #176049) !important; }
    nav .nav-links a.active, nav .nav-links a[aria-current="page"] { border-color: var(--accent, #176049) !important; background: var(--accent, #176049) !important; color: #fff !important; }
    nav .nav-links a.app-shell-review-link:not(.active) { border-color: #b9d4c6 !important; background: var(--accent-light, #e6f3ed) !important; color: var(--accent, #176049) !important; }
    .app-shell-actions { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
    .app-shell-actions > a { text-decoration: none !important; }
    .app-shell-login {
      display: inline-flex; align-items: center; min-height: 30px; padding: 5px 9px;
      border: 1px solid var(--border, #d8ddd7); border-radius: 7px;
      background: var(--surface, #fff); color: var(--text3, #737d75);
      font: 700 10px var(--font-mono, var(--mono, monospace)); white-space: nowrap;
    }
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
      nav .nav-links a { padding-left: 7px !important; padding-right: 7px !important; font-size: 10px !important; }
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
  const internalPage = ["review.html", "candidates.html", "quality.html"].includes(currentFile);
  const visibleNavigation = internalPage ? internalNavigation : navigation;
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

  const logo = pageNav.querySelector(".nav-logo");
  if (logo) {
    [...logo.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => node.remove());
    logo.append(document.createTextNode("自身免疫 CAR-T 情报工作台"));
  }
  document.title = document.title.replaceAll("神经免疫", "自身免疫");
  if (isEnglish) document.title = translateValue(document.title);

  let desktopLinks = pageNav.querySelector(".nav-links");
  if (desktopLinks) {
    desktopLinks.innerHTML = visibleNavigation.map(([label, href]) => `<li><a href="${href}" class="${href === activeFile ? "active" : ""}"${href === activeFile ? ' aria-current="page"' : ""}>${label}</a></li>`).join("");
  }

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

  if (!internalPage) {
    const loginLink = document.createElement("a");
    loginLink.className = "app-shell-login";
    loginLink.href = location.protocol === "file:" ? "http://127.0.0.1:8765/login.html" : "login.html";
    loginLink.textContent = "内部登录";
    actions.appendChild(loginLink);
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
    <nav>${visibleNavigation.map(([label, href]) => `<a class="app-shell-mobile-link${href === activeFile ? " is-active" : ""}" href="${href}"${href === activeFile ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
    <div class="app-shell-mobile-divider"></div>
    <nav>
      <a class="app-shell-mobile-link${currentFile === "search.html" ? " is-active" : ""}" href="search.html">全局检索</a>
      ${internalPage ? '<a class="app-shell-mobile-link" href="index.html">返回公开站</a>' : `<a class="app-shell-mobile-link" href="${location.protocol === "file:" ? "http://127.0.0.1:8765/login.html" : "login.html"}">内部登录</a>`}
    </nav>
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
      if (currentFile === "candidates.html") return;
      translateNode(document.body);
      sanitizeUntranslatedEnglish(document.body);
      setTimeout(() => { translateNode(document.body); sanitizeUntranslatedEnglish(document.body); }, 500);
      setTimeout(() => { translateNode(document.body); sanitizeUntranslatedEnglish(document.body); }, 1500);
    }).catch(() => {});
  }
})();
