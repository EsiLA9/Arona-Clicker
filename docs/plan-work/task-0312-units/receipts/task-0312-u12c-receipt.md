# Receipt 0312-U12C

| 项 | 结果 |
| --- | --- |
| 状态 | 四组 U12C 边界已完成；U12A/B/C 全部定向验收后，仍需负责人联合复核，才可放行 U13。 |
| 修改 | 新增真实 Owner 边界测试；修复一个由冒号 Enemy ID 复现的末值校验缺陷；未改其他文件。 |
| 范围 | 仅新增边界测试、validator 内最小修复和本 Receipt；未改 Owner 恢复、旧 B 测试、生成物、`.workbuddy/` 或 Git 提交。 |
| 行数 | validator 开工基线 1175 行、完成后 1177 行；新测试 384 行；净改动远低于 1000 行登记上限。 |
| GALHCG | 已核项目身份 `project_id=acprogram`；影响累计到 U19 统一只读复核，未改图、refresh 或 freshness。 |

## 已交付边界

- 旧 `cardEffects` 与 program prepare 对同一真实 PlayerCommand CardRef 累计减费：原 sCost 3、总折扣 4、实际折扣截为 3；trace 的实际 zone/receiver 正确，PlayerCommand 仍消耗 1 PlayerCost。
- 四种真实 Enemy skip（被击倒、无合法 CardRef、前序 Enemy 消耗资源后不可支付、Party 终局后 roundEnded）均无 prepare/resolve visits；每种均验证伪造 prepare visit 被拒绝。
- 同一 Enemy Team 资源链包含两个 program event，中间插入另一 Enemy 的真实 cost。真实链 `2→4→3→4` 可通过；平移第二事件的 before/after 但保持 delta 不变会被拒绝。纯 legacy receipt 的 resourceChanges 末值投影被独立改写时会被拒绝。
- 真实 HP ratio guard、HP 截到 0、HP 已为 0 后实际 delta 仍为 0、嵌套 then 路径均通过；分别损坏 ratio cap、已声明路径、零 delta 和当前 HP 末值都会拒绝。

## 修复依据

HP 快照索引使用 `kind:id`，但 `validateCurrentSnapshot` 原先以 `split(':')` 读取 actor ID。带冒号的合法 Enemy ID `robot:alpha` 被截成 `robot`，真实 round 2 快照因此误拒。现按第一个分隔符解析 kind，余下完整字符串作为 ID；U12C HP Owner 正例覆盖此情形。

## 验证

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 定向 | `npx vitest run tests/engine/gameplay-b-effect-receipt-boundaries.test.ts tests/engine/gameplay-b-effect-receipt.test.ts tests/engine/gameplay-b-effect-program.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts --silent` | 4 files / 63 tests 全部通过，退出码 0。 |
| 类型 | `npx tsc --noEmit` | 通过，退出码 0。 |
| 架构 | `npm run check:architecture` | 通过，退出码 0。 |
| 文档 | `npm run check:docs` | 通过，扫描 1131 份 Markdown，errors=0，退出码 0。 |
| 空白 | `git --no-pager diff --check` | 通过，退出码 0；仅有共享工作区既有 Markdown 的 CRLF→LF 提示。新增测试与本 Receipt 的尾随空白检查无命中。 |

## 剩余边界

Receipt 仅证明本 U12C 与父 U12B 覆盖的有界校验。U12A/B/C 联合复核前，不放行 U13；不据此宣称 Save/Load、UI、浏览器或完整 E1 完成。

