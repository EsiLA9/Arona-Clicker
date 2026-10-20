# U1：Encounter Action 作者合同

**状态：completed — P2/P3 review findings fixed; independent review passed**

## 目标

为 Map-local Action、Encounter 参与者、Tendency 候选与 MapRun 起始 Actor / Team resource 定义最小、单一作者语义；让 Registry 在运行前拒绝悬空或无效数据。

## 允许改动文件

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/registry/registry-validate.ts`
- `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`
- `tests/data/gameplay-b-map-registry.test.ts`

若必须改其它文件，停止并交回总控拆分。不得改 `engine-defs.gen.json`。

## Read Set

- Task 0290「作者数据与最小 Action 结果」及冻结行为表。
- `docs/docs-829/05-conventions/schema-sync.md` 与根 `AGENTS.md`：Schema 源与生成产物边界。
- `src/data-services/contracts/gameplay-map.ts`、`datapack.ts`、`src/data-services/registry/registry-validate.ts`。
- `tests/data/gameplay-b-map-registry.test.ts` 和当前 Gameplay B Datapack 样例。

## 约束

- Map 本地定义 Action 一次；Encounter 参与者只引用该 Map 的 Action ID 并配置正整数权重。不能引入 Profile / CardPool / StrategyProfile 必填链。
- C3 最少 Action target 为 `none`、`self`、`partyCharacter`；最少 effect 能修改 MapRun-local Actor / Team resource，费用分别使用 Actor / Team scope。
- 初始 Actor / Team resource 由 Map 显式配置，缺省为 0；只允许引用该 Map 固定队伍成员；值为非负安全整数。不能从 PlayerState 或 Operation Runtime 推导。
- Action ID 只在 Map 内唯一；`resumeVersion` 包含本 Map 全部 Action 和 Encounter 行为规则。
- Encounter 仍允许无候选并显示 Wait；Registry 不能为了避免空 Hand 而偷偷插入抽卡候选。

## 完成条件

- [x] Contract TSDoc 准确描述所有作者可见行为和状态归属。
- [x] Registry 验证 Map-local Action ID、Action / Target / Cost / Effect 数值、固定队伍参与者、Action 引用、Tendency 权重和初始 resource；并拒绝 Action、Target、Cost、Effect、Participant、候选和初始资源对象中的合同外字段；错误消息指向具体 Map / Node / Encounter / 字段。
- [x] 样例至少有两名队员、三种候选 Action、不同倾向和明确的初始 resource。
- [x] 测试覆盖有效数据及未知字段、重复 / 悬空 ID、重复 participant / eligible character、非正权重、无效参与者、非法费用 / resource 等拒绝情况。
- [x] 非施工者独立只读审查无阻塞问题；Receipt 见 [[receipts/receipt-U1-encounter-action-contract]]。

