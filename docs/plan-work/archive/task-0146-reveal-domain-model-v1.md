# Task：Information Reveal Domain Model v1

状态：done — Information Reveal v1 领域合同已裁定；仅完成源码核验与文档记录（2026-09-25）

## 背景与目标

Task 0145 已审计 17 种 `ConditionTarget` 的 ConditionDepIndex 与 EB-T 唤醒覆盖。正式 Reveal 内容当前实际使用七种：`resource`、`stat`、`spotLevel`、`hasEnh`、`hasReadStory`、`hasReadStoryInRun`、`countTags`。Reactive-ready 候选为 `resource`、`spotLevel`、`hasReadStory`、`hasReadStoryInRun`；`stat` 适合 admission/reconcile-first；`hasEnh` 与 `countTags` 缺少足够的 EB-T 事件能力。

本 Task 先裁定 Information Reveal 的领域事实和 Watch 语义，为后续 Reveal ↔ EB-T Adapter 提供稳定输入。Condition 可求值不代表它具备可靠的运行期唤醒能力。Wake source 只触发完整 Condition/ConditionGroup 重新求值；ConditionSystem 继续拥有真假语义。

本 Task 是领域模型与边界决策，不实现 RevealProgress、Watch、WakePlan 或 EB-T Adapter，不迁移 UI/消费者，也不修改 Event catalog、ConditionDepIndex、VisibilityEngine、TriggerSystem 或 Datapack Schema。

## 最高约束

状态轴保持独立：

```text
existence       → 动态 Visibility
name / condition / utility → Information Reveal
unlock          → 实时可达性 / 可用性
```

Information Reveal 的持久事实不得接管 `existence` 可见性或 `unlock` 可用性。既有 `RevealStage` 若继续提供给 UI，只能是由已揭示信息与动态状态推导出的表现投影，不是持久化事实模型。

## Read Set

执行前重新核对以下当前事实；路径变化时以 `docs/docs-828/00-INDEX.md` 为准：

- `docs/docs-828/00-INDEX.md`
- `docs/docs-828/01-architecture/state-layers.md`
- `docs/docs-828/02-modules/visibility.md`
- `docs/docs-828/02-modules/expression.md`
- `docs/docs-828/02-modules/effect-trigger.md`
- `docs/docs-828/05-conventions/architecture-discipline.md`
- `docs/docs-828/05-conventions/doc-maintenance.md`
- `docs/plan-work/archive/task-0145-reveal-condition-event-coverage-audit.md`
- `docs/plan-work/archive/task-0144-trigger-runtime-registration-withdrawal.md`
- `docs/plan-work/draft-0143-trigger-runtime-registration-withdrawal.md`
- `src/engine/types/reveal.ts`
- `src/engine/types/expression.ts`
- 默认内容中所有 `revealTriggers` 定义与其实际消费者

## 本 Task 必须裁定的领域合同

### 1. RevealedTarget 与 RevealProgress

- 定义 Information Reveal 的目标身份。目标必须能区分实体类别、实体 ID 与 target；不得把 EB-T Registration key/token 或事件类型纳入领域身份。
- 明确持久事实形状。优先评估“已揭示 target 集合/等价位集合”，而不是把线性 `RevealStage` 作为事实；如果采用其他结构，说明它如何支持 name 与 condition 独立揭示，以及以后增加新 target。
- 明确 `already revealed` 的判断规则，以及定义缺失、实体不存在、重复提交等边界。
- 按实际玩法事实裁定 `ProgressScope`：评估 Init、Run/Timeline、Save、Profile、Global 等生命周期，不得把它与内容加载范围或监听生命周期合并，也不得未经证据一律选 Global。
- 只做数据形状和所有权裁定；不添加 PlayerState 字段、不写存档结构、不实现迁移。

### 2. Prerequisite 与 Watch eligibility

