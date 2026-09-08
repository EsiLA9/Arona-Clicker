# 任务 0031：按钮内 SVG 状态颜色链路审查

状态：✅ 已实施并验证（2026-09-07）

关联方案：[[task-0030-button-rendering-convergence-solution]]

## 1. 现象

部分按钮内的小型 SVG 在 hover 时能够跟随按钮的 active 同源颜色，但点击后保持 active 时仍使用 SVG 自己的原始颜色，未必跟随按钮文字颜色。表现为：

- hover 时 SVG 看起来与按钮文字颜色一致。
- active 时按钮文字已经变化，SVG 仍保留路径上的原始 `fill`/`stroke`。
- 显式指定文字模式为 light/dark 时通常正常，使用 `auto` 时最容易出现分叉。

## 2. 调查结论

根因不是 active 背景没有刷新，也不是状态属性没有切换，而是 SVG 的颜色覆盖规则只对 hover 的 auto 路径完整，对 active 的 auto 路径不完整。

当前链路存在三个层次的分叉：

1. `data-theme-text-mode` 在 active 时会正确切换，但 CSS 没有为 active + `auto` 补充 SVG 子元素的 `fill: currentColor` / `stroke: currentColor` 强制覆盖。
2. hover 有专门的 `data-theme-hover-text-mode="auto"` 规则，并使用 `!important` 覆盖 SVG 路径原有颜色，因此 hover 看起来是正确的。
3. 顶部工具按钮另有一组 `.topbar .toolbar-button svg` 规则，其他区域没有同等的 SVG 兜底；非 host 按钮更无法进入表现宿主颜色链路。

## 3. 代码链路对照

| 阶段 | hover | active | 结果 |
| --- | --- | --- | --- |
| 状态数据 | inactive host 保留 `data-theme-hover-text-mode`，其值取 active host 的文字模式 | `data-theme-state="active"`，刷新 `data-theme-text-mode` | 状态切换本身正确 |
| 普通文字 | `:hover[data-theme-hover-text-mode]` 改变颜色 | `[data-theme-text-mode]` 改变颜色；布局 CSS 也可能提供 active 颜色 | 文字大多正确 |
| SVG 根节点 | hover light/dark/auto 都有颜色规则 | light/dark 有颜色规则；auto 只有继承到根节点的颜色 | 根节点可能正确 |
| SVG path 等子节点 | hover light/dark/auto 都有 `fill/stroke: currentColor !important` | light/dark 有；auto 缺失 | active auto 保留 inline/presentation `fill`/`stroke` |
| 非 host SVG | 依赖组件 CSS | 依赖组件 CSS | 不同区域表现继续分叉 |

关键代码位置：

- `src/ui/css/background.css` 的 light/dark 规则同时覆盖 active 与 hover 的 SVG 子节点。
- 同文件的 auto 规则只覆盖 `.presentation-host-target:hover[data-theme-hover-text-mode="auto"]`，并没有对应的 `.presentation-host-target[data-theme-text-mode="auto"]` SVG 子节点规则。
- `src/ui/css/layout.css` 的 SVG 兜底只限定在 `.topbar .toolbar-button`，不能覆盖普通面板按钮。
- `src/ui/controller-theme.ts` 在刷新时会根据 host 状态设置 `data-theme-text-mode`，并在 active 时移除 hover 专用属性；因此 active 不会继续错误地使用 hover 属性，这是正确行为，但也暴露出 active auto 规则缺口。

## 4. 为什么 inline SVG 特别容易暴露问题

SVG 的颜色可能来自三种来源：

1. 根 `<svg>` 的 `color` 继承。
2. 子元素通过 `fill="currentColor"` 或 `stroke="currentColor"` 继承。
3. 子元素直接写入 `fill="#..."`、`stroke="#..."` 或 `fill="url(...)"`。

当前头像 SVG 由 `src/ui/avatar-renderer.ts` 生成，圆形、路径和渐变子元素会直接写入颜色。例如 solid、duotone、pie 等图形的子节点拥有明确 `fill` 属性。仅改变按钮或 SVG 根节点的 `color`，不会让这些路径自动改色；必须由状态规则明确覆盖 `fill`/`stroke`，并且需要足够的优先级。

因此 hover 的 auto 规则能覆盖 inline/presentation 颜色，而 active 的 auto 规则缺失时，active 就会“忘记”使用按钮的统一颜色。

## 5. 现有规则为什么会让问题看起来不一致

### 5.1 hover 是一条专门的 active 同源路径

hover 对 inactive host 使用 active 背景，同时通过 `data-theme-hover-text-mode` 读取 active 的文字模式。auto 模式下 CSS 还显式将 SVG 子元素强制改为 `currentColor`，所以 SVG 与按钮文字同步。

### 5.2 active 主要依赖普通文字继承

