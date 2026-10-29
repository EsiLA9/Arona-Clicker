# Task-0057：单 Mod 全内容编辑工作台与 Mod 输出

状态：active

**状态**：🟡 方案已裁定；ADR-0011 P1A 基础模型已实施并验证，完整工作台仍待施工  
**日期**：2026-09-14  
**前置**：[[task-0055-runtime-datapack-editor-mvp]]、[[task-0056-workspace-datapack-boundary-convergence]]、[[adr-0010-definition-repository-editor-resolution]]、[[adr-0011-definition-resolution-withdrawal]]

## 一、目标

将当前“单 Mod + 单临时 Spot”的运行时编辑器扩展为**单 Mod 全内容编辑工作台**：

1. 一次编辑会话只允许一个目标 Mod；
2. 目标 Mod 的全部 Datapack 内容支持新建与修改，并具备必要的删除语义；
3. 已导入的 Mod 可以转入编辑态；
4. 编辑态可以进行校验、运行时预览、撤销/重做和错误定位；
5. 编辑态可以输出为可再次导入的 Mod 文件或 ZIP；
6. 编辑过程不直接修改正式 PackManager、背景 Datapack 或 Runtime Registry 的来源；
7. 能增量更新的内容不触发运行时整体重载，无法安全增量更新的内容保留整包重载回退路径。

本任务是完整编辑工作台的规划入口，不把所有实现一次性塞入 Task-0055 或 Task-0056。

当前进度：Definition Resolution 的 P1A 纯模型已由 [[task-0058-definition-resolution-p1a]] 实施并验证；Task-0057 的 Draft 工作区、全表 UI、Runtime Preview 与 Mod Export 仍未施工。

## 二、当前基线与问题

### 2.1 当前临时编辑器基线

- `RuntimeModDraft` 只有一个 `spot`；
- `RuntimeDatapackEditorState` 只有一个 Spot 表单；
- `AronaClickerRuntime.runtimeMod` 只记录一个临时 Mod；
- 临时 Spot 通过构造内存 Datapack 后调用 `reloadPreservingState()` 载入；
- `Registry` 是运行时合并结果，没有按 Def 保存来源 provenance，也没有公开的 Def 替换/删除接口；
- `PackManager.StoredPack` 保存 manifest、解析后的 Datapack 和图片，但不保存原始分片、原始字节或 content hash；
- `parsePack()` 将多个 JSON 分片合并为一个 Datapack，当前模型无法保证原始文件分片和未识别字段的无损回写；
- `tools/datapack-editor/` 已具备部分 Schema 驱动的增删改、撤销/重做与 JSON 导出模型，但它是独立历史工具，不能直接成为当前游戏内 UI 的状态真源。

### 2.2 目标与当前实现的差异

当前临时 Spot 逻辑适合作为 Runtime Overlay 的试验基线，但不适合作为完整 Mod 编辑器的数据模型。完整目标需要同时处理：

- 原始 Mod 来源与目标包定位；
- 目标包与引用包的边界；
- 全表 Def 的新建、修改、删除和顺序；
- 跨表、跨包引用与删除 tombstone；
- Runtime 预览与局部刷新；
- PlayerState 残留与显式清理；
- manifest、图片、JSON 分片和 ZIP 输出。

## 三、核心边界

### 3.1 单 Mod 边界

编辑会话只能拥有一个 `targetPackId` / `targetModName`：

- 目标 Mod 内的 Def 可编辑；
- Reference Pack 只读，用于引用解析、名称展示和校验；
- 不把全部启用包合并成一个可编辑数据库；
- 不允许普通编辑直接修改 `modName`；
- Mod 元信息中的显示名称、版本、作者、简介可编辑；
- 如需修改 `modName`，另做“复制为新 Mod / 重命名 Mod”流程，不能隐式重写全部 ID。

### 3.2 三种数据不能混为一谈

```text
Source Pack       原始目标 Mod，只读
Draft Workspace   当前编辑操作、删除标记、顺序、撤销历史
Runtime Preview   将 Draft 应用到当前游戏的临时结果
Export Artifact   根据 Draft 生成的可导入 Mod 文件
```

