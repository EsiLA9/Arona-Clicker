# Task：Gameplay B C5 作者入口、完整样例与旧语义退役

**状态：proposed — C5 完整施工仍依赖 Task 0291 C4；负责人于 2026-10-18 另行裁定，立即将默认 Gameplay B bundle 切为 Map-only 并退役旧 Strategy Park bundle**

## 目标

完成 Task 0287 的 C5：让 Gameplay B 作者能在受支持的 Datapack Editor 中建立新 Map；从零重建真实玩法 B 内容；补足 Rest、Shop、Edge Branch 的 D2 样例；完成 Gameplay B 专属旧 Operation 数据、默认包、专属 UI 分支和失效测试的退役；使旧 Operation Run 明确失效，同时保留共享 AC 内容及长期 PlayerState。负责人新裁定已允许默认旧包立即退役，不再等待 U4；B 专属源文件和 UI 分支的彻底清理仍按 U5 依赖关系处理。

新作者路径以 `Map → Node → Edge → Encounter → Action / Effect` 为中心。`OperationEvent → Location → Scene` 不再是地图的隐含包装层，也不作为新 Map 内容的权威来源。

## 设计目标：作者数据应具备的结构和关系

```text
Datapack.maps
   ↓
独立 Datapack Editor 的 Maps 表
   ↓
Registry → Map Resolver → Spot.mapEntry → MapRun / Workspace
                              │
                              ├─ Battle：沿用 C4
                              ├─ Rest：有限轮次与 MapRun-local 恢复
                              ├─ Shop：Offer、局内支付、临时物品
                              └─ Branch：Edge 条件，不新建路线树
```

编辑器必须能表达 C4 最终冻结的 Map / Battle 作者字段，以及本 Task 所需的 Rest / Shop / 条件 Edge 字段；内容通过正常 Datapack → Registry → Resolver → Spot 入口驱动实际 Runtime。坐标等地图展示信息只服务 UI，不建立第二份可写移动图。

## 已冻结边界

- 本 Task 的施工依赖 Task 0291 C4 完成及独立复核；C4 最终 Map 字段以其验收后的源码为准，再进入 Editor Schema。
- Stage B 允许 Gameplay B 专属包内容按新目标从零重写；Carousel、Strategy Park 旧路线和专属示例不要求逐条迁移。
- `Spot.mapEntry` 是新 Map 的正常入口；`operationEntry` 不得暗中重解释为 Map。
- MapRun-local 临时物品、PlayerCost、局内 HP 和节点进度不能因 Shop 或 Encounter 自动写入 Persistent PlayerState。只有明示的一次性长期奖励可以写入。
- 旧 Gameplay B Operation Run 不迁移。负责人于 2026-10-18 裁定：不要求二次确认；旧 Event 无法由 Registry 解析时直接拒绝恢复，并允许后续存档清除旧 Operation checkpoint。该处理不得清理或回滚长期 PlayerState。
- `base` 角色、Variant、永久 Items、通用资源 / Effect、PackManager、Save 与事务设施按阶段 B 清单保留；`prototypes/gameplay-b/` 不随默认 Gameplay B 内容清理。
- Battle 由 C4 覆盖；Rest、Shop 和 Edge Branch 必须在 C5 有独立 D2 运行记录，不得因阶段拆分而从总体验收中删除。
- 不编辑生成文件 `tools/datapack-editor/schema/engine-defs.gen.json`。Maps 使用可维护的 Editor Schema 源并补足对应同步 / roundtrip 测试。

## 当前背景：C5 实施前源码核对

