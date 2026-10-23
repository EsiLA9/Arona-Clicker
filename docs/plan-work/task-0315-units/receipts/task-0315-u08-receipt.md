# Task 0315 U08 Receipt：Workspace 旧卡牌字段移除

状态：completed。

## 修改

- `src/arona-clicker/contracts/runtime/runtime.ts`：Workspace Action view 不再声明旧 `hpEffects` / `cardEffects` 字段；准备期折扣、资源、HP 与条件统一从 `declaredEffects` 读取。
- `src/arona-clicker/services/map/map-effect-summary.ts` 与 `contracts/map-relations.ts`：为 Program `damage` / `heal` 生成保留操作语义、目标、数量、路径和分支的声明摘要。其他资源、Counter、Flag、CardRef prepare 摘要沿用现有表示。
- `src/ui/components/map/map-workspace.ts`：移除旧 HP / 卡牌字段渲染，使用声明摘要呈现伤害、治疗、资源、条件状态和准备期折扣；Commit 预览 Trace 展示 damage/heal 请求量及 HP 实际变化，Clamp 后的零变化也保留。
- 两份 UI 测试的旧 Action 夹具改为 effectProgram；E1 Workspace 测试覆盖 damage/heal 声明显示和 0 / +2 实际 HP 变化。
- Shop Offer `effects` 与费用、CardRef 准备目标和现有交互生命周期未改。

## 验证

- 实际运行：`npx vitest run tests/ui/gameplay-b-effect-workspace.test.ts tests/ui/gameplay-b-map-workspace.test.ts --silent`，**2 files / 29 tests passed**。
- `git --no-pager diff --check` 对 U08 变更通过；新建 UI Receipt 与测试文件无尾随空白。
