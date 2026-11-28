> 历史证据：本地第三轮原文保留，非本轮新设计合同。原相对链接指向旧文档或仓库，可能在此包内不可用；从原仓库核对。

# 现状审计与证据索引

## 基线与范围

2026-11-28（Asia/Shanghai）。起点和实际 HEAD 均为 `391fc1cc4fbd1c7dffc989c82547aafc9531e5f1`，分支 `codex/story-continuation-0351`，远端 `EsiLA9/Arona-Clicker`。GALHCG 的 `graph_project` 核对 `acprogram`，其实现摘要用于定位，事实取自工作树。启动时的预存修改包括已归档的 Task 0427 与 `src/ui/css/editor-workspace.css`、`src/ui/runtime-editor/world-browser-provider.ts`、`src/ui/story-editor/controller.ts`、`src/ui/workspace/editor-workbench.ts`、`src/ui/workspace/editor-workspace.ts`。Task 历史可由 `ai/archive/history.zip` 追溯；P2 中依赖这些文件的观察属于工作树，换基线时复核。

Confirmed 表示已核实路径、合同和行为，Partial 表示存在实现但覆盖有限，Inferred 表示由已核查链条推导，Undecided 表示需要实验证据或确认。目标文档为 Proposed。表中的测试是可复核入口，整套执行结果另见页尾。

## 按目录找实现

| 层 | 入口及合同 | 当前依赖与出参 |
| --- | --- | --- |
| `src/app/`、`src/arona-clicker/runtime/` | `runtime-bootstrap.ts:createAppRuntime/loadDefaultDatapack`，`runtime.ts:AronaClickerRuntime`，`runtime-game-instance.ts:GameInstance` | 装配包目录、Registry、Engine 与领域服务，提供游戏命令、读取和保存 |
| `src/data-services/` | `contracts/datapack.ts:Datapack`、`datapack/`、`registry/`、`authoring/` | 包字节变成定义，Registry 校验并投影目录、关系和定义，作者策略用于部分写操作 |
| `src/engine/`、`src/arona-clicker/services/` | Condition、Effect、Trigger、EventBus 与产品 Story、World、Economy、Character | 条件求值、事件唤醒、产品命令与状态提交，UI 消费只读服务 |
| `src/arona-clicker/state/`、`src/data-services/persistence/` | `StateMutationService`、`per-init-fields.ts`、Runtime save codec 和 storage | 内存账本、Init 履历及快照、保存版本与恢复 |
| `src/ui/`、`tools/` | 游戏内 Workspace/Story/World、独立 `tools/datapack-editor`、Node Graph 演示 | 两个 Vite 开发入口，游戏内接 Runtime 端口，独立工具编辑导入的数据；图演示不承担产品内容保存 |
| `tests/` | data、engine、ui、tooling、prototypes；独立工具同目录测试 | 分层验证，DOM 设施不能替代真实输入、布局和浏览器复核 |
| `docs/docs-830/`、`ai/guide/`、`ui-style/` | 现行机制、领域上下文包和路由、authoring/content-tools 两套交互参考 | 查入口及已采用视觉约定，见页末文档差异 |
| `scripts/`、`datapack/`、`datapack-dev/` | Schema 生成、Base 分片导出和 bundle 同步、样例/依赖包 | 现有可重现产物入口与原型真实数据 |

Runtime 组合入口为 `src/arona-clicker/runtime/runtime-wiring.ts:wireGameInstance`，把通用 Engine 与产品的 StateMutation、Registry 与领域服务组合。普通玩家操作经产品命令，条件和 Effect 用共享 EventBus/Trigger 分发。保存由 `runtime-save-codec.ts:buildSaveData` 构造，`runtime-save.ts:restoreFromSave` 处理恢复。下表聚焦会改变 P0–P6 方案的链路。Gameplay B 和 Operation 核对数据合同、现有准入和构建边界，战斗细节维持立项范围所定的优先级。

## 内容、文件、编辑器与故事

