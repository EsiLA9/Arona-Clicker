# Task-0046：Init 生命周期边界与运行时重建

状态：🟢 P0/P1 已完成；P2 延期

关联裁定：[[docs/0x-plan&work/active/adr-0009-init-lifecycle-boundaries]]

## 目标

把 Init 切换、保存式重启、硬重启和读档恢复收敛为一个明确的生命周期边界，消除“状态已经换了、长寿命运行服务还保留旧世界”的风险。

本任务优先处理 Sol 审查中已经被源码证实的部分：

- `resumeInit` 对当前活动 Init 的非封闭调用；
- Init-local runtime cache、Affector 实例和 EventBus 队列残留；
- Story cursor 不属于 InitSnapshot；
- 非当前 Init 实体可被普通 Effect 写入；
- 单一会话时间戳与读档补算基准不一致；
- 生命周期缺少可测试的 generation 与 transition 语义。

PassiveStory 的 `passiveCooldowns` / `studentBlocks` 快照归属和 completion 幂等已由 [[docs/0x-plan&work/active/task-0032-passive-story-scheduling]] 负责，本任务不重复改写其业务规则。

## 设计边界

### 本次包含

- 核心 Init 转换编排与幂等；
- 保存式切换、硬重启、直接 `resumeInit` 调用的统一行为；
- EventBus 待处理队列的 Init 边界清理；
- Affector runtime 的显式 dispose/rebuild；
- Story global/chat cursor 的快照、恢复和清理；
- `runtimeGeneration` 及过期任务检查所需的内部基础设施；
- 当前 Init 作用域的 Spot/Area 写入拒绝；
- Session 时间戳与读档离线补算测试；
- 相关 Vitest、类型检查、架构检查和全量测试。

### 本次不包含

- 延迟/定时 Effect：当前 Effect DSL 没有该功能；
- 通用 `EffectCapability`、foreign-Init mutation 和 typed runtime EntityRef；
- Story reward 的完整 staged transaction 重构；只补充边界测试并记录后续依赖；
- Datapack fingerprint、definition revision、alias migration；项目明确不做存档迁移；
- PassiveStory 的 Pool、cooldown、completionKey 业务改造；
- UI 视觉或 Workspace 改动。

## 当前事实与代码落点

| 领域 | 当前事实 | 施工落点 |
| --- | --- | --- |
| Init 进入 | `enterInit()` 设 activeInit、发 `initEntered`、执行 entry effects、reconcile Affector | `src/arona-clicker/services/init-service.ts` |
| 切换 | 核心 `resumeInit()` 已在活动 Init 上先保存式退出；UI 原有显式 `restartInit()` 路径保持兼容 | `src/arona-clicker/services/init-service.ts`、`src/ui/controller.ts` |
| 快照 | `InitSavepoint` 遍历 `PER_INIT_FIELD_SPECS`，已纳入 Story global/chat cursor；时间戳仍属于 Session，不落 InitSnapshot | `src/arona-clicker/state/init-savepoint.ts`、`src/arona-clicker/state/per-init-fields.ts`、`src/arona-clicker/types/state.ts` |
| EventBus | 新增 `clearQueue()`；Init 边界清理待处理事件，事件 origin 仍属于 P2 | `src/engine/core/event-bus.ts`、`src/engine/types/events.ts` |
| Affector | 实例不落存档；Init/load/reset 先 `disposeRuntime()`，再由 `reconcileMounts()` 从当前状态重建 | `src/engine/effect/affector-engine.ts` |
| Story | global cursor 与 chat cursors 通过可序列化 `storyCursors` 随 Init 快照保存/恢复 | `src/arona-clicker/services/story-service.ts`、`src/arona-clicker/services/story-cursor-state.ts` |
| Session | 读档 timestamp 在 `start()` 离线补算前保留；切换后的新会话刷新基准，非活动 Init 不补算 | `src/engine/runtime/session-service.ts`、`src/arona-clicker/runtime-save.ts` |
| 作用域 | 普通 Spot level/manager Effect 经 StateMutationService 拒绝非当前 Init Spot；global Spot 保留共享例外 | `src/engine/types/expression.ts`、`src/arona-clicker/state/state-mutation-service.ts`、`src/arona-clicker/runtime-wiring.ts` |
| 既有相关任务 | PassiveStory per-Init cooldown/block 与完成幂等已有独立施工任务 | `docs/0x-plan&work/active/task-0032-passive-story-scheduling.md` |

## 施工切片

### P0：转换边界与运行时清理

1. 在 `InitService` 内收口 transition orchestration；直接从活动 Init 调用 `resumeInit(target)` 时，先执行保存式退出。
2. 为 restart/switch/reset 增加内部 `runtimeGeneration`，并提供最小的过期 generation 检查接口；不改现有公开命令签名。
3. 为 EventBus 增加只清队列的能力，在 Init 切换和 restart 的清理阶段调用；不要误删长寿命订阅者。
4. 为 AffectorEngine 增加显式 runtime dispose，清理 instances、activeInstances、condition deps、polling 和派生同步记录；之后由 `reconcileMounts()` 从当前状态重建。
5. 统一 Init Trigger 卸载、Visibility 清理、Story cursor 清理和 Session stop 的顺序。
6. 为 `setSpotLevel`、`addSpotLevel`、`setManager` 等直接实体写入口增加当前 Init 所属校验；global Spot 保持现有共享语义。

