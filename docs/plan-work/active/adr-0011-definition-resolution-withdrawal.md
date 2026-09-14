# ADR-0011：Definition Resolution 撤回与引用悬置语义

**状态**：🟢 Accepted / 生效（2026-09-14）；P1A/P1B 已实施并验证  
**日期**：2026-09-14  
**依据**：[[docs/plan-work/review/def-resolution-withdrawal-sol-review]]  
**关联**：[[docs/plan-work/active/adr-0010-definition-repository-editor-resolution]]、[[docs/plan-work/active/task-0057-single-mod-editor-workbench]]

> 本 ADR 已裁定并补充 ADR-0010 中的 Definition Resolution 撤回语义；不代表当前 Runtime 已拥有通用 Def 撤回能力。现有 Task-0055 的实现边界继续有效。

## 一、背景

当前 Registry 是 Datapack 合并后的运行时物化结果，只支持整体清空与重新加载；当前游戏内编辑器仍是单 Mod / 单临时 Spot Overlay。为了支持未来的 Def 撤回、恢复、编辑器撤销和运行时重建，需要把“来源内容”“解析结果”和“Runtime 生效”分开。

本 ADR 只裁定 Definition Resolution 的语义和层次边界，不实现 Registry 热卸载、完整 DraftLayer、PackManager 持久化或新的 Datapack 格式。

## 二、候选定义

### 2.0 Definition identity 与 source identity

DefinitionKey 只描述逻辑 Definition 身份，不包含来源层：

~~~ts
interface DefinitionKey {
  table: DefinitionTable;
  id: string;
}

interface DefinitionSourceRef {
  kind: 'base' | 'pack' | 'draft';
  sourceId: string;
}

interface DefinitionRef {
  key: DefinitionKey;
  source: DefinitionSourceRef;
}
~~~

DefinitionKey 回答“是哪一个逻辑 Def”，DefinitionRef / DefinitionRecord 回答“哪个来源提供了这个 Def”。来源层不能塞进 DefinitionKey，否则无法判断不同来源是否正在覆盖同一个逻辑身份。

### 2.1 Definition Resolution 状态

Definition Resolution 的最小状态为：

~~~ts
type DefinitionResolutionStatus =
  | 'resolved'
  | 'suspended'
  | 'missing';
~~~

严格语义：

- resolved：来源链上找到当前有效 Definition；
- suspended：来源链上本来存在可解析 Definition，但被当前有效的 Tombstone / blocking record 阻断；
- missing：来源链上没有可用 Definition，且没有阻断记录。

suspended 不能被用作“暂时没找到”的泛称，否则会与 missing 重叠。

### 2.2 Editor 操作意图

编辑器操作意图与解析状态分离：

~~~ts
type DefinitionEditIntent =
  | 'create'
  | 'replace'
  | 'suspend'
  | 'delete-local'
  | 'remove-override';
~~~

操作对象和回退规则：

| 操作 | 作用对象 | 解析结果 |
|---|---|---|
| remove-override | 当前层针对 DefinitionKey 的 override record | 删除后继续向下解析 |
| delete-local | 当前目标包/编辑层自己拥有的 source record | 删除后按来源链解析；无下层来源则为 missing |
| suspend | 当前解析身份 DefinitionKey | 新增 blocking record，阻止向下回退，结果为 suspended；不删除任何 source record |
| resume | 当前 EditingWorkspace 自己拥有的 suspension blocking record | 只移除调用层自己的阻断，之后重新按来源链解析 |
| replace | 当前层 source record | 当前层提供新的 resolved 内容 |
| create | 当前层新增 source record | 新增 resolved 内容 |

如果产品要求“删除后绝不回退”，必须使用带明确目标范围的 suspend，不能把 delete-local 当作隐式全局删除。

## 三、Tombstone 存储裁定

### 3.1 首阶段只允许 Draft-only Tombstone

P1 的 Tombstone 只属于 EditingWorkspace / DraftLayer：

~~~text
P1  Draft-only Tombstone
P2  Definition Resolution 接受并返回 suspended
P3  Candidate materialization 使用解析结果
P4  再决定导出时保留、编译掉还是映射为正式删除语义
~~~

首阶段不把 Tombstone 加入正式 Datapack JSON 合同，不改变 Datapack、StoredPack 或 PackManager 快照格式。

