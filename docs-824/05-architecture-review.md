# docs-824 — 05 架构诊断基线

> 本文记录 ACProgram 引擎的架构体检结果，作为拆分重构的**基线参照**。所有数据以 `main` 分支代码为准，重构后本文不再更新——后续增量问题应记录在 `06-refactoring-guide.md` 的惯例中。

> **进展标注（2026-08）**：基线中三个 UI 大文件已完成拆分，当前实际结构以 `01-file-composition.md` 为准：
> - `ui/controller.ts`（967 行）→ 385 行门面，另拆出 controller-events / controller-theme / controller-save / controller-actions-{topbar,contacts,theme,story,inventory}
> - `ui/components/tooltip.ts`（787 行）→ 门面 + tooltip-detail-{area,spot,enh,init,item,resource,codex}（共享基础并入 tooltip-reveal）
> - `src/ui/styles.css`（未入基线，3785 行）→ 拆为 `css/` 下 16 个主题分区文件（区块顺序与原文件一致）

## 诊断方法

- **工具**：LSP `documentSymbol` 分析每个文件的符号边界与行号范围
- **指标**：文件行数 > 300 行视为"偏大"，> 500 行视为"危险信号"
- **范围**：`src/engine/`（71 文件，~12,173 行）+ `src/ui/`（28 文件，~4,900 行）

## 大文件总览

按行数降序，列出所有超 300 行的文件：

| # | 文件 | 行数 | 区域 | 严重度 | 切割建议 |
|---|------|------|------|--------|----------|
| 1 | `types/entities.ts` | 959 | 引擎-类型 | 🔴 危险 | 按领域拆为 world/content/trigger/datapack |
| 2 | `ui/controller.ts` | 967 | UI | 🔴 危险 | 拆为 core/modals/panels |
| 3 | `game-instance.ts` | 915 | 引擎-门面 | 🔴 危险 | 拆出 state-factory/view-builder/save-codec/runtime-reset |
| 4 | `game/story-service.ts` | 780 | 引擎-服务 | 🔴 危险 | 拆出 flow/jump/replay/rewards |
| 5 | `ui/components/tooltip.ts` | 787 | UI | 🔴 危险 | 拆出 reveal/enhancement |
| 6 | `expression/game-num.ts` | 672 | 引擎-数值 | 🟡 偏大 | 拆出 build/tag |
| 7 | `system/state-mutation-service.ts` | 534 | 引擎-系统 | 🟡 偏大 | 拆出 effect-ops |
| 8 | `game/init-service.ts` | 437 | 引擎-服务 | 🟡 偏大 | 拆出 init-mount |
| 9 | `expression/game-num-eval.ts` | 418 | 引擎-数值 | 🟡 偏大 | 保持纯求值不变 |
| 10 | `registry/registry.ts` | 372 | 引擎-注册表 | 🟡 偏大 | 暂不拆分 |
| 11 | `types/character.ts` | 371 | 引擎-类型 | 🟡 偏大 | 暂不拆分 |
| 12 | `effect/affector-engine.ts` | 340 | 引擎-效果 | 🟡 偏大 | 暂不拆分 |
| 13 | `system/color-system.ts` | 328 | 引擎-系统 | 🟡 偏大 | 暂不拆分 |

## 各文件详细分析

### 1. `types/entities.ts` — 959 行

**问题**：所有实体 `*Def` 类型堆在一个文件中，横跨 6 个以上领域。

**符号分布**：

| 行号范围 | 符号 | 领域 |
|-----------|------|------|
| ~1-120 | 导入/基础工具类型 | 基础设施 |
| ~121-250 | 枚举（RevealStage/RevealTriggerKind/AreaKind/SpotKind/ItemKind/ItemRarity/EnhancementScope/EnhancementSource/ExpItemKind/StoryKind/StoryCursorState/PageInteractionKind/StoryTalkletKind/...） | 跨领域 |
| ~251-350 | InitDef / AreaDef / SpotDef / RevealTriggerDef | **world** |
| ~351-550 | StoryDef / ItemDef / DropTableDef / EnhancementDef | **content** |
| ~551-750 | TriggerDef / AffectorPackDef / 条件谓词类型 | **trigger** |
| ~751-959 | Datapack 聚合类型 / 导出 | **datapack** |

