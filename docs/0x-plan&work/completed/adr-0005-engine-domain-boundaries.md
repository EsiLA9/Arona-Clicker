# 06-adr/0005 — 基础引擎与 AronaClicker 领域边界

- **状态**：已完成（2026-09-02；设计确认于 2026-09-01）
- **决策者**：项目维护者 + AI 协作
- **来源**：项目结构探索与后续内聚任务设计
- **关联 Roadmap**：[[docs/0x-plan&work/completed/roadmap-0005-engine-domain-consolidation]]

## 背景

施工记录（2026-09-02）：新增 `engine/contracts/chat-presentation.ts`，承载引擎与演出服务之间的最小聊天文本契约；`expression.ts` 仅保留效果 DSL 对该契约的组合引用，避免把产品表现字段继续扩散为表达式类型的公共成员。

施工记录（2026-09-02）：剧情演出载荷完成第二次收敛：完整 Talklet/Choice 由数据服务拥有，引擎只消费最小嵌入片段；产品 Story 服务与 UI 继续使用完整数据服务契约。

施工记录（2026-09-02）：产品编排型 `RuntimeEffectReactor` 归入 AronaClicker 服务层；引擎 EffectEngine 通过事件与端口发出请求，不再直接或间接拥有产品 Color/Story/ChatFlow 编排实现。

施工记录（2026-09-02）：新增 `engine/contracts/event.ts` 定义 `EngineEventShape` / `EventOf`，EventBus 依赖最小判别事件形状；具体产品事件联合类型仍可作为默认实现注入。

施工记录（2026-09-02）：收紧 AronaClicker 根 API，删除 `export * from '../engine/types'`，产品调用方改用显式产品 contracts 与内容 Builder；这使引擎机制出口与产品领域出口在公共 API 层真正分离。

施工记录（2026-09-02）：基础 `EventBus` 改为泛型事件总线，`GameEvent` 仅作为当前 AronaClicker 的默认事件联合类型；这样保留现有订阅链兼容性的同时，为其他领域事件提供独立接入面。

施工记录（2026-09-02）：事件目录 `EVENT_CATALOG` 已从基础引擎移至 AronaClicker contracts；EventBus 所需的 `GameEvent` 与 `EventHandler` 仍保留在引擎，保证事件分发机制独立于目录登记数据。

施工记录（2026-09-02）：图片定义、图片索引解析与图片查询端口已从引擎移出，分别由 `data-services/contracts/pic.ts` 与 AronaClicker contracts 承载；基础引擎不再拥有数据包图片实体。

施工记录（2026-09-02）：世界地图数据实体 (`InitDef` / `AreaDef` / `SpotDef`) 归入 `data-services/contracts/world.ts`；世界 Builder 与目录查询端口归入 AronaClicker。基础引擎不再拥有产品世界数据定义或世界目录出口。

施工记录（2026-09-02）：通用数据声明不再由 `engine/types/common.ts` 承载；`ResourceDisplayDef`、`TagDef`、`CharacterBonusTable` 归入 `data-services/contracts/common.ts`，`ResourceAmount` 归入 `engine/contracts/resource.ts` 作为数值机制与数据声明共用的最小值对象。

施工记录（2026-09-02）：删除无消费者的 `engine/types/entities.ts` 历史聚合出口；引擎公共类型入口直接暴露机制契约，不再通过“实体总表”名称暗示产品实体仍属于基础引擎。

施工记录（2026-09-02）：UI 只读边界进一步落实：删除 `UIFacingGame` 兼容别名，组件参数统一使用 AronaClicker `GameReadModel`；控制器保留 Commands 与 Runtime 的写入职责。

施工记录（2026-09-02）：按项目“旧存档直接失效、不做迁移”纪律，移除 `runtime-save.ts` 中全局资源桶搬迁、缺失 Extra 补全和缺失 Area 推断逻辑；存档恢复现在只克隆当前 `PlayerState` 并重建运行时索引。

施工记录（2026-09-02）：EffectEngine 的产品运行时分发改为 `EffectRuntimeHandler` 注入；引擎不再依赖 EventBus 来构造主题/剧情/聊天请求事件，AronaClicker wiring 负责把这些效果转换成领域事件。

施工记录（2026-09-02）：状态效果的完整操作集合属于 AronaClicker：`EffectMutationPort` 与 `effect-ops` 已从基础引擎移至产品状态层。基础引擎保留 `StateMutationPort`，仅表达机制对宿主状态写入的最小要求。

施工记录（2026-09-02）：本轮内聚施工完成。后续 `EffectOp` 可继续作为当前 Datapack 声明协议演进，但新增执行语义必须通过领域宿主处理器或领域状态层接入，禁止将产品编排实现回置基础引擎。

当前项目已经完成一次引擎内部整理（T1-T7），但 `src/engine/` 仍同时包含两种性质不同的代码：

- 可复用的声明式机制：EventBus、Value、Condition、GameNum、Effect、Trigger、Affector、Reveal、Stats、Registry 等；
- AronaClicker 领域内容：Character、Story、Init、Area、Spot、Gacha、Color、Cultivate、Inventory 以及对应的 `PlayerState` 和服务。

`src/data/base/` 目前更接近测试/示例 Datapack，不应被视为引擎内置的生产内容。当前 `GameInstance` 也已经是 AronaClicker 运行时的组合根，而不是基础引擎对象。

## 决策

### 1. 基础引擎只负责机制执行

基础引擎负责：

- 事件分发与运行时基础设施；
- Value / Condition / Funclet / Stat DSL 求值；
- GameNum 数值树、缓存与失效；
- Effect / Trigger / Affector 响应机制；
- Reveal / Visibility 揭示机制；
- 统计与派生统计；
- Datapack 注册、合并、引用校验的通用机制；
- 统一状态变更管道及其事件、统计副作用。

基础引擎不直接负责：

- Character、Story、Init、Area、Spot 等 AronaClicker 实体；
- AronaClicker 的资源、抽卡、培养、色彩、库存规则；
- 具体 Datapack 内容；
- UI 页面和交互流程。

### 2. 领域语义通过适配器接入引擎

基础机制不直接写死 AronaClicker 字段，而通过上下文或适配器读取领域数据：

```text
Engine Condition / GameNum / Reveal / Stats
                    ↓
        Domain Context / Source Adapter
                    ↓
          AronaClicker State / Registry
```

引擎只依赖查询契约；AronaClicker 负责提供资源、实体等级、标签、拥有状态、故事完成状态等具体查询。

### 3. `GameInstance` 定位为 AronaClicker Runtime

`GameInstance` 的职责是组合并驱动 AronaClicker：

- 创建基础引擎服务；
- 创建 AronaClicker 领域服务；
- 注入领域适配器；
- 管理 init / tick / save / load / reset 生命周期；
- 生成 UI 所需只读视图。

后续目标名称为 `AronaClickerRuntime`。迁移期间可保留 `GameInstance` re-export 兼容层，避免一次性破坏测试与 UI 入口。

### 4. 基础数据服务独立于运行时门面

Datapack 的物理读取、解析、合并、校验，以及 SaveData、LocalStorage、图片资源加载，属于基础数据服务，不应依赖 `GameInstance`。

