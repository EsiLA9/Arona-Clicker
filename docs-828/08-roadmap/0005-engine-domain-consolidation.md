# 08-roadmap/0005 — 基础引擎与 AronaClicker 领域内聚

> 本文回答：如何将基础引擎、基础数据服务、AronaClicker 领域服务、具体 Datapack 与 UI 逐步内聚。设计权威见 [[docs-828/06-adr/0005-engine-domain-boundaries]]；本文只记录施工切片、状态和验收。

## 目标陈述

把当前按技术机制拆分、但产品领域仍混杂的项目，逐步收敛为：

```text
基础引擎机制
    ↓
基础数据服务
    ↓
AronaClicker 领域模型与 Runtime
    ↓
具体 Datapack
    ↓
UI
```

其中：

- 基础引擎负责 GameNum、Condition、Effect、Trigger、Affector、Reveal、Stats、EventBus 等机制；
- 基础数据服务负责 Datapack 读取、合并、校验、持久化和资源加载；
- AronaClicker 层负责实体、PlayerState、玩法服务和领域适配器；
- `base` 是测试/示例 Datapack，不是引擎内置生产内容；
- UI 只消费 ReadModel 并发出 Commands。

## 总体状态

**规划中，尚未开始源码迁移。** 当前施工入口为 M1-2：公共入口与依赖方向。

## 里程碑切片

| 切片 | 内容 | 状态 | 依赖 |
|---|---|---|---|
| M0-1 | 新增引擎边界 ADR，修正 `base`、`GameInstance`、Registry、PlayerState、SaveData 的定位 | ✅ 已确认（2026-09-01） | 无 |
| M0-2 | 修订 `00-INDEX`、overview、Datapack Roadmap 中的旧 base 语义 | ✅ 已完成（2026-09-01） | M0-1 |
| M1-1 | 盘点模块与跨层 import，形成当前依赖基线 | ✅ 已完成（2026-09-01） | M0-2 |
| M1-2 | 新增 `engine`、`data-services`、`arona-clicker`、`app` 公共入口 | 🟡 进行中 | M1-1 |
| M1-3 | 建立禁止 engine 依赖 UI / base / AronaClicker 实现的检查 | ⬜ 未开始 | M1-2 |
| M2-1 | 将 `engine/types` 区分为机制契约与 AronaClicker 实体类型 | ⬜ 未开始 | M1-2 |
| M2-2 | 拆分 Engine Contracts 与 AronaClicker Types，保留 re-export 兼容层 | ⬜ 未开始 | M2-1 |
| M2-3 | 重新确认 Schema 生成入口与编辑器同步边界 | ⬜ 未开始 | M2-2 |
| M3-1 | 抽象 Condition / Value / GameNum 的 Engine Context | ⬜ 未开始 | M2-2 |
| M3-2 | 抽象 Reveal / Stats / Affector 的领域查询适配器 | ⬜ 未开始 | M3-1 |
| M3-3 | 新增脱离 base Datapack 的基础机制单元测试 | ⬜ 未开始 | M3-1 |
| M4-1 | 将 `GameInstance` 重新定位为 AronaClicker Runtime | ⬜ 未开始 | M2-2 |
| M4-2 | 迁移 Story / World / Character / Economy / Color 领域服务 | ⬜ 未开始 | M4-1 |
| M4-3 | 引入 Runtime ReadModel 与 Commands | ⬜ 未开始 | M4-2 |
| M5-1 | 抽出 Datapack Source / Loader / Parser / Merge 服务 | ⬜ 未开始 | M1-1 |
| M5-2 | 抽出 SaveData / SaveCodec / LocalStorage 服务 | ⬜ 未开始 | M5-1 |
| M5-3 | 抽出图片与其他外部资源加载服务 | ⬜ 未开始 | M5-1 |
| M5-4 | 将现有多包管理 S2-S7 接入新的基础数据服务边界 | ⬜ 未开始 | M5-1 |
| M6-1 | 将 `src/data/base` 重定位为测试/示例 Datapack | ⬜ 未开始 | M4-2、M5-1 |
| M6-2 | 建立正式 AronaClicker 内容包的独立入口 | ⬜ 未开始 | M6-1 |
| M6-3 | 让所有测试显式注入测试 Datapack | ⬜ 未开始 | M6-1 |
| M7-1 | UI 组件改为只依赖 ReadModel / UIContext | ⬜ 未开始 | M4-3 |
| M7-2 | UI Controller 改为通过 Commands 操作 Runtime | ⬜ 未开始 | M7-1 |
| M7-3 | 移除 UI 对具体领域服务和 base 内容的直接依赖 | ⬜ 未开始 | M7-2 |
| M8-1 | 统一 `src/main.ts` 与 `src/ui/main.ts` 启动路径 | ⬜ 未开始 | M6-2、M7-2 |
| M8-2 | 删除旧路径和兼容层，更新模块卡片与架构文档 | ⬜ 未开始 | 全部 |

