# 04-mechanisms/color-derivation — 色彩派生：ColorSystem / 主题 token

> 本文回答：**主题与色彩怎么解析、合并、落 CSS。** 模块卡片见 [[docs/archive/docs-828-snapshot/02-modules/color]]；`ColorSystem` 负责：解锁管理 + 主题 token 合并 + CSS 变量注入。

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

### 背景来源快照与选择页投影

| 来源 | 数据归属 | 运行时范围与清理 | 主要渲染消费者 |
| --- | --- | --- | --- |
| Player | `PlayerState.activeTheme`、`themeLayerOrder` 与 ColorGroup | 全局基底；切换 Init 时保留，主题顺序由状态同步到 Runtime | 全局 token/CSS、body 外背景和选择页基底 |
| Init | `InitDef.theme` 与 `entityThemeSlots[init:<id>]` | 当前 Init 的 `init` 场景槽；`syncRuntimeTheme()` 先移除旧槽再按当前 Init 重建 | 游戏页；选择页按焦点只读投影 Init 主题 |
| Area | `AreaDef.theme` 与 `entityThemeSlots[area:<id>]` | 当前 Area 的 `area` 场景槽；旅行或场景重建时移除旧 Area 后再加入当前 Area | 游戏页；选择页仅在策略启用且焦点为活动 Init 时可预览，Restart 撤离禁用 |
| Student | 当前对话 CharacterVariant 的主题/装备与实体主题槽 | 当前对话的 `student` 场景槽；普通渲染从当前对话身份重建 | 游戏页对话空间及其 ThemeTree、背景和 Host |
| User | 当前激活的 `customThemes` 全局主题及用户启停状态 | 独立 `user` 槽；仅 active custom theme 且 capability 可用时参与，跨 Init 保留 | 全局颜色与 `global` 背景/Host，其中全局背景包含系统色层 |
| Preview | Theme Editor 当前草稿 | 独立 Preview 槽，覆盖已应用用户颜色；显式本地 global 图层会替换 user 背景来源，取消时移除 | 编辑器即时预览；不写入运行时场景槽 |
| Story | `setTheme` 演出效果 | Story `ephemeral` 槽优先级最高；剧情结束或无活动 Story 时清理 | 当前游戏表现；不进入选择页基底 |
| Selector focus | Registry 中焦点 Init / Enhancement 声明与选择状态 | 派生的只读投影，不写 PlayerState/Runtime；焦点切换更新 current/next 场景槽 | selector shell、轮盘、详情、顶栏 Host 与局部变量 |
| Presentation Host | 各主题来源携带的 PresentationDef | Host 背景随贡献来源合并；状态、父级回退由 `PresentationView` 解析 | `data-theme-host-id` 对应组件的 `.presentation-host-background` |

这些来源共同构成解析输入，但颜色 token、背景层与 Host 表现分别合并：token 按优先级逐键覆盖，背景按稳定 ID 替换/匿名追加，Host 再由 PresentationView 解析父级与状态。DOM 只承载解析结果，不拥有主题数据。

- `RuntimeThemeManager.resolve()` 将颜色 token 与背景贡献解析为同一份只读 `ResolvedTheme`。背景仍按稳定 ID 覆盖、匿名层追加；解析过程中保留 player、场景、user、preview、ephemeral 的来源，供特定来源替换。
- Init / GlobalEnhancement 选择页不把活动游戏的最终背景当作新页面基底。`selectorBaseTheme()` 排除 Init / Area / Student 场景层和剧情临时层，保留 player、user 与编辑 preview；选择页再把当前焦点 Init / Enhancement 投影到该基底。游戏中途打开选择面时，聚焦当前 Init 可按策略加入当前 Area；从 Init 的“结束游戏并重新选择世界线”入口撤离时，选择页只呈现 Init 自身主题，不把仍留在运行快照中的 Area 覆盖到 Init 上。
- 转场后，body 外背景读取选择页全局基底；`.selector-super-background` 的 current / next 双槽、详情视口、圆盘和顶栏从同一个焦点投影及 transition key 读取。焦点变化只刷新投影，不改 PlayerState 或运行时场景栈。返回游戏时由普通 `UIController.render()` 重建目标 Init / Area / Student 场景后再应用主题。
- 用户主题编辑 preview 是已应用 user 背景贡献的替身：显式本地 global 图层覆盖会按 user 来源移除旧 user 背景并合并草稿，保留独立 player/Init/Area/Student 来源。取消移除 preview，保存经 `StateMutationService` 更新用户主题后重新解析。

### 用户图层的继承与空覆盖

