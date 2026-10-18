# Draft：玩法 B 原子场景重构 — 全部 Task 裁定点总览

状态：draft — 已纳入 Goal Owner 于 2026-10-08 提供的统一裁定，作为 PB-01～PB-26 施工依据。当前进度：G01～G05、PB-01～PB-26 均已完成并归档；Owner 裁定条文未改。

## 当前施工进度（2026-10-08）

- **已完成并归档：** G01 / PB-01～05、G02 / PB-06～12、G03 / PB-13～18、G04 / PB-19～24。PB-24 的独立双 Scene 样例通过 Engine / UI / 浏览器验收；Task、测试证据和机制文档入口见 [[docs/plan-work/00-index]] 及对应 GoalSet。
- **接续施工：** PB-25 消费冻结的六张 Operation 表及 Scene 合同，完成独立 Editor 编辑、包导出 / 导入、Runtime reload / apply 与通用 Operation 入口游玩闭环。
- **G05 状态：** PB-25 作者链路和 PB-26 有替代证据范围内的旧分支清理均已完成。验收报告、保留的 Carousel 内容表现映射及 Strategy Park 地图边界见 [[draft-0255-gameplay-b-atomic-scenes-phase-v-authoring]] 与归档 Task。
- 本 Draft 下方“已核实的当前事实”段落记录的是裁定形成时（2026-10-08）的施工前基线。完成任务后的现行实现以源码、测试、`docs/docs-829/` 和已归档 Task 的收尾证据为准；不要把基线描述复述为当前缺失能力。

## 用途与权威边界

本文帮助 Goal Owner 和新加入的 Chat 一次掌握 Roadmap 来源、现有机制事实、26 个 Task 的背景与默认施工边界。源码、测试和 `docs/docs-829/` 是当前实现事实；各阶段 Draft 保存阶段事实与设计记录；各 Task 保存施工边界与验收。

### 权威顺序与施工状态

- 用户提供的《Gameplay B 原子场景重构：Goal Owner 统一裁定》明确批准“渐进式职责收敛”，并授权这些默认规则作为 Draft / Task 的施工依据。本文件已将其整理为当前总裁定。
- 本文件中的 **Goal Owner 裁定** 覆盖早期阶段 Draft / Task 中相同主题的“待人类裁定”“待确认”措辞；那些内容说明裁定前的事实、备选项和风险，不能再解读为本轮仍需重复询问。
- Task 状态随施工更新；`proposed` 只表示该 Task 尚无实施证据，不撤销 Owner 对默认合同的批准，也不意味着必须重新申请同一裁定。PB-24 已完成并归档；后续状态以 Task 收尾记录为准。
- 当前允许按默认合同继续阶段规划 / 施工；只在 Owner 裁定最后列出的四种升级条件成立时暂停并报告。普通字段命名、局部 helper、现有 API 适配由施工代理按最小变更原则处理。
- 当前实现事实仍以源码、测试和 `docs/docs-829/` 为准。Owner 裁定决定目标合同，不把不存在的 Scene 字段说成现有事实。

状态标记：

- **待裁定**：Task 明确要求人类先决定架构、语义或范围。
- **待确认**：Task 已提出可施工的建议合同，但尚未视为项目决定。
- **已裁定默认**：Goal Owner 已批准默认语义；实现时按此推进，不再因同一问题请求重复选择。
- **条件升级**：按现有合同可先做；若需要新增字段、状态或跨域规则，再暂停并另行裁定。
- **无独立裁定**：Task 已把边界写成可执行要求；施工前按源码和测试复核，不额外制造产品选择。
- **上游门槛**：依赖前序 Task 的决定或完成证据，不能自行绕过。

## Goal Owner 统一裁定（2026-10-08）

**总原则：渐进式职责收敛，不重新设计 Operation Engine。** 施工优先复用现有模型、服务、命令和状态；只有现有概念无法明确表达一个可验收需求时，才新增最小字段 / 方法。职责边界为 Action 定义效果、Runtime 判断合法性并结算、Location 管空间、Scene 组织 Location 内的局部玩法、UI 展示只读结果。统一玩家操作体验不要求战斗与 SceneAction 使用相同提交命令。不要为未来可能用、当前没有真实样例验收的复杂机制预建系统；若既有能力已满足 Task，允许按证据收窄或关闭，不为凑满 26 个编号制造代码。

以下默认规则已获 Owner 批准，施工时直接应用；“建议”只用于明确写出的样例位置建议，不能改写为全局强制架构。

### G01：基础修复（PB-01～05）

- **PB-01：** 先从现有战斗配置中找唯一、可靠的战斗判据。不能用 `PreparedBeat` 是否存在判定战斗，也不能用 Location ID 特判。若现有字段仍无法无歧义地区分，允许新增一个最小内容类型字段，并由 Runtime 投影给 UI。
- **PB-02：** 复用 Event / Location 已有表现字段；缺少的文案只补局部字段，不新建 Narration 系统。
- **PB-03：** Cost 槽表达当前 PlayerCost 余额，不表达容量；高余额可用数字或紧凑视图，不要求画几十个槽。`maxCarryCost` 只负责离场限制。
- **PB-04：** 优先复用已有名称来源；缺少的 Track / Fact / Item 标签允许放入 Event-local presentation map，不建全局实体字典。
- **PB-05：** 只补位置、当前计划、可替换状态和不可用原因，不改战斗规则。
- G01 不等待 G03 的 Scene 架构裁定。

### G02：操作一致性（PB-06～12）

- **PB-06：** 浏览、焦点、选中、锁定、不可用是不同状态；保留 `required / fixed` 原意。
- **PB-07：** 添加点击式 Performer 分配；与拖放共用同一 UI 草稿操作和 Runtime 资格来源。
- **PB-08：** Individual 多候选目标显式单选；Global 与支持多目标的场景牌可显式多选。候选集不是已选集合，空数组不表示全体。
- **PB-09：** 继续使用 UI 本地草稿；修复撤销、换人、换目标与 stale 清理，不造草稿管理服务。
- **PB-10：** 费用和合法性从 Runtime Preview 获取，UI 不另算价格 / 资格。
- **PB-11：默认单次确认。** 常规流程是编辑和即时预览后单次确认结算；不强制两次确认。只有确有不可逆后果或复杂批次需要复核时，才使用现有 stage / commit。
- **PB-12：** 优先用现有历史记录生成可证明的顺序；不能证明的跨地点顺序不得猜排。只有实际验收需要且现有数据不够时，才补最小顺序字段。
- 操作语义一致不要求每个 Scene 都有单独确认页面。

### G03：Scene 的最小合同（PB-13～18）

- **PB-13 身份 / 状态：** Scene Definition 默认内嵌 `OperationLocationDef`；一个 Location 可声明有序 Scene 集合，未声明时按单个隐式 Scene 呈现。`sceneId` 在 Location 内稳定唯一，完整身份由 Event / Location / Scene 组合确定。V1 不建可任意复制 / 独立运行的 Scene Instance 系统；如需运行标识，优先使用 `runId + locationId + sceneId` 推导。Run 内进度持续保留，离开后回来不重置完成项、不重发一次性奖励。唯一状态 Owner 继续是 `OperationRuntimeService` 持有的 EventRun；持久进度并入现有 Location progress / EventRun checkpoint，不加 SaveData 顶层键。`ready / active / completed` 为可由进度投影的表现状态，不额外存三份状态。只支持线性 Scene 顺序；不做分支图、无限循环、独立存档或旧档迁移；不兼容 checkpoint 仍由 `resumeVersion` 拒绝。
- **PB-14 表现：** Scene 定义可直接带标题和简短描述；Actor / Action 继续用现有名字来源；Fact / Item / Track 用 PB-04 的 Event-local 名称映射。遵循现有本地化约定，但不建 Presentation Registry 或新国际化框架。
- **PB-15 Offer：** Offer 是只读候选行为投影，不是新的 ActionDef。只表达既有来源、具体候选 / 卡实例、执行者 / 目标规则、可选 / 固定 / 不可用、费用和失败原因。同一 ActionDef 从不同来源出现时保持不同 Offer 身份，以保留来源费用、牌区和提交行为。Offer 不持资源、不执行效果。
- **PB-16 Plan / Preview：** 继续复用 `OperationSceneDraft`。ScenePlan 可是由草稿生成、供 Runtime Preview / Commit 使用的轻量值对象，不是持久状态实体。Runtime staged batch 只在确需待确认时使用，且与 UI 草稿分开。一个 Plan 不必同时组合战斗 Beat 与 SceneAction Batch；每次提交遵守各自现有合法事务边界。Preview 纯计算，不推进随机游标、不扣费、不写状态。
- **PB-17 原子结算：** 保留 `commitBeat` 与 SceneAction batch 两条既有提交路径；每次提交内费用、行动效果、牌区变化和相关 Scene 进度一致结算，不留部分成功；重复 / 过期请求不得重复产生效果；Scene 完成由 Runtime 根据结算后状态判定。UI 不直接写状态、不提供未经验证的 Delta。不建万能 Action 提交命令。
- **PB-18 完成 / 离开：** Scene 只表达是否完成，不建复杂 Result 类型树。Scene 完成不等于 Location 完成或 Route 转场。Location / Event 继续负责访问、完成、路线、目标、结局、进入 / 离开。同 Location 多 Scene 按有序列表推进下一项，Scene 推进不改地图位置；权威进度只保存在 Runtime 状态中。

