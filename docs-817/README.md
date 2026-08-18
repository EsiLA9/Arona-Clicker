# docs-817 — AronaClicker 项目速览

本目录是项目**当前实现**的浓缩总结，目标是让 AI（vibe coding）以最小上下文代价理解整个引擎，
再精确定位需要修改的文件。所有描述基于 `src/` 实际代码，不含规划/未实现内容。

> 读取顺序建议：先 `01` 了解全局，再按需读 `02`/`03`；`04` 是代码地图（改哪个功能先查这里）；
> `05` 是让项目更适合 AI 协作的重构建议。

## 文档索引

| 文件 | 内容 | 典型用途 |
|------|------|----------|
| [01-run-loop.md](./01-run-loop.md) | 启动流程、tick 帧循环、世界线生命周期、存档、UI 刷新 | 理解"游戏怎么跑起来" |
| [02-data-structures.md](./02-data-structures.md) | PlayerState / Datapack / 各实体定义 / 运行时状态 | 理解"数据长什么样" |
| [03-engine-mechanisms.md](./03-engine-mechanisms.md) | EventBus / 数值 / 条件 / 效果 / GameNum / Affector / Trigger / 揭示 / 统计 | 理解"机制怎么运作" |
| [04-code-map.md](./04-code-map.md) | 文件 → 职责 → 关键入口/函数的映射 | 改某个功能时查这个 |
| [05-optimization.md](./05-optimization.md) | 当前结构问题 + 面向 vibe coding 的重构建议 | 后续优化方向 |

## 项目一句话总结

一个**无框架 TypeScript 浏览器放置经营游戏引擎**（Blue Archive 同人）：
数据包（Datapack）驱动内容，引擎每秒一帧结算产出，事件总线把状态变更广播给触发系统与 UI。

- 技术栈：TS strict + Vite + Vitest，UI 用原生 DOM + innerHTML，存档用 localStorage
- 入口：`src/main.ts`（引擎） / `src/ui/main.ts`（UI）
- 运行命令：`npm run dev` / `npm test` / `npm run build`

## 顶层目录速查

| 目录 | 内容 |
|------|------|
| `src/engine/` | 引擎核心：`types/`（拆分后的类型）、`game/`（Story/Spot 服务）、子系统 + 26 个测试 |
| `src/ui/` | UI 层（controller + components） |
| `src/data/` | 基础数据包（TS 常量） |
| `src/save/` | localStorage 存档 |
| `tools/datapack-editor/` | 数据包编辑器（独立工具） |
| `docs/` · `docs-new/` · `Outdated/` | 历史设计文档（docs-817 是最新浓缩版） |
| `dist/` · `web-dist/` · `node_modules/` | 构建产物 / 依赖（勿改） |
