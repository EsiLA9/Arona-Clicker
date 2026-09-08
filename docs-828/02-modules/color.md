# 02-modules/color — 色彩 / 主题 / 装备

> 一句话：`ColorGroupDef` 是唯一色彩实体（主题预设 + 头像方案一体）；`ColorSystem` 管解锁与主题解析，装备/设计/实体槽构成多来源配色。

## 职责边界

- **管**：色彩组/装备解锁与收集、主题 token 解析、实体配色槽（area/variant/init/enhancement）、头像渲染。
- **不管**：临时演出主题层（`RuntimeThemeManager`，见 [[docs-828/02-modules/core]]）。

## 关键文件（`src/arona-clicker/services/`）

| 文件 | 职责 |
| --- | --- |
| `color-system.ts` | `ColorSystem`：解锁编排 / `resolveTheme`（theme 显式覆盖 > primary 派生 > 默认）/ 实体主题槽解析 `entityThemeOverride`（custom → design → equipment → 声明默认）/ `recheckDesignUnlocks` |
| `color-equipment-system.ts` | `ColorEquipmentSystem`：装备收集（`collectEquipment` 幂等，级联解锁其 `colorGroupId`）/ `effectsOf` 聚合装备效用 / `avatarColors` / `recheckUnlocks` 自动收集闭环 |
| `color-unlock-reactor.ts` | `ColorUnlockReactor`：订阅 `characterAcquired` / `flagChanged` 重算解锁（T1 从组合根外移） |
| `src/ui/avatar-renderer.ts` | `renderAvatarSvg(compositionType, colors)`：纯函数圆形头像 SVG（solid/gradient/duotone/pie/radial） |

## 核心概念

- **两个实体**：`ColorGroupDef`（色彩组 = slots 内联 hex + compositionType + theme 预设 + unlock）+ `ColorEquipmentDef`（收集品 = 捆绑色彩组 + effects）。原 `ColorDef` 已并入 `ColorGroupDef`。
- **状态归属**（全经 mutations 写）：`groupsOwned` / `activeTheme` / `equipmentsOwned`（global 层）；`RosterEntry.equippedEquipment`（单装备槽）。`activeTheme` 是系统默认、ColorGroup、独立用户主题的唯一全局单选来源；用户主题内容存于 `customThemes`，实体挂靠存于 `themeAttachments`。
- **实体配色槽**：`state.entityThemeSlots`（key = `area:<id>` / `variant:<id>` / `init:<id>` / `enhancement:<id>`），来源四选一：声明默认 / equipment / design / custom（当前交互入口仍主要覆盖 Area/学生；Init/GlobalEnh 选择页的局部投影由 Task-0025 接入）。
- **声明主题**：`InitDef.theme` 与 `EnhancementDef.theme` 可提供选择页场景的 `ThemeDef`；`ThemeDef.background` 是默认背景，`backgroundVariants` 是受控离散状态变体。
- **运行时层**：`player → init → area → student` 是可排序的四层；user/preview 独立于该排列，ephemeral 剧情层始终最高。
- 主题分层与合并规则见 [[docs-828/04-mechanisms/color-derivation]]。
- 系统默认主题的业务 fallback 由 `src/engine/core/theme-defaults.ts` 的 `SYSTEM_DEFAULT_PRIMARY` 单一提供；CSS 同值只作加载失败时的最后保险。
- 主题渲染采用两条轨道：`palette` 是最多六个、按优先级取色的自动轨道；`nodes` / `scopes` 是按语义节点名的手动覆盖轨道。UI 作用域未覆盖的节点沿父作用域继承。

## 测试入口

`tests/engine/color-system.test.ts`、`color-equipment-system.test.ts`、`color-derive.test.ts`、`color-ingame.test.ts`、`entity-theme.test.ts`

## 相关文档

[[docs-828/04-mechanisms/color-derivation]] · [[docs-828/02-modules/ui]]（theme-tree 落 CSS 变量）
