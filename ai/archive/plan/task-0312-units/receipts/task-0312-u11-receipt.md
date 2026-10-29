# Receipt 0312-U11

| 项 | 内容 |
| --- | --- |
| 状态 | U11实现与指定验收完成，交负责人审查。 |
| 实际修改 | 修改 `src/arona-clicker/services/map/map-run-service.ts` 与允许的 `tests/engine/gameplay-b-effect-lifecycle.test.ts`；新增本 Receipt。 |
| 预算 | U11净增约500行，低于负责人放宽的1000行上限。共享 `map-run-service.ts` 当前整体diff包含前置U10已完成的规划/安装修改，估算仅计本Unit条件完成与转换安全增量。 |
| 未完成内容 | 无。 |
| 范围外变更 | 无。本Unit未提交Git，未改U12 validator、其它Unit文件或存档格式。 |
| GALHCG影响闭环 | 只读确认 `project_id=acprogram` 且workspace根路径匹配。直接影响路径按Task约定累积至U19统一只读复核；本轮未改图、refresh或写freshness。 |

## 实际实现

- non-Battle `completion.kind === 'condition'` 在整轮计划的所有来源、费用和资源效果之后，使用最终detached locals判断；全队失败优先，达标结果走既有 `advanceCompletedActivity` 一次。Battle condition 在MapRun Runtime显式拒绝；manual与rounds入口未改变。
- 完成谓词由U06 `planMapEffectSource` 的现有when evaluator求值。MapRun仅递归添加kernel所需的path/mode元数据；不复制递归求值器、不增加programVisits/effectTrace，也不占D08 Action动态预算或completion额外静态节点。真实Registry测试覆盖合法64节点可完成、65节点在Registry拒绝。
- NEW05真实GameInstance Commit使用trust=2/max=3两名自然Party来源各+1，trace实际为+1与0；第二来源先支付supplies=1再获得+2，最终余额2；完成只在该轮末推进，Commit Receipt保留来源结算与locals摘要。实际programVisitCount=3，来源序列仅为两Action的三个真实访问；effectTrace没有completion伪来源。F样例按三次公开Commit达成condition，下一Activity locals回到自身初值且最后一轮Receipt摘要仍可读。
- 全队失败优先于已达condition；失败是合法终局Commit，party HP=0及Counter变化均进入结果，不被当作验证错误拒绝。
- RNG基线复现先通过真实GameInstance Registry/Variant启动和Owner party，随后用同一command/state连续prepare两次且不install：mock `Math.random`调用2次，准备出的下一Activity seed不同。修复后只在 `prepareEncounterRoundCommit` 的terminal-victory跨Activity链从当前Encounter已保存的seed/cursor纯派生下一新Encounter seed；覆盖Battle/rounds/condition胜利，不改变手动 `completeEncounter` 或其它入口。重复prepare结果相同且不触碰全局RNG；Battle Item库存预检失败零安装，补回库存后同command重试推进到同一确定性新Activity。

## 合同映射

| 合同 / 用例 | 证据 |
| --- | --- |
| E1-COMPAT-1 / D05 | 条件只用于non-Battle；全队failure优先，来源队列完成后检查一次，沿活动转换接口推进。Battle条件Runtime拒绝；manual与有限rounds旧入口保留。 |
| NEW05 | trust2/max3两个真实来源分别+1/饱和0；后续付费source仍消费Team cost并安装资源奖励；整轮结算后再转换。 |
| F / locals lifecycle | trust逐轮+1，第三轮后转换；新Activity使用其声明的locals初值，最近轮Receipt摘要保留。 |
| D08 completion边界 | 64个condition语法节点真实Owner可执行并转换；65个由真实Registry拒绝，另以合法Registry Owner party为底座、custom resolver提供65节点Encounter定义，公开Service Preview再次拒绝。Completion读取不伪装Action source、不加入4096动态访问或Receipt来源集合。 |
| failure优先 | 达condition同时全队倒地时，公开Commit结果为failure，HP与Counter计划均已安装。 |
| RNG安全 | 修复前同state prepare两次复现不同seed/两次Math.random；修复后同state prepare可复现且0次Math.random。Item预检失败不安装；同request恢复库存后成功。 |
| OLD/EQ | 既有legacy goldens未改期望；测试保持通过。 |

## 测试与验证

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为与兼容回归 | `npx vitest run tests/engine/gameplay-b-effect-lifecycle.test.ts tests/engine/gameplay-b-effect-program.test.ts tests/engine/gameplay-b-effect-program-commit.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-save-resume.test.ts --silent` | 通过，退出码0；6 files / 56 tests | 包含NEW05、F、64/65 condition界、custom resolver重核、Item预检失败和原golden；4096/4097原用例也通过。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | 在并行U12修复共享validator之后复跑；没有本Unit引入的类型错误。 |
| 架构 | `npm run check:architecture` | 通过，退出码0 |  |
| 空白 | `git --no-pager diff --check` | 通过，退出码0 | 仅有共享树中其它并行文件的CRLF提示。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | 扫描1121篇Markdown，errors=0。 |

## 遇到问题与需上游确认

- 无玩法歧义、白名单外依赖或待上游处理项。
- GALHCG直接影响关系留到U19按父Task统一只读复核；无图写入授权。

## 事实更新建议

- U11依据真实prepare复现将seed修复范围从最初预期的新condition转换扩展到所有 `prepareEncounterRoundCommit` 内terminal-victory的跨Activity转换；具体授权及入口见负责人2026-10-22回覆。
