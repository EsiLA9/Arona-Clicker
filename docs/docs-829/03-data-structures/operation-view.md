# OperationView — Gameplay B 只读投影

> 本文说明 Gameplay B EventRun 面向 UI 的独立只读快照；精确字段以 `src/arona-clicker/contracts/operation-view.ts` 为准。

## 归属与边界

- `EventRun` 是当前 Gameplay B 战斗的真实局内状态，由 Runtime 私有的 `OperationRuntimeService` 持有；它不是 `PlayerState` 的字段。`OperationView` 是从 Run 计算出的 detached 只读 UI 投影，不是状态 owner，也不会写进存档。
- 产品 `SaveData` 可另带可选的 `operationRun` 检查点；`save()` 通过 Operation Entry 生成它，`load()` 再单独恢复。这个保存片段不改变 EventRun 与 PlayerState 的分开归属；当前 View 也不是保存格式。
- `GameReadModel.operationEntry` 只暴露 `OperationViewQuery.getView(expectedRunId?)`；启动、修订、取消和 Commit 由 Controller action 调用 Runtime 上的窄 Operation Entry facade。两者是分离的读写边界。
- Runtime owner 保持私有。UI 不读取 EventRun、冻结规则、resolver、ActionDef 或 mutable GameInstance 内容。
- `expectedRunId` 与当前 Run 不一致、Run 不可用或缺少 UI 所需战术内容时返回 `null`，防止过期 route 显示另一个 Run。

## 投影内容

投影包括当前 Event 的标题与简短介绍、当前 Location 的 `currentStage`（来自作者声明的 `stage: combat | scene`）、版本与 Beat、轨道/事实/持有物、事件与地点目标进度、Actor 与 Team、基础计划和干预后计划、合法战术 Action / Target 候选及阻塞理由、协同预览、Commit 状态、Resolution 历史和序号，以及 Run-wide `timelineSequence`。Resolution、转场与地点入场 Cost 记录各自携带相同时间轴中的 `timelineSequence`，让只读 UI 能校验并交织呈现。`currentStage` 是 UI 判定战斗表面的唯一来源；PreparedBeat 可在非战斗地点存在，UI 不根据其是否为空分类。`OperationViewActor` 带 detached `displayName`、`avatarRef`、`hp`、`maxHp`、`participantKind` 和当前 `positionId`，左/右身份卡不需要 UI 反查可变角色或 Runtime 数据。玩家场景投影提供当前共享 PlayerCost、离场 `maxCarryCost`、Location `actionMode`、SceneAction 的作者文案、费用、`performerPolicy` / `selectionPolicy`、目标 `targetSelectionMode`、合格执行学生与按执行者区分的当前合法目标，以及可就地激活时按绝对 Actor ID/type 过滤的 `legalActorlessTargetActorIds`；同时投影批次已用/剩余、待提交批次草稿、实际选择费用预览、drawPile/discard 数量、可用 hand 实例的作者文案和选择策略，以及每次地点入场的 Cost 记录。Action、SceneAction 与 PlayerSceneCard 的当前及历史显示文案均来自内容投影；候选只含 UI-safe 数据，不暴露 Action 定义，也不依赖 Location SceneAction 的当前模式筛选。RouteView 包含每个 Location 的访问计数/上限/当前位置/已访问/完成状态，以及全图 RouteEdge 的来源、目标、标签、凭证要求和是否消费。仅当前 Location 的出口投影可用或锁定原因；其他地点的边为未评估状态，不代表可立即转场。它还提供当前出口列表、转场历史、总访问数与事件访问上限；不包含可写规则或完整 Run。角色技能结果只保留是否成功；tactical RNG cursor、roll 测量、原始规则对象和完整 Run 不出现在 UI DTO。终局还投影奖励是否已领取。
对于有 Scene Batch 的 Scene（声明 `actionMode` 或启用 `autoCharacterActions`），`sceneActionBatchesUsed` 保留已提交次数；`sceneActionBatchesRemaining: null` 表示作者未设批次上限，有限上限则投影非负剩余数。基础 `basePreparedBeat` 与含当前 Intervention 的 `effectivePreparedBeat` 分开提供，UI 可据此显示自动 Action / Target 和玩家修订状态；View 只读投影不会把默认计划本身写成干预。

当前 Scene 子投影还提供可选的 `autoCharacterActions` 与作者声明的完成谓词。启用自动角色计划时，学生的 `profile.actionOptions` 来自本轮 Character Hand，`basePreparedBeat` / `effectivePreparedBeat` 包含默认或被单槽 Intervention 修订的 Character 行动；没有自动行动开关的普通 Decision、Shop 与 SceneAction Scene 不因此生成 Character 计划。UI 可以直接显示 Action、默认 Target、Wait、Scene 批次进度和完成条件，不通过 Combat 阶段推断。

