# 机制聚合总入口（历史层反向索引）

> 本目录从当前机制出发，链接到相关设计理由与历史来源。它只聚合链接，不复制机制正文，也不维护实现状态。

## 用法

```text
想了解当前机制事实       → docs/docs-829/00-INDEX
想追溯某机制的设计来源   → 本目录对应聚合页 → archive/ 原文
想了解当前推进项         → docs/plan-work/00-index
```

历史提案或约束不能单独证明当前行为；核对实现时以源码、测试及 [[docs/docs-829/00-INDEX]] 路由到的现行文档为准。

## 机制地图

| 机制聚合 | 关注内容 | 入口 |
| --- | --- | --- |
| 引擎架构与领域边界 | 装配、引擎 / 领域分层、事件与基础机制 | [[architecture-engine]] |
| Datapack、Registry 与存档 | 多包、命名空间、启用集、残留、服务工作区 | [[datapack-registry-save]] |
| 世界、Spot 与商店 | Init / Area / Spot、揭示、商店与空间经营 | [[world-spot]] |
| 角色、获取与成长 | Character / Variant、拥有、抽卡、培养、好感、碎片 | [[docs/plan-work/mechanisms/character-acquisition-growth]] |
| 色彩、主题与 UI 表现 | Color、Theme、Presentation、UI Host、服务工作区 | [[theme-presentation-ui]] |
| 审查与文档治理 | Code Review、文档重构、文档整理、跨机制风险 | [[review-documentation]] |

## 阅读规则

1. 聚合页只列当前事实源、仍生效裁定和历史来源，不写实现状态或结论。
2. 历史来源指向 `archive/` 原文；原文记录当时的判断，不代表当前行为。
3. 同一主题的正文只维护一份，其余位置使用链接。
