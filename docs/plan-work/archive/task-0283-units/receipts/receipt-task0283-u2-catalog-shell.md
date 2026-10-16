# Receipt task-0283-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `src/ui/runtime-editor/codex/content-labels.ts`；修改 `src/ui/runtime-editor/codex/view.ts`、`src/ui/runtime-editor/codex/codex.css` 与 `tests/ui/runtime-editor-codex-shell.test.ts`。 |
| 未完成内容 | 真实浏览器、类型检查与架构检查由主线程统一验收；当前无 U2 内部未完成项。 |
| 范围外变更 | 无；`src/ui/runtime-editor/view.ts` 仅按主线程要求只读复核，未修改。 |
| GALHCG 影响闭环 | 已用 `graph_project` 核对 `acprogram`，图内 `RuntimeEditor Codex` 搜索为 scoped miss；对 U2 直接路径执行 `graph_read` 与 `graph_health(check="changed")` 只读复核。无图谱维护授权，未改图、刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run --silent tests/ui/runtime-editor-codex-shell.test.ts` | 通过 | 9 tests passed。 |
| 集成测试 | `npx vitest run --silent tests/ui/runtime-editor-codex-shell.test.ts tests/ui/runtime-editor-codex-integration.test.ts` | 部分通过 | shell 9 tests passed；integration 收集失败，`codex-details/index.ts` 当时无法解析 `./render`。主线程确认 U3 正在重写该模块，按要求未重复运行。 |
| 类型检查 | `npx tsc --noEmit` | 未执行 | 由主线程完成整体类型验证。 |
| 人工验收 | 未执行 | 未执行 | 浏览器与窄屏验收由主线程统一执行。 |
| GALHCG | `graph_project`、`graph_search`、`graph_read`、`graph_health(check="changed")` | 只读完成 | 直接路径结果与索引状态在下表概述；没有地图维护授权。 |

## 直接路径地图复核

| 路径 | `graph_health(check="changed")` 结果 |
| --- | --- |
| `src/ui/runtime-editor/codex/content-labels.ts` | `unreferenced_path`；新文件未索引 |
| `src/ui/runtime-editor/codex/view.ts` | `content_changed`；1 条既有 Evidence 基准已过期 |
| `src/ui/runtime-editor/codex/codex.css` | `content_changed`；1 条既有 Evidence 基准已过期 |
| `tests/ui/runtime-editor-codex-shell.test.ts` | `content_changed`；1 条既有 Evidence 基准已过期 |
| `docs/plan-work/archive/task-0283-units/receipts/receipt-task0283-u2-catalog-shell.md` | `unreferenced_path`；新文件未索引 |
| `src/ui/runtime-editor/view.ts`（按主线程要求只读复核） | `content_changed`；1 条既有 Evidence 基准已过期 |

## 遇到问题

- 集成测试尝试时，详情 `render.ts` 尚未落盘，导致 `tests/ui/runtime-editor-codex-integration.test.ts` 在收集阶段失败；该文件不在 U2 白名单，且主线程说明 U3 正在处理。
- 新建分类模块与 Receipt 没有直接 Evidence / maps_to 关联；其它 U2 源码与测试文件存在直接映射，但其既有 Evidence 内容基准已过期。本 Unit 无地图维护授权。

## 需上游确认项

- 无。

## 事实更新建议

- Runtime 浏览器的 `definitionKind` 使用 Registry getter 的稳定 plural key；U2 使用该 key 做显式主分类映射，未识别 kind 才进入“其它内容”。
- 超级图鉴当前分类计数按完整有效 Runtime 条目计算，不随搜索结果变化；中栏条目计数按当前搜索、分类、包与类型筛选结果计算。
- `layout.css` 的 `.workspace-frame` 全局外观通过 `.runtime-editor-codex__grid.workspace-frame` 的图鉴作用域覆盖隔离；其三栏 `grid-template-columns` 与撑满列的 flex 行为保留。
