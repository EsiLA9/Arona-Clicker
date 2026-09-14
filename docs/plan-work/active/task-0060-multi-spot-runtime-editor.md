# Task-0060：单临时 Mod 的多 Spot 临时构建与编辑

**状态**：🟡 P1–P4 已实施；自动化验收通过，Edge 手工验收待补  
**日期**：2026-09-14  
**前置**：[[docs/plan-work/active/task-0055-runtime-datapack-editor-mvp]]、[[docs/plan-work/active/task-0056-workspace-datapack-boundary-convergence]]、[[docs/plan-work/active/task-0058-definition-resolution-p1a]]、[[docs/plan-work/active/task-0059-definition-resolution-p1b]]  
**关联任务**：[[docs/plan-work/active/task-0057-single-mod-editor-workbench]]  
**关联裁定**：[[docs/plan-work/active/adr-0010-definition-repository-editor-resolution]]、[[docs/plan-work/active/adr-0011-definition-resolution-withdrawal]]

## 一、任务定位

本 Task 将当前“单临时 Mod、单临时 Spot”的运行时编辑 MVP 扩展为“单临时 Mod、多个临时 Spot”的批量 Draft 编辑服务。

本任务只解决编辑服务的第一段扩展：在一个 EditingWorkspace 中同时创建、选择、修改、删除、暂时挂起和恢复多个 Spot，并将它们一次性物化为一个临时 Runtime Mod。它不提前实现完整的全表 Mod 编辑器，也不把通用 Def 撤回、Runtime 局部卸载或正式 Mod 持久化混入本任务。

目标操作链为：

```text
多个 Spot 的表单操作
        ↓
EditingWorkspace / Draft
        ↓
Definition Resolution 与诊断
        ↓
批量生成一个 RuntimeModDraft
        ↓
一次预览应用或安全回退
```

## 二、当前基线与问题

当前运行时编辑服务仍以单 Spot 为模型：

- `RuntimeDatapackEditorState` 持有一个 `spot` 草稿和一个选中区域；
- `toRuntimeModDraft()` 只能生成一个 Spot；
- `hydrateRuntimeEditor()` 只能恢复一个 Spot；
- 编辑器页面只有一个 Spot 表单和一组创建、更新、放弃、删除操作；
- Runtime 通过一个 `runtimeMod` 保存临时 Mod，并以 `applyRuntimeMod()` 生成临时 Datapack；
- 当前应用路径可以通过 `reloadPreservingState()` 整体恢复运行时状态，但还不是通用的 Def 级实时卸载机制；
- `removeRuntimeMod()` 的语义是移除整个临时 Mod，不能直接用来删除其中一个 Spot。

因此，本任务的关键不是复制多个单 Spot 服务，而是把编辑状态、Draft 物化和运行时应用粒度提升到“一个临时 Mod 内包含多个 Spot”。

## 三、范围与硬约束

### 3.1 本 Task 必须支持

- 一个编辑会话最多拥有一个目标临时 Mod；
- 一个临时 Mod 可以拥有多个临时 Spot；
- Spot 的新建、选择、修改、删除；
- Draft-only 的 Spot `suspend` 与当前 Workspace 自己拥有的 `resume`；
- 多个 Spot 在一次提交/预览中批量校验、批量物化和批量应用；
- Spot 级别的解析状态、引用错误和操作失败反馈；
- 应用失败时保留旧 Runtime 与当前 Draft；
- 尽量复用现有 Runtime Overlay 与状态恢复路径。

### 3.2 不在本 Task 内

- 同时编辑多个 Mod；
- 全表 Def 的新建与修改；
- 通用 Def 的 Runtime unload / hot swap；
- 直接对 Registry 做 Spot 级删除或绕过 Runtime 应用入口；
- PackManager / `StoredPack` 持久化；
- 正式 Datapack / ZIP 导出；
- Runtime 子系统完整的 Retain / Detach / Purge 生命周期；
- 旧存档迁移或兼容代码；
- 恢复已弃用的独立 `tools/datapack-editor/` 作为当前编辑器入口。

## 四、设计原则

### 4.1 一个 Workspace 对应一个临时 Mod

EditingWorkspace、Draft 和 Runtime Preview 必须保持清晰分层：

```text
EditingWorkspace
    ├─ Mod metadata
    ├─ Draft Spot records
    ├─ Tombstones
    └─ selection / diagnostics

Runtime Preview
    └─ 一个包含多个 Spot 的临时 Mod
```

Draft 负责编辑事实，Runtime Preview 负责运行时物化结果；UI selection 不得成为 Runtime 数据源。

### 4.2 Spot 的逻辑身份与来源分离

Spot 使用稳定的逻辑身份：

