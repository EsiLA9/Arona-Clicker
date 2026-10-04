# Task：从 Base TypeScript 内容导出标准数据包文件夹

状态：done — Base TypeScript 标准文件夹导出、完整解析比对与确定性验证已交付

## 目标

在不改动现有内容模块和运行时代码结构的前提下，从 Base 的 TypeScript 内容组合生成可由 `parsePack()` 读取的文件夹数据包。导出目录默认为 `datapack/base@<Version>/`，包含 manifest、JSON 分片和图片资源。

## 范围

- 新增只供导出 / 校验使用的 TS 内容组合入口，引用当前 `src/arona-clicker/content/` 下已有定义模块，不重排或改写这些模块。
- 新增 Node 脚本，通过 Vite SSR 加载组合结果，将内容序列化为 `datapack.json`、JSON 分片，并复制 Base 图片为包内相对资源。
- 将产品中的静态图片 URL 映射为包内 `zip:` 相对路径；不改变原 TS Def 的 `src` 值。
- 新增端到端测试：运行同一导出器到临时目录，以 `FolderPackSource` / `parsePack()` 解析，再把包内图片路径还原为对应 TS 来源 URL，与 TypeScript Base 对象逐字段比较，并核对复制资源字节。
- 可指定输出目录；生成目录是可删除、可再生成的数据包产物。

## 非目标

- 不改写或替换 `default-datapack.ts`、内容定义模块或 Runtime 当前的 JSON 发布入口。
- 不自动将导出文件安装或复制到 `datapack-dev/`。
- 不修改数据包管理 UI、RuntimeEditor、Schema 或 PlayerState。

## 需要核对

- [[docs/docs-829/00-INDEX]]
- [[docs/docs-829/04-mechanisms/data-services/pack-loading]]
- [[docs/docs-829/03-data-structures/datapack-contracts]]
- [[docs/docs-829/05-conventions/testing]]
- `src/arona-clicker/content/`
- `src/data-services/datapack/pack-parser.ts`
- `src/data-services/datapack/source.ts`

## 验收

- 默认脚本生成完整的 `datapack/base@<Version>/` 标准文件夹；可用 `parsePack()` 解析且 manifest 与内容身份一致。
- 解析后的内容与当前 TS 组合在表、字段、顺序、嵌套值和图片引用上完全一致；文件包图片均存在且逐字节等同于源资源。
- 重复运行输出保持确定；Vite dev、Vite build 和 Runtime 当前启动路径不受影响。
- 定向导出测试、类型检查、架构检查、文档检查及 `git diff --check` 通过。

## 相关任务

- [[task-0175-base-packageization-editing-and-swap]]
- [[task-0176-base-runtime-editor-full-content-coverage]]

## 最终核验（2026-10-02）

- `npm run datapack:export-base` 成功生成 `datapack/base@1.0.0/`，包含 `datapack.json`、`content.json` 和 3 个图片资源。
- `tests/data/base-datapack-folder-export.test.ts` 端到端测试通过：运行真实导出进程、经 `FolderPackSource` / `parsePack()` 解析，逐字段匹配当前 TypeScript 组合和 Runtime 当前 JSON Base fixture，逐字节比较图片资源，并确认重复导出字节稳定。
- `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（522 篇 Markdown，0 errors）、`npm run build`、`git diff --check` 通过。
- 构建成功，并报告 game chunk 超过 500 kB 的提示；该提示不影响导出产物或构建完成。
