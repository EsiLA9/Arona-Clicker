# Draft：Trigger Runtime Registration 与 Withdrawal

状态：accepted — Task A 首切片已完成；EB-T-Reveal 消费者目标行为已补入，实施边界待裁定

## 目标

在启动 Reveal 等领域改造前，先把 EB-T 的运行时注册身份、幂等准入/撤出、Tag 批量撤出和当前 dispatch 即时失效语义定义清楚。领域封装负责决定注册资格与持久玩法进度；EB-T 只维护有效 Registration 并按 Event → Match → Condition → 执行路径派发。

## 设计边界

- 本文冻结 EB-T runtime registration/withdrawal 首期边界，并记录后续 EB-T-Reveal 并行消费者的目标行为；新增目标行为本身不改变当前玩法，也不构成消费者施工授权。
- EB-T 不理解 Reveal、Milestone、StoryFollowUp 等领域概念，也不持有领域进度。
- Definition、Trigger 身份、领域 Watch、Registration、一次派发的候选身份、Domain Progress 是不同概念，不强行共用一个 ID。
- 保留现有 `group`，并新增精确匹配的 runtime tags；二者用途不同。Runtime tags 首期只由内部领域适配器提供，不加入 Datapack DSL。
- 第一施工切片只做 EB-T Registration/Withdrawal 基础设施；不改 once/Effect 成功时序，不加 post-fire、不引入 Behavior。
- 后续 Reveal 切片在领域侧决策 Watch，再由独立 adapter 物化为 EB-T Registration；不把 Watch 规划、RevealProgress 或可见性/解锁语义下沉到 EB-T。
- 当前只规划 Reveal 的领域行为与 EB-T 接口要求；Condition dirty/cache、索引性能和更底层失效服务不在本轮范围。

## 当前事实与代码落点

- `TriggerSystem` 当前以 `RegistrationKey` 保存 Registration，以 `(key, token)` 区分运行 incarnation；一个 `TriggerId` 可以对应多条 Registration。
- `register()` 接收不含 token 的 `TriggerRegistrationRequest`；同 key 同规范请求幂等，冲突拒绝隐式替换。TriggerSystem 实例级分配单调 token，`clear()` 不复位。
- 系统维护 event type、key→type、group、runtime tag 索引；tag 严格相等匹配。兼容 `mount/load/unmount` 使用独立 legacy key，不误撤显式 Registration。
- TriggerSystem 继承 `EventDrivenReactor` 并静态按事件类型订阅 EventBus；Registration 准入/撤出不创建或删除单条 EventBus listener。
- 派发候选快照保存 `(key, token)` 并在每项执行前复核；撤出后同 key 重注册不会让旧候选复活，本轮新增 Registration 从后续事件开始响应。
- once 仍按 `TriggerId` 写入 `triggersCompleted` 后执行 Effect；Task A 保持既有顺序。Effect 结果仍没有统一的成功/失败协议，留给 Execution / Commit Semantics 后续切片。
- 当前 `VisibilityEngine` 也继承 `EventDrivenReactor`，但不注册到 `TriggerSystem`；它自行用 `ConditionDepIndex` 维护 existence 显隐。name/condition/utility 的信息揭示仍由 UI 查询时直接求值。Task A 未迁移 Reveal consumer。
- 当前 EB-T 的 `TriggerDef` 只有 `effects[]` 执行路径，尚无受限 typed Behavior/RevealAction；Reveal 写入进度并在 dispatch 中请求撤出还需单独设计。

## 核心术语

```text
Definition / TriggerDef
    │ domain admission
    ▼
Registration（当前是否参与 EB-T 派发）
    │ event dispatch
    ▼
Execution（Match → Condition → existing Effect pipeline）

Domain Progress（once / RevealProgress / Story progress）独立存在
```

