# Task 0264：PB-14 Scene 表现信息由内容提供

状态：completed — Scene 标题、简述、状态投影和正式内容样例已实现并经过 Operation UI 行为测试。
> Goal Owner 统一裁定（2026-10-08）：本 Task 原先待裁定的字段来源由 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]] 明确；下方施工前门槛和事实记录保留为历史。
> 文档说明：事实表、架构门槛、施工切片与“当前核验”保留施工前记录；最终合同、验证结果和后续边界见“实施收尾与证据”。

## 目标

使 Scene 的玩家可见标题、说明、状态名称和必要参与者 / 事实 / 物品名称来源于作者内容及现有只读 OperationView。更新内容并重新载入后，Operation UI 能显示新文案，不需要按 Event、Location 或 Action ID 修改 UI 源码。

本 Task 覆盖 G03“作者控制微型 Scene 表现”的部分；不构建独立 Narrative 引擎，也不把规则效果藏入文案字段。

## 设计边界

- 本 Task 包含：核定 Scene 表现的最小字段来源；在正式 gameplay-b@1.0.0 内容样例中填入 Scene 标题 / 描述 / 状态名称和必要的参与者、事实、物品呈现；由只读 View 投影并由 Operation workspace 消费。
- 明确非目标：大型对话系统、Localization 工具、重写全局 Entity presentation、地点专用 UI 分支、Schema Editor 可视化 Scene 编辑器。
- 已裁定来源：draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md。字段放在 SceneDef、独立 presentation 表或复用稳定既有定义都未裁定，不得直接选择其一施工。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Actor 有 detached 展示名 / 头像；Action 有 title / description；SceneAction 和 PlayerSceneCard 有可覆盖的标题 / 描述。 | src/data-services/contracts/operation.ts：OperationActorDef、OperationActionDef、OperationSceneActionDef、OperationPlayerSceneCardDef；src/arona-clicker/services/operation-view-projector.ts：projectActor、projectSceneActions、projectPlayerCards。 | 可复用已存在的作者文案，不对其创建 Scene 私有副本。 |
| OperationView 投影行动、SceneAction 和玩家卡文案与 Objective / Outcome 描述。 | src/arona-clicker/contracts/operation-view.ts：OperationViewActionOption、OperationViewSceneAction、OperationViewSceneCard、OperationViewObjectiveProgress；src/arona-clicker/services/operation-view-projector.ts：projectOperationView。 | 新 Scene view 可以沿用 UI-safe projection 边界，不能把 UI 直接连到冻结 Registry 规则。 |
| Event factIds / itemIds 是允许列表；运行态和 View 以 knownFactIds / heldItemIds 字符串 ID 表达，没有独立事实 / 物品名称字典。 | src/data-services/contracts/operation.ts：OperationEventContentDef；src/arona-clicker/contracts/operation-view.ts：OperationView.knownFactIds / heldItemIds；src/arona-clicker/services/operation-view-projector.ts：projectOperationView。 | 路线图要求可读事实 / 物品名称，但当前并不存在通用名字投影；由人类决定 Scene 自带提示还是增设可复用内容定义。 |
| Scene 状态名与 Scene 文案目前不存在，因为没有 Scene 定义或 Scene 状态。 | src/data-services/contracts/operation.ts：OperationEventContentDef / OperationLocationDef；src/arona-clicker/contracts/operation.ts：EventRun；GALHCG source search SceneRuntime / sceneInstanceId complete 无命中。 | 先完成 Task 0263 的身份及状态裁定，方能确认状态显示和值源。 |
| 内容进入 Registry 的现有 Operation arrays 包含事件、地点、Actions、StudentOperationProfiles、StrategyProfiles、CardPools；Registry 有关引用校验。 | src/data-services/contracts/datapack.ts：Datapack.Operation 字段；src/data-services/registry/operation-content-validation.ts：validateOperationContent、checkLocationShape、checkEvent。 | 若新增 author field / table，更新源合同、引用校验和 Schema；不能只在 sample TS 做例外。 |
| Gameplay B 正式可选 bundle 与 src/data/test-datapack.ts 的职责不同。 | AGENTS.md；src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts；tests/engine/gameplay-b-authoring-workflow.test.ts。 | 可点击的最终展示验收以正式可选 bundle 内容为准，不能只改测试 fixture。 |

