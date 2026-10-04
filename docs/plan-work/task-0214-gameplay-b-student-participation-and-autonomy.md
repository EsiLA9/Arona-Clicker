# Task 0214 — 玩法 B 学生参与与自主行动 Profile

状态：active — 0214-U2 ready

## 目标

让由 AC Character 身份选入的学生以独立 Event Actor 参加事件，并用可解释、与持久角色数据松耦合的操作 Profile 表达现场专长、行动倾向和候选行动范围。

## Why

学生必须影响“能做什么、先做什么、现场结果如何”，而不能只作为显示资料或数值倍率。长期角色成长和事件临时状态需要独立拥有者。

## Scope

- 事件入场时按 Character ID 解析学生身份；只有持有至少一个真实 CharacterVariant 的学生可以进入玩家队伍。
- 以独立的 `StudentOperationProfileDef` 描述行动优先级、能力、候选行动、可读理由和可选角色随机技能规则引用。
- Profile 对一次事件入场预解析；把需要供本局决策读取的身份/Profile 信息复制到 EventRun Actor 快照，不把持久角色对象引用放入 Run。
- 至少一种 Profile 专属现场能力必须改变处理问题的可行方案；数值倍率或普通标签差异不能单独满足此条件。
- 无合法候选行动时返回显式 Observe/Wait 安全回退和理由。
- 角色、Profile、HP、操作资源及临时状态均与 PlayerState / InitSnapshot 长期角色进度隔离。
- 对手与环境参与者可使用同一 EventRun Actor 管线，不要求 AC Character 定义、玩家 roster 或学生 Profile。

## Non-goals

- 不修改 `CharacterData`、`CharacterVariantDef`、`VariantProgress`、Character Schema 或 PlayerState 字段；不建立角色养成、好感、社团模拟或敌人收集系统。
- 不在本 Task 执行角色随机技能，不实现 Seed/Cursor 消费或 Commit 时触发；这些行为由 Task 0215 负责。
- 不实现 PreparedBeat、玩家干预、统一 Resolution、UI、Location 路线或 Datapack。
- 不让玩家逐个为所有学生挑选行动；有限指挥由 Task 0215 实现。

## 已核实事实与跨 Unit 约束

### Confirmed Facts

| 事实 | 证据 | 设计影响 |
| --- | --- | --- |
| `CharacterSystem.getUnlocked(state)` 通过 `state.roster` 中的 variant ID 调用 Variant→Character resolver，并只返回已加载的非 `Character.None` Character 定义；GameInstance 的 resolver 从 Registry 的 `characterVariants` 读取 `proto`。 | `src/arona-clicker/services/character-system.ts`：`getUnlocked()`；`src/arona-clicker/runtime-wiring.ts`：`setVariantProtoResolver()`；`src/arona-clicker/runtime-game-instance.ts`：加载 Character 定义 | 学生入场必须使用 `getUnlocked()` 核验 Character 已持有且角色定义真实存在，并验证至少一个真实 Variant 与该 Character 对应。 |
| `RosterSystem.getOwned()` 直接读取 `state.roster[variantId]`；`isOwned()` 只判断该结果是否为 `undefined`，不负责验证 Variant 定义、Variant 的 `proto` 或 Character 定义。 | `src/arona-clicker/services/roster-system.ts`：`getOwned()`、`isOwned()` | 不能只用 `RosterSystem.isOwned()` 作为学生身份与持有资格检查。 |
| `CharacterData` 保存基础身份资料；`CharacterVariantDef` 是角色差分定义；持久的 `VariantProgress` 属于玩家 roster。它们当前没有玩法 B 的 StudentOperationProfile。 | `src/data-services/contracts/character-data.ts`；`src/data-services/contracts/character-variant.ts`；`src/arona-clicker/types/state.ts` | Profile 单独建模，不向 Character 或 Variant 持久 Schema 添加现场战术字段。 |
| 当前 `OperationActorDef` / `OperationActorState` 只有 ID、type、HP 和 resources；EventRun 尚无 Character identity、Profile 或 faction 字段。`OperationEventDef` 对 Location 只声明地点 ID 集合，没有 `LocationDef`。 | `src/arona-clicker/contracts/operation.ts`；`src/arona-clicker/services/operation-runtime-service.ts`；`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | Task 0214 通过三个 Unit 增加初始参与者与 Profile 快照；此刻只能按 EventDefinition 级别声明参与者。 |
| `OperationRuntimeService.start()` 接收原始 EventDefinition，验证后即创建 Run 并发布 `runStarted`、`locationEntered`；当前 `GameInstance.operationRuntime` 公开该 owner 的 start、state delta、finish、reset 与 dispose 等方法。它不读取 PlayerState、CharacterSystem 或 RosterSystem。随机字段当前只有 seed/cursor 快照，没有消费接口。 | `src/arona-clicker/services/operation-runtime-service.ts`；`src/arona-clicker/runtime-game-instance.ts`：`operationRuntime`；`src/arona-clicker/runtime-wiring.ts`；`src/arona-clicker/contracts/operation.ts`：`EventRun.random` | U1 必须关闭这个 raw-owner 旁路：GameInstance 只暴露 ID 入场门面与只读快照，受信内容解析和 roster/Profile admission 成功后才能调用私有 owner。不要在本 Task 另造 RNG。 |
| EventRun 是独立易失状态，不属于 PlayerState、InitSnapshot 或 SaveData；当前 Runtime 通过 detached 快照读出 Run。 | `docs/docs-829/02-modules/arona-clicker.md`；`docs/docs-829/03-data-structures/player-state.md`；`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 仅复制事件实际需要的局内初值和 Profile 语义，不写入长期角色状态。 |

