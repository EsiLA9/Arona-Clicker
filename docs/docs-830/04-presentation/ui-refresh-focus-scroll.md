# docs-830/04-presentation/ui-refresh-focus-scroll — 局部刷新、焦点与滚动

本文回答：状态变化后 UI 如何选择更新范围，并尽量保留用户正在操作和阅读的位置。

可复用栏按显示实例更新，普通栏的共享更新与复杂地图/交易页的专用更新边界见 [[workspace-columns-and-layout]]。面板和工作区滚动快照不再依赖物理列序；聊天包装层处理各个可见流，并以显示实例和业务流共同区分阅读位置。

## 更新范围与调度

Controller 按变更范围提交四类请求：`behavior` 改已挂载节点的值或属性，`element` 替换稳定身份的单个元素，`region` 更新一个内容宿主，`structure` 重建 Workspace 或整个 App。`UIUpdateDispatcher` 用 Surface key/generation 和更新身份合并同一微任务内的重复请求，再按结构、区域、元素、behavior 排序派发。

批量请求先过滤过期 Surface。App 结构更新会覆盖该批次的窄更新；Workspace 结构更新覆盖其下的区域/元素/behavior；区域更新会压掉同一宿主及其子宿主的元素和 behavior 请求。目标不存在或不支持时，Controller 的专用调用方决定按面板回退或重建 Workspace。

```text
事件 / Controller 命令
  → 生成更新请求并绑定当前 Surface token
  → 微任务合并 → 丢弃旧 generation → 结构化简与排序
  → 更新目标 DOM；必要时由调用方回退到更大范围
```

这不是所有事件共享的一条强制路径：`render()` 会全量重建 `#app`；`refreshPanels()` 按 Workspace 能力局部更新，部分类型尚有全量回退；高频资源数字则可用 `refreshLight()` 更新。

## 阅读位置与输入位置

面板/区域协调路径会在替换前捕获目标容器中的焦点，并在节点仍匹配时恢复；整页 `render()` 则保留面板、Workspace 与聊天流的滚动位置。聊天流由 `FlowScroll` 管理：用户原本贴底且出现新内容时跟到底；用户在上方阅读时，普通聊天按比例恢复，Map 信息流采用锚点模式；明确切回聊天等操作可要求滚到底。刷新前会清理即将失效锚点关联的浮层。

Map / 特定工作区还使用语义 region key 与 focus key 对应局部节点；保留的 DOM 身份可减少表单输入、焦点和滚动跳动。目标区域缺失时再补回所属区域，不因此默认重建整个 App。

源码入口：`src/ui/update/ui-update-types.ts`、`ui-update-dispatcher.ts`、`ui-surface.ts`、`src/ui/controller/controller.ts`、`src/ui/flow/flow-scroll.ts`、`src/ui/interaction/focus.ts`。

行为测试见 `tests/ui/ui-update-dispatcher.test.ts`、`scroll.test.ts`、`focus.test.ts`、`workspace-lifecycle.test.ts`。页面身份见 [[workspace-navigation-and-rendering]]。

## 从现象选择调查入口

资源数字、单张卡片、面板区域和整个工作区对应不同的更新尺度。调度器的合并规则及同一商店区域内更新被覆盖的具体例子见 [[update-dispatch-and-surface]]。

阅读位置保持也有前提：`FlowScroll.capture()` 在 DOM 重建前记录滚动位置、是否贴底和锚点；恢复时只有调用方要求跟随且用户原本贴底，才自动跟到底。用户在上方阅读时，调用方选择按比例或锚点恢复；明确要求 `force` 则滚到底。该机制不意味着所有界面刷新都自动调用它。
