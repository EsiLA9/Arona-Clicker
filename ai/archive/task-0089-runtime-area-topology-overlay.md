# Task：Runtime Area 拓扑 Overlay 与统一可达性

状态：active — 2026-09-17 已完成代码施工，待浏览器交互验收

## 目标

将静态 `AreaDef.adjacentAreaIds` 与 Runtime Editor / Affector 产生的临时可达关系分离，使 Runtime Mod 可以从自己拥有的 Area 连接到其他数据包拥有的 Area，而不修改外部 Area Def，也不因 `twoWay` 反向边触发 Area 所有权冲突。

最终所有玩家移动与 Area 导航 UI 都通过统一的“当前可用拓扑”查询，合并静态拓扑、Runtime 拓扑 Overlay 与 Affector 动态连接。

## 当前事实与问题

- `AreaDef.adjacentAreaIds` 是静态数据包声明，玩家移动与左侧 Area 导航直接消费它。
- `RuntimeWorldContentCoordinator.prepareAreas()` 当前把 `twoWay` 实现为修改目标 Area 的 `adjacentAreaIds`，并要求目标 Area 属于当前可编辑 Area 集合。
- 因此 Runtime Mod 新建 Area 后，无法对外部 Mod / base Area 构造指向它的双向可达关系。
- Affector 已有独立的动态 `areaConnections` 通道；`InitService.travelToArea()` 当前会额外查询该通道，但 UI 左侧导航尚未统一消费动态关系。

## 设计裁定

### 1. 三类拓扑来源

```text
AreaDef.adjacentAreaIds       静态 Def 拓扑
Runtime Area Topology Overlay  Runtime Editor 临时拓扑
Affector areaConnections       Affector 生命周期拓扑
                 ↓
       AreaConnectivity 查询层
                 ↓
        玩家移动 / Area 导航 UI
```

- 静态 Def 保持原语义，不由外部 Runtime Mod 改写。
- Runtime Editor 的 `twoWay` 只保存一条 Overlay 声明，在查询层解释为两个方向，不物化反向 Area Def。
- Affector 动态连接继续由 Affector 生命周期管理，与 Runtime Editor Overlay 分开存储，但由同一查询层合并。

### 2. Runtime Overlay 归属

- Runtime Mod 只声明自己拥有的源 Area 的拓扑 Overlay。
- 目标 Area 可以来自 base、其他 Mod 或当前 Runtime Mod，但必须存在并属于同一 Init。
- 删除、重应用或撤销 Runtime Mod 时，只移除该 Mod 的 Overlay；不修改目标 Area Def。
- 不新增 PlayerState 字段，不做存档迁移；Overlay 属于当前 Runtime 内容状态。

### 3. 查询与事件

- 新增只读连通性查询能力，至少提供当前 Area 的可达目标集合，并保留来源信息供 UI 需要时展示。
- `travelToArea()` 使用该查询层，不再分别拼接静态邻接与 Affector 连接。
- `rail.ts` 使用同一查询结果，保证 UI 显示的“可前往区域”和实际移动判定一致。
- Runtime Overlay 变更发出拓扑变化事件；当前 Area 受影响时，UI 只刷新左侧 Area 导航。

## 施工切片

### P0：Runtime Overlay 数据与 Coordinator

- [x] 为 Runtime World 状态增加 Overlay 连接契约与快照字段。
- [x] `twoWay` 改为保存 Overlay，不再要求反向修改外部 Area Def。
- [x] 保留同 Init、目标存在、自身连接和重复边校验。
- [x] Apply / delete / rollback 时保证 Overlay 与 Area Def 一致收敛。

### P1：统一 AreaConnectivity 查询

- [x] 在 `RuntimeGameInstance.availableAreaIds()` 提供统一的静态 + Runtime Overlay + Affector 可达性查询。
- [x] `InitService.travelToArea()` 改用统一查询。
- [x] UI 左侧 Area 导航改用统一查询。

### P2：事件、诊断与测试

- [x] 增加拓扑变化事件及事件目录登记。
- [x] 覆盖外部 Area 作为双向目标、跨 Init 拒绝、Overlay 删除和回滚。
- [x] 覆盖 UI 与实际移动结果一致，以及 Overlay 变化后的左侧导航刷新。

## 非目标

- 不改变静态数据包的 `AreaDef` 结构与现有邻接语义。
- 不允许跨 Init 移动或建立拓扑连接。
- 不将任意外部 Area 转化为当前 Runtime Mod 的可编辑 Def。
- 不改造独立 `tools/datapack-editor/`。
- 不新增存档迁移或兼容层。

## 测试与验收

- `npx tsc --noEmit`
- `npm test -- --run tests/engine/runtime-world-hot-crud.test.ts`
- Runtime Editor / Area 导航专项 UI 测试
- `npm run check:architecture`
- `npm run check:docs`

## 当前核验（2026-09-17）

- 已核实 `AreaDef.adjacentAreaIds`、Runtime World Coordinator、`InitService.travelToArea()`、Affector `areaConnections` 与左侧 Area 导航的现状。
- 已确认当前 `twoWay` 实现会修改目标 Area Def，因此无法支持外部 Area 目标。
- `npx tsc --noEmit` 通过。
- `npx vitest run tests/engine/runtime-world-hot-crud.test.ts tests/ui/runtime-editor-definition.test.ts tests/ui/runtime-editor-form.test.ts tests/ui/controller-events.test.ts --reporter=dot` 通过，4 个测试文件、38 项测试通过。
- `npm test -- --run --reporter=dot` 通过，167 个测试文件、1557 项测试通过。
- `npm run check:architecture` 通过。
- `npm run check:docs` 通过。
- `git diff --check` 通过。

## 剩余工作

- 补充当前 Runtime Editor 自定义拓扑下拉的浏览器交互验收。
- 如浏览器验收发现下拉筛选或导航刷新仍有问题，再补充 UI 修正与回归测试。

## 相关路由

- [[docs/docs-828/02-modules/world]]
- [[docs/docs-828/02-modules/affector]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[task-0088-init-area-hot-crud-and-location-fallback]]
