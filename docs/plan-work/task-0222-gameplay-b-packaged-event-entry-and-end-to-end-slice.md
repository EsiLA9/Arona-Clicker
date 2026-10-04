# Task 0222 — 玩法 B V1 产品入口与多地点切片

状态：proposed — 等待 Runtime、路线、Datapack 与创作校验能力完成

## 目标

让玩家从 AC 正式 UI 选择并启动一场由默认 Datapack 定义的多地点事件，完整体验学生计划、有限指挥、地点路线和事件结局。

## Why

Runtime、Authoring 和局部 UI 各自可通过测试，并不能证明玩家能从 AC 正式产品入口完成一场事件。此 Task 将已验收能力装配为一个正式发布的可玩内容切片。

本 Task 同时是玩法 B 下一大型体验施工阶段：前序 Task 优先建设并稳定服务/内容接口，不再逐项试做聊天流交互。Task 0222 基于实际 OperationView、命令和 Runtime 重新裁定玩家交互，并形成正式三栏 UI；Task 0216 的单地点界面只证明机制可观察与接口可用，不作为最终布局。

## Scope

- 在现有 AC UI 中提供清楚的 Operation 入口/可用事件列表、学生阵容选择或可用阵容摘要、启动与终局返回路径。
- 依据前序服务/投影/命令接口设计并施工 Gameplay B 正式 Operation Surface。版式必须是左/中/右三栏：左为我方，中心为信息聊天流，右为敌方；只改玩法 B 工作区，不做全 AC UI 重设计。
- 中心信息栏是主阅读区并占可用工作区宽度过半，承载固定事件/地点介绍、已知内容、状态简报和 Resolution 叙述；左/右为较窄但可读的角色/敌方卡片区。
- 左栏以一张我方角色卡对应一名学生，卡内呈现身份、状态、当前计划/行为、行动理由、目标与可用操作；不得把学生计划/行为同时复制成独立多列、平行长列表或一名学生一条聊天消息。
- 右栏以敌方/环境参与者卡呈现状态、Intent、目标和压力。角色计划所用的“角色卡”是其行为与身份的呈现容器，不等于玩家有限 SceneCard 牌组中的卡牌实例。
- 依据 Task 0224/0225 的接口，在本 Task 首次设计并引入 Individual/Global SceneAction、路线选择、Cost 支付、玩家 SceneCard 与确认等玩家交互；可决定哪些固定信息作为聊天流消息、哪些交互控件属于角色卡/信息栏/栏内面板。不得把未经设计的交互提前带入前序 Task。
- Event 入口使用 Task 0220 的默认 Registry 查询、Task 0216 可复用的 OperationView/Controller/Runtime 边界和 Task 0218 的 RouteView/命令；只复用机制合同，不沿用 0216 的双栏/学生计划条目布局。Event Location 不映射成 Area/Spot。
- 在 AronaClicker 默认内容中正式发布以游乐园巡查/失控设施为主题的多地点事件；沿用早期 Gameplay B 主题并扩展为同一张有向地图（可按区域/楼层分组），不另造随机地图生成器。
- 正式事件仅挂靠 `base:init:schale_office`；Task 0216 的临时 TypeScript 样例在本 Task 迁入 default Datapack/Registry，UI 只在夏莱办公室世界线提供入口。
- 地图至少包含三地点、一个允许回访的有界环、一条由 EventRun 局内持有物开启的捷径、一个因果路线选择；每地点访问中的状态会跨地点传播，并产生成功、部分成功和失败结果。
- 至少一个非战斗 Location 使用 Individual SceneAction（玩家给每名可行动学生各选一项），至少一个使用 Global SceneAction（玩家只选一项并选择其合法目标范围）。
- EventRun 使用共享 PlayerCost；样例展示地点进入 Cost 增量、实际离场携带上限以及场景行为与玩家卡共同支付的费用。Cost 与 AC 长期资源/战斗资源保持分离。
- 样例包含固定有限玩家场景卡组，展示起始抽牌、跨地点留手、同场景行为合并支付、打出后不回洗及牌堆耗尽；场景卡不进入战斗 Click。
- 至少一名学生的专属能力改变关键问题的可行解法；同一 Beat 至少出现两项合理但互相冲突的干预机会，玩家可选择不干预或干预其中一项。
- 一个地点至少有两条均可取但不互相支配的首选路线；路线选择前显示已知利益和遗留代价，并在后续状态兑现差异。
- 事件包含一个战斗/敌对行动地点和一个现场处置地点；全事件采用同一 Beat/Intent/Intervention/Resolution 语义。
- 角色 Profile 专属现场能力改变至少一个解法；角色随机技能与其并行且只在 Commit 结算，不能消费共享 PlayerCost。
- 事件结束后展示结果摘要与长期奖励提交；奖励通过 StateMutationService 且只提交一次。
- 使用固定 Seed/可复现输入完成 UI 端到端走查；检查 1280×720 下主信息与路线选择可读。
- 性能回执分别记录正式默认事件的代表性工作负载与 Task 0220 有效 `at-cap` 夹具在 prepare、干预预览、Commit/resolve、route/view、save/load 上的 p50/p95；`2x-overflow` 仅核验 Registry 拒绝和诊断，不进入 Runtime benchmark。记录浏览器、硬件、输入规模、EventRun snapshot 大小，以及带相同基础存档内容时 SaveData 增量。
- UI 施工声明 DOM budget、刷新等级与 interaction preservation；hover/scroll/单项选择仅触发 behavior/region 更新。

