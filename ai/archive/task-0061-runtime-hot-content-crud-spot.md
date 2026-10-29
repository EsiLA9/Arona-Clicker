# Task-0061：Runtime 热内容 CRUD 与 Spot 服务接入

状态：closing

**状态**：🟡 P0–P4 已实施并通过定向验收；P5 全量与 Edge 验收待完成  
**日期**：2026-09-14  
**前置**：[[task-0060-multi-spot-runtime-editor]]、[[adr-0012-runtime-hot-content-crud]]  
**关联**：[[adr-0010-definition-repository-editor-resolution]]、[[adr-0011-definition-resolution-withdrawal]]、[[task-0059-definition-resolution-p1b]]

## 一、目标

将当前“Draft CRUD → 整体 `reloadPreservingState()`”的 Spot 编辑链路扩展为真正的 Runtime 局部热 CRUD：

```text
一个 Spot 内容提交
    ↓
一个 RuntimeSpotMutation
    ↓
Registry 局部增删改
    ↓
GameNum / Visibility / Spot 查询定向刷新
    ↓
当前 Spot 服务立即使用新定义
```

本任务仍只允许一个临时 Mod，但每次提交只处理一个 Spot 内容，不重新提交其他 Spot。

## 二、硬边界

### 必须支持

- Spot `create`、`replace`、`delete`；
- Spot `suspend`、`resume`；
- 单内容提交和 revision 防冲突；
- 失败时不改变旧 Registry、RuntimeModState 和 PlayerState；
- 单 Spot 删除不移除整个临时 Mod；
- 当前 `SpotService.unlockSpot()`、`upgradeSpot()` 能直接读取热更新后的 Spot；
- 基础 Spot 字段的局部 GameNum、Area/Tag、Visibility 更新。

### 暂不支持

- 多 Mod；
- 一次提交多个 Definition；
- 复杂 Spot 功能、Trigger、Story、Shop、Gacha、Color 引用热更新；
- 通用 Def unload；
- PackManager / StoredPack / 正式 Datapack 导出；
- Story cursor、Trigger once、Affector 实例的通用 Detach/Purge；
- 存档迁移。

## 三、首阶段内容字段

首阶段只开放当前编辑器已经使用的字段：

- `idName`；
- `areaId`；
- `name`；
- `description`；
- `baseCost`；
- `baseCostResource`；
- `baseYield`；
- `baseYieldResource`；
- `baseCapacity`。

`functionalities`、`tags`、`gachaPools`、`colorGroupId`、`theme`、复杂 `Effect` 与引用字段必须由后续任务单独接入。

## 四、目标接口

```ts
type RuntimeSpotMutation =
  | { operation: 'create'; modName: string; spot: RuntimeSpotInput; expectedRevision: number }
  | { operation: 'replace'; modName: string; idName: string; spot: RuntimeSpotInput; expectedRevision: number }
  | { operation: 'delete'; modName: string; idName: string; playerData: 'retain' | 'purge'; expectedRevision: number }
  | { operation: 'suspend'; modName: string; idName: string; expectedRevision: number }
  | { operation: 'resume'; modName: string; idName: string; expectedRevision: number };
```

```ts
interface RuntimeSpotMutationResult {
  ok: boolean;
  revision: number;
  spotId: string;
  operation: RuntimeSpotMutation['operation'];
  transition?: DefinitionChange;
  diagnostics?: readonly DefinitionDiagnostic[];
  message: string;
}
```

不允许把完整 `RuntimeModDraft.spots` 作为热 CRUD 的输入。

## 五、施工切片

### P0：裁定与基线

- [x] 新建 ADR-0012，裁定单 Spot 热 CRUD 的边界；
- [x] 固定单临时 Mod 与单内容提交模型；
- [x] 固定基础 Spot 字段白名单；
- [x] 固定 Retain / Purge / suspend / resume 语义；
- [x] 确认 Task-0060 的整包路径保留为兼容入口。

### P1：Registry 单 Spot mutation

- [x] 增加受控的 Spot create / replace / delete；
- [x] 正确维护 Spot 主表、Area 索引、Tag 索引和来源 owner；
- [x] 提供 prepare / commit / rollback 或等价的原子边界；
- [x] 校验 Area、ID、字段和 Runtime Mod ownership；
- [x] 添加 Registry 层回归测试；
- [x] suspend 保留 source record/owner、移出 active 索引，resume 恢复；receipt 可回滚。

### P2：局部派生系统更新

