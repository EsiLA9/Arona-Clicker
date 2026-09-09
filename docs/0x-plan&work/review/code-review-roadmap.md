# Code Review Roadmap — 当前实现复核路线

> 本文用于按当前源码理解和复核 AronaClicker，不是历史目录阅读清单。
> Review 的目标是确认实际依赖、状态边界、事件链和玩法行为；测试全绿只能证明行为未回归，不能替代代码审查。

## 当前状态

**状态：🟡 进行中。**

已完成的架构内聚施工已经通过全量测试、类型检查和架构边界检查，但本路线仍需继续沉淀“为什么这样设计”和“当前剩余风险”的人工复核记录。

最近一次基线（2026-09-02）：

- 108 个测试文件通过；1030 项测试通过；
- `npx tsc -p tsconfig.json` 通过；
- `npm run check:architecture` 通过；
- `src/engine/` 与 `src/data-services/` 没有越界依赖；
- 产品内容从 `src/arona-clicker/content/` 进入，`src/data/base/` 仅用于测试/示例包。

## 当前系统地图

```text
src/app/
  └─ runtime-bootstrap.ts
       └─ src/arona-clicker/runtime.ts
            ├─ src/engine/                 基础机制
            ├─ src/data-services/          Datapack / Registry / 存储
            ├─ src/arona-clicker/          产品 Runtime / 状态 / 领域服务 / 内容
            └─ src/ui/                     ReadModel 消费与 Commands 编排
```

主运行链：

```text
createAppRuntime()
  → loadDefaultDatapack()
  → AronaClickerRuntime.init(datapacks)
  → Registry 建表与引用校验
  → GameNum / Reveal / Affector / Trigger 建立运行时索引
  → 进入默认 Init（旧 Review 时序）
  → start() / tick()
```

当前 UI 主链已改为 Lobby → 选择/恢复 Init → start；上面的链路仅保留为本轮 Review 的历史基线。当前事实以 `docs/docs-828/01-architecture/overview.md` 为准。

## Phase 0：全局认知与基线（✅ 已完成）

阅读：

- `AGENTS.md`；
- `docs/docs-828/00-INDEX.md`；
- `docs/docs-828/01-architecture/overview.md`；
- `docs/docs-828/01-architecture/run-logic.md`；
- `abstract.md`。

已确认：

- 基础引擎不再是产品 Runtime 的组合根；
- `src/data-services/` 负责 Datapack、Registry、资源与持久化适配；
- `src/arona-clicker/` 负责产品状态和玩法域；
- UI 通过 `GameReadModel` 读取，通过 `GameCommands` 发起写操作；
- 旧存档不做迁移，结构变化允许直接清档。

## Phase 1：数据服务与契约边界（🟡 待人工复核）

### 阅读入口

| 顺序 | 当前文件 | 关注点 |
| --- | --- | --- |
| 1 | `src/data-services/contracts/datapack.ts` | Datapack 汇总契约与可选表 |
| 2 | `src/data-services/contracts/*.ts` | World、Character、Story、Gacha、Color 等数据声明的归属 |
| 3 | `src/data-services/registry/registry.ts` | 表合并、clear、只读 accessor、引用校验 |
| 4 | `src/data-services/registry/registry-validate.ts` | 三段式 ID、重复表项与跨表校验 |
| 5 | `src/data-services/datapack/` | Source、manifest、PackManager、ZIP/文件夹解析 |
| 6 | `src/data-services/persistence/` | 存储适配与 JSON 文档保存 |
| 7 | `src/engine/contracts/` | 引擎消费数据时所需的最小端口 |

### 检查项

- [ ] 确认每张 Datapack 表属于数据声明、基础机制还是产品内容；
- [ ] 抽查 3 个真引用和 3 个意义引用，确认加载期校验是否符合预期；
- [ ] 确认 Registry 不持有对 AronaClicker 或 UI 的反向依赖；
- [ ] 复核多包目标中 S1c–S7 的实现状态，见 [[docs/0x-plan&work/active/roadmap-0001-datapack-management]]；
- [ ] 标记 `src/data-services` 中仍属于实验/未接线的功能。

## Phase 2：基础数值与机制引擎（🟡 待人工复核）

### 阅读入口

