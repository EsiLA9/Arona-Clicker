# Unit 0313-U5：文档消歧、准入与独立敏捷任务交接

状态：complete — 文档消歧、准入表、敏捷接续及收尾完成；实际 [[docs/plan-work/archive/task-0313-units/receipts/task-0313-u5-receipt]]。

## Goal

核对所有回写、提交两张独立施工准入结论，完成E0文档验收而不冒充玩法全批准。

## Must Read / Read Set

先读 [[docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission]] 和 [[docs/ai/PROJECT-CONSTITUTION]]；只读下表命中段落，不整文件堆入上下文。表中未写完整前缀的services/contracts/runtime相邻路径均在 `src/arona-clicker/`，engine测试相邻文件均在 `tests/engine/`。

| 类型 | 路径／符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | 本Task、五个Unit及U1–U4 Receipt | 核对实际完成、白名单和未完成项 |
| 产物 | U1 current-behavior-evidence.md、U4 behavior-cases.md | 对照事实及规则版本 |
| 合同 | Draft0312 §5/§9–§11/新增敏捷合同、Task0312 §3–§9 | 主体就地同步，禁止只追加覆盖声明 |
| 规范 | [[docs/ai/goal-workflow]]、[[docs/ai/PROJECT-CONSTITUTION]]、[[docs/ai/galhcg-project-map]]、[[docs/docs-829/05-conventions/doc-maintenance]] | 状态、索引、Receipt、只读收尾与归档 |
| 配置 | `package.json` 的check:docs；现有索引 | 验证命令、路径、状态 |

## Context Budget

| 项 | 预算／规则 |
| --- | --- |
| 目标上下文 | 20k–40k token，按函数／命名测试分段读取；工具输出计入 |
| 文档 Read Set | 3–8篇命中段落；Unit/Receipt只读所依赖的结论 |
| 历史文档 | 默认0；仅U1明确指定Report0311历史快照和必要0309证据 |
| 超预算处理 | 超60k先交上游缩小／拆分，不全仓扫描；净修改≤500行、文件≤5 |

## Optional Read Set

仅当某一批准来源在对话记录中不可核对，列待补来源并保持待批；不通过搜索旧历史推定批准。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本Unit明确指定的直接证据除外）。
- 旧Operation/EventRun CardPool、无关Engine Effect／Trigger全实现、整个UI或独立编辑器。
- 生成Schema、构建产物、依赖目录和全仓历史。

## Confirmed Facts

| 事实 | 依据（路径／符号） | 备注 |
| --- | --- | --- |
| Task0312当前为proposed/contract-review | Task0312状态及E0/P0 | 不因调查完成直接升格可实施 |
| 0309已complete | Task0309实际状态 | 不列为待实现依赖 |
| Task与Draft不替代当前实现事实 | goal-workflow | E0设计记录不写成docs-829已实现机制 |

## Constraints

- 本Unit创建时仅列说明；本轮已完成E0文档执行与收尾，结果见Receipt。
- 遵循本Task裁定状态和A01–A06；人类批准须有原话／日期／来源，AI推荐不算批准。
- 当前事实冲突按停止条件交上游；未批分歧按既定任务要求记录有限方案，不自行选定，不因等待批准而伪造完成。
- Owner／存档／声明式边界按 [[docs/docs-829/05-conventions/architecture-discipline]]，文档状态按 [[docs/ai/goal-workflow]]。

## Allowed Files

- `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md`
- `docs/plan-work/task-0312-gameplay-b-effect-program-v1.md`
- `docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission.md`
- `docs/plan-work/00-index.md`
- `docs/plan-work/archive/task-0313-units/receipts/task-0313-u5-receipt.md`

只允许新增列明未来产物／自己的Receipt，更新Task只写实际进度、证据及本Unit授权结论；不扩大其它Unit范围。不编辑产品源码、产品测试、数据包、Schema或协作协议。

## Explicit Non-goals

- 执行E1或敏捷Runtime、写测试实现／原型调度器、修改已有数据或准备页。
- 全局Action Registry、共享模板、通用注入、外部成长Adapter、第二Owner／完整历史状态系统。
- 为消除既有检查错误而修无关文档，或代替人类批准玩法。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 六条：越白名单／新增未列路径／超预算；Read Set外新增阅读超过2文件；事实冲突；实现需要未裁定选型或扩范围；必需验证失败／不可解释。中断写Receipt与缺失信息，只暂停受影响工作，由上游更新边界后续行。

