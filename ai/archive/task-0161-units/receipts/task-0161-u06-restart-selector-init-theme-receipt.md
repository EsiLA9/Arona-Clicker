# Execution Receipt：Task 0161 U06

状态：完成

## 实际修改

- `src/ui/context.ts`：为选择页上下文加入 `includeResumedArea` 策略。
- `src/ui/controller-panels.ts`、`src/ui/controller.ts`：初次渲染与后续焦点上下文依据 `pendingRestart` 传递策略。
- `src/ui/selector-theme.ts`：Restart 模式不合并当前 Area 的主题 token、节点覆写或 Area 身份到 transition key。
- `tests/ui/controller-init-select.test.ts`：通过活动千禧年 Init 的“结束游戏”按钮验证撤离后的 Init 主色 `#4f46e5` 胜过活动 Area 主色 `#6366f1`。

## 验证

- `npx vitest run tests/engine/theme-runtime.test.ts tests/ui/controller-init-select.test.ts tests/ui/selector-theme.test.ts tests/ui/controller-global-enhancement.test.ts --silent`：4 个文件、61 项通过，其中控制器选择页 12 项通过。
- `npx tsc --noEmit`：通过。
- `npm test -- --silent`：201 个文件、1847 项通过。

## 限制

- 浏览器视觉验收未在此 Unit 执行；DOM 与投影身份由控制器回归覆盖，整体 Task 仍需完成其余往返矩阵与最终检查。
