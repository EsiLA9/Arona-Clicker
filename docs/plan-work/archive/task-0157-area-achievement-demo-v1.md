# Task：独立数据包的双区域成就演示 v1

状态：done — 双区域成就演示、验证与当前事实文档已完成

## 目标

交付一个可导入的自包含示范数据包：玩家进入演示 Init 后只看到初始 Area 的 Achievement；首次进入起初即可前往的第二个 Area 后，才看到其独立 Achievement。累计资源与收集品目标能完成、显示进度、自动提供一次性效果，并在切换 Init 与读档后保持完成事实。它是隐藏 Milestone → Listener → Achievement 的首个玩家可玩闭环。

## 设计边界

- 本 Task 包含：最小声明关系、Area 首访准入与当前 Init 监听生命周期、两种 Init 累计统计的精确唤醒、首次完成效果、只读成就页、示范 JSON／ZIP 和定向测试。示范的两个 Area 目标互不依赖。
- 玩家只看到 Achievement；已发现项在定义仍存在时不因离开 Init 隐藏。成就页按归属分组，当前区域优先；简单数值用“当前／目标”，展示作者线索和奖励说明。
- Listener 的 `then` 可转发当前真正可执行的 Effect；首个示范至少使用一个持久资源发放。完成先记账；可捕获异常记 DevLog 且不自动重试，接口未报告的业务拒绝不能伪装成可检测失败。旧 completed ID 不因定义更新补发。
- 本 Task 不含 Runtime Editor、独立编辑器、附加 `when`、多前置关系、Init／全局目标实例、Roadmap、星野天台剧情等待、成就领取、重复或重置目标。完整作者范围留给后续独立 Task。
- 已裁定来源：[[draft-0156-area-achievement-demo]]。历史 [[draft-0152-milestone-listener-and-achievement-packaging]] 的 `next` 提议不进入本 Task。

## 当前事实与代码落点

| 已核实事实 | 源码／测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Datapack 已接收 `MilestoneDef{id,condition}`，Registry 可查询；分片与 ZIP 已包含 `milestones` | `src/data-services/contracts/datapack.ts`、`src/data-services/registry/registry.ts`、`src/data-services/datapack/fragment-parser.ts`、`zip-loader.ts`、`tests/data/fragment-parser.test.ts` | 扩声明和引用校验，复用现有包入口 |
| 完成事实 Save 级且幂等，Milestone Adapter 已管理基础 watch、完整重验、提交与撤出 | `src/arona-clicker/types/state.ts`、`state/state-mutation-service.ts`、`services/milestone-domain.ts`、`services/milestone-adapter.ts`、`tests/engine/milestone-runtime.test.ts` | 增加 Listener 效果及成就只读投影；避免第二份完成账本 |
| `stat` 能求值但 Milestone 当前不为它建立 watch；已有 Init 累计资源和物品收集 DSL | `src/engine/expression/condition-system.ts`、`stat-dsl.ts`、`src/arona-clicker/services/milestone-domain.ts` | 只为本 Task 使用的两个统计键证明 mutation→event→过滤→重验链 |
| Init／Area 到访事实已保存；`isFirstEnter` 为 InitService 局部判定，进入事件无该字段；`initEntered` 早于默认 Area 到访写入 | `src/arona-clicker/services/init-service.ts`、`src/arona-clicker/types/state.ts`、`src/engine/types/events.ts` | 默认 Area 和跨 Area 旅行都要在到访写入后完成准入对账；不假定存在 firstEntered 事件 |
| Records 服务页已路由，但当前仅显示内容规模和统计占位 | `src/ui/workspace/workspace-router.ts`、`src/ui/components/service-workspace.ts` | 在现有只读服务页建立最小成就入口，避免另造导航体系 |
| `StoryFollowUp` 已处理星野天台的剧情后等待进场 | `src/data-services/contracts/story-entry.ts`、`src/arona-clicker/services/story-follow-up-mount.ts`、`src/arona-clicker/content/story-conversation-walls.ts` | 它是现成的独立剧情机制，不是本 Task 的待实现依赖 |

