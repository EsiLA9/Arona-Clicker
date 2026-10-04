# docs-829 — 项目文档总入口

> 本文只负责路由。当前机制事实来自源码与测试；本目录从现行代码重新建立，不继承旧文档中的未核实断言。

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
| 系统概览、依赖方向与运行流 | [[docs/docs-829/01-architecture/overview]] |
| 模块职责与源码入口 | [[docs/docs-829/02-modules/00-index]] |
| 按大模块浏览分功能 Wiki | [[docs/docs-829/06-wiki/00-index]] |
| 数据定义、存储与引用语义 | [[docs/docs-829/03-data-structures/00-index]] |
| 机制流程与事件协作 | [[docs/docs-829/04-mechanisms/00-index]] |
| 架构边界、Schema、测试与文档规则 | [[docs/docs-829/05-conventions/00-index]] |

### 常见任务

| 任务 | 路由 |
| --- | --- |
| 改实体字段或枚举 | [[docs/docs-829/05-conventions/schema-sync]] |
| 改状态归属 / Init 快照 | [[docs/docs-829/03-data-structures/player-state]] |
| 改状态写入或事件联动 | [[docs/docs-829/04-mechanisms/state-mutation]]、[[docs/docs-829/04-mechanisms/effect-trigger]] |
| 改 UI 刷新、命令或表现 | [[docs/docs-829/06-wiki/50-ui/00-index]] |
| 写或调整测试 | [[docs/docs-829/05-conventions/testing]] |

## 文档边界

- `01-architecture/` 讲跨模块关系；`02-modules/` 提供简短源码卡；`03-data-structures/` 讲布局与语义；`04-mechanisms/` 讲可观察行为及流程。
- `06-wiki/` 按 Outline 组织概念和跨功能协作，指向而不复制字段与算法正文。
- `docs/docs-829/` 是唯一持续维护的项目文档系统。旧 `docs/docs-828/` 路径只保留兼容重定向；原文作为只读历史快照存放于 `docs/archive/docs-828-snapshot/`，不作为当前事实输入。旧规划材料继续由 `docs/plan-work/archive/` 管理。
