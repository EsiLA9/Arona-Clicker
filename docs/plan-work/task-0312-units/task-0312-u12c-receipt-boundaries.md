# Unit 0312-U12C：回执校验最后边界验收

状态：completed — 本页仅保留施工计划；实际修改与验证结果以对应实施 Receipt 为准。
> 现行作者合同与迁移结果以 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 和对应 Receipt 为准；本页的旧字段与 legacy 执行说明只记录当时施工计划，不是当前作者入口。

## Goal与合同

完成父 [[docs/plan-work/task-0312-units/task-0312-u12-trace-validation]] 在U12B预算内未覆盖的四组真实Owner行为与独立篡改。唯一合同E1-COMPAT-1，不加AG调度、不削减OLD期望、不造历史Owner。先复述Goal/白名单/非目标/停止条件。

## Read Set

- AGENTS.md、PROJECT-CONSTITUTION；父U12、U12B实际Receipt。
- src/arona-clicker/services/map/map-effect-receipt-validator.ts当前API及纯校验链。
- tests/engine/gameplay-b-effect-test-fixtures.ts；gameplay-b-effect-receipt.test.ts现有真实Receipt上下文。
- tests/engine/gameplay-b-effect-program.test.ts及gameplay-b-effect-card-prepare.test.ts的对应合法CardRef/Enemy skip案例。
- map-run-service.ts中resolveEncounterCommitPlan、map-card-effects.ts的真实prepare/settlement逻辑；只读命中函数。

额外Read Set最多2文件，超过先报根。源码/合同不符、未知机制裁定、验证失败无法解释时停当前Unit报根。

## Allowed Files与预算

- 新增 tests/engine/gameplay-b-effect-receipt-boundaries.test.ts：四组真实Runtime/Registry/Variant/Owner fixture及独立篡改，预计300–450行。
- src/arona-clicker/services/map/map-effect-receipt-validator.ts：仅修本Unit复现的校验缺陷，预计0–80行净增，以B最终文件物理行数为基线。
- 新增 docs/plan-work/task-0312-units/receipts/task-0312-u12c-receipt.md：实际证据/边界，预计40–60行。

预计340–590行，负责人登记上限1000；需新增路径/超预算先报告，不压缩代码规避。不改B原测试、其它Unit、Owner恢复、生成物，不提交、不动.workbuddy、不写图。

## 必须完成

1. 旧cardEffects与program prepare同轮叠加并截原sCost，真实CardRef、实际执行zone、PlayerCost不减；同步篡改cost投影/receiver应拒绝。保留B已测的未选Hand receiver=null正例与未知candidate拒绝。
2. 被击倒/无目标/不可支付/已终局的Enemy程序来源不产生prepare/resolve visits；真实Owner可达fixture，拒伪造访问。先按实际planner选最小必需分组，不改E1调度。
3. 同账户program event之间夹Enemy实际cost，再有program event；验证每账户before/after链包含中间cost。同步平移第二事件before/after保持delta不变仍拒绝；纯legacy资源末值篡改不得漏验。
4. 合法HP ratio guard、clamp到0、HP0再变化actual delta0及嵌套then/else路径可被接受；独立破坏cap/ratio/实际delta/最终HP拒绝。先前已证明HP链不能因后续legacy治疗或跨活动角色HP保留误拒。

每个正例先真实提交并保存Owner生成Receipt，再只对副本篡改。父Run身份与当前末值从真实快照提供；新activity的初值不证明旧Receipt，不造完整历史状态，不重施成本/库存。

## Verification与完成标准

运行新boundaries、原receipt、effect-program、legacy-goldens定向测试，全局tsc、architecture、docs、diff空白；记录真实命令/数量/退出码，无skip/todo。完整A/B/C通过后根独立复核再放行U13。Receipt列实际修改/未完成、API能力与历史证明边界；GALHCG影响累计U19统一只读复核，不改图/refresh/freshness。