### G04：现有内容迁移与组合（PB-19～24）

- **PB-19：** 只迁移正式 Carousel；独立 `carousel-route-slice` 保留作测试样例，不强制并入。
- **PB-20：** 三个战斗 Location 各有独立 Scene 身份，不抽共享 Scene Definition；保留 3 / 3 / 4 Beat。
- **PB-21：** 第一轮按一个非战斗 Location 对应一个 Scene 等价迁移，不改 fixed 行动、费用、Effect 顺序或 Route。若旧 Task 能以测试证明已等价替换，允许直接关闭。
- **PB-22：** 复合样例建议放进**独立小型测试 Event**，而不是修改 Strategy Park 的 13 地点主线，更不能覆盖现有 Boss。先用 Scene A“调查设备”→ Scene B“处理警报”；A 完成后在同一 Location 开 B，不作 Route 转场。顺序由 Location 内有序定义，Runtime 保存进度。失败不推进；跳过沿用既有 skip；回访保留 Run 内进度。不做任意分支、递归和循环。
- **PB-22 启动路径核验：** 当前 `center-panel.ts` 的 Operation feed 静态列 Carousel 与 Strategy Park 两个 Event。独立测试 Event 需要可实际启动，不能悄悄添加新的硬编码 Event-ID 卡片；施工时应核对是否能复用 / 提前提供通用 Event 列表，或通过受限测试入口达到实际可玩验收。若在既定范围内无法给出可点击入口，再按升级条件报告。
- **PB-23：** Position 是目标合法性的一部分，优先扩展现有 `OperationActionTargetDef` 与目标选择服务，不在 Offer / UI 另算。支持 `select`（从合法候选中显式选）与 `all-eligible`（Action 明确声明后由 Runtime 解析当前全体合法目标）；禁止用空数组暗示全体。Relation / Type / ID / Position 过滤取交集，不建覆盖优先级系统。目标死亡、换位、状态过期时重验，不静默换目标；空组不可执行。
- **PB-24 M 选 N：** 第一版在同一 SceneAction 选择批次的 M 个候选 Offer 中恰好选 N 个；每项只能选一次；fixed 自动纳入但不计 N；少于 N 不可提交并说明；跳过仍走现有规则，不自动算成功。首版不要求混合战斗牌、物理玩家牌和购买来源。
- **PB-24 临时购买：** 视为有 PlayerCost 和奖励 Effect 的有限购买 Offer，不建立 ShopService / 货币 / 库存子系统。使用现有 PlayerCost；每项默认每 Run 购买一次；优先用现有 Fact / Condition 标记购买状态并防重；奖励用现有 Effect（Item / Fact / Track 等）；费用与效果沿既有原子批次。只有真实案例需要库存大于一或补货时另行扩展。

### G05：作者链路和清理（PB-25～26）

- **PB-25：** 消费已经冻结的 Scene 合同，不建第二套模型。Scene 默认嵌在 Location，因此优先扩展现有 Operation Location 编辑能力，不新建顶层 Scene 表。Editor 必须无损处理全部六张 Operation 表；最小闭环是“编辑 → 保存 → 验证 → 导出 PackParser 可读 Datapack → 重新导入 → 从 Operation 入口启动并游玩”。不要求节点画布，结构化编辑加必要 JSON 编辑即可。
- **PB-26：** 逐项删除真正已被通用 View / 内容替代的 Carousel 特判；先补齐替代来源再删除。不因统一 Scene 删除 Strategy Park 专属地图或正常 Event 差异，不建兼容服务。

### 施工顺序和升级条件

- G01 / G02 可依据上述默认规则施工，不等待 G03 架构决定。
- G03 从 PB-13 按最小合同逐项落地；每个 Task 至少提供一个可观察的 UI / 玩法行为。
- G04 先等价迁移，再逐项验证多 Scene、群体目标、M/N 和购买，均由真实可玩内容验收。
- G05 最后完成作者链路与旧分支清理。
- **仅以下情形升级给 Goal Owner：** (1) 现有 Runtime 无法保证单次提交原子性，必须引入跨系统事务；(2) 真实案例确实无法用 Location 内嵌 Scene 与现有 EventRun 状态表达；(3) 必须引入独立 Runtime Owner、全局状态根或新存档体系；(4) 范围内出现简单规则无法表达的真实可玩案例。其他字段名、对象组织、局部 helper 与现有 API 适配由施工代理按最小改动完成并测试。

最终验收看旧玩法是否保真、新 Scene 是否能组织 Location 内局部行为、复杂选择是否复用现有 Runtime、作者是否能不加 UI ID 特判创作可玩内容；不以新增抽象数量衡量。

## 给新 Chat 的一次性简报

### 需求来源与讨论边界

本计划来自用户提供的 Sol 完整 Roadmap，内容包含 26 个可独立验收的 PB Task。Roadmap 的核心方向是把 Gameplay B 的“地点流程”和“局部玩法场景”拆成可组合的概念：Location 负责空间、路线、进入 / 离开与地点进度；未来的 Scene 负责一段局部玩法的身份、参与者、操作、选择、结果和完成。作者希望通过 Datapack 声明内容，玩家从通用 Operation 工作区进入并操作，而不是依赖 Carousel 地点 ID 特判。

这是目标模型的提案，**不是当前 ACProgram 已有的 Scene API，也不是已授权一次性重写的规格**。Sol Roadmap 中的 SceneDef、SceneRuntime、ScenePlan、SceneResolution、M/N 与 Shop 字样都必须先经本项目源码、测试和机制文档核对；人类决定哪些语义采纳后，才回写阶段 Draft / Task。当前实现事实以源码、测试和 `docs/docs-829/` 为准。

所附文本中的插图资源没有完整保留：可读内容中只见 favicon / “GitHub +1/+2” 一类链接碎片，没有 SVG 源码或图像载荷。本文件不会从这些碎片推断未写出的玩法规则、布局或资产要求。

### 最终体验与阶段关系

- 玩家可从夏莱办公室的 Operation 入口启动 Carousel、Strategy Park 和之后的可选样例，在同一工作区读懂战斗、场景行动、玩家场景牌和地点内连续 Scene。
- 对每次操作，玩家能分辨正在浏览什么、实际选了什么、谁会行动、目标是谁、费用是否足够、如何撤回，以及确认后运行时真实结算了什么。
- 一段 Scene 完成不等于玩家离开 Location，也不等于 Route 自动开放；路线与空间继续由 Location / Event 规则决定。
- Datapack 作者最终可声明 Scene 身份、表现信息、参与者、行动来源、目标 / 选择约束、费用、完成条件与后续 Scene，并通过独立 Datapack Editor 完成真实编辑、校验、导出 / 导入和可玩验收。
- G01（PB-01～05）修 V1 可读性与阶段识别；G02（PB-06～12）统一玩家操作语义；G03（PB-13～18）定义最小 Scene 身份、计划、预览、结算和完成边界；G04（PB-19～24）迁移真实样例并验证复合地点、目标与 M/N / 购买；G05（PB-25～26）闭合作者流程并在上游替代证据充分后清理旧特判。

PB-01～PB-05 已实施并归档；其余尚未开工的 Task 保持 `proposed`，Goal Owner 已批准的默认合同可直接作为施工依据。Roadmap / Agent 的建议只有在上方 Owner 裁定明确采纳时才成为决定。下文旧的“待确认 / 待裁定”表述记录的是 Owner 提供规则前的分析状态；与上方裁定冲突时以上方为准。除列出的四个升级条件外，不再为同一问题重复请求人类选型。

### 核心术语和责任边界

