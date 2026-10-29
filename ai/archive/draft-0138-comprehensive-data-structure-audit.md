# 综合游戏数据结构设计与实例核验报告

状态：draft — 🟡 结构审计完成，待将风险项拆为独立施工任务

## 1. 结论摘要

当前游戏数据主链路是连贯的：

```text
Builder / JSON 分片
  → Datapack 合约
  → Fragment / Pack Parser
  → Registry 校验与按 ID 合并
  → Story / Init / Trigger / Affector 等运行时服务
  → Runtime Content Browser / UI 只读投影
```

已有实例能够证明：

- `baseDatapack` 可以进入 Registry 并启动游戏；
- `datapack/AronaClickerCore/*.json` 可以合并为 ZIP Datapack 并通过 Registry 校验；
- `datapack/addition_test` 可以与 base 一起加载，Init、Area、Story、Item、Tag、Gacha 等跨表引用可以解析；
- StoryEntry 的 `storyId`、Init 的 `startStoryId`、Area 的 `initId`、Spot 的 `areaId` 等关键关系已有校验或测试覆盖；
- StoryEntry Reaction 已能在 Builder → Registry → Runtime Trigger 链路中工作，未激活时不进入 TriggerSystem 事件桶。

但“结构可加载”不等于“所有语义引用都被静态校验”。当前主要风险集中在：

1. 默认产品内容与外部 JSON 数据包是两套并行来源，部分同名内容已经出现行为差异；
2. Fragment Parser 只做顶层结构识别，嵌套字段大量依赖 TypeScript cast；
3. Effect、Condition、Reaction 内部的目标引用没有统一的 Registry 级校验；
4. 多数据包覆盖采用按 ID 的后加载覆盖，尚无统一的冲突 / 追加 / 合并语义；
5. Runtime Content Browser 的关系扫描是通用字符串扫描，能够发现很多关系，但不能完全表达关系类型，也可能把同一实体在不同路径上的多次出现展示为多条关系。

## 2. 当前数据层分工

### 2.1 声明层

| 层 | 主要类型 | 职责 | 是否应保存运行时派生值 |
| --- | --- | --- | --- |
| 世界实体 | `InitDef` / `AreaDef` / `SpotDef` | 世界线、区域、设施与静态拓扑 | 否 |
| 剧情本体 | `StoryDef` / `Talklet` | 文本、选项、演出效果 | 否 |
| 剧情入口 | `ActiveStoryEntry` / `PassiveStoryEntry` | 投放条件、入口方式、奖励、归属与 `storyId` | 否 |
| 世界规则 | `TriggerDef` | 无天然 StoryEntry 所属关系的事件规则 | 否 |
| 持续规则 | `AffectorPackDef` | 持续生产 / 区域 / 标签作用 | 否 |
| 表现辅助 | `Presentation` / `PicDef` / `TagDef` / `Extra` | 名称、说明、主题、资源和附加数据 | 只保存声明 |
| 运行时状态 | `PlayerState` | 当前 Init、资源、日志、完成记录与玩家选择 | 是，但只保存状态 |

### 2.2 StoryEntry 与 Story 的关系

`StoryDef` 只持有演出本体；`StoryEntry` 通过 `storyId` 指向本体，并额外承担投放世界线、入口条件、重播策略、完成奖励、归属与阻断等语义。`reactions` 是 StoryEntry 的完成后局部事件反应声明；`StoryEntryReactionMount` 才将其转换为稳定 ID 的 Runtime Trigger。Binding、分组和事件桶均属于运行时派生内容，不应写入 JSON、Registry 独立表或存档。

## 3. 文件与实例核验

### 3.1 默认产品内容

正式应用入口是 `src/arona-clicker/content/default-datapack.ts`。它组合 `baseInits`、`baseAreas`、`baseStories`、`baseActiveStories`、`basePassiveStories`、`baseTriggers` 等代码 DSL，并在组合时为部分世界实体补充规范化 `presentation.default`。

这条链路与 `src/data/base/datapack.ts` 的测试 / 示例 Datapack 入口不同。后者同样组合默认内容，但用途是测试与示例，不应被误认成正式产品内容源。

### 3.2 外部 JSON / ZIP 数据包

外部数据包采用 `manifest + JSON 分片 + assets → Pack Parser → Fragment Parser → Datapack`。`datapack/addition_test` 的实例核验表明：观测世界线的默认 Area、起始 Story、购买资源与 Reveal 条件可解析；被动 Story、支付组、Tag、Extra、图片和卡池可进入 Registry；与 base 合并后 Runtime Content Browser 能返回已解析关系。

### 3.3 已确认的内容源差异

`datapack/AronaClickerCore/09-triggers.json` 与 `src/arona-clicker/content/triggers.ts` 并不是同一份内容的机械序列化：

- JSON 中存在 `base:trigger:first_credit`，效果是增加 `base:item:field_note`；
- 当前代码 DSL 中对应的是 `base:trigger:first_credit_milestone`，效果是增加信用点；
- JSON 中还包含 `extra.name_zh` 描述，而代码 DSL 版本未使用同一条目结构。

这不是 Registry 结构错误，两个来源各自都能通过对应测试；但如果 JSON 被视为正式产品内容的发布镜像，则已经发生语义漂移。必须明确“代码 DSL 是正式源”还是“JSON 是正式源”。

## 4. 引用完整性审计

### 4.1 已覆盖关系

当前 Registry 已覆盖或测试验证 Init → Area、Area → Init、Area → Spot、Spot → Area、Area → adjacent Area、Init → Story / ActiveStoryEntry、StoryEntry → Story、PassivePool → PassiveStoryEntry、Shop → Section / Entry / Item、GachaPool → CharacterVariant / 资源、CharacterVariant → Curve / FavoriteItem / UniqueWeapon / Trait / Gear、Pic / CharaProfile → Pic、Presentation → ColorGroup 等关系。