| 数据状态 | 语义 | 全局目标结果 |
| --- | --- | --- |
| `global` 宿主缺省，或 `layers` 未定义 | 继承当前有效回退；列表只读显示回退，首次编辑会物化当时的有效用户图层 | 系统色层与继承的用户层 |
| `global.layers` 含图层 | 用本地列表覆盖继承的用户图层；保存后独立持久化顺序与 enabled 状态 | 系统色层与本地用户层 |
| `global.layers: []` | 显式本地空覆盖；不继承主题设计/用户回退层 | 仅系统色层；系统色层仍不可删除，ignore 开关只控制绘制 |
| 显式“恢复继承” | 清除本地列表与顺序，回到缺省继承状态 | 重新显示当前有效回退 |

- 空数组是有效配置，不等同于缺省值。删除最后一个用户图层必须保留 `layers: []`；只有用户显式执行“恢复继承”才清除本地覆盖。
- 图层 Manager 的回退快照排除活动场景及故事层，不能把当前 Area / Student / Story 层物化进跨世界线的用户主题。
- `Theme Preview` 替换既有 user 背景时按来源重放贡献：删除用户层不会靠相同 ID 偶然覆盖来隐藏旧层，也不会清空其它来源；若 user 层原先以同 ID 遮蔽了较低来源，替换后较低层会重新显现。Host 自身的父级 / 状态回退继续由 `PresentationView` 解析。

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

## 实体表现语义单元

`Init / Area / Spot / Enhancement / CharacterVariant` 可声明 `EntityPresentationDef`。其 `default` 与 `additions[].override` 同时承载名称、描述和可选主题，Resolver 输出完整值；正式默认 Datapack 在组合入口把旧 `name / description / theme` 投影到 `presentation.default`，外部旧 Datapack 保留 legacy fallback。

实体表现的选择优先级为：

```text
runtime owner/lifetime override > PlayerState.entityPresentationSelections optionId > presentation.default > legacy fields
```

玩家只选择 addition 的 `optionId`，通过 `StateMutationService` 写入 Global map；运行时覆盖不写 PlayerState，按 story / area / init 生命周期清理。`EntityPresentationService` 仍委托 `ColorSystem.resolveEntityTheme()` 处理 equipment、design、custom 等既有颜色来源，因此表现内容选择与“仅改变颜色来源”的 `entityThemeOptions` 是两个有明确边界的入口。

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
- `VariantProgress.colorEquipment: EquipmentId | null` —— 单装备槽（`null` = 未装备）。

### 写入口（全部经 StateMutationService）

- `unlockGroup(groupId)`：色彩组解锁（条件满足）→ `groupUnlocked` 事件；
- `collectEquipment(equipmentId)`：装备收集入库存（幂等）；收集时会**级联解锁其引用的 ColorGroup**；
- `equipEquipment(variantId, equipmentId)` / `unequipEquipment(variantId)`：单槽装备/卸下（未拥有 / 同装备 → 拒绝）；
- `activateTheme(groupId)`：激活系统默认或全局 ColorGroup（未拥有拒绝；`null` 回系统默认）→ `themeChanged` 事件；
- `activateCustomTheme(customThemeId)`：激活已保存的独立用户主题；切换到内置主题只解除全局应用，不删除 `customThemes` 记录。

### 解析与渲染

- `ColorSystem.resolveTheme(group)`：唯一主题解析路径 —— `theme` 显式覆盖 > primary（主色位色值）派生 > 默认；
- `ColorEquipmentSystem.effectsOf(state, variantId)`：按 `colorEquipment` 聚合装备 effects；
- `ColorEquipmentSystem.avatarColors(equipmentId)`：按 slot 顺序返回组内各色位的内联 hex；
- `src/ui/avatar-renderer.ts` `renderAvatarSvg(compositionType, colors)`：纯函数，按构成方式输出圆形头像 SVG。

### 自动收集闭环

`ColorUnlockReactor`（装配于 `wiring.ts`）订 `characterAcquired` / `flagChanged` → 重算解锁：扫描带 `unlock` 条件的装备与设计，条件满足即自动入库存（缺省无 `unlock` = 不可自动解锁）。

## 剧情演出层

- `triggerStory` effect 或 `setTheme` → `pushStoryTheme`（`setTheme` 经 `themeEffectRequested` 请求事件转发，见 [[docs/archive/docs-828-snapshot/04-mechanisms/trigger-effect]]）；
- 剧情结束（`clearStoryTheme`）→ 移除演出层，回到场景主题。

## 相关文档

[[docs/archive/docs-828-snapshot/02-modules/color]] · [[docs/archive/docs-828-snapshot/03-data-structures/declarative-dsl]] §10

