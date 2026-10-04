# Task：从源码重建 docs-829 文档系统

状态：done — 新文档系统已重建并切换当前入口

## 目标

在 `docs/docs-829/` 建立一套独立、可直接作为项目当前参考入口的文档系统。所有机制、结构和职责正文重新从当前源码与测试核实编写；`docs/docs-828/` 作为旧版快照保持不变，不将旧页正文复制或改写为新事实。

## 目标目录模式

```text
docs/docs-829/
├─ 00-INDEX.md
├─ 01-architecture/       总览、依赖、生命周期、状态与数据流
├─ 02-modules/             短模块卡，职责/源码/测试/深入路由
├─ 03-data-structures/     PlayerState、Registry、契约与引用语义
├─ 04-mechanisms/          按大模块分目录的机制正文
│  ├─ engine/
│  ├─ data-services/
│  └─ arona-clicker/
├─ 05-conventions/         架构边界、Schema、测试和文档维护
└─ 06-wiki/                Outline 的跨层概念与分功能关系页
   ├─ 00-index.md
   ├─ 10-application-runtime/
   ├─ 20-data-services/
   ├─ 30-arona-clicker-domain/
   ├─ 40-engine/
   ├─ 50-ui/
   └─ 60-engineering-support/
```

每个 Wiki 子目录有 `00-index.md`，按主题新增分功能页。模块卡不复制 Wiki 正文；数据结构与机制页保留各自的唯一专业职责。旧 `docs/docs-828/` 和 `docs/docs-824/` 不作为本轮当前事实来源。

## 并行工作包

1. **Engine**：引擎职责卡、核心协作页、表达式/数值、效果联动、可见性/统计等机制；直接核对 Engine 源码与测试。
2. **Data Services**：包契约和导入、PackManager、Registry、定义解析/编辑策略、持久化与资产；核对数据服务实现与测试。
3. **AronaClicker Domain**：Runtime、PlayerState、世界/角色/故事/商店等服务与领域机制；核对产品 Runtime、状态写入口和测试。
4. **Integrator**：搭建新索引、架构正文、UI 与工程支持正文，交叉校对 Agent 页面，并完成入口切换与旧版保留说明。

所有 Agent 只在 `docs/docs-829/` 的职责白名单内写作；并行前不移动或修改旧文档。

## 权威与内容规则

- 当前事实以 `src/`、`tests/` 与本轮新写的 `docs/docs-829/` 为准；直接核验，不从旧文档复制事实表述。
- Outline 只提供概念分组，不是实现证据；所有协作箭头须标明是静态依赖、调用流程或数据流。
- 旧系统全文不改。完成新系统后，仅更新 `AGENTS.md` 路由和计划索引，指向 docs-829；旧链接继续指向旧快照，不在旧树内追加 redirect。
- `docs/plan-work/archive/` 只存计划历史；不把现行技术文档放入计划归档。

## 验收

- docs-829 的总入口可路由到架构、模块卡、数据结构、机制、规范和概念 Wiki。
- 大模块按目录组织分功能页；每篇有职责范围、关键源码/测试路由，并链接同一新系统内的相关专题。
- 根目录 `AGENTS.md` 当前文档路由切换到 docs-829；文档总索引、Wiki 子索引和模块卡之间的链接完整。
- `docs/docs-828/` 与 `docs/docs-824/` 的文件和内容保持不变。
- `npm run check:docs` 通过；Task 记录实际核验与未覆盖项。

## 当前核验（2026-09-28）

- 新树按目标目录模式完成：架构 4 篇、模块卡 6 篇、数据结构 6 篇、机制 6 篇、规范 5 篇；Wiki 含总索引、6 个大模块索引和分功能专题页。
- `npm run check:docs`：通过，扫描 438 篇 Markdown，0 errors。
- `git diff --check`：发现并修正 `AGENTS.md` 文件末尾多余空行；未运行测试（本 Task 仅重建文档）。

## 最终状态

新文档体系已完成并成为当前路由入口；未解决的实现事实仍在对应新文档中标为待核实（例如 TickSystem 对 `totalFrames` 的直接写入）。未将旧文档迁入或复制到新树。

## 相关路由

[[docs/docs-828/01-architecture/AC-outline-wiki]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[docs/ai/task-read-set-routing]]
