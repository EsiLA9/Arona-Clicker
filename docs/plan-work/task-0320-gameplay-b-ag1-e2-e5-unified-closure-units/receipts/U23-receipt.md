# Task 0320-U23 Receipt：实际治疗后的局内资源触发

状态：实现与自动化验证完成；屏幕验收待人工执行。

## 交付结果

| 范围 | 结果 |
| --- | --- |
| 作者合同与 Schema | Effect Program 增加闭合 `healApplied` Trigger；只接受同一 Action 的单体 primary Heal 与正向 primaryActor 资源变化。Syntax、Normalizer、AG-1 Context、Registry 与生成 Schema 已同步。 |
| 纯 Planner | 按实际 Heal 增量建立局部事件；按 Heal hit 顺序与 Trigger 声明顺序生成 FIFO Trace/资源意图。零恢复不触发；每 Commit 最多 32 次激活。 |
| Owner 与事务 | Trigger 资源效果加入父来源账本；父来源完成结算后，后序来源可读到奖励。自身来源不可提前读取。预算或余额失败仍拒绝整个 detached Commit。 |
| Receipt 与恢复 | 独立 `triggerReceiptVersion: 1`/`triggerTrace`；不升级 scheduler、Program、Status 或 Shield 版本。Save/Restore 从 Commit 起始快照重算，并拒绝篡改后的 Trace。 |
| ReadModel/Flow 与样例 | 深冻结 Preview/Recent Commit 投影；Flow 显示父 Heal 请求量、实际恢复和资源回馈。正式样例地图演示芹香 9/10 HP 请求治疗 3、恢复 1、获得 focus +1，并让后序来源读取该资源攻击训练靶。 |
| 开发测试台 | 使用 U14g 白名单操作参数运行完整演练；人工屏幕验收步骤与结果模板见 [[../U23-screen-acceptance-report]]。 |

## 自动化验证

| 验证 | 结果 |
| --- | --- |
| U23a syntax/normalization/context/registry/schema-sync 定向测试 | 75/75 通过；`npm run gen:schema` 通过。 |
| `tests/engine/gameplay-b-effect-planner.test.ts` | 48/48 通过；覆盖多 Heal hit 与多 Trigger 顺序、满血/倒地/零恢复 no-op、超出 32 次预算。 |
| `tests/engine/gameplay-b-heal-applied-resource-example.test.ts` | 3/3 通过；覆盖正式 Map、后序来源读取、Save/Restore Trace 重算、Trace 篡改拒绝，以及 34 次激活超预算时 HP/资源/PlayerCost/版本/Receipt 均不安装。 |
| `tests/engine/gameplay-b-map-ag1-commit.test.ts` 与既有 E3/保存恢复回归 | 35 + 3 + 9 项通过。 |
| `tests/engine/gameplay-b-map-ag1-restore.test.ts` | 57/57 通过。 |
| `tests/ui/map-flow-adapter.test.ts -t "healApplied resource feedback"` | 1 项通过。 |
| 14 文件合并定向回归（Syntax/Normalizer/Registry/Schema、Planner、样例 Owner/Restore、AG-1 Commit/Restore/Save、ReadModel、Runtime/UI、迷你控制台） | 457/457 通过。 |
| `npx tsc --noEmit --pretty false` | 通过。 |
| `npm run check:architecture` | 通过。 |
| `npm run check:docs` | 通过；扫描 1284 篇 Markdown，0 errors。 |
| `git --no-pager diff --check` | 通过；仅显示既有 CRLF/LF 归一化提示，无空白错误。 |

## 人工验收

未执行浏览器屏幕验收。用户允许在无法操作关卡时提供需求报告单；因此 [[../U23-screen-acceptance-report]] 保持“待人工执行”，不宣称通过。
