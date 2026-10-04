# Unit task-0161-U02：选择页全局基底与焦点投影

## Goal

让 Init / GlobalEnhancement 选择页与离开后的 body 背景使用不含旧活动场景的全局快照，并按一个焦点身份投影主题。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/ui.md` | 选择页与 UI 入口路由 |
| 文档 | `docs/docs-828/04-mechanisms/color-derivation.md` | 主题来源契约 |
| Task | `docs/plan-work/task-0161-theme-background-layer-lifecycle-pipeline.md` | 生命周期范围和验收 |
| 源码 | `src/ui/controller-theme.ts`：背景 / Presentation View | 从 selector base 建立视图 |
| 源码 | `src/ui/controller-panels.ts`、`controller.ts`：render 和 selectorContext | 让初次进入与焦点刷新共用基底 |
| 源码 | `src/ui/selector-theme.ts`：`projectSelectorTheme` | 按焦点组合主题 |
| 测试 | `tests/ui/controller-init-select.test.ts` | 验证全局保留和 scene/story 排除 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–25k tokens |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 |
| 超预算处理 | 拆分或回到 Task owner 重新收敛 Read Set |

## Optional Read Set

- `src/ui/selector-page.ts`：selector context 被焦点轮换事件使用的时点。

## Do Not Read by Default

- `docs/plan-work/archive/**`；本 Unit 使用 Task 0161 当前确认事实。
- `src/ui/components/**`；选择页 DOM 不需更改。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 重选按钮直达 `renderInitSelect()`，不会走一般 `render()` 的主题重建。 | `controller-actions-inventory.ts`、`controller-panels.ts` | 此入口需安全隔离旧场景。 |
| `projectSelectorTheme()` 把传入背景当 base，再叠加焦点主题与可能的 Area。 | `selector-theme.ts` | 输入快照必须已经按来源限定。 |
| 普通游戏页 `syncRuntimeTheme()` 会重建目标场景层。 | `controller-theme.ts:syncRuntimeTheme` | 返回游戏沿原职责重建。 |

## Constraints

- 选择页焦点投影不写 PlayerState 或 Runtime 场景栈。
- 保留 player/user 全局主题和当前焦点合法 Area；排除上一场景 Student / Story。
- 不改变选择页 DOM 结构、滚轮交互或转场动画。

## Allowed Files

- `src/ui/controller-theme.ts`
- `src/ui/controller-panels.ts`
- `src/ui/controller.ts`
- `src/ui/selector-theme.ts`
- `tests/ui/controller-init-select.test.ts`

## Explicit Non-goals

- 不重做选择页视觉设计或 root 全局 token 管理。
- 不改 Init / GlobalEnh 的选择业务和保存行为。

## Stop Conditions

按 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件六项执行；若须修改 CSS、选择页组件或改变焦点 Area 产品策略则停止上交。

## Completion Criteria

- [x] 首次渲染和后续焦点投影均使用 selector base。
- [x] body 外背景及 current scene 不再携带旧 scene/story 层。
- [x] 用户 global 主题仍出现在选择页基底中。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/controller-init-select.test.ts --silent` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 浏览器 | Restart → 聚焦不同 Init → 进入 | 屏幕/DOM 与目标焦点一致 |

## Pre-flight

- Goal：隔离选择页全局基底并按焦点投影。
- Allowed Files：以上五个文件。
- Explicit Non-goals：不改选择页 DOM / 交互。
- Stop Conditions：遵守本 Unit 六项停止条件。

