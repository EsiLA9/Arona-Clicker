# ADR-001 rev2 PassiveStoryEntry 的主导聚集化与动态抽选机制

- 状态：已确认设计（经两轮 grill 盘问）
- 日期：2026-08-20（v1）/ 2026-08-21（rev2）
- 关联：`10-story-graph.md`、`02-data-structures.md`、`03-engine-subsystems.md`
- 术语表：`GLOSSARY-passive-tags.md`

## 修订记录

- **rev2（本文）**：废弃 v1 的「平铺 `tags: TagPath[]` + OR 准入」模型，改为**主导维度（Lead）结构化聚合**；新增 `CharacterGroupDef` 与拒绝采样、双轨保底（显式 pity + trigger 派生 wantedSet）、`explainPassivePool` 诊断视图；明确各计数的三层状态归属。
- v1（2026-08-20）：确立 tag gate/boost/lock、软衰减、分桶索引的基本盘，未实现即被 rev2 取代。

## 背景与问题

当前 `PassiveStoryEntry`（`src/engine/types/entities.ts:462`）仅有
`weight / repeatable / availableInits / triggerCondition`，抽选是
`registry.passiveStories` 全量 O(n) 过滤 + 加权转盘（`passive-picker.ts`）。需要支持：

1. **聚集化**：降低抽选扫描成本；让玩家尽量少看到相同 Story（去重）。
2. **动态池**：不同 Area 的可抽选集合随进程变化——Spot 增删导致某类 story 准入/准出；
   主线进度 / Spot 功能选择显著提升某类抽取率（boost）或锁定只能抽某些池（lock）；
   招募角色使相关 entry 可被抽选或提权。
3. **强制逻辑与保底**：部分 entry 充当剧情/判断接口（如羁绊链全收集才放行后续主线），
   纯随机可能导致玩家长期抽不中，需要保底与补偿机制；entry 天然带多个维度
   （地点 × 角色 × 主题），需要高效且不过度复杂的筛选模式。

## 决策（经两轮盘问确认）

| 维度 | 决策 |
| --- | --- |
| 多维度准入语义 | **结构化 AND**：不做平铺 tag 的任意布尔组合；entry 声明单一**主导维度**定一级分桶，次级维度用拒绝采样软约束 |
| 主导维度枚举 | 四种全做：`spot` / `character` / `area` / `init`（1-N 向下聚合的顶层键） |
| 多角色组合 | 新增 `CharacterGroupDef`；**group 合法性是硬前置**（不合法 → 引用它的 entry 不可选） |
| 角色匹配失败处理 | **拒绝采样**：重掷 ≤K 次，耗尽则**强制采纳最后命中者**（宁可不严格不空手） |
| lock 与基础闲聊 | lock 激活时严格排除一切非锁定池 entry；entry 可用 `lockExempt` 主动豁免 |
| 软衰减计数层 | `passivePlayCounter` / `passiveLastPlayed` 放 **global 层**（跨世界线连续） |
| 保底计数层 | `passiveMissStreaks` 放 **per-Init 快照层**（保底常绑定世界线内收集任务） |
| `areaTagState` 层 | **per-Init 快照层**（Area 从属于 Init） |
| 保底双轨 | A 轨：entry 显式 `pityAfter`（数值或预设串）；B 轨：trigger 条件涉及 Story 收集/次数判定时自动构建 wantedSet，施加**固定提权倍率** |
| 去重策略 | 软衰减：最近播过的 entry 权重临时降低，随「又播出了几条」计数恢复 |
| 可抽选集合真相来源 | **派生**自在场实体：当前 Area 内 Spot.tags ∪ 已解锁角色的 tags/组，不持久化存储 |

## 数据结构变更

### 1. 主导维度 `PassiveLead`（新增，`entities.ts`）

```ts
type PassiveLead =
  | { kind: 'spot'; tags: TagPath[] }            // 桶键：spot tag（层级前缀登记）
  | { kind: 'character'; refs: (Character | GroupId)[] }
  | { kind: 'area' }                             // 当前 Area 即准入（「基础闲聊」的表达方式）
  | { kind: 'init' };                            // 当前 Init 即准入
```

- 「无标签基础闲聊」不再需要特判：用 `{kind:'area'}` 或 `{kind:'init'}` 表达。
- `spot` 主导桶内多 tag 为 OR（任一命中活跃池即入桶）；跨维度 AND 由结构保证
  （主导维度定桶 + 拒绝采样约束次级维度），不做任意布尔表达式。

### 2. `CharacterGroupDef`（新实体，Datapack 新表 `characterGroups`）

```ts
interface CharacterGroupDef {
  id: GroupId;
  name: string;
  members: Character[];
  /** 合法性：需解锁成员数下限。缺省 = 全部解锁才合法。 */
  minUnlocked?: number;
  /** 合法性：某 tag 的已解锁角色数下限（如「防御部角色 ≥ 2」）。 */
  minUnlockedByTag?: { tag: TagPath; count: number }[];
}
```

- 合法性在**候选过滤阶段**硬判定：group 不合法 → 引用它的 entry 直接退出候选。
- registry 加载时校验 `refs` / `members` 引用完整性。