**依赖关系**：被全项目 50+ 文件引用。拆分为 re-export 兼容层后，外部导入 `from './types'` 不受影响。

**建议切割点**：
- `world.ts`：InitDef / AreaDef / SpotDef / RevealTriggerDef + 相关枚举
- `content.ts`：StoryDef / ItemDef / DropTableDef / EnhancementDef + 相关枚举
- `trigger.ts`：TriggerDef / AffectorPackDef + 条件谓词类型
- `datapack.ts`：Datapack 聚合类型
- `entities.ts`：降为 re-export 兼容层

---

### 2. `ui/controller.ts` — 967 行

**问题**：UI 层上帝控制器，混合了事件绑定、刷新策略、弹窗管理、面板桥接等 4 个以上职责。

**符号分布**：

| 行号范围 | 符号 | 职责 |
|-----------|------|------|
| 37-77 | 构造函数 + 生命周期钩子 | 属性声明 |
| 77-101 | constructor 内部闭包 | 绑定初始化 |
| 102-165 | mount() | 事件订阅 + 定时器 |
| 166-213 | destroy() / computeRevealFingerprint() / refreshRevealIfChanged() / refreshLight() | **刷新策略** |
| 214-277 | render() / renderInitSelect() / replaceInitDetail() | **渲染** |
| 278-355 | applyTheme() / initSelectMode() / bindDetailActions() | 面板桥接 |
| 356-441 | resetSessionPanel() / trimHistory() / restoreHistories() / withHistories() | 历史管理 |
| 442-497 | startNewGame() / resumeInit() / activeStream() | **世界线操作** |
| 498-863 | bindActions() 及其内部大量闭包 | **事件绑定**（占 365 行） |
| 864-945 | logStoryFailure() / openGachaModal() / openSpotGachaModal() / openEnhancementManager() | **弹窗** |
| 945-967 | bindGachaButtons() | 卡池按钮 |

**耦合关系**：依赖 game-instance、registry、tooltip 等引擎模块，以及大量 DOM 操作。

**建议切割点**：
- `controller-core.ts`：刷新策略(refreshLight/reveal)、生命周期(mount/destroy)、渲染(render)
- `controller-modals.ts`：openGachaModal / openSpotGachaModal / openEnhancementManager
- `controller-panels.ts`：applyTheme / initSelectMode / resetSessionPanel / restoreHistories
- `controller.ts`：保留构造函数 + bindActions 事件绑定编排

---

### 3. `game-instance.ts` — 915 行

**问题**：引擎上帝类，混合了子系统组装、世界线生命周期、tick 编排、存档、视图、状态重置等 6 个以上职责。

**符号分布**：

| 行号范围 | 符号 | 职责 |
|-----------|------|------|
| ~1-50 | 导入 | 依赖 |
| ~51-120 | 属性声明 | 所有子系统引用 |
| ~121-250 | constructor | 子系统组装/di |
| ~251-300 | startNewGame() / createDefaultState() | **默认状态构建** |
| ~301-400 | enterInit() / resumeInit() / hardRestartInit() / purchaseInit() | 世界线生命周期 |
| ~401-500 | tick() / tickOnce() | **tick 编排** |
| ~501-600 | save() / load() | **存档编解码** |
| ~601-700 | getView() / createUIContext() | **视图组装** |
| ~701-800 | resetRuntime() / reload() | **状态重置** |
| ~801-915 | 各种 Extra API / get/setExtra / 工具方法 | 杂项门面 |

**耦合关系**：依赖全部 17+ 子系统，是引擎的"中枢神经"。拆出部分不会影响 tick 热路径。

