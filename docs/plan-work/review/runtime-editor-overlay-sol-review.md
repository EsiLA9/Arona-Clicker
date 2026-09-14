# Review：Sol 关于 Runtime Editor 单 Mod / 单实体 Overlay 收缩建议的事实核查

**状态**：🟢 二次回复确认；建议作为后续收敛原则，不直接改写已生效 ADR  
**日期**：2026-09-14  
**评审对象**：Sol 关于 `Base + Editing Overlay`、悬置解析、单实体提交、原子边界、派生索引与 PlayerState 解耦的意见  
**相关文档**：[[docs/plan-work/active/adr-0010-definition-repository-editor-resolution]]、[[docs/plan-work/active/adr-0011-definition-resolution-withdrawal]]、[[docs/plan-work/active/adr-0012-runtime-hot-content-crud]]、[[docs/plan-work/active/task-0062-runtime-spot-editor-simple-flow]]

## 一、结论摘要

Sol 的核心建议应采纳，但应准确限定为“后续通用 Def 编辑能力的设计约束”，而不是对当前代码的字面描述。

建议确认以下结论：

1. Runtime Editor 当前按一个 EditingWorkspace、一个临时 Mod、一次一个实体提交；不需要现在建设通用多 Mod Patch Stack、优先级合成或完整事务框架。
2. Editor 的未提交输入属于 Draft；Runtime 只接收一次已校验的单实体 mutation。当前 UI 已按这一方向收敛。
3. Tombstone / suspended 应改变解析结果，不应把 `suspended` 写入每个引用对象，也不应维护递归传播的实体生命周期状态。
4. 真正需要保留的是小型原子提交边界、派生索引失效和 Definition 与 PlayerState 的分离。
5. `created / modified / removed` 适合作为 Editor View 的推导状态，不应成为 Definition Resolution 的第二套持久状态机。

但有四点必须修正：

- 当前没有名为 `DefLayerManager` 或 `EditingOverlay` 的通用 Runtime 服务；通用层列表只存在于纯 Definition Resolution 测试/规划模型中。
- 当前 Runtime 热路径不是简单的 `getEffective(id) = overlay ?? base`：Spot 局部 mutation 已经同时维护主表、Area/Tag 索引、挂起记录、GameNum、Visibility 和 RuntimeModState。
- 当前提交边界已经不是“直接 `registry.set()` 后发事件”，而是 `prepare → commit → 派生更新 → 失败回滚` 的协调器；不应为此另造大事务系统，但也不能退化成无回滚的简单 setter。
- “一次只操作一个实体”适用于当前 UI 主流程和热 CRUD 提交单位，不等于 Runtime 内部只能保存一个实体。当前 Runtime 仍支持一个临时 Mod 下多个 Spot，且这是已有验收口径。

## 二、事实核查

### 2.1 单 Mod / 单实体边界：基本成立，但要区分 UI 与 Runtime

**结论：采纳，修正“只有一个实体”的范围。**

当前 `RuntimeDatapackEditorState` 仍有 `spots`、`selectedSpotId` 和 `suspendedSpotIds`，说明编辑状态模型可以保存多个 Spot；Task-0060 也明确一个临时 Mod 可承载多个 Spot。Task-0062 已把用户主流程改成一次只展示、编辑和提交一个 Spot。

当前真正固定的是：

```text
1 个 EditingWorkspace
  └─ 1 个临时 Mod
       └─ 多个已应用 Spot

每次 UI 操作 / Runtime 热提交
  └─ 1 个 Spot mutation
```

因此 Sol 的“单实体”应理解为提交原子性和用户操作粒度，而不是把 `RuntimeModState` 退化成单个实体槽位。否则会与 Task-0060/0061 已完成的多 Spot 能力冲突。

### 2.2 是否已经存在通用多层 Runtime Layer：不成立

**结论：部分采纳，事实表述需要收紧。**

