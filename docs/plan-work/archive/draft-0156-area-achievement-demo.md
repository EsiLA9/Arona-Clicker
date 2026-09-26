# Draft：区域探索成就的首个可玩闭环

状态：done — 首期玩法语义已由 Task 0157 交付；后续范围留在 Goal Set

## 目标与最终方向

玩家只接触 Achievement：进入一个 Init 后，初始 Area 的成就引导收集；首次前往第二个 Area 后才看到那里的成就。隐藏的 Milestone 固化目标曾成立的 Save 事实，Listener 负责准入与首次完成效果。最终作者可在 Runtime Editor 用一个流程创作三层内容；本 Draft 只为第一份可玩数据包与运行时闭环定界。

## 本阶段玩法语义与边界

- 示例包自带 1 个 Init、2 个起初都可前往的 Area、少量资源与收集品。两个 Area 的首期目标互不依赖；进入 Init 时默认 Area 视为到访，第二个 Area 的成就必须等首次真正进入后才出现。
- Area 目标的载入门槛是到访事实。其他作者条件在将来可作附加门槛，不能绕过 Area 首访。当前 Init 内已引入目标保持监听；离开 Init 时撤出，返回时按持久到访与完成事实重建并立即重验。
- Achievement 是唯一玩家可见的目标：单一成就页按 Init／Area／全局分组，当前区域优先；已发现项在定义仍存在时保持可见。未完成项可显示标题、线索、作者写的奖励说明和简单数值“当前／目标”；组合目标以后显示各条件状态，不强算总百分比。
- 首个示例按一对一关系组织：一个 Achievement 观察一个隐藏 Milestone，配一个 Listener；条件与 completed ID 各只有一份。是否允许多个展示包装复用同一事实留给后续阶段。
- 第一处目标使用该 Init 的累计获得资源，资源花掉不回退累计值；第二处可使用该 Init 的收集品累计值。Area 决定引入与展示位置，不限定资源或物品必须在该 Area 获得。
- 目标引入时当前条件已满足便立即完成。`milestoneProgress.completed` 仍是 Save 级单调事实；Listener 在首次成功提交后自动尝试 `then`，范围为当前真正可执行的 Effect。完成先记账，效果失败留错误且不自动补发；定义更新后也不向旧 completed ID 补发。
- 首期手写 JSON／ZIP 数据包并通过导入体验；不实现 Runtime Editor 创作。Milestone 不向玩家展示，Achievement 不拥有自己的完成计数或领取动作。

## 本轮确定的后续方向

- Area、Init、全局三类归属；额外引入条件与归属门槛同时满足。后继 Achievement 在自己身上列出前置项，多个前置全部完成才有资格；不再维护旧草案的反向 `next` 列表。
- 作者最终在 Runtime Editor 的一个流程里填写归属、引入条件、完成条件、Effect 和展示文案；编辑器内部维护隐藏 Milestone、Listener 与可见 Achievement 的关系。
- Roadmap 另行讨论。星野天台的“剧情完成后等待下一次进入 Area”已有 `StoryEntry.followUps` 与 `StoryFollowUpMount` 实现，属于独立的剧情等待语义，不进入本 Task 的 Milestone 模型；若将来要扩展成通用玩法，再单独立项。

## 当前事实与待核对问题