- Draft 不直接 mutation Runtime Registry；
- Runtime Preview 不自动写入 PackManager；
- Export 不自动替换包库中的原 Mod；
- “输出 Mod”和“安装/替换到包库”必须是两个明确动作。

### 3.3 ID、删除与引用

- Mod 内新增实体必须使用目标 Mod 的三段式命名空间；
- 已创建 Def 的 ID 默认不可编辑；改 ID 等价于“新建 + 删除旧 Def”；
- suspend 产生 Draft-only Tombstone 且阻止下层回退；delete-local 与 remove-override 按 ADR-0011 继续向下解析；
- 外部 Mod 的引用只能被诊断，不能由当前编辑器直接修改外部包；
- 被外部 Def 或 PlayerState 使用的删除操作必须给出引用影响；
- 不为旧 PlayerState 编写迁移兼容代码，字段结构破坏性变更应提示并遵守当前存档策略。

## 四、编辑数据模型建议

### 4.1 Source / Repository

目标包读取必须基于原始 `StoredPack.datapack` 和 manifest，而不是从合并后的 Runtime Registry 反推。

后续 DefinitionRepository 按 ADR-0010 与 ADR-0011 的最小接口和解析语义实现：

```ts
get(ref)
list(query)
has(ref)
resolve(ref)
```

解析顺序固定为：

```text
当前目标包 DraftLayer
    ↓
显式 Reference Packs（按 PackPlan 顺序）
    ↓
原始目标包 Definition source
    ↓
基础 Definition source
    ↓
显式允许且具备 provenance 的 Runtime fallback
```

`Runtime fallback` 不能默认开启。`DefinitionRecord` 必须带 `packId / table / id`，避免解析后再次丢失来源。

### 4.2 DraftLayer

DraftLayer 以 Def 为单位保存：

- `create`：新建 Def；
- `replace`：修改已有 Def；
- `suspend`：写入 Draft-only Tombstone；
- `delete-local`：删除当前编辑层 source record 并继续解析；
- `remove-override`：移除当前层 override 并继续解析；
- `move` / `order`：保留存在顺序敏感的表顺序；
- `baseRevision`：记录进入编辑态时的源版本或 content hash。

编辑器表单操作只写 DraftLayer，不立即改 Runtime。保存或预览时再生成一次统一的 `RuntimeContentDelta`。

### 4.3 编辑器工作区状态

建议将页面状态与领域数据分开：

```ts
interface ModEditingWorkspaceState {
  targetPackId: string | null;
  targetModName: string;
  manifest: ModManifestDraft;
  draft: DraftLayer;
  selectedTable: string;
  selectedRef: DefinitionRef | null;
  issues: readonly EditorIssue[];
  dirty: boolean;
}
```

`selectedTable`、`selectedRef` 属于 UI selection；Def 草稿、删除标记和历史属于编辑工作区；二者不能继续合并进 App Shell 的通用 `PanelState`。

## 五、全内容覆盖范围

编辑器必须以当前 `Datapack` 合同和 Schema 同步产物为覆盖清单，不能只扩展 Spot 表单。当前内容至少包括：

| 分类 | 内容 |
| --- | --- |
| 世界 | Init、Area、Spot |
| 规则 | Enhancement、Funclet、Trigger、AffectorPack |
| 剧情 | Story、ActiveStory、PassiveStory、PassivePool |
| 物品 | Item、DropTable |
| 角色 | Character、CharacterVariant、CharaProfile、归属配置 |
| 成长 | CultivateCurve、FavoriteItem、UniqueWeapon、Trait、Gear、GearConfig |
| 色彩 | ColorGroup、ColorEquipment、ThemeDesign |
| 交易与招募 | Shop、GachaPool |
| 资源与表现 | Pic、ResourceDisplay、Tag、Extras |
| 全局配置 | AffectionConfig 及 Datapack 合同中的其他可选单值配置 |

每张表都要明确：

- 主键与 ID 格式；
- 是否允许新建、修改、删除；
- 是否存在顺序语义；
- 引用的目标表；
- 是否允许跨包引用；
- 删除时的引用影响；
- Runtime 预览所需的重建范围；
- 导出时的分片和资产映射。

## 六、校验边界

