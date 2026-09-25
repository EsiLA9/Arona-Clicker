# Task：数据包 Pane 级排序与普通态 / 编辑态双按钮切换

状态：done — 2026-09-19 实现、自动化核验与浏览器交互验收完成，待归档

## 来源与问题

`task-0111-datapack-pane-slots-selection-and-atomic-apply` 已建立 `(ModId, VersionId)` Pane、普通态 / 编辑态独立记录、按 Pane 持久化 Selection 和全局 Runtime Apply。

当前数据包管理页的显示层仍把 Pane 内的两个记录分别渲染为 `pack-entry`：上下移按钮挂在单个记录上，导致同一 `(ModId, VersionId)` 的普通态和编辑态可以被拆开移动；同时 Pane 内出现两份完整数据包操作区，模式切换入口重复。

本 Task 只修正管理页的聚合显示、排序草案和模式操作入口，不回改已归档 Task 的数据包记录、Selection 持久化、编辑器目标或 Runtime Apply 契约。

## 目标

1. 以 `(ModId, VersionId)` 对应的 Pane 作为数据包列表的唯一显示和上下移动单位。
2. 同一 Pane 内的普通态、编辑态不再渲染为两份完整数据包条目。
3. 每个 Pane 只提供普通态、编辑态两个状态按钮，用于已有状态的切换或编辑态创建。
4. 保留普通态 / 编辑态底层记录的独立性，不复制、覆盖或合并已存在记录。
5. 保持创建状态、Selection、Runtime 和 Apply 的既有边界。

## 设计边界

### Pane 是排序单位

- 列表中的一项对应一个 `PackCatalogPane`，其身份为 `paneKey = ModId@VersionId`。
- 同一 Pane 内的 fixed / editing 记录在 `draftOrder` 中作为连续块移动。
- 移动 Pane 不改变记录内容、启用状态、Selection 或 Runtime。
- 核心数据包所在 Pane 继续固定在最前，不允许被普通 Pane 越过。
- 非「全部数据包」分区继续只读，不提供排序操作。

底层 `draftOrder` 仍可保存记录 ID，以兼容现有 `PackManager` 配置校验；UI 移动时必须按 Pane 分组重建 / 移动记录块，不能交换单个记录 ID。

### Pane 内的两个状态按钮

每个 Pane 的模式操作只显示两个按钮：

```text
ModId · VersionId

[普通态] [编辑态]
```

- 已有普通态时，普通态按钮可选择 / 切换到 fixed 记录。
- 普通态不存在时，不提供直接创建普通态入口。
- 已有编辑态时，编辑态按钮只切换到已有 editing 记录，不重新复制、不覆盖内容。
- 编辑态不存在且普通态存在时，编辑态按钮执行 fixed → editing 的完整内容复制。
- 创建编辑态后不自动改变 Pane 的待 Apply Selection，也不触发 Runtime Apply。
- 已有记录的查看、编辑器打开、删除和导出动作不改变底层记录边界；不在本 Task 中重新设计文件服务。

“当前查看哪条记录”和“下一次 Apply 使用哪种状态”继续保持可区分。按钮事件不得通过全局编辑态、最近一次编辑器目标或浮窗上下文推断写入目标。

### 状态与视觉层级

- Pane 卡片承载身份、普通态 / 编辑态存在状态、当前 Runtime / 待 Apply 提示和两个状态按钮。
- 不再在 Pane 内为 fixed / editing 各渲染一份完整 `pack-entry`。
- Pane 卡片内部不承担独立数据包排序；上下移动控件只属于 Pane。
- 列表区域继续滚动，Pane 内部按钮保持键盘可达并提供明确的禁用原因。

## 当前事实与代码落点

- `PackCatalogPane` 已在 `src/arona-clicker/contracts/runtime.ts` 提供 fixed / editing 槽位、Selection 和 Runtime 记录身份。
- `PackManager` 已按 Pane 聚合记录，并以记录 ID 保存 `draftOrder`；本 Task 不修改其存储格式。
- `src/ui/components/service-workspace.ts` 的 `renderPackEntry` 当前承载单记录上下移和复制 / 打开编辑器按钮，`renderPackPane` 当前再将两份完整条目包在同一 Pane 中。
- `src/ui/workspace/datapack-workspace-state.ts` 的 `moveDatapackDraft` 当前交换单个记录 ID，需要增加 Pane 块级移动能力。
- `src/ui/controller-actions-topbar.ts` 当前监听单记录 `data-pack-draft-up/down`，需要改为 Pane 级事件。
- `src/arona-clicker/services/datapack-workspace-view.ts` 当前提供单记录移动可用性判断，需要补充 Pane 级可移动性投影或由状态层统一计算。

## 施工切片

### P0：Pane 块级排序

