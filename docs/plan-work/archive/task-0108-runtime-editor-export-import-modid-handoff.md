# Task：Runtime Editor 导出包回流与 ModId 冲突交接

状态：proposed — 2026-09-18 待裁定

归档原因：已合并至 `task-0110-datapack-editing-state-and-targeted-authoring`，不再单独推进。

前置任务：[[task-0109-runtime-editor-multi-datapack-authoring]]

## 背景

`task-0107-runtime-editor-pack-export-service` 已支持把指定编辑态数据包导出为标准 Datapack ZIP。`task-0109-runtime-editor-multi-datapack-authoring` 将把普通态数据包复制为独立的编辑态数据包，并把 Runtime Overlay 建模为编辑态数据包的会话结果。下一步最自然的用户路径是：

```text
编辑 Runtime Mod → 导出 ZIP → 导入该 ZIP → 继续使用或启用导入包
```

导出包会保留原编辑态数据包的 `ModId + VersionId`、manifest 命名空间以及所有实体 ID 的第一段命名空间。因此，导入后不能把它当作一个全新的命名空间处理：它可能与仍处于活动 Runtime Session 的编辑态数据包具有同一个 Mod 命名空间。普通态与编辑态在本地 Catalog 中必须是不同记录；启用集内和 Runtime Editor Overlay 中仍要求命名空间唯一，三者边界需要显式收敛。

## 目标

为“导出后重新导入”建立一套可解释、可取消、不会静默改变引用的冲突处理方案：

- 区分 `ModId + VersionId` 逻辑身份、内部 `packRecordId` 重复、启用集的 `modName` 冲突和 Runtime Editor Overlay 的 `modName` 占用；
- 以 `packRecordId` 区分普通态 / 编辑态数据包记录，以活动 Runtime Session / Overlay 判定实际命名空间占用，不再依赖全局编辑态单例；
- 导入同逻辑身份数据包时不自动覆盖普通态或编辑态记录、不自动启用、不自动结束当前 Runtime Session；
- 用户尝试启用与活动 Runtime Overlay 同 `modName` 的包时，在保存进度或重载 Runtime 之前阻断并给出明确交接选项；
- 支持用户显式确认“结束当前 Runtime Session 并切换到导入包”，或取消并继续编辑；
- 不改写实体 ID、不批量重命名 ModId、不猜测跨包引用迁移关系；
- 为未来“从已导入普通态复制出新的编辑态”“编辑态与普通态版本比较”等能力保留接口边界。

## 非目标

- 不允许两个同 `modName` 的包同时进入启用集；这是现有三段式 ID 和 Registry 唯一性约束的基础。
- 不在导入时自动把 `demo-mod` 改成 `demo-mod-2`；这会要求重写所有 Def ID、引用、Tag、图片和存档键，风险远超当前需求。
- 不在本 Task 实现导入包的原地编辑、版本合并、三方 Diff 或冲突合并。
- 不在本 Task 实现普通态 / 编辑态数据包 Catalog、完整内容编辑能力或 Runtime Session 的底层拆分；该边界由前置 `task-0109` 完成，本 Task 只消费其稳定接口。
- 不把导出 ZIP 自动安装、自动启用或自动替换当前 Runtime；导入仍先进入包库，启用仍由启用集草案确认。
- 不为了绕过命名空间冲突而修改 PlayerState、SaveData 或实体引用。

## 当前事实

### 三个不同的身份概念

| 身份 | 当前来源 | 是否允许重复 | 风险 |
| --- | --- | --- | --- |
| `ModId + VersionId` / 逻辑包身份 | manifest、实体三段式 ID 和包版本 | 普通态与编辑态可以各有一条本地记录；启用集按 `modName` 互斥 | 不能用逻辑身份直接覆盖普通态或编辑态记录 |
| `packRecordId` / Catalog 记录身份 | 普通态导入记录、编辑态复制记录 | 每条记录必须唯一 | 同一逻辑包的普通态、编辑态和未来副本可能被误当成同一条 |
| 编辑态数据包 | 普通态完整复制 + `state = editing` | 可有多份；只有 Apply 后参与 Runtime 命名空间 | 不能再用“是否有全局草稿”判断 Runtime 是否被占用 |
| Runtime Editor Session / Overlay | 活动 `editingPackRecordId` + Session / Overlay lease | 同一时刻只允许一个活动 Overlay | 关闭浮窗或保存编辑态不能被误判为释放命名空间 |

