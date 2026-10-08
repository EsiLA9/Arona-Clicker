# Unit 0235-U09：AronaClicker 领域功能 Wiki

## Goal

用玩家能观察到的流程解释状态、世界线、角色成长、剧情和聊天领域如何协作。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/30-arona-clicker-domain/00-index.md`、`state-and-mutation.md`、`world-lifecycle.md`、`character-acquisition-growth.md`、`story-and-chat.md` | 本 Unit 所有产品领域 Wiki 页 |
| 源码 | `src/arona-clicker/state/state-mutation-service.ts`、Init/Spot、gacha/character、story/chat 的主要 service | 核实产品状态和业务服务责任 |
| 测试 | `tests/engine/state-mutation-service.test.ts`、`tests/engine/gacha-service.test.ts`、对应 story/lifecycle 测试 | 可观察结果和拒绝条件 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 18k–40k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 按产品场景分组；不因交叉引用展开所有内容定义 |

## Optional Read Set

- `docs/ai/context-packs/character`、`world-lifecycle`，仅按命中的子题查路线。

## Do Not Read by Default

- `docs/plan-work/archive/**`、无关玩法 Demo/历史截图。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 领域 Wiki 将状态、世界线、角色、剧情聊天列为分立主题。 | `06-wiki/30-arona-clicker-domain/00-index.md` | 调查时按当前服务和测试校正边界。 |
| 状态写入由 StateMutationService 与业务服务协作，`resourceChanged` 是可观察消息，View/ReadModel 是读取输出。 | `src/arona-clicker/state/state-mutation-service.ts`：`changeResource()`、`resourceBucket()`；`tests/engine/state-mutation-service.test.ts` | 初始化/存档恢复是独立生命周期操作，不等于单字段 mutation。 |
| Init 切换以 `InitSavepoint` 保存/恢复局部字段；Area 移动检查当前 Init、剧情阻断、可达与可见条件。 | `src/arona-clicker/services/init-service.ts`：`resumeInit()`、`restartInit()`、`hardRestartInit()`、`travelToArea()`；`tests/engine/init-global-lifecycle.test.ts` | 软重启与硬重启对快照的处理不同。 |
| GachaService 逐抽结算并经 mutation 更新资源/持有状态/卡池计数；培养推演函数本身不写状态。 | `src/arona-clicker/services/gacha-service.ts`：`roll()`；`services/cultivate-system.ts`：`applyExp()`、`checkBreakthrough()`；`state/state-mutation-service.ts`：`addExp()`、`breakthroughStar()`；对应 gacha/cultivate tests | 角色状态作用域可按 Registry 持久化配置改变。 |
| StoryEntry 是触发入口、StoryDef 是 Talklet 演出内容；ChatFlowService 发表现事件而不直接写 PlayerState。 | `src/arona-clicker/services/story-service.ts`、`story-flow.ts`、`chat-flow-service.ts`；`tests/engine/chat-flow-service.test.ts`、`tests/engine/story-flow.test.ts` | Story 当前游标与已完成/已读状态分开管理。 |

## Constraints

- 以玩家可见操作作叙事线索，再解释状态 owner 和服务，不臆造设计动机。
- “事件、故事、Story”涉及不同类型时按实现定义区分。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u09-wiki-domain.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/30-arona-clicker-domain/00-index.md`
- `docs/docs-829/06-wiki/30-arona-clicker-domain/state-and-mutation.md`
- `docs/docs-829/06-wiki/30-arona-clicker-domain/world-lifecycle.md`
- `docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth.md`
- `docs/docs-829/06-wiki/30-arona-clicker-domain/story-and-chat.md`

## Explicit Non-goals

- 不更改产品规则、角色数值、抽卡表或剧情文案。
- 不将示例内容或玩法 B 专属机制描述成所有 Init 共同行为。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；状态和存档边界冲突时暂停该页并将证据送回上游。

## Completion Criteria

- [x] 四个功能主题从入口、主要 service、状态影响、事件/更新和测试能追通。
- [x] 每个领域页链接状态结构、机制正文、UI 展示或下游功能的适用入口。
- [x] Wiki 分区首页能帮助读者按问题选读，而不要求先理解所有服务名。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 用户流程核验 | 角色获得、进入世界线、读故事三条路径 | 源码/测试支撑页面所述行为 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt 0235-U09

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 本 Unit 白名单内更新 `06-wiki/30-arona-clicker-domain/00-index.md`、`state-and-mutation.md`、`world-lifecycle.md`、`character-acquisition-growth.md`、`story-and-chat.md`；补充新人术语解释、玩家操作路径、源码符号、测试证据与前后向链接。本 Unit 文档增加 Confirmed Facts 与 Receipt。 |
| 未完成内容 | 未修改玩家玩法规则、角色数值、抽卡表或剧情内容；未调查 UI 的像素级入口和所有角色持久化配置。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | `review_changes(directory="docs/docs-829/06-wiki/30-arona-clicker-domain")` 与本 Unit Unit-file 路径查询均 complete=true；刷新 GachaService、StateMutationService、PlayerState、InitService、StoryService 等 6 条文档映射 Evidence，并刷新 U09 Unit 文件的 `goal-workflow` 映射；本 Unit 7 条文档映射均 fresh。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 源码与 `tests/engine/state-mutation-service.test.ts`、`tests/engine/init-global-lifecycle.test.ts`、`tests/engine/gacha-service.test.ts`、`tests/engine/cultivate-system.test.ts`、`tests/engine/character-persist.test.ts`、`tests/engine/story-flow.test.ts`、`tests/engine/story-entry-split.test.ts`、`tests/engine/chat-flow-service.test.ts` 对照 | 未执行 | 仅用于审查证据，没有运行 Vitest。 |
| 文档链接 | `npm run check:docs` | 通过 | 最终复跑：681 Markdown，0 errors。Task 0238 的临时错误已由任务负责人修复。 |
| 差异检查 | `git diff --check`（跟踪中的 Wiki 页）+ `rg -n "[\t ]+$"`（3 个 Unit 文档） | 通过 | Wiki 无差异空白错误；Unit 文档无行尾空格命中。 |
| GALHCG | 本 Unit 相关文档目录与 Unit-file 路径 `review_changes`、`plan_map_updates`、`update_map`、`verify_freshness` | 通过 | 检查 complete=true；计划有效；Wiki 与 Unit 文件映射 Evidence 均 fresh。 |

### 遇到问题

- 本次 AronaClicker 领域源码/测试范围内未确认需要产品代码修复的 P0–P3 问题；原 Wiki 缺少新人可跟随的流程、符号和测试链接，已补齐。
- Task 0238 的临时链接检查错误由任务负责人修复；最终全局文档检查通过。

### 需上游确认项

- 无。

### 事实更新建议

- 无；四个领域流程的机制细节仍由现有 03/04 页面承担。
