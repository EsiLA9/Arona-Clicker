# 08-roadmap/0005 — 基础引擎与 AronaClicker 领域内聚

> 本文回答：如何将基础引擎、基础数据服务、AronaClicker 领域服务、具体 Datapack 与 UI 逐步内聚。设计权威见 [[docs/plan-work/completed/adr-0005-engine-domain-boundaries]]；本文只记录施工切片、状态和验收。

**状态：✅ 已完成（2026-09-02）**

## 目标陈述

施工记录（2026-09-02）：M8-2 最终验收完成：基础引擎不再保留产品实体聚合层、产品状态效果分支或产品演出编排；数据服务负责数据包/资源/存储；AronaClicker 负责 Runtime、状态、领域服务、内容与效果宿主；UI 组件使用 ReadModel，控制器通过 Commands 写入。全量 108 个测试文件/1029 项测试、TypeScript 类型检查与架构边界检查均通过。本 Roadmap 目标完成。

施工记录（2026-09-02）：完成演出文本契约收敛：`ChatTextKind`、`ChatTextStyle`、`ChatTextEffectValue` 移至 `src/engine/contracts/chat-presentation.ts`，并切换 Engine Event、ChatFlow、RuntimeEffectReactor、Affector 文本解释器及 UI 引用。该切片不改变运行语义，完成后类型检查通过；下一步进行全量回归与公共出口审计。

施工记录（2026-09-02）：公共出口审计完成：`src/arona-clicker/index.ts` 不再宽泛转发 `engine/types`；引擎根入口保留机制、最小契约与通用 ID/DSL，产品目录、结果、状态、图片与演出编排均从领域或数据服务入口提供。`engine/types/index.ts` 的角色注释同步改为通用 ID 入口，避免误认为它仍承载角色实体。

施工记录（2026-09-02）：M8-2 清理切片完成：删除无项目内消费者的 `src/engine/types/entities.ts` 兼容聚合层，事件类型改为直接引用 `engine/contracts/affector`，引擎类型入口不再保留历史实体总表。类型检查、全量 108 个测试文件/1028 项测试与架构边界检查通过。

施工记录（2026-09-02）：M7-1/M7-3 清理切片完成：删除 `UIFacingGame` 兼容别名，图鉴弹窗等 UI 组件直接依赖 `GameReadModel`；同时清理 AronaClicker Runtime 中已过时的迁移期注释。类型检查、全量 108 个测试文件/1028 项测试与架构边界检查通过。

施工记录（2026-09-02）：M8-2 存档纪律切片完成：移除 `runtime-save.ts` 中旧资源桶迁移、缺失 Extra 补全与缺失 Area 推断；将回归用例改为验证当前 SaveData 完整往返。类型检查、全量 108 个测试文件/1028 项测试与架构边界检查通过。

施工记录（2026-09-02）：M2-2/M4-2/M8-2 Effect 边界切片完成：新增 `EffectRuntimeHandler`，EffectEngine 移除 EventBus 与产品演出分发表，AronaClicker wiring 注入主题/剧情/聊天请求转换器；新增引擎隔离回归，类型检查与 17 项 EffectEngine 测试通过，待全量回归。

施工记录（2026-09-02）：Effect 边界切片全量验收完成：全量测试最终为 108 个测试文件、1029 项测试，类型检查与架构边界检查通过。EffectOp 声明暂保共享 DSL，以保证 Datapack 可解析；产品执行语义已通过 Handler 注入从引擎实现中隔离。

施工记录（2026-09-02）：M4-2/M8-2 状态写入切片完成：将完整 `EffectMutationPort` 与 `effect-ops` 实现移至 AronaClicker 状态层，删除 `src/engine/system/effect-ops.ts`；基础引擎不再直接承载资源/设施/强化/角色/好感写入分支。类型检查通过，待全量回归。

施工记录（2026-09-02）：剧情演出载荷切片完成：完整 `Talklet` / `StoryChoice` 归入数据服务，引擎 `EngineTalklet` 收缩为最小嵌入结构。类型检查与 52 项剧情/聊天专项测试通过，待全量回归后继续最终出口审计。

施工记录（2026-09-02）：`RuntimeEffectReactor` 迁移完成：Color/Story/ChatFlow 效果请求的实际编排进入 AronaClicker 服务层，引擎保留效果机制与请求端口。类型检查、Effect/剧情 31 项专项回归通过，待全量回归后继续审计。

施工记录（2026-09-02）：补回迁移后世界/通用数据契约的字段 TSDoc 标签，并重新生成编辑器 Schema，避免结构内聚过程中丢失数据编辑元数据；类型检查与架构边界检查通过。

施工记录（2026-09-02）：事件机制契约切片完成：EventBus 的最小事件形状与类型提取工具进入 `engine/contracts/event.ts`，具体 `GameEvent` 载荷与机制实现进一步解耦。类型检查、EventBus 9 项测试与架构边界检查通过。

施工记录（2026-09-02）：公共入口收敛切片完成：AronaClicker 不再宽泛转发 `engine/types`，内容 Builder 通过产品内容出口显式提供。类型检查与 31 项公共入口/Builder 专项测试通过，待全量回归后继续进行最终引擎出口审计。

施工记录（2026-09-02）：EventBus 机制切片完成：`EventBus<TEvent>` 支持独立事件联合类型，默认 `GameEvent` 行为保持不变；类型检查与 15 项事件总线/反应器专项测试通过。下一步继续收敛产品事件载荷与引擎公共出口。

施工记录（2026-09-02）：事件目录切片完成：`EVENT_CATALOG` / `EventCatalogEntry` 进入 AronaClicker，基础引擎事件文件仅保留 `GameEvent` / `EventHandler`。类型检查与 22 项事件/Trigger 专项测试通过，待全量回归后继续处理剩余引擎公共类型。

施工记录（2026-09-02）：图片资产切片完成：图片契约与索引解析进入数据服务，图片查询端口进入 AronaClicker，删除引擎图片类型与查询出口。Schema、类型检查、全量 108 个测试文件/1027 个测试与架构边界检查通过。下一步继续审计引擎类型与公共导出，仅保留基础机制。

施工记录（2026-09-02）：世界数据实体与 Builder 切片完成：世界契约进入 `data-services/contracts/world.ts`，三种 Builder 与 `WorldCatalogQueryPort` 进入 AronaClicker；删除引擎世界类型、世界目录端口与世界 Builder 出口。Schema、类型检查、全量 108 个测试文件/1027 个测试与架构边界检查通过。下一步审计引擎总出口、数据服务公共入口与 UI/产品引用。

施工记录（2026-09-02）：通用数据声明切片完成：`ResourceDisplayDef`、`TagDef`、`CharacterBonusTable` 进入 `data-services/contracts/common.ts`，`ResourceAmount` 收敛至 `engine/contracts/resource.ts`；删除 `engine/types/common.ts`。类型检查、全量 108 个测试文件/1027 个测试与架构边界检查通过。下一步处理 `InitDef`/`AreaDef`/`SpotDef` 世界数据契约及其 Builder 的归属。

把当前按技术机制拆分、但产品领域仍混杂的项目，逐步收敛为：

```text
基础引擎机制
    ↓
基础数据服务
    ↓
AronaClicker 领域模型与 Runtime
    ↓
具体 Datapack
    ↓
UI
```

其中：

- 基础引擎负责 GameNum、Condition、Effect、Trigger、Affector、Reveal、Stats、EventBus 等机制；
- 基础数据服务负责 Datapack 读取、合并、校验、持久化和资源加载；
- AronaClicker 层负责实体、PlayerState、玩法服务和领域适配器；
- `base` 是测试/示例 Datapack，不是引擎内置生产内容；
- UI 只消费 ReadModel 并发出 Commands。

## 总体状态

**源码迁移与 M8-2 收口已完成。** 当前结构以基础引擎机制、基础数据服务、AronaClicker 领域层和 UI ReadModel/Commands 为边界；后续新功能按该边界增量演进。

当前状态归属切片已完成：`PlayerState` / `InitSnapshot` 的真实定义已落在 `src/arona-clicker/types/state.ts`，并组合产品故事与角色运行时状态；旧 `src/engine/types/state.ts` 已移除。下一切片：继续拆分 `src/engine/types` 总出口中的混合实体与机制类型，并收拢剩余领域实现；完成后必须通过类型检查、受影响回归、全量测试与架构边界检查。

## 里程碑切片

| 切片 | 内容 | 状态 | 依赖 |
|---|---|---|---|
| M0-1 | 新增引擎边界 ADR，修正 `base`、`GameInstance`、Registry、PlayerState、SaveData 的定位 | ✅ 已确认（2026-09-01） | 无 |
| M0-2 | 修订 `00-INDEX`、overview、Datapack Roadmap 中的旧 base 语义 | ✅ 已完成（2026-09-01） | M0-1 |
| M1-1 | 盘点模块与跨层 import，形成当前依赖基线 | ✅ 已完成（2026-09-01） | M0-2 |
| M1-2 | 新增 `engine`、`data-services`、`arona-clicker`、`app` 公共入口 | ✅ 已完成（2026-09-01） | M1-1 |
| M1-3 | 建立禁止 engine 依赖 UI / base / AronaClicker 实现的检查 | ✅ 已完成（2026-09-01） | M1-2 |
| M2-1 | 将 `engine/types` 区分为机制契约与 AronaClicker 实体类型 | ✅ 已完成（2026-09-01） | M1-2 |
  | M2-2 | 拆分 Engine Contracts 与 AronaClicker Types，保留 re-export 兼容层 | ✅ 已完成（2026-09-01） | M2-1 |
| M2-3 | 重新确认 Schema 生成入口与编辑器同步边界 | ✅ 已完成（2026-09-01） | M2-2 |
  | M3-1 | 抽象 Condition / Value / GameNum 的 Engine Context | ✅ 已完成（2026-09-01） | M2-2 |
| M3-2 | 抽象 Reveal / Stats / Affector 的领域查询适配器 | ✅ 已完成（2026-09-01） | M3-1 |
  | M3-3 | 新增脱离 base Datapack 的基础机制单元测试 | ✅ 已完成（2026-09-01） | M3-1 |
  | M4-1 | 将 `GameInstance` 重新定位为 AronaClicker Runtime | ✅ 已完成（2026-09-01） | M2-2 |
