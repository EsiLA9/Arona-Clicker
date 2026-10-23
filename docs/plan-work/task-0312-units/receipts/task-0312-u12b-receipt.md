# Receipt 0312-U12B

| 项 | 结果 |
| --- | --- |
| 状态 | B局部实现与验证完成；四组未覆盖行为已按负责人决定转U12C。U12整体仍未完成，不能放行U13 Owner恢复。 |
| 修改 | 仅修改validator、既有effect-receipt.test.ts与本Receipt；未提交Git。 |
| 文件物理行数 | 负责人以`(Get-Content -LiteralPath ...).Count`复核：validator 1175行、测试470行、Receipt 35行；A基线584+143，B相对A净增591+327+35=953行，低于1000上限。代理此前1139/447/26为排除空行的计数，不能作为物理行数。C以validator1175行为增量基线。 |
| GALHCG | 已按 `project_id=acprogram` 核对身份；影响累计U19统一只读复核，未改图、refresh或freshness。 |

## 已交付行为

- `validateMapEffectCommitReceipt(value, context)`保留opaque输入与可信`context.runId`。拒绝未知根/嵌套字段、坏Scope/身份、来源候选及声明顺序不符；PartyCommand仍须是participant.actions候选。
- 访问walk按真实planner顺序重建：Party prepare后Party resolve、Ability/Item program resolve，再逐Enemy prepare→resolve。旧/新prepare投影按Party聚合及Enemy仅影响后续Enemy的时相核对；CardRef须为合法候选、符合目标side和sCost条件，receiver与当前选中卡一致。未选Hand候选真实正例的receiver为null。
- HP内部链保留Party→legacy Ability→Enemy program和Item program→legacy Ability时相；校验guard读值、statement path、分支、截界与actual delta。真实后续Activity round 1测试证明不会把地图初始HP当作跨活动Party历史。
- 资源projection按Party/Ability/Item聚合cost、依序结算effect，Enemy逐source核cost与effect；legacy变化插入program事件之间。活跃同Activity紧下一轮须提供所有触及账户的可信末值，缺失或null拒绝；切Activity时只核旧Receipt内部链，不用新Activity余额作旧末值。
- `plannedLocals`必须是且仅是Counter/Flag对象；Round 1 Encounter locals与Enemy起始HP可按定义锚定，Party HP保留为有界trace witness，不声称拥有完整历史Owner。

## 定向Owner证据

- 39项测试通过：A原32项，加真实未选Hand receiver=null及未知CardRef拒绝、同步重写then→else的program→legacy→program HP链拒绝、Item guard先读HP再执行legacy Ability heal、Party/Ability/Item同账户穿插资源链与第二事件平移拒绝、Enemy prepare仅折后续Enemy、malformed plannedLocals拒绝、legacy-only末值缺余额拒绝、跨Activity携带HP/资源正例、同步未知sourceKey不抛异常。
- E1跨Run输入：调用方须从可信checkpoint提供`context.runId`。当前Encounter同node/activity紧接下一轮时，同时提供`currentEncounter`及完整`currentBalances`；校验器不读取或重放历史Owner，也不迁移/重施费用或库存。

## 验证

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 定向 | `npx vitest run tests/engine/gameplay-b-effect-receipt.test.ts --silent` | 通过，1 file / 39 tests，退出码0。 |
| 类型 | `npx tsc --noEmit` | 通过，退出码0。 |
| 架构 | `npm run check:architecture` | 通过，退出码0。 |
| 文档 | `npm run check:docs` | 通过，错误0，扫描1129份Markdown。 |
| 空白 | `git --no-pager diff --check` | 通过，退出码0；仅报告其他共享文档的CRLF提示。 |

## 转U12C的必测边界

U12C继续真实Owner行为与独立篡改：旧+program prepare叠加并截断到原sCost；skip Enemy程序来源零访问；同一资源账户在program事件之间插入Enemy cost；HP ratio、clamp到0与HP0实际零delta。B Receipt与U12C完成后才构成U12完整验收。其余恢复接线仍归U13；U12B未接Owner恢复。
