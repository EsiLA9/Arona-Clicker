# Task：Runtime Editor 面板最小范围 DOM 刷新

状态：active — U1/U2 已施工并通过定向验证；U3 等待可用编辑态包完成内容编辑器桌面验收

## 目标

重整游戏内 Runtime Editor 浮动面板的刷新边界，使面板已打开时的普通交互和内容变化只更新实际受影响的 DOM 区域，保留未变化节点的 identity，并避免以完整 panel `innerHTML` 重建来处理局部状态变化。

本 Task 覆盖 Runtime Editor panel 各 surface，重点包括内容浏览器的类型切换、搜索筛选、条目选择、Draft 保存、Apply 状态收敛及 Codex 页面切换。验收以 DOM identity、更新范围和交互连续性为准，不以调用了某个局部 render 函数作为充分证据。

## 设计边界

- 本 Task 包含：定义刷新等级与唯一完整重建条件；为 panel shell、header、surface body 和内容浏览器子区域建立稳定更新边界；合并一次用户动作引发的多个 DOM 更新；保留滚动、焦点、输入值和浮动层锚点连续性；添加回归证据。
- 明确非目标：不改变编辑数据、Policy、Draft / Apply 语义、持久化、Datapack 命令、内容范围、三栏视觉设计或 `#app` 主界面刷新机制；不扩充 22 类内容编辑能力（归 `task-0176`）；不重写 Codex 查询和关系语义。
- 保持 body-level panel 与主 `#app` 生命周期分离。关闭面板时可以移除面板；首次打开时可以挂载初始结构。编辑目标包切换若需要更换整个 surface 内容，仍应尽量保留 panel shell。
- 所有 DOM 替换须遵守 `docs/ai/frontend-design-project-overlay.md` 的 mutation range、稳定节点、scroll / focus / hover 连续性和 DOM budget 要求。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Runtime Editor 浮动 panel host 位于 `document.body`；`syncRuntimeEditorPanel()` 当前对打开中的 panel 重新执行整棵 panel 渲染并赋值 `host.innerHTML`，随后重绑 surface 的动作。 | `src/ui/runtime-editor/actions.ts`：`syncRuntimeEditorPanel`、`openRuntimeEditorPanel` | 当前全 panel 重建入口集中，可作为收敛改造入口；须区分首次挂载与后续同步。 |
| 内容浏览器搜索和筛选通过行节点 `hidden` 更新，不重建列表。 | `src/ui/runtime-editor/actions.ts`：`syncRuntimeEditorBrowserFilter`、浏览器 search/filter handlers | 保留 behavior patch 路径，并用 identity 测试锁定。 |
| 浏览器条目列表同步会生成完整 workspace HTML 作离屏参考，再替换列表内容；保存后可能先调用 `openRuntimeSpotEditor` / `openRuntimeDefinitionEditor` 更新详情，再刷新列表。 | `src/ui/runtime-editor/actions.ts`：`syncRuntimeEditorBrowserEntries`、`saveRuntimeSpotDraft`、`saveRuntimeDefinitionDraft` | 单次保存应整理成有明确目标范围的一次收敛，避免重复渲染/重复替换；若移除离屏整页 render，应保留正确性。 |
| 选择条目只重绘 detail slot，并同步列表选中态和 Apply footer；type / surface 切换现有路径可能走整 panel 同步。 | `src/ui/runtime-editor/actions.ts`：`syncRuntimeEditorBrowserDetail`、`openRuntimeDefinitionEditor`、`bindRuntimeDatapackEditorActions` | 详情选择路径继续保持局部；类型切换需替换所需 panes / body，而不是销毁 shell 和无关稳定节点。 |
| `#app` 全量 render 会移除主树，但 Runtime Editor panel 是 body-level 宿主；Controller 另有全量/面板/区域/行为刷新层级和 UI 更新诊断计数。 | `src/ui/controller.ts`：`render`、`refreshPanels`、`UIRefreshStats`；`src/ui/runtime-editor/view.ts`：`renderRuntimeEditorPanel` | panel 刷新需与主 UI 更新分开核算，且主界面 `render()` 不应作为 Runtime Editor 更新的间接入口。 |
| Task 0180 已建立三栏工作区、条目选择局部详情刷新和 Codex detail slot 局部刷新基线。 | `docs/plan-work/archive/task-0180-runtime-editor-shared-content-workspace.md` | 本 Task 继承工作区与编辑语义，仅推进更严格的面板 DOM 生命周期，不重复设计视觉外壳。 |

## 刷新契约与 DOM budget

