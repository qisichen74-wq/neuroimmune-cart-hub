# AI 情报助手运行说明

更新日期：2026-09-15

## 产品边界

AI 情报助手只检索生产构建中的正式记录。`candidate-report.json`、审核决定和内部告警不进入公开索引。回答仅用于科研与产业情报参考，不构成临床诊疗建议。

没有配置模型时，助手自动使用“证据检索模式”，返回最相关的正式记录和引用；配置模型后，模型基于相同证据生成综合回答。无论哪种模式，候选池都不会进入回答。

## 本地运行

1. 将 `.env.example` 中的 AI 配置复制到本地 `.env.local`，按需填写 `DEEPSEEK_API_KEY`。
2. 运行 `npm start`。
3. 打开 `http://127.0.0.1:8765/assistant.html`。

可选配置：

```text
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_API_BASE=https://api.deepseek.com
DEEPSEEK_THINKING=disabled
ASSISTANT_DISABLE_MODEL=0
```

密钥为空时不会调用外部模型。密钥只能保存在服务端环境变量中，不能写入 HTML、浏览器 JavaScript 或公开 JSON。

进行本地隐私测试时，可设置 `ASSISTANT_DISABLE_MODEL=1`。即使环境中存在模型密钥，该开关也会强制使用站内检索模式，问题和证据不会发送给外部模型。

## 构建与测试

```text
npm run build:assistant
npm run test:assistant
npm run eval:assistant
npm run build:site
```

`build:assistant` 从专题、研究、竞争项目、临床试验、事件、机构、项目、交易、交易节点和安全信号生成 `data/assistant-index.json`，同时合并来源、核验状态和关系网络。

## 生产部署

现有 Cloudflare 集成为 Workers Builds。`worker.mjs` 处理 `/api/assistant`，通过 `ASSETS` 绑定读取本次部署的索引，并复用 `functions/api/assistant.js`；该函数也保留 Pages 兼容入口。生产环境需要在托管平台中配置 `DEEPSEEK_API_KEY`，模型、接口地址和思考模式可分别通过 `DEEPSEEK_MODEL`、`DEEPSEEK_API_BASE`、`DEEPSEEK_THINKING` 调整。密钥不能提交到 Git，本地密钥也不会自动同步至线上。

如果同时存在 DeepSeek 与旧版 OpenAI 配置，助手优先使用 DeepSeek。旧的 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_API_BASE` 仍受支持，便于平滑迁移；没有任何密钥时仍使用站内检索模式。

当前函数内的内存限流只是一层轻量保护，不保证跨实例一致。公开访问量扩大前，应在边缘网关增加持久化限流、访问分析和成本告警。

## 回答链路

1. 解析用户问题和可选页面上下文。
2. 按精确标识符、结构化字段、关键词和问题类型检索。
3. 根据 `relations.json` 扩展直接关联对象。
4. 合并核验状态、复核日期、来源权威性和数据截至日期。
5. 将最多十条证据发送给模型。
6. 检查模型是否引用有效的 `[S1]` 等证据编号；无引用、包含任意无效引用或已知被截断的答案会被丢弃并回退到直接检索结果。这是编号检查，不是逐句事实核验。

## 本轮质量验收（2026-09-15）

审计、索引生成和问答共用 `lib/evidence-policy.mjs`。使用上海时区的日历日；复核截止日当天仍有效，次日过期。按类型复核周期和显式截止日期中较早的条件判断；缺失、无效、未来核验日期不能计为当前已核验。字段继承顺序为类型默认值、带来源的集合核验信息、单条记录核验信息。

审计的 `summary.stale` 统计核验过期的去重记录数，`registry_stale` 单独统计登记库长期未更新提醒，不再将两者相加。重新构建索引不会刷新任何原始核验日期。

没有当前已核验证据时，证据置信度为低；模型答案前固定显示历史资料提示。界面“已配置”只表示存在服务端配置，不表示已通过实时连接测试。

固定检索集位于 `evals/assistant-cases.json`，使用 2026-09-14 的固定评测时点。报告输出到 `evals/results/latest.md`，影响常问问题的优先复核记录见 `evals/results/review-priority.md`。评测覆盖中英文疾病、缩写、编号、跨项目、交易、安全、追问、页面上下文和无证据问题；只检查预设关键记录是否进入前十条，不能把通过率解释为全面召回率或模型准确率。向量检索仍未实现。

如需真实联调，先启动本地服务，再显式执行 `node scripts/smoke-assistant.mjs --live`。会将两条问题和对应证据发送给已配置模型，可能产生费用；输出保存在 `evals/results/live-smoke.json`，不进入公开构建。默认测试不访问模型。

尚待验收：重点项目一手来源逐字段复核、模型逐句引用支持和冲突处理、独立扩展问题集、线上限流与费用控制、生产域名部署。当前不自动刷新核验日期，也不把网页可访问当作外部事实已核验。

## 上线前检查

本轮高频来源复核见 `docs/source-review-2026-09-15.md`。五项登记新增字段级复核和七天有效期，不改变整条记录核验日期；构建仅从已核对且哈希匹配的官方快照生成字段证据。原始获取脚本不会自动写回正式数据。

- 为生产域名验证 `/api/assistant` 的 GET 和 POST。
- 确认 `assistant-index.json` 中 `candidate_records_included` 为 `false`。
- 使用真实问题评测检索召回、引用支持度、过期提示和拒答。
- 设置 API 成本限额、告警、限流及日志保留策略。
- 对最新状态、监管结论、疗效和安全性问题进行领域人工抽查。

DeepSeek 接口采用服务端 `/chat/completions` 调用，默认使用 `deepseek-v4-flash` 并关闭思考模式，以控制公开问答的延迟和成本；如需更深推理，可把 `DEEPSEEK_THINKING` 设为 `enabled`。站内检索由本项目控制，不启用开放互联网搜索。实现依据见 [DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) 和 [DeepSeek 模型说明](https://api-docs.deepseek.com/quick_start/pricing/)。
