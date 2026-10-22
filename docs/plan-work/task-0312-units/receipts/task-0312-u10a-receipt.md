# Receipt 0312-U10A

| 项 | 内容 |
| --- | --- |
| 状态 | U10A纯规划与指定验证完成，交负责人审查；U10整体未完成。 |
| 实际修改 | 修改 `src/arona-clicker/services/map-run-service.ts`、`src/arona-clicker/contracts/map-run.ts`、`src/arona-clicker/contracts/map-effects.ts`；新增 `tests/engine/gameplay-b-effect-program.test.ts` 与本 Receipt。 |
| 行数 | 按当前共享树相对HEAD准确统计：map-run-service +439/-93、map-run contract +45/-0、map-effects本Unit增量 +41/-0（U06原有113行不计）、新测试 +400/-0、本Receipt +43/-0；合计 +968/-93，净增875行。服务/contract差异包含已在工作树中的U07/U08改动，U07 Receipt记录其service为+94/-59；此合计保守高于U10A自身净改动，仍低于负责人登记的1000行上限。 |
| 未完成内容 | U10B负责移除Commit保护、安装locals/trace/Receipt并完成幂等和GameInstance跨Owner事务验收；U15负责将Runtime readmodel完整透传Preview/Receipt字段。U10A不代表U10整体完成。 |
| 范围外变更 | 无。未改Runtime投影文件、其它Unit/代理文件或Task；未提交Git。共享工作区其它改动保留。 |
| GALHCG影响闭环 | 只读身份为 `project_id=acprogram`，工作区根匹配。受影响路径与关系累积至U19统一只读复核；未改图、refresh或写freshness。 |

## 规划与Preview接口

- `resolveEncounterCommitPlan()` 现在只对每个实际新program source调用一次`planMapEffectSource()`，同一plan供HP/locals投影与resource ledger使用；旧数组继续按U07 legacy phase切片。己方费用仍按C3起始余额聚合预检后才兑现资源；Enemy按声明顺序，当前source cost不可付则在prepare/resolve访问前skip。
- 每轮唯一预算由`programVisits.length`承载，prepare叶、实际语句与实际condition节点各记一次。Candidate查询不调用visit。Encounter引用program时Preview带版本头和scope，即使空program/Enemy均跳过也提供空visits/trace。Counter/Flag与HP留在detached Preview计划，不写Owner。
- `MapRunEncounterCommitPreview` / `Receipt`的program字段形状：`programReceiptVersion: 1`、`executionContractId: 'E1-COMPAT-1'`、根`effectScope { runId, mapId, nodeId, activityId, round }`、派生`programVisitCount`、`programVisits`、`plannedLocals`、`effectTrace`。每条visit有`sourceKey/source/actionId/path/kind/mode`；Actorless source身份区分`ability`与`item`，Item另带`itemId`。Actorless sourceKey使用tuple的JSON编码，与Party/Enemy key空间分离。
- Prepare trace含原始`targetCard: MapRunCardRef`、实际receiver或null、amount与prepare path；Enemy仅在本源可付后查自己的CardRef targets并记prepare。语句trace带source/mode/path及U06实际HP/Counter/Flag/when读数。C3/C5真实兑现时追加`resourceSettlement`，含account/identity/resourceId/intentDelta和余额before/after/actual delta；U06 `resourceChange` intent不重复安装。嵌套source、scope、CardRef与guard reads在Preview内深冻结。
- GameInstance的readmodel目前仍只投影`canCommit/cost/diagnostics/settlements/enemyActions`，本Unit白名单未含`runtime-game-instance.ts`；公开Workspace字段接线依U15 WorkItem 2验收。U10B可使用MapRunService公开Preview及Commit snapshot/Receipt。
- `prepareEncounterRoundCommit()`在规划前对当前Encounter引用的program拒绝并报告`E1 effectProgram installation pending U10B`；GameInstance真实入口的Preview零写与拒绝也有回归覆盖。

## 合同映射

| 合同 | U10A证据 / 后续 |
| --- | --- |
| NEW01 | 覆盖HP source读取、顺序内heal后guard读取当前值与C3资源实际余额；完整HP4/5先heal/先guard矩阵留U10B。 |
| NEW02 | 真实Owner自然费用加后续PlayerCommand形成 supplies 1、总成本2的冲突；program补给不资助起始费用，Preview/Commit拒绝且Owner零写。 |
| NEW03/04 | 本Unit按负责人拆分未覆盖Counter上下界饱和、零delta、Flag与safe-add溢出；U10B公开Preview/Commit一并验收。 |
| D07/D08 | program版本、source/path/实际delta/guard读数与唯一动态预算；prepare计数与语句访问统一；4096含prepare边界、重复Preview从0重算、4097拒绝。 |
| E1相位 | Ability与Item共用同Action时按唯一sourceKey连续看到locals；legacy Ability heal在C3相位，后续program Item guard保留C2读HP4；Enemy共享资源被前源消耗后skip，skip source无prepare/resolve visit。 |

## 测试与验证

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 定向回归 | `npx vitest run tests/engine/gameplay-b-effect-program.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-effect-card-prepare.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-run.test.ts --silent` | 通过，退出码0；5 files / 81 tests。 |
| 类型 | `npx tsc --noEmit` | 通过，退出码0。 |
| 架构 | `npm run check:architecture` | 通过，退出码0。 |
| 文档/空白 | `npm run check:docs`；`git diff --check` | 通过，退出码0；检查1118篇Markdown、errors=0。CRLF提示来自并行schema文件。 |

## 问题与上游事项

- Enemy动态费用测试使用两名真实Owner Enemy、EnemyTeam初值2、各自费用1；首源实际扣费并执行program资源变化后，第二源在MapRun执行阶段成为`unaffordable`，其prepare/resolve没有visit。候选阶段将费用不足动作过滤为null的路径另由U09既有测试覆盖。
- 本Unit未修改U06纯核、U08 locals helper、U09 CardRef resolver、U15 Runtime readmodel或跨Owner安装；无待裁玩法项。U10B须完成安装与事务矩阵，U15须核对完整readmodel字段。
