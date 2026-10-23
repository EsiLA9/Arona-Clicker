# Receipt 0320-U12b

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `map-effects.ts` 增加 detached MapRun Facts 声明/状态与来源开始资源余额输入、MapRun Facts 计划结果及 guard/write Trace 类型。`map-effect-planner.ts` 支持来源/主目标/来源 Team/循环目标 Actor 的余额读取，拒绝未绑定 `additionalActor`、缺少账户/资源与非法余额；按有序状态读写 MapRun Counter/Flag、对 Counter 安全整数检查后饱和，并保留回放 Trace。Planner 测试新增余额快照、循环身份、Fact 顺序/饱和、拒绝边界和输入不变性覆盖。 |
| 未完成内容 | Owner 来源时点快照构造、MapRun 根 Facts 安装及 AG-1 Receipt/Restore 重放由 U12c 接线；Effect RNG 与 additionalTarget Runtime 仍未完成。 |
| 修改文件 | `src/arona-clicker/contracts/map/map-effects.ts`；`src/arona-clicker/services/map/map-effect-planner.ts`；`tests/engine/gameplay-b-effect-planner.test.ts`。 |
| 范围外变更 | 无；只修改三条实现白名单路径。 |
| GALHCG 影响闭环 | 只读核对；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Pure Planner | `npx vitest run --silent tests/engine/gameplay-b-effect-planner.test.ts` | 通过，25/25 | 包含既有单语句、U12a 循环及本 Unit 新增边界 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码 0 | 全工作树 |
| 文档链接/结构 | `npm run check:docs` | 通过，扫描1239篇、errors: 0 | U12b Unit/Receipt 已登记 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码 0 | 仅共享工作树 CRLF 提示 |

## 遇到问题

- 无。

## 需上游确认项

- 无；本 Unit 消费 U08 已冻结的账户、Fact、饱和与来源状态语义。

## 事实更新建议

- 此 Unit 仅使纯 Planner 产生余额/Fact 计划；U12c 将接入 AG-1 来源起点快照、根 Facts 安装和 Receipt/Restore 重放。
