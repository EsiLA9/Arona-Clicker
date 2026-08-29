# 03-data-structures/id-reference-semantics — 带 id 的 Def 条目与引用语义（真引用 / 意义引用）

> 本文回答：**哪些「带 id 的内容条目」被其他字段按 id 引用？每次引用是取目标内容生效（真引用），还是只拿 id 做身份/分组/路由键、行为由自身副本决定（意义引用）？**
> 覆盖：`src/engine/types/` 全部 Def 实体 + 运行时代码消费点核对（行号为核对时快照）。

## 判定标准

- **真引用**：引用方把 id 解析成注册表里的 Def 后，**使用该 Def 的内容字段**决定行为——目标内容变化则行为变化；悬空引用通常是加载期报错（`validateDatapack` / `validateCharacterRefs`）。
- **意义引用**：引用方只用 id 做**身份匹配 / 归属 / 分组 / 路由 / 状态键**，行为由引用方自身携带的内容（或 PlayerState 里按 id 存的副本）决定，不读目标 Def 的内容字段——即「我持有和该 id 一致的副本生效」。
- **内部身份**：id 仅用于该实体自身生命周期（挂载/卸载/once 状态/实例追踪），不存在跨 Def 引用。
- **未接线**：字段声明即存，当前无运行时消费方。

---

## 一、世界结构（Init / Area / Spot）

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `AreaDef.initId` | InitDef | 意义 | 归属键：进入判定、可见性挂载按 id 匹配运行时 `activeInit`，不读 InitDef 内容。有加载期校验 |
| `SpotDef.areaId` | AreaDef | 意义 | 归属键：Spot 挂载/展示按 id 匹配当前 Area。有加载期校验 |
| `InitDef.defaultAreas` | AreaDef | 真 | 进入 Init 时挂载这些 Area 并展开其子树（读 `area.defaultSpots` 等实际内容）。有校验 |
| `AreaDef.defaultSpots` | SpotDef | 真 | 挂载 Spot 本体（baseCost/baseYield 等全部字段参与结算）。有校验 |
| `AreaDef.adjacentAreaIds` | AreaDef | 意义 | 移动可达性：`adjacentAreaIds.includes(areaId)` 纯身份匹配。无加载期校验 |
| `InitDef.startStoryId` | StoryEntry | 真 | 进入 Init 时启动该剧情入口，经 entry → storyId 取 StoryDef 的 talklets 播放。无加载期校验（悬空引用运行时软失败 NotFound） |

## 二、剧情（Story / Entry / Pool / Talklet）

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `StoryEntryBase.storyId` | StoryDef | 真 | 播放目标 Story 的 talklets。加载期强校验 |
| `StoryEntryBase.id`（与 storyId 同值） | — | 意义 | 见「特别说明 ①」 |
| `Talklet.jumpToStory` / `StoryChoice.jumpToStory` | StoryDef | 真 | 直接查 stories 表播放目标内容（`story-jump.ts`）。无加载期校验 |
| `Talklet.kizuna.storyId` / `ChatTextEffectValue.targetStoryId` | ActiveStoryEntry | 真 | 点击卡片启动目标入口（先查 entry 再取 story 播放） |
| Effect `triggerStory` 的 target | StoryEntry | 真 | effect-engine 转发 → 查 entry 并启动 |
| `BranchGuard.storyId` / prerequisites[].storyId | StoryEntry | 意义 | 重读守卫：按 id 比较跳转目标、按 id 查 storyReadLogs 阅读记录。唯一用到 StoryDef 的仅是 talkletIndex=-1 时枚举 talklets 结构判「全部已读」，不读内容字段。无加载期校验 |
| Condition `hasReadStory` / `hasReadStoryInRun` / `visitedStoryInChain`（key=StoryId） | StoryDef | 意义 | 纯日志/游标记录身份匹配，不读 StoryDef 内容 |
| `TriggerEventDef` on:{…}（9 种 kind，见 [[docs-828/03-data-structures/declarative-dsl]] §5） | 各实体 | 意义 | 事件载荷 id 相等比较（trigger-system）；载荷 id 来自 StateMutationService 运行时快照，完全不读 Def 内容 |
| `PassivePoolChild.id` | 子池 / Entry | 真 | 解析后取目标池/entry 的**完整内容**递归抽取（children/condition/owner/weight/cooldownFrames）；「未被引用 entry 自动归默认根池」。无加载期校验 |
| `StoryEntryDef.owner` / `PassivePoolDef.owner` | CharacterVariantDef | 意义 | 聊天空间壁垒：`effectiveOwner === owner` 字符串比较，对话沙盒 key = `variant:${owner}`。全引擎无 `characterVariants.get(owner)` 取内容的路径 |
| `ActiveStoryEntry.availableInits` | InitDef | 意义 | 只比较运行时 `activeInit` 是否在列表里。加载期不校验存在性 |

