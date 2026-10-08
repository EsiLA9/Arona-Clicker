# 上下文包：生产与事件联动

适用：GameNum、生产结算、Affector、Effect、Trigger、Tick 和相关性能问题。

## Required Read Set

机制改动先读 [[docs/docs-829/05-conventions/architecture-discipline]] 与 [[docs/docs-829/02-modules/engine]]。再按实际子题选择，跨子题时合并：

| 子题 | 先读 |
| --- | --- |
| 生产结算 / Tick | [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/production]]、[[docs/docs-829/06-wiki/40-engine/tick-session]] |
| GameNum 表达式或失效 | [[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]、[[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/production]] |
| Affector 持续效果 | [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]]、[[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]] |
| Effect / Trigger 联动 | [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]]、[[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]] |

每次还要读取目标源码、调用方和相关测试；`src/engine/expression/` 与 `src/engine/effect/` 是定位范围，不是整目录阅读清单。

## Optional Read Set

- [[docs/docs-829/01-architecture/run-logic]]
- [[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]

旧 `docs-828/07-audit/affector-performance` 是历史审计快照，不代表当前性能状态；性能结论须依据当前源码、测试和测量重新确认。

## 默认不读

- `docs/plan-work/archive/**`
- 与生产链无关的 UI / 编辑器文档

## 最小验证

定向生产 / Effect 测试、`npx tsc --noEmit`；跨模块改动再运行 `npm test`。
