# docs-824 — 01 文件构成

> 本文回答：**这个仓库有哪些文件，各自负责什么。**
> 定位改哪个功能，先看本文件的「目录 → 职责」映射，再进对应目录按文件名定位。

## 顶层结构

| 路径 | 一句话职责 |
| --- | --- |
| `package.json` / `vite.config.ts` / `vitest.config.ts` / `tsconfig.json` | 工程配置：构建、类型、测试 |
| `index.html` | 游戏宿主页面 |
| `src/` | 全部源码（引擎 + 数据 + UI） |
| `tests/` | vitest 测试（与引擎实现目录基本镜像） |
| `tools/` | 数据包编辑器 / Schema 生成 / 校验脚本 |
| `scripts/` | 开发/构建辅助脚本（`.mjs` / `.mts`） |
| `datapack/` | 可选导入的数据包（JSON，非默认加载） |
| `docs-818/` | 旧版设计文档（当前代码已演进，此处为历史参照） |
| `docs-824/` | 本文档组（横向阅读手册） |

## 引擎核心 `src/engine/`

引擎是纯逻辑层，**不依赖 UI**。分以下子目录：

### `engine/core/` — 横切基础（无领域逻辑）

| 文件                             | 职责                                                        |
| ------------------------------ | --------------------------------------------------------- |
| `event-bus.ts`                 | 全局事件总线：mutation 写状态后广播的通道，也是增量缓存/触发器失效的入口                 |
| `tag.ts`                       | Tag 匹配（`matchesTag`），供强化反向索引与产出查询使用                       |
| `theme-runtime.ts`             | 运行时主题管理器（`RuntimeThemeManager`）：临时演出层恒最高，player/area/student 相对优先级玩家可自定义（`setLayerOrder`） |
| `entity-id.ts` / `resource.ts` | 实体 ID 工厂 / 资源 ID 常量（含 `GLOBAL_RESOURCE_IDS`）              |
| `display-name.ts`              | 显示名解析（角色显示名等）                                             |
| `dev-log.ts`                   | 开发日志（`DevLog`），循环 tick 记录                                 |

### `engine/types/` — 类型定义（**数据结构的唯一事实源**）

> 改字段/枚举前必读；改完必须 `npm run gen:schema` 同步协议。

| 文件 | 职责 |
| --- | --- |
| `state.ts` | `PlayerState` / `GameView` / `SaveData` / `VisibilitySnapshot` / 统计快照 |
| `entities.ts` | re-export 兼容层（聚合 world/content/trigger/datapack，全项目 `from './types'` 公共面不变） |
| `world.ts` | 世界实体：`InitDef` / `AreaDef` / `SpotDef` / `RevealTriggerDef`（自 entities.ts 拆出） |
| `content.ts` | 内容实体：`StoryDef` / `ItemDef` / `DropTableDef` / `EnhancementDef`（自 entities.ts 拆出） |
| `trigger.ts` | 联动实体：`TriggerDef` / `AffectorPackDef` / `EffectDef`（自 entities.ts 拆出） |
| `datapack.ts` | `Datapack` 聚合类型（自 entities.ts 拆出） |
| `character.ts` | Character 重构实体：`CharacterVariantDef` / `ColorDef` / `GachaPoolDef` / `CultivateCurveDef` / `RosterEntry` / `ThemeDef` |
| `expression.ts` | `Value` / `ValueExpression` / `Condition` / `Effect` 等声明式类型 |
| `events.ts` | 事件载荷类型（event bus 的 payload 契约） |
| `extra.ts` | Extra 附加数据树（`ExtraCompound`） |
| `pics.ts` | 图片资产：`PicDef` / 三段式索引解析（`mod:type(pic):id`） |
| `ids.ts` | 各实体的字符串 ID 类型 |
| `results.ts` | 各类结果/视图类型（如 `StoryView` / `GameUIView`） |
| `index.ts` | 类型聚合导出（作为公共 API 面） |

### `engine/registry/` — 数据包注册表

| 文件 | 职责 |
| --- | --- |
| `registry.ts` | `Registry`：持有全部 `Map<id, Def>`；数据加载后的合并产物 |
| `registry-validate.ts` | 加载期引用校验（池成员、差分、曲线、色彩等 id 是否合法） |

### `engine/expression/` — 数值与条件

| 文件 | 职责 |
| --- | --- |
| `value-system.ts` | `ValueSystem`：解析/求值 `ValueExpression`（字面量、res、funclet、属性源） |
| `condition-system.ts` | `ConditionSystem`：求值 `Condition` / `ConditionGroup`（and/or/not、flag、资源、帧数等） |
| `game-num.ts` | `GameNumSystem` 门面：索引/缓存/求值入口（每资源的 primitiveGain 产出树） |
| `game-num-eval.ts` | `evaluateGameNum`：GameNum 树的递归求值实现（含两级缓存） |
| `game-num-build.ts` | GameNum 树构建：`buildAll` / gain 树 / spot 子树 / zone 节点（自 game-num.ts 拆出） |
| `game-num-tag.ts` | GameNum 区表维护：TagEffect 路由 / Affector 桥接 / 脏位传播（自 game-num.ts 拆出） |
| `game-num-internal.ts` | GameNum 内部共享类型（ZoneNode / MulNode / ZoneIndexEntry） |
| `funclet-executor.ts` | Funclet 执行（复用数值片段的运行时求值） |
| `condition-deps.ts` | 条件依赖收集（静态扫描） |
| `stat-dsl.ts` | 统计 DSL（`stat:` 取值路径解析） |

