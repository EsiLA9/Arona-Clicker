# Task：Init / Area / Enhancement 编辑态 CRUD

状态：superseded — 2026-09-17 被 [[task-0088-init-area-hot-crud-and-location-fallback]] 取代；保留为中断方案记录

## 目标

为游戏内 Runtime Editor 增加 `inits`、`areas`、`enhancements` 三类 Definition 的编辑态 CRUD。这里的“编辑态”指：

```text
Registry 只读 Def
    ↓ hydrate
统一 Editor Draft（可新建 / 浏览 / 修改 / 标记删除）
    ↓ validate + reference check + dependency check
Runtime Content Coordinator
    ↓ 原子 apply / rollback / DefinitionDelta / reload 协调
Registry + 运行时服务重建或失效
```

本 Task 关注的是编辑器的 Draft 与受控提交契约，不把 `tools/datapack-editor/` 恢复为当前入口，也不把 UI 写入口扩展为直接修改 `PlayerState`。

## 设计边界

- 继续复用统一编辑器服务、Policy、Descriptor、左侧 Switch、子编辑弹窗与 `RuntimeContentCoordinator`；不为三类 Def 复制一套表单架构。
- 所有业务写入仍通过 `ctrl.commands` / Runtime command facade → authoring policy → Runtime Content Coordinator；UI 不直接持有 Registry 写引用。Spot 保持现有局部 mutation，三类新内容首版通过 candidate Datapack + 受控 reload 物化。
- CRUD 的 `R` 是从 Registry / 当前 Runtime source layer hydrate 到 Draft；不是把当前运行时玩家状态投影成可编辑 Def。
- Draft 内允许暂时存在未满足引用的条目，但 Apply 必须 fail closed；未完成草稿不能污染 Registry。
- `delete` 是 Definition 删除，不等同于 `suspend`。删除会移除 source record；暂时关闭内容使用 suspend / resume。
- 不做存档迁移。若字段、Draft 或 PlayerState 结构变化，旧存档失效并清档重来。
- 本 Task 不开放主题树、`extra` 深递归树或任意 Effect / Trigger DSL 的无限递归编辑；已声明的条件、揭示与效果子编辑器沿用现有深度上限和只读回退。
- 任何字段能否热写由 `materialization` 台账决定。不能指出消费者、失效方式和触发方的字段只读并显示原因。

## 当前事实与代码落点

### 当前已经存在

| 能力 | 当前落点 | 现状 |
| --- | --- | --- |
| 顶层内容键 | `src/data-services/contracts/datapack.ts`、`content-policy-types.ts` | `ContentKey` 已天然覆盖 `inits` / `areas` / `enhancements` |
| 三类 Def 契约 | `src/data-services/contracts/world.ts`、`enhancement.ts` | 字段与引用关系已定义 |
| Registry 只读表 | `src/data-services/registry/registry.ts` | 已有 `inits`、`areas`、`enhancements` Map 与部分索引 |
| 定义校验 | `src/data-services/registry/registry-validate.ts` | 已校验重复 ID、实体 ID、Init / Area 引用及 Extra |
| 来源解析纯能力 | `src/data-services/definition/` | 已有 `DefinitionSourceLayer`、三态 resolution、Draft tombstone 与 delta；尚未接入三类 Runtime Editor 工作区 |
| 构建器 | `src/arona-clicker/content/def-factory/{init,area,enhancement}.ts` | 默认内容采用声明式 Builder；不是 Runtime Editor 的写入口 |
| 运行时消费者 | `src/arona-clicker/services/init-service.ts`、`enhancement-service.ts`、Visibility / Trigger / Affector 服务 | 已有行为，但没有统一 Definition mutation 入口 |
| 编辑器策略 | `src/data-services/authoring/content-policies.ts` | 当前只有 `SPOT_CONTENT_POLICY` |
| Runtime CRUD | `runtime-content-coordinator.ts`、`registry-spot-mutation.ts` | 仅 Spot 有 create / replace / delete / suspend / resume |
| Runtime Mod 物化 | `src/arona-clicker/runtime.ts`、`runtime-game-instance.ts` | 当前临时 Mod 只承载 Spot；整包 `reloadPreservingState` 已存在，可作为三类新内容首版 Apply 基础 |

