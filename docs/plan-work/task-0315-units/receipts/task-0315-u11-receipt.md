# Task 0315 U11 Receipt：机制文档与统一收尾

状态：completed。

## 文档修改

- `docs/docs-829/03-data-structures/datapack-contracts.md`：明确 Map Action 仅以 `effectProgram` 声明效果，记录 `damage` / `heal` 的 primary 与正安全整数边界、旧字段 Registry 拒绝规则，并将 Shop Offer `effects` 区分为独立合同。
- `docs/docs-829/06-wiki/50-ui/refresh-update.md`：更新声明摘要、Preview / Receipt 与 `prepare` 的说明；界面展示 damage / heal 请求量及 HP 实际变化，不运行效果程序。
- `docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal.md`：记录逐 Action 迁移矩阵所在 Receipt、各 Unit 的真实验证结果、完成标准与剩余后续范围；将开工事实改标为准入基线。
- `docs/plan-work/00-index.md`：将 Task 0315 从当前推进项移入 2026-10-22 本轮完成项。

## 验证

- `npm run check:docs`：通过，扫描 1169 个 Markdown 文件，0 errors。
- `git --no-pager diff --check`：通过；输出只有既存文件 CRLF 转 LF 提示。
- `npm run check:architecture`：通过，`src/engine` 与 `src/data-services` 无越界向外导入。
- U01–U10 产品回归与 Schema 验证以各自 Receipt 为准；其中 U09 的 `npx tsc --noEmit` 通过，U10 的 Schema / Registry 定向回归为 3 个文件、164 项通过。本 Unit 未重复产品全量测试。

## GALHCG 只读影响检查

- `graph_project` 确认项目身份 `acprogram`。
- 对本 Task 直接影响的 40 个实现、文档、测试与生成 Schema 路径执行 `graph_health(check: "changed", options: { path })`；读取未写入 freshness。
- 9 个已有直接映射的文件返回 `content_changed`，关联 Evidence 当前均显示 stale：`src/arona-clicker/contracts/runtime/runtime.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/data-services/index.ts`、`src/data-services/registry/registry-validate.ts`、`src/ui/components/tooltip/tooltip.ts`、两份机制文档、`docs/plan-work/00-index.md` 与生成 Schema。其余 31 个路径返回 `unreferenced_path`，表示图中没有直接 Evidence / `maps_to` 关联。
- 该健康结果读取的是当前共享工作树，里面还含先前 E1 未提交改动；不能把所有旧 Evidence 的内容变化都单独归因到 Task 0315。
- Task 0315 只要求并授权此处的只读检查；没有执行 graph edit、refresh 或 freshness 写入。后续若需更新这些映射，应另按项目维护流程处理。

## 未执行项

- 未做真实浏览器验收；本 Task 的完成标准由 U08 DOM / UI 自动化证据及上述检查构成，浏览器视觉验收不是该标准的一部分。
- 未运行 `npm test` 全量测试；本 Task 使用 U01–U10 的定向回归与 Receipt 证据。
