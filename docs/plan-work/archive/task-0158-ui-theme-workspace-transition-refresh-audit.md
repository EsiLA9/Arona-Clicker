# Task：Theme Workspace 与 Init / GlobalEnh 选择页切换刷新审计

状态：active — 2026-09-27 归档时仍有转场矩阵未核验；剩余验收与全部修改需求已移交 Task 0161

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
9. 选择页和普通游戏页的背景来源不同：普通 `UIController.render()` 先同步运行时场景主题，再构造上下文；重启入口直接渲染选择页时不经过该同步。选择页把非空 `ctx.background` 当底层，再叠加焦点 Init 与 Area 图层；按稳定 ID 替换、无 ID 追加。因此旧运行时 Area 图层可以留在投影中，而焦点 Init 的 token / 渐变同时更新。

## 当前核验（2026-09-27）

- `UIController.render()` 会先调用 `syncRuntimeTheme()`；普通游戏页随后执行 `applyTheme(false)`。Lobby 分支在渲染选择页并标记挂载后提前返回，不经过普通页面的 `applyTheme(false)` 与主题浮窗恢复。
- 选择页入口 `renderInitSelect()` / `renderGlobalEnhancementSelect()` 直接走 `renderSelectorPage()`：重建 `#app`、同步外层背景、绑定选择页交互；聚焦 Init / GlobalEnhancement 的 `projectSelectorTheme()` 则把主题投影到选择页局部节点与当前/下一背景槽，不写回运行时场景主题栈。
- 用户主题编辑器开始编辑时设置临时 Preview 层；取消关闭时清除 Preview、丢弃草稿并重新渲染。保存应用与取消关闭是两条不同路径，需要分别复现。
- Lobby / 选择页和普通游戏页使用不同的主题应用入口；浏览器复现已确认，Init 选择页会保留前一场景图层，同时局部主题色已随焦点变化。失效边界限定为选择页背景基底继承；其它转场仍按下方矩阵继续核对。
- 已审阅 `controller-global-enhancement.test.ts` 与 `selector-theme.test.ts`：前者覆盖选择页翻面、重建和 mid-game 进入 GlobalEnhancement；后者覆盖局部投影与背景合并。现有用例未覆盖用户主题多图层与普通无额外层主题之间，经主题编辑器、Lobby、Init / GlobalEnhancement 选择页再返回游戏的完整往返。
- 已在本地浏览器复现用户给出的路径：从 `Schale_Office` 游戏页点击“结束当前游戏并重新选择世界线”，进入 `WORLD LINE / RESTART` 选择页。选择页随后聚焦到另一 Init（主题系统展示）；背景 DOM 仍保留原 Schale 的浅蓝基底、`Hoshino.png` 与两层 `background-triangles.svg`，并叠加主题展示 Init 自己的渐变层。截图中旧星野图层仍可见于下方；选择页局部主色已变为 `#2563eb`，文档根变量 `--ac-primary` 仍为 `#3b9eff`。这确认了“局部主题色随焦点变、前一场景背景仍混入选择页”的现象。
- 源码链已收敛到具体边界：重启按钮只设置 `started=false` / `pendingRestart=true` 并直调 `renderInitSelect()`；`renderSelectorPage()` 从现有 Runtime 取背景上下文并同步 body 外背景，但不调用 `syncRuntimeTheme()`；`projectSelectorTheme()` 又在 `ctx.background` 非空时将其作为 base。选择另一个 Init 时仅焦点 token / 渐变和同 ID 图层会被覆盖，前一 Init/Area 的其它图层不会因聚焦变化自动清除。
- 该结论定位了**选择页投影继承边界**，尚不代表主题编辑器预览保存/取消、普通 Init 进入后 CSS 变量、GlobalEnhancement 往返以及故事临时层都已完成核验。机制整理与修复范围另见 [[task-0161-theme-background-layer-lifecycle-pipeline]]。
- 未运行测试；现有测试主要覆盖单独图层合并、选择页焦点投影和轮盘刷新，没有覆盖“活动 Schale Area 图层 → 重启选择页 → 聚焦另一 Init → 再进游戏”的完整生命周期。

### 待执行复现矩阵

| 场景 | 转场 | 需记录的证据 |
| --- | --- | --- |
| 已应用的多图层用户主题 | 普通游戏 → Init 选择页 → GlobalEnhancement → 返回游戏 | 根级 CSS 变量、外层背景、选择页当前/下一背景槽、焦点实体、返回后的 Host 背景 |
| 无额外用户背景层的一般主题 | 同一转场路径，与多图层主题对照 | 同上；确认默认层、回退层与旧背景是否残留 |
| 用户主题编辑 Preview | 从普通游戏页或选择页打开编辑器，分别取消与保存应用，再进入/离开选择页 | Preview 层是否清除/保留、根级变量、主题浮窗开关与位置、背景宿主最终内容 |
| Init 与 GlobalEnhancement 局部切换 | 在选择页翻面并轮换聚焦项，再返回游戏 | `data-selector-theme-key`、当前/下一背景槽、顶栏投影及返回后的运行时主题 |

上述场景需分别记录转场来源与目标，使用相同数据包和主题配置对照；观察结果后再决定是否立修复 Task。

## 需后续复现与核实

- 主题工作区或用户主题编辑器预览打开时切换到 Init / GlobalEnh，再返回游戏：检查选中主题、背景列表、颜色变量、全局 body 背景、Host 背景以及浮窗开关状态是否一致。
- 从含图片/渐变/纯色额外层的用户主题切换到无用户层的一般主题，再切回：检查旧 DOM 背景、内联 CSS 变量、禁用/忽略层、系统颜色层、图层排序和主题来源状态是否残留或丢失。
- 对照 Lobby、普通游戏、服务 Workspace 和 mid-game GlobalEnh 的进入/退出路径，确认各自是否执行了必要的解析、变量注入、宿主刷新和场景清理。
- 按转场矩阵继续核对预览层、已应用用户主题层、Init/Area 场景层、GlobalEnh 实体主题投影与剧情临时层，确认各自应保留、重新投影还是清理。
- 对照用户全局主题/系统颜色层与场景专属背景层；不能用清空所有图层的办法掩盖归属边界。
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
