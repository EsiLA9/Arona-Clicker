# G02：战斗、场景行动与玩家手牌共享一致的操作语义

## 对最终目标的贡献

玩家在战斗、Location SceneAction 与有限 PlayerSceneCard 之间切换时，能用一致且可理解的方式浏览牌、选牌、指定执行者与目标、查看合法性和费用、撤回本地计划、确认或跳过，并在结算流中读懂结果与后续转场。

本阶段只统一玩家感知到的操作和计划投影。战斗 Beat 与场景批次继续由各自 Runtime 命令和原子结算入口处理；EventRun 仍是局内权威状态 owner。它为后续 Scene 身份与独立生命周期提供交互基线，不建立新 Scene Runtime 或万能 Manager。

## 完成定义

- [x] 战斗候选、Location SceneAction 和玩家手牌的展示、选中、不可用、固定含义清楚；推荐展示不伪装成已选。
- [x] 玩家不使用拖放也能为需要执行者的牌分配、改派和清除学生；点击与拖放落入相同的本地计划数据。
- [x] Individual 多候选目标显式单选；Global / 多目标来源显式选择；未选目标不会被解释成作用于所有候选对象。
- [x] 本地计划可替换、撤销、重选且按 runId / planVersion / Location 隔离；过期目标和过期计划由预览 / Runtime 拒绝。
- [x] UI 从 Runtime 纯预览读取合法性和费用结果，显示费用、余额及失败理由；预览不写入 Run。
- [x] 常规 Scene 流程为编辑、即时预览、单次确认；显式 skip、必要时的 Runtime stage 和战斗一键提交可区分。
- [x] Resolution、Route、Location entry Cost 以共同 timelineSequence 按可核实的 Run 顺序显示，不声称未保存的 Resolution 内部微时序。
- [x] G02/PB-06～12 完成 UI / Runtime 回归与闭环证据；定向验证 4 个文件、81 项通过，类型检查与差异检查通过。

## 依赖与边界

- 前置 Goal：G01 阶段 I 纠错作为阶段 II 集成验收前置；其人工交互基线目前需确认。此依赖不阻止本 Goal 的规划与事实核对。
- 本阶段顺序：PB-06 → PB-07 → PB-08 → PB-09 → PB-10 → PB-11 → PB-12；前序交互合同稳定后再验收后续任务。
- 本阶段明确暂缓：统一不同 Runtime 提交命令、Scene 身份/生命周期、ActionOffer 或 ScenePlan 新类型、通用群体目标/M 选 N、新地点/内容迁移、Datapack Editor、移除旧地点判断。
- Runtime 仍负责校验、费用与结算；组件消费 OperationView；Controller 通过现有 Operation Entry facade 发命令。任何状态模型或存档归属变化需另行裁定。

## 会改变方案的未知项

- PB-08 的源码事实与裁定前数量风险保留为历史：Owner 已规定 Individual 多候选目标显式单选，Global / 支持多目标来源显式多选，空数组不是全选。PB-23 `all-eligible` 后续也必须由目标定义明确声明。
- PB-11 的裁定前备选保留为历史：Owner 已批准默认单次确认；仅在确有不可逆或复杂批次时才选用既有 stage/commit。
- PB-12 原有各类历史字段缺少共同全序的事实已通过 `timelineSequence` 处理；Resolution 内仍只显示原子结算块，不推断内部效果顺序。
- G01/PB-01～05 已完成并归档；正式浏览器入口和 G03 Registry 点击流程作为当前试玩基线。

## 正式文档入口

- Draft：[[archive/draft-0252-gameplay-b-atomic-scenes-phase-ii-operation-semantics]]
- Task：[[archive/task-0256-pb-06-card-selection-states]]、[[archive/task-0257-pb-07-click-performer-assignment]]、[[archive/task-0258-pb-08-target-selection-and-count-validation]]、[[archive/task-0259-pb-09-reversible-local-action-plans]]、[[archive/task-0260-pb-10-legality-and-cost-preview]]、[[archive/task-0261-pb-11-confirm-return-and-skip]]、[[archive/task-0262-pb-12-operation-result-timeline]]

## 实施收尾（2026-10-08）

- G02 Task 0256～0262 已完成并归档；实现、测试与当前合同见 `draft-0252-gameplay-b-atomic-scenes-phase-ii-operation-semantics.md` 与 `docs/plan-work/archive/task-0262-pb-12-operation-result-timeline.md`。
- PB-11 最终采用普通场景操作单次确认；PB-08 将候选集合与已选集合分开，禁止空数组隐式全选；PB-12 使用最小 Run-wide timelineSequence，且恢复时校验 Route / Entry / Resolution 历史完整。
- G03 正式 Registry Event 由两名学生与一个环境参与者组成；人工 IAB 点击免执行者 PlayerSceneCard 后提交，确认 Scene completed、Location 仍 inProgress。
- `gameplay-b-event-runtime-integration.test.ts` 的七项失败已在 detached HEAD 复验为本轮前基线；保持断言，不通过放宽预期掩盖。
