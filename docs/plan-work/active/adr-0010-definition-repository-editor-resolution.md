# ADR-0010：DefinitionRepository 与 Editor 来源解析边界

**状态：🟡 接口裁定完成；Definition Resolution 撤回语义由 ADR-0011 补充，Repository / Overlay 实现待后续任务。**  
**日期：2026-09-14**

## 背景

Task-0056 P4 需要为后续多 Def Editor 确定读取边界，但当前运行时只有合并完成的 `Registry`。`Registry` 是 Runtime 的物化结果，包含启用包按顺序合并后的定义，不能反向说明某个定义来自哪个原始包，也不能表达草稿 patch / replacement / delete。

如果 Editor 直接把 `Registry` 当作源仓库，编辑目标包、引用包与最终运行时结果会被混为一谈；如果现在就创建通用 `DraftLayer` 或完整 Repository，又会在没有来源 provenance 的前提下提前承诺错误的模型。

## 裁定

### 1. Runtime Registry 继续只做运行时物化结果

- Runtime 机制继续从 `Registry` 读取合并后的定义；本 ADR 不改 Registry 的底层 Map、合并顺序或生命周期。
- Editor 草稿不得直接 mutation Runtime Registry。
- Apply 仍通过现有 Pack / Runtime 生命周期重新构建事实状态；UI 不手动同步或回填 Registry。

### 2. 后续 DefinitionRepository 采用最小只读接口

接口只表达来源定位与只读解析，不拥有草稿写入、Runtime reload 或保存：

```ts
interface DefinitionRef {
  packId: string;
  table: string;
  id: string;
}

interface DefinitionRecord<T> {
  ref: DefinitionRef;
  value: T;
}

interface DefinitionResolution<T> {
  status: 'resolved' | 'suspended' | 'missing';
  record?: DefinitionRecord<T>;
  source: 'draft' | 'reference-pack' | 'target-pack' | 'base-pack' | 'runtime-fallback';
}

interface DefinitionRepository<T = unknown> {
  get(ref: DefinitionRef): DefinitionRecord<T> | undefined;
  list(query: { table: string; packId?: string }): readonly DefinitionRecord<T>[];
  has(ref: DefinitionRef): boolean;
  resolve(ref: DefinitionRef): DefinitionResolution<T>;
}
```

这里的 `T` 是单个 Def 类型；真正接入时应由表到 Def 类型的映射提供编译期约束，而不是让 Editor 以 `any` 解释任意字段。`list` 返回带来源引用的记录，避免再次丢失 `packId`。

### 3. Editor 的解析优先级固定为显式来源链

后续 EditingWorkspace 的读取顺序为：

```text
当前目标包 DraftLayer
        ↓
显式 Reference packs（按 PackPlan 顺序）
        ↓
原始目标包 Definition source
        ↓
基础 Definition source
        ↓
显式允许的 Runtime fallback（仅当具备 provenance）
```

- Draft 的 suspend 必须解析为 status: suspended，不能删除来源记录；delete-local 与 remove-override 的下层回退遵循 ADR-0011。
- `runtime-fallback` 不是默认来源；只有调用方明确允许且运行时能提供来源 provenance 时才可使用。
- 来源链与解析结果是只读查询结果，不写入 `PackCatalog`、`PackPlan` 或 PlayerState。

### 4. 本阶段只落地查询端口，不落地通用 Repository

当前 `PackManager` 的 `StoredPack` 已保存包级 `id`、manifest 与原始 `datapack`，但 Runtime Editor 尚无按表/Def 的草稿仓库和 provenance 索引。因此本阶段只保留上述接口裁定，不创建无法可靠实现的 `DefinitionRepository` 实例，也不把现有 `Registry` 包装成伪 Repository。

Task-0055 的单 Mod / 临时 Spot Editor 继续以当前运行时 Overlay 行为为基线；接入本 ADR 的来源链应另拆任务，先补 `PackReference` 与 DraftLayer 的来源测试，再实现多 Def 读取。

## 影响

- `DefinitionRepository` 的未来调用方是 Editor/Application Query，不是 `src/ui/components/` 直接访问 `Registry`。
- Repository 不负责校验、Apply、reload、持久化或交易；这些职责继续由对应 Datapack lifecycle、PackValidation 与命令入口拥有。
- Shop UI 采用独立的 `ShopQueryPort` 读取 Shop 目录、资源展示配置、availability 与 preview；`checkout` 仍只存在于交易服务的命令侧。

## 暂不处理

- 不实现完整 `DraftLayer`、多 Def 编辑器、ZIP 导出或 PackManager 持久化。
- 不为旧 PlayerState / Datapack 编写迁移兼容代码。
- 不允许以“查询接口”名义把交易、Runtime reload 或 UI 渲染派生塞回 `ShopService`。

## 相关文档

- [[docs/plan-work/active/task-0056-workspace-datapack-boundary-convergence]]
- [[docs/plan-work/active/adr-0004-datapack-management]]
- [[docs/plan-work/active/adr-0007-shop-transaction-boundaries]]
- [[docs/docs-828/03-data-structures/registry]]
- [[docs/plan-work/active/adr-0011-definition-resolution-withdrawal]]