| 名词 | 本文件中的含义 | 当前状态 |
| --- | --- | --- |
| Event / Operation | 一次可启动的玩法流程；Event 声明 Locations、参与者 / 规则和结局，Operation Runtime 持有该次运行状态。 | 已存在。 |
| EventRun / Run | 当前 Event 的一次运行快照，含 Location progress、资源、路线及 Resolution 等；运行时服务持有唯一可变状态并投影只读快照。 | 已存在，并可按现有 resumeVersion checkpoint 保存 / 恢复。 |
| Location | 地点与空间流程单位，持有路线、访问进度、地点目标 / 结局和旧 SceneAction 配置。 | 已存在。 |
| Scene（新概念） | Location 内的一段局部玩法组织单位。它不代替 EventRun、Location 或 Route。 | 当前没有独立 SceneDef / sceneId / Scene 生命周期合同；Owner 默认规定内嵌 Location、线性顺序和 EventRun 状态 owner。 |
| Scene Definition / Instance | Definition 是内容中的稳定玩法定义；Instance 是某次 Run / Location visit 中的一次运行身份。究竟是否二分以及何时生成尚未决定。 | 提案术语，非当前字段。 |
| SceneAction | Location 目前可提供的一种行动来源 / 批次合同，配置 Action、scope、费用或文案。 | 已存在，但不代表一段 Scene 或 SceneRuntime。 |
| `interactionSceneId` | Location 给候选牌 / 行动条件使用的旧上下文标签。 | 已存在；不是未来 `sceneId` 或 `sceneInstanceId`。 |
| ActionDef / PlayerSceneCard | ActionDef 定义行动效果；PlayerSceneCard 是有限玩家场景牌的实例 / 选择来源。 | 已存在；不同来源有不同费用、目标与提交边界。 |
| Offer（PB-15 提案） | 将学生行动、SceneAction 与玩家场景牌投影成 UI 可读的行动候选。 | 当前无通用 Offer 合同；不能替代 ActionDef 或直接写状态。 |
| SceneDraft / ScenePlan（PB-09 / PB-16） | SceneDraft 是当前 UI 交互草稿；ScenePlan 是从草稿构造、供 Runtime Preview / Commit 使用的轻量值对象。 | UI 已有 `OperationSceneDraft`；Owner 决定继续复用，不建立持久计划实体；Runtime staged batch 与 UI 草稿分开。 |
| Preview / stage / commit | Preview 只算并给理由；stage 把待提交批次留在 Run；commit 才应用效果、费用和历史。 | 场景 Runtime 已有批次入口；普通 UI 当前主路径仍可能直接 commit。 |
| Resolution | Runtime 对一次已接受结算记录的原子结果；不是 UI 自行推算的效果顺序。 | 已存在，含战斗 Beat / SceneBatch 结果；粒度不表示每条 Effect 的微观时序。 |
| `required` / `fixed` | `required` 是玩家可选项；`fixed` 自动纳入并不能取消。 | 已存在；不可被解释为 M/N 计数规则。 |
| Individual / Global | 目标选择模式。Individual 的目标数量与 Global 显式目标数组受当前 Planner 限制。 | 已存在；Global 可列多个明确 Actor，不表示已有按站位筛出来的群体目标。 |
| PlayerCost / Actor / Team cost | EventRun 共享玩家费用与由行动执行者 / 队伍承担的行动成本。 | 已存在；费用归属不同，Preview / Commit 应由 Runtime 计算。 |
| Datapack Editor / Runtime UI | 前者是独立的 `tools/datapack-editor/` 作者工具；后者是玩家游玩的 Operation 界面。 | 是两个不同产品入口，不能以 Runtime UI 或生成 Schema 存在证明 Editor 能创作。 |

### 当前运行机制的简图

```text
Datapack / 已注册内容
        ↓ Registry 解析、引用验证
Event → Location / Route → Operation Runtime 创建并持有 EventRun
                                  ├─ 战斗 Beat：preview / intervention / commitBeat
                                  ├─ Location SceneAction：preview / stage / commit batch
                                  └─ Route：gate / cost / transition / entry gain
        ↓ detached OperationView
UI 读取 View、维护短期交互草稿，经 Controller / Operation Entry 发命令
```

未来 Scene 按 Owner 默认合同内嵌在 Location，运行进度由 OperationRuntimeService 的 EventRun 持有，并复用现有 Preview / Commit / Resolution；不能复制一份权威状态到 UI，不能把战斗、SceneAction、路线和 Scene completion 合成一个万能命令。只有遇到上方升级条件时才暂停重审。

## 当前实现事实：新 Chat 开工前要带上的基线

下表是规划时核对过的事实摘要。它用于理解为什么要裁定，不替代 Task 正文里的完整路径级 Read Set；如后续代码已经变化，应重新核查，不得直接把 2026-10-08 快照当永久事实。

| 领域 | 已核实的当前事实 | 主要证据入口 | 对施工的影响（按上方 Owner 裁定解读） |
| --- | --- | --- | --- |
| 战斗阶段识别 | `OperationView` 有 `currentLocationId`、`currentActionMode`、`basePreparedBeat`、`effectivePreparedBeat`，没有明确的 `isBattle` / `stage` 字段。UI 的 3 处条件使用 Carousel `platform` Location ID。`refreshPreparedBeat()` 会为所有未终局、未完成且含战术内容的 Location 准备 Beat，PreparedBeat 存在本身不能区分战斗。 | `src/ui/components/operation-workspace.ts`：`projectOperationActorHand`、`renderMain`、`renderOperationWorkspace`；`src/arona-clicker/contracts/operation-view.ts`；`src/arona-clicker/services/operation-runtime-service.ts`：`refreshPreparedBeat`。 | PB-01 必须找到内容 / Runtime 级共用判据；不能只挪动一个旧 ID 检查或把 PreparedBeat 错称为阶段信号。 |
| Strategy Park 战斗事实 | Strategy Park 有 13 个 Location，其中 `bumper`、`fireworks`、`boss` 是三处战斗，Beat 为 3 / 3 / 4。普通非战斗地点也有行动和成本。内容文件开头旧注释误写 12，数组和虚拟游玩测试是 13。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`gameplay-b-strategy-park-ids.ts`；`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts`。 | PB-20 / 21 要覆盖三个战斗和其余十地点；不可按旧注释漏掉地点或改变战斗内容。 |
| 地点与场景行动 | `OperationLocationDef` 承载 Location、旧 `interactionSceneId`、`actionMode`、`sceneActions` 等；`OperationLocationProgress` 跟踪 Location 完成、Beat 与行动批次数。当前没有 Scene Definition、Scene Instance、Scene 状态或同地点 Scene 序列合同。 | `src/data-services/contracts/operation.ts`；`src/arona-clicker/contracts/operation.ts`；`operation-runtime-service.ts`。 | 按 Owner 决定把 Scene 顺序内嵌 Location、以 Scene-local ID 标识、以现有 EventRun / Location progress 保存线性进度；不能把多个 SceneAction 当作多个 Scene。 |
| 状态 owner 与 UI | `OperationRuntimeService` 经 GameInstance 持有 RunSlot；View 是 detached 只读投影，UI 通过 Controller / Operation Entry 发命令。 | `src/arona-clicker/runtime-game-instance.ts`；`src/arona-clicker/services/operation-runtime-service.ts`：`RunSlot`、`getSnapshot`；`src/arona-clicker/contracts/operation-view.ts`；`src/ui/controller-actions-operation.ts`。 | 新 Scene 状态要有唯一写入口；UI 不直写 StateMutationService 或保有竞争的 Scene 权威副本。 |
| 原子结算 | 战斗使用 `commitBeat`；SceneAction 使用 `commitSceneActionBatch` / staged commit。两者都经过 Runtime planner / OperationResolution 并按版本和完整性检查，但命令与批次边界不同。 | `src/arona-clicker/services/operation-runtime-service.ts`；`operation-resolution-planner.ts`；`src/arona-clicker/contracts/operation-resolution.ts`；`tests/engine/operation-scene-actions.test.ts`。 | G03 复用现有原子路径；保持 `commitBeat` 与 SceneAction batch 分离，每次提交内 Cost、Effects、牌区和进度一致更新。 |
| 选择、目标、执行者 | 战斗干预 Draft 是单 Actor target；SceneAction / 场景卡使用 `targetActorIds[]`。Global 已支持多个明确目标和按目标结算。UI 某 Individual SceneAction 空目标数组目前会被控制器补成所有合法目标。位置 ID 已存在于 Actor，但目标选择器不按目标位置筛选。 | `src/arona-clicker/contracts/operation-action.ts`、`operation-scene-action.ts`；`src/arona-clicker/services/operation-target-selection.ts`、`operation-resolution-planner.ts`；`src/ui/controller-actions-operation.ts`：`readSceneBatchCommand`。 | PB-08 必须让实际选择数量显式；PB-23 新增位置 / 群体 filter，不重复造 target 数组或 fan-out；不允许把空数组默认为全选。 |
| 牌与 performer | 角色牌可拖放挂靠 Performer；已有 `performerPolicy` 和 View eligible Actor 列表。纯点击路径目前不能给无 performer 的 selected-student 卡分配角色。 | `src/ui/controller-actions-operation.ts`：`bindCardTargetGestures`、`applyCardDrop`；`OperationView`；`tests/ui/gameplay-b-operation-controller.test.ts`。 | PB-07 是可访问交互补齐，不应改变 performer 的 Runtime 合法性或状态 owner。 |
| 费用 | UI 成本预览主要按 DOM `data-player-cost` 求和，未纳入 ActionDef Actor / Team costs。Runtime `previewSceneActionBatch` 已可返回 PlayerCost、行动资源费用和阻塞原因。Strategy Park 西门进入 Run 时 5+1=6；`maxCarryCost=5` 是离场时上限，不是余额容量。UI 目前固定 5 个槽。 | `src/ui/components/operation-workspace.ts`：`MAX_COST_SLOTS`；`src/ui/controller-actions-operation.ts`：`updateCostPreview`；`src/arona-clicker/services/operation-entry-service.ts` / `operation-runtime-service.ts`；Strategy Park sample；`tests/engine/operation-runtime-service.test.ts`。 | PB-03 显示当前余额；PB-10 复用纯 Runtime 预览；不凭旧 UI 上限添加新 capacity。 |
| 文案 / labels | View 提供 Track 数值、Fact / Item ID 和一些 Actor / Action 文案，没有通用 Fact / Item / Track 显示名表；UI 中仍有 Carousel-specific 开场、战斗和事实日志字符串。 | `src/arona-clicker/contracts/operation-view.ts`；`operation-view-projector.ts`；`src/ui/components/operation-workspace.ts`。 | PB-02 与 PB-04 要分清 Event / 阶段文案和 Track / Fact / Item 名称；先复用现有内容表现，不因局部缺名就建立通用词条系统。 |
| 存档 | `SaveData.operationRun` 可保存有限 EventRun checkpoint；恢复时使用当前内容与 `resumeVersion` 校验，不兼容则拒绝；项目策略不写旧存档迁移。 | `src/arona-clicker/contracts/save-data.ts`、`operation-save.ts`；`operation-entry-service.ts`；`tests/engine/gameplay-b-save-resume.test.ts`。 | Owner 已决定 Scene 进度并入现有 Location progress / EventRun checkpoint；不加 SaveData 顶层键，版本不兼容依 `resumeVersion` 拒绝，按清档策略，不做迁移。 |
| Operation 内容与独立 Editor | Datapack / Registry / validation 已有六张 Operation 表：Events、Locations、Actions、Student Operation Profiles、Strategy Profiles、Card Pools。独立 Editor 生成 Schema 虽含相关定义，但 `TableKey` / `TABLE_META` 不含 Operation 表；`buildTables`、`loadDatapack`、`toDatapack` 仅遍历编辑器已知表。Editor JSON 文件 / 剪贴板并非 Runtime PackParser 的 manifest+fragments 包流程。 | `src/data-services/contracts/datapack.ts`；`src/data-services/registry/registry.ts` / `registry-validate.ts`；`tools/datapack-editor/schema/types.ts`、`editor-extras.ts`、`schema/merge.ts`、`model/editor-model.ts`、`ui/io.ts`；`src/data-services/datapack/pack-parser.ts`。 | PB-25 是完整作者路径，不是简单生成 Schema；必须验证无丢数据编辑、校验、可导入、reload 后能从通用 Operation 入口点击游玩。 |
| 样例入口 | Runtime 正式注册 Carousel `gameplay-b@1.0.0` 与 Strategy Park `gameplay-b-strategy-park@1.0.0`；Strategy Park feed / 地图是内容专属呈现。`carousel-route-slice` 是独立 resolver / route 示例，不是当前正式 Carousel bundle 内容。 | `src/arona-clicker/runtime.ts`；`src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`；`carousel-route-slice.ts`；`src/ui/components/center-panel.ts`。 | PB-19 / 22 / 25 需要分别说清正式 bundle、独立回归样例和普通作者 Event；不能混成一个入口现状。 |

