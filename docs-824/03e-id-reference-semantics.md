# docs-824 — 03e 带 id 的 Def 条目与引用语义（真引用 / 意义引用）

> 本文回答：**哪些「带 id 的内容条目」被其他字段按 id 引用？每次引用是取目标内容生效（真引用），还是只拿 id 做身份/分组/路由键、行为由自身副本决定（意义引用）？**
> 覆盖：`src/engine/types/` 全部 Def 实体 + 运行时代码消费点核对。

## 判定标准

- **真引用**：引用方把 id 解析成注册表里的 Def 后，**使用该 Def 的内容字段**决定行为——目标内容变化则行为变化；悬空引用通常是加载期报错（`validateDatapack` / `validateCharacterRefs`）。
- **意义引用**：引用方只用 id 做**身份匹配 / 归属 / 分组 / 路由 / 状态键**，行为由引用方自身携带的内容（或 PlayerState 里按 id 存的副本）决定，不读目标 Def 的内容字段——即「我持有和该 id 一致的副本生效」。
- **内部身份**：id 仅用于该实体自身生命周期（挂载/卸载/once 状态/实例追踪），不存在跨 Def 引用。
- **未接线**：字段声明即存，当前无运行时消费方。

---

## 一、世界结构（Init / Area / Spot）

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `AreaDef.initId` (world.ts:108) | InitDef | 意义 | 归属键：进入判定、可见性挂载按 id 匹配运行时 `activeInit`（init-service.ts:191-193），不读 InitDef 内容。有加载期校验（registry-validate.ts:112） |
| `SpotDef.areaId` (world.ts:142) | AreaDef | 意义 | 归属键：Spot 挂载/展示按 id 匹配当前 Area。有加载期校验（registry-validate.ts:117） |
| `InitDef.defaultAreas` (world.ts:56) | AreaDef | 真 | 进入 Init 时挂载这些 Area 并展开其子树（读 `area.defaultSpots` 等实际内容，init-service.ts:123-140）。有校验（registry-validate.ts:121-127） |
| `AreaDef.defaultSpots` (world.ts:114) | SpotDef | 真 | 挂载 Spot 本体（baseCost/baseYield 等全部字段参与结算）。有校验（registry-validate.ts:128-135） |
| `AreaDef.adjacentAreaIds` (world.ts:121) | AreaDef | 意义 | 移动可达性：`adjacentAreaIds.includes(areaId)` 纯身份匹配（init-service.ts:211-215）。无加载期校验 |
| `InitDef.startStoryId` (world.ts:61) | StoryEntry | 真 | 进入 Init 时启动该剧情入口，经 entry → storyId 取 StoryDef 的 talklets 播放（init-service.ts:146-148）。无加载期校验（悬空引用运行时软失败 NotFound） |

## 二、剧情（Story / Entry / Pool / Talklet）

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `StoryEntryBase.storyId` (content.ts:116) | StoryDef | 真 | 播放目标 Story 的 talklets（story-service.ts:238-240 → story-flow.ts:149）。加载期强校验（registry-validate.ts:136-142） |
| `StoryEntryBase.id`（与 storyId 同值） | — | 意义 | 见「特别说明 ①」 |
| `Talklet.jumpToStory` / `StoryChoice.jumpToStory` (content.ts:363,400) | StoryDef | 真 | 直接查 stories 表播放目标内容（story-jump.ts:23-41）。无加载期校验 |
| `Talklet.kizuna.storyId` (content.ts:376) / `ChatTextEffectValue.targetStoryId` (expression.ts:221) | ActiveStoryEntry | 真 | 点击卡片启动目标入口（先查 entry 再取 story 播放） |
| Effect `triggerStory` 的 target (expression.ts:100) | StoryEntry | 真 | effect-engine.ts:50-52 → game-instance.ts:181-185 查 entry 并启动 |
| `BranchGuard.storyId` / prerequisites[].storyId (content.ts:101-107) | StoryEntry | 意义 | 重读守卫：按 id 比较跳转目标、按 id 查 storyReadLogs 阅读记录（story-flow.ts:187-192、story-replay.ts:12-23）。唯一用到 StoryDef 的仅是 talkletIndex=-1 时枚举 talklets 结构判「全部已读」，不读内容字段。无加载期校验 |
| Condition `hasReadStory` / `hasReadStoryInRun` / `visitedStoryInChain`（key=StoryId, expression.ts:62-74） | StoryDef | 意义 | 纯日志/游标记录身份匹配（condition-system.ts:107-115），不读 StoryDef 内容 |
| `TriggerEventDef` on:{story/init/area/spotLevel/item/resource} (trigger.ts:60-67) | 各实体 | 意义 | 事件载荷 id 相等比较（trigger-system.ts:153-179）；载荷 id 来自 StateMutationService 运行时快照（spotId 是 spotLevels 状态键等），完全不读 Def 内容 |
| `PassivePoolChild.id` (content.ts:219) | 子池 / Entry | 真 | 解析后取目标池/entry 的**完整内容**递归抽取：children/condition/owner/weight/cooldownFrames（passive-pool-system.ts:106-136）；「未被引用 entry 自动归默认根池」（143-151）。无加载期校验 |
| `StoryEntryDef.owner` / `PassivePoolDef.owner` (content.ts:172,193,249) | CharacterVariantDef | 意义 | 聊天空间壁垒：`effectiveOwner === owner` 字符串比较（passive-pool-system.ts:97-100），对话沙盒 key = `variant:${owner}`（story-service.ts:31-34）。全引擎无 `characterVariants.get(owner)` 取内容的路径 |
| `ActiveStoryEntry.availableInits` (content.ts:118) | InitDef | 意义 | 只比较运行时 `activeInit` 是否在列表里（story-flow.ts:89,119）。加载期不校验存在性 |

