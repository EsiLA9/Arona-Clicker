# Review：Sol 对 Definition Resolution / Withdrawal 方案的事实核查与点评

**状态**：🟢 二次评审完成；ADR-0011 已生效  
**日期**：2026-09-14  
**评审对象**：Sol 关于 Def 撤回、Tombstone、引用悬置与 Definition Resolution 的修改意见  
**相关任务**：[[adr-0010-definition-repository-editor-resolution]]、[[task-0057-single-mod-editor-workbench]]

## 一、结论摘要

Sol 的核心判断成立：Def 的退出不应被实现为对 Runtime Registry 中某个 Map 成员的直接删除，而应被表达为 Definition Layer 对某个来源和 ID 的解析结果改变，再由 Runtime 根据解析差异进行物化或卸载。

建议采纳以下四条原则：

1. Editor 操作 Definition Layer / Draft，不直接修改 Runtime Registry；
2. Suspended 表示当前解析结果被遮蔽，不应成为 Def 对象自身的可变状态；
3. 引用继续保存 ID，悬置状态由解析结果产生，不把 suspended 写进每个引用结构；
4. Definition Resolution、Registry Materialization 和 Runtime Unload 分成三个阶段。

但 Sol 的意见不能原样视为当前实现说明。当前项目仍处于“Registry 物化结果 + 临时 Runtime Overlay + 整体重载”阶段。DefinitionRepository、DraftLayer、Tombstone、DefinitionDelta 和 Def 级热卸载目前都未实现。

首次评审时，ADR-0010 的计划接口把解析状态写成 resolved | deleted | missing；该冲突现已由 ADR-0011 修订，ADR-0010 与 Task-0057 已同步新的 resolved | suspended | missing 语义。P1 仍不得在纯 Definition Layer 之外施工。

## 二、事实核查

### 2.1 当前 Registry 不支持通用 Def 退出

**结论：确认。**

当前 Registry 通过 tableSteps 统一执行各表 load / merge / clear。公开能力包括加载、校验、查询和整体 clear()，没有通用的：

~~~ts
removeDef(type, id)
replaceDef(type, id, value)
unregisterPack(modName)
~~~

当前多包合并是物化过程，后加载内容可以覆盖相同 Map 键，但 Registry 没有为每个 Def 保留完整来源栈。因此直接 Map.delete() 不能可靠恢复被覆盖来源，也不能自动清理 Area、Spot、Tag 等关系索引。

证据：

- src/data-services/registry/registry.ts 只有按表清空和加载合并能力；
- [[docs/docs-828/02-modules/registry]] 明确 Registry 是编译态、运行时只读容器；
- [[docs/docs-828/03-data-structures/registry]] 明确 Registry 只在初始化时装载。

### 2.2 当前确实存在多包顺序覆盖，但不存在 Sol 示例中的完整来源层

**结论：部分确认，需修正表述。**

当前 PackManager 有包库、启用集和顺序；Runtime 按顺序把 Datapack 载入 Registry，后加载 Def 可以覆盖相同 Map 键。但当前启用集还会拒绝重复 modName，并且 StoredPack 只保存包级 id、manifest、已解析 Datapack、图片和导入时间。

当前没有正式实现：

- Base / Reference Pack / Editing Pack 的可查询来源链；
- 同一 Def 的来源栈；
- Draft Layer 的遮蔽记录；
- 原始分片、原始字节或 Def 级 content hash；
- 可持久化的 Tombstone。

因此 Sol 的三层示例适合作为未来 Definition Layer 的设计模型，不应描述为当前 Runtime 已经支持的多层解析事实。

证据：

- src/data-services/datapack/pack-manager.ts 的启用集校验拒绝重复 modName；
- src/data-services/datapack/pack-manager.ts 的 StoredPack 没有 Def 来源索引；
- src/data-services/datapack/pack-parser.ts 和 fragment-parser.ts 返回合并后的 Datapack，不保留原始 JSON 分片边界。

### 2.3 DefinitionRepository 与 DraftLayer 目前只是规划接口

**结论：确认；接口语义已由 ADR-0011 补齐，但代码尚未实现。**

ADR-0010 已经规定 Runtime Registry 不作为 Editor 数据库，后续 DefinitionRepository 只负责来源查询和解析；Task-0057 也把 DraftLayer、Tombstone 和引用图列为后续切片。

但截至本次核查：

- DefinitionRepository 没有实际实现；
- DraftLayer 没有实际实现；
- 当前游戏内编辑器仍使用单个 RuntimeModDraft.spot；
- 当前编辑器提交时由 AronaClickerRuntime.applyRuntimeMod() 构造临时 Datapack，并调用 reloadPreservingState()。

