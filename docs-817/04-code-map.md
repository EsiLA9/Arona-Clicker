# 04 — 代码地图（Code Map）

> 改某个功能先查这里：找到对应文件与入口，再打开该文件。
> 行号随代码演变会偏移，但文件与职责是稳定的。

## src/engine/ — 引擎核心

> 2026-08 重构：`types.ts` 已拆至 `types/` 文件夹（`index.ts` re-export，`./types` 导入兼容）；
> `game-instance.ts` 的剧情 / Spot 逻辑已拆至 `game/` 服务，`GameInstance` 保持为门面（公开 API 不变）。

### src/engine/types/ — 共享类型（拆分后）

| 文件 | 内容 |
|------|------|
| `index.ts` | 汇总 re-export（全项目 `from './types'` 兼容） |
| `ids.ts` | ID 类型、Resource/Character 枚举、全局资源标识 |
| `extra.ts` | ExtraValue / ExtraCompound / ExtraPath |
| `expression.ts` | Value / ValueExpression / Condition / Effect / FuncletDef（含构造器） |
| `entities.ts` | 数据包实体定义（Init/Area/Spot/Enhancement/Story/Item/Trigger/Affector/Datapack 等） |
| `state.ts` | PlayerState / InitSnapshot / 统计 / GameView / VisibilitySnapshot |
| `results.ts` | 各操作返回结果 / StoryView / SendState / SendResult |
| `events.ts` | GameEvent / EventHandler |

### src/engine/game/ — GameInstance 拆出的领域服务

| 文件 | 行数 | 职责 | 关键入口 |
|------|------|------|----------|
| `story-service.ts` | ~346 | 剧情游标 + 启动/推进/发送流程 | `startStory/triggerPassiveStory/advanceStory/clickSend/getSendState/saveCursor/restoreCursor/isBlockingMovement/clearPassiveIfPlaying` |
| `spot-service.ts` | ~230 | Spot 购买/升级/管理/产出/等级上限/Tag | `upgradeSpot/unlockSpot/assignManager/getSpotYield/getEffectiveMaxLevel/addSpotTag/removeSpotTag` |
| `snapshot.ts` | ~40 | per-Init 状态/快照纯函数 | `freshPerInitState/globalSpotEntries/localSpotEntries` |
| `debug-labels.ts` | ~40 | 揭示条件 → 简短文本（debug 展示） | `condLabel/triggerLabel` |

### src/engine/ — 其余子系统（原位）

| 文件 | 行数 | 职责 | 关键入口 |
|------|------|------|----------|
| `game-instance.ts` | ~1155 | **门面 + 总装**：子系统组装、tick、世界线/强化/物品/存档、Extra API；剧情与 Spot 逻辑委托给 game/ 服务 | `init/start/tick/save/load/enterInit/travelToArea/startNewGame/restartInit/resumeInit/hardRestartInit/purchaseEnhancement/reload` |
| `event-bus.ts` | 83 | 事件总线（订阅/派发/排队） | `on/onAny/emit/flush` |
| `registry.ts` | ~292 | 数据包校验 + 合并 + 关系索引 | `load/clear/spotsWithTag/areasOfInit/spotsOfInit/addSpotTag` |
| `state-mutation-service.ts` | ~245 | **唯一状态写入口**（写→统计→事件管道） | `changeResource/setSpotLevel/addEnhancement/addItem/applyEffects` |
| `value-system.ts` | 98 | ValueExpression 求值 | `evaluate/evaluateValue` |
| `condition-system.ts` | 126 | Condition/ConditionGroup 求值 | `evaluate/evaluateGroup/evaluateExpr` + 各 setter |
| `effect-engine.ts` | 38 | 效果执行（先求值表达式） | `applyEffects` |
| `game-num.ts` | 241 | 统一数值注册 + 懒求值（产出主路径） | `buildAll/evaluateResourceGain/evaluateSpotYield` |
| `tick-system.ts` | 127 | 帧推进（1s/帧） | `tick` |
| `affector-engine.ts` | ~253 | 持续效果生命周期 + 等级上限覆盖 + Spot 功能挂载 | `mount/unmount/recheckAll/applyActiveEffects/getSpotMaxLevelOverrides` |
| `trigger-system.ts` | 132 | Trigger DSL 桥接（事件→条件→执行） | `mount/unmountGroup/load/clear` |
| `visibility-engine.ts` | 103 | 可见性快照 | `compute/isAreaVisible/isSpotVisible` |
| `reveal.ts` | 68 | 揭示纯函数 | `existenceMet/unlockMet/existenceCondition` |
| `loot-system.ts` | 79 | 掉落表抽选 | `roll/rollTable` |
| `character-system.ts` | 114 | 角色数据/标签加成/解锁 | `getTagBonus/getUnlocked/getAssignable` |
| `spot-functionality.ts` | 65 | Spot 内源+外源功能 | `functionalitiesOf/extraYields` |
| `stats.ts` | ~283 | 三层统计 + DSL 求值 | `recordXxx/getSnapshot/evaluate/restore` |
| `stat-dsl.ts` | 91 | 统计查询 DSL 函数库 | `parseStatCall` |
| `extra.ts` | ~338 | Extra 树：构造/路径/合并/校验 | `getAtPath/setAtPath/mergeExtra/expandFlatKeys/toNumber` |
| `dev-log.ts` | ~196 | 运行时日志 | `record/recordEvent/recordTick/export` |
| `tag.ts` | 40 | 层级标签（TagPath）与匹配 | `tagPath/matchesTag/tagDisplay` |
| `entity-id.ts` | 22 | 三段式实体 ID | `entityId/parseEntityId` |
| `resource.ts` | 23 | 资源 ID/展示名 | `resourceId/resourceLabel` |
| `display-name.ts` | 52 | 三段式 ID → 可读名 | `displayName` |

