# Unit 0320-U10b：E2 Effect 上下文与 Registry 绑定

## Goal

消费 U10a 的 `requiresAg1` 语法标记，在 Map/Encounter/Action 来源上下文中闭合绑定资源账户、MapRun Facts 与 `loopTarget`；拒绝 E1、未声明资源、错误命名域及未契约化的 additionalActor。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → `docs/ai/context-packs/production`、`docs/ai/PROJECT-CONSTITUTION.md` | 项目路由与正式 Unit 纪律 |
| 上游合同 | Task 0320 P2、U08 Frozen P2 Contract + clarification addendum、U10a AST/Syntax | 账户读写闭集、Owner 物化规则、Fact 条件上下文与语法信号 |
| Map Owner | `src/arona-clicker/services/map/map-run-service.ts`：`initialResourceBalances` | 资源账户实际物化集合和默认零余额的适用边界 |
| Resource authoring | `src/data-services/contracts/gameplay-map.ts`、`src/data-services/registry/registry-validate.ts`：Action costs、Map 初值、Encounter Enemy 初值 | 校验所需声明来源及 Map 合同入口 |
| Context | `src/data-services/validation/gameplay-map-effect-context.ts`：`validateGameplayMapEffectContext`、`visitProgramNode`、`visitValueRefs`、completion 检查 | Map/Encounter/Action 来源级引用绑定 |
| Tests | `tests/data/gameplay-b-effect-registry.test.ts`、`tests/data/gameplay-b-map-registry.test.ts` | E1/AG-1 准入、资源声明、来源种类和 MapRun Facts 证据 |
| 项目地图 | `graph_project(acprogram)` 与 U10a 只读路径搜索 | 项目身份及 Data Services / MapRun 直接关系已核对；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 16k tokens；只核对 Context、Owner 资源初始化和指定 Registry tests |
| 文档 Read Set | 4 篇/节 |
| 历史文档 | 0 篇；U08/U10a 是当前合同 |
| 超预算处理 | 需要改 AST/Syntax、Owner 初始化、Map Action schema、Planner/Normalizer 或其它白名单文件时停止并交上游拆分 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Context 已按具体 Encounter/Activity、Party/Enemy/Ability/Item 与 Candidate Pool 来源创建 Action 上下文 | `gameplay-map-effect-context.ts`：`validateGameplayMapEffectContext` | 新引用仍需逐来源验证 |
| MapRun Party Actor 资源名由任一 Action Actor cost/effect 或 Map `initialActorResources` 形成资源 ID 并按 Party 身份初始化；Team 同理读取 Team cost/effect 与初值 | `map-run-service.ts`：`initialResourceBalances` | 本合同定为只暴露实际已物化资源；后续 Effect Program 写入所需资源仍须由初值声明 |
| Enemy Actor/Team 资源分别来自 Encounter `initialResources` 与 `initialEnemyTeamResources` | `map-run-service.ts` Encounter 初始化；Context 的 Enemy resource maps | 不将 Party 资源跨身份补给 Enemy |
| MapRun Facts 在 Map 根上按 Counter/Flag 分域；U09a Registry 已约束声明结构 | `gameplay-map.ts`、`registry-validate.ts` | Effect 引用不得退回 Encounter locals |
| Encounter completion 没有来源级 detached 顺序计划；U08 addendum 将 MapRun Fact Condition 限定于 Action Effect Program `when` | U08 clarification addendum；Context completion 入口 | completion 必须拒绝 MapRun Facts 条件 |

## Constraints

