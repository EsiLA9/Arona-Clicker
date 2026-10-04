# Execution Receipt：Task 0161 U05

状态：完成

## 实际修改

- `src/ui/components/selector-page.ts`：初始 shell 使用当前焦点 ThemeTree。
- `src/ui/selector-page.ts`：焦点切换时将同一 ThemeTree 更新到 selector shell 与各局部表面。
- `src/ui/outer-background.ts`：body 直系背景使用所属 BackgroundView 的 CSS 变量。
- `tests/ui/controller-init-select.test.ts`：覆盖焦点颜色与全局外背景变量来源。

## 验证

- `npx vitest run tests/engine/theme-runtime.test.ts tests/ui/controller-init-select.test.ts tests/ui/selector-theme.test.ts tests/ui/controller-global-enhancement.test.ts --silent`：包含 U05 控制器断言，4 个文件、61 项通过。
- `npx tsc --noEmit`：通过。
- `npm test -- --silent`：201 个文件、1847 项通过。
- 浏览器视觉检查：未执行；当前 CUA 浏览器状态接口返回连接错误，根 Task 保留该验收项。