### 3. `PassiveStoryEntry` 重构（`entities.ts:462`）

```ts
interface PassiveStoryEntry extends StoryEntryBase {
  type: 'passive';
  repeatable: boolean;
  weight: number;
  lead: PassiveLead;                                // 一级分桶 + gate 判定
  /**
   * 次级角色约束（拒绝采样软校验）：转盘命中后检查，
   * 不满足则重掷 ≤K 次，耗尽仍不满足则采纳最后命中者。
   */
  requireCharacters?: (Character | GroupId)[];
  /** lock 激活时仍可抽（主动豁免锁定排除）。 */
  lockExempt?: boolean;
  /** A 轨显式保底：连续 N 次未命中后必中。数值或预设档位串。 */
  pityAfter?: number | string;
  // availableInits / triggerCondition / completionReward 继承自 StoryEntryBase
}
```

- 预设串（如 `'chain-critical'`）在 datapack 级 `guaranteePresets: Record<string, number>`
  中转义为数值；未登记的预设串视为配置错误，registry 校验报错。

### 4. `PlayerState` 新增字段（三层归属）

```ts
interface PlayerState {
  // --- global 层（跨世界线保留） ---
  passivePlayCounter: number;                  // 被动闲聊累计播完条数
  passiveLastPlayed: Record<StoryId, number>;  // entryId -> 上次播完时的 counter（软衰减）
  // --- per-Init 快照层 ---
  passiveMissStreaks: Record<StoryId, number>; // 仅记录声明了 pityAfter 的 entry（有界）
  areaTagState: Record<AreaId, AreaTagRuntime>;
}

interface AreaTagRuntime {
  multipliers: Record<TagPath, number>;  // tag -> 权重倍率，缺省 1
  lockedTags: TagPath[];                 // 非空时仅这些池可抽（lockExempt 除外）
}
```

### 5. `EffectOp` 扩展（`expression.ts`）

```ts
| 'setAreaTagWeight'    // target=`${areaId}:${tag}`，value=倍率
| 'lockTagPool'         // target=areaId，value=tag，加入 lockedTags
| 'unlockTagPool'       // target=areaId，value=tag，移出 lockedTags
| 'clearTagPoolLock'    // target=areaId，清空 lockedTags
```

- 招募角色不新增 op：复用 `setFlag('char_unlock_<id>','true')`，
  池经 `CharacterSystem.getUnlocked` 自动纳入。
- 池本身不存储：活跃集合每次抽选时由在场实体派生。

## 注册期分桶索引

`StoryService` 构建期按 `lead.kind` 维护四张倒排表：

```ts
spotTagToEntries: Map<TagPath, Set<StoryId>>;    // spot 主导：每个 tag 及祖先前缀登记
charToEntries: Map<Character | GroupId, Set<StoryId>>;  // character 主导：逐 ref 登记
areaEntries: Map<AreaId, Set<StoryId>>;          // area 主导
initEntries: Map<InitId, Set<StoryId>>;          // init 主导
```

- 层级登记：entry 的 spot tag `office/defense` 同时登记到 `office` 与 `office/defense` 桶
  （父 tag 命中子 entry；反向不命中，避免过宽）。
- 抽选候选 = 各表命中桶的并集，**非全量扫描**。

## 抽选管线 v2

输入：`initId`（= activeInit）、`areaId`（= activeArea）。

```
1. 派生活跃集合（复用现有解锁模型，不新增存储）
   activeSpotTags = spotsIn(areaId).flatMap(s => s.tags)
   activeChars    = characterSystem.getUnlocked(state)   // flagged + 已指派 manager
   validGroups    = characterGroups 中满足 minUnlocked / minUnlockedByTag 者

2. 候选准入（四桶并集 + 硬过滤）
   candidates = spotTagToEntries[∩ activeSpotTags] ∪ charToEntries[activeChars ∪ validGroups]
              ∪ areaEntries[areaId] ∪ initEntries[initId]
   for each candidate:
     if weight<=0                          -> 排除
     if availableInits 非空 且 不含 initId  -> 排除
     if triggerCondition 存在且不满足        -> 排除
     if !repeatable && hasCompleted(entry)  -> 排除
     if 引用的 group 不合法                  -> 排除   // group 硬前置
     if lockedTags 非空 且 !lockExempt 且 lead 池 ∩ lockedTags 为空 -> 排除
                                                  // lock 严格排除，含 area/init 主导基础闲聊

3. B 轨提权（trigger 派生 wantedSet）
   wantedSet = registry 加载期扫描所有 ConditionGroup（Trigger / triggerCondition /
               conditionalRewards）中 hasReadStory / 阅读次数谓词引用的、
               可由 passive 完成的 storyId
   boost_B = wantedSet 含该 entry ? WANTED_BOOST(常量，如 ×3) : 1

4. 有效权重
   gap   = passivePlayCounter - passiveLastPlayed[entry]      // global 层
   decay = DECAY ^ max(0, gap - GRACE)                        // DECAY=0.5, GRACE=0
   boost_A = max( multipliers[entry 命中的 spot tag] ) 默认 1  // boost
   effWeight = entry.weight * boost_A * boost_B * decay

5. A 轨保底收窄
   stuck = candidates.filter(e => e.pityAfter && missStreaks[e.id] >= resolvePity(e.pityAfter))
   if stuck 非空: 在 stuck 内按 effWeight 转盘（多条卡住先救缺口最小者）

6. 加权转盘 + 拒绝采样
   roll 加权转盘命中 entry:
     if requireCharacters 全部满足（角色已解锁或引用合法 group）-> 选中
     else 重掷，≤REJECT_RETRY(4) 次
     耗尽仍不满足 -> 强制采纳最后命中者（宁可不严格不空手）

7. 完结回写
   on passive completion:
     passivePlayCounter++                          // global
     passiveLastPlayed[entry] = passivePlayCounter // global
     命中者 missStreaks 清零，其余有 pityAfter 的候选 +1   // 快照层
```

