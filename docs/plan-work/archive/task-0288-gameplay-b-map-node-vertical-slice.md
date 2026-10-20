# Task 0288：Gameplay B Map / Node / Encounter 最小竖切片

**状态：completed — C1 / C1a 通过施工与非施工者独立审查；C2 继续由上位 Task 分阶段推进**

**上位目标：**[[task-0287-gameplay-b-semantic-convergence-and-minimal-loop]]  
**冻结合同：**[[draft-0287-gameplay-b-phase-b-contract]]  
**执行边界：**本 Task 只实现 Map / Node / Edge 移动与真实 Datapack → Registry / Resolver → Spot Entry → Map / Encounter → 回图链路；不提前实现 C2–C5。

## 设计目标

Gameplay B 的第一条真实玩法路径应以地图上的位置移动为中心，而不是先启动一整段 Operation，再按地点完成度推进路线。作者提供一张 Map；Map 内有 Nodes 与 Edges；Node 可带一个 Encounter。玩家从普通 Spot 入口进入地图，只能移动到相邻节点。进入有未完成 Encounter 的节点后立即进入 Encounter；完成后回到原节点，之后仍由玩家决定下一步去哪里。

这条路径必须由正常 Datapack 内容驱动，并经正式 Registry、Resolver、Runtime 与游戏界面运行。最小 Encounter 只需要一个可观察、可合法提交的完成操作，不需要战斗、敌人或抽卡。目标是尽早验证新作者语义确实可以落地，而不是另造一个只在测试里成立的模型。

## 背景：当前实现与本阶段问题

- 当前 `Datapack` 没有 Map 表。Gameplay B 内容以 `OperationEvent`、`OperationLocation`、Action 与 Profile 等表表达；一个 Event 覆盖一整段旧关卡流程。
- 旧路线由 Location 完成和 Route 提交推进。Strategy Park 的静态布局与 Runtime 路线状态分开维护，不能作为新 Map 的权威模型。
- 现有 Spot `operationEntry` 指向 Operation Event；Registry 校验的也是 Event ID，不能直接当作新 Map 入口。
- GameInstance 当前持有 Operation Runtime Owner；保存数据含 `operationRun`。新 Run 必须有单一的当前位置与运行状态来源，旧 OperationRun 不转成 MapRun。
- 负责人已冻结阶段 B 的地图拓扑、Encounter 进入与回图、失败终止、状态生命周期、固定队伍、存档拒绝恢复等合同；这些不是本 Task 的开放设计问题。

上述当前实现事实来自阶段 A 的源码核验与 [[report-0287-gameplay-b-core-migration-investigation]]；施工时仍以当前源码、测试与 `docs/docs-829/` 复核。

## 本 Task 固定的行为合同

### 地图和遭遇

- Map 内嵌 Nodes、Edges；Node 至多内嵌一个可选 Encounter。Map 有起点与出口节点。
- MapRun 保存当前位置与节点进度。每个 GameInstance 至多一个活动 MapRun；不要求 MapRun 与 Encounter 分别使用不同 Runtime Owner。
- 仅能沿 Map 中实际存在且可通行的有向 Edge 移动。遭遇活动期间，UI 禁止移动，Runtime 也必须拒绝伪造或过期移动命令。
- 移入未完成 Encounter 的 Node 后立即开始遭遇；成功完成后标记完成、清除 Encounter-local 状态并回到该 Node。已完成遭遇重访时不重开。
- 到达预设出口节点后，MapRun 成功结束。Encounter 失败立即终止 MapRun，不发成功奖励；首版没有撤退或重试。
- C1a Encounter 只声明一个完成动作 `completion: { kind: "manual", label: string }`。玩家触发后，Runtime 校验当前活动 Encounter 并成功结束；没有此声明的 Encounter 不提供该动作。此字段只是 C1a 最小完成合同，不是通用脚本或效果 DSL。
- C1a 的最小样例只需上述一个可人工触发的合法 Encounter 完成操作；Battle、Enemy、Tendency、Hand、Swap、PlayerCost、Ability、Item 与通用 Effect 结算留给后续阶段。

### 状态生命周期

- **Persistent PlayerState：**已拥有角色、永久资源、长期成长与明确写回的长期奖励。
- **Map-run-local：**当前位置、节点访问/完成进度、跨遭遇友方状态、PlayerCost、临时物品及 MapRun 随机上下文。
- **Encounter-local：**当前遭遇参与者局部状态、敌方 HP、轮次、候选 Hand、Prepared Action / Target、Swap / Command 草稿及本次遭遇历史。
- 每项运行数据只由一个权威字段持有；创建、继承、结算、写回和清理遵守阶段 B 合同。C1a 尚未实现的玩法状态不提前建空泛扩展框架。

