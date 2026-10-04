# Task 0219 — 玩法 B EventRun 存档与精确续局

状态：completed（2026-10-05）— EventRun 有界快照、主 SaveData 接线、内容校验与正式游乐园样例的精确续局均已实现并验证。

## 目标

暂停并恢复一场正在进行的 EventRun，恢复后保留当前地点、EventState、Actor 状态、准备计划、待提交指挥、Resolution 日志位置和随机流状态。

## Why

事件跨越多个问题地点和决策节拍。用户离开后若重新准备计划、重抽随机结果或丢失路线状态，继续同一局就不可信。

## Scope

- EventRun 快照放入主 `SaveData` 的可选 `operationRun` 字段，继续使用现有唯一存档键；不新增 key/slot、第二套存档介质或快照专属版本号。`SaveData.version` 管存档格式，事件内容兼容只由 `eventId + resumeVersion` 管理。
- 快照保存 `eventId`、`resumeVersion` 与 EventRun 权威状态；OperationRuntime 负责恢复 Runtime 对象，SaveSystem 只读写主存档。
- 在玩家可暂停的位置保存 current Location、地点访问、轨道/事实、Actor 临时状态、PreparedBeat、InterventionDraft、RNG seed/cursor、终局/日志信息。
- 保存路线共享 PlayerCost、每次地点访问的 `costGain` 记录，以及有限卡组 drawPile/hand/discard 区域和当前 draw 顺序；恢复不得重复发放入场 Cost 或重抽已抽卡。
- 若在 SceneAction 批次待提交时允许暂停，保存完整逐人/全局选择、卡牌选择与费用快照；拒绝/撤销后保存的 Run 必须维持原 PlayerCost 与卡牌区。
- Event Seed 只用于派生固定卡组的初始洗牌顺序；顺序生成后保存在 drawPile，后续抽牌只移动列表头，不再推进牌组随机游标。存档不另存一个无后续用途的牌组 RNG cursor；预览不得消费战术随机数或改变牌区。
- PreparedBeat/InterventionDraft 是已向玩家展示的待提交事实，存档直接保留；OperationView 和索引可从 Run/Registry 重建，不存档。
- 只在有效状态命令或明确存档点形成 checkpoint；hover、滚动、只读预览不触发全存档序列化。
- Resolution/事件日志保持有界；地点访问、批次数与卡组上限保证 Run 和存档体积有限，不另做字节 cap benchmark。
- 恢复时重建对内容定义与 Character ID 的引用，并比较 `eventId + resumeVersion`；作者对不兼容内容改动手动递增事件版本。不计算自动内容 Hash。
- 对内容版本不兼容的 Run 清楚拒绝恢复并提供重新开始路径；遵守项目规则，不写旧存档迁移。
- 事件完成/失败后清理活动 Run，但保留明确需要展示或提交的 EventResult。

## Non-goals

- 不把 OperationRun 纳入 PlayerState per-Init 字段或 InitSnapshot。
- 不做云同步、回放格式、跨版本迁移或多设备冲突合并。
- 不重复实现 StorageAdapter 或 SaveSystem。

## Gameplay UI Deferred Scope

- 本 Task 只实现 Save/Resume Runtime 与存档入口 API；可以保存/恢复待提交的 SceneAction、卡牌选择和计划，但不设计暂停菜单、信息流提示或恢复交互界面。
- View/状态恢复能力可提供给 Task 0222；玩家侧暂停、继续和异常恢复体验统一由该 Task 设计与验收。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| SaveSystem 使用固定的 `acprogram_save` 键并按主 DTO 顶层 `version` 检查格式；StorageAdapter 只有 get/set/remove，没有独立槽位 API。 | `src/data-services/persistence/storage.ts`；`src/data-services/persistence/storage-adapter.ts`；`src/arona-clicker/contracts/save-data.ts`；`src/arona-clicker/runtime-save-codec.ts` | V1 将活动 EventRun 放入主 SaveData 的可选 `operationRun` 字段，不增加第二个 key/slot。 |
| Save/load 会重建运行态；per-Init 快照与其他 PlayerState 字段由专门规范区分。 | `docs/docs-829/03-data-structures/player-state.md`；`src/arona-clicker/state/per-init-fields.ts` | EventRun 作为独立存档子域，不混入 Init 恢复规则。 |
| 主 SaveData 有格式版本；事件内容使用 EventDef 的显式 `resumeVersion`。 | `src/arona-clicker/contracts/save-data.ts`；Task 0220 EventDef 契约 | `SaveData.version` 管存档格式，`eventId + resumeVersion` 管事件内容兼容；不计算 Datapack graph Hash。 |

