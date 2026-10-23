# Receipt 0320-U01

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `gameplay-map.ts` 增加闭合执行合同及 AG-1 Action / Party / Enemy 敏捷字段；`registry-validate.ts` 实施合同枚举、敏捷数值、对象闭合、固定 Party ID 与 E1 禁用边界；`gameplay-b-map-registry.test.ts` 增加 17 项 AG-1/E1 边界覆盖，并修正当前 Map 样例版本基线断言；生成器更新 `engine-defs.gen.json`；本 Unit 与 Receipt 更新实际字段与验证记录。 |
| 不变边界 | 未改 MapRun Runtime、Receipt / Save、UI、外部成长读取或旧 E1 执行语义。未改白名单外文件；未操作 GALHCG 图。 |
| 尚未完成内容 | 本 Unit 范围内无。AG-1 Runtime 接线留给后续 Unit。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Schema 生成 | `npm run gen:schema` | 通过 | 首次生成作者字段；最终复跑显示生成文件 unchanged。 |
| Registry 行为 | `npx vitest run tests/data/gameplay-b-map-registry.test.ts --pool=threads --maxWorkers=1 --minWorkers=1` | 通过，162/162 | 包含 17 项新增 AG-1/E1 合同与 Registry 边界测试。 |
| Schema 同步 | `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts --pool=threads --maxWorkers=1 --minWorkers=1` | 通过，15/15 | Schema 字段由生成器产生。 |
| TypeScript | `npx tsc --noEmit` | 通过 | 退出码 0。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 退出码 0；Git 仅提示共享工作区中若干既有 CRLF/LF 转换告警。 |

## 结果说明

- Registry 全套首次运行暴露一项此前已有的样例版本断言陈旧：样例集合已加入 `effect-program-example`、`status-example` 与 `prepared-tag-combo`，断言却要求所有非 `minimal-battle` Map 都是版本 4。测试现已按 11 张正式 Map 的具体 ID 列明预期版本，保持对每张 Map 的版本检查强度；该修正是现有样例集的测试基线同步，不是 AG-1 行为变化。
- Action 敏捷输入仅在显式 `executionContractId: 'AG-1'` 时允许；Party/Enemy supplement 缺省按合同解释为 0。作者合同只定义冻结输入，本 Unit 不计算或安装运行时排序结果。

## 遇到问题与需上游确认

- 无阻塞项，无需上游裁定。
