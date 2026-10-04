# Task 0219 — 玩法 B EventRun 存档与精确续局

状态：proposed — 等待 Task 0213–0218 完成

## 目标

暂停并恢复一场正在进行的 EventRun，恢复后保留当前地点、EventState、Actor 状态、准备计划、待提交指挥、Resolution 日志位置和随机流状态。

## Why

事件跨越多个问题地点和决策节拍。用户离开后若重新准备计划、重抽随机结果或丢失路线状态，继续同一局就不可信。

## Scope

- 为 EventRun 定义单一可序列化快照及恢复校验。它是与 PlayerState / InitSnapshot 分离的存档子域；快照 schema version 与主 `SaveData.version` 各自描述不同边界，SaveSystem 只负责介质，OperationRuntime 负责 Runtime 对象重建。
- 开始实现前裁定快照放入主 SaveData，还是使用独立存档 key/slot。当前 SaveSystem 只有固定主存档键；若选择独立槽位，须在该 Task 明确隔离写入、清理与超限失败的行为，不改变主存档版本语义。
- 在玩家可暂停的位置保存 current Location、地点访问、轨道/事实、Actor 临时状态、PreparedBeat、InterventionDraft、RNG seed/cursor、终局/日志信息。
- 保存路线共享 PlayerCost、每次地点访问的 `costGain` 是否已应用，以及有限卡组的 draw/hand/discard/played 分区、抽牌顺序和抽牌流位置；恢复不得重复发放入场 Cost 或重抽已抽卡。
- 若在 SceneAction 批次待提交时允许暂停，保存完整逐人/全局选择、卡牌选择与费用快照；拒绝/撤销后保存的 Run 必须维持原 PlayerCost 与卡牌区。
- 区分战术随机流与玩家卡组抽取流，分别保存可继续的状态；任一流的预览不得消费随机数。
- PreparedBeat/InterventionDraft 是已向玩家展示的待提交事实，存档直接保留；OperationView 和索引可从 Run/Registry 重建，不存档。
- 只在有效状态命令或明确存档点形成 checkpoint；hover、滚动、只读预览不触发全存档序列化。
- Resolution/事件日志有明确数量或字节上限；每地点 Beat 与地点访问上限保证 Run 和存档体积有界。
- 用合成上限 Run 定出 `EventRunSnapshot` 字节 cap；超限 Run 拒绝保存并给出诊断，具体 cap 在实施测量后进入机制文档。
- 恢复时重建对内容定义与 Character ID 的引用，并用 Task 0220 提供的事件内容兼容标识确认引用仍对应同一规则内容；该标识与快照 schema version、主 `SaveData.version` 分开。
- 对内容版本不兼容的 Run 清楚拒绝恢复并提供重新开始路径；遵守项目规则，不写旧存档迁移。
- 事件完成/失败后清理活动 Run，但保留明确需要展示或提交的 EventResult。

## Non-goals

- 不把 OperationRun 纳入 PlayerState per-Init 字段或 InitSnapshot。
- 不做云同步、回放格式、跨版本迁移或多设备冲突合并。
- 不重复实现 StorageAdapter 或 SaveSystem。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| SaveSystem 使用固定的 `acprogram_save` 键，并按主 DTO 顶层 `version` 检查 `1.0.0`；StorageAdapter 只有 get/set/remove，当前没有独立槽位 API。 | `src/data-services/persistence/storage.ts`；`src/data-services/persistence/storage-adapter.ts`；`src/arona-clicker/contracts/save-data.ts`；`src/arona-clicker/runtime-save-codec.ts` | EventRun 子域版本不得覆盖主 `SaveData.version`；持久化落点在同一主 DTO 或独立 key/slot 仍需在实现前裁定。 |
| Save/load 会重建运行态；per-Init 快照与其他 PlayerState 字段由专门规范区分。 | `docs/docs-829/03-data-structures/player-state.md`；`src/arona-clicker/state/per-init-fields.ts` | EventRun 作为独立存档子域，不混入 Init 恢复规则。 |
| Datapack 有 package `version`，PackManager 的 StoredPack 也有语义 `contentDigest`；Registry 当前只保留 `loadedModNames`，不提供版本或内容指纹。 | `src/data-services/contracts/datapack.ts`；`src/data-services/datapack/pack-manager.ts`；`src/data-services/registry/registry.ts` | 0219 不从 Registry 或主存档版本推断内容兼容性；Task 0220 为 EventRun 提供稳定的内容兼容标识。 |