Sol 建议的 resolve() 结果可以作为未来接口方向，但不能直接当作当前代码契约。

### 2.4 当前临时 Mod 的删除不是 Def 级卸载

**结论：确认。**

removeRuntimeMod() 当前能够删除整个临时 Mod，并选择保留或清理对应 Spot 的 PlayerState；其内部仍然是：

~~~text
保存状态
→ 清空 Registry 与运行时缓存
→ 重新加载背景 Datapack
→ 恢复状态
~~~

这证明项目已有“退出临时内容后恢复运行时”的应用层经验，但还不能证明已经支持任意 SpotDef、ItemDef、StoryDef 或其他 Def 的独立退出。

### 2.5 Trigger / Affector 已有实例卸载，但没有来源级 Def 撤回

**结论：部分确认。**

当前：

- TriggerSystem.unmount(id) 支持单个已挂载 Trigger 的卸载；
- TriggerSystem.unmountGroup(group) 支持按组卸载；
- AffectorEngine.unmount(instanceId) 支持单个 Affector 实例卸载；
- AffectorEngine.clear() 支持整体清理。

但数据包中的 TriggerDef、AffectorPackDef 尚未统一携带来源 Pack 身份，也没有“撤回某个来源下的所有 Def，并恢复下层来源”的通用 API。因此 Sol 提到的 Runtime 根据 Definition Delta 退场是合理目标，不是现有能力。

### 2.6 首次核查时计划状态名是 deleted，现已由 ADR-0011 修订

**结论：确认（首次核查快照）；该冲突现已由 ADR-0011 修订。**

首次核查时，ADR-0010 计划的接口是：

~~~ts
status: 'resolved' | 'deleted' | 'missing'
~~~

首次核查时，Task-0057 也把 Draft 的 delete 描述为 tombstone，并规定删除不能静默回退到下层来源。

Sol 建议拆成：

~~~text
Definition Resolution：resolved / suspended / missing
Editor Intent：replace / suspend / delete-local / removeOverride
~~~

这个拆分更能表达“运行时解析结果”和“作者操作意图”的差异，但它不是单纯重命名：它会影响下层回退、导出结果、删除语义和编辑器撤销/重做。因此必须通过 ADR 修订明确：

- removeOverride 是否允许回退到下层来源；
- suspendDefinition 是否写入遮蔽当前有效 Def 的 Tombstone；
- deleteLocalDefinition 删除的是当前层内容，还是对整个解析结果建立阻断；
- 目标包本身被编辑时，删除本地 Def 是否等价于 missing，还是必须写 suspend。

这些问题现已在 ADR-0011 中裁定；ADR-0010 的 Definition Resolution 状态已同步为 suspended / missing / resolved，详细撤回语义以 ADR-0011 为准。

### 2.7 Tombstone 属于 Definition Layer 的判断成立，但当前没有存储位置

**结论：设计上成立，当前未实现。**

Tombstone 能解决“删除后误回退”和“撤回后恢复”的问题，尤其适合编辑器的撤销/重做。但它必须属于 Draft / Definition Layer，而不能直接塞入 Runtime Registry。

当前 PackManager 的 StoredPack、Pack 快照和解析器都没有 Tombstone 字段。ADR-0011 已裁定首阶段只使用 Draft-only Tombstone：

- Tombstone 归 EditingWorkspace / DraftLayer 所有，并带有 owner；
- resume 只移除当前编辑层自己的 blocking record；
- 正式 Mod 导出时如何保留、编译或映射 Tombstone，延期到 Export ADR；
- 是否进入 PackManager / StoredPack 持久化，延期到后续 PackManager ADR。

### 2.8 引用分类方向正确，但必须按引用位置分类

**结论：采纳分类思想，修正分类对象。**

Sol 提出的三类引用很有用：

~~~text
Symbolic Reference
Optional Content Reference
Required Behavioral Reference
~~~

但不能简单按目标 Def 类型分类，因为同一个目标表在不同字段上可能有不同要求。例如：

- StoryEntry.storyId 当前有加载期强校验，是 Required；
- Talklet.jumpToStory 当前允许运行时软失败，接近 Optional；
- TagPath、owner、状态键主要是 Symbolic；
- ColorGroupId 在当前 Registry 的角色/主题校验中属于强引用，不应统一当作 Optional；
- Spot Functionality.shopId 当前也有 Registry 校验。

因此引用策略应绑定到具体字段或解析调用点，而不是只绑定到 StoryDef、ColorGroupDef 这类目标表。首版不强制为所有 Schema 字段增加元数据，而是先通过类型化解析调用或显式 policy 参数表达：