## 三、角色 / 培养 / 抽卡 / 色彩

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `CharacterVariantDef.proto` | 原型角色 | 意义 | 差分自带 name/rarity/school 内容副本；proto 只做聚合/分组键（protoStats 记账、tag-stats 分组、图鉴默认差分迁移） |
| `CharacterVariantDef.curve` | CultivateCurveDef | 真 | 取 expTable/starCost/maxLevel 参与升级突破；缺省用全局默认曲线。有加载期校验 |
| `CharacterVariantDef.colorGroupId` / `SpotDef.colorGroupId` / `ColorEquipmentDef.colorGroupId` | ColorGroupDef | 真 | 取 compositionType + 各 slot 内联 hex 渲染头像/主题；加载期强校验 |
| `ThemeDef.colorGroupId` / `ThemeEffectValue.colorGroupId` | ColorGroupDef | 真 | 解析成完整 token 表；未给 token 由主色位色值派生。加载期强校验 |
| `GachaPoolDef.featured`（rates 为稀有度权重，非实体引用） | CharacterVariantDef | 真 | 抽卡按 variant 的 rarity 等字段结算、featured（UP）在所属稀有度内优先命中。有校验（validateCharacterRefs）。注意：`refreshWorldPool`（池关闭成员并入世界 Pool）已实现但无调用点，未接线 |
| `SpotDef.gachaPools` | GachaPoolDef | 真 | 取池定义渲染专有面板并跑 roll；无声明仅开全局通用池 |
| `RosterEntry.equippedEquipment` | ColorEquipmentDef | 真 | 取 effects 应用（color-equipment-system） |
| `ThemeDesignDef.entityKey` | Area / Variant | 意义 | 解锁时只作落点键：`entityThemeDesignsOwned[entityKey]` 与 setEntityThemeSlot 的键；设计自身携带 theme 内容 |
| `EntityThemeSlot.designId / equipmentId` | ThemeDesignDef / ColorEquipmentDef | designId 真；equipmentId 特殊 | designId 解析出主题；equipmentId 写入但从不被读取——装备槽实际跟随当前已装备装备，是「身份存、实时解析」 |
| `PassiveStoryEntry.owner` | CharacterVariantDef | 真 | 聊天空间壁垒：owner 声明者仅在该学生对话空间被抽取/推送（passive-pool-system 的 ownerOk 剪枝 + 就绪队列谓词） |
| `PassiveStoryEntry.pushAfterStory` | StoryDef（演出本体 id） | 真 | 羁绊尾巴挂靠：关联剧情完结后强制优先推送进 owner 对话空间（见 [[docs-828/06-adr/planning]] §3） |