### Constraints

- 学生入场需同时核实：Character 定义存在且 `CharacterSystem.getUnlocked(state)` 包含该角色；存在 Registry 中真实、已持有、`proto` 与该 Character ID 相符的 Variant；被引用的 Profile 存在且 `profile.characterId` 与该学生相符。不得只调用 `RosterSystem.isOwned()`。
- GameInstance 的公开入口只接受稳定 `eventId` 与 `CharacterId[]`；event 内容、Actor/Profile 定义只能由构造时注入的受信 resolver 按 ID 查得。不得接受调用方传入 EventDefinition、ActorSpec、Profile 或解析后对象。
- `OperationRuntimeService` 是内部 EventRun owner，不作为 GameInstance 公共属性或 public facade 返回。公开 `operationEntry`（名称可依实现微调）只提供受控 `start(eventId, characterIds)` 和 detached read-only snapshot；不暴露 `applyStateDelta`、`finish`、`reset`、`dispose` 或 owner lifecycle subscription。
- EventRun 生命周期清理仍由 GameInstance 内部完成。后续玩法命令经专用受控领域服务增加，不重新公开通用 raw-owner 写入口；UI GameCommands 接线留给 Task 0216。
- Profile 与 CharacterVariant / VariantProgress 保持松耦合。Character / Variant 的基础 Schema 不承载 Profile 细节，持久成长数据不充当 ActorState。
- 对手和环境 actor 按自身 `participantKind` / faction 等事件内容输入解析，不经过玩家 roster admission；非学生身份不伪造 Character ID 或 StudentOperationProfile。
- 为同一 EventDefinition 的入场建立 Profile ID/Character ID 索引并完成解析；同一运行后续准备不得重新扫描 roster、Registry 或全部 Profiles。
- `StudentOperationProfileDef` 可以声明可选的角色随机技能规则 ID，并声明该规则不支付路线级 `PlayerCost`。技能规则的具体触发结果、Seed/Cursor 消费、预览不推进随机流和仅有效 Commit 才触发均归 Task 0215；本 Task 不实现这些运行行为。
- 参与者先作为 EventDefinition 的初始参与者输入；Location 中嵌入 participant 的形状、每地点加入/移除和路线覆盖，是 Task 0218/0220 的后续映射点。本 Task 不提前定义 Location 或 Datapack 合同。
- `ParticipantSpec` 中原先提出的“优先嵌入 Location”尚无当前 `LocationDef` 可承载，现收窄为未来迁移方向，不是本 Task 的实现要求。
- ReadModel 理由字段由 Profile resolution 提供稳定原因信息；PreparedBeat 中“此刻为何选择此行动”的最终解释由 Task 0215 组合 Profile 与当前局势生成。

## 保留的设计输入

早期用户裁定要求保留角色自己的随机技能，并且不新增消耗路线级 PlayerCost 的角色主动技能（[[draft-0204-gameplay-b-map-and-player-actions]]）。旧原型将角色技能表现为满足条件后的额外随机检查，而不是玩家场景卡组的抽牌（[[draft-0209-gameplay-b-current-loop-and-identity-review]]）。这是 AC-native 玩法设计输入，不代表 AC 当前已有该 Runtime。Profile 专属现场能力与随机技能规则并行表达。为符合 Draft 0212 的 Commit-only RNG 裁定，随机技能仅在 Task 0215 的有效 Commit 结算阶段消费 EventRun 随机流。

## Runtime Flow

GameInstance 公共 `operationEntry.start(eventId, characterIds)` → 私有受信内容 resolver 按 eventId 取 EventDefinition 与 Profile → U1 核验学生 Character、真实 Variant/Profile 配对 → 全部通过后才由 EntryService 调用私有 OperationRuntimeService owner → U2 将已解析参与者/Profile/faction/能力/优先项快照放入 EventRun Actor → Task 0215 从快照准备行动并在有效 Commit 时处理随机技能。公开读取只返回 detached snapshot；对手/环境参与者绕过玩家 roster admission。

## Dependencies

