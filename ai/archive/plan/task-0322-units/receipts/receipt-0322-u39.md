# Receipt Task 0322-U39

| 项 | 内容 |
| --- | --- |
| 状态 | 已归因；作为既有基线问题保留，不纳入Task 0322阶段1–5 |
| 实际修改 | 仅新增U39归因Unit与Receipt；未保留Map测试或Map源码改动 |
| 未完成内容 | Map基线测试错误未修复，留待其原Task/Owner处理 |
| 范围外原因 | 失败来自Gameplay B Map新增样例清单、条件判别类型及Item draft字段，不涉及StoryDef或Story节点迁移 |

## 原始验证结果

| 文件 | 结果 | 失败原因 |
| --- | --- | --- |
| `tests/data/gameplay-b-map-registry.test.ts` | 1项失败 | 当前数据含`gameplay-b:map:status-damage-reward-example`（`resumeVersion: 1`），测试旧期望表漏列该Map |
| `tests/engine/gameplay-b-basic-map-p0-p3.test.ts` | 2项失败 | 两条P3 Edge断言使用旧对象形状，遗漏`kind: 'teamResourceAtLeast'` |
| `tests/engine/gameplay-b-map-source-transactions.test.ts` | 1项失败 | Save中的Item draft增加显式`additionalTarget: null`，旧断言未包含 |
| `tests/data/base-datapack-folder-export.test.ts` | 通过 | 单独验证Export数据；本次没有失败 |

定向合并运行报告为4个文件、208项测试：204通过，4失败。该报告证明Map既有期望与当前Map数据合同不一致；它不表示Story切换产生了Map Runtime错误，也不作为Task 0322通过状态。

## 结论

不改Map文件和断言。全量验收报告应把这4项失败列为已知、无关基线问题，并避免宣称全仓测试全绿。
