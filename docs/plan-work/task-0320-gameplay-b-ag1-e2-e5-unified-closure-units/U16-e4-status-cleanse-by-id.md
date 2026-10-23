# Unit 0320-U16：E4 按精确 Status ID 清除状态

## Goal

为 Map Effect Program 增加最小、可重放的状态清除操作：对已解析的 `source` 或单位 `primary`，按一个已声明的 Status ID 清除该单位持有的全部匹配 Encounter-local Status 实例。沿用现有 MapRun Status Owner、detached 整轮计划、AG-1 Receipt 重放与 Save/Resume；不引入状态分类、层数消费或反应系统。

本 Unit 只交付精确 ID 清除首片，不代表 E4 的 Shield、Revive、Modifier、Trigger 或跨 Encounter Status 已完成。

## 前置依赖与版本边界

- 必须等待 U14 和 U15 完成；不得与 U14/U15 并行修改 MapRun Owner 或 AG-1 Restore。
- U14 当前冻结 scheduler v3→v4、受影响测试 Map 的 `resumeVersion` 4→5；U15 依赖 U14，再计划将 scheduler v4→v5、测试 Map `resumeVersion` 5→6。开工前以 U14/U15 最终 Receipt 与源码复核；若 U15 最终不是 scheduler v5 / 测试 Map `resumeVersion: 6`，停止并先修订本 Unit，不套用实现进行态的版本。
- `statusRemove` 不增加 scheduler start snapshot 输入或来源排序字段，因此本 Unit 保持 U15 最终 scheduler 格式（当前计划 v5），不再升 scheduler version。仅包含新操作的测试 Map 从 U15 完成后的 `resumeVersion: 6` 升为 7；只提升实际受影响的 fixture / 示例。
- Status 专用 Receipt 升为 `statusReceiptVersion: 2`，增加可独立核验的 Status Remove Trace；沿用 `programReceiptVersion: 1`，参照 Task 0318 对 Status 证据单独版本化的边界。不得把 Status Receipt 版本复用成 scheduler version。
- Restore 继续通过 AG-1 scheduler 全量重放。独立 `map-effect-receipt-validator.ts` 属于 E1/legacy 路径，不纳入 U16；若 AG-1 Status Remove 无法由 scheduler 重放闭环，停止并交 Task Owner 扩展白名单。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 项目入口 | [[AGENTS.md]]、[[docs/ai/PROJECT-CONSTITUTION]] | Unit 白名单、预算、停止条件 |
| 架构与验证 | [[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/testing]]、[[docs/docs-829/05-conventions/schema-sync]] | MapRun 唯一 Owner、Schema 与行为验证 |
| 机制基线 | [[docs/plan-work/task-0318-gameplay-b-encounter-statuses]]、[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]] §P4/§P7 | Encounter-local burn/regen 与待裁定 E4 范围 |
| 上游合同 | [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14-e2-additional-target-runtime]]、U14 Receipt、[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U15-e3-maprun-fact-gated-static-pools]]、U15 Receipt | 串行 scheduler 与 Map `resumeVersion` 前置核实 |
| 作者合同 | `gameplay-map-effects.ts` Status statement；`gameplay-map-effect-syntax.ts`、`gameplay-map-effect-context.ts`、Registry | 复用闭合 AST、目标范围与 Map-local Status 声明 |
| Runtime | `map-effects.ts`、`map-run.ts`、`runtime.ts`；`map-effect-planner.ts`、`map-encounter-statuses.ts`、`map-run-service.ts`、`runtime-game-instance.ts` | Status identity、Planner 顺序、Owner 安装、Restore 与 RecentCommit ReadModel 投影 |
| 定向测试 | Effect Syntax/Registry/Planner/Program Commit、AG-1 Commit/Restore、Status example 与 Schema sync 测试 | 覆盖语法、原子计划、Receipt 重放、版本拒绝 |
| 作者文档 | [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/examples/gameplay-b-statuses]] | 更新 Status 作者说明与正式示例 |

