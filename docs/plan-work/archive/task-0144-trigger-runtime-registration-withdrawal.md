# Task：Trigger Runtime Registration & Withdrawal（Task A）

状态：done — Task A 已实现并完成验证（2026-09-24）

## 目标

在现有 TriggerSystem 中建立稳定、可重复准入/撤出的 runtime Registration 合同，为后续领域适配器提供基础能力。EB-T 负责当前运行资格与索引一致性；调用方负责领域进度和重新准入理由。

## 执行边界

用户通过 Goal 明确授权执行 Task A。开工时复核当前源码与 Read Set；TriggerSystem 已存在的 definitions snapshot、revision、commitOnce 和 StoryFollowUp 改动均保留并兼容。
## 开工时源码基线（2026-09-24）

- `src/engine/effect/trigger-system.ts` 当前以 Trigger ID 为 Map 主键；mount 相同 ID 覆盖定义和 group，事件桶按 ID 保存候选。
- `processType()` 复制 bucket ID 集合，然后逐候选读取当前 Trigger；尚无 incarnation token，因此同 ID 撤出并重挂可能让旧候选解析到新内容。
- once 在 `fire()` 中先 `commitOnce(trigger.id)` 再调用 Effect；`processType()` 对每个候选独立检查共享完成集。因此同一事件的两个同 TriggerId 候选在第一条提交后，第二条会跳过。
- `registerBucket()` 在同 ID 改变事件类型时未先移除旧 bucket。
- TriggerSystem 是按事件类型静态订阅 EventBus；Registration 生命周期不应创建逐条 EventBus listener。

## Read Set

开工前阅读并复核：

- `docs/docs-828/00-INDEX.md`
- `docs/docs-828/02-modules/effect-trigger.md`
- `docs/docs-828/05-conventions/architecture-discipline.md`
- `docs/docs-828/05-conventions/testing.md`
- `docs/plan-work/draft-0143-trigger-runtime-registration-withdrawal.md`
- `src/engine/effect/trigger-system.ts`
- `src/engine/effect/event-driven-reactor.ts`
- `src/engine/core/event-bus.ts`
- `tests/engine/trigger-system.test.ts`

若具体路径与路由文档不同，以 00-INDEX 当前链接为准。

## 首期裁定

- `TriggerId : Registration = 1:N`。一个逻辑 Trigger 可以有多个独立运行 Registration，共享 TriggerId 级 once 身份。
- Registration 身份为 `(RegistrationKey, RegistrationToken)`。key 在当前 EB-T 有效 Registration 集内全局唯一，可复用；撤出再注册必须产生新 token。
- token 由 TriggerSystem 实例级单调计数器分配；调用方不能提交 token；`clear()` 清空 Registration/索引但不复位计数器。
- API 输入为 `TriggerRegistrationRequest`，不含 token；TriggerSystem 内部存储记录为 `TriggerRegistrationRequest & { token }`。
- 单条 Registration 零或一个 group、多值 runtime tags。Group 是单值生命周期归属；tag 是不透明精确匹配撤出标签；首期不 ref-count、不做层级前缀匹配。
- runtime tags 只用于内部适配层，不进入 TriggerDef 或 Datapack Schema。
- 同 key 重复提交同一规范 RegistrationRequest 是幂等 no-op；EB-T 不推断任意 TriggerDef 的语义等价。规范载荷冲突报 invariant 错误，不隐式 replace。需要替换时先 withdraw 再 register。
- 事件候选快照保存 `(key, token)`；逐候选执行前复核当前有效记录与 token。withdraw 后同 key 重新注册不复活旧候选；本次 dispatch 中新增的 Registration 不加入当前快照。
- 保留 Effect 路径和 once 提交先后顺序。由于 TriggerId 1:N，必须增加回归测试：同一事件中两条 once Registration 共享 TriggerId，最多执行一次。

## 实施范围

