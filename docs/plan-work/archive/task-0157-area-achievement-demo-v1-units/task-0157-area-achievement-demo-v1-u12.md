# Unit 0157-U12：可导入 ZIP 与使用说明

## Goal

把 U11 的 JSON 打包成玩家可导入的 ZIP，并验证真实包解析、加入包库、启用到 Runtime 的路径。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 包与 Unit 边界 |
| 计划 | Task 0157、本 Unit、U11 Receipt | 演示包语义 |
| 内容 | `datapack/area-achievement-demo/datapack.json`、`00-world.json`、`01-achievements.json` | ZIP 单一来源 |
| 源码 | `src/data-services/datapack/pack-parser.ts:parsePackFromZipBuffer`、`src/arona-clicker/runtime.ts:registerParsedPack/applyPackConfiguration` | 玩家导入与启用路径 |
| 测试 | `tests/data/area-achievement-demo.test.ts`、`tests/engine/arona-runtime-pack.test.ts` | 内容与包库验证入口 |

## Context Budget

目标约 10k–18k tokens；额外阅读超过 2 个文件或 60k tokens 时停报。

## Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| U11 的 JSON 已通过真实玩法测试，manifest 与内容 name/version 一致 | U11 Receipt、上述 JSON |
| `parsePackFromZipBuffer` 要求根目录 `datapack.json`，并将其它 JSON 分片合并为 Datapack | `pack-parser.ts:parsePack` |
| Runtime 允许将解析结果登记入包库、配置启用集并应用 | `runtime.ts:registerParsedPack/applyPackConfiguration` |

## Constraints

- 生成 `datapack/area-achievement-demo.zip`，ZIP 根目录恰含源文件夹的三个 JSON，内容与源文件逐字节一致；不包入外层目录。
- README 用简明玩家步骤说明导入、启用、进入演示 Init、设施产出与往返收集；注明奖励自动结算及第二 Area 首访前不可见。
- 在 U11 现有测试中追加真实 ZIP 测试：读取归档，检查分片与源码一致，调用真实 `parsePackFromZipBuffer`，加入 `AronaClickerRuntime` 包库并启用，检查目标 Init／Area／Achievement 注册。
- 顺手把现有 `achievementIds` 测试辅助函数改为直接从 `getAchievementView().map(item => item.id)` 取 ID，避免从 JSON 字符串解析展示结果。
- ZIP 是交付物；不额外引入构建脚本或改动 UI 导入行为。

## Allowed Files

- datapack/area-achievement-demo.zip（本 Unit 新建）
- datapack/area-achievement-demo/README.md（本 Unit 新建）
- `tests/data/area-achievement-demo.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u12-receipt.md`

## Explicit Non-goals

- 不修改源 JSON、基础包、引擎机制、编辑器或 UI。
- 不添加其它玩法或截图。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若真实导入与 U11 内容存在协议冲突，停止报告，不改源 JSON。

## Completion Criteria

- [ ] ZIP 可从玩家导入入口解析并加入包库启用；内含源 JSON，无分片漂移。
- [ ] README 说明玩家可重复体验的最短流程。
- [ ] 定向测试、类型与文档检查通过，Receipt 记录结果。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/data/area-achievement-demo.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