立项时通用数据包导入与 ZIP 解析可复用，但尚无 Listener／Achievement 声明、引用校验和端到端样例；Milestone Domain 也没有 Area 准入过滤，`stat` 条件不能生成 watch。U01–U15 已补齐本 Task 所需范围，当前事实见 [[docs/docs-828/04-mechanisms/trigger-effect]]。

## 施工切片

### P0：声明和准入

- 确定隐藏 Milestone、受限 Listener 与可见 Achievement 的一对一最小引用契约；条件和 completed ID 保持单一来源。
- 为新声明补分片／ZIP 解析、Registry 引用校验和可定位错误；旧有未关联 Listener 的 Milestone 保持原有 P0 行为。
- 从当前 Init 的持久 `visitedAreas` 与仍存在的定义派生首期已发现投影，不增加第二份持久账本。默认 Area 在 Init 进入流程写入到访后对账，跨 Area 在旅行写入到访后对账；先挂精确监听，再重验当前条件。第二 Area 目标不能在首次到访前注册、完成或显示。

### P1：累计条件与效果

- 为示例使用的 `$InitProducedAmount` 与 `$InitCollectedAmount` 逐项证明统计写入、事件身份过滤与完整条件重验；不把任意 `stat` 宣称为响应式。
- 仅在首次成功提交完成事实后执行 Listener `then`；沿用现有 Effect 执行语义，声明类与 no-op 不伪装成可执行奖励。失败记入现有 DevLog 并带目标 ID，不补发、不重放。已完成目标撤出监听，返回 Init 或读档不会再次结算。

### P2：玩家展示与示范包

- 提供只读 Achievement 列表与简单数值进度，当前 Area 排前，离开 Init 后按各 Init 已保存的 Area 到访事实回看已发现项。
- Records 页面打开期间，资源或物品变化应及时刷新简单数值进度，不要求重开页面。
- 增加自包含的 1 Init／2 Area 示范包；第二 Area 起初可前往，两目标独立。资源与收集品、效果及展示文案只作为测试玩法数据，不写进基础引擎。

每个 P 均按 [[docs/ai/PROJECT-CONSTITUTION]] 冻结了 Patch Unit、Allowed Files、Read Set 与 Receipt；U01–U15 均已验收，单元记录随本 Task 归档。

## 测试与验收

- [x] 示例包可独立导入和启用；进入演示 Init 后默认 Area 成就出现，第二 Area 成就在首次到访前既不显示也不监听，到访后出现；两处目标的完成顺序互不依赖。
- [x] 累计资源在花费后不倒退，物品收集按该 Init 统计；简单目标显示正确的当前／目标值，达标时各完成一次。
- [x] 引入时已经达标会追赶完成；效果只在首次提交后尝试一次，失败留错误且不自动补发。离开 Init、返回和读档不重复执行。
- [x] 完成及已发现展示在可用定义下保持；Records 页打开时资源或物品变化会更新简单数值进度。无效引用或不支持的条件在数据包验证／准入时给出可定位诊断，不能静默伪装为可运行目标。
- [x] 星野天台现有 StoryFollowUp 行为与未关联 Listener 的旧 Milestone 行为不因新链路改变。
- [x] 定向测试覆盖分片／ZIP、Registry、统计唤醒、首访与重建、效果、UI 投影；`npx tsc --noEmit`、`npm test`、`npm run build`、`npm run check:architecture`、`npm run check:docs` 通过。本 Task 未改 `src/engine/types/`，无需重新生成 Schema。

## 当前核验（2026-09-26）

