# Draft：Gameplay B 原子场景阶段 V——作者交付

状态：completed — 阶段 V 的作者链路与旧 UI 特判回归已由 PB-25/PB-26 实施并验收；本 Draft 保留为设计来源。
> Goal Owner 统一裁定（2026-10-08）：本阶段适用的 PB 默认合同与升级条件见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；本 Draft 中相同主题的早期“待裁定”记录保留为讨论历史，不再阻塞已定默认规则。

## 目标与最终方向

独立 Datapack Editor 能编辑最终 Scene 内容合同、保留作者数据、输出运行时可导入的包；作者加载包后能从通用 Operation 入口点击进入并完成场景。迁移内容不再依赖旋转木马专用阶段判断、文案回退或重复选择器。Strategy Park 的专属全地图版式继续存在。

阶段 V 消费 G03/G04 最终确定的源数据模型，不在编辑器里另建一份场景模型。普通 Operation UI 只消费只读 View/表现投影并经 Controller 发出命令；Registry 对可组合的包内容作权威引用校验。

## 本阶段玩法语义与边界

- 已裁定：PB-25 的验收必须闭合“无 TypeScript 作者输入 → 编辑/验证 → 保存或导出 → 导入 PackManager → 应用并 reload → 点击 Operation 启动 → 场景完成”的实际链路。只有 Schema 出现字段不算作者交付。
- 已裁定：PB-25 先消费 G03/G04 的最终 Scene 字段；字段应表达参与者、行动来源、目标规则、Cost、完成条件和后续 Scene，并复用已存在的 Operation Action、目标与结算语义。
- 已裁定：Schema 源契约、Registry 和内容校验是运行事实；生成的 Schema 是派生编辑协议；TableKey / TABLE_META 与编辑器 CRUD 才决定字段是否实际可编辑。
- 已裁定：独立 Datapack Editor 与游戏内 Runtime Editor 是两个入口。ContentAuthoringPolicy 目前不承载 Operation CRUD；不以扩充该策略清单代替独立编辑器表单。
- 已裁定：PB-26 只在相关内容迁移后删除无消费者的 Carousel 阶段/表现分支；Strategy Park 全地图是有测试保护的内容专属表现，仍需可见。
- 明确暂缓：可视化 Scene 画布、Event 阵容编辑器、万能 SceneManager、运行规则迁移兼容层。

## 施工前事实与方案核对

