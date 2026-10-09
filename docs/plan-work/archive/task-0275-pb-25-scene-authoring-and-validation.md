# Task：PB-25 场景创作与验证入口

状态：completed — Editor 作者闭环、Runtime 包验证与实际 Operation 游玩验收完成（2026-10-08）。
> Goal Owner 统一裁定（2026-10-08）：PB-25 的当前施工默认规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；其中规则覆盖本 Task 在该裁定前写成“待定 / 待确认”的历史措辞。仅符合总裁定列出的升级条件时暂停。

## 目标

让内容作者在独立 Datapack Editor 中创建最终 Operation Scene 内容，无需 TypeScript；保存/导出后能导入常规 PackManager 内容包、通过 Registry 校验，并从通用 Operation 入口点击启动及游玩。此 Task 覆盖路线图 PB-25，是 G05 的作者创作部分；它不重新设计 G03/G04 已确立的 Scene Runtime。

## 设计边界

- 包含：将上游冻结的 Scene 字段映射到唯一 Datapack 源契约与 Registry 消费面；同步生成 Schema；在独立编辑器开放实际 CRUD、引用导航与错误呈现；保证编辑器数据导入/导出无损并能形成 PackManager 可读包；提供最小数据驱动 Event 启动入口；以两学生、三个可选 Action 的场景完成人工点击验收。
- Scene 字段面至少覆盖：参与者、Action 来源/引用、目标规则、Scene 和 Action 的 Cost、完成条件、后续 Scene。字段的宿主、可选性和引用范围沿用 PB-13～PB-24 已冻结合同。
- 操作效果、目标过滤、合法性与结算仍由已有 Operation Action / Runtime / Registry 管理；编辑器只产生数据，不实现第二套规则或 Effect。
- 跨表校验分两层：编辑器根据独立 Schema 对本包内 ID/字段给出可导航诊断；Registry 对实际启用包集合做权威引用校验。校验错误必须指向具体数组/字段路径和缺失 ID。
- 运行时包应用通过 PackManager 现有验证与 reload。内容校验失败不得 reload 或部分覆盖 Registry；成功后新 Run 必须从当前 Registry 使用新内容。
- Operation 事件启动卡必须读取只读 Runtime/View 摘要并由 Controller 发命令，不由组件直接读 Registry 写状态，也不按事件 ID 维护专用分支。最小入口可沿用当前固定出动阵容策略；不新增阵容编辑器。
- 如需新增 Operation 表/字段，源契约必须是 PB-13～PB-24 已裁定模型的唯一实现；若该模型仍未冻结，停止并退回 Draft，不另建并行 SceneDef。
- 明确非目标：可视化 Scene 节点画布、通用作者 CLI、把 Operation 改入 ContentAuthoringPolicy、修改 Operation 结算算法、重做角色阵容选择、PB-26 的旧分支清理。
- 已裁定来源：draft-0255-gameplay-b-atomic-scenes-phase-v-authoring；Operation/Scene 合同裁定由阶段 III/IV Task 承担。

## 责任归属

- 数据服务/Engine 契约：Datapack 源类型与唯一 Schema 输入；Registry 对实际加载内容负责验证和索引。
- 独立 Datapack Editor：TableKey、TABLE_META、字段表单、EditorModel CRUD、文件导入/导出、编辑侧引用校验。该路径在 tools/datapack-editor/，不同于游戏内 Runtime Editor。
- PackManager / Runtime：候选启用集验证、应用和 reload；不由独立编辑器自行写 Registry。
- Operation Runtime / ReadModel：运行事件与生成作者可启动的只读入口摘要；Controller 将点击启动请求交给窄 Runtime 命令。
- Operation UI：消费只读投影和内容表现，不按新 Event/Scene ID 计算阶段、资格、目标、费用或结果。

