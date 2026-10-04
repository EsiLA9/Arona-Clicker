# Task 0215 — 玩法 B 行动准备、有限指挥与统一结算

状态：proposed — 等待 Task 0213 与 Task 0214 完成

## 目标

建立一个可解释的现场行动节拍：学生自主准备行动、对手/环境公开 Intent，Sensei 有限修订，再以单次 Commit 对冻结快照统一结算并产生唯一 Resolution。

## Why

“学生先行动、老师判断是否值得干预”构成玩法的核心决策。若准备、改选和结算使用不同的隐式状态，就无法解释玩家决定怎样改变结果。

## Scope

- 定义 `OperationActionDef` 的能力资格、标签、费用、目标规则及有限效果类别。
- 定义 `Intent`、`PreparedBeat`、`InterventionDraft` 与 `Resolution` 的职责和生命周期。
- 每个 Beat 最多一项 Sensei 指挥：替换一名学生的行动和/或合法目标；没有指挥时保留学生原计划。
- Commit 前对资源、行动、目标和计划版本做完整校验；Commit 后只按冻结快照扣费/结算一次。
- v1 协同规则只配对两个 Action；规则嵌入 Location 内容，按标签/目标建立候选桶并按确定优先序匹配。每个输入 Action 至多被消费一次，不执行多输入组合搜索。
- 准备只遍历 Profile/Location 声明的动作候选和合法目标，不扫描整个 Registry；一次 Intervention 只重算受影响 Actor 及相关协同预览。
- 确定性随机仅在 Commit 后消费 Seeded Stream；准备和编辑不改变随机游标。
- 为战斗伤害/治疗与场景轨道变化提供同一个 Resolution 容器；具体目标判定由 Task 0217 丰富。

## Non-goals

- 不在这一阶段建立通用策略 AI、状态效果语言、格子战场或连续时间模拟。
- 不让所有 AC Engine Effect 都能写 EventRun，也不将每个内部步骤发布到 EventBus。
- 不制作 UI；Task 0216 消费本 Task 的只读投影。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| Engine Effect 将未消费的状态效果交给 StateMutationPort，通用 Engine 不解释所有产品效果名称。 | `docs/docs-829/03-data-structures/engine-contracts.md`；`docs/docs-829/04-mechanisms/engine/effect-trigger.md` | EventRun 内行动结果应由产品操作 Resolver 拥有。 |
| EventBus 按事件类型订阅与排队派发，Mutation 是状态写入和领域事件的边界。 | `docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md`；`docs/docs-829/06-wiki/30-arona-clicker-domain/state-and-mutation.md` | 只对外发布有意义的阶段完成事件；Run 内结算直接编排。 |

## Data / API

- `OperationActionDef`：稳定动作 ID、合法 Actor Profile/能力、target contract、费用、标签和有限的局部效果声明。
- `PreparedBeat`：当前 Beat、各 Actor 行动/Intent、目标、费用快照、解释原因、可替代项和计划版本。
- `InterventionDraft`：0 或 1 项学生计划修订及选择原因；只作为待提交输入。
- `PlanEntry`：一个待结算行动计划；共享 Actor/Action/Target/费用/解释字段，并以参与方 kind 区分学生计划与敌对/环境 Intent。
- `CombinationRule`：嵌入 Location 的二输入标签/目标条件、稳定优先级及组合结果；不设独立 Registry 表。
- `Resolution`：唯一 ID、消费费用、配对结果、随机结果、每个 Actor/现场的结果记录及 EventRun 状态差异。
- 命令名、服务签名和实际目录由实施 Task 的 Read Set 决定；本文冻结语义，不锁定 TypeScript 形状。

## Runtime Flow

EventRun 准备每个 Actor 的候选计划与 Intent → 产出稳定 PreparedBeat → 接收至多一项合法 InterventionDraft → 验证计划版本与预算 → Commit 冻结副本 → 按确定优先级应用 Combination → 从 Commit 时的随机游标结算动作 → 一次性更新 Run 并追加 Resolution → 准备下一 Beat 或返回终局候选。

## Acceptance

- [ ] 一个 PreparedBeat 内含多个 PreparedAction；其中一项经 Sensei 修订后 Commit，Resolver 使用修订快照，其余行动保持原计划。
- [ ] 对不存在的 Actor、非法 Target、超额费用或第二项指挥，Commit 拒绝且不扣资源、不推进随机流、不写部分结果。
- [ ] 同一准备版本只产生一个 Resolution；重复 Commit 不会二次扣费或重复伤害。
- [ ] 同一 Seed、内容定义与输入序列得到相同 Preparation/Resolution；预览与编辑不会消耗随机流。
- [ ] 满足组合规则时一组输入只产生一次组合结果，不再重复执行其原始结果；未配对的 Action 正常结算。
- [ ] 组合限定为二输入，多个候选同时匹配时结果按稳定优先级确定；不运行多输入组合搜索。
- [ ] Actor/候选/目标/规则规模均由内容合同给出有限上限；Resolver 只处理当前 PreparedBeat 和匹配桶，不遍历全 Registry 或整张 Event 图。
- [ ] Resolution 能说明学生原计划、指挥修改、Intent、协同/随机结果和局部状态变化。
- [ ] combat 与非 combat Actor/Target 使用同一提交与结果容器；只在具体效果和局部目标上分支。

## Tests

- **Unit：**行动资格、目标/费用校验、协同冲突优先级、局部效果与随机消费。
- **Runtime：**固定输入多次重放、拒绝原子性、干预配额、重复 Commit、单次 Resolution。
- **Integration：**EventRun/ActorState 与 PreparedBeat、Resolution 的状态流转。
- **UI：**只验证投影字段契约，实际交互由 Task 0216 覆盖。

## Dependencies

- 依赖 Task 0213（EventRun/EventState owner）与 Task 0214（学生 Actor/Profile）。
- Task 0216、0217 依赖此统一准备与结算能力。

## Documentation / GALHCG

- 稳定后更新新的 Operation 机制页及 `docs/docs-829/01-architecture/data-flow.md` 中的产品流程。
- PreparedBeat、InterventionDraft、Resolver 内部辅助值无需逐个进入 GALHCG；稳定领域概念限定为 Operation Runtime、Prepared Action/Intent、Resolution。
- Read Set：`docs/docs-829/03-data-structures/engine-contracts.md`、`docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md`、`docs/docs-829/04-mechanisms/engine/effect-trigger.md`、Task 0213–0214 及目标测试。

## 当前核验与剩余工作

当前只核对 AC Effect、Mutation 与 EventBus 语义；未实现、未运行测试。实现时必须先决定组合优先级、效果批次顺序和失败原子性测试，再锁定方法签名。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0213-gameplay-b-event-runtime-and-session-state]]
- [[task-0214-gameplay-b-student-participation-and-autonomy]]
- [[docs/docs-829/05-conventions/testing]]