- [x] 增加按 `paneKey` 识别记录组的 UI 草案排序辅助方法。
- [x] 移动时保持同一 Pane 内已有记录的相对顺序，并将整个记录组上下移动。
- [x] 处理固定核心 Pane、缺少 fixed 或缺少 editing 的 Pane，以及草案顺序缺失记录的回填。
- [x] 将移动结果继续写入 `draftOrder`，复用现有校验、放弃和保存并应用流程。

### P1：Pane 单卡片渲染

- [x] 将数据包列表的主渲染单位收敛为一个 Pane 卡片。
- [x] 移除 Pane 内 fixed / editing 两份完整 `pack-entry` 的重复渲染。
- [x] 将上下移按钮放置在 Pane 身份区域，并使用 Pane 级 data attribute。
- [x] 保留普通态 / 编辑态当前 Runtime、待 Apply、当前编辑等状态提示。

### P2：普通态 / 编辑态双按钮

- [x] 已存在槽位显示可切换按钮，并保留 Selection 与 Runtime Apply 的延迟语义。
- [x] 缺少编辑态时显示创建入口，调用现有 fixed → editing 复制服务。
- [x] 禁止通过该 UI 直接创建普通态、重复复制已有编辑态或自动选中刚创建槽位。
- [x] 保留编辑器目标必须是明确 editing `packRecordId` 的约束。

### P3：样式与响应式布局

- [x] 将 Pane 卡片调整为单条身份信息 + 双状态按钮的紧凑布局。
- [x] 删除不再需要的双条目 / 槽位列表样式。
- [x] 保持列表滚动区域、底部草案操作区、键盘焦点和移动端布局不回退。

### P4：测试与验收

- [x] 测试普通态 + 编辑态作为整体上下移动，不能产生拆分顺序。
- [x] 测试核心 Pane 不能被越过、非「全部数据包」不能排序。
- [x] 测试每个 Pane 只渲染一个身份卡片和两个状态按钮。
- [x] 测试缺少编辑态时复制内容、创建后不改变 Selection / Runtime。
- [x] 测试已有编辑态只切换，不重复复制或覆盖。
- [x] 浏览器交互验收：数据包管理页只渲染一个 Pane；Pane 内有两个状态按钮；不存在旧的 `.pack-pane-slots` 与 `pack-workflow-guide`；上下移按钮绑定 Pane；底部草案操作区位于数据包列表之后。

## 非目标

- 不修改 `DatapackRecord`、`PackCatalogPane`、`DatapackSelection` 或 `RuntimeApplyPlan` 的身份模型。
- 不改变普通态 / 编辑态的持久化、导入、导出、删除 Guard 和冲突规则。
- 不增加自动 Apply、自动切换 Runtime、自动保存编辑器内容或全局编辑态。
- 不在本 Task 中实现新的数据包删除 / 导出操作面板。

## 当前核验（2026-09-19）

- 已核对 `task-0111` 的 Pane / Selection / Runtime 设计与当前源码。
- 已确认当前缺陷来自 UI 单记录渲染和单记录 `draftOrder` 交换。
- 定向 Vitest：`tests/ui/datapack-workspace-state.test.ts`、`tests/ui/datapack-workspace-order.test.ts`、`tests/ui/service-workspace.test.ts`，26/26 通过。
- 顶栏与设置工作区回归：`tests/ui/topbar-settings-workspace.test.ts`，13/13 通过。
- `npx tsc --noEmit` 通过。
- `npm run check:docs` 通过（扫描 241 篇 Markdown，0 errors）。
- `npm run check:architecture` 通过。
- `npm run build` 通过；仅保留既有大 chunk 警告。
- `git diff --check` 通过；仅报告既有 CRLF → LF 提示。
- 浏览器交互验收通过：进入设置 → 数据包管理后，当前页面显示 `1 个 Pane`，`[普通态]` / `[编辑态]` 两个状态按钮各 1 个，`.pack-pane-slots` 与 `.pack-workflow-guide` 均为 0 个，Pane 上下移控件为 2 个，`.pack-draft-actions` 为 1 个且位于数据包列表之后。
- 浏览器切换验收通过：普通态 → 编辑态后显示“已选择编辑态；返回数据包管理页后再统一 Apply”，Runtime 状态为“待 Apply”；未触发自动 Apply。随后可切回普通态。
- AOCI `aoci_maintain` 已执行但因仓库既有 code drift / unbaselined 条目停止，未对本 Task 进行语义写入；该治理阻塞不由本 Task 新增。

## 剩余工作

 P0–P4 已完成，无剩余施工项；本文在索引更新后移入 `docs/plan-work/archive/`。

## 相关路由

[[task-0111-datapack-pane-slots-selection-and-atomic-apply]]
[[task-0110-datapack-editing-state-and-targeted-authoring]]
[[docs/docs-828/00-INDEX]]
[[docs/docs-828/02-modules/runtime-editor]]
[[docs/docs-828/05-conventions/testing]]
[[docs/docs-828/05-conventions/doc-maintenance]]
