# Task 0085：Def 审计时间元数据与无时间内容兼容

状态：已完成

## 背景

后续需要为各类 Def 提供创建时间与修改时间，以支持按最近修改、创建时间范围和来源数据包进行快速筛选。当前实体类型没有统一的审计时间字段，RuntimeEditor 也没有在 Def 创建与修改时记录时间。

同时，历史 Datapack 内容不会全部具备时间字段。兼容策略必须避免在加载过程中修改原始内容，但在 Registry 的排序与筛选语义中，应将无时间内容视为极早值，使其稳定排在有时间内容之前。

## 目标

1. 为后续各类 Def 预留统一的创建时间 / 修改时间元数据。
2. 明确时间字段的来源、写入时机和不可变规则。
3. RuntimeEditor 创建或成功修改 Def 时正确维护时间元数据。
4. 缺失时间的历史内容继续可加载，并在 Registry 查询中按极早值处理。
5. 不让 Affector 的运行时覆盖或追加内容伪装成 Def 本体修改。

## 已裁定设计

### 元数据结构

使用可复用的嵌套结构，避免各实体重复声明字段：

```ts
interface DefMetadata {
  createdAt: number;
  updatedAt: number;
}

interface SomeDef {
  metadata?: DefMetadata;
}
```

时间使用 Unix milliseconds。UI 负责本地化展示，查询层直接进行数值排序和范围比较。

### 时间语义

- `createdAt`：Def 第一次成功创建的时间，之后保持不变。
- `updatedAt`：Def 最近一次成功写入的时间。
- 表单输入、页面切换和 Draft 暂存不更新正式 Def 时间。
- RuntimeEditor 新建并成功提交时同时写入两个字段。
- RuntimeEditor 成功替换已有 Def 时保留 `createdAt`，更新 `updatedAt`。
- Apply 失败、校验失败和回滚不得更新时间。

### 无时间内容兼容

- `metadata` 在 Datapack Def 中保持可选，以兼容历史内容。
- Registry 不在加载时向原始 Def 写入补丁时间，也不改变 Datapack 快照。
- Registry 对外提供有效审计时间：缺失的 `createdAt` 或 `updatedAt` 使用统一的极早值 `Number.MIN_SAFE_INTEGER`。
- 排序与筛选使用有效审计时间；因此无时间内容稳定视为最早内容。
- UI 可将缺失状态显示为“时间未知”，不能把极早值直接展示给用户。
- 若只有一个时间字段缺失，两个字段分别按各自的极早值处理，不互相推导。

### Affector 边界

Affector 的覆盖、追加价格组或其他运行时派生内容不修改 SpotDef 的 `metadata.updatedAt`。Affector 若未来需要审计时间，使用自身的运行时记录，不复用 Def 本体时间。

## 实施范围

### 包含

- 在基础数据服务契约中新增 `DefMetadata`。
- 盘点并为可扩展 Def 类型预留可选 `metadata` 字段，优先覆盖当前 Registry 聚合表。
- Registry 保留原始元数据，并提供缺失时间的有效极早值查询语义。
- RuntimeEditor Spot 创建 / 成功替换时写入和保留时间。
- Datapack 解析、Registry 加载、Runtime 热更新的 round-trip 测试。
- 为未来可视化筛选提供按创建 / 修改时间排序与比较的只读查询边界。

### 不包含

- 对历史 Datapack 批量补写时间。
- PlayerState 或存档迁移。
- 完整的可视化筛选界面。
- Affector 审计系统与有效内容派生时间。
- 使用文件系统时间或导入时间替代 Def 创建时间。

## 查询契约

建议提供统一的 Registry 查询结果，而不是让每个 UI 调用方自行判断缺失值：

```ts
interface EffectiveDefMetadata {
  createdAt: number;
  updatedAt: number;
  createdAtKnown: boolean;
  updatedAtKnown: boolean;
}
```

其中数值字段用于排序 / 筛选，`Known` 字段用于“时间未知”的展示和后续筛选条件区分。

## 验收标准

- 新增 Def 可以携带统一 `metadata`，不破坏现有 Def 字段语义。
- Registry 加载带时间与不带时间的内容后，原始 Def 均不被隐式改写。
- 无时间内容的有效创建 / 修改时间均为 `Number.MIN_SAFE_INTEGER`，并排在有时间内容之前。
- 缺失时间不会导致 Registry 校验失败或旧包无法加载。
- RuntimeEditor 新建 Spot 时写入创建 / 修改时间。
- RuntimeEditor 修改 Spot 时创建时间不变，修改时间更新。
- 失败提交、草稿暂存、Affector 运行时变化不会错误更新 Def 时间。
- 时间排序、缺失值兼容和 RuntimeEditor round-trip 测试通过。
- 机制文档同步说明元数据与极早值策略。

## 关联代码与文档

- `src/data-services/contracts/common.ts`
- `src/data-services/contracts/`
- `src/data-services/registry/registry.ts`
- `src/data-services/authoring/`
- `src/ui/runtime-editor/`
- `src/arona-clicker/contracts/runtime-content.ts`
- [[docs/docs-828/03-data-structures/type-boundary-audit]]
- [[docs/docs-828/02-modules/registry]]
- [[docs/docs-828/02-modules/runtime-editor]]

## 执行记录

- 2026-09-16：新增通用 `DefMetadata`、`EffectiveDefMetadata` 与 `MISSING_DEF_TIME`；Spot 首先接入 `metadata`。
- 2026-09-16：Registry 增加 Spot 有效元数据查询，缺失时间按 `Number.MIN_SAFE_INTEGER` 返回且不改写原始 Def。
- 2026-09-16：RuntimeEditor Spot 创建 / 替换维护创建时间与修改时间；相关测试 39 项通过。