## 四、物品 / 掉落 / 强化

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `DropTableDef.entries[].itemId` / `guaranteed[].itemId` | ItemDef | 真 | 抽中后经 giveItem 读 ItemDef.maxStack 并执行 pickupEffects |
| Effect `addItem` 的 target | ItemDef | 真 | effect-ops → item-service 读 ItemDef 内容发放 |
| `EnhancementDef.affectorPackIds` / `ItemDef.affectorPackIds` | AffectorPackDef | 真（字符串形式） | 字符串按 id 查注册表取 entries 参与产出；内联 AffectorPackDef 是匿名携带、先注册再用。「后加载优先」= 同 id 覆盖 |
| `EnhancementDef.attachment` | Area / Init | 意义 | 引擎完全不消费（`enhancementAttachments` 只写不读），UI 仅用 id 做面板摆位分组和名字展示 |
| `SpotFunctionalityDef.id` | —（内源/外源功能） | 内部身份 | id 仅作运行时 Affector 包命名空间键 `${fn.id}@${spotId}`；外源（Enhancement 注入）与内源同 id 时后注册覆盖，实现隐式合并/去重。不被 effect/条件引用 |

## 五、数值 / 表达式 / 事件层

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `FuncletCall.funcletId` / Value source `funclet` | FuncletDef | 真 | 取 def.calc 求值（`expression/value-system.ts:79` 经 `funclet-executor.ts`）。⚠️ calc 求值有已知缺陷恒返回 0，见 [[docs-828/03-data-structures/declarative-dsl]] §2 |
| `TriggerDef.id` | —（自身生命周期） | 内部身份 | 全局 triggerDefs 按 id 挂载/卸载/once 持久化，无任何跨 Def 引用；匿名 Trigger 派 `anon:` 派生 id |
| `AffectorEffect.id` | —（包内条目） | 内部身份 | 仅用于 AffectorInstance.activeEntryIds 追踪 |
| 各 Def 的 `tags: TagPath[]` | TagDef | 意义 | 标签是纯语义标记：匹配按 id 前缀（hasTag/countTags/tagCount/zoneModifiers），TagDef 的 name/description 仅 UI 展示 |
| 资源 id（`baseCostResource`/`baseYieldResource`/AffectorFlow.resource/…） | 资源 | 意义（状态键） | 资源在 PlayerState 按 id 存数量副本，效果的操作目标就是该 id 本身；资源 Def 的显示名/图标不参与结算 |
| `avatar` / `image` 的 PicId | PicDef | 真 | resolvePicSrc → registry.pics.get 解析成实际图片；缺图回退首字母占位 |
| `RosterEntry.variantId` / `GachaPoolState` / `storyReadLogs` / `studentBlocks` 等 | 各 Def | 意义（状态键） | 玩家层按 id 持有进度副本（等级/经验/pity/阅读记录），Def 内容不参与——这就是「我拥有和该 id 一致的副本生效」的字面形态 |

---

## 特别说明

1. **StoryEntry.id 与 StoryDef.id 同值**是最典型的「副本 id」设计：每个 Entry 都带一份与 Story 同名的 id 副本， `entry.storyId` 才是真引用（builder 缺省 `_storyId = id` ， `def-factory/story-entry.ts` ）。运行时**不强制 id\=\=\=storyId**，只有加载期校验 storyId 必须可解析——一旦启用「多 Entry 复用同一 Story」，entry.id 就退化为纯身份键，这是当前设计里最值得注意的一处。
2. **混合引用**：`setTheme` 的 value 中 `colorId` 是真引用、`entityKey` 是意义引用；`affectorPackIds` 字符串真引用、内联匿名；`EntityThemeSlot.equipmentId` 写而不读。
3. **两处未接线/未实现**：`refreshWorldPool`（池关闭并入世界 Pool）无调用点；Effect `loot` 是 no-op 预留。（原第三处 `ChatMessageDef.owner` 随 ChatMessageDef 表于 2026-08-29 移除，不再存在。）
4. **加载期校验覆盖面不一致**：有校验的（initId/areaId/defaultAreas/defaultSpots/storyId/curve/色彩系/gacha 成员）多数是真引用；而 jumpToStory、startStoryId、availableInits、adjacentAreaIds、PassivePoolChild、BranchGuard、owner 等**均无静态校验**——意义引用悬空不影响行为（身份匹配恒不中），但真引用悬空只会运行时软失败。

