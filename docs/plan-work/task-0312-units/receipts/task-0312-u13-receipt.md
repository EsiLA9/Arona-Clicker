# Receipt 0312-U13

| 项 | 内容 |
| --- | --- |
| 状态 | U13 Owner/Save/Resume 接线与公开场景完成；不代表 U18/U19 完整 E1 发布验收。 |
| 实际修改 | 修改 `src/arona-clicker/services/map/map-run-service.ts`；新增 `tests/engine/gameplay-b-effect-save-resume.test.ts`；新增本 Receipt。未修改 `contracts/map-run.ts`、通用 SaveData 版本或 codec。 |
| 未完成内容 | 本 Unit 无未完成项。U18/U19 的完整 E1 验收仍按总 Task 计划进行。 |
| 范围外变更 | 无；修改限于 U13 白名单。 |
| GALHCG 影响闭环 | 项目身份已核对为 `acprogram`；本 Unit 影响纳入 U19 统一只读复核，未编辑图、刷新或写 freshness。 |

## 实际接线

- `activeEncounter.locals` 按当前 activity 的声明严格解码并复制；声明存在但字段缺失、类型错误、界外值或未知键均拒绝。无 locals 声明的 Encounter 不接受非空 locals。
- Owner 恢复 E1 Receipt 时保留旧字段、费用、目标、Wait/skip、PlayerCost、Item 次数和版本检查，再调用 U12 Receipt validator 校验 E1 访问记录、资源事件、HP 投影、Trace、Scope 与 locals。
- 对 Program Action，Owner 仍重建并核对旧费用投影；Program resource/HP 投影保留后交由 E1 validator 做完整核对。旧 Action 继续沿原投影校验路径。
- 活跃 Encounter 的最近 Receipt 校验获得恢复后的 Encounter locals、HP 与 Actor/Team 余额；切换到新 activity 后保留并内部校验上一 activity 的顶层 Receipt，不拿新 activity 状态当旧末值。恢复时仍核对顶层与 activeEncounter 回执相等。
- 新 Receipt 固定为 `programReceiptVersion: 1`、`executionContractId: E1-COMPAT-1`。MapRun checkpoint 继续使用已有 `resumeVersion` 边界；SaveData 顶层版本与通用 codec 未变，没有旧档迁移。

## 行为覆盖与 ID 映射

| 映射 | 本 Unit 验证 |
| --- | --- |
| OLD01 | 既有回执、Map 保存恢复、来源事务回归继续通过；另覆盖损坏的 PlayerCost 与 Wait 目标仍被 Owner 拒绝。 |
| EQ05 | 真实 `GameInstance.save/load` 恢复 E1 locals/trace、合法 Item 草稿与上一 activity Receipt；Item 只扣一次、统计和库存事件只记一次，精确重放幂等，冲突 request 拒绝。损坏的 Scope、版本、Trace path 与 visit 数量拒绝。 |
| NEW03 / NEW04 | trust 从 2 增加至上限 3；同轮第二个来源的增量为 0。Flag 在同轮反复写入后保存并恢复最终值。 |
| NEW05（E1 部分） | 完整 Talk 轮次后满足完成条件并进入 Battle activity；从 Save/Load 恢复后与同一原始运行不间断提交结果相等。未覆盖 AG 即时终局。 |
| NEW07 / D07 / D08（Owner 边界） | 恢复端拒绝非法 Receipt 版本、Scope、Trace path 与 visit count；U12 Receipt validator 负责既有 statement/guard/链校验。本 Unit 不替代 U12 的预算边界测试。 |

另覆盖真实 Enemy `robot:alpha` HP 从 2 截到 0、其后实际 delta=0，混合 legacy Team resource effect 与 E1 HP/Flag/Item 记录，以及损坏 locals 导致 MapRun 快照不安装。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/gameplay-b-effect-save-resume.test.ts tests/engine/gameplay-b-effect-receipt.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts --silent` | 通过，4 files / 55 tests，退出码 0。 | 含 U13 两项公开 Save/Load Owner 用例与旧回归。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码 0。 |  |
| 架构 | `npm run check:architecture` | 通过，退出码 0。 | 无新增基础层反向依赖。 |
| 文档 | `npm run check:docs` | 通过，扫描 1132 份 Markdown，errors=0，退出码 0。 | Receipt 写入后复核。 |
| 范围 / 空白 | `git --no-pager diff --check`；`rg -n "[ \\t]+$"` 检查新增测试与 Receipt | 通过，退出码 0；新增文件无尾随空白。 | Git 输出仅提示两个共享既有 Markdown 文件的 CRLF→LF 规范化。 |
| 人工验收 | 检查 Owner 仍以既有 MapRun 为唯一安装入口；新存档恢复拒绝时 `mapRun.getSnapshot()` 为空。 | 通过。 | 真实 GameInstance Save/Load 测试验证。 |

## 遇到问题

- 旧 Owner Receipt parser 在 Program Action 上无 E1 plan 时会尝试重算全量 legacy resource projection，并因无对应 plan 而拒绝合法 E1 Receipt。保留旧费用/结构校验，Program effects 转交已完成 U12 的 validator 核验后恢复。
- Program Action 的 HP settlement 不能根据 legacy `action.hpEffects` 重建；其实际投影由 Receipt trace 校验。Owner 先核目标身份和数据形状，再由 U12 validator 核实际 HP 链。

## 需上游确认项

- 无。

## 事实更新建议

- U13 新 E1 回执采用 Receipt version 1 与 `E1-COMPAT-1`；checkpoint 兼容性仍由现有 MapRun `resumeVersion` 管理。完整 E1 发布与 GALHCG 统一复核留给 U18/U19。
