# 06-wiki/60-engineering-support/architecture-checks — 架构依赖检查

> 本文回答：`npm run check:architecture` 检查了哪些依赖边界，成功能证明什么？

## 检查过程

`npm run check:architecture` 执行 `scripts/check-architecture-boundaries.mjs`。脚本递归读取 `src/engine/` 和 `src/data-services/` 下的 `.ts` 文件，查找 `from '...'` 和 `import('...')` 形式的导入；只解析以 `.` 开头的相对路径，再看目标是否落入禁止依赖目录。

目前检查边界大致是：

- `src/engine/` 不能依赖 UI、产品领域、Data Services、旧存档入口和 `src/data/`。
- `src/data-services/` 不能反向依赖 UI、产品领域、旧存档入口和 `src/data/`。
- 检查脚本的 `compatibilityShims` 集合仍保留两项旧 Engine 兼容转发文件豁免，但当前工作树中没有对应的源文件。若未来重建同名路径，该文件的边界违规会被跳过；应先复核并清理或重新证明该豁免（本次记录为 P3 维护发现）。

命中规则时脚本输出来源文件、导入写法及目标目录，并以非零退出码结束；没有命中时显示通过。

## 结果能说明什么

这是快速的**静态语法检查**：不运行应用，也不验证产品逻辑。它只检查指定目录里的 `.ts` 和相对导入写法，不能识别路径别名、非字面量动态路径，也不建完整 TypeScript 模块图。因此“通过”只表示该脚本覆盖范围内没有命中禁止路径；不能证明全部依赖方向合理，更不能证明程序运行行为正确。

脚本入口：`scripts/check-architecture-boundaries.mjs`。稳定边界见 [[docs/docs-829/05-conventions/architecture-discipline]]；模块之间的静态依赖和运行时组合见 [[docs/docs-829/01-architecture/dependency-map]]。文档路由检查是另一条独立命令：[[docs/docs-829/06-wiki/60-engineering-support/docs-tooling]]。