- `Datapack` 已声明 `maps`，`GameplayMapDef` 和 Registry / Resolver / Spot `mapEntry` 已实现；C1a、C2、C3 通过正式 Map 入口运行。当前 Map 数据字段会继续由 C4 扩展。
- 独立 Editor 的 `TableKey` 没有 `maps`；`TABLE_META` 仍注册六张旧 Operation 表。`engine-defs.gen.json` 当前不含 `maps` / `GameplayMapDef`，而根 `AGENTS.md` 禁止修改生成 Schema。
- Editor `merge.ts` 对 `TableMeta.custom` 会直接加入自定义 `TableSchema`，跳过 generated `defMap`。因此维护中的 `types.ts` / `editor-extras.ts` 可以注册 source-owned Maps 表；应增加 Maps 专项来源覆盖和编辑往返测试，避免把缺失的生成表默认为完成。
- 默认 Runtime 已改为只装载 `gameplay-b-map-datapack.ts` 的 Map-only `gameplay-b@1.0.0` bundle；旧 `gameplay-b-strategy-park@1.0.0` bundle 已列为精确退役项。混合旧样例 `gameplay-b-datapack.ts` 与 Strategy Park 源内容暂留给既有定向测试，不再作为默认运行内容；Map-only Datapack 已拆出单独源。
- PackManager 从保存快照恢复时会移除精确指定的旧 Strategy Park 内置 bundle，清理失去内容记录的 Pane 选择并保存清理后的快照；base 与用户导入包不受此退役规则影响。
- `operation-workspace.ts` 仍导入 Strategy Park 静态地图常量并按 Event ID 分支；`runtime-bootstrap.ts` 仍接入 Carousel Safety Operation resolver。开发卡牌检查器、Runtime 包样例和很多旧 engine / UI tests 也直接导入这些文件。
- 旧 B 记录与通用 Operation 合同 / Runtime 可能存在不同的消费者边界。删除前必须核实所有非 B 内容调用方，不能仅凭文件名含 Operation 就删掉共享机制。
- 当前阶段 B 要求 MapRun-local 临时物品；C4 的 Consumable Item source 是 Persistent PlayerState inventory。C4 已提交的永久消耗品使用仍按同一事务扣除 PlayerState 库存；C5 Shop 临时货品则使用独立的 MapRun-local 身份与数量，不得伪装成永久 Item，也不能调用 `ItemService.useItem()`。

### U5 只读调用方盘点（2026-10-18；施工前须复核）

| 当前对象 / 调用方 | 现状与建议去向 |
|---|---|
| `operation-samples/gameplay-b-datapack.ts` / `gameplay-b-map-datapack.ts` | 前者仍保留旧 Operation 定向夹具并复用 Map 定义，但已不由 Runtime 装载；后者是默认 Map-only 包，只开放 `Spot.mapEntry`。多项 Map tests 尚待迁到干净 Map fixture。**Transform：**U5 调整 Map 测试消费者后，再从旧混合夹具中移除 B 专属 Operation 记录。 |
| `gameplay-b-strategy-park.ts`、`-ids.ts`、`-map.ts` | 默认 Runtime bundle、`operation-workspace.ts` 的静态地图 / ID 分支、Operation UI / 样例测试及已发布内容测试仍引用。旧 13 地点内容、静态图数据、Park-specific styles 与按 Event ID 渲染应在新 Map 正常链路通过后 **Retire / Transform**；`prototypes/gameplay-b/` 保留。 |
| `runtime.ts` 内置包与 PackManager 快照 | 默认只装载 Map-only `gameplay-b@1.0.0`；`gameplay-b-strategy-park@1.0.0` 使用精确 bundle 退役名单从旧快照移除并保存清理后快照。**Transform：**后续仍需做首次启动与重启验收；保留 `base` 与 `sourceKind !== 'bundle'` 的用户导入包。 |
| `ui/components/operation-workspace.ts`、`app/runtime-bootstrap.ts` | Operation Workspace 同时包含 Park 静态地图 / Carousel 专属表现和较通用 Operation 呈现；runtime bootstrap 有 Carousel Safety resolver fallback。**Retire / Transform：**只退役已确认的 Park / Carousel 特例，先由 U4 验证新 Map Workspace；保留仍有消费者的通用 Operation 展示、Resolver 与 Controller 路径。 |
| `ui/development/gameplay-b-card-inspector.ts` 与 quick test console | Card Inspector 是直接加载旧 B 包并启动 Carousel 的专属调试入口，可退役或转为新 Map 调试入口；quick test console 目前只做角色投送和 `getValue`，不启动 Operation，不能只凭名称删除。 |
| `Spot.operationEntry`、DSL、Registry、Editor、Runtime API | 当前生产侧 Operation 内容调用来自两份旧 B 包，但 `operationEntry` / Resolver / Registry / Runtime 仍是通用接口。**Keep 或单独整体退役：**U5 按非 B 消费者证据决定；绝不暗中改成 Map Entry，也不留下能重新激活旧 B 默认内容的旁路。 |
| `SaveData.operationRun` / Operation Restore | Snapshot 只存 `eventId`、`resumeVersion` 与 Run，不存来源包 ID；Restore 按当前 Registry 解析。Gameplay B 默认 Event 已从 Registry 移除，旧 Run 无定义时恢复会被拒绝；后续存档清掉旧 checkpoint。按负责人新裁定不再加确认步骤；必须验证 PlayerState 不被清理，通用非 B Operation 恢复规则仍保持原样。 |
| 旧 B 样例测试与通用 Operation tests | Map tests 应迁到 U4 新 fixture；Carousel / Strategy Park / 旧 Scene 内容测试应 Retire 或改写为 D2 新样例。`operation-runtime-service`、准入规则等通用行为测试按 API 最终去向保留或重写；混合测试只移除旧样例依赖，不批量删除通用覆盖。 |