| 概念 | 职责 | 生命周期 |
| --- | --- | --- |
| Trigger Definition | 声明事件模式、条件和既有 `Effect[]` | 数据包或领域内容源拥有 |
| `TriggerId` | 逻辑规则身份；可能承载持久 once 进度引用 | 不随单次挂载自动改变 |
| Reveal Watch | 领域意图：某作用域内某实体的某信息目标当前需要监听 | RevealSystem 根据内容、进度与准入策略推导 |
| `RegistrationKey` | 可重复使用的 runtime slot key | withdraw 后可重新 register |
| `RegistrationToken` | 区分同 key 的某次 Registration incarnation | TriggerSystem 实例生命周期内单调分配 |
| Registration identity | `(RegistrationKey, RegistrationToken)` | 一次准入至撤出的唯一运行身份 |
| Group | 单 Registration 的来源/生命周期批量卸载标签 | Init、实体局部来源等装配边界 |
| `TriggerRuntimeTag` | 行为语义上的精确批量撤出选择器 | 由 Registration 携带，可有多个 |
| Domain Progress | 领域是否已完成、揭示或消费 | 领域决定存档层与重注册资格 |

## Registration 运行时形状

以下是已实施的内部 runtime 合同，不是公开 Datapack Schema。调用边界提交 Request，token 由 TriggerSystem 创建：

```ts
type TriggerRegistrationRequest = {
  key: RegistrationKey;
  triggerId: TriggerId;
  def: TriggerDef;
  tags: ReadonlySet<TriggerRuntimeTag>;
  group?: RegistrationGroup;
};

type TriggerRegistration = TriggerRegistrationRequest & {
  token: RegistrationToken;
};

type DispatchCandidate = {
  key: RegistrationKey;
  token: RegistrationToken;
};
```

建议首期明确 `TriggerId : Registration = 1:N`：同一逻辑 Trigger 可因不同来源或作用域拥有多条 Registration，并共享其 `TriggerId` 对应的 once 进度身份。`RegistrationKey` 在 EB-T 中全局唯一；不同来源/作用域使用不同 key。一个 Registration 只有一个可选 group，不做 owner list 或 ref-count。key 的具体字符串格式与构造责任仍待裁定。

`RegistrationToken` 由 TriggerSystem 实例级单调计数器分配；每次真正创建 Registration 才取新 token。`clear()` 清空注册与索引但不重置计数器。名称用 `Token` 而非 per-key generation，避免把内部 token 暴露成领域版本号。

## 注册与撤出语义

EB-T 已提供以下最小运行时操作：

```text
register(request: TriggerRegistrationRequest)
withdraw(registrationKey)
withdrawByTag(tag) / withdrawByTags(tags)
unmountGroup(group)   // 保留现有来源生命周期语义
```

- 对已注册的相同 key 和相同规范 RegistrationRequest 重复 register：幂等 no-op，不生成额外 Registration 或候选。EB-T 只比较规范请求的结构/descriptor 身份，不判断两个任意 TriggerDef 是否语义等价。
- 调用方提交不含 token 的 TriggerRegistrationRequest；TriggerSystem 仅在真正创建 Registration 时分配 token，领域系统不能制造、复用或猜测 token。
- 同 key 已存在但载荷不同：首期直接报错；不隐式覆盖，也不提供 `replace()`。调用方必须先 withdraw，再以同 key 注册，产生新 token。
- 幂等判定不引入通用深度结构哈希。Registration descriptor 应先规范化；首期比较策略可在实施 Task 中细化，冲突时优先报 invariant violation，而非静默覆盖。
- withdraw 不存在/已撤出的 key：安全 no-op。
- withdraw 后同 key 可再次 register，但必须生成新 token；旧候选不可命中新 incarnation。
- 一个 `TriggerId` 可对应多个 key，各 Registration 独立准入/撤出，once 进度仍由共享 `TriggerId` 语义决定。
- 每个 Registration 独立携带零/一个 group 和多个 runtime tags。Group 与 Tag 索引最终都撤销 Registration，但目的不同：group 表示“这条注册由谁的生命周期管理”，tag 表示“哪些注册在语义上可一起撤出”。
- Runtime tag 首期只供领域 adapter 构造 Registration 时使用；`TriggerDef` / 普通 Datapack 不增加 `runtimeTags` 字段。
- `TriggerRuntimeTag` 为不透明精确身份，EB-T 只做严格相等匹配。不得复用 ContentTag 的层级前缀匹配；Reveal 等领域如需撤同级/低级，应自行展开 tags 并发出多个精确撤出请求。
- EB-T 内部维护 `key → registration`、`event type → keys`、`key → event type`、`group → keys`、`tag → keys` 等索引一致性。领域调用方不能直接修改索引或 EventBus listeners。

