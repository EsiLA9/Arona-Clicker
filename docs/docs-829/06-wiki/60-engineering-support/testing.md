# 06-wiki/60-engineering-support/testing — 怎样运行项目测试

> 本文回答：改动后应该跑哪一个测试，测试通过能说明什么？

## 入口与组织

`npm test` 运行 `vitest run`，以一次性方式执行 Vitest。Vitest 配置只收集 `tests/**/*.test.ts` 与 `tools/**/*.test.ts`，运行在 Node 环境并先加载 `tests/setup.ts`。测试分布在 `tests/`，主要按 `engine`、`ui`、`data` 等领域组织；独立数据包编辑器也在其模块目录内放置测试，例如 `tools/datapack-editor/schema/` 与 `tools/datapack-editor/model/`。

## 选择运行方式

| 需要做什么 | 命令 | 能说明什么 |
| --- | --- | --- |
| 跑整个配置内的 Vitest 套件 | `npm test` | 当前断言集整体是否通过；不自动运行构建、类型检查或静态架构/文档检查 |
| 只跑关联测试 | `npx vitest run tests/engine/arona-runtime-pack.test.ts`（替换为目标 `.test.ts` 路径） | 被指定的测试文件是否通过；没有被选中的其他行为不受覆盖 |
| 交互中反复运行测试 | `npm run test:watch` | 启动 Vitest watch 模式，适合开发时观察相关测试 |
| 检查 TypeScript 类型 | `npx tsc --noEmit` | 项目当前 TypeScript 配置的静态类型错误；不执行游戏流程 |
| 检查 Vite 生产构建 | `npm run build` | Vite 当前生产构建是否完成；不等于测试每项业务正确 |

改代码时先找行为附近的测试，例如 `tests/engine/` 或 `tests/data/`。测试入口是否被当前 Vitest 配置收集，可查 `vitest.config.ts`；命令映射可查 `package.json`。

## 同步类检查

`tools/datapack-editor/schema/engine-schema.sync.test.ts` 把源类型解析结果、生成协议与合并后的编辑器表作一致性断言，覆盖表映射、字段覆盖、hand 占位、引用目标及枚举选项。它属于测试套件的一部分，可在类型或编辑器表定义调整时发现不同步。

测试通过只说明已编码的断言通过；静态边界检查、构建、类型检查和文档链接校验是独立命令，不由 `npm test` 自动代跑。测试失败则需要检查真实行为与断言预期；不要只为让测试通过而假定产品逻辑已正确。

## 相关脚本

- `npm test`：执行 Vitest 全量测试。
- `npm run check:architecture`：扫描引擎和数据服务的相对导入边界，见 [[docs/docs-829/06-wiki/60-engineering-support/architecture-checks]]。
- `npm run check:docs`：校验 Markdown 链接及约定，见 [[docs/docs-829/06-wiki/60-engineering-support/docs-tooling]]。

Schema 修改的完整同步步骤见 [[docs/docs-829/06-wiki/60-engineering-support/schema-editor]]；静态架构检查不能替代模块审阅，见 [[docs/docs-829/06-wiki/60-engineering-support/architecture-checks]]。
