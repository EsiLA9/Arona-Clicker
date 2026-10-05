# Unit 0229-U2：外部选择页复用统一背景合成

## Goal
让外部 Init 选择页以和运行时相同的派生底层合成规则投影聚焦 Init / 恢复 Area 主题，同时继续保持 Init 主题仅在选择页有效。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/context-packs/ui-presentation.md`、`docs/docs-829/06-wiki/50-ui/presentation-theme.md` | UI / 生命周期与 Unit 纪律 |
| 源码 | `src/ui/selector-theme.ts`：`projectSelectorTheme()`、`mergeSelectorBackgrounds()` | Init / Area 投影和绘制顺序 |
| 源码 | `src/ui/controller-theme.ts`：`syncRuntimeTheme()` | 确认 Init 没有运行时注入 |
| 测试 | `tests/ui/selector-theme.test.ts`、`tests/ui/controller-init-select.test.ts` | 选择页投影及运行期隔离 |

## Context Budget
约 8k–18k token；限定 selector projection 与其测试。超出白名单停止上报。

## Optional Read Set
- `src/ui/background-service.ts`：仅核对背景 view 层顺序。

## Do Not Read by Default
- `tools/datapack-editor/**`
- `src/ui/components/user-theme-editor.ts`
- `docs/plan-work/archive/**`（调查 Task 0228 除外）

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 选择页自行合并 base、focus 与恢复 Area 背景，并在无 focus layer 时创建 selector fallback。 | `src/ui/selector-theme.ts`：`projectSelectorTheme()` | 派生画布底层应在完成最终合并后生成一次。 |
| Init 主题仅从 selector 的 selected theme 投影；游戏运行时不压入 Init scene layer。 | `src/ui/controller-theme.ts`：`syncRuntimeTheme()`；Task 0227 | 此生命周期约束继续生效。 |

## Constraints
- 复用 U1 公共 helper；最终 selector token 只生成一条派生底层，置于 runtime base、focus 与 Area 显式 layer 下方。
- 若恢复 Area token 覆盖 Init token，派生底层使用最终 selector tokens；选择 Init 变体内容仍按其现有变体顺序。
- Init 色彩与背景不写回游戏运行时状态。

## Allowed Files
- `src/ui/selector-theme.ts`
- `tests/ui/selector-theme.test.ts`
- `tests/ui/controller-init-select.test.ts`
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`

## Explicit Non-goals
- 不改运行时 theme resolver（U1）。
- 不编辑 Datapack Schema 或内容写服务（U3/U4）。
- 不改变 selector 页面布局或过渡动画。

## Stop Conditions
遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件全部 6 条；尤其超出白名单时停止上报。

## Completion Criteria
- [x] Init selector projection 和 Runtime 使用同一派生背景 helper / layer ID / stack order。
- [x] selector focus theme 与恢复 Area 显式层下方保有最终派生底色。
- [x] 测试证明 Init theme 仍不进入 gameplay runtime layer stack。
- [x] selector 定向测试、类型检查、文档检查通过。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/selector-theme.test.ts tests/ui/controller-init-select.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 0 errors |