### 当前导入链路

1. `parsePackFromZipFile()` 解析 manifest、分片和图片；
2. UI 展示导入预览；
3. 确认后 `registerParsedPack()` 以 `modName@version` 注册到 `PackManager`；
4. 当前 UI 明确提示“加入包库但不立即改变当前运行内容”；
5. 用户在数据包工作区中修改启用集草案，随后单独校验并应用。

因此，“导入”本身不应被当成 Runtime 冲突；冲突的硬边界是启用 / 应用，以及同一 `packId` 的再次导入。

### 当前 Runtime Editor 边界

- Runtime Editor 编辑态数据与玩家 SaveData 分离；在新模型中，导出和关闭浮窗不会自动结束编辑态数据包或 Runtime Session；
- 当前 Runtime Mod Overlay 使用 `modName:typeName:idName` 进入 Registry；
- `applyRuntimeMod()` 已阻止临时 Mod 与当前 Registry 中已存在的实体 ID 无提示重叠；
- 数据包启用集使用 `PackManager.validateConfiguration()` 阻止两个同 `modName` 的包同时启用；
- 当前启用集应用路径没有针对“Runtime Editor 当前占用同一 `modName`”提供专门的交接语义，不能依赖通用 Registry 报错来替代 UI 决策。

## 前置架构语义：编辑态是数据包记录状态，不是全局悬置信息

本 Task 以 `task-0109` 的模型为前提：

- “启用编辑态”表现为把普通态数据包复制为 `state = editing` 的新记录；
- 普通态记录是只读基线，编辑态记录保存完整可编辑内容；两者通过 `sourceRecordId` / `sourceDigest` 建立来源关系；
- 未 Apply 的编辑态数据包不进入 Registry，不占用 Runtime 命名空间；
- 只有活动 Runtime Session 已经把编辑态数据包 Apply 为 Overlay 时，才形成 `RuntimeEditorNamespaceLease`；
- “结束编辑会话”只解除 Overlay，默认保留编辑态数据包；“删除编辑态数据包”必须是单独的明确操作；
- 导出必须指定 `packRecordId`，不能隐式读取全局单例。

因此，本 Task 处理的冲突主体不是“某个全局编辑态是否存在”，而是“目标数据包是否要接管当前活动 Runtime Session 所占用的 `modName`”。

## 核心裁定建议

### 1. 导入阶段：只登记，不解决 Runtime 命名空间

导入确认只完成“解析 → 校验 → 登记普通态数据包”，默认保持未启用。若活动 Runtime Overlay 的 `modName` 与导入包相同，预览页显示非阻断提示：

> 当前 Runtime Editor Session 正在占用 `demo-mod`。数据包已加入包库但尚未启用；若要启用它，需要先结束当前 Session 并执行一次明确交接。

这样用户可以先导入、查看包详情和依赖，不会因为导入动作而丢编辑态数据包、重载 Registry 或改变 PlayerState。

### 2. 包库阶段：区分幂等重复与内容冲突

对外 `packId = ModId + VersionId`，但导入登记的目标状态固定为 `normal`；不能继续无条件覆盖：

- 已有普通态记录的同一 `packId` 且内容指纹相同：视为幂等重复导入，保留原普通态记录，更新选中项 / 导入反馈，不产生第二条普通态记录；
- 已有普通态记录的同一 `packId` 但内容指纹不同：拒绝登记，报告“普通态包身份相同但内容不同”，要求用户先移除旧包或显式执行未来的替换流程；
- 已有编辑态记录不阻断普通态导入；两者通过不同 `packRecordId` 共存，但启用 / Apply 时仍按 `modName` 做 Runtime 冲突校验；
- `modName` 相同但 `versionId` 不同：允许在普通态包库并存，但所有同名条目都必须在启用草案中互斥；
- `modName` 不同：按现有依赖和 Registry 校验继续处理。

内容指纹应由稳定的语义包内容计算，而不是只依赖文件名或导入时间。首期可采用规范化 manifest、Datapack 分片和图片路径 / 字节的摘要；ZIP 压缩时间、文件顺序等传输细节不能影响指纹。

### 3. 启用阶段：把活动 Runtime Session 作为独立冲突源

在 `validatePackConfiguration()` 或等价的 Runtime 门面校验层增加 Runtime Editor 命名空间检查：

