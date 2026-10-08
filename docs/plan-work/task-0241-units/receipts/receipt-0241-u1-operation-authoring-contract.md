# Receipt 0241-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/data-services/contracts/operation.ts`、`src/data-services/contracts/datapack.ts`、生成的 `tools/datapack-editor/schema/engine-defs.gen.json` |
| 未完成内容 | `actorPosition` effect 仍由 U6 增加，因该 union 对 Runtime switch 有可见影响，分配到纯结算 Unit 同步完成；schema 其余 E0 字段已声明 |
| 范围外变更 | 无；Schema 文件由 `npm run gen:schema` 自动生成 |
| GALHCG 影响闭环 | E1 收尾时按变更路径统一 review/update Evidence；本 Receipt 先记录实际待办，不将地图维护误报为已完成 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Schema 生成 | `npm run gen:schema` | 通过 | operationStrategyProfiles 与 operationCardPools 登记于生成 Table 清单 |
| Schema 同步测试 | `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过 | 8 tests |
| 类型检查 | `npx tsc --noEmit` | 通过 | 移除延后至 U6 的 effect union 后无错误 |
| 空白检查 | `git diff --check` | 通过 | 有工作树 CRLF 提示，无 diff whitespace 错误 |
| GALHCG | 延后 E1 收尾 | 未执行 | 最终源码范围一并 review，避免临时/反复 Evidence token |

## 遇到问题

- 新增 `actorPosition` effect union 会令 `operation-resolution-planner.ts` 当前穷尽分支编译失败，因此其类型变更与消费者实现都放在 U6 一起提交；U1 范围只先声明位置/武器事实与池/策略类型。

## 需上游确认项

- 无。E0 已裁定该 effect 的语义与接线阶段。

## 事实更新建议

- 无；Task 0241 保持 proposed 机制，不提前改现行 Runtime 文档。