`src/data-services/definition/definition-resolution.ts` 的 `resolveDefinition(layers, key)` 确实能按顺序查询多个 `DefinitionSourceLayer`，并支持 `base / pack / draft` 来源、Draft-only Tombstone、`resolved / suspended / missing` 和 Delta。这个模型是 P1A/P1B 的纯解析能力，不是当前 Runtime Registry 的通用多层编辑器。

当前 Runtime 热 Spot 路径使用的是：

- `RuntimeModState.spots: Map<string, SpotDef>`；
- `suspendedSpotIds: Set<string>`；
- 一个临时 Mod 的 owner / revision；
- Registry 的受控 Spot mutation；
- 事件驱动的局部派生更新。

所以“把通用 Layer 降为唯一 Editing Overlay”是适合未来抽象命名的建议，但不应描述为一次必须删除的现有 `DefLayerManager`。目前更准确的目标是：保留 Definition Resolution 的来源层模型作为纯数据层；在 Runtime Editor 侧只暴露单一编辑工作区和单一提交入口，不向调用者暴露层栈管理 API。

### 2.3 Overlay 记录是否必须保存 `created / modified / removed`：基本成立

**结论：采纳。**

当前 Definition Resolution 已把“解析状态”定义为 `resolved / suspended / missing`，把编辑操作拆成 `setDefinitionRecord`、`deleteLocalDefinition`、`removeOverride`、`suspendDefinition`、`resumeDefinition`。这已经证明“编辑意图”和“解析结果”不应混为一个字段。

Editor 的 `created / modified / removed / unchanged` 可以由以下信息推导：

```text
是否有当前编辑记录
基础/参考来源是否存在
当前解析是否被 Tombstone 阻断
```

但“modified”不能只看是否有 Overlay value：如果未来允许编辑包覆盖参考包，必须比较当前编辑记录与有效下层记录的来源关系；如果没有可靠来源链，则不应提前承诺精确的 UI 状态。当前 Spot MVP 只需要 owner、当前状态和操作结果，不需要增加持久化 edit-state 字段。

### 2.4 Tombstone 与 `overlay.delete()` 的语义区分：成立

**结论：采纳，且与 ADR-0011 一致。**

`resumeDefinition()` 只移除当前 Draft owner 自己的 Tombstone；`deleteLocalDefinition()` / `removeOverride()` 则是移除当前层记录并允许继续解析下层来源。测试已经覆盖：Tombstone 不删除 source record；有候选来源时结果是 `suspended`；没有候选来源时结果是 `missing`；其他 owner 不能替换或恢复当前 owner 的 Tombstone。

因此不能把“撤回当前编辑”与“明确要求有效视图中不存在”统一成一个 `delete`。面向 Editor 的 API 可以简化，但内部必须保留这两个不同语义。

### 2.5 悬置作为解析失败/不可用结果，而非级联实体状态：成立

**结论：采纳。**

当前解析模型返回 `resolved / suspended / missing`，引用仍保留原始 ID；没有代码证明项目维护了 `SUSPENDED → RECOVERING` 等递归实体状态机。现有文档也已裁定：Area 祖先不可达属于 Runtime Availability，不能伪装成子 Def 被删除。

后续应继续坚持：

```text
引用保存 ID
        ↓
Resolver 返回解析结果与原因
        ↓
具体消费者按 required / optional / symbolic 策略处理
```

这不等于完全不需要依赖信息。诊断、失效范围和派生索引仍可能需要引用关系；只是该信息不应被物化成每个 Def 的可变 suspended 生命周期状态，也不应由通用 Resolver 替所有消费者决定“级联删除”。

### 2.6 不建设完整 Transaction / Undo：大体成立，但当前仍需要原子回滚

**结论：采纳“不要建设事务框架”，保留“单 mutation 原子边界”。**

`RuntimeContentCoordinator` 当前已经按单个 `RuntimeSpotMutation` 做准备、校验、owner/revision 检查、Registry 提交、派生观察者通知和失败回滚；Registry 层有 mutation receipt。测试覆盖了 stale revision、候选失败、PlayerState 保留/清理和回滚路径。

因此推荐的边界是：

