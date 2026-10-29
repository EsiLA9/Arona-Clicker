# Receipt 0320-U09a

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `src/data-services/contracts/gameplay-map.ts` 增加闭合 `mapRunFacts` Counter/Flag 声明类型与生命周期 TSDoc；`src/data-services/registry/registry-validate.ts` 拒绝未知字段、无效数组/条目、空 ID、Counter/Flag 重名、非法安全整数/范围和总数超过64；同一 ID 可用于 Encounter locals，因为生命周期命名域不同。`tests/data/gameplay-b-map-registry.test.ts` 覆盖上述边界；`tools/datapack-editor/schema/engine-defs.gen.json` 仅由 `npm run gen:schema` 生成并同步。 |
| 未完成内容 | 无。本 Unit 不创建运行时状态或 Effect Program 读写。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 未改图、未刷新或写 freshness；Task 0320 收尾统一核对 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Map Registry | `npx vitest run --silent tests/data/gameplay-b-map-registry.test.ts` | 通过，175/175 | 覆盖新 MapRun Facts 声明、闭合字段、重名、初值/范围和64条上限，并保留旧 Map 与 Encounter locals 命名域兼容 |
| 生成 Schema 同步 | `npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过，15/15 | `mapRunFacts` 与 Counter/Flag 类型由生成器输出 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | 面向共享工作树当前源码 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码0 | 仅有既存 CRLF→LF 提示 |

## 遇到问题

- 无。

## 需上游确认项

- 无；范围依据 U08 已冻结。

## 事实更新建议

- MapRun Facts 现由 Map 定义初始化声明；Counter/Flag 共用 MapRun Fact 命名域，Encounter locals 保持独立命名域；本 Unit 尚无运行时 Owner 状态。
