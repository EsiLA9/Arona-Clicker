# docs-824 — ACProgram 引擎文档（文件构成 / 运行逻辑 / 数据结构 / 核心算法）

> 本文档组针对当前代码库（`docs-818` 之后演进，含 Character 重构、Gacha、培养、色彩、通讯录等新子系统）编写的横向阅读手册。
> 按「四个问题」组织：**这个仓库有哪些文件 / 程序怎么跑 / 数据长什么样 / 核心算法怎么写**。

## 阅读路径

| 想了解 | 看这篇 |
| --- | --- |
| 整个仓库的文件构成与职责 | [[docs-824/01-file-composition]] |
| 程序从启动到运行的主干时序 | [[docs-824/02-run-logic]]（子文档 02a-e） |
| 核心数据类型 / 状态结构 / 注册表 / 引用语义 | [[docs-824/03-data-structures]]（子文档 03a-e） |
| 生产结算 / 抽卡 / 培养 / 色彩 / 状态写入算法 | [[docs-824/04-core-algorithms]]（子文档 04a-g） |
| 架构诊断基线（大文件清单与拆分决策） | [[docs-824/05-architecture-review]] |
| 代码拆分规范（何时拆/如何拆/验证） | [[docs-824/06-refactoring-guide]] |
| 图片资产（PicDef 存储/索引/解析） | [[docs-824/07-pic-assets]] |

## 概览

这是一个 **事件驱动 + 声明式数据包** 的放置类角色扮演游戏引擎（TypeScript，Vite + vitest）。

- **核心思想**：游戏逻辑尽量写成**数据包**（`Datapack`），由引擎的子系统解释执行，而非硬编码。
- **单一写入口**：所有状态变更都经 `StateMutationService`，禁止绕过它直接改 `PlayerState`。
- **只读 UI**：UI 层只消费 `GameInstance.getView()` / `createUIContext()` 返回的不可变快照。
- **三层状态**：跨世界线保留（global）/ per-Init / 快照三层，见 [[docs-824/03-data-structures]]。

## 主干调用链（一句话版）

```text
main.ts
  └─ new GameInstance()           组装全部子系统（构造器完成依赖注入）
       └─ init(datapacks)         加载数据包 → 校验 → 建索引 → 进入默认世界线
            └─ start()            启动 1 tick/秒 会话循环
                 └─ tick()        每帧：生产结算 → 持续效果 → 阻断复检 → 统计
```

完整时序见 [[docs-824/02-run-logic]]。

## 目录速览

| 目录 | 一句话职责 |
| --- | --- |
| `src/engine/core/` | 事件总线、Tag 路径、DevLog、运行时主题等横切基础 |
| `src/engine/types/` | 全部实体/状态/表达式类型定义（数据结构的唯一事实源） |
| `src/engine/registry/` | 数据包注册表 + 加载 + 引用校验 + 反向索引 |
| `src/engine/expression/` | 数值表达式、条件系统、Funclet、统一数值（GameNum） |
| `src/engine/effect/` | Effect 引擎、Affector 持续效果、Trigger 事件触发 |
| `src/engine/system/` | 各领域系统：状态写入、Tick、角色、通讯录、Gacha、培养、色彩… |
| `src/engine/game/` | 高层门面服务：Init、Story、Spot、Item、Session、Enhancement |
| `src/engine/stats/` | 三层统计（global / init / session） |
| `src/engine/visibility/` | 可见性快照引擎（事件驱动增量） |
| `src/data/base/` | 默认数据（TypeScript），非 `datapack/` 的 JSON |
| `src/ui/` | 前端 UI（Vue），只读消费 |
| `tests/` | vitest 测试 |

## 文档纪律

- 引用代码/文件一律使用 Obsidian `[[path]]` 链接 + `path:行号` 定位。
- 改引擎机制前先读 [[docs-824/01-file-composition]] 确认改动文件。
- 改数据结构前先读 [[docs-824/03-data-structures]] 与 `src/engine/types/**`，改完跑 `npm run gen:schema`。
- 机制改动必须带 vitest 测试。