不默认读取 `docs/plan-work/archive/**`、AC Effect/Trigger 实现目录或无关 UI。读取超出上述路径且会改变合同的事实时按停止条件上报。

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–30k tokens；限 Status Remove 的作者、Planner、Owner 和 Restore 闭环 |
| 文档 Read Set | 5 篇/节；只读列出的当前 Task、0318 与规范 |
| 历史文档 | 0 篇 |
| 超预算处理 | 按下列串行切片施工；不以扩大 Read Set 代替拆分 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Encounter-local Status 只接受 Map 声明的 `burn`/`regen`，`statusApply` 目标限 `source` 或 `primary` 单位。 | `gameplay-map-effects.ts` Status AST；`map-effect-planner.ts` statusApply 分支 | 新操作沿用单位目标和 Map-local ID |
| Status 身份由 holder、Status ID、来源身份和 Action ID 构成；相同来源重施叠层并刷新时长，不同来源独立。 | `map-effects.ts` MapEncounterStatusInstance；`map-encounter-statuses.ts` statusIdentityKey | Remove 可覆盖同一 holder/statusId 下的多个来源实例 |
| roundEnd 按 holder roster、Status ID、稳定 source key、Action ID 排序，并以独立 Status Trace 重放 HP/时长变化。 | `map-encounter-statuses.ts` applyMapEncounterStatusRoundEnd / validateMapEncounterStatusTrace | Remove Trace 要能核对删除身份和后续列表 |
| AG-1 Restore 从 scheduler start snapshot 重建计划；Status 证据独立使用 `statusReceiptVersion`。 | `map-run-service.ts` restoreAg1EncounterCommitReceipt；Task 0318 | 不另造独立 Validator |

## Frozen Contract

### 作者形状与适用范围

- 新增闭合 statement：`{ op: 'statusRemove', target, statusId }`。
- `target` 仅允许现有 `GameplayMapEffectUnit` 中的 `source` 或单位 `primary`。Actorless Ability/Item 只能使用单位 `primary`；不合成 source。
- CardRef、Team、`additionalTarget`、TargetSet、`loopTarget`、`loopTargetActor` 均不适用；不得自动选目标。
- `statusId` 必须引用所属 Map `statuses` 中已声明的精确 ID；不支持前缀、类别或 Tag 匹配。
- 本 Unit 只在 AG-1 MapRun Effect Program 路径交付。E1-COMPAT-1/legacy 独立 Validator 路径不因此获得新操作。

### 清除行为

- statement 执行时，在 detached Status 列表中删除：holder 与已解析单位身份完全一致，且 `statusId` 完全一致的全部活动实例。Status 的来源身份和 Action ID 不限制清除范围。
- 不匹配的实例保留身份、顺序和值；无匹配是成功 no-op，仍记录 statement 访问及空 removed list。
- 一个 Program 内严格按语句顺序改 detached 列表：前序 `statusApply` 可由后序 `statusRemove` 清除；反向次序则最终保留后施加的实例。
- 清除不改 HP、费用、资源、Counter/Flag、Status 层数或其他 holder，也不产生触发事件。roundEnd 仅处理清除后仍在列表中的实例。
- 单位身份沿用来源计划已解析的 source/primary；不 fallback 或重选。AG-1 对 defeated source、显式目标锁定和终局 skip 的既有规则保持。清除不是 HP 操作，不复活单位。
- `statusRemove` 作为普通 resolve statement 计入现有静态/动态访问预算。超预算、后续语句错误、过期 token 或 Owner 安装失败时整轮拒绝；不得部分安装 HP、Status、资源、费用、库存、Facts 或 RNG。

### Trace、Receipt 与恢复

- 通用 Effect Trace 记录来源 Action、effectPath、语句访问顺序、holder identity、精确 Status ID 和访问结果。
- Status 专用 Receipt v2 增加 `statusRemoveTrace`。每条访问记录执行前的 holder/Status ID 和删除实例身份；removed list 按现有 roundEnd 稳定顺序（holder roster、Status ID、source key、Action ID）给出完整被移除实例和原列表位置。无匹配也记录空列表。
- `plannedStatuses` 与现有 `statusTrace` 继续表示本轮 roundEnd 后的计划结果。Restore 从 scheduler start snapshot 重跑真实 AG-1 Planner，并比较 Effect Trace、Status Remove Trace、planned Status、roundEnd Trace 与最终 Encounter/Run 状态；不直接安装 Receipt 中的 removed list。
- Save/Resume 继续验证活动 Encounter Status 的定义、holder、source、Action 和时间字段；对 AG-1 Status Receipt 严格接受 v2、拒绝 v1 与未知版本，不写迁移器。E1/legacy 的 statusApply 与 v1 Status Receipt 路径保持原样，本 Unit 不把 AG-1 格式拒绝扩展到旧执行路径。
- 本 Unit 不新增 scheduler start snapshot 输入；`schedulerFormatVersion` 保持 U15 最终版本（当前计划 v5）。若 U15 Receipt 最终版本不同，按前置门槛停止修订本 Unit。
- `programReceiptVersion` 保持 1，Status 专用字段由 `statusReceiptVersion: 2` 闭合版本；Status 专用版本不得代替 Map `resumeVersion`。
- U16-E1 已将正式 Status 示例 `gameplay-b:map:status-example` 从 E1-COMPAT-1 切至 AG-1（为实际来源补齐 `agility` 字段），保留 `statusApply` 行为并展示新操作，`resumeVersion` 从1升至2。没有把 U15 gated-pool Map 的版本套用到该示例，也没有升级无关 Map；E1/legacy v1 兼容路径由 Save/Resume 回归测试单独固定覆盖。

