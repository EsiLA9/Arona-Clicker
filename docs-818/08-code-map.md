# 08 — Code Map 代码地图

> 改某个功能先查这里：找到对应文件与入口，再打开该文件。

---

## src/engine/types/ — 共享类型

| 文件 | 内容 |
|------|------|
| [[src/engine/types/index.ts]] | 汇总 re-export（全项目 `from './types'` 兼容） |
| [[src/engine/types/ids.ts]] | ID 类型、Resource/Character 枚举、全局资源标识 |
| [[src/engine/types/extra.ts]] | ExtraValue / ExtraCompound / ExtraPath |
| [[src/engine/types/expression.ts]] | Value / ValueExpression / Condition / Effect / FuncletDef（含构造器） |
| [[src/engine/types/entities.ts]] | 数据包实体定义（Init/Area/Spot/Enhancement/Story/Item/Trigger/Affector/Datapack 等） |
| [[src/engine/types/state.ts]] | PlayerState / InitSnapshot / 统计 / GameView / VisibilitySnapshot |
| [[src/engine/types/results.ts]] | 各操作返回结果 / StoryView / SendState / SendResult |
| [[src/engine/types/events.ts]] | GameEvent / EventHandler |

---

## src/engine/game/ — GameInstance 拆出的领域服务

| 文件 | 行数 | 职责 | 关键入口 |
|------|------|------|----------|
| [[src/engine/game/story-service.ts]] | ~680 | 剧情游标 + 启动/推进/发送/跳转链/重阅读/守卫/完结奖励 | `startStory` / `replayStory` / `triggerPassiveStory` / `advanceStory` / `clickSend` / `getSendState` / `saveCursor` / `restoreCursor` / `isBlockingMovement` / `clearPassiveIfPlaying` |
| [[src/engine/game/spot-service.ts]] | ~262 | Spot 购买/升级/管理/产出/等级上限/Tag | `upgradeSpot` / `unlockSpot` / `assignManager` / `getSpotYield` / `getEffectiveMaxLevel` / `addSpotTag` / `removeSpotTag` |
| [[src/engine/game/init-service.ts]] | ~436 | 世界线生命周期/区域移动/购买/专属 Trigger 挂载；快照操作委托 init-savepoint | `enterInit` / `travelToArea` / `restartInit` / `resumeInit` / `hardRestartInit` / `purchaseInit` / `mountInitTriggers` |
| [[src/engine/game/init-savepoint.ts]] | ~81 | per-Init 快照纯状态操作（保存/恢复/清除/播种；global Spot 属全局层不进快照） | `save` / `clear` / `restore` / `seed` |
| [[src/engine/game/item-service.ts]] | ~73 | 物品发放/使用/掉落表发放 | `giveItem` / `useItem` / `rollDropTable` |
| [[src/engine/game/enhancement-service.ts]] | ~132 | 强化购买/移除/条件诊断 dump | `purchaseEnhancement` / `removeEnhancement` / `dumpEnhancementDebug` |
| [[src/engine/game/session-service.ts]] | ~100 | 帧循环状态机（running/interval/lastTick）+ 离线收益补算（8h 上限） | `start` / `stop` / `running` / `touchLastTick` / `setLastTick` |
| [[src/engine/game/snapshot.ts]] | ~43 | per-Init 状态/快照纯函数 | `freshPerInitState` / `globalSpotEntries` / `localSpotEntries` |
| [[src/engine/game/page-interaction.ts]] | ~38 | Talklet 交互/回显纯谓词 | `isInteractivePage` / `shouldEchoReply` / `rollClickWorkTotal` |
| [[src/engine/game/passive-picker.ts]] | ~40 | 被动闲聊候选筛 + 权重抽选 | `eligiblePassiveStories` / `pickPassiveStory` |
| [[src/engine/game/debug-labels.ts]] | ~35 | 揭示条件 → 简短文本（debug 展示） | `condLabel` / `triggerLabel` |

---

## src/engine/ — 引擎子系统

