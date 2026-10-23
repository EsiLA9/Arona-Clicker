# Receipt Task 0322-U37

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `runtime-content-reference-rules.ts`切到新Story字段/Action discriminant；`editor-extras.ts`将Stories表改为nodes JSON与stages record；`src/data/test-datapack.ts`说明更新；`gen-engine-schema.mjs`生成继承interface字段；更新引用扫描测试至新路径；新增U37 Unit说明。 |
| 未完成内容 | 生成Schema同步测试和类型检查由root在最终联合验证中运行；没有编辑生成Schema文件。 |
| 范围外变更 | 无 |
| GALHCG影响闭环 | 未写图、刷新或写freshness；集中Task收尾时复核。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 脚本语法 | `node --check scripts/gen-engine-schema.mjs` | 通过 | 未写输出文件 |
| Schema源解析 | `parseEngineSchema()`只读查看`StoryDef` fields | 通过 | 输出id/name/nodes/stages/extra；nodes与stages由editor-extras显式提供JSON/record元数据 |
| 引用扫描测试 | `npx vitest run tests/data/runtime-content-reference-rules.test.ts` | 通过 | 9项通过，覆盖新EntryCard、表现目标/选项与实体主题引用路径 |
| Schema生成写回 | 未执行 | 延后 | root按约定在全量切换完成后统一生成一次 |
| 同步测试/tsc | 未执行 | 延后 | root负责统一执行 |

## 遇到问题

- StoryDef继承StoryNodeDocument时，生成器原先仅读接口本地成员，会生成空Story字段；已补通用interface继承字段解析。

## 需上游确认项

- 无；主Agent须在最终Schema验证前运行`npm run gen:schema`并审阅差异。

## 事实更新建议

- Editor Stories行的复杂节点联合结构以通用JSON承载；此Unit不增加专属编辑控件。
