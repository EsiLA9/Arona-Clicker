# Task：Gameplay B Character Hand、Swap 与 Action Commit

**状态：complete — Task 0287 的 C3 Character Hand、Swap、PlayerCost Command、Commit 与 Encounter UI 交付完成**

## 目标

在已完成的 Map / Node / Encounter / MapRun 生命周期上，交付完整可玩的角色行动轮：Encounter 按参与者倾向抽取有限 Hand；每名角色有明确的准备行动和目标；玩家可免费换成自己手牌中的另一项，或花费 PlayerCost 指令角色执行手牌外行动；一次成功提交结算本轮行动、推进轮次并抽取下一轮 Hand。

这不是旧 Operation 体系的改名版。新内容不要求 `OperationEvent`、`Location`、`Scene`、`StudentProfile`、`CardPool` 或 `StrategyProfile`；旧 Runtime 只可供参考抽样算法、目标校验和原子提交模式。

## 冻结的玩家行为

| 概念 | C3 合同 |
|---|---|
| **Draw / Hand** | 进入 Encounter，以及上一轮成功 Commit 后，为每名当前可行动的固定队员从 Encounter 提供的合法 Action 候选中按 Tendency 权重抽取最多 3 个互不重复的候选，不放回。候选不足就少抽；没有合法候选时显示明确的 `Wait / 无可行动`，不能因 View、Preview、打开 UI 或恢复存档重新抽。Hand 是 Action ID 列表，不是物理卡堆。 |
| **Prepared Action** | 每个队员默认准备 Hand 中第一张抽到的 Action，并展示该行动及目标。目标规则只有一个合法对象时自动填入；有多个时由玩家选取。没有可抽 Action 时准备为 `Wait`。自动 Planner 可以辅助补全目标，但不得改选 Hand 外 Action，也不得覆盖玩家当前有效选择。 |
| **Swap** | 玩家可免费将一名队员的 Prepared Action 换成该队员当前 Hand 中的另一张 Action；不补牌、不重抽。全队每轮共享一个 override 槽，Swap 与 PlayerCost Command 只能择一生效。有效草稿可在提交前修改或清除。 |
| **Player Command** | 玩家可指定一名队员执行该 Encounter 当前允许、但不在其本轮 Hand 内的 Action；每次固定消耗 1 点 MapRun PlayerCost，并占用与 Swap 共用的 override 槽。Actor / Team Action cost 仍需另外满足。费用只在 Commit 成功时扣除。 |
| **Commit** | 一次 Commit 结算全队这一轮的准备行动；一个 Swap 或 Command 只替换其中一名队员的行动。按 MapRun 固定队伍顺序在 detached 草稿上逐项验证并应用费用 / 效果，任一项失败则整轮不写入。成功后只推进一次轮次并抽取下一轮 Hand；重试或过期提交不能重复结算。全员均为 Wait 时也允许提交一次无效果轮次，供遭遇继续推进；只有成功 Commit 才会进行下一次 Draw。 |

候选行动、准备目标、当前 override 和随机上下文全都属于当前 Encounter；完成 Encounter 后清理，不带进下一处。PlayerCost 与 Actor / Team 资源余额属于 MapRun，跨 Encounter 保留。长线 PlayerState 只用于队伍准入，不能作为局内费用或 HP 的隐式来源。

## 作者数据与最小 Action 结果

Map 是可独立加载与版本化的内容包。C3 的作者语义收敛到：Map 内只定义一份可复用的 Action 列表；Encounter 参与者引用本 Map 内的 Action ID，并为自己可执行的候选 Action 配置正整数 Tendency 权重。Encounter 不再通过 Profile / CardPool / StrategyProfile 拼装候选。