- 定义已揭示事实如何约束其他 Reveal target 的准入，例如某个 target 必须在 name 与 condition 均揭示后才 eligible。
- 首期采用受限关系；明确允许的 prerequisite 形式、求值语义、循环处理与非法引用处理。
- 不建立通用依赖图、任意表达式图或新的 Datapack DSL。必须说明如何避免把 `name / condition / utility` 硬编码成不可扩展的线性第三阶段逻辑。
- 从实体定义、Progress 与 prerequisite 推导“当前 eligible targets / desired Watches”的领域规则；EB-T 不参与决定哪些 Watch 应存在。

### 3. WatchScope 与 ProgressScope

- 分别定义 `WatchScope`（Watch 当前因何种加载/实体生命周期而存在）和 `ProgressScope`（揭示事实保留多久）。
- 明确同一领域目标可以使用短期 WatchScope、长期 ProgressScope；实体离开或内容卸载撤销 Watch，不自动清除 Progress。
- 定义 Scope 变化后的重建/reconcile 入口和必须重新读取的领域事实。
- 不让领域模型暴露 Registration group、runtime tag、token 或 EB-T 索引结构。

### 4. RevealWatch 与 WakePlan 语义

定义概念性领域对象及其边界，至少覆盖：

```text
RevealWatch
  WatchKey
  target condition
  prerequisite / eligibility basis
  WatchScope
  WakePlan (0..N wake sources, or an explicit non-reactive result)
```

- 一个 RevealWatch 表示一个完整 Condition/ConditionGroup 的求值责任；可由零到多个 wake source 唤醒，因此不得把它等同于单个 TriggerDef。
- 一个 ConditionGroup 的 wake set 是所有可能改变叶子真值的 wake source 并集；任一 source 到达后重新求值完整表达式。AND/OR 不得编译成多个 Trigger 的逻辑组合。
- Condition 真假由 ConditionSystem 求值。Condition 只能求值但没有可靠运行期 WakePlan 时，领域模型必须能明确表达此能力差异。
- WakePlan 只裁定语义，不新增运行时 API，也不建立通用的 `ConditionTarget → TriggerEventKind[]` 固定映射表。规划必须保留具体状态来源、scope、payload/filter 精度、admission/reconcile 的影响。
- 对信息 Reveal，以 `false → true` activation coverage 判断是否能可靠 reactive watch；`true → false` invalidation 作为独立属性记录。Sticky Progress 不因缺少回退唤醒而自动降级；若所选 ProgressScope 会重置，重置后的新准入必须重新 admission-evaluate。

## 首期能力边界

以 Task 0145 的源码证据为起点，逐项裁定当前七种正式 Reveal ConditionTarget：

| ConditionTarget | 当前审计分层 | 本 Task 要求 |
| --- | --- | --- |
| `resource` | Reactive-ready | 规定 Watch 可含资源变化与 Init 准入等多个 wake source；事件只唤醒完整求值 |
| `spotLevel` | Reactive-ready | 明确按实体/Spot 状态来源和 scope 准入，不丢失完整 Condition 求值 |
| `hasReadStory` | Reactive-ready | 区分当前持久事实 Scope 与运行期故事完成事件 |
| `hasReadStoryInRun` | Reactive-ready | 明确 Run/Init 重置与 admission/reconcile 的关系 |
| `stat` | Admission/Reconcile-first | 条件可求值不得被表述为 Reactive-ready；不以 tick 作为默认兜底 |
| `hasEnh` | Event capability gap | 不偷用 VisibilityEngine/ConditionDepIndex 作 EB-T 监听后门；裁定首期不支持 reactive 时的领域结果 |
| `countTags` | Event capability gap | 同上；状态定义或 Tag/Registry 重建需要通过领域 reconcile 处理，不伪造成普通事件 |

Task 0145 还发现 `InitService.enterInit()` 在默认 `currentAreaId` 写入前发出 `initEntered`，随后没有对应 `areaEntered`。本 Task 将其记录为 Init lifecycle/event ordering 的独立技术债，并规定 Reveal reconcile 必须发生在 Init admission 完成后；不得把 `initEntered` 当作所有 Init 状态都已稳定的信号。本 Task 不修复 Init 生命周期或把 `area` 加入 Information Reveal 首期范围。