- Task 0213 已完成并归档；U1 将有意收紧其原先公开的 `GameInstance.operationRuntime` raw-owner 接口。当前 Runtime 契约及机制文档是本 Task 的 Read Set。
- Task 0215 使用本 Task 的 EventRun Actor 身份快照、Profile 候选和能力结果。
- Task 0216 使用本 Task 的 Profile/Actor 显示语义与样例验收；正式游乐园内容入口由 Task 0216 提供。
- Task 0218/0220 将 EventDefinition 级参与者输入迁移或映射到正式 Location / Datapack 内容合同。

## Patch Units

### Unit 0214-U1：入场身份/持有校验与候选 Profile 独立契约

状态：completed

#### Goal

关闭 GameInstance 对 raw EventRun owner 的公共入口，建立受控 `operationEntry.start(eventId, characterIds)`；只从受信内容 resolver 读取 EventDefinition/Profile，核验玩家学生身份和持有后才调用内部 owner。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/05-conventions/architecture-discipline.md` | 确认产品服务与局部 Runtime 的边界。 |
| 文档 | `docs/docs-829/02-modules/arona-clicker.md`、`docs/docs-829/03-data-structures/player-state.md` | 核验 Character 服务与 roster 状态 owner。 |
| 文档 | `docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/01-architecture/data-flow.md` | 核对角色持有语义及当前文档中 raw owner 的公开调用流程；本 Unit 要修正 API 边界。 |
| 源码 | `src/arona-clicker/services/character-system.ts`：`getUnlocked()`、`get()`；`src/arona-clicker/services/roster-system.ts`：`getOwned()`、`getVariant()`、`isOwned()` | 构建持有学生与真实 Variant 的校验。 |
| 源码 | `src/arona-clicker/runtime-game-instance.ts`：`operationRuntime` 属性、生命周期调用；`src/arona-clicker/runtime-wiring.ts`：owner 装配；`src/arona-clicker/runtime-options.ts`：构造选项 | 移除原始 owner 公共属性，接入受控入口和受信 resolver 配置。 |
| 源码 | `src/arona-clicker/contracts/operation.ts`：`OperationEventDef`；`src/arona-clicker/services/operation-runtime-service.ts`：`start()` | 确认内部 owner 输入及成功创建 Run 的边界。 |
| 源码 | 新建的 operation-participant-admission、operation-entry-service 与 operation-content-resolver 契约 | 建立 ID-only 公开入口、受信内容解析及 admission 的单一调用路径。 |
| 测试 | `tests/engine/character-system.test.ts`、`tests/engine/roster-system.test.ts`、`tests/engine/character-availability.test.ts` | 核对 roster 解锁、Variant proto 与 isOwned 语义。 |
| 测试 | `tests/engine/operation-runtime-service.test.ts`、`tests/engine/gameplay-b-event-runtime-integration.test.ts`、U1 新建的 admission 测试 | 验证内部 owner 边界、GameInstance 生命周期和公开入口行为。 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含当前代码、测试与输出。 |
| 文档 Read Set | 6 篇；不扩展到角色域全目录。 |
| 历史文档 | 仅为随机技能裁定读取 [[draft-0204-gameplay-b-map-and-player-actions]] 与 [[draft-0209-gameplay-b-current-loop-and-identity-review]]。 |
| 超预算处理 | 超过 60k token 时停下并缩小 Unit 或交回上游。 |

#### Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| `getUnlocked()` 是核验已持有 Character 身份的入口；单看 `isOwned()` 不会验证 Variant 定义和 proto。 | `src/arona-clicker/services/character-system.ts`；`src/arona-clicker/services/roster-system.ts` | 完整实现细节见本 Task「已核实事实与跨 Unit 约束」。 |
| Profile 不属于当前 Character 或 Variant 持久字段。 | `src/data-services/contracts/character-data.ts`；`src/data-services/contracts/character-variant.ts` | U1 必须使用新的操作域类型。 |
| GameInstance 目前把 `OperationRuntimeService` 实例公开为 `operationRuntime`，允许调用方传入 EventDefinition 并直接做通用局部写入；架构/模块/机制文档也记录了这一接口。 | `src/arona-clicker/runtime-game-instance.ts`；`src/arona-clicker/runtime-wiring.ts`；`docs/docs-829/01-architecture/data-flow.md`；`docs/docs-829/02-modules/arona-clicker.md`；`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 本 Task U1 是有意收紧该公共边界；需更新当前权威文档，不修改归档 Task 0213 Receipt。 |

#### Constraints