### 三类对象的编辑语义

| Def | 核心字段 / 子结构 | 关键引用与运行时风险 |
| --- | --- | --- |
| `InitDef` | `name`、`description`、`defaultAreas`、`startStoryId`、`purchaseCost`、`enterEffects`、`triggers`、`revealTriggers`、`tags` | `defaultAreas` 必须指向同一 Init；Init 切换、可见性、进入效果与 per-Init 快照均可能读取它 |
| `AreaDef` | `initId`、`name`、`description`、`defaultSpots`、`adjacentAreaIds`、`enterEffects`、`revealTriggers`、`tags` | `initId` 决定世界线归属；Spot 的 `areaId`、Area 邻接索引、地图 / 可见性缓存依赖它 |
| `EnhancementDef` | `name`、`description`、`effects`、`price`、`attachment`、`maxStacks`、`irreversible`、`addsFunctionalities`、`affectorPackIds`、`revealTriggers`、`tags` | 已拥有、不可逆、全局 / Init / Area attachment、AffectorPack 和 Visibility 都可能持有引用或运行时实例 |

### 立项时不得假定的事实

- 不能因为 Registry 有 Map 就直接 `set/delete`：现有 Spot mutation 同时维护 owner、挂起记录、索引、revision 和 rollback，这些规则需要泛化而不是绕过。
- 不能把 `InitDef` / `AreaDef` / `EnhancementDef` 的 Builder 当作编辑器编码器：Builder 面向源码构建，Draft 需要 round-trip、诊断、缺省值和不可编辑结构保留。
- 不能把 Enhancement 删除简单映射成 `PlayerState.unlockedEnhancements` 的删除；这是状态写入口与定义写入口的跨边界问题，必须有明确的阻断或运行时撤销策略。

## 目标契约

### 1. Policy 与 Descriptor

为三类内容分别增加 `ContentAuthoringPolicy`，追加到 `CONTENT_POLICIES`。每份 Policy 必须声明：

- `idType`、`inputPrefix`、字段 / 扩展 / section；
- `defaults` 与缺省 / 显式空数组语义；
- `materialization`：消费者、失效方式、现有触发方；
- `state`：Definition 被修改或删除时，已存在的玩家状态如何处理；
- `mutate`：进入受控物化 / Apply 的唯一适配器；首版三类内容不要求直接调用 Registry 局部 mutation。

建议的最小可写面如下，未列出的字段先只读：

| Content | P0 标量 / 引用 | P1 集合 / 子编辑 |
| --- | --- | --- |
| `inits` | `idName`、`name`、`description`、`worldTilt`、`worldTiltAlias`、`startStoryId`、`purchaseCost` | `defaultAreas`、`tags`、`revealTriggers`；`enterEffects` / `triggers` 先只读或复用已验收子编辑器 |
| `areas` | `idName`、`initId`、`name`、`description` | `defaultSpots`、`adjacentAreaIds`、`tags`、`revealTriggers`；`enterEffects` / `theme` / `extra` 先只读 |
| `enhancements` | `idName`、`name`、`description`、`autoApply`、`maxStacks`、`irreversible`、`attachment`、`price` | `tags`、`revealTriggers`、`affectorPackIds`；`effects` / `addsFunctionalities` 只有在对应目标编辑器与运行时重建链验收后开放 |

Policy 不应把只读字段静默丢弃。对已有定义 hydrate 时，要么保留为不可编辑的 opaque payload 并在替换时合并，要么在诊断页标记“当前编辑器无法无损回写”并阻止 Apply。

### 2. 来源、所有权与 Apply 模式

本 Task 不把“有统一 command”误解成“所有表都直接 mutation Registry”。根据 [[adr-0010-definition-repository-editor-resolution]]、[[adr-0011-definition-resolution-withdrawal]] 与 [[adr-0012-runtime-hot-content-crud]]，必须分开三层：