```ts
interface DefinitionKey {
  table: 'spots';
  id: string;
}
```

来源由 `DefinitionSourceRef` 表达。Draft source ID 必须稳定指向 EditingWorkspace / DraftLayer 的逻辑 ID，不能使用某次 UI 实例、对象地址或临时渲染节点 ID。

### 4.3 编辑先写 Draft，提交时批量应用

表单输入只更新 Draft，不逐字段触发 Runtime 更新。用户点击预览、应用或保存时，服务才执行：

```text
读取 Draft
    ↓
解析所有 Spot
    ↓
校验所有 Spot 与引用
    ↓
生成 candidate RuntimeModDraft
    ↓
应用整个临时 Mod
```

同一批次内多个 Spot 的修改必须合并为一次 Runtime 应用，避免因为输入框变化或单个 Spot 操作反复重载。

### 4.4 删除、挂起与整包移除不能混淆

- `delete-local`：删除当前 Draft 层自己拥有的 Spot source record，然后继续按来源链解析；
- `suspend`：新增当前 Draft 层拥有的 blocking record，不删除任何 source record，结果为 `suspended`；
- `resume`：只能移除当前 EditingWorkspace / DraftLayer 自己拥有的 Tombstone；
- `removeRuntimeMod()`：仍然只表示移除整个临时 Mod，不参与 Spot 级删除。

如果删除后需要阻止下层 Spot 回退，必须显式表达为 `delete-local + suspend` 的组合语义，不能让单纯的 `delete-local` 隐式变成阻断。

## 五、目标数据模型调整

### 5.1 RuntimeModDraft

将单数 Spot 调整为稳定有序的 Spot 集合，具体字段命名以现有 Runtime 合约为准：

```ts
interface RuntimeModDraft {
  modName: string;
  displayName?: string;
  spots: readonly RuntimeEditorSpotDraft[];
}
```

Spot 顺序必须可比较、可测试、可稳定物化。除非现有 Datapack 合同明确要求顺序，否则不得通过 UI 数组位置偷偷改变无关语义。

### 5.2 编辑器状态

编辑状态至少需要支持：

```ts
interface RuntimeDatapackEditorState {
  modName: string;
  displayName: string;
  spots: readonly RuntimeEditorSpotDraft[];
  selectedSpotId: string | null;
  applied: boolean;
  error?: string;
}
```

如果需要保存操作状态，应将其与 Spot 内容分开，避免把 `selectedSpotId`、展开状态或表单临时值序列化为 Definition 内容。

### 5.3 与 Definition Resolution 的衔接

本 Task 复用 P1A/P1B 已确定的语义：

- `resolved`、`suspended`、`missing`；
- `create`、`replace`、`delete-local`、`suspend`、`resume`；
- required / optional 引用策略；
- `DefinitionDiagnostic` 中的 source、reference、path、resolutionStatus 和 policy；
- `DefinitionDelta` 的 added / changed / removed 与 transition。

第一阶段只将这些能力用于 Spot Draft 和其直接引用，不扩展为所有 Runtime 子系统的失效规划器。

## 六、服务职责

建议按现有边界增加适配，而不是创建新的超级服务：

| 组件 | 本 Task 中的职责 |
| --- | --- |
| `RuntimeDatapackEditorState` | 持有多个 Spot、选中项和编辑器反馈 |
| Draft / EditingWorkspace adapter | 记录 Spot 的 create / replace / delete-local / suspend / resume |
| Definition Resolution adapter | 根据来源层解析 Spot 并产生状态与诊断 |
| Runtime Mod materializer | 将解析后的多个 Spot 生成一个 `RuntimeModDraft` |
| `Runtime` | 通过现有单临时 Mod 应用入口批量接收候选结果 |
| UI Renderer / Controller | 展示 Spot 列表、表单、状态和操作反馈 |

数据服务不得依赖 `src/ui/`；UI 不得直接写 Runtime Registry。

## 七、运行时应用策略

### 7.1 首版保留整体恢复后端

首版不实现 Spot 级 Runtime unload。批量应用使用当前安全路径：

```text
旧 Runtime Preview
        ↓
构建包含所有当前 Spot 的新 candidate
        ↓
校验通过
        ↓
reloadPreservingState()
        ↓
成功后替换 runtimeMod
```

这表示“减少重载”首先通过减少应用次数实现，而不是强行把所有变更伪装成增量更新：一次编辑提交对应一次整包应用；没有提交的输入不触发重载。

### 7.2 原子失败行为

candidate 必须先构建和校验，成功应用后才能替换当前 Runtime 记录。如果构建、校验或重载失败：

- 旧 Runtime Preview 保持不变；
- 当前 EditingWorkspace / Draft 保持不变；
- 不写入正式 PackManager；
- UI 展示可定位的 Spot 或引用诊断；
- 不产生半应用的临时 Mod。