## Non-goals

- 不新增核心 Runtime 机制、通用剧情引擎、程序化地图或额外成长系统。
- 不创建专用 Runtime Editor、地图画布或全局 UI 重设计。
- 不以单一通关率或美术完整度替代玩家可理解的现场判断与状态因果。
- 不为窄屏内容移位单独扩大验收；三栏信息在目标桌面尺寸内同时可读即可。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| 游戏 UI 使用 Workspace/Controller/Runtime 命令和只读 GameView/Context。 | `docs/docs-829/02-modules/ui.md`；`docs/docs-829/06-wiki/50-ui/controller-commands.md`；`read-model-context.md` | 事件入口、Roster 选择和 Operation 操作由产品 UI 命令驱动。 |
| 正式应用内容从 AronaClicker 默认 Datapack 入口提供，测试 Datapack 与产品默认内容分离。 | `AGENTS.md`；`src/arona-clicker/content/default-datapack.ts` | 正式可玩样例放产品内容层，验证夹具留在测试包。 |
| Area/Spot 是世界线空间和功能设施，Runtime Editor 负责现有世界内容编辑会话。 | `src/data-services/contracts/world.ts`；`src/arona-clicker/services/runtime-content-coordinator.ts`；`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md` | Event 入口另立操作导航，不伪装成 Spot 功能。 |

## Data / API

- `OperationCatalogView`：可启动事件摘要、阵容要求、锁定原因与入口状态；来源于 Registry/产品规则的只读投影。
- UI 命令：选择可用 Event、确认学生阵容、开始 Event、返回事件目录或主 Workspace。
- 正式示例的 Event/Location/Action/Profile、SceneAction、PlayerCost、有限卡组及其嵌入式 Combination/Objective/Outcome/Route 数据位于 default Datapack；Task 0216 临时 TypeScript 切片不作为第二份长期内容维护。
- 不增加平行的 UI 写模型或单独的 Spot/Area 关联字段。

## Runtime Flow

默认 Datapack 加载并验证 → Registry 生成可启动事件目录 → 玩家进入 Operation 入口并选 Event/学生 → OperationRuntime.start 建立 EventRun → 本 Task 的三栏 Surface 消费 OperationView/SceneAction/Route/Card 命令完成多个地点 → Event Outcome View 展示结果 → 明确奖励经 StateMutationService 写入 → 返回事件目录。

## Acceptance