## Dispatch 中即时撤出契约

1. 事件到达时，从对应事件桶生成候选快照 `{key, token}`。
2. 对每个候选执行前，读取当前 Registration。
3. 仅当 Registration 存在且 token 与候选一致时继续 Match/Condition/Execution。
4. 任一行为撤出 Registration 后，即使同 key 在本次 dispatch 内重新注册，新 token 也不能让旧候选恢复资格；新 Registration 从之后的事件开始生效。
5. `withdrawByTag(X)` 在执行时撤销当时带精确 tag X 的全部 Registration；同轮尚未执行的候选立即失效。
6. 一次事件处理过程中新增的 Registration 不自动加入已经建立的候选快照。

这样避免将 Trigger ID 快照误当成某次注册身份，也避免“撤出后借尸还魂”。EventBus listener 仍是 TriggerSystem 级静态分桶订阅，不按 Registration 建立独立 listener。

## 第一施工切片：Registration & Withdrawal（Task A 已完成）

Task A 已按以下边界完成纯运行时基础设施增量：

1. Registration record、全局唯一 `RegistrationKey` 和 `TriggerId : Registration = 1:N`。
2. TriggerSystem 生命周期内单调 `RegistrationToken`；`clear()` 不复位。
3. 幂等 register、幂等 withdraw、withdrawByTag(s)，保留单值 group 索引，不做 ref-count。
4. 精确 runtime tag 倒排索引；首期只对内部 adapter 开放，不进入 Datapack Schema。
5. dispatch candidate 携带 `(key, token)`，逐候选复核 token；撤出后同 key 重注册仍使旧候选失效。
6. 一致维护 byType、bucketType、group、tag 索引；修复同 key 更换事件类型后的旧 bucket 残留。
7. 保持现有 Effect pipeline 与 once 提交时序不变；不加 post-fire、in-flight、Behavior 或 Effect transaction 语义。

首切片不改现有 Trigger 的游戏行为，不引入 Reveal consumer；通过单元测试证明运行时 Registration 合同。

## 后续切片：Execution / Commit Semantics

以下内容从 Registration & Withdrawal 首切片中排除，后续另立执行提交语义设计：

```text
Match ✓ → in-flight → Effect[] pipeline → success/failure
                                     → once commit / post-fire withdrawal
```

- 需要定义 in-flight 防重，避免 Effect 同步发事件导致同一 once Trigger 递归重入。
- 需要为 Effect 执行定义 success/failure/partial/no-op 可观察契约，再裁定 Effect 成功、once 持久提交与 post-fire withdrawal 的顺序。
- 当前 `EffectEngine.applyEffects()` 与 `StateMutationPort.applyEffects()` 返回 `void`，且 mutation 批次可能部分写入；事务与回滚语义不由 Registration Task 顺带解决。

Registration Task 保持当前 Effect 与 once 时序不变，不承诺失败 Effect 不消费 once。

## 持久进度与重新准入

- EB-T 的 withdraw 只撤销当前 Registration，不删除 Definition、Registry 内容或 Domain Progress。
- 领域系统在重新装载/进入作用域时读取自己的进度，决定要不要重新 register。
- once 仍按 `TriggerId`（或之后明确的进度身份）判断；Tag/group/generation 不得进入 once 完成身份。
- 当前 `triggersCompleted` 是 per-Init。通用 Runtime Registration 改造不自动改变这一现状；全局规则是否应有跨 Init once 需要独立裁定。
- 暂时准出与永久移除内容必须由来源/领域层区分；EB-T 不负责清理 orphan progress。
- withdraw 不重放离线/缺席期间的事件；重新 register 只响应未来派发。若玩法需要对当前状态补算，由领域适配层显式执行 reconcile，而不是 EB-T 隐式 replay。