首期只为四个 Reactive-ready target 裁定 WakePlan 语义。不把 17 种 ConditionTarget 编译成 Trigger 的通用 planner。对于其余实际内容目标，明确表达 AdmissionOnly、Unsupported 或其他经过证据支持的结果；不得让部分覆盖被标成 complete。

## 执行步骤

1. 按 Read Set 核实当前代码、默认内容中的 Reveal 定义及所有读取/呈现消费者；只使用当前源码与 Task 0145 审计作为事实依据。
2. 列出每类实体、Information Reveal target、条件组合、定义来源和实际消费路径，确认 Progress 身份需要覆盖的粒度。
3. 对 ProgressScope 与 WatchScope 分别提出候选范围，并依据数据生命周期、Init 快照、Run 记录和跨 Init 玩法事实给出首期裁定及未决问题。
4. 写出 RevealedTarget、RevealProgress、prerequisite、RevealWatch、WakePlan 的概念结构、所有权和关键不变量；区分领域身份与未来 EB-T 物化身份。
5. 对当前七种 ConditionTarget 给出明确能力 profile：Condition evaluation、activation wake coverage、invalidation coverage、admission/reconcile 责任及首期支持结果。
6. 定义准入时 current-state evaluation 与 Watch materialization 的语义顺序，避免 `evaluate(false) → register` 间漏掉状态变化；推荐先保证 Watch 的 wake source 已有效，再做 admission evaluation，满足时提交领域揭示并收敛所需 Watches。此处只裁定合同，不实现。
7. 给出失败/重复/重入时领域事实的权威性：Progress 是已揭示事实；未来 runtime Watch/Registration 是可重建投影；重复 reveal 提交须幂等。
8. 更新本 Task 的裁定、模型图、支持矩阵、边界与后续 Task 建议；同步 `docs/plan-work/00-index.md`。不要修改当前机制事实文档，除非本 Task 范围明确增加一条已经实现且稳定的机制（本 Task 预计不应产生此类修改）。

## 明确排除

- Reveal EB-T Adapter、Trigger Registration 物化、TriggerBehavior/RevealAction 与 opaque action handle。
- RevealProgress 的 PlayerState/存档字段实现、StateMutationService 写入实现与存档迁移。
- 任何 VisibilityEngine、ConditionDepIndex、Event catalog、TriggerSystem、Init lifecycle、Datapack 或 Schema 代码改动。
- 将 `existence` 变为 sticky 信息事实，或把 `unlock` 并入 Information Reveal。
- 通用 Condition dependency → event 编译器、Condition dirty/cache、tick 轮询或通用依赖图。
- UI 迁移、旧 Reveal 系统下线或并行消费者实现。
- 将 Reveal、Achievement、Milestone、Quest 等多个领域并入统一生命周期管理器。

## 执行裁定

### 领域事实与身份

首期将 Information Reveal 定义为**当前 Save 内单调增长的已知信息事实**。一次信息已揭示后，即使后来条件回退、切换 Init 或重新进入 Run，该信息仍保持已知；运行时监听被撤出、内容暂时卸载或状态重建都不删除它。

领域键使用稳定内容身份，不包含任何 EB-T runtime identity：

```ts
type InformationRevealTarget = string; // 受 Registry 中该实体声明的 target 集合约束
type RevealedTarget = {
  entityKind: EntityKind;
  entityId: string;
  target: InformationRevealTarget;
};

type RevealProgress = {
  revealed: ReadonlySet<RevealedTarget>;
};
```

初期接受的实体种类沿用当前定义所有者：`init`、`area`、`spot`、`enhancement`、`item`、`activeStoryEntry`、`passiveStoryEntry`。StoryEntry 以入口自身的 ID 为实体身份，不能用它指向的 StoryId 代替。初期 Information target 是 `name`、`condition`、`utility`；类型形状保留未来新增信息 target 的空间。`existence` 仍属于动态 Visibility，`unlock` 仍属于实时可达性，二者不写入 RevealProgress。