- [ ] 玩家可从现有 AC UI 进入 Operation 目录，查看可启动事件、锁定原因并启动默认内容中的正式事件。
- [ ] 三地点事件可从头到尾在浏览器中完成；玩家实际看到学生专属能力、竞争性行动计划、一个战斗/敌对 Intent、一个环境/场景目标和路线取舍。
- [ ] 从 `base:init:schale_office` 可启动游乐园主题正式事件；路线含有界回环、持有物门槛与因果分支，EventRun 状态不写入 PlayerState/InitSnapshot。
- [ ] 事件各含 Individual 与 Global 非战斗 SceneAction；Individual 要求玩家为每名合格学生分别选择，Global 仅作一次选择且按合法目标范围影响对象。
- [ ] PlayerCost 在场景内共享；场景进入增量恰好一次，只有成功离场才应用携带上限，单出口自动和多出口显式路径结果一致。
- [ ] 固定有限场景卡组可跨地点留牌；打牌与 SceneAction 同批汇总费用且一次 Resolution 提交，已用牌不回洗，玩家卡不参与战斗 Click，角色技能不消耗 PlayerCost。
- [ ] 改变路线或关键 Beat 决定会沿事件轨道/事实影响后续地点；玩家决定可稳定达到成功、部分成功、失败三种终局，随机不独占结果。
- [ ] 多出口时 Route 命令独立选择；单一出口自动转场；两者都不创建 Resolution、扣行动资源或增加 Beat/Click 计数。零合法出口时不等待 Route 输入、不创建转场命令，直接进入 Event 终止判定并展示依据。
- [ ] 硬失败除外，若仍有合法路线则 Event 继续；到达终止边界后按硬失败 → 全部主目标满足时成功 → 显式部分成功 → 失败的顺序裁定。结局摘要解释目标与代价。
- [ ] 结局画面及事件日志与 EventRun/Resolution 一致；长期奖励写入只发生一次，未完成事件不发终局奖励。
- [ ] 固定 Seed/输入序列重玩结果一致；保存后恢复仍继续同一地点/路线与准备计划。
- [ ] 1280×720 下事件目标、学生计划、Intent、指挥位、Commit 状态、地点出口与结局均可理解，不触发全 Workspace 无关区域重建。
- [ ] 桌面试玩中左/中/右三栏分别承担我方 / 信息 / 敌方；中心聊天信息流占可用工作区宽度过半且为主要阅读区，左/右角色卡与敌方卡同时可见。
- [ ] 每名学生的当前计划/行为、行动理由与操作入口只在其我方角色卡内形成主要表达；没有重复学生行动聊天消息或平行多列计划/行为长列表。
- [ ] 固定场景介绍、地点已知信息与结算记录在中心聊天流中按时间顺序可读；本 Task 明确设计的玩家选择不会把学生计划正文复制成消息条目。
- [ ] Individual/Global SceneAction、路线选择、Cost/SceneCard 支付的真实 UI 交互仅在本 Task 完成设计和可用性验收；它们调用前序稳定 API，不在此扩大底层规则。
- [ ] 分别记录正式默认事件和有效 `at-cap` 夹具的 prepare、intervention preview、resolve、route projection、OperationView 和 save/load p50/p95、EventRun snapshot 大小及固定基础存档上的 SaveData 增量；超出预先选定的用户感知目标时必须先定位瓶颈再扩大上限。
- [ ] `2x-overflow` 仅验证 Registry 拒绝与诊断，不启动 Runtime、不计入性能 benchmark。
- [ ] 诊断确认用户命令每次只构建需要的 OperationView，并由 UI Dispatcher 合并单一相关区域更新；hover、scroll 不调用 Resolver、不做全量 render。

## Tests

- **Unit：**OperationCatalog 查询、阵容门槛、Outcome 摘要与奖励幂等。
- **Runtime：**正式 Registry 定义下启动、路线分支、Event Outcome 和 Mutation 提交。
- **Integration：**Workspace → Controller → Event/Route 命令 → OperationRuntime → OperationView → StateMutationService。
- **UI：**浏览器完成三地点路径和三类结局；检查三栏职责与角色卡表达、固定信息流、Individual/Global 场景选择、玩家卡、零/单/多合法出口、锁定路线、返回入口和 focus/scroll 连续性。
- **Performance：**预热同一 reference 浏览器后分别运行正式默认事件和有效 `at-cap` 夹具；报告规模、p50/p95、EventRun snapshot 大小、固定基础存档上的 SaveData 增量、全局 render 次数和区域刷新命中。`2x-overflow` 只用于 Registry 拒绝测试。不以未标设备的单次耗时作 SLA。

## Dependencies

- 依赖 Task 0216 的 OperationView/Controller/Runtime 边界（不沿用其界面布局）、Task 0218 的因果路线、Task 0219 的 Save/Resume、Task 0220 的 Datapack/Registry、Task 0221 的内容校验流程，以及 Task 0224/0225 的 SceneAction、PlayerCost 与有限场景卡组服务。
- 这些能力分别依赖 Task 0213–0215 与 Task 0217。

## Documentation / GALHCG

- Task 0222 是最后一个 Gameplay B 大阶段；稳定后可委派子 Agent 汇总前序 Task 累积证据，统一更新 `docs/docs-829/02-modules/ui.md`、Operation/Route/Outcome 机制页、AronaClicker 默认内容、UI 入口路由和 GALHCG，并完整验证 freshness。
- GALHCG 只为稳定产品入口、默认事件内容、Operation Runtime、三栏 UI 投影和验证测试建立适当 maps_to；具体事件节点/人物/数值不建稳定 Concept。
- Read Set：`docs/docs-829/02-modules/ui.md`、`docs/docs-829/01-architecture/data-flow.md`、`docs/docs-829/06-wiki/50-ui/controller-commands.md`、`read-model-context.md`、`refresh-update.md`、`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`、`docs/docs-829/05-conventions/testing.md`、`docs/ai/frontend-design-project-overlay.md`、Task 0213–0221 与目标源码/测试。

## 当前核验与剩余工作

当前已核对 UI/Workspace、默认 Datapack、Area/Spot 和 Runtime Editor 边界；未实现正式内容或产品入口、未进行浏览器验收。此 Task 负责将前序稳定能力组合成可交付的游戏内事件切片，并首次正式裁定、施工 Gameplay B 三栏和玩家交互。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0216-gameplay-b-command-loop-vertical-slice-ui]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0219-gameplay-b-event-save-and-resume]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[task-0221-gameplay-b-authoring-and-content-validation-workflow]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
