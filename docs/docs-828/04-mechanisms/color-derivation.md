# 04-mechanisms/color-derivation — 色彩派生：ColorSystem / 主题 token

> 本文回答：**主题与色彩怎么解析、合并、落 CSS。** 模块卡片见 [[docs/docs-828/02-modules/color]]；`ColorSystem` 负责：解锁管理 + 主题 token 合并 + CSS 变量注入。

## 主题分层

| 层 | 来源 | 优先级 |
| --- | --- | --- |
| 玩家全局层 | `syncPlayerThemeFromState(state)` | 可自定义 |
| 场景层 init | 当前/恢复中的 Init 的 theme | 可自定义 |
| 场景层 area | 当前 Area 的 theme | 可自定义 |
| 场景层 student | 当前对话学生差分 theme | 可自定义 |
| 临时演出层 | `setTheme` effect（剧情演出） | 始终最高 |

player/init/area/student 四层的相对优先级由玩家可自定义（`PlayerState.themeLayerOrder`，`RuntimeThemeManager.setLayerOrder`，缺省 `['player','init','area','student']`）；user/preview 独立插入，演出层不参与排序，始终最高。主题浮窗「层级优先级」段用 ◀/▶ 交换相邻位。

## 合并规则

```text
runtimeTheme() → 按优先级合并主题层：
  tokens 逐键覆盖（低层缺失键 → 高层补）
  palette 取最高层的非空有序色板（最多六色）
  nodes 逐节点覆盖，scopes 逐作用域节点覆盖
  → 渲染为 --ac-* 与 --theme-node-* CSS 变量
  → UI 作用域按 root → cluster → child 继承；背景文字色同步派生
```

- 合并是**运行时派生**，不落 PlayerState；
- 每次场景切换（`travelToArea` / 对话空间切换）→ `popSceneTheme` + `pushSceneTheme` → UI `applyTheme` 重注入 CSS 变量。

### 双轨主题色与作用域继承

自动轨道使用 `ThemeDef.palette`、用户主题 `palette` 或色彩组 `slots` 生成 `--theme-node-*`。主色/背景/面板优先取第 1 色，辅助与 active 取第 2 色，高亮取第 3 色，状态色偏向后部色位；色板不足时退回最后一个可用颜色，因此只配置一个主题色也能完整工作。

手动轨道使用 `ThemeDef.nodes` 或用户主题 `nodes` 按节点名覆盖自动结果；`scopeNodeOverrides` / 用户主题 `scopes` 可对 `left.contacts`、`center.chat` 等 UI 作用域进行局部覆盖。作用域没有指定的节点从父作用域继承，最终回到 root 的自动结果。

组件应优先使用 `--theme-node-<node>` 与专用 `ui-cluster--*` / `ui-control--*` 类名。旧的 `--cyan`、`--panel` 等变量目前由兼容别名提供，作为渐进迁移层。

## 实体配色槽（Area / 学生 / Init / GlobalEnh 的多来源配色）

每个可挂靠实体有一个「主题槽」（`PlayerState.entityThemeSlots`，key = `area:<id>` / `variant:<id>` / `init:<id>` / `enhancement:<id>`），当前生效主题可来自多个来源：

| 来源 | 说明 |
| --- | --- |
| 声明默认 | `AreaDef.theme` / `CharacterVariantDef.theme` / `InitDef.theme` / `EnhancementDef.theme`（兜底，无槽位时生效） |
| equipment | 已装备的 `ColorEquipmentDef`（`theme` 完整主题优先，否则回退其引用的 `colorGroupId` 组预设） |
| design | 已解锁的 `ThemeDesignDef`（全局表 `themeDesigns`，`entityKey` 声明目标实体） |
| custom | 玩家/剧情写入的 `ThemeDef`（`setTheme` effect 的 `scope=area|student` + `entityKey`） |

解析（`ColorSystem.entityThemeOverride`）：玩家槽位（custom → design → equipment，按 `entityThemeSlots[key].kind`）→ 无槽位/`default` → 声明默认（student 走既有 ColorGroup 主色位回退）。UI 侧 `entityThemeOptions` 汇总可选项。

