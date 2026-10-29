# Task-0063：Runtime Editor Command Facade 与 Materialization 边界收口

状态：closing

**状态**：🟡 P0–P3 已实施并通过自动化验收；Edge 手工验收受 Computer Use 桥接阻断  
**日期**：2026-09-14  
**前置**：[[runtime-editor-overlay-sol-review]]、[[adr-0010-definition-repository-editor-resolution]]、[[adr-0011-definition-resolution-withdrawal]]、[[adr-0012-runtime-hot-content-crud]]  
**关联**：[[task-0061-runtime-hot-content-crud-spot]]、[[task-0062-runtime-spot-editor-simple-flow]]

## 一、目标

为游戏内 Runtime Editor 提供一个薄的、Editor-oriented Command Facade，使 UI 只表达编辑意图，不直接了解 Runtime 热内容提交的内部安全机制。Facade 是调用便利层，不是 Runtime 安全边界，也不是新的 Runtime 子系统。

目标调用链：

```text
UI Draft
   ↓ 编辑意图
RuntimeDefinitionEditor
   ↓ RuntimeSpotMutation
RuntimeContentCoordinator
   ↓ 原子 Registry mutation
Runtime Materialization / Projections
   ↓
成功提交，或 receipt rollback
```

本任务同时把以下术语和成功条件固定到实现与测试中：

- **Resolution**：Definition 来源解析为 `resolved / suspended / missing`；
- **Materialization**：有效 Definition 投影为 Registry、索引、GameNum、Visibility 和 Runtime Service 可消费结构；
- **mutation success**：Definition 校验通过，且该 mutation 声明要求的所有必要 Runtime Projections 均同步成功。

## 二、当前事实

当前系统已经具备本任务所需的内部能力：

- `RuntimeDatapackEditorState` 保存 Editor Draft，当前 UI 一次呈现和提交一个 Spot；
- 一个 EditingWorkspace 只使用一个临时 Mod，但 Runtime 可保存多个已应用 Spot；
- `RuntimeSpotMutation` 已覆盖 `create / replace / delete / suspend / resume`；
- `RuntimeContentCoordinator` 已负责 owner、revision、candidate 校验、Registry 提交、派生观察者、失败回滚和 RuntimeModState；
- Registry 已提供受控 Spot mutation receipt，并维护 Spot、Area、Tag、owner、suspended 等结构；
- `spotDefinitionChanged` 已驱动当前 Spot 范围内的 GameNum 与 Visibility 定向更新；
- `DefinitionSourceLayer[]`、Tombstone 和 `DefinitionResolution` 属于纯 Definition Resolution 模型，不是本任务要改写的 Runtime Layer Stack。

本任务的主要缺口是边界表达：UI/Editor 调用面仍可能直接拼装 Runtime command 所需的 owner、revision 和内部字段；“索引失效”也需要在任务口径中统一提升为 Materialization / Projection 更新。

## 三、硬边界

### 必须支持

- 提供一个薄的 Editor Facade，至少覆盖当前 Spot 主流程：
  - `createSpot`；
  - `replaceSpot`；
  - `deleteSpot`；
  - `suspendSpot`；
  - `resumeSpot`。
- Facade 负责把 UI 编辑意图翻译为现有 `RuntimeSpotMutation`；
- Facade 可以读取构造 mutation 所需的 workspace、owner 和 revision 上下文，但不复制或预执行 Coordinator 的校验；
- Facade 隐藏 `expectedRevision`、owner/source 约束、receipt、rollback、Area/Tag index、GameNum 和 Visibility 等内部细节；
- 不改变当前单临时 Mod、多已应用 Spot、单 Spot mutation 的产品边界；
- 为必要 Runtime Projection 的成功/失败建立明确测试口径；
- 必要 Projection 失败时，整次 mutation 返回失败并执行既定回滚；
- Editor Presentation State 继续由 Editor/Draft 侧表达，不进入 Runtime Definition 状态模型。

### 明确不做

- 不重构或删除 `DefinitionSourceLayer[]`；
- 不创建通用 `LayerManager`、Layer priority、merge strategy 或 conflict resolution；
- 不把 Runtime Spot mutation 重构成通用 Definition Resolution source layer；
- 不实现多 Mod 编辑、多实体批量提交或 Runtime mutation history；
- 不把 Undo/Redo 历史放入 RuntimeContentCoordinator；
- 不新增跨所有 Def 类型的 generic event；`spotDefinitionChanged` 继续保留；
- 不实现通用 Def 热 unload、跨类型 Materialization Planner 或依赖图状态机；
- 不改变 Tombstone 正式 Datapack/PackManager 持久化边界；
- 不新增存档迁移代码。

## 四、设计约束

### 4.1 Facade 只翻译意图，不拥有 Runtime 状态或安全规则

Facade 不保存独立的 Layer、Transaction、History 或 Dependency Graph。它可以读取构造 mutation 所需的当前 workspace、owner 和 revision 上下文，但 owner、revision、candidate legality 等判断的唯一权威仍是 `RuntimeContentCoordinator`；Facade 不复制或预执行这些校验。

