# 机制聚合：引擎架构与领域边界

## 机制范围

- Runtime 装配、事件驱动、StateMutation 单一写入口、只读 UI；
- Engine / data-services / AronaClicker 的类型与依赖边界；
- GameNum、Affector 等基础引擎机制的架构裁定。

## 当前事实源

- [[docs-828/01-architecture/overview]]
- [[docs-828/01-architecture/run-logic]]
- [[docs-828/01-architecture/state-layers]]
- [[docs-828/05-conventions/architecture-discipline]]
- [[docs-828/04-mechanisms/state-mutation]]

## 计划与决策

| 生命周期 | 文档 | 用途 |
| --- | --- | --- |
| completed | [[0x-plan&work/completed/adr-0001-architecture-consolidation]] | T1-T7 架构整理决策 |
| completed | [[0x-plan&work/completed/adr-0002-gamenum-tree]] | GameNum 树与 Affector 修复 |
| completed | [[0x-plan&work/completed/adr-0005-engine-domain-boundaries]] | 引擎与领域边界 |
| completed | [[0x-plan&work/completed/roadmap-0005-engine-domain-consolidation]] | 领域内聚施工记录 |
| active | [[0x-plan&work/active/roadmap-0007-enhancement-reveal]] | 强化揭示与服务权限语义 |

## 当前判断

架构主线已落地；后续变更必须遵守 `docs-828/05-conventions/architecture-discipline`，而不是回到旧的 GameInstance/混合类型路径。
