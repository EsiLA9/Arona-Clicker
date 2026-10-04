# Task 0222 — 玩法 B V1 产品入口与多地点切片

状态：proposed — 等待 Runtime、路线、Datapack 与创作校验能力完成

## 目标

让玩家从 AC 正式 UI 选择并启动一场由默认 Datapack 定义的多地点事件，完整体验学生计划、有限指挥、地点路线和事件结局。

## Why

Runtime、Authoring 和局部 UI 各自可通过测试，并不能证明玩家能从 AC 正式产品入口完成一场事件。此 Task 将已验收能力装配为一个正式发布的可玩内容切片。

## Scope

- 在现有 AC UI 中提供清楚的 Operation 入口/可用事件列表、学生阵容选择或可用阵容摘要、启动与终局返回路径。
- Event 入口使用 Task 0220 的默认 Registry 查询、Task 0216 的 OperationView/Controller 和 Task 0218 的路线 View；不把 Event Location 当 Area/Spot。
- 在 AronaClicker 默认内容中发布一个新写的中性多地点事件；至少三个地点，一个因果路线选择，事件轨道/事实跨地点传播，并能产生成功、部分成功和失败结果。
- 至少一名学生的专属能力改变关键问题的可行解法；同一 Beat 至少出现两项合理但互相冲突的干预机会，玩家可选择不干预或干预其中一项。
- 一个地点至少有两条均可取但不互相支配的首选路线；路线选择前显示已知利益和遗留代价，并在后续状态兑现差异。
- 事件包含一个战斗/敌对行动地点和一个现场处置地点；全事件采用同一 Beat/Intent/Intervention/Resolution 语义。
- 事件结束后展示结果摘要与长期奖励提交；奖励通过 StateMutationService 且只提交一次。
- 使用固定 Seed/可复现输入完成 UI 端到端走查；检查 1280×720 下主信息与路线选择可读。
- 性能回执分别记录正式默认事件的代表性工作负载与 Task 0220 有效 `at-cap` 夹具在 prepare、干预预览、Commit/resolve、route/view、save/load 上的 p50/p95；`2x-overflow` 仅核验 Registry 拒绝和诊断，不进入 Runtime benchmark。记录浏览器、硬件、输入规模、EventRun snapshot 大小，以及带相同基础存档内容时 SaveData 增量。
- UI 施工声明 DOM budget、刷新等级与 interaction preservation；hover/scroll/单项选择仅触发 behavior/region 更新。

## Non-goals

- 不新增核心 Runtime 机制、通用剧情引擎、程序化地图或额外成长系统。
- 不创建专用 Runtime Editor、地图画布或全局 UI 重设计。
- 不以单一通关率或美术完整度替代玩家可理解的现场判断与状态因果。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| 游戏 UI 使用 Workspace/Controller/Runtime 命令和只读 GameView/Context。 | `docs/docs-829/02-modules/ui.md`；`docs/docs-829/06-wiki/50-ui/controller-commands.md`；`read-model-context.md` | 事件入口、Roster 选择和 Operation 操作由产品 UI 命令驱动。 |
| 正式应用内容从 AronaClicker 默认 Datapack 入口提供，测试 Datapack 与产品默认内容分离。 | `AGENTS.md`；`src/arona-clicker/content/default-datapack.ts` | 正式可玩样例放产品内容层，验证夹具留在测试包。 |
| Area/Spot 是世界线空间和功能设施，Runtime Editor 负责现有世界内容编辑会话。 | `src/data-services/contracts/world.ts`；`src/arona-clicker/services/runtime-content-coordinator.ts`；`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md` | Event 入口另立操作导航，不伪装成 Spot 功能。 |

## Data / API

- `OperationCatalogView`：可启动事件摘要、阵容要求、锁定原因与入口状态；来源于 Registry/产品规则的只读投影。
- UI 命令：选择可用 Event、确认学生阵容、开始 Event、返回事件目录或主 Workspace。
- 正式示例的 Event/Location/Action/Profile 及其嵌入式 Combination/Objective/Outcome/Route 数据位于 Datapack；临时测试 fixture 不进入 default Datapack。
- 不增加平行的 UI 写模型或单独的 Spot/Area 关联字段。

## Runtime Flow

默认 Datapack 加载并验证 → Registry 生成可启动事件目录 → 玩家进入 Operation 入口并选 Event/学生 → OperationRuntime.start 建立 EventRun → 通过 Task 0216 的 Beat UI 和 Task 0218 的 Route UI 完成多个地点 → Event Outcome View 展示结果 → 明确奖励经 StateMutationService 写入 → 返回事件目录。