## 三、角色 / 培养 / 抽卡 / 色彩

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `CharacterVariantDef.proto` (character.ts:90) | 原型角色 | 意义 | 差分自带 name/rarity/school 内容副本；proto 只做聚合/分组键（protoStats 按 proto 记账 state-mutation-service.ts:193,343；tag-stats.ts:240 分组；图鉴默认差分迁移） |
| `CharacterVariantDef.curve` (character.ts:130) | CultivateCurveDef | 真 | 取 expTable/starCost/maxLevel 等参与升级突破（cultivate-system.ts:36-45）；缺省用全局默认曲线。有加载期校验（registry-validate.ts:168-172） |
| `CharacterVariantDef.colorGroupId` / `SpotDef.colorGroupId` / `ColorEquipmentDef.colorGroupId` | ColorGroupDef | 真 | 取 compositionType + 各 slot 内联 hex 渲染头像/主题（avatar-renderer.ts、color-system.ts resolveTheme）；加载期强校验（registry-validate.ts） |
| `ThemeDef.colorGroupId` / `ThemeEffectValue.colorGroupId` | ColorGroupDef | 真 | 解析成完整 token 表（color-system.ts `themeContributionFromThemeDef` / `resolveTheme`）；未给 token 由主色位色值派生。加载期强校验（registry-validate.ts） |
| `GachaPoolDef.members / featured` (character.ts:437,451) | CharacterVariantDef | 真 | 抽卡按 variant 的 rarity 等字段结算、featured 偏置（gacha-service.ts:56-81）。有校验（validateCharacterRefs）。注意：「池关闭成员并入世界 Pool」的 `refreshWorldPool`（character-availability.ts:62-76）已实现但无调用点，未接线 |
| `SpotDef.gachaPools` (world.ts:198) | GachaPoolDef | 真 | 取池定义渲染专有面板并跑 roll（contacts.ts:359-381）；无声明仅开全局通用池 |
| `RosterEntry.equippedEquipment` (character.ts:535) | ColorEquipmentDef | 真 | 取 effects 应用（color-equipment-system.ts:88-92） |
| `ThemeDesignDef.entityKey` (character.ts:205) | Area / Variant | 意义 | 解锁时只作落点键：`entityThemeDesignsOwned[entityKey]` 与 setEntityThemeSlot 的键（color-system.ts:497-504）；设计自身携带 theme 内容 |
| `EntityThemeSlot.designId / equipmentId` (character.ts:182-186) | ThemeDesignDef / ColorEquipmentDef | designId 真；equipmentId 特殊 | designId 解析出主题（color-system.ts:393-409）；equipmentId 写入但从不被读取——装备槽实际跟随当前已装备装备（entity-theme-options.ts:10），是「身份存、实时解析」 |
| `ChatMessageDef.owner` (character.ts:469) | CharacterVariantDef | 未接线 | 全引擎无任何代码读取 owner 做分组/展示，声明即存。语义上应是意义引用（分组键），但未接线 |