```text
DOM budget:
- 新增 wrapper / 节点数量：默认 0；只有建立稳定更新边界且证明现有节点无法承担时才新增，逐项记录数量与职责。
- 稳定节点：panel host、panel shell、panel header、当前 surface body、内容浏览器类型导航 / entry pane / detail slot / footer；无关范围更新时保持节点 identity。
- behavior patch：搜索过滤可见性、条目选中态、计数、Apply 可用态、surface 标题/状态等语义值。
- region 替换：确实变化的 surface body、类型导航内容、条目列表内容、详情表单内容；替换范围不得越过稳定 panel shell。
- 允许完整 panel render：首次打开/挂载；关闭时移除；显式恢复损坏或缺失的 panel host 的防御性路径。普通 click、输入、筛选、选择、保存、删除/恢复、Apply 完成和 surface 切换不得替换整个 panel shell。

Interaction preservation:
- 搜索和筛选不得重建 entry row；滚动位置不变。
- 单项选择不得重建类型导航、条目列表或 shell；焦点按触发控件的交互语义保留。
- 列表内容确需替换时保留搜索值、滚动位置、筛选、选中条目；焦点若落在被移除子树中，按明确规则移至同一操作的稳定目标。
- 仅在被替换 range 内处理 popover / 锚点；未受影响 range 的 hover / tooltip 保持存活，断开锚点不得残留。
- surface 切换时保留 shell/header稳定节点；滚动与焦点按目标 surface 定义恢复策略，不做无根据的跨 surface 复用。
```

## 施工切片

### Patch Unit 与 Receipt

| Unit | 范围 | 状态 |
| --- | --- | --- |
| 0194-U1 | 稳定 panel shell、surface/header/body 分区更新、Codex 事件只绑定一次；加入 shell identity 回归 | complete |
| 0194-U2 | 内容浏览器更新收敛、列表替换和筛选/滚动状态回归 | complete |
| 0194-U3 | 全量定向验证、桌面交互与终态文档收尾 | active；编辑器验收待可用目标包 |

Unit 的 Read Set、白名单和收据内联在本表后；每个 Unit 按 PROJECT-CONSTITUTION 执行。

#### 0194-U1：稳定面板壳与分区刷新

**Goal**：打开的 Runtime Editor panel 保留 `.runtime-editor-panel` shell，只替换 header 内容和当前 surface body；Codex 委托监听器在复用 shell 后不重复绑定。

**Read Set**：`docs/plan-work/task-0194-runtime-editor-panel-minimal-dom-refresh.md`；`docs/ai/PROJECT-CONSTITUTION.md`；`docs/ai/frontend-design-project-overlay.md`；`src/ui/runtime-editor/actions.ts` 的 `syncRuntimeEditorPanel`、`bindRuntimeEditorCodexActions`、`bindRuntimeDatapackEditorActions`；`src/ui/runtime-editor/view.ts` 的 `renderRuntimeEditorPanel`；`tests/ui/runtime-editor-codex-integration.test.ts`。

**Confirmed Facts**：panel 在 body-level host；当前同步会 `host.innerHTML` 替换整面板；Codex 动作通过 scope 级 input/toggle/click 委托绑定；Datapack Editor 事件多数绑定到新生成的具体控件，panel capture listener 已有一次性标记。

**Constraints**：不改变表单/编辑/Apply 语义；不修改 `#app` 刷新；保留 panel shell identity；若目标文件存在任务开始前的未提交改动，只能基于当前文件增量修改，不得重置或覆盖。

**Allowed Files**：`src/ui/runtime-editor/actions.ts`、`tests/ui/runtime-editor-codex-integration.test.ts`。

**Explicit Non-goals**：本 Unit 不整理 browser list diff、不改 view/CSS、不添加通用 mutation 框架、不处理与 Runtime Editor 无关的工作树变更。

**Stop Conditions**：按 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件；若稳定 shell 要求改动白名单外事件生命周期或子弹窗管理，停止并上报。

**Completion Criteria**：普通 surface 重同步保留 panel 与 header/body 宿主节点 identity；Codex 重复同步后一次操作只触发一次状态转换；定向测试通过。

**Verification**：`npx vitest run tests/ui/runtime-editor-codex-integration.test.ts`；`npx tsc --noEmit`。

**Receipt**：施工完成后追加实际变更、命令与结果、未完成项。

**0194-U1 Receipt（2026-10-03）**：`syncRuntimeEditorPanel()` 复用已挂载的 panel、header、body 宿主，只在对应 HTML 变化时替换其内部节点；替换前按范围关闭浮层，恢复焦点和浏览器列表滚动。Codex panel 委托绑定增加稳定标记，避免 shell 复用时重复注册。`runtime-editor-codex-integration.test.ts` 增加宿主/内容 identity 和状态写次数断言。集成测试 17/17 通过；`npx tsc --noEmit` 通过。工作树其他既有改动未清理。