## 后续目标行为草案：并行 EB-T-Reveal

本节是首期 Registration/Withdrawal 之后的 Reveal 消费者设计，不改变 Task A 已完成边界。第一阶段保留现有 `VisibilityEngine` 与 UI Reveal 求值路径；新路径并行建立并独立验收，在切换消费者前不得让两套实现同时写同一份结果。

### 领域职责与三条状态轴

冻结以下职责分离：

```text
Visibility：实体现在是否出现                 → VisibilityEngine
Reveal：玩家已经知道该实体的哪些信息           → RevealSystem / RevealProgress
Unlock：实体或功能现在是否可达、可使用          → 所属领域的实时准入判定
```

三者互不蕴含。数据允许时，实体可以隐藏但已知名称，也可以可见但仍隐藏名称或条件信息；已揭示信息不自动代表实体当前可达。`existence` 保持当前显隐门槛语义，不作为一次性 RevealProgress；`unlock` 是可达性门槛，不作为信息揭示进度。RevealProgress 首期只承载信息目标。

### Watch 计划与 EB-T 物化分层

- RevealSystem 的领域接口只表达 `RevealWatchKey { watchScope, entityKind, entityId, target }` 一类稳定 Watch 身份及 Watch 意图；领域侧不持有 RegistrationKey、RegistrationToken、EB-T group/tag、TriggerDef 展开数量或 Registration 列表。
- RevealSystem 按 Definitions、RevealProgress 与 target 准入策略，计算 `desired Watches`。它负责解释哪些目标未揭示、当前是否 eligible、内容是否属于当前可用作用域，以及一次推进后哪些 Watch 不再需要。
- 独立的 Reveal↔EB-T adapter 将 Watch 集合物化为一条或多条 `TriggerRegistrationRequest`，生成 EB-T 稳定 key、TriggerDef、group、runtime tags 与 opaque `RevealActionHandle`，并维护 Watch↔Registration 及 Watch↔ActionHandle 私有映射。Action payload 只携带 handle，不携带 `RevealWatchKey` 字段；Watch/schema 变化不泄漏进 EB-T runtime descriptor，EB-T registration 变化也不泄漏到 RevealSystem。
- adapter 根据 desired/current Watch 集做 reconcile：新增缺少的 Watch、撤销不再需要的 Watch、同一 Watch 重复 reconcile 幂等。EB-T Registration 是可重建运行时投影，不能作为领域进度事实。
- EB-T group 表示 Registration 的来源或运行生命周期；runtime tag 表示跨 Registration 的精确撤出关系。adapter 应避免 group 和 tag 同时表达同一个 RevealTarget 的同一批候选。具体映射由 adapter 决定：例如 group 承担 content/watch scope 生命周期，target tag 用于撤出同一 Watch 下的 OR alternatives。

### 目标资格与条件语义

- 一个 Watch 对应一个实体上的一个 RevealTarget；该 target 下多条 `revealTriggers` 仍按 OR 解释，任一条件满足即可提交该目标。
- 没有声明条件的目标按现有 DSL 语义处理为无门槛；没有相应 target 声明时继续沿用默认已知语义，不为其创建 Registration。
- 目标是否 eligible 由 RevealProgress 与目标前置关系推导，而不是写成 RevealSystem 对固定“第几阶段”的分支。首期可用内部策略表达默认关系：`name` 与 `condition` 可独立揭示；`utility` 默认要求前两者都已揭示。首期不因此新增 Datapack 作者字段；以后增加目标时扩展策略，不改 Watch/Registration 主模型。
- RevealProgress 保存已揭示的信息 target 集合（例如 `name`、`condition`、`utility` 的集合/位集），不持久化 `RevealStage`。`presence/partial/known/utility` 由 Visibility 与已揭示位投影；`purchaseable` 和 `owned` 由实时可达/拥有状态决定。投影不得反向成为唯一持久事实，以便以后加入 `description`、`source` 等信息 target 时不扩张线性阶段枚举。

### 两种条件求值入口

