# docs-818 — AronaClicker 设计文档

本目录是项目的**权威设计文档**，基于 `src/` 实际代码编写，所有描述与代码一致。文档使用 Obsidian `[[link]]` 风格引用源文件。

## 文档索引

| 文件 | 内容 | 典型用途 |
|------|------|----------|
| [[01-architecture]] | 系统架构总览、技术栈、设计原则 | 理解项目全貌 |
| [[02-data-structures]] | PlayerState / Datapack / 实体定义 / 表达式 / 条件 / 效果 / Extra / 事件 | 理解"数据长什么样" |
| [[03-engine-subsystems]] | 17 个引擎子系统详解 | 理解"每个子系统怎么工作" |
| [[04-init-lifecycle]] | 世界线生命周期、帧循环、存档、离线收益 | 理解"游戏怎么跑起来" |
| [[05-access-stages]] | 可知性 / 可达性 / 生效层级 | 理解"内容如何逐步解锁" |
| [[06-ui-layer]] | UI 控制器、组件结构、刷新策略 | 理解"界面怎么渲染" |
| [[07-data-pack-system]] | 数据包加载、分片合并、Mod 导入 | 理解"内容如何注入" |
| [[08-code-map]] | 文件 → 职责 → 入口映射表 | 改某个功能时先查这里 |

## 阅读顺序建议

1. **快速了解**：[[00-README]]（本页）→ [[01-architecture]]
2. **理解数据**：[[02-data-structures]]
3. **理解机制**：[[03-engine-subsystems]] → [[04-init-lifecycle]]
4. **理解解锁**：[[05-access-stages]]
5. **理解 UI**：[[06-ui-layer]]
6. **理解内容**：[[07-data-pack-system]]
7. **定位修改**：[[08-code-map]]

## 项目一句话总结

一个**无框架 TypeScript 浏览器放置经营游戏引擎**（Blue Archive 同人）：数据包驱动内容，引擎每秒一帧结算产出，事件总线把状态变更广播给触发系统与 UI。

- 技术栈：TS strict + Vite + Vitest，UI 用原生 DOM + innerHTML，存档用 localStorage
- 入口：[[src/main.ts]]（引擎） / [[src/ui/main.ts]]（UI）
- 运行命令：`npm run dev` / `npm test` / `npm run build`

## 顶层目录速查

| 目录 | 内容 |
|------|------|
| `src/engine/` | 引擎核心：`types/`（拆分后的类型）、`game/`（Story/Spot 服务）、子系统 + 26 个测试 |
| `src/ui/` | UI 层（controller + components） |
| `src/data/` | 基础数据包（TS 常量） |
| `src/save/` | localStorage 存档 |
| `tools/datapack-editor/` | 数据包编辑器（独立工具） |
| `docs-817/` · `docs-818/` | 设计文档（818 为最新权威版） |

## 常用调试入口

- `window.__game`（引擎实例）、`window.__ui`（控制器）
- `Ctrl+Shift+D`：Enhancement 揭示条件诊断
- devLog 导出：UI 按钮 → 下载 JSON