## 已有基础与旧工作状态

这份背景卷以当前源码为事实，不把旧 Task 的“完成”标签当成永久证明；它们用于说明哪些能力本轮应复用、哪些边界不可误认为已统一。

- **Task 0245 — 费用、执行者与目标合同：** 已完成。明确了 SceneAction / PlayerSceneCard 可以不需要学生，也可以由学生执行；payer、performer 和 target 是不同角色；Scene PlayerCost 与 Action Actor / Team cost 可同时出现、但应在同一场景批次中一起预览和原子提交；Global / Individual 保留各自批次语义。它明确把固定群体 fan-out、M/N、Shop stock、EventRun 临时 Resource 留给后续，不等于这些能力存在。
- **Task 0246 — 统一角色持牌交互：** 已完成 U0–U3。三类牌（战斗 CharacterHand 候选、Location SceneAction、物理 PlayerSceneCard）可以共享 UI 角色归属与交互表现，但仍不是同一 Runtime 牌实体：战斗计划、SceneAction batch、玩家物理卡实例各自保留来源、费用、固定状态和事务。
- **Task 0247 — 二次拖拽与卡牌语义审查：** 已完成。执行者和效果目标分开存储；只有目标合法数大于一才提供重新选目标；Global 多目标 Resolution 按实际选择列表逐 Actor 施加 Effects。不能说当前 UI 目标一定只是一个，也不能把“对全队”误解为空列表自动全选。
- **Task 0248 — optional-student、可跳过推进与目标连线：** 已完成。`required` 表示玩家可选，不要求每名学生 / 每批都必须选择；`fixed` 才表示自动加入、不可取消。可跳过空批次占用一次 Location 批次机会，但不扣 Cost / 移牌 / 结算非 fixed 行动；完成目标和 Route Gate 仍要满足。这是当前 Task 语义的关键来源，不能沿用更早的“必须每人选满”旧说明。
- **Task 0249 — Operation 工作区面板 / 地图弹窗：** 旧 Task 的定向 UI 实现已完成，人工视口与遮挡检查曾作为剩余验收点。当前地图入口是 Strategy Park 专属表现，不因通用 Scene 目标被自动视为 Carousel 残余。
- **Task 0250 — GALHCG 职责抽取：** 冻结时已交 Luna 子代理施工，主代理复核尚未完成；它不是 Operation Scene 的源代码实现，也不是 G03 必须等候的运行时依赖。不可把它的提取建议当成当前实现事实。

对应归档来源：[[task-0245-gameplay-b-operation-scene-card-performer-target-cost-model]]、[[task-0246-gameplay-b-unified-actor-card-interface]]、[[task-0247-gameplay-b-card-drag-target-and-semantic-audit]]、[[task-0248-gameplay-b-scene-card-activation-progression-and-links]]、[[task-0249-gameplay-b-operation-workspace-panels-and-map-popup]]、[[task-0250-galhcg-node-extraction-and-responsibility-aggregation]]、[[archive/active-work-freeze-2026-10-08-gameplay-b-atomic-scenes]]。这些归档和阶段材料是历史导航；若其内容与当前源码不同，以当前源码 / 测试 / `docs/docs-829/` 为准。

## 已定的跨阶段合同摘要

| 顺序 | 裁定主题 | Owner 默认决定 | 影响 Task |
| --- | --- | --- | --- |
| 1 | Scene 身份、顺序和状态 owner | Scene Definition 默认嵌入 Location；稳定 ID 由 Event / Location / Scene 组合；无独立 Instance allocator；线性顺序；EventRun 是唯一 owner；进度随现有 checkpoint。 | PB-13、14、18、22、25 |
| 2 | 计划与执行 | 复用 UI `OperationSceneDraft`，ScenePlan 是轻量值；Offer 是只读视图且保留牌源身份；普通场景默认单次确认；战斗和 SceneAction 提交路径不合并。 | PB-11、15～17 |
| 3 | 目标与选择 | Individual 显式单选；Global / 支持多目标的牌显式多选；位置过滤进入目标合同；`select` 与明确声明的 `all-eligible` 分开；M 选 N 首版恰选 N、同一 SceneAction 批次。 | PB-08、23、24 |
| 4 | 样例与迁移 | Carousel 正式包迁移、独立 route slice 留作测试；Park 三战各自拥有 Scene；非战地点按一个 Location 一个 Scene；复合样例建议独立测试 Event，不动 Park 主线与 Boss 点。 | PB-19～22 |
| 5 | 临时购买 | 以 PlayerCost + 现有 Effect 表达；每个购买 Offer 每 Run 默认一次；用现有 Fact / Condition 防重，不建 ShopService / 货币 / 库存系统。 | PB-24 |
| 6 | 作者交付与旧特判 | Scene 内嵌 Location，因此先扩展现有 Location 编辑；Editor 无损处理六张 Operation 表并闭合导出 / 导入 / 可玩流程；迁移证据充分后逐个删 Carousel 特判，保留 Park 地图。 | PB-25、26 |

## G01：V1 可读、可玩（PB-01～05）

| Task | 裁定点 / 开工确认 | 状态 |
| --- | --- | --- |
| [[archive/task-0251-pb-01-runtime-combat-stage-projection]] PB-01 | 先找现有战斗配置的唯一判据；不使用 `PreparedBeat` 是否存在或 Location ID。现有字段仍有歧义时，新增最小内容类型字段并由 Runtime 投影给 UI。 | 已裁定默认；已完成并归档 |
| [[archive/task-0252-pb-02-event-correct-operation-copy]] PB-02 | 复用 Event / Location 现有表现字段；缺少时只补局部文案，不新建 Narration 系统；与 PB-04 的 Track / Fact / Item 标签分开。 | 已裁定默认；已完成并归档 |
| [[archive/task-0253-pb-03-cost-balance-slot-projection]] PB-03 | Cost 槽表达当前 PlayerCost 余额，不表达容量；高余额可用数字或紧凑视图。`maxCarryCost` 仅负责离场限制。 | 已裁定默认；已完成并归档 |
| [[archive/task-0254-pb-04-readable-operation-state-names]] PB-04 | 优先复用已有名称来源；缺失的 Track / Fact / Item 标签允许增加 Event-local presentation map，不建全局实体字典。 | 已裁定默认；已完成并归档 |
| [[archive/task-0255-pb-05-actor-position-and-action-eligibility]] PB-05 | 只补站位、当前计划、可替换状态和不可用原因，不改战斗规则。 | 已裁定默认；已完成并归档 |

G01 实施结案（2026-10-08）：9 个定向测试文件共 133 项通过，类型检查通过；PB-01～PB-05 Task 已归档。后续 Goal 仍沿用本 Draft 中原有 Owner 默认裁定。

## G02：操作语义统一（PB-06～12）

