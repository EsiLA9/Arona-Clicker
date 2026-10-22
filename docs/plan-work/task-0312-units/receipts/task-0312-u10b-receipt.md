# Receipt 0312-U10B

| 项 | 内容 |
| --- | --- |
| 状态 | U10B实现与所列验收完成，交负责人审阅；本轮未提交Git。 |
| 实际修改 | `src/arona-clicker/services/map-run-service.ts`；新增 `tests/engine/gameplay-b-effect-program-commit.test.ts`；更新 `tests/engine/gameplay-b-effect-card-prepare.test.ts` 与 `tests/engine/gameplay-b-effect-program.test.ts`；新增本Receipt。 |
| 行数预算 | 新公开Commit测试626行，含矩阵与Owner事务场景；按U10B估算约710行净改动（含服务接线、既有测试调整和Receipt），低于1000行上限。 |
| 未完成内容 | 无U10B未完成项。Runtime UI ReadModel的完整程序字段展示仍属U15；U11/U12按父Task依赖等待负责人审阅本Receipt。 |
| 范围外变更 | 无；未改Runtime Owner、fixture、纯核、Schema、其它Unit或计划文档；保留共享工作树中的并行改动。 |
| GALHCG影响闭环 | 只读身份核对为 `project_id=acprogram` 且根路径匹配。直接影响范围累计至U19统一只读复核；本轮未改图、refresh或写freshness。 |

## 安装行为与事务证据

- `previewEncounterCommit()`对有效新程序计划返回 `canCommit: true`；`prepareEncounterRoundCommit()`不再因program本身拒绝。所有规划、版本、余额、预算与scope校验仍在原权威MapRun计划中，安装仍走现有prepared token及GameInstance两Owner连续安装入口。
- 非终局下一轮从`plan.plannedLocals`建立Encounter快照；换活动时继续由新活动声明初始化locals。同Encounter跨轮Counter保留，新的Activity使用其自身初值。
- `snapshotOf()`对Receipt新增的`effectScope`、`programVisits`、`plannedLocals`与`effectTrace`显式复制并冻结；成功公开Commit Receipt含版本、`E1-COMPAT-1`、Scope、Visits、Trace及规划locals。
- GameInstance公开Item Commit成功后扣除库存一次并安装程序效果；相同request重放返回同一快照，不重复扣库存、改状态、累计Stats或发Item事件。草拟Item后库存被移除时，公开Commit因库存不足拒绝，MapRun、PlayerState、Stats与事件均零写。
- Prepared token仍是唯一的安装资格；本Unit没有增加状态Owner、第二写入口或runtime事务协调逻辑。
- Item正例在现有GameInstance事务中先验证MapRun token与库存debit，再按原协调顺序连续安装；拒绝发生在两Owner写入之前。
- 新程序trace的零变化、guard读取、Counter实际delta及资源实际settlement均由既有E1规划结果进入Receipt；本Unit不把意图trace当实际资源写入。
- 新活动的locals仍通过原`createEncounterSnapshot`初始化；program状态只作为同活动下一轮的显式输入。
- Runtime Workspace当前只投影`canCommit/cost/diagnostics/settlements/enemyActions`，没有断言它展示Trace或plannedLocals；完整UI ReadModel字段仍映射U15。

## 合同与归档行为用例映射

| 合同ID | 验收证据 |
| --- | --- |
| NEW01 | 新测试以真实primary `serika`验证HP4/5及guard在heal前后：固定HP<5守卫先判断时仅HP4获`med+1`；先heal再用同一守卫时两者均不获资源。typed MapRun Preview与GameInstance公开Commit的HP、资源、locals和Trace一致。 |
| NEW02 | 使用真实合法Owner自然来源及后续PlayerCommand，Team起始1、两项cost各1，后续program补给不资助起始费用；公开Commit整轮拒绝，Team/PlayerCost与MapRun、PlayerState、Stats保持原值。未使用零余额伪造自然Hand。 |
| NEW03 | 非战斗`rounds:3`首轮有两名自然Party来源分别对`trust=2,max=3`加1；Trace为2→3、3→3且delta分别1/0，公开GameInstance Commit安装后进入round2，未提前结束。 |
| NEW04 | 下界0再−1保留delta0；Flag false→true→false保留两次写入Trace；`MAX_SAFE_INTEGER + 1`在clamp前拒绝整轮。GameInstance公开Commit拒绝，MapRun与PlayerState零写。 |
| D07/D08动态访问预算 | 每次Preview重新规划并保持4096次访问（包含prepare）；4096通过公开GameInstance Commit并在Receipt保留4096 Visits/Trace，幂等重放零重复；4097 Preview及公开Commit拒绝，MapRun/PlayerState/Stats零写。NEW07完整保存恢复验收留待U12/U13。 |
| EQ01–EQ04 | 保持既有legacy goldens与source/card prepare事务用例；公开新program prepare Commit通过，不再断言U10A临时pending门。测试未改OLD期望。 |

## 测试与验证

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-program-commit.test.ts tests/engine/gameplay-b-effect-program.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-effect-card-prepare.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-run.test.ts --silent` | 通过，退出码0 | 6 files / 90 tests。 |
| 类型 | `npx tsc --noEmit` | 通过，退出码0 |  |
| 架构 | `npm run check:architecture` | 通过，退出码0 | 无基础层反向依赖。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | 创建Receipt前扫描1119篇Markdown；Receipt加入后复核1120篇，均errors=0。 |
| 空白 | `git --no-pager diff --check`与新测试尾随空白扫描 | 通过，退出码0 | Git只提示共享树中两处无关文件的CRLF规范警告。 |

## 问题与需上游确认项

- 无待裁语义、范围外需求或未解释验证失败。GALHCG直接影响项留待U19按父Task统一只读复核；U15仍需完成ReadModel展示范围。
- 本Receipt未授权或执行GALHCG图写入、刷新与freshness更新；相关工作按父Task安排在U19处理。
- 无新依赖、Schema变化、存档格式迁移或禁改目录变更。
- 变更文件均处于U10B白名单；代码和Receipt保留在当前共享工作树中供负责人复核。
