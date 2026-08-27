# docs-824 — 04e 色彩派生：ColorSystem / 主题 token

> 原文出处：`04-core-algorithms.md` 五章。`ColorSystem` 负责：解锁管理 + 主题 token 合并 + CSS 变量注入。

## 主题分层

| 层 | 来源 | 优先级 |
| --- | --- | --- |
| 玩家全局层 | `syncPlayerThemeFromState(state)` | 可自定义 |
| 场景层 area | 当前 Area 的 theme | 可自定义 |
| 场景层 student | 当前对话学生差分 theme | 可自定义 |
| 临时演出层 | `setTheme` effect（剧情演出） | 始终最高 |

player/area/student 三层的相对优先级由玩家可自定义（`PlayerState.themeLayerOrder`，
`RuntimeThemeManager.setLayerOrder`，缺省 `['player','area','student']`）；
演出层不参与排序，始终最高。主题浮窗「层级优先级」段用 ◀/▶ 交换相邻位。

## 合并规则

```text
runtimeTheme() → 按优先级合并 token：
  tokens 逐键覆盖（低层缺失键 → 高层补）
  → 渲染为 --ac-* CSS 变量 + --ink-on-*/--muted-on-* 背景感知文字色
  → UI 层 buildThemeVars 展开语义层（由 --ac-primary 衍生）
```

- 合并是**运行时派生**，不落 PlayerState；
- 每次场景切换（`travelToArea` / 对话空间切换）→ `popSceneTheme` + `pushSceneTheme` → UI `applyTheme` 重注入 CSS 变量。

## 实体配色槽（Area / 学生的多来源配色）

每个 Area 与 CharacterVariant 有一个「主题槽」（`PlayerState.entityThemeSlots`，key =
`area:<id>` / `variant:<id>`），当前生效主题可来自多个来源：

| 来源 | 说明 |
| --- | --- |
| 声明默认 | `AreaDef.theme` / `CharacterVariantDef.theme`（兜底，无槽位时生效） |
| equipment | 已装备的 `ColorEquipmentDef`（`theme` 完整主题优先，否则 `themeColorId`） |
| design | 已解锁的 `ThemeDesignDef`（全局表 `themeDesigns`，`entityKey` 声明目标实体） |
| custom | 玩家/剧情写入的 `ThemeDef`（`setTheme` effect 的 `scope=area|student` + `entityKey`） |

解析（`ColorSystem.entityThemeOverride`）：玩家槽位（custom → design → equipment，按
`entityThemeSlots[key].kind`）→ 无槽位/`default` → 声明默认（student 走既有
ColorGroup 主色位回退）。UI 侧 `entityThemeOptions` 汇总可选项，主题浮窗「区域配色」
段与学生面板「配色设计」段渲染（未解锁设计置灰）。

获得途径：
- `ThemeDesignDef.unlock` 条件满足 → `recheckDesignUnlocks()` 自动解锁（挂
  `characterAcquired` / `flagChanged`，与 ColorEquipment 同一闭环）；
- 获得后自动写入槽位（改默认色），玩家可手动换回；
- `setTheme` effect 的 `scope=area|student` 直接改写实体主题槽（写入 `custom` 来源）。

状态归属：`entityThemeSlots` / `entityThemeDesignsOwned` 均为收集类资产（global 层，入存档）。

## 三层色彩体系（Color / ColorGroup / ColorEquipment）

学生头像与效用由三层实体构成，主题（UI）与头像（学生）解耦：

| 实体 | 职责 | 关键字段 |
| --- | --- | --- |
| `ColorDef` | 主题 token 表（primary 派生全套 UI 配色）+ 解锁条件 | `theme` / `unlock` |
| `ColorGroupDef` | 预制头像构成模板（不可自由组装），决定抽象圆形图案 | `compositionType` / `slots[{role,colorId}]` |
| `ColorEquipmentDef` | 核心收集品：捆绑 `colorGroupId`（头像视觉）+ `effects`（效用）+ 可选 `themeColorId`（UI 主题） | `colorGroupId` / `effects` / `themeColorId` / `unlock` |

`CompositionType`：`solid` 单色 / `gradient` 线性渐变 / `duotone` 双色阶调 / `pie` 饼图分区 / `radial` 径向渐变。

### 状态归属

- `PlayerState.equipmentsOwned: EquipmentId[]` —— 已收集装备清单（幂等入库存）；
- `RosterEntry.equippedEquipment: EquipmentId | null` —— 单装备槽（`null` = 未装备，替换旧 `equippedColors` / `colorSlots`）。

### 写入口（全部经 StateMutationService）

- `unlockColor(colorId)`：Color 解锁（条件满足）；
- `collectEquipment(equipmentId)`：装备收集入库存（幂等）；`tryUnlock` 收集时会**级联解锁其 ColorGroup 引用的全部 Color**；
- `equipEquipment(variantId, equipmentId)` / `unequipEquipment(variantId)`：单槽装备/卸下（未拥有 / 同装备 → 拒绝）。

### 解析与渲染

- `ColorEquipmentSystem.effectsOf(state, variantId)`：按 `equippedEquipment` 聚合装备 effects（原 `ColorSystem.effectsOf` 已迁移至此）；
- `ColorEquipmentSystem.avatarColors(equipmentId)`：解析 ColorGroup 各 slot 的实际 hex（按 slot 顺序）；
- `avatar-renderer.ts` `renderAvatarSvg(compositionType, colors)`：纯函数，按构成方式输出圆形头像 SVG，供通讯录行头像与装备预览消费。

### 自动收集闭环

`characterAcquired` / `flagChanged` 事件挂 `ColorEquipmentSystem.recheckUnlocks()`：扫描带 `unlock` 条件的装备，条件满足即自动入库存（缺省无 `unlock` = 不可自动解锁）。

## 剧情演出层

- `triggerStory` effect 或 `setTheme` → `pushStoryTheme`；
- 剧情结束（`clearStoryTheme`）→ 移除演出层，回到场景主题。

---

上一篇：[[docs-824/04d-cultivate]] · 下一篇：[[docs-824/04f-trigger-effect]]