### 4.2 尚未统一静态校验的关系

以下关系仍主要依赖运行时效果执行、通用字符串扫描或内容作者自律：

- `Effect.target` 对 Item、Resource、Story、Character、Spot 等目标的统一类型检查；
- `TriggerDef.effects` 与 StoryEntry Reaction 的事件参数、效果目标；
- Condition 中 `key` 所指向的实体、资源、标签、统计项；
- Talklet / Choice 效果中的 Item、Resource、Story 跳转目标；
- Init Trigger 与 StoryEntry Reaction 的重复行为或同一事件双重触发；
- 外部包 StoryEntry 指向已加载其他包 Story 的跨包 `storyId`。

特别是 `validateDatapack` 对 StoryEntry 的 `storyId` 只使用本次 Datapack 的 `stories` 集合；因此“Entry 在扩展包、Story 在基础包”的组合尚未成为完整支持路径。addition-test 没有触发该缺口，因为它的 Story 与 Entry 都在同一包内。

## 5. Registry 合并与数据所有权

Registry 对大多数实体使用 `Map<id, def>`，后加载相同 ID 的定义覆盖前者。该行为简单且查询成本低，但没有统一的显式 replace / append / conflict 语义；StoryEntry 的 `reactions` 也不能跨包追加，只能随整个 Entry 覆盖。

因此应把“实体覆盖”和“集合追加”分为两种操作。Reaction、Tags、PassivePool children 等集合型字段不应默认采用 last-write-wins。

## 6. Parser、Contract 与 Schema 边界

Fragment Parser 正确识别 Datapack 顶层列表和单例字段，列表分片按声明顺序拼接，Pack Parser 处理 manifest、ZIP、图片和 JSON 分片；但已识别列表中的元素直接 cast 为目标类型，嵌套 schema 主要依赖 Registry Validator。

因此新增字段若只修改 Contract：

- JSON 可以被读取但字段可能没有合法性检查；
- Runtime Editor / 图鉴不一定自动获得对应编辑或关系语义；
- Reaction 的 `id` 重复、空字符串、无效事件参数、无效效果目标目前不会在 Registry 阶段明确报错。

Contract、Registry Validator、Runtime Browser、Runtime Editor 描述器和测试应作为一个变更单元同步维护。

## 7. Runtime Content Browser 与重复关系

Runtime Content Browser 当前递归收集每个实体的所有字符串，再依据完整 ID 候选集判断 `missing / resolved / ambiguous`。同一个目标在多个字段出现、同时作为 owner 与 storyId 出现、自引用字段出现，都会形成多条关系诊断。

这通常是“关系实例重复”，不是底层数据表重复。推荐底层保留每个真实路径，UI 默认按目标实体聚合，并把多个路径折叠成一项、显示路径数量；所属关系、自引用和普通引用应分组展示。不要把 Runtime Trigger / Binding 伪装成额外数据实体。

## 8. 与前端及性能约束的关系

- Registry 只提供只读实体与查询快照；
- UI 使用 `getView()` / Browser detail，不持有 Registry 写引用；
- 关系扫描与派生索引只在 Registry 内容修订时重建；
- 查看单个详情只刷新详情区域与相关关系区域，不重建顶部标题、实体列表或整个 Codex Shell；
- 语义摘要从字段路径和关系类型生成紧凑文本，不额外构造统计服务；
- 不为每条 Relation 创建巨大卡片、重复标题或全量 JSON 展开块。

## 9. 建议处理优先级

### P0：明确来源事实

1. 规定 `default-datapack.ts` 与 `datapack/AronaClickerCore/*.json` 的权威关系；
2. 若 JSON 是发布镜像，增加 DSL → JSON 一致性检查；
3. 若 JSON 是独立兼容包，明确它不保证与默认产品内容逐条一致。

### P1：补齐结构校验

1. 为 StoryEntry Reaction 增加 `id` 非空 / 同 Entry 内唯一校验；
2. 校验 Reaction 的事件参数与 `activation / lifetime` 枚举；
3. 为 StoryEntry、Talklet、Choice、TriggerDef 统一建立 Effect 目标解析器；
4. 明确跨包 Story / Entry 引用是否支持，并把 Registry 已加载 ID 传入校验上下文；
5. 对顶层未知字段给出诊断，避免分片内容静默丢失。

### P2：统一关系投影

1. 将字段路径映射集中到关系描述表；
2. 增加 Reaction、Effect、Condition 的语义关系类型；
3. 图鉴按目标聚合重复路径，保留“展开路径”而不是重复渲染多个项目；
4. 为每条关系保留来源 Entry 与原始路径，但不新增运行时实体表。

### P3：处理多包写入语义

1. 实体定义使用显式 replace；
2. 集合字段使用 append / replace / remove；
3. 同 ID 冲突必须诊断，不再默认静默覆盖；
4. Definition Patch 稳定后再开放 Runtime Editor 的跨包追加。

## 10. 当前审计结论

当前实例没有发现会阻止 base 与 addition-test 加载的结构性不匹配；本次定向数据测试 43 项全部通过。

但存在三类设计级不一致：

1. **内容源漂移**：代码 DSL 与核心 JSON 示例包存在同名 Trigger 行为差异；
2. **校验覆盖不足**：嵌套 Effect / Condition / Reaction 引用尚未形成统一静态验证；
3. **关系投影重复**：图鉴看到的重复关系多数来自多路径扫描，而不是实际重复存储，当前 UI 应聚合展示。

这三类问题不应通过在 UI 中隐藏或手工修正解决，应分别在来源约定、Registry Validator 和关系投影层处理。
