# Task：Def 编辑器总纲与各类内容编辑需求台账

状态：active — 🟡 总纲设计与阶段裁定，尚未进入全量 Def 施工

## 1. 任务定位

本 Task 是 Runtime Editor 后续 Def 编辑工作的总纲。它回答四个问题：

1. Datapack 中每一类 Def 的职责、引用关系和作者真正需要编辑的内容是什么；
2. 每一类 Def 应采用什么编辑器形态、页签、子编辑器、预览和诊断；
3. 哪些字段可以安全写入，哪些字段只能只读，哪些字段必须等机制或物化链补齐；
4. 各类 Def 应按什么依赖顺序、Apply 级别和验收标准推进。

本 Task 不直接把所有字段开放为可写，也不把 UI 设计当成 Runtime / Registry / PlayerState 的替代品。它是后续专项 Task 的裁定入口；每个独立 Def 域开工前，必须从这里拆出自己的 Task、Read Set、Allowed Files 与验收矩阵。

## 2. 当前事实与硬边界

### 2.1 当前事实

- `Datapack` 的内容全集由 `src/data-services/contracts/datapack.ts` 定义，包含世界、剧情、角色、养成、色彩、经济、效果、资源和表现等表，以及若干 singleton 配置。
- `ContentKey` 已从 `Datapack` 顶层字段派生；新增表不应再维护第二份内容键枚举。
- 当前 `CONTENT_POLICIES` 已登记 `inits`、`areas`、`spots`、`enhancements` 四类策略。Policy 负责字段白名单、输入校验、编码、分区、消费者和失效台账，不等于该类内容已经具备完整的用户可写 Apply。
- `Init / Area / Spot` 当前使用局部 Registry mutation；`Enhancement` 当前为 `reload` 策略，不能套用 Spot 的局部热 CRUD。
- Runtime Editor 当前入口是 `src/ui/runtime-editor/`，独立 `tools/datapack-editor/` 只有在明确要求独立数据包编辑器或 Schema 编辑器时才进入本 Task 的实现范围。
- 数据包编辑态、目标 `packRecordId`、Pane / Selection / Runtime Apply、完整源包导出与编辑态持久化已经有专项设计和实现记录；本 Task 不重建这些生命周期模型。
- `Registry` 是声明内容的只读编译态；运行时进度属于 `PlayerState`；UI 只消费 `GameView` / `UIContext`，不持有 Registry 或 PlayerState 写引用。

### 2.2 不可破坏的边界

1. 所有运行时状态写入继续经 `StateMutationService`；Def 编辑器不得把定义字段写入 PlayerState。
2. UI 只能提交 Draft / Command，不能直接修改 Registry、Datapack 原对象或运行时索引。
3. 每个写字段必须在 Policy 的 `fields` / `extensions` / `materialization` 中有明确登记；没有消费者和失效触发方的字段默认只读。
4. 复杂字段必须 fail closed：编辑器不能因为当前结构复杂就把它降级成空值、当前计算值或截断后的近似值。
5. 已有定义包含首版不支持的结构时，默认阻断替换；只有建立不透明载荷保留与回写协议后，才允许“编辑部分字段但保留其余结构”。
6. 新建定义必须携带明确的编辑态数据包目标；不得从当前浮窗、最近选择、当前 Runtime 或默认 Mod 推断写入目标。
7. `Draft → Validate → Prepare → Apply → Projection → Receipt/Rollback` 是统一提交链；任一步失败都不得留下半提交的 Registry、索引、Runtime 状态或 Applied 快照。
8. 不写存档迁移和版本兼容代码。Def 结构发生破坏性变更时同步更新测试与文档，旧存档按项目纪律失效并清档重来。

## 3. 能力分级

每类 Def 的能力必须拆成四个独立维度，不能用“有编辑页面”概括全部能力。

| 等级 | 含义 | UI 行为 | Apply 要求 |
| --- | --- | --- | --- |
| R0 | Browse | 在 Content Browser 中列出、搜索、按来源筛选 | 不产生 Draft |
| R1 | Inspect | 查看字段、引用、来源、消费者、缺失项、运行时投影 | 只读；允许复制路径和跳转引用 |
| D1 | Draft | 在编辑态数据包中创建/编辑/复制/删除草稿 | 只改编辑态内容，不改变 Runtime |
| A1 | Apply | 将已校验草稿提交到 Runtime / 导出包 | 必须有明确物化消费者、失效策略、原子回滚和回归测试 |

另有两个独立标记：

- `opaque-safe`：当前未展开的结构可以被完整保留并无损回写；
- `runtime-ready`：当前 Apply 可以安全更新 Runtime 所有必要投影。

因此 `D1 + !opaque-safe` 只能在新建空对象或完整覆盖对象中开放；`A1` 必须同时满足 `runtime-ready`，否则只能保存编辑态并导出。

## 4. 统一编辑器工作台

### 4.1 页面骨架

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 编辑态数据包 / ModId / Version    来源  状态  保存草稿  Apply / 导出 │
├──────────────────────┬──────────────────────────┬───────────────────┤
│ 内容类型与条目导航    │ 当前 Def 编辑区            │ 检查器 / 影响 / 差异 │
│ 类型 Switch            │ 标题 / 来源 / Draft 状态  │ 引用关系            │
│ 搜索 / 筛选            │ 左侧页签 + 右侧字段      │ 诊断问题            │
│ 新建 / 复制 / 删除     │ 子集合摘要行              │ Runtime 投影        │
└──────────────────────┴──────────────────────────┴───────────────────┘
```

- 顶部只承载当前编辑态目标、来源、Revision、草稿状态、保存和 Apply；不承载复杂字段。
- 左栏是内容类型与当前表条目浏览器；“正在查看哪个条目”和“新建写入哪个数据包”必须分开显示。
- 中栏是单个 Def 的编辑器。标量字段按页签呈现，集合字段显示摘要行，复杂对象进入受控子编辑器。
- 右栏是检查器，展示来源层、引用关系、受影响 Runtime 子系统、当前值 / Draft 值 / Apply 值差异和问题定位。
- 关闭工作台只隐藏 UI，不清除编辑态 Draft；放弃编辑才清除 Draft。
- Apply 成功后保留内容类型、选中条目、当前页签和诊断结果，不能强制回退到总入口。

### 4.2 Def 编辑页通用页签

不是每个 Def 都必须拥有全部页签，但页签语义固定，不为每类 Def 发明全新信息架构。

| 页签 | 内容 | 默认写入等级 |
| --- | --- | --- |
| 概览 | 名称、类型、来源、归属、引用计数、当前 Runtime 状态 | R1 |
| 基础 | ID 局部名、名称、描述、枚举、稳定基础值 | D1 |
| 归属 / 范围 | Init、Area、owner、global、作用域、生命周期 | D1 或只读，取决于状态分层 |
| 引用 | 单引用、引用列表、反向引用、未知引用诊断 | D1；未知值保留并提示 |
| 逻辑 | Condition、Effect、ValueExpression、Reveal、Trigger | 默认 D1；A1 需单独证明 |
| 集合 | 物品、功能、升级、成员、章节、Entry 等摘要行 | D1；集合子编辑器负责细节 |
| 表现 | Theme、Presentation、背景、头像、颜色、预览 | 默认 R1；安全协议齐备后 D1 |
| 扩展 | Extra、未知字段、原始载荷摘要 | 默认只读；支持 opaque-safe 才允许保留式编辑 |
| 差异 | Source / Draft / Runtime 三方差异、变更路径 | R1 |
| 诊断 | 字段、引用、能力、物化、Runtime 影响问题 | R1；问题必须可定位回页签或摘要行 |

### 4.3 通用描述符

后续实现应让 UI 消费由 Policy 和 Def Registry 派生的描述符，而不是在 `view.ts` 再维护一份类型清单。建议契约如下，实际命名以开工 Task 的源码调查为准：

```ts
interface DefinitionEditorDescriptor {
  key: ContentKey;
  label: string;
  idType: string;
  source: 'policy' | 'readonly-contract';
  capabilities: { browse: boolean; inspect: boolean; draft: boolean; apply: boolean };
  sections: readonly EditorSectionDescriptor[];
  fields: readonly EditorFieldDescriptor[];
  collections: readonly EditorCollectionDescriptor[];
  unsupported: readonly UnsupportedFieldDescriptor[];
  materialization: readonly FieldMaterialization[];
}