### `engine/effect/` — Effect / Affector / Trigger

| 文件 | 职责 |
| --- | --- |
| `effect-engine.ts` | `EffectEngine`：把 `Effect[]` 应用到状态（转发 `StateMutationService` + 主题/剧情特判） |
| `affector-engine.ts` | `AffectorEngine`：持续效果实例的活跃管理（时间/帧窗口、叠加、移除） |
| `affector-text.ts` | Affector 的文本/描述解析 |
| `trigger-system.ts` | `TriggerSystem`：事件驱动联动；`TriggerDef` 匹配 + once/可重复语义 + 事件分桶 |
| `event-driven-reactor.ts` | 事件驱动响应器（增量缓存失效等） |

### `engine/system/` — 各领域系统（**核心写入口在此**）

| 文件 | 职责 |
| --- | --- |
| `state-mutation-service.ts` | **单一写入口**：全部状态变更基础操作 + 4 步管道（写→统计→emit→订阅） |
| `effect-ops.ts` | Effect 分支执行：`applyEffects`/`applyEffect` 各 op 分发（自 state-mutation-service.ts 拆出） |
| `tick-system.ts` | 每 Tick 的生产结算编排（经 GameNumSystem） |
| `character-system.ts` | Character 系统容器：注册表视图 + 归属层解析 |
| `character-availability.ts` | 可抽取集合（`getDrawable` 世界 Pool 合并） |
| `roster-system.ts` | 通讯录查询（只读）：持有差分/碎片/图鉴/按校分组 |
| `gacha-service.ts` | 抽取模式注册表 + ba-classic 结算（权重 roll + featured + 天井） |
| `cultivate-system.ts` | 培养纯计算：曲线解析 / `applyExp` 推演 / `checkBreakthrough` 校验 |
| `color-system.ts` | 色彩系统：库存查询 / 解锁编排 / HSL 主题派生 |
| `spot-functionality.ts` | Spot 功能项（生产/设施/招募等）注册与查询 |
| `loot-system.ts` | 掉落池结算 |
| `passive-pool-system.ts` | 被动闲聊池（差分并入常驻池） |

### `engine/game/` — 高层门面服务

| 文件 | 职责 |
| --- | --- |
| `init-service.ts` | Init 生命周期：进入/退出/快照保存恢复（委托 init-mount） |
| `init-mount.ts` | `mountInitTriggers` 世界线专属 Trigger 挂载（自 init-service.ts 拆出） |
| `init-savepoint.ts` / `snapshot.ts` | Init 断点快照 / 快照结构 |
| `session-service.ts` | 会话：1 tick/秒 循环、Session 上下文、游玩帧统计 |
| `story-service.ts` | 剧情演出编排门面：游标持有 + 流程编排（委托 flow/jump/replay/rewards） |
| `story-flow.ts` | 剧情主流程：start / advance / clickSend / 被动闲聊 |
| `story-jump.ts` | 剧情跳转链：goto / insert / 返回栈 |
| `story-replay.ts` | 重读 / 分歧守卫 |
| `story-rewards.ts` | 剧情完结奖励结算 |
| `story-cursor-state.ts` | 剧情游标 / 聊天沙盒游标状态 |
| `spot-service.ts` | Spot 操作（生产/设施面板门面） |
| `item-service.ts` | 物品操作 |
| `enhancement-service.ts` | 强化解锁/移除门面 |
| `passive-picker.ts` | 被动闲聊挑选（冷却表 + 剩余池） |
| `page-interaction.ts` | 页面交互（多击进度等） |
| `debug-labels.ts` | 调试标签 |
| `state-factory.ts` | 默认状态构建（`createDefaultState`，自 game-instance.ts 拆出） |
| `view-builder.ts` | `getView` / `createUIContext` 视图组装（自 game-instance.ts 拆出） |
| `save-codec.ts` | 存档序列化/反序列化（自 game-instance.ts 拆出） |
| `runtime-reset.ts` | 运行时重置 / reload（自 game-instance.ts 拆出） |
| `game-instance.ts` | **引擎总装 + 门面**：子系统组装 + API 委托 + tick 编排（见 [[docs-824/02-run-logic]]） |

### `engine/stats/` — 三层统计

| 文件 | 职责 |
| --- | --- |
| `stats.ts` | `StatsService`：global / init / session 三层计数与快照 |
| `stats-counters.ts` | 统计计数器结构（`StatsCounters`） |
| `tag-stats.ts` | Tag 统计（角色收集数等，供条件系统） |
| `world-tilt.ts` | 世界倾斜（world tilt 机制） |

### `engine/visibility/`