## 四、物品 / 掉落 / 强化

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `DropTableDef.entries[].itemId` / `guaranteed[].itemId` (content.ts:450-455) | ItemDef | 真 | 抽中后经 giveItem 读 ItemDef.maxStack 并执行 pickupEffects（loot-system.ts:28-78 → item-service.ts:28-37） |
| Effect `addItem` 的 target (expression.ts:96) | ItemDef | 真 | effect-ops.ts:37-39 → item-service 读 ItemDef 内容发放 |
| `EnhancementDef.affectorPackIds` / `ItemDef.affectorPackIds` (content.ts:72,431) | AffectorPackDef | 真（字符串形式） | 字符串按 id 查注册表取 entries 参与产出（affector-engine.ts:107-139）；内联 AffectorPackDef 是匿名携带、先注册再用。「后加载优先」= 同 id 覆盖（load/registerPack） |
| `EnhancementDef.attachment` (content.ts:32-35) | Area / Init | 意义 | 注释属实：引擎完全不消费（PlayerState.enhancementAttachments 只写不读），UI 仅用 id 做面板摆位分组和名字展示（ui/components/enhancements.ts:29-53） |
| `SpotFunctionalityDef.id` (world.ts:225) | —（内源/外源功能） | 内部身份 | id 仅作运行时 Affector 包命名空间键 `${fn.id}@${spotId}`（affector-engine.ts:277-299）；外源（Enhancement 注入）与内源同 id 时后注册覆盖，实现隐式合并/去重。不被 effect/条件引用 |

## 五、数值 / 表达式 / 事件层

| 引用字段 | 指向 | 分类 | 实际效果 |
| --- | --- | --- | --- |
| `FuncletCall.funcletId` / Value source `funclet` (expression.ts:252-257,18) | FuncletDef | 真 | 取 def.calc 求值（value-system.ts:111-112、funclet-executor.ts:26） |
| `TriggerDef.id` (trigger.ts:69) | —（自身生命周期） | 内部身份 | 全局 triggerDefs 按 id 挂载/卸载/once 持久化（trigger-system.ts:85），无任何跨 Def 引用；匿名 Trigger 派 `anon:` 派生 id |
| `AffectorEffect.id` (trigger.ts:20) | —（包内条目） | 内部身份 | 仅用于 AffectorInstance.activeEntryIds 追踪 |
| 各 Def 的 `tags: TagPath[]` | TagDef | 意义 | 标签是纯语义标记：匹配按 id 前缀（hasTag/countTags/tagCount/zoneModifiers），TagDef 的 name/description 仅 UI 展示（registry.ts:219-240） |
| 资源 id（`baseCostResource`/`baseYieldResource`/AffectorFlow.resource/Condition resource/Value res） | 资源 | 意义（状态键） | 资源在 PlayerState 按 id 存数量副本，效果的操作目标就是该 id 本身；资源 Def 的显示名/图标不参与结算 |
| `avatar` / `image` 的 PicId（content.ts:333,354、character.ts:107） | PicDef | 真 | resolvePicSrc → registry.pics.get 解析成实际图片（resolve.ts:25）；缺图回退首字母占位 |
| `RosterEntry.variantId` / `GachaPoolState` / `storyReadLogs` / `studentBlocks` 等 | 各 Def | 意义（状态键） | 玩家层按 id 持有进度副本（等级/经验/pity/阅读记录），Def 内容不参与——这就是「我拥有和该 id 一致的副本生效」的字面形态 |

---

## 特别说明

1. **StoryEntry.id 与 StoryDef.id 同值**（content.ts:115「当前与 id 1:1 同值」）是最典型的「副本 id」设计：每个 Entry 都带一份与 Story 同名的 id 副本，`entry.storyId` 才是真引用（builder 缺省 `_storyId = id`，story-entry.ts:36-39）。运行时**不强制 id===storyId**，只有加载期校验 storyId 必须可解析（registry-validate.ts:136-142）——一旦启用「多 Entry 复用同一 Story」，entry.id 就退化为纯身份键，这是当前设计里最值得注意的一处。
2. **混合引用**：`setTheme` 的 value 中 `colorId` 是真引用、`entityKey` 是意义引用（color-system.ts:306-325）；`affectorPackIds` 字符串真引用、内联匿名；`EntityThemeSlot.equipmentId` 写而不读。
3. **三处未接线/未实现**：`refreshWorldPool`（池关闭并入世界 Pool）无调用点；`ChatMessageDef.owner` 无消费方；Effect `loot` 是 no-op 预留（effect-ops.ts:55-58）。
4. **加载期校验覆盖面不一致**：有校验的（initId/areaId/defaultAreas/defaultSpots/storyId/curve/色彩系/gacha 成员）多数是真引用；而 jumpToStory、startStoryId、availableInits、adjacentAreaIds、PassivePoolChild、BranchGuard、owner 等**均无静态校验**——其中意义引用悬空不影响行为（身份匹配恒不中），但 jumpToStory / startStoryId / PassivePoolChild 这类真引用悬空只会运行时软失败。

---

