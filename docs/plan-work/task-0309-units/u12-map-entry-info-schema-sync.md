# Unit 0309-U12：同步 Map 行前说明 Schema

## Goal

将 `GameplayMapDef.entryInfo` 的当前源码契约同步到独立 Datapack Editor 使用的生成协议，并证明生成结果与生成器解析一致。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 约定 | `AGENTS.md` 工作边界及其当前用户授权答复 | 用户于 2026-10-21 明确允许对本字段受控生成 Schema；本 Unit 将生成文件纳入窄白名单 |
| 约定 | `docs/docs-829/05-conventions/schema-sync.md` | 确认生成命令、产物与同步测试 |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` 的内容契约范围 | 固定 `entryInfo.description` 与 `tips` 的可选纯展示形状 |
| 源码 | `src/data-services/contracts/gameplay-map.ts:GameplayMapDef.entryInfo` | 生成输出的权威源 |
| 生成器 / 测试 | `scripts/gen-engine-schema.mjs`、`tools/datapack-editor/schema/engine-schema.sync.test.ts` | 核对生成和验证流程，不手编辑 JSON |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 源契约将 `entryInfo` 定义为可选对象，含可选只读 `description?: string` 与 `tips?: readonly string[]` | `src/data-services/contracts/gameplay-map.ts:GameplayMapDef` | 字段仅作展示 |
| 当前共享工作树生成 JSON 已含 `entryInfo`，并含并行 Area Map 字段 | `tools/datapack-editor/schema/engine-defs.gen.json` 当前内容 | 生成前需与源码解析结构比较；不得丢失并行 Schema 内容 |
| 生成命令写入且仅写入 `tools/datapack-editor/schema/engine-defs.gen.json` | `scripts/gen-engine-schema.mjs` CLI；`package.json` `gen:schema` | 生成产物不得手动编辑 |

## Constraints

- 用户已针对 Task 0309 授权运行受控 Schema 生成命令；本 Unit 的 Allowed Files 仅纳入生成器指定输出。
- 生成前后确认 AreaMap 与 Story 等并行源码字段仍在生成结果中。
- 不手编辑 JSON；不修改生成器、editor-extras、Editor 表元数据或其他 Schema 文件。
- 若生成器结构与当前 checked-in 文件不一致且会覆盖并行任务内容，停止并上报，不覆盖或重建。

## Allowed Files

- `tools/datapack-editor/schema/engine-defs.gen.json`（只能由 `npm run gen:schema` 写入）

## Explicit Non-goals

- 不改变 Map 契约、玩法、`resumeVersion`、运行时投影或准备页 UI。
- 不扩展独立 Datapack Editor 的 Map 编辑界面或手工字段覆盖。

## Stop Conditions

适用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条。特别是：生成结构将移除当前并行 AreaMap / Story 字段、要求编辑生成器或扩大 Allowed Files、或同步验证失败时停止并上报。

## Completion Criteria

- [x] 仅通过生成命令更新生成协议。
- [x] 生成协议包含 `GameplayMapDef.entryInfo` 且和源码解析结构一致；并行 Schema 字段保留。
- [x] Schema 同步测试与全项目类型检查通过。
- [x] Receipt 记录实际执行命令、生成差异与未完成项。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 受控生成 | `npm run gen:schema` | 完成；只改 Allowed File，保留并行 Schema 结构 |
| Schema 同步 | `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts` | 全部通过 |
| 类型检查 | `npx tsc --noEmit` | 通过 |
| 结构复核 | 比较生成 JSON 的 `defMap` / `defs` / `indexedTypes` 与 `parseEngineSchema()` | 结构相同，entryInfo 与并行字段均保留 |
