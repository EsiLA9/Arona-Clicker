# Task：PB-02 — 让 Operation 阶段与结案文案对应事件

状态：completed — Operation 工作区现按事件内容显示入口、阶段、路线与结案文案。
> Goal Owner 统一裁定（2026-10-08）：PB-02 的施工默认规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；其中规则覆盖本 Task 在该裁定前写成“待定 / 待确认”的历史措辞。仅符合总裁定列出的升级条件时暂停。
> 实施状态（2026-10-08）：已按裁定完成；实现和自动化验收见“实施结案”。

## 目标

Strategy Park 的 Operation 开场、战斗标题、地点结束/出口提示及结案文案与游园巡查事件一致；旧旋转木马 Run 继续显示旧样例自己的文字。修正共享 UI 在 Strategy Park 复用旋转木马话术的问题，不重构所有 Operation 表现类型。

本 Task 覆盖 G01 的事件阶段文案，不拥有 Track / Fact / Item 名称和事实结算日志；这些由 PB-04 统一处理。

## 设计边界

- 本 Task 包含：使用现有事件特定呈现来源分流 Operation 展示文案；修正入口、开场、战斗标题、战斗结束/路线提示和结果短文；验证旧样例未被误改。
- 本 Task 不包含：新通用 Narrative 系统、Datapack Event 名称/说明字段、全 UI 文案迁移、站位/牌面设计、事实和物品日志文字。
- 已裁定来源：[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]。复用现有局部呈现数据优先；新增泛化数据契约需另行裁定。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Office 中确实有两个独立事件卡片，Strategy Park 的入口已用自己的标题、介绍、开始/继续按钮。 | `src/ui/components/center-panel.ts`：`renderOperationEntry()` 的 `entries` 数组同时包含 Carousel 与 `GAMEPLAY_B_STRATEGY_PARK_IDS.event`。 | 不把已经正确的 Strategy Park 入口文案改坏；测试同时守住两张卡。 |
| Operation Workspace 部分输出仍固定使用 Carousel 文案。 | `src/ui/components/operation-workspace.ts`：`renderMain()` 从 `COPY.resultText` 取结案文字；标题写“旋转木马安全战斗”；出口描述写只有旋转木马平台战斗。该组件还对所有 EventRun 显示 `COPY.event.introduction`。`COPY` 来自 `GAMEPLAY_B_PRESENTATION`，它的内容是旋转木马安全行动。 | Strategy Park 中不能再消费 Carousel 专属阶段文字；旧样例仍必须使用原来的 presentation。 |
| Strategy Park 已有少量事件特定呈现来源，但不是完整通用 Event Presentation。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts` 有 `PARK_MAP.title` 和路线地图呈现；`gameplay-b-presentation.ts` 的 `event`、`resultText`、三处 Location 则明确写 Carousel。OperationEventContentDef 本身无 event title/introduction/result-copy 字段。 | PB-02 使用现有局部呈现表/明示的事件分支即可；不顺便增加全新呈现系统或 Datapack 字段。 |
| 当前可见文案已有 Carousel 样例回归基础。 | `tests/ui/operation-workspace-view.test.ts` 和 `tests/engine/gameplay-b-scene-action-sample.test.ts` 测试旧样例；`tests/ui/gameplay-b-operation-controller.test.ts` 覆盖策略园入口和 Carousel 入口。 | 增补 Strategy Park 的无 Carousel 错误文案断言，并保留旧样例预期。 |

## 责任迁移与不迁移

- 迁移：事件特定的开场/阶段/结案文案由该事件的现有 presentation 数据拥有；共享 UI 依据 OperationView 的 Event 身份选择对应文字，不把 Carousel copy 当默认所有事件的正式文案。
- 不迁移：Operation Runtime 不获得叙事规则、不解释行动结果；结算算法和结果类型不变；事实、物品、轨道及行动名称不在本 Task 更改。

## 施工切片

### P0：整理本 Task 负责的字符串

- 盘点 Office entry、Operation opening、battle/scene stage heading、Location completion/route prompt 与 final-result copy。
- 将 PB-04 的 fact log 文字和 item/track 名称排除在本 Task 外，避免重复归属。

### P1：事件特定显示并保留兼容样例

- Strategy Park 选用自身现有介绍/呈现表或局部新增字段；Carousel 仍用其正式 copy。
- 通用兜底文案不得谎称地点、设施或只有某地点可以战斗。

## 测试与验收

- [ ] 在夏莱办公室读取两张 Operation 入口卡，Strategy Park 按钮/介绍仍写策略园；Carousel 按钮仍写自己的旋转木马样例。
- [ ] 点击“开始策略园试玩”，在碰碰车区检查 opening 和战斗标题，不出现“旋转木马安全战斗”；完成该地点并查看出口提示，不能声称“战斗只在旋转木马平台进行”。
- [ ] 推进至 Strategy Park 结案，结论内容不再描述旋转木马风险结局；保留与实际结果相符的通用或事件特定说明。
- [ ] 点击旧旋转木马入口并通过战斗、现场行动至结案，旧样例文案仍正确。
- [ ] 扩展 `tests/ui/gameplay-b-operation-controller.test.ts` 与 `tests/ui/operation-workspace-view.test.ts` 的可见文字断言；运行旧样例的 `tests/engine/gameplay-b-scene-action-sample.test.ts` 回归。
- [ ] 在 Edge 实际点击两种入口并走过至少一处战斗、一个出口和结案；不以静态字符串测试替代人工流程验收。

建议定向命令：`npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/operation-workspace-view.test.ts tests/engine/gameplay-b-scene-action-sample.test.ts`。

## Read Set

- `docs/docs-829/00-INDEX.md`、`docs/docs-829/02-modules/ui.md`、`docs/docs-829/02-modules/arona-clicker.md`
- `docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/05-conventions/architecture-discipline.md`、`docs/docs-829/05-conventions/testing.md`
- `docs/ai/context-packs/ui-presentation.md`、`docs/ai/PROJECT-CONSTITUTION.md`
- `src/ui/components/center-panel.ts`、`src/ui/components/operation-workspace.ts`、`src/arona-clicker/contracts/operation-view.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-presentation.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids.ts`
- `tests/ui/gameplay-b-operation-controller.test.ts`、`tests/ui/operation-workspace-view.test.ts`、`tests/engine/gameplay-b-scene-action-sample.test.ts`

## 明确非目标

- 不让 Carousel 样例失去其“旋转木马安全行动”文案。
- 不把事件介绍、地点名、Action、Fact、Item、Track、Route 一次性改造成新通用内容系统。
- 不改 EventResult、奖励、路线、战斗或场景行动规则。
- 不处理 PB-04 的“任何 knownFact 都显示旋转木马控制台”结算日志；那项修正在 PB-04 负责。

## 实施结案（2026-10-08）

- Operation Event 内容增加局部标题与简介；工作区的标题、开场、结案摘要和路线显示消费事件文案，并为未知事件保留通用回退。
- Carousel 与 Strategy Park 的事件文案已分别维护；PB-04 的 Track / Fact / Item 标签仍由其事件呈现映射负责。
- 定向回归：operation-workspace-view、gameplay-b-operation-controller、gameplay-b-scene-action-sample 通过。整组 9 文件定向套件共 133 项通过；类型检查通过。
- GALHCG：Task 已移至 docs/plan-work/archive/；迁移后路径映射已复核。
## 相关路由

[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/06-wiki/50-ui/00-index]]