```text
DefinitionRepository / DraftLayer
  负责来源解析、Draft CRUD、suspended / missing 诊断
        ↓ materialize candidate
Runtime Content Coordinator
  负责策略校验、事务、revision、影响预览
        ↓
Registry / Game Runtime
  负责运行时物化；非 Spot 首版走一次完整 reloadPreservingState
```

首版把编辑工作区限定为**一个编辑器拥有的临时 Mod source**：

- `create`：创建 `${modName}:init|area|enhancement:${idName}` 的 owned record；
- `replace`：只替换当前临时 Mod 自己拥有的 record，实体 ID 不变；
- `delete-local`：删除当前临时 Mod 的 owned record；
- `suspend` / `resume`：在 DraftLayer 增加或撤销 owner 明确的 Tombstone，供预览与撤销使用；
- 已加载的 base / 外部 Pack Definition 默认只读，可 `inspect`、复制为新 ID，但不能被 Runtime Mod 用另一个 `modName` 伪装成同 ID 覆盖。

这是必要限制：当前 Datapack 校验要求包内实体 ID 的 `modName` 与包 manifest 一致，现有 Registry 也没有 Init / Area / Enhancement 的 source-owner 记录。若要原 ID 覆盖外部 Pack，必须另立“source-aware override materialization”裁定，不能把它偷偷塞进普通 `replace`。

因此三类内容首版采用以下 Apply 模式：

| 变更范围 | Apply 方式 | 原因 |
| --- | --- | --- |
| 单个 Spot，且不涉及其他表 | 继续使用现有 Spot hot mutation | 已有 Registry 索引、事件与局部失效链 |
| Init / Area / Enhancement 任一变更 | 组装完整临时 Datapack，预检后一次 `reloadPreservingState` | 当前这些表没有受控局部 mutation 与完整运行时失效链 |
| 同一 Draft 中跨表变更 | 一次 candidate materialization + 一次 reload | 避免先应用引用方、后应用被引用方造成中间无效状态 |

非 Spot 首版不新增 `Registry.applyDefinitionMutation`。可以抽取通用的 Coordinator / receipt / diagnostics 形状，但 Registry 的写入仍通过正常 Datapack reload；未来要做真正热 CRUD 时另立 RuntimeInvalidationPlanner 任务。

### 3. Candidate materialization 与事务

Apply 不逐条写 Registry，而是构造候选运行时世界：

1. 用来源解析链读取启用 Pack 的原始内容与编辑器 DraftLayer；
2. 只把当前编辑器 source 的 active owned records 物化到临时 Datapack；suspended records 不物化；
3. 将候选 Datapack 与背景 Datapack 装载到临时 `Registry`，执行 `validate`、引用检查和三类关系图检查；
4. 检查 PlayerState 对当前 Definition 的兼容性，并生成 `reload-required` / 阻断诊断；
5. 对当前运行时保存一份 `SaveData` 与旧 RuntimeMod snapshot；
6. 调用一次 `reloadPreservingState([...background, candidateRuntimePack])`；
7. reload 与 state restore 成功后，才推进 workspace revision、`applied` 快照和运行时 Mod metadata；
8. 任一步失败，重新加载旧 Datapack 组合并恢复旧 SaveData；恢复失败则返回 `rollback-failed`，同时停止继续提交。

候选 Registry 是事务的预检面，不是第二个可被 UI 持有的运行时写入口。Apply 结果必须包含本次 `DefinitionDelta`、引用诊断、影响范围与是否发生完整 reload。

### 3. Draft CRUD 状态

Editor state 从当前 `spots` 专用容器扩展为按 `ContentKey` 分区的 Draft store。Definition 层使用完整实体 ID，UI 表单才使用局部 `idName`：

```text
definitions: {
  spots: Map<id, DraftRecord>,
  inits: Map<id, DraftRecord>,
  areas: Map<id, DraftRecord>,
  enhancements: Map<id, DraftRecord>,
}
draftMeta: {
  dirty, sourceRevision, diagnostics, pendingDeletes, unsupportedPaths,
  sourceOwner, lastApplyMode
}
```

