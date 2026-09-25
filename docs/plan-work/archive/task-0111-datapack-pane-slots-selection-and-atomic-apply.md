# Task：数据包 Pane 槽位、选择态与原子 Apply

状态：done — 2026-09-19 已完成实现、自动化核验与浏览器交互验收

## 与前置任务的关系

本 Task 是 `task-0110-datapack-editing-state-and-targeted-authoring` 的后续模型收敛任务。

`task-0110` 已建立普通态 / 编辑态 Catalog 记录、编辑态目标包写入、导出回流和基础冲突拦截。本 Task 不再继续向现有“平铺数据包列表 + 编辑态例外”模型增加条件，而是把数据包记录、Pane 聚合、管理页选择和 Runtime 实际状态拆成明确的层。

## 目标

建立可长期复用的数据包管理模型：

1. 每个 `(ModId, VersionId)` 形成一个管理 Pane；Pane 只是 UI / 领域聚合投影，不是存储中的数据包实体。
2. Pane 内最多包含一个 fixed 数据包槽位和一个 editing 数据包槽位；两者是独立的 `DatapackRecord`。
3. 普通态 / 编辑态允许共享 `(ModId, VersionId)`，其完整记录身份由 `(ModId, VersionId, Kind)` 唯一确定。
4. 将已保存数据、管理页待 Apply 选择、Runtime 上一次成功加载的状态完全分离。
5. 将版本变化统一建模为从明确 source Fork 出新的 editing 数据包，不再存在“修改现有 VersionId”的领域动作。
6. 将 Runtime Apply 收敛为解析、校验、构建计划、原子提交的全局操作。
7. 为未来的文件夹型数据、ZIP、浏览器文件系统或远程仓库复用导入 / 导出 / 复制服务接口，而不让文件服务依赖 Pane、Selection 或 Runtime。

## 设计模型

### 1. DatapackRecord：底层独立记录

底层继续存储独立数据包记录，而不是把两个槽位存成一条“双态数据包”：

```ts
interface DatapackRecord {
  readonly packRecordId: string;
  readonly modId: string;
  readonly versionId: string;
  readonly kind: 'fixed' | 'editing';
  readonly content: DatapackContent;
  readonly sourcePackRecordId?: string;
  readonly sourceDigest?: string;
  readonly contentDigest: string;
}
```

领域层使用 `fixed / editing` 表达实体的可变性约束；UI 仍可显示“普通态 / 编辑态”。现有 `editingMode: normal | editing` 可以在存储适配层映射，但不能继续承担 Pane、Selection 或 Runtime 状态的语义。

唯一约束：

```text
UNIQUE(ModId, VersionId, Kind)
```

因此同一 `(ModId, VersionId)` 下同时存在一个 fixed 与一个 editing 是正常状态，不应被实现成“先报身份冲突、再为 editing 特判放行”。

`ModId` 创建后始终不可修改。需要新的身份时只能创建新的记录；`VersionId` 的变化也只能产生新记录，不能修改既有记录的身份。

### 2. DatapackPane：身份分组与 UI 投影

```ts
interface DatapackPane {
  readonly identity: {
    readonly modId: string;
    readonly versionId: string;
  };
  readonly fixedSlot?: DatapackRecord;
  readonly editingSlot?: DatapackRecord;
}
```

Pane 按 `(ModId, VersionId)` 聚合 Catalog 记录。它不是可直接保存的“第三种数据包”，也不拥有内容副本。

一个 Pane 可以缺少任一槽位，但缺失槽位不可被选择，只显示可用的创建、导入或导出动作。UI 不使用“仅普通态 / 仅编辑态”作为领域状态名。

### 3. Selection State：管理页待 Apply 选择

选择态独立于数据包记录和 Runtime：

```ts
type SlotKind = 'fixed' | 'editing';

interface DatapackSelection {
  readonly paneKey: string;
  readonly selectedSlot: SlotKind | 'none';
}
```

选择态要求：