#### 0194-U2：内容浏览器单次区域收敛

**Goal**：保存/创建/删除等 Draft mutation 在一次动作内最多重绘一次列表区域，并保持搜索、筛选、滚动和选中状态。

**Read Set**：Task 0194 的刷新契约；`src/ui/runtime-editor/actions.ts` 的 `syncRuntimeEditorBrowserEntries`、`syncRuntimeEditorBrowserDetail`、`saveRuntimeSpotDraft`、`saveRuntimeDefinitionDraft`；`src/ui/runtime-editor/view.ts` 的 browser entries/detail renderers；`tests/ui/runtime-editor-codex-integration.test.ts`、`tests/ui/runtime-editor-definition.test.ts`。

**Allowed Files**：`src/ui/runtime-editor/actions.ts`、`src/ui/runtime-editor/view.ts`、`tests/ui/runtime-editor-codex-integration.test.ts`。

**Explicit Non-goals**：不改变 CRUD / Apply 结果，不将行级 diff 作为强制实现；不更改内容表单字段或样式。

**Completion Criteria**：identity 测试证明 shell、导航和详情外的稳定节点未被无关重建；列表更新次数受控且搜索/筛选/滚动状态正确；定向测试通过。

**Receipt**：开工时补全预算、白名单和停止条件，完工后记录实际证据。

**0194-U2 Receipt（2026-10-03）**：内容浏览器列表刷新改为直接调用 `renderRuntimeEditorBrowserEntries()` 生成 entries region，不再离屏构造完整 workspace；新增搜索/筛选保留 entry row identity 的断言。集成 + definition 定向测试 29/29 通过，类型检查通过。Draft 保存中详情与列表仍各自只更新所需 region，未改动 Draft / Apply 语义。

#### 0194-U3：最终验证与交接

**Goal**：按 Task 验收范围验证更新等级、交互连续性和工程回归，补齐最终核验与剩余工作。

**Allowed Files**：Task 0194 与 `docs/plan-work/00-index.md`；若实现修复需越过此前 Unit 白名单，应先建立新 Unit。

**Completion Criteria**：完成定向 Runtime Editor UI 测试、类型/架构/文档/构建/diff 检查及可用桌面交互核验；记录未执行项及原因。

**Receipt**：保留实际命令输出摘要、DOM identity / 浏览器观察与剩余工作。

### P0：刷新调用图与基线

- 追踪所有 `syncRuntimeEditorPanel()` 调用方，按首次挂载、surface 切换、Draft 变更、Apply、关闭、包目标切换分类。
- 对内容浏览器保存、类型切换、条目选择、筛选、Apply 完成和 Codex 详情页签记录当前重建范围、DOM identity、scroll/focus 行为与调用次数。
- 若源码实际路径与本 Task 表格不符，先更正文档事实并据证据调整实现边界。

### P1：稳定 panel shell 与分区刷新入口

- 将 panel shell/header 与可更新 surface 内容分开，避免普通同步对 host 或 panel shell 执行整棵 `innerHTML` 替换。
- 建立统一且显式的 mutation range 更新入口；替换前后处理受影响区域的 popover 锚点和节点恢复，不引入仅为抽象而存在的刷新框架。
- surface / 内容类型变化只替换所需内容区；header 文本、导航选中态等可由 behavior patch 更新。
- 事件委托绑定在稳定祖先上，避免每轮局部刷新重复绑定被保留节点上的监听器。

### P2：内容浏览器更新收敛

- 保持搜索和筛选为 behavior 更新；条目选择只更新 detail slot、选择标记和 footer 状态。
- Draft 保存、创建、删除/恢复、Apply 完成等批次只对变化区域进行一次 UI 收敛；消除“打开编辑详情”与“刷新列表”造成的重复 render / DOM mutation。
- 更新列表时恢复搜索、筛选、滚动与选中状态；空态、计数和 Apply 状态随相同批次一致更新。
- Codex 保持已有 pane/detail 局部更新范围，不得因共享 panel 外壳而退化为整面板更新。

### P3：回归与桌面交互核验

- 加入 UI 测试，直接断言面板 shell、未变化 pane、列表行等节点在对应行为后保持 `isSameNode`；断言预期更新区域发生变化。
- 覆盖快速连续搜索/筛选、选择、保存、类型切换、Apply 后收敛、surface 切换、面板关闭/重开及主 `#app` render 时 panel 生命周期。
- 在桌面浏览器核验焦点、列表滚动、编辑输入、tooltip/popover 锚点与列表空状态，不以仅检查计数器代替交互证据。

## 测试与验收