## Data / API

- `SaveData.operationRun`：`eventId`、`resumeVersion`、EventRun、已准入 Actor/Profile 快照、有限 Resolution 摘要及可选终局 `EventResult`。EventRun 内可选保存明确暂存的 SceneAction/玩家卡选择和对应费用预览；纯预览仍不形成 Run 状态。
- 恢复顺序固定为：加载主 Save → 让 0213 生命周期先清除内存 Run → 找到 EventDef 并校验 `eventId + resumeVersion` → 重建 EventRun、随机流和待提交状态 → 再创建 OperationView。版本或引用校验失败时不创建半恢复 Run。
- 不引入独立存档 key/slot 或自动解析 Datapack graph 计算内容 Hash。
- 定义副本、Registry lookup 索引、OperationView、DOM/UI 状态不进入 snapshot；缓存均从现有 Datapack/Registry 重建。

## Runtime Flow

暂停点请求存档 → OperationRuntime 生成一致快照 → 写入主 SaveData.operationRun → 读取主 Save 后清空旧内存 Run → 按 `eventId + resumeVersion` 验证 → 重建 EventRun、PreparedBeat、牌区和随机流 → 生成相同 OperationView 并继续。

## Acceptance

- [x] 在 Commit 前保存含学生行动修订的 Run，恢复后 PreparedBeat/InterventionDraft 不变；不中断与恢复后的下一次 Commit 结果一致。
- [x] 正式游乐园样例路线转场后存取，当前 Location、访问记录和 EventState 保持一致。
- [x] PlayerCost、地点 `costGain` 记录、有限卡组 drawPile/hand/discard 和实体卡顺序恢复一致；不重复发放 Cost、不重抽卡或重洗牌。
- [x] SceneAction/玩家卡批次待提交时可存取；费用、卡牌分区和 RNG 在 stage 时不变，恢复后提交与不中断路径一致。
- [x] 非零战术 RNG cursor 恢复后，下一次随机结算与不中断路径完全一致。
- [x] 损坏快照、未知 Event、缺失 Character 和 `resumeVersion` 不兼容均可查询清晰拒绝原因，且不留下半恢复 Run。
- [x] 主 `SaveData.version` 保持格式版本职责；事件内容仅比较 `eventId + resumeVersion`，不计算自动内容 Hash。
- [x] EventRun checkpoint 位于主 SaveData 顶层，不进入 PlayerState/InitSnapshot；终局 `EventResult` 可恢复。奖励结算与幂等提交留给首次接入奖励写入的 Task 0222。
- [x] 快照只含有界 Run 动态状态和可选终局结果；定义副本、Registry 索引、OperationView、DOM 与无界日志不进入 SaveData。底层 SaveSystem 仍按原有单一主存档路径写入。
- [x] 不增加迁移、独立存档 key 或存档格式版本；旧 SaveData 缺少 `operationRun` 时按无续局状态加载。

## Tests

- **Unit：**主 SaveData.operationRun 往返、字段/角色引用诊断、resumeVersion 变化拒绝、PlayerCost/三分区牌区与已洗牌 draw 顺序恢复、战术 RNG 恢复。
- **Runtime：**Commit 前/后、地点之间与事件终局恢复；对比 uninterrupted replay。
- **Integration：**主 SaveSystem 存取、0213 load 清理后显式恢复 Runtime，奖励提交幂等。
- **API/Integration：**暂停点、恢复结果和拒绝原因可由 Runtime/Save facade 查询；不做玩家侧界面或信息流交互。

