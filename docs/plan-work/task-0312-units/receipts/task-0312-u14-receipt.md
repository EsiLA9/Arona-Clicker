# Receipt 0312-U14

| 项 | 内容 |
| --- | --- |
| 状态 | U14实现与指定验收完成，交负责人审查；未提交Git。 |
| 实际修改 | 新增 `src/arona-clicker/services/map/map-effect-summary.ts`、`tests/engine/gameplay-b-effect-projection.test.ts`、本 Receipt；修改 `src/arona-clicker/contracts/map/map-relations.ts` 与 `src/arona-clicker/services/map/map-relation-projector.ts`。 |
| 预算 | 实际约356行净手写改动（约100行摘要helper、39行契约、7行投影接线、180行测试、30行Receipt），低于本Unit登记的1000行上限。 |
| 未完成内容 | 无U14内未完成项。Runtime ReadModel接线仍按计划归U15；U14未修改Runtime或UI。 |
| 范围外变更 | 无。保留共享工作树其他Unit的独立变更；未修改AG/E2+、Owner、Schema、runtime、UI或其它测试。 |
| GALHCG影响闭环 | 只读身份核对为 `project_id=acprogram` 且workspace根路径匹配。直接影响路径累积到U19统一只读复核；本Unit未改图、refresh或写freshness。 |

## 实际投影行为

- 新program通过 `normalizeMapActionEffects` 形成纯声明摘要，输出到 `MapActionRelation.declaredEffects`。它与旧 `effectRecipients` 分开，标记 `declaration: 'declared'`；旧数组字段和投影分支保持原样。
- HP `source`/`primary`、资源 `sourceActor`/`primaryActor`/`sourceTeam` 解析为Owner当前投影中的稳定引用；新Team引用带来源阵营。Actorless Ability保留空performer，未解析primary保持null，source团队按party映射。
- Counter/Flag摘要使用独立类型、Encounter声明路径和 `recipient: null`，没有伪造单位受用箭头；Counter是delta，Flag是boolean。
- `when` 两个已声明分支分别列出条件、条件path、when path、分支名和叶path，均标为conditional。helper不求值条件、不调用效果核或VM，不生成实际结算结果。
- prepare折扣摘要读取当前真实target CardRef；无已解析卡目标时受用者为null。摘要/关系查询不写MapRun、locals、draft、Owner或RNG。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/gameplay-b-effect-projection.test.ts tests/engine/gameplay-b-map-relations.test.ts --silent` | 通过，退出码0；2 files / 10 tests | 新测试3项，覆盖source与primary不同、Actorless与未决定目标、then/else guard/path、sourceTeam party/enemy、Encounter Counter/Flag无箭头、真实Owner CardRef prepare、snapshot/RNG零变化；旧map-relations回归7项通过。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 |  |
| 架构 | `npm run check:architecture` | 通过，退出码0 | 基础层无新增反向依赖。摘要契约只依赖data-services契约类型，不反向导入normalizer实现。 |
| 空白与范围 | `git --no-pager diff --check`；扫描两份新增代码/测试文件尾随空白 | 通过，无新增空白命中 | U14修改限于登记的四个代码/测试路径与本Receipt。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | 扫描1126篇Markdown，errors=0。 |

## 合同与用例映射

| 合同 / ID | U14证据与边界 |
| --- | --- |
| D01 / NEW01 | `when` 的then/else保留各自guard条件与路径，统一标为条件声明；没有把两边合并成必定结算或执行Guard。 |
| D06 / NEW06 | sourceActor、primaryActor、sourceTeam受用者区分；Actorless Ability无performer，未决定primary无虚构对象。新Team摘要带party/enemy side。 |
| D03 / NEW03/NEW04 | Encounter Counter/Flag分别作为局内事实摘要，Counter为delta、Flag为bool，均不创建单位关系箭头。 |
| D07 / ReadModel边界 | 摘要只描述Datapack声明；实际计划与结算仍归Owner Preview/Receipt。本Unit未增加Runtime/UI展示接线。 |
| OLD relation regression | `tests/engine/gameplay-b-map-relations.test.ts`原7项通过；legacy effectRecipients原投影路径未改。 |

## 遇到问题

- 迭代类型检查曾报告共享U12B validator的TS2345，以及U14条件摘要克隆的窄化错误。只修复U14自身窄化；U12B文件未由本Unit修改。最终 `npx tsc --noEmit` 通过。
- 摘要类型最终只依赖data-services契约，保持contracts不反向依赖normalizer service实现。

## 需上游确认项

- 无。U15仍依赖U13与U14均完成；本Receipt不表示U13或U15完成。

## 事实更新建议

- 无需写回其它文档；Runtime ReadModel字段接线和展示留在U15/U16范围。
