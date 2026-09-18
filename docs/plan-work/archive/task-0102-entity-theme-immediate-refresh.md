# Task：实体主题变更即时刷新

状态：done — 2026-09-18 已完成

## 目标

修复实体主题槽在运行时发生变化后，当前 UI 必须离开并重新进入 Area 才显示新主题的问题。尤其覆盖 Enhancement 获得后通过 `setTheme(scope: 'area')` 改变当前 Area 主题的路径。

## 已确认根因

`StateMutationService.setEntityThemeSlot()` 已经同步写入 `PlayerState.entityThemeSlots`，并发出 `entityThemeChanged`。但 `src/ui/controller-events.ts` 没有订阅该事件；UI 只在 Area 切换时再次执行 `syncRuntimeTheme()`，因此当前页面的运行时主题层和 CSS 变量不会立即重算。

现有 `themeChanged` 已通过 `scheduleRender()` 触发 UI 重建，本 Task 复用同一条刷新入口，不新增第二套主题注入路径。

## 范围

### 包含

- 将 `entityThemeChanged` 接入 UI Controller 的事件订阅。
- 变更发生后触发一次受调度的 UI 刷新，使运行时主题层、CSS 变量、Area 主题名称/选项和相关表现同步更新。
- 为当前 Area 的主题槽变化补充 UI 回归测试。
- 核验 Enhancement 获得后的即时主题切换，以及玩家切回声明默认主题的路径没有回归。

### 不包含

- 不改 `ColorSystem` 的主题解析优先级。
- 不改 `StateMutationService` 的状态归属、事件契约或存档结构。
- 不新增主题事件；不改变 Area 切换、剧情临时主题和玩家自定义主题的生命周期。
- 不把所有实体表现变化改造成全量刷新；本 Task 只补齐实体主题槽变化的现有事件消费。

## 施工切片

### P0：基线确认

- [x] 确认 `entityThemeChanged` 的发射位置和主题解析入口。
- [x] 确认缺口位于 `controller-events.ts` 的 UI 事件订阅。

### P1：事件接线

- [x] 在 UI Controller 订阅 `entityThemeChanged`。
- [x] 复用 `scheduleRender()`，由正常渲染流程重新执行 `syncRuntimeTheme()` 与 CSS 注入。

### P2：回归测试

- [x] 当前 Area 的主题槽变化会触发 UI 刷新。
- [x] 不离开 Area 时，当前主题解析和渲染状态即可更新。
- [x] 默认主题选项仍然可用，且不会被主题覆盖写坏。

### P3：验证与收束

- [x] 运行定向 Vitest。
- [x] 运行 `npm test`、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`。
- [x] 记录最终核验结果；完成后将本 Task 归档并从 `docs/plan-work/00-index.md` 的活跃任务中移除。

## 最终核验

- 定向 Vitest：2 个测试文件、7 个测试通过。
- 全量 Vitest：173 个测试文件、1607 个测试通过。
- TypeScript 类型检查通过。
- 架构边界检查通过。
- 文档链接与结构检查通过。
- 未修改引擎 Schema，因此不需要运行 `npm run gen:schema`。

## 验收标准

1. 在夏莱主厅直接购买 `base:enhancement:schale_night_mode` 后，当前页面无需移动即可显示墨蓝主题。
2. `entityThemeChanged` 到达 UI 后只触发必要的 UI 调度，不引入重复订阅或循环刷新。
3. Area 主题槽清除后，当前页面立即恢复声明默认主题。
4. 现有主题运行时、实体表现选择、剧情临时主题与全部既有测试保持通过。

## 相关事实入口

- `src/arona-clicker/state/state-mutation-service.ts`
- `src/arona-clicker/services/color-system.ts`
- `src/ui/controller-events.ts`
- `src/ui/controller-theme.ts`
- `docs/docs-828/04-mechanisms/color-derivation.md`