## Data / API

- `EventRunSnapshot`：独立快照 schema version、Task 0220 提供的事件内容兼容标识、唯一权威 Run 状态、地点状态/访问收益标记、ActorState、共享 PlayerCost、玩家卡组四区与抽牌状态、PreparedBeat、InterventionDraft、独立随机流位置、有限 Resolution 摘要。
- `SaveSystem` 扩展边界只承载该快照的存取；主 DTO 内的可选子域或独立 key/slot 的持久化位置须在实施前裁定，业务恢复/校验由操作 Runtime 完成。
- 定义副本、Registry lookup 索引、OperationView、DOM/UI 状态不进入 snapshot；缓存均从现有 Datapack/Registry 重建。

## Runtime Flow

暂停点请求存档 → OperationRuntime 生成一致快照 → SaveSystem 持久化 → 之后读取并分别校验快照 schema、Task 0220 内容兼容标识及角色引用 → 重建 EventRun 和 PreparedBeat → 生成相同 OperationView 并继续 Commit。

## Acceptance

- [ ] 在 Commit 前保存包含一次学生行动修订的 Run，恢复后看到相同 PreparedBeat/InterventionDraft；Commit 结果与不中断时相同。
- [ ] 在路线切换后保存并恢复，当前 Location、访问次数和 EventState 保持一致。
- [ ] 恢复后 PlayerCost、地点 `costGain` 访问标记、有限卡组四区/抽牌顺序及卡组 RNG 流与保存前一致；恢复不重领 Cost、不重抽卡。
- [ ] SceneAction 或玩家卡批次待提交时保存/恢复，继续提交与无中断执行结果一致；拒绝批次不改变已保存的费用、卡牌分区或随机流。
- [ ] RNG seed/cursor 恢复后，不重掷既有预备结果，也不跳过下一次应发生的随机结算。
- [ ] 损坏 snapshot、未知事件/角色引用或定义版本不兼容均返回完整诊断，不生成半恢复 Runtime。
- [ ] EventRun 子域 schema version、主 `SaveData.version` 与 Task 0220 内容兼容标识各自独立；版本不兼容时不会把一种版本误判为另一种。
- [ ] 保存和恢复不改写 PlayerState/InitSnapshot；终局奖励仍只提交一次。
- [ ] 存档不包含 Registry 定义副本、可重建索引、OperationView、DOM 或无界日志；EventRunSnapshot 有明确字节 cap，超限快照不写入且不会留下部分更新。
- [ ] 现有存档升级不通过迁移兼容实现；破坏性运行结构变更遵守“旧存档清档”护栏。

## Tests

- **Unit：**snapshot codec 往返、字段省略/非法引用诊断、PlayerCost/卡组分区与独立随机流 round-trip。
- **Runtime：**Commit 前/后、地点之间与事件终局恢复；对比 uninterrupted replay。
- **Integration：**SaveSystem 存取与 Runtime 重建，奖励提交幂等。
- **UI：**暂停/恢复界面反馈和恢复位置说明。

## Dependencies

- 依赖 Task 0213–0218 的完整 EventRun、Actor、PreparedBeat、Resolution 和路线状态；依赖 Task 0224/0225 的 PlayerCost、地点入场收益与玩家场景卡组状态；依赖 Task 0220 提供稳定事件内容兼容标识。

## Documentation / GALHCG

- 稳定后更新 `docs/docs-829/03-data-structures/player-state.md` 所属边界或新增 Operation 存档机制页，并更新 Save/Runtime Wiki。
- GALHCG 记录 Run snapshot 的稳定 owner/恢复职责；codec 字段与 StorageAdapter helper 不建独立 Concept。
- Read Set：`docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/06-wiki/20-data-services/persistence-assets.md`、SaveSystem/Runtime save 源码与测试、Task 0213–0218。

## 当前核验与剩余工作

当前核对到 SaveSystem 只检查固定主 DTO 版本，Registry 只保留已加载 Mod 名称；没有现成的 Registry 内容版本字段。主 DTO 内嵌或独立 key/slot 尚待本 Task 实施前裁定；事件内容兼容标识由 Task 0220 定义并提供，不复用 `SaveData.version`。玩家路线 Cost、入场收益幂等标记、有限卡组与独立抽牌流均属于必须往返验证的 EventRun 子域。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0213-gameplay-b-event-runtime-and-session-state]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[docs/docs-829/05-conventions/testing]]
