# Receipt 0320-U06

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `map-run-service.ts` 新增 AG-1 scheduler Receipt 分支：校验必需字段与 start snapshot，复用现有快照解析器构造 detached 历史 MapRun，重跑真实 AG-1 planner，逐字段比较 scheduler、投影、Program/Status 与 terminal；E1 携带 scheduler 字段时拒绝。planner-owned 对象采用键排序的稳定比较，数组顺序保留。活动后继时校验四类资源余额唯一且匹配、Party/Enemy HP roster 顺序、locals/statuses 预期存在性与内容。新增 `tests/engine/gameplay-b-map-ag1-restore.test.ts` 29 条用例，包含真实 CardRef 合法恢复与篡改拒绝、额外 sequence 尾行、Status Trace 篡改拒绝。未改 `map-effect-receipt-validator.ts`：AG-1 Program visits/trace/locals 由真实 planner 按 executionSequence 重生成并完整比较；旧 E1 source-walk 保持原样。 |
| 未完成内容 | 无。曾由并行 U07 UI 草稿导致的类型问题已由 U07 修复；随后联合类型检查通过。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 尚未施工；直接影响范围在 Task 0320 工作节点收尾时统一复核；未修改图、未刷新或写 freshness |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| AG-1 Restore / 篡改拒绝 | `npx vitest run tests/engine/gameplay-b-map-ag1-restore.test.ts` | 通过，29/29 | 覆盖有/无 Program、closed Encounter、跳过 Ability/Item、合法CardRef与CardRef篡改、JSON字段重排、scheduler/start/terminal/sequence（含多余尾行）/source/target/敏捷/排序键/projection/cost/Program/Status Trace篡改、活动后继HP/locals差异及拒绝原子性 |
| MapRun / Effect / ReadModel / UI 联合定向测试 | 六文件联合 `npx vitest run --silent ...` | 通过，100/100 | U06 Restore29、MapRun Save/Resume7、Effect Save/Resume7、Runtime ReadModel7、Workspace31、Flow19；E1 与 AG-1 路径均覆盖 |
| 架构检查 | `npm run check:architecture` | 通过 | Architecture boundary check passed |
| 文档链接与结构 | `npm run check:docs` | 通过 | errors: 0；scanned markdown: 1206 |
| TypeScript | `npx tsc --noEmit` | 通过，退出码 0 | U07 修复后联合复核 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 仅显示现有文件换行符提示，无 whitespace error |

## 遇到问题

- U05 原回执不足以回放关闭 Encounter；U05b 已补齐开始快照、完整 U02 排序键与 terminal checkpoint。U06 以真实 planner 对完整 Receipt 投影重算，并在活动后继时核对可用状态。终局 skip 的上游行为证据：`tests/engine/gameplay-b-map-ag1-commit.test.ts` 的 `keeps an Item selected after terminal victory in the sequence without consuming inventory` 与 `records later Enemy sources as roundEnded after a faster Party source ends the Battle`；U06 自身另有 selected-but-skipped Ability/Item Restore 往返测试。

## 需上游确认项

- 无。若 U05 最终 Receipt 缺少支持 skip／terminal／余额重算的必要证据，再按停止条件提交明确的合同调整问题。

## 事实更新建议

- 无。本次只建立后续施工入口；没有把预期合同写成已实现事实。