- [x] 新增 `spotDefinitionChanged` 事件和事件目录登记；
- [x] GameNum 支持单 Spot 子树增删改，不调用 `buildAll()`；
- [x] Visibility 支持单 Spot 索引与快照更新，不调用 `rebuild()`；
- [x] 确认基础 Spot 无复杂功能时的 Affector/Trigger 边界；
- [x] 覆盖 Area 变化、产出资源变化和删除后的幽灵索引。

### P3：RuntimeContentCoordinator

- [x] 用 `RuntimeModState.spots` 替换热路径上的全量 Spot 数组输入；
- [x] 实现 revision、单内容校验、DefinitionChange 和结果诊断；
- [x] 实现 Registry 与 Runtime 状态的失败回滚；
- [x] 保持一个临时 Mod 限制；
- [x] 证明一次热 CRUD 不调用 `reloadPreservingState()`。

### P4：SpotContentService 与 UI

- [x] 在 `SpotService` 下增加 `content` 子门面或等价窄接口；
- [x] UI 当前 Spot 表单改为提交一个 `RuntimeSpotMutation`；
- [x] 未提交的其他 Spot Draft 不受影响；
- [x] 单 Spot 删除不调用 `removeRuntimeMod()`；
- [x] suspend/resume 仍保留 owner 约束。

### P5：验收与兼容清理

- [x] create / replace / delete / suspend / resume 的热路径测试；
- [x] SpotService 解锁与产出测试（升级字段仍在首阶段白名单之外）；
- [x] PlayerState Retain/Purge 测试；
- [x] 旧整包应用入口兼容测试；
- [x] `npx tsc --noEmit`、`npm run check:architecture`、`npm test`、`npm run build` 通过；
- [ ] Edge 手工验证单 Spot 提交、撤销、重新进入和异常恢复。

## 六、失败与回滚口径

### 提交前失败

校验、revision、owner、Area 或字段错误时：

- 不改 Registry；
- 不改 RuntimeModState；
- 不改 PlayerState；
- 返回带 Spot ID/path 的诊断。

### 提交后失败

局部派生系统应用失败时，必须恢复目标 Spot 的 Registry 记录、索引和运行时派生状态。不能通过重新加载完整 Datapack 作为默认回滚手段；若首阶段无法对复杂字段提供原子更新，应在提交前拒绝该字段，而不是进入半应用状态。

## 七、验收关键场景

| 场景 | 预期 |
| --- | --- |
| create 一个新 Spot | Registry、Area、GameNum、Visibility 立即可查；reload 次数为 0 |
| replace 名称 | 只更新目标 Spot，其他 Spot 和 PlayerState 不变 |
| replace Area | 旧 Area 索引移除，新 Area 索引加入 |
| replace 产出资源 | 旧资源子树移除，新资源子树加入，产出不重复 |
| delete | 目标 Spot 不可再被 SpotService 操作，其他 Spot 保留 |
| delete + retain | 当前等级、经理、快照保留 |
| delete + purge | 当前状态和所有 Init 快照对应记录清理 |
| suspend | source record 与 PlayerState 保留，Runtime 不再使用 |
| stale revision | 拒绝提交，旧内容完整保留 |

## 当前施工记录（2026-09-14）

- Registry 已提供 Spot 局部 `create / replace / delete / suspend / resume`，维护主表、Area/Tag 索引、owner，并支持 receipt 回滚；挂起删除的状态转换为 `suspended → missing`。
- GameNum 与 Visibility 已订阅 `spotDefinitionChanged`，对目标 Spot 做定向更新；热路径未调用 `buildAll()`、`rebuild()` 或 `reloadPreservingState()`。
- Runtime 已接入 `RuntimeContentCoordinator`、revision、单临时 Mod 限制、失败诊断和 PlayerState Retain/Purge；`SpotService.content` 提供单 Spot 内容门面。
- UI 已改为当前 Spot 单项提交；未提交 Draft 不会被隐式提交，单 Spot 删除不移除整个临时 Mod。
- 自动化验证：`npm test` 通过（157 个测试文件 / 1462 项）；`npx tsc --noEmit`、`npm run check:architecture`、`git diff --check`、`npm run build` 通过。
- 待补：Edge 中的单 Spot 提交、挂起/恢复、重新进入编辑态与异常恢复手工验收。

## 八、后续扩展入口

当 P1–P5 完成后，另建任务处理：

- 复杂 Spot 功能的热替换；
- 通用 Def 的热 CRUD；
- RuntimeInvalidationPlanner / Coordinator 的跨子系统失效；
- 正式导出和 PackManager 持久化；
- Story / Trigger / Affector 的 Detach/Purge 生命周期。