上述静态依赖基线需按负责人新裁定更新：默认旧包退役已获授权并先行实施；B 专属源码、专属 UI 与 obsolete tests 的删除仍须在 U5 依据当前调用方确认，不得误删共享 Operation Runtime。

## C5 行为合同

本 Task 继承已冻结的 D2 验收目标：Rest 有角色行为、轮次结算、资源恢复和回图；Shop 做资源交换，余额不足拒绝且重复请求不重复支付，并且不依赖战斗专属规则；Branch 由 Map Edge 表达。下列具体作者字段、交互方式与实现顺序是供 C5 施工采用的最小建议，不代表负责人另行冻结了新的产品数值或通用规则。进入 U2 后若源码证明某条建议不能复用 C4 语义，应先提交最小数据合同与行为证据，再实现；不得借机扩成新的通用 Encounter / Economy 框架。

### 1. Editor 作者入口

- 最终独立 Datapack Editor 提供 `maps` 表，作者能够新增、编辑、删除和浏览 Map 内容；Map 是数组记录，ID 使用既有三段式 `map` 身份。
- 通过可维护源码定义 Maps `TableSchema`，例如 `TableKey: 'maps'` 加 `TABLE_META` 的 `custom` builder。`merge.ts` 现有 custom 路径可避开旧生成 `defMap`；不得手改或生成提交 `engine-defs.gen.json`。
- Schema 覆盖 C4 最终稳定作者字段及 C5 的 Node / Edge / Encounter / Rest / Shop / 条件和临时物品表达；Character、Item 等外部引用需能选择，Map 内局部 Node / Action ID 由 Map-aware 校验检查。
- 注册 Maps 表后，Editor 导航、`EditorModel` 加载 / 编辑 / 导出、Datapack Package 导入 / 导出都能保留 `maps`。对自定义 Schema 的来源覆盖、字段覆盖与 roundtrip 单独加测试；继续由 Registry 验证完整 Map 业务关系。
- 不把整张 Map 退化为单一 JSON 文本区域；若某个复杂叶子暂无法结构化，须有明确边界与不丢数据验证，不影响 Node / Edge / Action / Encounter 基本可视编辑。

### 2. Rest、Shop、Branch 的最小真实样例

- **Rest：**无敌人的 Encounter，不执行敌方行动。角色可使用既有 Hand / Action 回合；内容声明一个有限轮数上限，达到后结束并回同一 Node；资源恢复写入 MapRun-local HP 或 Actor / Team resource，不触发 Battle 胜负或长期角色成长。
- **Shop：**作者声明 Offer 列表；玩家可选择购买或离开。购买使用 MapRun-local 资源支付并发放 MapRun-local 临时物品 / 通行证；扣款与发货必须作为一个 MapRun 原子提交，若任一部分失败则两者均不变化；余额不足不得改动状态，成功购买一笔后重复请求不得重复支付或重复发放。Shop 不抽角色 Hand，不运行 Enemy / Battle 回合。
- **Temporary Item：**数量 / 标记归 MapRun-local，可用于 Map Edge / Encounter Condition；保存与恢复只在该 Run 内继承，Run 成功 / 失败后清理或按明示的 Result 合同转为长期奖励。不能调用通用 `ItemService.useItem()` 把局内物品写进 PlayerState inventory。
- **Branch：**以当前 Node 的 Edge 及明确可读的 MapRun-local Condition 表达；至少包含一条条件 Edge 与一条替代 Edge。不可达 Node 仍由 MapRun Owner 拒绝移动命令；不另建 Route 提交或任务分支系统。
- Shop / Rest 可以复用统一 Action / Effect / Condition 语义，但不得要求战斗专属目标、Enemy 状态或 Character Hand，也不新增庞大 EncounterType / 通用 Shop Economy DSL。若 C4 当前管线不能表达这些用例，应在 U2 先形成一项最小 C5 数据合同，再依只读源码 / 行为证据实施。

### 3. 新内容与旧内容迁移