| 证据与状态 | 实际链条、输入与结果 | 测试入口与缺口 |
| --- | --- | --- |
| A01 Confirmed 包读取 | `src/data-services/datapack/source.ts` 的 `PackSource` 为路径与字节读取抽象，`pack-parser.ts:parsePack` 读取根 `datapack.json`，枚举 JSON 和图片，调用 `parseFragment` / `mergeFragments`，检查 manifest 和分片的 name/version，返回 `ParsedPack`（Datapack、图片 data URL 和计数）。`manifest.ts:parsePackManifest` 要求小写 modName，依赖为 modName 字符串数组。 | `tests/data/datapack/{pack-source,pack-parser,pack-manifest,zip-loader}.test.ts`。结构归类与 JSON 语法检查在此发生；领域合同留给后段。 |
| A02 Confirmed 合并策略 | `fragment-parser.ts` 迁移旧 Story Entry 后识别列表、单例与 extras。列表拼接，同名 extras 键和单例后值覆盖，name/version 取首个有效字符串。不识别任何字段时失败，混合已知与未知字段可忽略未知项。合并产物未维护逐字段作者源位置。 | `tests/data/datapack/fragment-parser.test.ts`。需要新增两处冲突定位、顺序置换和往返保真验证。 |
| A03 Confirmed 启用与准入 | `PackManager.applySelection/applyConfiguration/applyRuntimePlan` 计算启用集并依赖检查，目标校验后应用。Runtime 的 `applyEnabledPacks` 经包管理应用到 GameInstance。 `registry/registry-validate.ts:validateDatapack` 结合上下文检查地图、Story、揭示、Milestone 等领域定义。包记录选择、保存及 Runtime 重装属于另一层。 | `tests/data/datapack/pack-manager.test.ts`、`tests/engine/runtime-content/{registry,arona-runtime-pack}.test.ts`。校验通常在异常上停止，作者端没有统一完整多错误报告。 |
| A04 Partial 作者策略与热写 | `authoring/{content-policy,content-policies,content-policy-dsl}.ts` 给出策略、字段描述与算式相关作者支持。`RuntimeContentCoordinator.applySpotMutation` 接受 create/replace/delete/suspend/resume，检查修订后获得 Registry 写入 receipt，通知失败尝试回滚。Init/Area 另由 `runtime-world-content-coordinator.ts` 协调。 | `tests/engine/runtime-content/{runtime-content-coordinator,runtime-world-hot-crud,runtime-spot-field-authoring}.test.ts`。热写回执可用；作者工作区的持久文件事务与包启用属于不同流程。 |
| A05 Confirmed Base 与导出 | `base-datapack-source.ts:baseDatapackSource` 汇总类型化内容、生成 AreaMap 投影与图片映射；`scripts/export-base-datapack.mjs` 和 `base-datapack-export.mjs` 输出 metadata、字段 JSON、图片。应用取 `base-pack/content.json`，由 `scripts/sync-base-datapack-bundle.mjs` 单独准备。独立工具 `ui/io.ts:createDatapackPackage` 另走 ZIP 导出。 | `tests/data/datapack/{base-datapack-folder-export,bundled-base-pack,archive-writer,addition-test-pack}.test.ts`、`tools/datapack-editor/ui/io.test.ts`。两套产物都应与新 build 样本对照。 |
| A06 Partial 独立编辑器 | `tools/datapack-editor/model/editor-model.ts:EditorModel` 按 table/index/path 更改内存数据，`commit` 做快照，`undo/redo` 恢复。 `validate/index.ts:validateDatapack` 组合表结构、ID、引用和额外语义检查。Schema 经 `scripts/gen-engine-schema.mjs` 生成 `engine-defs.gen.json` 并叠加 `schema/editor-extras.ts`。 | `tools/datapack-editor/{model/editor-model,schema/engine-schema.sync,schema/datapack.schema,validate/operation-authoring}.test.ts`。UI/CLI 共享验证、真实文件归属与跨包事务需要新合同。 |
| A07 Confirmed 游戏内工作台 | `src/ui/workspace/editor-workbench.ts:EditorWorkbench.project` 组合表现，`browse-instance-manager.ts:BrowseInstanceManager` 管理准备、激活、复用、复制和关闭，`editor-explorer-service.ts` 投影目录。Story 控制器与 World provider 提供领域接线，共享外壳依赖工作树变更。 | `tests/ui/workspace/{editor-workbench,browse-instance-manager,editor-explorer-service}.test.ts`、`tests/ui/story/story-editor-workspace-session.test.ts`。没有统一跨作者端草稿存储。浏览器验收未用 DOM 测试代替。 |
| A08 Confirmed Story 保存、校验与试播 | `src/ui/story-editor/pack-source.ts:storyPackSource` 接入包来源，`src/arona-clicker/runtime/runtime.ts:saveStoryAuthoringToPack` 校验和保存选择的包，改 ID 另外核对 digest。 `GameInstance.previewStoryWithContent` 建立 sandbox，按作者补丁和目标构建试播。 `Registry.saveStoryAuthoring` 也可应用仅本次运行的补丁。 | `tests/ui/story/{story-editor-pack-source,story-editor-authoring}.test.ts`、`tests/engine/story/{story-authoring,story-definition-save}.test.ts`。不同操作的成功回执不能互换。 |
| A09 Confirmed Story 播放 | `contracts/story.ts:StoryDef` 继承 `StoryNodeDocument`，节点及动作在 `contracts/story-node.ts`，投放入口在 `contracts/story-entry.ts`。 `StoryService` 经 `StoryNodePlayer`、action host、playback coordinator、奖励回执推进。实际 Base 白子邀请卡绑定 Area、Active Entry 与允许回传的 flags。 | `tests/engine/story/{story-continuation,story-node-playback.integration,story-node-save.integration,story-reward-receipts,story-replay}.test.ts`。覆盖父子保存、回传、赴约、回放隔离及通知失败。没有文本 DSL Golden。 |
| A10 Partial 通用关系导航 | `registry/runtime-content-browser.ts` 从 Registry 和 supplemental 来源构造快照并提供 `getReferences/getEntityRelations`；`authoring/story-identity.ts:planStoryIdentityChange` 在 Story 相关记录中找并改 ID 引用；Story Directory 另有专用验证。 | `tests/engine/runtime-content/{runtime-content-browser-rules,runtime-content-browser-published-content}.test.ts`、`tests/engine/story/story-directory.test.ts`。运行时可见项与跨文件作者图的范围不同。 |

