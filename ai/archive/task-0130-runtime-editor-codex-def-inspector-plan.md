# Task：RuntimeEditor 超级图鉴 Def 详览规划

状态：done — 🟢 已完成各类 Runtime 有效 Def 的三页详览、关系可靠性与全量验收

## 1. 任务定位

本 Task 承接 `task-0128-runtime-editor-loaded-content-codex` 与 `task-0129-runtime-editor-codex-workspace-optimization`，规划超级图鉴对各类 Runtime 有效 Def 的详尽只读展示。

目标不是扩展编辑能力，而是让每类 Def 在“概览 / 关系 / 原始数据”三个页签中拥有清晰、领域正确、可追踪且不失真的内容呈现。

超级图鉴仍然只访问当前 Runtime 已加载并进入有效 Registry / Runtime Content 的内容，不访问包库未加载数据，不写 Registry，不写 PlayerState，不触发加载、Apply 或状态变更。

## 2. 当前事实

### 2.1 现有能力

- `RuntimeContentBrowserQueryPort` 已提供当前有效内容的列表、详情、字段树、出向引用和反向引用。
- `codex-details` 已提供通用概览、关系和字段树渲染器。
- 概览已支持 Condition、Effect、ValueExpression、Payment、RevealTrigger 的通用语义摘要。
- 关系解析已对主要已知字段提供声明关系、目标类型和可靠性标记；未登记字段继续走推断兜底，完整类型适配仍在推进。
- 原始数据页已同时提供字段树、严格 JSON 展示和复制入口；Map / Set / unknown 等特殊值仍需继续补充专门视觉核验。
- Registry getter 会动态发现内容种类，不能另建一套与 Registry 平行的手写 Def 全集。

### 2.2 当前可见 Def 台账

| 分组 | 类型 |
| --- | --- |
| 世界 | Init、Area、Spot、Enhancement |
| 剧情 | Story、ActiveStory、PassiveStory、PassivePool、StoryEntry |
| 经济 | Item、DropTable、Shop、ResourceDisplay |
| 角色成长 | Character、CharacterVariant、CharaProfile、CultivateCurve、FavoriteItem、UniqueWeapon、Trait、Gear、GearConfig、GachaPool |
| 表现资产 | ColorGroup、ColorEquipment、ThemeDesign、Pic、Tag |
| 引擎规则 | FuncletDef、AffectorPack、TriggerDef |
| 全局配置 | AffectionConfig、CharacterPersistConfig、Extras |
| 派生 / 补充 | `storyEntries` 派生视图、`affectorPacks`、`triggerDefs` 补充源 |

实际展示台账以当前 Runtime Registry 暴露的 getter 和补充源为准；本表只作为规划分组，不作为第二份类型事实源。

## 2.3 当前实施进度

- [x] 增加按 `definitionKind` 分派的领域摘要 Profile，覆盖世界、剧情、经济、角色成长和表现资产的主要字段 / 数量。
- [x] 概览显示容器形态与派生视图标记，避免 singleton / derived 内容被误解为普通实体。
- [x] 关系列表增加领域化关系名称，并明确当前通用扫描结果为“推断”。
- [x] 原始数据页增加严格 JSON 展示，同时保留字段树和复制入口。
- [x] 补充 Profile、严格 JSON 和图鉴集成回归测试。
- [x] 为已知字段关系增加 Runtime Content Browser 层的声明 / 推断可靠性标记；高价值 Def 的完整类型适配仍待继续。
- [x] 缺失 / 歧义关系保留已知目标类型，不再统一降级为 `unknown`。
- [x] 增加当前 Runtime 全量暴露 Def 的三页签渲染烟测，覆盖 singleton、派生和普通条目路径。
- [x] 建立 Registry getter / Runtime 补充源的完整 Def Profile 台账，并测试未知未来 kind 仍走通用 Inspector 兜底。
- [x] 完成第一批 / 第二批 / 第三批 Def 的逐类型语义内容核验与边界测试。

## 3. 三页签展示协议

### 3.1 概览

概览统一由四部分组成：

1. 身份：Def 类型、显示名称、完整 ID 或 singleton、来源 Mod、命名空间、来源可靠性和当前有效状态。
2. 领域摘要：该类 Def 的核心字段、数量、关键开关、条件、支付、效果或运行时用途。
3. 关联摘要：父级、子项、关键引用数量、缺失 / 歧义诊断数量。
4. 通用语义摘要：Condition、Effect、ValueExpression、Payment、RevealTrigger。

概览回答“这是什么、当前如何生效、最重要的配置是什么”，不直接倾倒完整字段树。

### 3.2 关系

关系页统一分为：

- 所属 / 父级关系；
- 向外引用；
- 被引用 / 反向引用；
- 缺失、歧义、未确认或推断关系诊断。

