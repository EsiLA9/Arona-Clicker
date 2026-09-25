# Task：Init / Area 热 CRUD 与当前位置兜底

状态：in-progress — 2026-09-17 重新立项，取代 0087 的三类内容全量 CRUD 方案

## 目标

在游戏内 Runtime Editor 的既有 Spot 编辑框架中，补齐 Init 与 Area 的编辑态 CRUD，并让提交后的定义立即作用于当前 Runtime。若热编辑使玩家当前所处的 Init / Area 丢失，运行时必须给出可预期的简单兜底：优先回到当前 Init 的第一个有效默认 Area；若当前 Init 已不存在，或没有有效默认 Area，则退回 Init 选择界面。

本任务重新收敛自 [[task-0087-init-area-enhancement-editor-crud]]。0087 的 Enhancement CRUD、三类 Definition 的 candidate reload 方案和已拥有 Enhancement 状态守卫均不属于本任务准出范围。

## 设计裁定

### 1. 热 CRUD 的含义

Init / Area 的 Apply 走 Runtime 的受控局部 mutation，不调用 `reloadPreservingState`，不重建整包 Registry，也不重置 PlayerState。写入链固定为：

```text
Runtime Editor Draft
  → PackCatalog/Game command facade
  → Runtime World Content Coordinator
  → Registry 的 Init/Area mutation
  → InitService 位置与运行时依赖协调
```

UI 不直接写 Registry 或 PlayerState。Registry mutation 在所有索引、引用和归属检查通过后才写入，并提供 receipt 供批量 Apply 失败时回滚。

### 2. 编辑范围与归属

- 继续使用 Spot 共用的编辑器外壳、左侧 Definition Switch、Draft store、表单、诊断区、Apply/失败反馈和窄屏布局；不另建 Init / Area 编辑页面。
- 本任务开放 `inits`、`areas`、`spots` 三个 Switch 项；`enhancements` 不在当前 UI 和 Apply 契约中。
- Runtime Editor 只允许修改当前临时 Mod 自己创建的 Init / Area；基础内容或其他 Mod 的定义显示为只读 / 不可删除。
- `replace` 不允许改变 Init ID，也不允许改变 Area 的 `initId`；跨 Init 搬迁另立任务，避免在单次热编辑中重算整张世界图。
- 不做存档迁移。热 CRUD 只改变 Definition，不删除资源、Spot 等玩家进度；若当前定位失效，按本任务的兜底算法处理。

### 3. CRUD 与引用约束

- Create：ID、字段和引用全部有效后才加入 Registry。
- Replace：保留 ID；Init 的 `defaultAreas` 必须存在且属于该 Init，Area 的 `defaultSpots` 必须存在，邻接 Area 必须存在并属于同一 Init。
- Delete Area：若仍被 Spot 的 `areaId`、Init 的 `defaultAreas` 或其他 Area 的邻接关系引用，则阻断并在编辑器诊断区说明引用来源。
- Delete Init：若仍有 Area 属于它，或其他 Definition 仍引用它，则阻断；当前活动 Init 的删除在 Runtime 协调层还必须触发位置兜底，而不是留下悬空状态。
- 单次 Apply 按依赖安全顺序处理：先创建 / 替换 Init，再创建 / 替换 Area；删除时先 Area、后 Init。中途失败回滚已完成的局部 mutation。
- 所有失败均 fail closed：Registry、索引、运行时位置和 Draft 的 applied 基线不能出现半更新。

### 4. 当前所处位的兜底

热 CRUD 提交后由 `InitService` 做一次轻量 reconciliation：

1. `activeInit` 不再存在：卸载该 Init 的 Trigger，清理当前剧情和局部可见性，清空 `activeInit` / `currentAreaId`，刷新可见性，使 UI 回到 Init 选择界面。
2. `activeInit` 仍存在，但 `currentAreaId` 不存在或不再属于该 Init：从该 Init 的 `defaultAreas` 顺序中取第一个仍存在且归属正确的 Area，直接切换过去并刷新依赖；不重复播放 Init 进入效果，不清空玩家资源和 Spot 进度。
3. 没有任何有效默认 Area：按第 1 条退回 Init 选择界面。
4. 当前 Area 仍有效：只刷新受定义影响的 Trigger / 可见性 / Affector 依赖，不改变玩家位置。

该兜底是运行时状态修复，不是 UI 猜测。UI 只根据只读 view 重新渲染当前页面。

## 实现落点

| 层 | 责任 |
| --- | --- |
| `src/data-services/authoring/content-policies.ts` | Init / Area 字段、默认值、引用诊断与可写范围 |
| `src/data-services/registry/registry.ts` / mutation 模块 | Init / Area 原子局部 CRUD、关系索引维护、receipt 回滚 |
| `src/arona-clicker/services/runtime-world-content-coordinator.ts` | 临时 Mod 归属、批量依赖顺序、Registry mutation 与 InitService 协调 |
| `src/arona-clicker/services/init-service.ts` | 当前 Init / Area 有效性重算与两级兜底 |
| `src/arona-clicker/contracts/runtime-content.ts`、`runtime.ts`、`runtime-commands.ts` | Game / Pack command facade，不把 Registry 写引用暴露给 UI |
| `src/ui/runtime-editor/{state,view,actions}.ts` | 复用 Spot 框架的 Init / Area Draft、表单、Apply、失败恢复和可访问反馈 |

## 验收

### 可执行验收

- 类型检查：`npx tsc --noEmit`
- Init / Area 热 CRUD、关系阻断、回滚和位置兜底：`npm test -- --run tests/engine/runtime-world-hot-crud.test.ts`
- 共享编辑框架与 Draft 行为：`npm test -- --run tests/ui/runtime-editor-definition.test.ts tests/ui/runtime-editor-form.test.ts`
- 架构边界：`npm run check:architecture`
- 文档链接：`npm run check:docs`
- 生产构建：`npm run build`

### 一般编辑用户验收

- Init、Area、Spot 在同一个编辑外壳中切换，切换后仍能看到当前条目、未保存提示和 Apply 状态。
- 新建、修改、删除条目的标签、输入名称和错误位置清楚；引用不存在或删除受阻时不丢 Draft。
- Apply 成功后能看到明确成功反馈；失败后仍停留在原编辑位置，用户可修正后重试。
- 当前区域被删除时，用户能观察到回到默认区域；没有可用默认区域时，能看到 Init 选择界面，而不是空白地图或死页面。
- 位置兜底不清空资源、Spot 等玩家进度，也不重复触发一次性 Init 进入效果。
- 键盘焦点、按钮禁用态、异步反馈和窄屏布局沿用 Spot 编辑器的现有可用性约定。

## 非目标

- Enhancement 编辑态 CRUD、已拥有 Enhancement 的撤销 / 重建策略。
- 任意 Effect / Trigger DSL 的新编辑器。
- candidate Datapack + 全量 reload 作为 Init / Area 的 Apply 路径。
- 独立 `tools/datapack-editor/` 的恢复或改造。
