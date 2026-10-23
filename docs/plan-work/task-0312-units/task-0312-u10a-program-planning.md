# Unit 0312-U10A：新程序权威纯规划

状态：completed — 本页仅保留施工计划；实际修改与验证结果以对应实施 Receipt 为准。
> 现行作者合同与迁移结果以 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 和对应 Receipt 为准；本页的旧字段与 legacy 执行说明只记录当时施工计划，不是当前作者入口。

## 范围与预算

允许文件：

- `src/arona-clicker/services/map/map-run-service.ts`：净增260–350行；只改纯planner、Preview和必要的Commit拒绝门位置。
- `src/arona-clicker/contracts/map/map-run.ts`：净增15–35行，公开Preview/Receipt的规则版本、访问数、结果locals等必要typed字段。
- `src/arona-clicker/contracts/map/map-effects.ts`：净增10–30行，资源实际before/after与prepare trace必要类型；资源意图与最终trace必须可区分。
- 新增（执行时才创建）：tests/engine/gameplay-b-effect-program.test.ts；350–480行，真实Owner入口的Preview行为、预算与零写。
- 新增实际 `docs/plan-work/task-0312-units/receipts/task-0312-u10a-receipt.md`：50–70行。

净增估算685–965行，负责人按已授权额度登记上限1000。U06纯核已有足够接口，本子Unit不改`map-effect-planner.ts`；若真实必需先报告负责人调范围。只能阅读已规定Read Set及直接依赖；不得自行扩文件。

## 施工与验收

1. 完成原U10 Work Items 1–3、5–6的完整纯规划职责：C0–C5真实顺序、source只求值一次、HP/locals连续可见、资源账本C3兑现、旧相位不变、Enemy费用可付才访问resolve、prepare只在实际阶段计数。去掉planner内program拒绝，保留condition拒绝。自定义resolver也用U03共享context validator重核。
2. `resolveEncounterCommitPlan`持有唯一4096预算入口；每Preview重建，候选查询不计。Trace含版本、真实身份、path、guard实际读数、零变化和资源实际余额；资源意图不重复施加。Preview提供完整typed结果供U10B安装，保持输入/Owner/库存/RNG零写。
3. U10A期间将新program Commit保护放到`prepareEncounterRoundCommit`规划之前，明确诊断“effectProgram installation pending U10B”；旧Commit继续可用。不开放未完成的安装。既有U09测试匹配effectProgram仍通过，不改它。
4. 覆盖NEW01基本读取、NEW02聚合费用不足、混合旧新source、Ability/Item/Enemy程序、4096/4097真实Owner fixture及含prepare边界、动态Enemy费用不足不计prepare/resolve，以及自定义resolver非法上下文重核。使用U01固定seed Owner fixture，不伪造Hand/Scope或真实状态。完整NEW01初HP4/5与先治疗/后判断矩阵、NEW03/04 Counter clamp/零delta/Flag/溢出迁到U10B公开Preview/Commit一起验收，不删U10总合同用例。
5. 运行新测试、旧金样、U09、map-run与source-transactions；全局tsc、architecture、docs和空白检查。Receipt列实际结果、未完成的U10B安装与具体接口。不得预填U10完成。GALHCG影响累计U19只读复核，不写图。

U10B从本子Unit实际Receipt继续；U11/U12等待U10B。当前不实现存档恢复、condition完成、UI或AG。

2026-10-22实际施工预算复核：代理报告源码约360–390新增、contracts约50–60、当前测试417行，若继续全部矩阵加100–130及Receipt50–60，约977–1060行（新增估计尚未扣删除）。负责人按独立验收边界将约90–110行完整NEW01/03/04矩阵移交U10B；A保留本页列出的核心纯规划及预算/反例。以实际净改动计量，不压行数、不改总合同。
