# Receipt 0301-U1a

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/data-services/contracts/gameplay-map.ts`；由生成器更新 `tools/datapack-editor/schema/engine-defs.gen.json`；新增 U1a Receipt。 |
| 未完成内容 | Registry 引用、用途、资源校验及其行为用例由 U1b 完成。 |
| 范围外变更 | 无；生成 Schema 未手动编辑。 |
| GALHCG 影响闭环 | `graph_project(acprogram)` 已核对；直接路径复核后仅修改数据合同与生成 Schema，不需要写语义图。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Schema 生成 | `npm run gen:schema` | 通过 | 正式生成器更新了新资源合同类型索引。 |
| Schema 同步 | `npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过 | 1 文件、10 项通过。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无类型错误。 |
| 差异 | `git diff --check -- src/data-services/contracts/gameplay-map.ts tools/datapack-editor/schema/engine-defs.gen.json` | 通过 | 无空白错误。 |

## 遇到问题

- 无。本 Unit 保留 `damage` 过渡字段，等 Runtime 与正式内容迁移完成后再统一移除。

## 需上游确认项

- 无。

## 事实更新建议

- 无；合同类型已进入 `GameplayMapDef` 生成索引，行为校验由 U1b 验收。
