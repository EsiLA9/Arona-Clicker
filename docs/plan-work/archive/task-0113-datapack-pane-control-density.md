# Task：数据包 Pane 控件层级与状态列收敛

状态：done — 2026-09-19 实现、自动化核验与浏览器交互验收完成，待归档

## 来源与问题

`task-0112-datapack-pane-group-order-and-mode-switch` 已将 `(ModId, VersionId)` 收敛为一个 Pane，但当前 Pane 的上下移控件仍与状态切换控件处于同一工具行；状态切换区还显示“模式 / 下次 Runtime 来源”提示，启用集操作位于 Pane 底部，增加了状态列的横向跳转。

## 目标

1. 将 Pane 的“上移 / 下移”放置到小 Pane 右上角，明确它作用于整个 Pane。
2. 移除“模式 / 下次 Runtime 来源”可见提示，只保留“普通态 / 编辑态”状态按钮。
3. 将当前普通态的启用集操作放到状态按钮列最右侧；已启用时显示“移出启用集”，未启用时继续显示“加入启用集”，核心包保持“始终启用”。
4. 保持状态切换、编辑态创建、Selection / Runtime Apply、编辑器目标和排序行为不变。

## 设计边界

- 上下移按钮仍使用 Pane 级事件和 `paneKey`，只改变 `draftOrder`，不改变状态选择或 Runtime。
- 状态列不再展示 Apply 时序文案；按钮本身仍保留当前态、待 Apply 和当前查看的必要反馈。
- 启用集按钮只操作普通态，不允许编辑态进入启用集；编辑器入口继续作为 Pane 的独立操作。
- 不改变数据包记录、持久化结构、Selection 存储、导入导出和删除权限。

## 施工切片

### P0：Pane 控件布局

- [x] 将 Pane 上下移按钮移动到 Pane 头部右上角。
- [x] 调整窄屏布局和键盘焦点顺序，保持按钮可达。

### P1：状态列收敛

- [x] 删除“模式 / 下次 Runtime 来源”可见提示及相关旧布局依赖；状态按钮可见文字只保留“普通态 / 编辑态”，Runtime / Apply 细节保留在按钮提示中。
- [x] 在状态按钮列最右侧放置普通态启用集操作。
- [x] 保留普通态 / 编辑态的当前状态、待 Apply、当前查看反馈。

### P2：测试与验收

- [x] 更新渲染断言，确认 Pane 仍只渲染一次、状态按钮仍为两个。
- [x] 验证普通态启用 / 移出启用集入口位置和核心包禁用语义。
- [x] 完成类型检查、定向测试、文档检查和浏览器交互验收。

## 最终核验（2026-09-19）

- 定向 Vitest：`tests/ui/service-workspace.test.ts`、`tests/ui/datapack-workspace-order.test.ts`、`tests/ui/datapack-workspace-state.test.ts`，26/26 通过。
- `npx tsc --noEmit` 通过。
- `npm run check:docs` 通过（扫描 242 篇 Markdown，0 errors）。
- `npm run check:architecture` 通过。
- `npm run build` 通过；仅保留既有大 chunk 警告。
- 浏览器验收通过：数据包管理页的 Pane 右上角存在 Pane 级上移 / 下移控件；状态列仅保留普通态 / 编辑态，旧提示计数为 0；当前状态按钮计数为 2；草案操作区仍存在。
- 浏览器当前核心包显示“始终启用”；普通态启用集操作沿用同一状态列最右侧位置，非核心包显示加入 / 移出启用集。
- AOCI `aoci_maintain` 已执行但仍因仓库既有 code drift / unbaselined 条目停止，未对本 Task 进行语义写入；该治理阻塞不由本 Task 新增。

## 非目标

- 不重新设计数据包 Pane 的排序算法或普通态 / 编辑态的数据模型。
- 不改变 Runtime Apply 的显式提交规则。
- 不新增数据包导入、导出、删除服务。

## 相关路由

[[task-0112-datapack-pane-group-order-and-mode-switch]]
[[docs/docs-828/00-INDEX]]
[[docs/docs-828/02-modules/ui]]
[[docs/docs-828/05-conventions/testing]]