- 新内容包必须有从零编写且经正式 `mapEntry` 加载的可玩 Map：至少一张三节点 Battle 地图，以及可实际运行的 Rest、Shop、条件 Edge 样例；这些内容可按最小作者语义安排在同一张或多张 Map 中，但不得依赖旧 Event / Location / Scene / Profile / CardPool。
- 完成新内容的 Registry、Resolver、Spot、Runtime / UI 端到端验证后，再逐项删除 / 替换阶段 B 矩阵列为 Retire 的 B 专属内容。
- 默认 Gameplay B 包不再以旧 Carousel / Strategy Park Operation 作为可玩入口或权威源；Strategy Park 静态地图、按 Event ID 的专属渲染与 Carousel Safety fallback 从新玩法链路退役。
- 对每个准备删除的 Operation 文件 / 字段 / UI 分支记录：它是否为 B 专属、其所有静态调用者、是否有其它包或模块的消费者、采用 `Retire` 还是保留共享 API。保留 generic Operation Runtime 时必须确保新 Gameplay B 不依赖它；若确认其只服务退役 B 内容，则按现行架构约定删除多余路径和失效测试。
- 旧包元数据和默认 Runtime pack snapshot 需更新。新 Map ID / package ID 可按新内容约定决定；不得为兼容旧内容保留双重地图位置或双重完成状态。
- 旧 Operation Run / checkpoint 因 Event 定义不再可解析而直接失效；后续存档允许清掉旧 Run checkpoint，不增加确认步骤。长期角色、永久物品及其它 PlayerState 必须保留。新 Map 的 Save / Load 覆盖 MapRun-local HP / 资源 / 临时物品、Node 状态及活动 Encounter；新 Run 使用不同 `runId` 并从 Map 初值重建。

## Patch Units

### U1 — Maps Editor source schema 与 roundtrip

**前置：**C4 作者数据合同和 Registry 字段稳定。

**读集：**`tools/datapack-editor/schema/types.ts`、`editor-extras.ts`、`merge.ts`、`datapack.schema.ts`、`engine-schema.sync.test.ts`、Editor model / IO tests、当前 Datapack / Gameplay Map 源合同。

**可写集：**Editor 维护中的 Map Schema 源、Map Table 导航 / 引用校验和定向 Editor / Schema / Package roundtrip tests；不写生成 Schema。

**验收：**作者可从真实 Editor 修改 Map 及嵌套字段；保存、导出、重新加载与 pack roundtrip 不丢数据；Source-owned Schema 专项测试涵盖最新 C4 / C5 字段。

### U2 — MapRun-local 临时物品与 Rest / Shop / Edge 条件闭环

**读集：**C4 MapRun Owner / Action / HP / Item Commit、Map Content Resolver / Registry、阶段 B 生命周期和 Save / Resume。

**可写集：**MapRun Owner 与最小 Map Content / Registry / Condition / Effect contract 的必要扩展及对应保存、支付、Rest、条件移动测试。仍由 MapRunService 持有局内唯一可写权威。

**验收：**有限轮 Rest、MapRun-local 资源恢复、Shop 成功购买的扣款 + 临时物品发放原子性、余额不足零写入 / 请求去重、临时物品保存 / 条件分支 / Run 清理均可实际运行；永久 PlayerState 库存不会收到 Shop 临时物品 delta，C4 永久 Consumable 使用则只在成功事务中扣除 PlayerState 库存。

### U3 — Rest / Shop / Branch Workspace 交互

**读集：**Map Workspace View、Controller 命令、C4 UI、UI Presentation 上下文和项目视觉约定。

**可写集：**Map Workspace / Controller / CSS 中和 C5 Offer、Rest、条件 Edge 相关的部分及 UI tests；不改 C4 Battle 样式和 Map 导航模型。

**验收：**作者声明的 Rest / Shop / Branch 可由玩家辨识并操作；Offer 价格、MapRun 余额、临时物品、目标 Edge 和成功 / 拒绝原因均清楚；返回地图保持 Node 与定位。

### U4 — 新 Gameplay B Map 内容从零重建

**读集：**Task 0287 / 0291 最终合同、C1a–C4 receipts、Map Registry / Resolver / Spot 入口、Editor U1 与 C5 U2 / U3。

**可写集：**新 Gameplay B Datapack Map 样例、包元数据、Spot.mapEntry 与端到端内容 tests；暂不删除旧样例与包。

**验收：**一个至少三 Node 的新 Map 覆盖 Battle、成功 / 失败和返回路径；Rest、Shop、条件 Edge 各有可由正式 Datapack 入口运行的定向样例。样例可以最小化拆分或合并，不依赖旧 Operation 记录作为作者前置；成功 Exit 的明确一次性奖励只结算一次。