- 将 participant / profile 定义放入独立操作域契约文件；不得修改 Character Schema、VariantProgress 或 PlayerState。
- 公开入场只接受 eventId 和 Character ID 列表；受信 `OperationContentResolver` 按 eventId 返回事件及 Profile 内容。调用方不能覆盖内容输入，也不能把 EventDefinition/Actor/Profile 对象塞进 start。
- 用 gated `OperationEntryService` 串联内容查找、真实 owned Variant→Character 核验、`CharacterSystem.getUnlocked()` 交叉校验、Profile 匹配和内部 owner start。收集完整诊断，任一错误发生时不调用 owner，不产生 Run 或 `runStarted`。
- `OperationRuntimeService` 不可从 GameInstance 公共接口获取；通过只读 snapshot facade 提供 detached EventRun 读取。公共 facade 不暴露通用 delta、结束、reset/dispose 或 owner listener。
- `GameInstanceOptions` 可在构造时注入最小受信 resolver port 以供测试；注入只控制可信内容来源，不扩大每次公开 start 参数。
- `GameInstanceOptions.wiring` 是受信组合根/测试替身，不是隔离对抗式扩展代码的权限边界；角色/Roster 查询始终由该实例装配，普通 Operation 调用方不能逐次注入状态、服务或事件内容。
- 对手与环境不经过上述 roster/Profile 校验。
- Profile 声明只包含候选/偏好、能力标识、理由键、可选随机技能规则引用；技能实际运行留给 0215，声明不得引入 PlayerCost 支付字段。
- 只建立 EventDefinition 级初始参与者输入；不新建或扩展 LocationDef、Datapack、Runtime ActorState。
- 更新 0213 已归档 Task 当前机制文档、模块卡和数据流图中有关公开 raw owner / 原始 EventDefinition 入参的内容；归档 Task 0213 本身保持历史 Receipt，不改写。

#### Allowed Files

- 新增：src/arona-clicker/contracts/operation-participant.ts
- 新增：src/arona-clicker/contracts/student-operation-profile.ts
- 新增：src/arona-clicker/contracts/operation-content-resolver.ts
- 新增：src/arona-clicker/services/operation-participant-admission.ts
- 新增：src/arona-clicker/services/operation-entry-service.ts
- 新增：tests/engine/operation-participant-admission.test.ts
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `src/arona-clicker/runtime-wiring.ts`
- `src/arona-clicker/runtime-options.ts`
- `docs/docs-829/01-architecture/data-flow.md`
- `docs/docs-829/02-modules/arona-clicker.md`
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`
- `docs/plan-work/task-0214-gameplay-b-student-participation-and-autonomy.md`（仅填写本 Unit Receipt）

#### Explicit Non-goals

- 不修改 EventRun Actor/Profile 快照结构；由 U2 完成。
- 不接 UI `GameCommands`；由 Task 0216 将公开 ID-only entry 接到产品 UI 命令。
- 不建立 sample event/Profile 内容或 `schale_office` 入口；测试只用最小 fixtures。
- 不实现 Commit RNG、Profile 专属能力执行或 Observe/Wait 运行逻辑。

#### Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件执行默认 6 条。本 Unit 已显式允许 GameInstance、Wiring、选项、受信内容 resolver 契约与当前 Operation owner 文档修订；如仍需白名单外改动，先停止并交回上游更新 Allowed Files。

#### Acceptance / Completion Criteria

- [x] 独立 participant/Profile 契约能表达学生 Character ID、Profile ID、非学生类型/阵营、行动候选/顺序、能力与理由键。
- [x] 可选 `randomSkillRuleId` 只能作为非空规则引用声明，且模型不包含 PlayerCost 支付或 RNG 执行数据。
- [x] GameInstance 公开入场仅接受 `eventId` 与 `CharacterId[]`，由构造期受信 resolver 按 ID 取得事件定义/Profile；入口不接受 EventDefinition、Actor 或 Profile 对象。
- [x] 入场校验使用 `CharacterSystem.getUnlocked()`，并确认至少一个实际持有的 Variant 在 Registry 中存在、其 `proto` 与所选 Character ID 匹配；Profile 存在且 Character ID 匹配。
- [x] 未知 eventId、未知/未拥有 Character、无效 Variant、缺失/重复/错配 Profile、重复 participant ID 均返回清晰诊断；失败公开入场后 snapshot 仍为空，内部 owner 未被调用，且没有 `runStarted`。
- [x] 通过内部 owner spy 验证无效选角不会调用 `start`/发出 `runStarted`；通过真实 GameInstance 公开入口验证无效选角无 Run、合法选角创建 Run。
- [x] GameInstance 不公开 `OperationRuntimeService`；只通过 ID-only entry 和 detached read-only snapshot facade 启动/读取；生命周期清理仍按 init/load/reset/dispose 工作。
- [x] 对手和环境 Actor 可独立通过 participant 契约而无需 Character / Variant / roster / StudentOperationProfile。
- [x] Character、Variant、VariantProgress、PlayerState Schema 无变更。
- [x] 架构数据流、AronaClicker 模块卡与 Operation Runtime 机制页不再声称调用方可直接传原始 EventDefinition 到 `GameInstance.operationRuntime.start()`；不改写归档 Task 0213 Receipt。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-participant-admission.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts tests/engine/character-system.test.ts tests/engine/roster-system.test.ts tests/engine/operation-runtime-service.test.ts` | 所有目标通过；非法 GameInstance 公开入场无 Run，admission owner spy 确认无 `runStarted`，合法入场建立 Run。 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误。 |
| 架构检查 | `npm run check:architecture` | 产品层服务依赖方向合法。 |
| 文档检查 | `npm run check:docs` | 当前公开接口文档与实现一致。 |

