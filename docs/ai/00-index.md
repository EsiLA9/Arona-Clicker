# docs/ai — AI 协作与作者工具协议入口

> 本文回答：项目协作规则、GALHCG 查询、Read Set、玩法工作流、提示词和模板分别在哪里。
> 本目录规定协作方式，不定义游戏机制；机制事实以源码、测试与 `docs/docs-829/` 为准。

| 需要 | 阅读 |
| --- | --- |
| Patch Unit 边界、停止条件、Receipt 与验证 | [[docs/ai/PROJECT-CONSTITUTION]] |
| GALHCG 身份解析、未知/新增内容发现、变更审查与地图维护 | [[docs/ai/galhcg-project-map]] |
| 任务领域与最小源码 Read Set | [[docs/ai/task-read-set-routing]] |
| 从玩法意图、事实核对到 Task 施工 | [[docs/ai/goal-workflow]] |
| 游戏内 UI 的刷新级别、DOM 预算和交互连续性 | [[docs/ai/frontend-design-project-overlay]] |

## 上下文包

- [[docs/ai/context-packs/character]]：角色、招募、培养、好感与装备。
- [[docs/ai/context-packs/datapack-schema]]：Datapack、Registry、Schema 与独立编辑器协议。
- [[docs/ai/context-packs/production]]：生产、GameNum、Affector、Effect 与 Trigger。
- [[docs/ai/context-packs/ui-presentation]]：游戏内 UI、主题、表现与刷新。
- [[docs/ai/context-packs/world-lifecycle]]：世界线、Init、Spot、Lobby 与存档。

## 提示词

- [[docs/ai/prompts/sol-discussion]]：外部方案讨论；输出是建议，不是项目决定或实现事实。
- [[docs/ai/prompts/local-fact-review]]：按 Draft 的事实门槛核对最小源码与测试。

## 模板

- [[docs/ai/templates/goal-set]]、[[docs/ai/templates/goal-card]]：可删除目标集与阶段卡。
- [[docs/ai/templates/discussion-draft]]：同一 Goal 的滚动裁定 Draft。
- [[docs/ai/templates/execution-task]]：根目录中的独立可验收 Task。
- [[docs/ai/templates/patch-unit]]、[[docs/ai/templates/execution-receipt]]：Unit 白名单与执行回执。

## 权威关系

- [[AGENTS.md]] 是新会话入口和稳定项目护栏；本索引只做 `docs/ai/` 内部导航。
- [[docs/docs-829/00-INDEX]] 与其路由页面维护当前项目机制、结构和架构事实。
- `docs/plan-work/` 记录目标意图、裁定和阶段状态；归档计划不可替代当前源码核验。