`RevealStage` 继续只是 UI/兼容投影。它可以从已揭示 target、当前 Visibility、可达性和拥有状态计算，但绝不能反向作为持久事实，也不能因 Stage 升级而合成 `name + condition + utility` 的进度。当前 UI 的 `owned/access → allKnown` 只能视为旧显示投影；它不授予 RevealProgress 事实。名称与条件可独立为真或为假。

`alreadyRevealed(key)` 按下列规则判定：

1. 当前定义不存在或该 target 未被该实体声明：返回 `unresolved`，不创建/提交事实；不因一次缺包或卸载删除已有进度。
2. prerequisite 未满足：该 target 暂不 eligible；进度查询不得把它投影成已知。
3. 该 target 没有 Reveal gate（无同 target 的 `revealTriggers`）：沿用现行语义，视为无门槛、已知，不要求写 progress。
4. 有 gate 且当前 Save 的 progress 含该领域键：已知，且不再依赖条件当前值。
5. 有 gate 但没有 progress：未知，除非 admission 或合法 wake 后当前完整条件求值为真并成功提交。

重复提交同一个已知 target 是幂等 no-op。实体消失、定义暂时缺失或内容包关闭不会清除 Save 里的 key；它只在相同完整身份的定义重新可解析时重新生效。不同实体类别、不同完整 ID、不同 target 互不碰撞。没有存档迁移和隐式跨 Save/账号合并。

### ProgressScope 与 WatchScope

| Scope | v1 裁定 | 生命周期事实 / 边界 |
| --- | --- | --- |
| `ProgressScope` | **Save**，适用于所有上述实体与信息 target | SaveData 持有 PlayerState；该范围跨 Init 切换与 Run 重新开始保留，但不等于 Profile、账号或跨存档 Global。`hasReadStoryInRun` 是 gate 的输入 scope，不是它揭示后事实的存储 scope。 |
| `WatchScope` | 当前已应用 Runtime 内容快照中的当前 Init admission | Watch 在所属内容不活动、Init 离开或定义被卸载时撤销；切换/读档/重置/内容 Apply 后由 Reveal 域重新读取定义、Progress、Prerequisite 和当前 state 推导。WatchScope 不写入 Save，不编码 EB-T group/tag/token。 |

v1 所有确有 gate 且当前 eligible 的 target 可在当前 active Init 中拥有 Watch。Init/Area/Spot/StoryEntry 的定义归属、当前 Init、Active/Passive Entry 的 `.inits()` 限定及当前 Registry 共同决定 eligibility；不把持久范围反推成监听范围。卸载只撤销运行期 Watch，不清除 Progress。恢复同一 Save 时先完成内容/Init admission，再重建所需 Watch。

### Prerequisite 与 desired Watch 推导

源码核验显示当前内容没有声明 `name → condition → utility` 的领域 prerequisite。旧消费者按 target 分别聚合：同一实体同一 target 的多个 RevealTrigger 是 OR；不同 target 各自判断。不能因为 UI 阶梯展示次序或“购买/拥有”状态就推断 `utility` 必须等待 `name && condition`。因此 v1 不为现有内容添加这条硬编码规则。

领域模型保留受限的 target prerequisite 能力，以便未来内容明确表达跨信息块准入，而不固定第三阶段：

- prerequisite 是同一实体内其他 Information target 的引用列表，列表按 AND 解释；空列表等于无 prerequisite。
- 不允许任意 Condition、跨实体依赖、OR 子句、事件引用或副作用。
- 引用必须指向已声明的 Information target；禁止自身引用与循环；非法引用使相关 target fail-closed 并产生定义诊断。
- v1 当前正式内容的 prerequisite 全为空。新增 target 是否依赖 `name`、`condition` 或两者应由该 target 的领域声明决定，而不是 RevealSystem 对 `utility` 的特例判断。