- [ ] 打开中的 Runtime Editor 在搜索、筛选、普通条目选择、Draft 保存、删除/恢复、Apply 完成和 surface 切换时不替换 panel shell；关闭面板除外。
- [ ] 搜索/筛选保留全部 entry row 节点 identity，仅更新可见性、空态及关联状态。
- [ ] 条目选择只更新详情内容和必要选中/页脚属性；类型导航和 entry list 保持 identity。
- [ ] Draft 批量变更每次用户动作最多进行一次列表 region 收敛；详情和页脚同步到同一最终 Draft 状态，不出现中间态闪烁。
- [ ] surface 或类型切换只替换必要 body/pane；header shell 和未变化区域保持 identity，状态与焦点符合定义策略。
- [ ] 主 `#app` 全量 render 不意外重建 body-level Runtime Editor panel；显式关闭/重开及缺失 host 恢复正确。
- [ ] 被替换区域的 popover 不留下断开锚点；未受影响区域的 tooltip、滚动与焦点不被误伤。
- [ ] 定向 Runtime Editor UI 回归、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`npm run build` 与 `git diff --check` 通过；桌面浏览器完成上述关键交互验收。
- [ ] 记录 UI refresh diagnostics 与 identity 断言证据、DOM budget 实际值和未覆盖情形；所有施工 Unit 均有 Receipt。

## 当前核验（2026-10-03）

- 已检查 `docs/docs-829/00-INDEX.md`、UI 刷新路由、`docs/ai/frontend-design-project-overlay.md`、`src/ui/runtime-editor/actions.ts`、`view.ts`、`src/ui/controller.ts`、归档 Task 0180 和相关 UI 测试。
- Task 执行开始（2026-10-03）：发现工作树已有广泛未提交修改，包含本 Task 涉及的 `actions.ts`、`view.ts` 与 UI 测试；明确保留其现状并只做增量修改。调用点已分类：面板入口/同步、目标包切换、导出错误、Apply 错误与状态收敛、close、browser detail helper。当前主风险为打开状态同步整树替换 host 内容，以及 shell 复用时 Codex 事件重复绑定。
- U1/U2 施工：同步路径已保留 panel/header/body 三个宿主节点；仅在对应片段 HTML 实际变化时才替换其子树，替换前按范围关闭浮层，恢复焦点和浏览器列表滚动；Codex panel 级委托监听器增加一次性绑定保护。浏览器条目同步改为直接渲染 entries region，不再离屏构造完整 workspace。
- U1/U2 回归证据：`tests/ui/runtime-editor-codex-integration.test.ts` 新增 panel/header/body 与 Codex workspace identity 检查、委托状态写入次数检查、搜索/筛选保留 entry row identity 检查。
- 初次联合验证因 U2 新 wrapper 调用参数错误失败；已修复参数并重跑。`npx vitest run tests/ui/runtime-editor-codex-integration.test.ts tests/ui/runtime-editor-definition.test.ts --reporter=dot`：2 文件 / 29 项通过。
- 最终工程检查：`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（561 篇 / 0 errors）、`npm run build` 均通过。构建只有既有大 chunk 警告；作用文件 `git diff --check` 通过，只有 CRLF→LF 提示。
- 12 个 Runtime Editor 定向测试文件批次：11 文件 / 99 项通过；`runtime-editor-pack-export.test.ts` 的 2 项失败。失败来自当前工作树既有的 `renderRuntimeEditorTargetPicker()` 调整：测试传入没有 `game` 的 `UIContext` stub，而该渲染函数读取 `ctx.game.getPackCatalog`。这是本 Task 开始前已有的未提交 `view.ts` 改动；本轮没有扩展范围修改。
- 桌面验收已在本地游戏页打开 Runtime Editor 超级图鉴，完成条目选择与“概览 → 关系”切换，详情内容和焦点正常。当前应用无可用编辑态 Mod，内容浏览器停在目标选择空状态，因此真实编辑 Draft 的桌面操作未验收；没有创建或持久化额外数据包。

## 剩余工作

- 本 Task：P0、U1、U2 与自动化回归已完成。U3 仍需在有可编辑 Runtime Mod 的环境验收内容浏览器真实编辑操作；并需确认上述已有 `runtime-editor-pack-export` 测试 stub 与 target picker 契约后重跑 12 个定向测试，再完成 Task 终态文档维护。
- 最终方向：本 Task 只处理 Runtime Editor 面板更新范围；内容类型覆盖仍由 `task-0176-base-runtime-editor-full-content-coverage` 独立推进。

## 相关路由

- [[docs/docs-829/06-wiki/50-ui/refresh-update]]
- [[docs/docs-829/02-modules/ui]]
- [[docs/ai/task-read-set-routing]]
- [[docs/ai/frontend-design-project-overlay]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[task-0176-base-runtime-editor-full-content-coverage]]
- [[task-0180-runtime-editor-shared-content-workspace]]（归档基线）
