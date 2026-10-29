# 03-data-structures/type-boundary-audit — 引擎契约与领域类型归属盘点

> 本文回答：engine/types 中哪些类型属于基础引擎机制，哪些属于 AronaClicker 领域，以及下一步如何拆分。类型字段的真实定义仍以源码为准；本文件是迁移清单，不是第二份类型事实源。

## 归属原则

施工记录（2026-09-02）：将 `ChatTextKind`、`ChatTextStyle`、`ChatTextEffectValue` 从 `engine/types/expression.ts` 收敛到 `engine/contracts/chat-presentation.ts`。效果 DSL 仍由引擎解释，但演出文本载荷不再与数值表达式/条件定义物理混放；引擎事件和聊天服务均通过该契约引用。

施工记录（2026-09-02）：完整 `Talklet` / `StoryChoice` 定义已从引擎契约下沉至 `data-services/contracts/story.ts`；`engine/contracts/talklet.ts` 仅保留 Effect 嵌入演出片段所需的最小字段，并允许领域字段透传。

施工记录（2026-09-02）：`RuntimeEffectReactor` 已从 `src/engine/effect` 迁移至 `src/arona-clicker/services`；它负责 Color/Story/ChatFlow 三类产品编排，引擎仅保留 Effect 请求事件与最小端口。

施工记录（2026-09-02）：EventBus 的最小事件形状与按类型提取工具已抽至 `src/engine/contracts/event.ts`；基础事件机制与具体 `GameEvent` 载荷进一步分离。

施工记录（2026-09-02）：AronaClicker 根入口已移除对 `engine/types` 的宽泛转发，改为显式导出产品 contracts、内容 Builder 与必要的引擎端口；引擎内部类型不再通过产品根 API 扩散。

施工记录（2026-09-02）：`EventBus` 已泛型化，默认仍使用 `GameEvent`，也可通过 `EventBus<TEvent>` 接入独立事件联合类型；事件分发机制不再绑定单一产品事件形状。

施工记录（2026-09-02）：`EVENT_CATALOG` 与 `EventCatalogEntry` 已迁移至 `src/arona-clicker/contracts/event-catalog.ts`；引擎 `events.ts` 仅保留运行时事件联合类型与处理器契约，事件登记表作为产品联动审计数据由领域层维护。

施工记录（2026-09-02）：图片数据包契约与 `PicId` 解析工具已迁移至 `src/data-services/contracts/pic.ts`，图片查询端口归入 AronaClicker；引擎聊天机制仅保留字符串资源引用，`src/engine/types/pics.ts` 与引擎图片查询端口已删除。

施工记录（2026-09-02）：`InitDef`、`AreaDef`、`SpotDef`、进入条目与 Spot 功能契约已迁移至 `src/data-services/contracts/world.ts`；三种世界 Builder 与 `WorldCatalogQueryPort` 已迁移至 AronaClicker，`src/engine/types/world.ts` 已删除。

施工记录（2026-09-02）：`ResourceDisplayDef`、`TagDef`、`CharacterBonusTable` 已进入 `src/data-services/contracts/common.ts`；`ResourceAmount` 已进入 `src/engine/contracts/resource.ts`，作为数值机制与数据声明共用的最小值对象；`src/engine/types/common.ts` 已删除。

施工记录（2026-09-02）：删除无消费者的 `src/engine/types/entities.ts` 兼容聚合层，`engine/types/index.ts` 直接导出 `reveal` 与 `trigger` 机制契约；引擎类型目录不再保留历史实体总表入口。

施工记录（2026-09-02）：`UIFacingGame` 兼容别名已删除，图鉴弹窗等只读组件直接接收 `GameReadModel`；UI 侧不再以具体运行时类型作为渲染参数。

施工记录（2026-09-02）：`EffectRuntimeHandler` 进入 `engine/contracts/effect-runtime.ts`；`EffectEngine` 不再持有 EventBus 或产品演出分发表，运行时效果由 AronaClicker 组合根注入，基础引擎仅保留效果求值与状态写入管道。

