# Task 0225 — 玩法 B 有限玩家场景卡组

状态：proposed — 等待 Task 0224 的 SceneAction 与共享费用合同完成

## 目标

为一场 Event 提供固定、有限的玩家场景卡组，以 EventRun 独立维护抽牌、手牌、弃置和已打出区域；所有抽牌可由事件 Seed 复现，卡牌只用于非战斗场景。

## Why

玩家需要在地点间安排有限的主动工具。固定卡组让卡牌成为路线内的 Cost 决策，而不是角色技能或长期构筑；显式卡牌区域和稳定抽牌顺序让选择、存档与结算都可解释。

## Scope

- 为每场 Event 配置固定卡组与抽牌规则；每个物理卡牌实例有唯一 ID，同名多张牌仍是不同实例。不提供购买、构筑、事件间继承或局内增生卡组。
- EventRun 维护 draw、hand、discard、played 四个互斥区域，并保留稳定抽牌顺序；卡牌定义由内容查找，Run 只保存实例和区域状态。
- 起始抽牌数、每次进入 Location 的抽牌数和手牌上限由事件内容明确给出；首期样例提供确定值。达到手牌上限时停止抽牌，未抽卡留在 draw。
- 卡组顺序由 Event Seed 确定；使用独立的卡组随机流或等价派生序列，不改变 Task 0215 的战术 Resolution 随机游标。
- 卡牌可在 Task 0224 的 SceneAction 批次中选择；其 PlayerCost 与同批 SceneAction 费用共同校验、一次扣除。有效提交后卡牌效果进入该批唯一 Resolution，并将卡牌移入 played；无效或资源不足时 Run 与卡牌区域保持不变。
- 手牌跨 Location 保留，除非卡牌效果明确移动卡牌。明确弃置才进入 discard；discard 与 played 均不会洗回 draw，draw 耗尽后不再抽到新牌。
- 卡牌效果只允许在非战斗 SceneAction 时机使用；效果可按内容影响合法角色目标或 Event 局部状态，并复用 Operation 的封闭 Action / Target / Effect 与 Resolution 规则。
- 为 Task 0219 精确存档、Task 0220 内容合同与上限、Task 0221 作者校验及 Task 0222 正式事件样例提供稳定的卡组状态语义。

## Non-goals

- 不提供角色消耗 PlayerCost 的技能，不把卡牌变成角色行动或战斗 Click 卡。
- 不增加弃牌区回洗、循环牌库、随机生成牌、牌组构筑、商店购买或跨 Event 卡牌库存。
- 不单独实现卡牌费用扣除器、卡牌 Resolver 或第二种结算记录；费用与结果复用 Task 0224 / Task 0215。
- 不扩展任意脚本效果、通用卡牌框架或独立卡牌编辑器。

## 设计依据与 AC 现状边界

- 固定有限卡组、Seed 抽牌、draw / hand / discard / played、已用牌不洗回及仅场景使用，是 Draft 0204 已确认的玩法输入。
- Task 0215 的统一 Resolution 与 Task 0219 的 Run 快照均为 proposed 设计目标，不能当作当前源码已支持卡牌状态的依据。
- 本 Task 可先通过 Task 0213 的 EventDefinition 临时 TypeScript 输入建立有限牌库运行规则，不等待 Datapack / Registry 合同；Task 0220 后续把稳定定义字段正规化并加入数值/数量硬上限，不改变卡组运行语义。

## Data / API

- Event 的固定卡组声明包含有限卡牌实例/副本、起始抽牌数、入场抽牌数和手牌上限；单张卡声明稳定 ID、费用、合法场景时机、目标范围及有限效果。
- EventRun 快照只保存四个区域的实例 ID 与 draw 顺序/位置；定义内容、效果函数、OperationView 与缓存均从 Registry 重建。
- SceneActionBatch 只接受当前 hand 中的卡牌实例 ID；同一实例不能重复选择，也不能同时出现在多个区域。
- discard 表示明确弃置而未打出的卡牌；played 表示已执行效果的卡牌。二者均不会返回 draw，首期不要求额外的玩家弃牌命令。
- 卡组内容必须是有限数量且每张实例有唯一 ID；本 Task 验证有限性与区域互斥，不虚构数值性能目标。Task 0220 后续决定 Registry 硬上限并用 at-cap / overflow 验证覆盖。

