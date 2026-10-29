# Task：数据包编辑态转换、指定包编辑与 ModId 冲突收敛

状态：done — 2026-09-19 已完成实现、自动化核验与浏览器交互验收

## 合并范围

本 Task 合并并取代：

- `task-0108-runtime-editor-export-import-modid-handoff`：导出回流、包身份与 Runtime 交接；
- `task-0109-runtime-editor-multi-datapack-authoring`：普通态 / 编辑态数据包与编辑副本工作流。

后续不再把 Runtime Editor 的编辑态、数据包复制和导入冲突拆成相互独立的两套模型。

## 最终目标

### 1. 普通态数据包可以复制转换为编辑态

读入 ZIP / 文件夹后，系统先登记一个普通态数据包。用户选择“切换为编辑态”时：

```text
普通态数据包
  → 完整复制内容与资源
  → 创建新的编辑态数据包记录
  → 记录 sourcePackRecordId / sourceDigest
  → 打开编辑工作区
```

普通态原包保持不变。编辑态数据包是独立副本，保存、预览、导出和后续修改都作用于编辑态记录。

### 2. 所有编辑态数据包都可以进入编辑

“编辑态”不是当前仅支持 Spot 的临时 UI 槽位，而是数据包级别的内容编辑状态。包库中的每一条编辑态记录都可以通过自己的 `packRecordId` 打开同一编辑工作区；当前工作区已接入 Init、Area、Spot、Enhancement 四类内容，新增内容和 Apply 都以当前编辑态记录为目标。

编辑器尚未覆盖的 Datapack 顶层表不会在保存时被清空：编辑态复制保留完整 Datapack 与图片，保存时只替换已接入的内容表，其余表原样保留。未来的个性化布置文件等服务可以复用 `PackCatalogRecord` 的只读内容面与 `savePack` 的记录边界继续扩展，而不再重新引入全局编辑态。

编辑器内部的 `packRecordId`、来源关系、摘要和审计时间属于系统元数据，不等于用户内容字段。

### 3. 新建数据时必须指定目标数据包

所有新建 Definition / 内容数据的命令都必须携带明确的目标编辑态数据包：

```ts
createInit({ targetPackRecordId, input });
createArea({ targetPackRecordId, input });
createSpot({ targetPackRecordId, input });
```

禁止从全局 Runtime Editor、当前浮窗、最近一次选择或隐含默认值推断目标 ModId。目标缺失、目标为普通态或目标记录已失效时，命令直接返回结构化错误，不创建半成品数据。

## 身份、状态与冲突规则

### 数据包身份

| 层级 | 定义 | 用途 |
| --- | --- | --- |
| `ModId` | 数据包命名空间，例如 `demo-mod` | 实体 ID 第一段、Runtime Registry 命名空间 |
| `VersionId` | 数据包版本，例如 `1.0.0` | 版本记录、导出 manifest 和回流识别 |
| `packId` | `ModId + VersionId` 的逻辑身份 | 普通态与编辑态之间的来源和回流关系 |
| `EditingMode` | `normal` / `editing` | 本地 Catalog 生命周期状态，不写入标准 ZIP |
| `packRecordId` | 本地 Catalog 记录的内部唯一身份 | 区分普通态、编辑态和未来副本 |

建议的记录合同：

```ts
interface DatapackRecord {
  readonly packRecordId: string;
  readonly modId: string;
  readonly versionId: string;
  readonly editingMode: 'normal' | 'editing';
  readonly sourcePackRecordId?: string;
  readonly sourceDigest?: string;
  readonly content: DatapackContent;
}
```

`normal / editing` 是本地数据包记录状态，不是标准 Datapack 文件格式字段。导入任何外部文件都生成 `normal` 记录；编辑态导出为 ZIP 后再次导入，也重新生成 `normal` 记录。

### 两层冲突规则

#### A. Runtime / 启用集合：ModId 不可碰撞

编辑态数据包和普通态数据包都是数据包。任何进入同一 Runtime / 启用集合 / 预览应用目标的包集合，都必须满足：

```text
同一集合内，ModId 不可重复
```

因此：

- 同一个 `ModId` 的普通态和编辑态不能同时作为 Runtime 来源；
- 同一个 `ModId` 的不同版本不能同时进入启用集；
- 未启用、未 Apply 的 Catalog 记录可以并存，但进入 Runtime 前必须再次校验；
- 关闭浮窗、保存编辑态或仅选择记录，不会释放也不会占用 Runtime 命名空间；占用以活动 Overlay / 启用集为准。

#### B. Catalog 保存：三元组不可重复

保存数据包记录时，以下三元组必须唯一：

```text
(ModId, VersionId, EditingMode)
```

因此：

