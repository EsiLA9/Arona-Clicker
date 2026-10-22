# Unit 0312-U12B：混合来源状态链与完整回执验收

状态：ready / 2026-10-22负责人放行。[[docs/plan-work/task-0312-units/receipts/task-0312-u12a-receipt]]已实际交付：32项定向、tsc/architecture/docs/空白通过，根核对Receipt及当前接口；A明确未完成项在本页继续，未接入Owner恢复。继承 [[docs/plan-work/task-0312-units/task-0312-u12-trace-validation]] 全部剩余验收；完成B才构成U12完成并解除U13依赖。

B增量基线为A validator584行、测试143行，父Run可信身份已通过必填context.runId输入。预算按B相对该实际基线的新增/删除计量，不把同一未提交文件的A内容再次计入。完整B剩余校验估算调整为validator净增250–400、测试150–250、Receipt60–80，总460–730，上限1000，文件白名单不变。

## Allowed Files与预算

- `src/arona-clicker/services/map-effect-receipt-validator.ts`：修正source集合并补混合legacy/program相位链、账户资源链及完整Scope/投影，估净增170–240行。
- `tests/engine/gameplay-b-effect-receipt.test.ts`：新增真实混合来源正例与独立篡改负例，估净增100–170行。
- 新增实际Receipt：docs/plan-work/task-0312-units/receipts/task-0312-u12b-receipt.md；估60–80行。

预计330–490行，常规500内，上限按已授权1000。不得改其它路径；若完整剩余合同需超范围或预算，先交根调整。

## 必须完成

1. 合法旧来源不能被`sourceInfos`当无program错误拒绝；真实混合Receipt、skip来源、Ability/Item独立来源均按完整E1相位校验。
2. 临时局部source流：party顺序→program Ability/Item C2；旧Ability/Item HP在C3全部资源后；Enemy逐source。program event与旧settlement投影互校去重，legacy HP变化插入program guard/HP链间隙。加入真实program→legacy→program HP正例，以及program Item guard→后置legacy Ability heal正例；有界anchor不冒充完整历史Owner。
3. C3先聚合成本，再party→Ability→Item效果，Enemy逐源cost→effect；每账户资源before→after链包含legacy effects和中间cost，不只核单条算术。真实同账户多effects正例，第二事件before/after同时平移、delta不变必须拒绝。prepare旧新来源合法总折扣及scostCost投影完整核验。
4. 同node/activity且紧接一轮的当前Encounter可比完整最终HP/locals/资源末值；退出或转入新活动只核内部链/声明/plannedLocals，不用新活动初值证明前轮。必要可信父Run/余额由context显式输入，U13从真实checkpoint提供，不能信receipt自报值。
5. 父Unit所有路径/source/Scope/版本、guard实际读值/分支/短路、连续性/零delta/clamp/溢出、投影/余额/末值/动态预算独立篡改项保持，AG字段拒绝，不迁移/不重施费用库存。缺失的完整项在B补齐，A测试数不等于父Unit覆盖。
   根对A首稿已核实的具体剩余项亦必须补齐：从规范化resolve AST和重算guard结果闭合完整then/else statement访问walk，拒绝同步改visit/trace/投影的错分支；source必须符合当前participant候选/eligible、Enemy候选、Ability暴露和Item映射，Party/Enemy行顺序核声明而非信Receipt自报顺序；当前Encounter引用program时不能全删header伪装legacy。plannedLocals仅对Counter/Flag链，不把HP键当Flag。严格unknown嵌套身份/Scope与合法零变化正例一起验证。
6. 新旧定向、tsc、architecture、docs、空白真实通过并记录Receipt；输出实际U13调用API、能力与历史证明边界。GALHCG只读影响累计U19，不写图。
