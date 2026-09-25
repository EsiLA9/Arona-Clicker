# 工作文档冻结清单（2026-09-25）

本清单记录用户要求统一归档时，`docs/plan-work/` 根目录 31 份工作文档的**最后已知状态**：8 份 Draft、23 份 Task。归档仅代表从当前推进区移出；未做完的施工、裁定、浏览器验收和 AOCI 收尾仍未完成。下面的摘要来自文档正文及归档前的计划索引，不替代当前源码与 `docs/docs-828/`。

## Draft（8）

| 文档 | 最后已知进展 | 仍待处理 |
| --- | --- | --- |
| [[draft-0136-story-trigger-catalog-and-scoped-mounting]] | Story Trigger 独立目录与作用域挂载草案，尚未开工 | Trigger ID、来源策略、当前 Area 追赶和编辑器能力等裁定 |
| [[draft-0137-story-entry-reactions-sol-review-and-decision]] | StoryEntry Reaction 第一阶段已实现 | priority、catch-up、跨 Init persistent、Definition Patch 暂缓 |
| [[draft-0138-comprehensive-data-structure-audit]] | 数据结构与实例审计完成，定向数据测试 43 项通过 | 内容源漂移、嵌套校验和关系投影风险需独立裁定 / 施工 |
| [[draft-0139-story-follow-up-packaging]] | StoryFollowUp 作者语义与天台样例完成事实核查，后由 Task 0140 承接首期 | 更多等待模式、跨 Init、Overlay 等仍在首期外 |
| [[draft-0142-trigger-gameplay-packaging]] | Trigger 玩法类型与领域包装建议已写成草案 | 数据包作者入口、once 作用域、定义变化和级联等未裁定 |
| [[draft-0143-trigger-runtime-registration-withdrawal]] | Registration / Withdrawal 首切片由 Task 0144 实施 | 通用执行 / commit 语义及全局 Trigger 完成状态仍待裁定 |
| [[draft-0144-eventbus-trigger-millstone]] | Milestone 持久抵达事实主体设计由 Task 0151 完成 P0 | Achievement / Listener 等上层能力另行推进 |
| [[draft-0152-milestone-listener-and-achievement-packaging]] | Listener v1 语义收敛，能力审计由 Task 0153 完成 | 另立实施 Task；Achievement 展示尚未施工 |

## Task（23）

| 文档 | 最后已知进展 | 仍待处理 |
| --- | --- | --- |
| [[task-0076-unified-def-editor-service]] | 统一 Def 编辑服务 P0–P2 主体落地 | 第二类 Def、reload Apply、子弹窗、复杂字段等后续裁定 / 实施 |
| [[task-0077-runtime-editor-condition-tree]] | 条件树主体落地 | 视觉与交互裁定、浏览器验收；依赖 0078 |
| [[task-0078-runtime-editor-condition-target-editors]] | 原子条件目标编辑器 P0/P1 落地 | P2 布尔及其他目标、回归和浏览器验收 |
| [[task-0079-chara-spot-link-retirement-and-redesign]] | Manager 旧语义删除范围已裁定 | 代码、状态、Schema、UI 与测试清理尚待施工 |
| [[task-0080-spot-cost-and-payment-extensibility]] | 组合资源 / 物品支付 P0/P1 与 Runtime Editor 切片完成 | 非库存 Provider、动态金额及跨领域费用接入另立任务 |
| [[task-0086-ui-dom-refresh-boundaries-and-hover-preservation]] | DOM/hover 调查、P0 与首批局部替换完成 | Editor 提交去重、Tick 路径核验、浏览器刷新计数验收 |
| [[task-0088-init-area-hot-crud-and-location-fallback]] | Init / Area 热 CRUD 与位置兜底已重新立项，文档仍标 `in-progress` | 以文档验收矩阵核实实际实现和用户交互；未在本轮重新运行测试 |
| [[task-0089-runtime-area-topology-overlay]] | Runtime 拓扑 Overlay 代码施工完成 | 自定义拓扑下拉与导航的浏览器验收 |
| [[task-0092-agents-routing-slimdown]] | AGENTS 精简任务文档仍标 `active` | AOCI Entry 规模标签优化与最终对齐记录 |
| [[task-0093-init-editor-design]] | Init Editor 引擎与 UI 已落地，既有全量测试记录通过 | 浏览器验收、构建，以及只读来源 / 复制工作流 |
| [[task-0094-runtime-editor-floating-pane-launcher]] | 全局浮动编辑器入口已落地 | 跨页面、桌面和窄屏浏览器验收 |
| [[task-0095-runtime-editor-mini-launcher-and-init-default-area]] | 迷你入口与默认 Area 协同创建代码、自动化验收完成 | 浏览器视觉验收 |
| [[task-0098-runtime-editor-workspace-decoupling-and-light-theme]] | 亮色 Editor Workspace、内容浏览器解耦的核心迁移与自动化验收完成 | 浏览器视觉验收 |
| [[task-0100-ui-semantic-region-mapping-follow-up]] | Init 文案、ARIA / 主题节点和批量刷新计数的后续任务已提出 | 尚未排期或施工 |
| [[task-0103-init-selector-freeze-after-runtime-apply]] | 新建 Init 后选择器冻结问题的调查交接 | 继续定位、修复及回归验收 |
| [[task-0104-init-editor-apply-interaction-convergence]] | Apply 后选择页交互的自动化施工完成 | 真实浏览器视觉验收与 AOCI 对齐 |
| [[task-0120-def-editor-design-masterplan]] | Def 编辑器总纲、字段能力与阶段计划已建立 | 平台门禁、各 Def 域实施、共享编辑器及全量验收均未完成 |
| [[task-0131-runtime-editor-codex-detail-navigation-and-density]] | 图鉴详情密度 / 导航实现、测试、架构与构建验收完成 | 浏览器截图、窄屏、长字段与查看栈目视验收 |
| [[task-0133-runtime-editor-codex-reference-trace-and-unified-rendering]] | 图鉴关系追踪方案；原索引记录聚合与路径属性已有部分进展 | addition-test 端到端、统一渲染、局部刷新和浏览器验收 |
| [[task-0134-runtime-content-static-reverse-query-and-milestones]] | 静态正反关系查询与实体记录范围已规划 | 统一查询、Inspector 接入与里程碑后续阶段的施工验收 |
| [[task-0135-runtime-editor-semantic-summary-readable-projection]] | 图鉴语义摘要可读化需求与验收样本已定义 | 可读文案投影、统一渲染和测试尚待实施 |
| [[task-0140-story-follow-up-v1]] | StoryFollowUp v1 P0/P1/P2 业务实现与验证完成 | AOCI 终态维护受既有治理漂移阻断 |
| [[task-0147-ai-read-set-routing-efficiency]] | 按子题选择最小 Read Set 的路由已完成 | AOCI 治理稳定后仍需完成对齐 |

## 恢复方式

这些文档均保留归档前的状态词，不统一改为 `done`。若重新推进某方向，先核对当前源码、测试和 `docs/docs-828/`，再按 [[docs/ai/goal-workflow]] 另立 Draft / Task；不要在冻结正文继续追加施工记录。历史正文中“当前”“待归档”等措辞均以本次冻结日期为界理解。
