# 让 Color/ColorGroup 拥有自身 theme-tree 快速映射，驱动 角色/Talklet·Story/Area/Spot/自定义主题 UI

## 设计模型（依据用户澄清）
- **theme-tree 是绝对、与整个界面一一对应的单一全局参考树**：即现有 `controller.ts applyTheme()` 把合并后的 token 经 `buildThemeVars` 注入 `:root` 的机制。维持这一个持续生效的参考树，不改为逐容器分散主题。
- 每个实体把"期望色 / 期望 token"作为**一层贡献**填入参考树；按优先级合并（player < area < spot < student < ephemeral）。
- **Color/ColorGroup 各自拥有快速映射**：把自身解析为一组 token 贡献（Color 直接用 `.theme`；ColorGroup 取其 `role==='primary'` slot 的 Color）。
- **必要时绕过参考树直接 fill styles**：对 Spot 缩略 / 头像强调 / 自定义预览等局部表面，用作用域化 `applyThemeTree` 直接落在具体元素上。

## 1. 引擎：Color/ColorGroup → token 贡献（快速映射）
文件 `src/engine/system/color-system.ts`（复用已有的 `resolveTheme`）：
- 模块级纯函数 `themeContributionFromColor(def: ColorDef): ThemeTokens` → 直接 `resolveTheme(def)`。
- `themeContributionFromGroup(group: ColorGroupDef, getColor: (id)=>ColorDef|undefined): ThemeTokens` → 取 `slots` 中 `role==='primary'`（回退首个 slot）→ 其 `colorId` → `resolveTheme`。**这就是 ColorGroup 的快速映射**。
- `themeContributionFromThemeDef(theme: ThemeDef, getColor): ThemeTokens` → 抽出 `ColorSystem.runtime` 现有 resolver 逻辑（colorId 基类 + tokens 覆盖）复用。
- 在 `ColorSystem` 上提供实例方法（`registry` 注入 `getColor`/`getGroup`），便于 `controller` 直接调用。

## 2. 运行时层优先级（参考树合并）
文件 `src/engine/core/theme-runtime.ts`：
- `ThemeLayer.scope` 增加 `'spot'`。
- `resolve()` 增加按 scope 的稳定优先级排序：player(0) < area(1) < spot(2) < student(3) < ephemeral(4)，避免插入顺序决定覆盖。其余逻辑不变。

## 3. UI：theme-tree 构建 +（必要时）作用域绕过
文件 `src/ui/theme-tree.ts`：
- `export type ThemeTree = Record<string, string>`。
- `buildThemeTree(tokens)` → 组合 `--ac-*`（来自 tokens）+ `buildThemeVars(primary, {}, tokens)` + `--hero-gradient`，返回完整 CSS 变量映射（供一次性应用 / 预览）。
- `applyThemeTree(el, tree)` / `clearThemeTree(el)` → 在指定元素上 set/remove 这些自定义属性（CSS 变量继承，实现"绕过参考树直接 fill"）。
- 便捷封装 `themeTreeFromColor` / `themeTreeFromGroup` / `themeTreeFromThemeDef`（接受 resolver 或已解析 tokens）。

## 4. 接通各实体到参考树（按优先级填入）
文件 `src/ui/controller.ts` `applyTheme()`：
- **Player 层**：保留 `state.activeColor`。
- **Area 层**：保留 `area.theme`；可选允许 `area.colorGroupId` 作为来源。
- **Student 层（核心修复）**：当 `conversationVariantId` 打开时，优先用该学生的 **ColorGroup**（`entry.equippedEquipment` → `colorEquipmentSystem.groupOf` → `themeContributionFromGroup`；回退 `variant.colorGroupId`）填入参考树 primary 节点；保留 `variant.theme` 作为显式覆盖层。
- **Spot 层（新增）**：当右侧 Spot 面板激活且存在聚焦 Spot 时，推入 `scope:'spot'`，来源 `spot.theme`（新增字段）或 `spot.colorGroupId`。聚焦态复用现有 `panelState`（若无选中态则新增 `panelState.activeSpotId`）。
- **Story ephemeral 层**：保留 `setTheme`；其 `colorId` 允许指向 ColorGroup 的 primary Color（走 `themeContributionFromGroup`）。
- **自定义主题**：扩展现有 `#theme-palette-btn` 面板——可选任意 Color / ColorGroup（解析为贡献）或自定义 token 覆盖；预览用 `buildThemeTree` + `applyThemeTree` 到预览容器，应用则写入 player 层（复用 `activateTheme` 或新增自定义 ThemeDef）。

## 5. Spot 字段 + Schema 同步（AGENTS.md 协议）
文件 `src/engine/types/world.ts` `SpotDef` 增加：
- `theme?: ThemeDef`（镜像 `AreaDef`，`@label 主题` `@ref colors`）。
- `colorGroupId?: ColorGroupId`（`@label 默认色组` `@ref colorGroups`，可选，用于 Spot 缩略/强调）。
然后 `npm run gen:schema` 重新生成 `engine-defs.gen.json`，并运行 `engine-schema.sync.test.ts` 确认三向一致；如需补 `editor-extras.ts` overrides 再补。

## 6. 测试（vitest，AGENTS.md 要求机制改动带测试）
- 新增 `tests/engine/theme-tree.test.ts`：`themeContributionFromColor`/`FromGroup`（primary slot 解析、回退、未定义）/ `FromThemeDef`；`RuntimeThemeManager` 新增 `spot` scope 与优先级排序。
- 扩展 `tests/ui/theme-tree.test.ts`（TREE-13+）：`buildThemeTree`（含 `--ac-*` 与 `--hero-gradient`）、`applyThemeTree`/`clearThemeTree`（元素上 set/remove 变量）、`themeTreeFrom*`。
- 视情况更新 `tests/engine/theme-runtime.test.ts`。

## 7. 收尾
`npx tsc --noEmit` + `npm test` + `npm run build` 全绿。Color/ColorGroup 类型本身不改动（只加构建器），故无需为它们重跑 schema；仅 Spot 字段触发 schema 同步。