# Goal 工作流 — 从玩法意图到施工

> 本文回答：如何让长期终点、阶段规划、方案讨论、源码核验和本地施工各有归属。它只规定协作流程，不记录具体玩法；当前规则由 `AGENTS.md` 与 `docs/docs-829/` 路由，GALHCG 主动帮助发现未知实现与文件关系，但必须回到源码和测试核证。

## 五层对象

| 对象 | 唯一职责 | 存放位置 | 删除 / 完成后 |
| --- | --- | --- | --- |
| Goal Set | 一轮讨论的最终玩家体验、阶段全图和依赖顺序 | `docs/plan-work/goalsets/<set-id>/` | 可以整组删除 |
| Goal Card | 一个有独立完成定义的阶段结果，以及它对最终目标的贡献 | 同一 Goal Set 目录，每 Goal 一张 | 随 Goal Set 删除 |
| Draft | 一个 Goal 的滚动语义裁定和事实问题 | `docs/plan-work/draft-*.md` | 保留为设计来源；失效时归档 |
| Task | 已裁定且可验收的调查或施工边界 | `docs/plan-work/task-*.md` | 核验后移入 `archive/` |
| Patch Unit / Receipt | 单次施工白名单与实际结果 | 活动 Task 内，或超过 3 个 Unit 时拆至 Task 同级目录 | Task 完成/冻结后随 Task 归档 |

默认关系为一个 Goal → 一份滚动 Draft → 一个实施 Task；这是减少文档分裂的偏好，不是数量约束。Goal Set 可以包含多个 Goal。独立可验收、可供多个后续 Task 复用的只读审计可以另立 Task；小范围事实核对留在 Draft 的事实门槛中。单个 Goal 因责任边界变化而需要多个 Task 时，必须写明各自验收结果、依赖和未完成的最终目标部分。

Codex Goal 只负责当前会话的持续执行。长期状态、决策、验收与剩余工作写在 Draft / Task；不要把 Codex Goal、Goal Card 与 Patch Unit 的 `Goal` 字段视为同一对象。

## 权威与可删除边界

- 当前实现事实来自源码、测试与 `docs/docs-829/`；Goal Set、Goal Card 和 Draft 表达意图、裁定或待核对问题，不升格为当前机制事实。
- SolChat 给出建议和方案；本地 AI 用项目 Read Set 核对代码证据；人类裁定玩法优先级和架构级选择。Draft 的裁定记录区分建议、决定和依据。
- Goal Set 只向持久文档发出链接。`docs/plan-work/goalsets/README.md` 以外的 Goal Set 文件不得成为其目录外 WikiLink 的目标；持久 Draft、Task 和机制文档须独立解释目标与边界。因此整组删除不会使正式记录失去含义。
- Goal Set 的进度表只链接 Draft / Task，不再复制它们的状态与验收结论。`docs/plan-work/00-index.md` 只链接稳定的 Goal Set 使用说明及正式活跃文档，不逐张登记可删除的 Goal Card。
- 正式 Draft / Task 保持全局唯一文件名；Goal Set 内文件名带 `<set-id>` 前缀，遵守 `check:docs` 的唯一性检查。

## 流转

以下完整流转用于需要阶段规划、方案裁定或明确施工边界的工作。普通小需求可直接实施并说明结果，无需先建 Goal Set / Draft / Task / Unit / Receipt；测试与审查按 [[docs/docs-829/05-conventions/testing]] 分级，重要系统结构设计与已报告 bug 优先严格验证。