> 设计取向：加权转盘 + 乘性修正 + 有界重掷，**非最优搜索**，符合「无需绝对最佳、
> 不要过于繁琐」的要求。性能上候选来自桶并集，转盘与校验均 O(候选数)。

## 诊断视图 `explainPassivePool`（补偿机制的可查询面）

只读 API（UI 只读纪律），返回每个 entry 未进入候选的原因：

```ts
explainPassivePool(areaId?): {
  entryId: StoryId;
  selectable: boolean;
  excludedBy?: 'weight'|'init'|'condition'|'completed'|'group'|'lock';
  missingRefs?: { spotTags?: TagPath[]; characters?: (Character|GroupId)[] };
  // missingRefs = lead/requireCharacters 声明 − 当前活跃集合，供 UI 提示「去建造/去招募 XX」
}
```

## 用户场景 → 机制映射

| 场景 | 机制 |
| --- | --- |
| 新增 spot「防御部办公室」→ 防御系闲聊可抽 | spot.tags 进 activeSpotTags → spot 主导 entry 入桶（gate 准入） |
| 移除 spot / 切出 Area | tags 退出活跃集合 → 对应 entry 自动准出 |
| 进入主线第三章 → 「作战」类抽取率 ×3 | `setAreaTagWeight(area,'combat',3)` → boost_A |
| 活动期间只能抽「夏日」池 | `lockTagPool(area,'summer')` → lock 严格排除（`lockExempt` 可豁免） |
| 招募 Hoshino → 其闲聊可抽/提权 | `setFlag('char_unlock_hoshino')` → character 主导入桶，可叠加 setAreaTagWeight |
| 社团全员闲聊（多人组合） | `CharacterGroupDef` + `minUnlockedByTag`；不合法 → 硬排除；合法但个别成员缺失 → 拒绝采样容忍 |
| 羁绊链 5 条须全收集才放行主线 | 编辑者标 `pityAfter`（A 轨硬保底）；主线 trigger 引用收集判定 → B 轨自动 wantedSet ×WANTED_BOOST |
| 玩家不知道为什么抽不到 | `explainPassivePool` 报出 missingRefs → UI 引导 |
| 连续抽到同一条 | 软衰减 decay 压制最近播出者 |

## 待确认（假设）

- **常量默认值**：`DECAY=0.5`、`GRACE=0`、`REJECT_RETRY=4`、`WANTED_BOOST=3`。
  建议后续提到 datapack 级 passive 配置以便调参。
- **B 轨 wantedSet 范围**：目前全量扫描注册期条件；若误伤面过大（无关任务线也被提权），
  可收窄为「所属 Trigger 其余谓词已满足」时才生效——待实现后观察。
- **`requireCharacters` 是否需要 spot 版本**（`requireSpots`）：当前场景均可由 spot 主导
  lead 表达，暂不加；出现真实需求再扩。
- **pity 预设串**：`guaranteePresets` 放 datapack 顶层还是 passive 配置块内——倾向后者。

## 集成点与实施阶段

1. **类型层**：`PassiveLead` / `CharacterGroupDef` / entry 字段 / `PlayerState` 字段 /
   `EffectOp` ×4 → `npm run gen:schema`（复杂联合类型在 `editor-extras.ts` 兜底）。
2. **Registry**：`characterGroups` 表加载 + 引用完整性校验 + 四张分桶索引构建 +
   B 轨 wantedSet 扫描 + `guaranteePresets` 校验。
3. **Picker v2**（纯逻辑，`passive-picker.ts` 重写）：上述管线 2–6 步 +
   `explainPassivePool`；测试覆盖 gate/boost/lock/decay/pity/拒绝采样/explain 七类场景
   （架构纪律「测试先行」，`npm test` 通过才算完成）。
4. **StoryService 集成**：注入 `characterSystem`（`game-instance.ts` 已持有）；
   `triggerPassiveStory`（`story-service.ts:189`）改调 v2；完结回写三处计数。
5. **Effect 引擎**：分发新增 4 个 Area 运行时 op。
6. **数据迁移**：`src/data/base/stories.ts` 的存量 passiveStories 补 `lead` 字段
   （现值多为 `{kind:'area'}`）。