## 玩法、来源与工具

| 证据与状态 | 实际入口、行为与状态 | 测试入口与局限 |
| --- | --- | --- |
| A11 Confirmed 世界知识和旅行 | `world/information-reveal-domain.ts:queryInformationReveal/deriveDesiredInformationWatches` 计算已知、待门控和候选监听。 `AreaTravelGraph/buildAreaTravelRoutes` 用 Area 拓扑和状态产出 adjacent/visited/transit/mapDirect。 `AreaMapCommandService` 打开、观察和收集地图。 `per-init-fields.ts` 快照含 visitedAreas 和 collectedAreaMapIds。 | `tests/engine/world/{information-reveal-progress,information-reveal-save-rebuild,information-reveal-hot-content}.test.ts`、`tests/engine/area-map/{area-map-travel,area-map-commands,area-map-fast-travel}.test.ts`。并行机制已能工作，完整玩家调查顺序需新纵向场景。 |
| A12 Partial 物品、商店和奖励 | `economy/item-service.ts:giveItem/useItem/rollDropTable` 连接发放、使用和掉落；真实表名为 `dropTables`。`ShopService.checkout` 校验报价、库存和可支付性并返回收据；`story-rewards.ts` 有 Story 奖励回执；库存、商店记录有状态归属。 | `tests/engine/runtime-content/shop-service.test.ts`、`tests/engine/story/story-reward-receipts.test.ts`、`tests/ui/workspace/inventory-workspace.test.ts`。这些没有组成跨来源永久档案和系列完成合同。 |
| A13 Partial 角色知识 | `RosterSystem.getOwned/contactGroups/codex` 与 `CharaProfileService.characterProfile` 有不同角色投影，`AffectionSystem`、`content/character/bond-content.ts` 连接好感和剧情；角色、Variant 与持有分别存在。 | `tests/engine/character/roster-system.test.ts`、`tests/engine/story/{hoshino-story-spaces,shiroko-story-samples}.test.ts`。完整的未持有前认识与逐条资料揭示仍缺可定位合同。 |
| A14 Confirmed 偶遇与投放 | `economy/passive-pool-system.ts:rebuildIndex/pick` 生成候选依赖，按条件、权重等挑选内容。 `services/story/{story-entry-selection,story-availability-delivery-mount,story-follow-up-mount}.ts` 处理入口、发现与后续投放；`StoryService` 接管播放。 | `tests/engine/character/passive-pool.test.ts` 覆盖事件、区域、切换、恢复。关键内容获知与消费的保证需作为显式验收。 |
| A15 Partial 里程碑与解锁 | `world/milestone-domain.ts` 推导 watch，`MilestoneAdapter.registerSources/attemptCompletion` 用 Trigger 唤醒后重新求值，经 mutation 提交完成再执行 listener.then。后置失败记录开发日志。 `read-model/achievement-view.ts` 投影成就；`SpotFunctionality`、Enhancement、Affector 保有各自职责。 | `tests/engine/world/{milestone-runtime,milestone-adapter}.test.ts`、`tests/data/area-map/area-achievement-demo.test.ts`。需实验保证完成后的能力同样可交付，并覆盖无 wake 映射条件与存档。 |
| A16 Partial 内容还原 | `content/story/stories.ts` 汇集不同篇章与样例，`authored-story-catalog.ts` / `story-directory.ts` 可表达游戏目录。 `datapack-dev` 有可导入测试包与使用说明。所核查的 `src`、`tools`、`scripts`、`datapack-dev` 中未定位独立原文清单、篇目授权记录、分段覆盖率或批处理还原台账。 | 此结论限所列范围。内部 1.3R、2.3、2.3R 和权威来源由负责人确认。Story 导航与原版覆盖是不同口径。 |
| A17 Partial Agent 作者入口 | `ai/guide/` 提供上下文包与工程路由，`package.json` 有 Base export、Schema、测试、文档与 Task 工具。当前工具各自输出，`scripts/run-tests.mjs` 会写测试汇总。未发现一项可从翻译/创作源执行实体查询、统一验证、写入与隔离预览的作者 CLI。 | `tests/tooling/`、独立工具 Schema/validator 测试。GALHCG 的项目源码图用于定位实现，不能充当作者内容索引。 |

