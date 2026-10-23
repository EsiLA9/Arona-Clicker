# Receipt 0312-U01

| 项 | 内容 |
| --- | --- |
| 状态 | 完成，交负责人审查；不代表E1产品整体验收通过 |
| 实际修改 | 修订并扩展 `tests/engine/gameplay-b-effect-test-fixtures.ts`、`tests/engine/gameplay-b-effect-legacy-goldens.test.ts`；新增本Receipt。两份测试初稿已由负责人纳入工作树提交，本Receipt记录的是该初稿上的U01最终修改。 |
| 未完成内容 | 无U01内剩余项。没有新增程序语法或NEW断言；后续产品Unit、U18/U19验收仍按总Task依赖执行。 |
| 范围外变更 | 无；未改产品源码、总Task或Unit正文，未Git提交，未触碰其它工作树改动。开工基线HEAD为 `dff0061`；执行期间外部提交将HEAD推进至 `a28f1d9`并纳入两份施工初稿，提交执行方未核实，本施工代理与负责人均未提交。 |
| GALHCG影响闭环 | 只读确认 `project_id=acprogram`、根目录匹配；只读源搜索命中 `src/arona-clicker/services/map/map-run-service.ts:959` 的 `resolveEncounterCommitPlan`。U01文件影响范围留待U19统一只读复核；未改图、refresh或写freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试（完整命中套件） | `npx vitest run tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-save-resume.test.ts --silent` | 通过，退出码0 | Vitest 2.1.9；5 files / 91 tests。各文件为13、46、18、7、7 tests；该轮之后只在EQ02同一新测试内增加PlayerCost断言，产品源码和其它4份测试未变。 |
| 定向测试（最终金样文件） | `npx vitest run tests/engine/gameplay-b-effect-legacy-goldens.test.ts --silent` | 通过，退出码0 | Vitest 2.1.9；1 file / 13 tests。最终状态覆盖追加的EQ02 PlayerCost断言。 |
| 类型 | `npx tsc --noEmit` | 通过，退出码0 | 负责人开工前也记录类型基线退出码0。 |
| 范围与差异空白 | `git --no-pager diff --check`；对两份测试与本Receipt扫描尾随空格 | 通过，退出码0 | 实际差异仅两份U01测试文件；新增Receipt未跟踪，以定向尾随空格扫描补检，未命中。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | 检查1108篇Markdown，errors=0。 |
| GALHCG | 项目身份及源码只读搜索 | 已完成，只读 | 无授权维护；直接影响范围按Task约定集中到U19。 |

## 覆盖映射

| 合同 / E0 ID | 新测试证据 |
| --- | --- |
| OLD01 | 实际Owner创建固定seed与Hand；连续两次Preview无状态写入；旧费用、队伍Action后Enemy阶段、Receipt；Save/Load和同request replay。 |
| EQ02 | 两个真实Hand中的折扣Action指向同一真实CardRef；原sCost=2、折扣相加后截为2、实付0，未向余额赠费；另提交合法Actorless Ability，PlayerCost原4扣1→3，不受sCost折扣影响。 |
| EQ03 | 两个独立实例分别覆盖显式目标倒地后HP实际delta=0及自动目标fallback；Action费用仍正常扣除。 |
| EQ04 / Skip补全 | 分别覆盖自然与PlayerCommand的noLegalTarget费用通道；Enemy的unaffordable（前源耗尽资源）、defeated、roundEnded和无合法card目标各自独立。Enemy skip记录空resourceChanges且不出现hpChanges；defeated / roundEnded的原余额足以支付非零费用，另验证适用的后续来源。 |
| OLD旧相位 / EQ05保存边界 | Receipt分组对应Party→Ability→Item→Enemy；HP封顶产生非交换结果。另覆盖清场后Ability与Item仍执行、Ability PlayerCost和Item库存各结算一次、保存恢复后request replay不重复扣库存，以及恢复后实际Commit下一轮。 |
| NEW / AG | 本Unit不创建新程序或敏捷行为断言；不把AG调度、逐源支付、统一准备或AG终局写成E1通过条件。 |

## 遇到问题

- 首轮运行发现battle样例不能声明manual completion、card target必须有cardEffects、卡牌/敌方Hands及PlayerCommand候选须由Owner真实流程生成；按当前Registry及Owner接口修正fixture。最终定向测试和类型检查均通过，无未解决问题。
- 源码事实与U01批准的E1兼容基线一致：Enemy按声明顺序逐源处理，先判来源已倒地，再判终局；`roundEnded`金样使用全队倒地后的存活后序Enemy。无需扩大范围或重裁语义。

## 需上游确认项

- 无。请负责人审查本Receipt与两份测试后，再决定是否放行依赖Unit。

## 事实更新建议

- 无新增权威机制事实；本Unit测试只将现有MapRun行为固化为可运行旧基线。