目标依赖方向：

```text
SaveStorage / PackLoader → Data Contract
AronaClickerRuntime      → SaveCodec / PackManager
UI                        → Runtime ReadModel + Commands
```

### 5. `base` 作为测试/示例数据包

`base` 不再作为引擎的隐式默认内容。测试和示例入口显式注入测试 Datapack；正式内容包拥有独立入口。

引擎不得导入：

```text
src/data/base/*
datapack/AronaClickerCore/*
```

### 6. UI 依赖能力接口，而不是具体引擎实现

UI 最终只依赖：

- `GameReadModel`：GameView、StoryView、实体显示信息、日志等；
- `GameCommands`：故事推进、移动、购买、使用物品等命令；
- 基础持久化服务和 UI 自身服务。

UI 不直接依赖 `StateMutationService`、`Registry`、`GameNumSystem`、`ConditionSystem` 等内部实现。

## 目标模块布局

```text
src/
├─ engine/
│  ├─ core/
│  ├─ contracts/
│  ├─ expression/
│  ├─ effect/
│  ├─ visibility/
│  ├─ stats/
│  ├─ registry-core/
│  └─ runtime/
│
├─ data-services/
│  ├─ datapack/
│  ├─ persistence/
│  └─ assets/
│
├─ arona-clicker/
│  ├─ types/
│  ├─ state/
│  ├─ registry/
│  ├─ adapters/
│  ├─ services/
│  └─ runtime/
│
├─ datapacks/
│  ├─ test-base/
│  └─ arona-clicker-content/
│
└─ ui/
   ├─ components/
   ├─ controllers/
   ├─ read-model/
   └─ adapters/
```

这是目标语义布局，不要求一次性按目录搬迁。迁移必须先建立入口和依赖约束，再按切片移动实现。

## 约束与非目标

- 不改变现有 tick 调用顺序和状态变更语义；
- 不在本目标内引入新框架或新运行时依赖；
- 不编写存档迁移；状态结构变化按项目纪律直接更新测试与文档；
- 不把所有实体强行泛化为通用引擎实体；只有确实属于机制契约的部分进入 `engine`；
- 迁移期间允许使用 re-export 兼容层，但兼容层不是最终结构；
- 每个切片必须通过 `npx tsc --noEmit` 和 `npm test`。

## 后果

正面后果：

- 基础机制可以脱离 AronaClicker 内容单独测试；
- 测试 Datapack、正式 Datapack、未来其他 Datapack 可以共享引擎；
- UI 不再被内部服务类和具体数据包绑死；
- `GameInstance` 的职责从“所有服务集合”收拢为应用运行时。

代价：

- 需要增加 Engine Context、领域 Adapter、ReadModel、Commands 等接口；
- Registry、PlayerState、SaveData 需要分阶段拆分；
- 迁移期会存在 re-export 和新旧入口并存；
- 与 [[docs/0x-plan&work/active/roadmap-0001-datapack-management]] 的多包管理工作存在交叉，需要按本 ADR 更新 base 语义。

## 实现记录