施工记录（2026-09-02）：`EffectMutationPort` 与完整 Effect 分支实现已从 `engine/contracts/mutation.ts` / `engine/system/effect-ops.ts` 下沉至 `arona-clicker/contracts/effect-mutation.ts` / `arona-clicker/state/effect-ops.ts`；基础引擎只依赖最小 `StateMutationPort`。

施工记录（2026-09-02）：边界审计收口：`engine/types` 剩余文件均为机制契约或通用 ID/DSL；产品实体、状态、结果、内容工厂、完整状态效果分支与演出编排已分别归入数据服务、AronaClicker 或 UI 层。

| 判断问题 | 归属 |
|---|---|
| 没有具体游戏实体也能解释或执行吗？ | Engine Contract |
| 描述数值、条件、效果、触发、持续效果、揭示或事件机制吗？ | Engine Contract |
| 描述 Character、Story、Init、Area、Spot、Item、Gacha、Color 吗？ | AronaClicker Type |
| 描述 PlayerState 中的资源、角色、剧情、世界线或库存吗？ | AronaClicker State |
| 描述 UI 展示结果或领域命令结果吗？ | AronaClicker Application Contract |
| 只是图片、存档、Datapack 的物理传输格式吗？ | Data Service Contract |

## 文件级归属

| 当前文件 | 当前内容 | 目标处理 |
|---|---|---|
| ids.ts | 通用 ID 字符串类型；产品资源与角色词表已移出 | 保留通用 ID 与字符串分类类型；Resource/Character 等具体词表归 AronaClicker |
| extra.ts | ExtraValue、ExtraCompound、ExtraPath | Engine/Data Contract，归属待实现时按消费方拆分 |
| expression.ts | Value、Condition、Effect、Funclet 等机制；Effect DSL 仍包含产品可扩展操作名 | 机制表达式保留；演出文本载荷已拆到 `engine/contracts/chat-presentation.ts`，运行时效果执行通过 `EffectRuntimeHandler` 注入隔离；EffectOp 声明仍作为当前 Datapack DSL 的共享协议 |
| reveal.ts | RevealStage、RevealTarget、RevealTrigger | 机制契约；具体实体目标通过适配器提供 |
| trigger.ts | Affector、Trigger 机制与领域事件 kind | Affector/Trigger 契约保留，领域事件载荷拆分 |
| events.ts | GameEvent、EventHandler | EventBus 事件契约保留；事件登记表已迁移至 AronaClicker，事件载荷后续按领域继续评估 |
| common.ts | 已删除；内容分别进入 `data-services/contracts/common.ts` 与 `engine/contracts/resource.ts` | 不再保留混合引擎文件 |
| pics.ts | 已删除；PicId、PicDef 与图片引用解析进入 `data-services/contracts/pic.ts` | 图片数据服务契约；不属于核心数值引擎 |
| chara-profile.ts | 已删除；声明表进入数据服务，玩家覆写/解析结果进入 AronaClicker | `src/data-services/contracts/chara-profile.ts` + `src/arona-clicker/types/chara-profile.ts` |
| character.ts | 通用 Variant/Color/Equipment/Gacha/Cultivate ID 与获得来源 | 保留为引擎可理解的字符串分类；角色实体/配置进入数据服务与 AronaClicker |
| content.ts | 已删除；Enhancement、Story、Talklet、Item、DropTable 分别进入数据服务契约 | AronaClicker 内容工厂与领域服务消费数据服务契约 |
| world.ts | 已删除；Init、Area、Spot、World 功能项进入数据服务契约 | AronaClicker 世界 Builder 与查询端口 |
| datapack.ts | Datapack 聚合结构，包含所有领域表 | 汇总契约已归入 `src/data-services/contracts/datapack.ts`；领域表继续按引擎/AronaClicker 归属拆分 |
| state.ts | 历史 PlayerState、InitSnapshot 兼容导出；统计/Visibility 已拆出 | 产品状态真实定义归 `src/arona-clicker/types/state.ts`；引擎统计/可见性基础结构分别归 `engine/contracts/stats.ts` / `engine/contracts/reveal.ts`，旧文件待删除 |
| results.ts | Tick、Travel、Story、Spot、Item、Enhancement 结果 | 已删除；Tick 位于 `src/engine/contracts/tick.ts`，领域结果位于 `src/arona-clicker/contracts/results.ts` |
| entities.ts | 多个实体类型的 re-export | 迁移期兼容层，最终按新入口拆分 |
| index.ts | 全部类型、builder、事件的总 re-export | 迁移期兼容层，最终拆为 engine/arona-clicker/data-services 入口 |