- 只允许选择已经存在的槽位；
- 创建或导入新槽位后不自动改变当前选择；
- 每个 Pane 的最后选择持久化，重新打开应用时恢复；
- 选择改变不会复制、覆盖、保存内容，也不会立即改变 Runtime；
- 当用户修改多个 Pane 的选择时，下一次 Apply 统一提交全部选择。

`selectedPackId` 之类的 UI 当前查看项不能代替 Selection State；“查看哪个条目”和“下次 Runtime 使用哪个槽位”是不同状态。

### 4. Runtime State：上一次成功 Apply 的结果

Runtime 只记录最后一次成功应用的记录集合：

```ts
interface RuntimeDatapackSet {
  readonly panes: ReadonlyMap<string, string>; // paneKey -> packRecordId
}
```

允许出现如下合法中间状态：

```text
Storage  : fixed=A, editing=E
Selection: editing
Runtime  : fixed
```

这表示用户已经选择下一次使用编辑态，但尚未 Apply；Runtime 仍使用上一次成功加载的普通态。

## 生命周期原语

领域服务只暴露少量稳定原语，不为每种 UI 文案增加独立业务动作。

### `createEmptyEditing(identity)`

创建指定 `(ModId, VersionId)` 的空 editing 记录，立即持久化，但不改变 Selection 或 Runtime。

约束：

- 适用于没有 fixed 槽位的 Pane / 新建身份；
- 已有 fixed 槽位时，不允许在相同身份下创建空 editing；此时必须从 fixed 复制；
- `ModId` 在创建后不可修改；
- `(ModId, VersionId, editing)` 已存在时拒绝创建。

### `cloneAsEditing(sourceId, targetIdentity)`

从明确 source 完整复制内容与资源，创建新的 editing 记录；source 身份和内容永远不变。

使用场景：

```text
fixed 1.0  → cloneAsEditing → editing 1.0
fixed 1.0  → cloneAsEditing → editing 1.1
editing 1.0 → cloneAsEditing → editing 1.1
```

默认 source 规则：

- Pane 只有 fixed 时，默认 source 为 fixed；
- Pane 同时有 fixed 与 editing 时，默认 source 为 editing；
- 用户可在需要时明确指定 source；
- 新 `VersionId` 只产生新的 editing Pane 槽位，不复制 fixed 槽位。

### `importFixed(package)`

所有外部导入都登记为 fixed，不携带 editing 标记。

- `(ModId, VersionId, fixed)` 不存在：插入 fixed 槽位；
- 同一 fixed 三元组内容摘要相同：幂等；
- 同一 fixed 三元组内容摘要不同：直接拒绝，不覆盖；
- 同身份 editing 已存在不构成数据层冲突，UI 可以提示“填充普通态槽位”，但不做内容 merge。

### `export(recordId, options)`

fixed 与 editing 都可以单独导出；导出文件一律是普通态文件，不写入本地 `Kind` 标记。

- 导出 fixed：导出 fixed 当前内容；
- 导出 editing：导出 editing 当前内容，但重新导入后仍登记为 fixed；
- 导出选项可以修改导出文件的 `VersionId`；
- 导出不会修改本地记录身份或内容；
- “新版本”领域动作统一落到 `cloneAsEditing(sourceId, targetIdentity)`，不能实现为修改本地 `VersionId`。

## Runtime Apply

管理页先从所有 Pane 的 Selection State 解析出完整计划：

```ts
interface RuntimeApplyPlanEntry {
  readonly paneKey: string;
  readonly selectedSlot: SlotKind;
  readonly packRecordId: string;
  readonly modId: string;
  readonly versionId: string;
}

interface RuntimeApplyPlan {
  readonly entries: readonly RuntimeApplyPlanEntry[];
}
```

Apply 流程固定为：

```text
读取所有 Pane 的 Selection
  → 确认每个选择都指向已存在记录
  → 校验依赖、内容和 Runtime ModId 唯一性
  → 构建完整 RuntimeApplyPlan
  → 原子加载整个计划
  → 成功后更新 RuntimeState
```

失败时：

