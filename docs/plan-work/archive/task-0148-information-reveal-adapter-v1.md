# Task：Information Reveal Adapter v1

状态：done — Save Progress、Reveal 域与 EB-T Adapter 已落地，运行时接线由 Task 0149 完成（2026-09-25）

## 目标

按 [[task-0146-reveal-domain-model-v1]] 的领域合同，建立 Save 范围的 Information Reveal 已知事实、Reveal 域的 desired Watch 推导和首期 Reveal ↔ EB-T Adapter。由 Reveal 域负责准入求值、进度提交与 reconcile；EB-T 只提供 0..N 运行期唤醒源。完成后用源码、测试和运行时边界证据验收，不把旧 UI 消费者迁入本 Task。

## 设计边界

- `existence` 保持动态 Visibility；`unlock` 保持实时可达性。Information Progress 只含定义声明的 `name`、`condition`、`utility` 等信息 target；`RevealStage` 不落盘。
- 领域身份为 `(entityKind, entityId, target)`；StoryEntry 使用 EntryId。Progress 属于当前 Save，跨 Init/Run 保留；Watch 只属于当前已应用内容与当前 Init admission。
- 同一 target 的多个 gate 按 OR 合成一个完整求值责任；ConditionSystem 保留 AND/OR 真值。首期无显式 prerequisite 内容，领域推导保留受限的同实体 target prerequisite 能力，但本 Task 不新增 Datapack DSL。
- 首期 reactive 仅覆盖 `resource`、`spotLevel`、`hasReadStory`、`hasReadStoryInRun`；`stat`、`hasEnh`、`countTags` 只在 admission/reconcile 求值，不宣称持续响应。不得使用 tick 轮询、VisibilityEngine 或 ConditionDepIndex 充当监听后门。
- 先物化唤醒源，再从当前完整状态 admission-evaluate；真值成立后经 StateMutationService 幂等提交 Progress，随后 reconcile 并撤出多余注册。失败时 Progress 不变，Watch 可重建。
- Init 的 `initEntered` 早于默认 Area 等准入状态稳定；必须接入 post-admission reconcile，不能仅靠该事件。
- 不新增存档迁移、通用 Condition→Event 编译器、Event catalog 新事件、UI 迁移、旧 Reveal 下线、Init 生命周期顺序修复或 Schema/Datapack 字段。

## 当前事实与代码落点

| 已核实事实 | 位置 |
| --- | --- |
| 当前 `PlayerState` 尚无 Information Reveal Progress；SaveData 持有 PlayerState | `src/arona-clicker/types/state.ts`、`src/arona-clicker/contracts/save-data.ts` |
| 状态写入集中于 StateMutationService；初始状态由 state-factory 建立 | `src/arona-clicker/state/state-mutation-service.ts`、`state-factory.ts` |
| TriggerSystem 已有 `register`、`withdraw`、group/tag 与独立 Registration identity | `src/engine/effect/trigger-system.ts` |
| InitService 的 `initEntered` 先于默认 Area 写入 | `src/arona-clicker/services/init-service.ts:216` |
| 现有 UI 在 `tooltip-reveal.ts` 即时求值，尚未消费持久 Progress | `src/ui/components/tooltip-reveal.ts` |

本仓库当前存在大量与本 Task 无关的未提交改动。各 Unit 须保留其原貌，不得借本任务清理或重写。

## 施工切片

### Unit 0148-U1：Save Progress 与写入口

#### Goal

建立可序列化、幂等的 Information Reveal Progress，限定为当前 Save 的信息事实；不接入监听。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 裁定 | [[task-0146-reveal-domain-model-v1]] §领域事实与身份、ProgressScope | 锁定事实语义 |
| 规范 | [[docs/docs-828/01-architecture/state-layers]]、[[docs/docs-828/04-mechanisms/state-mutation]] | 状态层和单一写入口 |
| 源码 | `src/arona-clicker/types/state.ts`、`state/state-factory.ts`、`state/state-mutation-service.ts`、`contracts/save-data.ts` | 字段、初始化、提交与保存 |
| 测试 | 现有 state/save 相关测试 | 沿用项目测试样式 |

#### Context Budget

目标 10k–25k tokens；只读上述正文、目标源码与必要测试，超出时停止并报告。

#### Optional Read Set

- `src/arona-clicker/runtime-save-codec.ts`：仅当默认 Save codec 对新字段有显式白名单时读取。

