# Goal Set：玩法 B 原子化场景重构

Set ID：gs-20261008-gameplay-b-atomic-scenes

## 最终玩家与作者体验

- 玩家最终能：在同一 Operation 工作区中理解并执行战斗、场景行动、玩家手牌和地点内连续场景；计划与结算结果一致，场景完成与路线离开清楚分开。
- 数据包作者最终能：仅通过 Datapack 声明场景身份、参与者、行为来源、目标与选择约束、费用、完成条件及后续场景；加载后使用通用 Operation UI 游玩并获得明确的内容验证错误。
- Goal Owner 默认运行合同见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]：Scene 定义内嵌 Location，线性进度由现有 EventRun / Location progress 持有；不增加 Scene Runtime owner、SaveData 顶层键或旧档迁移。后续实现仍须以源码、测试和机制文档作为事实依据。

## 阶段全图

| Goal | 独立完成结果 | 前置依赖 | 当前 Draft / Task |
| --- | --- | --- | --- |
| G01：V1 可读、可玩（completed） | Strategy Park 一轮可正常操作，资源、身份、文案与站位信息可读，旧旋转木马样例仍可玩。 | 无 | [[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]；[[docs/plan-work/archive/task-0251-pb-01-runtime-combat-stage-projection]]、[[docs/plan-work/archive/task-0252-pb-02-event-correct-operation-copy]]、[[docs/plan-work/archive/task-0253-pb-03-cost-balance-slot-projection]]、[[docs/plan-work/archive/task-0254-pb-04-readable-operation-state-names]]、[[docs/plan-work/archive/task-0255-pb-05-actor-position-and-action-eligibility]] |
| G02：操作语义统一 | 战斗、场景行动和玩家牌对选择、执行者、目标、撤销、费用预览、确认及结果的表达一致。 | G01 可独立推进；G02 集成验收仍覆盖 V1 基线。 | [[draft-0252-gameplay-b-atomic-scenes-phase-ii-operation-semantics]]；Task 0256–0262 |
| G03：原子场景骨架（completed） | 两名学生 + 一个环境参与者的 Registry 内容示例可运行、计划、预览、原子结算并完成，且不接管 Location 地图或全局状态；一个行为需学生执行，另一个 actorless。 | G02；复用已核实的 Task 0245–0248 能力。Task 0250 只作可由源码复核的导航，不是 Runtime 前置。 | [[docs/plan-work/archive/draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation]]；Task 0263–0268（已完成归档） |
| G04：真实玩法迁移（completed；PB-19～PB-24 archived） | 旧样例、Strategy Park、多场景地点、群体目标、M 选 N 与临时购买验证同一场景原语可组合。 | G03；保留具体内容规则并逐步迁移。 | [[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]]；Task 0269–0274 |
| G05：内容作者交付（completed） | 独立 Datapack Editor 可创作、验证并加载场景；按替代证据清理旧特判并保留专属地图表现。 | G04 的真实内容迁移与范围核验。 | [[draft-0255-gameplay-b-atomic-scenes-phase-v-authoring]]；Task 0275–0276 |

## 长期边界

- 明确暂缓：全盘重写玩法 B、为减少代码行数合并不同 Runtime 命令、创建包办卡牌/角色/地图/结算的万能 SceneManager、独立的庞大 Narrative 系统、可视化场景节点编辑器，以及存档迁移/历史兼容层。
- 已裁定默认：Scene 嵌入 Location，Location 内可声明有序 Scene；Offer 是只读投影，ScenePlan 是轻量值；复用 `OperationSceneDraft`、EventRun、现有原子提交路径。G01/G02 可先施工；G04 先等价迁移，复合场景是独立小型测试 Event；PB-23 / 24 采用 Goal Owner 指定的显式筛选 / 选择规则。完整细节与仅有的升级条件见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]。
- 施工约束：路线图的 26 个验收案例是需求输入，已获 Owner 裁定的默认规则是施工依据。G01 PB-01～PB-05 与 G03 PB-13～PB-18 已完成并归档；其余 Task 的 proposed 状态表示尚无实现证据，不等于需要重复申请同一语义裁定。后续实现仍按各 Task 的源码证据、有限边界、依赖、玩家验收和分级验证完成。

## 下一步

- G01～G05 与 PB-19～PB-26 均已完成并归档。PB-25 作者闭环及 PB-26 有替代证据范围内的旧分支清理结果记于 Draft 与归档 Task；未替代的专属表现仍保留。
- 升级条件仅限总裁定卷列出的四项：Runtime 原子性不足、Location / EventRun 无法表达真实案例、必须增加独立 owner / 全局状态 / 新存档体系、或简单规则不能表达实际可玩案例。普通实现选择由施工代理按最小改动处理。