| Task | 裁定点 / 开工确认 | 状态 |
| --- | --- | --- |
| [[task-0256-pb-06-card-selection-states]] PB-06 | 浏览、焦点、选中、锁定、不可用各自独立；保留 `required / fixed` 语义。 | 已裁定默认 |
| [[task-0257-pb-07-click-performer-assignment]] PB-07 | 点击 Performer 和拖放共用 UI 草稿操作与 Runtime 资格来源。 | 已裁定默认 |
| [[task-0258-pb-08-target-selection-and-count-validation]] PB-08 | Individual 多候选显式单选；Global / 支持多目标的场景牌可显式多选；空数组不表示全体。 | 已裁定默认 |
| [[task-0259-pb-09-reversible-local-action-plans]] PB-09 | 复用 UI 本地草稿；仅修撤销、换人、换目标和 stale 清理，不增加草稿服务。 | 已裁定默认 |
| [[task-0260-pb-10-legality-and-cost-preview]] PB-10 | 费用和合法性来自 Runtime Preview；UI 不另算价格或资格。 | 已裁定默认 |
| [[task-0261-pb-11-confirm-return-and-skip]] PB-11 | 常规流程为编辑 + 即时预览后单次确认；只在不可逆后果 / 复杂批次确需复核时使用现有 stage / commit。 | 已裁定默认 |
| [[task-0262-pb-12-operation-result-timeline]] PB-12 | 优先用现有记录生成可信顺序；不能证明不伪造。只有真实验收需要且现有数据不足时才补最小顺序字段。 | 已裁定默认 / 条件升级 |

## G03：原子场景骨架（PB-13～18）

| Task | 裁定点 / 开工确认 | 状态 |
| --- | --- | --- |
| [[task-0263-pb-13-scene-identity-lifecycle]] PB-13 | Scene Definition 内嵌 Location；Location 内稳定 `sceneId`，身份由 Event / Location / Scene 组合；V1 不建独立 Scene Instance allocator；线性进度由 OperationRuntimeService 的 EventRun / Location progress 持有并随现有 checkpoint 保存。 | 已裁定默认 |
| [[task-0264-pb-14-scene-content-presentation]] PB-14 | Scene definition 直接含标题 / 简述；Actor / Action 复用现有名称；Fact / Item / Track 用 Event-local map；遵循已有本地化机制，不建 Registry / 国际化框架。 | 已裁定默认 |
| [[task-0265-pb-15-action-offer-projection]] PB-15 | Offer 是只读候选投影；相同 ActionDef 的不同来源保持各自身份、费用与提交路径；不持资源、不执行效果。 | 已裁定默认 |
| [[task-0266-pb-16-scene-plan-preview]] PB-16 | 复用 `OperationSceneDraft`；ScenePlan 是轻量值对象；UI 草稿和按需 Runtime staged batch 分开；不要求 Plan 跨战斗 Beat 与 SceneAction Batch 混合。 | 已裁定默认 |
| [[task-0267-pb-17-scene-atomic-resolution]] PB-17 | 保留 `commitBeat` / SceneAction batch；单次提交内费用、Effect、牌区与 Scene 进度原子一致；拒绝部分成功、过期请求和重复副作用。 | 已裁定默认 |
| [[task-0268-pb-18-scene-completion-location-exit]] PB-18 | Scene 只表达是否完成；不等于 Location 完成 / Route 转场；Location / Event 继续管理空间进度；Scene 可推进有序下一幕但不移动地图。 | 已裁定默认 |

## G04：真实玩法迁移（PB-19～24）

| Task | 裁定点 / 开工确认 | 状态 |
| --- | --- | --- |
| [[task-0269-pb-19-carousel-sample-migration]] PB-19 | 只迁正式 Carousel；独立 route slice 保留为测试样例，不强制并入。现内容若已等价替换，可按测试证据收窄或关闭。 | 已裁定默认 |
| [[task-0270-pb-20-strategy-park-battle-migration]] PB-20 | 三个战斗 Location 各有独立 Scene 身份，不抽共享 Definition；保留 3 / 3 / 4 Beat。 | 已裁定默认 |
| [[task-0271-pb-21-location-exploration-migration]] PB-21 | 一个旧非战斗 Location 对应一个 Scene 等价迁移；不改变 fixed 行动、费用、Effect 顺序或 Route。 | 已裁定默认 |
| [[archive/task-0272-pb-22-multiple-scenes-per-location]] PB-22 | 复合样例用独立小型测试 Event；同 Location 线性 Scene A → B；A 完成后原地激活 B；失败不推进，skip 遵循现有规则，回访保留 Run 内进度；Park 主线 / Boss 不动。 | 已裁定默认 |
| [[archive/task-0273-pb-23-group-and-position-targets]] PB-23 | Position 属目标合法性，扩展现有 ActionTargetDef / 目标服务；明确 `select` 与 `all-eligible`；过滤取交集，状态过期重验，空组不可执行。 | 已实施、浏览器验收并归档 |
| [[archive/task-0274-pb-24-m-of-n-and-temporary-shop]] PB-24 | 同一 SceneAction batch 中 M 选 N 为恰好 N；fixed 不计数；skip 按既有规则。Purchase Offer 复用 PlayerCost / Effect，每项每 Run 默认一次，用现有 Fact / Condition 防重，不建 Shop / stock 服务。 | 已实施、浏览器验收并归档 |

## G05：内容作者交付（PB-25～26）

| Task | 裁定点 / 开工确认 | 状态 |
| --- | --- | --- |
| [[archive/task-0275-pb-25-scene-authoring-and-validation]] PB-25 | Scene 内嵌 Location；优先扩展现有 Operation Location 编辑。六张 Operation 表无损编辑；完成保存 / 验证 / PackParser 导出 / 重新导入 / Operation 入口游玩闭环。 | 已完成，证据见归档 Task |
| [[archive/task-0276-pb-26-remove-legacy-special-cases-and-regression]] PB-26 | 仅删除已由通用 View / 内容替代的 Carousel 特判；保留 Strategy Park 地图和正常 Event 差异；不建兼容服务。 | 已完成，保留边界及交叉回归见归档 Task |

## PB-01～PB-26 逐项背景与裁定缘由

以下章节让未读过各 Task 的 Chat 能一次理解：需求从哪里来、现在的系统是什么、为什么当时会提出某个裁定问题，以及它如何影响施工。章节中“待裁定 / 待确认”只描述 Goal Owner 统一裁定提供前的分析状态；**当前执行默认一律以上方 Goal Owner 统一裁定为准**。若出现上方列出的四种升级条件，才重新开启讨论。每项中的源码入口是核对路线；具体测试清单和玩家验收仍以相应 Task 正文为准。

### G01 — V1 可读、可玩

#### PB-01：Runtime 战斗阶段投影

- **为什么有此项：** Roadmap 假设 Runtime 已提供“战斗阶段”，并要求战斗卡、按钮和标题由这个阶段控制。现在 Operation Workspace 的三个调用路径都检查 Carousel 的 `platform` Location ID，导致其他 Event 的战斗可能被当成场景行动。
- **现状证据：** `OperationView` 有 `currentLocationId`、`currentActionMode` 和 `basePreparedBeat` / `effectivePreparedBeat`，没有明确阶段字段；`refreshPreparedBeat()` 对存在战术内容的未完成地点都会生成 prepared beat。Strategy Park 用 `scene.combat` 与 `maxBeats` 表达三处战斗，非战斗点用 action mode / SceneAction 批次表达。
- **待裁定：** 施工时能否用一项现有作者字段作为跨 Carousel / Strategy Park 的无歧义 Runtime 判据？如果不能，是否新增最小内容字段或 View projection？这里不决定要不要造 `SceneRuntime`。
- **影响：** 必须替换三个消费者的相同业务判断，并覆盖三个 Park 战斗及非战斗地点；只隐藏一个按钮不能算修复。入口：`src/ui/components/operation-workspace.ts` 的 `projectOperationActorHand()`、`renderMain()`、`renderOperationWorkspace()`；`src/arona-clicker/services/operation-runtime-service.ts` 的 `refreshPreparedBeat()`。

#### PB-02：事件正确的 Operation 文案

- **为什么有此项：** 当前 UI 有旋转木马专属的入口 / 阶段 / 结案字符串；Strategy Park 开场和结案可能读到错误或过度泛化文字。它和 PB-04 的对象名称不同：PB-02 处理“我进入什么事件、处在哪个阶段、刚完成什么”；PB-04 处理轨道、事实、物品叫什么。
- **现状证据：** Event 和现有 Action / Actor 等内容已带部分可展示标题、说明；UI 仍存在 Carousel 入口卡片和阶段 / 结算分支。`center-panel.ts` 的 Operation feed 目前只列 Carousel 与 Strategy Park 两个例子。
- **待裁定：** 对已有字段足够表达的 Event，按各自内容提供标题 / 介绍 / 结案文案；若某个所需阶段文字没有局部内容字段，先决定是否可借既有 presentation mapping。只有出现跨 Event 都需要的新语义时，才另裁定通用字段，不把 PB-02 扩成通用 Narrative 系统。
- **影响：** 需要同时保留 Carousel 正确文案和 Strategy Park 文案，并与 PB-04 分开责任，避免同一 Fact / Item 文案被两个 Task 各做一套。入口：`src/ui/components/center-panel.ts`、`src/ui/components/operation-workspace.ts`、Operation 样例内容。

#### PB-03：按余额呈现 Cost 槽

- **为什么有此项：** 当前 UI 固定画 5 个 Cost 槽，但 PlayerCost 是实时余额，不是容量。Strategy Park 西门可带着 5 点入场再获得 1 点，因此余额可到 6；离场时 `maxCarryCost=5` 才做截断。
- **现状证据：** `operation-workspace.ts` 有 `MAX_COST_SLOTS = 5`；Runtime 维护 `playerCost`，地点可 `costGain`，离开时另行受 `maxCarryCost` 约束。Task 指向 Runtime 测试验证余额超过 5、最高可到 50。
- **待裁定：** Task 的推荐是槽数表示当前余额、0 时显示 0 与耗尽状态。除非产品明确要求显示第三种“容量上限”，否则不得把 `maxCarryCost` 复用为槽数；若要上限，必须另定其数据 owner / 语义。
- **影响：** UI 不应改变成本经济或路线截断，只改读数表现。入口：`src/ui/components/operation-workspace.ts`、`src/arona-clicker/services/operation-runtime-service.ts`、`tests/engine/operation-runtime-service.test.ts`。

