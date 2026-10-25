# Draft 0327：可复现的本地验收控制台

状态：design — 2026-10-24。用户要求设计控制台参数，解决验收反复卡在剧情、角色领取与前置资源的问题。本文定义建议合同，尚未实现这些新命令；现有 `devConsole=gameplay-b`、`getValue`、`startMap` 仍按当前源码工作。

## 目标与已核事实

一次准备命令能把游戏放到明确的验收起点，再用真实界面检验目标行为。准备内容和实际验收动作分别记录；刷新后能够复现准备起点，测试存档又能恢复已经进行的战斗。

当前 `src/ui/main.ts` 仅在开发构建且 `devConsole=gameplay-b` 时挂载试玩台。`gameplay-b-quick-test-console.ts` 已支持 `getValue`、角色投送、`startMap --enter-office --move-to --ability --target-* --commit-rounds`。它缺少剧情推进、培养、场所入口和统一前置预设。`--enter-office` 只进入世界线，会正常触发开场剧情。

`tests/engine/story-test-fixtures.ts:finishStory` 已证明可以用当前 Story token 经 `advanceStory/clickSend` 推进正文和点击；开发实现需成为正式开发模块，不能从测试目录导入。`SaveSystem` 当前使用固定 `acprogram_save`，试玩台“仅内存”文案不能保证手动保存或其他保存入口不会写正常槽；验收模式需显式独立存储。

## 一、启动参数只负责环境和复现

建议启动形式：

```text
?devConsole=gameplay-b&devCase=variant-training&devState=fresh&devAt=spot&devOwned=basic
```

| 参数 | 固定值与默认 | 行为 |
| --- | --- | --- |
| `devConsole` | `gameplay-b` | 沿用现有开发开关；非开发构建不解释其他验收参数 |
| `devCase` | 首期 `variant-training` | 选择代码白名单内、带修订号的验收预设 |
| `devState` | `fresh` 默认；`resume` | fresh 新建该测试会话；resume 只读独立测试槽，缺档明确报错，不自动重做准备 |
| `devAt` | `spot` 默认；`battle-1`、`battle-2-mid`、`battle-3-mid` | 指定准备终点；除 spot 外，均通过真实入口与战斗命令推进，不改节点游标 |
| `devOwned` | `basic` 默认；`advanced`、`missing` | 测试账号中的精确 Hoshino 持有/培养预设；missing 只允许停在 spot，验证拒绝入场 |

未知值、重复参数和冲突组合在改状态前拒绝。`resume` 与 `devAt/devOwned` 不同时使用：恢复已有档案不重新领取、培养、回血、抽牌或推进战次。

验收模式从 UI mount 前启用独立的测试存档槽和测试包库；不恢复或写入正常包配置。默认使用当前捆绑内容，记录内容版本与摘要，避免旧包缓存静默替换本轮源码。测试槽使用 sessionStorage 或独立有前缀的存储 adapter；全页面的 save/load/export/import 统一指向它，不能只拦控制台自己的保存按钮。正常启动行为保持现状。

首期不提供尚未由引擎支持的随机种子参数。需要精确复盘 Hand/RNG 时保存真实 MapRun 快照。

## 二、主命令是准备预设

```text
prepare variant-training --story finish --owned basic --at spot
prepare variant-training --story finish --owned advanced --at spot
prepare variant-training --story finish --owned missing --at spot
prepare variant-training --story finish --owned basic --at battle-2-mid
```

`prepare` 只对已启用的验收测试会话工作。预设按顺序：核对内容 → 进入夏莱办公室 → 推进前置剧情 → 准备角色与资源 → 打开指定场所或推进指定战斗。默认从空测试会话构建，重复相同命令得到相同的领域起点；不会通过重复领取增加碎片、重复完成剧情奖励或累加培养。

当前有活动 Run 或未保存测试进度时拒绝覆盖，要求显式 `--reset-test` 才重建测试会话。该参数只清当前测试会话，不删正常存档。

首期 `variant-training@1` 的预设内容：

