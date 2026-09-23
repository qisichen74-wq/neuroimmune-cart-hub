const conversation = document.getElementById("conversation");
const welcome = document.getElementById("welcome");
const form = document.getElementById("composer");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask-button");
const evidenceList = document.getElementById("evidence-list");
const evidenceEmpty = document.getElementById("evidence-empty");
const evidenceCount = document.getElementById("evidence-count");
const contextBar = document.getElementById("context-bar");
const contextCopy = document.getElementById("context-copy");
const params = new URLSearchParams(location.search);
let context = params.get("context_type") && params.get("context_id") ? { type: params.get("context_type"), id: params.get("context_id") } : null;
let messages = [];
let busy = false;

const modeLabels = {
  "grounded-answer": "证据回答",
  "retrieval-only": "站内检索",
  "retrieval-fallback": "检索回退",
  "no-evidence": "证据不足"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function safeHref(value, external = false) {
  try {
    const url = new URL(String(value || ""), location.href);
    if (external && !["http:", "https:"].includes(url.protocol)) return "";
    if (!external && !["http:", "https:"].includes(url.protocol)) return "";
    return escapeHtml(external ? url.href : `${url.pathname.split("/").pop() || ""}${url.search}${url.hash}`);
  } catch {
    return "";
  }
}

function inlineMarkup(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(S\d+)\]/g, '<button class="citation-link" type="button" data-citation="$1">$1</button>');
}

function richText(value) {
  const lines = String(value || "").split(/\r?\n/);
  const html = [];
  let list = [];
  const closeList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkup(item)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    closeList();
    if (!line) continue;
    html.push(`<p>${inlineMarkup(line.replace(/^#{1,4}\s+/, ""))}</p>`);
  }
  closeList();
  return html.join("");
}