---

## 六、潜在设计问题（评审意见，按严重度排序）

### 1. StoryEntry.id 与 StoryDef.id 共用一个主键（最危险）

- Entry 与 Story 是两种实体（触发/奖励 vs 演出内容），却共用同一 id 值：加载期只校验 storyId 可解析，**不校验 id === storyId**——1:1 只是 builder 约定，无强制。
- **两个命名空间因巧合重合**：`triggerStory` 的 target 是 Entry id，而 `hasReadStory` 等条件的 key 是 StoryDef id（storyLog 按 StoryDef.id 记录）。今天三者相等所以不炸；一旦按规划「多 Entry 复用同一 Story」解耦，条件系统会指向错误实体。
- **跨表 id 冲突静默吞数据**：校验对 activeStories / passiveStories 分别查重，不查两表之间、也不查 story 表与 entry 表之间；`storyEntries` 合并视图同 id 时 passive 静默覆盖 active。
- 建议：要么合并 Entry 与 Story；要么让 storyId 成为显式独立引用，并补 `id === storyId` 一致性校验。

### 2. 真/意义引用没有统一校验规则

- 有校验：initId / areaId / defaultAreas / defaultSpots / storyId / curve / 色彩系 / gacha 成员。
- **无校验**：jumpToStory、startStoryId、kizuna.storyId、PassivePoolChild.id、owner、availableInits、adjacentAreaIds。真引用悬空 → 运行时软失败；意义引用拼错 → 静默无行为，都无 DevLog。
- 建议：真引用必须解析成功（加载期报错）；意义引用悬空不报错但进 DevLog 警告。可并入 `validateCharacterRefs`。

### 3. 混合/双通道引用与隐式覆盖

- `affectorPackIds: string | AffectorPackDef`：同字段既是引用又是内联内容；同 id「后加载优先」覆盖是隐式的。
- `SpotFunctionalityDef.id` 兼作运行时 pack 命名空间键：内源与外源同 id 时「后注册者覆盖」（外源胜出），合并是隐式、顺序相关的，数据作者无法显式控制。
- 共同问题：**用「同 id 即同一物」做隐式去重/覆盖**。匹配可以做，覆盖这种有副作用的事应显式声明。

### 4. 写而不读 / 未接线

- `EntityThemeSlot.equipmentId` 写入但不被读取——两个真相源，换装备并不改槽。
- `refreshWorldPool`、Effect `loot`——声明即存、无消费方。声明式数据包里「声明了却不生效」最易误导数据作者。（原列的 `ChatMessageDef.owner` 随该表于 2026-08-29 移除。）

### 5. 字符串 ID 泛滥（stringly-typed）

- proto / owner / entityKey / 资源 / 标签全是裸字符串，无命名空间或枚举约束；标签按前缀匹配，拼错永不报错也永不命中。

### 合理的部分（不必改）

- TriggerEventDef / Condition 按 id 匹配运行时状态——事件系统的正常形态。
- tags 纯语义匹配——意义引用的正当用途。
- 状态层按 id 持有副本（RosterEntry.variantId、资源数量、storyReadLogs）——「副本生效」的正确场景。

**一句话总结**：意义引用本身没有错；错在 ① 两个实体共用主键且无校验；② 引用校验无统一规则，缺口全在后期新增字段；③ 用「同 id」做隐式覆盖/去重。其中 ① 在推进「多 Entry 复用同一 Story」时会最先爆。

## 相关文档

[[docs-828/03-data-structures/declarative-dsl]] · [[docs-828/05-conventions/architecture-discipline]]
