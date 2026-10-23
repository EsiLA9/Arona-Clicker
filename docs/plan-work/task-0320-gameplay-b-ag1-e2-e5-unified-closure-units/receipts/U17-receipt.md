# Receipt 0320-U17

| 项 | 内容 |
| --- | --- |
| 状态 | complete；U17a1–U17d2 的窄首片实现与自动化验证完成；人工屏幕验收未执行，需求单已交付 |
| 范围 | AG-1 Party 来源对另一名 Party 当前 Prepared Action 的唯一顶层无条件 damage/heal amount 加一个固定 signed delta；按 AG-1 后序执行、单次 detached plan 与 Restore 重放闭环 |
| 前置版本 | 已核实 scheduler v5、既有 `programReceiptVersion: 1`、Status Receipt v2；U17 不增 scheduler 输入或改排序 |
| Task Owner 冻结 | delta 为非零 safe integer 全范围；负 amount clamp 到0，安全整数溢出拒绝整轮；每来源最多一个 Modifier、每个目标最多一个且不叠加；只含新 Modifier Trace 的 Program Receipt 使用 v2，其他旧 Receipt v1 保持；样例为后序队友治疗卡 `heal +2` |
| 实施进度 | U17a1：AST/Strict Syntax/Normalizer（25/25）；U17a2：Context/Registry/Schema（37/37；Schema 由生成器同步）；U17b：Planner intent/amount（31/31）；U17c1：AG-1 Owner/Receipt/Restore（83/83）；U17c2：ReadModel 投影（3/3；v1 兼容、v2 Trace/候选预览深冻结）；U17d1：UI 候选/预览（40/40）；U17d2：正式示例 Commit/Save/Restore 与目标 defeated/notApplied（58/58）。U17 全部定向测试合计223/223，类型、架构与白名单差异检查通过 |
| 总体状态 | U17 CardRef Modifier 窄首片已完成，不代表 E5 整体完成；Task 0320 仍 active，E4 后片、其他 E5 能力与 P6 仍需合同与施工 |
| GALHCG | 项目身份只读核对为 `acprogram`；未写图、未刷新或写 freshness |

## 冻结边界

- Modifier 来源必须是实际 AG-1 Party source；目标是不同 Party Owner 的真实 Prepared CardRef，且对应排序序号严格晚于 Modifier 来源。
- Modifier 来源 `target.kind` 为 CardRef、`prepare` 为空/省略、`resolve` 仅一条 `cardEffectModifier`。目标 Action 的 `resolve` 仅一条顶层无条件 `damage` 或 `heal`；保留该语句已有 TargetSet 与 repeat。
- 固定路径为 `resolve[0].amount`，固定操作 `add`；不支持任意路径、乘法、同 Owner、Enemy/Ability/Item、叠加或跨回合保存。
- Modifier source 跳过则不登记；目标 source 跳过则记 `notApplied` 与精确原因。本轮结束丢弃。
- 完整 scoped CardRef 与 AG-1 实际 Prepared source 绑定；Commit/Restore 不按 Action ID 猜测或替换目标。

## 审计记录

- 当前 `resolveMapCardEffects()` 专用于 `prepare.discountSCost`，会要求目标存在正 sCost 且来源有 prepare；Planner 没有 CardRef Modifier 输入，因此必须新增专用解析和 pending Modifier ledger，不复用折扣语义。
- 已有 AG-1 `source.cardRef` 与执行序号可作为实际 Prepared 身份证明；CardRef 选择不能仅靠候选列表证明其已被选中。
- UI 候选过滤若无法从现有 ReadModel 获得真实 Prepared 与序号，需要在 U17d 内显式增加投影字段，不由界面自行推断顺序。

## 验证

| 阶段 | 命令/方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| U17a1 AST/语法/归一化 | Syntax + Normalization | 2 个文件、25/25通过；类型检查、定向差异检查通过 | 合法 op 要求 AG-1；固定字段、non-zero safe-integer delta 与字段/语句顺序保持已覆盖 |
| U17a2 Context/Registry/Schema | Registry + Schema sync；`npm run gen:schema` | 2 个测试文件、37/37通过；类型检查、定向差异检查通过；Schema 由生成器更新 | 限定 AG-1 Party Modifier source、card/ally、无 prepare、唯一根 statement；target 候选按另一 Party eligible owner 校验并只要求至少一个单语句 damage/heal 候选；enemy-target damage 和无关 Action 通过 |
| U17b Planner intent/修正 | Planner | 1 个测试文件、31/31通过；三个白名单文件类型与定向差异检查通过 | intent 只含 source key/action/path/delta；目标每个 Value/TargetSet/repeat hit 都记录原始量、delta、修正量与实际 HP 变化 |
| U17c1 AG-1 Owner/Receipt/Restore | AG-1 Commit + Restore | 83/83 通过；类型检查与白名单 `git diff --check` 通过 | 覆盖 applied、sourceSkipped、带精确原因的 target notApplied、完整双方 CardRef/序号和逐 hit amount/HP；Restore 重放并拒绝 CardRef/delta/index/amount/version 篡改；非终局 Program Receipt v2 保存并恢复空 plannedLocals，沿用 v1 successor 语义；只含 AST 的测试 Map 使用 `resumeVersion: 6` |
| U17c2 ReadModel 投影 | Workspace 定向测试 | 3/3 通过；`npx tsc --noEmit` 与白名单 `git diff --check` 通过 | Program Receipt v1 兼容；v2 Modifier Trace/Receipt 深冻结；Prepared source 的候选预览投影 CardRef、damage/heal 与 delta |
| U17d1 | UI 候选与预览 | Workspace 定向测试40/40通过；类型与白名单差异检查通过 | 复用 keyed CardRef Picker；调用 AG-1 scheduler 排序器过滤后序来源；覆盖 agility、roster tie、PlayerCommand CardRef/逻辑序号、stale selection 拒绝；按钮显示目标伤害/治疗与 delta |
| U17d2 | 正式 Map 示例、Commit/Restore | 正式 heal +2 示例、非终局 Save/Restore 与 defeated/notApplied skip 和 AG-1 Restore 合计58/58通过 | 正式 Map 升至 `resumeVersion: 7`；Receipt v2 请求2→4，HP 5→9；当前浏览器人工验收未执行，需求单见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U17-screen-acceptance-report]] |
| U17 全片联合回归 | 10个定向文件、类型、架构、Schema sync、文档与差异 | 223/223通过；Schema sync 15/15；`npx tsc --noEmit --pretty false`、`npm run check:architecture` 通过；`npm run check:docs` 扫描1258篇、0 errors；`git --no-pager diff --check` 通过 | 共享工作区显示既有 CRLF→LF 提示，不影响差异检查退出状态 |

