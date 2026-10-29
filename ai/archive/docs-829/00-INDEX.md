# docs-829 — 项目文档总入口

> 本文只负责当前项目机制与结构的导航；已知任务领域可从 [[1-项目/GALHCG/AGENTS]] 直接进入对应领域包，无需先读本页。当前机制事实来自源码与测试；本目录不继承旧文档中的未核实断言。

## 系统一句话

Arona Clicker 由声明式 Datapack 提供内容，产品 Runtime 组合通用 Engine 与领域服务；游戏状态、派生机制和 UI 查询视图由明确的读写边界连接。

## 主干阅读路线

```text
游戏入口 → App bootstrap → AronaClicker Runtime / PackManager
  → Datapack / Registry → Engine 与产品领域服务
  → PlayerState / 派生系统 → GameView / UIContext → UI
```

### 架构与模块

| 想了解 | 阅读 |
| --- | --- |
| 第一次接触项目，从哪里开始 | [[ai/archive/docs-829/01-architecture/first-read]] |
| 系统概览、依赖方向与运行流 | [[ai/archive/docs-829/01-architecture/overview]] |
| 模块职责与源码入口 | [[ai/archive/docs-829/02-modules/00-index]] |
| 按大模块浏览分功能 Wiki | [[ai/archive/docs-829/06-wiki/00-index]] |
| 数据定义、存储与引用语义 | [[ai/archive/docs-829/03-data-structures/00-index]] |
| 机制流程与事件协作 | [[ai/archive/docs-829/04-mechanisms/00-index]] |
| 架构边界、Schema、测试与文档规则 | [[ai/guide/conventions/00-index]] |

### 常见任务

| 任务 | 路由 |
| --- | --- |
| 改实体字段或枚举 | [[ai/guide/conventions/schema-sync]] |
| 改状态归属 / Init 快照 | [[ai/archive/docs-829/03-data-structures/player-state]] |
| 改状态写入或事件联动 | [[ai/archive/docs-829/04-mechanisms/state-mutation]]、[[1-项目/ACProgram/ai/archive/docs-829/04-mechanisms/engine/effect-trigger]] |
| 改 UI 刷新、命令或表现 | [[ai/archive/docs-829/06-wiki/50-ui/00-index]] |
| 写或调整测试 | [[ai/guide/conventions/testing]] |

## 文档边界

- `01-architecture/` 讲跨模块关系；`02-modules/` 提供简短源码卡；`03-data-structures/` 讲布局与语义；`04-mechanisms/` 讲可观察行为及流程。
- `06-wiki/` 按 Outline 组织概念和跨功能协作，指向而不复制字段与算法正文。
- `ai/archive/docs-829/` 是唯一持续维护的项目文档系统。旧 `docs/docs-828/` 已退役删除；原文作为只读历史快照存放于 `ai/archive/docs-history/docs-828-snapshot/`，不作为当前事实输入。旧规划材料继续由 `ai/archive/` 管理。
