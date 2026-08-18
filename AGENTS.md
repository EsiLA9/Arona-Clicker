# AGENTS.md — AI 协作指南

## 快速上手

- 项目结构速览：`docs-818/00-README.md`
- 改引擎机制前先读：`docs-818/03-engine-subsystems.md`
- 改数据结构前先读：`docs-818/02-data-structures.md`
- 定位修改文件：`docs-818/08-code-map.md`

## 命令

- 测试：`npm test`（vitest）
- 类型检查：`npx tsc --noEmit`
- 开发服务器：`npm run dev:game`（UI）/ `npm run dev`（引擎）
- 构建：`npm run build`
- 生成 JSON Schema：`npm run gen:schema`

## 架构纪律（不可破坏）

1. **单一写入口**：所有状态变更走 `StateMutationService`，禁止直接改 PlayerState
2. **事件驱动**：新增联动逻辑优先做成 Trigger/Affector，不要塞进 GameInstance 方法体
3. **数据包声明式**：新机制优先设计成 Datapack 字段（JSON Schema 同步），而非硬编码
4. **只读 UI**：UI 只消费 `getView()` / `createUIContext()`，不持有写引用
5. **三层状态**：新增"跨世界线保留"数据时想清楚放 global / per-Init / 快照三层中的哪一层
6. **测试先行**：机制改动必须带 vitest 测试（`npm test` 通过才算完成）

## 禁止修改

- `dist/` / `web-dist/` / `src/ui/dist/` / `node_modules/`
- 改 `src/engine/types/` 需同步 `tools/datapack-editor/schema`（`npm run gen:schema`）

## 代码风格

- 默认不写注释；只在 WHY 非显而易见时写
- 引用文件用路径而非复制代码，让 AI 用 Read 定向读
- 改哪个功能先查 `docs-818/08-code-map.md` 的文件→职责映射