## Runtime Flow

建立 EventRun → 依 Event Seed 生成固定 draw 顺序并执行起始抽牌 → 进入 Location 时按配置抽牌至 hand 上限 → 玩家将零张或多张 hand 实例附加到 SceneAction 批次 → Task 0224 汇总费用并整体提交 → 成功时执行卡牌/行为并把实例移至 played，明确弃置时移至 discard；拒绝时不变 → 后续 Location 继续抽 draw，draw 耗尽则停止。

## Acceptance

- [ ] 相同 Event 内容与 Seed 产生完全相同的初始 draw 顺序；卡牌抽牌不推进 Task 0215 的战术随机游标。
- [ ] 每张物理卡有唯一实例 ID；重复卡名不会合并成一张牌，同一实例在任一时刻只属于一个区域。
- [ ] 起始抽牌、地点入场抽牌和手牌上限由内容明确控制；达到上限不丢牌，抽牌堆耗尽后不从其他区域补牌。
- [ ] 手牌可跨 Location 保留；成功打出的卡只进入 played，明确弃置的卡只进入 discard；两区都不会回洗到 draw。
- [ ] 一张卡只能从当前 hand 选择，并且只能在非战斗 SceneAction 批次使用；战斗 Beat 或不匹配场景时机的使用被拒绝。
- [ ] 选卡与 SceneAction 同批校验；提交成功时卡牌费用只计一次，卡牌效果与行动结果进入同一个 Resolution，实例只移动一次。
- [ ] 资源不足、无效目标、重复卡实例、卡牌不在手牌或批次过期时整批拒绝；PlayerCost、事件状态、随机游标和所有卡牌区域保持不变。
- [ ] 同一 Seed 与输入序列产生相同卡牌抽取、区域变化及 Resolution 记录；卡组状态始终受内容上限约束。

## Tests

- **Unit：**卡牌定义校验、唯一实例、区域互斥、手牌上限、draw 耗尽及弃置/打出转移。
- **Runtime：**Seed 重放、SceneAction 联合费用提交、拒绝原子性、战斗时机拒绝与卡组状态隔离。
- **Integration：**Task 0224 SceneAction → 一次费用扣除 → 单一 Resolution → 区域转移。Task 0219 再单独验收 Save/Resume 往返不重抽、不重放。
- **Content：**Task 0220 验证有界 at-cap 卡组与超限拒绝；Task 0221 覆盖作者诊断；Task 0222 正式内容覆盖抽牌、留牌和耗尽路径。
- **UI：**提供 hand、抽牌与已用状态的只读投影契约；浏览器流程由 Task 0222 验收。

## Dependencies

- 依赖 Task 0224 的 EventRun PlayerCost、SceneAction 批次原子提交与统一 Resolution；并传递依赖 Task 0213–0218。Task 0220 是后续声明合同/内容校验 Task，不是本 Runtime 卡组逻辑的前置。
- Task 0219、0220、0221、0222 的存档、内容合同、作者流程与正式样例均须依赖 Task 0225；本 Task 不修改这些既有任务文档。

## Documentation / GALHCG

- Runtime 稳定后更新 Operation 场景卡组的状态归属、抽牌时机、区域流转与存档边界；说明该卡组属于单个 EventRun。
- GALHCG 仅在卡组语义稳定并有源码、文档和测试证据后维护玩家场景卡组映射；单张卡牌、卡组实例和数值不建节点。
- Read Set：Task 0215、0219、0224 与 0220–0222、目标 Runtime / Registry / Save 源码和测试、[[docs/ai/task-read-set-routing]]、[[docs/ai/galhcg-project-map]]。

## 当前核验与剩余工作

已将 Draft 0204 确认的有限玩家场景卡组规则拆为 EventRun 状态、抽牌和 SceneAction 提交要求；未实现卡组接口、Datapack 合同、存档编码或测试。施工时由 Task 0220 定稿内容层级和数值上限。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[draft-0204-gameplay-b-map-and-player-actions]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]
- [[task-0219-gameplay-b-event-save-and-resume]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
