# Task 0233：Gameplay B 本地试玩台内容投送命令扩展

状态：complete — U1–U3 已完成；定向测试、类型检查、文档检查和本地浏览器验收通过，已归档。

## 目标

仅为 Gameplay B 本地测试扩展开发试玩台，使测试者能通过 `getValue Name [valueNum]` 为当前内存中的试玩状态投送内容。首期支持事件效果已有对应语义的 `resource`、`chara`、`spot` 类别；`area` 暂不支持。

本 Task 只为 Gameplay B 测试扩展本地开发工具，不新增正式玩家命令、通用内容调试框架、事件系统机制、存档字段或独立内容编辑能力。完成定义是：命令按严格 ID 解析首期类别，通过既有游戏状态变更入口应用，提供可读结果；非法或不支持的命令不产生状态写入。

## 设计裁定与边界

- 本 Task 包含：Gameplay B 本地试玩台命令语法、严格目标 ID、`resource`/`chara`/`spot` 三类投送、堆叠数量规则、结果反馈、定向测试及显式开发入口验收。
- 明确非目标：`area` 和其他类别支持、执行任意代码、任意对象路径写入、正式内容命令、游戏内普通用户入口、存档迁移、改造通用事件效果 API。
- 设计裁定：命令主形态为 `getValue Name [valueNum]`；首期支持 `resource`、`chara`、`spot`，`area` 暂不支持。`resource` 走 `addResource`，`chara` 走 `grantCharacter`，`spot` 走 `addSpotLevel`。
- 用户裁定数量初始规则：省略 `valueNum` 时默认为 1；只允许用于可堆叠目标；0 为 no-op；负数和非整数拒绝；角色命令每次只获得一次，不用 `valueNum` 重复获得。
- 保留现有夏莱办公室 Init 门槛及单目标语法。ResourceDisplay 定义没有独立 stackable 字段；首期把 Registry 已登记的 ResourceDisplay ID 视为数量型资源白名单。Spot 与 Chara 是非堆叠目标：省略数量时各执行一次，显式正数量不重复执行并提示该类别不接受数量；显式 0 统一 no-op。
- `Name` 严格采用 `modid:typeid:itemid` 三段 ID；只接受恰好三个非空段、由 ASCII `:` 分隔的形式，不接受显示名、别名、缺段、多段或自动猜类别。
- 用户裁定三段含义：`modid` = Datapack ID；`typeid` = 目标类别；`itemid` = 定义 ID。实现以 Registry 中来源 `modName` 与本地定义 ID 精确匹配。
- 实际允许类别为 `resource`、`chara`、`spot`；`area` 和其他类别返回不支持。`resource` 的数量白名单为 Registry 已登记 ResourceDisplay；Spot 固定 +1，Character 每条命令只调用一次获得。
- 保留既有夏莱办公室 Init 门槛和单目标语法；这些既有行为在本次未扩张。
- 只有通过严格三段解析并在当前 Registry / 明确白名单中解析成功的 ID 才能应用；不把未经校验的字符串直接传给任意状态字段。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 本地试玩台仅在开发模式且 URL 含 `devConsole=gameplay-b` 时动态挂载。 | `src/ui/main.ts: boot`，`gameplayBQuickTestConsoleEnabled` | 功能继续留在现有显式 opt-in 开发入口。 |
| 控制台目前只解析中英文“获得角色/grant character(s)”命令，角色和别名为三项静态白名单。 | `src/ui/development/gameplay-b-quick-test-console.ts: TEST_CHARACTERS / interpretGameplayBQuickTestCommand` | 需要从单一命令解析扩成受限的目标/操作解析；不得改成 eval 或通用脚本入口。 |
| 应用前要求当前 Init 为 `base:init:schale_office`；成功后用 `acquireCharacter`，然后调用可选刷新回调。 | 同文件 `mountGameplayBQuickTestConsole` 的 run handler | 场景门槛是否保留须裁定；输出反馈与 UI 更新需覆盖所有支持操作。 |
| 通用事件效果执行器现有 `addResource`、`setResource`、`addSpotLevel`、`setSpotLevel`、`addItem`、`grantCharacter`、`unlockInit` 等分支。 | `src/arona-clicker/state/effect-ops.ts: applyEffect` | 这些是可核对的候选动作，不代表每一种都属于本 Task 的“获取”语义。Area/Spot 对应关系仍需核验。 |
| 资源增量走 `changeResource`，会更新资源桶、统计并发出 `resourceChanged`；全局资源与普通资源分桶。 | `src/arona-clicker/state/state-mutation-service.ts: resourceBucket / changeResource` | 资源命令必须走 mutation API，以保留事件与统计联动。 |
| 角色获得统一走 `acquireCharacter`；首次获得与重复获得的效果不同，重复可能发碎片和奖励资源。 | `src/arona-clicker/state/state-mutation-service.ts: acquireCharacter`；`tests/engine/roster-system.test.ts` | `valueNum` 对角色是否适用不能直接按“重复 N 次”推断，需明确重获/批次数语义。 |
| 可堆叠物品存在 `addItem(itemId, count, maxStack)` 状态写入口。 | `src/arona-clicker/state/state-mutation-service.ts: addItem` | 物品可作为数量型候选，具体白名单和上限须从定义/Registry 核实。 |
| 本地控制台目标通过 Registry 的定义 ID 与来源 Datapack 解析；ResourceDisplay 有完整 resource ID，Spot 有 owner 查询，CharacterVariant 原有表未保留 source mod。 | `src/data-services/registry/registry.ts: resourceDisplays / spotOwnerOf / characterVariants` | U1 增加 resourceDisplay 与 characterVariant owner 查询；不从显示名、别名或未知 namespace 猜目标。 |
| ResourceDisplayDef 没有独立 stackability 字段，运行时资源 ID 白名单由已登记 resourceDisplays 提供。 | `src/data-services/contracts/common.ts: ResourceDisplayDef`；`runtime.ts: runtimeAuthoringValidationContext` | 首期将已登记资源视为数量型；Spot 与 Character 命令单次执行。 |