function formatDate(value) {
  if (!value) return "未注明";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

function setContext(next) {
  context = next;
  contextBar.hidden = !context;
  contextCopy.textContent = context ? `${context.type} · ${context.id}` : "";
  const url = new URL(location.href);
  if (context) {
    url.searchParams.set("context_type", context.type);
    url.searchParams.set("context_id", context.id);
  } else {
    url.searchParams.delete("context_type");
    url.searchParams.delete("context_id");
  }
  history.replaceState({}, "", url);
}

function addUserMessage(content) {
  welcome?.remove();
  const article = document.createElement("article");
  article.className = "message message-user";
  article.innerHTML = `<p>${escapeHtml(content)}</p>`;
  conversation.appendChild(article);
}

function addThinking() {
  const article = document.createElement("article");
  article.className = "message";
  article.id = "assistant-thinking";
  article.innerHTML = '<div class="thinking"><div class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></div><span>正在检索正式记录、检查来源状态并组织回答…</span></div>';
  conversation.appendChild(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
}

function addAnswer(payload) {
  document.getElementById("assistant-thinking")?.remove();
  const article = document.createElement("article");
  article.className = "message message-assistant";
  const limitations = (payload.limitations || []).length ? `<div class="answer-notes"><strong>需要注意</strong><ul>${payload.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : "";
  article.innerHTML = `
    <div class="answer-sheet">
      <div class="answer-meta">
        <span class="answer-mode">${escapeHtml(modeLabels[payload.mode] || "站内回答")}</span>
        <span class="answer-confidence${payload.confidence === "低" ? " is-low" : ""}">证据置信度 ${escapeHtml(payload.confidence || "待判断")}</span>
        <span class="answer-date">数据截至 ${escapeHtml(payload.data_as_of || "未注明")}</span>
      </div>
      <div class="answer-copy">${richText(payload.answer)}</div>
      ${limitations}
      <div class="answer-actions"><button type="button" data-copy-answer>复制回答</button></div>
    </div>`;
  article.querySelector("[data-copy-answer]").addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(payload.answer);
    event.currentTarget.textContent = "已复制";
  });
  conversation.appendChild(article);
  article.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addError(message) {
  document.getElementById("assistant-thinking")?.remove();
  addAnswer({ mode: "no-evidence", confidence: "低", answer: message, limitations: [], data_as_of: "" });
}

function renderEvidence(sources) {
  evidenceCount.textContent = String(sources.length);
  evidenceEmpty.hidden = sources.length > 0;
  evidenceList.innerHTML = sources.map((source) => {
    const recordUrl = safeHref(source.record_url);
    const sourceUrl = safeHref(source.source_url, true);
    return `
    <article class="evidence-card" id="evidence-${escapeHtml(source.citation_id)}" tabindex="-1">
      <div class="evidence-top"><span class="evidence-id">${escapeHtml(source.citation_id)}</span><span>${escapeHtml(source.type_label)}</span></div>
      <h3>${escapeHtml(source.title)}</h3>
      <p>${escapeHtml(source.excerpt || "暂无摘要")}</p>
      ${source.field_verification ? `<p><strong>登记字段${source.field_verification.current_verified ? "已复核" : "复核记录"} · ${escapeHtml(source.field_verification.last_verified_at)}</strong><br>${escapeHtml(source.field_verification.summary)}<br>仅限登记字段，不代表整条档案已重新核验。</p>` : ""}
      <div class="evidence-status">
        <span class="${source.stale ? "is-stale" : ""}">${source.stale ? "整条档案超过复核期" : escapeHtml(source.verification_status || "状态未注明")}</span>
        <span>${escapeHtml(source.confidence || "待判断")}置信度</span>
      </div>
      <div class="evidence-links">
        ${recordUrl ? `<a href="${recordUrl}">站内记录</a>` : ""}
        ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener">原始来源</a>` : ""}
        ${(source.additional_source_urls || []).map((url) => safeHref(url, true)).filter(Boolean).map((url, i) => `<a href="${url}" target="_blank" rel="noopener">补充来源 ${i + 1}</a>`).join("")}
      </div>
    </article>`;
  }).join("");
}

async function ask(question) {
  if (busy) return;
  busy = true;
  askButton.disabled = true;
  const priorHistory = messages.slice(-6);
  messages.push({ role: "user", content: question });
  addUserMessage(question);
  addThinking();
  questionInput.value = "";
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: priorHistory, context })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "问答服务暂时不可用，请稍后重试。");
    messages.push({ role: "assistant", content: payload.answer });
    addAnswer(payload);
    renderEvidence(payload.sources || []);
  } catch (error) {
    addError(error.message || "问答服务暂时不可用，请稍后重试。");
  } finally {
    busy = false;
    askButton.disabled = false;
    questionInput.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (question) ask(question);
});
questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => ask(button.dataset.question)));
document.getElementById("clear-context").addEventListener("click", () => setContext(null));
conversation.addEventListener("click", (event) => {
  const citation = event.target.closest("[data-citation]")?.dataset.citation;
  if (!citation) return;
  const card = document.getElementById(`evidence-${citation}`);
  if (!card) return;
  document.querySelectorAll(".evidence-card.is-highlighted").forEach((item) => item.classList.remove("is-highlighted"));
  card.classList.add("is-highlighted");
  card.focus({ preventScroll: true });
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => card.classList.remove("is-highlighted"), 1800);
});

if (context) setContext(context);
if (params.get("q")) questionInput.value = params.get("q");

fetch("/api/assistant")
  .then(async (response) => {
    const status = await response.json();
    if (!response.ok) throw new Error();
    document.getElementById("state-dot").classList.add("is-ready");
    document.getElementById("state-count").textContent = `${status.records} 条正式记录`;
    const providerName = status.model_provider === "deepseek" ? "DeepSeek" : status.model_provider === "openai" ? "OpenAI" : "问答模型";
    document.getElementById("state-copy").textContent = status.model_configured ? `${providerName} 已配置，回答将经过站内证据检索。` : "证据检索可用；配置模型密钥后启用综合回答。";
    document.getElementById("state-date").textContent = `截至 ${status.data_as_of || "未注明"}`;
    document.getElementById("state-model").textContent = status.model_configured ? `${providerName} 已配置` : "检索模式";
  })
  .catch(() => {
    document.getElementById("state-dot").classList.add("is-error");
    document.getElementById("state-count").textContent = "服务未连接";
    document.getElementById("state-copy").textContent = "请通过本地工作台服务或已配置的生产站访问。";
  });
