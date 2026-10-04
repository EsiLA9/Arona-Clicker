# 本地 AI 事实核对提示词

> 用于解决 Draft 中会改变最近阶段方案的问题；不以全仓审计代替具体问题。

```text
依据 AGENTS.md、docs/docs-829/00-INDEX.md 和指定 Draft，核对进入下一阶段所必需的源码与测试事实。先用 GALHCG 主动查询相关 Module / Concept / 文件关系；若未知项未命中，改查别名、路径与源码字面量，不能把零命中当作“不存在”。随后按 docs/ai/task-read-set-routing.md 选择最小 Read Set。docs-828 是历史快照，只在追溯旧审计或设计理由时查阅，不作为当前事实依据。

Draft：<路径>
本轮事实问题：<逐条列出>

对每个问题给出：GALHCG 查询范围与匹配质量、结论、源码/测试位置、对方案或验收的影响、仍不确定之处。重点核对状态读取与写入方、事件发布与过滤、生命周期、数据包契约和现有测试中与问题相关的部分；不要默认展开全部领域。

若本轮新增或更改源码、测试或当前机制文档，按 docs/ai/galhcg-project-map.md 对直接影响路径运行 review_changes，并维护有当前文件证据支持的 Evidence / maps_to；无法维护时记录阻塞原因。

随后更新同一 Draft 的“已裁定 / 待裁定 / 已核实事实 / 下一步”。若满足 docs/ai/goal-workflow.md 的 Draft→Task 准入，提出一个可独立验收的 Task 轮廓和可能的 Patch Unit 顺序；若未满足，准确列出缺失证据。

不要为了完成文档链而额外拆 Task，不要把 SolChat 建议当作源码事实。只有审计自身独立可验收且会被后续工作复用时，才建议只读审计 Task。
```