~~~ts
type ReferencePolicy = 'symbolic' | 'optional' | 'required';
~~~

真正的 Definition 引用可以使用 resolveRequired()、resolveOptional() 或 resolve(ref, policy)；TagPath、owner、state key 等 symbolic identity 继续由各自系统解释，不强制提供统一的 resolveSymbolic()。

### 2.9 Funclet 中性值的提醒成立，且当前实现确实有硬编码兜底

**结论：确认，Sol 的修正必要。**

当前 ValueSystem 与 FuncletExecutor 在找不到 Funclet 时直接返回 0。这是一种历史性统一兜底，不代表 0 在所有上下文都是真正的中性值。

不同消费位置可能需要不同处理：

| 消费位置 | 候选降级 | 备注 |
|---|---|---|
| Condition | false | 通常是 fail closed，但必须记录诊断 |
| Effect target | skip | 不能伪造一次效果执行 |
| 数值加成 | 0 | 只适用于加法语义 |
| 倍率 | 1 | 只适用于乘法语义 |
| 选择器 | 空集合 | 可能改变后续随机/必选语义 |
| 必需交易校验 | fail | 不应静默放行 |

所以应由调用方或表达式上下文决定 fallback，并返回 unavailable 原因；不能让 Funclet Resolver 统一猜测“中性值”。

### 2.10 Area / Spot 的祖先不可达不应伪装成子 Def 被撤回

**结论：确认，建议采纳。**

AreaDef 与 SpotDef 的层级关系中，父节点不可用会影响子节点的运行时可达性，但不代表子节点定义本身被删除。

建议区分：

~~~text
Definition Resolution：resolved
Runtime Availability：unreachable because parent unavailable
~~~

这样恢复父 Area 后，Spot 可以自然恢复，而不需要为每个子节点生成和撤回一组重复的 Tombstone。

## 三、方案点评与修正后的目标模型

### 3.1 建议采纳的总体链路

~~~text
Definition Sources
        ↓
Definition Resolution
  resolved / suspended / missing
        ↓
Definition Diagnostics
        ↓
Resolved Definition Set
        ↓
Registry Materialization
        ↓
Definition Delta / Invalidation Scope
        ↓
Runtime Derived Systems
~~~

这里的 Registry 仍然是当前有效定义的物化结果，不是 Definition 的真源。

### 3.2 建议采用“解析状态”和“编辑意图”双层模型

建议未来把两者明确分开：

~~~ts
type DefinitionResolutionStatus =
  | 'resolved'
  | 'suspended'
  | 'missing';

type DefinitionEditIntent =
  | 'create'
  | 'replace'
  | 'suspend'
  | 'delete-local'
  | 'remove-override';
~~~

含义如下：

- remove-override：撤回当前层的覆盖，允许按来源链继续解析；
- suspend：写入当前编辑层的遮蔽记录，阻止下层 Def 生效；
- delete-local：删除当前层由编辑包拥有的定义；若无下层来源，解析结果为 missing；
- replace：在当前层提供新内容；
- create：在当前层增加新 Def。

如果产品要求“删除后绝不回退”，就不能只使用 delete-local，必须把该操作实现为带明确范围的 suspension Tombstone。

### 3.3 引用不保存悬置字段，Resolver 返回原因

不建议修改每个 Datapack 引用结构：

~~~ts
{ id, suspended: true }
~~~

引用仍保存原始 ID；解析时返回状态、阻断来源和可选的被遮蔽记录：

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

具体引用点依据自身策略决定是跳过、降级、禁用父功能还是阻止提交。

### 3.4 Runtime Delta 需要包含失效范围

Sol 的 added / changed / removed 适合作为第一层内容差异，但对于 Runtime 不够完整。相同的 removed Def 可能影响完全不同的派生系统。

建议在其上增加受影响范围：

~~~ts
interface DefinitionDelta {
  added: readonly DefinitionKey[];
  changed: readonly DefinitionKey[];
  removed: readonly DefinitionKey[];
  transitions?: readonly DefinitionChange[];
}

interface DefinitionChange {
  key: DefinitionKey;
  before: DefinitionResolutionStatus;
  after: DefinitionResolutionStatus;
}
~~~

DefinitionDelta 只表达内容事实；由 RuntimeInvalidationPlanner 根据 Def 类型、关系图和当前运行状态推导 registry、world-index、visibility、game-num、affector、trigger、story、shop、gacha、assets 等失效范围。首版仍可由 Planner 触发完整 Registry / Derived Systems rebuild，不能让 Definition Layer 直接依赖这些 Runtime 子系统。

