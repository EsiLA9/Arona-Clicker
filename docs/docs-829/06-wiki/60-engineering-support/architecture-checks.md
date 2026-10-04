# 架构边界检查

`npm run check:architecture` 执行 `scripts/check-architecture-boundaries.mjs`。脚本递归读取 `src/engine/` 和 `src/data-services/` 下的 TypeScript 文件，用相对路径导入语法扫描禁止的依赖方向。

引擎禁止导入 UI、内容、存档及数据服务目录；数据服务禁止导入 AronaClicker 内容、UI、测试数据及存档目录。脚本另为两个已知引擎兼容 shim 设置例外。发现违规时会打印来源文件、导入语句和目标目录，并以非零退出码结束。

这是轻量语法扫描：它只识别相对导入，不解析别名、动态路径或完整 TypeScript 模块图。因此通过结果表示未发现该检查器覆盖范围内的违规，不证明所有依赖关系都正确。相关源码入口为 `scripts/check-architecture-boundaries.mjs`。
