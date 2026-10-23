# Receipt 0320-U14

| 项 | 内容 |
| --- | --- |
| 状态 | completed（自动化、类型、架构和文档检查通过；宽屏实屏验收未通过/未能验证，需求单已交付） |
| 实际修改 | 完成 additionalTarget Draft/API、`additionalActor` / `loopTargetActor` resourceChange 作者账户与 Schema、Planner/AG-1 Receipt/Restore，以及 Party/Ability Workspace secondary target picker。AG-1 scheduler 升至 v4，受影响测试 Map `resumeVersion` 升至5。 |
| 未完成内容 | 无施工项。宽屏实屏结果见 [[../U14-screen-acceptance-report]]；当前可进入内容没有声明 additionalTarget 的 Action，因此新按钮组未能在正式关卡中呈现。 |
| 范围外变更 | Map relation 拖放、独立 E1 Receipt Validator、U07 屏幕验收与 E1 U18。 |
| GALHCG 影响闭环 | 只读核对；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Author syntax/context/Registry/Schema | `npx vitest run --silent tests/data/gameplay-b-effect-syntax.test.ts tests/data/gameplay-b-effect-normalization.test.ts tests/data/gameplay-b-effect-registry.test.ts tests/data/gameplay-b-map-registry.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts` | 232/232 passed | Task Owner 复核；含 additionalTarget、自/敌方来源边界与资源账户限制；Schema 由生成器同步 |
| Draft/API / MapRun | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts` | 59/59 passed | Party/Ability/Item 主次目标字段合并、Preview 与 Save/Restore |
| Planner / Projection / AG-1 Commit / Restore | `npx vitest run --silent tests/engine/gameplay-b-effect-planner.test.ts tests/engine/gameplay-b-effect-projection.test.ts tests/engine/gameplay-b-map-ag1-commit.test.ts tests/engine/gameplay-b-map-ag1-restore.test.ts` | 110/110 passed | 覆盖交叉阵营身份、同 ID 不同领域身份、账户账本及 Restore 重放 |
| Workspace DOM click chain | `npx vitest run --silent tests/ui/gameplay-b-map-workspace.test.ts` | 32/32 passed | Party 与 Ability 的 primary/secondary 选择、提交状态与刷新连续性；不代表屏幕验收 |
| 类型检查 | `npx tsc --noEmit --pretty false` | 通过 | 全工作树当前状态 |
| 架构检查 | `npm run check:architecture` | 通过 | 全工作树当前状态 |
| 文档检查 | `npm run check:docs` | 通过（1251 篇，0 errors） | 全工作树当前状态 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 仅有共享工作树 CRLF/LF 行尾提示 |
| 宽屏浏览器屏幕验收 | in-app browser 实际进入 Schale Office 并打开 Map 入口列表 | 未通过/未能验证 | 当前已注册可进入 Map 没有声明 `additionalTarget` 的 Action，无法呈现新按钮；详细需求单见 [[../U14-screen-acceptance-report]] |

## 遇到问题

- 无。

## 需上游确认项

- 无；secondary identity、AG-1 准入、来源可见余额、倒地不 fallback 与 MapRun 边界见 U08；UI 沿用既有 Workspace target picker 风格。

## 事实更新建议

- 完成后回写 Draft 0312 §3 示例与 §6–8 E2 条目，更新 Task 0320 与 `docs/plan-work/00-index.md`；不修改旧 E1 U18 状态。