#### Receipt 0214-U1（完成或中断时填写）

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 修改文件 | `src/arona-clicker/contracts/operation-content-resolver.ts`、`operation-participant.ts`、`student-operation-profile.ts`；`src/arona-clicker/services/operation-entry-service.ts`、`operation-participant-admission.ts`；`runtime-game-instance.ts`、`runtime-options.ts`、`runtime-wiring.ts`；`tests/engine/operation-participant-admission.test.ts`、`gameplay-b-event-runtime-integration.test.ts`；`docs/docs-829/01-architecture/data-flow.md`、`docs/docs-829/02-modules/arona-clicker.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`。 |
| 验证 | `npx vitest run tests/engine/operation-participant-admission.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts tests/engine/character-system.test.ts tests/engine/roster-system.test.ts tests/engine/operation-runtime-service.test.ts`：5 files / 48 tests passed；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`git diff --check` 全部通过。 |
| 未完成 / 问题 | EventRun 当前仍不包含 Character、Variant、Profile、faction 或能力快照；这是 U2 的工作。U1 的 private `startAdmitted(admission)` 目前只将事件定义交给 owner；U2 必须在首次发布 `runStarted` 前消费完整 DTO 并初始化 Actor/Profile 快照。 |
| 事实更新建议 | GameInstance 只公开 ID-only `operationEntry` 与 detached snapshot；`#operationRuntimeOwner` 不经过 WiringHooks / 默认 Wiring 暴露。构造期 resolver 缺省时 fail-closed。`GameInstanceOptions.wiring` 属受信组合根/测试替身，不是对抗式扩展隔离边界。 |

### Unit 0214-U2：EventRun Actor/Profile 快照、专属能力与安全回退

状态：ready — 依赖已完成 U1

#### Goal

将已准入参与者与 Profile 在事件入场时解析成稳定 EventRun Actor 快照，并让 Profile 的专属能力、行动排序及 Observe/Wait 回退对后续准备器可读；持续保持 GameInstance 不暴露 raw owner。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | U1/U2 开工前核对 Task 0213-U3 后的稳定运行态边界。 |
| 源码 | `src/arona-clicker/contracts/operation.ts`：`OperationActorDef`、`OperationActorState`、`EventRun` | 只扩展 Run 所需参与者/Profile 快照。 |
| 源码 | `src/arona-clicker/services/operation-runtime-service.ts`：`start()`、`getSnapshot()`、`applyStateDelta()` | 完成快照复制、冻结与局部状态隔离。 |
| 源码 | U1 新建的 src/arona-clicker/services/operation-entry-service.ts：`start()` 与 admission flow | 读取 U1 已准入 DTO 的来源和调用内部 owner 的唯一边界，确保 U2 的快照生成不绕过 admission。 |
| 源码 | `src/arona-clicker/services/operation-definition-validation.ts`：`validateOperationEventDef()` | 对新的 Actor/Profile 引用进行入场校验。 |
| 源码 / 测试 | U1 的 participant/Profile 契约与 admission 服务、`tests/engine/operation-runtime-service.test.ts` | 消费 U1 的解析结果并保持校验单一来源。 |
| 文档 | `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md` | 明确 Profile 产出与 PreparedBeat / Commit RNG 的边界。 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含当前代码、测试与输出。 |
| 文档 Read Set | 2 篇；只读 0215 中相关 Scope/Data API/Acceptance。 |
| 历史文档 | 0 篇；U1 已提供必要语义来源。 |
| 超预算处理 | 超过 60k token 时停下并调整 Unit 范围。 |

#### Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前 EventRun Actor 快照只有 ID/type/HP/resources，无身份、faction、Profile 字段。 | `src/arona-clicker/contracts/operation.ts` | Task 0215 需要由 0214 提供稳定身份/Profile 输入。 |
| Runtime 快照是 detached copy；`start()` 会克隆定义，`getSnapshot()` 返回冻结拷贝。 | `src/arona-clicker/services/operation-runtime-service.ts` | Profile 信息应随一次入场快照固定。 |
| 准备、编辑、Commit 与随机技能结算由 0215 负责。 | `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md` | 本 Unit 不实现 PreparedBeat 或 RNG。 |

#### Constraints