待批选项可按本Unit规定产出“方案+差异+推荐+阻塞ID”，这是设计文档的完成方式，不是允许施工代理替人类定案。既有check:docs八处错误若前后一致，按Task基线口径记录，不自动触发无关修复。

## Work Items

1. 按本Task §5回写映射逐段核对：when时刻、Counter策略、费用双通道、敌方折扣、目标倒地、non-battle终局、预算/trace。修正文档主体的相反断言；每个待批项保持一致候选与状态，样例数字/结果也随之同步。
2. 给Task0312增加本Task明确依赖链接，替换E0/P0重复工作为准入引用；标明E1仅旧调度等价、不含敏捷Scheduler，按实际批准写contract-ready或继续contract-review及阻塞ID，保留原轮实测历史。
3. Draft0312 §10登记独立敏捷目标及E1关系；新增合同正文仍留原Draft，不再建立一份完整Agility平行设计。Task0312只链接共享边界，不能暗中采用另一套支付／终局。
4. 在本Task追加“E0执行结论与准入表”：E1与敏捷分别选择可施工/等待批准/等待事实证据/等待前置实现，逐项列ID、证据、负责下一动作。批准依据不全不得标可施工；D10待批若仅影响敏捷，不无理由拖住已获批E1。
5. 同节追加“敏捷Runtime后续需求交接”：已获批规则链接、用户确认规则、未批分歧、source/排序/费用/target/terminal/trace/save最小实现职责、候选文件、自动化/宽屏只读顺序展示所需验证、先后/并行策略。只做接续材料，不分配新Task编号或创建产品Task。
6. 逐项核对U4对合同的覆盖，OLD与E1等价/AG变更分开陈述；缺事实的必要门槛交回对应Unit，不能为了结束文档而补批准。确认U1测试实际结果与代码当前版本相符；源码在期间改变则只对直接相关事实重新核证。
7. 运行文档与空白检查；合并Task／Unit／两个证据文档／两份0312／索引直接路径做一次GALHCG changed只读复核，读完分页owner/Evidence。无授权不改图、不刷新、不写freshness。
8. 更新索引及本Task实际状态、剩余批准／产品范围；文档工作可complete同时两个产品入口仍阻塞，但中断Unit不能算完成。按模板写U5 Receipt，不代写未执行Unit Receipt。未来若归档，Task及units目录一同归档并同步引用；本Unit先给完成建议，未核验前不提前搬走文件。

## Completion Criteria

- [x] 主体回写清单逐项完成，两份0312无互相矛盾的执行合同。
- [x] E1/敏捷两张准入表及后续需求交接有依据；文档complete不等于产品ready。
- [x] U1–U4实际Receipt与产物、U5检查证据可达，未执行验证及待批项如实保留。
- [x] 索引/相互依赖/状态正确，文档错误与基线差异清楚，GALHCG收尾完整性记录。
- [x] 改动限白名单；无实现、Schema生成、无关修复、虚构人类批准或全量暂存。

## Verification

| 项 | 命令／方式 | 期望结果 |
| --- | --- | --- |
| 文档检查 | `npm run check:docs` | 无本Task新增错误；既有8处记录前后差异 |
| 空白与范围 | `git --no-pager diff --check`；新未跟踪文档另查尾随空白；审阅diff/status | 无新增空白错误；所有写入在各Unit白名单 |
| 语义审查 | 按D01–D12与Task §5回写映射逐段审查 | 批准/事实/建议/后续状态分明，两张准入无冲突 |
| GALHCG | 当前注册graph_health changed，合并直接路径并读取返回分页 | 只读结果完整记录，未维护原因明确 |
| 文档／链接 | `npm run check:docs`，记录相对本Task基线的新增项；不新增无效WikiLink | 无本Unit新增错误；非零既有错误不写成通过 |
| 空白／范围 | `git --no-pager diff --check`；新未跟踪md另查尾随空白 | 无新增空白错误且文件不越白名单 |

## Receipt

执行结束或中断时才创建 `docs/plan-work/archive/task-0313-units/receipts/task-0313-u5-receipt.md`，按 [[docs/ai/templates/execution-receipt]] 记录实际变更、实际验证、未完成和待批ID。GALHCG收尾可统一合并到U5，注明“待U5统一只读复核”，不得每次编辑刷新地图。