每个 DraftRecord 至少支持：`hydrate`、`create`、`clone`、`update`、`markDeleted`、`discard`、`validate`、`apply`。UI 的删除按钮只标记 `pendingDeletes`，确认 Apply 后才进入 candidate materialization；取消编辑则丢弃 Draft，不回写 Registry。

父级列表只显示实体摘要与状态：`new` / `modified` / `deleted` / `suspended` / `invalid` / `readonly-source`。跨表引用选择器必须区分“当前 Draft 中新增但尚未 Apply”的候选；批量 Apply 以完整候选包校验，不把尚未提交的 Draft 假装成当前 Runtime Definition。

### 4. CRUD 能力矩阵

| 来源 | Browse / Inspect | Create | Edit | Delete / Suspend | 首版处理 |
| --- | --- | --- | --- | --- | --- |
| 当前编辑器临时 Mod owned record | ✅ | ✅ | ✅ | ✅ | 本 Task P1/P2 |
| base / 外部 Pack resolved record | ✅ | — | — | — | 只读，可复制为新 ID |
| 外部 Pack 原 ID override | ✅ | — | — | — | 延后至 source-aware override ADR |
| Draft tombstone | ✅ | — | — | ✅ resume / discard | 绑定当前 workspace，不进正式 Datapack |

“编辑态 CRUD”首版的可写对象是编辑器 source 自己拥有的 Definition；这保证了删除、回滚和包 manifest 的所有权语义一致。若产品必须直接编辑 base / 外部 Pack 原 ID，应先补充来源包选择、override 导出、回退顺序和持久化方案，不在本 Task 中通过特殊分支绕过。

### 5. Command / result 形状

UI 不直接提交完整 `Datapack`，而提交一个工作区批次；Spot 单项热 CRUD 仍保留现有专用 command。三类新内容建议采用下面的边界：

```text
RuntimeDefinitionEditorCommands
  getWorkspaceSnapshot()
  validateWorkspace(expectedRevision)
  applyWorkspace(expectedRevision)
  discardWorkspace()
  create(table, input)
  update(table, idName, input)
  markDeleted(table, idName)
  suspend(table, idName)
  resume(table, idName)
```

`create / update / markDeleted / suspend / resume` 只操作 Draft workspace，不触发 Runtime。只有 `applyWorkspace` 才执行 candidate materialization 与一次 reload；这样用户可以在同一工作区先建 Init、再建 Area、再建 Enhancement，并在提交前看到完整影响预览。

```text
RuntimeDefinitionApplyResult {
  ok
  revision
  mode: 'none' | 'reload'
  delta: DefinitionDelta
  diagnostics
  affected: { tables, ids, playerStatePolicies, requiresReload }
}
```

`markDeleted` 只表示“删除本编辑器 source 的 record”；对 resolved 外部 record 的隐藏必须使用另有 owner 的 tombstone，当前首版 UI 不把两者混成一个“删除”按钮。

## 关系与 CRUD 约束

### Init / Area / Spot

```text
Init
 └─ defaultAreas[] ─→ Area
      ├─ defaultSpots[] ─→ Spot
      └─ adjacentAreaIds[] ─→ Area
Spot.areaId ───────────────→ Area
```

- 新建 Area 必须引用存在的 Init；新建 / 替换 Init 的 `defaultAreas` 必须只包含其 `initId` 相同的 Area。
- Area 的 `initId` 替换不是普通字段修改：它会改变该 Area 及其 Spot 的世界线边界。P0 禁止跨 Init 移动；需要移动时另立迁移任务。
- 删除 Init 前，必须没有 active Area、未挂起 Area、当前 activeInit 或快照引用。否则只允许显示阻断诊断。
- 删除 Area 前，必须没有 active / suspended Spot 引用，且不能仍被任一 Init 的 `defaultAreas` 或邻接关系引用；编辑器提供“先清理引用”的路径，不自动级联删除。
- `defaultAreas` / `defaultSpots` 是声明式默认集合，不等同于运行时当前地图集合；编辑器不得用运行时可见状态反写这些字段。

