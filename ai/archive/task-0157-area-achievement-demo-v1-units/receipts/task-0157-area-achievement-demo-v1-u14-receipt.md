# Execution Receipt：Task 0157 U14

日期：2026-09-26

## 结果

- 新增真实联动测试：读取演示包 manifest 与 JSON 分片，合并后连同基础包加载到 `GameInstance`，通过正式 `startNewGame`、Tick、Area 旅行和 `UIController` Records 渲染驱动断言；没有 mock Achievement 投影，也没有直接写游戏状态。
- 初始 Records 显示补给成就 0/6、未完成，档案成就尚未出现。首次旅行到档案间后，运行时投影已发现目标；页面重新打开 Records 后显示 1/3、未完成。
- 在 Records 保持打开时往返旅行，档案进度依次更新为 2/3 和 3/3，完成状态同步为“已完成”；同一成就行和 Records 根节点在定点刷新中保持身份不变。
- 真实生产路径将补给成就更新为 8/6 并显示完成：目标达标后自动发放的 2 点奖励也计入累计产出。测试清理 Controller 与 Runtime。
- 更新 UI 模块卡片，记录 Records 成就只读投影、Init／Area 分组、新发现呈现时机和定点刷新契约。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/ui/area-achievement-demo.test.ts` | 通过；1 个文件、1 项真实运行时 UI 集成测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 334 |

## 范围

- 仅新增定向测试和本 Receipt，并更新 UI 模块卡片；未修改 UI 实现、Runtime、数据包或现有测试。
