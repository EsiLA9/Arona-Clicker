# Receipt Task 0313-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（U1证据与指定基线测试完成；不代表玩法批准或产品准入） |
| 实际修改 | 新增 `docs/plan-work/archive/task-0313-units/current-behavior-evidence.md`；新增本 Receipt。未修改总 Task（负责人更新）。 |
| 未完成内容 | 未运行 `npm run check:docs`、`git diff --check` 与未跟踪新文档尾随空格检查；按主Agent安排由后续收尾统一检查。未运行 data/UI测试，只检查了其指定命名用例。 |
| 范围外变更 | 无。保留工作树既有并行改动，未回退或暂存它们。 |
| GALHCG影响闭环 | 工作节点完成后由U5统一只读复核直接影响范围；项目身份已核对 `project_id=acprogram`，source查询仅用于定位。未授权维护图，未编辑、刷新或写freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 指定定向测试 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-save-resume.test.ts` | 通过 | Vitest v2.1.9，4 files / 78 tests passed；exit 0。 |
| 逐文件计数复核 | 同命令加 `--silent` | 通过 | run 46、cards 18、source-transactions 7、save-resume 7；总计78；6.04s，exit 0。复跑仅为取得未截断摘要。 |
| 文档链接/空白 | `npm run check:docs`、`git --no-pager diff --check`、新增文档尾随空格检查 | 未执行 | 由主Agent或U5按共同收尾计划执行；不得据此宣称本Unit已通过。 |
| 类型/全量/其他测试 | 未执行 | 未执行 | 不在本Unit指定验证范围。 |
| 人工源码核对 | 按Unit Read Set有界读取 planner、save/receipt、preview、card effects、runtime coordinator及既有测试名/断言 | 完成 | 阶段、来源矩阵、目标、终局、Receipt/Save/RNG及0312差异已写证据文件。 |

## 遇到问题

- 指定测试初次运行时旧测试产生大量Event输出，工具界面截断文件摘要；测试退出成功。为取得逐文件数量，在相同四文件上以 `--silent` 复跑，4 files / 78 tests通过。
- 现状差异已明确：常规队伍HP规划、Ability/Item后置HP与Enemy逐只执行不是单一交织队列；PlayerCommand noLegalTarget仍累计PlayerCost。该事实不构成停止条件，因为Unit要求记录差异，未要求替后续玩法选择定案。
- `prepareEncounterRoundCommit` 在终局推进到下一个Encounter activity的路径会进入`createEncounterSnapshot`并分配新随机种子；未制作最小复现，不称为RNG bug。证据建议后续定向断言覆盖此分支。

## 需上游确认项

- U1无需新增事实答复即可交付。D02、D04、D05、D07、D11、D12的玩法裁定/合同归属已在证据差异表列出，交相关Unit继续审阅；AI推荐不构成人类批准。

## 事实更新建议

- 建议U2/U3引用证据文件的来源阶段矩阵，不把现有分阶段结算称为统一执行序列。建议U4按“PlayerCommand自动目标无替补仍消耗PlayerCost”与“终局推进下一Encounter时prepare新seed”分别保留样例/定向断言候选。
- Hand候选受既有资格/费用筛选；敏捷度验收应以合法自然来源为起点，并按 A04 保留抽取/行动次数不变。总Task进度与证据链接由主Agent更新。
