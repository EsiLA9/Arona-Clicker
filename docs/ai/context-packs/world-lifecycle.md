# 上下文包：世界线、Init 与生命周期

适用：Init、Area、Spot、Lobby、会话、存档、世界线切换和运行时重建。

## Required Read Set

- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/02-modules/world]]
- [[docs/docs-828/01-architecture/run-logic]]
- [[docs/docs-828/01-architecture/state-layers]]
- `src/arona-clicker/` 对应 runtime / init / save service 与测试

## Optional Read Set

- [[docs/docs-828/01-architecture/design-constraints]]
- [[docs/docs-828/07-audit/dual-track-state]]
- [[docs/docs-828/01-architecture/data-flow]]

## 默认不读

- `docs/plan-work/archive/**` 中尚未落地的多包存档规划
- 与生命周期无关的表现层审查文档

## 最小验证

生命周期 / 存档定向测试、`npx tsc --noEmit`；不新增存档迁移代码。