条件求值有两个合法入口，事件不是唯一入口，也不得为准入查询伪造 EventBus 事件：

1. **Admission-time evaluation**：Watch 新变为 eligible、内容加载/作用域进入或存档恢复后，adapter 先物化其 Registration，再针对当前 ConditionState 查询一次。条件已满足则直接请求领域提交并 reconcile 撤出；未满足则保留 Registration。
2. **Event-driven evaluation**：Watch 已物化为有效 Registration 后，由真实 Event 到达驱动 EB-T 的 Match → Condition → Typed Action。

注册先于当前态查询，避免 `evaluate=false → state changes → register` 间隙漏过已经发生的变化。Admission-time evaluation 是对当前状态的领域查询，不重放或合成事件；若推进使新 Watch eligible，先物化新 Watch 的 Registration，再查询当前状态。新 Registration 不加入当前 dispatch；已撤出 Registration 即使位于候选快照中，也不得执行。首期以同步 mutation/event/reconcile 临界段为前提；若调用链变为异步，须另定并发合同。

### Reveal 成功、持久事实与撤出

```text
Trigger match
    ↓
受限 RevealAction(ActionHandle)
    ↓
Reveal adapter 解析 ActionHandle → RevealWatchKey
    ↓
RevealSystem.commitReveal(WatchKey)
    ├─ 检查作用域有效且目标尚未揭示
    ├─ 通过 StateMutationService 提交 RevealProgress  ← 权威事实
    └─ 推导 desired Watches 并请求 adapter reconcile
```

- EB-T 只执行类型受限的 `RevealAction(ActionHandle)`，不发布 `revealTargetSucceeded` 领域事件，也不理解 RevealTarget、层级或持久进度。adapter 解析 opaque handle 后调用 RevealSystem；handle 仅在运行时映射中有效，随 Registration 重建，不持久化为领域身份。Action 由受控行为注册表处理，不允许数据包提供任意 callback。
- 现有 TriggerSystem 目前只执行 `Effect[]`；Reveal consumer 因而依赖后续单独裁定的 typed Behavior/Action 执行边界。不得用 `TriggerSystem.once` 代替 RevealProgress，也不得假设普通 Effect 已能写 RevealProgress。
- adapter 生成的 Reveal Trigger 使用 `once:false`；是否已揭示及重复 Action 的幂等性只由 RevealProgress/`commitReveal` 决定。EB-T 的 once 完成记录不能先于领域提交消耗。
- `commitReveal` 是领域事实提交点：先验证未揭示并提交 RevealProgress，再 reconcile 运行时 Registration。若撤出/准入失败，已提交的 RevealProgress 仍是真实进度；下次装载或显式 reconcile 按该事实修复 Registration 投影。
- 成功后撤掉已完成 Watch 的 OR alternatives，以及因进度变化而不再 eligible/required 的其他 Watches；保留仍未完成且仍 eligible 的并列目标。撤出具体 Registration 的表达完全由 adapter 翻译，不由 RevealSystem 调用 tag/group API。
- 不因 Watch 撤出清除 RevealProgress；卸载内容作用域只撤销运行资格，不重置进度。重新加载后按进度重建仍有效的 Watch。

### WatchScope 与 ProgressScope

运行内容作用域与持久进度作用域是两个独立概念，不共用一个 `scope` 字段：

```text
WatchScope     = 当前 Watch 因哪个已加载内容/运行生命周期而存在（如当前 Init）
ProgressScope  = RevealProgress 应保存多久（Init / Run / Timeline / Save / Profile / Global）
```

因此 Watch 可以在当前 Init 卸载时撤出，而对应进度按 Profile 或 Global 保留。首个消费者切片需依据内容与跨 Init 玩法事实明确实际 scope 和字段归属；不得直接把状态结构写死为 `init.revealProgress`。

### 首个消费者切片的待核验项

