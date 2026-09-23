# 高频证据复核记录

复核日期：2026-09-15。范围：5 项 ClinicalTrials.gov 登记、Kyverna 2 份企业声明。不是全库重新核验。

## 登记字段

已获取并逐项核对正式标题、申办方、登记状态、人数、入组类型、分期、开始及结束日期、登记更新日期和平台结果发布标记。

| 登记 | 登记状态 | 登记人数 | 类型 | 结果发布标记 |
| --- | --- | --- | --- | --- |
| [NCT06451159](https://clinicaltrials.gov/study/NCT06451159) | Active, not recruiting | 10 | ESTIMATED，计划数 | false |
| [NCT06193889](https://clinicaltrials.gov/study/NCT06193889) | Recruiting | 66 | ESTIMATED，计划数 | false |
| [NCT07403188](https://clinicaltrials.gov/study/NCT07403188) | Recruiting | 70 | ESTIMATED，计划数 | false |
| [NCT07006805](https://clinicaltrials.gov/study/NCT07006805) | Withdrawn | 0 | ACTUAL，实际数 | false |
| [NCT06220201](https://clinicaltrials.gov/study/NCT06220201) | Active, not recruiting | 120 | ESTIMATED，计划数 | false |

主要登记字段与站内值一致。NCT06451159 的本地申办方写为 Bruce Cree / UCSF，而官方 leadSponsor 是 Bruce Cree，机构信息为 UCSF；本轮字段证据保留官方原值，不将机构合写解释为两个申办方。

`hasResults=false` 仅表示 ClinicalTrials.gov 未发布该登记的结果，不能据此断言没有论文、会议报告或企业数据。NCT07403188 为观察性长期随访，没有临床分期字段，不赋予一个虚构的试验阶段。

原始快照、获取时间、差异清单与人工逐项复核后的清单保存在 `evals/verification/2026-09-15/`。构建校验 SHA-256 和登记身份后生成 `data/registry-field-evidence.json`，嵌入问答索引。字段证据自复核日起按 7 天周期到期，不会因重新构建延长有效期。

本轮不刷新 `data/verification.json` 的整条记录日期。问答分别展示登记字段复核和整条档案时效；编辑分析、患者结果及监管解读未被这次登记核对覆盖。缺少入组类型的旧记录显示“登记入组数（类型未注明）”，不再一律标为计划数。

## 企业披露

[Kyverna 2026-09-01 声明](https://ir.kyvernatx.com/news-releases/news-release-details/company-statement-miv-cels-favorable-safety-profile)提供全人源 CD19、CD28 共刺激域，以及公司对 SPS 滚动 BLA 和 gMG 入组时间的计划。将这些内容作为带日期的企业披露更新到 Kyverna 档案，未据此宣称已获批、已完成入组或安全性已被独立证实。

[2026-05-12 公司公告](https://ir.kyvernatx.com/news-releases/news-release-details/kyverna-therapeutics-announces-initiation-rolling-sps-bla)补充支持自体 CAR-T 构建和此前滚动提交进程。此公告也包含单臂试验分析和研究者发起试验进展，因此检索到少量病例报告时尤其不能推断整个项目只有病例证据。本轮未把这些临床数据直接写入疗效结论；需要另行核对原始研究和会议材料。

## 仍待处理

- PubMed 高频研究、疾病专题及安全记录的逐字段复核尚未完成。
- 旧 `refresh-verification.mjs` 包含“页面可访问或关键词命中即刷新日期”的宽松路径，本轮未运行；不能用该脚本消除剩余告警。
- 整条记录核验期统计保持 47/246；新增 5 份近期登记字段核对不能被加算为 5 条全文已核验。
- 固定检索回归、字段作用范围、实际/计划入组、快照到期和模型输入测试需通过后才交付。逐句医学事实支持仍需独立评测。