| M4-2 | 迁移 Story / World / Character / Economy / Color 领域服务 | ✅ 已完成（2026-09-02） | M4-1 |
| M4-3 | 引入 Runtime ReadModel 与 Commands | ✅ 已完成（2026-09-02） | M4-2 |
| M5-1 | 抽出 Datapack Source / Loader / Parser / Merge 服务 | ✅ 已完成（2026-09-02） | M1-1 |
| M5-2 | 抽出 SaveData / SaveCodec / LocalStorage 服务 | ✅ 完成 | M5-1 |
| M5-3 | 抽出图片与其他外部资源加载服务 | ✅ 已完成（2026-09-02） | M5-1 |
| M5-4 | 将现有多包管理 S2-S7 接入新的基础数据服务边界 | ✅ 已完成（2026-09-02） | M5-1 |
| M6-1 | 将 `src/data/base` 重定位为测试/示例 Datapack | ✅ 已完成（2026-09-01） | M4-2、M5-1 |
| M6-2 | 建立正式 AronaClicker 内容包的独立入口 | ✅ 已完成（2026-09-01） | M6-1 |
| M6-3 | 让所有测试显式注入测试 Datapack | ✅ 已完成（2026-09-01） | M6-1 |
| M7-1 | UI 组件改为只依赖 ReadModel / UIContext | ✅ 已完成（2026-09-02） | M4-3 |
| M7-2 | UI Controller 改为通过 Commands 操作 Runtime | ✅ 已完成（2026-09-02） | M7-1 |
| M7-3 | 移除 UI 对具体领域服务和 base 内容的直接依赖 | ✅ 已完成（2026-09-02） | M7-2 |
| M8-1 | 统一 `src/main.ts` 与 `src/ui/main.ts` 启动路径 | ✅ 已完成（2026-09-01） | M6-2、M7-2 |
| M8-2 | 删除旧路径和兼容层，更新模块卡片与架构文档 | ✅ 已完成（2026-09-02） | 全部 |

## 推荐施工顺序

```text
M0 设计裁定
  ↓
M1 依赖基线与入口
  ↓
M2 类型边界
  ↓
M4 AronaClicker Runtime
  ↓
M3 基础引擎适配器
  ↓
M5 基础数据服务
  ↓
M6 Datapack 重定位
  ↓
M7 UI 能力边界
  ↓
M8 清理与收束
```

M3 和 M4 可以小范围交错，但禁止在类型边界未确定前大规模移动实现。

## 第一施工批次

### M0-1：架构边界裁定

产出：

- [[docs/plan-work/completed/adr-0005-engine-domain-boundaries]]；
- `base` 语义从“默认基础内容”改为“测试/示例 Datapack”；
- `GameInstance` 定位为 AronaClicker Runtime；
- 确认 Engine Contracts、Data Services、AronaClicker Types、UI ReadModel 四个边界。

验收：

- 用户 review 通过；
- 不修改运行时代码；
- 不引入新的架构矛盾。

### M0-2：文档路由同步

需要同步：

- [[docs/docs-828/00-INDEX]]；
- [[docs/docs-828/01-architecture/overview]]；
- [[docs/docs-828/01-architecture/data-flow]]；
- [[docs/plan-work/active/roadmap-0001-datapack-management]]；
- [[docs/plan-work/active/adr-0004-datapack-management]]。

验收：

- 文档不再把 `base` 描述为固定生产基础包；
- 所有设计正文只在 ADR，Roadmap 只保留状态和切片。

### M1-1：依赖基线

检查范围：

- `src/engine/` 对 `src/data/`、`src/ui/`、`src/save/` 的依赖；
- UI 对具体 Engine Service、`src/data/base` 的依赖；
- SaveStorage 对 `GameInstance` 的反向依赖；
- `main.ts` 与 `ui/main.ts` 的重复启动路径；
- 测试对完整 `GameInstance` 和 base Datapack 的耦合。

产出：

- 当前 import 依赖清单；
- 模块归类表；
- 迁移顺序和冲突点；
- 后续静态约束的检查范围。

验收：

- 只读分析，不改变行为；
- 依赖清单可用于 M1-2 的入口设计。

## 每切片统一验收

```text
改动前：给出改动清单与裁定点
实现后：npx tsc --noEmit
实现后：npm test
若改 types：npm run gen:schema
完成后：同步对应 docs/docs-828 文档
完成后：用户 review，再进入下一切片
```

## 风险与处理

| 风险 | 处理 |
|---|---|
| `engine/types` 拆分导致 Schema 漂移 | 先明确类型归属，再按 schema-sync 流程生成和验证 |
| `GameInstance` 迁移导致测试大面积修改 | 先保留 re-export 和兼容构造入口 |
| Engine Context 过度抽象 | 只抽取 GameNum / Condition / Reveal / Stats 实际需要的查询，不预先泛化全部实体 |
| Datapack 多包工作与目录迁移冲突 | 先完成 M0/M1；M5 接管现有 0001 的 Source / PackManager 工作 |
| UI ReadModel 设计过早 | 先从现有 `GameView`、`StoryView` 和 controller 调用点提取，不新造重复状态 |
| 误把测试内容当产品边界 | 所有测试 Datapack 显式注入，禁止 runtime 默认导入 base |

## 相关目标

- [[docs/plan-work/active/roadmap-0001-datapack-management]]
- [[docs/plan-work/active/roadmap-0002-spot-shop]]
- [[docs/plan-work/active/roadmap-0003-gacha-pool-model]]
- [[docs/plan-work/active/roadmap-0004-chara-ownership]]

## 进度记录（append-only）