Desired Watches 由 Reveal 域根据当前定义中的信息 target、该 target 的 gate、Save Progress、受限 prerequisite、实体 scope 与当前 Init 推导。已有进度、未满足 prerequisite、缺失定义或无 gate 均不生成运行期 Watch。EB-T 不参与准入决策。

### RevealWatch、OR 与 WakePlan

```text
Content Definition + current Save Progress + active Init
                         │
                         ▼
                    RevealSystem
       ┌─────────────────┼──────────────────┐
       │                 │                  │
  Progress truth   prerequisites     desired RevealWatch
                                          │
                         Reveal ↔ EB-T adapter (future)
                                          │
                      0..N runtime registrations
                                          │ event wake
                                          ▼
                            full ConditionSystem evaluate
                                          │ true
                                          ▼
                              commit RevealProgress
                                          │
                                    reconcile
```

一个 `RevealWatch` 的领域身份是 `(entityKind, entityId, target)`。同 target 多条 RevealTrigger 按现行 OR 语义归并为**一个完整 gate**（概念上 `OR(all declared conditions)`；无条件分支使 gate admission-time 为真）。因此不需要用数组位置创造不稳定的 clause ID。一个 Watch 对完整 Condition/ConditionGroup 负责，WakePlan 可含 0..N source；它不是一个 TriggerDef。

```ts
type RevealWatch = {
  key: RevealedTarget;
  fullCondition: Condition | ConditionGroup;
  prerequisiteTargets: readonly InformationRevealTarget[];
  watchScope: WatchScope;
  wakePlan: ReactiveWakePlan | AdmissionOnly | Unsupported;
};

type ReactiveWakePlan = {
  kind: 'reactive';
  sources: readonly WakeSource[]; // 每个 source 带状态来源、过滤范围与作用域说明
  activationCoverage: 'complete' | 'partial';
  invalidationCoverage: 'complete' | 'partial' | 'uncovered';
};
type AdmissionOnly = { kind: 'admission-only'; reason: string };
type Unsupported = { kind: 'unsupported'; reason: string };
```

WakePlan 是特定完整 Watch 在特定来源、scope 与事件过滤条件下的审计/规划结果，不是 `ConditionTarget → TriggerEventKind[]` 固定表。AND 和 OR 都将所有叶子可能影响的 source 取并集；任一 source 唤醒后由 ConditionSystem 对整个表达式重新求值。Event 负责唤醒，ConditionSystem 负责真假。`ConditionDepIndex` 不是 Reveal 的监听后门。

### 当前默认内容样本

源码逐项核对的 Information Reveal（只统计 `name/condition/utility`，不把 `existence/unlock` 混入）：

| 定义拥有者 | 当前 gate 样本 | 结论 |
| --- | --- | --- |
| Init | 千禧年 name=`revealCredit(50)`；name/condition/utility 另有 Credit 产出门槛；其他 Init 的 Info target 使用 `revealCredit`；Trinity/Gehenna 的 existence `stat` 不属于此处信息事实 | target 之间独立；Progress key 用 InitId + target。 |
| Area | Hangar/千禧年机房等 name gate 用资源阈值 | Area 信息事实与动态所在/可达性分开。 |
| Spot | `field_work`、`tactical_desk`、咖啡角等资源门槛；Hangar 内容含 `hasReadStory`、`hasEnh`、`spotLevel`、`countTags`、`stat` 的嵌套 AND/OR | 组合条件保留完整结构；多个 gate 按 target OR。 |
| Enhancement | 当前默认内容未发现 `name/condition/utility` gate；存在/解锁声明属于另两条状态轴 | 不把 unlock state 写成 information progress；身份规则仍覆盖未来明确声明的信息 target。 |
| ActiveStoryEntry | Serika/run-chain Entry 的 name 与 condition 分别由 `hasReadStory` / `hasReadStoryInRun` 门控 | EntryId 而非 StoryId 是领域实体身份；name 与 condition 并非天然互相 prerequisite。 |
| PassiveStoryEntry | `schale_briefing.name` 使用 GlobalProduced stat 门槛 | 可求值，但 v1 无可靠持续 WakePlan。 |
| Item | 当前样本未发现 `name/condition/utility` gate | 后续加入时仍按相同身份、scope 与 gate 规则。 |