### Enhancement

- `attachment.kind = global | init | area` 决定可见范围和状态层级；attachment 的 kind 切换先作为结构性变更，P0 只允许在新建时选择，既有 Def 替换时保持不变。
- `attachment.areaId` 必须存在；`attachment.initId` 必须存在；Area attachment 的 Init 一致性必须验证。
- `revealTriggers` 的引用目标必须经过 Condition / Reveal 校验；Visibility consumer 的刷新链未接通前，替换只能阻断或执行完整重建，不能“写入后等下次刷新”。
- `affectorPackIds` 必须引用 Registry 中存在的 AffectorPack；修改它必须触发 Affector runtime 重建或明确拒绝热 Apply。
- `irreversible = true` 不是 UI 禁止编辑的理由，但已拥有的不可逆 Enhancement 不允许删除、撤销或把 `irreversible` 改为 false；可编辑字段仅限不会改变既有拥有语义的部分。
- 删除 / suspend 已拥有 Enhancement 时，不从 PlayerState 静默删除拥有记录。P0 选择阻断并提示“先清理运行时状态 / 新建世界线”；未来若需要撤销，另立状态迁移与事务任务。

### 反向引用预检

Apply 前由一个只读 `DefinitionImpactIndex` 扫描 candidate 与当前状态，统一生成“谁引用了它”的诊断；删除按钮本身不做级联推断。

| 目标 | 必查的引用 / 状态 | 默认策略 |
| --- | --- | --- |
| Init | `Area.initId`、Init `defaultAreas`、Enhancement `attachment.initId`、`state.activeInit`、Init snapshots 的 key / current area | 有 active / snapshot / Area 依赖即阻断 |
| Area | `Spot.areaId`、Init `defaultAreas`、`Area.adjacentAreaIds`、Enhancement `attachment.areaId`、`state.currentAreaId`、snapshot `currentAreaId` | 有 Spot、拓扑或当前状态依赖即阻断 |
| Enhancement | `state.unlockedEnhancements`、Condition 中的 `hasEnh`、其他 Definition 的显式 Enhancement 引用 | 已拥有或被 required 引用即阻断；普通未拥有项可删除 |
| AffectorPack | Enhancement `affectorPackIds`、当前 Affector runtime | 本 Task 不删除 AffectorPack；缺失引用在 candidate 校验时报错 |

历史字段（如 `visitedInits` / `visitedAreas`、story logs）可以保留为历史记录，但不能被用来让一个仍被当前运行时需要的 Definition 删除成功。影响索引应同时报告“结构引用”和“PlayerState 残留”，让 UI 区分两种阻断原因。

### Policy 类型补充建议

当前 `ContentAuthoringPolicy` 的 `mutate` 形状是为 Spot hot mutation 设计的。三类新内容接入前建议拆成两个显式能力，避免用空实现欺骗类型系统：

```text
materialize(input, context) -> Def
decode(def, context) -> Draft + unsupportedPaths
applyHot?(request) -> receipt       // 只有已具备局部失效链的表提供
```

同时把当前单一的 `state: 'retain'` 扩展为表级状态策略，例如 `onDelete: 'block-if-referenced'`、`onReplace: 'retain-id'`、`onScopeChange: 'block'`。这样 Enhancement 的“已拥有阻断”和 Area 的“当前区域阻断”由契约表达，而不是散落在 UI action 的 if 分支。

### Reload 后的状态语义

非 Spot Definition 首版采用完整 reload，因此必须明确 reload 不等于重新发放内容：