```text
Editor Draft / 可选的 Editor Undo-Redo
        ↓ Apply
RuntimeContentCoordinator.prepare
        ↓
Registry commit + derived update
        ↓
成功事件，或完整回滚
```

不应添加 `beginTransaction / stage / commitBatch / TransactionPlan` 来模拟当前不存在的批量编辑需求；但也不能把原子性降为“Map 改完再尽力通知”。这里的原子是一次受控 mutation 的工程不变量，不是通用事务产品。

Undo/Redo 当前尚未由 Runtime 服务承载，也不是 Task-0062 的需求。未来若增加，应优先放在 Editor Draft/History；若 Undo 已经作用于已提交 Runtime，则它只是再次提交一个 `replace / remove / restore` mutation，不应要求 Runtime 保存完整历史栈。

### 2.7 事件是否应收缩为一个通用事件：方向成立，当前不宜改名

**结论：暂不施工。**

当前 Spot 热 CRUD 已有 `spotDefinitionChanged`，事件目录和 GameNum/Visibility 的订阅也已完成。它只覆盖当前首阶段 Spot 字段和派生系统，属于比抽象的 `runtimeDefChanged` 更明确的窄事件。

可以把下列原则作为未来扩展约束：不为同一单实体 mutation 设计多段生命周期事件；事件携带 key、operation 和必要的结构摘要，不默认携带大 Def；消费者收到事件后重新查询自己的只读来源；当多个 Def 类型确实共享同一消费者协议时，再评估统一 `runtimeDefinitionChanged`。

现在直接把 `spotDefinitionChanged` 改成通用事件，会扩大已验收范围，也不能解决复杂 Def 尚未具备失效协议的问题。

### 2.8 派生索引是当前最值得投入的区域：确认，且已有 Spot 先例

**结论：采纳。**

当前 Registry Spot mutation 已维护 Spot 主表、Area 索引、Tag 索引、owner 与 suspended 记录。`spotDefinitionChanged` 已驱动 GameNum Spot 子树、Visibility Spot 索引和当前 Spot 服务刷新；测试明确验证热路径不调用 `reloadPreservingState()`、`GameNumSystem.buildAll()` 或 `VisibilityEngine.rebuild()`。

这说明本轮意见不是要重新发明一个抽象 Invalidation Solver，而是确认当前路线：对已有 Def 类型维护窄、可测试的派生更新协议；复杂字段没有完整失效证据时，先拒绝或回退到明确的整包路径。通用 `RuntimeInvalidationPlanner` 仍应另建任务，不应塞回当前 Spot MVP。

### 2.9 Definition 与 PlayerState 分离：成立，但 purge 是显式例外

**结论：采纳。**

ADR-0012 和当前测试已经固定：replace 默认保留同 ID PlayerState；delete 默认 retain；delete + purge 才清理目标 Spot 的当前状态、Init 快照和 Tag 覆盖；suspend 保留 source record 和 PlayerState；create 不自动创建等级、经理或快照。

因此“Def 不存在”不能推导出“State 必须删除”。但这条原则不能被解释成 Runtime 永远不能清理 State：清理必须是带明确产品语义、目标范围和测试的显式操作，并继续遵守 `StateMutationService` 单一写入口。

## 三、修正后的目标模型

当前阶段建议把目标模型写成：

```text
Editor
  ├─ current Draft / optional Editor History
  └─ one EditingWorkspace
       └─ one temporary Mod
            └─ many applied Spot records
                  │ one mutation per commit
                  ▼
RuntimeContentCoordinator
  ├─ validate / owner / revision
  ├─ Registry controlled mutation
  ├─ derived-index invalidation
  └─ rollback receipt
                  ▼
Effective Runtime Spot View
```

Definition Resolution 作为未来跨来源能力继续保持纯数据层：

```text
Draft source → Pack source → Base source
       └─ resolve: resolved / suspended / missing
```

两者的边界是：当前 Runtime Spot 热 CRUD 可以拥有自己的受控局部物化；它不因此自动升级为通用多来源 Runtime 合成系统。