## Dependencies

- 依赖 Task 0213–0218 的 EventRun、Actor、PreparedBeat、Resolution 和路线状态；依赖 Task 0224/0225 的 PlayerCost、地点入场收益与三分区牌组状态；依赖 Task 0220 的 EventDef.resumeVersion。

## Documentation / GALHCG

- 本 Task 收尾时定向复核 Save/Resume 直接受影响的路径、Owner 与 Evidence，并修正既有 Operation EventRun / SaveSystem / PlayerState 关系；不做全图 freshness 扫描或额外 Concept 扩展。
- Receipt 记录机制页、Owner 与证据路径。GALHCG 维护集中在本大型阶段点完成，不随每个小 Unit 重复全量更新。
- Read Set：`docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/06-wiki/20-data-services/persistence-assets.md`、SaveSystem/Runtime save 源码与测试、Task 0213–0218。

## 已完成总结

SaveSystem 仍使用现有唯一主存档路径；`SaveData.operationRun` 是可选字段。`SaveData.version` 管格式，EventDef 的 `resumeVersion` 管内容兼容，不计算内容 Hash。保存/恢复现已覆盖路线 Cost、地点入场收益记录、三分区卡组/已洗牌 draw 顺序、战术随机状态、PreparedBeat/InterventionDraft、显式暂存的场景批次与终局 EventResult。Task 0222 仍负责首次产品奖励写入和 exactly-once 验收。

## 实施裁定

- `SaveData.operationRun` 只保存活动 Run 的动态状态、事件 `eventId + resumeVersion`、学生/对手入场快照及可选待提交 SceneAction/玩家卡批次。事件定义、OperationAction、Location、Profile、Registry 索引与 OperationView 一律从当前 Registry 重建，不复制进存档。
- 只要 EventRun 带有 Registry Event 的正整数 `resumeVersion` 且处于活动或保留结局状态，就可生成快照；缺少内容版本的低层测试 Fixture 不进入可恢复存档。终局 `EventResult` 可随终局快照保留，活动 Run 不因 `load()` 的清理步骤残留。
- 恢复先清空现存 Run、恢复主 PlayerState，再解析事件内容并比较 `eventId + resumeVersion`；Init、Character、Profile、Action 与 Run 状态校验全部成功后才一次性安装 Run。任何拒绝均保持无活动 Run，并由 Operation Entry 查询接口给出诊断，允许调用方重新开始。
- 已提交的 Run 状态可存档；hover、纯预览和未被 Run 接受的临时 UI 输入不触发写入。为支持明确的 SceneAction/玩家卡“待提交”暂停点，新增的只是 Operation Run 内的单个批次草稿（原始选择及费用预览快照），拒绝的提交不改变已存费用、卡区或 RNG。
- 牌组洗牌结果本身保存在 drawPile/hand/discard；恢复只重建同一批物理 CardInstance ID，不重新洗牌，也不恢复无后续用途的 deck RNG cursor。战术 RNG 继续恢复 seed/cursor。
- 不修改 SaveSystem 固定 key 或主 SaveData 格式版本；`operationRun` 是向 `1.0.0` SaveData 增加的可选字段，不新增迁移或第二套持久化。

## Patch Unit Plan

### Unit 1 — EventRun checkpoint 与原子恢复

- **Goal：**为 OperationRuntime 提供 detached checkpoint、待提交场景批次快照与“先校验、后安装”的恢复入口。
- **Allowed Files：**`src/arona-clicker/contracts/operation-save.ts`（新增）、`src/arona-clicker/contracts/operation.ts`、`operation-scene-action.ts`、`src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/services/student-operation-profile-resolver.ts`、`src/arona-clicker/services/operation-entry-service.ts`（新增的 Save/Resume 与 staged SceneAction/Card 窄接口）、`tests/engine/operation-runtime-service.test.ts`、`tests/engine/operation-scene-actions.test.ts`。
- **Read Set：**Operation EventRun / trusted content、SceneAction batch plan/commit、PreparedBeat 与 RNG 实现及对应单元测试。
- **Completion Criteria：**checkpoint 不含定义图或 UI；恢复后 runId、Run 状态、待提交计划/干预、Cost、地点记录、牌区/物理卡顺序、日志序号和战术 RNG 不变；非法快照不会部分安装；待提交 SceneAction 草稿可原样继续提交。
- **Non-goals：**不连接 SaveSystem、不做玩家暂停 UI、不迁移 PlayerState。
- **Stop Conditions：**若恢复需要更改现有 Action/Card 可信定义边界，暂停并记录差异。