### 7.3 Spot 删除的运行时行为

删除单个 Spot 时，必须以“剩余 Spot 集合”重新生成同一个临时 Mod 并应用，不能调用整个 Mod 的移除接口。

第一阶段默认保守保留 PlayerState。Spot 相关历史数据是否 Detach 或 Purge，另列 Runtime 生命周期任务裁定。

## 八、编辑器交互

编辑器由单个 Spot 表单扩展为列表 + 当前项表单：

```text
Spot 列表
    ├─ Spot A：新建 / 已修改 / 已挂起
    ├─ Spot B：已修改
    └─ Spot C：继承来源 / 缺失

当前选中的 Spot 表单
```

必须提供：

- 新建 Spot；
- 选择 Spot；
- 修改 Spot；
- 删除当前 Draft 所拥有的 Spot；
- 暂停与恢复当前 Spot；
- 显示 resolved / suspended / missing；
- 显示 required / optional 引用诊断；
- 丢弃当前编辑或整个 Draft；
- 批量预览/应用全部修改。

已有游戏内 Spot 入口只负责定位并选中对应的逻辑 Spot ID，不得为每个入口创建重复的临时 Mod 状态。

## 九、施工切片

### P0：任务基线与模型裁定

- [x] 确认单临时 Mod、多临时 Spot 的范围；
- [x] 确认 Draft source ID 与 Workspace 生命周期；
- [x] 确认 Spot ID、顺序和空集合语义；
- [x] 为现有单 Spot 行为补充迁移前后的回归测试；
- [x] 不修改既有 ADR-0011 的核心语义。

### P1：多 Spot 编辑状态与 Runtime 合约

- [x] 将单数 Spot 状态改为集合与 `selectedSpotId`；
- [x] 将 `RuntimeModDraft` 物化结果改为多个 Spot；
- [x] 更新 hydrate / serialize / clear / dirty 状态处理；
- [x] 保证单 Mod 限制继续生效；
- [x] 覆盖空集合、单项集合和多项集合。

### P2：Draft 与 Resolution 适配

- [x] 为 Spot 实现 create / replace / delete-local；
- [x] 接入 Draft-only suspend / resume；
- [x] 按 Draft source layer 返回 resolved / suspended / missing；
- [x] Spot 物化前经过 Definition Resolution；
- [x] 保证 Draft 操作不修改背景 Pack source record。

### P3：批量物化与运行时应用

- [x] 将所有有效 Spot 物化为一个 candidate Runtime Mod；
- [x] 一次批量校验所有 Spot 与直接引用；
- [x] 一次性应用 candidate，不按字段或 Spot 逐项重载；
- [x] candidate 校验失败时保留旧 Runtime 与 Draft；
- [x] 删除单个 Spot 时不调用整个 Mod 移除接口。

### P4：多 Spot UI

- [x] 将单表单扩展为 Spot 列表 + 当前 Spot 表单；
- [x] 接入新建、选择、修改、删除、挂起、恢复；
- [x] 显示解析状态、诊断和应用结果；
- [x] 游戏内已有入口能够定位到指定 Spot；
- [x] 草稿操作只重建当前编辑器弹窗，应用后再刷新运行时页面。

### P5：验收与性能基线

- [x] 覆盖单 Spot 兼容行为；
- [x] 覆盖多个 Spot 的新建、修改、删除、挂起、恢复；
- [x] 覆盖同一批次混合成功和失败校验；
- [x] 覆盖 candidate 校验失败后的旧 Runtime 保留；
- [x] 覆盖 PlayerState 保留与单 Spot 清理；
- [x] 记录一次批量应用与连续输入时的重载次数；
- [x] `npx tsc --noEmit`、`npm run check:architecture`、`npm test` 通过；
- [ ] 在 Edge 中完成编辑、预览、取消、重新进入和多 Spot 选择验收。

## 十一、实施记录（2026-09-14）

已完成的代码接线：

- `RuntimeModDraft.spots` 替代单数 `spot`，可在一个临时 Mod 中承载多个 Spot；
- `RuntimeDatapackEditorState` 使用 `spots`、`selectedSpotId` 和 `suspendedSpotIds` 管理编辑会话；
- Spot 草稿先保存到当前 Workspace，点击“应用全部 Spot”才调用 Runtime；
- 编辑器 Draft 映射为稳定 owner 的 Definition source layer；挂起/恢复分别使用 `suspendDefinition()` / `resumeDefinition()`；
- Runtime 仍通过一次 `reloadPreservingState()` 批量应用整个临时 Mod；
- 单 Spot 删除会以剩余 Spot 重新应用临时 Mod，不调用 `removeRuntimeMod()`；
- PlayerData 默认保留，显式清理只针对被删除的 Spot；
- UI 已增加 Spot 列表、选择、新建、编辑、删除、挂起、恢复和批量应用入口。
- 新建与编辑统一执行 Spot ID 唯一性校验；重复 ID 报错后可直接修正并继续保存。