### 3.5 PlayerState 默认与 Def 生命周期解耦

这条原则建议采纳：

~~~text
Definition existence ≠ PlayerState existence
~~~

Def 被暂停时，Spot 等级、物品数量、角色成长、剧情记录等状态默认不应自动丢失。真正的清理应是显式的 purgeOrphanedState 或等价命令，并按表定义清理范围。

但当前项目并非已经统一实现该原则。removeRuntimeMod(preservePlayerData) 已经提供临时 Mod 级的“保留/清理”选项；通用 Def 残留策略尚未形成统一服务。未来实现还要单独处理：

- 当前活动剧情 Def 被暂停；
- 当前 Init 或 Area 被暂停后的 Lobby / 可达性；
- Spot 的 per-Init 快照与 global 状态；
- Trigger once 记录、Affector 实例和派生缓存。

### 3.6 诊断必须可见，但不能把所有悬置都升级成阻止错误

建议统一使用：

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

建议的最小诊断码包括：

~~~text
DEF_REF_SUSPENDED
DEF_REF_MISSING_OPTIONAL
DEF_REF_MISSING_REQUIRED
DEF_PARENT_UNAVAILABLE
DEF_TOMBSTONE_SHADOWED
DEF_STATE_ORPHANED
~~~

PackValidation 继续负责包配置、启用集和加载计划；DefinitionDiagnostics 负责解析后的 Def 图和运行时悬置。两者不要合并成一个万能 Validator。

## 四、与现有文档的关系及当前边界

### 4.1 ADR-0010 已完成语义同步

ADR-0010 已同步 Definition Resolution 的状态命名，并明确：

- DefinitionRepository 保持只读，写操作归属 Draft / EditingWorkspace；
- resolved / suspended / missing 的解析语义以 ADR-0011 为准；
- remove-override、delete-local、suspend、resume 的回退规则以 ADR-0011 为准；
- Tombstone 的正式导出和 PackManager 持久化不在 ADR-0010 或 ADR-0011 内裁定。

### 4.2 Task-0057 已完成任务口径同步

Task-0057 已经包含来源链、Draft tombstone、引用图和 Runtime Delta，当前施工应遵循：

- 删除操作不能使用一个模糊的 delete 覆盖所有语义；
- 引用悬置由 Resolver 返回，不在每个引用对象中保存状态；
- 引用策略按字段/调用点分类；
- Area 祖先不可达和 Spot Definition suspended 必须区分；
- Delta 需要关联派生系统失效范围；
- Funclet fallback 由消费上下文决定；
- DefinitionDiagnostics 与 PackValidation 分离。

### 4.3 当前 Task-0055 不应提前升级为通用 Def 热卸载

Task-0055 的单 Mod / 临时 Spot Overlay 仍可作为最小可交付功能继续使用。当前阶段不应直接把 Registry 改造成可任意删除的可变数据库，也不应为了一个 Spot 编辑需求提前实现所有 Def 类型的热更新。

## 五、建议后续施工顺序

### P0：架构裁定已完成

- ADR-0011 已 Accepted / 生效；
- ADR-0010 与 Task-0057 已同步 resolved / suspended / missing 和编辑操作语义；
- Tombstone 已裁定为 Draft-only，并绑定 owner 与 EditingWorkspace 生命周期；
- 导出格式、PackManager 持久化和 Runtime Detach / rebuild 顺序保留给后续 ADR / 任务。

### P1A：来源解析与 Tombstone 纯模型

- 建立 DefinitionRef、DefinitionRecord、DefinitionResolution；
- 建立目标包、引用包、基础包的来源测试；
- 实现 suspend、resume、remove-override 的纯解析行为；
- 不连接 Runtime，不修改 Registry。

### P1B：引用策略与诊断

- 实现 optional / required 的 resolver 行为；
- 补充 resolutionStatus 与 policy 诊断；
- 覆盖 DefinitionChange 的状态迁移测试；
- 不连接 Runtime，不修改 Registry。

### P2：候选物化与诊断集成

- 从解析结果生成完整 Datapack；
- 构建跨表引用诊断；
- 区分 optional、required、symbolic 的处理；
- 解析失败时保持旧 Runtime 不变。

### P3：Runtime 退出编排

- 先以整包 Registry rebuild + reloadPreservingState() 实现正确性；
- 清理或重建 Trigger、Affector、Visibility、GameNum 等派生系统；
- 引入 DefinitionDelta 和失效范围，但首版允许内部全量执行；
- 补充活动 Init、活动剧情和状态残留测试。