- 2026-09-01：新增四个公共入口与 check:architecture 边界检查；Value / ValueSource / ValueExpression 首批迁入 src/engine/contracts/expression.ts，RevealStage / RevealTarget / RevealTrigger / AccessStage 第二批迁入 src/engine/contracts/reveal.ts，ExtraValue / ExtraCompound / ExtraPath 第三批迁入 src/engine/contracts/extra.ts，AffectorState / AffectorFlow / AffectorEffect / AffectorPackDef / AffectorPackRef / AffectorInstance 第四批迁入 src/engine/contracts/affector.ts；schema 生成器现同时解析 engine/types 与 engine/contracts，旧 types 路径保留 re-export 兼容层；按 schema-sync 协议重生成 schema，类型检查、架构检查与 npm test（995 项）通过。
- 2026-09-01：M3-1 第一段新增 `ValueEvaluationContext` 与泛型化 `ConditionEvaluationContext` 读取端口，ValueSystem / ConditionSystem 实现对应契约；保留既有 PlayerState 调用面，未改变求值语义。
- 2026-09-01：M3-1 第二段移除 GameNumContext / GameNumEvalDeps 中未被数值树使用的 CharacterSystem 依赖，并同步接线与测试夹具；GameNum 不再携带无效的角色领域依赖。
- 2026-09-01：GameNum 依赖盘点确认数值树仍实际需要 Registry 的实体索引、ValueSystem 与 AffectorEngine；下一段将以这些实际调用面抽取端口，不做整类搬运。
- 2026-09-01：M3-1 第三段新增 `GameNumAffectorContext`，并将 GameNum 的 Affector 读取与区表同步函数改为依赖最小端口；保留 AffectorEngine 作为组合根实现，未改变 flows / zoneModifiers 语义。
- 2026-09-01：M3-2 第一段新增 `StatsQueryContext` 只读查询端口，StatsService 实现该端口，供 Condition / Runtime / UI 后续通过适配层消费；统计写入面保持在 StatsService 内部。
- 2026-09-01：M3-2 第二段新增 `RevealRegistryContext`，VisibilityEval / VisibilityIndex / VisibilityEngine 改为依赖带 revealTriggers 的只读实体索引；Reveal 辅助函数接受 readonly trigger 列表，未改变可见性判定。
- 2026-09-01：Reveal 适配验证完成：可见性三件套不再引用完整 Registry 类型，Reveal helper 与索引接口支持只读触发器集合；全量测试保持通过。
- 2026-09-01：M3-2 收口：Stats、Reveal、Affector 的查询端口均已被实际消费者使用，完整实现仍留在组合根与领域服务侧。
- 2026-09-01：M3-3 独立性验证：新增不加载 `src/data/base` 的 engine-contracts 测试，使用最小 fake registry / affector / reveal context 组合 Value、Condition、Stats 与 GameNum；3 项契约测试与全量 998 项测试通过。
- 2026-09-01：M4-1 首个切片：新增 `src/arona-clicker/runtime.ts` 的 `AronaClickerRuntime` 明确领域组合根入口；应用启动路径改用该入口，`GameInstance` 保留为引擎侧兼容实现，未改变运行时行为。类型检查、架构检查与关键 UI/契约测试通过。
- 2026-09-01：M4-2 首个切片：新增 `src/arona-clicker/services/index.ts` 作为 Story / World / Character / Economy / Color 服务的领域公共出口；先统一依赖方向，再逐服务迁移实现，避免一次性移动造成大范围兼容破坏。
- 2026-09-01：M4-2 第二段：角色培养纯计算已迁入 `src/arona-clicker/services/cultivate-system.ts`；旧 engine 路径仅作为明确登记的兼容 shim，架构检查允许该单一过渡点，后续收口时删除。
- 2026-09-01：M4-2 第三段：`CharaProfileService` 已迁入 AronaClicker 服务层；它依赖领域注册表、玩家覆写与图片解析适配，旧 engine 路径仅保留兼容 shim，后续与 Runtime 接线一并收口。
- 2026-09-01：M4-2 第四段：`CharacterAvailabilityService` 已迁入 AronaClicker 服务层；限定池关闭、世界 Pool 合并等抽卡可及性规则不再以 engine 实现为归属，旧路径仅用于迁移期兼容。
- 2026-09-01：M4-2 第五段：`GachaService` 已迁入 AronaClicker 服务层；代码定义的抽卡模式与领域资源/角色结算仍通过引擎事件和状态写入口协作，避免把具体抽卡规则留在基础引擎。
- 2026-09-01：M4-2 第六段：`ColorEquipmentSystem` 已迁入 AronaClicker 服务层；色彩装备的库存与解锁规则属于产品领域，主题运行时仍作为基础机制被领域服务调用。
- 2026-09-01：M4-2 第七段：好感计算与 `RosterSystem` 已迁入 AronaClicker 服务层；角色持有、通讯录分组、碎片及好感阶梯均不再以基础引擎实现为归属。
- 2026-09-01：M4-2 第八段：`CharacterSystem` 已迁入 AronaClicker 服务层；角色原型表与 roster 解锁语义属于领域数据查询，不再由基础引擎目录承载。
- 2026-09-01：M4-3 第一段：新增 AronaClicker `GameReadModel` / `GameCommands` 契约，UIContext 不再直接依赖 `GameInstance` 类型；ReadModel 当前保留既有只读查询字段，后续逐步减少对内部服务类的暴露。
- 2026-09-01：M4-3 第二段：UIController 增加强类型 `commands` 引用，存档保存与读取已通过 `GameCommands` 访问 Runtime；命令契约使用真实的 `AreaId`、`TravelResult` 与 `SaveData` 类型，不再以 `unknown` 占位。
- 2026-09-01：M4-3 第三段：顶栏的 Tick、reset、日志清理已改经 `GameCommands`，进一步减少 Controller 对 Runtime 具体实现方法的直接写调用。
- 2026-09-01：M4-3 第四段：新增 `src/arona-clicker/runtime-commands.ts`，将 StoryService 的写操作适配为 GameCommands；UI Controller 不再直接调用剧情服务的写方法。
- 2026-09-01：M4-3 第五段：UI Controller 的设施、背包、强化、抽卡与世界线写操作已统一通过 `GameCommands`，Runtime 领域服务仍由适配器持有。
- 2026-09-01：M5-2 第一段：LocalStorage `SaveSystem` 已迁入 `src/data-services/persistence`；旧 save 路径仅作为兼容转发，持久化实现不再归属 UI 或 Runtime 目录。
- 2026-09-01：M5-1 第一段：多文件 ZIP Datapack Loader 已迁入 `src/data-services/datapack`；数据包扫描、JSON 分片合并与图片提取不再归属 `src/data`，旧路径只保留兼容转发。
- 2026-09-01：M5-2 第二段：SaveData 已从 SaveCodec 内部定义提升为共享契约，并由 data-services 提供稳定公开出口；为遵守依赖方向，契约本体位于 engine/contracts，避免 engine 反向依赖 data-services。
- 2026-09-01：M5-2 第三段：SaveSystem 已依赖 `StorageAdapter`，LocalStorage 只是默认介质实现；持久化格式校验与介质访问职责完成初步分离。
- 2026-09-01：M5-2 第四段：快照组装已抽至 `data-services/persistence/save-codec.ts`，由 AronaClicker Runtime 注入使用；SaveCodec 的引擎恢复编排暂留组合根，避免数据服务反向持有 Runtime 子系统。
- 2026-09-01：M5-3 第一段：图片资源登记（mod + zip 路径 → 可显示 URL）已迁入 `data-services/assets/image-store.ts`；引擎旧入口保留兼容转发，避免破坏现有图片解析测试。PicDef/Registry 解析仍属于下一段边界拆分对象。
- 2026-09-01：M5-3 第二段：新增 `data-services/assets/pic-resolver.ts`，解析器只依赖只读 PicDef 映射与 ImageStore；AronaClicker 画像服务已切换到该窄接口，引擎旧解析入口暂作为兼容适配保留。
- 2026-09-01：M5-3 第三段：`PicService` 实现已迁入 `data-services/assets/pic-service.ts`，不再持有完整 Registry；引擎旧系统路径仅作兼容转发，PicDef 查询/图片登记/URL 解析均归入基础数据服务。
- 2026-09-01：M5-4 第四段：AronaClickerRuntime 现在持有 PackManager，并通过组合根适配 `reload`、图片清理与资源登记；引擎不直接拥有包库策略。
- 2026-09-01：M5-4 第五段：UI 数据包导入优先使用 AronaClickerRuntime 的 PackManager 接口，兼容旧 GameInstance 的回退逻辑仅用于迁移期调用者。
- 2026-09-01：M5-4 第六段：AronaClickerRuntime 支持注入包库存储，PackManager 自动持久化包库快照；浏览器入口使用数据服务提供的 JSON 适配器。
- 2026-09-01：M5-4 第七段：Runtime 应用启用集前使用临时 Registry 干跑校验，避免非法包先清理图片或改变正式运行时。
- 2026-09-01：M5-4 第十段：Runtime 提供显式异步包库快照恢复/保存入口，启动层可等待 IndexedDB，不改变引擎同步 API。
- 2026-09-01：M5-4 第十一段：UI 启动先恢复包库快照，失败时安全降级；默认 base 初始化与包库恢复解耦，避免异步恢复覆盖现有启动语义。
- 2026-09-01：M5-4 第十二段：包库弹窗通过 `PackCatalogReadModel` / `PackCatalogCommands` 消费运行时能力，展示包元数据、启用状态与依赖提示，并通过命令完成启停和排序；UI 不持有 `PackManager` 内部 Map。
- 2026-09-01：M5-4 第十三段：Runtime 在异步恢复/显式保存后保留 `AsyncPackSnapshotStore`，包库命令变更会异步写回同一存储；UI 启动不再同时注入互不一致的同步包库存储。
- 2026-09-01：M4-3 第六段：UI 的通讯录装备/培养、聊天已读与主题状态写入均通过扩展后的 `GameCommands`，组件和控制器动作模块不再直接持有或调用 `mutations`。
- 2026-09-01：M4-3 第七段：UI 的强化购买/停用、世界线生命周期与读档解锁均通过 `GameCommands`；控制器保留展示编排，Runtime/领域服务保留状态变更职责。
- 2026-09-01：M4-3 第八段：`GameReadModel.rosterSystem` 改为 `RosterQueryPort`，接口覆盖 UI 实际使用的角色、持有、碎片、通讯录分组与图鉴查询；具体 `RosterSystem` 不再成为 UI 契约的必要类型。
- 2026-09-01：M4-3 第九段：`GameReadModel.colorSystem` 改为 `ColorQueryPort`，覆盖 UI 实际使用的色彩组、主题 token、主题预览及实体主题来源查询；主题运行时写入仍保留在 Runtime/Commands 边界。
- 2026-09-01：M4-3 第十段：`GameReadModel.colorEquipmentSystem` 改为 `ColorEquipmentQueryPort`，UI 只依赖装备查询、色彩聚合与效果读取契约，装备解锁/收集写入仍留在领域服务与 Commands 边界。
- 2026-09-01：M4-3 第十一段：`GameReadModel.story` 改为 `StoryQueryPort`，UI 仅依赖剧情完成、就绪队列、发送门控与当前视图查询；剧情推进写操作继续通过 `GameCommands`。
- 2026-09-01：M4-3 第十二段：`GameReadModel.availabilityService` 改为 `AvailabilityQueryPort`，UI 仅依赖卡池关闭、世界池与可抽取角色查询；可及性领域实现继续由 AronaClicker Runtime 持有。
- 2026-09-01：M4-3 第十三段：`GameReadModel.gachaService` 改为 `GachaQueryPort`，UI 仅依赖卡池定义与抽取计数查询；抽卡执行仍通过 `GameCommands.roll`，不将写入能力暴露给 UI 读取面。
- 2026-09-01：M4-3 第十四段：`GameReadModel.statsService` 复用引擎 `StatsQueryContext`，UI 只依赖快照、上下文、DSL 求值与本轮完成状态查询，不再要求具体 `StatsService` 类型。
- 2026-09-01：M4-3 第十五段：`GameReadModel.spot` 改为 `SpotQueryPort`，当前仅暴露 UI 使用的设施有效等级上限查询；设施升级/解锁写操作仍通过 `GameCommands`。
- 2026-09-01：M4-3 第十六段：`GameReadModel.valueSystem` 改为 `ValueQueryPort`，UI 仅依赖带状态的表达式求值能力，ValueSystem 的 funclet/Extra 注入细节不再进入 UI 契约。
- 2026-09-01：M4-3 第十七段：`GameReadModel.conditionSystem` 改为 `ConditionQueryPort`，揭示、卡池与详情组件只依赖条件表达式/条件组求值，不再要求 ConditionSystem 的注入字段和内部上下文。
- 2026-09-01：M4-3 第十八段：`GameReadModel.affectorEngine` 改为 `AffectorQueryPort`，强化 UI 仅依赖 Affector Pack 查询；挂载、重算与效果应用继续由引擎运行时负责。
- 2026-09-01：M4-3 第十九段：审计确认 UI 没有调用 `CharacterSystem`；移除 `GameReadModel.characterSystem` 及其具体类型依赖。角色只读能力不重复建模，继续由 `RosterQueryPort` 与后续 Registry 查询端口按实际调用面承载。
- 2026-09-01：M4-3 第二十段：新增基础引擎 `WorldCatalogQueryPort` 与 `GameInstance.world` 只读入口，UIContext、世界线选择页、生产页、轨道、设施详情、提示与控制器已完成世界目录查询迁移；端口只承载目录查询，不包含注册表写入/合并能力。
- 2026-09-01：M4-3 第二十一段：审计确认 UI 不使用 `charaProfiles`，移除其具体类型依赖；新增 `PicQueryPort`，读取面仅暴露图片 URL/定义查询，图片登记写入继续限制在数据包导入组合根的兼容路径。
- 2026-09-01：M4-3 第二十二段：`GameReadModel.spotFunctionalitySystem` 改为 `SpotFunctionalityQueryPort`，UI 不再依赖其 Registry、ConditionSystem 与增强目标标签注入细节；设施功能查询仍由引擎实现负责。
- 2026-09-01：M4-3 第二十三段：新增 `ContentCatalogQueryPort`，`GameReadModel.registry` 仅保留 UI 实际读取的只读表集合；完整 Registry 的数据包合并、校验、清空等能力不再成为 UI ReadModel 的类型要求。
- 2026-09-01：M4-3 第二十四段：`GameReadModel.gameNumSystem` 改为 `GameNumQueryPort`，UI 仅依赖数值求值与产出查询；GameNum 的索引、失效、构建及 Affector 桥接能力不进入 UI 契约。
- 2026-09-01：M7-3 第一段：故事栏层级作为 AronaClicker 产品内容迁移到 `src/arona-clicker/content/story-hierarchy.ts`，UI 不再直接依赖 `src/data/base`；旧模块仅作为迁移期兼容出口保留。
- 2026-09-01：M6-1/M6-2 第一段：建立 `src/data/test-datapack.ts` 与 `src/arona-clicker/content/default-datapack.ts` 双入口，应用启动改从 AronaClicker 内容层获取默认 Datapack；现有 `data/base` 内容本体暂保留为实现源，旧数据入口继续兼容，后续分批物理迁移。
- 2026-09-01：M6-1/M6-2 第二段：资源 ID 定义迁移至 AronaClicker 内容层；`data/base` 对应文件只保留兼容 re-export，继续区分产品定义与测试包入口。
- 2026-09-01：M6-1/M6-2 第三段：物品定义迁移至 AronaClicker 内容层；测试/示例包保留兼容出口，内容实现继续按实体类别分批脱离 `data/base`。
- 2026-09-01：M6-1/M6-2 第四段：资源与物品已完成实际内容迁移；世界线/区域/设施因 Datapack 汇总存在声明依赖，后续按依赖顺序迁移，避免制造无意义的路径包装层。
- 2026-09-01：M6-1/M6-2 第五段：区域定义已迁移至 `src/arona-clicker/content/areas.ts`；`data/base/areas.ts` 仅保留兼容 re-export，正式内容层继续承接产品定义，区域与设施关系的汇总行为保持不变。
- 2026-09-01：M6-1/M6-2 第六段：世界线定义已迁移至 `src/arona-clicker/content/inits.ts`；`data/base/inits.ts` 仅保留兼容 re-export，世界线解锁条件、揭示与进入触发器仍作为产品内容定义，不上移到引擎机制层。
- 2026-09-01：M6-1/M6-2 第七段：设施定义已迁移至 `src/arona-clicker/content/spots.ts`；`data/base/spots.ts` 仅保留兼容 re-export，设施的产出与升级参数属于产品内容，设施功能 builder 与执行机制仍属于引擎职责。
- 2026-09-01：M6-1/M6-2 第八段：角色原型定义已迁移至 `src/arona-clicker/content/characters.ts`；角色原型属于产品内容，角色变体、培养曲线、色彩装备与卡池等关联定义暂由 `character-rework.ts` 继续编排，后续作为同一角色域切片拆分。
- 2026-09-01：M6-1/M6-2 第九段：普通强化与全局强化定义已迁移至 `src/arona-clicker/content/enhancements.ts`；强化的名称、价格、标签和 Affector 包引用属于产品内容，Affector 的解释与挂载机制仍由引擎负责。
- 2026-09-01：M6-1/M6-2 第十段：掉落表定义已迁移至 `src/arona-clicker/content/drop-tables.ts`；掉落配置属于产品内容，掉落结算机制仍由基础引擎解释，旧 `data/base` 路径仅保留兼容出口。
- 2026-09-01：M6-2 第十一段：正式默认 Datapack 入口改为显式组装已迁移内容，未迁移的故事、图片与角色重构定义暂继承测试包；该继承仅是内容迁移过渡，不改变基础引擎与产品内容的职责边界。
- 2026-09-01：M6-2 第十二段：图片资产与角色画像已进入 AronaClicker 内容层；默认入口直接依赖具体内容模块而不依赖内容总索引，避免 `content/index` 与 `default-datapack` 形成循环。
- 2026-09-01：M6-2 第十三段：培养曲线作为角色域的独立内容模块迁移至 `content/cultivate-curves.ts`；曲线参数属于产品平衡内容，培养算法仍由领域服务解释。
- 2026-09-01：M6-2 第十四段：默认与特殊角色差分开始迁移至 `content/character-variants.ts`；角色差分定义属于产品内容，旧总表仅在迁移期提供兼容出口与卡池编排。
- 2026-09-01：M6-2 第十五段：角色差分总表中的重复实现已删除；卡池暂由旧总表消费内容层差分导出，避免出现两套差分定义并行演化。
- 2026-09-01：M6-2 第十六段：色彩组定义开始迁移至 `content/colors.ts`；色彩名称、主题 token、头像构成与解锁条件属于 AronaClicker 内容，色彩派生与主题运行时仍由领域/引擎服务负责。
- 2026-09-01：M6-2 第十七段：色彩组与色彩装备的重复实现已清除；两者均由 AronaClicker 内容模块提供，旧角色总表只保留兼容导出，避免内容定义产生双份来源。
- 2026-09-01：M6-2 第十八段：卡池定义已迁移至 `content/gacha-pools.ts`，卡池成员引用内容层角色差分；抽卡概率与价格属于产品平衡内容，卡池结算与可及性判断仍由领域服务负责。
- 2026-09-01：M6-2 第十九段：好感台阶内容已迁移至 `content/affection-content.ts`；默认 Datapack 负责过滤旧测试条目并显式组装产品内容，台阶触发与奖励机制仍由领域服务解释。
- 2026-09-01：M6-2 第二十段：羁绊剧情已迁移至 `content/bond-content.ts`；active story 入口与 story 正文均由产品内容层声明，`character-rework.ts` 仅保留兼容转发，剧情执行机制仍由引擎/领域服务负责。
- 2026-09-01：M6-2 第二十一段：Trigger 声明已迁移至 `content/triggers.ts`；里程碑阈值、奖励数值与目标 ID 属于产品内容，Trigger 的侦测、条件求值、事件总线与效果执行仍属于基础引擎机制。
- 2026-09-01：M6-2 第二十二段：对话空间的 owner、cooldown 与 block 声明已迁移至 `content/story-conversation-walls.ts`；这些是产品内容参数，抽取、冷却计时、条件求值与阻断执行仍由剧情领域/引擎机制负责。
- 2026-09-01：M6-2 第二十三段：默认闲聊池树已迁移至 `content/story-pools.ts`，数据包汇总通过内容层获取池结构；旧故事聚合文件暂保留兼容导出，重复定义的最终清除与故事入口/演出正文拆分同步完成。
- 2026-09-01：M7-1 第二段：聊天流、悬浮提示与选择页的 UI 基础模块改用 `GameReadModel` 或最小读取端口，不再把 `GameInstance` 作为组件基础设施的必要类型；控制器仍是迁移期组合宿主，后续继续收窄其运行时依赖。
- 2026-09-01：M7-1 第三段：数据包导入/日志导出模块改用局部运行时能力接口，具体运行时类只在应用组合根负责实现，不再向 UI IO 服务传播。
- 2026-09-01：M4-3 第二十五段：命令适配器新增 `GameCommandSource` 结构化契约，具体 `GameInstance` 仅作为当前组合根实现该契约；Commands 对外保持稳定，适配器不再要求调用者依赖完整运行时类。
- 2026-09-01：M6-2 第二十四段：active story 入口定义已迁移至 `content/story-active-entries.ts`，测试 Datapack 汇总不再从旧故事聚合器取得该表；旧文件中的 legacy 定义仅为迁移期兼容，最终清除需与 passive 入口及故事正文拆分同步完成。
- 2026-09-01：M6-2 第二十五段：passive story 入口定义已迁移至 `content/story-passive-entries.ts`，闲聊权重、标签、揭示与奖励均属于产品内容；旧聚合器中的重复定义暂作兼容保留，待故事正文和测试包入口完成收口后删除。
- 2026-09-01：M8-1 第一段：两个应用入口通过 `src/app/runtime-bootstrap.ts` 共享 Runtime 创建、默认 Datapack 加载与默认 Init 定义；应用层统一装配，UI 仍负责 Controller 挂载，纯引擎入口仍负责无 UI 启动。
- 2026-09-01：M6-2 第二十六段：夏莱日常 7 条故事正文迁移至 `content/story-schale-daily.ts`；剧情文本、奖励与链式 flag 属于产品内容，故事执行与效果解释仍由引擎/领域服务负责，旧聚合器仅作迁移期组装。
- 2026-09-01：M6-2 第二十七段：阿比多斯与千禧年 8 条区域闲聊正文迁移至 `content/story-regional-chat.ts`；区域故事文本和奖励仍属于产品内容，复杂主线/分支暂作为下一切片处理。
- 2026-09-01：M6-2 第二十八段：星野相关 5 条对话、图片和邀约正文迁移至 `content/story-hoshino.ts`；图片引用与邀约卡片是产品内容声明，图片解析和剧情执行仍由数据服务/引擎机制负责。
- 2026-09-01：M6-2 第二十九段：芹香上下篇与当前 Run 三篇故事正文迁移至 `content/story-chains.ts`；跨 Run/本轮状态条件仍由故事入口声明，故事执行器继续负责揭示与链式推进机制。
- 2026-09-01：M6-2 第三十段：夏莱欢迎、设备简报和流剧场预演正文迁移至 `content/story-schale-main.ts`；演出效果参数属于产品内容，聊天流清理、定位文本与剧情推进仍由引擎机制执行。
- 2026-09-01：M6-2 第三十一段：千禧年欢迎与游戏开发部危机 6 条正文迁移至 `content/story-millennium-main.ts`；分支跳转、插入剧情和奖励参数属于产品声明，goto/insert 执行机制仍由故事服务负责。
- 2026-09-01：M6-2 第三十二段：阿比多斯欢迎正文迁移至 `content/story-abydos-main.ts`，`content/stories.ts` 成为产品故事正文总组装入口；旧 `data/base` 故事文件不再承载正文实现，仅提供迁移期 re-export。
- 2026-09-01：M6-2 第三十三段：默认 Datapack 的故事入口、正文和闲聊池改为内容层显式组装，测试 Datapack 不再作为故事字段的隐式来源；剩余非故事字段继续按切片迁移。
- 2026-09-01：M6-2 第三十四段：Affector Pack、资源栏显示策略和 Extra 常量迁移至 AronaClicker 内容层；效果解释仍由基础引擎负责，数值、标签与显示文案属于产品内容，默认包不再从测试包取得这些字段。
- 2026-09-01：M6-2 第三十五段：默认 Datapack 不再导入测试 Datapack；无产品定义的 funclet 与已冻结的 CharacterBonuses 以显式空表表达，测试包继续独立作为测试输入。
- 2026-09-01：M6-2 第三十六段：测试/示例数据包 `src/data/base/datapack.ts` 仅保留内容组合职责，资源栏、Affector Pack、Extra 与角色持久化配置的实现归入 `src/arona-clicker/content`；产品内容与测试数据入口进一步分离，旧路径仅承担迁移期兼容导出。
- 2026-09-01：M6-3 第一段：依赖基础包的引擎/UI 回归测试显式从 `src/data/test-datapack.ts` 注入 `baseDatapack`，测试不再依赖旧 `src/data/index.ts` 入口；测试包入口与产品默认内容入口的边界得到实际约束。
- 2026-09-01：M8-1 收口：`src/main.ts` 与 `src/ui/main.ts` 均通过 `src/app/runtime-bootstrap.ts` 创建运行时并加载 AronaClicker 默认内容；统一启动装配已完成，后续启动差异仅保留 UI 挂载职责。
- 2026-09-01：M8-2 第一段：好感与角色原型测试直接引用 `src/arona-clicker/services`；领域兼容 shim 仍被引擎内部装配使用，因此本阶段只清理外部测试依赖，不提前删除仍有内部消费者的旧路径。
- 2026-09-01：M4-2/M8-2 第二段：`GameInstance` 新增 `GameInstanceWiring` 注入点，默认 wiring 仅作为迁移期兼容实现；产品运行时可以逐步接管组合根装配，最终删除引擎目录中的领域 shim 而不改变运行时门面。
- 2026-09-01：M4-2/M8-2 第三段：`wireGameInstance` 的实现迁移到 `src/arona-clicker/runtime-wiring.ts`，`engine/game/wiring.ts` 仅保留兼容转发；领域服务装配的实现归属已进入产品 Runtime，图片服务直接从 `data-services` 注入。
- 2026-09-01：M4-1/M4-2/M8-2 第四段：`GameInstance` 的运行时实现迁移到 `src/arona-clicker/runtime-game-instance.ts`，引擎旧入口仅保留兼容 re-export；AronaClicker Runtime 直接拥有组合根实现，旧入口待完成调用方迁移后删除。
- 2026-09-01：M4-2/M8-2 第五段：`StoryService` 编排层归入 AronaClicker 服务层，旧 engine/game 入口仅作兼容转发；Story 流程辅助模块的通用机制与领域语义仍需继续拆分，不以一次移动宣称基础引擎已完全纯化。
- 2026-09-01：M4-2/M8-2 第六段：`SpotService` 归入 AronaClicker 服务层，设施规则不再由基础引擎目录承载；引擎只提供数值、条件、效果、状态变更与事件等机制依赖。
- 2026-09-01：M4-2/M8-2 第七段：`InitService` 归入 AronaClicker 服务层；世界线生命周期与区域移动是产品领域语义，Init 快照/挂载辅助仍通过引擎机制端口协作，未改变状态变更入口。
- 2026-09-01：M4-2/M8-2 第八段：`ItemService` 与 `EnhancementService` 归入 AronaClicker 服务层；物品、强化的产品规则不再由基础引擎目录承载，通用效果/条件/状态变更机制继续由引擎提供。
- 2026-09-01：M4-2/M8-2 第九段：`ChatFlowService` 归入 AronaClicker，基础引擎通过 `ChatFlowPort` 消费演出能力；`SessionService` 归入 `engine/runtime`，因为帧循环、离线收益与定时器属于通用运行时基础设施而非产品领域规则。
- 2026-09-01：M4-2/M8-2 第十段：Story 主流程归入 AronaClicker 服务层；跳转、奖励与游标辅助模块仍需继续拆分，基础引擎暂通过兼容出口维持旧调用方，不提前删除仍有消费者的路径。
- 2026-09-01：M4-2/M8-2 第十一段：Story 上下文、跳转、重读与奖励辅助实现归入 AronaClicker 服务层；游标状态暂保留为引擎侧序列化契约，后续需评估其与 SaveData 的边界。
- 2026-09-01：M4-2/M8-2 第十二至十五段：StoryCursorState、运行时重置与存档恢复编排归入 AronaClicker；引擎仅保留 `StoryCursorSnapshot` 等持久化 DTO 与通用子系统，`RuntimeEffectReactor` 通过 `StoryEffectPort` 请求剧情启动。旧入口仅作为兼容转发，待调用方迁移完成后删除。
- 2026-09-01：M2-2 后续切片：将 `ProductionResult` 与 `TickResult` 提取到 `src/engine/contracts/tick.ts`，引擎帧结算、会话服务和 DevLog 直接依赖基础契约；领域操作结果继续留在产品层迁移范围。
- 2026-09-01：M8-2 后续切片：生产 UI 控制器改用 AronaClicker Runtime 实现与 Data Services 存档契约，强化诊断标签工具迁入 AronaClicker 服务层；对应旧 `engine/game` 入口仅作迁移期兼容。
- 2026-09-01：M4-2/M8-2 后续切片：`StateMutationService` 不再直接导入培养/好感实现，而是消费 `CharacterProgressionPort`；AronaClicker wiring 注入具体算法，保持单一状态写入口并解除 engine → domain 实现依赖。
- 2026-09-01：M4-2/M8-2 后续切片：`ColorUnlockReactor` 改用 `ColorEquipmentUnlockPort`，只依赖装备解锁复检能力；具体 `ColorEquipmentSystem` 仍由 AronaClicker wiring 提供。
- 2026-09-01：M8-2 后续切片：`CharacterProgressionPort` 接线完成后，培养与好感旧 `engine/system` shim 已无消费者并删除；具体算法由 AronaClicker wiring 注入。
- 2026-09-01：M8-2 后续切片：角色原型、通讯录、抽卡、角色可及性、画像与图片服务的旧 `engine/system` shim 已确认无消费者并删除；产品实现分别由 AronaClicker 与 Data Services 承载。
- 2026-09-01：M4-2/M8-2 后续切片：`ColorSystem` 实现迁移至 AronaClicker 服务层；引擎效果与解锁反应器分别通过最小主题/解锁端口消费，旧 `engine/system/color-system.ts` 暂作兼容出口。
- 2026-09-01：M8-2 后续切片：`ColorEquipmentSystem` 已无引擎内部直接消费者，删除旧 `engine/system/color-equipment-system.ts` shim；产品实现与反应器端口均位于新边界。
- 2026-09-01：M8-2 后续切片：项目内测试与生产代码已不再引用 `engine/game-instance`，该历史兼容入口删除；Runtime 的唯一实现入口为 AronaClicker。
- 2026-09-01：M8-2 后续切片：确认好感、培养与色彩装备 shim 仍被 `StateMutationService` / `ColorUnlockReactor` 等引擎内部代码消费，已恢复并明确标记为待能力端口拆分；其余领域服务的外部消费者仍已迁出旧入口。
- 2026-09-01：M6-1/M6-2/M6-3 收口：产品默认 Datapack、测试/示例 Datapack 与测试注入入口已经分离；旧数据路径只保留兼容导出，后续兼容层删除不再影响数据包职责划分。
- 后续实现进度记录在 [[docs/0x-plan&work/completed/roadmap-0005-engine-domain-consolidation]]；设计变更只更新本 ADR。