该列表用于核对领域身份与当前消费者，不表示所有 target 都能在 v1 reactive。默认内容事实以 `src/arona-clicker/content/inits.ts`、`areas.ts`、`spots.ts`、`enhancements.ts`、`story-active-entries.ts`、`story-passive-entries.ts` 与 `tooltip-reveal.ts` 为准。

### Condition Wake Profile v1

`Condition evaluation` 表示当前 ConditionSystem 能否求值；`activation` 只衡量未知 target 从 false 到 true 时能否被唤醒；`invalidation` 独立衡量 true 到 false。Sticky Progress 的准入以 activation 为门槛，不因 invalidation 不完整而被撤回。下表针对当前 Information Reveal 用法，而非一般动态 Visibility。

| ConditionTarget | Evaluate | Activation / wake sources | Invalidation | Admission / v1 结论 |
| --- | --- | --- | --- | --- |
| `resource` | yes | complete：精确 `resourceChanged(resourceId)`；当前 Init 的资源快照切换由 `initEntered` 唤醒，并在 Init 完成后 reconcile | complete for observed resource changes; state replacement is covered by Init wake/reconcile | Reactive-ready；一个 Watch 可以对应资源变化与 Init 准入等多个唤醒源。 |
| `spotLevel` | yes | complete：精确 `spotLevelChanged(spotId)`；Init 快照切换由 `initEntered` 唤醒，默认 Spot 后续解锁另发等级事件 | complete for observed level changes; definition replacement uses reconcile | Reactive-ready；升级、降级及默认 Spot 解锁后均重新求完整条件。 |
| `hasReadStory` | yes | complete：`storyCompleted(storyId)`；Init 投影切换由 `initEntered` 唤醒，并在 admission 完成后 reconcile | partial for dynamic projection because `storyLog` is per-Init | Reactive-ready for sticky activation。**源码事实更正：** ConditionSystem 实际查的是 per-Init `state.storyLog`，不是 `storyReadLogs`，也不是跨 Run 阅读事实；事件 producer 在追加完成记录后发 `storyCompleted`。 |
| `hasReadStoryInRun` | yes | complete：`storyCompleted(storyId)`；`beginSession()` 重置后以 `initEntered` 与 admission reconcile 读取新 Run | complete within one Run; session reset is a scope transition, not a sticky invalidation | Reactive-ready for sticky activation。该名称对应 `completedStoryIdsThisRun`，StatsService 的 `beginSession()` 会清空集合；ProgressScope 仍是 Save。 |
| `stat` | yes | no general complete event set：统计可来自多类状态变化；v1 不以 `tick` 或宽事件兜底 | partial / source-dependent | AdmissionOnly：准入与显式 reconcile 时可求值；false 时不保留“保证实时”的 Watch。 |
| `hasEnh` | yes | EB-T event capability gap | 当前 DepIndex 能力不能推出 EB-T wake 能力 | AdmissionOnly / non-reactive v1：只在 admission/reconcile 求值；后续要 reactive 必须增加并核实真实领域事件。 |
| `countTags` | yes | Tag 声明、收集状态、Init/Registry 重建与动态 tag 的状态来源不构成 v1 完整 EB-T wake plan | source-dependent / partial | AdmissionOnly / non-reactive v1；不偷用 VisibilityEngine 或 DepIndex，也不伪造事件。 |

`hasReadStory` 的 API 名称与实现事实不一致是现存语义债务，本 Task 不改 ConditionTarget、默认数据或 Schema；后续消费者必须按真实 `storyLog` 完成事实设计。`stat`、`hasEnh`、`countTags` 仍可被 ConditionSystem 求值，但“可求值”不代表“能可靠持续监听”。