- Run Actor 快照仅保留供本玩法决策使用的 Character/Profile ID、参与者类别、阵营、Profile 能力/优先项及必要的初始/局部字段；不保留 PlayerState、CharacterData、VariantProgress 或可变 Registry 引用。
- EventRun 只能经 GameInstance 暴露的安全 EntryService 启动/只读快照入口访问；不得重新暴露或泄漏 `OperationRuntimeService`、raw owner 或通用局部 delta。
- `OperationEntryService` 是 admission DTO → owner 的唯一传递点；U2 在此把成功的 admission 结果映射为 EventRun Actor/Profile 快照，不创建绕过该门面的第二条 owner 调用路径。
- 在事件开始阶段解析和复制 Profile；一局内后续准备不得重新查询 CharacterSystem/RosterSystem、扫描 Registry 或重解析 Profile。
- 专属能力须通过资格/候选行动/可达目标等方式改变合法处理方案，并带可供 ReadModel 展示的来源理由。标签或普通倍率本身不足以通过验收。
- Profile 无可用计划时须给出稳定的 Observe/Wait 回退及理由；实际 Beat 的最终选择解释由 0215 结合当时局势生成。
- 非学生 Actor 同样进入 EventRun 快照，但不必携带 Character 或 StudentOperationProfile。
- 候选规模按当前 EventDefinition/Profile 输入线性索引；不得在每个 Actor/Beat 扫描整个 Registry。硬性内容上限由后续内容合同裁定，不在本 Unit 猜定数字。
- 本 Unit 只处理 EventDefinition 初始参与者，不声明 LocationDef 或 Datapack participant 内容。
- 本 Unit 不添加 Seed/Cursor 消费接口；随机技能引用只随 Profile 快照保留，实际触发由 0215 有效 Commit 完成。

#### Allowed Files

- `src/arona-clicker/contracts/operation.ts`
- U1 新建的 src/arona-clicker/services/operation-entry-service.ts
- `src/arona-clicker/services/operation-runtime-service.ts`
- `src/arona-clicker/services/operation-definition-validation.ts`
- 新增：src/arona-clicker/services/student-operation-profile-resolver.ts
- 新增：tests/engine/student-operation-runtime.test.ts
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`（更新或补充公开 facade 与 Run 生命周期验收）
- `docs/plan-work/task-0214-gameplay-b-student-participation-and-autonomy.md`（仅填写本 Unit Receipt）

#### Explicit Non-goals

- 不实现 Task 0215 的 PreparedBeat、InterventionDraft、Action Resolver、Resolution、Seed/Cursor 消费和有效 Commit 随机技能触发。
- 不接入 UI / ReadModel；这里只提供稳定快照、候选和理由字段。
- 不把 raw `OperationRuntimeService` 或 `applyStateDelta` 重新公开给 GameInstance / 调用方；后续玩法命令通过 0215 专用受控服务接入。
- 不编辑 Task 0213 曾更新的架构页、模块卡、PlayerState 文档或 Event Runtime 机制页；必要的入口边界改正文档在 U1，完整 Profile/Actor 行为说明在 U3。
- 不新建地点、路线或正式 Datapack 内容。

#### Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件执行默认 6 条。若 Actor/Profile 快照要求改变 Task 0213 已稳定 owner 边界、引入存档兼容或依赖 Task 0215 的运行接口，则停止并交回上游裁定。

#### Acceptance / Completion Criteria

- [ ] 入场后 EventRun Actor 快照含后续规则所需且不可变的身份/Profile/faction/能力/优先项信息；当前 HP、操作资源和临时状态只由 EventRun 持有。
- [ ] GameInstance 仍无公开 raw Runtime owner；Actor/Profile 快照仅由 `operationEntry.getSnapshot()` detached read-only 返回，公开启动仍只接受 ID。
- [ ] 同一个 Character 连续参加不同 EventRun 时，ActorState 相互隔离；修改 Run 内状态不改写长期角色进度。
- [ ] Profile 在一次入场时解析完成；验证不需运行时扫描完整 Registry 或在每次候选决策重新读取角色持有状态。
- [ ] 三个测试 Profile 可呈现不同优先级/能力；至少一项 Profile 专属能力开启原本不合法的有效方案，移除能力后该方案不可用，理由可追溯到能力/优先级/可见条件。
- [ ] 没有合法 Profile 候选时产生明确 Observe/Wait 计划和原因；非学生 Actor 不被迫提供 Character/Profile。
- [ ] Profile 快照可保留可选角色随机技能规则引用且不含 PlayerCost；本 Unit 测试不消费 seed/cursor、不结算技能结果。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/student-operation-runtime.test.ts tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts` | 快照隔离、Profile 能力资格、回退计划、非学生 Actor 路径及公开 facade 不泄露 owner 均通过。 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误。 |
| 架构检查 | `npm run check:architecture` | Run/Profile 依赖保持在产品域。 |

#### Receipt 0214-U2（完成或中断时填写）