- 不更新旧 Runtime；
- 不部分加载；
- 不修改 Selection；
- 不删除或改写任何数据包记录；
- 返回结构化诊断，指出冲突 Pane、记录和原因。

同一 `ModId` 的不同 `VersionId` 可以存储为历史 / 候选记录，但同一次 Runtime Apply 中只能有一个来源。fixed 与 editing 也不能同时作为相同 `ModId` 的 Runtime 来源。

## 编辑器边界

普通态不进入可写编辑器。可写编辑器入口直接要求：

```ts
EditorSession.open(editingPackRecordId)
```

服务层在创建 Session 时验证目标记录确实为 editing；UI 不能先打开任意数据包，再在内部判断是否只读。

如未来需要查看 fixed，可另设只读 Viewer / Snapshot Viewer，但任何写入 API 都必须携带 editing `packRecordId`。

编辑器保存与 Runtime Apply 分离：

- 保存：写回 editing 记录的 Storage；
- Apply：将已保存内容纳入 RuntimeApplyPlan 并加载；
- Saved but not Applied 是合法状态，不代表数据丢失；
- 未保存的 dirty editor session 在返回管理页时直接丢弃，不自动保存或保留草稿。

## 删除 Guard

删除统一经过领域 Guard，不由多个 UI 条件分别实现：

```ts
canDelete(packRecordId):
  if RuntimeState references packRecordId → deny
  if editor session has unsaved changes for packRecordId → deny / require explicit discard
  otherwise → allow
```

已保存但尚未 Apply 的记录可以删除，因为 Storage 已经是最新内容，Runtime 仍然是旧内容并不会产生未保存数据丢失。

删除 fixed 或 editing 只影响对应记录；另一槽位保留，Pane 的缺失槽位仍可重新填充或创建。内置包、依赖约束和其他现有不可删除护栏继续有效。

## 文件服务边界

文件服务不得感知 Pane、Selection、Runtime 或 UI：

```ts
interface DatapackRepository {
  create(record: DatapackRecord): void;
  read(packRecordId: string): DatapackRecord | undefined;
  delete(packRecordId: string): void;
  exists(identity: DatapackIdentity): boolean;
  enumerate(): readonly DatapackRecord[];
}

interface DatapackCopyService {
  copy(sourceId: string, destination: DatapackIdentity): DatapackRecord;
}

interface DatapackImportService {
  inspect(source: PackageSource): PackageInspection;
  validate(source: PackageSource): PackageDiagnostic[];
  importFixed(source: PackageSource): DatapackRecord;
}

interface DatapackExportService {
  export(sourceId: string, destination: PackageDestination, options?: ExportOptions): void;
}
```

`PackageSource / PackageDestination / PackageManifest / PackageContent` 是文件层概念。未来接入文件夹、ZIP、File System Access API、IndexedDB 或远程仓库时，上层 Pane 与 Runtime 模型不应改变。

## 冲突与诊断

建议保留结构化错误，而不是让 UI 解析字符串：

```ts
type DatapackConflictCode =
  | 'target-datapack-required'
  | 'target-must-be-editing'
  | 'datapack-record-conflict'
  | 'modid-runtime-conflict'
  | 'source-not-found'
  | 'stale-source'
  | 'runtime-plan-invalid'
  | 'runtime-apply-failed'
  | 'datapack-in-use'
  | 'editor-dirty';
```

提示采用“状态徽标 + 阻止原因 + 下一步动作”：

- 不自动改名；
- 不自动删除；
- 不自动覆盖；
- 不自动结束 Runtime Overlay；
- 不自动把 fixed 转成 editing；
- 打开已有记录时明确展示 `packRecordId` 与完整三元组。

## 当前事实与代码落点

`task-0110` 已完成的基础能力：

- `src/data-services/datapack/pack-manager.ts` 已有 `packRecordId`、`editingMode`、来源记录、内容摘要、完整复制、三元组保存拦截和编辑态不可直接进入启用集；
- `src/arona-clicker/runtime.ts` 已有普通态导入、编辑态复制、编辑态打开和编辑态保存入口；
- `src/ui/components/service-workspace.ts` 已提供平铺数据包列表中的“复制为编辑态 / 打开编辑器”；
- `src/ui/runtime-editor/` 已将编辑目标传递到 Init / Area / Spot / Enhancement 的编辑命令；
- 未接入的 Datapack 顶层表在编辑态保存时保留；编辑态导出重新导入为普通态。

