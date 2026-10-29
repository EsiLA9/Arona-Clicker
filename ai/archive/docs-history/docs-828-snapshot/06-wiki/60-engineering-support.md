---
scope: conceptual-wiki
authority: source-grounded-overview
read_when:
  - 需要知道测试、Schema 编辑器和项目检查脚本各自验证什么
  - 需要沿项目脚本入口定位工程约束或工具职责
avoid_when:
  - 需要某个机制本身的算法说明或逐字段 Schema 映射规则
related_modules:
  - tests
  - datapack-editor
  - scripts
---

# 06-wiki/60-engineering-support — 测试、工具与维护检查

> 本文回答：测试、独立 Datapack 编辑器和仓库维护脚本分别支撑哪些项目边界，它们怎样与源码及文档协作。

## 一句话概念

`tests/` 用行为断言守护当前机制，`tools/datapack-editor/` 提供独立的数据包编辑工作台，`scripts/` 承载可重复的生成、检查和分析任务。它们共同帮助发现实现与契约漂移，但各自检查的范围不同；以 `package.json` 注册的命令和脚本实现为准。

## 工程支持职责树

```text
工程支持
├─ tests/
│  ├─ engine/          通用机制、Runtime 与领域服务行为
│  ├─ data/            Data Services、Registry、Datapack、持久化
│  ├─ ui/              UI 组件、上下文、控制器与交互回归
│  └─ tools/datapack-editor/  Schema、编辑器模型、校验和界面行为
├─ tools/datapack-editor/
│  ├─ schema/          Schema 协议、生成输入合并与同步断言
│  ├─ model/           编辑器数据模型
│  ├─ validate/        数据包 / Extra 校验
│  └─ ui/              独立编辑器界面
└─ scripts/
   ├─ gen-engine-schema.mjs
   ├─ check-architecture-boundaries.mjs
   ├─ check-docs.mjs
   ├─ ui-callgraph.mjs
   ├─ report-doc-context.mjs
   └─ pack-arona-clicker-core.mjs
```

目录树描述职责入口，不表示测试执行时的模块依赖图。脚本是否读取或导入某个文件，应以该脚本的源码为证据。

## 测试如何对应源码

测试由 Vitest 执行，`npm test` 映射到 `vitest run`。主要目录按验证主题组织：

| 测试位置 | 常见验证对象 | 例子 |
| --- | --- | --- |
| `tests/engine/` | 引擎机制、产品 Runtime 与领域服务的行为契约 | `affector-engine.test.ts`、`character-progression-def.test.ts` |
| `tests/data/` | Registry、Datapack 导入、包管理、存储和数据服务 | `registry-spot-mutation.test.ts`、`pack-manager.test.ts` |
| `tests/ui/` | UI 上下文、控制器、页面与 DOM 可观察行为 | `context.test.ts`、`controller-events.test.ts`、`contacts-story-workspace.test.ts` |
| `tools/datapack-editor/**.test.ts` | 编辑器 Schema、模型、校验和 UI 组件 | `schema/engine-schema.sync.test.ts`、`model/editor-model.test.ts` |

这是主题归类而非严格的一对一镜像：一个功能的测试可以跨目录验证。例如产品 Runtime 服务的测试目前也可能位于 `tests/engine/`。新增机制仍按 [[docs/archive/docs-828-snapshot/05-conventions/testing]] 覆盖正路径和拒绝/边界，并在适当层验证事件订阅行为。

`engine-schema.sync.test.ts` 是类型与编辑器表之间的同步护栏：它调用 `scripts/gen-engine-schema.mjs` 导出的解析器，比较解析结果、生成协议和合并后的编辑器表。该测试提供字段覆盖与复杂字段同步断言；它不能替代真实编辑器交互测试。

## Datapack 编辑器与 Schema 同步

`tools/datapack-editor/` 是独立编辑器，区别于游戏内 UI 的 Runtime Editor。Schema 相关责任集中在 `schema/`：