interface EditorSectionDescriptor {
  id: string;
  label: string;
  order: number;
}

interface EditorCollectionDescriptor {
  inputKey: string;
  definitionKey: string;
  label: string;
  editorId: string;
  summary: (value: unknown) => { type: string; note: string };
  canAdd: boolean;
  canEdit: boolean;
  canRemove: boolean;
  canReorder: boolean;
}
```

约束：

- `sections` 从 Policy 派生；UI 不复制页签清单。
- `fields` 只描述标量与已经登记的可写字段；未知 Def 字段进入 `unsupported`，不能默默丢弃。
- `collections` 只声明子编辑器能力，不把子对象字段平铺到父表单。
- `summary` 必须能从当前值产生稳定摘要；摘要不得依赖当前 PlayerState 的偶然数值。
- 描述符必须能回答“为什么只读”：未授权、无消费者、存在不透明字段、需要 reload、引用缺失、目标来源不支持等原因不能只显示 disabled。

## 5. 通用字段与子编辑器需求

### 5.1 标量与引用

| 控件 | 适用 | 需求 |
| --- | --- | --- |
| ID 局部名 | 所有三段式实体 | 只编辑最后一段；实时检查小写字母、数字、`_`、`-`；完整 ID 在旁边显示且不可手改 |
| 文本 / 多行文本 | name、description、openingTitle 等 | 显示是否为空、长度和揭示级别影响；不得把描述文本当作逻辑条件 |
| 数值 | maxLevel、weight、cost 等 | 区分整数、非负数、有限数、常量表达式；显示单位与运行时解释 |
| 枚举 | kind、rarity、school、mode、visibility 等 | 显示中文说明、原始值、影响范围和不可逆变更提示 |
| 单引用 | Init、Area、Spot、Story、Item 等 | 下拉 / 搜索候选来自 Registry 或编辑态 Draft；未知当前值保留为红色诊断，不自动替换 |
| 引用列表 | defaultAreas、members、tags、gachaPools 等 | 支持排序、重复检查、移除和反向影响预览；列表为空的语义必须明确区分“未配置”和“显式为空” |
| Boolean | global、autoApply、repeatable 等 | 说明状态分层或运行时影响；对不可逆字段显示确认文案 |

### 5.2 成本与支付方案

统一使用 `PaymentOptionDef` / `CostItem` 语义：同一方案内 `costs` 是 AND，多方案是 OR。

- 父级只显示“方案数量 / 最便宜方案摘要 / 是否有条件”；详细成本进入 `payment-options` 子编辑器。
- Resource 与 Item 使用不同候选和整数约束；不把动态 `ValueExpression` 冻结成当前数值。
- 方案 ID 是稳定键，不能以数组位置代替；改名等价于删除旧方案并新增新方案，已有购买记录时必须阻断。
- 空列表只有在该字段支持显式空语义时才保留；否则区分“缺省回退”和“明确免费”。

### 5.3 Condition / Reveal / Trigger

统一 `condition-tree` 子编辑器，不为每类 Def 复制 AND / OR 逻辑。

- 根节点允许 `AND` / `OR`；单项不额外包装；空 AND 与空 OR 的求值语义必须在 UI 中显示。
- 条件叶子按 `ConditionTarget` 分派字段、候选、摘要和校验；未知 target 保留原始结构并阻断 Apply。
- 递归深度默认最多 4 层、单组最多 8 项；超过上限只能查看并提示改用独立数据包编辑器。
- Reveal 是“信息阶段 / 访问阶段”的声明，不得在编辑器中合并成一个“解锁”开关。
- Trigger 需要同时展示事件 kind、条件、once / maxRuns、effects 与所属事件目录；新增事件前必须登记 `EVENT_CATALOG`。

### 5.4 Effect / ValueExpression

- Effect 编辑器先选 `op`，再显示该 op 的 target、value、资源 / 物品 / 实体引用字段。
- `DECLARATIVE_EFFECT_OPS`、状态写入 Effect、演出请求 Effect 必须在 UI 上分组，避免作者误以为所有 Effect 都可在当前 Runtime 立即执行。
- ValueExpression 采用有限树编辑器：常量、Value source、有限算术运算和 clamp；超过层数只读。
- 每个 Effect 摘要必须包含 op、target 和关键值；不得只显示“效果 1”。
- 演出类 Effect 的保存与运行时执行不是同一件事；未接通宿主的 Effect 只能 D1 / export，不能 A1。

### 5.5 Theme / Presentation

Theme 与 `EntityPresentationDef` 必须分为两个层面：Theme 负责主题层 / 背景 / token，Presentation 负责 name、description、theme 的实体表现选项。

- 第一阶段先做来源、继承、预览和回退诊断；不开放任意 CSS、DOM 选择器、脚本或未登记图片地址。
- 背景图片只能使用 PicQuery 或受控直链；透明度、位置、尺寸、repeat、blend、rotation 等字段走白名单。
- 预览层不能写 PlayerState，取消、异常和切换实体必须清理预览层。
- `default / equipment / design / custom` 是实体主题槽，不得把默认主题误写成 custom 持久化值。
- Presentation additions 只在所属实体内稳定唯一；不能把它做成跨实体全局表而改变现有契约。

### 5.6 Extra / opaque 字段

- Extra 树使用现有 tagged union 与深度 / key 校验；编辑器不接受任意 JSON 直接写入。
- 全局 `extras` 的扁平路径与 Def 内 `extra` 的树形内容分开显示，避免作者混淆 Registry 合并层和实体本地扩展。
- 首版默认只读；若开放必须支持结构化 round-trip、深度上限、未知节点保留和修改路径诊断。
- 已有 Def 含未支持 `extra` 时，若不能证明无损保留，替换操作直接阻断。

## 6. 各类 Def 的设计需求

下面的“首期能力”是设计优先级，不是当前已经实现的能力承诺。

### 6.1 世界与运行时入口

#### InitDef / `inits`

首期页签：概览、基础、默认区域、购买 / 揭示、标签、诊断、差异。

- 基础：ID、名称、描述、起始剧情、worldTilt 与展示别名。
- 默认区域：有序引用列表；支持候选搜索、当前 Draft Area、上移 / 下移 / 移除；空列表合法但必须警告。
- 购买：ResourceAmount 只编辑有限常量资源方案；动态条件或未支持字段只读。
- 揭示：RevealTrigger 摘要行 + 条件树子编辑器。
- 当前 `enterEffects`、`triggers`、`theme`、`presentation`、`extra` 首期默认只读；已有对象存在这些字段时，替换必须阻断或使用明确 opaque-safe 回写。
- Apply 前显示：默认区域不存在、Area 归属不一致、起始剧情不是可用入口、当前 Init / Area / 快照受影响等问题。
- Runtime 语义：替换不重复播放一次性进入效果；删除当前 Init 后清除悬空位置并回到 Init 选择；不清资源、不清 Spot 进度、不改 defaultAreas 为当前运行区域。

#### AreaDef / `areas`

首期页签：概览、基础、所属 Init、默认设施、拓扑、揭示、标签、诊断。

- 默认设施是有序 Spot 引用；明确区分“列表为空”和“未配置”。
- 静态 `adjacentAreaIds` 与 Runtime 拓扑 Overlay 分开：编辑器编辑静态 Def 时不能伪造当前 Runtime 连接。
- 拓扑子编辑器显示 oneWay / twoWay、目标 Area、同 Init 约束和反向影响。
- 当前 `enterEffects`、`theme`、`presentation`、`extra` 首期只读；跨 Init 搬迁不是普通字段编辑。
- Apply 前校验 Init 归属、默认 Spot 存在、邻接目标存在且同 Init、删除反向引用和当前位置兜底。
- Area 删除不能留下 Spot 的悬空 `areaId`；若无法同批次处理引用，必须阻断。

#### SpotDef / `spots`

Spot 是当前最完整的层级样例，继续作为通用编辑器的回归样板。

- L1：名称、描述、Area、maxLevel、conditionText、global。
- L2：purchaseOptions、functionalities、levelUpgrades、revealTriggers、tags、gachaPools。
- L3 / L4：ConditionGroup、Effect、ValueExpression、Extra。
- `functionalities` 按 flow、linearYield、restartInit、hardResetInit、gacha、shop 分派；父级只显示 kind + 摘要。
- `levelUpgrades` 显示等级、支付方案数、条件和效果数；支付与 Effect 进入子弹窗。
- `revealTriggers` 显示目标与条件摘要；修改后必须触发 Visibility 索引刷新。
- `theme`、`presentation`、`colorGroupId`、`extra` 首期继续只读，除非各自物化台账与回归链完成。
- Spot 的所有修改必须保留 revision、所有权检查、Registry receipt、Affector / GameNum / Visibility / 服务投影同步与失败回滚。

#### EnhancementDef / `enhancements`

Enhancement 是“策略已有、运行时 Apply 风险高”的代表，不得因 UI 可渲染就开放完整写入。

首期可设计：名称、描述、autoApply、maxStacks、irreversible、attachment、price、tags、revealTriggers。

首期只读 / 阻断：effects、addsFunctionalities、affectorPackIds、theme、presentation、extra。

- 归属切换必须显示 global / Init / Area 的状态层影响；已拥有或不可逆强化默认阻断归属变更。
- Effects 与附加功能需要 Candidate Datapack + reloadPreservingState 或独立安全 mutation；不能套用 Spot 局部 mutation。
- Apply 前显示影响到的 Init、Area、Spot、Affector、Visibility 与玩家已拥有状态。
- A1 的前提是 reload 事务可验证“旧 Runtime 保持不变 / 新 Runtime 完整投影 / 失败恢复旧状态”。

### 6.2 剧情与事件

#### StoryDef / `stories`

StoryDef 是演出本体，StoryEntry 是进入资格与完成规则，必须分成两个编辑器，不把二者合为一张“剧情表”。

- Story 编辑器：名称、Talklet 顺序、说话人、文本、头像 / 图片、side、align、typing / thinking、clickWork、choices、effects、goto / insert、kizuna。
- Talklet 父级显示 `[talk] / [choice] / [effect]` 摘要；完整内容进入 Talklet 子编辑器。
- 预览必须是只读 Story sandbox，不推进正式 Story cursor、不写 storyLog、不发奖励。
- goto / insert 必须做跳转目标存在性、深度上限和返回栈诊断。
- 当前 Runtime Editor 首期只做 R0 / R1；完整 Talklet Apply 需要 StoryService、StoryCursor、奖励和演出事件链的端到端回归。

#### ActiveStoryEntry / `activeStories`

- 编辑 availableInits、triggerCondition、revealTriggers、replayable、completionStrategy、conditionalRewards、branchGuards、openingTitle、owner。
- StoryId 是真引用；StoryEntry 与 StoryDef 不能只依赖“当前恰好同 ID”的约定，编辑器必须显示本体解析结果。
- 完成奖励按 first / repeat 分组，条件奖励按声明顺序显示。
- branchGuard 需要显示前置 Story / Talklet 阅读日志要求，未知目标阻断 Apply。

#### PassiveStoryEntry / `passiveStories`

- 在 ActiveStoryEntry 基础上增加 repeatable、weight、affectionRequired、pushAfterStory、cooldownFrames、block、interruptible、leaveArea。
- 采用“候选资格 / 池权重 / 冷却 / 阻断 / 完成奖励”五组页签，避免把调度语义藏在一个条件列表里。
- weight 只影响当前池选择，不在编辑器中承诺全局概率；显示所属 Pool 反向关系。
- cooldown、studentBlocks、completionKey 等运行时状态不进入 Def 编辑器。

#### PassivePoolDef / `passivePools`

- 以树编辑器呈现 children：Entry 或子 Pool；父级显示权重、条件、owner、cooldown。
- 必须检测循环、孤儿 Entry、重复 child、空池和跨 owner 引用。
- 提供“当前可用候选模拟”只读预览，但模拟结果不写入冷却、不改变随机种子、不启动剧情。

#### TriggerDef / `triggerDefs`

- 以事件 kind → 条件 → once / maxRuns → effects 的顺序编辑。
- UI 必须从事件目录生成候选；新 kind 未登记 `EVENT_CATALOG` 时不能保存为可 Apply Def。
- 明确展示声明类、状态类、演出类 Effect 的不同执行边界。
- Trigger 的匿名 ID、完成记录和挂载组由引擎派生；编辑器显示派生身份但不让用户手填。

### 6.3 物品、掉落、商店与效果

#### ItemDef / `items`

首期页签：基础、使用、掉落 / 售价、揭示、Affector、扩展、诊断。

- 基础：名称、描述、icon、maxStack、rarity、type。
- 使用：useCondition、useEffects；拾取：pickupEffects；出售：sellPrice。
- `affectorPackIds` 显示引用包与能力摘要；不把 AffectorPack 内联复制到 Item。
- effect / condition / reveal 使用共享子编辑器；未知 Effect 或 opaque extra 阻断 A1。
- Item 的库存和购买记录属于 PlayerState / Shop 事实，不能在 Item 编辑器中修改。

#### DropTableDef / `dropTables`

- 入口条件、maxRolls、guaranteed、weighted entries 分三块编辑。
- 每个 entry 显示 item、min / max、weight、局部 condition；校验 min ≤ max、非负整数和权重有限。
- 提供“期望候选 / 保底结构”只读计算，不伪造一次实际掉落。
- 删除 Item 时必须反向检查 DropTable、Shop、Story reward、Trigger reward；不能只改 Item 表。

#### ShopDef / `shops`

- Shop 本体与 ShopEntry 分层；分区、商店条件、主题、条目集合分别编辑。
- ShopEntry 编辑 offer、unitCosts、condition、revealTriggers、visibility、stock、purchase policy、onPurchase。
- `onPurchase` 只能接受 transaction-safe 子集；超出子集时显示“可导出但不可 Runtime Apply”。
- 已产生购买记录的条目，id、offer 类型和 scope 变更必须显示高风险影响并默认阻断。
- 预览使用 ShopService 的 read-only checkout / availability projection，不在编辑器中自算支付和库存。

#### AffectorPackDef / `affectorPacks`

- Pack → Entry → condition / effects / perTickEffects / flows / zoneModifiers / areaConnections / capabilities 三层编辑。
- Entry 的 `id` 是稳定身份；已有挂载实例时改名等同于删除 + 新增，必须显示影响。
- flow、Effect、Zone modifier、Area connection 使用不同摘要和子编辑器，不能合并成“效果列表”。
- capabilities（如 `user-theme.editor`）必须显示权限影响和来源；新增服务能力需有服务端消费与事件测试。
- 任意 Affector 修改都必须有 mount reconcile、GameNum / Visibility / AreaConnectivity 影响预览；缺少必要 Projection 时只能 D1 / export。

### 6.4 角色、养成、色彩与招募

#### CharacterData / `characters`

- 编辑原型身份、name / displayName、school、rarity、description、tags、bond、extra。
- CharacterData 不显示玩家拥有、好感、等级、碎片等 State；右栏只读显示当前消费方。
- `bond.milestones` 以门槛 + Effect 摘要行编辑；A1 需等里程碑效果消费端接通。

#### CharacterVariantDef / `characterVariants`

- 编辑 proto、name / displayName、school、rarity、description、avatar、colorGroup、default、curve、affection cap、progression。
- proto、curve、colorGroup、avatar 使用引用候选；显示原型 / 差分 / 玩家 VariantProgress 的边界。
- `progression` 下的 skills、gearSlots、favoriteItem、uniqueWeapon、initialTraits 使用分层子编辑器。
- 不在 Variant 编辑器中写等级、经验、星级、好感、装备当前 tier 或已拥有状态。

#### CultivateCurveDef / `cultivateCurves`

- 编辑 maxLevel、expTable、starMax、starCost、levelBonusPerLevel。
- 提供曲线图 / 阶梯表预览；校验经验单调、长度与 maxLevel 一致、starCost 可解释。
- 曲线变更应显示被哪些 Variant 引用；已有玩家进度不迁移，Apply 前必须确认结构变更风险。

#### GearDef / `gears` 与 GearConfigDef / `gearConfig`

- GearDef：slot、名称、tiers；Tier：levelCap、baseLevel、expPerLevel、upgradeCost、baseEffects、perLevelEffects。
- GearConfig：经验材料映射与通用 levelCost，作为 singleton 单独编辑，不伪装成普通 Gear 行。
- Gear 编辑器显示三槽固定约束、tier 替换而非叠加、当前效果消费状态。
- 当前效果若仍是声明但无运行时消费方，只允许 D1 / export，不在 UI 中显示“已生效”。

#### FavoriteItemDef / `favoriteItems`、UniqueWeaponDef / `uniqueWeapons`、TraitDef / `traits`

- 三者使用独立类型页签，不做一个泛化“角色养成效果”表。
- Favorite / UniqueWeapon 编辑 owner、阶段 / 星级、cost、effects；Trait 编辑 learn / abandon 条件、effects 与名称。
- owner 引用必须指向已有 Variant；删除 owner 时给出反向阻断。
- 因当前部分消费端属于 B 段或仍是声明，占位编辑器首期只做 R0 / R1 + 结构校验；A1 另立角色成长 Task。

#### ColorGroupDef / `colorGroups`

- 编辑 compositionType、slots、theme token、unlock 条件；提供 solid / gradient / duotone / pie / radial 预览。
- slot role 与数量按 CompositionType 校验；颜色值走安全颜色解析，不接受任意 CSS。
- 主题 token 与头像调色板分开显示；不要把 `primary` 当成唯一颜色字段。

#### ColorEquipmentDef / `colorEquipments` 与 ThemeDesignDef / `themeDesigns`

- ColorEquipment：colorGroup、effects、theme、unlock、category；显示装备如何影响角色 Variant 与 ColorGroup 解锁。
- ThemeDesign：entityKey、theme、unlock；显示绑定的实体、作用域和可用选项。
- 两者均需经过 ColorSystem 解析预览；没有能力授权、解锁消费和撤回策略时只允许 D1 / export。

#### GachaPoolDef / `gachaPools`

- 编辑 mode、currency、costPerPull、rates、featured、pity、dupRewards、members、closeWhen。
- rates 使用权重表而非百分比自由输入；显示归一化结果和成员覆盖关系。
- featured、members 与 Variant 的反向引用可跳转；关闭条件与世界 Pool 合并状态必须只读说明。
- 预览允许固定 RNG / 统计模拟，但不得修改 gachaState、资源或角色拥有状态。

### 6.5 资源、资产、标签与配置

#### PicDef / `pics`

- 编辑资源身份、src、alt、角色、focus、fit、tint、preload 等受控字段。
- 预览必须经 PicQuery / PicResolver；zip 路径、直连 URL、缺图回退分别显示来源。
- 不在编辑器中上传二进制、不把远程 URL 当作安全白名单、不把预览 URL 写回其他 Def。

#### CharaProfileDef / `charaProfiles`

- 编辑 Character 关联、名称表、头像表、activeName / activeAvatar。
- 显示 declared / player override / proto fallback 来源；不能把玩家覆盖写入 Datapack。
- 删除头像必须检测 activeAvatar 与角色 Variant / Story 引用。

#### ResourceDisplayDef / `resourceDisplays`

- 编辑 resource、label、icon、order、显示条件 / hasAmount 等 UI 投影字段。
- 只影响显示，不编辑资源余额、生产或统计；提供列表排序和缺失资源诊断。

#### TagDef / `tags`

- 编辑层级 Tag 身份、parent、名称、简介和表现字段；TagPath 与三段式实体 ID 分开显示。
- 检查父级循环、跨 Mod 命名空间、父前缀匹配和引用计数。
- Tag 定义变化可能影响 Condition、Stats、GameNum 和 UI；没有完整失效链时只读。

#### FuncletDef / `funcletDefs`

- 首期只读检查与参数 / 返回值摘要；提供 ValueSystem 消费方、未知回落和恒 0 风险提示。
- 只有 Funclet 注册、参数注入、求值测试和 Schema 协议齐备后才开放 D1。

#### 全局 `extras`、`characterPersistConfig`、`affectionConfig`

- 作为 singleton 页面，不进入普通数组表；顶部明确显示“全局配置”。
- `characterPersistConfig` 改动会影响 per-Init 清除 / 恢复，必须显示所有字段的生命周期影响。
- `affectionConfig` 改动会影响等级上限、曲线与 Variant 进度解释，首期只做表格 / 曲线检查。
- `extras` 提供路径树、来源层和冲突合并预览；不允许把运行时 PlayerState.extras 当成 Datapack 草稿。

## 7. 依赖顺序与跨表影响

### 7.1 推荐施工顺序

```text
Editor Workspace / Target Pack / Draft / Diagnostics
        ↓
