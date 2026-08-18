# 05 — 面向 vibe coding 的结构优化建议

## 现状诊断：为什么 AI 难以高效工作

**规模数据**（`src/` 有效源码约 1.5 万行 + 26 个测试文件）：

| 问题 | 数据 | 影响 |
|------|------|------|
| `game-instance.ts` 过大 | ~1550 行 / 73KB | 职责混杂（总装 + 剧情 + 世界线 + Spot + 存档 + Extra API），AI 打开即吃满上下文 |
| `types.ts` 过大 | ~940 行 | 类型定义与使用混在一起，难以定向搜索 |
| UI 大文件 | `controller.ts` 712 行、`tooltip.ts` 28KB、`styles.css` 27KB | 纯 innerHTML 模板字符串可读性差，改动影响面难评估 |
| 测试与源码混排 | 26 个 `*.test.ts` 夹在 engine 目录 | 编译/搜索噪音；且测试常以完整 GameInstance 集成为主，单测边界不清 |
| 文档重复 | `docs/` + `docs-new/` + `Outdated/` 三套 | AI 难以判断哪套是"现行事实"，易被过时描述误导 |
| 构建产物入库 | `dist/`(252) + `web-dist/` + `src/ui/dist/` | 无关文件污染上下文与搜索结果 |
| 无版本控制 | 不是 git 仓库 | 无法回滚 AI 的大改动，协作风险高 |
| 行号漂移 | 文档引用的行号随编辑失效 | 建议以"文件 + 函数名"引用而非行号 |

## 建议 A：拆分大文件（收益最高）

> ✅ 已于 2026-08 执行：`types.ts` → `types/` 文件夹；`game-instance.ts` 剧情/Spot 逻辑拆至 `game/` 服务，
> GameInstance 保持门面与公开 API（`npm test` 334 用例全绿）。剩余项可作为后续增量。

**1) 拆分 `game-instance.ts` → 按领域拆服务**（✅ 已拆剧情/Spot；还可继续拆 Init/存档）：
- `story-service.ts`：startStory / advanceStory / clickSend / getSendState / triggerPassiveStory / completionReward
- `init-service.ts`：enterInit / startNewGame / restartInit / resumeInit / hardRestartInit / snapshot 读写
- `spot-service.ts`：upgradeSpot / unlockSpot / assignManager / getEffectiveMaxLevel / getSpotYield
- `save-service.ts`：save / load / 旧档迁移
- `GameInstance` 保留总装 + tick + Extra API，体积降至 ~400 行

**2) 拆分 `types.ts` → 按域分文件再 re-export**（✅ 已完成：`src/engine/types/`，`./types` 导入零改动）：
- `types/entities.ts`（InitDef/AreaDef/SpotDef/...）
- `types/state.ts`（PlayerState/InitSnapshot/GameView/Stats）
- `types/expression.ts`（Value/ValueExpression/Condition/Effect/Extra）
- `types/events.ts`（GameEvent/EventHandler）
- `types/results.ts`（各种 Result 联合类型）
- 顶部 `types/index.ts` re-export，保持全项目 `import ... from './types'` 兼容

**3) UI 拆分**：`controller.ts` 按绑定域拆（storyActions/spotActions/travelActions/saveActions）；`tooltip.ts` 的揭示阶段计算拆到 engine 侧（纯函数），UI 只做展示。

## 建议 B：重构文档体系（上下文管理）

- **文档分层**：保留 `docs-817` 作为唯一"当前实现"权威源；`docs/`(规划) 与 `docs-new/` 合并归档到 `docs/archive/`，或加 `OBSOLETE` 头标注。
- **每个文档带事实头**：写明"最后核对版本/日期 + 对应源码路径"。
- **索引用函数名**：`04-code-map.md` 统一用 `文件:函数` 引用，不写行号。
- **变更文档纪律**：改引擎机制时必须同步更新 docs-817 对应小节（把它当"架构契约"）。

## 建议 C：让 AI 快速获得上下文

- **根目录放 `AGENTS.md`**（opencode 会自动加载）：
  ```
  # AGENTS.md
  - 项目结构速览见 docs-817/README.md
  - 改引擎机制前先读 docs-817/03-engine-mechanisms.md
  - 测试：npm test（vitest）；类型检查：npx tsc --noEmit
  - 状态写入必须走 StateMutationService，禁止直接改 PlayerState
  - 改 types.ts 需同步 tools/datapack-editor/schema 的 JSON Schema（npm run gen:schema）
  - 禁止修改 dist/ web-dist/ src/ui/dist/ node_modules/
  ```
- **给 AI 的任务模板**（用 task 工具时复用）：指定"文件:函数"入口 + 期望行为 + 测试命令。
- **提示词里引用文件而非复制代码**：让 AI 用 Read 定向读，避免把 1500 行拖进上下文。

## 建议 D：工程卫生

- **初始化 git**：首次提交作为基线，之后每次大改可 diff/回滚。
- **清理构建产物**：`.gitignore` 加 `dist/ web-dist/ node_modules/ src/ui/dist/`（若产物要发布可改走构建流程）。
- **清理 `Outdated/`**：确认无用后删除或移出工作区。
- **测试策略**：把集成测试（建完整 GameInstance）与单元测试分开目录（如 `src/**/__tests__/*.unit.test.ts` vs `tests/integration/`），降低引擎目录噪音；新系统先写单测。
- **校验一致性**：`npm run gen:schema` 保持 `types.ts` 与数据包编辑器 Schema 同步；给 engine 加 `npm run typecheck` 脚本。

## 建议 E：保持的"架构纪律"（AI 改造时不要破坏）

1. **单一写入口**：所有状态变更走 `StateMutationService`，AI 不要绕过它直接改 state。
2. **事件驱动**：新增联动逻辑优先做成 Trigger/Affector，不要塞进 GameInstance 方法体。
3. **数据包声明式**：新机制优先设计成 Datapack 字段（JSON Schema 同步），而非硬编码。
4. **只读 UI**：UI 只消费 `getView()` / `createUIContext()`，不持有写引用。
5. **三层状态**：新增"跨世界线保留"数据时想清楚放 global / per-Init / 快照三层中的哪一层。
6. **测试先行**：机制改动必须带 vitest 测试（`npm test` 通过才算完成）。
