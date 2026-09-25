# Task：Runtime Editor 编辑态数据长效保存与恢复

状态：done — 2026-09-18 完成

## 目标

让 Runtime Editor 的编辑态草稿在关闭面板、页面刷新、浏览器重启后仍可恢复，避免用户因编辑器 UI 生命周期结束而丢失 Mod 元信息、Definition 草稿、集合编辑和当前编辑上下文。

本 Task 只保存编辑态数据，不把 Runtime Editor 草稿写入玩家存档，也不在启动时自动把草稿物化到 Registry 或 PlayerState。

## 当前事实与问题

- 编辑态唯一事实目前是 `UIController.panelState.runtimeDatapackEditor`，由 `createRuntimeDatapackEditorState()` 创建。
- `RuntimeDatapackEditorState` 已包含 Mod 元信息、Init / Area / Spot / Enhancement 草稿、Applied 快照、挂起 ID、选中对象、Switch、`formDraft` 和诊断状态，但没有持久化适配层。
- 关闭 Runtime Editor 面板只隐藏 body 级宿主，当前页面生命周期内草稿仍保留；浏览器刷新或重启后 `UIController` 和编辑态全部重新创建。
- `SaveSystem` 的 `acprogram_save` 只承载 `SaveData`；Runtime Mod / Runtime Editor 草稿不属于玩家存档语义，不能直接塞入该结构。
- 现有表单输入首先存在 DOM，只有切页、保存 Draft 或 Apply 前才通过 `stashRuntimeDefinitionForm()` / `stashSpotForm()` 写回 `formDraft`；持久化必须覆盖“输入尚未离开当前页面”的窗口。
- Runtime Mod 的运行时状态由 `AronaClickerRuntime` 内存持有，浏览器重启后不会自动恢复；恢复编辑态不能假设 Registry 已经包含对应 Runtime Definition。

## 核心裁定

### 1. 持久化对象分层

| 层 | 是否保存 | 恢复语义 |
| --- | --- | --- |
| 编辑草稿 | 是 | 恢复为待确认的 Editor Draft |
| Mod 元信息 | 是 | 与草稿一起恢复 |
| 当前 Definition / 集合 / `formDraft` | 是 | 恢复当前编辑上下文和未离开页面的输入 |
| `selectedContentKind`、条目、Switch、筛选 | 是 | 恢复到上次编辑位置 |
| `applied*` 快照与 `applied` 标志 | 否 | 新 Runtime 会话中不宣称已同步；恢复后重新建立“待 Apply”基线 |
| `problems`、`notice`、`error` | 否 | 依据当前 Registry 和 Policy 重新校验；不恢复过期诊断 |
| 面板 / Launcher 是否打开 | 否 | 启动时不自动弹出 UI，用户主动打开后查看恢复提示 |
| Launcher 位置 | 可单独保存 | 作为 UI 偏好保存，不与内容草稿混在同一快照 |

恢复后的状态必须明确表达：“草稿已恢复，但尚未同步到当前运行时”。Apply 仍是唯一的 Registry 物化入口。

### 2. 存储介质与键

- 使用独立的 `LocalStorageAdapter` 键，例如 `acprogram_runtime_editor_draft`；不复用 `acprogram_save`。
- 快照采用带版本和时间戳的 envelope：`schemaVersion`、`savedAt`、`sourceId`、`payload`。
- 当前只支持一个 Runtime Editor 草稿槽，因为 Runtime Editor 当前只允许一个临时 Mod 命名空间。
- JSON 解析失败、版本不匹配、结构不完整或超出存储配额时，忽略损坏快照并保留内存编辑，不阻断游戏；UI 只显示可理解的恢复 / 保存失败提示。
- 不编写旧快照迁移代码。版本不匹配直接丢弃并记录提示，遵守项目“不做存档迁移”的边界。

### 3. 写入时机