### P4：按表优化增量能力

- 优先优化 Spot / Area 索引、Tag、Visibility、Shop、资源表现；
- 再评估 Trigger / Affector / Funclet；
- Init 拓扑、角色结构和全局配置继续保留整包回退，直到具备完整局部重建证明。

### P5：Editor 接入

- Editor 只操作 Draft / Definition Layer；
- 提交时显示引用影响和 DefinitionDiagnostics；
- 支持 suspend / resume / delete-local / remove-override 的明确按钮语义；
- 与当前单 Mod、多临时 Spot 工作台衔接；
- 最后再接正式 PackManager 写入和 Mod 导出。

## 六、不可破坏的不变量

1. Editor 不直接删除或修改 Runtime Registry 成员；
2. Registry 是 Definition Resolution 的物化结果，不是 Definition 的真源；
3. 引用保留 ID，悬置原因由解析结果和诊断系统提供；
4. suspend 默认不清理 PlayerState；
5. remove-override 与 suspend 的下层回退语义必须不同且可见；
6. 解析失败或 Runtime 应用失败时，旧 Runtime 和旧 PlayerState 保持不变；
7. 没有完整失效证明的 Def 类型可以回退到整包重建；
8. “无效果”必须可诊断，不能成为静默数据丢失；
9. 数据服务不依赖 UI，编辑器状态不写入 Runtime Registry；
10. 不为旧 PlayerState 编写迁移兼容代码。

## 七、最终评价

Sol 的意见应被采纳为 Definition Resolution / Withdrawal 的正式设计方向，尤其是以下修正非常关键：

- 不把状态写进 Def 对象本身；
- 不把悬置字段散落进所有引用结构；
- 不把 Deleted、Suspended 当作同一层的运行时状态；
- 不让 Funclet Resolver 擅自决定所有上下文的中性值；
- 不把祖先不可达误写成子 Def 被删除；
- 不把内容差异和 Runtime 派生系统更新混为一谈。

但当前代码只能证明“整体重载后恢复运行时”和“部分实例可卸载”，不能证明已经拥有通用 Def 撤回能力。下一步应直接按已生效的 ADR-0011 施工 P1A/P1B 的纯 Definition Layer；在此之前，当前单 Mod / 多 Spot 需求继续使用 Runtime Overlay + 提交时一次重载即可。ADR-0011 生效本身不代表当前 Runtime 已拥有通用 Def 热卸载能力。

## 八、Sol 二次意见吸收结论

本轮 Sol 反馈不改变原 review 的总体结论，但把四个接口边界进一步压实：

1. suspended 只表示“来源链中存在可解析 Def，但被明确的阻断记录遮蔽”；没有任何来源才是 missing；
2. remove-override 与 delete-local 面向 source record，suspend 面向 resolved identity；
3. P1 只做 Draft-only Tombstone，不把 Tombstone 直接加入 Datapack 导出格式；
4. DefinitionDelta 保持内容层纯净，RuntimeInvalidationPlanner 负责把内容变化解释成失效范围。

同时补充两项：

- 引用策略首版优先通过 resolveRequired()、resolveOptional() 或显式 policy 参数表达；symbolic identity 继续由各系统解释，暂不急于为全部 Schema 字段增加 referencePolicy 元数据；
- PlayerState 残留处理分为 Retain、Detach、Purge：Detach 用于结束当前 Runtime session 中对已撤回 Def 的活动执行，但保留历史记录。

因此，本 review 已完成对 ADR-0011 的评审收敛。ADR-0011 现已生效；ADR-0010 继续负责 DefinitionRepository 的只读来源边界，其撤回状态和编辑操作语义以 ADR-0011 为准。

## 九、后续施工入口

已形成并生效的裁定：

- [[adr-0011-definition-resolution-withdrawal]]：解析状态、编辑操作、Draft-only Tombstone 与 Delta / Runtime 失效责任边界。

ADR-0011 生效不等于 Runtime 已具备通用 Def 热卸载；P1A/P1B 已完成纯模型施工，后续仍不得修改当前 Registry 的生命周期 API，除非另有 Runtime 任务裁定。

## 相关路由

- [[adr-0010-definition-repository-editor-resolution]]
- [[task-0057-single-mod-editor-workbench]]
- [[task-0055-runtime-datapack-editor-mvp]]
- [[docs/docs-828/02-modules/registry]]
- [[docs/docs-828/03-data-structures/registry]]
- [[docs/docs-828/03-data-structures/id-reference-semantics]]
- [[docs/docs-828/01-architecture/data-flow]]