| 项 | 内容 |
| --- | --- |
| 状态 | 等待 U1 |
| 修改文件 | — |
| 验证 | — |
| 未完成 / 问题 | — |
| 事实更新建议 | — |

### Unit 0214-U3：参与者机制文档与 GALHCG 收尾

状态：proposed — 依赖 U1、U2

#### Goal

仅按已经落地并验证的 Actor/Profile 行为维护当前机制文档与 GALHCG 证据；同步说明 U1 对归档 Task 0213 公开入口合同的安全收紧，不复制或改写历史 Receipt。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/05-conventions/doc-maintenance.md`、`docs/ai/galhcg-project-map.md` | 依据当前文档唯一权威页规则和地图更新协议施工。 |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/04-mechanisms/00-index.md` | 在既有 Operation Runtime 路由下补参与者/Profile 稳定机制。 |
| 文档 | `docs/docs-829/01-architecture/data-flow.md`、`docs/docs-829/02-modules/arona-clicker.md` | 复核 U1 修订的安全入口描述与 U2 快照事实一致。 |
| 文档 | `docs/plan-work/archive/task-0213-gameplay-b-event-runtime-and-session-state.md` 的 U3 Receipt | 了解已归档 owner 合同及其文档责任，并保留历史记录。 |
| 源码 / 测试 | U1/U2 实际修改并通过验证的 Operation participant、Profile、Runtime 与对应测试 | 当前事实必须回到实现和测试核实。 |
| GALHCG | `resolve_project`、`project_info`、`lookup`、`search`、`review_changes`、`resolve_paths`、`preview`、`update_map` | 重新核验受影响文件与概念；不得依赖本 Task 起草时的旧 token。 |

#### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token。 |
| 文档 Read Set | 当前机制页、目录索引、维护与 GALHCG 协议；不复读全套角色域文档。 |
| 历史文档 | 1 篇；只读 0213 的归档 Receipt 以核对原公开边界的收紧范围。 |
| 超预算处理 | 若地图结构或文档职责冲突超出本 Unit，先回报上游并缩小维护范围。 |

#### Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| CharacterSystem、角色 roster 与 Operation EventRun Runtime 均已有 GALHCG 概念；StudentOperationProfile 在本次预研时未命中。 | 2026-10-04 预研 `lookup("CharacterSystem")` 命中 `concept:character-system`；`lookup("RosterSystem")` 命中 `concept:character-roster-and-acquisition`。其后 Task 0213-U3 Receipt 记录新建 `concept:operation-event-run-runtime`（implemented）。 | 本次预研早于 Task 0213-U3 地图更新；实施时先重查并复用现有 Operation EventRun 概念，不得再建重复 Runtime Concept。 |
| GALHCG path 搜索 `operation-runtime` 找到 Operation Runtime 机制页、服务和测试；source 搜索 `StudentOperationProfile` 在 `src/arona-clicker` 零命中且查询完整。 | 2026-10-04 GALHCG `search(mode="path")` 与 `search(mode="source", directory="src/arona-clicker")` | 地图摘要与缓存 Evidence 不能替代当前源码核验。 |
| 已归档的 Task 0213-U3 建立 Operation Runtime owner、数据流、模块路由、机制页和 `concept:operation-event-run-runtime`；其当时公开 raw owner 合同由本 Task U1 有意收紧。 | `docs/plan-work/archive/task-0213-gameplay-b-event-runtime-and-session-state.md`：U3 Receipt；当前架构/模块/Runtime 机制页 | 本 Unit 完成 Actor/Profile 内容并与 U1 已修订的安全入口文档保持一致；不修改历史 Receipt 或重复建立 Runtime Concept。 |

#### Constraints

- Operation Runtime owner 与 Actor/Profile 行为各有单一权威说明；优先在 Operation 机制页中增加或链接参与者内容，不改写 CharacterSystem 通用角色机制。
- 不改写归档 Task 0213 Receipt。U1 已修订其留下的当前公开入口合同；本 Unit 更新 Actor/Profile 快照事实，并确保数据流、模块卡与机制页表述一致。PlayerState 结构不变时不更新 `player-state.md`。
- 仅当源码、测试和机制文档证明 StudentOperationProfile 是可复用稳定语义时才创建/扩展 GALHCG Concept；单个角色内容、测试 fixture、Resolver helper 不建 Concept。
- 已有 `concept:operation-event-run-runtime` 是 EventRun owner 的主概念；优先向该概念补充 Actor/Profile 实现、测试和文档 Evidence，只有出现边界清晰的独立可复用产品语义时才另建 Profile Concept，并建立有证据的关联。
- 对新增/修改文件逐路径执行 `review_changes`；获取最新 File ID 和 version token 后，确认已有 Character/Roster 节点是否只需引用，必要时再为稳定 Operation Participant/Profile 语义维护 maps_to。未确认的文件/关系不写入地图。
- 实施前重做 `resolve_project` 并核对 root；检查分页、complete/truncated 与 freshness，不把起草时查询视为最终地图状态。

