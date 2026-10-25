# docs-830/02-data-and-state/datapack-and-registry — Datapack 与 Registry

本文回答：声明式内容如何成为 Runtime 可查询的定义。

## 内容进入运行时

```text
Datapack 定义 → 包应用计划 → Registry 校验并合并 → 领域服务查询定义
```

Datapack 汇集角色、世界、剧情、经济等内容定义。`PackManager` 维护包记录与启用选择，并生成应用计划；Runtime 将启用的数据包交给 `GameInstance`。`Registry` 校验定义及其引用，再将定义整理为按 ID 查询的表和关系索引，供 Engine 与领域服务使用。

```mermaid
flowchart LR
  PACK[Datapack] --> PM[PackManager]
  PM --> RT[AronaClickerRuntime]
  RT --> REG[Registry]
  REG --> SVC[Engine 与领域服务]
```

## 边界

- Datapack 描述可装载内容；它不负责执行游戏行为。
- Registry 管理已装载定义与查询索引；具体规则由 Engine 或领域服务消费。
- Runtime 协调启用包、校验和重载，使包选择与当前 Registry 保持一致。

## 装载阶段

1. `GameInstance.init()` 创建候选 `Registry`，按启用顺序预检整组 Datapack 和地图引用。
2. 正式初始化时，`Registry.load(datapack)` 校验当前包与已加载定义之间的引用，再把各定义表合并入 Registry。
3. 全部包加载后，Runtime 再统一核验角色、商店、标签、地图等跨包引用，并把已装载定义交给数值、效果、触发和领域服务。

Registry 是运行期查询表，不是内容编辑器或存档。定义一般通过 Registry 的类型化表和索引查找；玩家进度则保存在 PlayerState，不能把包内定义的变化当成玩家状态更新。

| 数据类型 | 例子 | 主要消费者 |
| --- | --- | --- |
| 世界定义 | Init、Area、Spot | `InitService`、`SpotService`、可见性系统 |
| 业务定义 | 角色、商店、卡池、剧情入口 | 对应领域服务 |
| 引擎声明 | Funclet、Affector、Trigger | Engine 与 Runtime 反应器 |

主要源码：`src/data-services/contracts/datapack.ts`、`src/data-services/datapack/pack-manager.ts`、`src/data-services/registry/registry.ts`、`src/arona-clicker/runtime/runtime.ts`。相关测试见 `tests/data/pack-manager.test.ts`、`tests/engine/registry.test.ts`。

继续阅读：[[docs/docs-830/01-architecture/startup-and-runtime]]、[[docs/docs-830/02-data-and-state/state-and-events]]。
