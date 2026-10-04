# Task 0218 — 玩法 B 因果地点与路线选择

状态：proposed — 等待 Task 0217 完成

## 目标

把 Event 建成可处置的问题地点图。玩家选择先处理什么会改变后续地点压力、可见事实、可用行动或事件结局；路线选择是单独的事件决策。

## Why

路线的产品价值来自事件因果和资源取舍。若节点只改变奖励或下一场敌人，地图不会成为玩法 B 决策的一部分。

## Scope

- `OperationLocationDef` 之间建立有向 RouteEdge，支持引用 Task 0217 的 EventPredicate 门槛。
- 当前 Location 完成后展示可用出口、未开放原因、访问记录和简要的已知风险/收益。
- 0 条合法出口时进入 Task 0217 的 Event 终止判定；1 条合法出口时自动转场；2 条以上合法出口时玩家发出独立 Route 命令选一条。
- 单出口自动转场和多出口选择都不创建 PreparedBeat/Resolution、不扣行动资源、不推进 Beat/Click 计数。
- 至少一个三地点事件样本有两条首选路线：各有明确收益和遗留代价，选择前显示已知取舍，后续状态兑现不同后果。
- 每个 Location 有目标/失败终态或有限 Beat 上限；事件有地点访问/回路上限，保证行动历史有界。
- 校验未知目标地点、必经死路、访问上限和不安全回路；允许内容有明确上限的回访。

## Non-goals

- 不做程序化地图生成、任意路径规划 DSL 或通用世界导航图。
- 不把 Event Location 映射成 AC Area/Spot。
- 不以奖励挑选代替至少一种可观察的事件状态后果。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| Area 属于 Init 空间；Spot 表示有功能/购买/升级等产品行为的场所实体。 | `docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`；`src/data-services/contracts/world.ts`；`src/arona-clicker/services/spot-service.ts` | 一次事件内临时问题地点采用独立 OperationLocation。 |
| Condition / Effect / Trigger 的声明已有明确状态写入、事件与生命周期职责。 | `docs/docs-829/04-mechanisms/engine/effect-trigger.md` | 路线 Gate 留在 Operation EventState 谓词范围。 |

## Data / API

- `RouteEdge`：目标 Location ID、可用条件、可读锁定原因、访问上限/消耗声明；作为 Location 内容的嵌入值。
- `LocationProgress`：访问次数、已完成 Beat 数、状态、局部结果与离开原因，属于 EventRun。
- `OperationLocationDef`：声明目标/失败条件或有限 Beat 上限；Event 内容另设总访问上限以界定路线循环。
- `RouteView`：只包含当前 Location 的出口、条件结果、状态影响摘要和不可用原因，不含可写内容引用或整张图副本。
- EventRun 保存当前地点与访问历史；Area/Spot 不新增关联字段。
- Registry 加载时建立 `sourceLocation→outgoing RouteEdge[]` 索引；当前地点终态或相关 EventState 版本改变时只评估本地点出口。

## Runtime Flow

Location 终止 → 应用离场影响并评估当前地点 RouteEdge → 0 条可用时评估 Event 终局 → 1 条可用时自动转场 → 2 条以上时投影路线取舍并等待选择 → 记录 LocationProgress 并初始化目标地点 → 开始下一 Beat。任何转场都不调用 Beat Resolver。

## Acceptance

- [ ] 至少一处有两个首选出口，二者都可取但不互相支配；UI 在选择前呈现已知利益和遗留风险/未处理问题，之后状态按所选分支兑现。
- [ ] 多出口需要一个独立 Route 命令；单出口自动推进。两者都不创建 Resolution、扣战术资源或增加 Beat/Click 计数。
- [ ] 无合法出口时不等待无法完成的 Route 输入、不创建 Resolution 或额外 Beat；调用 Event 终止判定并显示结果依据。
- [ ] 锁定路线说明缺少的事实/阈值/访问资格；选中失效出口会原子拒绝。
- [ ] Registry 静态检查能以图拓扑发现从入口不可达的必需地点、无终态/兜底的死路、无界访问环；状态 Predicate 的完整可满足性不在加载路径中无界搜索。
- [ ] 每地点 Beat 上限和总访问上限会在运行时阻止无限续环，达到上限时产生明确定义的 Location/Event 结果。
- [ ] 出口视图/条件评估只遍历当前地点的 indexed outgoing edges，不扫描全 Event 图或全 Registry。
- [ ] 回访上限、跳过地点代价和事件终局结果在 Runtime/View/日志中一致。
- [ ] OperationLocation 与 Area/Spot 可并存且各自保留原有语义。

## Tests

- **Unit：**边条件、访问/Beat 上限、锁定原因、O(V+E) 拓扑死路/回路检查。
- **Runtime：**单出口自动转场与多出口显式选择；至少两条不同路线的完整结果快照与相同 Seed 可复现。
- **Integration：**Route 命令→EventRun→新 Location View；无战术 Resolution 产生。
- **UI：**地点完成、出口确认、锁定原因、回访/跳过提示。

## Dependencies

- 依赖 Task 0217 的 EventState、Predicate 与 Location/Event Outcome。
- 事件终局前的多地点续局依赖 Task 0213–0216。

## Documentation / GALHCG

- 稳定后更新新的 Location/Route 机制页，并在 `docs/docs-829/06-wiki/30-arona-clicker-domain/` 下补充 Operation 与 Area/Spot 的语义边界说明。
- GALHCG 只记录 Operation Location/Route 作为独立稳定语义；单个路线边与地点配置不建立 Concept。
- Read Set：`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`、`docs/docs-829/03-data-structures/registry.md`、`docs/docs-829/04-mechanisms/engine/effect-trigger.md`、Task 0217 源码与测试。

## 当前核验与剩余工作

当前只核对 Area/Spot、Registry 与运行条件的职责；未实现、未运行测试。路线门槛只承诺读取 EventState；若需读取玩家全局条件，必须重新核对访问边界。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0217-gameplay-b-objectives-and-partial-outcomes]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
