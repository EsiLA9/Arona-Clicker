# Receipt 0320-U09b

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `src/arona-clicker/contracts/map/map-run.ts` 增加可选 MapRun 根 `mapRunFacts` Counter/Flag 当前值状态；`src/arona-clicker/services/map/map-run-service.ts` 按 Map 声明初始化、深复制/冻结、跨现有 Run 转换保留，并在 `restoreRunState` 中逐字段核对声明顺序、ID、类型、边界和额外状态。`tests/engine/gameplay-b-map-run.test.ts` 覆盖初始化、跨 Encounter/Node、Restart/Abandon 和未声明 Map；`tests/engine/gameplay-b-map-save-resume.test.ts` 覆盖往返与篡改拒绝。 |
| 未完成内容 | 无。本 Unit 不接 Effect AST 或 AG-1 scheduler snapshot/Receipt。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 未改图、未刷新或写 freshness；Task 0320 收尾统一核对 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| MapRun 生命周期 | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts` | 通过，51/51 | Facts 按声明初始化、跨 Encounter/Node 保持，Restart 重置、Abandon 清除；未声明 Map 不物化字段 |
| Save/Resume | `npx vitest run --silent tests/engine/gameplay-b-map-save-resume.test.ts` | 通过，8/8 | 保留有效事实值；拒绝缺失、额外、越界、重复与未知 ID，且拒绝时不安装 Run |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | 面向共享工作树当前源码 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码0 | 仅有其他已修改文件的 CRLF→LF 提示 |

## 遇到问题

- 无。

## 需上游确认项

- 无；AG-1 scheduler snapshot/Receipt/replay 留给后续 U09c。

## 事实更新建议

- MapRun 根 `mapRunFacts` 只存 Counter/Flag 当前值，顺序和边界由当前 Map 声明校验；无作者声明时不生成运行态属性。AG-1 历史回执尚未纳入 Facts。
