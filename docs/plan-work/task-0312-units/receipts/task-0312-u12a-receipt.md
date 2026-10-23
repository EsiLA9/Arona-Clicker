# Receipt 0312-U12A

| 项 | 内容 |
| --- | --- |
| 状态 | U12A核心实现与指定验证完成；U12总体未完成，等待U12B。 |
| 实际修改 | 新增 `src/arona-clicker/services/map/map-effect-receipt-validator.ts`、`tests/engine/gameplay-b-effect-receipt.test.ts` 与本Receipt。 |
| 实际行数 | validator 584行、行为测试143行、本Receipt 38行，合计765行，低于U12A的850行目标及1000行上限。 |
| 未完成内容 | A仅验证当前全program Receipt。合法legacy/program混合source仍被拒绝；HP日志与plannedLocals对照需修正；完整then/else访问walk、地图来源许可、运行时缺trace拒绝、声明顺序Source校验、program间legacy HP相位插入、跨资源账户余额链、legacy/program组合折扣及当前HP/资源末值完整核验均留U12B。A不声明具备完整U12恢复验证能力。 |
| 范围外变更 | 无；未改Owner恢复、MapRun、U11或其它测试，没有提交Git。 |
| GALHCG影响闭环 | 已核项目身份 `project_id=acprogram`，根目录匹配；直接影响路径累计至U19统一只读复核，未改图、refresh或写freshness。 |

## A实际能力

- `validateMapEffectCommitReceipt(value, context)`接收opaque `unknown`，使用当前Map/Encounter Action定义与父Run可信 `context.runId` 校验E1版本、Scope、selected source/action、规范化声明path/op、预算、prepare CardRef与折扣/费用投影、guard逻辑/实际读值/短路访问、HP/Counter/Flag算术及内部链、资源事件与分组投影、plannedLocals；当前仍活着且node/activity相同的紧接一轮可核locals末值。
- 真实Runtime/Registry创建Owner与MapRun，使用Owner生成的CardRef选择目标后安装成功Receipt作正例；覆盖多层all/any/not guard（读取序列按实际postorder检查，visit路径按preorder检查）、跨Party source Counter连续性、资源settlement实际delta和可信父Run。32项定向测试包含独立篡改、预算与输入不变检查。HP格式/单条算术代码已实现，但A没有真实HP Receipt正例；混合branch/source、资源链与末值对应留B。
- A不造真实历史起始HP/locals，不把首个trace before/read说成历史真值；不重施费用或库存，也不创建Owner或接入恢复。有效legacy/program混合被拒及跨program资源账户连续链尚未证实，由B完成并复测。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/gameplay-b-effect-receipt.test.ts --silent` | 通过，退出码0 | 1 file / 32 tests；含1个真实Receipt正例与31项独立篡改、budget及输入不变检查。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | 全局检查。 |
| 架构 | `npm run check:architecture` | 通过，退出码0 | 无基础层反向依赖或新增写入口。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | Receipt写入后扫描1124篇Markdown，errors=0。 |
| 空白 | `git --no-pager diff --check`及3个新增文件尾随空白扫描 | 通过，退出码0 | 仅报告工作树既有schema脚本与测试文件CRLF提示；新增文件无尾随空白。 |

## 遇到问题

- 根审查确认A的正例是纯program Receipt；合法legacy source与program交织及资源跨事件余额链尚未覆盖，故依负责人于2026-10-22拆分安排转U12B继续，不把A的定向通过扩写成U12完成。

## 需上游确认项

- 无新增玩法/架构待裁项；U13必须等待U12B完成Receipt并验收完整混合链能力。

## 事实更新建议

- U13调用入口需传入可信checkpoint Run身份作为 `context.runId`，不可仅信Receipt自报的 `effectScope.runId`；当前API只校验Receipt，不接Owner恢复流程。
