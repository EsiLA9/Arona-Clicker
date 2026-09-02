# Plan — Color / ColorGroup / ColorEquipment 系统原型

> 目标：将 Color 升级为「Color（颜色原子）+ ColorGroup（头像构成模板）+ ColorEquipment（装备收集品）」三层体系，学生头像由 ColorGroup 抽象图案构成，装备捆绑视觉+效用。

**状态：✅ 已完成（2026-09-02）。** 本文保留原始设计与施工清单；当前实现以 `src/arona-clicker/`、`src/data-services/` 和测试为准。

## 设计定稿（已确认）

| 问题 | 决策 |
|------|------|
| 头像构成 | 抽象图案式：圆形本体，compositionType 决定配色方案（单色/渐变/双色阶调/饼图/径向） |
| ColorGroup 来源 | 仅预制模板，不可自由组装，作为整体收集品 |
| 主题与头像 | 独立：头像走 ColorGroup，UI 主题走 `activeColor`（保留现状 Theme-Tree） |
| 效用归属 | 挂在 ColorEquipment 上（装备持有 colorGroup + effects + 可选 themeColorId） |
| 学生槽位 | 单装备槽：`RosterEntry.equippedEquipment: EquipmentId | null` |

## 实体模型

```ts
// 1. ColorDef — 保留现有（theme token 表 + unlock），移除 effects
// 2. ColorGroupDef — 新：id/name/compositionType/slots
//    ColorGroupSlot { role: primary|secondary|accent|highlight|shadow|edge; colorId }
//    CompositionType = 'solid'|'gradient'|'duotone'|'pie'|'radial'
// 3. ColorEquipmentDef — 新：id/name/colorGroupId/effects/themeColorId?/unlock?/category?
```

状态变更：
- `PlayerState.equipmentsOwned?: EquipmentId[]`
- `RosterEntry.equippedEquipment: EquipmentId | null`（替换 `equippedColors`，删除 `colorSlots`）

## 已完成 ✅

- [x] **types/character.ts**：新增 `ColorGroupId`/`EquipmentId`/`CompositionType`/`ColorGroupRole`/`ColorGroupSlot`/`ColorGroupDef`/`ColorEquipmentDef`；`ColorDef` 移除 `effects`；`CharacterVariantDef` 移除 `colorSlots`；`RosterEntry.equippedColors` → `equippedEquipment`
- [x] **types/state.ts**：`PlayerState` 新增 `equipmentsOwned`
- [x] **types/datapack.ts**：新增 `colorGroups?` / `colorEquipments?` 字段
- [x] **registry.ts**：注册 `_colorGroups` / `_colorEquipments`（存取/clear/merge/accessor）；`validateCharacterRefs` 校验 group→color、equipment→group/themeColor 引用
- [x] **registry-validate.ts**：`colorGroups` / `colorEquipments` 去重校验
- [x] **def-factory/color-group.ts**（新）：`colorGroup(id)` Builder（type/slot）
- [x] **def-factory/color-equipment.ts**（新）：`colorEquipment(id)` Builder（colorGroup/effects/themeColor/category/unlock）
- [x] **def-factory/color.ts**：移除 `effects`
- [x] **def-factory/variant.ts**：移除 `colorSlots`
- [x] **def-factory/index.ts**：导出新 Builder
- [x] **state-mutation-service.ts**：
  - 移除 `equipColor`/`unequipColor`
  - 新增 `collectEquipment`（幂等入库存）/ `equipEquipment`（单槽，not-owned/already 拒绝）/ `unequipEquipment`
  - `acquireCharacter` 创建 entry 时 `equippedEquipment: null`
  - catalog 增加 `getColorGroup`/`getColorEquipment`

## 历史施工项（已完成）

### 1. 事件类型
- [x] `types/events.ts`：`GameEvent` union 中 `colorEquipped` 替换为 `equipmentCollected { equipmentId }` / `equipmentEquipped { variantId; equipmentId }`

### 2. 系统/服务
- [x] `system/color-equipment-system.ts`（新）：
  - `tryUnlock(equipmentId)`：条件校验 → `mutations.collectEquipment` + 级联解锁其 colorGroup 引用的所有 Color（`mutations.unlockColor`）
  - `recheckUnlocks()`：扫描全部装备，条件满足自动收集（挂 characterAcquired/flagChanged）
  - `ownedEquipments(state)` / `isOwned(state, id)` / `getDef` / `getAll`
  - `groupOf(equipmentId)`：解析装备的 ColorGroup
  - `effectsOf(state, variantId)`：装备的 effects（迁移自 ColorSystem.effectsOf，改为按 equippedEquipment 聚合）
  - `avatarColors(equipmentId)`：解析 ColorGroup 各 slot 的实际 hex（供 AvatarRenderer）