| 文件 | 行数 | 职责 | 关键入口 |
|------|------|------|----------|
| [[src/engine/game-instance.ts]] | ~758 | **门面 + 总装**：子系统组装、tick、世界线/存档、Extra API；剧情/Spot/世界线/物品/强化/帧循环委托给 game/ 服务 | `init` / `start` / `tick` / `save` / `load` / `enterInit` / `travelToArea` / `startNewGame` / `restartInit` / `resumeInit` / `hardRestartInit` / `purchaseEnhancement` / `reload` |
| [[src/engine/event-bus.ts]] | 83 | 事件总线（订阅/派发/排队） | `on` / `onAny` / `emit` / `flush` |
| [[src/engine/registry.ts]] | ~261 | 注册表：主存储 + 关系索引 + 合并；静态校验拆至 registry-validate | `load` / `clear` / `spotsWithTag` / `areasOfInit` / `spotsOfInit` / `addSpotTag` |
| [[src/engine/registry-validate.ts]] | ~139 | 数据包静态校验纯函数（ID 唯一/引用完整/Extra 合法） | `validateDatapack` / `RegistryError` |
| [[src/engine/state-mutation-service.ts]] | ~297 | **唯一状态写入口**（写→统计→事件管道） | `changeResource` / `setSpotLevel` / `addEnhancement` / `addItem` / `applyEffects` |
| [[src/engine/value-system.ts]] | 98 | ValueExpression 求值 | `evaluate` / `evaluateValue` |
| [[src/engine/condition-system.ts]] | 126 | Condition/ConditionGroup 求值 | `evaluate` / `evaluateGroup` / `evaluateExpr` + 各 setter |
| [[src/engine/effect-engine.ts]] | 38 | 效果执行（先求值表达式） | `applyEffects` |
| [[src/engine/game-num.ts]] | ~213 | 统一数值注册 + 索引/缓存生命周期（产出主路径） | `buildAll` / `evaluateResourceGain` / `evaluateSpotYield` |
| [[src/engine/game-num-eval.ts]] | ~140 | GameNum 节点纯求值（类型 + evaluateGameNum + affector 流） | `evaluateGameNum` / `GameNum` |
| [[src/engine/tick-system.ts]] | 127 | 帧推进（1s/帧） | `tick` |
| [[src/engine/affector-engine.ts]] | ~280 | 持续效果生命周期 + 等级上限覆盖 + Spot 功能挂载 | `mount` / `unmount` / `recheckAll` / `applyActiveEffects` / `getSpotMaxLevelOverrides` |
| [[src/engine/trigger-system.ts]] | 132 | Trigger DSL 桥接（事件→条件→执行） | `mount` / `unmountGroup` / `load` / `clear` |
| [[src/engine/visibility-engine.ts]] | ~119 | 可见性编排层（快照持有 + 增量 dirty 标记 + 对外 API） | `rebuild` / `getVisibility` / `recomputeAll` / `isAreaVisible` / `isSpotVisible` |
| [[src/engine/visibility-index.ts]] | ~202 | 「事件 → 受影响实体」反向索引构建与标脏收集 | `build` / `collectAffected` |
| [[src/engine/visibility-eval.ts]] | ~93 | 可见性求值（existenceMet 桥接 + 整类重算）+ 共享类型 | `evaluateEntity` / `recomputeCategory` / `EntityKind` |
| [[src/engine/reveal.ts]] | 68 | 揭示纯函数 | `existenceMet` / `unlockMet` / `existenceCondition` |
| [[src/engine/loot-system.ts]] | 79 | 掉落表抽选 | `roll` / `rollTable` |
| [[src/engine/character-system.ts]] | 114 | 角色数据/标签加成/解锁 | `getTagBonus` / `getUnlocked` / `getAssignable` |
| [[src/engine/spot-functionality.ts]] | 65 | Spot 内源+外源功能 | `functionalitiesOf` / `extraYields` |
| [[src/engine/stats.ts]] | ~262 | 三层统计服务（record 钩子 + DSL 求值 + 持久化） | `recordXxx` / `getSnapshot` / `evaluate` / `restore` |
| [[src/engine/stats-counters.ts]] | ~66 | 计数器纯函数（构造/复制/增长/空快照） | `bump` / `emptyCounters` / `copyCounters` / `freshSnapshot` |
| [[src/engine/stat-dsl.ts]] | 91 | 统计查询 DSL 函数库 | `parseStatCall` |
| [[src/engine/extra.ts]] | 15 | Extra 聚合出口（re-export，全项目兼容） | — |
| [[src/engine/extra-core.ts]] | ~46 | Extra 底座：常量/ExtraError/变体守卫/便捷构造器/dict key 校验 | `extra` / `ExtraError` / `isDict` … |
| [[src/engine/extra-construct.ts]] | ~56 | fromJson 宽松转换 + 深克隆 | `extraFromJson` / `cloneExtra` |
| [[src/engine/extra-path.ts]] | ~125 | 路径解析与寻址 | `parseExtraPath` / `getAtPath` / `setAtPath` / `deleteAtPath` |
| [[src/engine/extra-merge.ts]] | ~63 | 深合并 + 扁平键展开 | `mergeExtra` / `expandFlatKeys` |
| [[src/engine/extra-read.ts]] | ~43 | 宽松读取（缺失即默认） | `toNumber` / `readNumber` / `readString` / `readBool` |
| [[src/engine/extra-validate.ts]] | ~61 | 校验（收集错误 / 首错即抛） | `validateExtraValue` / `assertValidExtra` |
| [[src/engine/dev-log.ts]] | ~196 | 运行时日志 | `record` / `recordEvent` / `recordTick` / `export` |
| [[src/engine/tag.ts]] | 40 | 层级标签（TagPath）与匹配 | `tagPath` / `matchesTag` / `tagDisplay` |
| [[src/engine/entity-id.ts]] | 22 | 三段式实体 ID | `entityId` / `parseEntityId` |
| [[src/engine/resource.ts]] | 23 | 资源 ID/展示名 | `resourceId` / `resourceLabel` |
| [[src/engine/display-name.ts]] | 52 | 三段式 ID → 可读名 | `displayName` |
| [[src/engine/funclet-executor.ts]] | 44 | Funclet 执行器 | `execute` |