- 同一三元组已存在：阻止保存，不覆盖旧记录；
- 同一 `ModId + VersionId` 的 `normal` 与 `editing`：可以作为两条 Catalog 记录并存，但不能同时进入 Runtime；
- 同一 `ModId` 的不同 `VersionId`：可以作为历史 / 候选记录保存，但启用或 Apply 时仍执行 ModId 冲突检查；
- `packRecordId` 只负责内部记录区分，不能绕过三元组唯一性。

## 简单冲突提醒模式

不设计复杂的冲突合并器，统一使用“状态徽标 + 保存拦截 + 下一步动作”三段式提醒。

### 状态徽标

在数据包列表、详情页、编辑器顶部显示：

```text
普通态 · ModId demo-mod · Version 1.0.0
编辑态 · ModId demo-mod · Version 1.0.0
Runtime 冲突：demo-mod 已被另一个数据包占用
保存冲突：该 ModId / Version / EditingMode 已存在
```

### 冲突类型

| 代码 | 触发时机 | 提醒 | 可执行动作 |
| --- | --- | --- | --- |
| `target-datapack-required` | 新建数据未指定目标包 | 必须先选择一个编辑态数据包 | 返回目标包选择器 |
| `target-must-be-editing` | 目标包为普通态 | 普通态不可直接写入 | 创建 / 选择编辑态 |
| `modid-runtime-conflict` | Runtime 集合中出现重复 ModId | 两个数据包不能同时运行 | 移除目标 / 结束 Overlay / 取消 |
| `datapack-record-conflict` | 保存三元组已存在 | 不会覆盖已有数据包 | 打开已有记录 / 修改 VersionId / 取消 |
| `stale-source` | 编辑态来源摘要变化 | 当前编辑副本基线已变化 | 保留编辑态、重新确认或取消 |

提醒不自动改名、不自动删包、不自动替换、不自动结束编辑态。用户选择“打开已有记录”时，必须明确显示目标 `packRecordId` 和三元组。

## 关键交互

### 导入

```text
读入 ZIP / 文件夹
  → 解析与校验
  → 生成 normal 数据包记录
  → 若同一 normal 三元组同摘要：幂等提示
  → 若同一 normal 三元组不同摘要：阻止覆盖
  → 保持未启用，不改变当前 Runtime
```

### 切换为编辑态

```text
选择 normal 数据包
  → 点击“切换为编辑态”
  → 复制完整内容与资源
  → 创建 editing 数据包记录
  → 若 editing 三元组已存在：提示打开已有记录 / 修改 VersionId / 取消
  → 进入编辑工作区
```

### 新建数据

```text
点击“新建 Init / Area / Spot / Enhancement”
  → 必须选择目标 editing packRecordId
  → 校验目标仍存在且 editingMode = editing
  → 在目标 ModId 下创建数据
  → 保存并更新该编辑态数据包
```

### 编辑态应用与结束

```text
编辑态数据包 Apply
  → 校验目标 ModId 是否已被启用集或其他 Overlay 占用
  → 无冲突才建立 Runtime Overlay

结束 Runtime Session
  → 解除 Overlay
  → 保留 editing 数据包记录和内容
  → 不删除、不转 normal、不自动导出
```

## 推荐接口边界

```ts
interface DatapackTargetRef {
  readonly packRecordId: string;
  readonly modId: string;
  readonly versionId: string;
  readonly editingMode: 'normal' | 'editing';
}

interface CreateContentRequest<TInput> {
  readonly targetPackRecordId: string;
  readonly input: TInput;
}

interface DatapackConflict {
  readonly code:
    | 'target-datapack-required'
    | 'target-must-be-editing'
    | 'modid-runtime-conflict'
    | 'datapack-record-conflict'
    | 'stale-source';
  readonly packRecordId?: string;
  readonly conflictingPackRecordId?: string;
  readonly modId?: string;
  readonly versionId?: string;
  readonly editingMode?: 'normal' | 'editing';
  readonly message: string;
}
```

包库、编辑工作区和 Runtime facade 都只通过上述记录 / 只读视图通信；UI 不直接操作 Registry，也不自行拼装 Overlay 清理和 Runtime reload。

## 施工切片

### P0：身份与冲突裁定

- [x] 固定 `ModId`、`VersionId`、`packId`、`EditingMode`、`packRecordId` 的含义。
- [x] 固定 Runtime 集合的 ModId 唯一规则。
- [x] 固定 Catalog 保存三元组唯一规则。
- [x] 固定普通态导入、编辑态复制、编辑态导出后重新导入的状态转换。
- [x] 固定五类结构化提醒及其下一步动作。

### P1：普通态 / 编辑态数据包 Catalog

- [x] 普通态导入记录不可变，保存内容摘要和来源信息。
- [x] 实现普通态到编辑态的完整内容 / 资源复制，并记录来源关系。
- [x] 防止同一 `(ModId, VersionId, EditingMode)` 静默覆盖。
- [x] 支持多个 Catalog 记录，但 Runtime 应用前统一做 ModId 冲突校验。

