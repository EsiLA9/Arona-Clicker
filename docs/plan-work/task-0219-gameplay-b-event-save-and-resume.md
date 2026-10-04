# Task 0219 — 玩法 B EventRun 存档与精确续局

状态：proposed — 等待 Task 0213–0218 完成

## 目标

暂停并恢复一场正在进行的 EventRun，恢复后保留当前地点、EventState、Actor 状态、准备计划、待提交指挥、Resolution 日志位置和随机流状态。

## Why

事件跨越多个问题地点和决策节拍。用户离开后若重新准备计划、重抽随机结果或丢失路线状态，继续同一局就不可信。

## Scope

- 为 EventRun 定义单一可序列化快照及恢复校验；SaveSystem 负责介质，OperationRuntime 负责 Runtime 对象重建。
- 在玩家可暂停的位置保存 current Location、地点访问、轨道/事实、Actor 临时状态、PreparedBeat、InterventionDraft、RNG seed/cursor、终局/日志信息。
- PreparedBeat/InterventionDraft 是已向玩家展示的待提交事实，存档直接保留；OperationView 和索引可从 Run/Registry 重建，不存档。
- 只在有效状态命令或明确存档点形成 checkpoint；hover、滚动、只读预览不触发全存档序列化。
- Resolution/事件日志有明确数量或字节上限；每地点 Beat 与地点访问上限保证 Run 和存档体积有界。
- 用合成上限 Run 定出 `EventRunSnapshot` 字节 cap；超限 Run 拒绝保存并给出诊断，具体 cap 在实施测量后进入机制文档。
- 恢复时重建对内容定义与 Character ID 的引用，并确认定义版本/引用有效。
- 对内容版本不兼容的 Run 清楚拒绝恢复并提供重新开始路径；遵守项目规则，不写旧存档迁移。
- 事件完成/失败后清理活动 Run，但保留明确需要展示或提交的 EventResult。

## Non-goals

- 不把 OperationRun 纳入 PlayerState per-Init 字段或 InitSnapshot。
- 不做云同步、回放格式、跨版本迁移或多设备冲突合并。
- 不重复实现 StorageAdapter 或 SaveSystem。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| SaveSystem 通过 StorageAdapter 序列化数据；Save 与 Runtime 状态编排分离。 | `docs/docs-829/06-wiki/20-data-services/persistence-assets.md`；`src/arona-clicker/runtime-save.ts`；`src/arona-clicker/runtime-save-codec.ts` | Run codec 与保存介质分工明确。 |
| Save/load 会重建运行态；per-Init 快照与其他 PlayerState 字段由专门规范区分。 | `docs/docs-829/03-data-structures/player-state.md`；`src/arona-clicker/state/per-init-fields.ts` | EventRun 作为独立存档子域，不混入 Init 恢复规则。 |

## Data / API

- `EventRunSnapshot`：内容/规则版本标识、唯一权威 Run 状态、地点状态、ActorState、PreparedBeat、InterventionDraft、随机游标、有限 Resolution 摘要。
- `SaveSystem` 扩展边界只承载该快照的存取；业务恢复/校验由操作 Runtime 完成。
- 定义副本、Registry lookup 索引、OperationView、DOM/UI 状态不进入 snapshot；缓存均从现有 Datapack/Registry 重建。

## Runtime Flow

暂停点请求存档 → OperationRuntime 生成一致快照 → SaveSystem 持久化 → 之后读取并校验内容/角色引用 → 重建 EventRun 和 PreparedBeat → 生成相同 OperationView 并继续 Commit。

## Acceptance

- [ ] 在 Commit 前保存包含一次学生行动修订的 Run，恢复后看到相同 PreparedBeat/InterventionDraft；Commit 结果与不中断时相同。
- [ ] 在路线切换后保存并恢复，当前 Location、访问次数和 EventState 保持一致。
- [ ] RNG seed/cursor 恢复后，不重掷既有预备结果，也不跳过下一次应发生的随机结算。
- [ ] 损坏 snapshot、未知事件/角色引用或定义版本不兼容均返回完整诊断，不生成半恢复 Runtime。
- [ ] 保存和恢复不改写 PlayerState/InitSnapshot；终局奖励仍只提交一次。
- [ ] 存档不包含 Registry 定义副本、可重建索引、OperationView、DOM 或无界日志；EventRunSnapshot 有明确字节 cap，超限快照不写入且不会留下部分更新。
- [ ] 现有存档升级不通过迁移兼容实现；破坏性运行结构变更遵守“旧存档清档”护栏。

## Tests

- **Unit：**snapshot codec 往返、字段省略/非法引用诊断。
- **Runtime：**Commit 前/后、地点之间与事件终局恢复；对比 uninterrupted replay。
- **Integration：**SaveSystem 存取与 Runtime 重建，奖励提交幂等。
- **UI：**暂停/恢复界面反馈和恢复位置说明。

## Dependencies

- 依赖 Task 0213–0218 的完整 EventRun、Actor、PreparedBeat、Resolution 和路线状态。

## Documentation / GALHCG

- 稳定后更新 `docs/docs-829/03-data-structures/player-state.md` 所属边界或新增 Operation 存档机制页，并更新 Save/Runtime Wiki。
- GALHCG 记录 Run snapshot 的稳定 owner/恢复职责；codec 字段与 StorageAdapter helper 不建独立 Concept。
- Read Set：`docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/06-wiki/20-data-services/persistence-assets.md`、SaveSystem/Runtime save 源码与测试、Task 0213–0218。

## 当前核验与剩余工作

当前只核对 SaveSystem、InitSnapshot 与状态分层；未实现、未运行测试。定义版本匹配采取何种内容哈希由 DataPack/Registry 实际版本字段决定，不另造第二版本系统。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0213-gameplay-b-event-runtime-and-session-state]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[docs/docs-829/05-conventions/testing]]