- 表单 `input` / 集合操作 / 条目切换 / Switch 切换 / 筛选 / 新建 / 删除 / 挂起 / 恢复 / 保存 Draft / Apply 后，安排一次去抖写入。
- 写入前必须先把当前页面 DOM 暂存进 `formDraft`；不能只保存已经进入 `RuntimeDatapackEditorState` 的字段。
- 使用短去抖合并连续输入，避免每次按键都写 LocalStorage。
- `pagehide` / `beforeunload` / `visibilitychange(hidden)` 时同步 flush 尚未落盘的快照；flush 失败不得抛出未处理异常。
- 面板关闭不清除快照；用户显式放弃草稿、删除临时 Runtime Mod 或完成明确的“清除编辑态”操作时才清除。

### 4. 恢复时机与优先级

启动时在 UI 编辑态建立阶段读取快照，但不打开面板、不调用 `applyRuntimeMod()` / `applyRuntimeWorldDraft()`。

恢复优先级：

1. 当前 Controller 已有有效编辑态时，不用持久化快照覆盖它；
2. 有有效持久化快照时恢复草稿；
3. 没有快照时，继续使用 `IS_DEBUG_EDITING` 的 Debug seed；
4. 快照损坏或版本不匹配时，清理该快照并回退到普通空编辑态 / Debug seed。

恢复后清空 `applied*`、`problems`、`notice`、`error` 等会话派生字段，并保留内容字段与选择上下文。用户打开 Editor 后看到恢复提示，首次 Apply 成功后才建立本次运行时的 Applied 基线。

### 5. 数据安全与引用漂移

- 恢复快照不自动删除未知的 Init / Area / Spot / Enhancement 引用；先保留草稿，再由现有 Policy / Registry 诊断报告引用失效。
- 当前数据包启用集变化不应静默改写草稿；候选缺失、归属变化和同名冲突在 Apply 前 fail closed。
- 持久化层只处理 JSON-safe 的编辑数据，不保存 DOM、函数、Map、运行时服务引用或 `UIController`。
- LocalStorage 仅是当前浏览器 / 当前站点的本地草稿，不承诺跨浏览器、跨设备同步，也不作为导入导出格式。

## 主要代码落点

| 文件 / 模块 | 规划职责 |
| --- | --- |
| `src/ui/runtime-editor/state.ts` | 定义可持久化投影、恢复后派生状态重置与状态快照边界 |
| `src/ui/runtime-editor/`（新增持久化模块） | envelope、JSON 编解码、版本检查、LocalStorage 读写、清除和错误结果 |
| `src/ui/runtime-editor/actions.ts` | 表单暂存、去抖写入、操作后的持久化触发、显式放弃 / 删除时清除 |
| `src/ui/runtime-editor/debug.ts` 或 `src/ui/controller.ts` | 启动恢复顺序、Debug seed 与用户快照优先级 |
| `src/ui/runtime-editor/view.ts` | 恢复提示、尚未同步状态和存储失败提示 |
| `src/ui/controller.ts` | 页面级 flush 生命周期、`pagehide` / `visibilitychange` 监听与销毁解绑 |
| `tests/ui/`（新增 Runtime Editor 持久化测试） | 编解码、恢复、清理、刷新边界和不自动 Apply 回归 |
| `tests/ui/topbar-settings-workspace.test.ts` | 真实面板关闭 / 重开、表单输入暂存与恢复流程 |
| `docs/plan-work/00-index.md` | 当前 Task 路由 |

不修改 `SaveData`、`SaveSystem` 的玩家存档协议、Registry、PlayerState、Schema 或 Runtime World 提交契约。

## 施工切片

### P0：持久化契约与纯编解码

- [x] 固定 envelope、版本、键名、单槽语义和可持久化字段白名单。
- [x] 实现 JSON-safe 快照投影与严格结构解析；坏数据 / 版本不匹配返回明确结果，不抛出到 UI。
- [x] 明确恢复后 `applied*`、诊断和提示字段的重置规则。

### P1：编辑态写入接线

- [x] 将表单 `input`、集合编辑、切换、保存、Apply 和 CRUD 操作接入统一去抖持久化入口。
- [x] 写入前统一暂存当前 Definition / Spot 表单，覆盖“用户仍停留在当前页面”的输入。
- [x] 增加页面隐藏 / 关闭前 flush，并在 Controller 销毁时移除监听与定时器。

### P2：启动恢复与用户反馈

