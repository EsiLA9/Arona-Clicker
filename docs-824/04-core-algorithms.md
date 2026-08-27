# docs-824 — 04 核心算法（索引）

> 本文回答：**关键机制具体怎么算的？状态如何写入？产出/抽卡/培养/色彩/事件联动怎么运作？**
> 按主题拆分为 7 篇子文档，本篇保留算法总览表。

## 阅读路径

| 子文档 | 主题 | 原章节 |
| --- | --- | --- |
| [[docs-824/04a-state-mutation-pipeline]] | 状态写入 4 步管道（单一写入口） | 原一章 |
| [[docs-824/04b-production]] | 生产结算：GameNumSystem 数值树 + zone 聚合 | 原二章 |
| [[docs-824/04c-gacha]] | 抽卡结算：卡池 / 保底 / 重复转换 | 原三章 |
| [[docs-824/04d-cultivate]] | 培养推进：经验曲线 / 突破 | 原四章 |
| [[docs-824/04e-color-derivation]] | 色彩派生：ColorSystem / 主题 token | 原五章 |
| [[docs-824/04f-trigger-effect]] | 事件联动：Trigger / Effect / Affector / Reveal | 原六、七章 |
| [[docs-824/04g-roster]] | 通讯录分组 / 图鉴 / 招募 | 原八章 |

## 总体关系

```text
触发器 Trigger（条件）→ 效果 Effect（op 分支，经 StateMutationService 写入）
                          ↑
持续效果 Affector（ZoneModifiers → GameNumSystem 区表）→ 生产结算（04b）
生产结算结果（资源变化）→ 触发器再响应 → 循环
```

---

下一步读 [[docs-824/05-architecture-review]]（架构诊断基线）与 [[docs-824/06-refactoring-guide]]（拆分规范）。