## 施工前基线与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 现有 Datapack/Registry 有六张 Operation 内容表：Events、Locations、Actions、StudentOperationProfiles、StrategyProfiles、CardPools。当前 Operation 源合同包含 Location/SceneAction，但没有独立 OperationSceneDef/Registry 表。 | src/data-services/contracts/datapack.ts；src/data-services/contracts/operation.ts；src/data-services/registry/registry.ts；src/data-services/registry/operation-content-validation.ts；[[docs/docs-829/03-data-structures/datapack-contracts]] | 先核对阶段 IV 的最终 Scene 合同；六张既有表不能被误报为新 Scene 已可编辑。 |
| generator 输出包含六张 Operation 表字段；但 TableKey 未列 Operation，TABLE_META 未配置这些表，buildTables 仅从 TABLE_META 创建最终 TABLES。当前 engine-schema.sync.test.ts 对 Operation 生成 Schema 的专门断言只覆盖其中四张表。 | scripts/gen-engine-schema.mjs；tools/datapack-editor/schema/engine-defs.gen.json；tools/datapack-editor/schema/types.ts；tools/datapack-editor/schema/editor-extras.ts；tools/datapack-editor/schema/merge.ts；tools/datapack-editor/schema/engine-schema.sync.test.ts | 更新源字段后运行 npm run gen:schema；补齐 TableKey/TABLE_META/引用目标并将 Schema 同步断言覆盖全部六张既有表及最终 Scene 表/字段。生成 JSON 禁止手改。 |
| EditorModel 加载/导出只遍历 TABLES；独立 Editor 的当前 I/O 是单个 Datapack JSON / 剪贴板，而运行时包解析要求根 datapack.json manifest 与 JSON fragments。 | tools/datapack-editor/model/editor-model.ts；tools/datapack-editor/ui/io.ts；src/data-services/datapack/pack-parser.ts；src/data-services/datapack/zip-loader.ts | 扩充 Schema 的同时保证未知/新增 Operation 内容不会在 round-trip 丢失；输出要经过既有 PackManager 可识别的包格式或已有 Folder/ZIP Source，测试真实导入。 |
| Operation 引用由 Registry 在候选包集上验证；正式 apply 先 validatePackConfiguration，成功才应用并 reload。现有 authoring workflow 测试通过手工 ParsedPack 验证无效 route 引用路径、拒绝 apply、不替换 Runtime 及成功 reload。 | src/arona-clicker/runtime.ts；src/data-services/registry/registry-validate.ts；src/data-services/registry/operation-content-validation.ts；tests/engine/gameplay-b-authoring-workflow.test.ts；[[docs/docs-829/06-wiki/20-data-services/definition-authoring]] | 新 Scene 引用必须扩展 Registry 验证并返回确切路径；保留现有跨包验证，不把编辑器本地引用检查当作替代。现有测试不证明独立编辑器或包 I/O 已完成。 |
| ContentAuthoringPolicy 的当前授权清单只有 Init、Area、Spot、Enhancement；Operation 六表不属于游戏内 Runtime Editor 的 CRUD。 | src/data-services/authoring/content-policies.ts；[[docs/docs-829/06-wiki/20-data-services/definition-authoring]] | 只在独立 Datapack Editor 实现本 Task 的编辑能力，避免混淆两个写入通道。 |
| 当前 Operation 入口固定列出 Carousel 与 Strategy Park；OperationEntry.start() 可按事件 ID 启动，但 UI 没有通用作者事件列表。 | src/ui/components/center-panel.ts；src/ui/controller-actions-operation.ts；src/arona-clicker/contracts/operation-view.ts | 增加按当前世界线/可用条件展示的最小数据驱动列表，并允许点击启动作者事件；不增加事件专属 UI 条件。 |
| Operation Event 明确保存作者维护的 resumeVersion；旧 checkpoint 与当前值不符会以 content-version-mismatch 拒绝恢复。 | src/data-services/contracts/operation.ts；src/arona-clicker/services/operation-entry-service.ts；tests/engine/gameplay-b-save-resume.test.ts；tests/engine/gameplay-b-authoring-workflow.test.ts | Scene 内容导致 Run 不兼容时升级对应事件版本；不得增加旧存档转换或隐式降级逻辑。 |

## 施工切片

### P0：对齐唯一 Scene 源契约

- 消费 PB-13～PB-24 已冻结的 Scene 作者字段；将其纳入 Datapack/Registry 真正加载的数据路径，并维护面向作者的字段说明。
- 复用已有 Operation Action、Participant、目标/费用/完成规则；实现作者需要的稳定 ID 引用及引用校验。
- 如果上游没有明确最终宿主或状态/存档含义，停止本 Task 并回到 Draft 裁定；不在这里自行选择嵌套/独立 Registry。

### P1：接入独立编辑器真实 CRUD