Action 至少包含展示信息、角色资格、目标规则、可选 Actor / Team resource cost 与效果。第一版只需支持无目标、自身、固定队伍任一角色这些目标；至少支持改变 MapRun-local Actor / Team resource 的效果，使 C3 Commit 有可观察的真实结果。初始 Actor / Team resource 余额必须由 Map 内容明确提供并在 MapRun 启动时冻结；未声明值按 0 处理。不得从 PlayerState 成长值或旧 EventRun 导入。

Map 的 `resumeVersion` 覆盖本 Map 的 Action、参与者候选权重、目标与效果规则。任一会影响活动 Run 恢复的规则变更，都必须提升该版本；恢复时还需对存档 Hand、目标、override 与资源状态逐项校验。

C3 的 Action / Effect 处理为 C4 建立唯一可扩展的结算管线。C4 在同一版本校验、费用计划与原子提交点上增加 HP / Enemy 状态、失败终态、Ability 与 Item；不得再建另一套 Combat Commit 或另一个运行状态 Owner。C3 不创建空 HP 字段、不引入 Enemy HP、不实现 Ability / Item。

## 唯一状态 Owner 与生命周期

| 生命周期 | C3 状态 | 创建 / 更新 / 清理 |
|---|---|---|
| **Persistent PlayerState** | 已拥有 / 解锁角色、永久成长与物品。 | MapRun 开始时只读准入；C3 的 Draw、Swap、Command、Action Commit 不写入。 |
| **MapRun-local** | 当前位置、节点进度、固定队伍、PlayerCost、明确初始的 Actor / Team resource 余额。 | MapRun 开始时从 Map 声明初始化；每轮费用与效果在同一成功 Commit 中更新；进入下一 Encounter 时保留；MapRun 结束时清理。 |
| **Encounter-local** | 当前 Node、轮次、角色 Hand / 抽取顺序、Prepared Action / Target、共享 Swap / Command override、抽样状态和必要的提交版本。 | 进入 Encounter 时建立；View / Preview 不写入；成功 Commit 时整体推进；Encounter 成功 / 失败后清理；Save / Resume 原样校验恢复。 |

继续使用 GameInstance 内的 `MapRunService` 作为唯一可写 Owner。可把 C1 的活动 Encounter Node 标记升级为包含真实 Encounter-local 状态的对象；不得同时维护两个可独立修改的活动 Encounter / 当前位置副本。Query、Workspace 和 SaveData 只能读取或承载这个 Owner 的版本化快照。

## 当前背景与实施约束

- 当前 `GameplayEncounterDef` 只有展示信息和 C1a 手动完成配置；没有参与者、候选 Action、Tendency、Hand、Prepared Action、Swap / Command 或轮次提交。
- `MapRun` 当前保存固定队伍、PlayerCost、当前位置与活动 Encounter Node 标记；没有 Action resource、Encounter 行为快照或轮次 RNG。
- 旧候选 Resolver 有加权、不放回算法；旧 Operation Planner、Profile 优先级、Action 条件与 Event 上下文不能原样成为新语义。
- Save / Resume 已通过 `MapRunSaveSnapshot` 保存同一 MapRun Owner，C3 应扩展这个 checkpoint，不新增 Encounter 顶层 Save Owner。
- 目前独立 Datapack Editor 尚无 Maps 表；C3 先保证正式 Datapack → Registry → Resolver → MapRun 路径。C5 收尾时必须明确新作者内容可用的受支持编辑入口。按照项目 `AGENTS.md`，不得修改生成 Schema；如需编辑器字段，使用可维护的非生成 Schema 源或停止并报告具体缺口，不得手改 `engine-defs.gen.json`。

## 范围内

- Encounter 参与者、合法 Action 与 Tendency 的作者契约及 Registry 引用 / 数值校验。
- MapRun-local 初始 Actor / Team resource 来源和余额；Encounter-local Hand / Prepared / Target / override / RNG / 轮次状态。
- 抽样、目标合法性、免费 Swap、PlayerCost Command、费用可支付性与版本化原子 Commit。
- Workspace 只读投影与必要交互，让玩家看见完整 Hand、每名角色的准备行动和目标、共享 override、费用 / 结果与失败原因。
- Save / Resume 不重抽、不丢草稿、不重复提交；Encounter 切换清理本地状态而保留 MapRun 余额。
- 至少两个队员、三种候选行动、不同 Tendency 和一项可观察 Actor / Team resource 变化的新 Encounter 样例。