active 时系统只需要设置 `data-theme-text-mode`。对于普通文本，继承链足够；但 SVG path 的 `fill`/`stroke` 是独立绘图属性，不能假定会跟随文字颜色。light/dark 因为已有 SVG 子节点覆盖而正常，auto 则没有完成同样的闭环。

### 5.3 顶部按钮有局部补丁，放大了区域差异

`layout.css` 对顶部工具按钮写了 `svg` 与 `svg *` 的 currentColor 规则。这使顶部按钮即使没有依赖全部 host 规则，也可能表现得比其他区域更稳定；同样的 SVG 放到普通面板按钮、卡片或联系人行中时，覆盖范围就不同。

### 5.4 一部分 SVG 根本不属于主题按钮 host

联系人头像、故事爱心、装备头像等 SVG 多数位于非 `presentation-host-target` 元素内。这些 SVG 不会命中 `background.css` 的 host 状态选择器，即使外层按钮的 active/hover 背景发生变化，也没有共享的 SVG 前景色服务。

## 6. 测试覆盖缺口

现有 `tests/ui/presentation-text-color-css.test.ts` 已检查：

- light/dark host 文字模式。
- hover light/dark/auto 模式。
- `fill: currentColor !important` 与 `stroke: currentColor !important` 存在。

但它没有检查以下契约：

- active + auto 必须存在 SVG 根节点颜色规则。
- active + auto 必须存在 SVG 子节点 `fill/stroke: currentColor !important` 规则。
- hover 和 active 的 SVG 覆盖选择器应当成对出现。
- 带 inline `fill` 的 SVG 在普通主题按钮中必须经过同一前景色覆盖入口。

这解释了为什么已有 hover 回归测试通过，却没有阻止 active SVG 颜色回退。

## 7. 建议的解决方案

### 7.1 表现宿主按钮

将 auto 模式的 active SVG 规则与 hover 规则成对补齐：

- active 的 host 根节点、`presentation-host-content` 及其子元素使用 active 语义色。
- active 的 `svg` 使用相同的 `color`。
- active 的 `svg *`、至少 `path` 使用 `fill: currentColor !important` 和 `stroke: currentColor !important`。

这只是颜色消费规则，不在 CSS 中定义背景；背景仍由系统颜色层和用户主题数据提供。

### 7.2 普通按钮统一后

普通按钮接入 `PresentationHost` 后，所有可主题化 SVG 都应放在 `presentation-host-content` 内，依赖 host 状态的统一文字/SVG颜色服务。组件不再为 active 和 hover 各写一套 SVG 颜色规则。

### 7.3 有多色语义的 SVG

头像渐变、故事爱心等并非单色前景图标，不能默认强制变成按钮文字颜色。应在 markup 上区分：

- `data-theme-foreground="inherit"`：单色图标，跟随按钮文字颜色。
- `data-theme-foreground="fixed"`：多色头像、装饰图，保留自身颜色。

第一阶段只迁移单色按钮图标；多色 SVG 保留原色，避免破坏头像和特殊演出。

## 8. 验收标准

- 同一表现 host 下，hover 与 active 的单色 SVG 使用相同的最终文字颜色。
- active + auto 不再保留路径上的原始 `fill`/`stroke`。
- active + light/dark 的现有行为不回退。
- 顶部按钮与普通面板按钮使用同一套 SVG 状态覆盖逻辑。
- 多色头像、爱心等专用 SVG 不被误改成单色。
- 新增 CSS 契约测试，明确检查 active/hover auto 规则成对存在。

## 9. 本次实施

已在 `src/ui/css/background.css` 补齐 active + `auto` 的 SVG 规则：

- active host、内容节点和 SVG 根节点使用 active 语义色。
- active host 内 SVG 子元素使用 `fill: currentColor !important` 与 `stroke: currentColor !important`，覆盖路径上的 inline/presentation 颜色。
- hover + `auto` 的既有规则保持不变，现已与 active 规则成对存在。
- 未修改联系人头像、故事爱心等非表现宿主 SVG，因此它们继续保留自己的多色/固定颜色。

同时在 `tests/ui/presentation-text-color-css.test.ts` 增加了 active/hover auto SVG 覆盖契约测试。

本问题已作为 [[task-0030-button-rendering-convergence-solution]] 的 SVG 子项完成；后续普通按钮接入 `PresentationHost` 时应直接复用该全局规则，不再新增局部 SVG 颜色补丁。

## 10. 验证结果

- `npx vitest run tests/ui/presentation-text-color-css.test.ts tests/ui/components/contacts.test.ts tests/ui/components/chat-image.test.ts`：28 项通过。
- `npm run check:architecture`：通过。
- `npx tsc --noEmit`：未通过，现有 `tests/ui/selector-theme.test.ts:68` 使用了缺少完整 `BackgroundViewLayer` 字段的测试数据；不涉及本任务修改。
- `npm test`：123 个测试文件中 122 个通过，1 个既有 `tests/ui/components/story-gate.test.ts` 断言失败；失败断言与本次 CSS 修改无关。