| 领域 | 当前文件 |
| --- | --- |
| GameNum | `src/engine/expression/game-num.ts`、`game-num-build.ts`、`game-num-eval.ts`、`game-num-tag.ts`、`game-num-internal.ts` |
| Value / Condition | `src/engine/expression/value-system.ts`、`condition-system.ts`、`condition-deps.ts` |
| Funclet / Stat DSL | `src/engine/expression/funclet-executor.ts`、`stat-dsl.ts` |
| Extra | `src/engine/extra/` |
| Reveal | `src/engine/visibility/`、`src/engine/contracts/reveal.ts` |
| Stats | `src/engine/stats/`、`src/engine/contracts/stats.ts` |
| 通用机制契约 | `src/engine/contracts/`、`src/engine/types/` |

### 检查项

- [ ] 画出资源 → Init → Area → Spot → zone/flow 的 GameNum 树；
- [ ] 说明 `resourceChanged` 如何定向使缓存失效；
- [ ] 区分 `flows`、`effects`、`zoneModifiers` 和 `perTickEffects`；
- [ ] 确认 Condition、Value、Reveal 只依赖最小状态读取面；
- [ ] 复核 `docs/docs-828/07-audit/` 中 GameNum/Affector 豁免是否仍合理；
- [x] 记录 Affector → ConditionDepIndex → GameNum/flow → Tick 性能审查判别，见 [[docs/0x-plan&work/active/task-0034-affector-performance-review]]；
- [ ] 记录至少一个“数据作者容易误用”的 DSL 组合，并提出文档或 Schema 反馈。

## Phase 3：状态写入口与事件联动（🟡 待人工复核）

### 阅读入口

| 领域 | 当前文件 |
| --- | --- |
| 事件总线 | `src/engine/core/event-bus.ts`、`src/engine/contracts/event.ts` |
| 基础 Effect | `src/engine/effect/effect-engine.ts` |
| Trigger | `src/engine/effect/trigger-system.ts` |
| Affector | `src/engine/effect/affector-engine.ts`、`affector-text.ts` |
| 产品写入 | `src/arona-clicker/state/state-mutation-service.ts` |
| 产品 Effect 分支 | `src/arona-clicker/state/effect-ops.ts`、`src/arona-clicker/contracts/effect-mutation.ts` |
| 产品演出宿主 | `src/arona-clicker/services/runtime-effect-reactor.ts` |

### 检查项

- [ ] 从一个 UI 命令追踪到 PlayerState、统计、事件和派生缓存失效；
- [ ] 确认所有产品状态写入都经 `StateMutationService`；
- [ ] 确认基础 `EffectEngine` 只负责效果求值与最小状态端口，不承载产品分支；
- [ ] 区分一次性 Effect、Trigger 触发和 Affector 持续效果；
- [ ] 检查事件目录位于 `src/arona-clicker/contracts/event-catalog.ts` 且与事件联合保持同步；
- [ ] 复核 `loot`、声明类 Effect 等预留/未接线语义，避免在策划中误认为已生效。

## Phase 4：AronaClicker 玩法域（🟡 待人工复核）

### 世界与状态

- `src/arona-clicker/runtime-game-instance.ts`：产品运行时门面；
- `src/arona-clicker/runtime-wiring.ts`：组合根和依赖接线；
- `src/arona-clicker/types/state.ts`：完整 PlayerState / InitSnapshot；
- `src/arona-clicker/state/`：状态工厂、快照、重置和写入；
- `src/arona-clicker/services/init-service.ts`、`spot-service.ts`、`item-service.ts`、`enhancement-service.ts`。

检查：

- [ ] 每个状态字段归类到 Global、per-Init 快照或 per-Init 当前；
- [ ] `PER_INIT_FIELD_SPECS` 与 `InitSnapshot` 字段保持一致；
- [ ] 重启、世界线切换和读档恢复的保留/清除边界清楚；
- [ ] 当前存档恢复没有隐藏的迁移逻辑。

### 角色、招募与成长

- `src/arona-clicker/services/character-system.ts`；
- `character-availability.ts`、`roster-system.ts`、`gacha-service.ts`；
- `cultivate-system.ts`、`affection-system.ts`；
- `src/arona-clicker/types/character.ts` 与 `src/data-services/contracts/character*.ts`。

检查：

- [ ] Character 原型与 Variant 差分的职责清楚；
- [ ] 招募入口确实来自 Spot 的 `gacha` 功能项；
- [ ] 重复获得、碎片、星级、培养、好感的层级和事件清楚；
- [ ] 与未完成的卡池模型、角色拥有体系对照复核：[[docs/0x-plan&work/active/roadmap-0003-gacha-pool-model]]、[[docs/0x-plan&work/active/roadmap-0004-chara-ownership]]。