`RuntimeDefinitionEditor` 是 Editor 调用便利层，不是 Runtime 安全边界；它不得复制 Coordinator 的校验、Materialization、revision 判定或 rollback 责任，也不得成为绕过 Coordinator 不变量的唯一入口。任何合法调用者即使绕过 Facade 直接使用 Runtime command port，仍必须受到 Coordinator 的完整校验、原子提交与回滚约束。

推荐语义：

```text
editorDefinitions.createSpot(input)
editorDefinitions.replaceSpot(id, input)
editorDefinitions.deleteSpot(id, playerDataPolicy)
editorDefinitions.suspendSpot(id)
editorDefinitions.resumeSpot(id)
```

具体返回值可以继续复用或包装 `RuntimeSpotMutationResult`，但不得把内部 receipt 或可写 Registry 暴露给 UI。

### 4.2 Resolution 与 Materialization 不合并

`DefinitionSourceLayer[]` 继续负责：

```text
Draft → Pack → Base
       ↓
resolved / suspended / missing
```

Facade 不直接操纵 `layers.push()`、`layers.remove()`、priority、reorder 或 merge。若未来需要 Editor 侧来源查询，应通过 Editor-oriented Definition Query/Facade 封装，而不是让 UI 获取层数组。

`RuntimeContentCoordinator` 继续负责：

```text
validate
→ Registry mutation
→ required Runtime Materialization / Projections
→ success or rollback
```

### 4.3 必要 Projection 是 mutation 成功的一部分

Materialization 的 required/optional 边界归属于 `RuntimeContentCoordinator` 与各 projection adapter/observer，不属于 Facade。Facade 只知道有哪些命令，不知道一次命令需要更新哪些 Runtime Projection。

对当前 Spot 字段，State-owning Projection 至少包括 Registry 主表、Area/Tag 索引、GameNum Spot 子树和 Visibility 状态。事件通知本身不是 Projection 成功的替代品。

SpotService 查询可用性默认属于 Verification Consumer：测试可以验证 mutation 成功后 SpotService 能正确查询，但不因此要求 SpotService 提供独立 mutation receipt。只有当某个服务实际维护自己的缓存或物化状态时，才将其纳入 required Projection。

如果某个未来字段没有明确的 Materialization 协议，Coordinator 应在提交前返回 `unsupported` 或其他明确诊断，不得先写 Registry 再把后续失败留给订阅者。必要 Projection 失败不是“订阅者自己的事情”，而是当前 mutation 的失败。

### 4.4 状态分类保持单向

```text
Definition Resolution Status
  resolved / suspended / missing

Editor Presentation State
  created / modified / removed / unchanged
```

Runtime 不需要知道 `modified`；Editor 也不应通过伪造 `suspended` 或 `missing` 来表达 UI 分类。Def 的存在与 PlayerState 的存在继续分离，`purge` 仍必须是显式策略。

## 五、施工切片

### P0：调用面与 Materialization 契约核对

- [x] 盘点当前 UI、GameCommands、Runtime command port 对 `RuntimeSpotMutation` 的直接依赖；
- [x] 确认 Facade 的最小方法签名和返回值，不复制 Coordinator 的校验逻辑；
- [x] 将当前 Spot mutation 的 State-owning Projections 与 Verification Consumers 分开盘点；
- [x] 为 `Candidate validated / mutation prepared`、`Runtime Materialization succeeded`、`commit success` 三个阶段补充术语说明；
- [x] 确认不需要修改 ADR-0010～0012。

### P1：Runtime Editor Command Facade

- [x] 新增薄 Facade，并接入当前 Editor 主调用面；
- [x] Facade 将 UI 输入转换为单个 `RuntimeSpotMutation`，只补齐上下文，不复制 Coordinator 校验；
- [x] UI 不再拼装或持有 revision、owner/source、Registry receipt 等内部对象；
- [x] 确认绕过 Facade 的合法 Runtime command port 调用仍经过 Coordinator 的完整校验与回滚；
- [x] 保持 create/replace/delete/suspend/resume 的既有语义、诊断和 PlayerState retain/purge 规则；
- [x] 不引入新的 Runtime 状态存储。

### P2：Materialization 成功与回滚验收

- [x] 覆盖 Registry、Area/Tag、GameNum、Visibility 等 State-owning Projection 的必要更新；
- [x] 单独验证 SpotService 作为 Verification Consumer 的查询结果，不为只读查询强行增加 rollback participant；
- [x] 模拟任一必要 Projection 失败，验证整体 mutation 失败；
- [x] 验证失败后 Registry、索引、派生结构、RuntimeModState、PlayerState 均恢复；
- [ ] 验证可选观察者失败不会被误报为必要 Projection 成功；若当前没有可选观察者，记录为后续边界而不虚构实现；
- [x] 保持正常热路径不调用整包 `reloadPreservingState()`。

