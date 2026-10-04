# Execution Receipt：Task 0161 U01

状态：完成

## 实际修改

- `src/engine/core/theme-runtime.ts`：解析时保留背景来源贡献；selector 快照可排除场景和演出层；Preview 可替换指定来源，并在移除同 ID 覆盖后恢复被遮蔽的低层贡献。
- `src/arona-clicker/contracts/color-query.ts`、`src/arona-clicker/services/color-system.ts`：提供选择页全局基底并将用户 Preview 绑定到 user 来源替换。
- `tests/engine/theme-runtime.test.ts`：验证旧场景隔离、user Preview 保留 scene 来源，以及同 ID 用户覆盖撤下后恢复下层。

## 验证

- `npx vitest run tests/engine/theme-runtime.test.ts tests/ui/controller-init-select.test.ts tests/ui/selector-theme.test.ts tests/ui/controller-global-enhancement.test.ts --silent`：4 个文件、61 项通过。
- `npx tsc --noEmit`：通过。
- `npm test -- --silent`：201 个文件、1847 项通过。