## 架构裁定门槛

在新增字段前，由人类或负责 0263 的架构裁定明确：

- Scene presentation 挂在何种稳定内容 owner 下，是否按 locale 提供多个版本。
- 标题、说明、状态名是否是 Scene 内容本体还是独立表现引用；UI 应显示 Scene 状态名还是仅将状态 enum 翻译为作者标签。
- 参与者 / 事实 / 物品的名称是复用 Actor、Action 与现有游戏实体信息，还是通过 Scene 范围的 label 给出；不得无意把 Event 的 ID allow-list 变成全局事实/物品实体系统。
- fallback 和缺字段校验规则；不允许 UI 写事件 ID 特判补文案。

## 施工切片

### P0：字段来源与验证边界

- 将 P0 结论记录到 Draft；按 schema-sync 核定源类型、Registry 引用校验、独立 editor schema 与复杂表元数据的影响。
- 如新增源契约字段，生成 schema 文件只能用 npm run gen:schema，不直接编辑生成结果。

### P1：内容投影及可见样例

- 将已裁定表现信息传入 detached OperationView；Operation workspace 只读取 View。
- 更新正式 bundle 的原子场景示例，修改示例标题 / 描述 / 状态名后重新载入，确认 UI 依内容显示。
- 只在稳定机制实现后更新 docs/docs-829 当前机制文档；Planning 本身不改机制页。

## 测试与验收

- [x] Registry / content validation validates nested Scene structure and references; schema was generated from source contracts.
- [x] View / UI behavior test asserts the formal bundle's Scene title, description, and generic active/completed status text without Event/Location ID copy branches.
- [x] **Clickable content case**: the Operation Registry entry is clicked in the UI test; the displayed Event and Scene copy comes through Registry → OperationView → generic workspace rendering. Arbitrary editor text editing/reload was intentionally left to G05 authoring UX.

## 施工前核验记录（2026-10-08）

- 核对 Datapack、Operation 内容契约、Registry validation、OperationView projector、正式 Gameplay B bundle 与 authoring / UI 相关测试。
- 当前 OperationView 中可见事实 / 物品为 ID；没有 Scene 状态名合同。Roadmap 文案目标尚非实现事实。
- 未修改源码、测试、Schema 或机制文档；未运行测试 / 类型检查。

## 施工前 GALHCG 检索记录

- 发现路径：项目 acprogram；查询 Operation View Projection 及 Operation EventRun 概念后直接查看映射路径源码、测试和机制文档；Scene 表现概念未命中时扩至内容源类型与 OperationView。
- 变更审查：本 Task 仅新增规划文件，无实现路径 review_changes。
- 地图维护：提案未引入已实现内容，不将 Roadmap 表现合同写入 implementation maps_to。

## 实施收尾与证据（2026-10-08）

- `OperationSceneDef` stores `title` / `description` inline with nested Location content. `OperationViewScene` carries detached copy and a derived `ready | active | completed` status; the workspace maps these stable statuses to generic labels (`待开始` / `进行中` / `已完成`).
- The formal `gameplay-b@1.0.0` bundle now contains “原子场景演示”, with two declared students, one environment participant, and one actorless remote-stop SceneCard. UI behavior tests verify the Event card copy, Scene title/description/status, actorless hand status and activation copy, and the same Location remaining in progress after SceneAction commit.
- Track/Fact/Item display remains under the existing Event-local presentation mapping contract from PB-04; this Scene demo has no Fact or Item names to invent. No global presentation Registry or Narrative engine was added.
- The literal pre-ruling proposal to modify source content in an editor and reload in-browser is deferred to PB-25 / G05; G03 verifies the source-to-Registry-to-View-to-UI data path with no ID-specific rendering.

## 后续边界（G05）

- Datapack Editor authoring and live content editing/reload remain PB-25 scope; G03 adds the Runtime contract and a formal bundle sample only.

## 相关路由

draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md · [[docs/ai/context-packs/datapack-schema]] · [[docs/docs-829/05-conventions/schema-sync]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/05-conventions/testing]]
