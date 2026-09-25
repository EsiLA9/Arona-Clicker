# 上下文包：世界线、Init 与生命周期

适用：Init、Area、Spot、Lobby、会话、存档、世界线切换和运行时重建。

## Required Read Set

机制改动先读 [[docs/docs-828/05-conventions/architecture-discipline]] 与 [[docs/docs-828/02-modules/world]]。再按实际子题选择：

| 子题 | 先读 |
| --- | --- |
| Lobby / Init 选择 / Runtime 重建 | [[docs/docs-828/01-architecture/run-logic]] |
| 世界线状态归属 / 存档 / 恢复 | [[docs/docs-828/01-architecture/state-layers]]；涉及写入口时读 [[docs/docs-828/04-mechanisms/state-mutation]] |
| Area / Spot 拓扑与访问 | [[docs/docs-828/01-architecture/run-logic]] 的位置切换部分；涉及内容解析时补 [[docs/docs-828/02-modules/registry]] |
| Spot 生产结算 | [[docs/ai/context-packs/production]] 中的生产子题 |

每次还要读取 `src/arona-clicker/` 对应 runtime、init 或 save service 及相关测试，不默认读取整个目录。

## Optional Read Set

- [[docs/docs-828/01-architecture/design-constraints]]
- [[docs/docs-828/07-audit/dual-track-state]]
- [[docs/docs-828/01-architecture/data-flow]]

## 默认不读

- `docs/plan-work/archive/**` 中尚未落地的多包存档规划
- 与生命周期无关的表现层审查文档

## 最小验证

生命周期 / 存档定向测试、`npx tsc --noEmit`；不新增存档迁移代码。
