# AI 助手离线检索评测

评测日期：2026-09-14；数据截至：2026-08-21。

站内检索召回和无证据边界，不代表医学事实正确率或模型回答准确率。仅要求预先指定的关键记录出现在前十条，不测量全部相关资料的召回率。

通过 18/18。时效统计：199 条超过复核期，47 条当前已核验，共 246 条。

| 用例 | 问题 | 结果 |
| --- | --- | --- |
| ms-cn | 多发性硬化有哪些 CAR-T 临床试验？ | 通过 |
| ms-en | multiple sclerosis CAR-T trials | 通过 |
| ms-alias | MS有哪些临床试验？ | 通过 |
| mg | 重症肌无力有哪些临床试验？ | 通过 |
| nct | NCT06451159是什么研究？ | 通过 |
| pmid | PMID 40706586 的研究结论 | 通过 |
| product-trials | KYV-101有哪些临床试验？ | 通过 |
| comparison | 比较 KYV-101 和 CABA-201 的技术路线 | 通过 |
| safety-crs | CAR-T的CRS安全风险有哪些？ | 通过 |
| safety-icans | ICANS神经毒性有哪些证据？ | 通过 |
| safety-infection | CAR-T感染风险 | 通过 |
| deal | AstraZeneca收购Gracell的交易金额 | 通过 |
| financing | Cartesian K2 信贷融资 | 通过 |
| followup | 它的临床试验有哪些？ | 通过 |
| context | 这个试验的入组计划 | 通过 |
| unknown | 量子香蕉飞船 | 通过 |
| unknown-product | ZZZ-99999有哪些试验？ | 通过 |
| unknown-in-context | 量子香蕉飞船 | 通过 |

模型内容正确性、逐句引用支持、矛盾来源处理和医学结论需要另行人工验收，不包含在上述通过率中。
