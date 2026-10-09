# Task：PB-05 — 显示学生站位和行动可用状态

状态：completed — 学生卡显示已有站位、计划/可替换状态和 View 提供的不可用原因。
> Goal Owner 统一裁定（2026-10-08）：PB-05 的施工默认规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；其中规则覆盖本 Task 在该裁定前写成“待定 / 待确认”的历史措辞。仅符合总裁定列出的升级条件时暂停。
> 实施状态（2026-10-08）：已按裁定完成；实现和自动化验收见“实施结案”。

## 目标

在学生卡上让玩家看懂前排/后排；对当前计划、可替换行动及 View 已投影为不可选的行动，清楚标记状态并显示现有原因。位置效果结算后，站位文字与当前 View 中的行动候选同步更新。

本 Task 只表现已有 `OperationView` 投影，不改学生行动、站位效果、Pool 筛选或行动合法性规则。

## 设计边界

- 本 Task 包含：在学生卡上显示既有 `positionId` 的玩家可读位置名；清楚区分当前计划与替代行动；对 `selectable === false` 的已投影行动显示可理解原因；保留已有 fixed SceneAction / PlayerSceneCard 标记。
- 本 Task 不包含：完整卡片重设计、出现所有未进入 Hand 的候选行动、重新判定合法目标或费用、改变 Profile/Pool/Action 规则。
- 已裁定来源：[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]。Roadmap 的“fixed、可替换、不可用”对所有战斗牌并非现有 OperationAction 契约；战斗牌应准确显示“当前计划/可替换/不可用”，不为战斗 Action 发明新的 fixed 语义。既有 SceneAction/Card `selectionPolicy: 'fixed'` 仍显示固定状态。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| View 有站位，但学生卡不显示站位。 | `src/arona-clicker/contracts/operation-view.ts`：`OperationViewActor.positionId?`；`operation-view-projector.ts` 将 actor 的 `positionId` 投影出来。`src/ui/components/operation-workspace.ts`：`renderStudent()` 只显示 actor 名、头像和 `renderStudentVitals()`，没有读取 `positionId`。 | UI 直接消费 View 的位置数据，不从人物 ID 或地点推断前后排。 |
| Strategy Park 的站位有可见玩法效果。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`：星野、芹香 `positionId: 'back'`，白子 `front`；`stepForward` 效果设 actor `positionId: 'front'` 且仅 `back` 位置候选；`frontGuard` 只对 `front` 激活，front/back CardPool 按 `positionIds` 筛选。`tests/engine/operation-runtime-service.test.ts` 包含“commits position effects and re-resolves the next Character Hand from the new position”。 | 显示站位变化即可直接解释为何可见行动随位置变化；不要在 UI 里重算池子。 |
| 当前计划、备选与不可选标记有数据，但战斗牌没有 fixed 选择策略。 | `OperationViewActionOption` 包含 `selectable`、`blockedReasonIds`、`missingCapabilityIds`、`reasonIds`；`projectOperationActorHand()` 将当前计划与备选映射成 selected/locked。`OperationViewSceneAction` / `OperationViewSceneCard` 才有 `selectionPolicy: 'required' | 'fixed'`。 | 对战斗 Action 显示“当前计划”“可替换”“不可用”不应虚构 fixed 状态；fixed label 只保留于有该合同的 SceneAction/Card。 |
| Strategy Park 的现有不适用原因可能落入 Carousel 专属文案兜底。 | `operation-workspace.ts` 的 `optionReasons()` 提取能力、阻塞与 Operation 原因；`renderAction()` 从 `CAROUSEL_SAFETY_PRESENTATION.reasons` / `abilities` 查文案，未命中时用“当前无法采用”。`GAMEPLAY_B_STRATEGY_PARK_MAP` 有 Strategy Park Action/Actor copy，但没有对应 reasons/abilities 表。 | 展示依据必须使用 View 原因 ID；补足的是阶段所需的可读映射，不是业务合法性计算。若真实策略园内容不提供可见的不可选卡，使用明确的 UI fixture 验证 blocked 状态，不新增假规则/牌。 |
| 旧 Carousel 的 fixed SceneAction/Card 已有独立交互测试。 | `tests/ui/gameplay-b-operation-controller.test.ts`：测试 fixed SceneAction 不可交互且不会从批次移除；`tests/ui/gameplay-b-strategy-park-map.test.ts` 覆盖 Strategy Park SceneAction 卡片。 | PB-05 不得把 fixed 场景选择改成普通可替换行动，保留原测试。 |

## 责任迁移与不迁移

- 迁移：现有位置/资格原因的含义由 Operation View/可信内容提供；UI 按 `positionId`、`selectable` 和 reason IDs 渲染，不重算合法性。
- 不迁移：位置写入与行动筛选仍由 `OperationRuntimeService`、CardPool resolver 和 OperationAction 规则拥有；UI 不保存位置，也不调整计划结果。

## 施工切片

### P0：把现有只读状态呈现到学生卡

- 只显示内容中有约定的前排/后排词；未知 `positionId` 先使用安全的中性显示，不要直接暴露原始 Operation Actor ID。
- 当前计划和可替换行动使用可理解且不相互混淆的状态文案。已有 disabled/blocked 原因取自当前 View。

### P1：为策略园当前原因补足可读文案

- 先列出 Strategy Park 初次行动手牌/合法 View 可能提供的原因 ID，并检查现有文本来源。
- 如果样例不能在真实点击流程中形成 `selectable=false` 卡，添加最小 `OperationView` render fixture；不增加虚构内容或改变合法状态。

## 测试与验收

- [ ] 从夏莱办公室启动 Strategy Park，并到碰碰车区；星野/芹香显示后排、白子显示前排。
- [ ] 当后排学生手牌有“进入前排”时，点击该可替换行动并点击“提交本回合”；提交后学生卡改为前排，当前 View 的候选/牌面按 Runtime 重算结果同步更新。不得只在 UI 内改 badge 而让 Runtime 状态不变。
- [ ] 在一个包含不可选候选的 OperationView 中，卡面明确标示不可用并显示 View 已提供的原因；该 UI 测试不得通过复制一套 Action 判定来制造原因。
- [ ] 当前计划与备选行动可见且区别明确；fixed SceneAction/Card 仍标明固定、不能移除。
- [ ] 通过 `tests/ui/operation-workspace-view.test.ts` 测试位置 badge、计划/替代/blocked reason；通过 `tests/engine/operation-runtime-service.test.ts` 中已有 position effect 回归确认 Runtime 选择同步；保留 `tests/ui/gameplay-b-operation-controller.test.ts` 与 `tests/ui/gameplay-b-strategy-park-map.test.ts` 的实际交互。
- [ ] Edge 实际完成一次后排→前排行动；检查位置标签以及随后可见卡片。另对无法使用的候选读取解释，不要求点击禁用牌。

建议定向命令：`npx vitest run tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-controller.test.ts tests/ui/gameplay-b-strategy-park-map.test.ts tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts`。

## Read Set

- `docs/docs-829/00-INDEX.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/05-conventions/testing.md`
- `docs/ai/context-packs/ui-presentation.md`、`docs/ai/context-packs/character.md`、`docs/docs-829/05-conventions/architecture-discipline.md`
- `src/arona-clicker/contracts/operation-view.ts`、`src/arona-clicker/contracts/operation-beat.ts`、`src/arona-clicker/services/operation-view-projector.ts`、`src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts`、`src/arona-clicker/content/operation-samples/carousel-safety-copy.ts`、`src/ui/components/operation-workspace.ts`
- `tests/ui/operation-workspace-view.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`、`tests/ui/gameplay-b-strategy-park-map.test.ts`、`tests/engine/operation-runtime-service.test.ts`、`tests/engine/gameplay-b-event-runtime-integration.test.ts`

## 明确非目标

- 不让 UI 根据角色 ID、Action ID、Location ID 猜测站位或行动可用性。
- 不把所有内容包中任意 `positionId` 自动归并成“前排/后排”；本阶段以 Strategy Park 已声明的 front/back 为准。
- 不显示未进入当前 CharacterHand/ActionOption 投影的所有 ActionPool 选项。
- 不更改“自动计划”是否可替换、牌数、Action 合法性、目标、费用、敌人行为或固定场景行动规则。

## 实施结案（2026-10-08）

- 学生卡从 View 显示前/后排；未知站位使用中性提示。战斗行动标注当前计划、可替换或不可用，并显示投影原因；UI 不重算合法性，SceneAction / Card 的 fixed 语义保留。
- 定向回归：operation-workspace-view、gameplay-b-operation-controller 与 gameplay-b-strategy-park-sample 通过。整组 9 文件定向套件共 133 项通过；类型检查通过。
- GALHCG：Task 已移至 docs/plan-work/archive/；迁移后路径映射已复核。
## 相关路由

[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/ai/context-packs/ui-presentation]]
