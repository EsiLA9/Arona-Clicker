# Runtime 内容静态反查询与实体里程碑记录

状态：active — 2026-09-20 收敛为超级图鉴静态关系接入

## 当前进展

- 已为实体和资源增加统一的只读静态关系查询入口。
- 查询入口复用 Runtime 快照的正向 / 反向索引，不新增扫描和每帧工作。
- 已通过资源关系、实体关系和缺失资源查询测试。
- 现有 Inspector 已能统一呈现关系并支持局部跳转；本 Task 不新增专用资源页面。
- 实体获得 / 解锁 / 里程碑状态不在本阶段实施，后续另立状态层任务。

## 目标

在当前 Runtime 内容浏览器基础上提供简单、稳定、只读的内容反查询：

- 资源可以查询由哪些内容提供、消耗或作为条件；
- 实体可以查询会影响哪些资源 / 实体，以及由哪些资源 / 实体影响；
- Init、Area、Spot、Story、Trigger、Affector、Enhancement 等内容使用统一关系模型和前端渲染逻辑；
- 后续支持实体获得、解锁和里程碑等标志性记录，但不保存完整 Event / Effect 因果链。

## 非目标

- 不实现每次资源变化的完整来源栈。
- 不记录每个 Tick、每个 Event 或每次 Effect 执行历史。
- 不引入图数据库、统计服务或全屏关系图。
- 不改变 Trigger、Event、Affector 的运行时结算语义。
- 不让 UI 在每次打开详情时重新扫描全部 Registry。

## 当前事实与边界

- Runtime Query 已在 [`runtime-content-browser.ts`](../../src/data-services/registry/runtime-content-browser.ts) 构建有效 Def 快照、正向引用和反向引用。
- `RuntimeContentReferenceDiagnostic` 已保留 `path`、`relation`、`targetKind`、`confidence`、`status` 等基础信息。
- `GameEvent` 中多数事件已经带有实体 ID，例如 `spotId`、`areaId`、`initId`、`storyId`、`itemId`。
- `AffectorInstance` 已保存 `packId`、`mountEntityId` 和 `instanceId`。
- 资源变化等事件未必带有唯一内容来源，因此本 Task 只做静态关系，不猜测动态因果。

## 一、静态关系模型

在 Runtime Query 构建快照时生成关系边：

```text
来源 Def ──关系类型 / 字段路径──> 目标资源或 Def
```

关系至少覆盖：

| 关系 | 示例 |
| --- | --- |
| 产出 | Spot / Story / Trigger → Resource |
| 消耗 | Shop / Purchase / Upgrade → Resource |
| 解锁条件 | Resource → Init / Area / Spot |
| 支付门槛 | Resource → Shop / Upgrade / Gacha |
| 影响实体 | Trigger / Enhancement → Spot / Area / Init |
| 被挂载 | AffectorPack → Spot / Item / Enhancement |
| 所属关系 | Spot → Area、Area → Init |

关系必须保留：

- 来源 Def 身份；
- 目标 Def / Resource 身份；
- 关系类型；
- 原始字段路径；
- `declared` / `inferred` 置信度；
- `resolved` / `missing` / `ambiguous` 状态。

同一目标可以有多条路径。查询层不得把不同路径错误压成一条事实；UI 可以在概览聚合，但关系详情必须能展开全部路径。

## 二、查询接口

优先复用 `RuntimeContentBrowserQueryPort`，不新增 UI 专属扫描器。目标接口形态：

```ts
getOutgoingRelations(ref)
getIncomingRelations(ref)
getResourceRelations(resourceId)
getEntityRelations(ref)
```

资源查询需要支持两个方向：

```text
资源会影响什么：资源 → 解锁 / 支付 / 条件目标
什么会影响资源：实体 → 产出 / 奖励 / 消耗
```

实体查询需要支持：

```text
实体影响的资源 / 实体
影响该实体的资源 / 实体
```

资源不是普通 Def 时，仍使用统一的 `RuntimeDefinitionRef` 表达目标，不能为资源单独建立另一套 UI 关系协议。

## 三、统一前端展示

所有可浏览内容统一使用：

