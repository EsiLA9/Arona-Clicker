---
scope: ai-protocol
authority: routing
read_when:
  - 任务领域未知或跨越多个领域时选择 Read Set
  - 编写或审查 Patch Unit
  - 为 Draft 核对会改变方案的源码事实
avoid_when:
  - 需要机制正文或源码实现细节
related_modules:
  - documentation
  - ai-context
---

# task-read-set-routing — 任务 Read Set 路由

> 本文回答：**如何按具体任务选择必要的文档、源码和验证入口。**
> 已知领域直接从 [[AGENTS.md]] 进入对应上下文包；本文只为未知、跨领域或需要正式 Read Set 的任务决定下一站。领域细目只在对应包维护。docs-828 是历史来源，不作为当前 Read Set。

## 使用规则

1. 先写明本次要回答的问题。陌生领域、新内容或关系未知时，按 [[docs/ai/galhcg-project-map]] 查候选 Module / Concept / 路径，再进入下表命中的领域包。需要整体概览时才读 [[docs/docs-829/00-INDEX]]；需要跨模块运行关系时才读 [[docs/docs-829/01-architecture/overview]]；核对依赖方向时才读 [[docs/docs-829/01-architecture/dependency-map]]。
2. 领域包只选命中的子题行；同时涉及多个子题时再合并，重复文档只读一次。读取目标源码、直接调用方和相关测试，不把整个目录视为必读正文。
3. 事实不足时才扩展 Optional Read Set。`docs/plan-work/archive/**` 默认不读；追溯历史理由时按需引入 1–2 篇，再回到源码确认当前实现。
4. Read Set 与源码事实冲突时停止施工并记录冲突，不自行推导替代设计。
5. 文件改动后按地图查询页只读复核直接影响；维护授权与步骤由该页和 `.galhcg/agent-maintenance.md` 规定，不把维护指南加入普通 Read Set。

## 任务路由

下表提供候选验证入口，不要求每次全部执行。普通小需求按影响选必要检查，不强制新增测试、类型检查或正式 Unit；重要系统结构设计与已报告 bug 优先构造测试并严格审查，统一按 [[docs/docs-829/05-conventions/testing]] 分级。

| 任务 | 下一站 | 按影响选择的验证入口 |
| --- | --- | --- |
| 引擎机制 / 新增子系统 | [[docs/docs-829/02-modules/00-index]] 选模块，再从 [[docs/docs-829/04-mechanisms/00-index]] 选机制；生产链见 [[docs/ai/context-packs/production]] | 定向测试、类型检查；触及数据服务边界时检查架构 |
| PlayerState / 状态分层 | [[docs/docs-829/03-data-structures/player-state]]；涉及写入时再读 [[docs/docs-829/04-mechanisms/arona-clicker/state-mutation]] | 状态定向测试、类型检查 |
| 实体字段 / 枚举 / Datapack Schema | [[docs/ai/context-packs/datapack-schema]] 中命中的子题 | Schema 生成与相关定向测试、类型检查 |
| 生产 / GameNum / Affector / Trigger | [[docs/ai/context-packs/production]] 中命中的子题 | 生产 / Effect 定向测试、类型检查 |
| 角色 / 抽卡 / 培养 / 通讯录 | [[docs/ai/context-packs/character]] 中命中的子题 | 角色域定向测试、类型检查 |
| 游戏内 UI / 主题 / 表现 | [[docs/ai/context-packs/ui-presentation]] 中命中的子题 | UI 定向测试；涉及交互时浏览器验收 |
| 世界线 / Init / Spot / Lobby / 存档 | [[docs/ai/context-packs/world-lifecycle]] 中命中的子题 | 生命周期 / 存档定向测试、类型检查 |
| 文档维护 / 上下文治理 | [[docs/docs-829/05-conventions/doc-maintenance]]；正式施工协议变更时读 [[docs/ai/PROJECT-CONSTITUTION]] | `npm run check:docs`、`git --no-pager diff --check` |
| 玩法需求讨论 / Draft 准入 | [[docs/ai/goal-workflow]]、目标 Draft；事实门槛再选领域包 | 逐项记录事实依据 |

表中“类型检查”指 `npx tsc --noEmit`。验证按上述分级选择；Schema 同步、架构边界及其他工程护栏仍遵守 `AGENTS.md`。

## 上下文预算

| 任务规模 | 可控任务上下文目标 | 处理规则 |
| --- | ---: | --- |
| 小型文档 / UI 修正 | 5k–15k token | 直接执行单个 Unit |
| 单机制修改 | 10k–30k token | 保持单一领域 Read Set |
| 跨模块修改 | 25k–60k token | 明确增加的领域边界 |
| 超过 60k token | 不设默认 | 先拆 Unit 或补上下文包 |

这里的预算计算按任务选择的文档、源码、测试和工具输出。GALHCG 查询严格跟随响应分页与完整性提示；按任务缩小查询范围，不因地图结果扩大施工 Read Set。

## 相关入口

- [[docs/docs-829/01-architecture/overview]]
- [[docs/docs-829/00-INDEX]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/galhcg-project-map]]
- [[docs/ai/00-index]]
- [[docs/ai/templates/patch-unit]]
- [[docs/ai/goal-workflow]]
