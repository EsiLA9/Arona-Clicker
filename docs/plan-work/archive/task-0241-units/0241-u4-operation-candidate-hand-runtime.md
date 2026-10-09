# Unit 0241-U4：候选解析、偏好加权与确定性抽取

## Goal

按冻结 Operation Context 合并多池、过滤非法卡、应用角色偏好并抽取有限 Character Hand。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 | Hand/weight/legacy fallback 合同 |
| 源码 | `src/arona-clicker/contracts/operation.ts` | Profile/Context/Hand snapshot |
| 源码 | `src/arona-clicker/services/student-operation-profile-resolver.ts` | Admission 快照入口 |
| 源码 | `src/arona-clicker/services/operation-tactical-rng.ts` | 独立确定性 stream 复用依据 |
| 测试 | `tests/engine/operation-card-candidate-resolver.test.ts` (new) | candidate parser 行为覆盖 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k tokens |
| 文档 Read Set | Task E0 与必要的 Operation schema 路由 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超 60k tokens 时停止并交还 Task Owner |

## Optional Read Set

- `src/arona-clicker/services/operation-plan-preparation.ts`（只用于确认候选 DTO 被下一 Unit 消费）。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `src/ui/**`、Editor 与样例内容

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Admission 为学生 Profile 生成 detached snapshot | `student-operation-profile-resolver.ts:snapshotProfile` | 新运行时候选需要冻结 |
| `splitmix64-counter-v1` 现用于 tactical skill 抽取 | `operation-tactical-rng.ts` | Hand stream 必须独立派生 |
| 既有 Carousel Profile 的行动来源是静态 `candidateActionIds` | `gameplay-b-datapack.ts`、`carousel-safety-slice.ts` | 保持 legacy fallback，不提前迁移样例 |

## Constraints

- 只实现纯 candidate/Hand 解析，不改变 Run owner。
- Weight 使用 E0 定义的整数合并与 BPS 公式；Action 的合法性早于 Strategy 权重。
- 若显式 Pool 没有任何命中 Entry，旧 Profile `candidateActionIds` 作为隐式 legacy Pool，weight 10000；若有任一显式命中 Entry，则完全以显式池为候选。
- 角色 Hand 结果不得混进 SceneCard / playerSceneDeck。

## Allowed Files

- `src/arona-clicker/contracts/operation.ts`
- `src/arona-clicker/services/student-operation-profile-resolver.ts`
- `src/arona-clicker/services/operation-tactical-rng.ts`
- `src/arona-clicker/services/operation-card-candidate-resolver.ts` (new)
- `tests/engine/operation-card-candidate-resolver.test.ts` (new)

## Explicit Non-goals

- Preparation/Intervention、Run lifecycle、Save/Resume、View。
- UI、Editor、测试样例内容。
- SceneCard/PlayerCost 集成。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；预算或白名单不足时交还 Task Owner。

## Completion Criteria

- [ ] 多池合并、重复 Entry 聚合、策略多 tag 规则与同 seed 抽取可复现。
- [ ] `candidateActionIds` legacy fallback 保住既有 carousel Profile；显式池命中时不混入 fallback。
- [ ] Strategy 不影响合法性；无合法 Action 时 Hand 为空。
- [ ] 同 weapon/position/Context 的差异 Strategy 显示稳定抽取倾向。
- [ ] 空 bias、tag 重复与无 tag 匹配行为稳定。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-card-candidate-resolver.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Receipt

见 `receipts/receipt-0241-u4-operation-candidate-hand-runtime.md`。