| 问题 | 已核实依据 | 对方案／验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| Milestone 当前承载什么 | `src/data-services/contracts/datapack.ts` 的 `MilestoneDef` 只有 `id/condition`；`src/arona-clicker/types/state.ts` 的 `milestoneProgress.completed` 属于 Save | 首期需增加 Listener 与 Achievement 声明；不复制完成事实 | 已核实 |
| 当前响应式条件能否处理累计值 | `src/arona-clicker/services/milestone-domain.ts` 仅接 `resource/spotLevel/story/alwaysTrue`，`stat` 被排除；`src/engine/expression/condition-system.ts` 可读 `stat` | 对示例使用的累计资源／收集品统计补精确唤醒与完整条件重验 | 已核实 |
| 统计是否已有所需数值 | `src/engine/expression/stat-dsl.ts` 已有 `$InitProducedAmount`、`$InitCollectedAmount`；`src/engine/stats/stats.ts` 按 Init 累计 | 复用 Init 统计，不新增 Area 统计桶 | 已核实 |
| 首访信号在哪里 | `src/arona-clicker/services/init-service.ts` 有局部 `isFirstEnter` 与持久 `visitedInits/visitedAreas`；`src/engine/types/events.ts` 的进入事件不带 `firstEntered` 字段，且 `initEntered` 早于默认 Area 写入到访集合 | 默认 Area 应在 Init 进入流程状态就绪后对账；跨 Area 进入可在到访写入后的入口重算，不假设事件有 firstEntered 字段 | 已核实 |
| 效果与展示的现状 | `src/arona-clicker/services/milestone-adapter.ts` 已管理基础 watch、完整重验、完成提交与撤出，但不执行 Listener Effect；`src/ui/components/service-workspace.ts` 的 records 页面尚无成就列表 | Listener 的效果接线与只读成就页均为新增能力 | 已核实 |
| 示例包怎样独立导入 | `src/data-services/datapack/fragment-parser.ts` 和 `zip-loader.ts` 接收 Milestone 列表；现有 `datapack/addition_test/` 可作打包格式参照 | 新示范包需覆盖导入、注册、读档与 UI 路径 | 已核实；精确分片方案施工时定 |
| 星野天台等待机制是否仍待构建 | `src/data-services/contracts/story-entry.ts` 声明 `followUps`；`src/arona-clicker/services/story-follow-up-mount.ts` 接线；`src/arona-clicker/content/story-conversation-walls.ts` 已使用 | 已有专用实现，本 Draft 不再把它计作待构建的成就能力 | 已核实 |

## 裁定记录

| 议题 | 本轮用户裁定 | 对实施的影响 |
| --- | --- | --- |
| 玩家所见 | Milestone 隐藏，Achievement 展示目标与线索；Roadmap 首期不做 | UI 只读取 Achievement 投影 |
| Area 载入 | 需首次进入；已引入目标在当前 Init 内保持监听，离开撤出 | 用到访事实恢复，不一次性挂载所有区域 |
| 条件与效果 | 累计和持有两种资源条件最终都提供；任意已可执行 Effect 可用，预留／声明类保持原义 | G01 先验证累计统计与一个简单奖励，G02 补完整作者范围 |
| 失败与更新 | 先记 completed，效果失败不自动补发；旧完成记录不因新效果补发 | 明确错误记录与一次性门槛，不引入效果领取账本 |
| 前置关系 | 后继成就填写多个前置，全部满足；不维护 `next` | G01 两目标独立，G02 再实现前置门 |
| 首期交付 | 手写自包含 JSON／ZIP 示范包，暂不做 Runtime Editor | 第一 Task 以玩家可玩闭环为验收 |

## Draft → Task 准入

- [x] 玩法语义与明确非目标已裁定。
- [x] 会改变首期方案的状态、统计、首访、效果与展示入口已核对。
- [x] 两 Area 独立演示有独立完成定义；完整作者能力留在后续 Goal。
- [x] 施工 Read Set 与导入、运行时、UI、读档验收入口可定位；正式 Patch Unit 在开工前逐个冻结。
- [x] 首期之后仍缺 Init／全局与前置组合、完整条件能力及 Runtime Editor 单流程创作。

## 下一步

[[task-0157-area-achievement-demo-v1]] 已完成：数据包、运行时与玩家可见页均已交付。本 Draft 的「当前事实与待核对问题」保留为立项时基线，当前实况见 [[docs/docs-828/04-mechanisms/trigger-effect]]。

## 相关路由

[[docs/docs-828/04-mechanisms/trigger-effect]] · [[docs/docs-828/02-modules/effect-trigger]] · [[docs/docs-828/01-architecture/state-layers]] · [[draft-0152-milestone-listener-and-achievement-packaging]] · [[task-0151-milestone-persistent-arrival-facts-p0]] · [[task-0153-milestone-listener-admission-and-reactive-coverage-audit]]