### 准入、提交与收敛顺序

对具有至少一个合法 reactive source 的 desired Watch，顺序裁定为：

1. Reveal 域推导 desired Watches 并验证 key、gate、prerequisite 与当前 WatchScope。
2. Adapter 先完成这些 Watch 所需 Wake source 的 materialization/subscription；同一事件可以覆盖多个 Watch，单一 Watch 也可有多个 source。
3. 订阅有效后立即从**当前完整状态** admission-evaluate 整个 gate。Admission evaluation 是直接 ConditionSystem 查询，不伪造/重放事件。
4. 仍 eligible、仍未已知且 gate 为真时，由 Reveal 域提交一次 RevealProgress；随后重算 desired Watches 并撤出已不再需要的 Watch。
5. `AdmissionOnly` Watch 只在当前准入/reconcile 查询；false 时不能声称会对之后的变化实时响应。

因此避免 `evaluate(false) → register` 的丢事件窗口。重新 reconcile/重复事件/重入提交均按当前 Progress 与完整 Condition 再验证；Progress 提交才是权威事实，Runtime Watch 是可丢弃并重建的投影。失败而未提交 Progress 时继续保留仍有效的 Reactive Watch 以供重试；若已经揭示，清理 Watch 不得回滚进度。

Init ordering 是独立技术债：`InitService.enterInit()` 在发出 `initEntered` 后才写默认 `currentAreaId`，之后也没有 `areaEntered`。因此 `initEntered` 不能当作“Init 全状态已稳定”信号。后续 Adapter 必须由 Init/Runtime 所有者在 Init admission 完成（默认 Area、默认 Spot、起始流程等已建立）后调用 reconcile；本 Task 不改该生命周期。

### 候选方案与取舍

| 候选 | 决定 | 依据 |
| --- | --- | --- |
| 把线性 `RevealStage` 写成 Progress | 拒绝 | name/condition 独立揭示，Stage 混入存在、访问、拥有投影且无法表达独立布尔组合。 |
| 为每种目标分别硬编码 target 阶段与 prerequisite | 拒绝 | 当前内容没有通用阶段 prerequisite；以后新 target 会迫使改核心分支。 |
| 保存 target 集合，并由每个 target 自带受限 prerequisite 描述 | 采纳为领域合同 | 支持独立事实与拓展 target；当前无 prereq 的内容保持空约束，不引入通用表达式图。 |
| Progress 写进 Init 或 Run scope | 拒绝为 v1 默认 | 与 Sticky 信息在切换后仍已知的玩法语义冲突；story / Run 条件是 gate 输入，不是揭示事实生命周期。 |
| Progress 写入 PlayerState 所谓 Global/Profile | 拒绝 | “global”在此仓库是 Save 内跨 Init 状态层；没有 Profile/跨 Save 持久服务证据。Save scope 已准确覆盖本目标。 |
| 单 Watch = 单 TriggerDef，或把 AND/OR 翻译成 Trigger 逻辑组合 | 拒绝 | 一个完整条件可依赖多个真实事件；ConditionSystem 保留完整表达式真值，Wake source 仅唤醒。 |

### 未决事项与后续切片

- 默认内容作者将来如何显式声明 prerequisite 尚未授权；本 Task 只冻结受限领域语义，不增加 Datapack DSL。
- Profile/跨 Save 信息记忆没有现行持久服务证据，留待真实产品需求另立裁定；v1 不偷偷并入账号级 Global。
- `hasReadStory` 命名与读取 `storyLog` 完成事实的差异需由独立 Condition 语义任务决定；本 Task 只按事实设计 WakePlan。
- `AdmissionOnly` 的 `stat`、`hasEnh`、`countTags` 在无其他 reconcile 时不会承诺同一 Init 内的最终实时揭示。扩大支持必须先证明事件源或明确产品接受边界。
- Init 的 post-admission reconcile 入口需要后续 Adapter Task 接入；`initEntered` 当前顺序事实保持技术债。
- 下一切片另立 Reveal Adapter Task：实现 Reveal 域状态/Watch desired 推导、受限 wake materialization 与 typed success boundary；只能消费本 Task 的合同。当前 Task 不授权实现。