- 为 Registration、Request、Key、Token 选择最小内部类型表达；不公开为 Datapack/schema 类型。
- 在 TriggerSystem 内维护 key→Registration、event type→keys、key→event type、group→keys、tag→keys 等必要索引。
- 提供 register、withdraw(key)、withdrawByTag(s)、保留兼容的 group unmount 与 clear 行为；对重复准入/撤出按上述合同幂等。
- dispatch 使用候选快照并逐项校验 token；修复事件类型变化后的旧桶残留。
- 将现有 mount/load 调用迁移或通过兼容适配接入 Registration，不改变默认数据与现有玩法结果。
- 一次性回归覆盖同 TriggerId 1:N 的 once 行为，不重排 once 提交，不引入成功/失败提交协议。

## 明确排除

- Effect 成功/失败/部分提交语义、事务与回滚。
- in-flight 防重、once 提交重排、post-fire withdrawal、TriggerBehavior。
- Reveal、Milestone、StoryFollowUp 等领域消费者迁移及领域持久进度。
- Datapack 懒加载/卸载编排、公开 runtime tag 字段、Schema 变更。
- once 存档层级或全局跨 Init 语义调整。

## 实施与核验结果

- TriggerSystem 已建立 `TriggerRegistrationRequest` 与内部 `TriggerRegistration`；请求必须提供 tags，不含 token。真正创建记录时由实例级单调计数器分配 token，`clear()` 不重置序列。
- Registration 以 key 独立存储；TriggerId 可对应多条 Registration。定义载荷被冻结并规范化，tag 排序后作为 canonical descriptor；同 key 同 descriptor 返回既有 token，冲突拒绝隐式替换。
- 增加事件类型、key→type、group、tag 索引；撤出清理全部索引，runtime tag 严格相等匹配。兼容 mount 仅替换自己的 legacy key；旧 unmount 不误撤显式 Registration。
- Dispatch 快照携带 `(key, token)` 并在候选执行前复核。触发执行中的 tag 撤出与同 key 重注册不会让旧候选恢复；新 Registration 从后续事件响应。
- once 路径和提交顺序保持不变；同 TriggerId 多条 once Registration 的同一事件回归确认只执行一次。
- 最终验证：`npm test`（188 files / 1748 tests passed）、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 全部通过。

## 验收

- [x] Request 类型不含 token；只有 TriggerSystem 创建 Registration token。
- [x] 同 key 同规范请求重复注册只保留一条记录，不产生第二候选；同 key 冲突明确报错。
- [x] token 对真正新建的 Registration 单调递增；withdraw/re-register 与 clear/re-register 均不复用旧 token。
- [x] withdraw 不存在 key 可重复调用；撤出后可用同 key 注册新 incarnation。
- [x] 当前 dispatch 中 A 撤出 B 后 B 不执行；A 撤出并同 key 重注册 B 后旧候选仍不执行，新记录从后续事件开始响应。
- [x] 新 Registration 不加入已建立的当前 dispatch 候选快照。
- [x] 精确 tag 撤出且仅撤出命中 tag 的 Registration；group、tag、多索引在各撤出入口后一致。
- [x] 一个 TriggerId 的多个 Registration 可独立撤出；同一事件同一 TriggerId 且 once=true 时只执行一次。
- [x] 同 key 改变事件类型后旧桶清理；EventBus listener 数量不随单条 Registration 变化。
- [x] once 的提交时序、完成存储结构与 Effect 调用路径保持不变。
- [x] 机制修改附 Vitest 回归测试；按项目约定运行目标测试、类型检查及相关架构/文档检查。
- [x] Task 完成后核对并更新对应 `docs/docs-828/` 当前机制文档；本任务稳定后按 AGENTS 完成文档检查、归档与索引维护。

## 预期改动边界

首选 `src/engine/effect/trigger-system.ts` 与 `tests/engine/trigger-system.test.ts`，需要共享内部类型时仅新增最小引擎内部模块。禁止触及生成的 schema 文件、`dist/`、`web-dist/`、`node_modules/`。是否需要更新机制文档由实施后实际稳定事实决定。

## 相关文档

- [[draft-0143-trigger-runtime-registration-withdrawal]]
- [[draft-0142-trigger-gameplay-packaging]]
- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]