校验分为三层，不能只依赖 UI 字段校验。

### 6.1 结构校验

- 字段类型、必填字段、枚举、嵌套对象和数组结构；
- 三段式 ID、命名空间和同表唯一性；
- 删除标记与新增/修改操作的冲突；
- manifest 与 Datapack 的 `modName / name / version` 一致性。

### 6.2 语义校验

- Init / Area / Spot 的层级关系；
- 跨表引用和跨包引用；
- Character / Variant / Profile 关联；
- Shop / Gacha / Item / DropTable 关系；
- Trigger / Effect / Funclet / Affector 关系；
- Tag、Reveal、Condition 和作用域；
- Pic 路径、主题资源和图片资产；
- 目标 Mod 对外引用与删除影响。

### 6.3 Runtime 预览校验

将目标 Mod Draft 与明确的 Reference Pack 组合进行预览校验，要求：

- 校验失败不改变当前运行时；
- 不能因为编辑器缺少某个来源而默认从合并 Registry 猜值；
- 不能让不完整 Draft 进入正式 PackManager；
- 允许 warnings，但 errors 阻止预览和正式导出。

## 七、Runtime 预览与重载策略

### 7.1 统一 Delta，不按输入框更新

```text
表单编辑 → DraftLayer
点击保存/预览 → 全量 Draft 校验
              → RuntimeContentDelta
              → 增量更新或整包回退
              → 发送内容变化事件
              → UI 局部刷新
```

输入框变化不能直接触发 Runtime 更新。多个 Def 的修改应尽可能合并为一次提交。

### 7.2 变更能力矩阵

| 变更类型 | 首版策略 |
| --- | --- |
| 纯数据展示字段 | 局部替换并刷新相关 UI |
| Spot 基础数据、Area 归属 | Registry / Area 索引 Delta，必要时重建 GameNum 相关节点 |
| Tag、Reveal、Condition | 重建相关 Visibility / Tag 索引 |
| Shop、Gacha、DropTable | 重建对应查询索引和引用校验 |
| 图片、主题、资源展示 | 更新资产索引和表现查询，不重启游戏状态 |
| Funclet、Trigger、Affector | 首版允许整包 `reloadPreservingState()` 回退 |
| Init / Area 拓扑、角色结构、全局配置 | 首版允许整包回载；后续再拆专用增量能力 |
| ModName、依赖集、包级 manifest 结构 | 视为包级变更，不能伪装成普通 Def 增量 |

“避免大规模重载”不是“所有表都强行热更新”。安全性优先：没有完整 Delta 能力的表保留整包回退。

### 7.3 Runtime Overlay 所有权

Runtime Overlay 必须记录其拥有的 Def 集合和来源：

- 只能替换/删除 Overlay 自己拥有的内容；
- 不能删除背景 Mod 的 Def；
- 目标 Mod 编辑预览不能直接覆盖正式 Source；
- 正式包重新应用时明确清除 Preview Overlay；
- Overlay 操作失败时保持旧 Runtime，不产生半应用状态。

## 八、PlayerState 与存档策略

修改或删除已有 Def 时，默认不自动清除玩家数据：

```text
Def 当前不可解析 → PlayerData 作为残留保留
用户显式清理     → 按 Def / Mod 范围删除对应数据
```

具体清理范围必须按表定义，可能包括：

- Spot 等级、管理人和标签覆盖；
- Item 数量；
- Character / Variant 拥有与成长数据；
- Story 阅读记录、冷却和阻断状态；
- Enhancement、Gear、Color 等拥有状态。

结构清理应进入 StateMutationService 或专门的残留清理入口，不能由 UI 直接改 PlayerState。

## 九、Mod 输出设计

### 9.1 首版输出目标

首版优先保证**语义等价、可再次导入**，输出包括：

- `datapack.json` manifest；
- 数据表 JSON 分片；
- 图片和其他资产；
- 经过校验的目标 Mod 内容；
- 不包含编辑器内部字段、虚拟表和 Runtime 临时字段。

建议通过独立的 `ModExporter` 生成确定性输出：相同 Draft 得到稳定的排序和稳定的 JSON 结果。

### 9.2 必须提前裁定的无损程度