#### Do Not Read by Default

- 其他 `docs/plan-work/archive/**`；UI 与编辑器目录。

#### Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| PlayerState 尚无进度字段 | `src/arona-clicker/types/state.ts:27` |
| SaveData 保存 PlayerState | `src/arona-clicker/contracts/save-data.ts:8` |

#### Constraints

- 遵守 [[docs/docs-828/05-conventions/architecture-discipline]]；不写存档迁移。
- key 不含 EB-T token、RegistrationKey 或事件类型；定义缺失或 target 未声明时不提交；重复提交为 no-op。

#### Allowed Files

- `src/arona-clicker/types/state.ts`
- `src/arona-clicker/state/state-factory.ts`
- `src/arona-clicker/state/state-mutation-service.ts`
- tests/engine/information-reveal-progress.test.ts（本 Unit 新建）

#### Explicit Non-goals

- 不挂载 Watch，不更改 UI，不修改 InitService 或 TriggerSystem。

#### Stop Conditions

适用 [[docs/ai/PROJECT-CONSTITUTION]] 六项停止条件；若保存路径需修改白名单外文件，先报告，不自行扩围。

#### Completion Criteria

- [x] 字段可序列化、默认值明确；字段位于 PlayerState Save 层，不进入 InitSnapshot。跨 Init/Run 行为留待 U3 集成测试。
- [x] 状态写入方法验证领域 key，重复提交幂等，并有定向测试。

#### Verification

npx vitest run tests/engine/information-reveal-progress.test.ts；`npx tsc --noEmit`。

### Unit 0148-U2：Reveal 域推导与 Wake Profile

#### Goal

建立独立 Reveal 域服务，从当前 Registry、Save Progress、Init 与受限 prerequisite 推导目标状态和 desired Watch，并给出可审计的 WakePlan；不注册 EB-T、不接运行时生命周期。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 裁定 | [[task-0146-reveal-domain-model-v1]] §Prerequisite、RevealWatch、Wake Profile | 唯一未来设计合同 |
| 规范 | [[docs/docs-828/02-modules/visibility]]、[[docs/docs-828/02-modules/expression]]、[[docs/docs-828/05-conventions/architecture-discipline]] | 现行模块边界 |
| 源码 | `src/data-services/registry/registry.ts` 的实体 getter/归属查询；`src/engine/contracts/reveal.ts`；`src/engine/expression/condition-system.ts`；U1 的 `src/arona-clicker/types/state.ts`；`src/arona-clicker/state/snapshot.ts` 的 Enhancement 归属函数 | 定义、Condition、Progress 与缺省归属 |
| 测试 | `tests/engine/reveal.test.ts` 与 U1 测试 | 既有约定和事实语义 |

#### Context Budget

目标 15k–30k tokens；只读上述目标符号及所需实体合同，超预算停止报告。

#### Optional Read Set

- `src/data-services/contracts/story-entry.ts`、`world.ts`、`enhancement.ts`、`item.ts`：按遇到的实体归属字段精确读取。

#### Do Not Read by Default

- 其他历史 Task、UI/编辑器源码与整个 Registry 实现目录。

#### Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| ConditionSystem 提供 `evaluateExpr`，支持完整 Condition/ConditionGroup | `src/engine/expression/condition-system.ts:107` |
| Registry 分开维护 active/passive StoryEntry，合并 `storyEntries` 为只读视图 | `src/data-services/registry/registry.ts:703` |
| Progress 字段与三元 key 已由 U1 提供 | `src/arona-clicker/types/state.ts` |
| 未声明 attachment 的 Enhancement 在现行快照分层中按 local 处理 | `src/arona-clicker/state/snapshot.ts:24` |

#### Constraints

- 同一实体同 target 的多个 gate 为 OR；不同 target 独立。无 gate 的声明 target 视为已知且不生成 Watch。
- 仅当前内容定义可解析、当前 scope eligible、尚未揭示且 prerequisite 满足时产生 desired Watch。定义卸载不清 Progress。
- Enhancement `attachment` 缺省时沿用当前 local 归属：仅在 active Init 中准入 Watch，Lobby 无 Watch；有 `init`/`area` 归属时依其 ID 与当前 Init 匹配，有 `global` 归属时在任一 active Init 可准入。此规则只决定 WatchScope，不改变 Save Progress。
- prerequisite 仅支持同实体内已声明的信息 target 的 AND 列表；当前内容为空。自引用、缺失引用或循环 fail-closed 并给出诊断，不增加 Datapack DSL。
- 复杂 gate 的 wake sources 为所有叶子的并集；四种 reactive 条件必须有精确状态来源/过滤范围。只要有未覆盖的 activation leaf，整个 Watch 不能标 complete reactive；`stat`、`hasEnh`、`countTags` 返回 AdmissionOnly。
- 不把事件类型、RegistrationKey、token 或 group 放入领域身份。

