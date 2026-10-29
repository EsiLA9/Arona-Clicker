# ADR-0012：Runtime 热内容 CRUD 与 Spot 服务接入边界

状态：active

**状态**：🟢 Accepted / 生效（2026-09-14）
**日期**：2026-09-14  
**依据**：[[task-0060-multi-spot-runtime-editor]]、当前 Runtime / Registry 代码核查  
**关联**：[[adr-0010-definition-repository-editor-resolution]]、[[adr-0011-definition-resolution-withdrawal]]、[[task-0061-runtime-hot-content-crud-spot]]

> 本 ADR 只裁定“单个临时 Mod 中的 Spot 内容如何进行局部热 CRUD”。它不把所有 Definition、正式 Datapack、PackManager 或 Runtime 生命周期一次性改造成热更新系统。

## 一、背景

当前编辑器已经可以在 Draft 中维护多个 Spot，但提交时仍由 `applyRuntimeMod()` 将全部 Spot 重新物化为一个临时 Datapack，并调用 `reloadPreservingState()`。这减少了提交次数，却仍然会整体清空并重建 Registry 及其运行时派生系统。

Definition Resolution、Draft-only Tombstone 与 `DefinitionDelta` 已经提供了来源层语义，但它们目前是纯数据层能力，不直接修改 Runtime Registry。要让当前 Spot 服务真正使用热内容 CRUD，需要增加 Runtime 侧的局部变更协调层。

## 二、裁定

### 2.1 首阶段只做 Spot 热 CRUD

首阶段支持：

- 一个临时 Mod；
- 一个提交请求只包含一个 Spot 内容操作；
- `create`、`replace`、`delete`；
- 作为同一生命周期接口的 `suspend`、`resume`；
- 仅支持当前编辑器已有的基础 Spot 字段。

首阶段不开放会引入额外运行时依赖的字段：

- `functionalities`；
- `gachaPools`；
- `colorGroupId`；
- Trigger、Story、Shop、复杂 Effect 或其他跨 Definition 引用；
- 多 Mod 同时编辑。

这些字段需要各自的失效和生命周期协议，不能借用 Spot 基础 CRUD 的安全边界。

### 2.2 单内容命令优先于整包 Draft 提交

Runtime 热内容接口不得接收完整 `RuntimeModDraft.spots` 集合作为提交单位。提交单位固定为一个 `RuntimeSpotMutation`：

~~~ts
type RuntimeSpotMutation =
  | { operation: 'create'; modName: string; spot: RuntimeSpotInput; expectedRevision: number }
  | { operation: 'replace'; modName: string; idName: string; spot: RuntimeSpotInput; expectedRevision: number }
  | { operation: 'delete'; modName: string; idName: string; playerData: 'retain' | 'purge'; expectedRevision: number }
  | { operation: 'suspend'; modName: string; idName: string; expectedRevision: number }
  | { operation: 'resume'; modName: string; idName: string; expectedRevision: number };
~~~

`expectedRevision` 用于拒绝过期编辑器或重复提交。成功提交后 Runtime revision 单调递增。

### 2.3 Runtime 使用 Overlay Map，不重建 Datapack

临时 Mod 的 Runtime 状态改为按逻辑 Spot ID 保存：

~~~ts
interface RuntimeModState {
  modName: string;
  displayName: string;
  version: string;
  author: string;
  description: string;
  sourceId: string;
  spots: Map<string, SpotDef>;
  suspendedSpotIds: Set<string>;
  revision: number;
}
~~~

`RuntimeModDraft` 可以保留为兼容读取/旧路径，但热 CRUD 不再把全量数组作为应用输入。新增或修改一个 Spot 时只更新该 Spot 的 Registry 记录、索引和派生运行时节点。

### 2.4 Definition Layer 与 Runtime Layer 分工

