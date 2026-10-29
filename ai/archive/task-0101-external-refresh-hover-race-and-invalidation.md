# Task：外部刷新 Hover 竞态与失效范围收敛

状态：done — 2026-09-18 完成修复、专项回归与真实 Chrome 验收

## 目标

修复内容更新或外部事件触发 UI 刷新时偶发打断 hover / tooltip 的问题，确保：

- DOM 替换前后的 Popover 延迟计时器不会把已脱离文档的旧锚点重新打开；
- 一个实体的揭示或表现变化不会替换同组内未变化的卡片、导航项或 Region；
- 外部实体表现变化不再无条件触发整个 `#app` 重建；
- 宽事件广播不会把日志刷新和揭示检查放大为无关的交互中断。

本 Task 延续 task-0096 的刷新层级和 mutation range 契约；不改引擎事件语义、存档格式或 Workspace 路由语义。

## 已确认证据

1. `PopoverManager` 的 80ms `showTimer` 在 DOM mutation 时没有取消，延迟回调也没有检查 `wrap.isConnected`。真实 Chrome CDP 已复现：切换 Settings 后，旧 Spot tooltip 仍为 open，但当前页面连接的 tooltip anchor 数为 0。
2. `refreshRevealIfChanged()` 在单个揭示指纹变化后调用 Spot / Enhancement / Area 的集合刷新；集合刷新方法当前对所有预期 key 执行元素替换，因此未变化的兄弟元素也会失去 hover。
3. `entityPresentationChanged`、`themeChanged`、`userThemeChanged` 当前统一 `scheduleRender()`；其中 Runtime Effect 可从剧情或外部效果触发 `entityPresentationChanged`，无关实体变化也会重建整个 `#app`。
4. `EventBus.onAny` 对绝大多数非 Tick 事件同时执行揭示检查和日志刷新，增加了局部刷新叠加及刷新竞态的频率。

## 优先级与修改内容

| 优先级 | 修改内容 | 完成判据 |
| --- | --- | --- |
| P0 | 为 Popover 延迟显示增加 mutation 取消 / generation 校验，并在回调前检查锚点仍连接于当前 root | 全量或局部刷新后不得出现 disconnected anchor 的 open tooltip；旧计时器不能写入新 surface |
| P1 | 将揭示刷新收敛为元素目标更新；通过 markup diff 跳过未变化节点，集合变化才回退 Panel | 未变化的同组卡片 / 导航项 hover、tooltip、节点身份保持 |
| P1 | 为 `entityPresentationChanged` 建立实体到元素 / Region / Panel 的最小映射；不可见实体不触发 App render | 外部表现变化只更新受影响目标；当前 hover 不被无关实体变化关闭 |
| P1 | 收窄 `onAny` 的日志刷新条件，并消除特定事件与宽广播造成的重复刷新 | 无日志变化的事件不替换 Log Panel；同一事件链不重复刷新无关区域 |
| P2 | 扩展刷新观测，记录 mutation target、reason、surface generation 和 fallback | 能从诊断记录判断 hover 中断来自 timer、element、Panel 还是 full render |

## 施工切片

### P0：Popover 延迟竞态（已完成）

- [x] 将 `showTimer` 的取消能力提升到 mutation 生命周期可调用范围。
- [x] 延迟回调执行前检查 `wrap.isConnected`、当前 root 包含关系和 generation。
- [x] 刷新、销毁和跨 Workspace 切换时统一清理待显示与待隐藏计时器。
- [x] 增加 pending timer 单测与“悬停后 10ms 刷新、等待超过 80ms”的真实 Chrome 验收。

### P1：最小失效集合（已完成）

- [x] 为 Spot、Enhancement、Area nav 建立 element 更新目标；输出未变时保留原节点，不做无意义 `outerHTML` 替换。
- [x] 保留集合增删、排序、当前归属变化时的 Panel fallback。
- [x] 增加同组未变化卡片 / 导航的节点身份、tooltip 范围与刷新计数测试；滚动 / 焦点沿用现有局部刷新回归。

### P1：外部表现事件映射（已完成）

- [x] 梳理 `entityPresentationChanged` 的 entity key 到当前页面节点 / Region 的映射。
- [x] 当前节点不可见或不在当前 Surface 时不触发 `render()`。
- [x] 主题提交仍保留安全 full-render 降级；Runtime 表现覆盖优先走最小范围刷新。

### P1：宽广播收敛（已完成）

- [x] 为日志建立最新日志 entry revision 判定；没有新增日志的外部事件不替换 Log Panel。
- [x] 为特定事件与 `onAny` 的组合增加刷新计数断言，确认不会重复刷新无关区域。

### P2：刷新诊断（已完成首版）

- [x] `UIRefreshObservation` 记录 `element` scope、reason、surface key / generation、outcome 与 fallback reason；`data-ui-refresh-element*` 计数可用于浏览器验收。
- [x] 详细 mutation range 可视化与 Runtime Editor 批量计数继续由 task-0100 承接，不阻塞本 Task 的 hover 修复。

## 验收与测试

- [x] Popover 单元测试：pending show timer 在 scope mutation / full render 后不再执行。
- [x] UI 集成测试：无关 Spot / Enhancement / Area nav hover 在同组其他 key 更新后保持。
- [x] UI 集成测试：外部 `entityPresentationChanged` 对不可见实体不产生 full render。
- [x] UI 集成测试：无日志变化的外部事件不替换 Log Panel。
- [x] 浏览器级验收：Hover、tooltip、节点身份和 `data-ui-refresh-*` 计数；真实 Chrome 复现中旧 tooltip 保持关闭、旧锚点连接数为 0。
- [x] 运行 `npm test`、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 和 `npm run ui:callgraph -- --hot`。

## 实现摘要

- `PopoverManager` 将 show / hide timer 提升为实例状态；mutation 会取消待显示计时器，延迟回调同时校验 generation、`isConnected` 和当前 root 包含关系。
- `UIUpdateDispatcher` 新增 `element` 更新类型，Spot、Enhancement、Area nav 只在渲染结果确实变化时替换目标节点；未变化节点保留 DOM 身份，集合变化才回退 Panel。
- `UIController.refreshEntityPresentation()` 将 `spot`、`enhancement`、`area`、`variant` 映射到当前可见元素 / Region / Panel；不可见实体直接忽略，不触发 `#app` 全量 render。
- `onAny` 的日志刷新改为 revision 判定；没有新日志的外部事件不再替换 Log Panel。正式主题事件仍保留 full-render 安全降级。

## 最终核验

- 专项测试：Popover 4/4、Workspace lifecycle 10/10、Controller events 5/5。
- 全量测试：173 个文件、1607 个测试全部通过。
- 类型检查、架构检查、文档检查与 `ui:callgraph --hot` 全部通过；文档扫描 231 篇、错误 0。
- Chrome CDP：在实际游戏页对 Spot 卡片触发 hover，10ms 后切换 Settings，等待 180ms；结果为 tooltip `open=false`、Spot anchor `connected=0`，未出现旧内容残留。

## 关联

- [[task-0096-panel-granular-refresh-api-and-hover-continuity]]
- [[task-0100-ui-semantic-region-mapping-follow-up]]
- [[docs/docs-828/07-audit/dom-refresh-chains]]