- Luna 先只读复核声明、监听、到访与进入顺序、统计、Records 页面及导入路径；其后按 U01–U15 分段实施，由上层逐段审查。下列 Unit 记录为实际验证结果。
- U01 已完成：新声明、JSON 分片与 ZIP 保留，定向测试 18/18、类型检查和文档检查通过；见 [[task-0157-area-achievement-demo-v1-u01-receipt]]。
- U02 已完成：Registry 查询、引用、一对一关系与 `then` op 加载期校验；定向测试 40/40、类型、架构和文档检查通过；见 [[task-0157-area-achievement-demo-v1-u02-receipt]]。
- U03 已完成：关联目标按当前 Init 与 Area 到访事实派生 Watch，旧 Milestone 原行为保留；定向测试 5/5、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u03-receipt]]。
- U04 已完成：旅行后的即时对账及默认 Area、读档、返回路径；定向测试 10/10、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u04-receipt]]。
- U05 已完成：两种指定 Init 累计统计的精确资源／物品唤醒与完整重验；定向测试 9/9、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u05-receipt]]。
- U06 已完成：首次提交后执行 Listener `then`，异常记录 DevLog 且不重放；定向测试 17/17、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u06-receipt]]。
- U07 已完成：已发现、完成与两种简单累计进度的只读投影及跨 Init 回看；定向测试 2/2、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u07-receipt]]。
- U08 已完成：GameReadModel 向 UI 暴露实时只读成就投影；定向测试 3/3、类型、架构与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u08-receipt]]。
- U09 已完成：Records 页按 Init／Area 分组显示已发现成就、线索、奖励和简单进度；定向测试 12/12、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u09-receipt]]。
- U10 已完成：Records 在场时合并事件并定点更新简单进度与状态，保留成就行节点；定向测试 8/8、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u10-receipt]]。
- U11 已完成：双区域示范 JSON 经正常设施产出与反复进场即可完成两个独立目标，首访前不展示或监听第二目标，效果仅首次到账；定向测试 2/2、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u11-receipt]]。
- U12 已完成：实际 ZIP 与源 JSON 字节一致，经玩家包解析器和 Runtime 包库启用验证；定向测试 3/3、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u12-receipt]]。
- U13 已完成：不支持的 Listener 条件在已访 Area 准入时记录一次带 ID 与具体叶条件的 DevLog 错误；定向测试 10/10、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u13-receipt]]。
- U14 已完成：真实演示数据与 Records 页面联动验证首访隐藏、1/3 到 3/3 的定点更新与完成状态；定向测试 1/1、类型与文档检查通过；见 [[task-0157-area-achievement-demo-v1-u14-receipt]]。
- U15 已完成：Registry、Effect/Trigger 模块与机制当前事实文档同步；文档检查与 diff 格式检查通过；见 [[task-0157-area-achievement-demo-v1-u15-receipt]]。
- 最终验证（2026-09-26）：`npm test` 199 个文件、1826 项全通过；`npm run build`、`npx tsc --noEmit`、`npm run check:architecture` 通过；`npm run check:docs` 与 `git --no-pager diff --check` 通过。真实 ZIP 经逐字节比对、解析、包库启用；UI 联动使用实际演示包而非 mock 投影。

## 剩余工作

- 本 Task 内：无待完成项。
- 最终方向仍缺：Init／全局目标、附加引入条件、多前置 AND、组合条件状态展示与 Runtime Editor 单流程创作；后续另立 Draft／Task，不把这些塞进示范施工。

## 归档结果

- 可导入演示包为 `datapack/area-achievement-demo.zip`；源 JSON 与玩家说明位于 `datapack/area-achievement-demo/`。
- 当前机制事实已同步至 [[docs/docs-828/04-mechanisms/trigger-effect]]、[[docs/docs-828/03-data-structures/registry]] 与 [[docs/docs-828/02-modules/ui]]；后续作者能力由 Goal Set 的 G02/G03 继续追踪。

## 相关路由

[[draft-0156-area-achievement-demo]] · [[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/effect-trigger]] · [[docs/docs-828/04-mechanisms/trigger-effect]] · [[docs/docs-828/01-architecture/state-layers]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[docs/ai/context-packs/datapack-schema]] · [[docs/ai/context-packs/production]]
