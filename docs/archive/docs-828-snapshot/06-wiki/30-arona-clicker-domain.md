---
scope: navigation-summary
authority: source-grounded-outline
read_when:
  - 修改 AronaClicker 的 PlayerState、领域服务或只读读模型
  - 需要理解业务命令怎样提交状态并呈现给 UI
avoid_when:
  - 需要完整字段清单或某项机制算法
related_modules:
  - player-state
  - state-mutation
  - domain-services
  - read-model
---

# 06-wiki/30-arona-clicker-domain — 产品领域、状态与 ReadModel

> 本文回答：AronaClicker 的领域服务如何编排业务，玩家状态由谁写入，以及 UI 如何通过只读投影读取结果。

## 领域层级

```text
Runtime 门面：src/arona-clicker/runtime-game-instance.ts
├─ 领域服务：src/arona-clicker/services/
│  ├─ 世界线 / 区域 / Spot：InitService、SpotService
│  ├─ 角色 / 招募 / 培养 / 色彩：Character、Gacha、Color 等服务
│  ├─ 故事 / 物品 / 强化 / 商店：对应服务
│  └─ 服务间以端口、共享查询能力和事件协作
├─ 状态写入：src/arona-clicker/state/state-mutation-service.ts
├─ 持久运行态：src/arona-clicker/types/state.ts / state/
└─ 只读投影：src/arona-clicker/read-model/
```

`services/` 不是一个统一业务服务。`src/arona-clicker/runtime-wiring.ts` 为各服务注入 Registry、条件/数值求值、事件、写入端口和状态读取回调；服务负责自己的业务门槛与操作顺序。代表性入口包括 `src/arona-clicker/services/spot-service.ts`、`init-service.ts`、`story-service.ts`、`gacha-service.ts` 和 `shop-service.ts`。

## 命令链与状态变化

UI 命令适配位于 `src/arona-clicker/runtime-commands.ts`。它将 `GameCommands` 映射到 Runtime 门面或领域服务方法。一次业务操作通常沿下列链路进行：

```text
Controller Action
  → GameCommands（runtime-commands.ts）
  → Runtime 门面 / 领域服务（门槛与业务步骤）
  → StateMutationService（提交玩家业务状态、同步统计、发出事件）
  → EventBus 分发事件，订阅者更新相关派生系统
```

`StateMutationService` 是玩家业务状态写入的集中入口，实现 Engine `StateMutationPort` 及产品扩展端口。常见写入按“状态 → 统计 → 事件”完成，订阅者再按事件维护 GameNum 缓存、可见性、Affector 或其他派生结构。TickSystem 对 `totalFrames` 的直接递增是一个待核对的例外，见 [[docs/archive/docs-828-snapshot/01-architecture/AC-outline-wiki#探索中待进一步核对]]。具体写入协议和副作用细节见 [[docs/archive/docs-828-snapshot/04-mechanisms/state-mutation]] 与 [[docs/archive/docs-828-snapshot/02-modules/state-mutation]]。

命令调用、状态持久化和事件驱动不是同一概念：命令链描述谁调用谁；PlayerState 的三层归属描述数据活多久；事件描述写入后哪些订阅者响应。状态归属规则见 [[docs/archive/docs-828-snapshot/01-architecture/state-layers]]。

## PlayerState 与领域边界

`PlayerState` 位于 `src/arona-clicker/types/state.ts`，运行时由 `src/arona-clicker/state/state-factory.ts` 创建。它记录当前 Save 的玩家状态，字段按 Global、per-Init 快照、per-Init 当前分层；Init 快照的保存、恢复与清理由 `src/arona-clicker/state/per-init-fields.ts` 和 `init-savepoint.ts` 协作管理。

Registry 定义游戏内容，PlayerState 记录玩家进度，二者不应折叠：例如 Spot 定义与 Spot 等级属于不同对象。UI 读取的 `GameView` 又是从 PlayerState 与派生系统构建的投影，不是另一份权威状态。字段详情见 [[docs/archive/docs-828-snapshot/03-data-structures/player-state]]；数据流边界见 [[docs/archive/docs-828-snapshot/01-architecture/data-flow]]。

## ReadModel 与呈现

`GameInstance.getView()` 委托 `src/arona-clicker/read-model/game-view-builder.ts`，从 PlayerState、Visibility、当前故事视图、活跃 Affector 和统计快照生成 `GameView`。`GameReadModel` 是产品向读接口契约；`src/ui/context.ts` 的 `createUIContext()` 将该读取面组织成组件消费上下文，并组合名称解析、格式化或专用只读查询。

```text
PlayerState ─┐
Visibility ──┤
StoryView ───┼→ buildGameView() → GameReadModel / UIContext → UI 呈现
Affector ────┤
Stats ───────┘
```

读模型是快照/查询投影，不提供领域写权限。UI 命令通过独立 `GameCommands` 能力调用；组件通常只获得 `GameReadModel` 与 `UIContext`。更广的 UI 刷新和控制器边界见 [[docs/archive/docs-828-snapshot/02-modules/ui]]。

## 关键源码与验证入口

| 主题 | 代码 / 文档 |
| --- | --- |
| 服务装配与端口注入 | `src/arona-clicker/runtime-wiring.ts` |
| 领域运行时门面 | `src/arona-clicker/runtime-game-instance.ts` |
| UI 命令适配 | `src/arona-clicker/runtime-commands.ts` |
| PlayerState 与写入口 | `src/arona-clicker/types/state.ts`、`src/arona-clicker/state/state-mutation-service.ts` |
| Init 字段归属与快照 | `src/arona-clicker/state/per-init-fields.ts`、`src/arona-clicker/state/init-savepoint.ts` |
| ReadModel 构建 | `src/arona-clicker/read-model/game-view-builder.ts`、`src/ui/context.ts` |
| 深入机制 | [[docs/archive/docs-828-snapshot/01-architecture/state-layers]]、[[docs/archive/docs-828-snapshot/04-mechanisms/state-mutation]]、[[docs/archive/docs-828-snapshot/02-modules/character]]、[[docs/archive/docs-828-snapshot/02-modules/world]] |

关联测试入口：`tests/engine/state-mutation-service.test.ts`、`tests/engine/milestone-runtime.test.ts`、`tests/engine/arona-runtime-pack.test.ts`。业务机制的专门测试由 [[docs/archive/docs-828-snapshot/05-conventions/testing]] 路由。
