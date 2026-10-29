# Task 0320-U24 Receipt：实际受伤后的局内资源触发

状态：实现与自动化验证完成；屏幕验收待人工执行。

## 交付结果

| 范围 | 结果 |
| --- | --- |
| 作者合同与 Schema | Trigger event 扩为闭合 `healApplied | damageApplied`；Context 要求同一 Program 存在对应的 primary Heal/Damage，并验证 primaryActor 资源声明。Schema 已重新生成。 |
| Planner | `damageApplied` 只在单体 primary Damage 最终 HP 实际下降时发出。Trigger Trace 的 `requestedAmount` 记录 outgoing modifier 后、Status 减伤/Shield 前请求；`actualAppliedAmount` 记录正值 HP 损失。 |
| 共用队列与 Owner | Heal/Damage hit 按 Program Trace 顺序入同一个 FIFO；每 event 只激活匹配声明，按声明顺序执行。两类激活共用每 Commit 32 次预算与父来源资源账本。 |
| Receipt/Restore | `triggerReceiptVersion: 1` 继续容纳两种 event，不改 Scheduler/Program/Status/Shield 版本。Root Restore 从 Commit 起始快照重算；U24 正式样例可保存恢复 Trigger Trace。 |
| Flow 与正式样例 | Flow 区分实际恢复和实际 HP 损失。`gameplay-b:map:damage-applied-resource-example` 展示 Enemy 对 Serika 造成 HP -1、她获得 `guard +1`，再由她的后序来源读取 guard 攻击训练靶。 |
| 迷你控制台 | 可直接运行完整演练，屏幕命令和人工记录模板见 [[../U24-screen-acceptance-report]]。 |

## 自动化与静态验证

| 验证 | 结果 |
| --- | --- |
| U24a Syntax/Normalizer/Registry/Context/Schema sync 定向测试 | 75/75 通过；`npm run gen:schema` 通过。 |
| `tests/engine/gameplay-b-effect-planner.test.ts` | 52/52 通过；覆盖 Damage request 5 → 减伤 2 → Shield 吸收 1 → 实际 HP 损失 2；无 HP 损失/TargetSet 不触发；Heal/Damage 混合顺序与共用预算。 |
| `tests/engine/gameplay-b-damage-applied-resource-example.test.ts` | 1/1 通过；覆盖真实 Enemy 来源、primary 目标、后序 Actor 余额读取、Commit Receipt 与 Save/Restore。 |
| `tests/ui/map-flow-adapter.test.ts -t "mixed healApplied and damageApplied resource feedback"` | 1 项通过。 |
| 15 文件 U23/U24 与相关 Registry/AG-1/UI/迷你控制台合并回归 | 462/462 通过。 |
| `npx tsc --noEmit --pretty false` | 通过。 |
| `npm run check:architecture` | 通过。 |
| `npm run check:docs` | 通过；扫描 1287 篇 Markdown，0 errors。 |
| `git --no-pager diff --check` | 通过；仅显示既有 CRLF/LF 归一化提示，无空白错误。 |

## 人工验收

未执行浏览器屏幕验收。用户允许在无法操作关卡时提供需求报告单；因此 [[../U24-screen-acceptance-report]] 保持“待人工执行”，不宣称通过。
