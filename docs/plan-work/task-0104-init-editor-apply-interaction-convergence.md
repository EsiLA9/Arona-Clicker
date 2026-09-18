# Task：Init Editor Apply 后选择页交互收敛

状态：active — 🟡 施工中

## 目标

在不关闭 Runtime Editor、不过度增加选择页动画保护、也不把新 Init 自动设为 `activeInit` 的前提下，收敛“新建 Init → 保存 Draft → Apply → 主体 Init 选择页继续可用”的真实交互链路。

## 设计边界

- Runtime Editor 仍是 body 级前台 Workspace；Apply 成功后保留编辑态、当前页面和当前 Definition 上下文。
- Lobby 中新 Init 只进入 Registry 与选择器，不自动进入世界线，不写入 `activeInit`。
- 选择器在 Apply 后必须拥有确定的选择状态：保留仍有效的用户选择；当前选择已删除时才回退到有效候选。
- Runtime World commit 的内部状态、Registry 和回调观察到的快照必须一致，避免 EventBus 回调读取到半提交状态。
- 不修改引擎字段、存档结构、事件类型或 `tools/datapack-editor/`。

## 当前事实与代码落点

- UI Apply 入口：`src/ui/runtime-editor/actions.ts` 的 `applyRuntimeWorldEditorDraft()`。
- Runtime World 协调器：`src/arona-clicker/services/runtime-world-content-coordinator.ts` 的 `applyWorldDraft()`。
- Runtime 回调：`src/arona-clicker/runtime.ts` 的 `runtimeWorldContent` `onCommitted`。
- 选择页重建与选择状态：`src/ui/controller-panels.ts`、`src/ui/selector-page.ts`、`src/ui/selector-theme.ts`。
- 当前回归测试只覆盖翻面中直接重建，以及 Init 草稿协同创建；没有覆盖完整 World Apply 后再操作选择器的真实 UI 流程。

## 施工切片

### P0：建立真实 UI 回归路径

- [ ] 在 Lobby 中选择一个旧 Init，打开 Runtime Editor，新建带自定义 `defaultArea` 的 Init。
- [ ] 保存 Definition 草稿并执行 World Apply。
- [ ] 断言 Registry、选择器行数、旧选择状态、Runtime Editor 前台状态和 defaultArea 引用。
- [ ] 显式关闭 Editor 后点击旧 Init、新 Init、GlobalEnhancement 翻面与滚轮，并在 microtask / animation 完成后再次断言无回退。

### P1：提交快照与 UI 通知时序

- [ ] 让 `RuntimeWorldContentCoordinator` 在发布 `onCommitted` 前完成自身 `modName / inits / areas / topology / revision` 的一致写回。
- [ ] 保留失败回滚边界；不得让回调观察到 Registry 新状态与 Coordinator 旧状态混合。
- [ ] 增加协调器回调观察测试，覆盖 Init、Area、revision 同时可见。

### P1：选择状态契约

- [ ] 不自动选择新 Init，不改变 `activeInit`。
- [ ] Apply 后保留仍存在的用户选中 Init；若选中项被删除，回退到有效候选并保证详情 CTA 与转轮绑定一致。
- [ ] 仅在测试证明当前实现不满足上述契约时修改选择页代码，避免重复堆叠 `flipSeq / sceneSeq` 防护。

## Patch Units

### Unit task-0104-U1：补齐真实 World Apply 流程并收敛提交可见性

#### Goal