### 内容与存档

- 新内容通过普通 Datapack 声明 Map；普通 Spot Functionality 明确引用 Map ID。不得把新 Map 包成旧 `OperationEvent`，不得建立 demo-only loader 或在 UI 硬编码样例 ID。
- Map ID / resumeVersion 是 MapRun checkpoint 的内容兼容边界。Map 不存在或版本不兼容时拒绝恢复该 Run、提示内容已失效，并保留 PlayerState；旧 `operationRun` 不迁移为 MapRun。
- C1a 完成前保留旧样例与入口；本 Task 不执行 C5 的 Gameplay B 内容删除或旧系统退役。

## 计划与依赖

本 Task 使用 [[task-0288-units-guide]] 中的 Patch Unit。U0 是全仓类型检查的既有验证前置，不改变 Gameplay B 产品语义；U1–U8 完成 C1 / C1a 依赖链；U9 是独立复核发现并修复的合同回归收口。

```text
U1 Map 数据合同与 ID
  ↓
U2 Registry 表、拓扑校验与 mapEntry 引用
  ↓
U3 Map Resolver 与正式 Datapack 样例
  ↓
U4 MapRun 最小状态机
  ↓
U5 GameInstance / ReadModel / GameCommands 接线
  ↓
U6 MapRun Save / Resume
  ↓
U7 Map / Encounter Workspace
  ↓
U8 Spot 入口及端到端实际运行验收
```

每个 Unit 开始前先复述 Goal、Allowed Files、Non-goals 与 Stop Conditions；先读指定 Read Set；超出白名单、预算或事实边界即停止并回报。完成后在 `task-0288-gameplay-b-map-node-vertical-slice-units/receipts/` 记录 Receipt。最终需由不同于施工者的验收者独立审查 C1a 链路。

## 数据包与 Schema 边界

- C1a 样例使用项目正常 TypeScript Datapack / PackManager / Registry 加载路径，不可绕过 Registry。
- 仓库 `AGENTS.md` 明确禁止修改生成 Schema；本 Task 不手改或运行会改写 `tools/datapack-editor/schema/engine-defs.gen.json` 的生成步骤，也不扩建独立 Schema Editor 支持。若本 Task 的正常运行链因该限制无法通过，按 Unit Stop Condition 上报具体阻塞，不得自行改禁改边界。
- 不修改 `dist/`、`web-dist/`、`src/ui/dist/`、`node_modules/` 或生成文件。

## 验收

- [x] Registry 接受合法 Map；拒绝错误 Map ID、重复 Node ID、未知起点/出口/边端点、错误拓扑引用与无效 `resumeVersion`。
- [x] Spot 的 `mapEntry` 只能引用 Registry 已有 Map；新 Map 不依赖 Operation Event、Location、Scene 或旧 Resolver fallback。
- [x] 真实 Datapack 样例经默认启用 PackManager / Registry / Resolver 加载并出现在正常 Spot 入口。
- [x] 正常游戏入口可打开 Map A；只显示可移动的相邻节点；实际移动到 B 后触发 Encounter。
- [x] Encounter 活动时地图移动被锁定，直接提交伪造移动命令也不改变 MapRun。
- [x] 执行合法的最简完成操作后回到 Map B，Encounter 标记为完成；玩家再主动移动到 C 并结束 MapRun。
- [x] 非相邻/不存在节点移动、被阻断移动、无效 Encounter 完成均不改变状态。
- [x] 保存/恢复在 Map 上及 Encounter 中保留其正确生命周期状态；不重复触发已提交结算、不重抽尚未实现的 Hand；无效版本拒绝 Run 并保留 PlayerState。
- [x] Map / Encounter UI 使用现有 Workspace 外壳与设计约定；没有地图运行状态的 UI 可写副本，没有按示例 Map ID 特判。
- [x] 定向 Data / Engine / UI 测试、`npx tsc --noEmit` 与 `npm run check:docs` 按 Units 要求通过；C1a UI 链路已由非施工者独立复跑与审查。

## 明确不属于本 Task

- C2 之后完整 Encounter 规则、Battle/Rest/Shop 交互与局部条件 / Effect 扩充。
- Character Tendency、加权 Hand、Prepared Action、Swap、PlayerCost Command 与 Commit 行为抽取。
- Player Ability、Item 使用、奖励发放与跨遭遇资源效果扩展。
- 删除 / 替换旧 Gameplay B Operation 内容、退役 Operation Runtime 或迁移旧 OperationRun；这些按 0287 的 C5 或另行批准范围办理。
- 编辑器生成 Schema 与独立 Datapack Schema Editor。

