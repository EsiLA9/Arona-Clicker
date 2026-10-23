# Receipt 0320-U14f

| 项目 | 记录 |
| --- | --- |
| 状态 | 实现与自动化验证完成；人工屏幕验收尚未执行。 |
| 实际修改 | `startMap <mapId>` 增加显式 `--enter-office` 参数。Map/进行中 Run/启动回调先校验；仅成功校验后通过 Controller 既有 Init 恢复流程进入夏莱办公室，再使用原 `GameCommands.startMap` 与 Workspace 路由。缺省参数仍要求已进入办公室。 |
| 保持的约束 | 仍只允许当前 Registry 已加载的 Map；不覆盖进行中的 MapRun；固定队伍由 Runtime 正常准入；不自动发放角色；`getValue` 与角色命令仍要求夏莱办公室；只在开发模式显式挂载。 |
| 修改文件 | `src/ui/development/gameplay-b-quick-test-console.ts`、`src/ui/main.ts`、`tests/ui/gameplay-b-quick-test-console.test.ts`、`docs/docs-829/02-modules/ui.md`、本 U14f Unit 与验收需求单。 |
| 屏幕验收 | 尚未观察实际浏览器。验收步骤与失败/队伍准入预期见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14f-screen-acceptance-report]]。 |

## 验证

| 验证项 | 结果 |
| --- | --- |
| `npx vitest run --silent tests/ui/gameplay-b-quick-test-console.test.ts` | 14/14 通过；覆盖精确参数语法、缺省门槛、从 Init 经 Controller 流程进入 Office 并启动 Map、未知 Map 不发生 Init 切换、固定队伍准入和活动 Run 防护。 |
| `npx tsc --noEmit --pretty false` | 通过。 |
| `npm run check:architecture` | 通过。 |
| `npm run check:docs` | 通过；最终扫描 1262 篇 Markdown，0 errors。 |
| `git --no-pager diff --check` | 通过；仅提示共享工作树中既有 CRLF→LF 行尾转换。 |

## Non-goals

- 不改变正式世界线、Map、角色解锁或存档规则。
- 不以浏览器手动走查状态替代自动化测试；U17 CardRef Modifier 人工验收仍未完成。
