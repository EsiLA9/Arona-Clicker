# Receipt 0312-U07

| 项 | 内容 |
| --- | --- |
| 状态 | U07 实施与指定验证完成，交负责人审查；不代表 E1 产品整体完成。 |
| 实际修改 | 修改 `src/arona-clicker/services/map/map-run-service.ts`（新增94行、删除59行、净增35行）与 `src/arona-clicker/services/map/map-card-effects.ts`（新增20行、删除7行、净增13行）；新增本 Receipt。旧金样 `tests/engine/gameplay-b-effect-legacy-goldens.test.ts` 未改，全部旧期望保留。 |
| 手写预算 | 开工估算约560行已向负责人报备；负责人登记本Unit手写净改动上限1000行。最终两份源码净增48行，旧金样改动0行。 |
| 未完成内容 | 无 U07 内剩余项。U08/U09/U10/U11 的 locals、Card prepare adapter、program commit 与 condition completion 仍按各自 Unit 实施。 |
| 范围外变更 | 无 U07 范围外改动；保留工作树里 U04/U05/U06 的未提交产物和文档。未提交 Git。 |
| GALHCG 影响闭环 | 只读身份确认 `project_id=acprogram`、根目录匹配；定向 path/source 查询并回读当前 map-run、map-card-effects、U05 normalizer、U06 planner/contract。直接影响服务路径及关系累积至 U19 统一只读复核；未改图、refresh 或写 freshness。 |

## 实际接线与旧接口

- `map-run-service.ts` 新增 `normalizeMapRunActionEffects`，把 U05 normalizer 的错误重新包装为公开 `MapRunError`，维持 Commit 错误类型。HP 适配 `applyHpEffects` 和资源/成本适配 `settlementChangesFor` 都直接调用 `planMapEffectSource`，不是仅导入。
- 旧 `action.hpEffects` 被 U05 规范化为 `hpChange(target: primary)`；`applyHpEffects` 根据来源只选匹配的 legacy phase 切片，把完整当前 party/enemy HP 与 cap 作为 detached input。HP 输出以 planner trace 的实际 `after/delta` 更新原 detached HP map，并映射成既有 `MapRunEncounterHpChange[]`；每条旧 HP 叶仍输出一项，包括实际 delta 为0的项目。对外 Settlement / Receipt / 投影格式不增加 program trace。
- 旧 `action.effects` 被规范化为 `resourceChange`。`settlementChangesFor` 仍原样计算旧 `costs` 与 sCost 折扣，再将共享 planner 的 resource ledger 映射回既有 `resourceChanges`：`sourceActor` / `primaryActor` 分别映射 `characterId` 或 `enemyId`，`sourceTeam` 映射现有 team scope 与 enemy `teamSide`。helper 不查余额、不支付或落账。
- 身份绑定：party 来源为 `{kind:'partyCharacter', id}`，Enemy 来源为 `{kind:'enemy', id}`；Ability/Item 的 source 为 `null`，合法选中单位作为 primary；`sourceTeam` 按来源方绑定。HP map key 使用 `partyCharacter:<id>`、`enemy:<id>`。actorless sourceKey 为 `actorless:<actionId>`，有 Actor 的 sourceKey 复用 `mapCardActorKey`。legacy 无需 `visit`。
- 相位/兑现点：Party 保留原 `settlementChangesFor` 后调用 `applyHpEffects` 的外层顺序，HP 仍在该 Party 来源的成本与资源 effects 兑现前更新。己方成本仍在 `addRequiredCosts` 汇总，验证并扣除后由 `resourceSettlements` 顺序兑现 Party/Ability/Item resource effects；Ability/Item HP 仍由 `pendingHpActions` 在资源兑现后应用。Enemy 仍在 `enemyActionCostsArePayable` 通过后调用 `applyEnemyResourceChanges`，先逐源扣费/兑现 effects，再调用 `applyHpEffects`。
- restore 调用点继续复用 `settlementChangesFor` 校验旧 Actorless、Party 与 Enemy settlement 数组；旧作者 HP 数组仍按原规则验证。没有改变 CardRef、费用、目标、skip、Item 消耗事务、terminal 或随机抽取策略。
- `map-card-effects.ts` 的 `resolveMapCardEffects` 保留目标/场景/受益对象校验，只把旧 `cardEffects` 折扣规范化并通过 `planMapEffectSource` 的 prepare 输出取得，然后汇总到现有 `reductions`；prepare 使用空 resolve 切片，是纯元数据，不扣费或执行 Action。新 `effectProgram` 仍明确失败。
- `resolveEncounterCommitPlan` 中既有 `effectProgram`、Encounter `locals`、condition completion 三条 U03 拒绝保持原样；U07 没有放行 program 或增加执行 trace。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 旧效果与直接回归 | `npx vitest run tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts --silent` | 通过，退出码0；5 files / 91 tests | OLD 金样13项期望未改；另含负责人指定的 save-resume 7 项。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | 首轮发现 HP trace union narrowing 问题，收窄至 Actor identity 后复跑通过。 |
| 架构 | `npm run check:architecture` | 通过，退出码0 | 基础层无反向依赖或新写入口。 |
| 空白与范围 | `git --no-pager diff --check`；`git --no-pager diff --numstat -- <两份服务文件及旧金样>` | 通过 | 仅有并行 U04 文件的 CRLF 提示；两份服务新增/删除为94/59与20/7；旧金样0/0。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | Receipt 写入后检查1114篇Markdown，errors=0。 |

## 遇到问题

- 负责人 review 指出规范化异常须保留 `MapRunError`，且 Party HP 外层调用顺序应保持原位。已通过小包装修正错误类型并恢复调用位置；旧 HP 实际更新仍早于成本/资源兑现。修正后指定测试、类型与架构检查复跑通过。

## 需上游确认项

- 无。可由 U08/U09/U10 按上述实际 identity、HP projection、resource ledger 转换和兑现调用点消费。

## 事实更新建议

- U07 已把旧 HP/resource/card prepare 真正接入共享 `normalizeMapActionEffects` / `planMapEffectSource`；未来 Unit 应以 `map-run-service.ts` 的恢复与运行时调用点为准，不从规划接口摘要推导投影格式。