## 四、建议采纳的后续规则

### 保留

- 单临时 Mod 约束；
- 单实体 mutation 提交单位；
- Draft 与 Runtime 的边界；
- `suspend`/Tombstone 与移除当前层记录的语义差异；
- 引用保留 ID，悬置由解析/诊断产生；
- 小型 prepare/commit/rollback 原子边界；
- 派生索引的窄协议和按 Def 类型的失效测试；
- Definition existence 与 PlayerState existence 解耦。

### 暂不做

- 通用 `LayerManager`、Layer priority、merge strategy、conflict resolution；
- 多 Mod 同时编辑或来源栈 UI；
- 通用 Def 热 unload；
- 级联 suspended 状态图和 resume dependency tree；
- Runtime mutation history / Undo stack；
- 跨所有 Def 类型的统一增量依赖求解器；
- Tombstone 正式 Datapack/PackManager 持久化；
- 直接把 Spot 窄事件改造成全局通用事件。

## 五、对现有文档的影响

本 Review 不修改 ADR-0010、ADR-0011 或 ADR-0012 的已生效语义。它补充一条实现层解释：

> “Editing Overlay”是当前单 Mod 编辑边界的概念名，不是授权建立 N 层 Runtime Patch Stack 的入口；Definition Source Layer 仍是纯解析模型，Runtime 局部 mutation 仍须通过受控协调器和派生失效协议。

Task-0062 的“用户一次只编辑一个 Spot”继续有效；Task-0060/0061 的“一个临时 Mod 可有多个已应用 Spot、一次提交只处理一个 Spot”也继续有效。若未来重新引入多项 Draft、批量提交、复杂 Def 热替换或正式导出，应另建 ADR/Task，不在本 Review 或现有 Spot 任务中扩张范围。

## 六、最终判断

Sol 的意见不是要求“大改 Layer 架构”，而是要求把抽象保持在当前产品边界内。事实核查支持这一判断：当前项目已经沿着单 Mod、单 mutation、局部索引刷新、状态保留和 Draft-only Tombstone 方向实施；尚未拥有需要被拆除的通用 Runtime Layer 管理系统。

最划算的后续动作不是重命名大量现有代码，而是继续守住边界：对外使用 Editor 导向的单实体命令，对内保留解析层与 Runtime 物化层的分工，把工程复杂度投入原子失败恢复、派生索引正确性、诊断和 Def/State 解耦。

## 七、Sol 二次回复：补充确认与最小后续方向

Sol 对本 Review 的主要修正表示认可，并进一步确认：当前应收缩的是抽象边界，不是把现有 Runtime 热路径强行改造成教科书式 Overlay。尤其应保持以下两套机制分离：

```text
Definition Resolution
  解释某个 Definition key 最终从哪个来源解析出来

RuntimeContentCoordinator
  解释一个已确认的编辑结果如何安全进入运行时
```

两者共享 `suspend/tombstone` 与“移除当前层覆盖”之间的语义，但不应因为共享语义就把 Runtime Spot mutation 重构成 `DefinitionSourceLayer[]`。

### 7.1 固定 Resolution 与 Materialization 术语

后续文档建议固定使用：

- **Resolution**：来源记录经过优先级/阻断规则后，某个 Definition key 解析为 `resolved / suspended / missing` 的结果；
- **Materialization**：将有效 Definition 投影为 Runtime 可消费结构，并同步必要的 Registry、索引和派生系统。

Spot 的完整链路因此应表达为：

```text
Source Records
      ↓ Resolution
Effective SpotDef
      ↓ Materialization
Registry / Area index / Tag index / GameNum / Visibility
```

这里必须保留一个重要不变量：

> Definition Mutation 成功，不等于 Runtime Mutation 成功；只有 Definition 可接受且要求的 Runtime projections 均同步成功，整个 mutation 才算成功。

这正是现有 `RuntimeContentCoordinator`、Registry mutation receipt 和失败回滚继续存在的理由。纯 `EditingOverlay` 不能替代 Materialization 的原子边界。