#### PB-04：Operation Track / Fact / Item 名称

- **为什么有此项：** 轨道值、已知事实和持有物在 View 中主要是 ID / 数值；现 UI 对 Carousel 有特判名称，对未知 Track 会显示“现场状态”之类通用字样，部分日志仍把任何 Fact 写成 Carousel 控制台。
- **现状证据：** `OperationView.tracks` 是 ID 到数值的映射，`knownFactIds` / `heldItemIds` 是 ID 列表；没有通用 Fact / Item 名称字典。Actor / Action 有作者文案；Strategy Park 地图给少数凭证提供专属名称，但没有一般 Track / Fact label 表。
- **待裁定：** 先查能否复用 Event 内 presentation map / 已有只读 View 名称。如果要把 Track / Fact / Item 名称写进新的 Datapack 字段，需决定它是 Event-local label、可复用实体定义还是其他 owner；不能顺手造全局实体系统。
- **影响：** 新字段触发源合同、Registry、生成 Schema、独立 Editor 同步，需另行评估范围。入口：`src/arona-clicker/contracts/operation-view.ts`、`operation-view-projector.ts`、`src/ui/components/operation-workspace.ts`。

#### PB-05：学生站位和行动资格

- **为什么有此项：** Actor 已有前 / 后排位置和资格投影，玩家面板却不显示位置；不可用原因的 UI 文案部分通过 Carousel reason / ability 映射查找，Park 的理由会落到泛化回退。
- **现状证据：** `OperationActorDef.positionId` / `OperationViewActor.positionId` 存在；Actor Effect 可改站位，Strategy Profile / CardPool 能用 front / back 筛选；`OperationViewActionOption` 有 selectable、blocked reason 等投影。
- **裁定边界：** 只显示已有 View 状态。未知位置用安全中性文案；战斗牌展示“当前计划 / 可替换 / 不可用”。`fixed` 只保留给现有 SceneAction / SceneCard 规则，不能扩成战斗牌规则。
- **影响：** 这是显示现状，不扩充位置系统、资格算法或“fixed”语义。入口：`operation.ts`、`operation-view.ts`、`operation-workspace.ts`、Operation View / Workspace tests。

### G02 — 玩家操作语义统一

#### PB-06：浏览、焦点、选中和不可用

- **为什么有此项：** 三种牌源（学生战斗牌、Location SceneAction、玩家场景牌）的选中反馈与 aria 语义不完全相同；出现默认亮起或有焦点时，玩家可能误以为牌已进入结算计划。
- **现状证据：** 战斗牌的 `selected` 来自有效计划；SceneAction / SceneCard 按 `required | fixed` 管理；浏览、hover 和键盘焦点应只是视觉 / 输入状态。
- **待确认 / 当前合同：** `browsing/focused` 不等于 selected；`fixed` 是已纳入且不可取消；`required` 是可选；unavailable 显示原因且不允许激活。Task 按此合同施工，无额外产品选择。
- **影响：** ARIA / 键盘状态不能把浏览态当 `aria-pressed`，也不能把 fixed 误标成 disabled。入口：`src/ui/components/operation-workspace.ts` 中三种卡视图，`tests/ui/operation-workspace-view.test.ts`。

#### PB-07：点击 Performer 分配

- **为什么有此项：** 未挂靠学生的 `selected-student` 场景行动牌现在靠拖放选择执行者；普通点击处理会拒绝没有 performer 的牌，键盘 / 纯点击无法完成此路径。
- **现状证据：** View 已提供 eligible Actor IDs；拖放路由由 `performerPolicy` 与未绑定的 Actor 候选决定。固定牌和无需学生的 `none` / `optional-student` 牌已有不同规则。
- **裁定边界：** 增加可聚焦的点击候选入口，只显示当前 eligible IDs；点击结果与拖放相同，草稿更新但不写 Run。资格逻辑继续由 View / Runtime 负责。
- **影响：** PB-07 不定目标数量；目标选择是 PB-08。入口：`src/ui/controller-actions-operation.ts` 的 `bindCardTargetGestures` / `applyCardDrop` 和 `tests/ui/gameplay-b-operation-controller.test.ts`。

#### PB-08：目标数量和显式选择

- **为什么有此项：** 战斗牌使用单个 `targetActorId`；SceneAction / PlayerSceneCard 的命令使用 `targetActorIds[]`。当前控制器对空目标的 Individual SceneAction 会把所有合法候选写入命令，候选资格被误当作玩家已经选择。
- **现状证据：** 目标选择服务可筛合法候选；Planner 可对 Global 的多个明确目标逐一应用效果。Global 多目标是已有能力，缺少的是位置 / 群体筛选与一致的显式选择，不是所有场景行为只能选一个 Actor。
- **待裁定：** 当前 Task 建议 Individual 多候选时只选 1 个，Global / 玩家场景牌可多选且必须明确展示所选名字。需要 Owner 明确保持此数量合同；若要允许 Individual 多选，应先修改 Draft 和 Runtime/UI 验收。
- **影响：** 需要在 Controller 命令、Runtime preview、最终 Planner 三处校验；失败不能部分扣费、写 Effect 或弃牌。入口：`operation-target-selection.ts`、`operation-scene-action.ts`、`src/ui/controller-actions-operation.ts` 的 `readSceneBatchCommand`。

#### PB-09：可撤销的本地草稿

- **为什么有此项：** 计划行为由牌、执行者、目标组合而成；单击 / 拖放不断替换时，关联字段可能残留，旧运行草稿也可能重用。
- **现状证据：** UI 有 `OperationSceneDraft`；它是以 `runId`、`planVersion`、当前 Location 等为界的本地内存状态。Runtime 另有可保存的 staged batch，两者生命周期不同。
- **待确认 / 当前合同：** 取消牌要清除其 performer / target；改目标不删除行动；改 Performer 仅保留仍合法的目标；版本或 Location 失效则提示刷新，不提交旧草稿。Scene 还未独立身份化，本 Task 暂以 Location 为局部编辑上下文。
- **影响：** 普通输入应使用局部 DOM 更新 / identity 保持，不用整页 render 重建草稿。PB-13 建立 Scene Instance 后需重新审视草稿绑定键。入口：`src/ui/controller-actions-operation.ts`、`src/ui/components/operation-workspace.ts`。

#### PB-10：合法性和费用预览

- **为什么有此项：** UI 目前按 DOM 上的 PlayerCost 数字做简单求和，没有调用已有 Runtime preview，漏掉由行动 Actor / Team 支付的资源费用，也无法统一呈现 Runtime 真实拒绝理由。
- **现状证据：** `OperationRuntimeService.previewSceneActionBatch` / `OperationEntryFacade.previewSceneActionBatch` 是纯计算，返回余额、PlayerCost、Actor / Team 成本、批次计数和拒绝原因；战斗候选有 `selectable`、`blockedReasonIds`、`canCommit`，提案干预可使用 `previewIntervention`。
- **裁定边界：** preview 必须复用提交使用的 Planner，变更选择后更新；preview 不写 Run / 扣费 / 移牌，最终提交再验证。UI 不复制规则计算。
- **影响：** 费用、合法性、Actor / Team 资源都来自可信 Runtime 预览。入口：`src/arona-clicker/services/operation-runtime-service.ts`、`operation-entry-service.ts`、`src/ui/controller-actions-operation.ts` 的 `updateCostPreview`。

#### PB-11：两步确认、返回修改和跳过

- **为什么有此项：** Runtime 已有 `stageSceneActionBatch` / `commitStagedSceneActionBatch`，普通 UI 的“确认本批”目前通常直接走 `commitSceneActionBatch`，没有常规待确认面板。
- **建议但未决定：** 场景操作先将完整 Plan stage 为 pending，玩家查看选择 / Performer / Targets / Preview 后可返回修改或二次确认；跳过以单独的空 batch / 明确命令表现。战斗继续单击 commitBeat，学生 Wait 是自动计划结果，不等于玩家跳过按钮。
- **待裁定：** Goal Owner 需确认是否将这个两步交互作为 Scene 的必需体验，或保持一键结算。Roadmap 的“编辑 → 待确认 → 结算”是一种意图，具体操作仍可修订。
- **影响：** 若改为两步，必须正确恢复 UI 草稿和 Runtime staged state，返回修改不能提前写 Effect / 扣费。入口：`operation-runtime-service.ts` 的 stage / clear / commitStaged API，`src/ui/controller-actions-operation.ts` 的 Scene submit / commit 分支。

#### PB-12：Operation 旅程时间线