ID、引用、标量与集合通用控件
        ↓
Init → Area → Spot → Enhancement
        ↓
Condition / Reveal / Effect / Payment / Value 子编辑器
        ↓
Item / DropTable / Shop / GachaPool
        ↓
StoryDef / StoryEntry / PassivePool / Trigger
        ↓
Character / Variant / Cultivate / Gear / Color
        ↓
Affector / Theme / Presentation / Pic / CharaProfile
        ↓
Funclet / Extra / singleton 配置 / 全量 Candidate Apply
```

顺序不是 Datapack 加载顺序的机械复制，而是为了先建立可复用控件、诊断和物化证明，再扩大写入范围。

### 7.2 删除与变更影响矩阵

| 目标变更 | 必查反向引用 | 必查 Runtime 投影 |
| --- | --- | --- |
| Init 删除 / ID 变更 | Area、Spot、StoryEntry、Enhancement、Snapshot | activeInit、currentArea、Init Trigger、Visibility、per-Init 状态 |
| Area 删除 / Init 变更 | Spot、Init.defaultAreas、邻接拓扑、Theme / Presentation | 当前 Area、AreaConnectivity、Spot index、Visibility |
| Spot 删除 / Area 变更 | Area.defaultSpots、Enhancement functionality、Shop / Gacha 入口 | PlayerState Spot、Affector mount、GameNum、Visibility、Spot service |
| Item 删除 | DropTable、Shop、Story / Trigger / Effect reward、库存残留 | Item registry、库存 UI、Loot / Shop 查询 |
| Variant 删除 | GachaPool、CharacterData proto、Gear / Favorite / Weapon / Trait owner、Story owner | Roster、gachaState、CharacterMemory、Color unlock |
| Story 删除 | StoryEntry、goto / insert、startStory、BranchGuard、Kizuna | Story cursor、completion / read logs、PassivePool |
| Color / Theme 删除 | Variant、Equipment、ThemeDesign、EntityPresentation | ColorSystem、UI theme、avatar renderer |
| Affector 删除 | Item、Enhancement、Spot functionality、mount state | AffectorEngine、GameNum、AreaConnectivity、Service capability |

删除策略：能自动迁移引用时必须展示迁移计划并在同一原子批次提交；不能迁移时阻断删除。不得把引用改成字符串孤儿后再依赖运行时回退。

### 7.3 并行施工版：分层、分域、分阶段

本 Task 采用“一个统领、一个共享契约线、多个 Def 域线、一个集成验收线”的协作模型。并行的前提不是让多个 agent 同时修改同一套基础文件，而是先冻结跨域契约，再按 Def 域划分不相交写集。任何共享文件、生成产物、跨域 Apply 或 AOCI 收尾都必须回到统领 / 集成线串行处理。

#### 7.3.1 Agent 角色与责任边界

| Agent 线 | 负责范围 | 可以独立产出 | 不得擅自修改 |
| --- | --- | --- | --- |
| `lead-contract` | Workspace、Descriptor、Capability、Diagnostic、Diff、Apply Receipt 的共同契约 | 契约草案、状态机、字段语义、共享测试夹具 | 各 Def 域 Policy、生成 Schema、其他 agent 的域实现 |
| `dsl-editor` | Condition、Reveal、Trigger、Effect、ValueExpression、Payment 子编辑器 | 子编辑器协议、节点摘要、递归 / 未知节点规则、DSL 测试 | Def 域字段白名单、Runtime 宿主实现 |
| `world-domain` | Init、Area、Spot、Enhancement | 世界域 Policy、域描述符、引用 / 删除影响、域测试 | 共享 `view.ts`、共享 Policy 类型、其他 Def 域 |
| `economy-domain` | Item、DropTable、Shop、GachaPool | 经济域 Policy、支付 / 奖励 / 反向引用设计、域测试 | Story、Character、共享支付协议 |
| `story-domain` | Story、ActiveStoryEntry、PassiveStoryEntry、PassivePool、Trigger | 剧情域描述符、sandbox 预览边界、域诊断与测试 | StoryService 运行时机制、共享 DSL 契约 |
| `character-domain` | Character、Variant、CultivateCurve、Gear、Favorite、UniqueWeapon、Trait | 角色养成域字段台账、曲线 / 阶段子编辑器、域测试 | PlayerState、Roster、共享 Effect 运行时 |
| `presentation-domain` | ColorGroup、ColorEquipment、ThemeDesign、Theme、Presentation、Pic、CharaProfile、ResourceDisplay、Tag | 表现与资产域描述符、受控预览、资源来源诊断、域测试 | 二进制资源、主题运行时宿主、全局 UI 基础层 |
| `effect-config-domain` | AffectorPack、Funclet、Extra、characterPersistConfig、affectionConfig 及其他 singleton | 效果 / 配置域能力矩阵、只读 / 导出-only 边界、域测试 | StateMutationService、运行时 Effect 宿主 |
| `integration-qa` | 合并、跨域引用、Candidate Apply、导出再解析、全量回归 | 集成补丁、影响计划、回滚证据、最终验收报告 | 在域线尚未交付前替代其设计结论 |

角色可以由同一 agent 在不同波次承担，但“统领 / 共享契约”和“集成验收”不能同时由多个 agent 认领。域线负责证据和局部实现，统领负责取舍、冲突裁定和最终 Task 状态。

当前源码仍处于集中式实现阶段，不能跳过共享内核拆分直接启动多域代码并行：`state.ts` 固定四类 Draft 数组，`view.ts` 固定内容类型标签与 Spot 分支，`actions.ts` 固定定义类型事件路由，`content-policies.ts` 集中登记当前所有 Policy。因此，域线可以提前并行做事实盘点、字段矩阵、反向引用和测试设计，但在 K0 合并前不得直接修改共享入口或声称域实现已可并行合并。

共享内核 K0 的独占写集至少包括：

- `src/ui/runtime-editor/state.ts`、`view.ts`、`actions.ts`、`form.ts`、`sections.ts`、`reference-options.ts`、`collection-prototypes.ts`、`collections.ts`、`subdialog.ts`、`persistence.ts`、`index.ts`、`config.ts`；
- `src/data-services/authoring/content-policy-types.ts`、`content-policy.ts`、`content-policy-dsl.ts`；
- `src/arona-clicker/contracts/runtime.ts`、`runtime-content.ts` 及对应共享 UI / authoring 测试；
- 必要时新增 `src/data-services/authoring/policies/` 与 `src/ui/runtime-editor/domains/` 作为按域扩展点。

K0 的完成条件是：共享 UI 不再新增 Def 类型分支，描述符 / Policy / Diagnostic / Draft 状态有稳定注册协议，域线可以只新增自己的域文件。K0 之前，域线只提交 Domain Packet；K0 之后，域线才进入 D1 / A1 的代码施工波次。

#### 7.3.2 写集隔离与合并规则

每个 agent 启动前必须收到 `baseline`、`readSet`、`allowedFiles`、`forbiddenFiles` 和 `doneWhen`。并行 agent 默认使用独立 worktree / 分支；禁止多个 agent 在同一工作树直接写文件。

当前仓库已有用户修改和未跟踪文件，因此正式启动 coding agent 前，统领必须先建立一个可识别的 Baseline Receipt：记录当前工作树状态、纳入本轮的已有修改、明确不属于本轮的修改，并从该基线派生独立 worktree。不得通过清理、重置或覆盖脏工作树来制造“干净起点”；也不得从默认分支假设当前 Runtime Editor 基线已经存在。

共享写集必须集中到 `lead-contract` 或 `integration-qa`：

- `src/ui/runtime-editor/sections.ts`、`view.ts`、`state.ts`、`actions.ts`、`form.ts`、`config.ts`、`subdialog.ts` 等现有共享入口只能由共享契约线或集成线修改。
- `src/data-services/authoring/content-policy-types.ts`、`content-policy.ts`、`content-policy-dsl.ts` 等协议文件只能由共享契约线修改；各域线提交字段清单和补丁建议，不直接争抢同一中央文件。
- `src/data-services/authoring/content-policies.ts` 当前包含多类 Policy，不能让多个域线同时编辑。优先拆为按域定义、中央聚合的结构；若本阶段不拆文件，则由集成线按域补丁顺序串行合并。
- `docs/plan-work/00-index.md`、本 Task、共享测试夹具、集成测试和任何生成 Schema 只由统领 / 集成线更新。
- `src/engine/types/**` 的字段或枚举变更必须集中到明确的 Schema 责任人；完成后由集成线统一执行 `npm run gen:schema`，不得由域线手改生成结果。
- 域线只能修改分配给自己的域描述符、域 Policy 适配层、域子编辑器、域测试和自己的设计证据；发现必须触碰共享文件时，提交“共享变更请求”，不要绕过边界直接修改。

合并顺序固定为：

```text
共享契约 / 诊断状态
        ↓
DSL 子编辑器协议与安全边界
        ↓
各 Def 域适配器与域测试（可并行合并）
        ↓
跨域引用、删除计划、Candidate Apply
        ↓
Schema / 构建 / 全量测试 / 浏览器与导出验收
        ↓
AOCI Maintain 与 Task 收尾
```

合并每个域线后先运行该域的最小测试集；所有域线合并完成后再运行跨域测试。合并冲突不得由 agent 通过“保留两份逻辑”解决，必须由统领根据当前源码事实裁定唯一契约。

#### 7.3.3 波次与关键路径

| 波次 | 串行阻塞项 | 可并行工作 | 退出门禁 |
| --- | --- | --- | --- |
| P0 基线 | 统领确认当前源码、Policy、运行时消费者、脏工作树边界 | 各域只读事实盘点、反向引用盘点 | 形成统一 Baseline Receipt；没有把历史文档当现状 |
| P1 共同契约 | `lead-contract` 冻结 Descriptor、Capability、Diagnostic、Draft / Apply 状态 | 所有域线按模板提交字段与影响台账；`dsl-editor` 盘点已有 DSL 能力 | Contract v1：域线可以只依赖稳定接口，不再复制 UI 类型清单 |
| K0 共享内核 | `state.ts`、`view.ts`、`actions.ts`、中央 Policy 和共享契约拆为描述符 / 注册点 | 各域只读完成 Domain Packet；不得提交域代码到集中入口 | 共享入口不再新增 Def 类型分支；域线拥有独立扩展点 |
| P2 共享控件 | 共享字段、引用、集合、摘要、问题定位接口 | `dsl-editor` 实现子编辑器；各域线只新增自己的域文件和测试 | 每个域能独立构建、校验和输出未闭合项；不宣称跨域 Apply 已完成 |
| P3 域并行 | 仅处理共享契约回归，不再扩展共享 API | world / economy / story / character / presentation / effect-config 六条域线并行施工 | 每条域线交付 Domain Packet，包含测试、阻断项和写集证明 |
| P4 集成 | 集成线串行处理中央聚合、跨域引用、删除计划、Apply / Projection | 域线只修复自己被指出的局部问题，不重写共享架构 | 集成测试、导出再解析、回滚证据齐备 |
| P5 全量验收 | 全量命令、浏览器验收、AOCI Maintain | 只允许并行读取日志和复核结果，不允许新增功能 | Task 达到最终稳定状态后再归档 / 更新索引 |

可以并行的是同一波次中拥有独立事实范围和独立写集的工作；以下情况必须降级为串行：

- 修改同一个 Policy 中央聚合文件、共享 Editor State、共享表单分派或共享测试夹具；
- 修改 `Datapack` / Engine schema、事件目录、Effect 宿主或 StateMutationService；
- 改变某个跨域引用的身份语义、Apply 事务边界、reload 策略或回滚协议；
- 需要同时改变两个 Def 域的删除迁移、运行时 Projection 或存档 / per-Init 生命周期；
- 任何 agent 无法证明未知字段、动态表达式和已有运行时状态可以安全保留时。

#### 7.3.4 域线交付包（Domain Packet）

每个域线必须交付一份独立的 `Domain Packet`，不以“代码已经能显示”为完成标准。交付包至少包含：

```text
domainKey / baselineCommit / agent
Required Read Set 与实际读取范围
Def 清单与字段级能力矩阵（R0 / R1 / D1 / A1、opaque-safe、runtime-ready）
Editor Sections、Collection、Child Editor 和摘要协议
Policy / Descriptor / materialization / consumer / invalidation 台账
反向引用、删除阻断、跨 owner 与未知引用规则
Allowed Files、实际改动文件、未改动但需要集成的共享文件
最小测试集、拒绝边界、round-trip、失败回滚证据
未决问题、阻断项、需要统领裁定的冲突
建议合并顺序与集成后的影响范围
```

为便于统领机器化收集，交付包应至少能映射到以下字段；字段缺失时只能标记 `partial`，不能标记 `passed`：

```text
packetVersion: def-editor-delivery/1
agentId / packageId / baseRevision / contractRevision
scope / ownedPaths / ownedSymbols / touchedPaths
status: passed | blocked | partial
confirmedFacts[]: factId / claim / sourcePath / sourceSymbol / status
capabilityMatrix[]: table / defKind / level / opaqueSafe / runtimeReady
materialization[]: consumer / invalidation / projection / blockingReason
changeSummary / explicitNonGoals / crossAgentDependencies / schemaImpact
verification[]: command / result / testCase / evidence
runtimeEvidence[]: preimage / draft / applied / projection / receipt / rollback
openIssues[]: blockerCode / affectedPath / owner / nextAction
```

事实与证据 ID 统一采用域前缀，避免不同 agent 对同一问题重新编号：

- `F-<domain>-nnn`：源码、测试或当前机制文档确认的事实；
- `D-<domain>-nnn`：本包新增的设计决定；
- `T-<domain>-nnn`：测试与静态检查证据；
- `R-<domain>-nnn`：Prepare / Apply / Projection / Rollback 证据；
- `B-<domain>-nnn`：阻断、冲突或需要统领裁定的问题。

每个域线至少通过四层检查：

1. 数据语义：Policy validate、encode / decode、Draft round-trip、未知字段与 opaque 阻断；
2. 编辑器状态：hydrate、clone、stash、页签切换、集合子编辑器、目标 `packRecordId`、诊断定位；
3. Runtime 事务：revision / ownership、Prepare、Apply、Projection、Receipt、Rollback；
4. 域回归：该域既有机制、反向引用、删除阻断和不误写 PlayerState。

最终集成线追加类型检查、架构检查、Schema 同步、全量测试、构建、Edge 浏览器验收、导出 ZIP 再解析和全量 Content Browser 覆盖率检查。

交付包中的“未决问题”必须分类为 `design-blocked`、`runtime-blocked`、`shared-contract-blocked`、`test-blocked` 或 `external-input-blocked`。未决项不能通过降低校验、吞掉未知字段或把 A1 改名为“保存”来消除。

#### 7.3.5 防重复与防漂移规则

- 统领先发布域任务卡和 Read Set；域线不得重复调查其他域的完整实现，只读取其契约和引用摘要。
- 每个域只维护自己的字段矩阵；跨域引用只维护“引用方 / 被引用方 / 变更影响”，不复制对方字段定义。
- 共享契约变更必须带版本号和迁移说明；契约冻结后，新增字段先进入下一版，不在域线内部偷偷扩展。
- agent 发现当前源码与总纲不一致时，先记录事实冲突和证据路径，再请求统领裁定；不能直接按规划文档覆盖源码现实。
- 同一问题只允许一个 owner；其他 agent 只引用问题编号，不另建同义诊断、同义测试或同义 Policy。
- 任何域线发现需要修改另一个域的文件时，提交跨域影响请求；只有被影响域 owner 和统领共同确认后才进入集成补丁。

#### 7.3.6 集成与回滚门禁

集成线按“契约 → 子编辑器 → 域适配 → 跨域 Apply”逐步合并。每次合并都保留：

1. 合并前 baseline 与合并后 revision；
2. 受影响的 Policy / Descriptor / Runtime Projection 列表；
3. 通过的最小测试集和未运行的测试集；
4. 失败时可回退到上一稳定批次的证据；
5. 是否改变了 A1、reload、opaque-safe 或删除阻断判定。

出现下列情况时必须立即阻断当前 package，并保留现场：

- 需要修改 `Allowed Files` / `ownedSymbols` 之外的路径或公共符号；
- 源码事实与 Read Set、Task 或已发布 `contractRevision` 冲突；
- 复杂结构无法无损 round-trip，或动态表达式被迫折算成常量；
- 缺少消费者、失效触发方、Runtime Projection、明确目标数据包或回滚证据；
- stale revision、ownership 不匹配、来源包冲突或第三方脏改动导致 Apply 前提不成立；
- 测试失败原因无法解释，或为了通过测试需要放宽全局安全护栏。

阻断时不得自行改为“只读后悄悄继续”，必须在 `Open Issues` 中注明 owner、证据路径、下一动作和是否可以将该字段降级为 D1 / export-only。集成线可以继续合并其他不受影响的 package，但不允许跨过未解决的共享契约或 Runtime 回滚问题进入全量 Apply。

任何一条域线出现共享契约冲突、测试不确定、未知字段回写风险、Projection 不完整或第三方脏改动，集成线应标记该域为 `blocked`，保留其他域的独立成果继续合并；不能为了让全量流水线变绿而临时放宽全局校验。只有所有域的阻断项清零或被明确裁定为 D1 / export-only 后，才允许进行全量 Apply 验收。

#### 7.3.7 K0 之后的域线写集

K0 合并后，域线应优先新增独立域文件和独立测试，不直接回写中央聚合入口。推荐写集如下；实际开工前仍需根据当前源码重新确认路径，不得把本表当成无需核验的授权：

| 域线 | 推荐独占写集 | 明确锁定的共享范围 |
| --- | --- | --- |
| `world-domain` | 世界 Def contract、世界 Policy adapter、`runtime-editor/domains/world.*`、世界域测试 | `Datapack` 聚合、Registry 总入口、StateMutationService |
| `dsl-editor` | `content-policy-dsl.ts`、DSL 子编辑器与 DSL 专项测试；若 K0 已吸收该协议，则只修改其独立扩展文件 | Engine expression 类型、共享 `view.ts`、中央 Policy 聚合 |
| `economy-domain` | Item / DropTable / Shop / Gacha 的 domain contract、Policy adapter、域 UI、域测试 | Shop / Loot / Gacha 运行时服务、PlayerState、中央聚合 |
| `story-domain` | Story / Entry / PassivePool / Trigger 的 domain contract、Policy adapter、域 UI、域测试 | Story cursor、奖励结算宿主、全局事件目录 |
| `character-domain` | Character / Variant / Curve / Gear / Color 的 domain contract、Policy adapter、域 UI、域测试 | Roster、玩家养成状态、Datapack / Registry 聚合 |
| `presentation-domain` | Theme / Presentation / Pic / Profile / ResourceDisplay / Tag 的 domain contract、Policy adapter、域 UI、域测试 | 二进制资源、主题运行时宿主、全局 UI 基础层 |
| `effect-config-domain` | Affector / Funclet / Extra / singleton 的 domain contract、Policy adapter、域 UI、域测试 | Effect 宿主、StateMutationService、全局 Extra 合并入口 |
| `integration-qa` | 中央 Policy 聚合、`Datapack` 聚合、fragment / pack parser、Registry / definition 聚合、pack export、全量测试 | 所有域线仍在施工时不得提前接管其独立写集 |

以下文件设为文件级锁，不能由多个域线同时修改：`src/ui/runtime-editor/state.ts`、`view.ts`、`actions.ts`、`form.ts`、`sections.ts`、`collections.ts`、`persistence.ts`、`src/data-services/authoring/content-policies.ts`、`src/data-services/contracts/datapack.ts`、`src/data-services/datapack/fragment-parser.ts`、`src/data-services/registry/registry.ts`、`src/data-services/registry/registry-validate.ts`、`src/ui/runtime-editor/pack-export.ts` 及现有共享测试文件。域线需要这些文件的变化时，提交跨域影响请求，由 `integration-qa` 重放语义变更。

#### 7.3.8 平台轨道与域级门禁

原来的 M0–M5 保留为产品路线，但真正施工时还要有一条更短的共享平台关键路径。平台轨道拆为五个节点：

| 节点 | 责任 | 必须冻结的内容 |
| --- | --- | --- |
| `F0` | 事实基线与能力台账 | 当前源码、Policy、状态层、引用语义、local-mutation / reload / export-only 分类、脏工作树 Baseline Receipt |
| `F1` | 通用描述符与诊断契约 | Descriptor、Problem、Diff、Reference Context、能力原因、反向引用 Provider 接口 |
| `F2` | Draft 与 round-trip 容器 | 所有 ContentKey、singleton、`undefined` / 显式空数组、删除 tombstone、Def ↔ Draft 无损边界 |
| `F3` | Apply Adapter | local mutation、candidate reload、Prepare、Projection、Receipt、Rollback 与目标 `packRecordId` |
| `F4` | 影响图 | 反向引用、删除计划、Runtime Projection、跨 Mod / owner / override 冲突 |

`F1` 和 `F2` 未冻结前，Def agent 只能做 R0 / R1 调查和设计；`F3` 未冻结前，任何 agent 都不能把“保存 Draft”描述为 Runtime Apply；`F4` 未冻结前，删除和 ID 变更只能 export-only 或阻断。`F3` 不应全部拖到最终阶段：至少要先完成世界域和当前四类 Policy 所需的最小 Apply Adapter，最终阶段再补全量 Candidate Apply。

域级准出必须独立于其他 Def 域，采用以下门禁：

| 门禁 | 通过条件 | 未通过时的允许状态 |
| --- | --- | --- |
| `G0` 事实与边界 | Def / singleton 清单、能力矩阵、引用语义、共享文件 owner 已确认 | 只读调查 |
| `G1` 平台契约 | Descriptor、Problem、Diff、Reference Context、collection / singleton 容器可测试 | 设计 / R0 / R1 |
| `G2` 提交主链 | Draft → Validate → Prepare → Apply → Projection → Receipt → Rollback 闭合 | D1 / export-only |
| `G3` 共享 DSL | round-trip、深度 / 条数、未知节点 fail-closed、摘要和诊断稳定 | 复杂字段只读 |
| `G4` 域级 D1 | Policy / Descriptor 对齐，Def ↔ Draft、引用、删除诊断和 Draft 保存通过 | R0 / R1 |
| `G5` 域级 A1 | 消费者、失效链、Projection、删除策略、Apply Adapter 和回滚测试齐备 | D1 / export-only |
| `G6` 跨域集成 | 完整 Candidate Registry load、跨表校验、影响计划、导出再解析通过 | 保留独立域成果，阻断全量 Apply |
| `G7` 工程准出 | 类型、全量测试、架构、文档、构建、浏览器和导出验收全部有 Receipt | Task 不得收尾 |

可以直接并行的工作包括 DSL 子编辑器、Pic / ResourceDisplay / CharaProfile 的 R0/R1、CharacterData / CultivateCurve、StoryDef 结构浏览、Item / ColorGroup / Tag 基础字段和 World 域页面描述符。需要前置引用或消费端的工作仍可并行设计，但实现必须等待依赖契约：DropTable 等 Item，Shop 等 Item / Payment，GachaPool 等 CharacterVariant，StoryEntry 等 StoryDef，PassivePool 等 StoryEntry，Variant 等 Character / Curve / Color，Gear / Favorite / Weapon / Trait 等 Variant / Item / Effect，Affector 等 Effect / Condition / World Projection，Trigger 等 `EVENT_CATALOG` 与 Effect 能力矩阵。

`Theme`、`Presentation`、`Extra` 主要是嵌套子结构，不应被并行 agent 伪造为独立顶层表；`gearConfig`、`characterPersistConfig`、`affectionConfig`、全局 `extras` 则必须走 singleton 容器，不能套用 `idName + array` 的 Draft 模型。

#### 7.3.9 第一轮协同开发结果

第一轮采用三个独立写集并行开发，交付物已经落入当前工作树：

| Package | 状态 | 交付物 | 验证 |
| --- | --- | --- | --- |
| `P-core-descriptor` | 已完成 | `definition-descriptor.ts` 与独立测试 | 5/5 专项测试通过 |
| `P-core-diagnostics` | 已完成 | `definition-diagnostics.ts` 与独立测试 | 5/5 专项测试通过 |
| `P-world-policy` | 已完成 | `authoring/policies/world.ts` 与独立测试 | 4/4 专项测试、25/25 Policy 回归通过 |
| `P-dsl-safety` | 已完成 | DSL / Condition 安全边界增强与独立测试 | 8/8 专项测试通过；修复了下拉框默认值误读问题 |

本轮刻意没有修改 `state.ts`、`view.ts`、`actions.ts`、中央 `content-policies.ts`、`Datapack` 聚合、Registry 或 Runtime Apply 入口。上述包属于 K0 / DSL / World 的独立增量，尚未注册进共享 UI 和中央 Policy 聚合，不能据此宣称全量 Def 编辑器或 A1 Apply 已完成。

当前集成状态：四个专项包的合并前测试共 22/22 通过；架构边界检查和文档检查通过。全局 `npx tsc --noEmit` 仍被既有 `runtime-content-browser.ts` / `runtime-content-browser.test.ts` 漂移阻断，后续 K0 集成前必须由集成线单独处理并记录，不得把该问题归因于本轮独立包。

## 8. 诊断与差异要求

所有 Def 编辑器统一输出五类问题：

1. **字段问题**：缺失、格式、范围、枚举、重复键、递归深度；
2. **引用问题**：missing、suspended、wrong type、cross-owner、循环、孤儿；
3. **能力问题**：当前表只读、字段未登记、已有对象包含 opaque 字段、需要 reload；
4. **物化问题**：消费者、失效触发方、必要 Projection、事件目录或 Schema 未闭合；
5. **运行时影响**：当前 Init / Area / Spot、玩家进度、购买记录、Affector mount、Story cursor、主题层或存档快照。

每个问题必须包含：

```text
problemCode
severity: error | warning | info
objectRef / table / defId
sectionId
path
message
nextAction
```

点击问题必须能切换到页签、字段或集合摘要行。Apply 失败保留 Draft、Applied 基线和完整问题列表；不允许用 Toast 覆盖结构化诊断。

## 9. 分阶段施工计划

### M0：总纲与描述符收敛（本 Task）

- [x] 建立全部 Datapack Def / singleton 的分类、编辑等级和依赖台账。
- [x] 固定 Workspace、页签、摘要行、子编辑器、诊断和差异的通用契约。
- [x] 固定“Policy 已登记 ≠ Runtime 已可 Apply”的判断规则。
- [x] 增加 K0 共享内核、域线 ownership、Domain Packet、并行波次和集成回滚门禁。
- [ ] 建立 Baseline Receipt、文件 / 符号 ownership map 与每条域线的 Required Read Set / Allowed Files。
- [ ] 完成 K0：将当前集中式 `state.ts` / `view.ts` / `actions.ts` / Policy 聚合改造成描述符 / 注册点可扩展结构。
- [ ] 完成平台轨道 `F0`–`F4`：事实基线、通用契约、Draft 容器、Apply Adapter、反向影响图。
- [ ] 发布 `G0`–`G3` 共享门禁，使各域可以独立推进 R0 / R1 / D1，而不重复发明提交链。
- [ ] 将当前四类 Policy 的字段、扩展、只读字段和影响矩阵同步成机器可消费的设计表。

### M1：当前四类编辑器准出

- [ ] Init / Area / Spot 共享描述符与字段渲染，不再由 `view.ts` 维护类型分支。
- [ ] 完成 Enhancement 的 Draft / reload / 影响预览边界；未闭合前隐藏 A1 Apply。
- [ ] 四类编辑器均具备来源、目标包、Revision、三方差异和结构化诊断。
- [ ] 通过 Policy round-trip、Definition resolution、Registry mutation / reload、Runtime projection 回归。

### M2：共享 DSL 子编辑器

- [ ] Condition / Reveal / Trigger / Effect / ValueExpression / Payment 统一子编辑器。
- [ ] 完成深度、条数、未知节点、未知引用与安全回退测试。
- [ ] 为每种 EffectOp 建立“可编辑 / 只读 / 仅导出”能力矩阵。

### M3：经济、剧情、事件

- [ ] Item、DropTable、Shop、GachaPool 的 Draft 与导出。
- [ ] StoryDef、Active / Passive Entry、PassivePool、Trigger 的层级编辑与 sandbox 预览。
- [ ] 完成奖励、购买、掉落、抽卡、剧情完成的反向引用诊断。

### M4：角色、养成、色彩

- [ ] CharacterData、Variant、CultivateCurve、Gear、Favorite、UniqueWeapon、Trait。
- [ ] ColorGroup、ColorEquipment、ThemeDesign、CharaProfile。
- [ ] 将声明-only 的 B 段养成字段与真正运行时消费分开显示，禁止误导为已生效。

### M5：效果、表现、配置与全量 Apply

- [ ] AffectorPack、Theme、Presentation、Pic、ResourceDisplay、Tag、Funclet、Extra 和 singleton。
- [ ] 建立完整 Candidate Datapack Apply、影响计划、回滚、导出再解析和启用集冲突检查。
- [ ] 完成全量 Content Browser 的覆盖率、未知字段保留和跨表影响验收。

## 10. 各阶段完成判据

### 设计准出

- 每个 Def 都有“职责、引用、页签、字段控件、子编辑器、预览、诊断、Apply 等级、非目标”。
- 每个可写字段都能指出消费者和失效方式；否则被标为只读或导出-only。
- 复杂结构不在父表单平铺；摘要行可定位到子编辑器和问题路径。
- 设计没有把历史 archive 文档中的未实现建议当成当前源码事实。

### 工程准出

- 变更类型 / 枚举后执行 `npm run gen:schema`，不得手改生成 Schema。
- 每个机制改动补 Vitest 正路径、拒绝边界、round-trip 和失败回滚测试。
- 通过 `npx tsc --noEmit`、`npm test`、`npm run check:architecture`、`npm run check:docs` 与 `git diff --check`。
- 涉及游戏内 UI 的编辑器任务补 Edge 浏览器验收；涉及导出 / 导入的任务补 ZIP 再解析验收。
- Apply 成功后验证 Registry、Runtime projection、UI 选中上下文和数据包源内容一致；失败后验证旧状态仍可用。

## 11. 明确不做

- 不把 `tools/datapack-editor` 直接改成游戏内 Runtime Editor 的实现来源。
- 不为所有 Def 建立一个超级 `DatapackService`、超级 `WorkspaceState` 或万能递归 JSON 表单。
- 不自动替换未知引用、不自动删除不支持字段、不把动态表达式折算成常量。
- 不把运行时当前状态反写进 Def：当前 Area、拥有角色、库存、购买记录、故事游标、AffectorInstance、主题预览都不属于 Def 草稿。
- 不因为用户要求“尽量详细”就提前开放缺少物化证明的字段；详细设计和可写授权是两个阶段。
- 不编写存档迁移、不在 Apply 中隐式清档、不用全量重载掩盖未定义的局部失效语义。

## 12. 后续拆 Task 的模板

每个 Def 域单独开工时，Task 至少包含：

```text
目标与当前事实
Def / 引用 / 状态边界
Required Read Set
Allowed Files
Policy 字段与 materialization 台账
Editor Sections / Child Editors
Draft round-trip
Validate / Diagnostics
Prepare / Apply / Projection / Rollback
反向引用与删除影响
非目标
专项测试与浏览器 / 导出验收
```

推荐拆分方式：

- `task-0121-world-def-editor`：Init / Area / Spot / Enhancement 统一准出；
- `task-0122-definition-dsl-child-editors`：Condition / Reveal / Effect / Value / Payment；
- `task-0123-economy-def-editor`：Item / DropTable / Shop / GachaPool；
- `task-0124-story-event-def-editor`：Story / StoryEntry / PassivePool / Trigger；
- `task-0125-character-progression-editor`：Character / Variant / Curve / Gear / Color；
- `task-0126-affector-presentation-assets-editor`：Affector / Theme / Presentation / Pic / Profile / Extra；
- `task-0127-full-definition-apply-and-impact-plan`：全量 Candidate Apply、影响计划与导出闭环；其中 Apply Adapter 应提前拆出平台包，不能全部压到最终阶段。

在真正创建上述 Task 前，建议先以 `packageId` 细分并行交付包，而不是让一个大 Task 同时占用多个 agent：

- `P-0123-item`、`P-0123-drop-table`、`P-0123-shop`、`P-0123-gacha`；
- `P-0124-story-def`、`P-0124-story-entry`、`P-0124-passive-pool`、`P-0124-trigger`；
- `P-0125-character-curve`、`P-0125-variant`、`P-0125-progression`、`P-0125-color`；
- `P-0126-affector`、`P-0126-theme-presentation`、`P-0126-pic-profile`、`P-0126-tag-resource`、`P-0126-extra-singleton`。

这些 package 共享 `contractRevision` 和 Delivery Packet，但各自拥有独立写集、测试文件和阻断状态；只有集成线负责把它们注册到中央聚合入口。

这些编号只是当前拆分建议；真正开工前仍需以当时源码、Policy、测试和 AOCI 维护结果重新核验，不直接创建全部后续文档。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/03-data-structures/declarative-dsl]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/schema-sync]] · [[docs/docs-828/05-conventions/testing]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[task-0076-unified-def-editor-service]] · [[task-0077-runtime-editor-condition-tree]] · [[task-0078-runtime-editor-condition-target-editors]] · [[task-0088-init-area-hot-crud-and-location-fallback]] · [[task-0093-init-editor-design]] · [[task-0098-runtime-editor-workspace-decoupling-and-light-theme]] · [[task-0110-datapack-editing-state-and-targeted-authoring]] · [[task-0111-datapack-pane-slots-selection-and-atomic-apply]] · [[task-0119-runtime-editor-base-full-export]]