## 串行施工切片与 Allowed Files

每个切片独立控制在 3–5 个实现文件、约 300–500 行净改动；按序完成，不能把中间态当作完整能力。

### A — 作者 AST、语法与上下文

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`
- `tests/data/gameplay-b-effect-normalization.test.ts`

完成：闭合 AST；拒绝未声明/非法 ID、非 source/primary 单位目标、额外字段和错误上下文；规范化保留顺序与字段。

### B — Registry 与 Schema

- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（只由 `npm run gen:schema` 更新）
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`

完成：合法作者内容通过 Registry；未知 Status ID 与不可达单位目标拒绝；Schema 生成同步，不手改生成文件。

### C — 纯 Planner 与 Status identity 校验

- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `src/arona-clicker/services/map/map-encounter-statuses.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`
- `tests/engine/gameplay-b-effect-program-commit.test.ts`

完成：跨来源实例全清、无匹配 no-op、apply/remove 前后顺序、预算失败原子拒绝与稳定 Status Remove Trace。

### D1 — MapRun Receipt、AG-1 Commit 与 Restore

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `tests/engine/gameplay-b-map-ag1-restore.test.ts`
- `tests/engine/gameplay-b-effect-save-resume.test.ts`

完成：AG-1 Receipt v2 与 U15 scheduler 起点闭环；成功 Commit 安装清除后的状态；Preview/失败/重试不变；Restore 重算并拒绝身份、顺序、目标、状态列表或版本篡改；E1/legacy Status Receipt v1 保持。

### D2 — RecentCommit ReadModel 投影

- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `tests/ui/gameplay-b-effect-workspace.test.ts`

完成：ReadModel 的 Commit Preview 与 RecentCommit 允许 AG-1 Status Receipt v2；RecentCommit 按深冻结投影 `statusRemoveTrace` 的目标、原列表位置与完整删除实例，不改 UI 玩法或 Live Owner。只读投影测试覆盖版本与 trace，E1/legacy Receipt v1 行为仍保持。

### E1 — 正式 AG-1 示例

- `src/arona-clicker/content/gameplay-b/gameplay-b-status-example.ts`
- `tests/engine/gameplay-b-effect-example.test.ts`
- `tests/data/gameplay-b-map-registry.test.ts`（仅把 status-example 固定 resumeVersion 预期更新为2）

完成：正式 Status Map 从 E1 切至 AG-1、`resumeVersion` 1→2；保留 `statusApply` 行为并展示目标 `burn` 精确全清及无匹配 no-op。

### E2 — 作者合同与 Draft 路由

- `docs/examples/gameplay-b-statuses.md`
- `docs/docs-829/03-data-structures/datapack-contracts.md`
- `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md`

完成：作者说明明确精确 Status ID 与清除全部来源实例；Draft §7 与 0320 P4/P7 在本 Unit 实施后同步。Task Owner 的 Unit Receipt、主 Task 与 `docs/plan-work/00-index.md` 不在施工代理白名单。

### E3 — AG-1 Action 元数据归一化兼容

- `src/data-services/normalization/gameplay-map-effect-program.ts`
- `tests/data/gameplay-b-effect-normalization.test.ts`
- `tests/engine/gameplay-b-map-relations.test.ts`

完成：有限 Effect Normalizer 将合法 Action 元数据 `agility` 视为已知字段；含 Status Program 的 AG-1 Action 在 Map Relation/Workspace 只读投影时不再报 unknown field。测试覆盖归一化一致性与关系投影，不改变调度或玩法语义。

### 施工控制

- 阶段 A→B→C→D1→D2→E1→E2→E3 串行。任一阶段超预算或要改白名单外文件时，先停并拆分/更新白名单。
- Task Owner 单独维护本 Unit、Receipt、Task 0320 与 `docs/plan-work/00-index.md`。
- 施工开工前复核 U14/U15 最终 Receipt 的 scheduler / resumeVersion；不从实现进行态推断版本。