## 相关文档

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/01-architecture/overview]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/refactoring]]
- 2026-09-01：边界收敛记录：`engine/game` 已清空；PlayerState 初始化、per-Init 快照/字段清单、Init Trigger 挂载与 GameView 组装分别归入 `src/arona-clicker/state`、`src/arona-clicker/services` 与 `src/arona-clicker/read-model`。基础引擎保留通用机制、Registry、状态写入契约与 Runtime Session，产品 Runtime 持有具体 StateMutation 实现。
- 2026-09-01：边界收敛记录：StateMutationService 的具体实现归入 `src/arona-clicker/state`；`src/engine` 仅保留 `StateMutationPort`/`EffectMutationPort` 等契约与 Effect/Tick 编排，禁止通过 fallback 反向实例化产品写入服务。Runtime wiring 负责注入唯一实例。
- 2026-09-01：边界收敛记录：产品操作结果（Story/Spot/Item/Enhancement/Travel）与 `GameView` 已从 `src/engine/types` 移至 `src/arona-clicker/contracts/results.ts` 与 `contracts/view.ts`；基础引擎仅保留 `TickResult` 等通用运行时输出。
- 2026-09-01：边界收敛记录：`Resource` 枚举及全局资源判定属于 AronaClicker 产品规则，已迁移至 `src/arona-clicker/types/ids.ts`；基础引擎只处理字符串形式的通用资源 ID，不再导出产品资源集合或跨世界线策略。
- 2026-09-01：边界收敛记录：`Character`、`CharacterRarity`、`CharacterSchool` 的具体值词表属于 AronaClicker 产品内容，已迁移至 `src/arona-clicker/types/ids.ts`；基础引擎中的角色相关契约退化为字符串标识/分类类型，避免引擎出口携带具体产品枚举。
- 2026-09-01：边界收敛记录：新增 `src/arona-clicker/types/character.ts` 作为角色领域类型的唯一产品侧消费入口；由于 Registry 仍同时承担角色索引与通用内容目录，`CharacterData`/`CharacterVariantDef` 本体暂留旧契约，后续以最小只读 Registry 端口拆除这层耦合。
- 2026-09-01：边界收敛记录：新增 `CharacterCatalogEntry` 最小读取契约，`ContentCatalogQueryPort.characters` 只暴露角色 ID、显示名与 Tag；UI/显示名消费面不再绑定完整角色实体，完整 `CharacterData` 迁移可在后续 Registry 泛化后进行。
- 2026-09-01：边界收敛记录：AronaClicker 的角色内容、培养/好感/抽卡/通讯录服务及相关 UI 已统一从 `src/arona-clicker/types/character.ts` 获取实体类型；旧引擎类型文件只作为暂存源，不再作为产品消费者入口。
- 2026-09-01：边界收敛记录：UI 的角色变体查询统一经 `RosterQueryPort`，`ContentCatalogQueryPort` 仅保留角色目录所需的最小信息，不再向 UI 暴露完整 `characterVariants` 表；完整变体数据继续由 Registry/AronaClicker 领域服务协作持有。
- 2026-09-01：边界收敛记录：`TagStatService` 的角色收集重算只依赖注入的 `characterProtoOf` 原型解析能力，不再将完整角色变体表放进引擎统计端口；Registry 查表由 AronaClicker wiring 提供。
- 2026-09-01：边界收敛记录：`CharacterProgressionPort` 已从基础引擎契约目录迁移至 `src/arona-clicker/contracts`；培养/好感是产品成长机制，基础引擎不再导出其角色实体与配置类型。
- 2026-09-01：边界收敛记录：角色与角色变体定义构造器已迁移至 `src/arona-clicker/content/def-factory`；基础引擎 `def-factory` 仅保留通用实体/机制构造器，产品角色内容由领域内容层负责创建。
- 2026-09-01：边界收敛记录：Chara 名称/头像解析已迁移至 AronaClicker 服务层；其角色目录回退、玩家自定义与演出覆盖优先级属于产品资料语义，不再放在基础引擎 core 目录。
- 2026-09-01：边界收敛记录：Affector 生命周期、运行时效果反应器与 Tick 结算均已解除对具体 `Registry` 类的依赖，分别消费最小查询上下文或不消费注册表；Registry 具体实现继续由组合根提供。
- 2026-09-01：边界收敛记录：设施功能查询端口只暴露 `SpotFunctionalityView` 最小结构；基础 Affector 机制不再依赖完整设施功能产品定义及其附加字段。
- 2026-09-01：边界收敛记录：Registry 实现与 Datapack 静态校验已归入 `src/data-services/registry`；基础引擎保留机制查询契约，数据包编译态容器由基础数据服务提供。
- 2026-09-01：边界收敛记录：Datapack 汇总契约已归入 `src/data-services/contracts/datapack.ts`；Schema 生成器同时读取数据服务契约与引擎类型，基础引擎不再对外提供 Datapack 聚合类型。
- 2026-09-01：边界收敛记录：`CharacterData` 作为数据包角色元数据记录已归入 `src/data-services/contracts/character-data.ts`；产品侧通过 `src/arona-clicker/types/character.ts` 统一消费，基础引擎 `common.ts` 不再承载该产品实体。
- 2026-09-01：边界收敛记录：`CharacterVariantDef` 作为数据包角色变体记录已归入 `src/data-services/contracts/character-variant.ts`；产品侧通过 `src/arona-clicker/types/character.ts` 统一消费，基础引擎不再导出该实体。
- 2026-09-01：边界收敛记录：`CultivateCurveDef` 作为数据包成长配置已归入 `src/data-services/contracts/cultivate-curve.ts`，Builder 归入 AronaClicker 内容层；培养曲线解释与状态变化仍由产品成长服务执行。`ThemeDef` 因仍被引擎世界/主题声明机制直接消费，暂保留在引擎契约中。
- 2026-09-01：边界收敛记录：`AffectionConfigDef` 作为数据包好感配置已归入 `src/data-services/contracts/affection-config.ts`；好感算法与状态写入留在 AronaClicker，基础引擎不再导出产品好感配置。
- 2026-09-01：边界收敛记录：主题声明类型 `ThemeDef`、主题 token 与实体主题槽已从角色类型文件拆至 `src/engine/types/theme.ts`；它们属于引擎主题机制的独立契约，由世界线声明、主题运行时和 UI 映射共同消费。
- 2026-09-01：边界收敛记录：`RosterEntry`、`ProtoStat`、`GachaPoolState` 已从角色声明模块归入 `src/engine/types/state.ts`；这是运行时状态子结构整理，完整 `PlayerState` 仍由后续状态端口迁移负责。
- 2026-09-01：边界收敛记录：条件与可见性机制改用 `ConditionState` 最小读取契约；产品状态由组合根适配，好感等产品规则通过注入查询器提供，避免基础引擎条件系统持有完整 PlayerState 语义。
- 2026-09-01：边界收敛记录：StatsService 改用 `StatsState` 最小读取契约；统计引擎不再在状态注入 API 上绑定 AronaClicker 完整 PlayerState，仍由组合根提供结构兼容的状态视图。
- 2026-09-01：边界收敛记录：ValueSystem 改用 `ValueState` 最小读取契约；基础数值求值只依赖其实际读取字段，Funclet 参数覆盖与 Extra 查询继续通过引擎端口注入。
- 2026-09-01：边界收敛记录：GameNum 改用 `GameNumState`；其在 ValueState 之上仅读取 tag/entity effects 与 spot tag overrides，区表聚合、缓存求值和 Affector flows 不再显式绑定完整 PlayerState。
- 2026-09-01：`GameNumQueryPort` 同步改用 `GameNumState`，UI/Runtime 的数值查询契约与引擎内部求值边界保持一致。
- 2026-09-01：TriggerSystem 改用 `TriggerState`，将条件读取与 once 完成记录作为最小引擎状态面。
- 2026-09-01：FuncletExecutor 改用 `ValueState`，参数覆盖仅复制 flags 后交给 ValueSystem 求值。
- 2026-09-01：`VisibilitySnapshot` 迁移至 `engine/contracts/reveal.ts`；Reveal/Visibility 结果与玩家运行时状态分离，旧 state 入口仅保留兼容导出。
- 2026-09-01：ConditionState 的 `storyLog` 改用 `StoryCompletionState[]`，基础条件机制只观察完成记录 ID，产品故事记录形状继续留在 AronaClicker。
- 2026-09-01：ConditionState 的 `protoStats` 改用 `ProtoStatState`，基础条件机制只观察累计获得数。
- 2026-09-01：动态 Spot 标签覆盖改用 `SpotTagOverrideState` 引擎契约；旧 `SpotTagOverride` 保留为兼容别名。
- 2026-09-01：新增 `src/arona-clicker/types/state.ts` 作为产品状态唯一消费入口；状态工厂、状态写入与 InitSavepoint 已完成入口迁移，PlayerState 的底层定义暂保留在 engine 作为过渡源。
- 2026-09-02：`src/arona-clicker/types/state.ts` 已升级为完整的 PlayerState / InitSnapshot 定义，并组合产品故事/角色运行时状态；基础引擎的动态 Spot 标签契约统一使用 `SpotTagOverrideState`。测试入口已切换到产品状态类型，旧 `engine/types/state.ts` 已删除。
- 2026-09-02：Chara 资料完成三分：Datapack 声明 `CharaProfileDef` 归入 `src/data-services/contracts/chara-profile.ts`，玩家覆写与解析结果归入 AronaClicker 类型，Builder 归入产品内容层；引擎不再导出 Chara 资料类型或 Builder。
- 2026-09-02：角色持久化配置 `CharacterPersistConfig` / `CharacterPersistScope` 归入 `src/data-services/contracts/character-persist.ts`；它作为 Datapack 的状态分层声明由数据服务读取，AronaClicker 负责提供具体配置与解释，基础引擎角色类型不再承载该配置。
- 2026-09-02：产品 `ContentCatalogQueryPort` 迁移至 `src/arona-clicker/contracts/content-catalog.ts`；引擎显示名解析改用本地最小 `DisplayNameCatalog`，基础引擎不再拥有包含 Gacha/Color 等产品目录的查询端口。
- 2026-09-02：Gacha 配置 `GachaPoolDef`、`GachaMode` 及其概率/保底/重复奖励子结构迁移至 `src/data-services/contracts/gacha-pool.ts`，Builder 迁移至 AronaClicker 内容层；基础引擎不再导出招募配置或 Builder。
- 2026-09-02：Color 配置 `ThemeDesignDef`、`ColorGroupDef`、`ColorEquipmentDef` 及色位结构迁移至 `src/data-services/contracts/color.ts`，Builder 迁移至 AronaClicker 内容层；主题叠加运行时仍留在引擎，基础引擎不再导出具体色彩数据或 Builder。
- 2026-09-02：Item/DropTable 配置 `ItemDef`、`DropTableDef`、`DropTableEntry` 迁移至 `src/data-services/contracts`，其 Builder 归入 AronaClicker 内容层；引擎只保留通用表达式、Reveal、Affector 引用等机制契约，LootSystem 继续作为产品掉落解释器。
- 2026-09-02：Enhancement 配置 `EnhancementDef` 与挂靠元数据迁移至 `src/data-services/contracts/enhancement.ts`，Builder 归入 AronaClicker 内容层；强化定义中的 Effect、Reveal、Affector 引用仍复用基础机制契约，购买/持有/撤回规则由产品服务解释。
- 2026-09-02：PassivePool 配置 `PassivePoolDef` / `PassivePoolChild` 迁移至 `src/data-services/contracts/passive-pool.ts`，Builder 归入 AronaClicker 内容层；基础引擎不再承载产品池树实体，池 gate、路径权重和冷却语义由 AronaClicker 服务解释。
- 2026-09-02：纯演出契约 `StoryDef`、`Talklet`、`StoryChoice` 归入 `src/data-services/contracts/story.ts`，Story/Talklet/StoryEntry Builder 归入 AronaClicker 内容层；演出字段复用基础 Effect/Condition/ID 机制，剧情入口的触发、奖励与重读策略继续由产品层解释。
- 2026-09-02：StoryEntry 全部数据契约归入 `src/data-services/contracts/story-entry.ts`，删除引擎混合内容桶；由于 Event/Effect 仍需要传递聊天演出，抽取 `engine/contracts/talklet.ts` 作为引擎向内的最小机制契约，禁止 `src/engine` 反向导入 `src/data-services`。
- 2026-09-01：Runtime 组合根、产品领域服务与产品 Contracts 的 PlayerState 引用统一经 AronaClicker 状态入口，降低产品层对 engine/types 状态桶的直接耦合。
- 2026-09-01：SaveData 组装实现迁移至 `src/arona-clicker/runtime-save-codec.ts`；`data-services` 不再承载包含产品 Story/聊天语义的快照编排代码。
- 2026-09-01：`SaveBuildContext` / `SaveCodec` 迁移至 `src/arona-clicker/contracts/save-codec.ts`；存档构建上下文归产品编排，`SaveData` 暂作为跨层持久化 DTO。
- 2026-09-01：完整 `SaveData` 迁移至 `src/arona-clicker/contracts/save-data.ts`；data-services 的 `SaveSystem` 改为泛型 JSON 容器，engine 不再拥有包含 `PlayerState` 的产品存档结构。
- 2026-09-01：故事完成/阅读记录迁移至 `src/arona-clicker/types/story-state.ts`，角色运行时 `RosterEntry` / `ProtoStat` / `GachaPoolState` 迁移至产品角色类型入口；本轮先切断产品消费者对旧引擎状态定义的依赖，兼容源待完整 PlayerState 下沉后移除。
- 2026-09-01：`StateMutationPort` 移除完整 `PlayerState` 的 `setState` 要求，新增 AronaClicker 侧 `StateMutationHostPort` 承担宿主状态同步；Effect/Affector/Tick/Session 仅使用最小运行时状态契约，并保留可选同步兼容桥。
- 2026-09-01：将 `ResourceAmounts`、`StatCounters`、三层统计快照与 `StatsContext` 移入 `engine/contracts/stats.ts`；统计机制的契约不再与 PlayerState 混在同一状态类型桶。
- 2026-09-01：AffectorEngine 内部改用 `AffectorRuntimeState`；其 `setState` 保留 `PlayerState` 作为宿主同步入口，Spot 功能查询同步改用 `FunctionalityState`，将业务读取从完整 PlayerState 中分离。
- 2026-09-01：EffectEngine 与 TickSystem 分别引入 `EffectRuntimeState`、`TickState` 作为内部读取/结算面；完整 PlayerState 仅保留状态同步职责。