自动化验证结果：

- 多 Spot 编辑器状态测试：7 项通过；
- Runtime 多 Spot 与挂起/恢复测试：8 项通过；
- 顶栏多 Spot 编辑、批量应用和单 Spot 删除测试：6 项通过；
- 全量测试：151 个测试文件、1426 个测试通过；
- `npx tsc --noEmit` 通过；
- `npm run check:architecture` 通过；
- `git diff --check` 通过（仅保留既有换行格式提示）。

当前保留的边界：

- Runtime 尚未实现通用 Def 级卸载；
- 背景 Pack 的完整 provenance / 跨层引用图尚未接入当前 Spot MVP；
- Tombstone 尚未进入 PackManager 或正式 Datapack 导出；
- Edge 手工验收待补。

## 十二、验收标准

### 数据与边界

- [x] 一个 EditingWorkspace 只有一个临时 Mod；
- [x] 一个临时 Mod 可以包含多个 Spot；
- [x] Spot 逻辑身份不携带层作用域；
- [x] Draft、Runtime Preview、背景来源彼此可区分；
- [x] UI 不直接 mutation Registry；
- [x] 背景 Pack 不因 Draft 操作被修改。

### 行为

- [x] 可以连续创建并编辑多个 Spot；
- [x] 一个 Spot 的修改不会丢失其他 Spot；
- [x] 单个 Spot 删除不会移除整个临时 Mod；
- [x] `suspend` 不删除任何 source record；
- [x] `resume` 不能移除其他来源拥有的 Tombstone；
- [x] 多 Spot 修改可以一次提交并一次应用；
- [x] 没有提交时，输入变化不会触发 Runtime 重载；
- [x] candidate 失败时旧 Runtime、Draft 和 PlayerState 保持可用；
- [x] 缺失、悬置和引用错误能够区分显示。

### 非目标约束

- [x] 不引入多 Mod 编辑；
- [x] 不实现通用 Def 实时退出；
- [x] 不写入 PackManager；
- [x] 不实现正式导出；
- [x] 不添加存档迁移代码；
- [x] 没有增量失效证据时允许回退到整体 `reloadPreservingState()`。

## 十三、停止条件与后续拆分

出现以下情况时，应停止继续扩展 UI，先另建 ADR 或后续 Task：

- 需要改变 `resolved / suspended / missing` 的语义；
- 需要改变 `delete-local / suspend / resume` 的回退规则；
- 需要把 Tombstone 写入正式 Datapack 或 PackManager；
- 需要实现通用 Def Runtime unload；
- 需要决定 Story、Trigger、Affector 等 PlayerState 的 Detach / Purge 顺序；
- 需要支持多个目标 Mod；
- 需要把整体 reload 替换为跨多个 Runtime 子系统的增量失效协议。

上述内容不应通过继续扩大本 Task 的正文来吸收，应按文档范围拆分纪律创建新的 ADR 或 Task。

## 十四、相关代码与文档

- [[docs/plan-work/active/task-0055-runtime-datapack-editor-mvp]]：单 Mod / 单临时 Spot Runtime 编辑基线；
- [[docs/plan-work/active/task-0057-single-mod-editor-workbench]]：单 Mod 全内容编辑工作台的长期目标；
- [[docs/plan-work/active/task-0058-definition-resolution-p1a]]：来源解析、Tombstone、三态结果与 Delta；
- [[docs/plan-work/active/task-0059-definition-resolution-p1b]]：引用策略、诊断与 DefinitionChange 消费；
- [[docs/plan-work/active/adr-0010-definition-repository-editor-resolution]]：Editor 来源解析与 Runtime Registry 边界；
- [[docs/plan-work/active/adr-0011-definition-resolution-withdrawal]]：撤回、悬置和 Draft-only Tombstone 语义；
- [[docs/docs-828/05-conventions/architecture-discipline]]：状态写入、UI 只读和数据服务依赖纪律；
- [[docs/docs-828/05-conventions/schema-sync]]：实体字段与编辑器 Schema 同步协议；
- [[docs/docs-828/05-conventions/testing]]：测试与验收纪律。

当前实现基线代码：

- `src/ui/workspace/runtime-datapack-editor-state.ts`；
- `src/ui/components/runtime-datapack-editor.ts`；
- `src/arona-clicker/contracts/runtime.ts`；
- `src/arona-clicker/runtime.ts`。
