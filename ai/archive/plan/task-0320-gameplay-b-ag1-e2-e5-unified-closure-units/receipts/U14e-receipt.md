# Receipt 0320-U14e

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | 本地试玩台新增严格 `startMap modid:map:itemid` 命令；只允许当前已加载 Map，在夏莱办公室且无进行中 MapRun 时执行。成功后复用 `GameCommands.startMap` 并切换至 Map Workspace。原资源、角色、Spot 命令不变。 |
| 修改文件 | `src/ui/development/gameplay-b-quick-test-console.ts`、`src/ui/main.ts`、`tests/ui/gameplay-b-quick-test-console.test.ts` |
| 限制 | 仅在开发构建显式启用试玩台；未改正常 Spot 准入；不动态加载/构造 Map，不覆盖进行中的关卡，不持久化。该命令本身不提供声明 `additionalTarget` 的内容。 |
| GALHCG 影响闭环 | 只读核对项目 `acprogram`；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Parser/UI command | `npx vitest run --silent tests/ui/gameplay-b-quick-test-console.test.ts` | 10/10 passed | 覆盖合法/非法 Map ID、成功启动与路由、未知 Map、活动 Run 拒绝、Init 门控和原命令回归 |
| 类型检查 | `npx tsc --noEmit --pretty false` | 通过 | 含本 Unit 三个代码文件 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 共享工作树只报告 CRLF/LF 行尾提示 |

## 未完成内容

- 无 U14e 施工项。
- U14 additionalTarget 的实屏验收仍缺正式内容样例；详见 [[../U14-screen-acceptance-report]]。