## 目标类型分区

~~~text
src/engine/contracts/
├─ expression.ts       Value / Condition / Effect / Funclet
├─ reactive.ts         Trigger / Affector / Effect response
├─ reveal.ts           Reveal contract
├─ events.ts           Engine event contract
├─ stats.ts            Stats contract
├─ datapack.ts         Engine-level datapack contract
└─ ids.ts              Generic entity/reference ids

src/arona-clicker/contracts/ + content/
├─ character.ts        Character / Roster / Gacha / Color / Cultivate
├─ content.ts          Story / Item / Enhancement / DropTable
├─ world.ts            Init / Area / Spot
├─ state.ts            AronaClickerState / InitSnapshot
├─ contracts/results.ts Domain command results
├─ chara-profile.ts    Character presentation data
└─ datapack.ts         AronaClicker datapack tables
~~~

## 必须避免的错误拆法

- 不把 expression.ts 整体当作纯引擎文件，主题和聊天文本字段需要单独归属；
- 不把 events.ts 整体当作通用事件文件，事件载荷需要按机制/领域拆分；
- 不把 state.ts 整体迁移到任一层，统计快照、可见性快照和 AronaClicker 状态应分别处理；
- 不让 Engine Contract 直接 import Character、Story、Spot 等领域类型；
- 不提前泛化所有 Datapack 表，先保留 AronaClicker 的内容聚合，再抽取实际复用的底层契约。

## M2-2 实施顺序

1. 新增 src/engine/contracts/ 与 src/arona-clicker/types/；
2. 先移动无争议的机制类型：Expression、Reveal、Affector/Trigger 的机制部分；
3. 移动 AronaClicker 实体类型：Character、Content、World、Results；
4. 拆分 State、Events、Datapack 三个混合热点；
5. 保留 src/engine/types/index.ts 对共享机制类型的聚合出口，不再回导出产品结果/View；
6. 每批移动后执行 Schema 同步、类型检查和全量测试。

## 已完成迁移

