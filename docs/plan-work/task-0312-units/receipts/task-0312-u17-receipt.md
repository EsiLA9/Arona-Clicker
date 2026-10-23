# Receipt 0312-U17

后续迁移提示（2026-10-22）：本 Receipt 记录 U17 初次交付时旧／新 Action 并列的历史状态。作者指南已由 Task 0315 更新为当前 `effectProgram` 合同，旧数组对照已移除；当前示例以 [[docs/examples/gameplay-b-effect-program-e1]] 为准，迁移矩阵见 [[docs/plan-work/task-0315-units/receipts/task-0315-u04-receipt]]。下方 U17 结果仍保持其原始交付事实。

| 项 | 内容 |
| --- | --- |
| 状态 | 实现与定向行为完成；负责人已核源码/数值/真实Registry Variant与入口，并于2026-10-22在并行错误修复后复验全局类型通过，U17局部验收通过。U13 Save/Load、U15 ReadModel、U16 UI 和 U18 浏览器纵向验收仍未完成，不由本Receipt宣称完成。 |
| 实际修改 | 新增 `src/arona-clicker/content/gameplay-b/gameplay-b-effect-program-example.ts`、`tests/data/gameplay-b-effect-example.test.ts`、`docs/examples/gameplay-b-effect-program-e1.md`、本Receipt；修改 `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts` 与白名单扩展的 `tests/data/gameplay-b-effect-registry.test.ts`。共6个路径。 |
| 净改动 | 本Unit五个主体路径约407行净增（411增、4删）；Receipt 43行；总计约450行，低于500行预算。 |
| 范围 | 新例图以五个有序activity对照旧/新射击、真实Hand CardRef折扣、费用与奖励、4/10及5/10包扎、trust多来源条件交涉。地图终端追加一个入口；原八张Map的定义与版本未改，未新增或启用另一个bundle。没有Save/ReadModel/UI/浏览器改动。 |
| GALHCG | 项目身份此前核对为 `acprogram`。影响路径累积留U19统一只读复核；本Unit未改图、refresh或写freshness。未提交Git，未改 `.workbuddy/`。 |

## 实际行为与作者资料

- **A / OLD01、EQ01：** 例图先以旧 `hpEffects` Action、再以 E1 `hpChange` Action各造成主目标 3 点伤害，二者声明执行者 sCost 费用均为 1。新式射击被 E 折扣后实际支出为 0；测试确认真实受用卡引用及旧式对照的余额结果。
- **B / EQ02、NEW02：** 掩护射击先核算执行者弹药费用，再造成 2 点主目标伤害并令 sourceActor 弹药 +1。Shiroko 从 0 起步而不可支付，Serika 从 1 起步并能执行；奖励不会垫付轮初费用。
- **C / NEW01：** 两人以初始 HP 4/10、5/10进入包扎 activity。`hpAtMost 4` 位于治疗之前：4/10 来源使 Team 急救包 +1 后治疗 3；5/10 来源治疗 3 但不领奖励。作者指南另列相同 guard 移到治疗之后的完整片段：HP 先变成 7/10 与 8/10，再判断 `hpAtMost 4`，两者均不奖励。
- **E：** 准备 Action 通过 MapRun Owner 当前 Serika Hand 中的 `precision-shot` CardRef 设置目标；真实 Preview 记录 1 点折扣，射击成本降为 0，Serika 的剩余 sCost 保持 1。
- **F / NEW03、NEW04、NEW05(E1部分)：** trust 初值 0、范围 0–3；两人每轮各交涉 +1。第1轮后 trust=2，可作为U18保存点；本Unit没有执行Save/Load。继续整轮后实际Counter变化为 +1、0，整轮报告奖励均结算，trust=3并完成 activity。Flag初值为 false，完成状态保留在本 Encounter 生命周期内。
- 作者指南说明 E1 字段/时点、费用与资源账户、Counter饱和、Flag寿命、source/primary/Actorless差异、真实CardRef和 `resumeVersion` 规则；不涉及资源条件、AG、Status 或 Pool。

## 用例与验证

| 合同 / ID | 本Unit证据与边界 |
| --- | --- |
| OLD01 / EQ01 | 同一合法Map中保留旧数组 Action 并新增等值程序 Action；没有批量迁移既有八张Map。 |
| EQ02 / NEW02 | 例图以真实Owner结算掩护射击；费用从起始Actor余额核算。测试观察到初始0仍为0、初始1经−1与+1后为1。 |
| NEW01 | Owner按声明顺序结算 guard 与 HP；4/10奖励、5/10无奖励，均实际治疗3点。后置guard的同条件结果在作者指南中给出。 |
| NEW03 / NEW04 | trust共享Counter饱和产生实际 +1、0；Flag通过合法 Registry 校验，交涉 Activity 在整轮后完成。未验证 Save/Load。 |
| NEW05（E1部分） | Owner 完整结算多人交涉来源及 Team 奖励后检查条件；不涉及 AG 即时终止或排序。 |
| NEW06 / D06 | `defaultDatapack` 与 gameplay-b bundle 经真实 `Registry.load`；Registry Map resolver 返回已验证例图；Owner party 使用 Registry 中按 `proto` 找出的真实 Variant。 |
| Registry gate 同步 | 更新既有测试末尾临时 `not implemented` gate：未声明 Flag 仍在自定义 resolver 路径拒绝且快照零写；合法 condition completion 可 Preview/Commit，trust=0 时继续下一轮且未完成。未改其它 OLD 期望。 |

| 验证 | 命令 | 结果 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/data/gameplay-b-effect-example.test.ts tests/data/gameplay-b-effect-registry.test.ts tests/data/gameplay-b-map-registry.test.ts` | 通过，3 files / 145 tests，退出码 0。 |
| 类型 | `npx tsc --noEmit` | 负责人最终复验退出码0，通过。代理此前执行退出码1，仅并行validator的info窄化/重复source，现已修复；保留该历史，不将当时失败写为通过。 |
| 文档 | `npm run check:docs` | 通过，扫描1128篇 Markdown，errors=0，退出码 0。 |
| 空白 | `git --no-pager diff --check` | 退出码 0；新增和本Unit编辑文本尾随空白检查无命中。 |

## 未完成与接续

- 当前内容和Owner例图加载/动作路径已实际验证；负责人已在并行类型错误修复后复验全树通过。
- 负责人交接联合检查首次发现新增例图resumeVersion=1触及旧Save回归的包内最低3断言；仅将新例图及其对应新测试改为3，旧八图版本/正文及旧测试期望不变。修正后联合复验结果见交接记录。
- 未执行实际浏览器操作、Save/Load、Runtime ReadModel/UI或 U18 全链验收；作者指南的“trust=2 保存后继续”是可复现步骤与数据设置，不是本Unit的Save/Load证据。
- U13、U15、U16与U18后续仍须各自Receipt、测试及规定证据；E1整体和AG前置解除仍未完成。