- [x] 在 UI Controller 建立阶段按“现有内存态 > 持久化草稿 > Debug seed”顺序恢复。
- [x] 恢复后不自动打开面板、不自动 Apply；显示“已恢复草稿，尚未同步到当前运行时”状态。
- [x] 用户显式清除编辑态时同步清理持久化快照；浮动面板关闭只保留草稿。
- [x] 存储失败只影响长效保存，不破坏当前内存编辑；提供可理解的警告。

### P3：验证与验收

- [x] 验证跨 Controller 重建 / 模拟页面刷新后草稿、表单暂存和选中上下文恢复。
- [x] 验证恢复不会修改 Registry / PlayerState，必须手动 Apply 才产生运行时变化。
- [x] 验证坏 JSON、版本不匹配、未知引用和清理路径；LocalStorage 写入异常由持久化层 fail soft。
- [x] 完成类型、定向测试、全量测试、架构检查、文档检查和空白检查。

## 测试与验收

### 必测场景

1. Mod 元信息、Init / Area / Spot 草稿、嵌套支付 / 揭示 / 标签集合 round-trip 后保持数据与顺序。
2. 用户停留在当前表单输入，直接关闭面板或触发 `pagehide` 后，重新建立 Controller 仍能恢复最后输入。
3. 刷新后恢复编辑态但 Registry 与 PlayerState 不变化；打开面板看到待 Apply 提示。
4. 恢复后手动 Apply 成功，Applied 基线在当前会话正确建立。
5. 已有内存编辑态时，持久化快照不能覆盖当前编辑。
6. `IS_DEBUG_EDITING=1` 只在没有有效用户快照时播种默认编辑态。
7. 坏 JSON、错误版本、缺少必需数组、非法内容类型和 LocalStorage 配额失败均 fail soft。
8. 显式放弃 / 删除 Runtime Mod 后快照清除，下一次启动不再恢复旧内容。
9. 当前数据包变化导致引用失效时，草稿保留并由现有诊断 / Apply 校验报告，不静默删除。

### 验收命令

```text
npx tsc --noEmit
npx vitest run tests/ui
npm test
npm run check:architecture
npm run check:docs
git diff --check
```

浏览器验收需确认：刷新后编辑器不自动弹出但草稿可见、当前输入不丢失、恢复提示清晰、手动 Apply 前 Registry 不变化、清除操作确实删除本地草稿。

## 非目标

- 不把 Runtime Editor 草稿并入玩家存档或增加存档迁移。
- 不在启动阶段自动把草稿加载为 Datapack、Registry 或 PlayerState。
- 不实现跨设备同步、云端保存、多用户隔离或多份 Runtime Mod 草稿管理。
- 不把 LocalStorage 快照当作正式 Datapack 导出格式；导入 / 导出另按既有服务处理。
- 不在本 Task 重新设计 Runtime Editor Policy、Runtime World Coordinator 或 Definition DSL。

## Receipt

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/ui/runtime-editor/state.ts`、新增 `src/ui/runtime-editor/persistence.ts`、`debug.ts`、`actions.ts`、`view.ts`、`src/ui/controller.ts`、新增 `tests/ui/runtime-editor-persistence.test.ts`、本 Task 与 `00-index.md` |
| 行为结果 | 使用独立 `acprogram_runtime_editor_draft` localStorage 槽位；输入去抖保存；面板关闭 / 页面隐藏 / Controller 销毁前 flush；恢复不自动弹面板、不自动 Apply；明确“关闭编辑态”清除草稿 |
| 测试与验证 | 新增持久化测试 5 个通过；`npx tsc --noEmit`、`npm test`（174 文件 / 1617 测试）、`npm run check:architecture`、`npm run check:docs` 与 `git diff --check` 均通过 |
| 未完成内容 | 未做手工浏览器验收；交互边界由 happy-dom 面板回归与生命周期测试覆盖 |
| AOCI 收尾 | 受当前仓库既有治理漂移状态约束，稳定后按 Guide 处理 |

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/05-conventions/testing]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[task-0093-init-editor-design]] · [[task-0098-runtime-editor-workspace-decoupling-and-light-theme]]