## Acceptance

- [ ] 玩家可从现有 AC UI 进入 Operation 目录，查看可启动事件、锁定原因并启动默认内容中的正式事件。
- [ ] 三地点事件可从头到尾在浏览器中完成；玩家实际看到学生专属能力、竞争性行动计划、一个战斗/敌对 Intent、一个环境/场景目标和路线取舍。
- [ ] 改变路线或关键 Beat 决定会沿事件轨道/事实影响后续地点；玩家决定可稳定达到成功、部分成功、失败三种终局，随机不独占结果。
- [ ] 多出口时 Route 命令独立选择；单一出口自动转场；两者都不创建 Resolution、扣行动资源或增加 Beat/Click 计数。零合法出口时不等待 Route 输入、不创建转场命令，直接进入 Event 终止判定并展示依据。
- [ ] 硬失败除外，若仍有合法路线则 Event 继续；到达终止边界后按硬失败 → 全部主目标满足时成功 → 显式部分成功 → 失败的顺序裁定。结局摘要解释目标与代价。
- [ ] 结局画面及事件日志与 EventRun/Resolution 一致；长期奖励写入只发生一次，未完成事件不发终局奖励。
- [ ] 固定 Seed/输入序列重玩结果一致；保存后恢复仍继续同一地点/路线与准备计划。
- [ ] 1280×720 下事件目标、学生计划、Intent、指挥位、Commit 状态、地点出口与结局均可理解，不触发全 Workspace 无关区域重建。
- [ ] 分别记录正式默认事件和有效 `at-cap` 夹具的 prepare、intervention preview、resolve、route projection、OperationView 和 save/load p50/p95、EventRun snapshot 大小及固定基础存档上的 SaveData 增量；超出预先选定的用户感知目标时必须先定位瓶颈再扩大上限。
- [ ] `2x-overflow` 仅验证 Registry 拒绝与诊断，不启动 Runtime、不计入性能 benchmark。
- [ ] 诊断确认用户命令每次只构建需要的 OperationView，并由 UI Dispatcher 合并单一相关区域更新；hover、scroll 不调用 Resolver、不做全量 render。

## Tests

- **Unit：**OperationCatalog 查询、阵容门槛、Outcome 摘要与奖励幂等。
- **Runtime：**正式 Registry 定义下启动、路线分支、Event Outcome 和 Mutation 提交。
- **Integration：**Workspace → Controller → Event/Route 命令 → OperationRuntime → OperationView → StateMutationService。
- **UI：**浏览器完成三地点路径和三类结局；检查零/单/多合法出口、锁定路线、返回入口、focus/scroll 连续性。
- **Performance：**预热同一 reference 浏览器后分别运行正式默认事件和有效 `at-cap` 夹具；报告规模、p50/p95、EventRun snapshot 大小、固定基础存档上的 SaveData 增量、全局 render 次数和区域刷新命中。`2x-overflow` 只用于 Registry 拒绝测试。不以未标设备的单次耗时作 SLA。

## Dependencies

- 依赖 Task 0216 的单地点 Operation UI、Task 0218 的因果路线、Task 0219 的 Save/Resume、Task 0220 的 Datapack/Registry、Task 0221 的内容校验流程。
- 这些能力分别依赖 Task 0213–0215 与 Task 0217。

## Documentation / GALHCG

- 稳定后更新 `docs/docs-829/02-modules/ui.md`、Operation/Route/Outcome 机制页、AronaClicker 默认内容和 UI 入口路由。
- 在 GALHCG 为稳定产品入口、默认事件内容、Operation Runtime、UI 投影和验证测试建立适当 maps_to；具体事件节点/人物/数值不建稳定 Concept。
- Read Set：`docs/docs-829/02-modules/ui.md`、`docs/docs-829/01-architecture/data-flow.md`、`docs/docs-829/06-wiki/50-ui/controller-commands.md`、`read-model-context.md`、`refresh-update.md`、`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`、`docs/docs-829/05-conventions/testing.md`、`docs/ai/frontend-design-project-overlay.md`、Task 0213–0221 与目标源码/测试。

## 当前核验与剩余工作

当前已核对 UI/Workspace、默认 Datapack、Area/Spot 和 Runtime Editor 边界；未实现正式内容或产品入口、未进行浏览器验收。此 Task 负责将前序稳定能力组合成可交付的游戏内事件切片。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0216-gameplay-b-command-loop-vertical-slice-ui]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0219-gameplay-b-event-save-and-resume]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[task-0221-gameplay-b-authoring-and-content-validation-workflow]]