### P3：边界回归与文档同步

- [x] 补 Facade 行为测试和单 Spot UI 调用回归测试；
- [x] 补 Resolution Status 与 Editor Presentation State 不交叉存储的测试/断言；
- [x] 更新相关模块卡片或任务文档中的“索引失效”措辞为 Materialization / Projection；
- [x] 完成 `npx tsc --noEmit`、`npm run check:architecture`、`npm test`、`npm run build`；
- [ ] 完成 Edge 手工验收：新建、编辑、删除、挂起/恢复、失败提示与恢复后 UI 状态。

## 六、验收标准

| 场景 | 预期 |
| --- | --- |
| UI 新建 Spot | 只调用 Facade；Facade 产生一个 create mutation；成功后 Spot 与所有必要 Projection 可用 |
| UI 编辑 Spot | 只调用 Facade；只替换目标 Spot，其他已应用 Spot 与 PlayerState 不变 |
| UI 删除 Spot | 只删除目标 Spot；Retain/Purge 语义保持现状 |
| UI 挂起/恢复 | 继续保留 owner 约束；Tombstone/解析语义不被 UI 直接重写 |
| revision 过期 | Facade 返回明确失败；旧 Runtime 与 PlayerState 不变 |
| Registry 写入成功、必要 Projection 失败 | 整次 mutation 失败并 rollback，不返回 success |
| Facade 被绕过 | 合法 command port 调用仍由 Coordinator 完成 owner、revision、candidate、原子提交与 rollback 校验 |
| 可选观察者失败 | 不伪装成必要 Projection 成功；按明确的 optional 诊断策略处理 |
| 正常热路径 | 不调用整包 `reloadPreservingState()`；不调用未授权的全量 Layer 管理 API |
| Editor 状态展示 | `created/modified/removed/unchanged` 不写入 Runtime Definition Resolution 状态 |

## 七、停止条件与后续拆分

遇到以下需求时停止本任务，另建 ADR 或 Task：

- 需要改变 `resolved / suspended / missing` 的语义；
- 需要让 Facade 直接管理多个来源层、优先级或冲突；
- 需要多个 Definition 一起提交或引入批量事务；
- 需要跨 Story、Character、PassivePool、Trigger、Affector 等类型建立统一 Materialization；
- 需要把 Tombstone 写入正式 Datapack/PackManager；
- 需要实现通用 Def unload、依赖图传播或 Runtime mutation history；
- 需要让 Definition Mutation 与 PlayerState purge 建立新的自动联动。

## 八、完成记录

已实施：

- 新增 `RuntimeDefinitionEditor`，只负责从当前 Runtime 上下文构造 Spot mutation；
- `AronaClickerRuntime` 与 `GameCommands` 暴露 Editor Facade 的窄接口；
- Runtime Editor 顶栏的新建、替换、删除路径统一通过 Facade；旧 `applyRuntimeMod` / `applyRuntimeSpotMutation` 入口仍保留在 Runtime API 侧供迁移期调用者使用；
- Facade 不复制 Coordinator 的 owner、revision、candidate legality、Materialization 或 rollback 规则；
- 增加 Facade create/replace 回归测试，验证 metadata 后首次提交能正确取得 Mod 上下文并递增 revision。
- UI 在 Facade 不可用时显示明确错误，不再从热编辑主流程直接拼装 Runtime mutation。

自动化验收：

- `npx tsc --noEmit` 通过；
- `npm run check:architecture` 通过；
- `npm test` 通过（157 个测试文件 / 1463 项）；
- `npm run build` 通过；
- `git diff --check` 通过。

剩余工作：Edge 手工验收 Facade 接线后的新建、编辑、删除、挂起/恢复、失败提示与恢复后 UI 状态。2026-09-14 尝试三次读取浏览器状态（含一次会话重置）均因 `nodeRepl.fetch request failed` 失败，当前没有可用浏览器/页面状态；未将该项误报为完成。

## 九、相关代码与文档

- `src/ui/workspace/runtime-datapack-editor-state.ts`：Editor Draft 与当前 Spot 选择状态；
- `src/ui/components/runtime-datapack-editor.ts`：游戏内 Runtime Editor UI；
- `src/arona-clicker/contracts/runtime-content.ts`：`RuntimeSpotMutation` 与结果契约；
- `src/arona-clicker/services/runtime-content-coordinator.ts`：校验、提交、revision 与回滚；
- `src/data-services/registry/registry-spot-mutation.ts`：Registry Spot mutation receipt；
- `src/data-services/definition/definition-resolution.ts`：纯 Definition Resolution 与 Tombstone；
- [[runtime-editor-overlay-sol-review]]：Sol 三次回复与事实核查；
- [[task-0061-runtime-hot-content-crud-spot]]：Spot 热 CRUD 实施边界；
- [[task-0062-runtime-spot-editor-simple-flow]]：单 Spot UI 流程边界。