### P2：编辑态工作区能力

- [x] 让所有编辑态记录接入统一编辑工作区；当前工作区支持 Init / Area / Spot / Enhancement。
- [x] 保存编辑态时保留未接入的 Datapack 顶层表，避免以空值静默覆盖。
- [x] 让 UI 发出的新建 / 修改命令携带明确 `targetPackRecordId`，目标不是编辑态时返回结构化错误。
- [ ] 后续扩展更多 Datapack 顶层表的专用字段编辑器；不影响本 Task 的编辑态记录边界。

### P3：Runtime 与冲突提醒

- [x] 建立 `target-datapack-required`、`target-must-be-editing` 等结构化返回码。
- [x] 在 Apply / 启用集应用前阻断 ModId 碰撞。
- [x] 提供徽标、保存拦截和“打开已有记录 / 修改版本 / 取消”的简单交互。
- [x] 交接失败保持原编辑态、原 Overlay、PlayerState 和启用集不变。

### P4：导入 / 导出回流与验收

- [x] 编辑态导出为普通 ZIP，重新导入后登记为 normal，不覆盖原记录。
- [x] 同三元组同摘要导入幂等；同三元组不同摘要阻止覆盖。
- [x] 验证普通态与编辑态不能以相同 ModId 同时进入 Runtime。
- [x] 完成类型、定向测试、全量测试、架构检查、文档检查和浏览器验收。

## 非目标

- 不自动重命名 ModId，不自动重写实体 ID、引用、Tag、图片命名空间或存档键。
- 不实现三方合并、内容 Diff 或自动冲突合并。
- 不把 `EditingMode` 写入标准 Datapack manifest；外部文件默认代表 normal 数据包。
- 不把编辑态数据写入玩家存档。
- 不允许 UI 绕过目标数据包选择，继续使用全局编辑态或最近一次目标作为隐式默认值。

## 用户验收场景

| 编号 | 场景 | 期望 |
| --- | --- | --- |
| US-1 | 导入一个 ZIP | 登记为 normal，未启用，不改变当前 Runtime |
| US-2 | normal 切换为 editing | 复制完整内容，保留 normal 原包，生成独立编辑态记录 |
| US-3 | 包库中存在任意编辑态记录 | 任意编辑态记录都可打开同一编辑工作区；已接入字段可编辑保存，未接入顶层表保留不丢失 |
| US-4 | 新建 Spot 时未指定目标包 | 被阻止并提示必须选择 editing 数据包 |
| US-5 | 新建数据时指定 normal 包 | 被阻止并提示先复制为 editing |
| US-6 | 两个 Runtime 包使用同一 ModId | Apply / 启用前阻止并显示冲突双方 |
| US-7 | 保存重复三元组 | 阻止覆盖，提供打开已有记录、改 Version 或取消 |
| US-8 | editing 导出后重新导入 | 生成 normal 记录，不覆盖原 normal 或 editing 记录 |
| US-9 | 结束编辑态 Runtime Session | 解除 Overlay，但保留编辑态数据包 |

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[task-0106-runtime-editor-draft-persistence]] · [[task-0107-runtime-editor-pack-export-service]]

## 施工回执

已落地：

- `PackManager` 增加 `normal / editing` 记录状态、`packRecordId`、来源摘要、内容摘要、完整复制、同三元组保存拦截与编辑态不可直接启用规则；编辑态保存不会覆盖普通态记录。
- Runtime 增加 `getPackRecord`、`getEditingPackDraft`、`createEditingPack`、`openEditingPack`；编辑态 Apply 会排除同 ModId 的普通态来源，避免 Runtime 命名空间碰撞，并将修改回写到编辑态记录。
- UI 数据包工作区提供“复制为编辑态 / 打开编辑器”；编辑器状态持有 `packRecordId`，Init / Area / Spot / Enhancement 的新建、修改和 Apply 均沿目标记录传递；未绑定目标时不再创建全局编辑态。
- 编辑态保存以 Datapack 合并方式更新已接入表，保留其他顶层表与资源；导出 ZIP 仍不写入 `EditingMode`，重新导入按普通态处理。

核验：`npx tsc --noEmit`、数据包 / Runtime Editor 定向 Vitest、全量 Vitest（178 个文件 / 1,639 项）、`npm run check:architecture`、`npm run check:docs`、`npm run build` 与 `git diff --check` 均已通过。真实浏览器已验证普通态复制为编辑态、Pane 双槽位、选择态等待 Apply，以及 Apply 后编辑态显示 Runtime；ZIP 编译、写入、解析回流由 `tests/ui/runtime-editor-pack-export.test.ts` 与 `tests/data/archive-writer.test.ts` 覆盖。