## 范围外

- Character / Enemy HP、HP 上限与起始来源、Enemy 行为、全队 HP 归零失败结果、撤退或重试。
- Player Ability、Item Use、冷却、一般卡组构筑、实体抽牌堆 / 弃牌堆。
- 旧 EventRun 的保存迁移；Gameplay B 旧 Datapack 记录的最终删除 / 重建由 C5 完成。
- 大型 Combat 类型枚举、Planner DSL 或第二套地图 / 遭遇 Runtime。

## 验收标准

1. Registry 拒绝重复或不存在的 Map-local Action、非法参与者 / 候选引用、重复候选、非正 Tendency、错误目标 / 费用 / 效果及无效初始资源；默认新样例从正常 Datapack 入口加载。
2. 进入 Encounter 生成最多 3 张互不重复 Hand；分布测试证明权重会影响抽取。候选不足少抽、无候选显示 Wait；View、Preview、关闭 / 重开 UI 均不重抽。
3. Prepared Action 是首张抽取候选，目标合法且可见；多候选目标能被显式选择。玩家 Swap 后，Planner 和重绘不能覆盖选择。
4. 合法 Hand 内 Swap 免费；非法 Swap、非法 / 不可支付的 Player Command、失效目标和过期版本请求不改变 Hand、准备行动、PlayerCost、Actor / Team resource、RNG 或历史。
5. PlayerCost Command 只选 Hand 外行动、精确花费 1 PlayerCost、与 Swap 共用全队每轮一个槽；普通 Swap 不扣 PlayerCost。Action 自身 Actor / Team cost 另行结算。
6. 成功 Commit 产生可观察的 Action / Target 结果和 resource 变化，恰好结算全队一轮；费用、效果、历史、轮次与下一 Hand 原子一致。重复或失败 Commit 不产生部分写入或额外抽取。
7. Checkpoint 恢复 Hand 顺序、Prepared Action / Target、override、轮次、资源与 RNG；续跑结果与未中断 Run 一致。拒绝无效快照时不能安装半个 MapRun。
8. Encounter 结束后清空 Hand / Prepared / override / encounter RNG，PlayerCost 与 Actor / Team resource 保留；新 Encounter 按其内容重新 Draw。
9. 玩家只使用 Workspace 展示和 Controller 命令，不直接操作 Registry / MapRun Owner；UI 状态变化不重建无关页面区域，也不把 Action 内容复制成第二份 UI 数据。
10. 既有 C1 / C2 正常 Map / Spot 入口、MapRun 存档和 Encounter 成功回图回归通过。

## Patch Units

- [[task-0290-gameplay-b-action-draw-hand-swap-commit-units/U1-encounter-action-contract]]：Action / Encounter 作者数据与 Registry 校验。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U1-encounter-action-contract]]。
- [[task-0290-gameplay-b-action-draw-hand-swap-commit-units/U2-hand-draw-and-checkpoint]]：MapRun 唯一 Owner 中的 Draw、Hand、确定性 RNG 与 checkpoint。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U2-hand-draw-and-checkpoint]]。
- [[task-0290-gameplay-b-action-draw-hand-swap-commit-units/U3-prepared-action-and-override]]：Prepared Action / Target、Swap 与 PlayerCost Command 草稿校验。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U3-prepared-action-and-override]]。
- [[task-0290-gameplay-b-action-draw-hand-swap-commit-units/U4-round-commit-and-resource-effects]]：真实整轮 Commit、费用 / Resource 效果原子结算及去重。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U4-round-commit-and-resource-effects]]。
- [[task-0290-gameplay-b-action-draw-hand-swap-commit-units/U5-workspace-interaction]]：只读行为投影、Map Workspace 手牌交互和命令接线。实现、验证及独立复核完成。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U5-workspace-interaction]]。
- [[task-0290-gameplay-b-action-draw-hand-swap-commit-units/U6-encounter-region-refresh-and-e2e]]：Encounter 区域局部刷新、交互连续性和真实 Datapack 端到端验收。实现、验证及独立复核完成。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U6-encounter-region-refresh-and-e2e]]。

