# Unit 0241-U10：Strategy Park 平行玩法实例内容

## Goal

新增不覆盖 Carousel demo 的独立近完整 Gameplay B 测试 Event，使用 E0 已裁定的 OperationStrategyProfile/CardPool/Context/Character Hand 合同，覆盖角色倾向差异、前排重解析、Negotiation、路线与结局，并以实际 Registry/Runtime 装配验证数据可玩。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 / D1 / 未复制项 | Engine 合同、验收与数据限制 |
| Receipt | `docs/plan-work/archive/task-0241-units/receipts/0241-e1-operation-runtime-and-galhcg.md` | E1 已实现接口与限制 |
| 原型路线 | `prototypes/gameplay-b/src/content/park-graph-route.ts`、`prototypes/gameplay-b/src/content/first-battle.ts` | BDemo 路线与战斗范围 |
| 原型角色/测试 | `prototypes/gameplay-b/src/content/characters.ts`、`prototypes/gameplay-b/tests/park-demo.test.ts` | 角色行动与完整游园演示依据 |
| AC 参考 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`、`src/arona-clicker/services/registry-operation-content-resolver.ts` | 现有 bundle / resolver 边界 |
| 测试 | `tests/engine/gameplay-b-scene-action-sample.test.ts`、`tests/engine/gameplay-b-route-sample.test.ts` | Runtime 内容装配和路线测试模式 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k tokens |
| Read Set | Task E0/D1 与列出的当前内容/测试 |
| 历史文档 | 0 篇；原型数据只作行为参考 |
| 超预算处理 | 按 PROJECT-CONSTITUTION 停止条件上报，不扩大读写范围 |

## Confirmed Facts

| 事实 | 依据 | 施工含义 |
| --- | --- | --- |
| E1 已接入 Operation CardPool、StrategyBias、角色 Hand、Actor position 与 OperationView diagnostics | E1 Receipt、E0 | 数据必须经标准 Registry resolver / Admission / Runtime 消费 |
| Event Run roster 固定，当前没有中途 Actor join/remove 命令 | E1 Receipt、Task 当前事实 | BDemo 中途入队列为“未复制”，以已有 Actor 状态/Position 变化覆盖可表达的角色成长 |
| 当前 AC Carousel demo 是现有 `gameplay-b@1.0.0` 内容，不是新玩法实例 | `gameplay-b-datapack.ts` | 本 Unit 只新增独立路径与身份，不改/不替换现有演示 |

## Constraints

- 新 event 使用唯一 Event/Location/Action/StrategyProfile/CardPool/SceneCard/Route IDs；不得复用旧 Carousel 或 `prototypes/gameplay-b` 临时 ID。
- 目标路线约 10–12 个可进入节点，覆盖原型 12 节点/3 战斗的主要节奏：3 个战斗阶段、多个场所活动或 SceneAction、路线分支、结局；不能缩减为单战斗小夹具。
- 至少两个学生使用相同 weapon/position/Context，但 profile Strategy 不同；提供行动执行由 back→front 改变 Pool 命中；含一个使用相同 Action/Pool/Strategy 的微型 Negotiation Scene。
- 每个用于验证新 Context 的样例 Location 都必须命中显式 Pool；不能因为 selector 与 scene/activity 配置不一致，在新样例中意外回退 legacy `candidateActionIds`。U11 Transcript 已发现 12 东出口 `social/handoff` 引用 `exploration` Pool 的问题，修后须在终点断言有 handoff Pool 命中且候选来源非 legacy。
- Use only static Event/Location/Profile pool references and E1-declared facts. Do not add Runtime temporary Pool injection, random Pool sources, Actor roster mutation, UI, Editor or browser flow.
- 允许新增独立 ID 模块来防止字符串散落；允许新一份玩法 Datapack 文件和样例行为测试。禁止修改 E1 类型/Registry/Runtime/Schema，以及 `gameplay-b-datapack.ts` / Carousel 样例源码。
- 在 D1 Receipt 中附原型对标表：逐个主要原型 route segment / combat / activity / join / modifiers 标为“复制/以状态变化替代/未复制”并说明原因；清楚标出运行时动态入队与动态临时 Pool 不在本轮支持范围。

## Allowed Files

- `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids.ts`（new）
- `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`（new，包含 Datapack/事件内容）
- `tests/engine/gameplay-b-strategy-park-sample.test.ts`（new）
- `docs/plan-work/archive/task-0241-units/receipts/0241-d1-gameplay-b-strategy-park.md`（new；本 Unit Receipt）

## Explicit Non-goals

- Engine/Registry/Schema 变更、现有 Carousel demo 修改或新 Gacha 数据。
- Headless virtual-play Transcript（归 U11）。
- Editor、游戏 UI 或浏览器验收。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；如内容无法表达上述玩法且需要扩展 Engine/Runtime，记录真实失败事实并停止交 Task Owner。

## Completion Criteria

- [x] 新事件经标准 Registry resolver/OperationEntry 正常启动、游玩和结局，不修改旧 Carousel demo。
- [x] 内容规模接近对标门槛（12 节点、3 战斗阶段、多场所活动、分支路线/终局）；不必要地复制的原型候选规则被记录。
- [x] 测试证明两名同 weapon/position 角色因 Strategy 得到不同 Hand 倾向、front 变化激活新 Pool、Negotiation 复用统一机制，并证明所有新样例 Context 包含显式匹配 Pool、不触发 legacy fallback。
- [x] D1 Receipt 含完整 BDemo 对标映射和实际验证结果。

## Verification

- `npx vitest run tests/engine/gameplay-b-strategy-park-sample.test.ts`
- `npx tsc --noEmit`
- `git diff --check`

## Receipt

`docs/plan-work/archive/task-0241-units/receipts/0241-d1-gameplay-b-strategy-park.md`
