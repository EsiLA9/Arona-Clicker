---
scope: ai-protocol
authority: routing
read_when:
  - 为施工任务选择 Read Set
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
> 它是 `AGENTS.md` 与 [[docs/docs-829/00-INDEX]] 的补充路由；领域细目只在对应上下文包维护。docs-828 是旧文档系统的迁移来源，不作为当前 Read Set。

## 使用规则

1. 先读 `AGENTS.md` 与 [[docs/docs-829/00-INDEX]]，按任务类型进入下表。需要跨模块定位或尚不熟悉整体架构时，再读 [[docs/docs-829/01-architecture/overview]]；核对依赖方向时读 [[docs/docs-829/01-architecture/dependency-map]]。
2. 领域包中的“按子题选择”只选命中的行；同时涉及多个子题时再合并，重复文档只读一次。目标源码和相关测试始终要核对，不把整个目录视为必读正文。
3. 事实不足时才扩展 Optional Read Set。`docs/plan-work/archive/**` 默认不读；追溯历史理由时按需引入 1–2 篇，再回到源码确认当前实现。
4. Read Set 与源码事实冲突时停止施工并记录冲突，不自行推导替代设计。
5. GALHCG 项目身份、查询、文件迁移与地图维护遵守 AGENTS.md 的接入约定；地图用于导航，实际事实仍按 Read Set 核对源码与测试。

## 任务路由

| 任务 | Required Read Set 入口 | 验证入口 |
| --- | --- | --- |
| 引擎机制 / 新增子系统 | [[docs/docs-829/02-modules/00-index]]、[[docs/docs-829/04-mechanisms/00-index]]、[[docs/docs-829/05-conventions/architecture-discipline]]、目标源码与测试；生产链见 [[docs/ai/context-packs/production]] | 定向测试、类型检查；触及数据服务边界时检查架构 |
| PlayerState / 状态分层 | [[docs/docs-829/03-data-structures/player-state]]、[[docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]、目标 state service 与测试 | 定向测试、类型检查；不写存档迁移 |
| 实体字段 / 枚举 / Datapack Schema | [[docs/ai/context-packs/datapack-schema]] 与目标类型、同步测试 | `npm run gen:schema`、Schema 测试、类型检查 |
| 生产 / GameNum / Affector / Trigger | [[docs/ai/context-packs/production]] 中命中的子题 | 生产 / Effect 定向测试、类型检查 |
| 角色 / 抽卡 / 培养 / 通讯录 | [[docs/ai/context-packs/character]] 中命中的子题 | 角色域定向测试、类型检查 |
| 游戏内 UI / 主题 / 表现 | [[docs/ai/context-packs/ui-presentation]] 中命中的子题 | UI 定向测试、类型检查；涉及交互时浏览器验收 |
| 世界线 / Init / Spot / Lobby / 存档 | [[docs/ai/context-packs/world-lifecycle]] 中命中的子题 | 生命周期 / 存档定向测试、类型检查 |
| 文档维护 / 上下文治理 | 本文、[[docs/docs-829/05-conventions/doc-maintenance]]；施工协议变更再读 [[docs/ai/PROJECT-CONSTITUTION]] | `npm run check:docs`、`git --no-pager diff --check` |
| 玩法需求讨论 / Draft 准入 | [[docs/ai/goal-workflow]]、目标 Draft、命中领域的最小 Read Set；仅在事实门槛需要时读目标源码与测试 | 逐项记录事实依据；不以测试通过替代玩法裁定 |

表中“类型检查”指 `npx tsc --noEmit`。机制改动还须遵守 `AGENTS.md` 的测试和 Schema 同步要求；表格只提供查找入口，不降低这些护栏。

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
- [[docs/ai/templates/patch-unit]]
- [[docs/ai/goal-workflow]]
