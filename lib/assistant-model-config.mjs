const DEEPSEEK_DEFAULTS = {
  provider: "deepseek",
  protocol: "chat-completions",
  model: "deepseek-v4-flash",
  apiBase: "https://api.deepseek.com",
  thinking: "disabled"
};

const OPENAI_DEFAULTS = {
  provider: "openai",
  protocol: "responses",
  model: "gpt-5",
  apiBase: "https://api.openai.com/v1",
  thinking: ""
};

function clean(value) {
  return String(value || "").trim();
}

function normalizedThinking(value) {
  return clean(value).toLowerCase() === "enabled" ? "enabled" : "disabled";
}

export function resolveAssistantModelConfig(env = {}) {
  const disabled = clean(env.ASSISTANT_DISABLE_MODEL) === "1";
  const deepseekKey = clean(env.DEEPSEEK_API_KEY);
  const genericKey = clean(env.AI_API_KEY);
  const openaiKey = clean(env.OPENAI_API_KEY);

  if (deepseekKey) {
    return {
      ...DEEPSEEK_DEFAULTS,
      configured: !disabled,
      apiKey: disabled ? "" : deepseekKey,
      model: clean(env.DEEPSEEK_MODEL) || DEEPSEEK_DEFAULTS.model,
      apiBase: clean(env.DEEPSEEK_API_BASE) || DEEPSEEK_DEFAULTS.apiBase,
      thinking: normalizedThinking(env.DEEPSEEK_THINKING)
    };
  }

  if (genericKey) {
    const apiBase = clean(env.AI_API_BASE);
    const model = clean(env.AI_MODEL);
    if (!apiBase || !model) return { ...DEEPSEEK_DEFAULTS, provider: "compatible", configured: false, apiKey: "" };
    const protocol = clean(env.AI_API_PROTOCOL) === "responses" ? "responses" : "chat-completions";
    return {
      provider: clean(env.AI_PROVIDER) || "compatible",
      protocol,
      configured: !disabled,
      apiKey: disabled ? "" : genericKey,
      model,
      apiBase,
      thinking: normalizedThinking(env.AI_THINKING)
    };
  }

  if (openaiKey) {
    return {
      ...OPENAI_DEFAULTS,
      configured: !disabled,
      apiKey: disabled ? "" : openaiKey,
      model: clean(env.OPENAI_MODEL) || OPENAI_DEFAULTS.model,
      apiBase: clean(env.OPENAI_API_BASE) || OPENAI_DEFAULTS.apiBase
    };
  }

  return { ...DEEPSEEK_DEFAULTS, configured: false, apiKey: "" };
}