原因：

- Tombstone 一旦进入导出格式，就成为 Datapack compatibility contract；
- 当前解析器没有 Tombstone 字段，也不保存原始分片；
- 编辑器撤销/重做和运行时临时遮蔽不应被迫绑定到正式包格式；
- 需要先确定“编辑包”和“导出 Mod”之间的删除语义。

Tombstone 至少必须能表达：

~~~ts
interface DefinitionTombstone {
  table: string;
  id: string;
  kind: 'suspend';
  owner: DefinitionSourceRef;
}
~~~

Tombstone 必须有明确 owner，且 owner 是当前 EditingWorkspace / DraftLayer。resume 只能撤回该 owner 自己创建的 blocking record；当前层没有自己的 Tombstone 时，resume 只能返回 no-op 或 validation warning，不能删除其他来源的阻断。

放弃 EditingWorkspace 且没有显式保存为编辑项目时，Draft-only Tombstone 与其他 Draft mutation 一同销毁。

## 四、解析与引用边界

### 4.1 引用仍然保存 ID

Datapack 引用不增加 suspended 字段。解析时返回原因：

~~~ts
type DefinitionResolution<T> =
  | { status: 'resolved'; record: DefinitionRecord<T> }
  | {
      status: 'suspended';
      key: DefinitionKey;
      suspendedBy: DefinitionSourceRef;
      shadowedRecord?: DefinitionRecord<T>;
    }
  | { status: 'missing'; key: DefinitionKey };
~~~

悬置结果说明哪个来源创建了阻断，shadowedRecord 可选地说明恢复后将使用哪个来源。引用方根据自身语义决定如何处理，不把所有引用统一改造成 ReferenceState。

### 4.2 引用策略按字段/调用点分类

首阶段不要求全面改 Schema 元数据，优先为真正的 Definition 引用提供类型化 resolver 入口：

~~~ts
resolveRequired(ref)
resolveOptional(ref)
~~~

或者使用：

~~~ts
resolve(ref, policy)
~~~

Symbolic identity 不一定需要 Definition Resolution；TagPath、owner、state key 等继续由各系统按自身匹配语义处理。策略不是按目标表统一指定，而是按引用位置指定。StoryEntry.storyId、Talklet.jumpToStory、ColorGroupId 等字段可以有不同策略。

建议分类：

- symbolic：缺失后自然不匹配或不产生命中；
- optional：缺失后降级并产生 warning；
- required：解析失败必须产生 error 级诊断，并由当前阶段的明确策略决定拒绝候选、禁用父功能或 fail closed；不得被当作正常“不命中”。

### 4.3 Funclet 结果不得只返回裸数字

未来表达式解析可采用：

~~~ts
type EvalResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'missing' | 'suspended' | 'invalid' };
~~~

false、0、1、空集合、跳过 Effect 或阻止交易由消费上下文决定。当前 ValueSystem / FuncletExecutor 缺失时返回 0 的行为视为既有兜底，不视为新契约。

## 五、Definition Delta 与 Runtime 责任边界

### 5.1 DefinitionDelta 只表达内容事实

~~~ts
interface DefinitionDelta {
  added: readonly DefinitionKey[];
  changed: readonly DefinitionKey[];
  removed: readonly DefinitionKey[];
}
~~~

Definition core 不直接引用 GameNum、Visibility、Affector、Shop 等 Runtime 子系统。

### 5.2 Runtime 侧解释 Delta

运行时单独提供：

~~~text
DefinitionDelta
    ↓
RuntimeInvalidationPlanner
    ↓
RuntimeRebuildCoordinator
~~~

RuntimeInvalidationPlanner 根据 Def 类型、引用图、当前运行状态和失效规则推导：

- Registry 是否需要重新物化；
- World / Area / Spot 索引是否重建；
- Visibility / Tag / GameNum 是否失效；
- Trigger / Affector 是否卸载或重新挂载；
- Story / Shop / Gacha / Asset 查询是否刷新。

首版可以让 Planner 对所有变更选择整包 Registry rebuild + reloadPreservingState()，但接口责任必须保持分层，不能让 Definition Layer 直接维护 Runtime 子系统枚举。

### 5.3 可选的解析状态迁移记录

除了向 Runtime 投影的 added / changed / removed，Editor 与诊断层可以保留更完整的状态迁移：