- `Definition Resolution` 继续只处理 source record、Tombstone、解析状态和 Delta；
- `Registry` 提供受控的 Spot 局部 mutation，不向 UI 暴露可写 Map；
- `RuntimeContentCoordinator` 负责校验、提交、失效计划、回滚和 revision；
- `SpotContentService` 作为当前 `SpotService` 的内容子门面；
- UI 只通过 `GameCommands` / Runtime command port 发起单内容命令。

Definition core 不直接依赖 GameNum、Visibility、Affector 或 SpotService。

### 2.5 事件驱动局部失效

成功的 Registry 局部变更后发出一个 `spotDefinitionChanged` 事件。事件只携带逻辑身份、操作和结构变化摘要，Runtime 子系统从自身 Registry 查询最新定义：

~~~ts
{
  type: 'spotDefinitionChanged',
  spotId: string,
  operation: 'create' | 'replace' | 'delete' | 'suspend' | 'resume',
  previousAreaId?: string,
  nextAreaId?: string,
  previousYieldResource?: string,
  nextYieldResource?: string,
}
~~~

首阶段必须定向更新：

- Spot 主表、Area/Tag 索引；
- GameNum 的 Spot 子树与受影响父链；
- Visibility 的 Spot 索引和快照；
- 当前 Spot 服务查询结果；
- 基础 Spot 没有复杂功能时的 UI 视图。

热 CRUD 路径不得调用 `reloadPreservingState()`、`GameNumSystem.buildAll()` 或 `VisibilityEngine.rebuild()`。

### 2.6 PlayerState 与 Definition 生命周期分离

- create：不自动创建等级、经理或快照记录；
- replace：同 ID 默认保留所有 PlayerState；
- delete：默认 Retain；
- delete + purge：经明确命令后，由 `StateMutationService` 清理当前状态和 Init 快照；
- suspend：保留 source record 和 PlayerState；
- resume：只解除当前 EditingWorkspace 自己的阻断记录。

通用 Story cursor、Trigger once、Affector 实例的 Detach/Purge 仍延期到专门 Runtime 生命周期任务。

## 三、目标调用链

~~~text
Editor 当前 Spot Draft
        ↓
GameCommands.applyRuntimeSpotMutation(one item)
        ↓
RuntimeContentCoordinator.prepare
  - owner / Mod / revision 校验
  - 单 Spot candidate 校验
  - DefinitionChange / invalidationScopes
        ↓
Registry.commitSpotMutation
        ↓
GameNum / Visibility / Spot runtime 定向应用
        ↓
EventBus: spotDefinitionChanged
        ↓
RuntimeModState revision + UI refresh
~~~

准备失败时不得改动 Registry、RuntimeModState 或 PlayerState。提交后的派生更新必须是可回滚或不会抛出不可恢复错误的受控操作。

## 四、当前 Spot 服务接入

不修改 `unlockSpot()`、`upgradeSpot()` 的玩家行为语义。建议在 `SpotService` 下提供内容子门面：

~~~ts
game.spot.content.create(...)
game.spot.content.replace(...)
game.spot.content.delete(...)
game.spot.content.suspend(...)
game.spot.content.resume(...)
~~~

内容变更成功后，既有 `SpotService` 因为持续读取 Registry，会自动使用新定义；只有缓存型派生系统需要订阅 `spotDefinitionChanged`。

## 五、明确保留的旧路径

- 整个临时 Mod 的关闭/移除可以暂时保留整体恢复路径；
- 旧 `applyRuntimeMod()` 可以作为迁移期兼容入口；
- 不支持热修改的复杂 Spot 字段可以返回明确的 unsupported diagnostic，并回退到后续专门任务；
- 正式 PackManager、StoredPack 和 Datapack 导出不进入本 ADR。

## 六、后续施工任务

实现拆分见 [[task-0061-runtime-hot-content-crud-spot]]：

1. Registry 单 Spot mutation 与索引维护；
2. GameNum / Visibility 的局部更新；
3. RuntimeContentCoordinator、revision 和回滚；
4. SpotContentService 与 UI 单内容提交；
5. 旧整包应用路径的兼容清理。
