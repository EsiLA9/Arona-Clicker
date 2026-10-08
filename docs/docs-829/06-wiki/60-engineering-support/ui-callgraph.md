# 06-wiki/60-engineering-support/ui-callgraph — 浏览 UI 调用链

> 本文回答：界面重绘或 DOM 修改可能由谁触发，可以怎样反向找入口？

`npm run ui:callgraph` 执行 `scripts/ui-callgraph.mjs`，用 TypeScript 语法树分析源码并在终端显示概览。默认扫描 `src/ui/` 下 `.ts`、非 `.d.ts` 文件；不会执行游戏，也不会做类型检查。

## 常用查找方式

在 package script 后用 `--` 把参数交给脚本：

| 问题 | 命令 |
| --- | --- |
| 看文件、函数和 DOM 写入的总览 | `npm run ui:callgraph -- --summary` |
| 从事件回调找向刷新或 DOM 写入点的路径 | `npm run ui:callgraph -- --chains` |
| 查看 DOM 写入点及其调用者 | `npm run ui:callgraph -- --dom` |
| 找谁可能调用目标函数 | `npm run ui:callgraph -- --reverse render,refreshPanels` |
| 查看目标函数继续调用什么 | `npm run ui:callgraph -- --forward bindContactsActions` |
| 找调用入度或 DOM 写入较多的位置 | `npm run ui:callgraph -- --hot` |
| 纳入跨文件同名多定义的弱关联 | `npm run ui:callgraph -- --chains --weak` |

默认根目录只有 `src/ui`。要把 Runtime 加入候选，可传 `--roots src/ui,src/arona-clicker`。可以用 `--depth` 限制正向路径深度、`--paths` 限制反向路径数；`--json graph.json` 将当前分析结果另写为 JSON 文件。

## 怎样理解结果

脚本识别函数、方法、回调、常见监听器（例如 `addEventListener`、`subscribe`）、部分 DOM 写入属性与方法，以及一组按函数名定义的“刷新线索”。调用者与被调用者按语法里的函数名匹配；跨文件若同名函数不唯一，关联可能存在歧义。`--weak` 会把这些弱关联也加入分析。

所以结果适合定位“从哪里开始读”，不能当作运行时调用记录或完整调用证明：动态调用、未识别的 DOM 写法和非 TypeScript 文件不会完整出现在图里；同名方法可能造成误连。使用结果时回到对应源码和真实用户路径确认。

入口与参数实现：`scripts/ui-callgraph.mjs`。UI 刷新与交互规范见 [[docs/docs-829/06-wiki/50-ui/00-index]]；静态架构依赖检查与本脚本的作用不同，见 [[docs/docs-829/06-wiki/60-engineering-support/architecture-checks]]。