关系必须带有关系语义，例如“所属 Area”“支付资产”“卡池成员”“颜色绑定”“效果目标”，不能全部退化为“引用”。可解析目标继续支持点击跳转。

### 3.3 原始数据

原始数据页保留完整原始事实：

- 默认展示可折叠字段树；
- 显示字段路径、值类型、值和语义节点标记；
- 提供严格 JSON 展示 / 复制；
- 明确表达 Map、Set、unknown、cycle 和 singleton；
- 不混入 PlayerState、运行时实例、编辑草稿或 UI 派生字段。

## 4. 各类 Def 展示规划

### 4.1 世界类

| 类型 | 概览重点 | 关系重点 |
| --- | --- | --- |
| Init | 起始剧情、Area 数量、世界倾斜、共享标记 | 起始 Story、所属 Area、相关 Spot |
| Area | 所属 Init、Spot 数量、可见性、表现配置 | Init、Spot、条件、主题 |
| Spot | 所属 Area、等级、功能、支付、升级、揭示 | Area、Resource、Item、Shop、Gacha、Affector、Story |
| Enhancement | 自动应用、最大层数、不可逆、效果摘要 | Item、Condition、Effect、目标 Def |

Spot、Area、Init 为第一批优先级。

### 4.2 剧情类

| 类型 | 概览重点 | 关系重点 |
| --- | --- | --- |
| Story | 标题、流程结构、Talklet 数量、角色 / 主题摘要 | Entry、前后续剧情、角色、条件、效果 |
| ActiveStory | 入口条件、目标 Story、重播策略 | Init、Story、Condition |
| PassiveStory | 触发方式、条件、冷却、Talklet 数量 | PassivePool、Story、角色 |
| PassivePool | 成员数量、选择 / 权重策略 | PassiveStory、条件 |
| StoryEntry | 来源类型、入口 ID、展示标题 | 原始 Active / Passive 来源 |

`storyEntries` 必须标记为派生合并视图，避免用户误以为它是独立来源。

### 4.3 经济类

| 类型 | 概览重点 | 关系重点 |
| --- | --- | --- |
| Item | 类型、堆叠、图标、用途 | Shop、DropTable、Spot、Gear、Gacha |
| DropTable | 条目数、权重、掉落范围 | Item、Resource |
| Shop | 商品数、价格、解锁条件 | Item、Resource、Spot、Enhancement |
| ResourceDisplay | 标签、图标、显示格式 | 所有 Resource 使用方 |

支付、掉落和商店需要结构化摘要，不只依赖通用语义扫描。

### 4.4 角色与成长类

| 类型 | 概览重点 | 关系重点 |
| --- | --- | --- |
| Character | 差分数量、标签、基础资料 | Variant、Profile、GachaPool |
| CharacterVariant | 原型、培养曲线、初始特性、装备槽、主题 | Character、Curve、Trait、Gear、FavoriteItem、UniqueWeapon |
| CharaProfile | 资料、头像、简介、展示资源 | Character、Pic |
| CultivateCurve | 等级数、经验和属性曲线 | CharacterVariant |
| FavoriteItem | 偏好角色、效果、增益 | CharacterVariant、Item |
| UniqueWeapon | 角色专武、成长层级、效果 | CharacterVariant、Item |
| Trait | 条件、效果、作用目标 | CharacterVariant、Condition、Effect |
| Gear | 类型、层级、升级成本、效果 | CharacterVariant、Item、Effect |
| GearConfig | 经验材料、全局升级参数 | Item、Gear |
| GachaPool | 成员、Featured、概率 / 条件 | CharacterVariant、Item、Resource |

CharacterVariant 是角色成长关系的核心枢纽，应作为第二批优先级。

### 4.5 表现与资产类

| 类型 | 概览重点 | 关系重点 |
| --- | --- | --- |
| ColorGroup | 色阶、主题 token、显示名 | ColorEquipment、ThemeDesign、Presentation |
| ColorEquipment | 所属色彩组、效果、主题 | ColorGroup、CharacterVariant、Item |
| ThemeDesign | 颜色组、背景、装饰层 | ColorGroup、Pic、Presentation |
| Pic | 类型、路径 / URL、安全状态 | Character、Spot、Theme、Presentation |
| Tag | 路径、名称、描述、层级 | Init、Area、Spot、Character、Story、Enhancement |

### 4.6 引擎规则类

| 类型 | 概览重点 | 关系重点 |
| --- | --- | --- |
| FuncletDef | 类型、目标、数值表达式、用途 | Spot、AffectorPack、Resource、Condition |
| AffectorPack | 条目、挂载目标、Flow、Funclet、持续效果 | Spot、Area、Resource、Funclet |
| TriggerDef | 触发事件、条件、效果、优先级 | Event、Condition、Effect、目标 Def |