- 扩充 TableKey、TABLE_META、EditorModel 和 Schema FieldDef，让作者可新增、编辑、复制、删除最终 Scene 表/字段。
- 为参与者、Action、目标、费用、完成条件和下一 Scene 配置编辑器表单及引用选择；复杂嵌套字段必须显式定义 editor-extras 元数据。
- 修复导入/导出的数据保留面，使新旧 Operation 顶层数据按实际 Schema 无损往返；不能用忽略未知字段的方式静默丢弃表。
- 更新 Schema 同步测试的 6 表契约清单，并覆盖最终 Scene 表、引用目标及字段从生成协议进入最终 TABLES。

### P2：闭合可加载包与验证错误

- 提供从独立编辑器保存/导出到现有运行包解析/导入的最小实际路径；manifest、Datapack fragments 和包元数据满足 PackParser/PackManager 约束。
- 编辑器错误面板提供可点击的字段路径；Registry 预检错误提供确切 ID/路径。无效包应用前保持旧 Runtime/Registry 和当前可见内容不变。
- 新字段的引用错误至少覆盖缺失 Action、Scene/Location、参与者、目标 ID 与后续 Scene；范围和所有权跟随阶段 III/IV 契约。

### P3：提供通用 Operation 启动卡并点击游玩

- 以只读 Runtime/Operation 投影列出当前可启动 Event 的标题、说明、准入结果与理由；组件通过 Controller 命令启动，不把 Event ID 列表写死到界面。
- 创建一个两名学生参与、三个可选 Action 的真实作者样例；作者经独立编辑器完成字段编辑、保存/导入、应用，返回办公室点击该 Event，再在 Operation 中点击行动/目标、预览费用并提交，直到场景完成或进入声明的下一 Scene。
- 用户无效引用后在编辑器或包预检中看到路径诊断；修正并重新导入后可游玩。

## 测试与验收