### Unit 2 — 主 SaveData 接线与内容准入

- **Goal：**在既有 `GameInstance.save()/load()` 内保存/恢复 Unit 1 checkpoint，并以当前 Registry/EventDef 重建规则。
- **Allowed Files：**`src/arona-clicker/contracts/save-data.ts`、`contracts/save-codec.ts`、`runtime-save-codec.ts`、`runtime-game-instance.ts`、`services/operation-entry-service.ts`、`services/student-operation-profile-resolver.ts`、`tests/engine/gameplay-b-save-resume.test.ts`（新增）、`tests/engine/gameplay-b-event-runtime-integration.test.ts`、`tests/engine/game-instance.test.ts`。
- **Read Set：**SaveSystem 单一键/版本门槛、`restoreFromSave()` 顺序、OperationContentResolver/Admission、Registry-backed Gameplay B 正式 Datapack。
- **Completion Criteria：**`SaveData.operationRun` 可选且无额外 key；加载先清除现存 Run，再恢复 PlayerState 并核对 Init、事件版本、Character/Action 引用，成功后才安装；版本/内容/快照错误可查询且不留下半恢复 Run；旧 SaveData 缺字段时按原行为加载。
- **Non-goals：**不改 SaveSystem key、`SaveData.version` 或写兼容迁移；不把 Run 放入 PlayerState / InitSnapshot。
- **Stop Conditions：**若内容版本只能靠 Hash 才能安全恢复，暂停；当前裁定是作者维护 `resumeVersion`。

### Unit 3 — 正式事件往返验收与机制收尾