规则类概览优先回答“何时触发、作用于谁、产生什么效果”。

### 4.7 全局配置类

| 类型 | 概览重点 | 关系重点 |
| --- | --- | --- |
| AffectionConfig | 等级、阈值、推送 / 解锁配置 | CharacterVariant、Story、Talklet |
| CharacterPersistConfig | 状态块持久化层级 | Character、Init、PlayerState 说明 |
| Extras | 路径树、键数量、命名空间 | ValueExpression、Condition、Effect 使用方 |

全局配置应明确显示“Runtime 全局配置”，不伪装成普通实体，也不强行生成实体 ID。

## 5. 关系解析方案

关系解析分三层，按可靠性排序：

1. 类型专属关系适配器：明确知道 `Spot.areaId`、`GachaPool.members`、`CharacterVariant.curve` 等字段的目标类型和关系名称。
2. Schema / 字段元数据：补充短 ID、数组引用、可选引用和语义引用的类型信息。
3. 通用启发式兜底：保留现有字段名 / ID 形状扫描，但标记为 `inferred`，不能伪装成已确认关系。

关系状态继续区分 `resolved`、`missing`、`ambiguous`，并新增或等价表达“declared / inferred”的可靠性维度。

## 6. 实施阶段

### Phase 1：展示协议与类型台账

- 建立按 `definitionKind` 分派的展示 Profile。
- 解决 singleton、非字符串键和 derived kind 的身份规则。
- 明确每类 Def 的概览字段与优先级。

### Phase 2：领域概览适配器

- 扩展 `DefinitionInspectorViewModel` 或增加等价只读投影。
- 为世界、剧情、经济、角色成长、表现资产、规则、全局配置提供领域摘要。
- 保留通用语义摘要作为兜底和补充。

### Phase 3：关系适配器

- 为高价值 Def 增加类型专属关系抽取。
- 为关系增加语义名称、目标类型、路径和可靠性。
- 保留缺失 / 歧义 / 推断诊断和跳转能力。

### Phase 4：原始数据增强

- 保留字段树。
- 增加严格 JSON 展示和复制。
- 完善 Map、Set、unknown、cycle、singleton 的可视化。

### Phase 5：分组验收与覆盖补齐

按世界、剧情、经济、角色成长、表现资产、规则、全局配置逐组验收，最后再处理低频和派生类型。

## 7. 优先级

第一批：Spot、Area、Init、CharacterVariant、GachaPool、Story、ActiveStory、PassiveStory、Item、Shop、DropTable。

第二批：Gear、FavoriteItem、UniqueWeapon、Trait、CultivateCurve、Character、CharaProfile、ColorGroup、ThemeDesign、Pic。

第三批：AffectorPack、TriggerDef、FuncletDef、ResourceDisplay、Tag、全局配置、派生视图和低频类型。

## 8. 验收标准

- 每个当前 Runtime 实际暴露的 Def kind 都有明确的展示归属；未识别类型仍可通用兜底展示。
- 概览对第一批类型展示领域核心字段，不再只有通用字段树和泛化语义摘要。
- 关系页能区分父级、子级、向外引用、反向引用、缺失、歧义和推断关系。
- 关系跳转不修改 Runtime、PlayerState 或编辑器草稿。
- `storyEntries`、singleton、Map / Set、非字符串键等边界有专门测试。
- 原始数据可完整查看和复制，且不混入运行时状态或 UI 派生信息。
- 保持三页签局部刷新边界，不重建整个超级图鉴工作区。
- 补充 UI、Runtime Content Browser、关系解析和领域摘要测试。
- 完成 `npx tsc --noEmit`、相关 vitest、`npm run check:architecture`、`npm run check:docs`，必要时补跑全量测试和构建。

## 相关路由

`task-0128-runtime-editor-loaded-content-codex` · `task-0129-runtime-editor-codex-workspace-optimization` · `task-0120-def-editor-design-masterplan` · `docs/docs-828/02-modules/runtime-editor` · `docs/docs-828/02-modules/registry` · `docs/docs-828/02-modules/ui` · `docs/docs-828/03-data-structures/declarative-dsl` · `docs/docs-828/05-conventions/testing`

## 9. 最终核验（2026-09-20）

- `npx tsc --noEmit`：通过。
- 相关 Runtime Content Browser / Codex 测试：通过，28 tests。
- `npm test -- --run`：通过，187 test files / 1704 tests。
- `npm run check:architecture`：通过。
- `npm run check:docs`：通过，errors 0。
- `npm run build`：通过；仅保留既有大 chunk warning，无新增构建错误。

最终交付包括：领域摘要 Profile、完整 Def kind 台账、声明 / 推断关系可靠性、缺失关系目标类型、字段树与严格 JSON 展示，以及当前 Runtime 每个真实 Def 的三页渲染验收。