## src/ui/ — UI 层

| 文件 | 行数 | 职责 |
|------|------|------|
| `main.ts` | 18 | UI 入口（建 GameInstance + UIController） |
| `controller.ts` | ~712 | 事件绑定、刷新策略（轻量/重建）、聊天流、tooltip、导入 Mod、日志导出 |
| `context.ts` | 37 | `UIContext`（view + 格式化 + displayName），UI 渲染的只读上下文 |
| `styles.css` | ~27k 字节 | 全部样式 |
| `components/app-shell.ts` | 899 | 主布局（header + 三面板） |
| `components/rail.ts` | ~8.7k | 侧栏（Area / 世界线）渲染 |
| `components/tooltip.ts` | ~28k | **揭示阶段计算 + tooltip 内容**（getSpotReveal/getEnhancementReveal/getInitReveal 等，UI 侧揭示逻辑都在这里） |
| `components/init-select.ts` | ~6.6k | 世界线选择页 |
| `components/center-panel.ts` / `production.ts` / `story.ts` / `enhancements.ts` / `right-panels.ts` / `header.ts` / `tabs.ts` / `toast.ts` / `errors.ts` | — | 各面板/聊天/强化管理/Toast/错误文案 |
| `modal.ts` | ~3.3k | 通用弹窗母版 |

## src/data/ — 基础数据包（TS 常量）

| 文件 | 职责 |
|------|------|
| `index.ts` | 导出 `baseDatapack` |
| `base/datapack.ts` | 聚合全部列表为一个 Datapack（含 extras 常量表示例） |
| `base/inits.ts` `areas.ts` `spots.ts` `stories.ts` `items.ts` `enhancements.ts` `drop-tables.ts` `triggers.ts` `characters.ts` | 各实体常量（可直接套用写法） |
| `zip-loader.ts` | Mod 压缩包 → Datapack（多文件分片合并） |

## 其它

| 路径 | 职责 |
|------|------|
| `src/save/storage.ts` | localStorage 存档 |
| `tools/datapack-editor/` | 独立数据包编辑器（model/schema/ui/validate） |
| `scripts/gen-datapack-schema.mjs` | 生成 JSON Schema（`npm run gen:schema`） |
| `scripts/pack-arona-clicker-core.mjs` | 把基础数据包打包成 zip |
| `datapack/` | 打包好的数据包 zip + 分片 JSON |
| `docs/` `docs-new/` | 历史设计文档（docs-817 为最新浓缩） |
| `Outdated/` | 废弃原型（AronaClicker/AronaClickerLite/AronaClickerPM），勿动 |

## 常用调试入口

- `window.__game`（引擎实例，直接调任意 API）、`window.__ui`（控制器）
- `Ctrl+Shift+D`：Enhancement 揭示条件诊断写入 devLog
- devLog 导出：UI 按钮 → 下载 JSON
