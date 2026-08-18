# AronaClicker — 实现文档

本文档描述 AronaClicker 项目**当前已实现**的系统、数据结构与运作方式，不包含需求规划或未实现功能。

## 文档索引

| 文件 | 内容 |
|------|------|
| [01-architecture.md](01-architecture.md) | 模块架构、启动流程、依赖关系 |
| [02-data-structures.md](1-项目/ACProgram/docs-817/docs-new/02-data-structures.md) | 所有实体定义、运行时状态结构 |
| [03-engine-core.md](03-engine-core.md) | GameInstance、Registry、EventBus、StateMutationService |
| [04-expression-systems.md](04-expression-systems.md) | ValueSystem、ConditionSystem、StatDSL 统计查询 |
| [05-production-systems.md](05-production-systems.md) | TickSystem、EffectEngine、GameNumSystem、AffectorEngine |
| [06-content-systems.md](06-content-systems.md) | VisibilityEngine、LootSystem、TriggerSystem、CharacterSystem、SpotFunctionality |
| [07-game-loop.md](07-game-loop.md) | 游戏循环、存档/读档、世界线切换、离线进度 |

## 技术栈

- **语言**: TypeScript (strict)
- **运行时**: 浏览器 (单页应用，无框架，原生 DOM 操作)
- **持久化**: localStorage
- **构建**: tsc + Vite (vitest 测试)
- **数据包**: TypeScript 常量定义，编译时嵌入
