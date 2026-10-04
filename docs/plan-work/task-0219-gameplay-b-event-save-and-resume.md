# Task 0219 — 玩法 B EventRun 存档与精确续局

状态：proposed — 等待 Task 0213–0218、0224、0225 与 0220 完成

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

- `SaveData.operationRun`：`eventId`、`resumeVersion`、地点状态与访问 Cost 记录、ActorState、EventState、共享 PlayerCost、玩家卡组三分区和固定 draw 顺序、PreparedBeat、InterventionDraft、战术 RNG cursor、有限 Resolution 摘要。
- 恢复顺序固定为：加载主 Save → 让 0213 生命周期先清除内存 Run → 找到 EventDef 并校验 `eventId + resumeVersion` → 重建 EventRun、随机流和待提交状态 → 再创建 OperationView。版本或引用校验失败时不创建半恢复 Run。
- 不引入独立存档 key/slot 或自动解析 Datapack graph 计算内容 Hash。
- 定义副本、Registry lookup 索引、OperationView、DOM/UI 状态不进入 snapshot；缓存均从现有 Datapack/Registry 重建。

## Runtime Flow

暂停点请求存档 → OperationRuntime 生成一致快照 → 写入主 SaveData.operationRun → 读取主 Save 后清空旧内存 Run → 按 `eventId + resumeVersion` 验证 → 重建 EventRun、PreparedBeat、牌区和随机流 → 生成相同 OperationView 并继续。

## Acceptance

- [ ] 在 Commit 前保存包含一次学生行动修订的 Run，恢复后看到相同 PreparedBeat/InterventionDraft；Commit 结果与不中断时相同。
- [ ] 在路线切换后保存并恢复，当前 Location、访问次数和 EventState 保持一致。
- [ ] 恢复后 PlayerCost、地点 `costGain` 访问记录、有限卡组 drawPile/hand/discard 与保存的 draw 顺序一致；恢复不重领 Cost、不重抽卡，也不重洗卡组。
- [ ] SceneAction 或玩家卡批次待提交时保存/恢复，继续提交与无中断执行结果一致；拒绝批次不改变已保存的费用、卡牌分区或随机流。
- [ ] RNG seed/cursor 恢复后，不重掷既有预备结果，也不跳过下一次应发生的随机结算。
- [ ] 损坏 snapshot、未知事件/角色引用或 `resumeVersion` 不兼容均返回清楚诊断，不生成半恢复 Runtime。
- [ ] 主 `SaveData.version` 只校验存档格式；事件内容兼容只比较 `eventId + resumeVersion`，不运行自动内容 Hash。
- [ ] 保存和恢复不改写 PlayerState/InitSnapshot；终局奖励仍只提交一次。
- [ ] 存档不包含 Registry 定义副本、可重建索引、OperationView、DOM 或无界日志；地点/卡组/Resolution 上限保证快照有限，写入失败不留下部分 SaveData。
- [ ] 现有存档升级不通过迁移兼容实现；破坏性运行结构变更遵守“旧存档清档”护栏。

## Tests

- **Unit：**主 SaveData.operationRun 往返、字段/角色引用诊断、resumeVersion 变化拒绝、PlayerCost/三分区牌区与已洗牌 draw 顺序恢复、战术 RNG 恢复。
- **Runtime：**Commit 前/后、地点之间与事件终局恢复；对比 uninterrupted replay。
- **Integration：**主 SaveSystem 存取、0213 load 清理后显式恢复 Runtime，奖励提交幂等。
- **API/Integration：**暂停点、恢复结果和拒绝原因可由 Runtime/Save facade 查询；不做玩家侧界面或信息流交互。

## Dependencies

- 依赖 Task 0213–0218 的 EventRun、Actor、PreparedBeat、Resolution 和路线状态；依赖 Task 0224/0225 的 PlayerCost、地点入场收益与三分区牌组状态；依赖 Task 0220 的 EventDef.resumeVersion。

## Documentation / GALHCG

- 在本 Task Receipt 记录候选机制页、Owner 与证据路径；不在单 Task 收尾时写 GALHCG。
- Receipt 记录 Save/Resume 直接受影响的机制事实；全图 freshness 扫描和额外 Concept 扩展为 post-v1，不阻塞恢复闭环。
- Read Set：`docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/06-wiki/20-data-services/persistence-assets.md`、SaveSystem/Runtime save 源码与测试、Task 0213–0218。

## 当前核验与剩余工作

当前核对到 SaveSystem 使用固定主存档键；V1 选择在主 SaveData 增加可选 `operationRun`。`SaveData.version` 管格式，EventDef 的 `resumeVersion` 管内容兼容；不建设内容 Hash。保存/恢复覆盖路线 Cost、地点入场收益记录、三分区卡组/已洗牌 draw 顺序、战术随机状态和待提交计划；卡组不维护洗牌后的随机游标。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0213-gameplay-b-event-runtime-and-session-state]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[docs/docs-829/05-conventions/testing]]
