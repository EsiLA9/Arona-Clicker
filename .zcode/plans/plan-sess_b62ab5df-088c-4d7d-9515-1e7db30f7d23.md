# 色彩系统扩展：层优先级自定义 + 场景/学生配色槽

## 需求回顾

1. **层优先级可排列**：玩家可在主题浮窗中拖拽/调整"玩家层/场景层/学生层"在主题合并时的优先级顺序，剧情演出层始终最高。
2. **场景/学生配色槽**：每个 Area 和 CharacterVariant 自有一个 `currentTheme`，可从多来源（装备、解锁设计、affector、玩家自定义）获得主题，玩家在已有来源中选定生效。

---

## 一、层优先级自定义（改动较小，可独立上线）

### 数据模型

```ts
// PlayerState 新增（state.ts）
themeLayerOrder?: ('player' | 'area' | 'student')[];
// 省略 = 默认 ['player','area','student']（当前语义：student > area > player）
```

### 引擎层

**1. `RuntimeThemeManager`（theme-runtime.ts）** — 当前 `resolve()` 按 `[player, ...sceneStack, ...ephemeralStack]` 固定顺序合并，改为按配置顺序合并：
- 新增字段 `layerOrder: ThemeScope[]`（默认 `['player','area','student']`）。
- 新增 `setLayerOrder(order)` 方法。
- `resolve()` 改为：先建立 `byScope` 映射（player 单层 + sceneStack 按 scope 去重），再按 `layerOrder` 顺序合并，最后在其上叠加 `ephemeralStack`。
- 保持 `currentScene()` / `topEphemeral()` 等 API 不变；`sceneStack` 的 push/pop 语义不变（去重基于 scope 的机制不变，只是合并顺序不再依赖 push 顺序）。

**2. `ColorSystem`（color-system.ts）** — 新增 `syncLayerOrderFromState(state)`：
- 读取 `state.themeLayerOrder`，调用 `runtime.setLayerOrder(order)`。
- 在 `syncPlayerThemeFromState` 末尾同步调用，由 `applyTheme` 统一触发。

**3. `StateMutationService`（state-mutation-service.ts）** — 新增：
```ts
setThemeLayerOrder(order: ThemeLayerScope[]): boolean
```
- 校验是 `['player','area','student']` 的排列；无效时回退默认。
- 写入 `state.themeLayerOrder`；emit `themeChanged` 事件（复用已有，触发 UI 重渲 + applyTheme）。

**4. 事件（events.ts）** — 不变，`themeChanged` 已足够。

### UI 层

**5. `header.ts` theme-float 新增"层级优先级"段**：
- 在现有主题色 swatch 列表下方新增 `<section class="layer-order">`。
- 三行：玩家层 / 场景层 / 学生层，每行一个上移按钮 ◀ 和下移按钮 ▶。
- 当前顺序用数字标识（1, 2, 3）。
- 按钮绑定 `data-theme-layer-order` 属性，值为 `['player','area','student']` 的 JSON 序列化。
- 底部注文："剧情演出临时层始终最高优先级"。

**6. `controller.ts` 绑定**：
- `[data-theme-layer-order]` click → 解析新顺序 → `game.mutations.setThemeLayerOrder(newOrder)` → `render()` → `applyTheme()` 自动重建。

**7. `styles.css` — 新增 `.layer-order` 相关样式。

### 测试

**8. `tests/engine/theme-runtime.test.ts`：
- 新增用例：`setLayerOrder([player, student, area])` → student 高于 player 但低于 area。
- 新增用例：`setLayerOrder([student, area, player])` → player 最低。
- 验证 `colorId` 溯源取最底层、`layers` 输出顺序正确。

---

## 二、场景/学生配色槽（以"槽"模型为核心）

### 核心概念

每个 Area 和 CharacterVariant 有一个"主题槽"（theme slot），可用主题来自多个来源，玩家在可用来源中选择谁生效。不引入全新 `designs[]` 数组，而是通过现有与新来源自然填充。

### 来源类型

| 来源 | 说明 | 存入方式 |
|------|------|----------|
| **声明默认** | 当前 `AreaDef.theme` / `CharacterVariantDef.theme` | 始终可用，作为兜底 |
| **装备** | `ColorEquipmentDef.themeColorId` → 解析为 ThemeDef | 装备时存入 |
| **解锁设计** | 新增 `ThemeDesignDef`（数据包表），含 full ThemeDef + unlock 条件 | 条件满足时存入 |
| **剧情 Effect** | 现有 `setTheme` effect，扩展 scope 参数支持 `area`/`student` 目标 | effect 触发时存入 |
| **玩家自定义** | 玩家直接设定 token 覆盖 | 手动存入，覆盖其他来源 |

### 数据模型

**新增类型 `ThemeDesignDef`（character.ts）**：
```ts
export interface ThemeDesignDef {
  id: string;
  name: string;
  description?: string;
  theme: ThemeDef;          // 完整主题定义
  unlock?: Condition | ConditionGroup;
}
```
数据包表 `themeDesigns` 新增（`Datapack` 接口、gen:schema 自动派生）。

**PlayerState 新增（state.ts）**：
```ts
// 每实体的主题槽：玩家选定的来源
entityThemeSlot?: Record<string, {
  kind: 'default' | 'equipment' | 'design' | 'custom';
  designId?: string;       // 当 kind='design' 时
  equipmentId?: string;    // 当 kind='equipment' 时
  customTheme?: ThemeDef;  // 当 kind='custom' 时
}>;

// 已解锁的设计（按实体隔离；设计 id 全局唯一）
entityThemeDesignsOwned?: Record<string, string[]>;
```

