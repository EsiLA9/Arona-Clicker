# 07-audit/runtime-tolerance — 运行时容错政策分裂

> 本文回答：**异常数据的处理为何有三套互不一致的失效路径，以及统一政策怎么定。**
> 多 Datapack 前提（[[docs/docs-828/07-audit/00-overview]]）不影响本组结论——恰恰相反：第三方包作者更需要**响亮、可定位到包**的错误，静默兜底让坏包表现为「功能不生效」，无法调试。

## 问题清单

| # | 现象 | 位置 | 严重度 |
| --- | --- | --- | --- |
| 1 | 同一「引用无效」有三种结局：加载期抛错 / 运行时软失败 / 静默不中 | 见下 | 高 |
| 2 | 「未知 source 回落 0」与编译期穷尽重复，且已实证吞掉 funclet bug | `02-modules/expression.md:14,16,22` | 高 |
| 3 | 存档政策两套并存：version 抛错 vs normalize / `??=` 兜底 | 见下 | 中 |

### 1. 三种失效路径并存

- **位置**：`03-data-structures/registry.md:44`（校验失败即抛错，但覆盖面并非全量）；`03-data-structures/id-reference-semantics.md:103`（jumpToStory / startStoryId / availableInits / PassivePoolChild / owner 等无静态校验——真引用悬空运行时软失败、意义引用静默不中，均无 DevLog）；`03-data-structures/declarative-dsl.md:62-63`（extra / protoStat 缺失→0）。
- **原因**：容错点按需求时点逐个添加，无统一政策；校验缺口集中在后期新增字段。
- **方案组**：
  - **A（推荐）**：两层政策写入 [[docs/docs-828/05-conventions/architecture-discipline]]——① 加载期：真引用悬空一律抛错（补 §六.2 缺口，并入 `validateDatapack`）；② 运行时：任何降级/兜底必须 DevLog（带包名 + 实体 id），仅玩家输入类允许静默。
  - B：最小改动——仅为现有静默回落统一加 DevLog。
  - C：维持现状，仅把「哪类字段有校验」写全（id-ref §六.2 已列）。

### 2. funclet 恒 0 + 冗余回落

- **位置**：`02-modules/expression.md:14`（未知 source 回落 0）与 `:22`（「缺注册即编译错误」的编译期保证并存）；`03-data-structures/declarative-dsl.md:36`（`value-system.ts:79` 强转 bug，calc 恒返回 0，未修）。
- **原因**：运行时回落是在编译期穷尽之上叠的第二重保险；强转 bug 恰好落进 `default → 0` 分支被静默吞掉，至今无人察觉。
- **方案组**：
  - **A（推荐）**：修 funclet（一行：直接 `evaluate(def.calc, state)`）；回落保留（多包健壮性）但 DevLog error。
  - B：回落改抛错（严格路线）。
  - C：若确认无数据使用 Funclet，整条机制移除。

### 3. 存档政策两套并存

- **位置**：`02-modules/world.md:42`（`normalizePlayerState` 兜底 + version 校验）；`01-architecture/state-layers.md:31`（旧档缺字段 `??=` 兜底）；`03-data-structures/player-state.md:47`（纪律 8：不写迁移）。
- **原因**：「读档补默认」与「不做迁移、坏档清档」是方向相反的两套旧数据政策；清档政策下字段级兜底大多成为永不触发的死分支。
- **方案组**：
  - **A（推荐）**：统一为「version 不符 → 抛错清档；同 version → 不做字段级兜底」，最贴合纪律 8。
  - B：删 version 抛错、只留 normalize（宽松路线，与 A 互斥）。
  - C：保留现状，但把两政策的触发场景写进一篇文档。