## Explicit Non-goals / Defer

| 能力 | U16 裁定 | 后续依赖 |
| --- | --- | --- |
| 部分层数/来源消费 | 不纳入；只按 ID 全清。 | 冻结跨来源扣层优先级、部分扣层 Receipt 与归零删除规则。 |
| harmful/beneficial 类别净化 | 不纳入；不增加 Status 分类字段。 | 冻结 Status category 作者合同及匹配规则。 |
| Shield | 不纳入；不伪装为 HP 或 Status。 | 冻结额度/身份/上限/时长/到期及 damage→Shield→HP 顺序。 |
| Revive | 不纳入；普通 heal 和 Status 清除均不复活。 | 冻结适用阵营、恢复量、资格重验与本轮行动资格时点。 |
| Damage/Heal Modifier | 不纳入。 | 依赖 Shield 与实际伤害/治疗结果口径、修正顺序、舍入和 clamp。 |
| 受伤/受治/到期 Trigger 队列 | 不纳入；clear 不发事件，不重入来源。 | 冻结事件口径、触发身份、同源不可重入、链深与单 Commit 预算。 |
| 跨 Encounter/MapRun Status | 不纳入；维持 Task 0318 Encounter-local 生命周期。 | 冻结持久 Owner、Run 初始化/清理与版本化 Save/Restore。 |
| 独立 E1/legacy Status Receipt Validator | 不纳入。 | 只有明确要求 E1/legacy 接受新操作时另立 Unit；不得重复实现 AG-1 Restore。 |

Task 0320 P7 不得将上述项标为 E4 已完成；保留依赖或明确由后续 Task 承接。

## Stop Conditions

- U14/U15 仍施工、最终 Receipt 缺失，或 scheduler / resumeVersion 最终值与本 Unit 前置条件不同。
- Status 身份/顺序与 Task 0318 Restore 事实冲突，或需改 AG-1 scheduler start 输入、候选快照或 U15 行为。
- Clear 必须扩大到 additional/loop 目标、分类、层数消费、外部 Owner 或 EventBus 才能满足需求。
- 无法通过 AG-1 全量重放核验清除历史，或必须改独立 E1/legacy Validator 才能闭环。
- 需要修改 Allowed Files 外的代码/数据，或任何失败路径发生部分 Owner 安装。
- 必要验证失败或不可执行；遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件，不以默认值掩盖冲突。

## Completion Criteria

- [x] AST/Context/Registry/Schema 严格接受精确 Map Status ID 与 source/primary 单位目标；无效 ID、目标和额外字段拒绝。
- [x] Planner 对单一 holder/statusId 删除全部来源实例；保留其他身份/顺序；无匹配为 no-op；按语句次序支持同轮 apply/remove。
- [x] Status Remove Trace v2 与 roundEnd Trace/plannedStatuses 可由 AG-1 起点独立重算；身份、位置、版本或最终状态篡改被拒。
- [x] Preview、失败、过期、预算拒绝与恢复验证不安装部分变化；成功 Commit 后现有 ReadModel 反映活动状态列表。
- [x] 正式 Status 示例与作者文档更新；未使用该操作的既有 Status/Map 行为保持。
- [x] 定向测试、Schema 生成、类型、架构、文档与差异检查通过并记录实际结果。
- [x] U16 收尾明确列出本 Unit 不涵盖的 E4 提议；不声称 E4 整体完成。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 作者合同 | `npx vitest run --silent tests/data/gameplay-b-effect-syntax.test.ts tests/data/gameplay-b-effect-normalization.test.ts tests/data/gameplay-b-effect-registry.test.ts` | 合法/非法语法、目标与引用边界通过 |
| Schema | `npm run gen:schema`；`npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts` | 生成同步且无手改输出 |
| Planner/Commit/Restore/示例 | `npx vitest run --silent tests/engine/gameplay-b-effect-planner.test.ts tests/engine/gameplay-b-effect-program-commit.test.ts tests/engine/gameplay-b-map-ag1-commit.test.ts tests/engine/gameplay-b-map-ag1-restore.test.ts tests/engine/gameplay-b-effect-example.test.ts` | 计划原子、Receipt/Save/Restore 重放与示例通过 |
| 全局护栏 | `npx tsc --noEmit`；`npm run check:architecture`；`npm run check:docs`；`git --no-pager diff --check` | 退出码0；文档路径无新增错误 |

按项目地图入口完成直接影响范围的只读核对；不编辑 GALHCG、不刷新或写 freshness。