- 当前没有占用中的 Runtime Editor Overlay：按现有启用集规则校验；
- 活动 Session 的 Overlay 使用 `modName = X`，目标启用集包含 `modName = X` 的包：返回结构化 `runtime-editor-modname-conflict`，不得进入保存、reload 或图片清理；
- 只有 Catalog 中存在同 `modName` 的未 Apply 编辑态数据包：不阻断，但 Apply 该记录时必须重新校验；
- 当前仅关闭浮窗、保存编辑态或选择了编辑态数据包：不视为已经释放或占用 Runtime，具体以 Session / Overlay lease 为准；
- 同 `modName` 的普通态包若是当前 Runtime Editor 已明确交接的目标，不再走普通冲突错误，而进入专用 handoff 流程。

这里的“Runtime 命名空间占用”不能只看面板是否打开或 Catalog 中是否有草稿；必须区分：

```text
浮窗关闭        ≠ 编辑会话结束
存在编辑态数据包 ≠ Runtime Overlay 已 Apply
Runtime Overlay  ≠ 包库中的 Datapack 条目
```

### 4. 推荐交互：显式“切换为导入数据包”

当用户在启用集草案中加入同 `modName` 的数据包时，界面不直接显示泛化的“启用集冲突”，而是提供两个安全动作：

1. **取消并继续编辑**：撤销本次启用草案变更，保留当前 Editor Draft、Runtime 和 PlayerState；
2. **结束 Runtime Session 并切换为数据包**：打开一次交接确认，列出影响后，按明确顺序完成切换。

交接确认必须说明：

- 当前活动 Editor Mod 名称、版本和未应用内容数量；
- 目标数据包名称、版本、依赖和启用集变化；
- 当前编辑态数据包将不再作为 Runtime Overlay，但其 Catalog 记录和完整内容默认保留；
- 本地编辑草稿的处理方式；
- 切换需要保存当前进度并重载 Registry，失败时保持原状态。

推荐的 P0 语义是：确认交接后，以导入的普通态包作为正式 Runtime 来源，结束当前 Runtime Editor Session 并解除当前 Overlay；原编辑态数据包记录和完整内容默认保留，但不再作为活动 Runtime Overlay。用户之后可以重新打开它。取消交接则完全不改变当前编辑态记录、Session、Runtime 和启用集。

### 5. 不做静默 ModId 改名

即使用户导入的普通态包与编辑态数据包具有相同逻辑身份，也不能自动生成 `demo-mod-imported` 或类似名称。普通态与编辑态通过不同的内部 `packRecordId` 共存；改写外部 `ModId` 会影响：

- Init / Area / Spot / Enhancement 全部实体 ID；
- `defaultAreas`、`defaultSpots`、拓扑、支付、Reveal、Tag、Resource、Item 等引用；
- `dependencies`、图片命名空间和存档残留；
- 用户从编辑器看到的 ID 与导出包中的 ID 一致性。

如未来需要“复制为新 Mod”，应另立任务，使用显式的引用图重写器、预览 Diff 和新命名空间确认，不属于本 Task。编辑态导出为普通态时若发生同一 `ModId + VersionId` 冲突，也必须进入显式替换 / 新版本决策，不能静默覆盖普通态基线。

## 推荐接口边界

### 包库身份与指纹

放在 `src/data-services/datapack/` 的纯数据合同中，不依赖 UI：

```ts
interface PackIdentity {
  readonly packId: string; // ModId + VersionId
  readonly modId: string;
  readonly versionId: string;
  readonly modName: string;
  readonly contentDigest: string;
}

type PackRecordState = 'normal' | 'editing';

type PackImportDecision =
  | { readonly kind: 'added'; readonly packId: string; readonly packRecordId: string; readonly state: 'normal' }
  | { readonly kind: 'idempotent'; readonly packId: string; readonly packRecordId: string; readonly state: 'normal' }
  | { readonly kind: 'identity-conflict'; readonly packId: string; readonly existingDigest: string; readonly incomingDigest: string };
```

`StoredPack` 可增加可选 `contentDigest`；旧包库快照若缺失指纹，应在读取后按当前规范重新计算，不能把导入时间或 ZIP 文件名当作指纹。是否需要存档结构版本另立裁定，禁止悄悄编写迁移逻辑。

### Runtime Editor 冲突查询

运行时门面提供只读查询与校验结果，UI 不直接读取 Registry 写引用：