| 问题 | 已核实依据 | 对方案/验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| 当前 Operation 数据契约和 Registry 有几张正式表？是否已经有原子 Scene 表？ | src/data-services/contracts/datapack.ts 的 operationEvents、operationLocations、operationActions、studentOperationProfiles、operationStrategyProfiles、operationCardPools 六个可选表；src/data-services/registry/registry.ts 有六个对应 Map、merge 与 getter。src/data-services/contracts/operation.ts 当前有 OperationLocationDef、OperationSceneActionDef 等，但没有 OperationSceneDef 或 scene Registry 表；Location 仍持有 actionMode、sceneActions、sceneActionBatches、Location 目标/结局和 routeEdges。interactionSceneId 与 OperationCardConditionDef.sceneIds 是既有的有限交互/候选筛选值，不等同于独立 Scene 身份或生命周期。当前权威说明见 [[docs/docs-829/03-data-structures/datapack-contracts]] 与 [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]。 | 现有六表是 PB-25 的编辑基线，不代表最终 Scene 仍须嵌套 Location；新字段必须先来自 G03/G04 冻结后的源契约。 | 已核实 |
| 生成 Schema 是否意味着独立编辑器已经开放 Operation 表？ | scripts/gen-engine-schema.mjs 从 Datapack 契约生成 tools/datapack-editor/schema/engine-defs.gen.json；生成文件当前含六个 Operation 顶层表及字段。tools/datapack-editor/schema/types.ts 的 TableKey 未列这些表；editor-extras.ts 的 TABLE_META 也不含这些表；schema/merge.ts 的 buildTables 只遍历 TABLE_META，datapack.schema.ts 的 TABLES 因而没有 Operation CRUD 页。 | 必须补 TableKey、TABLE_META、字段表单/引用语义和真实 CRUD，而不能只运行 npm run gen:schema。禁止手改 engine-defs.gen.json。 | 已核实 |
| 当前编辑器会否保留未开放的 Operation 表？ | tools/datapack-editor/model/editor-model.ts 的 loadDatapack() 和 toDatapack() 均只遍历 TABLES；tools/datapack-editor/ui/io.ts 当前提供 JSON 文件/剪贴板导入与 JSON 下载。未纳入 TABLES 的 Operation 顶层数据导入后不会进入编辑模型，导出也不会带回。 | PB-25 要有无损 round-trip，并提供 PackManager 实际接受的导入包格式；只加导航按钮或示例 fixture 不够。 | 已核实 |
| 运行时包加载、引用校验和 reload 的既有边界是什么？ | src/data-services/datapack/pack-parser.ts 要求根 datapack.json manifest 与 JSON fragments；src/arona-clicker/runtime.ts 的 validatePackConfiguration() 建立候选集校验，applyPackConfiguration() 在验证通过后委托 PackManager 应用并 reload。Registry 的 operation-content-validation.ts 校验 Event/Location/Action/Profile/CardPool 之间以及 Event 内的完整引用；例如 Location route target、SceneAction.actionId、Event.locationIds、participant/profile 引用都有带字段路径的诊断。当前说明见 [[docs/docs-829/06-wiki/20-data-services/definition-authoring]]。 | PB-25 的错误引用应在编辑器侧指出本包内问题，并通过实际 PackManager 预检覆盖跨包/Registry 规则；校验失败不得 reload 或部分替换 Registry。 | 已核实 |
| 是否已有 authoring workflow 测试可复用？ | tests/engine/gameplay-b-authoring-workflow.test.ts 通过手工 ParsedPack 验证 Operation 引用失败、字段路径、候选包应用/reload 及不兼容 resumeVersion；当前不覆盖独立 Datapack Editor、包导出 UI 或通用 Operation 事件入口。 | 保留该 Runtime 回归，并增加编辑器 Schema/CRUD/导出/导入与真正可点击游玩覆盖。不能把现有测试写成独立编辑器已支持。 | 已核实 |
| resumeVersion 与存档变更如何处理？ | OperationEventContentDef 有作者维护的 resumeVersion；operation-entry-service.ts 恢复时比对当前定义，版本不一致返回 content-version-mismatch。tests/engine/gameplay-b-save-resume.test.ts 和 gameplay-b-authoring-workflow.test.ts 覆盖拒绝旧 Run；无内容 Hash 或迁移层。项目策略要求破坏性状态变更后清档，不写迁移。 | 若 Scene 内容变化让已有 checkpoint 不兼容，任务应升级对应 Event 的 resumeVersion，验证旧 checkpoint 被拒绝并按策略清档；不要静默搬迁 Run。 | 已核实 |
| 当前游戏 UI 是否能启动作者新增的 Event？ | src/ui/components/center-panel.ts 的 renderOperationEntry() 目前硬编码 Carousel 与 Strategy Park 两个 Event ID/入口文案；OperationEntry.start(eventId, roster) 接受 ID，但没有可供普通界面枚举作者 Event 的通用列表。组件读写边界由 [[docs/docs-829/06-wiki/50-ui/read-model-context]] 与 [[docs/docs-829/06-wiki/50-ui/controller-commands]] 约束。 | PB-25 必须添加最小数据驱动入口/只读摘要，使新包 Event 可点击启动；UI 不按新 Event ID 写分支。阵容选择器不属于此次范围。 | 已核实 |
| 哪些旧 UI 特判应在 PB-26 处理，哪些表现必须留下？ | src/ui/components/operation-workspace.ts 仍读 Carousel IDs / presentation 并按旧 Location、Fact、Item IDs 推断战斗、标题和展示名称；center-panel.ts 有 Carousel 示例卡片。相对地，operationMapPresentation() 按 Strategy Park Event 选择专属地图；tests/ui/gameplay-b-strategy-park-map.test.ts 覆盖 13 地点、路线状态和 Carousel 不显示该地图。 | 内容迁移完毕后删除旧 Carousel 通用阶段/文案回退，保留 Carousel 作为普通内容样例；保留 Strategy Park 专属地图 renderer、地图数据及其交互回归。 | 已核实 |
| 粘贴的 Roadmap 图像/SVG 资源是否可用？ | 附件正文中可见的是 Google favicon URL 和 “GitHub +1/+2” 引用碎片，没有 SVG markup、二进制图像或可恢复的原始流程图载荷。可核验的阶段顺序和验收文字仍完整。 | 规划只依据可读文字，不从引用噪声推断额外规则或 UI。 | 已核实（输入内容） |

