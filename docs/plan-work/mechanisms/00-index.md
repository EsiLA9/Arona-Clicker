# 机制聚合总入口（历史层的反向索引）

> 本目录是**冻结考古层的反向索引**：从「当前机制」出发，找到它的设计理由与历史来源。
> 它只聚合链接，不复制 ADR / Roadmap / Task / 机制正文，也**不维护任何状态**（状态只写在文档文首，见 [[docs/docs-828/05-conventions/doc-maintenance]]）。

## 用法

```text
想知道系统现在是什么      → docs/docs-828（唯一当前事实源）
想知道仍生效的约束         → docs/docs-828/01-architecture/design-constraints
想知道某个机制为什么这样设计 → 本目录对应聚合页 → 跳 archive/ 原文
想知道还有什么没做         → docs/plan-work/00-index 的「未决方向」
```

## 机制地图

| 机制聚合 | 关注内容 | 入口 |
| --- | --- | --- |
| 引擎架构与领域边界 | 装配、引擎 / 领域分层、事件与基础机制 | [[docs/plan-work/mechanisms/architecture-engine]] |
| Datapack、Registry 与存档 | 多包、命名空间、启用集、残留、服务工作区 | [[docs/plan-work/mechanisms/datapack-registry-save]] |
| 世界、Spot 与商店 | Init / Area / Spot、揭示、商店与空间经营 | [[docs/plan-work/mechanisms/world-spot]] |
| 角色、获取与成长 | Character / Variant、拥有、抽卡、培养、好感、碎片 | [[docs/plan-work/mechanisms/character-acquisition-growth]] |
| 色彩、主题与 UI 表现 | Color、Theme、Presentation、UI Host、服务工作区 | [[docs/plan-work/mechanisms/theme-presentation-ui]] |
| 审查与文档治理 | Code Review、文档重构、文档整理、跨机制风险 | [[docs/plan-work/mechanisms/review-documentation]] |

## 阅读规则

1. 聚合页只列「当前事实源 / 仍生效裁定 / 历史来源」三类链接，不写状态、不写结论；
2. 历史来源条目指向 `archive/` 原文；原文记录的是**当时的判断**，不是当前行为；
3. ADR 中「应如此」但源码未实现的部分，以 [[docs/docs-828/01-architecture/design-constraints]] 末节为准；
4. 同一文件可从多个机制入口被引用，但正文只保留一份。
