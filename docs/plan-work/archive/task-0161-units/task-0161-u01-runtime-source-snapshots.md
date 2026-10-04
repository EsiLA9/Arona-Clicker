# Unit task-0161-U01：按来源解析运行时主题快照

## Goal

让 Runtime 能排除场景来源构建选择页快照，并让编辑 Preview 精确替换已应用 user 背景贡献。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/04-mechanisms/color-derivation.md` | 当前主题合并契约 |
| 文档 | `docs/docs-828/05-conventions/architecture-discipline.md`、`testing.md` | 架构与测试要求 |
| Task | `docs/plan-work/task-0161-theme-background-layer-lifecycle-pipeline.md` | 目标与确认事实 |
| 源码 | `src/engine/core/theme-runtime.ts`：`ThemeLayer`、`resolve` | 实现来源筛选和背景贡献替换 |
| 源码 | `src/arona-clicker/services/color-system.ts`：`runtimeTheme`、Preview | 暴露 selector base 与标记 preview 替换来源 |
| 测试 | `tests/engine/theme-runtime.test.ts` | 验证场景隔离与用户来源替换 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k tokens |
| 文档 Read Set | 4 篇，均为当前机制 / 施工规则 |
| 历史文档 | 0 |
| 超预算处理 | 拆分或回到 Task owner 重新收敛 Read Set |

## Optional Read Set

- `src/arona-clicker/contracts/color-query.ts`：selector 方法的只读服务接口。

## Do Not Read by Default

- `docs/plan-work/archive/**`；无本 Unit 需要的历史裁定。
- `src/ui/**`；页面接线属于 U02 / U03。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Runtime 先合并 player 与场景，再追加 user、preview、ephemeral；背景 ID 相同则替换，不同则追加。 | `theme-runtime.ts:resolve` | 旧 merge 不记录每个最终背景层的 owner。 |
| Preview 是独立高优先级槽，现有 merge 无法移除较低 user 槽的其它 ID 图层。 | `theme-runtime.ts:resolve`、`color-system.ts:setUserThemePreview` | 只替换 user 来源；场景来源保留。 |

## Constraints

- 所有持久 PlayerState 写入继续走 `StateMutationService`。
- Runtime Snapshot 是只读派生；不新增存档迁移或 Datapack 字段。
- 遵守 `docs/docs-828/05-conventions/architecture-discipline.md` 与项目 TypeScript 风格。

## Allowed Files

- `src/engine/core/theme-runtime.ts`
- `src/arona-clicker/contracts/color-query.ts`
- `src/arona-clicker/services/color-system.ts`
- `tests/engine/theme-runtime.test.ts`

## Explicit Non-goals

- 修改选择页 DOM 或图层管理器。
- 改变现有 stable ID、匿名层、颜色 token 或剧情层优先级。

## Stop Conditions

按 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件六项执行；若需要额外文件、改变持久化 Schema 或改变场景保留策略则停止并交回 Task owner。

## Completion Criteria

- [x] Runtime 支持显式排除场景/剧情层的选择页全局快照。
- [x] Preview 可移除已应用 user 背景来源并合并草稿，不移除场景层。
- [x] 定向 Runtime 测试覆盖两种来源边界。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/theme-runtime.test.ts --silent` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Pre-flight

- Goal：按来源解析运行时主题快照。
- Allowed Files：以上四个文件。
- Explicit Non-goals：不改 UI、不改持久化 Schema。
- Stop Conditions：遵守本 Unit 六项停止条件。