---

## src/ui/ — UI 层

| 文件 | 行数 | 职责 |
|------|------|------|
| [[src/ui/main.ts]] | 18 | UI 入口（建 GameInstance + UIController） |
| [[src/ui/controller.ts]] | ~780 | **集成门面**：事件绑定、刷新策略（轻量/重建）、弹层/弹窗；聊天流/滚动/选择页/IO 委托给下方模块 |
| [[src/ui/chat-stream.ts]] | ~100 | 聊天流领域逻辑：ID 计数、剧情指纹去重、活跃流路由、剧情/回复/过渡页同步（`ChatStream`） |
| [[src/ui/scroll.ts]] | ~110 | 聊天流 / 面板滚动状态：重建 DOM 前后按比例捕获与恢复（`ScrollManager`） |
| [[src/ui/init-select-page.ts]] | ~200 | 世界线选择页轮盘交互：装配、聚焦旋转、局部刷新（`InitSelectPage`） |
| [[src/ui/import-export.ts]] | ~90 | 数据包导入（zip→Datapack→reload）与日志导出（`ImportExportService`） |
| [[src/ui/context.ts]] | 37 | `UIContext`（view + 格式化 + displayName），UI 渲染的只读上下文 |
| [[src/ui/popovers.ts]] | ~114 | 悬浮详情弹层（body 级、事件委托 + 防抖，一次绑定跨 DOM 重建） |
| [[src/ui/player.ts]] | 20 | 玩家（老师）聊天身份单一来源（`PLAYER_IDENTITY`） |
| [[src/ui/styles.css]] | ~99 行（minified） | 全部样式 |
| [[src/ui/modal.ts]] | ~100 | 通用弹窗母版 |

### 组件