- [x] `system/avatar-renderer.ts`（新，纯函数）：
  - `renderAvatarSvg(pattern: CompositionType, colors: string[], size?)` → SVG 字符串
  - solid 单色圆 / gradient 线性渐变 / duotone 双色叠加 / pie 饼图分区 / radial 径向渐变
- [x] `system/color-system.ts`：`effectsOf` 迁移到 ColorEquipmentSystem（或改造）；新增 `resolveThemeFromGroup(group)` 提取主色驱动 Theme-Tree（可选增强）

### 3. 装配
- [x] `game-instance.ts`：实例化 `ColorEquipmentSystem` 并注入 registry/mutations/state/condition；`mutations.setCharacterCatalog` 补 `getColorGroup`/`getColorEquipment`；`characterAcquired`/`flagChanged` 事件挂 `equipmentSystem.recheckUnlocks()`

### 4. 数据（base）
- [x] `data/base/character-rework.ts`：
  - `baseColors` 移除 `.effects()` 调用
  - 新增 `baseColorGroups`：若干预制组（solid/gradient/duotone/pie/radial 各一），引用现有 ColorId
  - 新增 `baseColorEquipments`：捆绑 ColorGroup + effects（如星野泳装组 + Credit 加成）+ themeColorId + unlock
- [x] `data/base/datapack.ts`：导出 `colorGroups` / `colorEquipments`

### 5. UI
- [x] `ui/components/contacts.ts`：
  - 角色面板：`equippedColors` → `equippedEquipment`，渲染装备卡片 + 头像 SVG 预览 + 装备/卸下按钮（data-equip-equipment / data-unequip-equipment）
  - 可装备列表来自 `colorEquipmentSystem.ownedEquipments`
  - 通讯录行头像：装备后显示 ColorGroup 生成的圆形头像
- [x] `ui/components/collection.ts`：新增装备图鉴（equipment codex，含头像预览 + 效用说明）；`renderColorCodex` 保留
- [x] `ui/controller.ts`：`[data-equip-color]` / `[data-unequip-color]` → `[data-equip-equipment]` / `[data-unequip-equipment]`，调 `mutations.equipEquipment` / `unequipEquipment`
- [x] `ui/components/header.ts`：主题 swatch 保留（colorsOwned 驱动），不变或微调

### 6. 测试
- [x] `tests/engine/color-system.test.ts`：CL 组改造——装备相关改为装备系统测试（collect/equip/unequip/effects/级联解锁）
- [x] `tests/engine/color-equipment-system.test.ts`（新）：解锁/级联/单槽/条件拒绝
- [x] `tests/engine/avatar-renderer.test.ts`（新）：各 compositionType 输出 SVG 且颜色数量匹配
- [x] `tests/engine/roster-system.test.ts`：`equippedColors: []` → `equippedEquipment: null`
- [x] `tests/engine/def-factory/variant-gacha-chat.test.ts`：移除 `colorSlots`
- [x] `tests/ui/components/contacts.test.ts`：适配新面板结构
- [x] `tests/engine/color-ingame.test.ts` / `color-derive.test.ts` / `theme-runtime.test.ts` / `character-freeze.test.ts`：按需适配

### 7. 文档 / Schema
- [x] `docs-824/04e-color-derivation.md`：补充 ColorGroup / ColorEquipment 章节
- [x] `npm run gen:schema`：重新生成 `engine-defs.gen.json`（新增实体必须同步）
- [x] `tools/datapack-editor/schema/editor-extras.ts`：如需要，为新实体字段补 override

## 验证

```bash
npx tsc --noEmit   # 类型通过
npm test           # 全部用例通过
npm run gen:schema # schema 同步（防漂移）
npm run dev:game   # 手动验证：收集装备 → 头像变化 + 效用生效；激活主题色 → UI 变化
```

## 关键纪律提醒

- 所有写操作走 `StateMutationService`，系统层只做条件编排
- 测试先行：机制改动必须带 vitest 测试
- 破坏性变更（equippedColors→equippedEquipment）按 AGENTS.md 第 7 条允许，无需迁移代码
- 实体字段改动后必须 `npm run gen:schema` 防漂移
