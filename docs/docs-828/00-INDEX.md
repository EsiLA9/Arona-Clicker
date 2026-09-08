# docs/docs-828 — 总入口（00-INDEX）

> 本文是文档库的**唯一入口**：只做路由，不写正文。想了解什么、想改什么，按表跳转到对应文档。
> 本库取代 `docs-824/`（已归档）；内容以 2026-09-07 代码实况为准（Lobby、主题表现宿主与主题编辑器首轮收敛后）。

## 系统一句话

**事件驱动 + 声明式数据包**的放置类 RPG 引擎（TypeScript / Vite / vitest）：游戏逻辑写成 `Datapack`，由引擎子系统解释执行；所有状态变更走 `StateMutationService` 单一写入口；UI 只消费只读快照。

## 主干调用链

```text
src/ui/main.ts → createAppRuntime()（组合 Runtime 与服务）
        → applyEnabledPacks()（加载启用数据包，保持 Lobby）
        → Lobby（activeInit 为空；选择 Init / 服务工作区，不启动 Tick）
        → choose / resume Init（写入 activeInit，恢复或建立快照）
        → start()（1 tick/秒）
        → tick()（生产结算 → Affector → 剧情 → 阻断复检 → 统计）
```

## 路由表

### 我想理解……

| 想了解 | 看这篇 |
| --- | --- |
| 系统全貌 / 核心思想 / 目录职责速览 | [[docs/docs-828/01-architecture/overview]] |
| 启动 → 装配 → tick 的完整时序 | [[docs/docs-828/01-architecture/run-logic]] |
| 三层状态（global / per-Init 快照 / per-Init 当前）与写入口 | [[docs/docs-828/01-architecture/state-layers]] |
| Datapack → Registry → PlayerState → GameView 数据流 | [[docs/docs-828/01-architecture/data-flow]] |
| 内聚施工前的模块归类与依赖基线 | [[docs/docs-828/01-architecture/module-dependency-baseline]] |
| 某个子系统（GameNum / Affector / 抽卡 / 色彩 / 剧情…） | [[#02-modules 模块卡片索引]] |
| PlayerState / Registry / 实体类型 / 声明式 DSL 枚举 | [[docs/docs-828/03-data-structures/player-state]] 起（见下方分区表） |
| 引擎契约与 AronaClicker 类型边界 | [[docs/docs-828/03-data-structures/type-boundary-audit]] |
| 生产 / 抽卡 / 培养 / 色彩 / 事件联动的机制细节 | [[docs/docs-828/04-mechanisms/00-index]]（正文迁移中，当前文件见下方分区表） |
| 长期目标 / roadmap / 里程碑进度 / ADR / 工作计划 | [[docs/0x-plan&work/00-index]] |

### 我想改……

| 想改 | 先读 |
| --- | --- |
| 引擎机制 / 新增子系统 | 对应 [[#02-modules 模块卡片索引]] + [[docs/docs-828/05-conventions/architecture-discipline]] |
| 实体字段 / 枚举（`src/engine/types/`） | [[docs/docs-828/05-conventions/schema-sync]]（必读，含 `gen:schema` 协议） |
| 文件拆分 / 重构 | [[docs/docs-828/05-conventions/refactoring]] |
| 正式默认游戏内容 | `src/arona-clicker/content/default-datapack.ts` + [[docs/docs-828/02-modules/registry]]；测试/示例包见 `src/data/test-datapack.ts` |
| 新增跨世界线保留的数据 | [[docs/docs-828/01-architecture/state-layers]]（先想清楚放哪一层） |
| Datapack 读取 / 多包管理 / mod 冲突 | [[docs/0x-plan&work/active/adr-0004-datapack-management]] |
| 测试 | [[docs/docs-828/05-conventions/testing]] |
| 文档本身 | [[docs/docs-828/05-conventions/doc-maintenance]] |

## 02-modules 模块卡片索引

| 卡片                                     | 子系统                                              | 代码位置                                             |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| [[docs/docs-828/02-modules/core]]           | 事件总线 / Tag / 主题运行时 / DevLog 等横切基础                | `src/engine/core/`                               |
| [[docs/docs-828/02-modules/registry]]       | 数据包注册表 + 加载校验 + def-factory 构建器                  | `src/data-services/registry/`、`src/engine/def-factory/` |
| [[docs/docs-828/02-modules/expression]]     | ValueSystem / ConditionSystem / Funclet / 统计 DSL | `src/engine/expression/`                         |
| [[docs/docs-828/02-modules/game-num]]       | GameNum 统一数值树（产出结算核心）                            | `src/engine/expression/game-num*.ts`             |
| [[docs/docs-828/02-modules/effect-trigger]] | Effect / Trigger / 事件驱动响应器                       | `src/engine/effect/`                             |
| [[docs/docs-828/02-modules/affector]]       | Affector 持续效果（四通道）                               | `src/engine/effect/affector-engine.ts`           |
| [[docs/docs-828/02-modules/state-mutation]] | StateMutationService 单一写入口                       | `src/arona-clicker/state/state-mutation-service.ts`    |
| [[docs/docs-828/02-modules/character]]      | Character / 抽卡 / 培养 / 通讯录                        | `src/arona-clicker/services/` 角色域              |
| [[docs/docs-828/02-modules/color]]          | 色彩 / 主题 / 装备                                     | `src/arona-clicker/services/color*.ts`           |
| [[docs/docs-828/02-modules/world]]          | Init / Area / Spot / 会话 / 存档                     | `src/arona-clicker/` Runtime 与领域服务            |
| [[docs/docs-828/02-modules/story]]          | 剧情演出 / 聊天流 / 被动闲聊                                | `src/arona-clicker/services/`                   |
| [[docs/docs-828/02-modules/visibility]]     | 可见性 / Reveal 揭示阶梯                                | `src/engine/visibility/`                         |
| [[docs/docs-828/02-modules/stats]]          | 三层统计 / Tag 统计 / 世界倾斜                             | `src/engine/stats/`                              |
| [[docs/docs-828/02-modules/extra]]          | Extra 三层附加数据树                                    | `src/engine/extra/`                              |
| [[docs/docs-828/02-modules/pics]]           | 图片资产（PicDef / ImageStore / charaProfile）         | `src/data-services/assets/`                              |
| [[docs/docs-828/02-modules/ui]]             | 前端 UI（只读消费 + controller 拆分）                      | `src/ui/`                                        |

## 03-data-structures 分区（数据结构）

| 文档 | 主题 |
| --- | --- |
| [[docs/docs-828/03-data-structures/player-state]] | PlayerState 三层运行时状态 |
| [[docs/docs-828/03-data-structures/registry]] | Registry 表 + 关系索引 + 校验 |
| [[docs/docs-828/03-data-structures/character-entities]] | Character 实体：差分/卡池/曲线/色彩 |
| [[docs/docs-828/03-data-structures/stats-views]] | 三层统计 & UI 只读视图 |
| [[docs/docs-828/03-data-structures/id-reference-semantics]] | 真引用 / 意义引用判定全表 |
| [[docs/docs-828/03-data-structures/declarative-dsl]] | 声明式 DSL 枚举总目录 |

## 04-mechanisms 分区（当前机制）

> 当前机制正文统一位于 `04-mechanisms`；旧目录 `04-algorithms` 仅保留迁移说明。

| 文档 | 主题 |
| --- | --- |
| [[docs/docs-828/04-mechanisms/state-mutation]] | 状态写入 4 步管道 |
| [[docs/docs-828/04-mechanisms/production]] | 生产结算：GameNum 四级层级树 + zone 聚合 |
| [[docs/docs-828/04-mechanisms/gacha]] | 抽卡结算 |
| [[docs/docs-828/04-mechanisms/cultivate]] | 培养推进 |
| [[docs/docs-828/04-mechanisms/color-derivation]] | 色彩派生与主题 token |
| [[docs/docs-828/04-mechanisms/trigger-effect]] | 事件联动 + GameEvent 事件目录 |
| [[docs/docs-828/04-mechanisms/roster]] | 通讯录 / 图鉴 / 招募入口 |

## 05-conventions（纪律与规范）

| 文档 | 主题 |
| --- | --- |
| [[docs/docs-828/05-conventions/architecture-discipline]] | 架构纪律 8 条（不可破坏） |
| [[docs/docs-828/05-conventions/refactoring]] | 文件拆分规范 |
| [[docs/docs-828/05-conventions/schema-sync]] | 实体类型 → 数据包编辑器同步协议 |
| [[docs/docs-828/05-conventions/testing]] | 测试纪律 |
| [[docs/docs-828/05-conventions/doc-maintenance]] | 文档维护规则（防漂移） |

## 计划与架构决策

> 原 `06-adr/` 与 `08-roadmap/` 已聚合至 [[docs/0x-plan&work/00-index]]；以下保留主题路由，正文统一维护在 `docs/0x-plan&work/`。

| 文档 | 决策 |
| --- | --- |
| [[docs/0x-plan&work/completed/adr-0001-architecture-consolidation]] | T1-T7 架构整理收官（装配外移 / 只读纪律 / 表驱动 / 环解扣） |
| [[docs/0x-plan&work/completed/adr-0002-gamenum-tree]] | GameNum 四级层级树 + 事件驱动失效（taskProduction Phase 1-8） |
| [[docs/0x-plan&work/completed/adr-0003-docs-restructure]] | 文档库重构：从日期戳手册到分层索引 |
| [[docs/0x-plan&work/active/adr-0004-datapack-management]] | Datapack 多包读取与管理（三段式命名空间 / 包库与启用集 / 惰性存档；规划中） |
| [[docs/0x-plan&work/completed/affection-planning]] | 好感系统设计（§1 数值 / §2 台阶推送与未读 / §3 羁绊尾巴挂靠推送；§4 Talklet 输入中提示未实现；2026-08-29 落地，轴 A 消息成分同日裁定移除） |

## 07-audit 设计审查（2026-08-30）

> 繁简 / 兜底问题清单（位置 / 原因 / 方案组）。**GameNum 增量失效体系与 Affector 对账链为多第三方 Datapack 基础设施，豁免**（见 00-overview）。整改完成后本分区归档。

| 文档 | 主题 |
| --- | --- |
| [[docs/docs-828/07-audit/00-overview]] | 范围 / 前提豁免 / 分组路由 |
| [[docs/docs-828/07-audit/runtime-tolerance]] | 运行时容错政策分裂（三轨失效路径 / funclet 实证 / 存档双政策） |
| [[docs/docs-828/07-audit/dual-track-state]] | 双轨与副本状态（剧情 id / 阅读记录 / equipmentId / SPECS 登记面） |
| [[docs/docs-828/07-audit/dormant-machinery]] | 休眠与预留机制（无调用点 / 无写入方 / no-op 群） |
| [[docs/docs-828/07-audit/presentation-fallbacks]] | 表现层回退链与 UI 防御密度 |
| [[docs/docs-828/07-audit/presentation-editor-consistency]] | 主题表现编辑器 / 运行时 / hover-active 一致性 |
| [[docs/docs-828/07-audit/enum-taxonomy]] | 枚举面与分类学超配（可见性阶梯 / 返回码 / EffectOp） |
| [[docs/docs-828/07-audit/stats-ledgers]] | 统计五套并记与 worldTilt 预留体系 |
| [[docs/docs-828/07-audit/sync-burden]] | 同步义务与流程负担（含漂移实证） |

## 08-roadmap 长期目标追踪

> 每个长期目标 1 篇（编号递增）：目标陈述 / 里程碑切片 / 状态 / 验收口径。设计权威在对应 ADR，本分区只管进度。

| 编号 | 目标 | 状态 |
| --- | --- | --- |
| [[docs/0x-plan&work/active/roadmap-0001-datapack-management]] | Datapack 多包管理落地（S1-S7） | 进行中（S1a/S1b 已落地） |
| [[docs/0x-plan&work/active/roadmap-0002-spot-shop]] | Spot 商店（购买集 / 发现限制） | 待设计裁定 |
| [[docs/0x-plan&work/active/roadmap-0003-gacha-pool-model]] | 卡池模型规范化（banner ↔ 角色池解耦） | 待设计裁定 |
| [[docs/0x-plan&work/active/roadmap-0004-chara-ownership]] | Chara 拥有体系 Init 化 + 追赶统计 | 待设计裁定 |
| [[docs/0x-plan&work/completed/roadmap-0005-engine-domain-consolidation]] | 基础引擎、基础数据服务与 AronaClicker 领域内聚 | ✅ 已完成（2026-09-02） |

## 命令速查

| 命令 | 用途 |
| --- | --- |
| `npm test` | vitest 全量测试 |
| `npx tsc --noEmit` | 类型检查 |
| `npm run dev:game` / `npm run dev` | UI / 引擎开发服务器 |
| `npm run build` | 构建 |
| `npm run gen:schema` | `src/engine/types/` → 编辑器 Schema 协议 |