- `ValueSource`、`Value`、`ValueExpression` → `src/engine/contracts/expression.ts`；
- `RevealStage`、`RevealTarget`、`RevealTrigger`、`AccessStage` → `src/engine/contracts/reveal.ts`；
- `ExtraValue`、`ExtraCompound`、`ExtraPath` → `src/engine/contracts/extra.ts`；
- `AffectorState`、`AffectorFlow`、`AffectorEffect`、`AffectorPackDef`、`AffectorPackRef`、`AffectorInstance` → `src/engine/contracts/affector.ts`；
- `ProductionResult`、`TickResult` → `src/engine/contracts/tick.ts`；引擎帧结算与会话服务不再从混合的领域结果文件取得基础输出类型。
- `CharacterProgressionPort` → `src/arona-clicker/contracts/character-progression.ts`；培养/好感状态写入与策略契约均归 AronaClicker，基础引擎不再导出产品成长机制类型。
- `ColorEquipmentUnlockPort` → `src/engine/contracts/color-unlock.ts`；色彩解锁反应器只请求装备解锁复检，不持有产品装备服务实现。
- `GameView` 与领域操作结果 → `src/arona-clicker/contracts/view.ts` / `contracts/results.ts`；引擎类型桶不再导出 UI/产品操作模型。
- `Resource`、`GLOBAL_RESOURCE_IDS`、`isGlobalResource` → `src/arona-clicker/types/ids.ts`；引擎 `ids.ts` 与资源工具仅保留通用实体/资源字符串能力。
- `Character`、`CharacterRarity`、`CharacterSchool` 的具体词表 → `src/arona-clicker/types/ids.ts`；引擎只保留字符串形式的角色 ID、稀有度和学校分类，具体枚举值不进入引擎出口。
- `CharacterData` → `src/data-services/contracts/character-data.ts`；产品消费者经 `src/arona-clicker/types/character.ts` 入口。
- Chara 声明表 → `src/data-services/contracts/chara-profile.ts`；玩家覆写与解析结果 → `src/arona-clicker/types/chara-profile.ts`，Builder → `src/arona-clicker/content/def-factory/chara-profile.ts`。
- 角色持久化配置 → `src/data-services/contracts/character-persist.ts`；它描述 Datapack 的状态分层声明，不属于基础引擎机制；产品内容通过 `src/arona-clicker/content/character-persist.ts` 提供具体配置。
- 产品内容目录查询 → `src/arona-clicker/contracts/content-catalog.ts`；基础引擎显示名解析仅接收最小目录读取面，不再导出包含 Gacha/Color 的产品目录端口。
- Gacha Datapack 配置 → `src/data-services/contracts/gacha-pool.ts`；Gacha Builder → `src/arona-clicker/content/def-factory/gacha-pool.ts`，招募算法与状态写入继续由 AronaClicker 服务负责。
- Color Datapack 配置 → `src/data-services/contracts/color.ts`；Color Builder → `src/arona-clicker/content/def-factory/`，主题叠加/解析机制继续归引擎，具体色彩库存与解锁规则由 AronaClicker 服务负责。
- `CharacterVariantDef` → `src/data-services/contracts/character-variant.ts`；产品消费者经 `src/arona-clicker/types/character.ts` 入口，依赖的 ThemeDef/成长定义仍在引擎过渡文件中。
- `CultivateCurveDef` → `src/data-services/contracts/cultivate-curve.ts`；培养曲线 Builder 下沉至 `src/arona-clicker/content/def-factory/`，成长算法由 AronaClicker 服务解释。
- `AffectionConfigDef` → `src/data-services/contracts/affection-config.ts`；好感数值解释与状态写入仍由 AronaClicker 好感服务负责。
- `ThemeDef`、`ThemeToken`、`ThemeOrderScope`、`EntityThemeSlot` → `src/engine/types/theme.ts`；这些类型由世界线声明、主题运行时和 UI 主题映射共同消费，不再混在角色类型文件中。
- `VariantProgress`、`ProtoStat`、`GachaPoolState` → `src/arona-clicker/types/character.ts`；它们是产品运行时状态子结构，不再混在角色 Datapack 声明模块中。
- 条件/Reveal 状态读取 → `src/engine/contracts/state-query.ts` 的 `ConditionState`；条件系统与可见性引擎只依赖资源、设施、旗标、剧情日志、原型统计和当前区域等最小只读面，好感读取由产品 wiring 注入。
- 统计状态读取 → `src/engine/contracts/state-query.ts` 的 `StatsState`；StatsService 只读取当前 Init、区域、总帧数与资源，不再要求完整 PlayerState。
- 数值表达式状态读取 → `src/engine/contracts/state-query.ts` 的 `ValueState`；ValueSystem 只读取资源、设施等级/管理者和 flags，Extra/Funclet 通过已有注入端口提供。
- `GameNum` 状态读取 → `src/engine/contracts/state-query.ts` 的 `GameNumState`；区表聚合、缓存求值与 Affector flows 只增加 tag/entity effects 与 spot tag overrides，不再显式依赖完整 PlayerState。
- `TriggerSystem` 状态读取 → `src/engine/contracts/state-query.ts` 的 `TriggerState`；触发器只需要 ConditionState 与 once 完成记录，不再显式依赖完整 PlayerState。
- `FuncletExecutor` 状态读取 → `ValueState`；Funclet 参数只通过 flags 覆盖注入，不再要求完整 PlayerState。
- `VisibilitySnapshot` → `src/engine/contracts/reveal.ts`；可见性结果属于 Reveal/Visibility 机制契约，不再与 PlayerState 定义混放。
- Condition 的故事完成读取 → `StoryCompletionState`；基础条件只依赖 `storyId`，不依赖 AronaClicker 的 passive/active 故事记录结构。
- Condition 的原型统计读取 → `ProtoStatState`；基础条件只读取 `acquiredTotal`，不依赖产品侧派生统计实体。
- 动态 Spot 标签覆盖 → `SpotTagOverrideState`；增撤标签的机制数据进入引擎状态契约，PlayerState 仅作为产品持久化容器。
- AronaClicker 状态消费者入口 → `src/arona-clicker/types/state.ts`；完整 `PlayerState` / `InitSnapshot` 定义及状态工厂、统一写入服务与 Init 快照编排均归产品入口，旧 `engine/types/state.ts` 已删除。
- 故事完成/阅读记录 → `src/arona-clicker/types/story-state.ts`；角色运行时 `VariantProgress` / `ProtoStat` / `GachaPoolState` → `src/arona-clicker/types/character.ts`，产品消费者已脱离 `engine/types/state.ts` 的这些定义。
- Runtime、产品服务与产品 Contracts 的 `PlayerState` 引用已统一改从 `src/arona-clicker/types/state.ts` 进入；引擎侧仍保留必要的同步/存档兼容边界。
- SaveData 组装逻辑 → `src/arona-clicker/runtime-save-codec.ts`；数据服务保留存储适配，产品 Runtime 负责 Story/聊天/可见性/状态快照组合。
- `SaveBuildContext`、`SaveCodec` 与完整 `SaveData` → `src/arona-clicker/contracts/save-codec.ts` / `save-data.ts`；其中包含产品状态、Story/聊天游标和产品统计。data-services 只提供泛型 JSON 存储，engine 不再承载产品存档 DTO。
- 统计快照与计数器 → `src/engine/contracts/stats.ts`；StatsService、统计 DSL 与事件上下文不再从混合 `engine/types/state.ts` 取得基础统计模型。
- `AffectorEngine` 内部状态读取 → `AffectorRuntimeState`；其宿主同步入口仍接收 `PlayerState`，仅用于向统一写入端口与 EffectEngine 转发当前状态。
- `SpotFunctionalityQueryPort` 状态读取 → `FunctionalityState`；功能派生不再要求完整 PlayerState。
- `EffectEngine` 数值解析内部状态 → `EffectRuntimeState`（ValueState 别名）；完整 PlayerState 仅保留在宿主同步入口。
- `TickSystem` 生产结算内部状态 → `TickState`（GameNumState + totalFrames）；统一写入口同步仍使用完整 PlayerState。
- `StateMutationPort` → 仅保留基础效果写入能力；完整状态同步从引擎端口移出，由 AronaClicker 的 `StateMutationHostPort` 承担。Effect/Affector/Tick 的 `setState` 仅接收最小状态面，并通过可选兼容钩子支持旧测试宿主。
- `ContentCatalogQueryPort.characters` → `CharacterCatalogEntry` 最小读取契约（`id/displayName/tags`）；显示名与 UI 目录读取已解除对完整角色实体的类型要求。
- UI 角色变体查询 → `RosterQueryPort.getVariant/getAllVariants`；`ContentCatalogQueryPort` 不再承载完整变体表，Registry 的变体合并仍属于领域/组合根边界。
- `TagStatService` 角色原型解析 → 注入 `characterProtoOf(variantId)`；统计机制不再依赖完整 `characterVariants` Map，具体 Registry 查表由 AronaClicker wiring 承担。
- `CharacterData` → `src/data-services/contracts/character-data.ts`；产品消费者仍统一经 `src/arona-clicker/types/character.ts` 入口，基础引擎不再承载角色元数据实体。
- 角色/角色变体定义构造器 → `src/arona-clicker/content/def-factory/`；基础引擎 `def-factory` 仅聚合通用机制与数据构造器。
- Chara 资料解析 → `src/arona-clicker/services/chara-profile-resolver.ts`；角色名/头像优先级属于产品领域服务，基础引擎核心不再依赖 `Registry.characters`。
- `AffectorEngine` → `AffectorRegistryContext`（物品/强化/设施的最小字段）；`RuntimeEffectReactor` → `RuntimeEffectRegistryContext`（剧情入口类型）；`TickSystem` 不再接收 Registry。基础机制不再依赖具体 Registry 类。
- `SpotFunctionalityQueryPort` → `SpotFunctionalityView`（功能 ID、种类、条件与产出参数）；设施完整定义与 Extra 数据不进入基础 Affector 查询端口。
- 原 `src/engine/types/*` 路径保留 re-export，作为迁移期兼容入口。