- 首先只读审计允许进入 EB-T-Reveal 的 Condition 对应哪些真实事件；当前 `TriggerEventDef.kind` 的事件面窄于 `ConditionDepIndex` 的所有依赖事件。目标行为不得默许未覆盖条件只靠未来偶然事件触发。该事件覆盖核验不等同于实现 dirty/cache 层，也不预设最终 Watch 一定物化为 TriggerEventDef。
- 明确所有权/可见性/访问状态变化是否属于 Reveal Watch，还是继续由既有 VisibilityEngine 与领域实时查询独立处理；当前建议按上述三轴保持分离。
- 明确 target prerequisite 策略、WatchScope、ProgressScope、集合/位集字段以及 StateMutationService 写入入口。
- 定义窄范围 Typed Runtime Action：既有 `Effect[]` 和受控 Action 两条执行入口；Action 返回 handled/failed 等最小结果，不顺带设计通用 Effect transaction。
- 明确 ActionHandle 生成、解析、失效及 Registration 重建语义；handle 映射由 adapter 私有管理。

Condition/Event Coverage Audit 输出矩阵至少包含：

| Condition dependency / target | ConditionDepIndex 当前失效事件 | EB-T 当前真实事件覆盖 | Reveal 首期支持 | 证据/限制 |
| --- | --- | --- | --- | --- |
| 按 Condition 类型与状态来源逐项填写 | 源码事实 | 源码事实 | 审计裁定 | 源码路径与事件 payload |

### 后续施工顺序建议

1. **Reveal Condition/Event Coverage Audit**：由 [[task-0145-reveal-condition-event-coverage-audit]] 只查事实并形成矩阵，不修改源码。每类条件记录 `Condition dependency`、`ConditionDepIndex` 当前失效事件、EB-T 是否有对应真实事件、Reveal 首期是否支持及证据。
2. **Reveal Domain Model**：裁定信息 target 集合、prerequisite 策略、RevealWatchKey、WatchScope/ProgressScope 与 RevealProgress 字段；不改 EB-T。
3. **Typed Runtime Action Boundary**：只增加 EB-T 执行受控 Action 并返回最小结果的边界；不解决通用 Effect 事务。
4. **Reveal Adapter**：实现 desired Watch → Registration 的私有物化/reconcile，以及 Registration → opaque ActionHandle → Watch 的反向映射。
5. **Parallel Consumer**：运行 EB-T-Reveal 并观察一致性，旧 UI Reveal 仍是生产事实来源；不得双写相同 RevealProgress。
6. **Consumer Migration**：并行结果稳定后另立切换范围，迁移 UI/领域消费者。

Task A 的 RegistrationKey、Token、group/tag 与 dispatch revalidation 已冻结；上述后续步骤不得因 Reveal 需求反向扩张或改写 Task A。

## 最小改造边界

1. 引入内部 Registration record；`TriggerId : Registration = 1:N`，key 全局唯一。
2. 引入实例级单调 RegistrationToken；dispatch candidate 携带 key/token；`clear()` 不复位 token 计数。
3. 同 key 同载荷注册幂等；同 key 冲突载荷报错；不提供 replace API。
4. register / withdraw 幂等；单值 group 保留；新增只给内部 adapter 使用的精确 runtime tag 倒排索引与批量撤出。
5. 统一维护 byType、bucketType、group、tag 索引，修复同 key 换 event type 的旧 bucket 残留。
6. 保持现有 Effect、once 顺序、RevealEngine、ConditionDepIndex、Datapack 懒加载与领域状态不变。

## 关键测试场景

- register 同 key/同载荷重复调用：一个有效 Registration、一个候选。
- 相同 key 不同载荷：报错；显式 withdraw 后再 register 才创建新 token。
- withdraw 重复调用安全 no-op；withdraw 后重新 register，下一事件正常响应。
- A 在同一事件中 withdraw B：B 不执行。
- A withdraw B 并立即同 key 重注册 B：旧 dispatch candidate 不执行新 Registration；下一事件才可执行。
- `withdrawByTag(X)` 撤出所有且仅有精确 tag X 的注册；多 tag、多 registration 情况正确。
- 同一个 TriggerId 的两个 Registration 可同时存在；撤出其中一个不影响另一个，二者共享逻辑 once 身份。
- 同一事件候选快照包含同 TriggerId 的两条 Registration 且 once=true 时，最多执行一次；第一条提交 once 后，第二条在现有逐候选 once 检查处跳过。此项保护 1:N 与既有 once 的交叉行为，不改变 once 提交时序。
- group unmount 撤出该 group 的 Registration，不误伤其他 group 下同 TriggerId 的 registration；每个 Registration 只属于一个 group。
- group 和 tags 双索引在 register/withdraw/group withdraw/tag withdraw 后一致。
- 同 key 更改事件类型时旧 bucket 清除；任一撤出入口均无 stale id。
- Registration Task 不改变 once 提交顺序与进度结构；token 不冒充 once 身份。
- EventBus listener 数量不随单条 Registration 准入/准出增长。