#### Allowed Files

- src/arona-clicker/services/information-reveal-domain.ts（新建）
- tests/engine/information-reveal-domain.test.ts（新建）

#### Explicit Non-goals

- 不修改 PlayerState、StateMutationService、TriggerSystem、Event catalog、Runtime、InitService、UI、Datapack 或 Schema；不生成运行时 Registration。

#### Stop Conditions

适用 [[docs/ai/PROJECT-CONSTITUTION]] 六项停止条件。若现行定义没有 prerequisite 字段，使用领域输入的空列表/受限可选映射，不改 Datapack；若无法确定某实体的当前 scope，先报告证据与问题。

#### Completion Criteria

- [x] 域查询能区分 unresolved、prerequisite 未满足、无 gate 已知、Progress 已知、待求值 gate；key 使用 StoryEntryId。
- [x] desired Watch 包含完整 gate、scope、prerequisite basis 与 WakePlan；覆盖全部七类实体与七种实际内容 ConditionTarget。
- [x] 同 target OR、嵌套 AND/OR、缺失/非法 prerequisite、卸载保留 Progress、Init/Registry scope 变化有定向测试；运行时重建留待后续集成验证。

#### Verification

npx vitest run tests/engine/information-reveal-domain.test.ts；`npx tsc --noEmit`。

### Unit 0148-U3：EB-T Adapter、生命周期与成功边界

#### Goal

建立 Reveal 专用的窄 typed runtime action 边界，并实现独立 Adapter，把一个 desired Watch 物化为 0..N EB-T Registration；运行时生命周期接线另作为本 Task 的后续施工切片。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 裁定 | [[task-0146-reveal-domain-model-v1]] §RevealWatch、准入提交顺序；[[draft-0143-trigger-runtime-registration-withdrawal]] §后续目标行为草案 | Domain/EB-T 边界与 opaque handle |
| 规范 | [[docs/docs-828/02-modules/effect-trigger]]、[[docs/docs-828/04-mechanisms/trigger-effect]]、[[docs/docs-828/05-conventions/architecture-discipline]] | Trigger 行为边界 |
| 源码 | `src/engine/effect/trigger-system.ts` 的 register/withdraw/dispatch；U2 的 `src/arona-clicker/services/information-reveal-domain.ts`；`src/arona-clicker/state/state-mutation-service.ts` 的 Reveal 写入口 | Action、Watch 与提交 |
| 测试 | `tests/engine/trigger-system.test.ts`；U1/U2 定向测试 | 兼容现有 dispatch 语义 |

#### Context Budget

目标 20k–35k tokens；若实施需超过 5 文件或 500 行净改动，停止并由我拆新 Unit。

#### Optional Read Set

- `src/engine/core/event-bus.ts`：仅在事件订阅/重入测试需要时读。

#### Do Not Read by Default

- UI、Datapack 编辑器、其他 Effect/Trigger 实现目录与无关历史计划。

#### Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| TriggerSystem 已有 Registration key/token 与 dispatch 重验证；普通 `fire` 先提交 once 再运行 Effect | `src/engine/effect/trigger-system.ts` |
| 当前 TriggerDef 只有 `Effect[]`，没有受限领域 Action | `src/engine/types/trigger.ts` |
| U2 返回完整 gate 与 WakePlan，尚不求值或注册 | `src/arona-clicker/services/information-reveal-domain.ts` |

#### Constraints

- Action 仅经 runtime Registration 携带 `{kind:'reveal', handle}`；不加 Datapack/TriggerDef 字段，也不暴露任意 callback 给内容作者。TriggerSystem 只按类型交给受控 handler，不理解 Reveal key 或 Progress。
- Adapter 私有保存 Watch↔Registration 与 opaque handle↔Watch 映射；Registration key/token 不进入 Save。生成的 Reveal Registration 使用 `once:false`，不得消费 `triggersCompleted`。
- EB-T 事件只唤醒，Adapter 必须用当前完整 state 与 ConditionSystem 重评整个 OR/AND gate，再经 StateMutationService 幂等提交；Action 只在提交成功后返回 typed success。
- reconcile 顺序为先物化来源，再 admission 求值、提交事实和撤出。无条件分支在 admission 直接为真；AdmissionOnly 每次显式 reconcile 求值，false 时不保留保证实时的 Registration。
- scope/定义/Progress 变化撤出旧 Registration；重入与重复事件不得重复提交。任何错误不得清除已提交 Progress。

