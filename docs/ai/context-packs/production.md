# 上下文包：生产与事件联动

适用：GameNum、生产结算、Affector、Effect、Trigger、Tick 和相关性能问题。

## Required Read Set

机制改动先读 [[docs/docs-828/05-conventions/architecture-discipline]]。再按实际子题选择，跨子题时合并：

| 子题 | 先读 |
| --- | --- |
| 生产结算 / Tick | [[docs/docs-828/04-mechanisms/production]]、[[docs/docs-828/02-modules/game-num]] |
| GameNum 表达式或失效 | [[docs/docs-828/02-modules/game-num]]、受影响的 [[docs/docs-828/04-mechanisms/production]] 章节 |
| Affector 持续效果 | [[docs/docs-828/02-modules/affector]]、受影响的 [[docs/docs-828/04-mechanisms/production]] 章节 |
| Effect / Trigger 联动 | [[docs/docs-828/04-mechanisms/trigger-effect]]、[[docs/docs-828/02-modules/effect-trigger]] |

每次还要读取目标源码、调用方和相关测试；`src/engine/expression/` 与 `src/engine/effect/` 是定位范围，不是整目录阅读清单。

## Optional Read Set

- [[docs/docs-828/01-architecture/run-logic]]
- [[docs/docs-828/07-audit/affector-performance]]

## 默认不读

- `docs/plan-work/archive/**`
- 与生产链无关的 UI / 编辑器文档

## 最小验证

定向生产 / Effect 测试、`npx tsc --noEmit`；跨模块改动再运行 `npm test`。