- Init / Area / Enhancement 的 ID 不变时，PlayerState 原样恢复；不会因 Definition replace 重放 `enterEffects`、购买奖励或一次性 `effects`。
- active Init、current Area、Init snapshot 中引用的 Init / Area 必须在 candidate 中继续 resolved；否则 Apply 前阻断。
- 已拥有 Enhancement 的 Definition 必须继续存在；允许修改的字段必须经过“已拥有”策略检查。Affector / Visibility / GameNum 在 reload 时从 candidate Registry 重新构建，不直接复用旧实例。
- reload 期间停止 Tick、清理旧 Init Trigger / Affector runtime，并在 restore 后按当前 active Init 重新挂载；旧的异步 runtime generation 必须失效。
- 如果用户只想暂时隐藏一条外部 Definition，使用 Draft tombstone 的 `suspend` 预览；当前首版不能把它提交成一个不同 `modName` 的正式包覆盖，除非完成 source-aware materialization。

### UI 承载建议

统一 Editor 外壳保持“顶部内容类型 / 条目 / 草稿状态 / Apply，左侧 Switch，右侧内容”。三类实体的首版页划分如下：

| 类型 | Switch 页 | 重点交互 |
| --- | --- | --- |
| Init | 概览、基础、区域、揭示、诊断 | `defaultAreas` 摘要行；显示 Area 的 Init 一致性；删除时显示反向引用 |
| Area | 概览、基础、拓扑、设施、揭示、诊断 | `adjacentAreaIds` 与 `defaultSpots` 通过候选选择器 / 子弹窗编辑；不把运行时当前 Area 当默认值 |
| Enhancement | 概览、基础、归属与价格、揭示、效果、诊断 | attachment 按 kind 分派；已拥有条目把不可安全修改字段锁定并解释原因 |

三个列表共用同一状态筛选：全部、草稿新增、已修改、待删除、挂起、只读来源、存在错误。切换实体或页面前先 stash 当前页；Apply 只读取完整 workspace，不读取当前 DOM。

## 施工切片

### P0：统一契约、Draft 容器与只读浏览

- 抽出按 `ContentKey` 的 Definition Draft / diagnostics / selection 模型。
- 为 `inits`、`areas`、`enhancements` 注册 Browse / Inspect 描述符；先支持 hydrate、搜索、引用跳转、只读摘要。
- 增加三类 Policy 的字段 / 引用校验和 round-trip 测试；只读结构必须有诊断。
- 不开放热 Apply 前，确保旧 Spot 编辑器行为不变。

完成定义：三类数据可在统一编辑器中浏览、从列表进入详情、显示反向引用和不可编辑原因；没有任何 Registry / PlayerState 写入。

### P1：Init / Area 的 Create / Edit / Delete

- 实现按表 Policy、DraftLayer、candidate Datapack 与 Coordinator；不直接扩展 Registry Map，也不把外部 Pack record 当作临时 Mod owned record。
- 开放 Init / Area 的 P0 标量与安全引用集合。
- Apply 前执行 Init–Area–Spot 关系图校验、反向引用阻断和完整 candidate reload。
- 让 reload 后的 Visibility、Init runtime mount / unmount、Area / Spot 关系索引从 candidate Registry 重建；不要新增伪造的 `areaDefinitionChanged` 事件替代完整重载。

完成定义：新建、编辑、删除的成功与阻断路径都有可重复测试；失败时 Registry 与 Draft 均保持原状。

### P2：Enhancement 的 Create / Edit / Delete

- 先接入安全标量、价格、tags、attachment 引用和 reveal；effects、addsFunctionalities、affectorPackIds 按各自重建链分批开放。
- 建立已拥有 / 不可逆 / 全局附着 / Init 附着 / Area 附着的状态守卫。
- 通过 candidate reload 接通 Enhancement、Visibility、Affector 的重建；若运行时状态不能恢复或操作会改变已拥有语义，Apply 前必须阻断。

完成定义：不会静默改变玩家拥有状态；已拥有或不可逆条目的危险操作均可解释地阻断；可热写字段的运行时表现与重新加载一致。

### P3：子编辑器与批量工作流

- 复用 condition tree、target editor、payment / collection prototype；为 `defaultAreas`、`defaultSpots`、`adjacentAreaIds`、`revealTriggers` 提供摘要行 + 子编辑弹窗。
- 支持同一次 Draft 中跨表 create / replace / delete 的依赖排序、预览和整批 rollback。
- 增加“影响预览”：被引用实体、需要 reload 的消费者、会被阻断的删除原因。

