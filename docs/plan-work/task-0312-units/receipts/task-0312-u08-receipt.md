# Receipt 0312-U08

| 项 | 内容 |
| --- | --- |
| 状态 | 实施及本Unit指定验证完成，交负责人审查；不代表E1整体完成。 |
| 实际修改 | 修改 `src/arona-clicker/contracts/map-run.ts`，为Encounter locals及U10未来Preview/Commit trace留typed引用；新增 `src/arona-clicker/services/map-encounter-locals.ts`；修改 `src/arona-clicker/services/map-run-service.ts`，安装/保留locals、复制快照并移除U03仅locals拒绝；新增 `tests/engine/gameplay-b-effect-lifecycle.test.ts`；新增本Receipt。U07在 `map-run-service.ts` 的既有实现保留。 |
| 手写净改动估算 | U08自身约420行（含Receipt，map-run-service只计本Unit增量，不计先前U07内容）；低于负责人登记的1000行上限。 |
| 未完成内容 | 本Unit的状态生命周期与指定行为已完成。新Save字段的严格恢复仍由U13负责；counterAdd/flagSet真实执行与trace生产留U10；condition completion留U11。 |
| 范围外变更 | 无。本Unit只改其五条白名单路径；保留U04–U07及并行U09工作树改动，未修改Task/Unit或提交Git。 |
| GALHCG影响闭环 | 工作区只读身份为 `project_id=acprogram`，根目录匹配。新增helper的定向path查询命中当前磁盘文件且完整；受影响范围累计至U19统一只读复核。本Unit未改图、refresh或写freshness。 |

## 实际状态与转换

- 实际U06 `MapEffectLocalsState` 形状为 `{ counters: Record<id, { value, min, max }>, flags: Record<id, boolean> }`。新helper用公开 `validateGameplayEncounterEffectSyntax` 校验声明shape、字段、名称、范围、重复ID和locals上限；复制时再校验状态键集合、类型、safe integer、范围和声明边界。Counter状态与Flag状态及其记录均独立复制并冻结。
- `MapRunEncounterSnapshot.locals` 是可选typed字段：`createEncounterSnapshot` 只在内容声明 locals 或传入续轮状态时附带它，所以旧图仍不新增空字段。新的声明Encounter从初值初始化；同Encounter提交下一轮传入当前状态并按同一声明复制校验；`openNodeContent` 为新活动重置。`snapshotOf` 深拷贝冻结locals与未来Commit receipt trace。内部Owner只有 `activeEncounter.locals`；离开和失败沿现有生命周期将 `activeEncounter` 置为 `null`。
- `MapRunEncounterCommitPreview` 与 `MapRunEncounterCommitReceipt` 各预留可选 `effectTrace?: readonly MapEffectTraceEntry[]`。本Unit不产生trace，也不新增Save恢复逻辑。
- `initialResourceBalances` 保留旧 `costs/effects` 规则，并遍历所有Map级显式Actor/Team初始余额声明，确保程序引用的已声明资源键进入对应目录。Enemy Actor与Enemy Team仍各从当前Encounter独立初值安装；同名键保持不同身份与阵营的独立余额。U03 Registry上下文要求引用的资源键有相应显式起始余额，本Unit不从EffectProgram树猜测账户键。
- `resolveEncounterCommitPlan` 仅移除了Encounter locals声明拒绝；`effectProgram`与condition completion两道拒绝仍在。真实Wait Commit跨轮测试证明 locals 不再因该门被拒；测试未执行counterAdd/flagSet。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-lifecycle.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-map-save-resume.test.ts --silent` | 通过，退出码0；3 files / 24 tests | 生命周期4项覆盖无效声明拒绝、初值与快照冻结、真实Wait跨轮、正常切换活动及清理；程序资源键显式声明安装和party/enemy Actor/Team同名键隔离；trace及Guard read深拷贝。OLD金样13项期望未改；Save/Resume 7项保持。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | U09并行文件修正及本Unit声明校验修正后全局检查通过。 |
| 架构 | `npm run check:architecture` | 通过，退出码0 | 基础层未反向依赖产品服务，无新增写入口。 |
| 空白与范围 | `git --no-pager diff --check`及新增helper/test/Receipt尾随空白扫描 | 通过 | diff check退出码0（仅有其他文件CRLF提示）；新增文件扫描无命中。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | 扫描1116篇Markdown，errors=0。 |
| GALHCG | `graph_project`与新增helper定向path查询 | 只读完成 | 未进行健康检查或写图。 |

## 遇到问题

- 首轮把空locals也加入所有旧Encounter快照，导致既有Save/Resume深相等测试失败。根据U08明确“旧内容不强加locals或新字段”，调整为只有声明locals的Encounter才携带状态；修正后OLD金样与Save/Resume指定测试全绿。
- 初次生命周期测试使用了不符合Registry三段式规则的Map ID，改为合法ID；活动Encounter draft必须带 `activityId`，测试改为从真实Owner快照构造Wait Commit命令。最终定向测试全绿。
- 复核资源边界时确认 U03 Registry context已要求 program 引用与显式余额逐上下文匹配，故不再从program树推导资源目录键；直接复用Map及Encounter的完整initial声明安装，避免跳过Registry的自定义resolver深树遍历和Party/Enemy账户猜测。

## 需上游确认项

- 无超出U08范围的待裁定项；根审查与只读review已确认删除资源键推导、复用U02公开Encounter effect语法校验，最终指定检查全绿。

## 事实更新建议

- 后续U10以 `activeEncounter.locals`、U06 `MapEffectLocalsState` shape，以及 `effectTrace` Preview/Receipt字段为接线点；旧图无locals时应按空状态消费而不要强制写入快照。U13负责新Save字段验证与恢复。