### U5 — B 专属旧 Operation 内容 / 专属 UI 退役与 Save 失效处置

**读集：**阶段 B Retire / Transform 矩阵、所有旧 B content importers、runtime bundled pack 和 PackManager 存档快照恢复、Operation Workspace、debug bootstrap、相关测试、PlayerState / Save / Load / 旧 `operationRun` resolver。

**可写集：**默认旧 B bundles 与 Map-only bundle 的切换已先行实施。U5 后续拆分 Map tests / fixtures；删除或替换 B 专属旧 datapack entries / 源文件 / 静态地图 branch / 专属 fallback / obsolete tests；确保旧 `operationRun` 对缺失 Event 的恢复拒绝及 checkpoint 清理不影响 PlayerState；共享 Operation 机制只按依赖审计明确保留或删除。精确内置 bundle 清理不得删除 base 或 `sourceKind !== 'bundle'` 的用户导入包；不得仅因有 B 专属代码而移除共享 Operation Entry、Registry 或 Runtime API。

**验收：**默认 Runtime 只装载 Map-only 包；首次启动和保存后重启都不再恢复 / 启用精确的旧内置 Strategy Park bundle；base 与用户导入包保留。Map tests 改用干净 Map fixture，再移除旧 Carousel / Strategy Park records 和旧混合包来源。缺失 B Event 的旧 `operationRun` 被拒绝，之后清除旧 checkpoint，但保留 PlayerState；按负责人新裁定不显示确认选择。非 B 通用 Operation Entry / API 仅按消费者审计决定去留，不批量删除。Strategy Park 展示分支、Carousel fallback 与失效旧测试不再能从正常入口激活。

### U6 — D1–D5 端到端、迁移矩阵、作者测试与独立验收

**读集：**Task 0287 D1–D5、Task 0291 / C5 U1–U5 receipts、当前测试、Save / Resume 和机制文档。

**可写集：**端到端与回归测试、迁移矩阵证据、C5 receipts、Task 0287 / 0292 状态和机制文档。

**验收：**未参与施工的 Agent 或主控从 Spot 正常入口运行新 Map，并分别实际运行 Battle、Rest、Shop、Edge Branch 样例；若内容可自然串成完整路径，再补跑 Battle → Rest → Shop → Branch → Exit 全路径，不以强行耦合样例为前置。按 D3 验证事务、RNG、状态生命周期、旧 Run 失效及 checkpoint 清理不影响 PlayerState，以及成功 Exit 时 PlayerState 奖励写回与 Run terminal 结果同一原子边界、重复提交不重复发奖；按 D4 逐条确认旧概念归属、是否存在第二权威、作者是否仍被迫填写退役结构、旧入口是否失效、测试是否覆盖。D2 的 Battle / Rest / Shop / Branch 各有独立结果记录。另由未参与施工、无旧 Operation 背景依赖的内容作者从空白作者入口开始，独立创建 Map A→B→C；B 节点 Encounter 至少声明 Character、Enemy、Available Actions 与 End Condition，Character 配置 Tendency，Action 配置 Effect；样例必须经正式 Datapack 路径运行。确认无需填写无实际玩法意义的 Scene、StrategyProfile、CardPool、Objective、Outcome、Team 或旧任务包装。U1 的 CRUD / roundtrip 测试不能替代这项 D5 验收。

## 执行纪律与 C4 依赖

- 现在只准备 C5 合同；U1–U6 施工需等 Task 0291 C4 完成并独立复核，避免同时改动 Map / MapRun 的作者权威。
- 每个 Unit 有独立 Read / Write / Acceptance；U2 / U3 如需增广 C4 结算管线须先向总控说明并串行处理。
- 负责人 2026-10-18 新裁定覆盖“U4 前不得退役旧 pack”的默认装载排序限制：旧 B bundles 已从默认装载和 PackManager 恢复中移除。此裁定不授权删除 base、用户导入包或共享 Operation Runtime；B 专属代码和旧测试按 U5 调用方审计继续清理。
- Luna Max 子 Agent 可以施工互不冲突 Unit；独立审查不得由同一施工 Agent 充任。
- 仅保留 Stage B 清单允许的共享数据；不因目录名、测试名或“从零重建”授权而批量删除共享 base / prototype。
- 不改生成 Schema，不写 GALHCG 图或 freshness；读图结果回到当前源码复核。