应用侧兼容入口收口：生产 UI 不再从 `engine/game-instance` 获取 Runtime/SaveData 类型；产品诊断展示工具位于 `src/arona-clicker/services`。

schema 生成器已同时扫描 `src/engine/types`、`src/engine/contracts` 与 `src/data-services/contracts`；因此手工覆盖仍能校验新契约字段，迁移不再要求把数据包记录暂留在旧引擎目录。

## 当前结论

M2-1 完成类型归属盘点；M2-2 已完成机制契约、运行时输出、资源、角色词表、`CharacterData`、`CharacterVariantDef`、`CultivateCurveDef` 与主题类型模块化，M3-2/M4-3 已将 UI 角色目录与变体查询收窄为最小只读端口；Registry 实现与 Datapack 汇总契约已归入基础数据服务。`GameNumState` 已补齐数值修饰状态边界。`PlayerState` / `InitSnapshot` 的真实定义已归入 `src/arona-clicker/types/state.ts`，故事与角色状态子结构也已归入产品类型入口；旧引擎状态桶已删除，剩余工作转为清理旧总出口与领域实现拆分。
- 2026-09-02：M2-2/M5-1/M6-2 后续切片完成：`ItemDef`、`DropTableDef` 与 `DropTableEntry` 迁移至 `src/data-services/contracts/item.ts` / `drop-table.ts`，Item/DropTable Builder 迁移至 AronaClicker 内容层；物品定义属于数据包契约，掉落结算仍由产品 LootSystem 负责。Schema 已重新生成；类型检查、相关 5 个文件/26 项定向测试、全量 108 个测试文件/1027 个测试与架构边界检查通过。
- 2026-09-02：M2-2/M5-1/M6-2 后续切片完成：`EnhancementDef` 与 `EnhancementAttachment` 迁移至 `src/data-services/contracts/enhancement.ts`，Builder 迁移至 AronaClicker 内容层；强化数据属于数据包契约，Affector/Spot 功能等仍由引擎机制解释。Schema 已重新生成；类型检查、Enhancement 相关 5 个文件/42 项定向测试通过。
- 2026-09-02：M2-2/M5-1/M6-2 后续切片完成：`PassivePoolDef` 与 `PassivePoolChild` 迁移至 `src/data-services/contracts/passive-pool.ts`，Builder 迁移至 AronaClicker 内容层；池树是数据包抽选声明，池门控/权重解释仍由产品 PassivePoolSystem 负责。Schema 已重新生成；类型检查、PassivePool 33 项定向测试通过。
- 2026-09-02：M2-2/M5-1/M6-2 后续切片完成：纯演出数据 `StoryDef`、`Talklet`、`StoryChoice` 迁移至 `src/data-services/contracts/story.ts`；Story/Talklet Builder 与 StoryEntry Builder 迁移至 AronaClicker 内容层，产品 Story 服务及 UI 结果契约开始使用新演出契约。Active/Passive 入口实体仍保留下一阶段拆分。Schema 已重新生成；类型检查、剧情相关 8 个文件/86 项定向测试通过。
- 2026-09-02：M2-2/M5-1/M6-2 后续切片完成：`StoryEntryBase`、`ActiveStoryEntry`、`PassiveStoryEntry`、`StoryEntryDef`、`BranchGuard` 与 `ConditionalReward` 迁移至 `src/data-services/contracts/story-entry.ts`；删除 `src/engine/types/content.ts`，基础引擎仅保留 `engine/contracts/talklet.ts` 的最小聊天演出机制契约，避免引擎反向依赖数据服务。Schema 已重新生成；类型检查、剧情专项与全量回归通过。