## 施工切片

### P0：冻结命令语义与可支持目标表（完成）

- 已核对三段 ID 与 Datapack 来源和 Registry 定义的对应关系，只纳入可安全调用既有状态变更入口的对象。
- 已确定首期类别、定义 ID、默认数量、数量校验、动作、保留的办公室门槛和结果反馈。
- 已将已登记 ResourceDisplay 作为数量白名单；Spot 每次 +1、Character 每条命令获得一次；未知/错来源目标拒绝，且不回退显示名或别名。
- Area 和其他首期范围外类别明确返回“不支持”，未添加新机制。

### P1：扩展开发控制台解析和应用（完成）

- 已把受限命令解析、目标归属解析和状态应用分开，并提供可单测的命令结果。
- 所有更改通过现有 `GameInstance.mutations` 写入口；应用成功后刷新界面。
- 对不支持目标、错误来源、无效数量、非法场景与 Spot mutation 拒绝提供稳定提示。
- 单条命令仅允许一个目标；多余参数、无效命令和拒绝条件均在写入前终止。

### P2：验证与稳定后更新机制记录（完成）

- 已覆盖命令语法、资源/角色/Spot、数量边界、错误来源、未知输入和 Area 拒绝的定向测试。
- 已在 DEV 浏览器中验证入口、命令结果与资源 UI 更新。
- 已更新 UI 模块卡，完成变更路径 Review、Evidence/maps_to 更新和 freshness 核验。

## Patch Units

### U1：Registry 内容来源归属查询

**Goal**：让本地测试命令可以验证 `modid` 是否为资源展示或角色差分定义的实际来源 Datapack。

**Read Set**：`src/data-services/registry/registry.ts` 中 TableStep、`currentPackModName`、resourceDisplays / characterVariants 合并；`tests/engine/registry.test.ts`；本 Task。

**Confirmed Facts**：Spot 已有 owner 查询；resourceDisplays 和 characterVariants 只有合并 Map，未保留 source mod。命令若只按可见定义查 ID，就无法保证 `modid` 对应定义来源。

**Allowed Files**：

- `src/data-services/registry/registry.ts`
- `tests/engine/registry.test.ts`
- `docs/plan-work/task-0233-mini-console-content-grants.md`

**Explicit Non-goals**：不改 Datapack Schema、存档、所有权解析规则或编辑器协议。

**Completion Criteria**：Registry 合并、覆盖和 clear 后准确报告两类定义的来源 modName；对应单测通过。

**Receipt**：新增 `resourceDisplayOwnerOf()` 与 `characterVariantOwnerOf()`，随 Registry merge/override 记录来源 Datapack ID，并在 clear 时清除；`npx vitest run tests/engine/registry.test.ts` 通过（44 tests）。

### U2：本地试玩台 getValue 命令

**Goal**：增加严格 ID 命令及 resource/chara/spot 三种既有事件式状态写入。

**Read Set**：本 Task；`src/ui/development/gameplay-b-quick-test-console.ts`；`src/arona-clicker/state/effect-ops.ts`；`src/arona-clicker/state/state-mutation-service.ts`；`src/data-services/registry/registry.ts` 的 owner 查询；`tests/ui/gameplay-b-quick-test-console.test.ts`。

**Allowed Files**：

- `src/ui/development/gameplay-b-quick-test-console.ts`
- `tests/ui/gameplay-b-quick-test-console.test.ts`
- `docs/plan-work/task-0233-mini-console-content-grants.md`

**Constraints**：只接受三段式 ID；resource 用登记的 ResourceDisplay 作为目标白名单并按 valueNum 增加；chara 校验 definition owner 后调用 acquireCharacter 一次；spot 校验 spotOwnerOf 后调用 addSpotLevel 一次；0 不写状态；保留夏莱办公室门槛、旧角色命令及开发模式 opt-in。

**Explicit Non-goals**：Area、Item、任意效果执行、别名匹配、批量命令、改 UI 启动路由或产品事件机制。

**Completion Criteria**：已知资源/角色/Spot 成功；错误 namespace、未加载 mod、未知 ID、非法数值、非堆叠数量、Area 和其他类型不写入；命令结果准确反映 mutation 结果；定向测试和类型检查通过。

