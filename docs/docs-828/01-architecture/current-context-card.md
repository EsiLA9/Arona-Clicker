---
scope: current-fact
authority: navigation-summary
read_when:
  - 新会话建立项目全局模型
  - 选择任务 Read Set
avoid_when:
  - 需要机制细节或字段级语义
related_modules:
  - architecture
  - state
  - ui
---

# 01-architecture/current-context-card — 当前架构上下文卡

> 本文回答：**开始一次新施工前，最少需要知道什么，以及下一步应该读哪里。**
> 本文是导航压缩层，不替代架构正文；当前事实仍以源码、测试和 `docs/docs-828/` 对应正文为准。

## 一句话模型

这是一个事件驱动、声明式 Datapack 驱动的放置类 RPG：Registry 编译内容，PlayerState 持有三层运行时状态，StateMutationService 是唯一写入口，派生系统通过事件失效或重算，UI 只消费只读视图。

## 主调用链

```text
src/ui/main.ts
  → createAppRuntime()
  → applyEnabledPacks()
  → Lobby（activeInit 为空，不启动 Tick）
  → choose / resume Init
  → start()（1 tick/秒）
  → tick()
      生产结算 → Affector → 阻断复检 / 剧情推进 → 统计 → UI 读取视图
```

详细时序：[[docs/docs-828/01-architecture/run-logic]]

## 四层数据流

```text
Datapack
  → Registry（只读编译态、表与关系索引）
  → PlayerState（Global + per-Init 快照 + per-Init 当前）
  → GameView / UIContext（UI 只读快照与查询面）
```

详细数据语义：[[docs/docs-828/01-architecture/data-flow]]、[[docs/docs-828/01-architecture/state-layers]]

## 五条高频边界

1. 状态只能经 `StateMutationService` 写入；不要直接修改 `PlayerState`。
2. 新联动优先使用事件、Trigger、Effect、Affector；不要把联动塞进大门面或 Tick 方法体。
3. 新机制优先声明为 Datapack 字段；改 `src/engine/types/` 的字段或枚举后必须执行 Schema 同步流程。
4. UI 只消费 `getView()` / `createUIContext()`；UI 不持有引擎写引用。
5. 新增状态字段先决定 Global、per-Init 快照还是 per-Init 当前；per-Init 字段必须登记 `PER_INIT_FIELD_SPECS`。

完整纪律：[[docs/docs-828/05-conventions/architecture-discipline]]

## 默认源码路由

| 任务 | 先看 | 常见源码入口 |
| --- | --- | --- |
| 生产 / 数值 / 持续效果 | [[docs/docs-828/04-mechanisms/production]] | `src/engine/expression/`、`src/engine/effect/` |
| 状态写入 / 状态字段 | [[docs/docs-828/01-architecture/state-layers]] | `src/arona-clicker/state/` |
| 角色 / 抽卡 / 培养 | [[docs/docs-828/02-modules/character]] | `src/arona-clicker/services/` |
| 世界线 / 生命周期 | [[docs/docs-828/02-modules/world]] | `src/arona-clicker/` |
| UI / 主题 / 表现 | [[docs/docs-828/02-modules/ui]] | `src/ui/` |
| 实体字段 / 枚举 / Schema | [[docs/docs-828/05-conventions/schema-sync]] | `src/engine/types/`、`tools/datapack-editor/schema/` |
| 文档治理 / Luna 上下文 | [[docs/ai/task-read-set-routing]] | `docs/`、`docs/ai/` |

## 默认不要读

- `docs/plan-work/archive/**`：除非需要追溯设计理由或恢复未决方向。
- `docs/newPlan/**`：旧位置，禁止继续写入。
- `tools/datapack-editor/**`：除非任务明确涉及独立数据包编辑器或 Schema 编辑器。
- 与当前任务无关的 `07-audit/**`：审查文档按路由按需读取。

## 最小启动上下文

普通任务建议从以下内容开始：

```text
AGENTS.md
→ docs/docs-828/00-INDEX.md
→ 本文
→ 一个相关模块卡片
→ 一篇相关机制 / 数据结构正文
→ 目标源码与测试
```

如果任务无法在这个范围内定位，再扩大 Read Set；不要一开始读取整个 `docs/`。

## 相关入口

- [[docs/docs-828/00-INDEX]]
- [[docs/ai/task-read-set-routing]]
- [[docs/ai/PROJECT-CONSTITUTION]]
