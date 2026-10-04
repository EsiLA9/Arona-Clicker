# Execution Receipt：Task 0161 U02

状态：完成

## 实际修改

- `src/ui/controller-panels.ts` 与 `src/ui/controller.ts`：初始选择页与后续焦点刷新使用 selector 全局基底。
- `src/ui/selector-theme.ts`：焦点主题从排除活动场景的全局快照解析；当前 Area 仅按选择页策略合并。
- `tests/ui/controller-init-select.test.ts`、`tests/ui/selector-theme.test.ts`：覆盖全局用户层保留、旧 Area/Story 排除、焦点轮换与当前 Area 策略。

## 验证

- 组合定向命令：`npx vitest run tests/engine/theme-runtime.test.ts tests/ui/controller-init-select.test.ts tests/ui/selector-theme.test.ts tests/ui/controller-global-enhancement.test.ts --silent`，4 个文件、61 项通过。
- `npx tsc --noEmit`：通过。
- `npm test -- --silent`：201 个文件、1847 项通过。
- 浏览器视觉检查：未执行；当前 CUA 浏览器状态接口返回连接错误，根 Task 保留该验收项。