```ts
interface RuntimeEditorNamespaceLease {
  readonly editingPackRecordId: string;
  readonly sessionId: string;
  readonly packId: string;
  readonly modName: string;
  readonly hasDraft: boolean;
  readonly hasRuntimeOverlay: boolean;
  readonly versionId: string;
}

interface RuntimeEditorPackConflict {
  readonly kind: 'runtime-editor-modname-conflict';
  readonly modName: string;
  readonly packId: string;
  readonly editingPackRecordId: string;
  readonly editor: RuntimeEditorNamespaceLease;
  readonly resolution: 'cancel' | 'handoff-to-pack';
}
```

冲突合同只描述事实与可选动作；交接命令的保存、Runtime 清理、启用集应用和 UI 反馈仍由应用层编排，避免 `PackManager` 反向依赖 Runtime Editor。

### 显式交接命令

建议在 `PackCatalogCommands` / Runtime facade 增加单独命令，而不是让 UI 拼装多个低层调用：

```ts
type RuntimeEditorPackHandoffRequest = {
  readonly packId: string;
  readonly expectedEditingPackRecordId: string;
  readonly expectedModName: string;
  readonly expectedSessionId: string;
  readonly expectedEditingDigest?: string;
};

type RuntimeEditorPackHandoffResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly code: 'stale-conflict' | 'save-failed' | 'validation-failed' | 'reload-failed'; readonly message: string };
```

命令必须在内部完成：

1. 重新读取当前编辑态 `packRecordId`、Session 和 PackManager 身份，防止确认弹窗期间对象变化；
2. 保存当前玩家进度；
3. 验证目标启用集和依赖闭包；
4. 解除 Runtime Editor Overlay / Runtime Mod 绑定；
5. 应用目标包配置并重载 Registry；
6. 只有成功后才结束当前 Runtime Editor Session、解除 Overlay，并将编辑态数据包标记为非活动；原编辑态记录和完整内容默认保留；
7. 任一步失败都保留原编辑态记录、原 Session / Overlay、原 Runtime 和原启用集。

## 交互流程

```text
导入 ZIP
  │
  ├─ 解析失败 ───────────────→ 保持现状，显示错误
  │
  ├─ 同 packId 同指纹 ────────→ 幂等成功，保持未启用
  │
  ├─ 同 packId 不同指纹 ──────→ 阻止登记，要求显式替换
  │
  └─ 登记包库（未启用）
        │
        └─ 用户加入启用集草案
              │
              ├─ 与活动 Overlay modName 不同 → 走现有校验
              │
              ├─ 与活动 Overlay modName 相同 → 冲突提示
              │       ├─ 取消：恢复草案，继续编辑
              │       └─ 切换：保存 → 结束 Session / 清理 Overlay → 应用普通态包 → 保留编辑态记录
              │
              └─ 交接失败 → 全部保持原状
```

## 施工切片

### P0：身份与冲突语义裁定

- [ ] 依赖并核对 `task-0109` 的 `packRecordId`、普通态 / 编辑态、Catalog、Session / Overlay 术语和显示文案。
- [ ] 明确 `modName`、`ModId + VersionId`、普通态 / 编辑态记录和 Session / Overlay 的冲突边界。
- [ ] 裁定同 `packId` 同指纹的幂等导入与同 `packId` 不同内容的阻断策略。
- [ ] 裁定导出包回流是否使用内容指纹识别；不依赖文件名、导入时间或 ZIP 字节偶然一致。
- [ ] 裁定交接成功后活动 Session 的处理方式；默认建议解除 Overlay 但保留编辑态 `packRecordId`，未来另做“从普通态复制为新编辑态”。

### P1：包库身份保护

- [ ] 为 `StoredPack` / `PackManager` 增加包内容指纹和登记决策结果。
- [ ] 禁止 `importPack()` 对同 `packId` 不同内容执行静默 `Map.set` 覆盖。
- [ ] 保留同 `modName` 不同版本在包库并存的能力；明确列表中的版本和启用互斥提示。
- [ ] 为重复导入、内容冲突、旧快照缺失指纹补充纯数据服务测试。

### P2：Runtime Editor 命名空间冲突守卫

- [ ] 在 Runtime / PackCatalog facade 提供活动 Session / Overlay 的命名空间只读查询。
- [ ] 在启用集预校验阶段阻断同 `modName` 的 Runtime Overlay / Pack 共存，不修改 Runtime、PlayerState 和正式启用集。
- [ ] 区分“浮窗已关闭”“编辑态已保存”“Session 已结束”“Runtime Overlay 已 Apply”，避免把 UI 可见性或 Catalog 存在性当作冲突解除。
- [ ] 保留非冲突包的现有启用集流程和依赖校验。