## 推荐施工顺序

```text
M0 设计裁定
  ↓
M1 依赖基线与入口
  ↓
M2 类型边界
  ↓
M4 AronaClicker Runtime
  ↓
M3 基础引擎适配器
  ↓
M5 基础数据服务
  ↓
M6 Datapack 重定位
  ↓
M7 UI 能力边界
  ↓
M8 清理与收束
```

M3 和 M4 可以小范围交错，但禁止在类型边界未确定前大规模移动实现。

## 第一施工批次

### M0-1：架构边界裁定

产出：

- [[docs-828/06-adr/0005-engine-domain-boundaries]]；
- `base` 语义从“默认基础内容”改为“测试/示例 Datapack”；
- `GameInstance` 定位为 AronaClicker Runtime；
- 确认 Engine Contracts、Data Services、AronaClicker Types、UI ReadModel 四个边界。

验收：

- 用户 review 通过；
- 不修改运行时代码；
- 不引入新的架构矛盾。

### M0-2：文档路由同步

需要同步：

- [[docs-828/00-INDEX]]；
- [[docs-828/01-architecture/overview]]；
- [[docs-828/01-architecture/data-flow]]；
- [[docs-828/08-roadmap/0001-datapack-management-rollout]]；
- [[docs-828/06-adr/0004-datapack-management]]。

验收：

- 文档不再把 `base` 描述为固定生产基础包；
- 所有设计正文只在 ADR，Roadmap 只保留状态和切片。

### M1-1：依赖基线

检查范围：

- `src/engine/` 对 `src/data/`、`src/ui/`、`src/save/` 的依赖；
- UI 对具体 Engine Service、`src/data/base` 的依赖；
- SaveStorage 对 `GameInstance` 的反向依赖；
- `main.ts` 与 `ui/main.ts` 的重复启动路径；
- 测试对完整 `GameInstance` 和 base Datapack 的耦合。

产出：

- 当前 import 依赖清单；
- 模块归类表；
- 迁移顺序和冲突点；
- 后续静态约束的检查范围。

验收：

- 只读分析，不改变行为；
- 依赖清单可用于 M1-2 的入口设计。

## 每切片统一验收

```text
改动前：给出改动清单与裁定点
实现后：npx tsc --noEmit
实现后：npm test
若改 types：npm run gen:schema
完成后：同步对应 docs-828 文档
完成后：用户 review，再进入下一切片
```

## 风险与处理

| 风险 | 处理 |
|---|---|
| `engine/types` 拆分导致 Schema 漂移 | 先明确类型归属，再按 schema-sync 流程生成和验证 |
| `GameInstance` 迁移导致测试大面积修改 | 先保留 re-export 和兼容构造入口 |
| Engine Context 过度抽象 | 只抽取 GameNum / Condition / Reveal / Stats 实际需要的查询，不预先泛化全部实体 |
| Datapack 多包工作与目录迁移冲突 | 先完成 M0/M1；M5 接管现有 0001 的 Source / PackManager 工作 |
| UI ReadModel 设计过早 | 先从现有 `GameView`、`StoryView` 和 controller 调用点提取，不新造重复状态 |
| 误把测试内容当产品边界 | 所有测试 Datapack 显式注入，禁止 runtime 默认导入 base |

## 相关目标

- [[docs-828/08-roadmap/0001-datapack-management-rollout]]
- [[docs-828/08-roadmap/0002-spot-shop]]
- [[docs-828/08-roadmap/0003-gacha-pool-model]]
- [[docs-828/08-roadmap/0004-chara-ownership]]

## 进度记录（append-only）

- 2026-09-01：根据项目结构探索结果建立本目标与对应 ADR；尚未开始源码施工。
- 2026-09-01：用户确认 [[docs-828/06-adr/0005-engine-domain-boundaries]]，M0-1 完成；进入 M0-2 文档路由同步。
- 2026-09-01：完成 overview、data-flow、Datapack Roadmap 与多包 ADR 的 base 语义同步；M0-2 完成，进入 M1-1 依赖基线。
- 2026-09-01：完成模块归类、跨层 import、启动入口、存档依赖和测试耦合盘点，新增 [[docs-828/01-architecture/module-dependency-baseline]]；M1-1 完成，进入 M1-2 公共入口与依赖方向。
