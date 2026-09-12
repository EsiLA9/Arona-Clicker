# 07-audit/dormant-machinery — 休眠与预留机制

> 本文回答：**已实现 / 已声明但当前无消费方的机制群，逐项处理方案。** 本文是 2026-08-30 审查快照，处理建议不代表已经执行。
> 仓库先例：ChatMessageDef 整表移除（2026-08-29，见 [[docs/docs-828/03-data-structures/id-reference-semantics]] 特别说明 3）——砍预留机制已有成熟路径。

## 共同原因与成本

休眠机制占 schema、快照、文档、测试四面；且声明式数据包里「声明了却不生效」最易误导数据作者（id-ref §六.4 原话）。**多 Datapack 前提下第三方作者更会被未接线字段误导**——未接线项要么删，要么在 schema 加显著 `@unwired` 提示。

## 问题清单

| 机制 | 位置 | 状态 | 推荐动作 |
| --- | --- | --- | --- |
| `refreshWorldPool` + `state.worldPool` | `02-modules/character.md:15`、`03-data-structures/player-state.md:34` | 已实现、无调用点 | 删 |
| `chatRead` / `markChatRead` / `chatReadChanged` | `03-data-structures/player-state.md`、`04-mechanisms/trigger-effect.md`、[[docs/plan-work/completed/affection-planning]] | 保留、无写入方（裁定供复用） | 限期接线或删 |
| EffectOp `loot` | `04-mechanisms/trigger-effect.md:16` ↔ `02-modules/world.md:50` | 文档矛盾（见下） | 先核代码，再接线或删 |
| Trigger `maxRuns`（引擎支持） | `02-modules/effect-trigger.md:15`；DSL 无此字段（`declarative-dsl.md:112`） | 数据从不使用 | 删，保留 `once` |
| `state.enhancementAttachments` | `03-data-structures/id-reference-semantics.md:65` | 引擎只写不读，UI 用 id 分组 | 标注「仅 UI」或删 |
| 组件级 CSS 变量预留覆写点 | `02-modules/ui.md`、[[docs/plan-work/completed/affection-planning]] §3 | 预留、有明确重肤用途 | 保留（低优先） |

### 1. refreshWorldPool + worldPool

- **原因**：「池关闭成员并入世界 Pool」的玩法未立项，服务、状态字段、测试全部休眠。
- **方案组**：**A（推荐）删**（服务 + 字段 + 测试）；玩法立项时重写——纪律 8 下无迁移负担。B 接线（需先定触发时机）。

### 2. chatRead 全链

- **原因**：轴 A 消息成分移除后遗留的读追踪基础设施，planning 裁定「供未来复用」保留；继续占 PlayerState 字段、快照登记（`characterPersistConfig` chatRead 分支）与事件目录。
- **方案组**：A **限期**：下一次文档库重建时仍无写入方则删。B 立即删（读追踪需求出现时重加，成本低）。C 接线（把聊天流演出事件记入已读）。

### 3. EffectOp `loot`

- **原因**：文档自相矛盾——`trigger-effect.md:16` 称「no-op 预留、未接线」，`world.md:50` 却写「掉落池结算（`loot` effect → giveItem）」。需先核对代码实况。
- **方案组**：A 若 LootSystem 已可用 → effect-engine 接线分发 + 补测试。B 若确无消费 → 删 op 与 LootSystem，`DropTableDef` 待掉落玩法立项再加。

### 4. Trigger maxRuns

- **原因**：引擎支持 `maxRuns` 语义，但 DSL 的 `TriggerDef` 只有 `once?`（`declarative-dsl.md:112`）——数据作者无法声明的通用化。
- **方案组**：**A（推荐）删**引擎内 maxRuns，仅保留 `once`。B 保留则必须进 DSL schema 并写明用途。

### 5. enhancementAttachments

- **原因**：引擎完全不消费；UI 仅用 id 做面板摆位分组与名字展示（id-ref §四表）。
- **方案组**：A 维持但标注「仅 UI 消费」（防误认引擎语义）。B 若 UI 改为直读 `EnhancementDef.attachment`，删运行时副本字段。

### 6. 组件级 CSS 预留覆写点

- **原因**：planning:305 明确用途——不改 DOM/类名即可重肤；属有用途的预留。
- **方案组**：A 保留。B 仅当 theme-tree 美化明确搁置时删变量。