本 Task 实施结果：

- Catalog 以 `DatapackPane` 投影聚合 fixed / editing 槽位，查看项与待 Apply 选择分离；
- Selection State 按 Pane 持久化，槽位点击只改变下次 Apply 选择，不立即重载 Runtime；
- `RuntimeApplyPlan` 在全局校验后一次性提交，失败保持旧 Runtime、Selection 与记录不变；
- `createEmptyEditing`、`cloneAsEditing`、`importFixed`、`export` 与删除 Guard 已落在数据服务边界；
- 可写 Runtime Editor 入口与所有新建 / 修改命令均要求 editing `packRecordId`，普通态只提供查看面。

## 施工切片

### P0：领域身份与 Pane Projection

- [x] 固定 `DatapackRecord`、`DatapackIdentity`、`PaneIdentity`、`SlotKind` 的类型和边界。
- [x] 将 `(ModId, VersionId, Kind)` 作为 Catalog 唯一键；允许同身份 fixed + editing 正常并存。
- [x] 增加从 Catalog 记录生成 Pane 的只读 projection，不在 Pane 内复制内容。
- [x] 固定空槽位、已有槽位、创建入口和 UI 标签语义。
- [x] 明确 `ModId` 不可修改，所有版本变化均为新记录 Fork。

### P1：生命周期原语与文件服务

- [x] 实现 `createEmptyEditing`、`cloneAsEditing`、`importFixed`、`export` 的领域接口。
- [x] 统一 fixed → editing、fixed → new-version editing、editing → new-version editing 的 source 选择规则。
- [x] 导入同身份 editing 时只填充 fixed 槽位，不实现内容 merge；内容不同的 fixed 重复导入直接拒绝。
- [x] 将 ZIP / 文件夹解析、复制、导入、导出拆到不依赖 Pane 与 Runtime 的服务边界。
- [x] 为 Version Fork、同摘要幂等、不同摘要拒绝和 ModId 不可变补测试。

### P2：Selection State 持久化

- [x] 建立按 Pane identity 保存的 `DatapackSelection`。
- [x] 区分“当前查看项”和“待 Apply 选择”。
- [x] 只允许选择已存在槽位；新建 / 导入后不自动改选中态。
- [x] 启动时恢复上次选择；槽位消失时返回可诊断的待处理状态，不静默选择其他槽位。
- [x] 验证选择状态保存、恢复和数据包删除 Guard 的交互。

### P3：RuntimeApplyPlan 与原子 Apply

- [x] 从全部 Pane Selection 解析完整 `RuntimeApplyPlan`。
- [x] 在加载前统一校验依赖、内容和 ModId 唯一性。
- [x] 将 Runtime Apply 改为全局、显式、原子提交；失败保持旧 Runtime 记录状态不变。
- [x] 将 RuntimeState 与 Storage、Selection 独立保存和读取。
- [x] 覆盖 fixed / editing 切换、多 Pane 同时修改、Apply 失败回滚和同 ModId 多版本冲突测试。

### P4：编辑器与删除边界

- [x] 让现有 writable Runtime Editor 的写入目标只接受 editing `packRecordId`。
- [x] 普通态不接受可写编辑目标；只保留包记录查看面。
- [x] 删除经过 Runtime 引用 Guard；UI 删除经过 dirty editor Guard。
- [x] 验证 Saved-but-not-Applied 可以删除，Dirty session 删除被拒绝。
- [x] 删除一侧后 Pane 投影仍保留另一侧及缺失槽位。

### P5：UI 收敛与验收

