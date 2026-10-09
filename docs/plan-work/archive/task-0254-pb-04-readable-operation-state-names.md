# Task：PB-04 — 让 Operation 轨道、事实与物品可读

状态：completed — Strategy Park 与 Carousel 的 Track / Fact / Item 标签已从各自事件呈现资料显示。
> Goal Owner 统一裁定（2026-10-08）：PB-04 的施工默认规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；其中规则覆盖本 Task 在该裁定前写成“待定 / 待确认”的历史措辞。仅符合总裁定列出的升级条件时暂停。
> 实施状态（2026-10-08）：已按裁定完成；实现和自动化验收见“实施结案”。

## 目标

玩家在 Strategy Park 中能读懂风险轨道、已记录事实和已获得物品的名称；状态区、背景信息、行动结算和路线日志使用一致且正确的字词，不泄露 `operation-track` / `operation-fact` / `operation-item` 内部 ID。旧旋转木马样例的事实/物品名称仍正确。

本 Task 负责轨道、事实、物品标签和对应的事实/物品结算日志；PB-02 负责事件开场、阶段标题与结案叙述。

## 设计边界

- 本 Task 包含：为两个已有样例中本阶段可见的 Operation Track / Fact / Item 提供符合现有事件内容的可读名称；让 OperationWorkspace 的状态、背景、结算和路线文案一致消费这些名称；消除“任何事实都叫旋转木马控制台已检查”的错误映射。
- 本 Task 不包含：更改事实/轨道/物品规则、目标判定或奖励；建立全项目通用名词服务；增加新的 Scene 抽象；擅自为 DataPack 增加 Schema 字段。
- 已裁定来源：[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]。现有 Operation 内容与 View 不携带这些局内名称。实施优先核对现有样例呈现映射；如果需要新 Datapack 字段或改 Registry Schema，停止并回到上游重审范围。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| OperationTrackDef 没有显示名或描述。 | `src/data-services/contracts/operation.ts`：`OperationTrackDef extends OperationBoundedValueDef`，只增加 `id`。`OperationEventContentDef` 的 `tracks` 是定义列表。 | Risk track 的可读名目前必须来自现有样例表现数据或后续明确裁定的投影字段；不把某个内部 ID 文本拆解成用户标签。 |
| Event 内事实与物品只登记 ID 集合；OperationView 将当前状态投影为 ID/数值。 | 同一文件的 `OperationEventContentDef.factIds` / `knownFactIds` / `itemIds` / `heldItemIds`；`src/arona-clicker/contracts/operation-view.ts` 的 `tracks`、`knownFactIds`、`heldItemIds`。Strategy Park 的 `operation-item` 与 `operation-fact` 是事件局内身份，不等同于全局 `ItemDef`。 | 不假设 UIContext 的全局 Item 名称查询会解析 Operation Item；PB-04 以有证据的事件样例文案为准。 |
| 当前 Strategy Park 轨道与事实表面会泛化或显示 ID，结算事实还会显示错误 Carousel 文案。 | `src/ui/components/operation-workspace.ts`：`renderProgress()` 未命中 `TRACKS` 时用“现场状态”；`renderBackground()` 仅匹配 Carousel Fact ID；`renderResolutions()` 对每个 `knownFact` 都固定显示“旋转木马控制台已检查”；`operationItemName()` 对两个 Park Item 单独硬编码，其余回退 ID。 | 状态区、背景区、事实结算日志与 Item/路线显示应统一用同一标签来源。PB-02 不再改这几处 Fact/Item 行。 |
| 已有事件特定文案可部分复用，但缺轨道/事实标签。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts` 已提供 `actions`、`sceneActions`、`actors`、地点和区域名称；`tests/engine/gameplay-b-strategy-park-sample.test.ts` 的 Action copy 测试要求 Map action presentation 与 ActionDef 文案吻合。该 map 当前没有 track/fact label 表。 | P0 在既有 presentation map 与 `OperationView` 当前能力间确定最小来源。可扩展样例局部 presentation map；不得假称已有通用 Datapack 标签合同。 |
| Carousel 有自己的轨道、物品和事实文字回归。 | `src/arona-clicker/content/operation-samples/gameplay-b-presentation.ts` 提供 Carousel tracks 与 itemName；`tests/ui/operation-workspace-view.test.ts` 断言结算日志“记录事实：旋转木马控制台已检查”和“获得员工证”。 | 必须把旧样例断言保留为事件专属正确结果；修复误用，不是删除原文案。 |

## 责任迁移与不迁移

- 迁移：局内 Track/Fact/Item 的用户可读文字归属于对应事件的现有呈现资料（在确认后可由 View 一致提供）；UI 负责格式化，不以 ID 判断事实含义。
- 不迁移：`EventRun` 继续持有 ID/数值状态，内容规则继续以稳定 ID 计算；名称呈现不得成为事实所有者，不得触发状态写入。

## 施工切片

### P0：确认事件局内名称的有限权威来源

- 对照 Strategy Park `IDS.tracks.risk`、`IDS.facts.*`、`IDS.items.*` 与当前 Action / Objective 文字，列出用户实际可见的名称；不要把“记录 fact”这条状态规则复制到 UI。
- 优先沿既有样例 presentation map 增加缺失标签或从现有 View presentation 读；若必须扩展 OperationEvent Datapack / Registry Schema，停止并上报，另做设计裁定。

### P1：所有 Operation 状态面统一查名

- 将同一事实/物品/轨道在状态区、背景面板、Resolution 与路线描述中的标签统一。
- 未知 ID 应安全回退到用户可理解的内容（至少不再输出明显内部 `gameplay-b-...:operation-*` 技术 ID），并保留足以诊断未知内容的 DOM data id。

## 测试与验收

- [ ] 启动 Strategy Park，显示的轨道名为“现场风险”或裁定的等价名称，而非泛化“现场状态”或 `gameplay-b-strategy-park:operation-track:...`；点击观察/压制等会改变该轨道的行动后，进度与结算日志显示同一名称。
- [ ] 在西门点击“领取巡查任务”并确认本批，背景/结算中的“队伍已完成出发简报”事实可读，不出现原始 fact ID 或“旋转木马控制台已检查”。
- [ ] 在电玩馆/交涉路线取得维修通行证或在服务亭取得员工广播凭证；持有物、取得日志、路线要求和消费记录显示同一物品名称。
- [ ] 旧 Carousel 流程记录控制台事实并获得员工证，仍显示“旋转木马控制台已检查”和“员工证”。
- [ ] 在 `tests/ui/operation-workspace-view.test.ts` 增加 Strategy Park 的状态/Resolution 呈现断言；若新增 View 标签字段，在 `tests/engine/operation-view-projector.test.ts` 断言字段来源及 detached 投影；保留 `tests/engine/gameplay-b-strategy-park-sample.test.ts` 与旧样例回归。
- [ ] Edge 实际游玩策略园西门、风险变化和凭证路线，确认同一 Fact/Item 名称在状态、结算和路线中一致。

建议定向命令：`npx vitest run tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-controller.test.ts tests/engine/operation-view-projector.test.ts tests/engine/gameplay-b-strategy-park-sample.test.ts tests/engine/gameplay-b-scene-action-sample.test.ts`。若实施证明不需 View 改动，可省去不受影响的 View projector 测试；不要为测试命令而新增无行为测试。

## Read Set

- `docs/docs-829/00-INDEX.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/05-conventions/testing.md`
- `docs/ai/context-packs/ui-presentation.md`、`docs/ai/context-packs/datapack-schema.md`（仅在拟加字段时）、`docs/docs-829/05-conventions/schema-sync.md`（仅在拟改字段/枚举时）
- `src/data-services/contracts/operation.ts`、`src/arona-clicker/contracts/operation-view.ts`、`src/arona-clicker/services/operation-view-projector.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-presentation.ts`、`src/ui/components/operation-workspace.ts`
- `tests/ui/operation-workspace-view.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`、`tests/engine/operation-view-projector.test.ts`、`tests/engine/gameplay-b-strategy-park-sample.test.ts`、`tests/engine/gameplay-b-scene-action-sample.test.ts`

## 明确非目标

- 不创建 `OperationFactDef`、Track name 数据库或全产品命名 Registry。
- 不改 Operation Datapack schema，除非上游重新确认并独立给出该范围。
- 不改任何真实状态 ID、存档字段或 Runtime 事实/物品写入口；不增加迁移兼容层。
- 不顺手重做 Actor、Action、Location 或 Map 名称；既有内容文案以各自当前来源为准。

## 实施结案（2026-10-08）

- Strategy Park presentation map 增加 Track、Fact、Item、结果和 Runtime 理由的可读标签；Carousel 保留独立标签。未知标签安全回退，不把内部 ID 当玩家文案。
- 定向回归：operation-workspace-view 与 gameplay-b-strategy-park-sample 覆盖事件名称与结算呈现。整组 9 文件定向套件共 133 项通过；类型检查通过。
- GALHCG：Task 已移至 docs/plan-work/archive/；迁移后路径映射已复核。
## 相关路由

[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/05-conventions/schema-sync]]
