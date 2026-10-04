# 测试

## 入口与组织

`npm test` 运行 `vitest run`，以一次性方式执行 Vitest。测试分布在 `tests/`，主要按 `engine`、`ui`、`data` 等领域组织；独立数据包编辑器也在其模块目录内放置测试，例如 `tools/datapack-editor/schema/` 与 `tools/datapack-editor/model/`。

## 同步类检查

`tools/datapack-editor/schema/engine-schema.sync.test.ts` 把源类型解析结果、生成协议与合并后的编辑器表作一致性断言，覆盖表映射、字段覆盖、hand 占位、引用目标及枚举选项。它属于测试套件的一部分，可在类型或编辑器表定义调整时发现不同步。

测试通过只说明已编码的断言通过；静态边界检查、构建和文档链接校验是独立命令，不由 `npm test` 自动代跑。

## 相关脚本

- `npm test`：执行 Vitest 全量测试。
- `npm run check:architecture`：扫描引擎和数据服务的相对导入边界，见 [[docs/docs-829/06-wiki/60-engineering-support/architecture-checks]]。
- `npm run check:docs`：校验 Markdown 链接及约定，见 [[docs/docs-829/06-wiki/60-engineering-support/docs-tooling]]。
