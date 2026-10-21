# Receipt Task 0313-U4

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（仅文档用例设计；不代表新语法/敏捷规则获批或已实现） |
| 实际修改 | 新增 `docs/plan-work/archive/task-0313-units/behavior-cases.md`；新增本 Receipt。未改Task、Draft、U1/U2/U3或产品文件。 |
| 未完成内容 | 未执行测试、`check:docs`、空白检查或地图健康复核；按主Agent指示由U5统一运行。没有新增产品测试/fixture代码。 |
| 范围外变更 | 无。 |
| GALHCG影响闭环 | U5统一只读复核直接影响路径；本Unit未维护/刷新语义图或写freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 人工fixture推演 | 对照Draft0312 §11–§13、Task0312 §3–§5及U1当前行为证据逐例写OLD/EQ/E1-NEW/AG期望 | 完成 | AG/E1-NEW全部标记未来设计期望，不称为测试通过。 |
| 现有测试映射 | 只读核对U4指定命名测试及用例描述 | 完成 | 作为旧行为来源；未重新运行。Enemy空Card目标skip缺专门回执用例，已标真实缺口。 |
| 指定/全量测试 | 未执行 | 未执行 | 按主Agent要求免于重跑，U5统一验证。 |
| 文档检查 | `npm run check:docs`、`git --no-pager diff --check`、新文件尾随空白检查 | 未执行 | U5统一处理并记录相对基线差异。 |
| GALHCG | 只读/维护图操作 | 未执行 | 留给U5合并直接影响范围统一复核。 |

## 遇到问题

- 全来源阶段、Actorless限制和AG支付期望已按最新Draft §13更新；现有无任何Actorless额外Action cost，Ability/Item不能用来构造Team补给正例。
- 起始Team0而自然来源cost1的NEW02无法作为合法Hand正例；已改为资格不可达/Actorless多余成本负例。AG正例复用`LATE_EFFECT_COMMIT_MAP`已实际构造的两来源草稿：Team1、serika的合法Hand外`serika-refill` Command先付1再回1、shiroko自然`shiroko-spend`后付1。
- Terminal先于source HP，击杀最后Enemy后后续为`roundEnded`；要覆盖`defeated`/HP0锁定须保留额外活Enemy。对敌方击倒目标同样保留活Party，避免把全队failure误写为source skip。

## 需上游确认项

- 玩法待批输出列于behavior-cases：D01/D02/D02-DISCOUNT/D03/D04/D05/D09/D10；D11来源入队/身份/快照按A01/A05落作工程合同。D06/D07/D08、稳定尾键和D12先后是文档中的工程默认；AI推荐不构成人类批准。
- AG11双方全灭例为E1候选`hpChange(source)`语法上的未来AG推演，未实现/未测试；它不新增玩法/作者原语范围。

## 事实更新建议

- U5可用此文件核对D01–D12及最低矩阵，优先检查AG04/05/09 terminal窗口、AG07 Actorless零额外Action cost、NEW02合法Hand输入及EG/EQ/AG版本隔离。文档检查和测试结果由U5实跑后补入总Task/Receipt。