### 影响方案的细节

- A08 的 `saveStoryAuthoringToPack` 通过 `requireEditingPack` 确认目标，并校验 patch shape、包归属、依赖与候选 Registry。checkOnly 返回校验结果，真实保存写 PackManager 与快照，包需重载才生效。运行期 Registry 保存是另一条明确的入口。
- A09 的 `src/data-services/authoring/story-definition-projection.ts:projectStoryDefinition` 接收对象与引用上下文，返回 Story 或带字段路径的问题；`registry-story-mutation.ts` 消费它。 `tests/data/story/story-definition-projection.test.ts` 覆盖坏 action 和未完整 transfer。统计 DSL 的 `parseStatCall` 解析统计表达式，Runtime Editor 结构化控件经 `readConditionEditor` 与 `readEffectEditor` 操作 Condition/Effect。
- A11–A15 的持久事实要区分当前 Init 与保存范围。 `src/arona-clicker/types/state.ts:PlayerState` 明示 informationRevealProgress、milestoneProgress 在保存范围内增长，库存、当前区域、到访、地图收集和故事投放在 `PER_INIT_FIELD_SPECS`；Roster 和购买事实还读取所属范围策略。 `tests/engine/world/information-reveal-save-rebuild.test.ts` 区分持久揭示和临时监听。
- A15 的测试明确固定了旧行为。 `tests/engine/world/milestone-runtime.test.ts` 验证重复唤醒仅完成一次、保存恢复不会重放 listener，并在 listener.then 抛错后仍保持完成、记日志且不重试。P4-E 更改的是需保证授予的能力合同。

## 实物样本与差异