## 执行纪律

- 每个 Unit 先核对自己的 Read Set 和直接调用方，再按 Allowed Files 实施；若发现需要改出边界，先报告给总控拆分。
- Luna Max 子 Agent 可负责实施 Unit；另一个未参与实施的 Agent 做只读独立审查。总控负责合并合同、验证跨 Unit 链路和更新 Task / Receipt。
- 变更 Datapack 契约时遵循 `schema-sync.md` 中的源文件维护规则，但服从 `AGENTS.md` 禁改生成产物的项目边界；不得直接编辑或提交 `engine-defs.gen.json`。
- 界面沿用当前 Map Workspace 的视觉样式。U5 / U6 实现前遵照紧凑 DOM 草图核查相近 UI；U5 使用既有 Map Workspace region refresh，保留导航、当前 Node、滚动与有效焦点；U6 再将行动更新收窄至 Encounter 子区域。不另造视觉方向或卡牌构筑控件。
- 核心测试按项目测试规范运行。任何抽样、存档、Command、Commit 或 UI 链路失败都必须修复后再完成 Task。
- 只读 GALHCG 核查并回到源码复核；本 Task 不授权写图、刷新 freshness 或改 Evidence。

## 后续依赖

- C4：在同一 MapRun Commit 管线中加入 HP / Enemy 状态与全队 HP 归零失败、失败结果页、HP 显式起始值 / 上限来源、Ability 与 Item；不重做 C3 Draw / Swap / Commit。
- C5：按 Task 0287 退役 Gameplay B 旧 Operation 数据和依赖，重建完整最小样例，补齐受支持的作者编辑入口和最终 Save / Resume 兼容处置。

## 当前进度

- U1 已完成：Map-local Action / Encounter 候选 / Tendency / 初始 Actor-Team resource 作者契约、Registry 校验与真实样例；初次独立审查的 P2 未知字段接受与 P3 重复准入覆盖缺口均已修复，二次审查通过。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U1-encounter-action-contract]]。
- U1 验证：`npx vitest run tests/data/gameplay-b-map-registry.test.ts` 72/72、`npx tsc --noEmit`、`git diff --check` 通过。
- U2 已完成：MapRun 唯一 Owner 持有活动 Encounter、固定队伍 Hand 与 RNG；按 Actor / Team 当前余额过滤不可支付候选；Restore 重演并验证 Hand；完成 Encounter 时清理局部数据并保留 MapRun 资源。独立只读复核通过。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U2-hand-draw-and-checkpoint]]。
- U2 验证：三个定向测试文件合计 20/20、`npx tsc --noEmit`、白名单文件 `git diff --check` 与尾随空白检查通过。
- U3 已完成：自然 Prepared 从 Hand 首项推导；Target 支持 none / self / 单一默认 / 显式多目标；免费 Swap 与精确 1 PlayerCost 的手牌外 Command 使用唯一共享 Override。复合 Node / round / draftVersion 令牌拒绝旧草稿；错误输入不写入。独立复核通过。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U3-prepared-action-and-override]]。
- U3 验证：定向测试 24/24、`npx tsc --noEmit`、diff 检查及白名单文件尾随空白检查通过。
- U4 已完成：自然行动、Swap 与 PlayerCommand 共用版本化 MapRun 整轮 Commit；先以提交起始余额联合支付 Actor / Team costs，再按固定队伍顺序应用 Effects；成功后原子记录结果、推进 round、用新余额抽下一 Hand。GameCommands 经 GameInstance 窄转发到私有 Owner。Restore 拒绝伪造多 Override receipt；独立复核通过。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U4-round-commit-and-resource-effects]]。
- U4 验证：定向测试 38/38、`npx tsc --noEmit`、授权文件与新增文件空白检查通过。
- U5 已完成并通过独立只读复核：只读 Workspace 投影提供完整 Hand / Prepared / Target、PlayerCommand affordability、资源、最近回执与共享 Commit Preview；Controller / GameCommands 接通 Swap、Command、Target、清除与 Commit。定向测试 36/36；Map / Registry / Resolver / Runtime Integration / Save-Resume / 正常入口 / Workspace 八个文件 123/123；`npx tsc --noEmit`、白名单检查及文档检查通过。独立审查无阻塞；失效控件焦点目前回到地图标题，U6 负责改善遭遇区内的焦点恢复。Receipt：[[task-0290-gameplay-b-action-draw-hand-swap-commit-units/receipts/receipt-U5-workspace-interaction]]。
- U6 已完成并通过独立只读复核：手牌 / 目标 / Override / Commit 只更新 Encounter 子区，保留三栏、Node、route、滚动与有效焦点；异常时显式恢复。Spot 正式入口竖切片覆盖两名角色、Swap、过期请求不重抽、PlayerCommand、资源效果、Encounter 完成回原 Node。八个 Map 回归文件 124/124、`npx tsc --noEmit` 和白名单差异检查通过；独立审查无阻塞。浏览器验收因 computer-use skill 的 Edge 激活失败恢复规程停止；详见 Receipt。

