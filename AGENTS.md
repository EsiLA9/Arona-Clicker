# AGENTS.md — AI 协作指南

## 快速上手

- 项目结构速览：`docs-818/00-README.md`
- 改引擎机制前先读：`docs-818/03-engine-subsystems.md`
- 改数据结构前先读：`docs-818/02-data-structures.md`
- 定位修改文件：`docs-818/08-code-map.md`
- 改实体字段/枚举前先读：`docs-818/09-schema-protocol.md`

## 命令

- 测试：`npm test`（vitest）
- 类型检查：`npx tsc --noEmit`
- 开发服务器：`npm run dev:game`（UI）/ `npm run dev`（引擎）
- 构建：`npm run build`
- 生成 Schema 协议：`npm run gen:schema`（src/engine/types/** → tools/datapack-editor/schema/engine-defs.gen.json）

## 架构纪律（不可破坏）

1. **单一写入口**：所有状态变更走 `StateMutationService`，禁止直接改 PlayerState
2. **事件驱动**：新增联动逻辑优先做成 Trigger/Affector，不要塞进 GameInstance 方法体
3. **数据包声明式**：新机制优先设计成 Datapack 字段（Schema 协议同步），而非硬编码
4. **只读 UI**：UI 只消费 `getView()` / `createUIContext()`，不持有写引用
5. **三层状态**：新增"跨世界线保留"数据时想清楚放 global / per-Init / 快照三层中的哪一层
6. **测试先行**：机制改动必须带 vitest 测试（`npm test` 通过才算完成）
7. **不做存档迁移**：项目处于长期开发阶段，PlayerState / Datapack 结构可随时破坏性变更，**禁止编写任何存档迁移/版本兼容代码**；旧存档失效直接清档重来。改状态结构时同步更新相关测试与文档即可

## 实体类型 → 数据包编辑器 同步协议（防漂移）

> 详见 `docs-818/09-schema-protocol.md`。

- 改 `src/engine/types/**` 的实体字段/枚举后，**必须** `npm run gen:schema`（重新生成 `engine-defs.gen.json`）。
- 简单字段（string/int/float/enum/ref/array）自动进编辑器；想带中文标签/枚举含义，在字段 TSDoc 写 `@label` / `@enum 值=中文` / `@ref <表>` / `@int`。
- 复杂/仅编辑需要的字段（条件/效果/表达式 tagged 联动、optionsFrom、collapsible 等）在 `tools/datapack-editor/schema/editor-extras.ts` 的 `TABLE_META.overrides` 兜底。
- `tools/datapack-editor/schema/engine-schema.sync.test.ts` 做三向一致检查：引擎字段↔协议↔editor 表，新增未同步即 error。

## 禁止修改

- `dist/` / `web-dist/` / `src/ui/dist/` / `node_modules/`
- `tools/datapack-editor/schema/engine-defs.gen.json`（生成产物，改源头后跑 `npm run gen:schema`）

## 代码风格

- 默认不写注释；只在 WHY 非显而易见时写
- 引用文件用路径而非复制代码，让 AI 用 Read 定向读
- 改哪个功能先查 `docs-818/08-code-map.md` 的文件→职责映射
