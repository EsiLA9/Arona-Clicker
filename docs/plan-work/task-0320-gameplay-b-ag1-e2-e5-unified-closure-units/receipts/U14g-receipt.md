# Receipt 0320-U14g

| 项 | 内容 |
| --- | --- |
| 状态 | implementation-complete; screen acceptance requested |
| 实际修改 | `startMap` 新增 `--move-to`、`--ability`、`--target-party` / `--target-enemy` 与 `--commit-rounds 1–20`。命令统一按移动、选择能力/目标、逐轮 Commit 执行。Commit 每次读取最新 Run 版本与 Owner ReadModel 预览。 |
| 修改文件 | `src/ui/development/gameplay-b-quick-test-console.ts`、`src/ui/main.ts`、`tests/ui/gameplay-b-quick-test-console.test.ts`；U14g 合同、U22 屏幕验收需求单、Task 0320 与 `docs/plan-work/00-index.md` |
| 限制 | 仍为开发模式本地内存工具；不执行脚本，不替代内容/目标/费用/Commit 校验。操作失败时保留已启动 Run 与已成功步骤。浏览器人工验收未执行。 |
| GALHCG 影响闭环 | 只读核对项目 `acprogram`；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Parser + 操作集成 | `npx vitest run --silent tests/ui/gameplay-b-quick-test-console.test.ts` | 16/16 passed | 包含白名单/边界解析，以及 U22 正式样例图的移动、能力目标选择、四轮 Commit |
| 类型检查 | `npx tsc --noEmit --pretty false` | 通过 | 变更后复核 |
| 架构边界 | `npm run check:architecture` | 通过 | Engine / Data Services 无违规外向依赖 |
| 文档检查 | `npm run check:docs` | 通过 | 扫描 1280 篇 Markdown，0 errors |
| 差异检查 | `git --no-pager diff --check` | 通过 | 仅有共享工作树的 CRLF/LF 行尾提示 |
| 浏览器验收 | [[../U22-screen-acceptance-report]] | 待人工执行 | 已给出一条命令完成 Map 进入和演练操作 |