## Read Set

- `docs/plan-work/archive/draft-0287-gameplay-b-phase-b-contract.md`：已冻结的 Draw、Hand、Swap、Command、Commit、MapRun 生命周期。
- `docs/plan-work/archive/task-0287-gameplay-b-semantic-convergence-and-minimal-loop.md`：总控 C3 / C4 / C5 阶段边界。
- `src/data-services/contracts/gameplay-map.ts`、`src/data-services/contracts/datapack.ts`、`src/data-services/registry/registry-validate.ts`：作者契约和内容准入。
- `src/arona-clicker/contracts/map-run.ts`、`src/arona-clicker/services/map-run-service.ts`、`src/arona-clicker/runtime-game-instance.ts`：唯一状态 Owner、checkpoint 和查询接线。
- `src/arona-clicker/services/operation-card-candidate-resolver.ts`、`operation-tactical-rng.ts`、`operation-plan-preparation.ts`、`operation-intervention-preview.ts`、`operation-runtime-service.ts`：只读复用算法 / 校验 / 事务模式，不沿用 Operation 内容语义。
- `src/arona-clicker/contracts/runtime.ts`、`src/arona-clicker/runtime-commands.ts`、`tests/engine/gameplay-b-map-*`、`tests/ui/gameplay-b-map-*`：命令、投影、存档和 C1 / C2 回归。
- UI Unit 额外读取 `docs/ai/context-packs/ui-presentation.md`、项目现有 `Map Workspace` 与 `Operation Workspace` 对应样式；新增 UI 需遵守 `frontend-design` skill。

## 停止条件

- 任何实现提议要新增第二个可写 Map / Encounter Runtime Owner，或将 `PlayerState` / `EventRun` 当作局内数据来源。
- 无法确认稳定的 Actor / Team resource 初始来源，或需要隐式读取长期养成值才能让行动运行。
- 需要手改生成 Schema 才能完成 C3；先提交具体技术缺口给总控，不得绕过 `AGENTS.md`。
- Action Commit 需要借用旧 Scene / Location 语义，或 C3 想提前加入 HP / Enemy / Ability / Item。
- 无法在不扩大 Unit 的前提下满足真实 Datapack → Registry → Resolver → Runtime 行为链。