**Receipt**：`getValue modid:typeid:itemid [valueNum]` 解析仅接受严格三段式 ID，走既有 mutations 写入口并保留原角色快捷命令；覆盖无效 ID/数值、错误来源、Area、堆叠数量、零值及三类行为。`npx vitest run tests/ui/gameplay-b-quick-test-console.test.ts` 通过（7 tests），`npx tsc --noEmit` 通过。

### U3：更新 UI 模块事实并收尾归档

**Goal**：将稳定的开发控制台命令范围写入当前 UI 模块卡，复核所有变更路径，然后完成 Task 归档。

**Read Set**：`docs/docs-829/02-modules/ui.md`；本 Task 与 U1/U2 Receipt。

**Allowed Files**：

- `docs/docs-829/02-modules/ui.md`
- `docs/plan-work/00-index.md`
- `docs/plan-work/task-0233-mini-console-content-grants.md`
- `docs/plan-work/archive/task-0233-mini-console-content-grants.md`

**Completion Criteria**：机制卡准确描述 DEV/URL 门槛、内存态、支持类型与写入口；文档检查通过；Evidence/maps_to 复核完成；Task 标记完成并归档，活动索引不再列作待施工。

**Verification**：`npx vitest run tests/engine/registry.test.ts tests/ui/gameplay-b-quick-test-console.test.ts`；`npx tsc --noEmit`。

**Receipt**：更新 UI 模块卡，记录开发入口、内存态、资源/角色/Spot 范围及不支持的 Area。`npm run check:docs` 通过（648 Markdown、0 errors），`git diff --check` 通过。浏览器使用 `?devConsole=gameplay-b` 打开控制台并进入夏莱办公室后，执行 `getValue base:resource:credit 25`；结果显示“信用点 +25。界面已刷新”，资源栏同时更新，控制台标明刷新页面即清空。

## 测试与验收

- [x] 命令只接受严格 `modid:typeid:itemid` 三段式 ID；无效格式、显示名/别名及未知 ID 均被拒绝且不写状态。
- [x] 首期仅支持 `resource`、`chara`、`spot`；分别沿用既有状态变更入口，`area` 和其他类别拒绝且不写状态。
- [x] Registry ResourceDisplay 是数量型资源白名单；Spot 每条命令 +1，Character 每条命令获得一次。
- [x] 命令合法形式、默认值与错误格式有可读反馈；0 为 no-op，负数、小数和非堆叠目标数量拒绝。
- [x] DEV + `?devConsole=gameplay-b` 入口和夏莱办公室场景门槛保留；试玩改动只驻留当前页面内存。
- [x] 定向测试、类型检查、文档检查、浏览器验收和 GALHCG Evidence/maps_to 闭环通过。

## 当前核验（2026-10-05）

- 已读 `docs/ai/goal-workflow.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/execution-task.md`、UI 模块卡与相关生产/角色/世界生命周期上下文包；并按源码和测试确认写入口、Registry 所有权和 UI 启动条件。
- 用户裁定 `modid:typeid:itemid` 含义为 Datapack ID、目标类别、定义 ID；首期支持 resource/chara/spot，Area 暂不支持；数量默认 1，仅对资源白名单生效，0 no-op。
- 验证：`npx vitest run --silent tests/engine/registry.test.ts tests/ui/gameplay-b-quick-test-console.test.ts` 通过（2 files、51 tests）；`npx tsc --noEmit` 通过；`npm run check:docs` 扫描 648 篇 Markdown、0 errors；`git diff --check` 通过。
- 浏览器验收：以 DEV URL 参数 `?devConsole=gameplay-b` 打开试玩台，经正常流程进入夏莱办公室后执行 `getValue base:resource:credit 25`。控制台反馈“信用点 +25。界面已刷新”，资源栏随即更新，控制台注明刷新页面即清空。

## GALHCG 影响闭环

- 项目解析为 `acprogram`，路径搜索与局部源码/测试证据作为机制导航依据；不以宽域查询超时或零命中推断实现不存在。
- 对 Registry、控制台、相关测试、UI 模块卡、Task 与索引路径执行 `review_changes`；所有直接关联的 Evidence 与 maps_to 角色均按最终文件状态更新。
- Task 完成后移入 `docs/plan-work/archive/`，索引改为归档入口；旧 Task 路径映射清除，新归档路径与更新后的索引建立/更新关系。地图变更使用新鲜路径令牌，经过 `plan_map_updates` 以及完整有效的 dry-run 后提交，再核对映射。
- 未创建新机制概念；仅更新 Registry、测试台、UI 命令与规划归档等直接受影响的既有节点/关系。

## 剩余工作

- 本 Task 无剩余工作。未来若需增加 Area 或其他类别，应重新核对其状态 owner 与合法写入口，再单独裁定范围。

## 相关路由

[[docs/ai/goal-workflow]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/ai/galhcg-project-map]] · [[docs/ai/context-packs/ui-presentation]] · [[docs/ai/context-packs/production]] · [[docs/docs-829/02-modules/ui]] · [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]] · [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]