## 裁定记录

| 待裁定问题 | SolChat 建议 | 本项目决定 | 依据/待验证项 |
| --- | --- | --- | --- |
| PB-25 是否仅补 Schema 字段即可？ | 形成最小可用的场景创作与验证入口。 | 修改为完整作者链路：源契约/生成 Schema/编辑表和 CRUD/校验/可导入包/通用可点击 Operation 启动。 | 当前 TableKey/TABLE_META 与 EditorModel 会排除 Operation 数据；Editor 的 JSON 下载不是包解析器要求的 manifest+fragments。 |
| PB-25 是否复用 ContentAuthoringPolicy？ | Roadmap 要求独立 Datapack Editor。 | 不复用 Runtime Editor 的策略 CRUD；以独立工具的 Schema、EditorModel 和 validate 为作者表单入口，PackManager/Registry 仍负责运行时权威验证。 | [[docs/docs-829/06-wiki/20-data-services/definition-authoring]] 说明六张 Operation 表不在策略 CRUD 中。 |
| 如何提供作者 Event 的可点击入口？ | Roadmap 要求在 Operation 中游玩。 | 加最小数据驱动 Event 列表和启动卡片，消费只读 Runtime 查询与 Controller 命令；固定当前可用阵容策略，不增加阵容编辑器。 | 当前 center-panel 只列两个样例 Event。若最终 View 尚未提供标题/说明，则由上游稳定的内容表现字段承载，不在 UI 按 ID 补字。 |
| Scene 的具体顶层/嵌套形状是什么？ | 新 Scene 应声明参与者、操作、完成与后续内容。 | 本 Draft 不选择独立表或嵌套字段；在 PB-25 开始前，PB-13～PB-24 必须把唯一源契约冻结。PB-25 只同步该契约。 | 当前源代码不存在原子 OperationSceneDef；Goal Set 与 G03/G04 约束保留上游裁定。 |
| 旧存档如何兼容新 Scene 状态？ | Roadmap 明确破坏性状态变更后清档，不做迁移。 | 不做迁移或旧字段回退；不兼容的 Event 内容递增 resumeVersion 并拒绝旧 checkpoint，按项目清档策略完成变更。 | operation-runtime.md 与 tests/engine/gameplay-b-save-resume.test.ts。 |

## Draft → Task 准入

- [x] 语义和明确非目标已裁定；UI 可点击游玩与 Strategy Park 地图保留写入验收。
- [x] 会改变方案的当前事实已核对；最终 Scene 字段必须由 G03/G04 冻结后才能接入编辑器。
- [x] PB-25 与 PB-26 有独立完成定义、顺序和上游依赖。
- [x] 施工 Read Set、Schema 命令、Registry 校验和浏览器 Operation 验收已明确。
- [x] 阶段 V 完成后仍需由内容作者实际持续制作；更大编辑器画布与阵容选择器仍未完成且不属于本 Goal。

## 完成记录（2026-10-08）

