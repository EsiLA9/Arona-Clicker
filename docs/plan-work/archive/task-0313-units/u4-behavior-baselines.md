# Unit 0313-U4：样例推演与回归基准

状态：complete — 行为文档推演完成，未运行新功能；实际交付见 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u4-receipt]]。

## Goal

产出可直接转自动化测试的旧行为基准、E1等价与敏捷新行为用例，裁定未批时保留完整分支期望。

## Must Read / Read Set

先读 [[docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission]] 和 [[docs/ai/PROJECT-CONSTITUTION]]；只读下表命中段落，不整文件堆入上下文。表中未写完整前缀的services/contracts/runtime相邻路径均在 `src/arona-clicker/`，engine测试相邻文件均在 `tests/engine/`。

| 类型 | 路径／符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | 本Task §3/§5、U1证据、U2/U3写回的Draft0312／Task0312 | 用例必须引用合同ID及版本 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`：explicit target、automatic retarget、PlayerCommand skip、Enemy顺序与defeat用例 | 取最小当前输入与旧期望 |
| 测试 | `tests/engine/gameplay-b-map-cards.test.ts`；`gameplay-b-map-source-transactions.test.ts` | 折扣、换牌、Ability/Item、跨Owner |
| 测试 | `tests/engine/gameplay-b-map-save-resume.test.ts`；`tests/data/gameplay-b-map-registry.test.ts` | 保存完整性与作者负例 |
| 源码 | 仅在用例期望不明时重读U1涉及的planner/restore/target/fee对应分支 | 不引入独立原型执行器 |

## Context Budget

| 项 | 预算／规则 |
| --- | --- |
| 目标上下文 | 20k–40k token，按函数／命名测试分段读取；工具输出计入 |
| 文档 Read Set | 3–8篇命中段落；Unit/Receipt只读所依赖的结论 |
| 历史文档 | 默认0；仅U1明确指定Report0311历史快照和必要0309证据 |
| 超预算处理 | 超60k先交上游缩小／拆分，不全仓扫描；净修改≤500行、文件≤5 |

## Optional Read Set

具体输入不足时只再读同一测试文件的共享fixture定义；不要引入旧Operation样例代替MapRun。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本Unit明确指定的直接证据除外）。
- 旧Operation/EventRun CardPool、无关Engine Effect／Trigger全实现、整个UI或独立编辑器。
- 生成Schema、构建产物、依赖目录和全仓历史。

## Confirmed Facts

| 事实 | 依据（路径／符号） | 备注 |
| --- | --- | --- |
| 新Counter/when/Agility尚未实现 | gameplay-map.ts与当前MapRunService | 新用例只能是设计期望，不冒充测试已通过 |
| 既有测试覆盖折扣幂等、目标fallback与外部事务 | map-cards、map-run、source-transactions命名用例 | 以当前输入为旧基准，不用新语法伪造旧运行 |

## Constraints

- 本Unit创建时仅列说明；本轮已执行E0文档推演，结果见Receipt。
- 遵循本Task裁定状态和A01–A06；人类批准须有原话／日期／来源，AI推荐不算批准。
- 当前事实冲突按停止条件交上游；未批分歧按既定任务要求记录有限方案，不自行选定，不因等待批准而伪造完成。
- Owner／存档／声明式边界按 [[docs/docs-829/05-conventions/architecture-discipline]]，文档状态按 [[docs/ai/goal-workflow]]。

## Allowed Files

- `docs/plan-work/archive/task-0313-units/behavior-cases.md`
- `docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission.md`
- `docs/plan-work/archive/task-0313-units/receipts/task-0313-u4-receipt.md`

只允许新增列明未来产物／自己的Receipt，更新Task只写实际进度、证据及本Unit授权结论；不扩大其它Unit范围。不编辑产品源码、产品测试、数据包、Schema或协作协议。

## Explicit Non-goals

- 执行E1或敏捷Runtime、写测试实现／原型调度器、修改已有数据或准备页。
- 全局Action Registry、共享模板、通用注入、外部成长Adapter、第二Owner／完整历史状态系统。
- 为消除既有检查错误而修无关文档，或代替人类批准玩法。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 六条：越白名单／新增未列路径／超预算；Read Set外新增阅读超过2文件；事实冲突；实现需要未裁定选型或扩范围；必需验证失败／不可解释。中断写Receipt与缺失信息，只暂停受影响工作，由上游更新边界后续行。

待批选项可按本Unit规定产出“方案+差异+推荐+阻塞ID”，这是设计文档的完成方式，不是允许施工代理替人类定案。既有check:docs八处错误若前后一致，按Task基线口径记录，不自动触发无关修复。

## Work Items

1. 创建behavior-cases.md，分为OLD（当前真实行为）、E1-EQ（旧表达经新规范化后应等价）、AG（敏捷有意变化），另列E1-NEW（when/locals等新功能）；不得把OLD与AG用同一个“无回归”结论覆盖。
2. 每例写完整可构造输入：Map/Encounter及source的最小ID、HP/上限、资源键/余额、locals声明、Hand/Prepared/target、PlayerCost、库存及item condition、种子/cursor、draft/commit版本；可引用现有fixture并列覆盖字段，不能只写“普通射击正常”。
3. 每例逐步写：采用的合同ID/规则版本、排序键及顺序、当时主目标、执行/skip、Actor/Team/PlayerCost/库存扣除、HP/locals实际delta、terminal、Receipt摘要、重复Preview零写、重放零重复。与保存相关的例写加载前后相同的可观察结果。
4. 以下是最低用例矩阵；数字只定义测试场景，不是平衡批准。待批规则给候选A/B各自的精确输出，不允许用“待定”代替期望结果。用例与当前测试的映射、未来新增测试候选路径写在每例结尾。
5. 对每个D01–D12登记至少一个正例及必要负例；来源矩阵每行、错误与skip类别、边界预算不得出现空白覆盖。无需为每个组合笛卡尔展开。
6. 只编辑文档，不新增fixture代码、排序原型或自动化测试。确需执行现有定位测试可用U1同名文件单测过滤，记录实际命令与结果；不重复运行无变化的整套基线。

最低样例矩阵：

| 用例ID | 必须使用的输入与区分点 | 输出要求 |
| --- | --- | --- |
| OLD01/EQ01 射击 | 攻击−3、弹药费1、目标HP5、余额1；旧与新表达 | 相同费用/HP/Receipt/回放，等价比较不启用敏捷 |
| NEW01 条件治疗 | HP4/10、5/10，治疗3且低半血奖励；guard分别放heal前后 | 各方案明确奖励有无/实际delta；then/else只走一支 |
| NEW02 资源恢复 | 起始Team0、恢复+1、另行动费用1 | 不同费用政策分别拒绝/允许的完整状态；E1与AG不能混称 |
| NEW03 Counter饱和 | trust2、min0/max3，两源各+1 | clamp→3并记录+1/+0；reject→整轮零安装；显式策略列两种，何时结束另依D05 |
| NEW04 Counter边界 | 当前0再−1、initial4/max3、安全整数极大加法、Flag false→true→false | 缺省/负值/溢出/重复写/严格布尔逐项裁定输出 |
| AG01 上限/先后 | base2+actor10、cap5，对手final6 | 按获批公式计算上限不破，final6在前；不增行动或改费用/数值 |
| AG02 最终同速次级不同 | final5/base4 对 final5/base2，交换阵营各一次 | 次级方案分别给顺序，不能提前我方优先 |
| AG03 完全同速 | 双方相同final和次级，同阵营再放两个来源 | 我方优先；同侧尾键稳定，重预览/保存不变 |
| AG04 高速击杀 | 我方final9打3，对方HP3/final2 | 后者执行或skip及三种成本分别取决获批合同；不得保留旧敌方总在后作证明 |
| AG05 敌方抢先 | 敌final9、我final2，敌伤害足以倒地我方行动者 | 按混合顺序重核source，目标/skip/终局及支付完整 |
| AG06 换牌重排 | 同角色Hand有final2与8两张，Swap改Prepared；再选PlayerCommand | 仅真实Prepared来源参加，草稿版本变后排序失效/重算；未选offer不入列 |
| AG07 Actorless | 同轮自然行动、Ability、Item、Enemy、Wait | 每项source key/阵营/补足/尾键/参与规则；费用、库存与zero sourceActor限制 |
| EQ02/AG08 折扣 | 两个常量折扣叠到原sCost以上；慢速折扣源被高速击倒 | 截0不赠资源；兼容旧预处理与新时机方案分开，不能回溯改已付款 |
| OLD02/EQ03/AG09 目标 | 两个攻击者同指目标，先手击倒；显式、自动各一次，有另一活目标 | 旧实际delta0/fallback基准；新选择、skip、费用结果有独立合同 |
| OLD03/EQ04 跳过 | 无自动替代目标的PlayerCommand；Enemy unaffordable/defeated/roundEnded | PlayerCost与Actor/Team分别列，不能统一免费 |
| AG10 未执行治疗/Item | 先手清敌或全我倒地，队列后有治疗、Ability、库存1的Item | 终局何时停止、未执行费/库存、结果与重放一次性 |
| NEW05/AG11 多终局 | 同一行动可使双方全灭的设计输入；non-battle trust达标但后续仍有合法效果/付费来源 | 失败/成功优先与整轮结束差异；不扩充自伤原语，仅作为合同推演 |
| EQ05 保存幂等 | 相同request重放/冲突request；save后继续；损坏Scope/版本/摘要 | 零重复扣费/库存/locals；无迁移恢复拒绝；预览不消费随机 |
| NEW06 作者依赖 | 同Action被两Encounter引用，一方缺Counter；program资源键未声明；Actorless sourceActor | 静态错误路径明确；不以全局Resource存在代替local余额声明 |
| NEW07 预算/trace | 节点/深度/locals/全轮预算边界及+1；伪造effectPath或order键 | 诊断、零安装、旧内容策略、恢复能核与不能核的边界 |

## Completion Criteria

- [x] 矩阵全部有可构造输入、精确预期、合同ID/状态、当前或未来测试映射。
- [x] OLD/E1-EQ/E1-NEW/AG清楚分组；未获批只列分支，不虚构新测试通过。
- [x] HP/费用/locals/库存/终局/Receipt/save断言覆盖，而非只验UI顺序。
- [x] 报告覆盖缺口、待批ID及实际验证；未新增产品实现或测试。

## Verification

| 项 | 命令／方式 | 期望结果 |
| --- | --- | --- |
| 人工推演 | 按U2/U3阶段表逐例列状态变化，复查每例起始值可支付性 | 所有分支可得唯一输出，不产生循环求解或无定义来源 |
| 覆盖核对 | D01–D12与source／skip类型映射 | 无无主规则或空白预期 |
| 文档／链接 | `npm run check:docs`，记录相对本Task基线的新增项；不新增无效WikiLink | 无本Unit新增错误；非零既有错误不写成通过 |
| 空白／范围 | `git --no-pager diff --check`；新未跟踪md另查尾随空白 | 无新增空白错误且文件不越白名单 |

## Receipt

执行结束或中断时才创建 `docs/plan-work/archive/task-0313-units/receipts/task-0313-u4-receipt.md`，按 [[docs/ai/templates/execution-receipt]] 记录实际变更、实际验证、未完成和待批ID。GALHCG收尾可统一合并到U5，注明“待U5统一只读复核”，不得每次编辑刷新地图。