- 消费 AST 结构校验输出；新 E2 构造只在 `executionContractId === 'AG-1'` 的 Map 有效。Map 字段省略或 `E1-COMPAT-1` 必须拒绝；原 E1 AST 保持兼容。
- Context 对资源账户的存在性必须与 U08/MapRun Owner 的物化边界相同：Party Actor 支持 Map 初始 Actor 资源或任一 Actor-scoped Action cost 所物化的资源；Party Team 支持 Map 初值或 Team-scoped cost；Enemy Actor/Team 只支持当前 Encounter 的各自初值。不可将未物化账户或资源默认为0。
- `sourceActor` 在 Ability/Item Actorless 上下文拒绝；`primaryActor` 需有可能的单位主目标；`sourceTeam` 按来源侧解析。余额读取的 `additionalActor` 当前语法可表达，但在 Action `additionalTarget` 尚未实现前必须拒绝；读取 `loopTargetActor` 仅在 `forTargets.body` 绑定到 TargetSet 可能成员，并检查每个成员资源。`resourceChange` 仍只接受已接线的 sourceActor/primaryActor/sourceTeam。
- `loopTarget` 对 HP/单位引用、`loopTargetActor` 对资源账户只在当前循环 body 有效；nested body 使用本层候选成员，退出后恢复外层。不得把 UI 坐标当领域身份。
- MapRun Counter/Flag 必须分别引用 Map `mapRunFacts.counters` / `mapRunFacts.flags`；遇到未声明 ID 或命名域错配拒绝。Counter/Flag Effect references 与 Encounter locals 分离。
- MapRun Fact `Condition` 只可用于 Action Effect Program 的 `when`；Encounter completion 若使用 MapRun Fact 条件必须拒绝。资源余额 Condition 在 completion 因无 Action source context 必须拒绝。
- 不实现 Runtime/Planner/Normalizer/Schema；语法/Context 通过不代表当前 Runtime 能执行新 AST。
- 遵守 PROJECT-CONSTITUTION 停止条件；禁止写 GALHCG 图、刷新或 freshness。

## Allowed Files

### 施工实现白名单（Agent）

- `src/data-services/validation/gameplay-map-effect-context.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`

### Task Owner 维护的施工记录

- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U10b-e2-effect-context-and-registry.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U10b-receipt.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md`
- `docs/plan-work/00-index.md`

实现限制为 2 个源码/测试文件、约 300–500 行净改动。子 Agent 不得编辑 Unit/Receipt/Task/index。

## Explicit Non-goals

- 不改 `gameplay-map-effects.ts`、Effect Syntax、Normalizer、Planner、MapRun Owner、scheduler v3、Receipt/Save/Resume 或生成 Schema。
- 不支持 Action `additionalTarget` 或额外目标账户运行绑定；本 Unit 继续拒绝 `additionalActor`，后续单独接线。
- 不支持 `resourceChange` 写入 `additionalActor` 或 `loopTargetActor`；这些写账户需要 Planner 对目标身份/循环成员接线，后续 Runtime Unit 处理。
- 不扩展 Encounter completion 的新事实条件、Edge 条件、Story/AC 状态或 Map 移动。
- 不改 Task 0316–0319 已完成切片及生产内容；不碰 GALHCG。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 MapRun Owner 的物化规则与 U08 补充不符、`requiresAg1` 无法经现有 Map-level Context 准确准入、引用需修改白名单外文件或 completion 条件需要新增语义裁定，停止并提交证据。

## Completion Criteria

- [x] Map Action E2 AST `requiresAg1` 在显式 AG-1 Map 通过，在省略合同/E1 Map 被拒绝，旧 E1 内容保持通过。
- [x] Actor/Team 余额读取与实际 MapRun Owner 物化来源一致；primary/source/team/loopTarget 读取账户按身份校验；`additionalActor` 在字段尚未接入前明确拒绝。`resourceChange` 写账户保持当前三账户。
- [x] MapRun Counter/Flag 读写引用 Map 声明的独立命名域；未声明/跨域引用拒绝，Encounter locals 不被混用。
- [x] MapRun Fact Conditions 在 Action `when` 中可用，在 Encounter completion 中拒绝；资源余额 completion 因缺少来源上下文而拒绝。
- [x] 覆盖 cost-only 已物化 Actor/Team 资源、Enemy 声明边界、嵌套 loopTarget、AG-1/E1 准入和 completion 拒绝的定向测试。
- [x] Registry 上下文测试、类型检查、文档检查和差异检查通过，并在 Receipt 留证。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Registry/Context | `npx vitest run --silent tests/data/gameplay-b-effect-registry.test.ts` | 新上下文绑定和 E1 拒绝通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 文档链接/结构 | `npm run check:docs` | 新路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