### P1：快照、Story cursor 与时间语义

1. 扩展 `InitSnapshot`，保存 global Story cursor 与 chat cursor 的可序列化快照；`InitSavepoint` 的 capture/restore/clear 与 `PER_INIT_FIELD_SPECS` 保持键一致。
2. 恢复游标时只恢复数据，不复用旧 `StoryCursorState` 对象；瞬态字段由 `restore()` 重建。
3. 明确切换期间 active Story 的行为，覆盖 `insertStack`、choice、clickWork、跳转返回和恢复后继续播放。
4. 修正 Session 离线补算基准：读档 timestamp 在活动 Runtime 启动补算前不能被无条件覆盖；Init 切换后的非活动世界线不产生离线收益。
5. 为 InitSnapshot 中未登记的角色/剧情相关字段建立检查清单；PassiveStory 字段按 task-0032 执行，不在此任务重复搬迁。

### P2：后续 ADR，不在本 Goal 内施工

- 延迟 Effect 的 ownerInit / inactivePolicy；
- 全量 Event origin envelope（`originInitId`、revision、generation）；
- 通用 Effect capability 与 typed runtime ref；
- Story completion staged transaction；
- Datapack fingerprint 与兼容性拒绝 UX。

## 测试与验收

### 必须新增或补充的测试

- 直接 `resumeInit(B)` 会保存 A、清理 A runtime，再恢复 B；重复切换不会叠加 Affector 实例；
- restart 后 EventBus 队列为空，旧事件不会在新 Init 派发；
- Affector 的 active/perTick/zone modifier 在 A → B → A 后只由当前快照重建；
- Story cursor 在 A 中进行 `insert` / choice / clickWork 后切换到 B，再回 A 可恢复同一执行上下文；
- 不同 Init 的 Spot target 不能通过普通 Effect 写入当前状态；global Spot 仍可写；
- 读档 timestamp 可以驱动活动 Runtime 离线补算，Init 切换不会给非活动 Init 补算；
- runtime generation 变化后，旧 callback 被拒绝；
- 既有 `initEntered` / entry effect 的 first 与 unconditional 语义保持明确且有回归测试。

### 验收命令

```text
npx tsc --noEmit
npm run check:architecture
npm test
```

专项测试至少覆盖：

```text
tests/engine/init-global-lifecycle.test.ts
tests/engine/per-init-fields.test.ts
tests/engine/affector-reconcile.test.ts
tests/engine/event-bus.test.ts
tests/engine/session-service.test.ts
tests/engine/story-flow.test.ts
tests/engine/game-instance.test.ts
```

## 当前核验（2026-09-11）

- 已核对 `docs/docs-828/00-INDEX`、三层状态、运行逻辑、Effect/Trigger、Affector、测试与文档维护规范；
- 已核实 Sol 审查中 Init 相关问题：`resumeInit` 非封闭、InitSnapshot 缺 Story cursor、Affector runtime 不随快照保存、EventBus 无 origin/Init reset 队列清理、Effect target 无通用作用域、Session 只有单一时间戳；
- 已确认当前没有 delayed Effect，因此该项列为后续设计债务，不作为现有 bug 修复；
- 已确认 task-0032 已规划 PassiveStory cooldown/block per-Init 与完成幂等，本任务建立依赖而不重复施工；
- 已完成 P0/P1：Init transition、EventBus queue 清理、Affector runtime dispose/rebuild、当前 Init Spot 写入校验、Story cursor 快照、Session 离线基准与 generation 检查接口；
- 类型检查已通过：`npx tsc --noEmit`；
- 架构检查已通过：`npm run check:architecture`；
- 最终 in-scope 定向测试已通过：8 个文件、121 个测试（含 Init、Session、Affector、EventBus、Story、GameInstance、GameNum 回归）；
- `npm test -- --silent --reporter=dot`：140/141 个测试文件、1304/1305 个测试通过；唯一失败为工作区既有 `tests/ui/shop-modal.test.ts` 新增断言“战术能量饮料 × 1”，实际现有 DOM 文本为“战术能量饮料× 1”，与本任务 Init 改动无关，未修改该 UI 工作区内容。

## 剩余工作

1. 处理工作区既有 Shop UI 断言后，再次运行全量 `npm test`；
2. P0/P1 已完成，仍保留 P2 为后续 ADR，不将未实现的延迟 Effect/capability 宣称为已解决。

## 相关路由

- [[docs/0x-plan&work/active/adr-0009-init-lifecycle-boundaries]]
- [[docs/0x-plan&work/active/task-0032-passive-story-scheduling]]
- [[docs/0x-plan&work/active/adr-0007-shop-transaction-boundaries]]
- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/01-architecture/run-logic]]
- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/02-modules/affector]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