获得途径：
- `ThemeDesignDef.unlock` 条件满足 → `recheckDesignUnlocks()` 自动解锁（挂 `characterAcquired` / `flagChanged`，与 ColorEquipment 同一闭环）；
- 获得后自动写入槽位（改默认色），玩家可手动换回；
- `setTheme` effect 的 `scope=area|student` 直接改写实体主题槽（写入 `custom` 来源）；Init/GlobalEnh 目前以选择页只读投影消费声明主题，不把选择页聚焦写回运行时层。

状态归属：`entityThemeSlots` / `entityThemeDesignsOwned` 均为收集类资产（global 层，入存档）。

## 色彩体系（ColorGroup / ColorEquipment）

学生头像与效用由两个实体构成，主题（UI）与头像（学生）由同一实体承载：

| 实体 | 职责 | 关键字段 |
| --- | --- | --- |
| `ColorGroupDef` | 唯一色彩实体 = 重点色彩组（slots 内联 hex）+ 头像渲染方案（compositionType）+ theme-tree 预设（theme 覆盖表，primary 缺省取主色位色值）+ 解锁条件 | `slots[{role,color}]` / `compositionType` / `theme` / `unlock` |
| `ColorEquipmentDef` | 核心收集品：捆绑 `colorGroupId`（头像视觉 + 主题预设）+ `effects`（效用）；收集时级联解锁该组 | `colorGroupId` / `effects` / `unlock` |

`CompositionType`：`solid` 单色 / `gradient` 线性渐变 / `duotone` 双色阶调 / `pie` 饼图分区 / `radial` 径向渐变。

### 状态归属

- `PlayerState.groupsOwned: ColorGroupId[]` —— 已解锁色彩组清单（幂等入库存）；
- `PlayerState.activeTheme` —— 当前全局主题来源，三选一：`{ kind: 'system' }`、`{ kind: 'color-group', id }`、`{ kind: 'custom', id }`；ColorGroup 选择须已拥有，custom 选择须已保存；
- `PlayerState.equipmentsOwned: EquipmentId[]` —— 已收集装备清单（幂等入库存）；
- `RosterEntry.equippedEquipment: EquipmentId | null` —— 单装备槽（`null` = 未装备）。

### 写入口（全部经 StateMutationService）

- `unlockGroup(groupId)`：色彩组解锁（条件满足）→ `groupUnlocked` 事件；
- `collectEquipment(equipmentId)`：装备收集入库存（幂等）；收集时会**级联解锁其引用的 ColorGroup**；
- `equipEquipment(variantId, equipmentId)` / `unequipEquipment(variantId)`：单槽装备/卸下（未拥有 / 同装备 → 拒绝）；
- `activateTheme(groupId)`：激活系统默认或全局 ColorGroup（未拥有拒绝；`null` 回系统默认）→ `themeChanged` 事件；
- `activateCustomTheme(customThemeId)`：激活已保存的独立用户主题；切换到内置主题只解除全局应用，不删除 `customThemes` 记录。

### 解析与渲染

- `ColorSystem.resolveTheme(group)`：唯一主题解析路径 —— `theme` 显式覆盖 > primary（主色位色值）派生 > 默认；
- `ColorEquipmentSystem.effectsOf(state, variantId)`：按 `equippedEquipment` 聚合装备 effects；
- `ColorEquipmentSystem.avatarColors(equipmentId)`：按 slot 顺序返回组内各色位的内联 hex；
- `src/ui/avatar-renderer.ts` `renderAvatarSvg(compositionType, colors)`：纯函数，按构成方式输出圆形头像 SVG。

### 自动收集闭环

`ColorUnlockReactor`（装配于 `wiring.ts`）订 `characterAcquired` / `flagChanged` → 重算解锁：扫描带 `unlock` 条件的装备与设计，条件满足即自动入库存（缺省无 `unlock` = 不可自动解锁）。

## 剧情演出层

- `triggerStory` effect 或 `setTheme` → `pushStoryTheme`（`setTheme` 经 `themeEffectRequested` 请求事件转发，见 [[docs/docs-828/04-mechanisms/trigger-effect]]）；
- 剧情结束（`clearStoryTheme`）→ 移除演出层，回到场景主题。

## 相关文档

[[docs/docs-828/02-modules/color]] · [[docs/docs-828/03-data-structures/declarative-dsl]] §10