- Base 分片与 bundle 的实体计数一致。各含 6 Init、15 Area、26 Spot、6 AreaMap、74 Item、46 Story、15 Active Entry、27 Passive Entry、6 Pool、9 Character、10 Variant、5 DropTable、1 Shop。
- 对读盘 JSON 递归按键排序、按实体 ID 对照，Base 46 个 Story 的 initId 存在差异，4 个 Millennium Story 的 startContext 有差异。以 `base:story:millennium_calculation` 为例，分片起点是 abydos_campus，bundle 是 millennium_lab。1 个 Active Entry 和 5 个 Passive Entry 的 availableInits 不同。 `base:activestory:bond_hoshino_evening` 在分片为空数组，在 bundle 含 base:init:abydos。5 个 Pic 的 src 不同，例如 Hoshino 图的 ZIP 地址与源码地址。modName 来自分片根 manifest 或 bundle 顶层。以上为已复现的数据差异，运行语义和迁移目标值由 P0/D11 单独验收。
- `datapack-dev/addition_test/`，`addition-test@0.1.0` 依赖 base。可追踪 `addition-test:init:observatory`、scanner、signal-chip、archive-fragment、welcome、passive-signal 与图片资产。使用 JSZip 读取相邻两个 ZIP，与目录文件逐项比较。两个 ZIP 都在 00-world.json、02-story.json 和 README.md 不同。解析 JSON 后差异分别落在 scanner 的 baseCapacity，以及 welcome、passive-signal 的 initId。复现时应固定路径与摘要，该版本标签共有多份输入。
- `datapack-dev/area-achievement-demo/`，`area-achievement-demo@1.0.0` 依赖 base。 `01-achievements.json` 中 steady-credit 检查该 Init 累计生产 6 信用点并给 2 点，archive-fragments 检查累计获得 3 枚档案片并给 5 点。P4-E 的能力型奖励是未来实验条件。
- `docs/docs-830/01-architecture/startup-and-runtime.md` 与 `02-data-and-state/package-io-and-source-layers.md` 能解释两条 Base 打包路径。当前 `default-datapack.ts` 读取 bundle，旧的 TypeScript 装配职责在 `base-datapack-source.ts`。地图摘要中的 defaultDatapack 汇总描述须按此定位。
- `docs/docs-830/05-domains/story-and-effects.md` 的羁绊例子仍以 Entry.kizuna/kizunaCard 介绍。 `content/story/story-shiroko.ts` 和 `story-hoshino.ts` 的正式样本已用 `entryCard.continuation`。蓝图以该样本为主，旧格式纳入导入实验和回归。
- P2 的视觉依据使用 `ui-style/visual-languages/authoring/` 下的 Workbench、Explorer、Inspector、故事与预览模式，独立工具使用 `content-tools` 已有层级。DOM 变更遵循 `ai/guide/frontend-design-project-overlay.md` 的区域、锚点和稳定节点约定。

## 覆盖矩阵与运行记录

| 要验证的结果 | 现有入口 | 蓝图新增证据 |
| --- | --- | --- |
| ZIP/碎片/manifest、启用、Base | data/datapack、tooling、runtime-content | 双前端同结果、两处源诊断、可重复 build、准入失败保留 live |
| 表、引用、草稿、预览 | 独立工具 spec、ui/workspace、ui/story、data/story | 文件移动时编辑身份、两实例冲突、源跳转、发布前后 DOM 和 Runtime 隔离 |
| Story 入口、行动、保存 | engine/story、data/story | JSON/DSL 对照 trace、格式 Golden、重复命令与过期来源映射 |
| 世界、角色、档案、偶遇、解锁 | engine/world、engine/area-map、engine/character、shop、rewards | 各 P4 垂直切片、跨 Init 重进、失败可恢复与持久可回顾 |
| 还原与 Agent | tooling、包验证与 Story 样例 | 原文清单与覆盖计数、批导部分失败、计划/应用权限及 IDE/CLI 结果同一 |

当前执行结果见 [Task 0429](../../ai/plan/task-0429-prototype-architecture-blueprints.md) 的验证记录。结果覆盖运行工作树上的现有测试。Editor Convergence Task 0421–0428 已归档至 `ai/archive/history.zip`；P2 的入口应以实际工作树和源码、生产测试为准，归档交接记录只用于追溯当时改动背景。