### 终态核验（2026-09-25）

- Read Set 中的当前模块文档、Task 0145 审计、Reveal/Condition/UI/State/Save 源码已核对；默认内容 Information targets 与 Condition 组合已单独盘点。
- 已决定所有 Information Reveal 的 ProgressScope 为 Save，所有运行期 WatchScope 为当前已应用内容快照 + 当前 Init admission；两者不能互相推导。
- 已记录 target identity、RevealProgress、OR gate 合并、受限 prerequisite、七类内容实体、七种实际 ConditionTarget 的 Wake Profile 和 admission commit 顺序。
- `npm run check:docs` 是本任务要求的唯一机器验证；本任务是设计文档裁定，没有运行测试套件。
- AOCI 完整 Overview 已交付且 Host delivery 已确认（782 entries，约 153,098 tokens，40 chunks）；Strict challenge submission 未通过 schema 校验，按会话合同不重试。治理对齐为 true；当前不能声称 strict AOCI cognition attestation verified，工程结论均绑定本轮源码与文档证据。

## 验收标准

- [x] 有明确且可判定的 RevealedTarget 身份与 RevealProgress 事实模型；并说明它不等同于 RevealStage 投影。
- [x] 逐个裁定当前内容目标的 ProgressScope，并定义 `already revealed`、重复提交与实体/定义缺失规则。
- [x] prerequisite 规则足以表达当前 Reveal 准入需求；关系受限、可验证，不形成通用依赖图，也没有把 utility 固定写成不可扩展的阶段特例。
- [x] WatchScope 与 ProgressScope 定义分离，并给出卸载、切换、重建和重新准入语义。
- [x] RevealWatch 表示完整 Condition 的求值责任，可有 0..N WakePlan source；ConditionGroup 唤醒为叶子 source 并集，AND/OR 真值始终由 ConditionSystem 判定。
- [x] 清晰区分 Condition evaluation capability、activation wake coverage、invalidation coverage 与 admission/reconcile 责任；明确 Sticky Reveal 不要求 true→false 唤醒。
- [x] 四个 Reactive-ready target 各有受限 WakePlan 语义；`stat`、`hasEnh`、`countTags` 没有被误报为完整 reactive 覆盖，且未以 tick 或 DepIndex/VisibilityEngine 作为隐形兜底。
- [x] `initEntered` 早于默认 Area 写入的事实成为独立技术债记录；准入后 reconcile 时机不依赖 `initEntered` 表示状态已完全稳定。
- [x] Progress 是领域权威事实，Watch/Registration 是重建投影；准入时检查当前状态的顺序避免检查与监听建立间的漏事件窗口。
- [x] Task 文档记录决策依据、候选方案、明确裁定、未决问题和下一施工切片；不改代码、数据包、Schema 或现行机制文档。
- [x] `npm run check:docs` 通过；本 Task 为设计裁定任务，不要求也不运行测试套件。


## 预期后续切片

本 Task 完成后，再另立 Reveal Adapter Task，限定消费本 Task 已裁定的领域接口和 WakePlan：首期只接 `resource`、`spotLevel`、`hasReadStory`、`hasReadStoryInRun`，将一个 Watch 物化为 0..N EB-T Registration；admission-time evaluation 与 Watch reconcile 由 Reveal 领域服务拥有。此 Task 不自动授权该实现。

## 相关文档

- [[task-0145-reveal-condition-event-coverage-audit]]
- [[task-0144-trigger-runtime-registration-withdrawal]]
- [[draft-0143-trigger-runtime-registration-withdrawal]]
- [[docs/docs-828/02-modules/visibility]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