## 当前执行记录

- 2026-10-17：负责人冻结阶段 B 全部行为、数据、内容和 Save / Resume 合同。
- 2026-10-17：建立本 Task 及 U1–U8 的施工边界；U1 Map 静态合同 / `map` ID 已完成，定向 ID 测试通过。全仓类型检查被两处无关 Operation UI 测试夹具的既有类型缺口阻断，已记入 U1 Receipt；旧 Operation 内容保留至 C5。
- 2026-10-17：为修复上述全仓类型检查前置问题建立 U0；只允许调整两条既有 UI 测试 fixture，不修改生产 Operation 行为。
- 2026-10-18：U2 完成 Map Registry 表、拓扑校验与 `mapEntry → mapId` 引用验证；定向测试 15/15 通过，类型检查通过，详见 U2 Receipt。
- 2026-10-18：U3 完成 Registry Map Resolver 与正式 Gameplay B Datapack 的 A→B→C 样例；Resolver 定向测试 2/2 通过，类型检查通过，未改默认包注册或生成 Schema，详见 U3 Receipt。
- 2026-10-18：U0 补齐两个手动 Workspace fixture 的 `returnContext`，并让两份旧 UI suite 都持有 Carousel 与 Strategy Park 入口 Spot；`npx tsc --noEmit` 通过。两份旧 Operation UI 定向测试仍有 21/40 项失败，失败摘要与停止原因记录在 U0 Receipt；U0 独立于 U1–U8 依赖链，不将旧 Operation UI 测试当作 Map 功能验收。
- 2026-10-18：U4 MapRun 状态机完成，定向测试 6/6 通过、类型检查通过，详见 U4 Receipt。U5 GameInstance / ReadModel / GameCommands 接线开始施工。
- 2026-10-18：U5 完成唯一 MapRun owner、冻结 ReadModel 投影与三项正式 GameCommands；生命周期集成测试 2/2、类型检查通过，详见 U5 Receipt。
- 2026-10-18：U6 preflight 发现 U4 MapRunService 的私有状态槽没有 checkpoint restore API；若只改 Save / GameInstance 会被迫 replay 命令，无法保留 Run ID 且可能重放结算。U6 白名单因此增加 `contracts/map-run.ts` 与 `services/map-run-service.ts`，限制为 Owner 级无副作用 snapshot / restore，并使用已有 DevLog warning 暴露无效 Map / resumeVersion。U6 完成：只保存活动 Run；定向存档测试 4/4、类型检查通过，PlayerState 与 OperationRun 保持独立，详见 U6 Receipt。
- 2026-10-18：U7 Map / Encounter Workspace 施工开始前发现 `MapRunQuery` 尚未公开 Map 名称、Node、Edge；既有 ContentCatalog / WorldCatalog 也不包含 Maps。为避免 UI 直接读 Registry 或手抄内容，U7 白名单增加 `contracts/runtime.ts` 与 `runtime-game-instance.ts`，只提供当前 Map 的 detached / readonly 内容投影；整体仍不引入第二份 MapRun 状态。U8 的正常 Spot 入口与端到端验收待 U7 完成后进行。
- 2026-10-18：UI 只读复核确认 U7/U8 的数据与 UI 分工可行；为保证 Map 移动和 Encounter 完成局部刷新，U8 Allowed Files 增加 `src/ui/controller.ts`，仅添加 Map Workspace region refresh handler，不改通用 Controller 路由模型。U7 进一步冻结 route-only MapRun 定位规则。
- 2026-10-18：U8 完成普通 Datapack Spot Map Entry、route-only 开始 / 返回 / 继续与窄 Map region refresh；新增正常 `createAppRuntime()` → `loadDefaultDatapack()` → `controller.mount()` UI 集成，免费获取未持有 Spot 后完整跑通 A→B→手动完成→B→C。非法命令拒绝且快照不变；移动 / 完成均仅 region refresh。定向 UI 集成、类型检查与文档检查通过；另一代理独立复跑 UI 集成并审查入口、路由、命令委托与刷新边界，结论通过，详见 U8 Receipt。
- 2026-10-18：U9 依据 U1–U6 独立复核收口两项发现：U5 生命周期测试改为验证 U6 `load(save())` 保留 Run ID / Encounter 进度，同时验证旧 SaveData 无 `mapRun` 时清理；Registry 新增正安全整数 `resumeVersion` 校验。定向测试 25/25、类型检查与文档检查通过，详见 U9 Receipt。
- 单元代码、测试与实际游戏入口验收结果以各 Receipt 记录；未完成验收不得标为已完成。
