# Unit 0309-U7：准备页生命周期与局部刷新

## Goal

在同一 map-entry route 内局部更新入口投影与交互门控，保持列 / 滚动 / 队员 DOM 身份；来源或当前区域失效时恢复原日常游戏位置。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` §“路由、会话与生命周期”及“门控、提交与更新边界” | route 生命周期与局部更新验收 |
| 源码 | `src/ui/controller/controller.ts:requestMapWorkspaceRefresh/applyUIUpdate/refreshMapWorkspaceRegion/render` | 现有 region dispatcher、MapFlow 清理与 route-only 生命周期 |
| 源码 | `src/ui/workspace/map-dom-updates.ts:patchMapDOM` | 复用 keyed reconciliation / popover 替换范围 |
| 源码 | `src/ui/components/map/map-entry-workspace.ts:renderMapEntryWorkspace` | 准备页稳定 Host、成员语义 key 与局部区域 |
| 文档 | `docs/docs-829/06-wiki/50-ui/refresh-update.md` | 当前项目 refresh 类别和回退语义 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k tokens |
| 文档 Read Set | 3 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并拆分 |

## Optional Read Set

- 只有找不到现成 roster / Story gate 通知入口时，才读取命中事件订阅的局部调用方。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**`

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `requestMapWorkspaceRefresh` 与 `applyUIUpdate` 目前只对 route kind map 使用 Map 区域刷新 | `src/ui/controller/controller.ts:requestMapWorkspaceRefresh/applyUIUpdate` | map-entry 需单独 region host 路径 |
| `patchMapDOM` 可复用 `data-workspace-frame`、column、theme host、focus 和 map region key 做递归 keyed patch，并在真正移除前通知 overlay owner | `src/ui/workspace/map-dom-updates.ts` | 页面可以共用现有协调器 |
| 当前 root `render()` 会重建 UI；普通页面数据更新应经现有 UIUpdate dispatcher 定向请求 | `src/ui/controller/controller.ts:render/flushUIUpdates` | tick 不得刷新整个页面 |

## Constraints

- route/owner 真正改变时允许结构 render；entry route 内只发 `region` update 到专属 host，普通 tick 不 `render()`。
- 复用 `patchMapDOM` 并给四个内容宿主、每个成员、资源项与主焦点提供稳定 key；补丁后恢复所有 content scroll，保留有效焦点。
- 替换前清理仅落在将移除 range 内的 popover；不影响外部锚点。
- `mapEntrySource` 不持久化。Spot / functionality / condition / Current Area 失效、Runtime load / 重建后来源无法验证时，安全返回单层 `returnTo`；不 abandon 有效 Run。
- 准备页的 fresh/resume 信息只能从 `getEntryView` 读取；不从游戏全页重建推导或镜像 Run。
- 遵守 Task 0309、`AGENTS.md` 与 UI refresh 规范。

## Allowed Files

- `src/ui/controller/controller.ts`
- `src/ui/components/map/map-entry-workspace.ts`

## Explicit Non-goals

- 不改 MapRun / SaveData / command、Datapack Schema 或页面内容合同。
- 不改通用 `patchMapDOM` 实现；只用已支持的 key 语义。
- 不修改或运行测试。

## Stop Conditions

适用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条。若刷新必须改通用 dispatcher / host registry / DOM reconciler，或超出两文件白名单，停止并上交。

## Completion Criteria

- [x] Gate / MapEntryView 更新时可只替换 map-entry region，保留共享 Frame 与 sibling column。
- [x] 稳定成员与资源 key 在局部 patch 中保留；滚动、有效焦点和范围外浮层保持。
- [x] Entry source / Area / 功能失效或重建后无法验证时返回原游戏位置，不清理 Run。
- [x] MapEntry route 当前不产生普通 Tick 全页重绘。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 源码类型检查 | 临时配置继承仓库 `tsconfig.json`，以 `controller.ts` 为入口 | 无新增错误 |
| 差异检查 | `git --no-pager diff --check` | 通过 |
| 测试 | 未要求；不修改或运行测试 | — |

## Pre-flight

- Goal：专属 map-entry region 更新与失效返回；Allowed Files 仅 Controller 与页面组件；route 切换可结构 render，局部变化使用 patchMapDOM；保留列 / scroll / focus，关闭目标范围内 popover；source/Area 失效安全返回但不 abandon。