## 测试与验收

### 必测层次

| 层次 | 验收重点 |
| --- | --- |
| Policy | 字段类型、必填 / 显式空数组、ID、引用、attachment 一致性、unsupported path |
| Candidate / reload | 三表 create / replace / delete / suspend / resume、owner、revision、候选 Registry 校验、旧运行时恢复 |
| Coordinator | 草稿校验、批量关系图、失败即停、reload 失败回滚、reload-required 诊断 |
| UI state | hydrate / clone / dirty、当前页 stash、跨表引用候选、标记删除 / 取消、错误留存 |
| Runtime | Init mount、Area 索引、Visibility、Enhancement Affector / owned 状态；至少覆盖热写与 reload 后一致性 |
| Browser | 左 Switch、摘要行、子弹窗、危险删除确认、阻断诊断、窄屏和 hover 保留 |

### 推荐命令

```text
npx tsc --noEmit
npx vitest run tests/data/content-policy.test.ts tests/engine/runtime-content-coordinator.test.ts tests/ui/runtime-editor-form.test.ts
npm run check:architecture
npm run check:docs
```

完成三类内容的运行时接入后，再补跑 `npm test`、`npm run build` 与浏览器验收。

## 当前核验（2026-09-17）

- 已读：`docs/docs-828/00-INDEX`、`docs/docs-828/02-modules/runtime-editor`、`docs/docs-828/05-conventions/doc-maintenance`、`docs/plan-work/task-0076-unified-def-editor-service`。
- 已核对：`Datapack` / `InitDef` / `AreaDef` / `EnhancementDef`、Registry 表与 Spot mutation、三个 Def Builder、`init-service` / `enhancement-service` 现有消费者、Definition Resolution / Draft tombstone、PackManager、`reloadPreservingState` 与 Visibility rebuild 链。
- 现状结论：当前 `CONTENT_POLICIES` 只有 `SPOT_CONTENT_POLICY`；现有受控 mutation 只有 Spot；Init / Area / Enhancement 尚无统一编辑态 CRUD；临时 Runtime Mod 也只承载 Spot。
- 设计补充结论：三类内容首版应走“编辑器 source Draft → candidate Datapack → 一次完整 reloadPreservingState”，而不是直接扩展 Registry 的局部 mutation；外部 Pack 原 ID 编辑需要另立 source-aware override 方案。
- 未执行代码修改、测试或浏览器验收；本文件是待裁定的施工设计。

## 剩余工作

- 裁定三类内容的 P0 可写字段与“不可无损回写”的 opaque 结构策略。
- 将 `RuntimeModDraft` / Editor workspace 从 Spot-only 扩展为 `inits` / `areas` / `enhancements` 分区，并统一完整 ID 与局部 `idName` 的边界。
- 为 candidate Datapack 建立一次性预检、SaveData 恢复和旧 RuntimeMod 回滚路径；确认 reload 失败时不会留下半套 Registry。
- 逐一确认 Init / Area / Enhancement 的 reload 后消费者与 PlayerState 守卫；不能安全恢复的操作降级为阻断诊断。
- 裁定 Enhancement 已拥有状态的删除、挂起和替换政策；在裁定前不得实现删除快捷路径。
- 若需要编辑外部 Pack 原 ID，另立 source-aware override / 导出裁定；本 Task 不通过不同 `modName` 写同 ID 绕过 Datapack 校验。
- 由 P0–P3 切片建立对应测试与浏览器验收记录；完成后将本 Task 移入 `docs/plan-work/archive/`。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/world]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/01-architecture/state-layers]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[adr-0010-definition-repository-editor-resolution]] · [[adr-0011-definition-resolution-withdrawal]] · [[adr-0012-runtime-hot-content-crud]] · [[task-0076-unified-def-editor-service]] · [[task-0086-ui-dom-refresh-boundaries-and-hover-preservation]]
