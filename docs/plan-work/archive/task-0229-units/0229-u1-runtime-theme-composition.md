# Unit 0229-U1：统一运行时主题合成与派生画布底层

## Goal
在 Engine 的运行时主题合并结果中统一生成一条稳定的派生画布底层；让来源可寻址的 Preview 替换对应主题贡献；移除 UserTheme 专属的重复底层注入。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/context-packs/ui-presentation.md`、`docs/docs-829/06-wiki/50-ui/presentation-theme.md` | Unit、主题与背景边界 |
| 源码 | `src/engine/core/theme-runtime.ts`：`ThemeLayer`、`RuntimeThemeManager.resolve()` | 统一来源合并和背景排序 |
| 源码 | `src/arona-clicker/services/color-system.ts`：`syncUserThemeFromState()`、`setUserThemePreview()` | 移除 UserTheme 专属派生层 |
| 源码 | `src/ui/controller-theme.ts`：`syncRuntimeTheme()` | 为 player / scene 层分配稳定来源 ID |
| 测试 | `tests/engine/theme-runtime.test.ts`、`tests/engine/color-system.test.ts` | 合并、preview 与 UserTheme 行为 |

## Context Budget
约 10k–25k token；只读主题运行时路径。超出 3–5 个文件或需要改其它模块时先停并上报。

## Optional Read Set
- `tests/ui/background-service.test.ts`（仅当背景 LayerView 断言受影响时）

## Do Not Read by Default
- `tools/datapack-editor/**`（交由 U3）
- `src/ui/selector-theme.ts`（交由 U2）
- `docs/plan-work/archive/**`，调查 Task 0228 除外

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前 `RuntimeThemeManager.resolve()` 合并各来源的 background，但不生成 theme-token canvas layer。 | `src/engine/core/theme-runtime.ts`：`resolve()` | 来源 list 为空直接返回空背景。 |
| 用户主题路径在 ColorSystem 中手工前置 `system-color-background` 到全局层。 | `src/arona-clicker/services/color-system.ts`：`syncUserThemeFromState()`、`setUserThemePreview()` | 此 Unit 收敛到 Engine 合并结果。 |
| 背景图层顺序首项 z-index 最低；`backgroundLayerOrder` 只对普通层排序。 | `src/engine/core/theme-runtime.ts`：`rebuildBackground()`、最终 sort；`src/ui/background-service.ts`：`renderBackground()` | 派生底层要固定在最底。 |

## Constraints
- 派生底层由最终合并的 `bg` / `bgAlt` tokens 决定；任何显式图层存在时仍生成。
- 稳定保留 `system-color-background` ID，置于所有显式图层下方且不允许排序提到上方。
- `systemColorLayerIgnored`、全局图层合并/覆盖和背景替换语义保持；不改变 UI DOM renderer。
- 一般来源替换 Preview 在目标层原优先级位置替换 token/background/presentation 贡献；找不到目标时按现有 Preview 优先级追加。
- 不把 Init 注入运行时；Init selector 由 U2 处理。

## Allowed Files
- `src/engine/core/theme-runtime.ts`
- `src/arona-clicker/services/color-system.ts`
- `src/ui/controller-theme.ts`
- `tests/engine/theme-runtime.test.ts`
- `tests/engine/color-system.test.ts`

## Explicit Non-goals
- 不增加 ThemeDef / ColorGroup Schema 字段（U3）。
- 不改 Init 选择页（U2）。
- 不新增一般主题编辑/保存服务（U4）。
- 不改 Hoshino 或 triangles 内容数据。

## Stop Conditions
遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件全部 6 条；尤其新路径或需改 Allowed Files 外文件即停止上报。

## Completion Criteria
- [x] 运行时最终合并结果始终含一条 bg/bgAlt 派生的 system canvas layer；`systemColorLayerIgnored` 继续由统一渲染过滤；显式 layers 仍叠在其上。
- [x] Preview 可按 source ID 原优先级替换主题贡献；不影响其它来源、图层顺序或用户现有 Preview 行为。
- [x] UserTheme 与 Preview 不再由 ColorSystem 单独生成重复的 system layer。
- [x] 定向 Engine / ColorSystem 测试、类型检查通过。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/theme-runtime.test.ts tests/engine/color-system.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 差异检查 | `git diff --check` | 通过 |