#### Allowed Files

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`
- `docs/docs-829/01-architecture/data-flow.md`（仅需同步 EventDefinition 入场信任边界时）
- `docs/docs-829/02-modules/arona-clicker.md`（仅需同步安全 EntryService 入口时）
- `docs/docs-829/04-mechanisms/arona-clicker/operation-participants.md`（仅在独立机制语义确有必要时新增）
- `docs/docs-829/04-mechanisms/00-index.md`
- `docs/docs-829/06-wiki/30-arona-clicker-domain/00-index.md`（仅在增加独立机制页路由时）
- `docs/plan-work/task-0214-gameplay-b-student-participation-and-autonomy.md`（仅填写本 Unit Receipt）

#### Explicit Non-goals

- 不修改 `docs/docs-829/03-data-structures/player-state.md`；该状态结构不变。本 Unit 可在必要时同步 U1 已修改的数据流/模块入口，但不重复改写 Task 0213 的 owner 架构说明。
- 不为每个 Character / Variant / Profile 实例单独建立 GALHCG 节点。
- 不把未实现的 Location/Datapack participant 方案写为当前事实。
- 不刷新全库文件清单，不顺手维护无关 Concept 或 Evidence。

#### Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件执行默认 6 条。GALHCG unavailable 时记录不可用原因、完成源码与文档核对，并按协议将地图复核留为未完成项；不以零命中或旧 freshness 观察宣称已维护。

#### Acceptance / Completion Criteria

- [ ] 机制文档准确说明玩家学生入场核验、Profile 预解析、EventRun Actor/Profile 快照、独立局内状态、非学生参与者旁路和 Observe/Wait 回退。
- [ ] Operation Runtime 页、模块卡和数据流图都描述 ID-only gated entry、受信内容解析/admission、私有 owner 与 detached read-only snapshot；不声称可将原始 EventDefinition 传给 GameInstance。
- [ ] Operation Runtime 页及必要索引可路由到参与者/Profile 权威内容；不改写归档 Task 0213 Receipt，不复制 PlayerState 或 owner 说明。
- [ ] 没有把 Commit RNG、LocationDef 或 Datapack 内容合同提前写为已实现事实。
- [ ] 对受影响代码、测试和机制文档执行 GALHCG 定向 review；现有映射已核对，新增 Concept / maps_to 仅在有实现、测试及文档证据时提交并复核。
- [ ] `npm run check:docs` 与 `git --no-pager diff --check` 通过。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档检查 | `npm run check:docs` | 无链接或结构错误。 |
| Diff 检查 | `git --no-pager diff --check` | 无空白错误。 |
| GALHCG | 对本 Unit 修改的源码、测试与文档逐路径 `review_changes`；必要时 `resolve_paths` / `preview` / `update_map`，写后再用 `context` 或 `search(mode="map")` 核验 | 范围完整、证据 token 当前、只更新本 Unit 支持的概念关系。 |

#### Receipt 0214-U3（完成或中断时填写）

| 项 | 内容 |
| --- | --- |
| 状态 | 等待 U1、U2 |
| 修改文件 | — |
| 验证 | — |
| 未完成 / 问题 | — |
| 事实更新建议 | — |

## 当前调查记录

- Character / Variant / Roster 的源码与定向测试已核对；EventRun 当前 actor 字段、生命周期及 Runtime 机制页已核对；未修改代码、未运行测试。
- 2026-10-04 GALHCG 查询确认项目根为 `C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram`、`project_id=acprogram`；`project_info` 为 `metadata_status=absent`，无项目专属 map/source scopes。
- 本次预研的 GALHCG `lookup("CharacterSystem")` 与 `lookup("RosterSystem")` 分别命中既有角色/roster 概念；当时 StudentOperationProfile / EventRun / Operation Runtime 未命中。随后 Task 0213-U3 已建立 `concept:operation-event-run-runtime` 并映射运行时服务、测试、架构/模块文档及机制索引。StudentOperationProfile 源码查询当时完整零命中。实施 U3 时必须重新查询并读取最新源码、测试及 token，沿用现有 Runtime Concept。
- U1 入场 admission 与 ID-only facade 已实施并验证；Task 0213-U3 已完成归档。U2 将在 `OperationEntryService.startAdmitted()` 的私有 seam 消费 DTO，初始化 EventRun Actor/Profile 快照。当前 `OperationEventDef` / `EventRun` Actor 结构仍未扩展；Profile 字段须从合法行动差异与解释需求反推，不扩展 Character 基础 Schema。GALHCG 定向变更审查和语义 Evidence 收尾由 U3 完成。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0213-gameplay-b-event-runtime-and-session-state]]
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[docs/ai/context-packs/character]]
- [[docs/docs-829/05-conventions/schema-sync]]