当前解析器主要保存合并后的 Datapack，不完整保留：

- 原始 JSON 分片路径；
- 文件边界；
- 注释和格式；
- 未识别字段；
- 原始二进制资产。

因此需要在施工前选择：

1. 只要求语义等价，允许重新分片和规范化输出；
2. 要求原包结构近似回写，则必须扩展 Source / StoredPack 保存原始分片和资产信息；
3. 不允许任何未知字段丢失；至少应报错或原样保留，不能静默忽略。

## 十、综合服务边界

可以建立 `ModEditingFacade` 作为 Application 层编排门面，但它不能成为新的超级服务。建议职责拆分如下：

| 组件 | 职责 |
| --- | --- |
| `DefinitionRepository` | 目标包、引用包和来源解析 |
| `DraftLayer` / `EditingWorkspace` | 增删改、顺序、撤销/重做、dirty 状态 |
| `DefinitionValidator` | 结构、语义和 Runtime 预览校验 |
| `RuntimeOverlayService` | 生成 Delta、增量预览、整包回退 |
| `PlayerDataResidueService` | 残留数据查看和显式清理 |
| `ModExporter` | manifest、JSON 分片、图片和 ZIP 输出 |
| `ModEditingFacade` | 编排上述服务，不拥有各表业务规则 |
| UI Controller / Renderer | 只读 View、表单交互和导航，不直接读写 Registry |

数据服务仍不得依赖 `src/ui/`；编辑器工作区状态也不得写入 Runtime Registry。

## 十一、建议施工切片

### P0：边界与来源模型

- 确定单 Mod 编辑会话模型；
- 增加 `targetPackId`、Source revision / provenance；
- 建立 `DefinitionRef / DefinitionRecord / DefinitionResolution` 实际类型；
- 补充目标包、引用包和 Runtime fallback 的来源测试；
- Definition Resolution 撤回语义遵循已生效的 ADR-0011；在 P1A/P1B 纯模型完成前不实现 Runtime 接线。

### P1：DraftLayer 与编辑工作区

- 按表保存 create / replace / suspend / delete-local / remove-override / order；
- 实现撤销、重做、dirty 和显式放弃；
- suspend 使用 Draft-only Tombstone，delete-local 不隐式创建全局阻断；
- 目标 Mod 的 `modName` 和 Def ID 默认锁定；
- UI 只保存 selection，不把全量 Draft 塞进 App Shell。

### P2：全表 Schema 与表单

- 以 Schema 同步产物覆盖当前 Datapack 全部表；
- 复杂 Condition / Effect / Trigger / Theme 使用类型化编辑器；
- 解决未知字段的保留或明确报错；
- 每张表补充新建、修改、删除和引用定位。

### P3：全量校验与引用图

- 结构校验、跨表校验、跨包校验；
- 构建 Def 引用图；
- 删除前展示影响范围；
- 将 Registry fallback 限制为显式且带 provenance 的路径。

### P4：Runtime Preview

- 目标 Mod Draft 编译为 Preview Overlay；
- 先校验、后应用；
- 纯数据变更走增量 Delta；
- 复杂变更保留 `reloadPreservingState()` 回退；
- 失败时保持旧 Runtime 和旧 PlayerState；
- UI 只刷新受影响的 Workspace / Panel。

### P5：Mod Export

- 生成 manifest、JSON 分片和图片资产；
- 明确稳定排序和输出目录；
- 导出前阻止 errors；
- 导出结果可再次导入并通过语义等价测试。

### P6：包库衔接

- 明确“导出”“安装为新包”“替换原包”三个动作；
- 记录 source revision，避免编辑旧版本覆盖新版本；
- 正式写入 PackManager 必须显式确认；
- 应用正式包后清除或重新建立 Preview Overlay。

### P7：验收与性能

- 全表 CRUD 与撤销/重做；
- 单 Mod + 多 Reference Pack；
- 删除 tombstone 与引用图；
- 导入 → 编辑 → 导出 → 再导入语义等价；
- Runtime 增量更新与整包回退；
- PlayerState 保留和显式清理；
- Edge 中验证编辑、预览、导出、取消、重新进入和包库衔接；
- `npx tsc --noEmit`、`npm run check:architecture`、`npm test` 全部通过。