- **Goal：**以 Task 0220 正式游乐园 Datapack 证明跨 GameInstance 精确续局，并更新机制文档、Task Receipt 与必要 GALHCG 关系。
- **Allowed Files：**Unit 1–2 完成后确认的测试文件、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/06-wiki/20-data-services/persistence-assets.md`、本 Task 与 `docs/plan-work/00-index.md`。
- **Read Set：**单一固定 Seed 集成测试、SaveData、Operation Runtime 机制文档及 GALHCG 直接受影响路径。
- **Completion Criteria：**Commit 前修订计划、场景待提交批次、路线后 Cost/抽牌、随机结算均能存取对比不中断路径；未知 Event、版本变化和损坏快照报告拒绝；终局 EventResult 可恢复。奖励写入与 exactly-once 由首次接入奖励 Mutation 的 Task 0222 验收；本 Task 不伪造尚不存在的奖励服务。
- **Non-goals：**不做暂停菜单、云同步、存档槽、回放、内容 Hash 或全图 GALHCG 重建。
- **Stop Conditions：**若实现需要 SaveData 版本迁移或 UI 信息流，先写清阻塞点，不扩大本 Task。

## Unit Receipts

### Unit 1 — EventRun checkpoint 与原子恢复（completed）

- **实际修改：**新增 `operation-save.ts`；扩展 `EventRun` 与 SceneAction 批次草稿；增加 Runtime checkpoint、恢复前完整状态校验、暂存/恢复/提交场景批次窄入口；从当前可信内容重建 Actor/Profile 静态规则。
- **涉及文件：**`src/arona-clicker/contracts/operation-save.ts`、`operation.ts`、`operation-scene-action.ts`、`src/arona-clicker/services/operation-runtime-service.ts`、`student-operation-profile-resolver.ts`、`operation-entry-service.ts`、`tests/engine/operation-runtime-service.test.ts`、`operation-scene-actions.test.ts`。
- **验证：**`operation-runtime-service.test.ts` 31 项、`operation-scene-actions.test.ts` 7 项通过；类型检查通过。
- **未完成：**无。本 Unit 的 GALHCG 维护集中到 Unit 3 执行。

### Unit 2 — 主 SaveData 接线与内容准入（completed）

- **实际修改：**主 SaveData 增加可选 `operationRun`；GameInstance 保存 checkpoint，读档先清 Run/恢复 PlayerState，再按 Registry Event、Init、Character、Profile 与内容版本校验并原子恢复。旧 DTO 缺字段仍无 Run。补充真实 Datapack 的跨 GameInstance 路线/Cost/卡组/RNG/终局往返测试，并更新 facade API 白名单断言。
- **涉及文件：**`src/arona-clicker/contracts/save-data.ts`、`contracts/save-codec.ts`、`runtime-save-codec.ts`、`runtime-game-instance.ts`、`services/operation-entry-service.ts`、`student-operation-profile-resolver.ts`、`tests/engine/gameplay-b-save-resume.test.ts`、`gameplay-b-event-runtime-integration.test.ts`。
- **验证：**`gameplay-b-save-resume.test.ts` 3 项、`game-instance.test.ts` 74 项、`gameplay-b-event-runtime-integration.test.ts` 14 项通过；另有 Operation Runtime/SceneAction 定向测试通过。一次初始集成回归发现旧 facade API 白名单未同步，更新断言后复跑通过。
- **未完成：**无。Operation 奖励提交接口尚未进入 Runtime，由 Task 0222 首次接入并验证幂等。

### Unit 3 — 正式事件往返验收与机制收尾（completed）

- **实际修改：**更新 Operation Runtime、PlayerState 与持久化边界机制文档；完成本 Task 验收和 Receipt；将 Task 移入归档并调整计划索引。
- **GALHCG：**仅刷新两个新增文件所在目录的精确文件项；更新既有 Operation EventRun Runtime、Operation Student Profile Admission、GameInstance Runtime Composition 证据/摘要，复核并维护 SaveSystem、PlayerState、Datapack Package I/O、PicService 的受影响映射。未创建 Concept、未做全图 freshness 扫描。直接路径与分页 Owner 复核完整；`review_changes` 最终均无 stale Evidence。
- **验证：**五个定向测试文件共 129 项通过；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`git diff --check` 通过。
- **未完成：**无；产品奖励 exactly-once 由 Task 0222 验收。

## Receipt

- **结果：**EventRun 可作为 SaveData 中可选、有界 checkpoint；恢复使用当前 Registry 内容和显式 `resumeVersion`，校验完成后才安装 Run。已存状态、暂存 SceneAction/玩家卡费用预览、实体牌区与随机游标均可精确续局；无效 checkpoint 不留下半恢复状态。
- **范围边界：**没有引入迁移、内容 Hash、独立存档槽、暂停 UI 或奖励 Mutation。终局 `EventResult` 可恢复；Task 0222 负责奖励一次性写入。
- **受影响的机制文档：**`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/06-wiki/20-data-services/persistence-assets.md`。
- **GALHCG 查询与维护：**以 `acprogram` 项目映射 Operation Runtime、SaveSystem、PlayerState 和直接受影响文件；两个新增源/测试文件完成定向刷新及 `maps_to`。写后 `search`/`context` 回读，所有变更文件 `review_changes` 分页完整且无 stale Evidence；不扩展新 Concept。
- **验证命令：**`npx vitest run --silent tests/engine/game-instance.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts tests/engine/operation-runtime-service.test.ts tests/engine/operation-scene-actions.test.ts tests/engine/gameplay-b-save-resume.test.ts`（5 files / 129 tests）；`npx tsc --noEmit`；`npm run check:architecture`；`npm run check:docs`；`git diff --check`。全部通过。
- **提交边界：**只提交 Task 0219 的代码、测试、机制文档和任务归档/索引；工作区里未关联的主题编辑器改动保持原状。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0213-gameplay-b-event-runtime-and-session-state]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[docs/docs-829/05-conventions/testing]]
