# 星图、世界线概览与主题交接

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 选择页节点图谱

顶栏保留在最上层。SVG 轴测平面铺满选择页背景，不套画布卡片框。右侧独立浮动工作台承载详情与命令。比例尺固定在图面左下角，进入子图时提供较大的返回按钮，不额外显示状态图例。节点用 `g[role=button]`，位置 / 连线只作呈现。可见性、拥有、价格与动作仍来自 RevealStage、`UIContext` 与 GameCommands。比例尺 / 滚轮锚定缩放只改相机，购买后原位刷新节点与工作台，不整页重建。

源码入口为 `src/ui/components/navigation/selector-graph.ts`、`src/ui/navigation/selector-page.ts`、`src/ui/css/selectors.css`。

## 节点名称和场景前景色

星图节点名称统一对比当前星图场景背景：`.selector-graph-canvas` 在节点局部主题之外解析 `--ink-on-canvas` 为自身 color，标签通过 currentColor 继承已解析前景色，避免节点各自的 ThemeTree 把名称误配成白字。普通 / 选中 / 迷雾名称均使用此关系，不再染主题强调色、使用半透明文字或描边。状态仍由节点图形表达。主题切换沿用既有局部变量更新，不替换标签 / 画布。入口为 `src/ui/css/selectors.css` 与 `selector-theme.ts`。明暗底、相反节点主题、各状态及原位切换由 `tests/ui/theme/selector-label-contrast.test.ts` 验证。

## 进入功能页时的主题延续

从星图顶栏进入设置、背包等功能页时，沿用 `SelectorPage.currentTheme()` 的完整聚焦投影，包括当前 Init / Area、背景与顶栏表现。同一功能区内切换页面继续沿用。返回游戏或在功能页明确激活其他主题时清除该 UI 临时来源。缺少可判定画布底色时回退到本地 `variables.css` 已有的浅色基础与深色正文，不再假定深色画布。入口为 `SelectorPage.currentTheme()`、`UIController.navigateToService()`、`controller-theme.ts`。

## 详情工作台与 Init 概览

选择页右侧详情通过稳定的收起／展开按钮切换 `hidden` 与 `aria-expanded`，不替换工作台、滚动容器或画布。Init 的进入 CTA 先打开左侧世界线概览中转页（`renderInitOverview`），隐藏星图与右侧详情，保留顶栏、相机、子图历史和选中项。背景沿用 Init 投影，不叠加恢复区域的 Area 背景。概览只读取当前 View 或对应 Init 快照，确认进入才调用既有新建／恢复命令。返回星图或 Escape 恢复原按钮焦点与原画布。从世界线的结束游戏或硬重置入口离开时，也先停留在刚离开的 Init 概览。玩家主动返回星图后再展开节点图，排队的页面刷新保留该停留状态。该状态只由 `SelectorPage` 持有，不进入存档。复用与行为入口：`src/ui/components/world/init-select.ts`、`src/ui/controller/controller-panels.ts`、`tests/ui/controller/controller-init-select.test.ts`、`tests/ui/workspace/selector-graph-navigation.test.ts`。

## 跨图过渡与背景交接

选择页图间导航由 `src/ui/navigation/selector-graph-transition.ts` 在同一 SVG 中暂存新旧 world 与过渡图层，保留顶栏、画布与工作台外壳。Portal 显示母图星座时，进入按“图收成真实星座 → 沿跨图曲线绘线 → 展开子图”呈现。返回先沿曲线反向绘线，再由 Portal 比例、关联星点和两端相机推导共同的空间变换，让母图星座恢复完整母图布局，原子图的节点、边、高程与网格同步放大并可移出屏幕。原子图围绕关联星点额外扩张至三倍，逐渐失焦并在后段淡出，母图完全恢复后再整体回收。连线持续跟随关联端点，节点与高程投影的渲染尺寸最多为原尺寸的 1.5 倍。进入约 1.3 秒、返回约 1.4 秒，线抵达后才切换详情。绘线遵守 Portal 的独立开关，无星座时使用放慢的节点过渡。初次进入按图与星座的实际范围取景。节点聚焦及导航抵达的背景交接由 `src/ui/presentation/selector-scene-background.ts` 承担：保留不透明旧底，只淡入新层。快速切换冻结当前合成画面，图片就绪后交接，完成后复用已加载的新层并回收旧层。沿用原有主题与约 420ms 背景淡入，不新增装饰。行为证明入口：`tests/ui/workspace/selector-graph-navigation.test.ts`、`tests/ui/theme/selector-scene-background.test.ts`。