- **为什么有此项：** Resolution 有递增 `resolutionSequence`；Route 转场与 Location entry Cost 记录没有共用序号；现 UI 将 Resolution、Route History、入场费用分开呈现，不能直接拼成跨地点因果线。
- **现状证据：** View 暴露 `resolutions`、`routeHistory`、`locationEntryCostHistory`、`resolutionSequence`；Result resolution 是一个原子结算块，不能把它伪拆成未存储的 Effect 微观顺序。
- **待裁定：** 先验证已有 Location visit / entry 轨迹能否恢复确定顺序。若存在重复地点、历史截断或零记录，须显示可证边界；只有确实不能恢复时，才决定新增最小 timeline order 数据及是否扩展 Save checkpoint。
- **影响：** 不做看似精确但可能错误的排序；如果要改 Run / SaveData，按破坏性状态变更和清档策略处理，无迁移层。入口：`operation-resolution.ts`、`operation.ts` 中 Route / Entry record、`operation-view.ts`。

### G03 — 原子场景骨架

#### PB-13：Scene 身份与生命周期

- **为什么有此项：** 当前没有 `SceneDef`、`SceneRuntime`、`sceneId`、`sceneInstanceId` 或 Scene lifecycle。Location 完成、Event Run 终局、Beat 与 SceneAction batch 各有独立状态；`sceneActionBatchesUsed` 是 Location 访问的批次数，不能当 Scene 运行次数。
- **待裁定：** 定义是否 Registry 顶层或嵌套在 Event / Location；稳定 ID 的命名 / 引用；实例每次进入、每 Run / Location 首次创建或其他时点生成；ready / active / completed 是否够用；单一状态 owner / 写入口；重复操作幂等；失败 / 完成 / 重入；状态是否纳入当前 `operationRun` checkpoint 与 resumeVersion。
- **影响：** 这是 G03、G04、G05 共同前提。若裁定引入新 Runtime owner、SaveData 键、PlayerState / InitSnapshot 字段或全局 EventBus 关系，停下并另开 ADR / Task，不由执行代理自由选型。入口：`src/arona-clicker/contracts/operation.ts`、`operation-runtime-service.ts`、`runtime-game-instance.ts`、`operation-save.ts`、`tests/engine/gameplay-b-save-resume.test.ts`。

#### PB-14：Scene 作者表现信息

- **为什么有此项：** View 已有 Action / Actor 文案投影，但没有 Scene 的标题、说明、状态名；事实 / 物品仍主要以 ID 显示。
- **待裁定：** 标题、说明、状态标签是 Scene 定义自身字段还是独立 presentation 引用；是否多语言；Actor / Fact / Item 名称是否可复用现有实体文案还是 Scene-local label；字段 owner 与 Registry validation 放在哪里。
- **影响：** PB-14 依赖 PB-13 身份合同。若新增数据源类型，须同步源契约、Registry、Schema 生成与 Editor 的复杂表元数据，不直接改生成文件；不得建设通用 Narration 系统或把 Event 的 ID allow-list 推为全局实体。入口：`operation.ts`、`operation-view.ts`、`operation-view-projector.ts`、Schema sync 约定。

#### PB-15：统一 Action Offer 投影

- **为什么有此项：** 当前 View 分别暴露战斗 ActionOption、SceneAction、PlayerSceneCard；UI 另有角色持牌 adapter。虽可共用表现，但三种来源的身份、费用和提交命令不同。
- **待裁定：** Offer 是否以稳定 Action ID、SceneAction 实例、物理牌实例还是 UI-local candidate id 为身份；多个来源的同一 ActionDef 合成一项还是多项；required/fixed、performer、scope/timing 的只读呈现；availability / failure reason 的唯一可信来源；Offer version 对齐 Run / planVersion。
- **影响：** Offer 只投影选择，不代替 ActionDef、不直接产 StateDelta、不合并各自价格 / 费用 owner。入口：`src/arona-clicker/contracts/operation-view.ts` 的现有 DTO、`src/ui/components/operation-workspace.ts` 的 `OperationActorHandCardView`。

#### PB-16：ScenePlan 与纯预览

- **为什么有此项：** UI 已有 SceneDraft，Runtime 有 preview / stage / commit；但尚无通用 ScenePlan。把同一个词用在三种生命周期会产生 stale state 和存档误解。
- **待裁定：** UI 本地草稿、Runtime staged draft、ScenePlan 是否分成两到三种对象；计划可否跨 Action 来源混合、引用哪些 Offer IDs；空计划和 fixed item 表示；preview 走现有 SceneBatch 或薄 adapter；是否尝试与战斗 PreparedBeat 组合；如何用 Run version / planVersion / SceneInstance 校验。
- **影响：** Pure preview 必须无写入、不扣费、不弃牌、不发 Effect、不推进 Random cursor。战斗和 Scene 提交可以显示一致但保留不同命令。入口：`operation-scene-action.ts`、`operation-view.ts`、`operation-runtime-service.ts`。

#### PB-17：Scene 原子结算

- **为什么有此项：** Battle commit 与 SceneBatch commit 各自已有 Planner / Owner write，但新 Scene 可能组合学生行动、SceneAction、玩家卡和完成状态。
- **待裁定：** 一个 Scene Plan 是否可跨多来源一起提交或来源分开提交；Scene completed 是否与状态 / 位置 / 资源 / 费用 / card zone / Resolution 在同一原子 Run replacement；成功 / 失败回执结构；同一 base plan 重试是否复用现有 idempotency 语义。
- **影响：** UI 只能传经校验的命令，不能提供 caller-supplied delta；Runtime 一次性计算完整计划并在成功后安装新快照，不出现部分扣费或 UI / Runtime 各算一次结果。入口：`operation-runtime-service.ts` 的 `commitBeat` / `commitSceneActionBatch`；`operation-resolution-planner.ts`。

#### PB-18：Scene 完成与 Location / Exit

- **为什么有此项：** 现在只有 Event / Location 完成语义；Location completion 可评估 Route Gate、目标及单出口转场。新 Scene 完成若重用 Location.complete 会意外移动空间流程。
- **待裁定：** Scene result 是布尔还是 richer result；completed 能否重入；Scene 完成后的玩家留场、结束 Operation 或由 Location/Event 开放下一流程；哪些 Route criteria 可用。必须区分 Scene Definition progress 和一次 Instance 的完成。
- **影响：** Scene completion handler 不直接调用 `completeCurrentLocation`、`transitionRoute` 或 `finish`；Location/Event 继续管理地图。复杂同地点下一 Scene 的推进留 PB-22。入口：`OperationLocationProgress`、`OperationRunStatus`、`RouteView`、`operation-runtime-service.ts` 的 completion / route methods。

### G04 — 真实玩法迁移和复合场景

#### PB-19：Carousel 正式样例迁移

- **为什么有此项：** Carousel 正式内容已组合安全战斗、平台、通道 SceneAction、出口 Global SceneAction 和玩家场景牌；另外还存在独立 route slice resolver。
- **现状证据：** Runtime 正式 `gameplayBCarouselDatapack` 由 `carousel-scene-action-slice` 组装；`carousel-safety-slice` 是安全战斗片段，`carousel-route-slice` 是四地点独立测试 Event，不在正式 wrapper 内。
- **待裁定：** PB-19 默认只迁正式 bundle。独立 route slice 是否继续为测试 / 示例、并入正式 Carousel 或冻结；在 G01 / G03 后具体还有哪些 Carousel ID 特判；若已等价，是否收窄 / 关闭 PB-19，不能为了编号制造迁移。
- **影响：** 不重做已经存在的 Carousel 行为或路线。入口：`src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`、三个 Carousel slices 和 route test。

#### PB-20：Strategy Park 三场战斗迁移

- **为什么有此项：** Park 是正式 13 地点流程，三处战斗是碰碰车区、烟花排练广场和中央舞台设备井，节拍分别 3 / 3 / 4。三者旧上下文都用 `park:combat`，但这不意味着它们共享一个 Scene instance。
- **待裁定：** 每个战斗地点是独立 Scene Definition、共享定义 + 各自 Instance，还是其他裁定模型；PB-01 的战斗 stage projection 与 G03 Scene mode/status 谁拥有最终显示语义；如何保留 `commitBeat` 事务边界和 AI/Profile 行为。
- **影响：** 迁移只换统一的 Scene 展示 / 计划体验，不重平衡角色、策略、战斗效果或 Route。入口：Strategy Park content / IDs、`gameplay-b-strategy-park-virtual-play.test.ts`。

#### PB-21：十个非战斗 Location 迁移

- **为什么有此项：** 除三处战斗外，Strategy Park 还有十个非战斗地点，已有 Individual / Global SceneAction、固定行动、PlayerCost、Actor / Team cost、Fact / Item / Outcome 和 Route 规则。
- **建议 / 待确认：** 第一轮建议一旧非战斗 Location → 一个可见 Scene，作为语义等价迁移；如果多个地点共享 Scene Definition，仍需明定每次 visit 是否有各自 Instance / progress，不能静默共享完成状态。
- **额外保持项：** 如 `controlRecord` 为 fixed 且与 `controlPower` 同一批次结算，需保留原时序；不能借搬到 Scene 改成可撤销或分批。
- **影响：** 先制作完整旧→新映射表：Scene ID、活动、行动选择、执行者 / 目标、费用、效果、Item / Fact、Route、访问上限。入口：`gameplay-b-strategy-park.ts`、IDs、Runtime / sample tests。

#### PB-22：同 Location 多 Scene 和复合地点

