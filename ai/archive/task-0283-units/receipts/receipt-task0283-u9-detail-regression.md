# Receipt task0283-U9

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（U9详情回归范围） |
| 实际修改 | `tests/ui/runtime-editor-codex-details.test.ts`：把出向诊断断言移到技术详情；将资料引用字段、按引用者和source/path计数、部分覆盖候选空态、技术出向分开验证；增加resolved引用携带candidates时不重复显示候选的回归；按实际profile术语修正断言；将Profile测试fixture收窄为 `RuntimeContentRawValue`。 |
| 未完成内容 | 本Unit内无未完成项。shell身份标题转义已由主线程集成回归验证。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | `graph_project` 核对 `project_id=acprogram`；修改后对测试与本Receipt执行直接路径只读复核。未改图、刷新或写入freshness；本Unit无图谱维护授权。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run --silent tests/ui/runtime-editor-codex-details.test.ts` | 通过 | 13/13 tests。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | exit code 0，无诊断；修正了Profile fixture的 `unknown` 类型。 |
| 人工验收 | 对照当前 `codex-details/render.ts`、`profiles.ts`、`types.ts` 与Runtime内容合同核实断言 | 通过 | 资料引用只在资料字段出现；incoming source/path、技术出向及覆盖提示分区验证。 |
| GALHCG | `project_id=acprogram`；修改后对两个允许路径做只读路径查询 | 通过 | 两个路径均匹配；只读，不做图谱维护。 |

## 遇到问题

- 旧断言要求资料页展示身份标题、聚合关系和出向诊断；这些内容当前分别归shell身份区、资料字段、被引用页和技术详情。测试现已按当前实现责任区改写，没有调整生产实现来迎合旧预期。

## 需上游确认项

- 无。shell标题转义覆盖由主线程在U6中补充。

## 事实更新建议

- 无；本Unit更新测试与Receipt，不改变项目机制或接口事实。