1. `scripts/gen-engine-schema.mjs` 从 `src/engine/types/`、`src/engine/contracts/` 和 `src/data-services/contracts/` 解析数据契约，并可写出 `schema/engine-defs.gen.json`。
2. `schema/engine-defs.ts` 读取生成协议；`schema/editor-extras.ts` 补足复杂编辑语义；`schema/merge.ts` 将两者拼合为表结构，`schema/datapack.schema.ts` 暴露最终 Schema。
3. `schema/engine-schema.sync.test.ts` 重新解析源类型，并验证生成字段与最终编辑器表保持同步。

修改参与 Datapack Schema 的字段或枚举时遵循 [[docs/archive/docs-828-snapshot/05-conventions/schema-sync]]：改源类型、运行 `npm run gen:schema`、按需维护 TSDoc 与 `editor-extras.ts`，再运行对应同步测试。`engine-defs.gen.json` 是生成产物，不手工编辑。独立编辑器的启动命令为 `npm run dev:editor`，游戏 UI 则为 `npm run dev:game`。

## scripts 任务速查

以下入口可在根目录 `package.json` 中找到。个别历史重构脚本也存在于 `scripts/`，不属于日常检查命令。

| 命令 | 实际用途 | 边界 |
| --- | --- | --- |
| `npm run gen:schema` | 从契约源码生成 Datapack 编辑器 Schema 协议 | 生成文件应通过源类型和生成命令更新 |
| `npm run check:architecture` | 检查 `src/engine/` 与 `src/data-services/` 对指定目录的相对 import 越界 | `scripts/check-architecture-boundaries.mjs` 是静态扫描；不是完整 TypeScript 模块图或运行时依赖分析 |
| `npm run check:docs` | 检查文档链接、计划文档文件名、源码路径与元信息等机械规则 | 不判断文档语义是否过期 |
| `npm run ui:callgraph` | 对 UI 调用与 DOM 写入做语法层静态分析，可输出调用链、反向链、正向链或热点 | 默认扫描 `src/ui/`；不做类型检查，也不等同于运行时追踪 |
| `npm run report:doc-context` | 报告文档分区规模与粗略上下文估算 | 只提供规模信息，不判断文档质量 |
| `npm test` | 执行 Vitest 全量一次性测试 | 详细纪律见测试规范 |
| `npx tsc --noEmit` | 执行 TypeScript 类型检查 | 编译期契约错误可在此暴露 |

架构检查脚本只识别相对 import，并针对代码中显式列出的目录集合报告越界；不能把通过结果扩大解释为所有层之间不存在任何依赖。调用链脚本则用 TypeScript 语法节点识别函数、调用和 DOM 写入特征，作为 UI 定位工具，而不是构建工具意义上的 import graph。

## 阅读与维护路线

| 任务 | 权威入口 |
| --- | --- |
| 新增或调整测试 | [[docs/archive/docs-828-snapshot/05-conventions/testing]] |
| 同步编辑器 Schema | [[docs/archive/docs-828-snapshot/05-conventions/schema-sync]] |
| 检查模块边界和 UI 只读纪律 | [[docs/archive/docs-828-snapshot/05-conventions/architecture-discipline]] |
| 维护 Wiki 与机制文档 | [[docs/archive/docs-828-snapshot/05-conventions/doc-maintenance]] |
| 了解 Datapack 编辑器模块 | `tools/datapack-editor/schema/`、`tools/datapack-editor/model/`、`tools/datapack-editor/ui/` |
| 了解概念层与模块关系 | [[docs/archive/docs-828-snapshot/01-architecture/AC-outline-wiki]] |

## 相关入口

[[docs/archive/docs-828-snapshot/00-INDEX]] · [[docs/archive/docs-828-snapshot/06-wiki/00-index]] · [[docs/archive/docs-828-snapshot/06-wiki/50-ui]] · [[docs/archive/docs-828-snapshot/05-conventions/testing]] · [[docs/archive/docs-828-snapshot/05-conventions/schema-sync]]
