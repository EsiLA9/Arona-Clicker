---
scope: ai-protocol
authority: routing
read_when:
  - 为施工任务选择 Read Set
  - 编写或审查 Patch Unit
avoid_when:
  - 需要机制正文或源码实现细节
related_modules:
  - documentation
  - ai-context
---

# task-read-set-routing — 任务 Read Set 路由

> 本文回答：**不同类型的施工任务，默认应该读取哪些文档、源码和验证入口。**
> 它是 `AGENTS.md` 与 `docs/docs-828/00-INDEX` 的补充路由，不复制机制正文。

## 使用规则

1. 先读 `AGENTS.md`、[[docs/docs-828/00-INDEX]] 和 [[docs/docs-828/01-architecture/current-context-card]]。
2. 选择一个最匹配的任务类型，读取其 Required Read Set。
3. 只在事实不足时读取 Optional Read Set。
4. `docs/plan-work/archive/**` 默认不读；需要历史理由时最多按需引入 1–2 篇，并回到源码确认当前实现。
5. Read Set 与源码事实冲突时停止施工，记录冲突，不自行推导替代设计。

## 任务路由

### 引擎机制 / 新增子系统

领域上下文包：本任务类型按具体机制选择 [[docs/ai/context-packs/production]] 或对应模块卡片。

Required Read Set：

- `docs/docs-828/05-conventions/architecture-discipline.md`
- 对应 `docs/docs-828/02-modules/<module>.md`
- 对应 `docs/docs-828/04-mechanisms/<mechanism>.md`
- 目标源码目录与已有测试

Optional：

- `docs/docs-828/01-architecture/run-logic.md`
- `docs/docs-828/01-architecture/data-flow.md`
- `docs/docs-828/01-architecture/design-constraints.md`

验证：定向 vitest、`npx tsc --noEmit`、必要时 `npm test` 和 `npm run check:architecture`。

### PlayerState / 状态分层 / 生命周期

Required Read Set：

- `docs/docs-828/01-architecture/state-layers.md`
- `docs/docs-828/03-data-structures/player-state.md`
- `docs/docs-828/04-mechanisms/state-mutation.md`
- 目标 state service、state factory、savepoint 和测试

Optional：

- `docs/docs-828/01-architecture/run-logic.md`
- `docs/docs-828/07-audit/dual-track-state.md`

验证：定向 vitest、`npx tsc --noEmit`；禁止新增存档迁移代码。

### 实体字段 / 枚举 / Datapack Schema

领域上下文包：[[docs/ai/context-packs/datapack-schema]]

Required Read Set：

- `docs/docs-828/05-conventions/schema-sync.md`
- `docs/docs-828/03-data-structures/declarative-dsl.md`
- 对应模块卡片与 `src/engine/types/` 目标类型
- 相关 Schema 同步测试

Optional：

- `tools/datapack-editor/schema/editor-extras.ts`
- 对应 `docs/docs-828/03-data-structures/*` 正文

验证：`npm run gen:schema`、Schema 定向测试、`npx tsc --noEmit`、`npm run check:docs`。

### 生产 / GameNum / Affector / Trigger

领域上下文包：[[docs/ai/context-packs/production]]

Required Read Set：

- `docs/docs-828/04-mechanisms/production.md`
- `docs/docs-828/04-mechanisms/trigger-effect.md`
- `docs/docs-828/02-modules/game-num.md`
- `docs/docs-828/02-modules/affector.md`
- `src/engine/expression/`、`src/engine/effect/` 目标源码和测试

Optional：

- `docs/docs-828/01-architecture/run-logic.md`
- `docs/docs-828/07-audit/affector-performance.md`

验证：生产 / Effect 定向测试、`npx tsc --noEmit`、必要时 `npm test`。

### 角色 / 抽卡 / 培养 / 通讯录

领域上下文包：[[docs/ai/context-packs/character]]

Required Read Set：

- `docs/docs-828/02-modules/character.md`
- `docs/docs-828/04-mechanisms/gacha.md`
- `docs/docs-828/04-mechanisms/roster.md`
- `docs/docs-828/04-mechanisms/cultivate.md`
- `docs/docs-828/03-data-structures/character-entities.md`
- 目标角色服务、state mutation 和测试

Optional：

- `docs/docs-828/01-architecture/state-layers.md`
- `docs/docs-828/04-mechanisms/gear.md`

验证：角色域定向测试、`npx tsc --noEmit`。

### UI / 主题 / 表现层

领域上下文包：[[docs/ai/context-packs/ui-presentation]]

Required Read Set：

- `docs/docs-828/02-modules/ui.md`
- `docs/docs-828/02-modules/color.md`
- `docs/docs-828/01-architecture/data-flow.md`
- `src/ui/` 目标 controller / component / host 与测试

Optional：

- `docs/docs-828/07-audit/presentation-fallbacks.md`
- `docs/docs-828/07-audit/presentation-editor-consistency.md`
- `docs/docs-828/07-audit/condition-presentation.md`

验证：UI 定向测试、`npx tsc --noEmit`；涉及浏览器行为时补 Edge 验收。

### 世界线 / Init / Spot / Lobby / 存档

领域上下文包：[[docs/ai/context-packs/world-lifecycle]]

Required Read Set：

- `docs/docs-828/02-modules/world.md`
- `docs/docs-828/01-architecture/run-logic.md`
- `docs/docs-828/01-architecture/state-layers.md`
- `src/arona-clicker/` 对应 runtime / init / save service 与测试

Optional：

- `docs/docs-828/01-architecture/design-constraints.md`
- `docs/docs-828/07-audit/dual-track-state.md`

验证：生命周期 / 存档定向测试、`npx tsc --noEmit`；不做存档迁移。

### 文档维护 / 上下文治理

Required Read Set：

- `docs/docs-828/00-INDEX.md`
- `docs/docs-828/05-conventions/doc-maintenance.md`
- `docs/ai/PROJECT-CONSTITUTION.md`
- 本文

验证：`npm run check:docs`、`git --no-pager diff --check`。

## 上下文预算

| 任务规模 | 目标上下文 | 处理规则 |
| --- | ---: | --- |
| 小型文档 / UI 修正 | 5k–15k token | 直接执行单个 Unit |
| 单机制修改 | 10k–30k token | 保持单一领域 Read Set |
| 跨模块修改 | 25k–60k token | 明确增加的领域边界 |
| 超过 60k token | 不设默认 | 先拆 Unit 或补上下文包 |

这里的上下文包括文档、源码、测试和工具输出，不只是文档正文。

## 相关入口

- [[docs/docs-828/01-architecture/current-context-card]]
- [[docs/docs-828/00-INDEX]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/templates/patch-unit]]