~~~ts
interface DefinitionChange {
  key: DefinitionKey;
  before: DefinitionResolutionStatus;
  after: DefinitionResolutionStatus;
}
~~~

例如 resolved → suspended、suspended → resolved、missing → resolved。它可以在 Runtime Delta 中投影为 added / changed / removed，但不应要求 Runtime 反向推断 suspension 原因。

## 六、PlayerState 残留策略

Definition existence 不等于 PlayerState existence。Def 被 suspend 时默认不自动删除玩家数据。

未来按三类处理：

| 策略 | 含义 |
|---|---|
| Retain | 保留持久数据，Def 恢复后可继续使用 |
| Detach | 结束当前 Runtime session 中对该 Def 的活动执行，但保留历史/持久数据 |
| Purge | 经用户或明确命令确认后清除对应状态 |

例如活动 Story 被 suspend 时，可 Detach 当前剧情游标、保留已读记录；不能简单把所有数据都当作 Retain，也不能默认 Purge。

## 七、诊断边界

~~~ts
interface DefinitionDiagnostic {
  code: string;
  severity: 'info' | 'warning' | 'error';
  source: DefinitionKey;
  reference?: DefinitionKey;
  path?: string;
  resolutionStatus?: 'suspended' | 'missing';
  policy?: 'symbolic' | 'optional' | 'required';
  message: string;
}
~~~

PackValidation 负责包配置、启用集和加载计划；DefinitionDiagnostics 负责解析后 Def 图中的悬置、缺失、父节点不可达和残留状态。两者不合并为万能 Validator。

## 八、实施边界

本 ADR 生效后，首个施工切片拆为两个子切片：

### P1A：来源解析与 Tombstone

- DefinitionRef / DefinitionRecord / DefinitionResolution 的纯类型与纯解析测试；
- Draft-only Tombstone；
- remove-override、delete-local、suspend、resume 的来源解析测试；
- resolved / suspended / missing 的严格区分；
- DefinitionDelta 的基础类型和纯差异测试。

### P1B：引用策略与诊断

- optional / required 的 resolver 行为；
- DefinitionDiagnostics 的 resolutionStatus 与 policy；
- DefinitionChange 的迁移测试。

P1A 与 P1B 都不连接 Runtime，不修改 Registry。

## 九、裁定结果与延期事项

本 ADR 已裁定以下三项核心语义：

1. DefinitionKey 只描述逻辑身份；DefinitionSourceRef / DefinitionRef / DefinitionRecord 描述来源；
2. remove-override、delete-local、suspend、resume 具有不同的作用对象和回退规则；
3. Draft-only Tombstone 必须拥有明确 owner，并且生命周期绑定 EditingWorkspace / DraftLayer。

以下内容不属于本 ADR 的生效范围，转入后续 Runtime / Export ADR 或任务：

- Tombstone 在导出格式中的正式表示；
- PackManager 或 StoredPack 的 Tombstone 持久化；
- Runtime Detach / rebuild 对 Story cursor、Trigger once、Affector 实例的具体执行顺序。

DefinitionDelta 与 RuntimeInvalidationPlanner 的责任分层已在本 ADR 中确定，但各子系统的具体失效规则、Registry 增量卸载和热更新仍属于后续 Runtime 施工范围。

P1A/P1B 均已按纯 Definition Layer 完成；两者都不连接 Runtime，不修改 Registry。

## 十、当前实现边界

以下行为仍是当前代码事实，不因本 ADR 草案而改变：

- 不修改当前 Runtime Registry 的公开生命周期 API；
- 不直接从 Registry Map 删除 Def；
- 不把 Tombstone 加入正式 Datapack 格式；
- 不实现 RuntimeInvalidationPlanner 的具体子系统逻辑；
- 不实现全表 Editor UI；
- 不接入 PackManager 正式包库写入；
- 不编写存档迁移或旧状态兼容代码。

## 相关文档

- [[docs/plan-work/review/def-resolution-withdrawal-sol-review]]
- [[docs/plan-work/active/adr-0010-definition-repository-editor-resolution]]
- [[docs/plan-work/active/task-0057-single-mod-editor-workbench]]
- [[docs/plan-work/active/task-0055-runtime-datapack-editor-mvp]]
- [[docs/docs-828/03-data-structures/id-reference-semantics]]