- [x] 将管理列表改为按 `(ModId, VersionId)` 展示 Pane 与两个槽位。
- [x] 展示 fixed / editing / Selected / Runtime 状态的独立标记。
- [x] 保留“从 fixed 复制”并提供数据层空 editing、导入 fixed、导出、Fork 新版本原语。
- [x] 确保槽位选择等待全局 Apply，不因点击槽位立即修改 Runtime。
- [x] 完成浏览器级交互、ZIP 回流、冲突提示和多 Pane Apply 验收。

## 非目标

- 不实现普通态与编辑态的三方内容 merge、Diff 或自动冲突解决；
- 不让 Pane 成为新的持久化数据包实体；
- 不把 Selection State 写进 `DatapackRecord`；
- 不把 RuntimeState 等同于已保存数据或管理页当前选择；
- 不允许 UI 通过最近一次目标、全局编辑态或浮窗上下文隐式决定写入包；
- 不修改标准 Datapack manifest 以携带本地 `Kind`；
- 不为旧存档或旧 Catalog 结构编写迁移兼容代码，结构破坏按项目存储约定处理。

## 测试与验收

### 单元 / 服务测试

- `(ModId, VersionId, fixed)` 与 `(ModId, VersionId, editing)` 可并存；同 Kind 重复被拒绝；
- Fixed 永远不能作为 writable target；
- `cloneAsEditing` 不改变 source，且深复制内容与资源；
- Fork 新版本只产生 editing 记录，不复制 fixed；
- `importFixed` 对同摘要幂等、不同摘要拒绝；
- Selection 创建、持久化、恢复和空槽位不可选择；
- 删除 Guard 正确区分 Runtime 引用、dirty session 和 saved-but-not-applied；
- RuntimeApplyPlan 遇到任一冲突时保持旧 Runtime 全部不变。

### UI / 浏览器验收

1. 导入普通 ZIP 后显示对应 Pane 的 fixed 槽位。
2. 从 fixed 创建 editing 后，Pane 出现两个独立槽位，内容初始一致但后续互不覆盖。
3. 创建空 editing 不自动改变当前选择。
4. 在多个 Pane 切换选择，Runtime 在 Apply 前保持不变，Apply 后一次性切换全部目标。
5. 导出 editing 后重新导入，形成 fixed 槽位，不覆盖本地 editing。
6. 同 fixed 三元组导入不同内容时直接拒绝。
7. Runtime 当前使用的记录不可删除；saved-but-not-applied 记录可删除；dirty session 删除被阻止。
8. 普通态不能进入可写编辑器，新建内容必须指定 editing `packRecordId`。

### 推荐核验顺序

```text
npx tsc --noEmit
npm test -- --run
npm run check:architecture
npm run check:docs
npm run build
浏览器交互验收 + ZIP 回流验收
```

## 当前核验

- `npx tsc --noEmit`：通过。
- 定向测试：`tests/data/pack-manager.test.ts`、`tests/data/pack-editing-state.test.ts`、`tests/data/pack-pane-selection.test.ts`、`tests/ui/datapack-workspace-state.test.ts`、`tests/ui/service-workspace.test.ts`：通过。
- 已新增 `tests/data/pack-pane-selection.test.ts`，覆盖 Pane 投影、空 editing、Version Fork、Selection 持久化、Runtime 状态分离、Apply 失败/回滚和 ModId 冲突。
- 全量 Vitest：178 个测试文件、1,639 项通过。
- `npm run check:architecture`、`npm run check:docs`、`npm run build`、`git diff --check`：通过。
- 真实浏览器已验证 Pane 双槽位、选择态与 Runtime 状态分离、编辑态全局 Apply；ZIP 回流由导出 / 归档 / 解析测试覆盖。

## 后续

本 Task 无剩余施工项。更多 Datapack 顶层表的专用编辑器仍是明确的后续扩展，不改变当前 Pane、槽位、Selection 与 Runtime Apply 边界。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/01-architecture/design-constraints]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[docs/docs-828/05-conventions/testing]] · [[task-0110-datapack-editing-state-and-targeted-authoring]] · [[task-0106-runtime-editor-draft-persistence]] · [[task-0107-runtime-editor-pack-export-service]]
