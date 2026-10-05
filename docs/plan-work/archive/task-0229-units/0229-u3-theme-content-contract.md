# Unit 0229-U3：一般主题背景控制契约与 Schema

## Goal
令 ColorGroup 与 ThemeDef 具有一致的派生画布底层控制契约，并将其同步到 Datapack Editor Schema。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/docs-829/05-conventions/schema-sync.md`、`docs/docs-829/03-data-structures/datapack-contracts.md` | 数据契约、Schema 生成边界 |
| 源码 | `src/engine/types/theme.ts`：`ThemeDef`；`src/data-services/contracts/color.ts`：`ColorGroupDef` | 声明统一开关 |
| 源码 | `tools/datapack-editor/schema/editor-extras.ts` | 复杂表 UI 元数据（仅字段需补充时） |
| 测试 | `tests/engine/color-derive.test.ts`、相关 Schema sync 测试 | 解析契约与 Schema 同步 |

## Context Budget
约 8k–18k token。生成文件只由 `npm run gen:schema` 更新；不得手改。

## Optional Read Set
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`。

## Do Not Read by Default
- UI 主题渲染源（U1/U2）
- 与 ThemeDef / ColorGroup 无关的 Datapack 表

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| ThemeDef 目前声明 colorGroup、palette、tokens、nodes、background 与 presentation。 | `src/engine/types/theme.ts`：`ThemeDef` | 加入统一的显式派生底层配置。 |
| ColorGroupDef 当前 theme 是 tokens，不含画布背景生成开关。 | `src/data-services/contracts/color.ts`：`ColorGroupDef` | 加入同名控制字段，和 ThemeDef 表意一致。 |

## Constraints
- 新字段必须说明默认值、继承/覆盖优先级和对 UserTheme 的映射。
- 按 AGENTS.md 同步运行 schema generator 与 schema 测试。
- 不添加存档迁移。

## Allowed Files
- `src/engine/types/theme.ts`
- `src/data-services/contracts/color.ts`
- 生成器输出 `tools/datapack-editor/schema/engine-defs.gen.json`（只能由 `npm run gen:schema` 写入）

## Explicit Non-goals
- 不手动编辑生成 JSON。
- 不改变主题色派生算法或图层内容。
- 不扩展编辑器视觉交互。

## Stop Conditions
遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件全部 6 条；任何 Schema 作用域扩大须先上报。

## Completion Criteria
- [x] ColorGroupDef 与 ThemeDef 使用一致的 `systemColorLayerIgnored` 派生画布底层开关字段，缺省均为启用派生底层。
- [x] `npm run gen:schema` 与 Schema sync 测试通过，生成文件内容仅来自生成器。
- [x] 类型和颜色派生测试通过。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Schema 生成 | `npm run gen:schema` | 生成成功 |
| 定向测试 | `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts tests/engine/color-derive.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