- `basic`：精确 Hoshino，Lv.1、星级0、好感Lv.1，使用当前可信转译规则得到10HP/基础敏捷2。
- `advanced`：精确 Hoshino，经真实培养接口达到当前增强阈值；建议Lv.15、好感Lv.3、星级0，规则输入50，对应16HP/基础敏捷6。若账号/曲线 cap 不支持，明确准备失败，不直接写培养字段。
- `missing`：不持有 Hoshino，不授予其他同 Chara Variant 替代；保留 Spot 供用户点击并验证拒绝。
- 默认不投送演练不需要的信用点。培养或其他预设确实需要的资源、道具、账号上限由预设逐项声明，并在回执列出；不使用无限资源。
- `spot`：停在夏莱主区，保留「进入演练场」按钮等待真实点击；不暗开地图。
- `battle-1`：通过同一个 `enterVariantTraining(spotId,functionalityId)` 开始第一战。
- `battle-2-mid / battle-3-mid`：通过真实选牌、目标、提交和节点继续，完成此前战斗，再在指定战斗提交一回合后停下；不重造三个 owner。

如果未来培养规则调整，提升预设修订并记录新终态；不能让同一预设名称默默代表不同数值。运行回执带准确修订。

## 三、保留少量单项命令

| 命令 | 用途与边界 |
| --- | --- |
| `story finish --owner global --max-steps 200` | 只推进当前 owner 已启动的链；正文确认、点击次数、operation 与奖励走当前 token 和原服务 |
| `story finish --owner Hoshino --choice <choiceId>` | 指定分支；遇到未指定选项、不可用选项、外部交付、地图/场所操作或无进展时停止并回报 blocker；默认不替用户选第一项 |
| `getValue base:resource:credit 10000` | 沿用当前资源增量命令，明确显示实际增量与所属世界线 |
| `cultivate Hoshino --exp 11000 --affection-exp 30` | 经现有培养/好感接口增加，显示 cap 和实际等级；不允许给未持有角色培养，不静默绕过上限 |
| `enterSpot base:spot:variant_training --function base:funclet:variant_training_entry` | 复用正式领域入口校验和真实 map 路由；不能调用普通 startMap 绕开转译确认 |
| `checkpoint save <name>` / `checkpoint load <name>` | 对完整产品 SaveData 做 JSON 往返，使用独立测试槽；不使用旧训练 Modal 的内存检查点替代 |
| `inspect acceptance` | 显示预设修订、内容摘要、Init/Area、剧情 blocker、精确 Variant/培养、活动 Run/节点/回合/提交版本、存档槽 |

`story finish` 不是直接写 completedStory：需要真实执行 operation、奖励与收尾，并确认无残留演出/输入锁。只为前置流程选择固定且已声明的选择项；一般剧情遇到选择就停止。步数1–200，无进展或超过上限都报错，已执行步骤不伪装为全部成功。

继续使用现有 `startMap ... --move-to ... --commit-rounds ...` 验证普通静态地图；演练场使用 `prepare/enterSpot`。不新增任意 JavaScript、任意 JSON 状态覆盖、假持有或无视边条件的 teleport。

## 四、每次必须给出可核对回执

一条简短结果，例如：

```text
READY · variant-training@1 · fresh · spot
已执行：夏莱开局 → 前置剧情完成 → Hoshino领取 → 培养核对
终态：夏莱主区；Hoshino Lv.1 / 星0 / 好感1；无活动地图
待验收：点击「进入演练场」；准备步骤不计入入口验收
测试存档槽：acceptance:variant-training:tab-session
```

失败显示 `BLOCKED`、已执行到哪一步、当前真实状态、准确阻塞原因；不得给出“已进入”但后台剧情仍锁住界面的结果。`resume` 显示恢复的 Run/战次/回合，不打印 fresh 的准备成功回执。

## 五、施工与验收建议

1. 参数解析、版本化预设与严格回执：独立 development 模块；非法参数零变更，生产构建无入口。
2. 统一测试存储 adapter 与启动顺序：先隔离存档/包库，再创建 Runtime、装载可信内容、执行预设、挂载 UI；刷新 resume 不重复准备。
3. Story/培养/Spot 的有界操作适配与控制台接线，沿用现有控件样式。
4. 用真实场景验证：一链接到 Spot → 单次点击进第一战；另一链接到第二战中途 → 保存/刷新/resume，保持HP/Hand/草稿/RNG/版本；missing验证拒绝。再跑正常启动/正常存档回归。

以上为设计范围，不把三战本身的入口、培养或战斗正确性替换成预设成功。原功能施工继续由 [[docs/plan-work/archive/task-0326-variant-translation-real-card-workspace]] 记录。