### 色彩与剧情

- 色彩：`src/arona-clicker/services/color*.ts`、`color-unlock-reactor.ts`；
- 剧情：`story-service.ts`、`story-flow.ts`、`story-jump.ts`、`story-replay.ts`、`story-rewards.ts`；
- 内容：`src/arona-clicker/content/`；
- 完整 Story/Talklet 契约：`src/data-services/contracts/story.ts`。

检查：

- [ ] 色彩解锁、装备、主题层和头像之间的反馈链清楚；
- [ ] StoryEntry、Story、Talklet、Choice 的边界清楚；
- [ ] 主线、羁绊、被动闲聊、好感台阶和尾巴的投递顺序可解释；
- [ ] 区分已实现故事机制与仅存在于内容/规划中的故事设想。

## Phase 5：UI 与应用入口（🟡 待人工复核）

### 阅读入口

- `src/app/runtime-bootstrap.ts`、`src/app/index.ts`；
- `src/arona-clicker/read-model/game-view-builder.ts`；
- `src/arona-clicker/runtime-commands.ts`；
- `src/ui/context.ts`、`src/ui/controller.ts`、`src/ui/controller-actions-*.ts`；
- `src/ui/components/`。

### 检查项

- [ ] UI 组件只消费 `GameReadModel`；
- [ ] controller 只通过 `GameCommands` 或产品 Runtime 公开命令写入；
- [ ] UI 不持有可写 PlayerState 或具体底层服务引用；
- [x] 核验条件展示从字符串化到 Presentation Tree 的建议，见 [[docs/0x-plan&work/active/task-0035-condition-presentation-tree]]；
- [ ] 复核生产、通讯录、剧情三个代表面板从读取到命令的完整链路；
- [ ] 确认 `src/ui/` 不直接依赖 `src/data/base/`，默认内容从 `src/arona-clicker/content/default-datapack.ts` 进入。

## Phase 6：内容包、Schema 与工具链（🟡 待人工复核）

### 阅读入口

- `src/arona-clicker/content/default-datapack.ts`：正式默认内容；
- `src/data/test-datapack.ts`：测试/示例内容入口；
- `src/arona-clicker/content/def-factory/`：产品内容 Builder；
- `src/engine/def-factory/`：基础机制 Builder；
- `tools/datapack-editor/schema/`；
- `scripts/gen-engine-schema.mjs`、`scripts/check-architecture-boundaries.mjs`。

### 检查项

- [ ] 修改数据契约后能完成 `npm run gen:schema` 并通过 Schema 同步测试；
- [ ] 默认包与测试包的职责没有重新混合；
- [ ] 产品内容 Builder 没有回流到基础引擎；
- [ ] 架构检查规则覆盖当前最重要的单向依赖边界；
- [ ] 标记未接线的 Datapack 字段、EffectOp 或预留系统。

## 全局验收清单

- [ ] 代码路径与 `docs/docs-828/01-05` 当前文档一致；
- [ ] 每个架构级发现都有位置、现象、影响和建议；
- [ ] 玩法规划引用当前实现，而不是历史路径；
- [ ] 所有新增机制都有测试与必要的 Schema 同步；
- [ ] `npm test`、`npx tsc -p tsconfig.json`、`npm run check:architecture` 全部通过；
- [ ] Review 发现中需要长期跟踪的事项已转入 `docs/0x-plan&work/active/` 的主题文件。

## 发现记录

| 日期 | 位置 | 发现 | 状态 |
| --- | --- | --- | --- |
| 2026-09-02 | `src/arona-clicker/content/default-datapack.ts` | 默认包迁移时漏挂 `characterVariants`，导致卡池引用 `Arona` 初始化失败 | ✅ 已修复并加入回归测试 |
| 2026-09-02 | 文档计划层 | 原 ADR/Roadmap/Plan 分散在 root 与 `docs/docs-828/06-adr`、`08-roadmap` | ✅ 已聚合至 `docs/0x-plan&work/` |
| 2026-09-02 | 当前 Review 文档 | 旧路线使用已删除的 `src/engine/game`、`src/engine/registry` 等路径 | ✅ 已按当前源码重写本文件 |

## 相关入口

- [[docs/0x-plan&work/00-index]]
- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/01-architecture/run-logic]]
- [[docs/docs-828/03-data-structures/type-boundary-audit]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
