# 上下文包：世界线、Init 与生命周期

适用：Init、Area、Spot、Lobby、会话、存档、世界线切换和运行时重建。

## 按子题选择

只读命中的一行；需要领域职责时补 [[docs/docs-829/02-modules/arona-clicker]]，改变架构或状态写入边界时补 [[docs/docs-829/05-conventions/architecture-discipline]]。

| 子题 | 先读 |
| --- | --- |
| Lobby / Init 选择 / Runtime 重建 | [[docs/docs-829/01-architecture/run-logic]]、[[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]] |
| 世界线状态归属 / 存档 / 恢复 | [[docs/docs-829/03-data-structures/player-state]]、[[docs/docs-829/06-wiki/30-arona-clicker-domain/world-lifecycle]]；涉及写入口时读 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]] |
| Area / Spot 拓扑与访问 | [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]]；涉及内容解析时补 [[docs/docs-829/06-wiki/20-data-services/registry]] |
| Spot 生产结算 | [[docs/ai/context-packs/production]] 中的生产子题 |

再核对 `src/arona-clicker/` 中对应 runtime、init 或 save service 及相关测试，不默认读取整个目录。

## Optional Read Set

- [[docs/docs-829/01-architecture/overview]]
- [[docs/docs-829/01-architecture/data-flow]]

旧 `docs-828/07-audit/` 文档是历史核查记录，不是当前规则；历史状态结论需按目标源码与测试重新确认。

## 默认不读

- `docs/plan-work/archive/**` 中尚未落地的多包存档规划
- 与生命周期无关的表现层审查文档

## 验证入口

行为改变时运行生命周期 / 存档定向测试；状态契约改变时补类型检查。不新增存档迁移代码。