- PB-19～PB-24 的 Location 内 Scene 合同和真实内容迁移已在上游完成；PB-25 已将六张 Operation 表接入 Datapack Editor 的 CRUD/Schema/校验/ZIP 出口，并以 EditorModel → PackParser → PackManager → apply/reload → 通用 Event 启动集成测试核验。
- PB-25 浏览器验收编辑了两名学生、三个可选行动的作者样例；运行时使用同一 `createDatapackPackage()` 导出面，经隔离 PackManager 来源应用、reload、通用入口启动、完成 M-of-N 场景批次和后续复核 Scene。CUA 未暴露浏览器下载文件捕获；具体替代证据和边界记在归档 Task。
- PB-26 移除 Carousel 的 Event 标题/说明 Presentation fallback 和无用 ID import；经证据审查保留仍无通用 View/内容替代的轨道、Fact、Item、Location 与行动表现映射，并完整保留 Strategy Park 专属地图。
- 浏览器实际完成 Carousel 成功结案；Strategy Park 实际显示 13 地点地图，完成线索/凭证行动、服务亭分支路线、镜面迷宫探索与碰碰车战斗一轮。完整经典路线与凭证分支由固定 seed 虚拟游玩回归覆盖。
- PB-25 13 个测试文件 / 102 项通过；PB-26 14 个测试文件 / 149 项通过；类型检查、文档链接/结构、架构依赖检查和差异空白检查均通过。`gameplay-b-event-runtime-integration.test.ts` 的 7 个基线失败有独立证据并保留原断言，不属于本阶段新增失败。
- 编辑器视觉节点画布、阵容选择器和通用 Narrative 仍属明确暂缓项，不作为 G05 未完成条件。

## Read Set 与机制入口

- Datapack / Schema：[[docs/ai/context-packs/datapack-schema]]、[[docs/docs-829/05-conventions/schema-sync]]、[[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/docs-829/06-wiki/60-engineering-support/schema-editor]]
- Operation / Registry / authoring：[[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]、[[docs/docs-829/06-wiki/20-data-services/definition-authoring]]、[[docs/docs-829/03-data-structures/registry]]
- Independent Editor：[[docs/docs-829/02-modules/datapack-editor]]、tools/datapack-editor/schema、tools/datapack-editor/model、tools/datapack-editor/validate、tools/datapack-editor/ui
- UI：[[docs/ai/context-packs/ui-presentation]]、[[docs/docs-829/02-modules/ui]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]、[[docs/docs-829/06-wiki/50-ui/controller-commands]]、[[docs/docs-829/05-conventions/architecture-discipline]]
- Validation reference: tests/engine/gameplay-b-authoring-workflow.test.ts; tests/engine/gameplay-b-save-resume.test.ts; tools/datapack-editor/schema/engine-schema.sync.test.ts; tests/ui/gameplay-b-operation-controller.test.ts; tests/ui/gameplay-b-strategy-park-map.test.ts

## GALHCG 只读发现

- 项目绑定：resolve_project 使用工作区绝对路径，返回 project_id=acprogram，workspace_path 与 root_path 均匹配本仓库。
- 查询：overview 导航到 domain-operation、datapack-editor；lookup 查询 Scene、SceneDef、Operation、Datapack Editor，其中 SceneDef 无命中，Datapack Editor 命中独立 Editor 概念。search(path) 精确查 operation-content-validation 与 editor-extras；search(source) 查 operationEvents、sceneActions、resumeVersion、TABLE_META 与 ContentAuthoringPolicy，并将候选回到源码、测试和当前机制文档核对。较宽的 Operation 路径搜索受结果上限截断，随后已按文件名和目录缩小查询。
- 结论：地图仅作发现导航；本 Draft/Task 不声称地图候选是实现依据。此代理没有写 GALHCG；地图写入待主代理汇总。
- 核验范围：只读发现，不更新 freshness、Evidence、maps_to 或项目文件清单。
