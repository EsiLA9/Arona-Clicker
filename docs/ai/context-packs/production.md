# 上下文包：生产与事件联动

适用：GameNum、生产结算、Affector、Effect、Trigger、Tick 和相关性能问题。

## Required Read Set

- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/04-mechanisms/production]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/02-modules/game-num]]
- [[docs/docs-828/02-modules/affector]]
- `src/engine/expression/`、`src/engine/effect/` 目标源码与测试

## Optional Read Set

- [[docs/docs-828/01-architecture/run-logic]]
- [[docs/docs-828/07-audit/affector-performance]]

## 默认不读

- `docs/plan-work/archive/**`
- 与生产链无关的 UI / 编辑器文档

## 最小验证

定向生产 / Effect 测试、`npx tsc --noEmit`；跨模块改动再运行 `npm test`。
