# 机制聚合总入口

> 本目录是 `docs/plan-work` 的**按机制阅读层**。它只聚合链接、状态和阅读顺序，不复制 ADR、Roadmap、Task 或机制正文。
> 原文仍按生命周期保留在 `active/`、`completed/`、`docs/newPlan/` 和 `registry&saves/`；需要判断“当前是否实施”时，以原文状态为准。

## 机制地图

| 机制聚合 | 关注内容 | 入口 |
| --- | --- | --- |
| 引擎架构与领域边界 | 装配、引擎/领域分层、事件与基础机制 | [[docs/plan-work/mechanisms/architecture-engine]] |
| Datapack、Registry 与存档 | 多包、命名空间、启用集、残留、服务工作区 | [[docs/plan-work/mechanisms/datapack-registry-save]] |
| 世界、Spot 与商店 | Init/Area/Spot、揭示、商店与空间经营 | [[docs/plan-work/mechanisms/world-spot]] |
| 角色、获取与成长 | Character/Variant、拥有、抽卡、培养、好感、碎片 | [[docs/plan-work/mechanisms/character-acquisition-growth]] |
| 色彩、主题与 UI 表现 | Color、Theme、Presentation、UI Host、服务工作区 | [[docs/plan-work/mechanisms/theme-presentation-ui]] |
| 审查与文档治理 | Code Review、文档重构、文档整理、跨机制风险 | [[docs/plan-work/mechanisms/review-documentation]] |

## 阅读规则

1. 想知道当前机制怎么运行：先看 `docs/docs-828/04-mechanisms/`，再看对应模块卡片。
2. 想知道为什么这样设计：看聚合页中的 ADR 或 completed 记录。
3. 想知道还要做什么：看 active Roadmap/Task 的“状态”和“剩余切片”。
4. 想看尚未裁定的方向：看 `docs/newPlan/`，不能把它当成已批准实现。
5. 同一文件可从多个机制入口被引用，但正文只保留一份。

## 生命周期状态

```text
docs/newPlan（方案草稿）
   ↓ 裁定
active/ADR + active/Roadmap + active/Task（当前决策与施工）
   ↓ 完成
completed/（历史决策与施工记录）
```

跨机制的长期任务仍保留在其生命周期目录中；本目录只提供机制视角的导航，不新增第二套状态系统。