### P3：显式交接与 UI

- [ ] 增加“取消并继续编辑”和“结束 Runtime Session 并切换为数据包”两个明确动作。
- [ ] 交接命令内部完成保存、再次校验、结束 Session、解除 Overlay、应用普通态包配置，并在成功后保留编辑态记录。
- [ ] 交接失败保持原编辑态记录、Session / Overlay、Runtime、PlayerState、包库与启用集不变。
- [ ] 预览页、包库详情、启用集校验错误显示命名空间冲突的具体双方和下一步动作。
- [ ] 导入同 `modName` 的包但未启用时不弹出破坏性确认，不打断当前编辑。

### P4：回流验收

- [ ] 导出 → 导入同一 ZIP：包库登记幂等，当前 Editor / Runtime 不改变。
- [ ] 导出 → 导入 → 尝试启用：冲突被阻断，取消后 Draft、Runtime、PlayerState 和启用集保持原状。
- [ ] 导出 → 导入 → 确认交接：目标普通态包成为 Runtime 来源，旧 Overlay 不残留，原编辑态数据包保留但 Session 明确结束。
- [ ] 同 `modName` 不同版本导入可并存，但启用时只能选择一个。
- [ ] 同 `packId` 不同内容导入不会覆盖原包。
- [ ] 交接期间保存失败、依赖失败、Registry 校验失败、reload 失败均可回滚到原状态。
- [ ] 完成类型、定向测试、全量测试、架构检查和文档检查。

## 用户验收场景

| 编号 | 场景 | 期望 |
| --- | --- | --- |
| US-1 | 当前编辑态 `demo-mod@1.0.0`，导入刚导出的普通态包 | 加入包库但保持未启用；编辑态和 Runtime 不变 |
| US-2 | 再次导入同一导出包 | 幂等提示，不出现重复条目，不覆盖不同内容 |
| US-3 | 同 `packId` 但 ZIP 内容被修改后导入 | 拒绝覆盖，保留原包库条目 |
| US-4 | `demo-mod@1.1.0` 普通态与当前 `demo-mod@1.0.0` 编辑态并存 | Catalog / 包库允许并存，但加入启用集时提示同命名空间冲突 |
| US-5 | 冲突弹窗选择取消 | 启用草案撤销，Editor Draft、Runtime、PlayerState 完全保留 |
| US-6 | 冲突弹窗选择切换 | 确认影响后保存、结束 Session、解除 Overlay、应用普通态目标包；原编辑态数据包保留但不再活动 |
| US-7 | 交接过程中保存 / 校验 / reload 失败 | 不清理草稿，不改变正式启用集，不留下半切换状态 |
| US-8 | 当前只关闭编辑器浮窗，没有结束 Runtime Session | 活动 Overlay 仍视为命名空间占用，不能通过隐藏浮窗绕过冲突 |
| US-9 | 导入不同 `modName` 的包 | 不触发本 Task 的冲突流程，继续现有包库 / 启用集校验 |

## 风险与停工条件

| 风险 | 处理 |
| --- | --- |
| 同 `packId` 普通态导入覆盖旧包 | P1 先做普通态指纹与登记决策，禁止继续复用无条件 `Map.set` |
| 包库重载后旧 Runtime Overlay 残留 | P2/P3 以 Runtime facade 的交接命令为唯一入口，不让 UI 直接拼装 reload |
| 自动改名造成引用图损坏 | 普通态复制为编辑态不改写 `ModId + VersionId`；若要复制为新逻辑包另立任务 |
| 弹窗确认期间编辑态 / 包库发生变化 | 交接请求携带期望 `packRecordId`、`packId`、`modName` 和可选指纹，执行时重新校验并返回 `stale-conflict` |
| 交接失败清理过早 | 只有普通态包配置应用成功后才清理活动 Overlay；保存和校验失败保持原状 |
| 用户以为关闭浮窗就释放命名空间 | UI 文案和状态合同显式区分 panel、普通态 / 编辑态记录、overlay、editing session |

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/01-architecture/design-constraints]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[docs/plan-work/archive/task-0107-runtime-editor-pack-export-service]] · [[task-0109-runtime-editor-multi-datapack-authoring]] · [[docs/plan-work/archive/adr-0004-datapack-management]]