- **为什么有此项：** Roadmap 希望在一个地点先调查再处置警报，地图位置不变；当前 Operation 只有 Location 内行动批次，没有 Scene 序列 / nextScene 字段。
- **待裁定：** 下一 Scene 的唯一内容声明和推进事件；首段失败、跳过、回访对第二段开放条件；Scene completed 与 Location completed 的关系；回访和 Save / Resume 的状态保留；样例是 Park 同 Event 新增 Location 支路还是新 Event。
- **现有地点冲突：** Park 已有“中央舞台设备井” 4 Beat Boss Location。Task 建议新 ID、新可选支路保护旧地点，但这是建议，不应按相同中文名字覆盖 `IDS.locations.boss`。若新 Event，需决定新的 Operation feed / UX 入口。
- **影响：** 不能用 Route 自动转场伪装同 Location Scene 进度，不能改变既有 13 地点主线回归。入口：`gameplay-b-strategy-park-ids.ts`、`src/ui/components/center-panel.ts`、Save / Resume tests。

#### PB-23：站位筛选和群体目标

**完成状态（2026-10-08）：** 已扩展 `OperationActionTargetDef` 的 `selectionMode` / `allowedPositionIds`，以 Runtime 当前 HP / Position 联合 relation / ID / type 筛选；Scene 的 `select` stale 目标拒绝，`all-eligible` 动态展开当前全组，空组不可提交；战斗仍为单目标。独立 `atomic-scene-demo` Event 通过 Engine、UI Controller、View badge 和本地浏览器链路验收。未把空 target ID 数组解释为全选。实施记录和测试统计见 [[archive/task-0273-pb-23-group-and-position-targets]]。

- **为什么有此项：** Actor 已有 `positionId`，ActionTarget 已有目标关系 / ID / Type；Scenario command 的 `targetActorIds[]` / Global fan-out 已存在。但目标定义没有 position / group descriptor。
- **待裁定：** Filter 字段归属全局 `OperationActionTargetDef`（可能影响战斗及其他 Action 来源）还是 Scene Offer target policy（可能不能跨来源复用）；群体自动解析全部合格 Actor，还是玩家可从群体中选子集；空群、死亡 / 移位和 stale target 的拒绝 / 重选语义；Relation、Position、Actor ID、Type 的交集规则。
- **必须保持：** 群体成员变化或目标变不合法时重新 preview / 验证；不得静默把过时目标换成全体。PB-08 的明确选择原则仍有效，不能误把 `targetActorIds=[]` 当全选。
- **影响：** 这是规则 / 内容合同而不是 CSS 筛选；需要 Runtime candidate projection、Planner 校验及警报 Scene 实操。入口：`operation-target-selection.ts`、`operation-resolution-planner.ts`、`OperationActionTargetDef`、Actor position Effect。

#### PB-24：M 选 N 和临时商店

- **为什么有此项：** `required | fixed` 只定义单项是否可选 / 自动纳入；当前 SceneCard 可一次提交多张只是物理牌区选择，不是内容作者可声明的 M 个候选中选 N。Operation 目前也没有 Shop、stock 或 purchase Offer。
- **待裁定（M/N）：** N 是恰选、最多还是最少；允许跳过 / 少选吗；fixed item 如何计数；候选可来自学生行动、SceneAction、玩家牌、purchase offer 的哪些组合；一名候选能否重复选。
- **待裁定（Shop）：** “临时”意味着 Scene-local、Run 内一次购买、有限库存还是离场重置；状态 owner 与保存 / 重入；购买应用既有 `heldItem` / Fact / Track / Action Effect 中哪种；共享 PlayerCost 与行动费用的支付顺序和原子失败语义。
- **当前可复用：** `playerCost` 是 EventRun 共享余额，SceneBatch preview / commit 会一起校验 PlayerCost 与 Actor / Team cost，Action effects 可给 item；但没有现成的购买 / stock 合同。Spot `ShopDef` / `ShopService` 不等于 Operation Shop。
- **影响：** 先裁定内容与 Runtime 合同再实现，防止先接入 Spot 商店或新货币后倒推需求。入口：`operation.ts`、`shop.ts`、`operation-runtime-service.ts`、`operation-resolution-planner.ts`。

### G05 — 独立作者交付和清理

#### PB-25：独立 Datapack Editor 的 Scene 创作与验证

- **为什么有此项：** Runtime 合同 / Registry 与生成 Schema 能容纳六张 Operation 表，不代表作者能在独立 Editor 里编辑这些表。Editor `TableKey` / `TABLE_META` 排除 Operation tables，EditorModel 只遍历已知表；载入 / 导出时会丢掉未知 Operation 顶层数据。Editor 当前 JSON 文件 / 剪贴板不是 PackParser 要求的 manifest + fragments 包。
- **待冻结输入：** PB-13～24 的 Scene 宿主、字段、引用、表现、选择、Cost、completion、后续 Scene 和 checkpoint / resumeVersion 语义必须先确定。本 Task 不得另造第二个 Scene 模型、独立 Registry 或临时 Save 字段。
- **完备作者链路：** Datapack 源类型 → 自动生成 Schema → TableKey / TABLE_META 表单 / EditorModel CRUD → 字段及本包引用校验 → 无损保存 / 导出符合 PackParser 的 artifact → Runtime validate / apply / reload → 通用 Event 入口展示并点击游玩。
- **待裁定：** 若最终 Scene 是嵌套 Location 还是顶层 Registry，PB-25 只消费冻结合同；若 Editor 输出 artifact 与现有 PackManager 不兼容，需提出满足真实导入所需的最小出口，不把“JSON 下载”称作完成。
- **影响：** 破坏性内容变化通过 Event `resumeVersion` 拒绝旧 checkpoint，并按清档策略，不做迁移。入口：`tools/datapack-editor/{schema,model,ui}`、`src/data-services/datapack/pack-parser.ts`、`src/arona-clicker/runtime.ts`、`operation-content-validation.ts`、`gameplay-b-authoring-workflow.test.ts`。

#### PB-26：删除旧 Carousel 特判并跨样例回归

- **为什么有此项：** G01 / G04 / G05 会迁移部分标题、阶段、Fact / Item label、禁用理由、入口等。清理必须等使用者切换到通用内容 / View，不能凭名字搜索结果直接删分支。
- **待裁定 / 证据门槛：** 对 `operation-workspace`、`center-panel`、Operation controller 中每个 Carousel ID 判断、文案回退、入口 fallback 列表出具消费者→替代字段表。只有 PB-19～25 已证明能输出同一玩家可见信息并有真实回归时，才删除被替代的分支；缺一个标题或入口字段就先停，回到上游修复。
- **必须保留：** Carousel 仍是普通可玩的内容样例；Strategy Park 的 13 地点专属地图、SVG 线条 / 区域布局、Route 摘要和 map CSS 是有内容责任的表示，不是 Carousel 遗留，应保持。
- **影响：** PB-26 是最后清理任务，不另建 Scene Manager / 编辑器 / 存档兼容层；手工浏览器验收必须覆盖旧 Carousel 与 Strategy Park，且重看复合 Scene、群体、M/N、Shop、Save / Resume。入口：`src/ui/components/operation-workspace.ts`、`center-panel.ts`、`tests/ui/gameplay-b-strategy-park-map.test.ts` 及 PB-19～25 测试。

## 获批准的施工顺序与剩余升级门槛

1. G01 / G02 按 Owner 默认规则推进，可独立于 G03 开始；按既有 Operation UI / Runtime 能力做定向修复和测试。
2. G03 从 PB-13 开始，按内嵌 Location、EventRun owner、线性进度及现有 checkpoint 的最小合同逐 Task 落地；每项至少提供一个玩家可观察的行为。
3. G04 先做等价迁移，再提供多 Scene、Position / group、M/N / Purchase 的可玩样例；每项用真实 Operation 内容验收。
4. G05 消费 G03 / G04 已冻结的合同完成 Editor 无损链路，最后按证据清理旧特判。

仅在 Owner 裁定中列出的四种升级条件下暂停当前路径；其他字段命名、helper、对象组织和 API 适配由施工代理按最小变更原则完成并测试。Task 的 `proposed` 状态表示该项尚无实施证据，不意味着重开已定规则。

## 当前核验依据

- 当前 Scene / SceneInstance 身份、Scene lifecycle、通用 Offer 和 ScenePlan 尚无独立 Operation 合同；`interactionSceneId` 是候选上下文，不是 Scene ID。详见阶段 III Draft 与 Task 0263～0268。
- Operation 的 `SelectionPolicy` 当前为 `required | fixed`；已有 Global 目标的 `targetActorIds[]` 可列出多个明确 Actor，但没有位置筛选或群体规则。
- Operation 已有原子 Beat 与 SceneAction batch 提交入口；它们共享 Resolution 能力，但提交边界不同。
- Operation 内容契约 / Registry 有六张表，独立 Datapack Editor 的表入口不含 Operation 表；Editor 可否创作并导入完整 Operation 内容须按实际操作闭环验收。
- Strategy Park 当前包含 13 个 Location、3 个战斗地点；“中央舞台设备井”是现有 4 Beat Boss Location，不能作为新复合地点被覆盖。

以上事实来自本 GoalSet 各 Task 2026-10-08 的源码 / 测试 / 当前机制页核对；本文件不替代各 Task 中的路径级证据和验收说明。

## 相关路由

[[docs/ai/goal-workflow]] · [[docs/ai/galhcg-project-map]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/05-conventions/schema-sync]] · [[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]] · [[draft-0252-gameplay-b-atomic-scenes-phase-ii-operation-semantics]] · [[draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation]] · [[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]] · [[draft-0255-gameplay-b-atomic-scenes-phase-v-authoring]]