用真实 UI 链路复现并锁定 Apply 后选择页与 Editor 的交互契约；同时让 World Coordinator 的提交回调读取到完整的内部提交快照。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/02-modules/ui.md` | 选择页、Lobby 与 Editor 生命周期 |
| 文档 | `docs/docs-828/02-modules/runtime-editor.md` | Draft / Apply / Coordinator 边界 |
| 文档 | `docs/docs-828/05-conventions/testing.md` | 定向测试与全量验收要求 |
| 源码 | `src/arona-clicker/services/runtime-world-content-coordinator.ts:applyWorldDraft` | 调整提交快照与回调时序 |
| 源码 | `src/ui/runtime-editor/actions.ts:applyRuntimeWorldEditorDraft` | 驱动真实 Apply 流程与 Editor 生命周期 |
| 源码 | `src/ui/selector-page.ts:reset` | 核对 Apply 后选择状态保持规则 |
| 测试 | `tests/ui/topbar-settings-workspace.test.ts` | 复用真实 Runtime Editor DOM 操作路径 |
| 测试 | `tests/engine/runtime-world-hot-crud.test.ts` | 复用 Runtime World 热 CRUD 断言 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 20k–35k token |
| 文档 Read Set | 3 篇 |
| 历史文档 | 0 篇；task-0103 仅作为当前问题入口 |
| 超预算处理 | 超过 60k token 时停止并拆分 Unit |

#### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| World Apply 成功后 UI 会显式调用 `ctrl.render()` | `src/ui/runtime-editor/actions.ts:applyRuntimeWorldEditorDraft` | 当前 Editor state 不应被隐式清除 |
| Coordinator 当前在内部镜像写回前调用 `onCommitted` | `src/arona-clicker/services/runtime-world-content-coordinator.ts:applyWorldDraft` | 需要用测试锁定提交可见性 |
| Lobby 没有 `activeInit` 时仍通过 Init selector 提供主体界面 | `src/ui/controller.ts:render` | 不得以自动进入新 Init 解决问题 |

#### Constraints

- 遵守 `AGENTS.md` 的 StateMutationService、Registry / Coordinator、测试和文档约束。
- 不改公共事件类型、Schema、存档结构或默认内容。
- 不通过强制关闭 Editor、自动设置 `activeInit` 或继续堆叠动画序列号解决问题。

#### Allowed Files

- `src/arona-clicker/services/runtime-world-content-coordinator.ts`
- `tests/engine/runtime-world-hot-crud.test.ts`
- `tests/ui/topbar-settings-workspace.test.ts`
- `docs/plan-work/task-0104-init-editor-apply-interaction-convergence.md`

#### Explicit Non-goals

- 不修改 `src/ui/css/runtime-editor.css` 的前台布局。
- 不修改 `src/ui/selector-page.ts`，除非本 Unit 的真实流程测试证明现有选择状态契约无法满足目标。
- 不修改 `task-0103` 正文。

#### Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION` §停止条件的 6 条默认规则；若需要修改 Allowed Files 或变更 Editor 前台设计，停止并上交。

#### Completion Criteria

- [ ] 真实 UI 流程覆盖新建 Init、协同 defaultArea、保存 Draft、World Apply、关闭 Editor 后选择器交互。
- [ ] Coordinator 回调测试确认 Init / Area / revision 观察到同一提交快照。
- [ ] 定向测试通过，且 Task 文档记录 Receipt。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/topbar-settings-workspace.test.ts tests/engine/runtime-world-hot-crud.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 文档检查 | `npm run check:docs`、`git diff --check` | 通过 |

#### Pre-flight

- Goal：补齐真实 World Apply UI 流程，并让提交回调读取完整快照。
- Allowed Files：上列 4 个文件。
- Explicit Non-goals：不改 Editor CSS、不强制关闭 Editor、不自动进入新 Init、不改 task-0103。
- Stop Conditions：遵守默认 6 条停止条件，尤其是需要扩展白名单或改变前台设计时停止。

## Explicit Non-goals

- 不通过 Apply 自动关闭或清空 Runtime Editor。
- 不通过提高 `z-index`、强制跳转或清空选择状态掩盖问题。
- 不把新 Init 自动写成 `activeInit`。
- 不改 Schema、存档迁移、Datapack Editor 或无关 UI 刷新机制。

## 测试与验收

- 定向：新增的 Runtime World 协调器测试与真实 UI 流程测试。
- 必须执行：`npx tsc --noEmit`、`npm test`、`npm run check:architecture`、`npm run check:docs`、`git diff --check`。
- 验收：Apply 后新 Init / defaultArea 存在且引用正确；Editor 状态保留；关闭 Editor 后选择器可点击、滚轮可移动、可翻到 GlobalEnhancement；等待 microtask 与动画后不回退。
- 当前任务不宣称已完成浏览器视觉验收；如代码测试通过但浏览器仍异常，保留为待验收项，不修改为 done。

## 当前核验（2026-09-18）

- 已阅读 `task-0103-init-selector-freeze-after-runtime-apply.md`、UI / Runtime Editor / 测试 / 文档维护路由。
- 已确认相关定向测试当前通过，但尚无本 Task 要求的真实 World Apply UI 流程测试。

## 剩余工作

- 完成 P0–P1 施工与定向测试。
- 执行全量类型、测试、架构和文档检查。
- 根据最终核验结果更新本 Task；若完成，再按仓库规则归档并维护 AOCI。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/05-conventions/testing]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[task-0103-init-selector-freeze-after-runtime-apply]] · [[task-0098-runtime-editor-workspace-decoupling-and-light-theme]]
