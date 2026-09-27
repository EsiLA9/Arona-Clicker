# Task：Theme Workspace 与 Init / GlobalEnh 选择页切换刷新审计

状态：proposed — 用户报告切换后表现内容未能可靠刷新，等待后续复现与处理

## 目标

记录并后续核实游戏内主题工作区、普通游戏界面、Lobby/Init 选择页与 GlobalEnh 选择页之间的主题切换和表现应用管线。重点追踪含用户自定义背景图层的主题切回无额外图层的一般主题，以及反向切换时的内容、变量、背景层和宿主表现是否同步。

本 Task 当前是问题调查记录，不授权改动主题机制或 UI 刷新实现。

## 用户报告

- 当前项目有多种界面切换后表现内容没有成功刷新的情况。
- 特别是带额外图层的主题与无额外图层的一般主题之间，互相切换时显示不稳定。
- 调查范围包括主题工作区离开/返回，以及进入和离开 Init / GlobalEnh 选择页的转场。

上述是待复现现象，不代表以下任一代码路径已经证明为根因。

## 已确认的源码事实

1. 一般应用页面由 `UIController.render()` 建立。开始生成页面前调用 `syncRuntimeTheme()`；常规页面挂载后调用 `applyTheme(false)` 并恢复主题浮窗状态。主题应用会重建 `ColorSystem.runtimeTheme()` 对应的 CSS 变量、表现宿主背景和外层背景。
2. Lobby（`!started && service === 'game'`）在 `render()` 中调用 `renderInitSelect()` 后提前返回，因此该分支不经过同一轮常规 `applyTheme(false)` 和主题浮窗恢复。
3. Init / GlobalEnh 选择页由 `controller-panels.ts` 的 `renderSelectorPage()` 单独重建 `#app`，并调用 `syncOuterBackground()`；聚焦实体、选择页状态和当前区域则由 `selector-theme.ts` 的 `projectSelectorTheme()` 另行投影到选择页局部 DOM。
4. 选择页翻面和聚焦项切换由 `SelectorPage` 更新局部投影和 current/next 背景槽；该投影不写入运行时场景主题栈。选择页主题包含运行时背景、聚焦实体背景、区域背景及确定性回退背景的合并。
5. 常规主题应用与选择页投影使用不同入口。常规入口按 `RuntimeThemeManager` 的层序解析用户层、预览层、场景层及临时演出层；选择页通过自己的 `mergeSelectorBackgrounds()` 合并局部背景。
6. 背景解析器 `buildBackgroundView()` 在输入层为空或全部层无法解析时会构造渐变回退层；选择页在聚焦主题/状态没有有效层时也会生成 `selector-focus-atmosphere`。
7. 用户主题编辑的预览由 `ColorSystem.setUserThemePreview()` 写入运行时预览层；编辑器打开和关闭流程分别设置/清除预览并触发页面重渲染。顶层 UI 事件中 `themeChanged`、`entityThemeChanged` 和 `userThemeChanged` 会调度重渲染。
8. 现有 `controller-global-enhancement.test.ts` 覆盖 Init 与 GlobalEnh 面翻转、GlobalEnh 购买后局部刷新、选择页重建时旧动画作废及从游戏页打开 GlobalEnh。`selector-theme.test.ts` 覆盖投影构造、同 ID 替换/匿名层追加和选择页 DOM 装配；这些测试没有证明“用户额外图层主题 ↔ 无额外图层一般主题”跨主题工作区、Lobby 与 mid-game GlobalEnh 的完整往返。

## 需后续复现与核实

- 主题工作区或用户主题编辑器预览打开时切换到 Init / GlobalEnh，再返回游戏：检查选中主题、背景列表、颜色变量、全局 body 背景、Host 背景以及浮窗开关状态是否一致。
- 从含图片/渐变/纯色额外层的用户主题切换到无用户层的一般主题，再切回：检查旧 DOM 背景、内联 CSS 变量、禁用/忽略层、系统颜色层、图层排序和主题来源状态是否残留或丢失。
- 对照 Lobby、普通游戏、服务 Workspace 和 mid-game GlobalEnh 的进入/退出路径，确认各自是否执行了必要的解析、变量注入、宿主刷新和场景清理。
- 区分预览层、已应用用户主题层、Init/Area 场景层、GlobalEnh 实体主题投影与剧情临时层，确认切换时是应保留、重新投影还是清理。
- 依据真实复现收敛根因及责任边界；不要预先把问题归结为 CSS、DOM 全量刷新或 Theme Runtime 的单一缺陷。

## Read Set

- `src/ui/controller.ts`：`render()`、`syncRuntimeTheme()`、`applyTheme()`、选择页/Workspace 路由入口。
- `src/ui/controller-panels.ts`、`src/ui/selector-page.ts`、`src/ui/selector-theme.ts`：选择页独立渲染、翻面和局部主题投影。
- `src/ui/controller-theme.ts`、`src/ui/controller-events.ts`、`src/ui/controller-modals.ts`：运行时主题注入、变更事件、用户主题预览应用/清理。
- `src/ui/background-service.ts`、`src/ui/outer-background.ts`、`src/ui/presentation-service.ts`：背景回退、外层背景和 Host 刷新。
- `src/engine/core/theme-runtime.ts`、`src/arona-clicker/services/color-system.ts`、`src/arona-clicker/services/user-theme-layer-service.ts`：运行时层级与图层内容。
- `tests/ui/controller-global-enhancement.test.ts`、`tests/ui/selector-theme.test.ts`、`tests/ui/theme-tree.test.ts` 与后续复现所需的相关 UI 测试。
- `docs/docs-828/02-modules/ui.md`、`docs/docs-828/07-audit/presentation-editor-consistency.md`、`docs/docs-828/07-audit/dom-refresh-chains.md`。

## 边界

- 这份记录只整理切换逻辑与已确认管线，不修改代码、样式、主题协议或游戏状态。
- 不将历史审计/计划文档中的旧结论直接视为当前根因；后续处理须回到当前源码、定向测试和浏览器复现。
- 本次未运行测试或浏览器验收。

## 后续验收方向

- 建立覆盖上述转场矩阵的可重复步骤，并记录每步来源主题、图层、路由/选择页面和预期结果。
- 根因结论能对应到具体主题层/刷新入口及失效边界，不以“全量重渲染次数”替代实际背景、变量和宿主内容核验。
- 后续修复范围与回归验证另行裁定；稳定机制再按文档维护约定沉淀到 `docs/docs-828/`。
