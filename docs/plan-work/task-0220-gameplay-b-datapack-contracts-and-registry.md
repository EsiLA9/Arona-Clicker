# Task 0220 — 玩法 B Datapack 定义与 Registry 校验

状态：proposed — 等待核心 Runtime 与路线语义稳定

## 目标

让 Operation Event、Location、Action 与学生 Profile 进入声明式 Datapack/Registry；参与者、组合规则、目标、结果与路线作为所属定义内的嵌入内容，使新事件主要通过内容定义建立。

## Why

若运行时规则和单局内容混写在产品代码，新增事件就会继续要求编辑 Runtime。Datapack/Registry 是 AC 已有的正式内容汇总边界。

## Scope

- 根据 Task 0213–0218 的稳定语义声明四类顶层定义：Event、Location、Action、StudentOperationProfile。
- ParticipantSpec、二输入 CombinationRule、Objective/Outcome、RouteEdge、TargetSpec 与 ActionTag 嵌入所属 Event/Location/Action/Profile；只有跨事件复用、独立查找或作者生命周期独立的概念才拆顶层 Registry 表。
- 使用 DefFactory/Builder 提供默认值、边界校验和友好错误；Registry 负责 ID/引用唯一性、闭合引用与跨定义校验。
- Registry 加载时构建稳定 ID 查找与 `sourceLocation→outgoing edges` 索引；整张有向拓扑只静态遍历一次。
- 使用隔离的测试/验证 Datapack fixture 证明合同与 Registry 行为；正式默认发布内容由 Task 0222 负责。
- 若定义进入 `src/engine/types/**`，遵守 Schema 同步并由生成器更新产物；仅产品域规则优先留在 `src/arona-clicker/` 内容合同。
- 提供一个小型完整事件定义作为合同验证内容。
- 对每地点 Actor、每 Actor 候选 Action、目标扇出、效果数、二输入规则、Predicate 节点、tracks/facts、每地点 Beat、总地点访问及日志大小定义硬上限，并随合同版本固定。
- 提供有效 `at-cap` 验证夹具覆盖各硬上限；耦合的 Runtime 热路径以可运行的上限组合压测。另提供 `2x-overflow` 校验夹具，使被测资源维度超过相应硬上限约两倍，用于验证 Registry 拒绝与诊断，不传入 Runtime。
- 静态验证仅覆盖 ID/引用/值域、终态存在和不读取运行变量的拓扑可达性（O(V+E)）；运行状态 Predicate 的完整目标可满足性可能指数增长，不在 Registry 加载中无界搜索。

## Non-goals

- 不把任意 TypeScript 回调、运行时脚本或外部代码作为 Datapack 字段。
- 不重构现有所有 Datapack 表、独立编辑器或内容打包流程。
- 不把 EventState 轨道硬编码成 PlayerState 字段，不把 Location 合并进 Area/Spot。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| Datapack 契约定义声明式内容，Registry 汇总定义、索引并验证重复 ID/引用。 | `docs/docs-829/03-data-structures/datapack-contracts.md`；`docs/docs-829/03-data-structures/registry.md`；`src/data-services/contracts/datapack.ts`；`src/data-services/registry/registry.ts` | 新玩法内容加入现有内容加载路，不自行建平行 Registry。 |
| 正式应用的默认内容入口位于 AronaClicker 内容层。 | `AGENTS.md`；`src/arona-clicker/content/default-datapack.ts` | 发布事件内容在产品默认包中维护。 |
| 引擎类型字段/枚举变更须使用 Schema 生成器，生成产物不可手改。 | `docs/docs-829/05-conventions/schema-sync.md` | 类型落点在进 Task 时需有证据；同步由项目流程处理。 |

## Data / API

- `OperationEventDef`、`OperationLocationDef`、`OperationActionDef`、`StudentOperationProfileDef` 进入顶层产品内容合同；其他小型规则为嵌入值。
- Objective/Outcome、Predicate、OperationEffect 保持封闭、小型、可校验的联合数据，不扩展成任意表达式引擎。
- Registry 查询按 ID 和事件结构导航；校验错误要指出所属 pack、事件/地点 ID 与字段路径。
- 默认内容使用领域 Builder/DefFactory；字段不直接开放未消费的 `Extra` 作逃生口。

## Runtime Flow

Datapack 来源解析 → Operation 定义 Builder/Validation → Registry 汇总与引用校验 → OperationRuntime 读取已验证的 Event/Location/Action → 以配置启动或推进 EventRun。

## Acceptance

- [ ] 一个新事件可只通过声明式内容完成地点、学生配置、动作、Intent、目标和出口定义；新增内容不要求修改 Action/Route Resolver。
- [ ] 缺失 Action、学生 Profile、Location、Route 或 Predicate 引用能在 Registry 加载阶段报告准确路径并阻止无效事件启动。
- [ ] 重复 ID、越界轨道、无效目标、无终局出口、拓扑上不可达的必需 Location 和违反资源上限的定义给出结构化诊断。
- [ ] 内容加载不尝试穷举运行状态以证明所有 Predicate/目标组合均可满足；目标可达性由有界运行测试/固定 Seed 样例验收。
- [ ] `at-cap` 定义合法并可供 Runtime 性能测试；`2x-overflow` 定义在 Registry 加载阶段被拒绝，诊断包含资源维度、实际值、上限和内容路径，不启动 Runtime。
- [ ] Registry 规模与构建耗时覆盖 `at-cap` 验证夹具；不得使用无界全图扫描解决作者诊断。
- [ ] 合法验证定义从测试/验证 Datapack 到 Registry 再到 Runtime 可运行；测试内容不会隐式成为正式默认内容。
- [ ] 若变更 Engine Schema，`npm run gen:schema` 后生成内容与定义源保持一致；生成文件无手工编辑。
- [ ] 现有 Datapack/Registry 行为与无关内容表保持原语义。

## Tests

- **Unit：**各定义字段验证与 Builder 默认值。
- **Runtime：**已验证 Definition 构造 Run、动作/状态配置能被 Resolver 消费。
- **Integration：**Datapack fragments→Registry→完整事件；不合法包稳定失败。
- **UI：**无需 Operation Editor；界面消费 Registry/View 投影。

## Dependencies

- 依赖 Task 0213–0218 的实体与行为语义；允许用稳定事件 fixture 先验证。
- Task 0221 依赖本 Task 的内容表、默认值和诊断合同。

## Documentation / GALHCG

- 稳定后更新 `docs/docs-829/03-data-structures/datapack-contracts.md`、Registry/Pack Loading 路由和新玩法 Authoring 机制页。
- Schema 对应的稳定定义概念进入 GALHCG 并 maps_to 到合同/Registry/默认内容；字段分支、Builder helper、Registry 私有表不分拆成语义节点。
- Read Set：`docs/docs-829/03-data-structures/datapack-contracts.md`、`registry.md`、`docs/docs-829/04-mechanisms/data-services/pack-loading.md`、`docs/docs-829/05-conventions/schema-sync.md`、目标合同/Registry 源码与测试。

## 当前核验与剩余工作

当前核对了 Datapack、Registry、默认内容及 Schema 边界；未创建字段、未生成 Schema、未运行测试。Task 开始时需按 Read Set 决定是否存在足够跨产品复用依据把某概念放入通用 Engine。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0219-gameplay-b-event-save-and-resume]]
- [[docs/docs-829/05-conventions/schema-sync]]
