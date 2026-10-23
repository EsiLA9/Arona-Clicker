# Unit 0312-U12A：有界trace格式与program内部校验

状态：completed — 本页仅保留施工计划；实际修改与验证结果以对应实施 Receipt 为准。
> 现行作者合同与迁移结果以 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 和对应 Receipt 为准；本页的旧字段与 legacy 执行说明只记录当时施工计划，不是当前作者入口。

## Allowed Files与预算

- 当前新增文件 `src/arona-clicker/services/map/map-effect-receipt-validator.ts`：首稿580行，内部unknown结构、版本、Scope、source/path、逐source程序语义、guard短路、delta和program投影基础校验。
- 当前新增文件 `tests/engine/gameplay-b-effect-receipt.test.ts`：首稿138行，30项真实Runtime成功Receipt及独立篡改行为；可增runId parent-envelope及必要Scope反例。
- 新增实际Receipt：docs/plan-work/task-0312-units/receipts/task-0312-u12a-receipt.md；预计60–80行。

当前778行，追加Scope/事实补强约20–50行，目标≤850，上限1000。只写这三处，不接Owner恢复、不改U11、Runtime、其它测试或types。

## 验收

1. 首稿已实现的格式/当前纯program正例、nested guard preorder visits与postorder reads、声明常量及算术/当前同Encounterlocals末值、预算、prepare及分组基础对应全部实际测试与tsc/architecture/docs/空白通过。
2. Scope要可绑定所属Run：若当前context没有可信runId，增加context.runId并在真实正例传Owner runId，拒绝单独或同步伪造receipt/card scope的跨Run记录；不给首个自报runId当可信父身份。U13按实际API提供父Run身份。
3. Receipt准确列A覆盖及已知未完成：合法legacy/program混合会误拒、program间legacy HP相位未插入、资源缺跨event账户连续链、退出/当前末值完整验证及混合折扣仍待B核实。A不代表U12完整成功，不预填后续Save恢复。当前validator未接Owner，无新产品恢复入口。
4. 只为A写实际Receipt。B从实际API/测试继续，U13等待B。GALHCG影响累计U19统一只读，不写图。