1. **提出需求**：在 Goal Set 写完整终点、明确暂缓项、阶段全图和依赖；每个阶段只有独立可验收时才建 Goal Card。使用 [[docs/ai/templates/goal-set]] 和 [[docs/ai/templates/goal-card]]。
2. **讨论阶段目标**：每个进入讨论的 Goal 建一份 Draft；多轮 SolChat 意见继续更新同一 Draft 的裁定记录，不为每轮建议另建文档。使用 [[docs/ai/templates/discussion-draft]] 与 [[docs/ai/prompts/sol-discussion]]。
3. **核对事实**：把会改变方案或验收边界的未知项列为事实门槛。先按 [[docs/ai/galhcg-project-map]] 主动搜索相关 Module、Concept、相邻源码与当前文档；零命中时换别名、路径或源码字面量继续定位，不能以“图里没有”作结论。再按 [[docs/ai/task-read-set-routing]] 读取最小源码与测试，记录证据、结论和影响。使用 [[docs/ai/prompts/local-fact-review]]。事实核对不自动形成新的阶段目标。
4. **冻结施工范围**：Draft 满足下方准入后，建立 Task 并在 `docs/plan-work/00-index.md` 登记。Task 写独立目标、当前代码事实、验收与剩余工作，不以 Goal Set 为必读前提。使用 [[docs/ai/templates/execution-task]]。
5. **执行与收尾**：需要白名单边界的施工 Task 按 [[docs/ai/PROJECT-CONSTITUTION]] 拆 Patch Unit / Receipt。源码、测试或当前机制文档变化后，用 GALHCG 主动只读复核直接受影响路径： `graph_health(check="changed", options={"path":"<相对路径>"})`。需要维护且授权范围明确时，按 `.galhcg/agent-maintenance.md` 更新有证据支持的关系；定向刷新不能替代语义映射更新，查询和说明安装不自动授权上述写入。实际核验后归档。用户要求清空当前工作区时，也可冻结未完成 Task 并保留原状态与待续记录。实现稳定的机制再按文档维护规则沉淀到 `docs/docs-829/`；只完成一个阶段不等于整个最终目标完成。

## Draft → Task 准入

| 门槛 | 必须可回答的问题 |
| --- | --- |
| 语义 | 玩家 / 数据包作者可观察到什么结果？权威状态属于哪一层？哪些能力明确暂缓？ |
| 事实 | 哪些状态读取、写入方、事件、生命周期及测试入口已由源码核对？剩余未知是否会改变方案？ |
| 验收 | 此 Task 有什么独立完成定义？和其他 Task 的依赖、边界是什么？ |
| 施工 | 所需 Read Set、修改边界和验证入口能否被拆成符合预算的 Unit？ |
| 追踪 | 本 Task 覆盖 Goal 的哪一部分？完成后还剩什么？ |

不满足时继续更新 Draft，并只调查会改变结论的事实。不得用“先做一次全仓审计”取代明确的问题，也不得把 SolChat 的建议写作当前源码事实。

## 何时另立文档

- **另立 Goal**：有独立玩家/作者结果和完成定义，而不只是同一结果的实现步骤。
- **另立 Draft**：目标语义或责任边界已改变；同一目标的多轮讨论继续写原 Draft。
- **另立只读 Task**：审计结果可独立验收、需要跨多个领域核验，且会被后续工作复用；否则将核验结论记在 Draft。
- **另立实施 Task**：有可验收的阶段结果，或原 Task 的范围、独立阶段、责任边界发生变化。
- **另立 ADR**：需要裁定跨 Task 生效的架构边界；单一任务内的方案选择留在 Draft / Task 裁定记录。

## 清空与重启

删除某个 `<set-id>/` 前，先确认其 Draft / Task 已写明独立目标与裁定、没有目录外文件链接到该集，并运行 `npm run check:docs`。默认可删除 Goal Set；若用户明确要求冻结归档，则将整组文件移入 `docs/plan-work/archive/`，保留最后已知状态并在 `docs/plan-work/00-index.md` 登记，不把归档写成完成。归档 Goal Set 不升格为机制事实，也不删除已归档 Task；重新讨论相似方向时新建 set-id，按需链接旧 Draft / Task 并重新核对当前源码，不原地复活旧计划。

## 相关入口

[[AGENTS.md]] · [[docs/ai/00-index]] · [[docs/ai/galhcg-project-map]] · [[docs/plan-work/goalsets/README]] · [[docs/docs-829/05-conventions/doc-maintenance]] · [[docs/ai/PROJECT-CONSTITUTION]]