Scene 子投影包含当前 `currentSceneId` / `currentScene`、当前 Location 的有序 `scenes` 状态和当前 Scene 下的 `actionOffers`。`ready`、`active`、`completed` 均由 Scene 内容顺序与 `EventRun.locationProgress.completedSceneIds` 推导；Location 已完成时，隐式 singleton `main` 也显示为 `completed`，当前 Scene 为空。未声明 `Location.scenes` 的内容使用虚拟 `main` Scene。Offer 为 UI-safe 的只读候选，携带来源（student Action、SceneAction 或 player SceneCard）、稳定 offer ID、Scene ID、Action ID 与对应源身份；它不是可提交计划，也不授予调用者自行指定效果的权限。

当前 `sceneActionChoice` 会投影为 `currentSceneActionChoice`，只描述 Global SceneAction 候选 ID 与 exact-N 数量；固定行动不在候选计数中。Purchase Offer 则经 `currentScenePurchaseOffers` 投影价格、是否已记录 Run-local purchase Fact、当前是否可负担、阻塞原因及人类可读奖励说明。View 不把奖励的 Event-local Item / Fact / Track ID 拼成显示文案；有 Action 描述时使用描述，没有时退回 Action 标题。Purchase marker 与 HeldItem 是两类独立 Run 状态，因此即使奖励物已被移除，Purchase Offer 仍显示已购买并不可再次选择。

写命令重算候选时，projector 复用冻结规则上的纯干预预览与 Combination resolver；读取 View 不调用内容 resolver、不写 EventRun、不推进随机游标。返回结构深度脱离 owner 当前状态。

## AC UI 消费路径

Operation route 持有 `runId`，由 Workspace Renderer 在进入或重建 route 时查询投影。已挂载 Workspace 中的战斗行动/目标/取消、SceneAction 与玩家卡批次暂存/结算、路线转场和奖励领取由 Controller 经 `operationEntry` 执行；每次命令最多读取一次新投影，再请求一个 `workspace.operation` region 更新。route 进出属于 workspace structure 更新。

学生卡同时是统一的角色持牌锚点（`data-operation-actor-hand`）。UI adapter `projectOperationActorHand()` 将战斗候选、已分配的场景行动和 SceneDraft 中的玩家实体牌规整为 `OperationActorHandCardView`（身份、牌种/来源、owner、锁定/选中状态、执行者候选、合法目标和费用）；组件再按来源绘制牌面。战斗 CharacterHand 行动牌由只读 Action options 与当前计划在角色锚点附近呈现；非战斗 SceneAction 和已分配执行者的 PlayerSceneCard 则从当前 View 加上 UI 内存中的可撤销 SceneDraft 投影到该角色牌槽。未分配或就地激活的 SceneAction / PlayerSceneCard 留在公共场景区/手牌区。`performerPolicy` 可指定必须学生、禁止学生（就地激活）或 `optional-student`（就地激活/学生执行二选一）；Actorless Actor Target 由绝对 ID/type filters 限定。Scene 批次的 `required` 项是玩家可选项，不再要求每名学生/全局必须选满；每名学生至多选一项、Global 至多选一项，零选等价跳过当前批次。fixed 牌仍自动加入且不可取消。PlayerCost 按固定项与实际加入项汇总，只要不超过余额即可提交，余额剩余保留。`select` 显示可手动选择的当前目标集合，目标 ID 保存在草稿并由 Runtime 再验证；`all-eligible` 显示自动作用于当前全部合法目标的说明和 View 候选，不开放单体目标拖放，也不从空数组猜目标模式。目标死亡或换位会改变 View 候选；过期手选由 Runtime 整批拒绝。卡牌关系线按出牌与目标的几何方位连接左右/上下边，卡片重叠时连接到目标最靠近卡牌的一侧；hover/focus 与拖放共享算法，只更新现有 SVG path。

实现与回归测试：`src/arona-clicker/contracts/operation-view.ts`、`src/arona-clicker/services/operation-view-projector.ts`、`src/ui/workspace/workspace-renderer.ts`、`src/ui/components/operation-workspace.ts`、`tests/engine/gameplay-b-event-runtime-integration.test.ts`、`tests/ui/operation-workspace-view.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`、`tests/ui/gameplay-b-card-inspector.test.ts`。

相关机制：[[operation-runtime]]；UI 路由：[[docs/docs-829/06-wiki/50-ui/workspace-routing]]。