| 文件 | 职责 |
| --- | --- |
| `visibility-engine.ts` | 可见性快照：事件驱动增量维护 inits/areas/spots/… 的显隐 |
| `visibility-index.ts` | 可见性反向索引（id → 显隐） |
| `visibility-eval.ts` | 单点显隐判定 |
| `reveal.ts` | 揭示/曝光（新进 Area 揭示） |

### `engine/extra/` — 三层附加数据合并

| 文件 | 职责 |
| --- | --- |
| `extra-core.ts` / `extra-construct.ts` / `extra-merge.ts` | Extra 树结构、构造、三层合并（全局 → per-Init → 数据包常量） |
| `extra-read.ts` / `extra-path.ts` | Extra 读取器 / 路径访问 |
| `extra-validate.ts` | Extra 校验 |

### `engine/image/` — 图片资产（PicDef）

| 文件 | 职责 |
| --- | --- |
| `image-store.ts` | `ImageStore`：压缩包解出图片登记（mod + 包内路径 → data URL） |
| `resolve.ts` | `resolvePicSrc`：三段式索引 / 直连 URL → 可显示 URL（纯函数） |

> 类型与索引约定见 `src/engine/types/pics.ts`；完整方案见 [[docs-824/07-pic-assets]]。

## 默认数据 `src/data/base/`

> **默认加载的是这里（TypeScript），不是 `datapack/` 的 JSON。**

| 文件 | 职责 |
| --- | --- |
| `datapack.ts` | 组合所有定义块，导出默认数据包（可注入 `GameInstance.init()`） |
| `resources.ts` | 资源定义（含全局资源） |
| `spots.ts` / `areas.ts` / `inits.ts` | 地图与场景（Spot / Area / Init） |
| `items.ts` / `enhancements.ts` | 物品 / 强化 |
| `stories.ts` / `stories-play.ts` / `stories-conversation-walls.ts` | 剧情（闲聊墙 / 演出流） |
| `characters.ts` / `character-rework.ts` | 角色（Character 重构的差分/色彩/卡池/培养曲线） |
| `triggers.ts` | 事件联动 Trigger 定义 |
| `drop-tables.ts` | 掉落池 |

> `datapack/`（根目录）是可选的 JSON 导入包，`src/data/zip-loader.ts` 负责 zip 解包加载，不参与默认加载。

## 前端 `src/ui/`

只读消费引擎 `getView()` / `createUIContext()`，不持有写引用。

| 路径 | 职责 |
| --- | --- |
| `main.ts` | UI 启动：建引擎实例、挂循环、渲染入口 |
| `components/` | UI 组件（生产/设施、通讯录、招募、图鉴、聊天、主题色面板等） |
| `components/tooltip.ts` | 提示面板门面：渲染组合（render*Detail / getTooltipContent + re-export 兼容） |
| `components/tooltip-reveal.ts` | 揭示阶段计算：resolveReveal / get*Reveal（自 tooltip.ts 拆出） |
| `components/tooltip-enhancement.ts` | 强化诊断：describeCondition / getSpotYieldBreakdown（自 tooltip.ts 拆出） |
| `controller.ts` | UI 控制器：事件绑定与编排（委托 core/modals/panels 三个模块） |
| `controller-core.ts` | 刷新策略/生命周期：reveal 指纹 / 轻量刷新 / destroy / 面板重置 / 聊天历史持久化（自 controller.ts 拆出） |
| `controller-modals.ts` | 弹层弹窗管理：Gacha / 强化管理（自 controller.ts 拆出） |
| `controller-panels.ts` | 面板桥接：Init 选择 / 详情 CTA / 读档按钮（自 controller.ts 拆出） |
| `context.ts` | UI 上下文（主题 token、当前 Init/Area/Spot） |
| `theme-tree.ts` | 把引擎运行时主题 token 落成 CSS 变量 |
| `chat-stream.ts` | 聊天流打字机/滚动 |
| `player.ts` / `modal.ts` / `popovers.ts` / `scroll.ts` | 玩家视图 / 弹窗 / 气泡 / 滚动 |
| `components/selector-page.ts` | 选择页整页渲染（Init ⇄ GlobalEnhancement 左右滑动、共享一圆） |
| `selector-page.ts` | 选择页交互：双轮盘装配、翻面/滑动、详情局部刷新（自 init-select-page.ts 演进） |
| `import-export.ts` | 存档导入/导出 |

## 脚本与工具

| 路径 | 职责 |
| --- | --- |
| `npm run dev` / `dev:game` | 引擎 / UI 开发服务器 |
| `npm test` | vitest |
| `npm run gen:schema` | `src/engine/types/**` → `tools/datapack-editor/schema/engine-defs.gen.json` |
| `npm run build` | 构建 |

## 阅读顺序建议

1. 先读 [[docs-824/02-run-logic]] 建立主干时序；
2. 改数据结构读 [[docs-824/03-data-structures]] + `src/engine/types/**`；
3. 写联动逻辑读 [[docs-824/04-core-algorithms]] 的 Trigger/Affector 部分；
4. 定位文件用本文件的映射表。