- 2026-09-01：根据项目结构探索结果建立本目标与对应 ADR；尚未开始源码施工。
- 2026-09-01：用户确认 [[docs/plan-work/completed/adr-0005-engine-domain-boundaries]]，M0-1 完成；进入 M0-2 文档路由同步。
- 2026-09-01：完成 overview、data-flow、Datapack Roadmap 与多包 ADR 的 base 语义同步；M0-2 完成，进入 M1-1 依赖基线。
- 2026-09-01：完成模块归类、跨层 import、启动入口、存档依赖和测试耦合盘点，新增 [[docs/docs-828/01-architecture/module-dependency-baseline]]；M1-1 完成，进入 M1-2 公共入口与依赖方向。
- 2026-09-01：新增 `src/engine/index.ts`、`src/data-services/index.ts`、`src/arona-clicker/index.ts`、`src/app/index.ts` 公共入口；类型检查与 995 项全量测试通过，M1-2 完成。
- 2026-09-01：新增 `scripts/check-architecture-boundaries.mjs` 与 `npm run check:architecture`，边界检查通过，M1-3 完成；进入 M2-1 类型归属盘点。
- 2026-09-01：完成 engine/types 文件级与类型级归属盘点，新增 [[docs/docs-828/03-data-structures/type-boundary-audit]]；M2-1 完成，进入 M2-2 类型拆分。
- 2026-09-01：M2-2 第一批完成：新增 src/engine/contracts/expression.ts，迁移 Value / ValueSource / ValueExpression；第二批新增 src/engine/contracts/reveal.ts，迁移 RevealStage / RevealTarget / RevealTrigger / AccessStage；旧路径保留 re-export；类型检查与 995 项全量测试通过，M2-2 继续进行。
- 2026-09-01：M2-2 第三批完成：新增 src/engine/contracts/extra.ts，迁移 ExtraValue / ExtraCompound / ExtraPath；schema 已按协议重生成，类型检查、架构检查与 995 项全量测试通过，M2-2 继续进行。
- 2026-09-01：完成 M2-3：schema 生成器改为同时解析 `src/engine/types` 与 `src/engine/contracts`，并通过 schema 三向同步测试。
- 2026-09-01：M2-2 第四批完成：新增 src/engine/contracts/affector.ts，迁移 AffectorState / AffectorFlow / AffectorEffect / AffectorPackDef / AffectorPackRef / AffectorInstance；旧路径保留 re-export；类型检查、架构检查与 995 项全量测试通过，M2-2 继续进行。
- 2026-09-01：M3-1 第一段完成：新增 `src/engine/contracts/evaluation-context.ts`，抽取 Value / Condition 的最小读取端口，并让现有系统实现契约；局部 32 项与全量 995 项测试通过，M3-1 继续进行。
- 2026-09-01：M3-1 第二段完成：从 GameNumContext / GameNumEvalDeps 及其接线、测试夹具移除未使用的 CharacterSystem 依赖；GameNum 相关局部 59 项与全量 995 项测试通过，M3-1 继续进行。
- 2026-09-01：复核 GameNum 实际调用面：保留 Registry 实体索引、ValueSystem 与 AffectorEngine 作为下一阶段端口抽取对象，避免制造未使用的泛化接口。
- 2026-09-01：GameNum 端口切片同时修正 `character-freeze` 中将“可解锁”误判为“已拥有”的测试条件；全量回归重新恢复 995/995，架构边界检查通过。
- 2026-09-01：M3-1 第三段完成：新增 `GameNumAffectorContext`，GameNum 的 flows / zoneModifiers 读取改用最小 Affector 端口；局部 39 项与全量 995 项测试通过，M3-1 继续进行。
- 2026-09-01：M3-2 第一段完成：新增 `StatsQueryContext`，StatsService 实现统计只读查询端口；局部 37 项与全量 995 项测试通过，M3-2 继续处理 Reveal 适配。
- 2026-09-01：M3-2 第二段完成：新增 `RevealRegistryContext`，可见性三件套改依赖最小只读揭示索引；局部 24 项与全量 995 项测试通过，M3-2 继续进行。
- 2026-09-01：M3-2 Reveal 适配确认：可见性引擎、索引与求值均通过只读契约访问揭示数据，未改变存在性判定；全量 995 项测试通过。
- 2026-09-01：M3-2 完成：StatsQueryContext、RevealRegistryContext 与 GameNumAffectorContext 三类查询端口均已接入；类型检查、架构检查与全量测试通过。
- 2026-09-01：M3-3 完成：新增不加载 `src/data/base` 的 `tests/engine/engine-contracts.test.ts`，验证 Value / Condition / Stats / GameNum / Reveal 的最小契约可独立组合；全量 99 个测试文件、998 项测试通过。
- 2026-09-01：M4-1 完成：新增 `src/arona-clicker/runtime.ts` 的 `AronaClickerRuntime` 明确领域组合根入口；应用启动路径改用该入口，`GameInstance` 保留为兼容实现。
- 2026-09-01：M4-2 第一段完成：新增 `src/arona-clicker/services/index.ts`，集中导出 Story / World / Character / Economy / Color 领域服务；领域公共入口不再逐项直接指向 `src/engine`，实现文件迁移留待后续切片。类型检查与 88 项相关回归测试通过。
- 2026-09-01：M4-2 第二段完成：将角色培养纯计算实现迁移至 `src/arona-clicker/services/cultivate-system.ts`，旧 `src/engine/system/cultivate-system.ts` 仅保留过渡转发；架构检查为该单一兼容 shim 留出显式例外，防止迁移期旧调用者扩散。类型检查与培养/运行时/持久化 91 项测试通过。
- 2026-09-01：M4-2 第三段完成：将 `CharaProfileService` 实现迁移至 `src/arona-clicker/services/chara-profile-service.ts`，旧 engine 路径仅保留兼容转发，并集中纳入领域服务出口；类型检查、架构检查与角色画像/UI 38 项测试通过。
- 2026-09-01：M4-2 第四段完成：将 `CharacterAvailabilityService` 实现迁移至 `src/arona-clicker/services/character-availability.ts`，领域出口改用新实现；旧 engine 路径保留兼容 shim。类型检查、架构检查与角色可及性/抽卡/UI 31 项测试通过。
- 2026-09-01：M4-2 第五段完成：将 `GachaService` 实现迁移至 `src/arona-clicker/services/gacha-service.ts`，抽卡模式、天井、资源扣除与角色获得编排归入领域层；旧 engine 路径仅保留兼容 shim。类型检查、架构检查与抽卡/可及性/UI 31 项测试通过。
- 2026-09-01：M4-2 第六段完成：将 `ColorEquipmentSystem` 实现迁移至 `src/arona-clicker/services/color-equipment-system.ts`，色彩装备库存、解锁级联、头像色板与装备效果归入领域层；旧 engine 路径仅保留兼容 shim。类型检查、架构检查与色彩/运行时/UI 41 项测试通过。
- 2026-09-01：M4-2 第七段完成：将好感计算与 `RosterSystem` 迁移至 `src/arona-clicker/services/affection-system.ts`、`src/arona-clicker/services/roster-system.ts`，通讯录、持有、碎片与好感规则归入领域层；旧 engine 路径保留兼容 shim。类型检查、架构检查与相关 49 项测试通过。
- 2026-09-01：M4-2 第八段完成：将 `CharacterSystem` 迁移至 `src/arona-clicker/services/character-system.ts`，角色原型元数据与 roster 解锁查询归入领域层；旧 engine 路径保留兼容 shim。类型检查、架构检查与角色/可及性/运行时/UI 106 项测试通过。
- 2026-09-01：M4-3 第一段完成：新增 `src/arona-clicker/contracts/runtime.ts`，定义 `GameReadModel` 与 `GameCommands`；`src/ui/context.ts` 改为接收 ReadModel，保留 `UIFacingGame` 类型别名兼容。类型检查、架构检查与 UI/契约 37 项测试通过。
- 2026-09-01：M4-3 第二段完成：`UIController` 增加强类型 `commands` 能力边界，存档保存/读取改经 `GameCommands` 调用；`GameInstance` 在迁移期作为默认实现注入。类型检查、架构检查与 Controller 生命周期 16 项测试通过。
- 2026-09-01：M4-3 第三段完成：顶栏手动 Tick、彻底重置与日志清理改经 `GameCommands`；契约补齐 `TickResult` 与日志命令。类型检查、架构检查与控制器 8 项测试通过。
- 2026-09-01：M4-3 第四段完成：新增 `createGameCommands` 运行时适配器，剧情启动、重播、推进、发送、好感推送与尾巴推送改经 `GameCommands`；类型检查、架构检查与剧情/UI 19 项测试通过。
- 2026-09-01：M4-3 第五段完成：设施移动/解锁/升级、物品使用、强化购买/移除、世界线购买/硬重启与抽卡均改经 `GameCommands`；类型检查、架构检查与相关 45 项测试通过。
- 2026-09-01：M5-2 第一段完成：将 LocalStorage `SaveSystem` 实现迁移至 `src/data-services/persistence/storage.ts`，旧 `src/save/storage.ts` 仅保留兼容入口；类型检查、架构检查与数据/UI 21 项测试通过。
- 2026-09-01：M5-1 第一段完成：将多文件 ZIP Datapack Loader 实现迁移至 `src/data-services/datapack/zip-loader.ts`，旧 `src/data/zip-loader.ts` 仅保留兼容入口，UI 导入路径改用数据服务；类型检查、架构检查与 ZIP/内容包/UI 18 项测试通过。
- 2026-09-01：M5-2 第二段完成：新增 `engine/contracts/save-data.ts` 作为共享存档契约，`data-services/persistence/save-data.ts` 提供数据服务公开入口；SaveCodec、LocalStorage、Runtime 与 UI 统一引用该契约，保持旧导出兼容。类型检查、架构检查与存档/数据/UI 48 项测试通过。
- 2026-09-01：M5-2 第三段完成：新增 `StorageAdapter` / `LocalStorageAdapter`，`SaveSystem` 改为依赖最小持久化介质接口；补充适配器测试，类型检查与 7 项持久化/UI 测试通过。
- 2026-09-01：M5-2 第四段完成：新增 `data-services/persistence/save-codec.ts` 负责纯快照组装，并通过 `GameInstanceOptions.saveCodec` 注入 AronaClicker Runtime；恢复编排继续留在 Runtime 侧。类型检查、架构检查与 Runtime/存档/UI/适配器 122 项测试通过。
- 2026-09-01：M5-3 第一段完成：将纯运行时图片资源登记实现迁入 `src/data-services/assets/image-store.ts`，数据服务公共出口新增 `ImageStore` / `ResolvedImageEntry`；旧 `src/engine/image/image-store.ts` 仅保留兼容转发，图片索引解析与 `PicService` 暂留引擎桥接层，待后续拆分 Registry 读取与领域画像语义。类型检查、架构检查与图片专项 26 项测试通过。
- 2026-09-01：M5-3 第二段完成：新增 `src/data-services/assets/pic-resolver.ts`，图片解析改为消费只读 `PicDefinitionMap`，不再要求数据服务持有完整 `Registry`；引擎 `resolve` 入口降为兼容适配，AronaClicker 画像服务已直接使用数据服务解析器。类型检查、架构检查与全量 1000 项测试通过。
- 2026-09-01：M5-3 第三段完成：将 `PicService` 实现迁入 `src/data-services/assets/pic-service.ts`，其依赖收窄为只读 PicDef 映射与 `ImageStore`；引擎旧 `system/pic-service.ts` 仅保留兼容转发，UI 既有 `game.pics` 门面行为不变。类型检查、架构检查与图片/画像/UI 专项 45 项测试通过。
- 2026-09-01：M5-1 第二段完成：新增 `PackSource` / `PackEntry` 契约与 `ZipPackSource`，ZIP Loader 的 JSON 条目遍历与读取已通过 Source 层完成；图片编码暂保留在 Loader 结果组装阶段。补充 Source 专项测试，类型检查、架构检查与 Source/ZIP 17 项测试通过。
- 2026-09-01：M5-1 第三段完成：新增独立 `PackManifest` 契约与 `parsePackManifest`，校验 `modName`、名称、版本、依赖与可选作者/图标字段；旧 ZIP Loader 暂不强制 manifest，待 Pack 流程接入时统一切换。类型检查、架构检查与 manifest/Source/ZIP 16 项专项测试通过。
- 2026-09-01：M5-1 第四段完成：将 JSON 分片识别与合并抽至 `src/data-services/datapack/fragment-parser.ts`，ZIP Loader 仅负责 Source 遍历、图片编码与入口适配；新增分片解析器独立测试，类型检查、架构检查与分片/manifest/Source/ZIP 18 项专项测试通过。
- 2026-09-01：M5-1 第五段完成：新增与物理来源无关的 `parsePack(source)`，强制根目录 manifest，复用分片解析器并统一提取图片资源；旧 ZIP Loader 继续兼容无 manifest 的历史包。新增 Pack 流程测试，类型检查、架构检查与 Pack/manifest/fragment/Source/ZIP 21 项专项测试通过。
- 2026-09-01：M5-1 第六段完成：UI 数据包导入改用 `parsePackFromZipFile`，按 manifest 的 `modName` 登记图片、按 manifest 展示名称与版本；旧 Loader 保留给兼容测试与历史调用者。类型检查、架构检查与全量 1011 项测试通过。
- 2026-09-01：M5-4 第一段完成：新增与持久化介质无关的 `PackManager`，统一维护 `StoredPack`、启用集与手动顺序；启用时检测同 `modName` 冲突并回滚，快照可供后续 IndexedDB 适配器使用。类型检查、架构检查与包管理专项 3 项测试通过。
- 2026-09-01：M5-4 第二段完成：新增 `PackSnapshotStore` 与 `JsonPackSnapshotStore`，复用 `StorageAdapter` 保存/读取/清理包库快照；PackManager 仍不感知具体存储介质，后续可替换为 IndexedDB 实现。类型检查、架构检查与包管理/存储专项测试通过。
- 2026-09-01：M5-4 第三段完成：新增 `PackApplyTarget` 与 `PackManager.applyEnabled`，启用集按手动顺序调用 Runtime `reload`，随后统一清理并按 manifest `modName` 登记图片；数据服务不持有具体 GameInstance。类型检查、架构检查与包管理专项 4 项测试通过。
- 2026-09-01：M5-4 第四段完成：`AronaClickerRuntime` 持有 `PackManager`，新增 `registerParsedPack` / `applyEnabledPacks` 组合根方法；启用包实际接入 `reload` 与图片资源登记，新增 Runtime 接线测试。类型检查、架构检查与 Pack/Runtime 专项测试通过。
- 2026-09-01：M5-4 第五段完成：UI 导入服务优先调用 Runtime 的 PackManager 能力，不再直接编排 `reload` 与图片登记；裸 `GameInstance` 仍保留兼容回退。类型检查、架构检查与全量 1019 项测试通过。
- 2026-09-01：M5-4 第六段完成：PackManager 注入 `PackSnapshotStore` 后会在导入/删除/启停/排序成功时自动保存；AronaClickerRuntime 支持注入包库存储，两个浏览器入口已使用 `JsonPackSnapshotStore + LocalStorageAdapter`。新增恢复测试，类型检查、架构检查与 Pack/Runtime 专项测试通过。
- 2026-09-01：M5-4 第七段完成：新增启用集预校验端口，AronaClickerRuntime 使用临时 Registry 干跑全部启用包；预校验失败时不会执行正式 reload 或图片替换，并补充失败回滚测试。
- 2026-09-01：M5-4 第八段完成：新增 `PackManager.dependencyHints` 只读报告，按 ADR 区分依赖包已启用、已安装未启用与缺失，不改变依赖不参与校验的裁定。补充包管理测试。
- 2026-09-01：M5-4 第九段完成：新增异步 `AsyncPackSnapshotStore` 与 `IndexedDbPackSnapshotStore`，为浏览器包库提供 IndexedDB 后端；PackManager 继续使用同步抽象，异步存储生命周期留给应用启动层。补充不支持环境测试。
- 2026-09-01：M5-4 第十段完成：AronaClickerRuntime 新增 `restorePackManager` / `savePackManager` 异步入口，允许启动层使用 IndexedDB 恢复与保存包库快照，不把异步 API 混入引擎同步循环。补充 Runtime 异步接线测试。
- 2026-09-01：M5-4 第十一段完成：UI 启动生命周期接入 IndexedDB 包库恢复，恢复失败时降级到现有 base 启动；恢复仅加载包库元数据，不自动覆盖默认启用内容，启用集仍由显式应用操作触发。
- 2026-09-01：M5-4 第十二段完成：新增包库 UI 只读视图与命令边界，顶栏接入“数据包库”弹窗，支持查看包信息、启停、顺序调整及依赖状态；UI 不直接访问 PackManager 内部集合，类型检查、架构检查与包库 UI 专项测试通过。
- 2026-09-01：M5-4 第十三段完成：修复 IndexedDB 恢复后的持久化生命周期；Runtime 记住异步包库存储，登记、启停与排序自动写回快照，UI 启动移除并行的 LocalStorage 包库注入；类型检查、架构检查与异步包库专项测试通过。
- 2026-09-01：M4-3 第六段完成：通讯录培养、装备、已读标记与主题设置等剩余 UI 状态写操作统一转入 `GameCommands`，UI 不再直接调用 `StateMutationService`；类型检查与相关 UI 回归测试通过。
- 2026-09-01：M4-3 第七段完成：选择页强化操作、世界线启动/重启/恢复、读档后的世界线解锁均改经 `GameCommands`；UI 控制器的状态写入进一步与 Runtime 门面解耦，类型检查与架构检查通过。
- 2026-09-01：M4-3 第八段完成：新增 `RosterQueryPort`，将通讯录/角色只读查询从 `GameReadModel` 对具体 `RosterSystem` 的依赖改为领域查询契约；`RosterSystem` 作为实现适配，类型检查、架构检查与角色/UI 21 项回归测试通过。
- 2026-09-01：M4-3 第九段完成：新增 `ColorQueryPort`，将色彩组、主题预览、实体主题选项与主题层级读取从 `GameReadModel` 对具体 `ColorSystem` 的依赖改为只读契约；类型检查、架构检查与主题/角色 UI 回归测试通过。
- 2026-09-01：M4-3 第十段完成：新增 `ColorEquipmentQueryPort`，将装备定义、持有状态、装备色彩与效果查询从 `GameReadModel` 对具体 `ColorEquipmentSystem` 的依赖改为只读契约；类型检查、架构检查与色彩装备/UI 20 项回归测试通过。
- 2026-09-01：M4-3 第十一段完成：新增 `StoryQueryPort`，将 UI 使用的剧情完成状态、就绪计数、发送状态与当前剧情视图从 `GameReadModel` 对具体 `StoryService` 的依赖改为只读契约；类型检查、架构检查与剧情/UI 44 项回归测试通过。
- 2026-09-01：M4-3 第十二段完成：新增 `AvailabilityQueryPort`，将 UI 使用的卡池关闭与角色可抽取查询从 `GameReadModel` 对具体 `CharacterAvailabilityService` 的依赖改为只读契约；类型检查、架构检查与抽卡/通讯录 31 项回归测试通过。
- 2026-09-01：M4-3 第十三段完成：新增 `GachaQueryPort`，将 UI 使用的卡池定义与 pity/pulls 计数从 `GameReadModel` 对具体 `GachaService` 的依赖改为只读契约；类型检查、架构检查与抽卡/UI 33 项回归测试通过。
- 2026-09-01：M4-3 第十四段完成：复用基础引擎已有的 `StatsQueryContext`，将 `GameReadModel.statsService` 从具体 `StatsService` 收窄为统计只读契约；类型检查、架构检查与统计/资源详情 UI 回归测试通过。
- 2026-09-01：M4-3 第十五段完成：新增 `SpotQueryPort`，将 UI 使用的设施有效等级上限查询从 `GameReadModel` 对具体 `SpotService` 的依赖改为最小只读契约；类型检查与架构检查通过。
- 2026-09-01：M4-3 第十六段完成：新增 `ValueQueryPort`，将 UI 使用的表达式求值从 `GameReadModel` 对具体 `ValueSystem` 的依赖改为最小只读契约；类型检查、架构检查与数值/提示 UI 回归测试通过。
- 2026-09-01：M4-3 第十七段完成：新增 `ConditionQueryPort`，将 UI 使用的条件表达式/条件组求值从 `GameReadModel` 对具体 `ConditionSystem` 的依赖改为最小只读契约；修正揭示组件的端口类型，类型检查、架构检查与条件/通讯录 UI 回归测试通过。
- 2026-09-01：M4-3 第十八段完成：新增 `AffectorQueryPort`，将 UI 使用的 Affector Pack 查询从 `GameReadModel` 对具体 `AffectorEngine` 的依赖改为最小只读契约；类型检查、架构检查与 Affector/强化相关回归测试通过。
- 2026-09-01：M4-3 第十九段完成：审计确认 UI 未使用 `CharacterSystem` 的直接查询能力；从 `GameReadModel` 移除该未使用的具体服务字段与类型依赖，不为不存在的调用面创建空端口。角色查询继续由 `RosterQueryPort` 与后续 Registry 查询端口承载。
- 2026-09-01：M4-3 第二十段完成：基础引擎新增 `WorldCatalogQueryPort`，由 `GameInstance.world` 提供世界线、区域、设施及关系/标签查询的只读入口；UIContext、世界线选择页、生产页、轨道、设施详情、提示、控制器等世界目录读取均已迁移，类型检查、架构检查与相关 UI 23 项测试通过。
- 2026-09-01：M4-3 第二十一段完成：审计确认 UI 未使用 `charaProfiles`，从 `GameReadModel` 移除该未使用的具体服务字段；新增 `PicQueryPort`，将图片 URL/定义查询与图片注册写入分开，兼容导入路径保留在组合根宿主；类型检查、架构检查与图片/头像/剧情图片 57 项测试通过。
- 2026-09-01：M4-3 第二十二段完成：新增 `SpotFunctionalityQueryPort`，将 UI 使用的设施功能列表/存在性查询从具体 `SpotFunctionalitySystem` 收窄为只读契约；条件注入、增强遍历与标签匹配仍封装在引擎实现内，类型检查、架构检查与设施/提示相关 39 项测试通过。
- 2026-09-01：M4-3 第二十三段完成：新增 `ContentCatalogQueryPort`，将 `GameReadModel.registry` 从完整 `Registry` 类收窄为 UI 实际使用的只读表集合；显示名服务同步改为依赖内容目录契约，类型检查、架构检查与引擎契约/提示/强化/收藏/通讯录 30 项测试通过。
- 2026-09-01：M4-3 第二十四段完成：新增 `GameNumQueryPort`，将 UI 使用的基础求值、区节点构建、资源产出与设施产出查询从具体 `GameNumSystem` 收窄为只读契约；索引构建、脏位维护与 Affector 同步仍由引擎内部负责，类型检查与数值/UI 65 项测试通过。
- 2026-09-01：M7-3 第一段完成：将故事栏层级编排从 `src/data/base/story-hierarchy.ts` 迁移至 `src/arona-clicker/content/story-hierarchy.ts`，UI 改用 AronaClicker 内容入口；旧路径仅保留兼容 re-export，UI 不再直接 import `src/data/base`，类型检查、架构检查与剧情/世界线 UI 28 项测试通过。
- 2026-09-01：M6-1/M6-2 第一段完成：新增 `src/data/test-datapack.ts` 测试/示例包入口与 `src/arona-clicker/content/default-datapack.ts` 产品默认内容入口，两个应用启动入口改用 AronaClicker 内容入口；旧 `src/data/index.ts` 保留兼容出口，内容本体后续继续物理拆分。类型检查、架构检查与运行时/UI 81 项测试通过。
- 2026-09-01：M6-1/M6-2 第二段完成：将资源 ID 内容实现迁移至 `src/arona-clicker/content/resources.ts`，`src/data/base/resources.ts` 改为测试期兼容出口；正式内容层开始承接不属于引擎机制的产品定义，类型检查、架构检查与运行时 76 项测试通过。
- 2026-09-01：M6-1/M6-2 第三段完成：将物品定义迁移至 `src/arona-clicker/content/items.ts`，正式内容入口继续承接产品实体定义，`src/data/base/items.ts` 仅保留兼容出口；类型检查、架构检查与运行时/物品/通讯录 88 项测试通过。
- 2026-09-01：M6-1/M6-2 第四段完成：完成资源与物品内容的实际物理迁移，并确认世界线定义与 Datapack 汇总存在强耦合；后续按汇总依赖顺序迁移世界线/区域/设施，避免产生仅改路径而未改变边界的机械拆分。
- 2026-09-01：M6-1/M6-2 第五段完成：将区域定义迁移至 `src/arona-clicker/content/areas.ts`，旧 `src/data/base/areas.ts` 收敛为明确的兼容 re-export；世界线/区域/设施汇总行为保持不变，类型检查、架构检查与相关 95 项测试通过。
- 2026-09-01：M6-1/M6-2 第六段完成：将世界线定义迁移至 `src/arona-clicker/content/inits.ts`，旧 `src/data/base/inits.ts` 收敛为兼容 re-export，并纳入正式内容层索引；类型检查、架构检查与世界线/UI 相关 81 项测试通过。
- 2026-09-01：M6-1/M6-2 第七段完成：将设施定义迁移至 `src/arona-clicker/content/spots.ts`，旧 `src/data/base/spots.ts` 收敛为兼容 re-export；产出、升级、揭示、重启与招募配置保持不变，类型检查、架构检查与设施/世界线/UI 相关 92 项测试通过。
- 2026-09-01：M6-1/M6-2 第八段完成：将角色原型定义迁移至 `src/arona-clicker/content/characters.ts`，旧 `src/data/base/characters.ts` 收敛为兼容 re-export；角色变体、卡池与培养数据继续通过原有汇总入口组装，类型检查与角色/好感/抽卡相关 23 项测试通过。
- 2026-09-01：M6-1/M6-2 第九段完成：将普通强化与全局强化定义迁移至 `src/arona-clicker/content/enhancements.ts`，旧 `src/data/base/enhancements.ts` 收敛为兼容 re-export；类型检查与强化/运行时相关 80 项测试通过。
- 2026-09-01：M6-1/M6-2 第十段完成：将掉落表定义迁移至 `src/arona-clicker/content/drop-tables.ts`，旧 `src/data/base/drop-tables.ts` 收敛为兼容 re-export；本轮连续内容迁移后全量 108 个测试文件、1026 项测试通过。
- 2026-09-01：M6-2 第十一段完成：`src/arona-clicker/content/default-datapack.ts` 改为显式组装已迁移的世界线、区域、设施、角色、强化、掉落表与物品；未迁移的剧情/图片/角色重构定义暂从测试包继承，并明确标注为过渡态。类型检查、架构检查与正式入口相关 89 项测试通过。
- 2026-09-01：M6-2 第十二段完成：将图片资产与角色画像定义迁移至 `src/arona-clicker/content/pics-assets.ts`、`chara-profiles.ts`，正式 Datapack 入口同步显式组装；修正内容索引反向导入风险，类型检查、架构检查与图片/画像/运行时 130 项测试通过。
- 2026-09-01：M6-2 第十三段完成：将角色培养曲线迁移至 `src/arona-clicker/content/cultivate-curves.ts`，正式入口显式使用该定义；类型检查、架构检查与培养/角色/运行时 91 项测试通过。
- 2026-09-01：M6-2 第十四段完成：新增 `src/arona-clicker/content/character-variants.ts` 承接默认差分与泳装特殊差分，旧总表开始改为兼容导出；类型检查、架构检查与角色差分/培养/强化/运行时 95 项测试通过。
- 2026-09-01：M6-2 第十五段完成：删除 `character-rework.ts` 中重复的 legacy 差分构建，仅保留色彩、卡池、好感与羁绊内容；旧总表通过新差分模块导入并再导出，类型检查、架构检查与角色/培养/强化 22 项测试通过。
- 2026-09-01：M6-2 第十六段完成：新增 `src/arona-clicker/content/colors.ts` 承接 23 个色彩组定义，正式 Datapack 入口改用内容层色彩组；类型检查、架构检查与色彩/主题/角色 43 项测试通过，旧总表的重复色彩构建待下一切片清除。
- 2026-09-01：M6-2 第十七段完成：清除 `character-rework.ts` 中重复的色彩组实现，并新增 `src/arona-clicker/content/color-equipments.ts` 承接色彩装备；正式入口显式组装两类内容，类型检查、架构检查与色彩/主题/角色/运行时 99 项测试通过。
- 2026-09-01：M6-2 第十八段完成：清除 `character-rework.ts` 中重复的色彩装备实现，新增 `src/arona-clicker/content/gacha-pools.ts` 承接常规与限定卡池；正式入口显式组装卡池，类型检查、架构检查与抽卡/角色/运行时 85 项测试通过。
- 2026-09-01：M6-2 第十九段完成：将好感台阶内容迁移至 `src/arona-clicker/content/affection-content.ts`，默认 Datapack 显式过滤旧好感条目并重新组装；`character-rework.ts` 不再持有好感剧情实现，类型检查、架构检查与剧情/好感/UI 99 项测试通过。
- 2026-09-01：M6-2 第二十段完成：将羁绊剧情迁移至 `src/arona-clicker/content/bond-content.ts`，默认 Datapack 显式过滤并重新组装 active story 与 story 条目；`character-rework.ts` 仅保留兼容导出，类型检查、架构检查与剧情/好感/UI 107 项测试通过。
- 2026-09-01：M6-2 第二十一段完成：将 Trigger 声明迁移至 `src/arona-clicker/content/triggers.ts`，默认 Datapack 直接组装产品触发定义；Trigger 的条件侦测、事件分发与效果执行仍由基础引擎负责，类型检查、架构检查与触发/剧情/游戏实例 76 项测试通过。
- 2026-09-01：M6-2 第二十二段完成：将对话空间 owner、冷却、阻断等闲聊池声明迁移至 `src/arona-clicker/content/story-conversation-walls.ts`；旧故事入口仅保留兼容引用，闲聊池策略仍由剧情领域服务与基础机制执行，类型检查、架构检查与故事/UI 8 项测试通过。
- 2026-09-01：M6-2 第二十三段完成：将默认闲聊池树迁移至 `src/arona-clicker/content/story-pools.ts`，测试 Datapack 汇总改用内容层池结构；旧 `stories.ts` 的同名导出暂保留为迁移期兼容实现，后续与故事入口拆分一并清除重复定义，类型检查、架构检查与相关 25 项测试通过。
- 2026-09-01：M7-1 第二段完成：`ChatStream`、`PopoverManager` 与 `SelectorPage` 不再声明依赖具体 `GameInstance`，分别改用最小故事读取端口或 `GameReadModel`；类型检查、架构检查与聊天/提示/选择页/剧情 UI 63 项测试通过。
- 2026-09-01：M7-1 第三段完成：数据包导入/日志导出模块改用局部运行时能力接口，移除对 `GameInstance` 与 `AronaClickerRuntime` 具体类的类型依赖；类型检查、架构检查通过，包库 UI 回归 2 项通过。
- 2026-09-01：M4-3 第二十五段完成：`createGameCommands` 改用 `GameCommandSource` 结构化能力契约，按故事、设施、世界线、物品、强化、抽卡与统一状态写入口声明所需最小接口；类型检查、架构检查与 Runtime/UI 4 项回归通过。
- 2026-09-01：M6-2 第二十四段完成：active story 入口迁移至 `src/arona-clicker/content/story-active-entries.ts`，测试 Datapack 汇总改用内容层入口；旧 `stories.ts` 暂保留 legacy 定义作为兼容过渡，类型检查、架构检查与故事/运行时/UI 90 项测试通过。
- 2026-09-01：M6-2 第二十五段完成：passive story 入口迁移至 `src/arona-clicker/content/story-passive-entries.ts`，测试 Datapack 汇总改用内容层入口；旧聚合器中的 legacy 定义暂保留，类型检查、架构检查与闲聊/好感/剧情/UI 57 项测试通过。
- 2026-09-01：M8-1 第一段完成：新增 `src/app/runtime-bootstrap.ts` 统一 Runtime 创建、默认 Datapack 加载与默认 Init 常量；`src/main.ts` 与 `src/ui/main.ts` 共享该装配入口，保留纯引擎入口与 UI 入口的职责差异，类型检查、架构检查与关键 Runtime/UI 7 项回归通过。
- 2026-09-01：M6-2 第二十六段完成：将夏莱日常 7 条故事正文迁移至 `src/arona-clicker/content/story-schale-daily.ts`；旧演出聚合器按 ID 排除重复定义后重新组装，类型检查、架构检查与剧情/好感/聊天/UI 64 项测试通过。
- 2026-09-01：M6-2 第二十七段完成：将阿比多斯与千禧年 8 条区域闲聊正文迁移至 `src/arona-clicker/content/story-regional-chat.ts`；复杂主线正文暂保留在 legacy 聚合器，类型检查、架构检查与剧情/好感/聊天/UI 64 项测试通过。
- 2026-09-01：M6-2 第二十八段完成：将星野相关 5 条对话/图片/邀约正文迁移至 `src/arona-clicker/content/story-hoshino.ts`；旧正文聚合器按 ID 排除重复定义，类型检查、架构检查与剧情/好感/聊天/UI/图片 87 项测试通过。
- 2026-09-01：M6-2 第二十九段完成：将芹香上下篇与当前 Run 三篇故事迁移至 `src/arona-clicker/content/story-chains.ts`；保留全局/本轮揭示条件由入口层声明，正文与奖励归入产品内容，类型检查、架构检查与剧情/运行时/UI 90 项测试通过。
- 2026-09-01：M6-2 第三十段完成：将夏莱欢迎、设备简报与流剧场预演迁移至 `src/arona-clicker/content/story-schale-main.ts`；演出专用文本、清场与入口卡片效果均保持不变，类型检查、架构检查与剧情/聊天/UI/运行时 120 项测试通过。
- 2026-09-01：M6-2 第三十一段完成：将千禧年欢迎与游戏开发部危机的 6 条正文迁移至 `src/arona-clicker/content/story-millennium-main.ts`；insert/goto 分支与完结奖励保持原语义，类型检查、架构检查与剧情/运行时/UI 90 项测试通过。
- 2026-09-01：M6-2 第三十二段完成：补齐阿比多斯欢迎正文至 `src/arona-clicker/content/story-abydos-main.ts`，新增 `content/stories.ts` 统一汇总全部产品故事；`data/base/stories.ts` 与 `stories-play.ts` 降为兼容出口，正文重复定义清除，类型检查、架构检查与全量 1026 项测试通过。
- 2026-09-01：M6-2 第三十三段完成：默认 Datapack 的 active/passive stories、story 正文与 passivePools 改为直接从 AronaClicker 内容层显式组装，不再通过测试 Datapack 继承故事数据；类型检查、架构检查与剧情/好感/UI 107 项测试通过。
- 2026-09-01：M6-2 第三十四段完成：新增 `content/affector-packs.ts`、`content/resource-displays.ts` 与 `content/extras.ts`，默认 Datapack 改为直接使用产品层的效果包、资源栏配置和 Extra 常量；类型检查、架构检查与 Affector/强化/运行时 77 项测试通过。
- 2026-09-01：M6-2 第三十五段完成：默认 Datapack 移除对 `src/data/test-datapack` 的整体依赖，`funcletDefs` 与冻结的 `characterBonuses` 改为显式空表；产品包与测试包入口完成分离，类型检查、架构检查与核心 86 项测试通过。
- 2026-09-01：M6-2 第三十六段完成：`src/data/base/datapack.ts` 降为测试/示例包组装入口，产品内容统一从 `src/arona-clicker/content` 读取；重复的资源栏、Affector Pack、Extra 与角色持久化配置实现已移除，旧内容路径继续以兼容出口保留。类型检查、架构边界检查与全量 1026 项测试通过。
- 2026-09-01：M6-3 第一段完成：引擎与 UI 回归测试中依赖基础包的 40 个测试文件改为显式从 `src/data/test-datapack.ts` 注入 `baseDatapack`，不再经过 `src/data/index.ts` 兼容入口；类型检查与全量 1026 项测试通过。
- 2026-09-01：M8-2 第一段完成：好感与角色原型测试改为直接引用 `src/arona-clicker/services`，不再通过 `src/engine/system` 领域兼容 shim；其余仍被引擎内部装配使用的 shim 暂不删除，待装配依赖完成反转后统一清理。类型检查与受影响 29 项测试通过。
- 2026-09-01：M4-2/M8-2 第二段完成：新增 `GameInstanceWiring` 注入契约，`GameInstance` 不再强制调用固定 wiring；默认装配行为保持不变，并以契约测试锁定产品运行时后续接管领域服务装配的扩展点。类型检查与运行时/契约 77 项测试通过。
- 2026-09-01：M4-2/M8-2 第三段完成：`wireGameInstance` 实现迁移至 `src/arona-clicker/runtime-wiring.ts`，引擎侧 wiring 降为兼容出口；领域服务实例化不再由引擎 wiring 文件承载，图片服务同时改为直接使用 `data-services` 实现。架构边界检查与受影响运行时 94 项测试通过。
- 2026-09-01：M4-1/M4-2/M8-2 第四段完成：`GameInstance` 实现迁移至 `src/arona-clicker/runtime-game-instance.ts`，`src/engine/game-instance.ts` 降为兼容 re-export；产品 Runtime 与 wiring 直接引用新实现，基础引擎不再承载运行时组合根本体。类型检查、架构边界检查与运行时/包管理/UI 82 项测试通过。
- 2026-09-01：M4-2/M8-2 第五段完成：`StoryService` 编排实现迁移至 `src/arona-clicker/services/story-service.ts`，Runtime、Commands 与 wiring 直接引用产品服务；`engine/game/story-service.ts` 仅保留兼容出口，Story 流程辅助模块暂留引擎侧作为下一阶段拆分对象。类型检查、架构边界检查与剧情回归 28 项测试通过。
- 2026-09-01：M4-2/M8-2 第六段完成：`SpotService` 迁移至 `src/arona-clicker/services/spot-service.ts`，设施购买、升级、产出与 Tag 操作的领域服务实现脱离 `engine/game`；旧路径仅保留兼容出口，Runtime 与 Commands 直接引用产品服务。类型检查、架构边界检查与设施/运行时/UI 95 项测试通过。
- 2026-09-01：M4-2/M8-2 第七段完成：`InitService` 迁移至 `src/arona-clicker/services/init-service.ts`，世界线生命周期、区域移动、Init 购买与重启/恢复规则脱离 `engine/game`；快照/挂载辅助暂保留为下一阶段拆分对象。类型检查、架构边界检查与世界线/运行时/UI 81 项测试通过。
- 2026-09-01：M4-2/M8-2 第八段完成：`ItemService` 与 `EnhancementService` 迁移至 `src/arona-clicker/services`，物品使用/掉落发放和强化购买/移除规则脱离 `engine/game`；旧路径仅保留兼容出口。类型检查、架构边界检查与物品/强化/UI 18 项测试通过。
- 2026-09-01：M4-2/M8-2 第九段完成：`ChatFlowService` 迁移至 `src/arona-clicker/services`，产品演出桥脱离 `engine/game`；`ChatFlowPort` 进入基础引擎契约，效果反应器只依赖端口。无产品规则的 `SessionService` 同步归档至 `src/engine/runtime`。类型检查、架构边界检查与运行时/演出 93 项测试通过。
- 2026-09-01：M4-2/M8-2 第十段完成：`story-flow` 主流程迁移至 `src/arona-clicker/services/story-flow.ts`，`StoryService` 直接消费产品侧流程；引擎侧仅保留兼容出口，跳转/游标/奖励辅助模块暂作为下一阶段拆分对象。类型检查、架构边界检查与剧情/UI 23 项测试通过。
- 2026-09-01：M4-2/M8-2 第十一段完成：`story-context`、`story-jump`、`story-replay` 与 `story-rewards` 迁移至 AronaClicker 服务层，Story 主流程不再依赖引擎侧辅助实现；`story-cursor-state` 暂保留为引擎存档契约。类型检查、架构边界检查与剧情/UI 30 项测试通过。
- 2026-09-01：M4-2/M8-2 第十二段完成：将 `StoryCursorState` 运行时实现迁移至 `src/arona-clicker/services/story-cursor-state.ts`；引擎契约新增不含播放瞬态的 `StoryCursorSnapshot`，SaveData 仅依赖该持久化 DTO，旧引擎路径降为兼容出口。类型检查与架构边界检查通过，剧情回归测试保持通过。
- 2026-09-01：M4-2/M8-2 第十三段完成：新增 `StoryEffectPort`，`RuntimeEffectReactor` 从具体 `StoryService` 收窄为“按效果请求启动剧情”的最小能力；效果机制不再通过引擎旧领域路径引用产品服务。类型检查、架构边界检查与全量 1027 项测试通过。
- 2026-09-01：M4-2/M8-2 第十四段完成：将 `runtime-reset` 实现迁移至 `src/arona-clicker/runtime-reset.ts`，产品运行时重置、数据包重载与学生阻断复检不再由 `engine/game` 承载；旧路径仅保留兼容转发。类型检查与架构边界检查通过。
- 2026-09-01：M4-2/M8-2 第十五段完成：将存档恢复编排迁移至 `src/arona-clicker/runtime-save.ts`；`data-services` 负责快照组装，AronaClicker Runtime 负责 Story/Init/Session 与引擎子系统重同步，`engine/game/save-codec.ts` 降为兼容出口。类型检查与架构边界检查通过，运行时存档回归保持通过。
- 2026-09-01：M2-2 后续切片完成：将基础帧结算输出 `ProductionResult` / `TickResult` 提取至 `src/engine/contracts/tick.ts`，旧 `types/results.ts` 仅保留兼容导出；类型检查、架构边界检查与全量测试通过。
- 2026-09-01：M8-2 后续切片完成：生产 UI 控制器移除对 `engine/game-instance` 的类型入口依赖，强化诊断标签工具迁入 AronaClicker 服务层；旧入口消费者进一步收敛。类型检查与架构边界检查通过。
- 2026-09-01：M8-2 后续切片完成：测试与生产代码均迁移到 AronaClicker Runtime 后，删除无项目内消费者的 `src/engine/game-instance.ts` 兼容入口，并从架构兼容名单移除。类型检查与架构边界检查通过。
- 2026-09-01：M8-2 审计修正：删除尝试显示 `StateMutationService` / `ColorUnlockReactor` 仍直接依赖好感、培养与色彩装备算法；必要 shim 已恢复并标记为待能力端口拆分，避免形成 engine → AronaClicker 反向依赖。
- 2026-09-01：M8-2 后续切片完成：`CharacterProgressionPort` 接线后删除无消费者的培养与好感 `engine/system` shim；引擎写入管道与产品算法边界完成第一阶段反转。
- 2026-09-01：M8-2 后续切片完成：删除 6 个无消费者的角色/抽卡/可及性/画像/图片 `engine/system` shim，旧领域入口继续收敛。类型检查与架构边界检查通过。
- 2026-09-01：M4-2/M8-2 后续切片完成：将 `ColorSystem` 实现迁移至 `src/arona-clicker/services/color-system.ts`，新增 `ColorEffectPort` / `ColorUnlockPort`，引擎反应器解除对具体色彩实现的依赖；类型检查与架构边界检查通过。
- 2026-09-01：M4-2/M8-2 后续切片完成：新增 `CharacterProgressionPort`，由 AronaClicker wiring 注入培养与好感算法；`StateMutationService` 保留统一写入与事件管道，不再直接依赖旧领域 shim。类型检查、架构边界检查与相关 112 项回归通过。
- 2026-09-01：M4-2/M8-2 后续切片完成：新增 `ColorEquipmentUnlockPort`，`ColorUnlockReactor` 不再依赖具体色彩装备服务；类型检查、架构边界检查与相关色彩/角色回归通过。
- 2026-09-01：M8-2 后续切片完成：端口反转后删除无消费者的 `engine/system/color-equipment-system.ts` shim；类型检查与架构边界检查通过。
- 2026-09-01：M8-2 后续切片完成：将 `GameInstanceOptions` 与 `GameInstanceWiring` 从 `engine/game-instance-options.ts` 移至 `src/arona-clicker/runtime-options.ts`，Runtime 组合根不再通过引擎旧目录引用产品 wiring 类型；类型检查与全量 108 个测试文件、1027 项测试通过。
- 2026-09-01：M8-2 后续切片完成：将页面交互判定与被动闲聊抽选两个纯剧情辅助模块合并至 `src/arona-clicker/services/story-interaction.ts`，删除无消费者的 `engine/game/page-interaction.ts` 与 `passive-picker.ts`；引擎目录不再承载产品故事策略，类型检查与故事辅助回归通过。
- 2026-09-01：M8-2 后续切片完成：删除无消费者的 `engine/game/wiring.ts` 与 `debug-labels.ts` 兼容出口，架构检查名单同步收缩；运行逻辑文档改用 `src/arona-clicker/runtime-wiring.ts` 与 `runtime-game-instance.ts` 作为权威路径。
- 2026-09-01：M8-2 后续切片完成：删除无消费者的 `engine/game` 服务兼容出口（Story、Spot、Init、Item、Enhancement、ChatFlow、Story 辅助、Runtime Reset、Save Codec）及 `engine/system/color-system.ts`；架构检查名单同步收缩，产品服务的唯一源码路径归入 AronaClicker/Data Services。
- 2026-09-01：M8-2 后续切片完成：删除无消费者的 `engine/game/session-service.ts`，统一使用基础引擎 `src/engine/runtime/session-service.ts`；旧 `engine/game` 服务兼容层清理完成。
- 2026-09-01：M4-1/M8-2 后续切片完成：将 AronaClicker 专属的 PlayerState 默认构建迁移至 `src/arona-clicker/state/state-factory.ts`，将 GameView 组装迁移至 `src/arona-clicker/read-model/game-view-builder.ts`；`engine/game` 不再承载产品状态初始化与 UI 视图模型组装。
- 2026-09-01：M4-2/M8-2 后续切片完成：将 per-Init 字段清单、世界线快照操作、InitSavepoint 与 Init Trigger 挂载迁移至 `src/arona-clicker/state` / `src/arona-clicker/services`；这些逻辑直接依赖 AronaClicker PlayerState 与 Init 语义，`engine/game` 不再承载世界线领域状态管理。
- 2026-09-01：M7-3/M8-2 后续切片完成：将纯 SVG 头像渲染从 `engine/system/avatar-renderer.ts` 迁移至 `src/ui/avatar-renderer.ts`，UI 组件与头像测试改用表现层入口；基础引擎不再包含 UI 样式生成逻辑。
- 2026-09-01：M4-2/M8-2 后续切片完成：将掉落表抽选实现从 `engine/system/loot-system.ts` 迁移至 `src/arona-clicker/services/loot-system.ts`，Runtime、ItemService 与测试改用产品服务入口；基础引擎不再承载物品掉落语义。
- 2026-09-01：M4-2/M8-2 后续切片完成：将被动闲聊池实现从 `engine/system/passive-pool-system.ts` 迁移至 `src/arona-clicker/services/passive-pool-system.ts`，保留条件依赖失效、owner/冷却/阻断剪枝与树状加权抽选；剧情领域不再由引擎目录承载。
- 2026-09-01：M4-2/M8-2 后续切片完成：将色彩解锁事件编排从 `engine/system/color-unlock-reactor.ts` 迁移至 `src/arona-clicker/services/color-unlock-reactor.ts`；基础引擎仅保留端口与事件反应器机制，产品解锁语义归入 AronaClicker。
- 2026-09-01：M4-2/M8-2 后续切片完成：为 `AffectorEngine` 接入既有 `SpotFunctionalityQueryPort`，并将 `SpotFunctionalitySystem` 实现迁移至 `src/arona-clicker/services/spot-functionality.ts`；引擎只依赖最小功能查询能力，不再依赖产品实现。
- 2026-09-01：M2-2/M4-2 后续切片完成：新增 `StateMutationPort`，EffectEngine、AffectorEngine 与 TickSystem 改用基础写入最小契约；`StateMutationService` 暂保留为迁移期实现与测试 fallback，下一阶段继续拆分其 AronaClicker 领域写入口。
- 2026-09-01：M4-2 后续切片完成：新增 `EnhancementMutationPort` 与 `InventoryMutationPort`，强化和物品领域服务不再依赖 `engine/system/state-mutation-service.ts` 具体类型；统一写入口继续由 Runtime 注入。
- 2026-09-01：M4-2 后续切片完成：新增 `SpotMutationPort` 与 `InitMutationPort`，设施和世界线服务不再依赖统一写入口的具体引擎类；Runtime 仍维持单一状态写入实例。
- 2026-09-01：M4-2 后续切片完成：新增 `GachaMutationPort` 与 `AvailabilityMutationPort`，抽卡与角色可及性服务不再依赖 `StateMutationService` 具体类型；角色获得与世界池合并仍统一经 Runtime 写入口。
- 2026-09-01：M4-2 后续切片完成：新增 `ColorMutationPort` 与 `ColorEquipmentMutationPort`，色彩主题/设计与色彩装备服务不再依赖 `StateMutationService` 具体类型；解锁、装备收集和主题槽写入仍统一经 Runtime。
- 2026-09-01：M4-2 后续切片完成：新增 `CharacterProfileMutationPort`，角色画像自定义服务不再依赖统一写入口具体类。
- 2026-09-01：M4-2 后续切片完成：新增 `StoryMutationPort`，StoryService 及剧情流程/奖励辅助不再依赖 `StateMutationService` 具体类型；剧情阅读、完成、冷却与阻断写入继续通过统一 Runtime 管道。
- 2026-09-01：M7-2/M8-2 后续切片完成：新增 `UiMutationPort`，Runtime Commands 不再通过 `Pick<StateMutationService>` 暴露引擎具体类；UI 写操作继续只能经命令边界进入统一写入管道。
- 2026-09-01：M8-2 后续切片完成：新增 `RuntimeMutationPort`，Runtime Reset/Save 编排不再依赖 `StateMutationService` 具体类型；重置、恢复与学生阻断复检通过最小运行时写入能力协作。
- 2026-09-01：M2-2/M4-2 后续切片完成：新增 `EffectMutationPort`，Effect 分发器不再依赖 `StateMutationService` 具体实现；声明式 Effect 的写入能力集合成为可替换的基础契约。
- 2026-09-01：M4-2/M8-2 后续切片完成：统一状态写入实现迁移至 `src/arona-clicker/state/state-mutation-service.ts`，引擎侧删除具体实现与 EffectEngine/TickSystem fallback；两者改为必须注入基础写入端口。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M5-1/M5-2/M6-3 后续切片完成：生产代码与数据测试均改用 `src/data-services` 与 `src/data/test-datapack.ts` 公开入口；删除无消费者的 `src/data/base` 兼容 re-export、`src/data/index.ts`、`src/data/zip-loader.ts` 与 `src/save/storage.ts`，旧测试数据目录仅保留 Datapack 组装文件。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M5-3/M8-2 后续切片完成：Runtime 与图片测试改用 `src/data-services` 的 ImageStore/图片解析入口，删除无消费者的 `src/engine/image` 兼容目录；图片存储、Pic 解析与 PicService 统一归属基础数据服务。类型检查、图片专项 26 项测试与架构边界检查通过。
- 2026-09-01：M4-3/M8-2 后续切片完成：将剧情、设施、物品、强化等操作结果与 `GameView` 从 `engine/types` 移至 `src/arona-clicker/contracts/results.ts` 与 `contracts/view.ts`；基础引擎类型不再导出产品操作结果和 UI 视图模型。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M2-2/M4-2 后续切片完成：将 `Resource`、`GLOBAL_RESOURCE_IDS` 与 `isGlobalResource` 迁移至 `src/arona-clicker/types/ids.ts`；引擎资源工具仅保留通用资源 ID 构造与字符串回退，产品资源枚举及跨世界线规则归入 AronaClicker。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M2-2/M4-2 后续切片完成：将 `Character`、`CharacterRarity`、`CharacterSchool` 的值词表迁移至 `src/arona-clicker/types/ids.ts`；引擎侧仅保留字符串 ID/分类类型，角色显示、学校与稀有度枚举不再由基础引擎出口提供。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M2-2 后续切片完成：新增 `src/arona-clicker/types/character.ts` 作为角色领域类型入口，并将 AronaClicker 的角色服务、内容、状态写入口与通讯录契约切换到该入口；`CharacterData`/`CharacterVariantDef` 实体本体暂由旧契约承载，下一步拆分 Registry 的角色读取面后再完成本体迁移。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M3-2/M4-3 后续切片完成：`ContentCatalogQueryPort.characters` 收窄为 `CharacterCatalogEntry`（仅 `id/displayName/tags`），显示名与 UI 读取不再要求完整 `CharacterData`；Registry 的完整角色合并与产品角色算法保持分离准备。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M2-2 后续切片完成：角色内容、培养曲线、好感、抽卡、通讯录与 Spot/UI 组件的实体类型引用统一经过 `src/arona-clicker/types/character.ts`；旧 `engine/types/character.ts` 仅作为过渡定义源，后续待 Registry/Datapack 角色表完成泛化后删除。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M3-2/M4-3 后续切片完成：UI 的角色变体查询统一改走 `RosterQueryPort`，`ContentCatalogQueryPort` 不再暴露完整 `characterVariants` 表；测试桩同步最小查询能力。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M2-2/M3-2 后续切片完成：`TagStatService` 不再通过基础引擎统计端口持有完整 `characterVariants` 表，改为注入 `characterProtoOf(variantId)` 最小解析能力；具体差分查表留在 AronaClicker wiring。类型检查与 TagStats 12 项回归测试通过。
- 2026-09-01：M4-2/M8-2 后续切片完成：将 `CharacterProgressionPort` 从 `src/engine/contracts` 下沉至 `src/arona-clicker/contracts`；培养曲线、角色变体与好感配置不再由基础引擎契约导出，统一状态写入服务与产品成长算法仍通过 AronaClicker 内部端口协作。
- 2026-09-01：M2-2/M6-1 后续切片完成：将 `CharacterBuilder` 与 `CharacterVariantBuilder` 从基础引擎 `def-factory` 下沉至 `src/arona-clicker/content/def-factory`；引擎构造器出口不再生产产品角色实体，默认产品内容改用新的领域入口。类型检查与角色构造器专项测试通过。
- 2026-09-01：M4-2/M8-2 后续切片完成：将 Chara 名称/头像优先级解析从 `src/engine/core` 下沉至 `src/arona-clicker/services/chara-profile-resolver.ts`；角色资料服务仍保持原行为，基础引擎核心不再直接依赖产品角色目录。
- 2026-09-01：M3-2/M4-2 后续切片完成：`AffectorEngine` 与 `RuntimeEffectReactor` 改用最小 Registry 查询上下文，`TickSystem` 删除未使用的 Registry 参数；基础引擎机制不再依赖具体 `Registry` 类。类型检查、Affector/Tick/反应器 32 项专项测试通过。
- 2026-09-01：M3-2/M4-2 后续切片完成：`SpotFunctionalityQueryPort` 改用 `SpotFunctionalityView` 最小结构，`AffectorEngine` 生成线性产出效果时不再依赖完整 `SpotFunctionalityDef`。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M5-1/M8-2 后续切片完成：Registry 的实现与静态校验从 `src/engine/registry` 迁移至 `src/data-services/registry`，数据包编译/合并/校验归入基础数据服务；AronaClicker Runtime 与测试入口同步切换，基础引擎不再导出具体 Registry 实现。类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M6-1/M6-2/M6-3 收口：默认产品 Datapack 已完全独立于测试入口，`src/data/base` 仅作为测试/示例包组装层；依赖基础包的测试均显式从 `src/data/test-datapack.ts` 注入，残余兼容层归入 M8-2 清理范围。类型检查、架构边界检查与全量 1026 项测试通过。
- 2026-09-01：M5-1/M8-2 后续切片完成：Datapack 汇总契约从 `src/engine/types/datapack.ts` 迁移至 `src/data-services/contracts/datapack.ts`；数据服务、AronaClicker Runtime、产品内容与测试均显式使用数据服务契约，基础引擎类型出口不再导出 Datapack。Schema 生成器同步支持数据服务契约目录；类型检查、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M2-2/M5-1 后续切片完成：将数据包角色元数据记录 `CharacterData` 从 `src/engine/types/common.ts` 下沉至 `src/data-services/contracts/character-data.ts`；产品内容经 `src/arona-clicker/types/character.ts` 消费，Registry 与分片解析器改用数据服务契约，Schema 生成器同步扫描该目录。类型检查、角色/Registry 专项 40 项测试与全量 108 个测试文件/1027 项测试通过。
- 2026-09-01：M2-2/M5-1 后续切片完成：将数据包角色变体记录 `CharacterVariantDef` 从 `src/engine/types/character.ts` 下沉至 `src/data-services/contracts/character-variant.ts`；产品角色服务、UI、Registry 与测试统一经产品类型入口或数据服务契约引用，基础引擎不再导出角色变体实体。类型检查与相关回归通过。
- 2026-09-01：M2-2/M5-1 后续切片完成：将数据包培养曲线记录 `CultivateCurveDef` 从 `src/engine/types/character.ts` 下沉至 `src/data-services/contracts/cultivate-curve.ts`，并将其 Builder 迁移至 `src/arona-clicker/content/def-factory`；培养算法继续由 AronaClicker 服务负责，基础引擎不再构造产品成长实体。类型检查、培养/Registry/Builder 专项 44 项与全量 108 个测试文件/1027 项测试通过，架构边界检查通过。
- 2026-09-01：M2-2/M5-1 后续切片完成：将数据包好感配置 `AffectionConfigDef` 从 `src/engine/types/character.ts` 下沉至 `src/data-services/contracts/affection-config.ts`；好感曲线解释、台阶触发和状态写入继续归属 AronaClicker 服务，基础引擎不再导出产品好感配置。类型检查、好感/角色/Registry 专项 40 项与全量 108 个测试文件/1027 项测试通过，架构边界检查通过。
- 2026-09-01：M2-2/M7-2 后续切片完成：将 `ThemeDef`、`ThemeToken`、`ThemeOrderScope`、`EntityThemeSlot` 从角色类型文件拆至 `src/engine/types/theme.ts`；主题声明与主题运行时的引擎职责保持不变，角色类型模块不再混入主题状态契约。类型检查、主题专项 63 项与全量 108 个测试文件/1027 项测试通过，架构边界检查通过。
- 2026-09-01：M4-2/M7-2 后续切片完成：将 `RosterEntry`、`ProtoStat`、`GachaPoolState` 从角色声明文件归入 `src/engine/types/state.ts`；角色 Datapack 定义与运行时状态子结构完成第一层分离，完整 PlayerState 下沉仍待状态端口拆分。类型检查、角色状态专项 42 项与全量 108 个测试文件/1027 项测试通过，架构边界检查通过。
- 2026-09-01：M2-2/M4-2 后续切片完成：新增 `src/engine/contracts/state-query.ts` 的 `ConditionState`，条件系统与 VisibilityEngine 改用最小状态读取契约；好感条件通过 AronaClicker wiring 闭包读取当前产品状态，基础引擎不再在条件/可见性 API 上绑定完整 PlayerState。类型检查、Condition/Reveal/Trigger 专项 41 项与全量 108 个测试文件/1027 项测试通过，架构边界检查通过。
- 2026-09-01：M2-2/M4-2 后续切片完成：在 `state-query.ts` 新增 `StatsState`，StatsService 改用最小状态读取面（Init、区域、帧数、资源）；统计三层计数和持久化语义保持不变。类型检查、Stats/Condition 专项 34 项与全量 108 个测试文件/1027 项测试通过，架构边界检查通过。
- 2026-09-01：M2-2/M4-2 后续切片完成：在 `state-query.ts` 新增 `ValueState`，ValueSystem 改用资源、设施、管理者与 flags 的最小状态读取面；数值表达式、Funclet 与 Extra 注入语义保持不变。类型检查、Value/GameNum 专项 68 项与全量 108 个测试文件/1027 项测试通过，架构边界检查通过。
- 2026-09-01：M2-2 后续切片完成：新增 `GameNumState`，GameNum 的区表聚合、缓存求值与 Affector flows 统一使用 ValueState 加上 tag/entity effects 与 spot tag overrides 的最小状态面；类型检查与 60 项 GameNum 回归通过。
- 2026-09-01：M2-2 后续切片完成：`GameNumQueryPort` 同步收窄为 `GameNumState`，外部数值查询不再把完整 PlayerState 写入基础引擎契约。
- 2026-09-01：M3-1 后续切片完成：新增 `TriggerState`，TriggerSystem 只依赖条件状态与 once 完成记录；类型检查与既有 Trigger 回归保持通过。
- 2026-09-01：M3-1 后续切片完成：FuncletExecutor 收窄为 `ValueState`，调用参数以 flags 覆盖注入；基础表达式执行器进一步解除对产品 PlayerState 的显式依赖。
- 2026-09-01：M3-2 后续切片完成：`VisibilitySnapshot` 迁移至 Reveal 契约，VisibilityEngine、SaveData 与 UI ReadModel 改用新入口；类型检查与 17 项 Reveal/UI 回归通过。
- 2026-09-01：M3-1 后续切片完成：ConditionState 的故事读取收窄为 `StoryCompletionState`，基础引擎不再依赖 passive/active 故事记录联合类型。
- 2026-09-01：M3-1 后续切片完成：ConditionState 的原型统计读取收窄为 `ProtoStatState`，基础引擎不再依赖产品侧 `ProtoStat` 实体。
- 2026-09-01：M3-1/M3-2 后续切片完成：动态 Spot 标签覆盖迁移为 `SpotTagOverrideState` 引擎契约，旧类型保留兼容别名。
- 2026-09-01：M4-1/M8-2 后续切片完成：新增 AronaClicker 产品状态入口，状态工厂、统一写入服务与 Init 快照编排改用 `src/arona-clicker/types/state.ts`；PlayerState 底层定义暂保留为迁移源。
- 2026-09-01：M4-1/M4-2 后续切片完成：Runtime 组合根、产品领域服务与 Contracts 的 PlayerState 引用统一切换到 AronaClicker 状态入口；类型检查、产品状态相关 123 项测试与架构检查通过。
- 2026-09-01：M4-1/M5-2 后续切片完成：SaveData 组装逻辑迁移至 AronaClicker Runtime，数据服务保留存储适配；类型检查、存档/Runtime 相关 79 项测试与架构检查通过。
- 2026-09-01：M3-2 后续切片完成：统计计数器、三层快照与事件上下文迁移至 `engine/contracts/stats.ts`，`engine/types/state.ts` 的基础统计混合内容进一步清理；类型检查、统计相关 31 项测试与架构检查通过。
- 2026-09-01：M3-2 后续切片完成：新增 `AffectorRuntimeState` 与 `FunctionalityState`，Affector 挂载对账和 Spot 功能查询不再显式绑定完整 PlayerState。
- 2026-09-01：M3-1/M3-2 后续切片完成：EffectEngine 与 TickSystem 分别使用 `EffectRuntimeState`、`TickState` 作为内部状态面；类型检查与全量回归保持通过。
- 2026-09-01：M2-2/M4-2 后续切片完成：`SaveBuildContext` / `SaveCodec` 收敛到 `src/arona-clicker/contracts/save-codec.ts`，`PersistedStats` 收敛到 `engine/contracts/stats.ts`；产品 Runtime、命令层与 UI 统一直接引用 `engine/contracts/save-data.ts`，数据服务保留兼容导出。类型检查、存档/运行时 79 项与 UI 16 项回归、架构边界检查通过。
- 2026-09-01：M3-2/M4-3 后续切片完成：UI 的揭示阶段/触发器/目标改用 `engine/contracts/reveal.ts`，揭示求值所需的 `PlayerState` 改经 `arona-clicker/types/state.ts`，并清理无用的引擎状态导入。类型检查通过，相关 UI 回归已通过。
- 2026-09-01：M2-2/M4-2 后续切片完成：`StateMutationPort` 不再要求完整 `PlayerState` 的 `setState`，新增 AronaClicker `StateMutationHostPort`；Effect/Affector/Tick/Session 的同步入口分别收窄至 `EffectRuntimeState`、`AffectorRuntimeState`、`TickState` 与对应最小状态面，保留可选兼容桥。类型检查、Effect/Affector/Tick 33 项回归、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M2-2/M4-2/M5-2 后续切片完成：完整 `SaveData` 下沉至 `src/arona-clicker/contracts/save-data.ts`，删除 engine/data-services 的产品存档契约，`SaveSystem` 改为泛型 JSON 存储；类型检查、存储/运行时/UI 90 项回归、全量 108 个测试文件/1027 项测试与架构边界检查通过。
- 2026-09-01：M2-2/M4-2 后续切片完成：新增 `src/arona-clicker/types/story-state.ts` 与角色运行时状态定义，产品故事/角色服务、结果和状态写入口改用产品类型；旧 `engine/types/state.ts` 暂保兼容源。类型检查、故事/角色/抽卡/状态写入 125 项回归、全量 108 个测试文件/1027 项测试与架构边界检查通过，待下一切片移除兼容源。
- 2026-09-02：M2-2/M4-2 后续切片完成：`src/arona-clicker/types/state.ts` 已从兼容门面升级为完整的 `PlayerState` / `InitSnapshot` 产品定义，并组合产品故事/角色运行时状态；基础引擎契约的动态标签覆盖统一改用 `SpotTagOverrideState`，不再读取旧状态桶。测试入口同步改用产品状态类型，并删除 `src/engine/types/state.ts`。类型检查、故事/角色/抽卡/状态写入 125 项回归、全量 108 个测试文件/1027 个测试与架构边界检查通过。
- 2026-09-02：M2-2/M5-1/M6-2 后续切片完成：Chara 声明表 `CharaProfileDef` 迁移至 `src/data-services/contracts/chara-profile.ts`，玩家覆写/解析结果迁移至 AronaClicker 类型，Builder 迁移至 `src/arona-clicker/content/def-factory`；删除引擎 Chara 类型与 Builder 出口，Schema 已重新生成。类型检查、Chara/数据包/Builder 定向 23 项、全量 108 个测试文件/1027 个测试与架构边界检查通过。
- 2026-09-02：M2-2/M5-1/M4-2 后续切片完成：角色持久化配置 `CharacterPersistConfig` / `CharacterPersistScope` 迁移至 `src/data-services/contracts/character-persist.ts`，产品内容与测试切换到数据服务契约，删除引擎角色类型中的持久化配置。Schema 已重新生成；类型检查、持久化/快照/Chara/数据包定向 29 项、全量 108 个测试文件/1027 个测试与架构边界检查通过。
- 2026-09-02：M2-2/M4-3 后续切片完成：产品 `ContentCatalogQueryPort` 迁移至 AronaClicker Contracts，基础引擎显示名解析改用最小 `DisplayNameCatalog`，删除引擎目录查询出口；类型检查、全量 108 个测试文件/1027 个测试与架构边界检查通过，架构边界检查通过。
- 2026-09-02：M2-2/M5-1/M4-2 后续切片完成：Gacha 配置 `GachaPoolDef`、`GachaMode` 及概率/保底/重复奖励子结构迁移至 `src/data-services/contracts/gacha-pool.ts`，Builder 迁移至 AronaClicker 内容层，删除引擎 Gacha 类型与 Builder 出口；Schema 已重新生成。类型检查、Gacha/可及性/Builder/UI 定向 37 项、全量 108 个测试文件/1027 个测试与架构边界检查通过。
- 2026-09-02：M2-2/M5-1/M7-2 后续切片完成：Color 配置 `ThemeDesignDef`、`ColorGroupDef`、`ColorEquipmentDef` 及色位结构迁移至 `src/data-services/contracts/color.ts`，Color Builder 迁移至 AronaClicker 内容层，基础引擎角色类型收缩为通用 ID 与获得来源；主题运行时机制保持在引擎。Schema 已重新生成；类型检查、Color/主题/Builder/UI 定向 110 项、全量 108 个测试文件/1027 个测试与架构边界检查通过。
- 2026-09-02：Item/DropTable 数据定义与 Builder 已完成迁移：数据服务承载可解析契约，AronaClicker 承载内容工厂与掉落解释服务；Schema、类型检查、26 项定向测试、全量 1027 项测试及架构边界检查均通过。下一步继续清理剩余 `engine/types/content.ts` 中的产品数据定义。
- 2026-09-02：Enhancement 数据定义与 Builder 已完成迁移：数据服务承载强化声明，AronaClicker 承载内容工厂与强化购买/状态解释；Schema 已重新生成，类型检查与 42 项 Enhancement/Effect/Affector/Spot 回归通过。下一步处理 Story 数据定义与 Builder 的归属拆分。
- 2026-09-02：PassivePool 数据定义与 Builder 已完成迁移：数据服务承载池树声明，AronaClicker 承载内容工厂与池抽选解释；Schema 已重新生成，类型检查与 33 项 PassivePool/Builder 回归通过。下一步继续拆分 StoryEntry 与 StoryDef/Talklet 契约。
- 2026-09-02：Story 第一层完成：`StoryDef`、`Talklet`、`StoryChoice` 契约进入数据服务，Story/Talklet/StoryEntry Builder 进入 AronaClicker 内容层；剧情服务与 UI 结果契约已切换，Schema 与 86 项剧情定向回归通过。下一步清理引擎中残留的 StoryEntry 定义，并统一 Active/Passive 入口契约。
- 2026-09-02：StoryEntry 第二层完成：入口、分支守卫与条件奖励契约进入数据服务，删除 `engine/types/content.ts`；引擎聊天事件改用本地 `EngineTalklet` 最小契约，架构检查重新通过。类型检查、Schema、剧情专项与全量 1027 项测试均通过。下一步盘点剩余引擎总出口与 UI/产品公共入口。
