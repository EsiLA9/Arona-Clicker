# ai/guide — Agent 协作与项目指引入口

> 本文回答：项目协作规则、GALHCG 查询、Read Set、玩法工作流、提示词和模板分别在哪里。
> 本目录保存 Agent 路由、工程约定、上下文包、提示词和模板；游戏机制事实以源码、测试与 `docs/docs-830/` 为准。

| 需要 | 阅读 |
| --- | --- |
| Task 创建、施工规格、验收与交接 | [[ai/guide/task-workflow]] |
| 跨会话原型架构调查、蓝图评审与后续施工交接 | [[ai/guide/prototype-blueprint-workflow]] |
| GALHCG 查询、分页、只读变更复核 | [[ai/guide/galhcg-project-map]]；获授权维护时再读 `.galhcg/agent-maintenance.md` |
| 领域未知、跨领域或正式施工时选择 Read Set | [[ai/guide/task-read-set-routing]]；已知领域从 [[AGENTS]] 直接进入下方领域包 |
| 架构、Schema、测试和文档维护约定 | [[ai/guide/conventions/00-index]] |
| 通用 UI 设计；游戏内 UI 的数据、刷新与施工补充；已有风格入口 | Agent 的 `frontend-design` skill；[[ai/guide/frontend-design-project-overlay]]；[[ui-style/00-index]] |
| 玩法心智模型与作者示例 | [[ai/guide/project-abstract]]、[[ai/guide/examples/00-index]] |

## 上下文包

- [[ai/guide/context-packs/character]]：角色、招募、培养、好感与装备。
- [[ai/guide/context-packs/datapack-schema]]：Datapack、Registry、Schema 与独立编辑器协议。
- [[ai/guide/context-packs/production]]：生产、GameNum、Affector、Effect 与 Trigger。
- [[ai/guide/context-packs/ui-presentation]]：游戏内 UI、主题、表现与刷新。
- [[ai/guide/context-packs/world-lifecycle]]：世界线、Init、Spot、Lobby 与存档。

## 提示词

- [[ai/guide/prompts/prototype-blueprint-review]]：用真实操作、源码和验收结果编写新人能接手的原型蓝图。
- [[ai/guide/prompts/sol-discussion]]：外部方案讨论；输出是建议，不是项目决定或实现事实。
- [[ai/guide/prompts/local-fact-review]]：按 Task 的关键问题核对必要源码与测试。

## 模板

- [[ai/guide/templates/execution-task]]：`newTask` 使用的默认施工规格骨架。

## 权威关系

- [[AGENTS]] 是新会话的简短分流入口；稳定工程约束由命中的规范页说明。本索引只做 `ai/guide/` 内部导航，列出的页面不构成必读清单。
- [[1-项目/ACProgram/docs/docs-830/00-INDEX|00-INDEX]] 是当前机制、结构和架构说明入口。
- [[ai/plan/00-index]] 记录目标意图、裁定和阶段状态；[[ai/archive/README]] 保存退役材料。两者都不替代当前源码核验。