### 引擎层

**1. `ColorSystem`（color-system.ts）** 扩展：
- 新增 `activeEntityTheme(entityKey, ...)` 查询方法：按 `entityThemeSlot` → 装备 → 声明默认 解析最终 ThemeDef。
- 新增 `designUnlock` 相关：`tryUnlockDesign(entityKey, designId)` → 校验 unlock → `mutations.unlockEntityDesign`。
- 新增 `recheckUnlocks()` 扩展：扫描所有 `ThemeDesignDef` 的 unlock 条件，满足时自动解锁。
- 新增 `availableThemes(entityKey)` 返回该实体可用的主题来源列表（供 UI 渲染）。

**2. `StateMutationService`（state-mutation-service.ts）** 新增：
```ts
unlockEntityDesign(entityKey: string, designId: string): boolean
setEntityThemeSlot(entityKey: string, slot: EntityThemeSlot | null): boolean
```
- `setEntityThemeSlot` 非 null 时写 `entityThemeSlot[key]`，null 时清除（回退到自动选择）。
- 均 emit `themeChanged` 事件。

**3. 装备联动**（color-equipment-system.ts）：
- 装备时（`equipEquipment`）自动调用 `colorSystem.availableThemes` 更新，或由 controller 的 `applyTheme()` 在 `render()` 时重新计算。
- `ColorEquipmentDef` 扩展：新增 `theme?: ThemeDef` 字段（可选，若提供则装备时成为"装备来源"主题，优先级高于 `themeColorId` 的单色覆盖）。

**4. Effect 扩展**（expression.ts）：
- `setTheme` 的 `ThemeEffectValue` 扩展 `scope` 支持 `'area'` | `'student'`（当前仅 `'ephemeral'`），使剧情/Trigger 能直接改变场景/学生的主题槽。

### UI 层

**5. 主题浮窗（header.ts）** — 进入 Area 时显示当前区域配色：
- 在"层级优先级"段下方新增 `<section class="area-designs">`，仅在 `currentAreaId` 存在时渲染。
- 显示当前区域可用主题来源列表（`availableThemes('area:<id>')`）。
- 每个来源一行：来源名 + 预览色块 + 选中状态（radio 样式）。
- 玩家自定义入口：一个"自定义"按钮打开 token 编辑（简化版：只给 primary 输入框）。

**6. 学生面板（contacts.ts 或 right-panels.ts）** — 学生详情区域新增"配色设计"段：
- 在装备槽下方显示当前学生的可用主题来源列表。
- 包含：装备来源（如果已装备）、解锁设计来源、玩家自定义。
- 交互同 area 设计：点击选中，预览色块同步。
- 未解锁设计显示锁图标+解锁条件。

**7. `controller.ts` 绑定**：
- `[data-entity-theme-select]` → `game.mutations.setEntityThemeSlot(entityKey, {kind, ...})`。
- `[data-entity-theme-custom]` → 打开 token 编辑 UI（初级：只改 primary 色值）。
- `applyTheme()` 扩展：计算当前 area 和 student 的 entityTheme → 若 player 设置了 `entityThemeSlot`，以其 ThemeDef 作为 `pushSceneTheme` 的 tokens 参数。

### 测试

**8. 新增测试**：
- `tests/engine/entity-theme.test.ts` — 主题槽解析优先级、unlock 自动解锁、装备联动、effect 注入。
- 在 `tests/engine/theme-runtime.test.ts` 增加 entityTheme 场景层合并测试。
- 扩展 `tests/ui/theme-tree.test.ts` 验证 entityTheme 输出的 CSS 变量正确。

### Schema 同步

- `ThemeDesignDef` 新增后 `npm run gen:schema` 自动生成。
- `tools/datapack-editor/schema/editor-extras.ts`：为 `areas.entityTheme` 和 `characterVariants.entityTheme` 新增 `themeField` 空白覆盖（确保同步测试通过），或明确标记为运行时字段不参与数据包编辑器。

---

## 实施顺序

### Phase A（基础层）
1. `RuntimeThemeManager` 改为可配置合并顺序
2. PlayerState + StateMutationService + 事件
3. 主题浮窗"层级优先级"段 UI
4. 测试

### Phase B（实体配色槽）
5. `ThemeDesignDef` 类型 + 数据包表
6. PlayerState 新增字段 + mutations
7. ColorSystem 扩展（availableThemes / activeEntityTheme / unlock）
8. 装备联动（扩展 ColorEquipmentDef.theme）
9. 剧情 effect 扩展（setTheme scope 支持 area/student）
10. 主题浮窗区域设计段 + 学生面板设计选择器
11. 控制器绑定 + applyTheme 扩展
12. 测试

### Phase C（可选，后续）
13. 玩家自定义 token 编辑 UI（初级：primary 色值编辑）
14. 卡池掉落设计（扩展 GachaPool 成员类型）

---

## 重要设计决策

- **层优先级**仅影响玩家/场景/学生三层；剧情演出层（ephemeral）始终最高，不参与排序。
- **实体主题槽**的 `entityThemeSlot` 仅存储来源引用，不存储完整 token 表（避免冗余）。完整 ThemeDef 在每次 `applyTheme` 时实时解析。
- 获得新设计时**自动**设为该实体当前生效主题（写入 `entityThemeSlot`），玩家可手动换回。
- 不做存档迁移——旧 PlayerState 缺字段按默认行为处理。