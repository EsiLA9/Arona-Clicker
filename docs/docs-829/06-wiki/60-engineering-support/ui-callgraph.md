# UI 调用图

`npm run ui:callgraph` 执行 `scripts/ui-callgraph.mjs`。默认扫描 `src/ui/` 下非声明文件的 TypeScript，使用 TypeScript 语法树记录函数定义、调用、监听器入口、DOM 写入及被识别为刷新汇聚点的函数名。

常用模式：

- `--chains`：从事件入口查看通往刷新或 DOM 汇聚点的调用链。
- `--dom`：查看 DOM 写入点及其反向调用链。
- `--reverse name1,name2`：查看目标函数的调用者路径。
- `--forward name1,name2`：查看目标函数继续调用的路径。
- `--hot`：查看调用入度和 DOM 写入热点。
- `--roots src/ui,src/arona-clicker`：扩展扫描目录；默认仅 `src/ui`。

脚本不做类型检查，调用关联基于语法层名称匹配，结果用于定位和探索。它不是运行时调用跟踪，名称相同的函数可能造成匹配歧义，未识别的动态调用也不会出现在图中。入口及参数实现见 `scripts/ui-callgraph.mjs`。
