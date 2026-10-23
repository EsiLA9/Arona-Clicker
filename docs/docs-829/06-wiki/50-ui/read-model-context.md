# 06-wiki/50-ui/read-model-context — 组件的只读查询上下文

组件需要知道当前资源、可见性、区域、角色和表现，才能生成界面。Runtime 通过 GameReadModel 提供查询入口；`createUIContext()` 把常用视图、查询器和格式化 / 表现工具整理成渲染上下文。组件消费这些读取结果，不拥有 PlayerState 的写引用。

## 两个读模型

`GameReadModel` 定义于 `src/arona-clicker/contracts/runtime/runtime.ts`：它包含 `getView()`、可用的目录 / 世界 / 服务查询接口，以及故事和成就等专用投影查询。`getView()` 返回 `GameView`，在 `src/arona-clicker/runtime/runtime-game-instance.ts` 通过 `buildGameView()` 生成面向界面的快照；它不返回 PlayerState 本身。

`UIContext` 是更靠近组件的渲染输入，定义于 `src/ui/runtime/context.ts`。`createUIContext(game, background, presentation)` 读取一次 `game.getView()`，并附上 Registry / World 查询、名称格式化、HTML 转义、主题背景、Presentation 宿主状态及实体表现查询。组件可从 `ctx.view` 取这次渲染使用的 GameView，从 `ctx.game` 使用契约暴露的查询方法。对话、Operation 等需要窄投影的区域可以调用专用查询，不必复制进全局 GameView。

## “只读”的实际含义

只读是组件的架构边界：`UIContext.game` 的类型是 `GameReadModel`，它不暴露 `mutations`、命令门面、生命周期或存档写入；Controller 单独拥有 `GameCommands` 并代表界面发起命令。GameView 是视图数据，服务查询接口可以按自身契约读取。不要把 `Readonly<T>` 类型包装误读为深度冻结，也不要在组件里绕开命令接口写游戏状态。

常见链路：

```text
Controller 开始渲染
  → createUIContext(game, 背景视图, 表现视图)
  → ctx.view = game.getView()
  → render* 组件查询字段并生成 HTML
  → Controller 把 HTML 挂载或更新到 DOM
```

`src/ui/components/` 中的 `render*` 函数消费上下文；局部更新也会重新创建 UIContext，所以组件读取的是更新时的查询结果。控制器刷新 DOM 的具体范围见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]。

## 当前内容图鉴查询

`GameReadModel.runtimeContentBrowser` 暴露当前生效定义、详情和正反向关系的只读快照。Registry adapter 的一般关系规则与 Operation 规则按真实字段和 union 分支收集同一批边，再建立双向索引；`source` 始终是引用者，`path` 始终属于原始引用者。局部键保留 owner、context 与 `targetLocations[].path`，不创建虚假的全局条目。

`confidence=declared` 且非 candidate 的边才参与确定关系诊断；未知扩展中的疑似 ID、动态选择器进入技术候选。`referenceCoverage.status=partial` 明确规则覆盖有限，空结果不表示删除安全。剧情入口按 active/passive 契约解析；资源关系区分全局显示定义与局内角色资源。查询枚举忽略 accessor，并截断递归环。

来源仅接已有可靠 owner（Init／Area／Spot、角色差分、资源显示），不从 namespace 猜包。来源未确认的内容仍出现在全部范围；缓存包含 owner、已加载包与补充规则 revision，定义变更沿 Registry 的替换／重载边界更新。

图鉴 UI 通过 `src/ui/runtime-editor/view.ts` 的 `getRuntimeEditorCodexView()` 读取 `runtimeContentBrowser.getView()`，详情适配器再以 `getDefinition()` 和实体／资源关系查询补充资料。它不读取 Editor Draft 或 PackCatalog；分类、搜索、选择和阅读历史由独立的 `CodexShellState` 管理，不从玩家拥有或解锁状态筛选内容。

对应证明：`tests/data/runtime-content-browser.test.ts`、`runtime-content-reference-rules.test.ts`、`runtime-content-operation-references.test.ts`；`tests/engine/runtime-content-browser-published-content.test.ts` 在内存载入正式基础包与两份玩法B包，并接 Runtime 规则源检查确定关系。`tests/ui/runtime-editor-codex-integration.test.ts` 验证图鉴读取当前 Registry 有效视图且不依赖编辑态 `packRecordId`。UI 消费边界与连续性见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]。

## 证明路径与测试边界

`tests/ui/controller-init-select.test.ts` 验证 Init 选择后的 View 反映新会话资源及状态；`tests/ui/context.test.ts` 验证 `createUIContext()` 的背景、宿主状态、父级回退和文字颜色查询。它们分别覆盖 View 消费与 UI 表现查询，不等于验证每一个组件。

View DTO 字段的权威列表：[[docs/docs-829/03-data-structures/game-view]]。输入命令：[[docs/docs-829/06-wiki/50-ui/controller-commands]]；返回 [[docs/docs-829/06-wiki/50-ui/00-index]]。
