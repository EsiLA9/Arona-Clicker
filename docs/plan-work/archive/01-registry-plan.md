# Registry 计划

## 1. 设计原则

- Registry 是 Datapack 的编译态，只读；所有运行时变化仍写入 PlayerState。
- Registry 只接受已经解析的完整启用集，不感知文件、ZIP、IndexedDB 或 UI。
- 所有表通过 `tableSteps` 统一 merge / clear；新增表必须同时补 getter、校验、引用测试和 schema。
- 校验采用两阶段：包内结构校验 + 完整启用集关系校验。
- 应用采用 all-or-nothing：dry-run 失败不 reload、不替换图片、不改变当前运行时。

## 2. 命名空间与表模型

所有可被引用或写入存档的实体最终使用 `modName:typeName:idName`。需要完成：

- S1c：`Character` → `base:character:*`，`VariantId` → `base:variant:*`，并收紧 characters / characterVariants 校验。
- 将 `affectionConfig` 改为 `affectionConfigs[]`，由角色/变体持有可选 `affectionConfigId`。
- Tag 不增加独立的 `modName` 字段；TagRef 统一使用 `modName:tagPath`，例如 `base:office/defense`、`my-mod:haunted/underground`。
- TagDef 保存完整 TagRef、可选完整 parent TagRef、名称和简介；子路径继承根命名空间，不重复携带 modName。
- 公共玩法 Tag 由 `base` 或协议包拥有；扩展包可以引用公共 Tag，也可以通过显式 parent 跨包挂靠，但不能静默覆盖其他包的 TagDef。
- Tag 索引、条件、Affector、TagStat 和动态 Tag 全部以完整 TagRef 为身份，按显式 parent/祖先链展开。
- extras v1 仅允许指定产品内容包提供；其他包携带时警告并忽略。
- 图片资源继续使用 mod 前缀隔离，PicDef 的 `src` 在解析阶段规范化。

## 3. 加载与校验管道

### 阶段 A：包级校验

`parsePack(source)` 负责：manifest、JSON 分片、图片、路径错误报告和包元数据一致性。补齐：

- `FilePackSource`：单 JSON 文件。
- `FolderPackSource`：File System Access API 目录快照。
- 扩展名解析器注册表，初期只注册 `.json`。
- `StoredPack` 保存可重建的原始来源快照或等价字节，不能只依赖当前页面内存。

### 阶段 B：启用集 dry-run

新增独立 `validateDatapackSet(datapacks)`，由 Runtime 在应用前调用：

1. 检查每包 manifest 与实体 modName 一致。
2. 检查单包内部重复 ID。
3. 合并所有表后检查完整 ID 重复；同一完整 ID 不允许后包覆盖前包。
4. 合并完成后统一检查所有真引用；允许跨包引用，悬空引用拒绝整个启用集。
5. 检查匿名 Trigger 等明确豁免项，避免把匿名运行时 ID 当作实体 ID。
6. 检查枚举、DSL、Extra、图片引用和单值配置策略。
7. 检查 TagRef 格式、TagDef 的 owner 与当前包一致、parent 是否存在；公共 Tag 的跨包引用允许通过，悬空 parent 拒绝启用集。

`Registry.load()` 应保留单包便捷入口，但多包主入口必须使用完整集合校验，不能逐包先行拒绝合法跨包引用。

### 阶段 C：正式构建

dry-run 通过后，清空旧 Registry 和所有依赖 Registry 的运行时索引，再按手动顺序 merge：

```text
Registry tables → relationship indices → character/story refs
→ GameNum → TagStat → PassivePool → Visibility → image registry
```

若 `reload` 或后续索引构建失败，应定义回滚边界：至少保证 dry-run 失败不触碰旧运行时；正式应用阶段需要在 Runtime 层保留旧包集与旧图片注册表，直到新集初始化完成。

## 4. PackManager 与应用层待办

- 导入 ID 改为稳定的 `contentHash` 或 `modName@version#hash`，避免同版本不同内容互相覆盖。
- 同 modName 不同包允许在包库并存，启用集内仍只能启用一个。
- 启用集变更先生成候选快照，再 dry-run，再 commit 包库状态和 Runtime。
- 恢复包库后按快照启用集应用；不能无条件加载默认包覆盖恢复结果。
- 默认内容作为“首次启动的默认启用集”，不能作为每次启动的强制内容。
- 依赖仍只做提示和排序参考，不自动下载、不自动启用。
- UI 补充移除包、导入失败详情、来源类型、内容 hash 和应用失败后的旧状态保持。

## 5. Registry 验收

- 两包同 `idName`、不同 modName 可同时加载。
- 同一完整 ID 重复必拒绝，且旧 Registry 不变。
- A 包引用 B 包实体可通过；悬空引用拒绝。
- 启用集顺序稳定地决定遍历顺序。
- 同 modName 冲突拒绝并回滚启用状态。
- 三种 Source 解析出的 Datapack 结果一致。
- reload 后所有派生索引重建，旧包实体不残留。
- `base:office` 能命中 `base:office/defense` 及显式挂靠的扩展 Tag。
- 两个包都可拥有名为 `office` 的私有 Tag，但完整 TagRef 不冲突。
- 扩展包引用 `base:office` 时不需要复制或重新定义公共 Tag。

## 当前实现进度

- 已完成 TagRef 基础 API：`tagRef`、`parseTagRef`、`isTagRef`、`tagKey`。
- 已完成 Registry TagDef 完整键、显式 parent 校验、跨包 parent 祖先索引和 Tag 查询。
- 已完成动态 Tag、TagStat、条件依赖和 GameNum Tag 效果的稳定键迁移。
- 已完成编辑器 TagDef parent 字段和 hasTag/countTags 的 Tag 表引用。
- 尚未完成：所有 Datapack 内容迁移为显式 TagRef、跨包 Tag owner 归属推导、Tag 残留存档过滤与完整编辑器跨包候选集。