- `DefinitionInspectorViewModel`；
- 概览、关系、原始数据页签；
- 关系目标快捷入口；
- 已解析 / 缺失 / 歧义状态；
- 当前已有的前进、后退查看栈。

概览中相同目标只显示一个聚合项：

```text
青辉石
2 条引用路径
```

展开后显示具体路径，例如：

```text
$.purchaseCost[0].resourceId · 已声明
$.revealTriggers[0].condition.conditions[0].key · 推断
```

不为 Resource、Init、Area、Spot 或 `addition-test` 编写专用 HTML 模板。

## 四、实体获得与里程碑记录（后续任务，不在本阶段实施）

未来如重新立项，可增加轻量事实记录，例如：

```text
entityMilestones[entityId][milestone]
```

首期只记录标志性事件：

- `acquired`：获得实体；
- `unlocked`：实体解锁；
- `firstReached`：首次达到重要状态；
- `milestone:<id>`：达到指定里程碑。

记录必须满足：

- 只在首次达成时写入；
- 使用现有状态写入口；
- 按 global / per-Init 层级裁定归属；
- 不记录完整 Event 对象、Effect 栈或高频 Tick 历史；
- 能被 Runtime Query / 图鉴读取为只读事实。

具体字段名和归属层级在实现前以现有 PlayerState 分层为准，不在 UI 内私自持有状态。

## 五、性能约束

静态关系索引只在 Runtime 快照构建或内容修订后更新：

```text
构建：O(Def 数量 + 关系边数量)
查询：O(1) 索引定位 + O(结果数量) 输出
每帧：无全表扫描
```

允许增加关系索引和少量路径字符串内存；禁止在每个 Tick 重新枚举全部 Def。

里程碑只在状态从未达成变为达成时写入，使用集合 / 标志位去重，不形成持续事件日志。

## 六、DOM 刷新边界

| 行为 | 允许刷新范围 | 禁止刷新范围 |
| --- | --- | --- |
| 打开关系详情 | 当前详情标题、关系区和详情主体 | Mod 列、条目列表、整个 Codex 壳层 |
| 展开同目标路径 | 当前聚合关系项 | 其他关系项、条目列表 |
| 资源 / 实体快捷跳转 | 详情标题、查看栈按钮、详情主体 | Mod 列、条目筛选结果 |
| 前进 / 后退 | 当前详情区域 | Mod 列、条目列表、筛选条件 |
| Runtime 内容重建 | Codex 快照和受影响详情 | 其他 Workspace |

不使用整个 Codex 容器 `innerHTML` 重建来完成关系跳转、路径展开或查看栈操作。

## 七、实施阶段

### P0：关系事实

- 盘点现有 Runtime Query 已能识别的资源 / 实体关系。
- 补充产出、消耗、解锁条件、支付门槛、挂载和所属关系的语义映射。
- 以 `addition-test:init:observatory`、`base:resource:pyroxene`、`addition-test:spot:scanner` 为验收样本。

### P1：索引与查询

- 增加统一出向 / 入向关系索引。
- 提供资源和实体的通用查询入口。
- 保留多路径事实和缺失 / 歧义诊断。

### P2：Inspector 接入

- 将资源和实体关系接入现有相关组分聚合展示。
- 复用统一跳转与查看栈。
- 保持详情局部 DOM 刷新。

### P3：里程碑基础

- 裁定最小实体里程碑数据结构与状态层归属。
- 只接入获得 / 解锁 / 里程碑首次达成事件。
- 增加去重、重载和只读查询测试。

## 验收标准

- `base:resource:pyroxene` 能查询被哪些 Init / Shop / Upgrade / Story / Trigger 使用或影响。
- `addition-test:init:observatory` 能显示其资源、Area、Story 和反向引用。
- `addition-test:spot:scanner` 能显示其消耗资源、产出资源和所属 Area。
- 同一目标的多条路径被聚合展示，但路径信息没有丢失。
- 资源和实体使用同一套 Inspector 关系渲染和快捷跳转。
- 静态关系查询不增加每帧全表扫描。
- 里程碑只在首次达成时记录，重复 Event 不产生重复事实。
- 关系跳转、路径展开、查看栈操作不刷新无关 DOM。
- 不增加长篇描述、统计服务、巨大关系图或巨大固定尺寸元素。