### 7.2 Effective Definition 不是唯一事实源

未来通用 Def Editor 不应把 Effective Definition 误解为 Runtime 唯一真源。当前运行时真正消费的是：

```text
Definition
  + Registry
  + Area / Tag 等关系索引
  + GameNum / Visibility 等派生结构
```

因此后续设计应继续区分：来源记录、解析结果、Registry 物化结果和派生 Runtime State，而不是用一个“有效 Def”对象代表全部运行时事实。

### 7.3 Edit State 保持可推导，但为未来保留基础事实

当未来出现 `Base → Pack A → Pack B → Editing Mod` 的来源链时，Editor 内部若要诊断“当前编辑值与下层值相同”的冗余覆盖，可以保留这些基础事实：

```ts
{
  effectiveSource,
  localRecord,
  lowerResolvedRecord,
  blockedByTombstone,
}
```

UI 再将其映射为 `created / modified / removed / unchanged`，并可额外提示 `redundant override`。这不改变当前阶段“不持久化 EditState”的结论；它只是避免未来把 `modified` 这个 UI 分类误当成底层事实。

### 7.4 事件演进顺序：typed event → shared protocol → generic event

当前 `spotDefinitionChanged` 应继续保留，因为它明确承诺 Spot 热 CRUD、GameNum 和 Visibility 的已实现响应范围。直接改成 `runtimeDefinitionChanged` 会暗示所有 Def 类型都支持同一种热更新协议，形成虚假能力承诺。

后续更稳妥的演进顺序是：

```text
先保留按 Def 类型的 typed event
        ↓
多个类型确实共享时抽取 shared protocol
        ↓
最后才评估 generic event
```

### 7.5 最小后续施工：Runtime Editor Command Facade

如果要改善 Editor API，Sol 建议只增加一个很薄的 Facade，例如：

```text
RuntimeDefinitionEditor
  createSpot(...)
  replaceSpot(...)
  suspendSpot(...)
  resumeSpot(...)
  deleteSpot(...)
```

它只负责把 Editor 的操作意图翻译成现有 `RuntimeSpotMutation`，再交给 `RuntimeContentCoordinator`。它不拥有 Layer、Transaction、History、Dependency graph，也不向 UI 泄漏 revision、owner、receipt、Area index、GameNum 或 Visibility 的内部细节。

该 Facade 属于后续可选的接口收敛任务，不修改 ADR-0010～0012，也不改变当前 Spot 热 CRUD 的内部安全机制。若实施，应另建小任务记录 API 迁移和 UI 调用点；在没有实际重复调用或泄漏问题前，不要求为了抽象而新增一层。

## 八、二次回复后的架构裁定句

> 当前 Runtime Editor 采用“单工作区、单临时 Mod、单实体 mutation”的产品边界；Definition Resolution 负责来源解析，RuntimeContentCoordinator 负责受控 Materialization，两者共享 Tombstone/撤回等语义但不合并实现。Editor 只持有 Draft 和操作意图，不拥有 Runtime Layer Stack、事务历史或派生依赖状态机；Runtime 的 mutation success 必须同时满足 Definition 可接受与要求的 Runtime projections 同步成功。

## 九、Sol 三次回复：术语与 API 边界的最终收紧

Sol 认可本 Review 已经可以作为后续设计约束，并补充三条防止重新误读的原则。

### 9.1 Editing Overlay 是语义概念，不是强制数据结构

`Editing Overlay` 描述的是：当前编辑 Mod 对下层来源形成局部覆盖的编辑语义。它不要求 Runtime 必须存在一个独立的 Overlay Map、Layer 对象或 Layer Manager。

因此不得从该术语推导出：

```text
BaseLayer / PackLayer / RuntimeLayer / EditorLayer / PreviewLayer
```

当前更稳妥的表达是：保留 Definition Resolution 的来源层模型；Runtime Editor 只表达本地编辑意图；Runtime 是否用 Map、物化记录或其他结构实现，由具体 Runtime mutation 负责。