## 六、潜在设计问题（评审意见，按严重度排序）

判定背景见文首「真引用 / 意义引用」定义。

### 1. StoryEntry.id 与 StoryDef.id 共用一个主键（最危险）

- Entry 与 Story 是两种实体（触发/奖励 vs 演出内容），却共用同一 id 值：entry.id 默认 = storyId（def-factory/story-entry.ts:36-39），加载期只校验 storyId 可解析（registry-validate.ts:136-142），**不校验 id === storyId**——1:1 只是 builder 约定，无强制。
- **两个命名空间因巧合重合**：`triggerStory` 的 target 是 Entry id（game-instance.ts:181-185），而 `hasReadStory` 等条件的 key 是 StoryDef id（condition-system.ts:107-115；storyLog 按 StoryDef.id 记录，state-mutation-service.ts:499-513）。今天三者相等所以不炸；一旦按注释规划「多 Entry 复用同一 Story」解耦，条件系统会指向错误实体。
- **跨表 id 冲突静默吞数据**：validateDatapack 对 activeStories / passiveStories 分别查重（registry-validate.ts:36-37），不查两表之间、也不查 story 表与 entry 表之间；`storyEntries` 合并视图同 id 时 passive 静默覆盖 active（registry.ts:113-115）。
- 建议：要么合并 Entry 与 Story（既然 1:1，为何两张表）；要么让 storyId 成为显式独立引用，并补 `id === storyId` 一致性校验，把「解耦」变成有意识的重构。

### 2. 真/意义引用没有统一校验规则

- 有校验的：initId / areaId / defaultAreas / defaultSpots / storyId / curve / 色彩系 / gacha 成员。
- **无校验的**：jumpToStory、startStoryId、kizuna.storyId、PassivePoolChild.id、owner、availableInits、adjacentAreaIds。真引用悬空 → 运行时软失败（「点了没反应」）；意义引用拼错 → 静默无行为（「聊天永远不出现」），都无 DevLog。
- 建议：真引用必须解析成功（加载期报错）；意义引用悬空不报错但进 DevLog 警告。可并入已有跨表校验入口 `validateCharacterRefs`（registry.ts:161-197）。

### 3. 混合/双通道引用与隐式覆盖

- `affectorPackIds: string | AffectorPackDef`（content.ts:72,431）：同字段既是引用又是内联内容；同 id「后加载优先」覆盖是隐式的（affector-engine.ts:84-99），两个数据包声明同名 pack 时后加载静默获胜。
- `SpotFunctionalityDef.id` 兼作运行时 pack 命名空间键 `${fn.id}@${spotId}`（affector-engine.ts:277-299）：内源（Spot 声明）与外源（Enhancement 注入）同 id 时「后注册者覆盖」（外源胜出），合并是隐式、顺序相关的，数据作者无法显式控制。
- 共同问题：**用「同 id 即同一物」做隐式去重/覆盖**。匹配可以做，覆盖这种有副作用的事应显式声明。

### 4. 写而不读 / 未接线

- `EntityThemeSlot.equipmentId` 写入但不被读取（entity-theme-options.ts:10 写；解析用实时 equippedEquipmentId，color-system.ts:393-409）——两个真相源，换装备并不改槽。
- `ChatMessageDef.owner`（character.ts:469）、`refreshWorldPool`（character-availability.ts:62-76，池关闭并入世界 Pool）、Effect `loot`（effect-ops.ts:55-58）——声明即存、无消费方。声明式数据包里「声明了却不生效」最易误导数据作者。

### 5. 字符串 ID 泛滥（stringly-typed）

- proto / owner / entityKey / 资源 / 标签全是裸字符串，无命名空间或枚举约束；标签按前缀匹配（hasTag / countTags / zoneModifiers），拼错永不报错也永不命中。owner / entityKey 这类「纯字符串相等路由」最易打错且最难发现。

### 合理的部分（不必改）

- TriggerEventDef / Condition 按 id 匹配运行时状态（trigger-system.ts:153-179）——事件系统的正常形态。
- tags 纯语义匹配——意义引用的正当用途。
- 状态层按 id 持有副本（RosterEntry.variantId、资源数量、storyReadLogs）——「我拥有和该 id 一致的副本生效」的正确场景。

**一句话总结**：意义引用本身没有错；错在 ① 两个实体共用主键且无校验；② 引用校验无统一规则，缺口全在后期新增字段；③ 用「同 id」做隐式覆盖/去重。其中 ① 在推进「多 Entry 复用同一 Story」时会最先爆。

---

上一篇：[[docs-824/03d-stats-views]] · 下一篇：[[docs-824/04-core-algorithms]]
