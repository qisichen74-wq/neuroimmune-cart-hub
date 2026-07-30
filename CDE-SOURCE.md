# CDE 中国药物临床试验来源

本项目已把国家药监局药审中心的“药物临床试验登记与信息公示平台”纳入候选发现流程。官方来源为：

- https://www.chinadrugtrials.org.cn/
- 记录编号：CTR 开头的中国药物临床试验登记号

## 访问方式

发现脚本会先判断 CDE 官网公开查询页是否可直接读取。该站目前通常返回 JavaScript 防护页，因此直接访问失败时，来源报告会标记为“部分可用”，不会把失败误写成“0 条结果”。

若需要自动分页检索，可使用 Parse 提供的 CDE 公开数据只读封装。它不是 CDE 官方 API，最终来源链接仍指向 CDE 官网。免费账户目前提供有限调用额度：

1. 在 https://parse.bot/marketplace/03eeffd6-cf63-4638-8196-8f2effac0ed3/chinadrugtrials-org-cn-api 获取 API Key。
2. 复制 `.env.example` 为 `.env.local`。
3. 在 `.env.local` 中填写 `CHINA_DRUG_TRIALS_API_KEY`，然后运行 `npm run discover:sources`。

`.env.local` 已加入 `.gitignore`，不会被提交到 GitHub。

## 免费额度保护

- Parse 免费账户目前是每月 100 credits，并非每天 100 次；所有 Marketplace API 共用该额度。
- CDE `search_trials` 每次成功调用消耗 2 credits。程序每 7 天实际刷新一次，其余运行复用本机 `.cache/china-drug-trials/` 缓存。
- 当前 8 个检索词、每词只读取第一页，一轮最多 8 次调用，即 16 credits。
- 程序设置每月 80 credits 的硬上限，为人工检查或其他 Parse API 保留至少 20 credits。
- 缓存、月度调用计数和 API 密钥均不会提交到 GitHub。

## 纳入规则

CDE 返回的记录仍需同时满足：

- 标题、药物名称或适应症明确涉及 CAR-T / 嵌合抗原受体 / 细胞治疗；
- 标题或适应症明确定位到自身免疫疾病；
- 肿瘤试验仅在排除标准中提到自身免疫病时，不会被纳入。

临床试验沿用项目规则：进入候选池，但不进入人工审核队列。