**建议切割点**：
- `game/state-factory.ts`：createDefaultState() 纯函数
- `game/view-builder.ts`：getView() / createUIContext() 视图组装
- `game/save-codec.ts`：save() / load() 序列化
- `game/runtime-reset.ts`：resetRuntime() / reload() 重置

---

### 4. `game/story-service.ts` — 780 行

**问题**：剧情服务混合了 5 个独立职责，且跳转逻辑（goto/insert）与重读/守卫逻辑之间有数据依赖但行为独立。

**符号分布**：

| 行号范围 | 符号 | 职责 |
|-----------|------|------|
| ~1-50 | 导入/属性 | 游标 + 状态引用 |
| ~51-200 | startStory() / advanceStory() / clickSend() | **主流程** |
| ~201-380 | goto() / insert() / 返回栈 | **跳转链** |
| ~381-500 | 重读 / 守卫 / 分歧 | **重阅读** |
| ~501-650 | 完结奖励结算 | **奖励** |
| ~651-780 | saveCursor() / restoreCursor() / 辅助 | 游标持久化 |

**建议切割点**：
- `story-flow.ts`：startStory / advanceStory / clickSend
- `story-jump.ts`：goto / insert / 返回栈管理
- `story-replay.ts`：重读 / 分歧守卫
- `story-rewards.ts`：完结奖励结算
- `story-service.ts`：保留游标持有 + 编排（委托给子模块）

---

### 5. `ui/components/tooltip.ts` — 787 行

**问题**：tooltip 组件混合了揭示阶段计算、强化诊断、渲染等 3 类职责。

**符号分布**：

| 行号范围 | 符号 | 职责 |
|-----------|------|------|
| ~1-36 | RevealLevel / 常量 | 揭示等级定义 |
| ~37-61 | renderRevealTriggers / conditionMet | 揭示触发渲染 |
| ~62-180 | resolveRevealTriggers / resolveReveal / get*Reveal 系列 | **揭示阶段计算** |
| ~181-275 | STAT_TEXT / describeStatDsl / describeConditionItem / describeCondition | 统计 DSL 描述 |
| ~276-300 | getEnhancementMultiplier / getSpotYieldBreakdown / YieldBreakdown | **强化倍率计算** |
| ~301-673 | renderAreaDetail / renderSpotDetail / renderResourceDetail / renderEnhancementDetail / renderInitDetail / renderItemDetail | **渲染函数** |
| ~674-787 | getTooltipContent / renderPoolDetail / renderPassiveEntryDetail / summarizeEffects | 入口调度 + 杂项 |

**建议切割点**：
- `tooltip-reveal.ts`：resolveRevealTriggers / resolveReveal / get*Reveal 系列 / conditionMet
- `tooltip-enhancement.ts`：getEnhancementMultiplier / getSpotYieldBreakdown / YieldBreakdown / 强化诊断
- `tooltip.ts`：保留渲染函数 + getTooltipContent 入口调度

---

### 6. `expression/game-num.ts` — 672 行

**问题**：数值系统混合了 gain 树构建、懒求值注册表、溯源分解、tag 效果维护、Affector 桥接 5 个职责，但与 game-num-eval.ts 的职责边界模糊。

**符号分布**：

| 行号范围 | 符号 | 职责 |
|-----------|------|------|
| ~1-80 | 导入/属性/类型 | 注册表 + 缓存 |
| ~81-250 | buildAll() / 树构建 | **gain 树构建** |
| ~251-380 | evaluate() / 懒求值 | **求值**（与 game-num-eval 重叠） |
| ~381-500 | getNamedValue() / 命名数值 | **注册表门面** |
| ~501-600 | 溯源分解 / tag 效果查询 | **tag 维护** |
| ~601-672 | Affector 桥接 / 辅助 | **Affector 桥接** |

**建议切割点**：
- `game-num-build.ts`：buildAll() / 树构建逻辑
- `game-num-tag.ts`：tag 效果维护 / Affector 桥接
- `game-num.ts`：保留 evaluate() / getNamedValue() / 注册表 / 缓存

