# Unit 0215-U5：单槽干预草稿与纯预览

## Goal

为当前 PreparedBeat 提供可撤销、限于一名学生的 InterventionDraft 校验与只读预览。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md` | 干预额度、stale 与费用语义 |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | EventRun 唯一 owner 和 detached snapshot 边界 |
| 源码/测试 | src/arona-clicker/contracts/operation-beat.ts、src/arona-clicker/services/operation-plan-preparation.ts、src/arona-clicker/services/operation-target-selection.ts | 草稿需要的 PreparedBeat/Plan/合法目标 |
| 源码/测试 | src/arona-clicker/contracts/operation-action.ts、目标准备测试 | 可选行动、费用与角色资格来源 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token；必要时不受代码行数限制，按职责保持文件边界 |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分 Draft 合法性与费用预览职责，不扩大 Read Set |

## Optional Read Set

- `src/arona-clicker/services/operation-entry-service.ts`：仅当理解将来 facade 输入形状所必需时读取。

## Do Not Read by Default

- UI、Operation View、SaveData、SceneAction、路线和 Datapack/Registry。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前计划和静态候选由 Profile/PreparedBeat 内容决定；UI 不应提交状态 delta。 | src/arona-clicker/contracts/operation-beat.ts、src/arona-clicker/services/operation-plan-preparation.ts | Draft 只表达有限输入。 |
| 当前 Runtime 写入边界为私有 Operation owner。 | `src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/services/operation-entry-service.ts` | 本 Unit 只实现纯计算。 |

## Constraints

- 一份 Draft 最多改一名学生的 action 和/或合法 target；换到另一名学生前先清除现有 Draft。
- 重复预览、改选、撤销和非法 Draft 均不得写 Run、改变版本或消费 RNG。
- 预览从当前被冻结的 PreparedBeat 计算完整预算影响；Team 资源或 Actor 资源不足时给出可读诊断，不重排其他 Actor 计划。
- 不接收客户端生成的 Action 效果、成本合计、Actor/Team/Track delta 或 PreparedBeat 替代内容。
- 本 Unit 只验证/预览，不直接持有或写 Draft；U8 通过当前 Run 版本命令保存/清除唯一已验证 Draft，保证 0219 能恢复它。

## Allowed Files

- src/arona-clicker/contracts/operation-beat.ts
- src/arona-clicker/services/operation-intervention-preview.ts（新增）
- tests/engine/operation-intervention-preview.test.ts（新增）
- docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/0215-u05-intervention-draft-and-preview-receipt.md

## Explicit Non-goals

- 不直接把 Draft 写入 EventRun，也不接窄 facade；由 U8 统一负责版本写入、Draft 持有和命令接线。
- 不实现 Combination、RNG、效果聚合或正式 Resolution。
- 不提供 UI 命令或多学生干预。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件默认六条执行；若纯预览无法复用 U4 的准备/目标结果且必须改白名单外文件，停止并报告。

## Completion Criteria

- [ ] Draft 仅包含 actor/action/target/reason 等受限用户意图，不暴露写模型字段。
- [ ] action-only、target-only 与 action+target 三种合法修订均能构成确定预览；未受影响计划逐字段保持不变。
- [ ] 错误 Actor/Action/Target、第二名学生、非法费用或过期 PreparedBeat 给出稳定诊断且不改输入。
- [ ] 预览提供费用/协同前置状态所需的只读投影，不消费随机流。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-intervention-preview.test.ts` | 合法/非法 Draft 与资源预算通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 人工验收 | 对相同输入重复生成预览并比较计划、费用和版本 | 输出一致且无写入 |
