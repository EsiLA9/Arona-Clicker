# Task：Init 主题仅用于外部选择页

状态：completed — 运行时 Init 主题已移除，选择页投影与回归用例保留

## 目标

Init 的声明主题只在外部 Init 选择页作为聚焦预览；进入游戏后不再注入 Init 的颜色、全局背景或 Presentation。Area、学生、玩家自定义主题和临时演出仍按现有运行时规则生效。

## 设计边界

- 本 Task 包含：分离 Init 选择页主题投影与游戏内运行时主题；更新当前机制文档与回归测试。
- 明确非目标：不改变 Area、学生、玩家自定义主题、剧情临时主题的合并顺序；不修改 Init 数据声明或主题编辑 UI。
- 已裁定来源：用户要求“只有在外部选择init停留的时候才显示init主题”。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 进入游戏时 `syncRuntimeTheme()` 会把当前 Init 的 ThemeDef 推入运行时 `init` scene scope | `src/ui/controller-theme.ts`：`syncRuntimeTheme` | 游戏内收到 Init 的 tokens、background 与 presentation |
| Init 选择页独立读取聚焦 Init 的 ThemeDef 与 backgroundVariants | `src/ui/selector-theme.ts`：`projectSelectorTheme`、`backgroundLayers`；`tests/ui/selector-theme.test.ts` | 可保留 Init 的外部选择预览，不依赖游戏运行时 Init scope |
| 运行时主题解析默认包含 Init scene scope | `src/engine/core/theme-runtime.ts`：`resolve` | 去掉 UI 运行时 Init 层写入后，主题运行时自然不含 Init 贡献 |

## 施工切片

### P0：移除游戏内 Init 主题注入

#### Unit 0227-U1：Init ThemeDef 只参与选择页

## Patch Unit 0227-U1：Init ThemeDef 只参与选择页

### Goal