==new== **执行状态（taskProduction 后回填）**：切割已完成——`game-num-build.ts` / `game-num-tag.ts` / `game-num-internal.ts` 拆出，`game-num.ts` 收敛为门面（构造注入 + 事件订阅 + 求值入口）。`getNamedValue()` / 命名数值注册表（named）已于 Phase 7 作为死代码删除，门面不再保留注册表职责。本节行号与符号分布为诊断时点基线，保留原文不改。

---

### 7. `system/state-mutation-service.ts` — 534 行

**问题**：单一写入口，职责清晰，但方法过多（30+ 公开方法）。applyEffects 的 op 分支可独立。

**符号分布**：

| 行号范围 | 符号 | 职责 |
|-----------|------|------|
| 36-50 | 构造函数 / 属性 | 持有 state + eventBus + statsService |
| 56-62 | characterCatalog() / setCharacterCatalog() | 图鉴操作 |
| 62-75 | setExtraReader() / setExtra() | Extra 操作 |
| 75-97 | current / curveOf | 当前状态/曲线查询 |
| 97-148 | resourceBucket / changeResource / setResource / setSpotLevel / addSpotLevel / setManager | 资源/Spot 写操作 |
| 148-235 | acquireCharacter / equipColor / unequipColor / unlockColor / activateTheme | Character 写操作 |
| 235-337 | addExp / breakthroughStar / addEnhancement / removeEnhancement / addItem / removeItem | 培养/强化/物品写操作 |
| 337-411 | setFlag / markChatRead / setGachaCounters / mergeIntoWorldPool / unlockInit / completeStory / setStudentBlock / clearStudentBlock | 标志/剧情/学生写操作 |
| 411-447 | recordStoryRead / setPassiveCooldowns | 记录/冷却 |
| 447-483 | setExtra / addExtra / removeExtra / toExtraValue | Extra 写操作 |
| 483-534 | applyEffect / applyEffects | 效果执行 |

**建议切割点**：
- `effect-ops.ts`：applyEffects() 内部各 op 分支（resource/spot/character/enhancement/item/flag/extra 等效果分支）
- `state-mutation-service.ts`：保留全部 30+ 公开方法门面，委托 effect-ops 执行效果分支

---

## 文件间依赖关系

```
game-instance.ts (915) ──依赖──→ 全部 17+ 子系统
    │
    ├──→ game/story-service.ts (780) ──→ types/entities.ts (959)
    ├──→ game/init-service.ts (437)
    ├──→ expression/game-num.ts (672) ──→ expression/game-num-eval.ts (418)
    ├──→ system/state-mutation-service.ts (534)
    ├──→ registry/registry.ts (372)
    └──→ effect/affector-engine.ts (340)

ui/controller.ts (967) ──依赖──→ game-instance.ts
ui/components/tooltip.ts (787) ──依赖──→ registry, types/entities.ts
```

对 `types/entities.ts` 的依赖是最广泛的——它是全项目的类型事实源。这决定了拆分顺序：**必须先拆分 entities.ts，再拆分其他文件**，避免类型导入链断裂。

## 拆分顺序建议

```
Step 1: types/entities.ts        ← 无运行时依赖，最先做
Step 2: game-instance.ts         ← 依赖 types，拆出后不影响子系统
Step 3: game/story-service.ts    ← 依赖 types + game-instance
Step 4: expression/game-num.ts   ← 依赖 types，可并行
Step 5: system/state-mutation-service.ts  ← 依赖 types，可并行
Step 6: controller.ts            ← 依赖 game-instance，最后做
Step 7: tooltip.ts               ← 依赖 types + registry，可并行
```

## 注意事项

1. **向后兼容**：所有拆分使用同包导入 + re-export 兼容层，保证 `from './types'` 等导入路径不变
2. **测试同步**：大测试文件（game-instance.test.ts 1000 行）按新模块结构同步拆分
3. **Schema 协议**：若动 types 目录，必须 `npm run gen:schema`
4. **零行为变化**：拆分是纯搬移，不改变 tick 热路径调用序列