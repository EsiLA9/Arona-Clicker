# Unit 0229-U4：跨来源派生底层禁用选项传播

## Goal
将 ThemeDef / ColorGroup 的统一派生底层开关传播至运行时和 Init selector；保留单一 `systemColorLayerIgnored` 渲染过滤方式。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/context-packs/ui-presentation.md`、`docs/docs-829/06-wiki/50-ui/presentation-theme.md` | UI theme 边界 |
| 源码 | `src/arona-clicker/services/color-system.ts`：`syncPlayerThemeFromState()`、`setUserThemePreview()` | ColorGroup 与 UserTheme flag 投影 |
| 源码 | `src/ui/controller-theme.ts`：`syncRuntimeTheme()` | Area / student ThemeDef 到 ThemeLayer |
| 源码 | `src/ui/selector-theme.ts`：`projectSelectorTheme()`、`withScopeVars()` | Selector 合并层与绘制过滤 |
| 测试 | `tests/engine/theme-runtime.test.ts`、`tests/ui/selector-theme.test.ts`、`tests/ui/controller-init-select.test.ts` | disabled 语义、生命周期 |

## Context Budget
约 10k–20k token；本 Unit 仅负责 optional flag propagation 与 selector rendering filter。

## Optional Read Set
- U3 Schema unit 完成后的生成 Schema 与相关 sync 测试。

## Do Not Read by Default
- 一般主题保存服务（U5）
- 独立 Datapack Editor 页面与用户编辑器视觉重构

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| RuntimeThemeManager 已暴露统一 `systemColorLayerIgnored` 层选项，`buildBackgroundView()` 按保留 layer ID 过滤渲染和 ink。 | `src/engine/core/theme-runtime.ts`、`src/ui/controller-theme.ts`、`src/ui/background-service.ts` | 所有来源使用同一解析结果 flag。 |
| UserTheme 将此设置保存在自己的草稿/存储模型；一般 ThemeDef / ColorGroup 字段由 U3 添加。 | `src/arona-clicker/types/user-theme.ts`；U3 | 该 Unit 负责适配，不迁移 UserTheme 存储 owner。 |

## Constraints
- flag 缺省不覆盖低优先级来源；显式 false/true 依主题 layer 优先级覆盖。
- Init selector 对焦点 Init、恢复 Area、玩家/User 来源按同一来源层次确定最终 flag；选择页变化不注入游戏 runtime。
- 派生 layer 保留在 BackgroundView 中；flag 为 true 时由既有统一过滤隐藏，不删除/重写作者显式图层。

## Allowed Files
- `src/arona-clicker/services/color-system.ts`
- `src/ui/controller-theme.ts`
- `src/ui/selector-theme.ts`
- `tests/engine/theme-runtime.test.ts`
- `tests/ui/selector-theme.test.ts`
- `tests/ui/controller-init-select.test.ts`

## Explicit Non-goals
- 不修改 Schema/生成文件（U3）。
- 不改变 Init runtime 隔离规则。
- 不改页面背景视觉层级或增加第二种关闭语义。

## Stop Conditions
遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件全部 6 条；若发现优先级需要新增裁定则停并上报。

## Completion Criteria
- [x] ColorGroup、ThemeDef、UserTheme 关闭/开启派生底层的覆盖规则一致，缺省时沿用低优先级来源。
- [x] Selector 的 BackgroundView 持有统一 disable flag；派生底层可见性与 ink 合成一致。
- [x] Init disable 只影响选择页，Area disable 运行时作用于 Area 主题层；其它来源与 layers 不被清除。
- [x] 定向测试、类型检查通过。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/theme-runtime.test.ts tests/ui/selector-theme.test.ts tests/ui/controller-init-select.test.ts` | 本 Unit 直接断言通过；允许记录并隔离与 Unit 无关的既存失败 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 差异检查 | `git diff --check` | 通过 |