游戏运行时不再应用当前 Init 的 ThemeDef；外部 Init 选择页仍显示聚焦 Init 主题。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/06-wiki/50-ui/presentation-theme.md` | 当前主题运行时与选择页职责 |
| 源码 | `src/ui/controller-theme.ts:syncRuntimeTheme` | 游戏内主题层装配 |
| 源码 | `src/ui/selector-theme.ts:projectSelectorTheme` | 外部选择页 Init 投影 |
| 源码 | `src/engine/core/theme-runtime.ts:RuntimeThemeManager.resolve` | 运行时层读取/合并语义 |
| 测试 | `tests/ui/controller-init-select.test.ts` | Init 选择与进入游戏回归 |
| 测试 | `tests/ui/selector-theme.test.ts` | 选择页 Init 主题投影回归 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 1 篇主题机制文档及 UI 路由 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分 Unit 或交回上游调整范围 |

### Optional Read Set

- `src/arona-clicker/content/inits.ts`，仅在检查 Init 默认主题声明时读取

### Do Not Read by Default

- `docs/plan-work/archive/**`
- 与 Init/UI 主题装配无关的 Datapack 实体和编辑器

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 游戏内 Init 主题由 UIController 注入 scene scope | `src/ui/controller-theme.ts:syncRuntimeTheme` | 当前行为 |
| 选择页从聚焦 Init 直接投影主题 | `src/ui/selector-theme.ts:projectSelectorTheme` | 保留行为 |

### Constraints

- 遵守 `AGENTS.md`、UI Read Set 和 Patch Unit 白名单。
- Init 主题只留在选择页；不要删除 Init 的 Datapack 主题内容。
- Preserve player、Area、student、user、preview、ephemeral 主题行为。

### Allowed Files

- `src/ui/controller-theme.ts`
- `tests/ui/controller-init-select.test.ts`
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`
- `docs/plan-work/task-0227-init-theme-selector-only.md`
- `docs/plan-work/00-index.md`

### Explicit Non-goals

- 不修改背景图层排序算法。
- 不改变 Init 选择页的聚焦主题与 backgroundVariants。
- 不更改 Init 的颜色数据或 Area 的运行时主题。

### Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件执行；若源码/测试事实与上方冲突，或实现需要修改白名单外文件，先停止并上报。

### Completion Criteria

- [x] 游戏进行中 runtime theme 不包含 Init scene 层或 Init 背景。
- [x] 外部 Init 选择页仍显示聚焦 Init 主题及背景。
- [x] 定向 UI 回归、类型检查通过；文档检查没有报告本 Task 修改的文档路径。
- [x] GALHCG 直接受影响路径复核完成，Task 归档。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/controller-init-select.test.ts -t 'Init 主题只显示在外部选择页'` | 通过 |
| 选择页测试 | `npx vitest run tests/ui/selector-theme.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 文档检查 | `npm run check:docs` | 无文档错误 |

## 当前核验（2026-10-04）

- `npx vitest run tests/ui/controller-init-select.test.ts -t 'Init 主题只显示在外部选择页' --reporter=dot --silent`：通过，12 项同文件其它测试跳过。
- `npx vitest run tests/ui/selector-theme.test.ts`：5 项通过。
- 同时运行两个测试文件时，controller-init-select 内已有的 Lobby/数据包标题用例失败；用例单独运行仍失败，表现为期望“全部数据包”却显示“经典数据包”，与本次 Init 主题变更无关，未扩展修复。
- `npx tsc --noEmit`：通过。
- `npm run check:docs`：首轮报告 19 条 `task-0215` 源码路径错误；随后最终重跑扫描 608 篇 Markdown、0 错误，检查通过。
- `git diff --check`：通过。

## GALHCG 影响闭环

- 发现路径：按 UI/主题 Read Set 查阅 `syncRuntimeTheme`、`projectSelectorTheme` 与 `RuntimeThemeManager.resolve`。
- 变更审查：`src/ui/controller-theme.ts`、`tests/ui/controller-init-select.test.ts`、`docs/docs-829/06-wiki/50-ui/presentation-theme.md` 均已定向复核。
- 地图维护：更新 `concept:ui-command-to-runtime` 到 Controller 实现与测试文件，以及 ColorSystem、EntityPresentationService、UI Presentation Layer 到机制文档的 Evidence；所有写后审查均完整、stale 0。

## 剩余工作

- 无。

## Receipt 0227-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/ui/controller-theme.ts` 移除游戏内 Init scene 主题推入；`tests/ui/controller-init-select.test.ts` 增加选择页/游戏态对照回归；`docs/docs-829/06-wiki/50-ui/presentation-theme.md` 更新当前机制说明 |
| 未完成内容 | 无；全文件测试中发现的 Lobby 标题失败与本 Unit 无关，见当前核验 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 已更新 `concept:ui-command-to-runtime` 到实现/测试文件及 ColorSystem、EntityPresentationService、UI Presentation Layer 到机制文档的 Evidence；三个路径写后均为 unchanged、stale 0；文档 owner 分页完整 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/controller-init-select.test.ts -t 'Init 主题只显示在外部选择页' --reporter=dot --silent` | 通过 | 12 项其它测试跳过 |
| 选择页测试 | `npx vitest run tests/ui/selector-theme.test.ts` | 通过 | 5 项通过 |
| 类型检查 | `npx tsc --noEmit` | 通过 |  |
| 文档检查 | `npm run check:docs` | 通过 | 最终重跑扫描 608 篇 Markdown，0 错误；首轮失败后检查状态恢复 |
| 差异检查 | `git diff --check` | 通过 |  |
| GALHCG | 定向 `review_changes`、`plan_map_updates`、dry-run、正式提交、写后复核 | 完成 | 实现、测试、机制文档 Evidence 均 fresh；文档 owner 分页完整 |

### 遇到问题

- `tests/ui/controller-init-select.test.ts` 中的 Lobby/数据包标题用例单独运行时失败（实际“经典数据包”，期望“全部数据包”）；不涉及 Init 主题运行时层，本 Unit 未处理。
- 首轮全库 `check:docs` 报告 19 条 `task-0215` 源码路径错误；最终重跑通过，未对这些范围外文档作改动。

### 需上游确认项

- 无。

### 事实更新建议

- 游戏运行时不再应用 Init ThemeDef；外部 Init 选择页仍独立投影 Init 主题和背景变体。

## 相关路由

- `docs/ai/context-packs/ui-presentation.md`
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`
- `docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`
