# Task 0315：Gameplay B 旧卡牌内容迁移与旧效果系统移除

状态：completed — U01–U11（含 U03b、U05b、U05c、U06b、U07c）与收尾证据均完成；本 Task 不代表完整 E2 完成。

## 目标

将当前 Gameplay B 第一方 Map 卡牌内容迁移到新的有序效果程序与原语语义，并彻底移除 Action 旧 `effects` / `hpEffects` / `cardEffects` 作者字段及其专属兼容执行路径。完成后，卡牌作者只使用 `effectProgram` 表达局内资源、伤害／治疗、条件变化和准备期 sCost 折扣；行动费用、行动目标、卡牌引用和商店交易继续使用各自既有合同。

本 Task 只实现迁移现有内容所需的有限原语切片，不宣称完整 E2 完成。具体包括常量单主目标 `damage` / `heal`，复用 E1 已有的有序资源／Counter／Flag 效果与条件、CardRef 准备期折扣。集合、通用 Value、随机、repeat、Card Tag / Pool、Status、Shield、复活和跨卡修正仍在独立后续范围。

## 设计边界

- 本 Task 包含：盘点并迁移所有仍受支持的第一方 Gameplay B Action 内容与作者示例；为旧 HP 变化提供 `damage` / `heal` 新语义；迁移资源变化至有序 `resourceChange`，迁移 sCost 折扣至 `prepare`；删除 Action 旧字段、旧归一化分支、旧分相位执行路径、旧作者 Schema 支持及只证明旧模式可执行的测试。
- `damage` 与 `heal` 使用 `{ op: 'damage' | 'heal', target: 'primary', amount: positive safe integer }`；damage 扣减 HP，heal 增加 HP但不复活。HP 上下限继续由 Owner 账本处理。旧负 HP 量转成 damage 的正量，旧正 HP 量转成 heal 的正量；实际内容映射和有意变化逐 Action 登记在迁移矩阵中。
- 迁移必须按当前 `effectProgram` 顺序语义表达先后和条件，不复刻旧数组按类型分阶段的隐藏顺序。旧结果与新顺序有差异时，迁移矩阵需写明新结果、设计原因和接受该变化所需证据；不得保留旧分支来掩盖差异。
- Map Action 的 `costs`、`target`、`tendencyRole`、真实 Hand / CardRef / Owner 生命周期不改。准备期折扣仍只影响实际 CardRef 的 Actor `sCost`，不影响 PlayerCost。
- `GameplayShopOfferDef.effects` 是独立的商店交易合同，明确保留；本 Task 的旧 `effects` 移除仅指 `GameplayMapActionDef.effects`。
- 当前 Run 的存档不新增兼容迁移层。修改 Action 行为的 Map 按 `resumeVersion` 合同更新版本，并验证旧版本 Run 走现有失效／拒绝策略。
- 明确非目标：一次实现完整 E2 的集合、Value 与随机；改变 Owner 费用时序、自动目标、Enemy 调度、PlayerCost、存档格式或 Item 双 Owner 原子事务；迁移历史只读快照及归档内容。
- 已裁定来源：[[docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives]] §5–6 的 E1 与 E2 推荐语义；E1 实际施工和阶段边界见 [[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]。E1 于 2026-10-22 按用户要求跳过 U18 验收并阶段结项；本 Task 以当前源码为基线，不把豁免写成 E1 产品验收通过。

## Task 准入基线与代码落点

以下是 2026-10-22 开工时核对的基线，用于解释迁移范围；U01–U10 已将其中旧 Action 合同与执行路径移除。完成后的当前合同见 [[docs/docs-829/03-data-structures/datapack-contracts]] 与对应源码。

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `GameplayMapActionDef` 同时定义旧 `effects` / `hpEffects` / `cardEffects` 与新 `effectProgram`。 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapActionDef`、`GameplayMapActionHpEffectDef`、`GameplayMapActionCardEffectDef` | 迁移需从源类型移除 Action 旧字段；不可把商店 offer 的 `effects` 一并删除。 |
| 旧数组被归一化为带 legacy mode / phase 的共用叶项，Registry 仍检查旧输入，MapRun 执行仍保留旧阶段路径。 | `src/data-services/normalization/gameplay-map-effect-program.ts`；`src/data-services/registry/registry-validate.ts`；`src/arona-clicker/services/map/map-run-service.ts` | 系统移除必须覆盖归一化、作者校验和 Owner 运行分支，不只是迁移示例数据。 |
| 卡牌准备期折扣与真实 CardRef、Actor `sCost` 相连；E1 Program 已有准备期入口。 | `src/arona-clicker/services/map/map-card-effects.ts`；`src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`；E1 Unit U09/U10 | 保留 CardRef 与准备流程，将旧 `cardEffects` 内容改写进新准备期语义。 |
| 第一方 `gameplay-b-map-datapack.ts` 当前有 25 处 `hpEffects` 和 2 处 `cardEffects`；同文件还含 Action 资源效果及 Shop `effects`。 | `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`；`src/arona-clicker/content/gameplay-b/gameplay-b-effect-program-example.ts` | 逐一盘点 Map / Action / Shop 的字段归属；不能按字段名做全仓盲目替换。 |
| 该第一方文件声明的 8 张 Map 当前均为 `resumeVersion: 3`。 | `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts` 的 Map 定义 | Action 行为改写时逐图提升版本，并用现有 Save/Resume 规则验证旧 Run 失效。 |
| Runtime、Relation 投影、UI 摘要及保存 Receipt 类型仍会读取或携带旧字段。 | `src/arona-clicker/services/map/map-relation-projector.ts`；`src/arona-clicker/contracts/map/map-run.ts`；`src/arona-clicker/contracts/runtime/runtime.ts`；`src/ui/components/map/map-workspace.ts` | 移除旧投影和 Receipt 兼容字段，确保 Workspace 只呈现新 Program 的声明摘要与实际结果。 |
| 旧模式断言分布于 Registry、归一化、Planner、Prepare、MapRun、Save/Resume、投影和 UI 测试。 | `tests/data/gameplay-b-effect-normalization.test.ts`；`tests/engine/gameplay-b-effect-legacy-goldens.test.ts`；`tests/engine/gameplay-b-map-run.test.ts`；`tests/ui/gameplay-b-map-workspace.test.ts` 等 | 保留行为回归价值，但把有效场景改成新格式；旧输入只保留 Registry 拒绝断言。 |

## 施工切片

### P0：迁移清单与原语边界冻结

- 从当前 Registry 可装载的第一方 Datapack、作者示例和直接测试夹具建立逐 Action 迁移矩阵：原字段、原行为、目标 Program、新旧差异、覆盖测试、所属 Map 与 `resumeVersion`。
- 确认所有待迁移 HP 内容可由常量单主目标 damage/heal 表达；旧资源效果与准备期折扣可落入 E1 已有原语。若发现必须依赖集合或 Value 的内容，先调整 Task 边界和估算，不以本 Task 暗中实现完整 E2。
- 按 Draft §6 推荐冻结有限 damage/heal 作者节点、Registry 规则、零／非法数量处理和解释结果；不新增未裁定的目标选择或费用行为。

### P1：实现迁移所需的新 HP 原语

- 将 damage/heal 纳入有限 `effectProgram` AST、静态验证、规划器、Receipt / trace 与只读摘要；两者内部复用 Owner HP 账本，不直接写入真实状态。
- 覆盖当前 primary 身份、同轮倒地目标、HP clamp、0 实际变化、非法量和原子提交；heal 不复活。保持 Prepare、cost 预检、资源结算和 Enemy 先后调度边界。

### P2：迁移第一方内容和行为回归

- 将旧 HP、资源和 sCost 卡牌内容逐 Action 改写为新 Program，并同步作者指南及正式示例；适用 Map 的 `resumeVersion` 按现有合同更新。
- 将旧模式 goldens 改为以新 Program 输入的行为用例。只有语义本来相同的项目要求结果等价；语义因旧分相位改为显式顺序而变化的项目，按 P0 矩阵验证并记录新结果。
- 保留 `costs`、`target`、Action 来源、Hand、CardRef、商店和 Item 事务既有行为。

### P3：删除旧系统路径

- 从 Action 合同、Map Registry / 校验、Schema 与作者读取入口删除旧数组；从 normalizer / planner / Owner / 投影 / UI 摘要 / Receipt 恢复中删除 legacy mode、旧 phase 和旧字段兼容分支。
- 删除只验证“旧字段仍能成功运行”的测试与旧专用 helper；增加原始 JSON 含已废弃 Action 字段时的 Registry 拒绝覆盖。
- 按 [[docs/docs-829/05-conventions/schema-sync]] 运行 Schema 生成和同步验证；不得手改生成 Schema。清理后确认 Shop Offer `effects`、E1 prepare、E1 有序效果及存档校验仍正常。

### P4：机制文档与收尾验证

- 更新 `docs/docs-829/03-data-structures/datapack-contracts.md` 与受影响的 MapRun / UI Wiki 页面，说明 Action 只使用新 Program，并区分 Shop Offer 的 `effects`。
- 按 [[docs/docs-829/05-conventions/testing]] 对旧新调度、Registry 拒绝、Save/Resume、CardRef 准备、ReadModel / UI 直接影响范围进行严格行为验证；必要时做跨层审查。
- 完成后统一核对索引、文档检查、差异空白和 GALHCG 直接影响闭环；不将 U18 被豁免的 E1 浏览器验收改记为已通过。

## 测试与验收

- [x] 第一方 Map Action 与作者示例已移除旧作者字段；U04 Receipt 给出逐 Action 迁移矩阵、新 Program、新旧语义和证据。
- [x] `damage` / `heal` 采用常量 primary 与正安全整数；Owner 行为回归覆盖 HP 上下限、HP=0、无复活、目标身份及失败时不安装状态（见 U01–U03b Receipt）。
- [x] 旧 Action 字段已从源合同、生成 Schema、Registry、normalizer 与 Runtime 移除；U10 覆盖 first-party 与导入包对三个旧字段的精确拒绝。
- [x] Save/Resume Receipt、Relation / Workspace 投影不再携带旧数组专用字段或分支；Map Registry 回归证明 Shop Offer `effects` 仍有效。
- [x] 原行为回归已迁为新 Program，覆盖费用、顺序、目标、Enemy skip、HP / 资源、CardRef prepare 和交易边界；两条混合 Action 的新顺序和原因列于 U04 矩阵。
- [x] 八张受影响的内置 Map 与 E1 示例 `resumeVersion` 从 3 提升到 4；保存恢复回归验证旧版本按既有规则失效，不添加兼容迁移层。
- [x] Schema 生成与同步、定向行为测试、全局 TypeScript、文档和差异检查结果见 U01–U11 Receipt 与下方收尾记录。未执行真实浏览器验收；该项不属于本 Task 的完成门槛。

## Read Set 与验证入口

- 文档：[[docs/ai/context-packs/production]]；[[docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives]] §5–6；[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]；[[docs/docs-829/05-conventions/architecture-discipline]]；[[docs/docs-829/05-conventions/schema-sync]]；[[docs/docs-829/05-conventions/testing]]；[[docs/docs-829/03-data-structures/datapack-contracts]]。
- 源码：`src/data-services/contracts/gameplay-map.ts`（`GameplayMapActionDef`）；`src/data-services/normalization/gameplay-map-effect-program.ts`；`src/data-services/registry/registry-validate.ts`；`src/arona-clicker/services/map/map-run-service.ts`（规划、提交、恢复）；`src/arona-clicker/services/map/map-card-effects.ts`；`src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`；`src/arona-clicker/services/map/map-relation-projector.ts`；`src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`；`src/arona-clicker/content/gameplay-b/gameplay-b-effect-program-example.ts`；`src/ui/components/map/map-workspace.ts`。
- 测试：`tests/data/gameplay-b-effect-normalization.test.ts`、`tests/data/gameplay-b-effect-registry.test.ts`、`tests/data/gameplay-b-map-registry.test.ts`；`tests/engine/gameplay-b-effect-legacy-goldens.test.ts`、`tests/engine/gameplay-b-effect-planner.test.ts`、`tests/engine/gameplay-b-effect-card-prepare.test.ts`、`tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-effect-save-resume.test.ts`、`tests/engine/gameplay-b-map-source-transactions.test.ts`；`tests/ui/gameplay-b-effect-workspace.test.ts`、`tests/ui/gameplay-b-map-workspace.test.ts`。
- 施工时按实改文件选择定向 Vitest；字段 / AST / Schema 变化运行 `npm run gen:schema`、Schema 同步测试与 `npx tsc --noEmit`；跨层写入边界按影响运行 `npm run check:architecture`。不默认要求全量测试或浏览器验收。

## 工作量估算

约 **5–8 个工程人日**：迁移清单与原语边界 0.5–1 日，damage/heal 原语与校验接线 1–2 日，内容迁移及行为回归 1–2 日，移除旧类型 / Registry / Planner / 投影和 Schema 兼容 1–2 日，文档、Save/Resume 与跨层复核 1 日。估算不包含完整 E2 集合、Value、随机、Tag / Pool 或 Status；若 P0 发现活动内容实际需要这些能力，先拆出后续 Task 或更新估算。

## 施工单元

按依赖完成下列 Unit；具体白名单、Read Set、停止条件与验证见各 Unit。所有新内容与回归用例先迁至新格式，再关闭旧 Registry / Runtime 路径。

1. [[docs/plan-work/task-0315-units/task-0315-u01-damage-heal-syntax]] → [[docs/plan-work/task-0315-units/task-0315-u02-damage-heal-planner]] → [[docs/plan-work/task-0315-units/task-0315-u03-owner-installation]]。
2. U03 后，[[docs/plan-work/task-0315-units/task-0315-u03b-receipt-validation]]、[[docs/plan-work/task-0315-units/task-0315-u04-content-migration]]、[[docs/plan-work/task-0315-units/task-0315-u05-legacy-golden-migration]]、[[docs/plan-work/task-0315-units/task-0315-u05b-core-test-fixtures]]、[[docs/plan-work/task-0315-units/task-0315-u05c-program-test-fixtures]] 可在互不重叠文件上并行。U05 / U05b / U05c 的 Owner / Receipt 回归等待 U03b 完成；U04 Registry 验证只依赖 U01/U02。
3. [[docs/plan-work/task-0315-units/task-0315-u06-owner-legacy-removal]] 完成后，[[docs/plan-work/task-0315-units/task-0315-u06b-receipt-legacy-removal]]、[[docs/plan-work/task-0315-units/task-0315-u07-save-projection-removal]]、[[docs/plan-work/task-0315-units/task-0315-u07c-relation-projection-removal]]、[[docs/plan-work/task-0315-units/task-0315-u08-ui-removal]] 可在互不重叠文件上并行（U07c 另依赖 U05b 关系夹具迁移）；四者完成后依序执行 [[docs/plan-work/task-0315-units/task-0315-u09-author-contract-schema-removal]] → [[docs/plan-work/task-0315-units/task-0315-u10-registry-schema-verification]] → [[docs/plan-work/task-0315-units/task-0315-u11-regression-docs-closeout]]。

## 当前核验（2026-10-22）

- 已核对项目身份 `acprogram`、E1 阶段状态、Draft 0312 E2 推荐范围、Map Action 合同、归一化 / Registry / Owner / Prepare / 投影 / UI 直接落点与相关测试。
- 当前第一方 `gameplay-b-map-datapack.ts` 有 25 处 `hpEffects`、2 处 `cardEffects`；该文件还包含资源 Action effects 与 Shop Offer effects，需在迁移矩阵内区分。八张内置 Map 的 `resumeVersion` 均为 3。
- 用户要求由多个 Luna 子 Agent 协同完成。U01 语法 7/7、U02 Planner / Trace 12/12、U03 Owner 接线 19/19、U03b Receipt 校验 45/45、U04 内容迁移 / Registry 136/136、U05 金样与 Card Prepare 20/20、U05c Planner / Program 18/18、U05b 核心夹具 92/92、U06 Owner 移除 66/66、U06b Receipt 移除 48/48、U07 Save/Resume 移除 2/2、U07c Relation 移除 31/31、U08 UI 移除 29/29、U09 归一化 5/5 与全局 TypeScript 检查、U10 Registry / Schema 164/164、U11 文档收尾均完成。各 Unit 命令和文件详见 `docs/plan-work/task-0315-units/receipts/`。
- U04 将 8 张内置 Map 与 E1 示例迁至新 Program，`resumeVersion` 从 3 提升到 4；完整逐 Action 迁移矩阵及保留 Shop 合同的说明见 [[docs/plan-work/task-0315-units/receipts/task-0315-u04-receipt]]。两条混合 Action 明确采用 damage 后 resourceChange；其余纯 HP / 纯资源 Action 无跨通道顺序变化。
- U10 通过 `npm run gen:schema` 和 Registry / Schema 定向回归（3 个文件、164 项）；生成产物只删除旧 Action 字段并加入 `damage` / `heal` variants。U11 `npm run check:docs` 与全工作树 `git --no-pager diff --check` 均通过。全局 TypeScript 于 U09 通过；没有重复全量产品测试。
- 最终只读 GALHCG 检查重新确认项目身份为 `acprogram`，并对直接影响范围执行 `graph_health(check="changed")`。本 Task 未执行图写入、刷新或 freshness 更新。
- 当前共享工作树保留既有 E1 未提交改动；本 Task 不提交或清理这些改动。未做真实浏览器验收；UI 使用 U08 / U11 Receipt 所列自动化与 DOM 回归证据。

## GALHCG 影响闭环

- 发现路径：项目身份由 `graph_project(workspace_path=...)` 确认为 `project_id=acprogram`；图内查询 `Gameplay B effectProgram`、`cardEffects legacy GameplayMapActionDef` 无命中，随后回到当前源码与测试确认落点。
- 收尾健康管理：产品施工完成后对直接影响路径统一执行了 `graph_health(check="changed")` 只读复核；施工中未反复检查。Task 文档不授权改图、refresh 或写 freshness。
- 地图维护：本 Task 未执行语义图维护；直接影响路径检查结果与后续建议见 U11 Receipt。

## 剩余工作

- 本 Task 没有剩余施工 Unit。后续已完成切片见 [[docs/plan-work/task-0316-gameplay-b-effect-collections-and-values]]、[[docs/plan-work/task-0317-gameplay-b-static-tags-and-candidate-pools]]、[[docs/plan-work/task-0318-gameplay-b-encounter-statuses]] 和 [[docs/plan-work/task-0319-gameplay-b-prepared-tag-combo]]；AG-1 与其余 E2–E5 能力统一登记于 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]，不属于本 Task 结项范围。

## 相关路由

- [[docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives]]
- [[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]
- [[docs/docs-829/05-conventions/schema-sync]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/docs-829/05-conventions/testing]]
- [[docs/ai/context-packs/production]]