- [x] Schema 源类型变更后运行 `npm run gen:schema`；生成文件由生成命令更新。
- [x] Schema 同步、Schema 表单、EditorModel、I/O、导航与 Operation 引用校验定向测试通过；覆盖六张 Operation 表与 Location 内 Scene 字段。
- [x] Runtime authoring workflow 与 Save/Resume 定向测试通过，覆盖错误包不替换 Runtime、验证后 apply/reload 与 `resumeVersion` 行为。
- [x] 新增 Editor → ZIP → PackParser → PackManager 验证/apply/reload → 通用 Event 启动集成测试；另有真实 PackManager 流程回归。
- [x] UI Controller / Registry 入口测试通过；组件读取只读 Operation View，启动命令经 Controller。
- [x] 人工浏览器验收：独立 Datapack Editor 完成样例导入、结构化 Scene 标题编辑、角色 ID 与依赖修正，界面校验显示通过；运行时加载该包，从通用 Event 卡启动两名学生的作者样例，完成 exact 2-of-3 批次并进入后续 Scene，提交复核行动并结束流程。
- [x] `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与 `git diff --check` 于 2026-10-08 最终文档收尾后通过。

### 实际结果与浏览器限制（2026-10-08）

- 定向验证：13 个测试文件、102 项测试通过；详见下方 GALHCG/最终核验记录中的命令范围。
- 精确命令：`npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts tools/datapack-editor/schema/datapack.schema.test.ts tools/datapack-editor/model/editor-model.test.ts tools/datapack-editor/ui/io.test.ts tools/datapack-editor/ui/navi.test.ts tools/datapack-editor/validate/operation-authoring.test.ts tools/datapack-editor/validate/extra.test.ts tests/data/pack-parser.test.ts tests/engine/gameplay-b-editor-authoring-workflow.test.ts tests/engine/gameplay-b-authoring-workflow.test.ts tests/engine/gameplay-b-save-resume.test.ts tests/ui/gameplay-b-operation-controller.test.ts tests/ui/gameplay-b-operation-entry-registry.test.ts --reporter=dot --silent`。
- 浏览器视口为本机 In-app Browser 默认视口（1280×720）。Editor 界面上的 ZIP 导出已触发，但当前 CUA 浏览器接口没有提供下载文件落盘捕获能力，因此无法把该次浏览器下载文件重新选入 Editor；实际运行时包由同一份 Editor 编辑数据调用同一个 `createDatapackPackage()` 出口生成，经 `parsePackFromZipBuffer()` 核验后放入隔离的 `datapack-dev` 来源，再通过 PackManager 启用、验证、应用并 reload。自动化集成测试完整覆盖 EditorModel → ZIP → PackParser → PackManager → 通用 Event 启动。故浏览器实际点击链已验证到 Editor 校验和 Runtime 完整游玩，下载 UI 的文件捕获由可执行的同出口构包及自动化往返测试补足。
- 本轮重跑的独立编辑器校验用例有一个过时最小 fixture，因 Operation 必填字段已严格进入 Schema 而失败；现已补齐合法最小 Event/Location/Action，仅保留三段式连字符 ID 的断言，10 项测试通过。

## 完成核验（2026-10-08）

- 六张 Operation 表已进入独立 Editor 的表模型、CRUD、导航与导出；Location 内 `scenes` 使用既定唯一 Operation 合同，无平行 Scene Registry。
- Editor 可导出 PackParser 可识别的 manifest + fragments ZIP；候选包验证通过后应用并 reload，Operation 入口从只读 Runtime 投影读取作者 Event 标题/说明与准入结果，并经 Controller 启动。
- 浏览器验收使用隔离本地来源 `127.0.0.1:5177`（Editor）与 `127.0.0.1:5178`（Runtime），未操作用户正式存档源。Editor 导出下载事件未能从 CUA 接口落盘读取，限制及替代证据见上文。
- `tests/engine/gameplay-b-event-runtime-integration.test.ts` 的 7 项失败已在本轮开始前于 detached HEAD 基线复现，属于既存断言/实现差异；本 Task 未弱化或改写这些断言。其余 PB25 定向集合 13 文件、102 项通过。

## 已关闭的裁定与范围条件

- PB-13～PB-24 已冻结并实现唯一 Scene 宿主、字段及持久化语义；本 Task 沿用 Location 内的 `scenes` 合同，没有添加并行 Scene Registry。
- 通用 Event 启动字段已由 Runtime/View 内容投影提供；center-panel 不再按 Event ID 回退标题或说明。
- Editor ZIP 导出已由 PackParser/PackManager 验证并用于实际 Runtime 游玩；浏览器下载文件无法由当前 CUA 接口落盘读取的限制及替代证据见上文。
- 本 Task 按 G05 白名单完成；存档结构和迁移层未变更。

## GALHCG 影响闭环

- 项目身份：通过绝对路径 `C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram` 解析并核对 `project_id=acprogram`、`root_path` 与工作区一致。
- 调查范围：按 PB-25 实际实现复核独立 Editor 的 Model、Schema、UI、I/O 与 Validator，Operation Event launch projection、Registry/PackParser 工作流，以及四份 `docs/docs-829/` 当前机制文档；对每个精确路径检查 `review_changes` 的文件分页与 owner 分页。四份当前机制文档的已有映射均显示 Evidence unchanged，因此未重复写入。
- 新增文件：定向刷新 `tools/datapack-editor/validate/operation-authoring.test.ts` 与 `tests/engine/gameplay-b-editor-authoring-workflow.test.ts` 所在目录的精确 include，随后 `resolve_paths` 均返回已索引 File。两者分别映射到 Datapack Editor UI 测试，以及 Editor UI、Package I/O、Operation 内容校验和通用 Event Runtime 的端到端测试。
- 文档追溯：归档 Task 文件以 `documentation` role 连到主要职责 Concept 及 Goal/Task 工作流 Concept；记录完成事实，不单独作为当前实现的证据。
- 路径迁移：地图搜索最初同时返回归档路径和已不存在的 `docs/plan-work/` 根路径同名 File。对两个旧路径的 `review_changes` 均发现 `missing`，且各自只有 Goal/Task 工作流的 documentation `maps_to`。确认 archive File 可解析且拿到新 Evidence 后，将两条关系迁到归档路径；随后精确刷新旧/新路径，`removed_entry_count=2`，旧路径 `resolve_paths` 现为 `not_found`，文件名搜索各只返回归档 File。
- 精确范围：PB-25 有 19 个直接源码/测试路径，PB-26 有 7 个，`controller-actions-operation.ts` 与 `gameplay-b-operation-controller.test.ts` 两者共享，合计 24 个唯一源码/测试路径；另对两份归档 Task 与四份受影响 `docs/docs-829/` 当前机制文档逐路径运行 `review_changes`，总计 30 个直接复核路径。四份机制文档的映射 Evidence 全部 unchanged，没有重复写入。为保全节点完整 Evidence 集，节点 upsert 另预览了 6 个 unchanged 支撑文件。
- 新文件与身份：`tools/datapack-editor/validate/operation-authoring.test.ts`、`tests/engine/gameplay-b-editor-authoring-workflow.test.ts` 和两份 Task 归档文件通过精确 include 定向刷新后均由 `resolve_paths` 成功索引。Search 中 `Datapack Editor UI` 同时命中游戏内 Runtime Editor；通过稳定节点 ID 与源码职责复核后只连到独立 Editor 概念。
- 写入批次：A 更新 4 个节点、20 条关系、32 条 owner Evidence、18 个唯一 Evidence 路径；B 更新 2 个节点、16 条关系、22 条 owner Evidence、12 个唯一 Evidence 路径；C 建立两条 Task 主职责记录；D 更新两条主职责关系并新增两条 Goal/Task 工作流追溯关系；E 在最终 Task 文本定稿后刷新这 4 条归档文档关系的 Evidence token。五批均完整 plan、dry-run `valid=true` / `errors_complete=true` 后正式提交；共执行 46 次 edge upsert（其中 6 次是最终文档边的重复刷新）。A/B/C 的 38 次 edge upsert 和 56 条 owner Evidence 是批次写入小计，不代表完整图快照；D/E 又执行 8 次 upsert。最终图中保留 6 个节点、40 条关系（38 条 `maps_to`、1 条 `depends_on`、1 条 `contains`）、58 条 Evidence references、32 个唯一 Evidence 路径；相较本轮前新增 10 条关系、刷新 30 条既有关系。定向 refresh 清理 2 个缺失旧根路径 File 节点及各自一条过期 Goal/Task 文档追溯边；对应归档 File 的两条新 Goal/Task 追溯边迁移了该关系，另由 C 建立的两条 Task 主职责边是新增关系。故两条旧边与两条归档追溯边净抵，Task 主职责映射另增加两条关系和两个 Evidence 引用；38/56 是 A/B/C 写入小计，不作为迁移前完整图快照。最终统计以 40 条关系、58 条 Evidence references、32 个路径为准。
- 写后核验：24 个唯一源码/测试路径、2 个归档 Task 路径和 4 个当前机制文档路径的 `review_changes` 文件/owner 页完整；26 个当前映射路径 stale=0，机制文档映射均 unchanged。两个旧根路径在刷新前曾为 missing 且各只有一个 owner；refresh 后 resolve 为 `not_found`，不再有直接 owner，Search 每个 basename 只返回归档 File。Schema JSON（7 owners）、Editor→Runtime 集成测试（8 owners）、Operation Runtime 文档（9 owners）和 Definition Authoring 文档（6 owners）页均续读至 `owner_complete`。`search(mode="map")` 与有界 `traverse`（depth 1、edge_limit 100）确认目标 Concept、归档 File、边方向和 roles，结果 complete=true。Batch E 后 `verify_freshness` 覆盖 6 个节点及 10 条新增关系，16/16 fresh，观察时间为 2026-10-08 15:17:46.064–15:17:46.569 UTC；随后最终 Task 文案 token 提交后已再次核验这 16 个 owner，结果仍 16/16 fresh，最终时间见本轮收尾回报。Task 记录只作 documentation trace，不作为实现依据；未作全库审计。

## 剩余工作

- PB-26 已在 `task-0276-pb-26-remove-legacy-special-cases-and-regression.md` 完成旧 UI fallback 清理与跨版本回归；其保留地图与静态表现边界见该 Task。
- 视觉节点画布、阵容选择器和通用 Narrative 不属于阶段 V，本轮未新增这些编辑器设计。

## 相关路由

- [[draft-0255-gameplay-b-atomic-scenes-phase-v-authoring]]
- [[docs/ai/context-packs/datapack-schema]]
- [[docs/docs-829/05-conventions/schema-sync]]
- [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]
- [[docs/docs-829/06-wiki/20-data-services/definition-authoring]]
- [[docs/docs-829/02-modules/datapack-editor]]
- [[docs/docs-829/06-wiki/60-engineering-support/schema-editor]]
- [[docs/ai/context-packs/ui-presentation]]
- [[docs/docs-829/02-modules/ui]]