| 文件 | 职责 |
|------|------|
| [[src/ui/components/app-shell.ts]] | 主布局（header + 三面板） |
| [[src/ui/components/header.ts]] | 顶栏 + 资源条 |
| [[src/ui/components/rail.ts]] | 左侧栏（Area / 世界线 / 故事） |
| [[src/ui/components/center-panel.ts]] | 中间面板（聊天 / 日志） |
| [[src/ui/components/right-panels.ts]] | 右侧面板（设施 / 强化 / 其他） |
| [[src/ui/components/production.ts]] | 设施卡片渲染 |
| [[src/ui/components/enhancements.ts]] | 强化购买/管理 |
| [[src/ui/components/collection.ts]] | 图鉴正文渲染（闲聊池树 + 色彩收集） |
| [[src/ui/components/collection-modal.ts]] | 图鉴弹窗：收集类型 Switch（闲聊 / 色彩）切换 |
| [[src/ui/components/story.ts]] | 聊天流/剧情对话 |
| [[src/ui/components/tooltip.ts]] | 揭示阶段计算 + tooltip 内容 |
| [[src/ui/components/init-select.ts]] | 世界线选择页 |
| [[src/ui/components/tabs.ts]] | Tab 按钮组 |
| [[src/ui/components/toast.ts]] | 全局 Toast 通知 |
| [[src/ui/components/errors.ts]] | 操作错误码文案 |

---

## src/data/ — 基础数据包

| 文件 | 职责 |
|------|------|
| [[src/data/index.ts]] | 导出 `baseDatapack` |
| [[src/data/base/datapack.ts]] | 聚合全部列表为一个 Datapack（含 extras 常量表示例） |
| [[src/data/base/inits.ts]] | 世界线定义（5 条） |
| [[src/data/base/areas.ts]] | 区域定义（12 个） |
| [[src/data/base/spots.ts]] | 设施定义（20+ 个） |
| [[src/data/base/enhancements.ts]] | 强化定义（12 个） |
| [[src/data/base/stories.ts]] | 剧情定义（20 条） |
| [[src/data/base/items.ts]] | 物品定义（12 个） |
| [[src/data/base/drop-tables.ts]] | 掉落表定义（5 个） |
| [[src/data/base/characters.ts]] | 角色定义（28 个） |
| [[src/data/base/triggers.ts]] | Trigger 定义（8 个） |
| [[src/data/base/resources.ts]] | 资源 ID 常量 |
| [[src/data/zip-loader.ts]] | Mod 压缩包 → Datapack（多文件分片合并） |

---

## 其他

| 路径 | 职责 |
|------|------|
| [[tests/]] | **全部 src 测试**（vitest）：目录镜像 `src/`（`tests/engine/…`、`tests/ui/…`）；`tools/datapack-editor` 的测试保留在其模块内 |
| [[src/save/storage.ts]] | localStorage 存档 |
| [[tools/datapack-editor/]] | 独立数据包编辑器 |
| [[tools/datapack-editor/schema/engine-defs.ts]] | Schema 协议 TS 形状 + JSON 加载 |
| [[tools/datapack-editor/schema/editor-extras.ts]] | 13 表 `TABLE_META` + overrides + stories/extras 整表兜底（复杂字段运行时构建） |
| [[tools/datapack-editor/schema/merge.ts]] | `buildTables()`：生成 defs ⊕ editor-extras 拼合 |
| [[tools/datapack-editor/schema/engine-schema.sync.test.ts]] | 引擎类型↔协议↔editor 表三向一致检查 |
| [[scripts/gen-engine-schema.mjs]] | 生成 Schema 描述协议（`npm run gen:schema` → `engine-defs.gen.json`） |
| [[scripts/pack-arona-clicker-core.mjs]] | 打包基础数据包 zip |
| [[datapack/]] | 打包好的数据包 zip + 分片 JSON |

---

## 常用调试入口

- `window.__game`（引擎实例，直接调任意 API）
- `window.__ui`（控制器）
- `Ctrl+Shift+D`：Enhancement 揭示条件诊断写入 devLog
- devLog 导出：UI 按钮 → 下载 JSON