## Task A 首期裁定（已实施）

| 问题 | 已实施语义 |
| --- | --- |
| TriggerId 与 Registration 数量关系 | `TriggerId : Registration = 1:N`；同逻辑 once 身份可由多 Registration 共享 |
| Registration identity | `(RegistrationKey, RegistrationToken)` |
| RegistrationKey | EB-T 当前有效集内全局唯一、可重复使用的 runtime slot |
| Token | TriggerSystem 实例生命周期内单调递增；`clear()` 不复位 |
| 同 key 已存在 | 相同注册请求幂等；冲突载荷报错 |
| Replace | 首期不提供；withdraw 后重新 register |
| Group | 每条 Registration 单值 group；多 owner 创建多条 Registration，不做 ref-count |
| Runtime Tag | 不透明、精确匹配、可多值；EB-T 不做层级处理 |
| Tag 作者面 | 首期只允许内部领域 adapter，Datapack/TriggerDef 不新增字段 |
| Post-fire / once / in-flight | 从 Registration Task 拆出，留给独立 Execution / Commit Semantics 切片 |

以上首期裁定已由 Task A 实施并验收；实现和测试证据见 [[task-0144-trigger-runtime-registration-withdrawal]]。规范 descriptor 仅比较规范结构，不推断任意 TriggerDef 的语义等价。

## 后续裁定

- 当前 per-Init `triggersCompleted` 对全局 Trigger 的产品语义是否保留。此项不阻塞 Registration API，但会影响 Milestone/领域消费者。
- 通用 Effect success/partial/failure、once commit、in-flight 防重和 post-fire 仍可另立执行语义范围；Reveal 不应因此承担通用 Effect transaction 改造。
- Reveal 首个消费者按本节施工顺序先完成只读 Condition/Event Coverage Audit，再裁定 Domain Model、窄 Typed Action、adapter 与并行验证。

## 当前核验（2026-09-24）

- Task A 于 2026-09-24 完成；`npm test`（188 files / 1748 tests）、类型检查、架构检查、文档检查均通过，完整结果见归档 Task。
- 本轮按源码复核 Reveal 边界并加入并行 EB-T-Reveal 目标行为：Visibility、Reveal、Unlock 分轴；Reveal Watch 与 Registration 分层；进度提交是事实点，Registration 是可重建投影。
- 当前 Reveal 条件的事件唤醒覆盖、RevealProgress 持久 scope 与 typed RevealAction 执行契约仍待后续 Task 核验/裁定。

## 剩余工作

- Task A 已完成并归档：[[task-0144-trigger-runtime-registration-withdrawal]]。
- 下一切片是 [[task-0145-reveal-condition-event-coverage-audit]]：只读完成 Reveal Condition/Event Coverage Audit，不修改源码；其结果再作为 Domain Model 与 Watch 唤醒方式的依据。
- 后续 typed Action 只实现 Reveal 所需的受控调用与最小结果契约；通用 Effect transaction 保持独立范围，不回写 EB-T Registration 语义。
- 当前请求仅把评审收敛加入目标行为草案，未开始 Reveal 实施或 Condition/Event Coverage Audit。

## 相关路由

- [[draft-0142-trigger-gameplay-packaging]]
- [[draft-0136-story-trigger-catalog-and-scoped-mounting]]
- [[draft-0137-story-entry-reactions-sol-review-and-decision]]
- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/03-data-structures/player-state]]