#### Allowed Files

- `src/engine/effect/trigger-system.ts`
- src/arona-clicker/services/information-reveal-adapter.ts（新建）
- `tests/engine/trigger-system.test.ts`
- tests/engine/information-reveal-adapter.test.ts（新建）

#### Explicit Non-goals

- 不修改 Runtime/InitService/内容 Apply/读档接线、UI、Event catalog、Datapack、Schema、EffectEngine 普通执行与 once 时序。

#### Stop Conditions

适用 [[docs/ai/PROJECT-CONSTITUTION]] 六项停止条件。若 typed action 无法仅凭这些文件实现或净改动超 500 行，停止并提交已确认事实，由我拆分。

#### Completion Criteria

- [x] typed Reveal Action 不影响普通 Trigger 的 Effect/once 路径；无 handler/失败时不报告成功。
- [x] 一个 Watch 可物化多个精确过滤 Registration；事件唤醒重评完整 gate，提交成功后撤出所有相关 Registration。
- [x] 首次 reconcile 订阅后求值；AdmissionOnly、无条件 gate、重复提交、撤出/重建和重入均有定向测试。

#### Verification

npx vitest run tests/engine/trigger-system.test.ts tests/engine/information-reveal-adapter.test.ts；`npx tsc --noEmit`。

## 测试与验收

- 各 Unit：定向 vitest 与 `npx tsc --noEmit`；跨模块完成后运行 `npm test`、`npm run check:architecture`、`npm run check:docs`、`npm run build`。
- 行为用例：Save/Init/Run 保留与重置、定义缺失/卸载、重复提交、同 target OR 与嵌套 AND/OR、多 source 唤醒、精确 ID 过滤、订阅与准入竞争、撤出/重建、post-admission、AdmissionOnly 不承诺实时响应。
- 我复核 Luna 的改动和 Execution Receipt，检查白名单、现有脏工作树、断言覆盖和测试结果；不以 Receipt 代替实际验证。

## 当前核验（2026-09-25）

- 已阅读 Task 0146 的领域裁定、Read Set 路由、状态层、Visibility/Trigger 模块卡片及目标源码入口。
- U1 由 Luna 实施；我已复核白名单内改动并独立重跑进度定向测试（6/6 通过）及 `npx tsc --noEmit`（通过）。Progress 位于 Save 层，跨 Init/Run 的运行时集成验证留待 U3。
- U2 曾因 Enhancement 缺省 attachment 的 WatchScope 未定而按停止条件暂停，未修改文件；已依据 `state/snapshot.ts` 的 local 分类补充裁定与 Read Set。U3 尚未执行；跨模块机器验证待施工后记录。
- U2 由 Luna 实施；我独立重跑 U1/U2 定向测试（13/13 通过）与 `npx tsc --noEmit`（通过），并复核无 gate、global Spot、StoryEntry 空 scope 与 Run 内 invalidation。U3 尚未执行。
- U3 由 Luna 实施；我指出初版未按 Registry 重验提交的缺口，修订版已补齐并独立重跑 Trigger/Adapter 定向测试（26/26 通过）与 `npx tsc --noEmit`（通过）。运行时接线转入 [[task-0149-information-reveal-runtime-lifecycle]]。
- Task 0149 接线完成后，全量 Vitest 194 文件 / 1777 测试通过；`npm run build`、`npm run check:architecture`、`npm run check:docs`、`git --no-pager diff --check` 均通过。当前机制文档已同步并行 Information Reveal 路径。

## 剩余工作

工程与验证已完成；本 Task 归档后按仓库协议维护 AOCI 受影响条目。旧 UI Reveal 消费者迁移不属于本 Task。

## 相关路由

- [[task-0146-reveal-domain-model-v1]]
- [[task-0145-reveal-condition-event-coverage-audit]]
- [[task-0144-trigger-runtime-registration-withdrawal]]
- [[docs/docs-828/02-modules/visibility]]
- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
