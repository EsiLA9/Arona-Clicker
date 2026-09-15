# Save 计划

## 1. 存档模型

存档分成三部分：

```text
SaveEnvelope
├── formatVersion / timestamp
├── active: 当前 Registry 可识别、可运行的状态视图
├── retained: 当前 Registry 不识别的原始状态残留
└── runtime cursors / stats / visibility（可重建项按策略处理）
```

当前已落地的边界包括 `SaveData.playerState.spotTagOverrides` + `SaveData.retained.spotTagOverrides`，以及 `tagEffects` 的同构分流：活跃数据进入 Runtime，禁用命名空间数据进入 retained；保存时会与运行时持有的 retained 合并后重新分流。不要把残留数据转换成未知的空对象。

## 2. 惰性保留规则

读档时用当前 Registry 建立存在性谓词：

```ts
isKnown('base:spot:x', 'spot') === registry.spots.has(id)
```

### 需要过滤的 ID 索引结构

- Global / 当前层资源键与 Spot：`spotLevels`、`spotManagers`、`spotTagOverrides`。
- 世界线：`activeInit`、`currentAreaId`、`visitedAreas`、`visitedInits`、`unlockedInits`、`initSnapshots`。
- 进度：`unlockedEnhancements`、`enhancementAttachments`、`storyLog`、`storyReadLogs`、`triggersCompleted`。
- 收集与角色：`roster`、`fragments`、`gachaState`、`equipmentsOwned`、`studentBlocks`。
- 故事游标：当前 entry、本体 story、insert stack、visited story、chat cursor。
- 动态效果与冷却：`tagEffects`、`entityEffects`、`passiveCooldowns`，按其 key 的实体语义分别处理。
- 动态 Tag：`spotTagOverrides.added/removed` 与 `tagEffects` key 必须保存完整 TagRef 语义；禁用 Tag 所属 mod 后进入残留，重新启用后复活，残留不参与当前结算。
- `flags`、普通资源、用户主题等非实体键默认保留；若未来引入 mod-owned key，应另加所有权元数据。

每个结构必须定义三种行为：

| 数据 | 活跃 | 残留 | 清除 |
| --- | --- | --- | --- |
| map | 进入运行时 map | 原键值保存 | 按 mod 前缀删除 |
| array | 进入运行时 array | 原元素保存 | 删除匹配元素 |
| scalar ref | 可解析则恢复 | 置为安全空值/默认值，原值进入残留 | 删除原值 |
| story cursor | 可解析则恢复 | 结束当前游标并保留游标原文 | 删除对应残留 |

## 3. 三层状态规则

- Global 数据的残留必须独立于 per-Init 快照保留，不能因为切换世界线而丢失。
- `initSnapshots[initId]` 的 key 本身也要过滤；快照内部再按相同规则过滤。
- 当前 `activeInit` 不存在时，不强行进入未知 Init；进入安全空状态，并在 UI 提示残留来源。
- 重新启用 mod 后，下一次读档将从 retained 原文重新筛选并复活。
- 读档后的 Visibility、Affector、TagStat、GameNum 等派生数据统一重建，不从残留或旧快照直接恢复。

## 4. Save API 计划

新增独立的纯数据服务，避免把过滤逻辑塞进 `Runtime`（当前 TagOverride 已有独立纯函数实现，后续按同一接口扩展）：

- `SaveResidueIndex`：扫描 Save，按 modName / table / count 生成报告。
- `filterSaveForRegistry(save, registry)`：返回 `{ activeSave, retained }`，不修改输入。
- `mergeRetainedOnSave(active, retained)`：保存时全量写回，保留未知字段和值。
- `clearSaveResidue(save, selector)`：按 modName 清除，返回删除计数和新 Save。
- Tag 专项清除已具备纯函数 `clearTagResidueByMod`，覆盖 `spotTagOverrides` 与 `tagEffects`，其余实体结构沿同一契约扩展。
- Tag retained 已有真实 `GameInstance.save → load → save` 往返测试：禁用 namespace 不进入 active state，二次保存仍保留原文。
- GameInstance 已提供 `getTagResidueSummary()` 与 `clearTagResidueByMod()`，供包管理/存档检查 UI 展示和隔离清除；清除仅作用于 retained，不修改 active PlayerState。
- 带冒号但不符合 TagRef 语法的动态 Tag/TagEffect key 强制留在 retained，不参与当前结算。
- `validateSaveShape(save)`：只做 DTO 形状检查，不因未知实体报错。

所有方法应是纯函数；Runtime 负责把 active 结果交给现有 restore 流程，UI 只消费 residue report 和 clear 命令。

## 5. 安全与一致性

- 残留数据不参与条件、生产、抽卡、剧情、统计或 UI 查询。
- Tag 残留不得降级成裸路径；必须保留完整 `modName:tagPath`，否则无法判断跨包复活和清除边界。
- 存档中出现未知 mod 不报错；Datapack 启用集中的悬空引用仍必须报错，两者不可混淆。
- 清除操作必须先生成报告，再由玩家确认；清除后保存前可提供计数反馈。
- 导入、停用、排序、reload 不得自动删除 Save。
- Save 中的 `version` 只用于当前 DTO 形状判断；不实现历史存档迁移。
- 如果当前运行时无法安全恢复（例如 activeInit 悬空且没有安全起点），应进入“残留检查/重新开始”状态，而不是加载半有效状态继续结算。

## 6. Save 验收

- 禁用 mod 后读档成功，未知实体不出现在 Runtime / GameView。
- 保存后未知实体仍原样存在。
- 重新启用 mod 后读档，原数据恢复。
- 按 mod 清除只删除目标残留，其他 mod 和活跃数据不变。
- 每种 map / array / scalar / cursor 结构都有单独测试。
- 当前 Init、per-Init 快照、global 归属和 CharacterPersistConfig 都有测试。