### 9.2 用 Runtime Materialization / Projection 覆盖“索引失效”

Spot 的更新对象已经不只是传统索引：

```text
Effective Definition
      ↓ Runtime Materialization
Registry
Area / Tag indexes
GameNum subtree
Visibility state
runtime services
```

因此“derived-index invalidation”只能被视为 Materialization 的一种实现策略，而不是总概念。后续涉及 Story、PassivePool、Character 或其他 Def 时，凡是从有效定义建立或更新的 Runtime 可消费结构，都应纳入对应的 Materialization / Projection 协议；没有完整协议时，不得因为它“不像索引”就绕过失效和回滚边界。

### 9.3 正式固定 mutation success 条件

单实体 mutation 的成功条件不是 Definition Registry 已写入，而是：

> Definition 可接受，且该 mutation 声明要求同步维护的所有必要 Runtime Materialization / Projection 均成功完成；任一必要 projection 失败，整个 mutation 失败并执行既定回滚。

因此以下顺序不能被当作完整成功实现：

```text
registry.replaceSpot(...)
eventBus.emit(...)
return success
```

正确语义仍是：

```text
prepare / validate
      ↓
Registry mutation receipt
      ↓
required Runtime Materialization / Projections
      ↓
全部成功 → commit / success
任一失败 → rollback(receipt) / failure
```

`GameNum`、`Visibility` 或其他必要消费者的失败不是“订阅者自己的事情”，而是当前 mutation 的失败。可选观察者可以另行定义非阻断通知，但必须明确标注为 optional，不能混入必要 projection。

### 9.4 DefinitionSourceLayer[] 保留；收紧的是 Editor API

现有 `DefinitionSourceLayer[]` 不应删除，也不应为了 Runtime Editor 改成单 Overlay。它承担的是“同一个 Definition key 在多个来源中如何解析”，这本来就是来源层问题。

真正不应暴露给 Runtime Editor 的是：

```text
layers.push / layers.remove
priority / reorder
merge / conflict resolution
```

如果实际调用面出现泄漏，再增加 Editor-oriented facade，例如：

```text
editingDefinitions.get(key)
editingDefinitions.set(key, value)
editingDefinitions.removeOverride(key)
editingDefinitions.suspend(key)
editingDefinitions.resume(key)
```

Facade 负责隐藏 `Draft → Pack → Base` 的来源排列和 Tombstone 细节；底层解析模型保持不变。当前没有必要为了预防性抽象而重构 `DefinitionSourceLayer[]`，也不应把纯解析 Facade 与 RuntimeContentCoordinator 合并。

### 9.5 Resolution Status 与 Editor Presentation State 永不互相进入

最终固定以下分类边界：

```text
Definition Resolution Status
  resolved / suspended / missing

Editor Presentation State
  created / modified / removed / unchanged
```

判断标准是：正常游戏运行是否需要知道该状态。`suspended` 会影响 Runtime 解析与可用性；`modified` 只服务 Editor 展示，因此不应进入 Runtime Definition 状态模型。Editor 可以从来源记录、解析结果和 Tombstone 推导 Presentation State，但不能把 Presentation State 回写成 Definition 生命周期字段。

## 十、当前阶段最终原则

> RuntimeEditor 只表达编辑意图；Definition Resolution 负责来源与可解析性；RuntimeContentCoordinator 负责单实体 mutation 的原子物化；各 Runtime 系统只消费成功物化后的有效定义。任何一层都不替另一层保存额外生命周期状态。

这条原则与现有 ADR-0010～0012 相容，且不要求“大改第一层 Layer”。当前收益最高、风险最低的顺序是：

```text
保留 DefinitionSourceLayer
        ↓
隐藏 Layer 操作细节
        ↓
必要时提供 Editor-oriented facade
        ↓
继续使用现有 RuntimeContentCoordinator
```

在出现真实 API 泄漏、重复翻译或跨多个 Def 类型共享协议之前，不为 Facade、generic event 或通用 Materialization Planner 预先增加新层。