## 十二、验收标准

### 结构

- [ ] 一个编辑会话只能有一个目标 Mod；
- [ ] 目标 Mod、Draft、Runtime Preview、Export Artifact 分层；
- [ ] Editor 不直接 mutation Runtime Registry；
- [ ] 不新增超级 `DatapackService` / `WorkspaceService`；
- [ ] Runtime Registry 保持运行时物化结果，不成为 Editor 数据库；
- [ ] Reference Pack 只读且来源可追踪。

### 行为

- [ ] 已导入 Mod 可以完整转入编辑态；
- [ ] 当前 Datapack 全部内容表支持定义范围内的新建与修改；
- [ ] suspend 产生明确 Tombstone，delete-local 与 remove-override 显示下层解析影响；
- [ ] 编辑错误不会改变旧 Runtime；
- [ ] 简单变更不触发 Runtime 整体重载；
- [ ] 复杂变更可以安全回退到整包重载并保留 PlayerState；
- [ ] 导出 Mod 可以重新导入并保持语义一致；
- [ ] 未经明确操作不会写入 PackManager 或清除 PlayerState。

### 数据完整性

- [ ] 不丢失未知字段，或在导入/导出前明确阻止并提示；
- [ ] manifest、Datapack、图片和引用关系一致；
- [ ] ModName、Def ID 和跨包引用遵守三段式命名空间；
- [ ] 同一 Draft 重复导出结果稳定；
- [ ] 目标 Mod 之外的背景包内容不被修改。

## 十三、非目标

- 不在第一阶段支持同时编辑多个 Mod；
- 不把所有启用包变成一个可编辑数据库；
- 不直接从 Runtime Registry 反推目标包来源；
- 不在缺少 provenance 时默认使用 Runtime fallback；
- 不为旧存档编写迁移兼容代码；
- 不要求所有 Datapack 表在首版都具备无 reload 热更新能力；
- 不把独立 `tools/datapack-editor/` 自动恢复为当前游戏内编辑器入口。

## 十四、风险与停止条件

| 风险 | 处理 |
| --- | --- |
| Registry 没有 Def 来源 | 先补 provenance，不允许伪造 Repository |
| 未知字段被解析器忽略 | 导入时报错或增加原始字段保留层 |
| 删除 Def 仍被外部引用 | 先显示引用图，默认阻止或转为残留 |
| 增量更新造成子系统索引不一致 | 没有完整 Delta 能力时回退整包 reload |
| 编辑器状态膨胀进 App Shell | 独立 EditingWorkspace 持有 Draft 与 selection |
| ModName 修改导致全局 ID 漂移 | 首版锁定 ModName，重命名另做任务 |
| 导出与再导入发生语义漂移 | 建立 round-trip 语义等价测试作为出口条件 |
| 临时预览污染正式包库 | Preview Overlay 与 PackManager 完全分离 |

出现以下情况时必须停止继续扩展 UI，而先补架构：

- 无法确定某个 Def 的来源；
- 无法区分 Draft 删除与下层回退；
- 无法在预览失败时保持旧 Runtime；
- 无法保证导出后再导入不丢失内容；
- 只能通过扩大一个综合 Service 来解决新表接入。

## 十五、相关路由

- [[task-0055-runtime-datapack-editor-mvp]]：当前单 Mod / 临时 Spot Overlay 基线；
- [[task-0056-workspace-datapack-boundary-convergence]]：Workspace、UI 状态和查询边界；
- [[adr-0010-definition-repository-editor-resolution]]：DefinitionRepository 与来源解析顺序；
- [[adr-0011-definition-resolution-withdrawal]]：Definition Resolution 撤回、引用悬置与 Draft-only Tombstone 语义；
- [[adr-0004-datapack-management]]：Source、Pack、PackManager、启用集和存档残留；
- [[docs/docs-828/05-conventions/schema-sync]]：实体类型与编辑器 Schema 同步协议；
- [[docs/docs-828/05-conventions/architecture-discipline]]：状态写入口、UI 只读和数据服务依赖纪律；
- [[docs/docs-828/05-conventions/testing]]：测试与验收纪律。
