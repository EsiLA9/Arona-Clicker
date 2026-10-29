# Draft：Variant 统一转译需求接口

状态：first-slice-complete — 2026-10-24；用户已批准统一接口首片施工，后续明确为 Variant → 固定枚举模式 → 场景数据，并确认首期 gameplay-b。首片实现与验证见 [[ai/archive/task-0323-variant-unified-translation-interface]]；本页原有未裁定的完整方向保留，不据此扩大 Task 范围。

最新裁定：owned 与 slice 是输入来源，不是转译模式；模式为代码枚举且各有固定输出。首期只做 gameplay-b 的接口/准备快照，不迁移 MapRun 或新增 Datapack 表；其他模式和完整战斗接合仍待后续。本文下述通用原始数值/阶级/玩法分层仅描述需要它的模式，不要求所有未来模式都采用同一管线。

## 目标与最终方向

本文回答：**玩家当前持有的 Variant 与场景要求的切片 Variant，怎样经过同一转译边界，成为可预览、可校验、可保存的本次出场构筑。**

用户已明确：持有、个人原始数值、培养与入队围绕 Variant 设计；Chara 只提供统计聚合。本文不再将 Chara 作为选队身份、个人属性来源或战斗资格主键。这是目标方向，不是当前实现事实。

本阶段交付统一需求接口、数据所有权、两种来源的解析语义及验收场景。属性维度、阶级阈值、具体牌池内容和运行时改造留待后续裁定。

## 本阶段玩法语义与边界

### 用户已明确的方向

- 玩家已持有的 Variant 是独立持有、培养、入队与转译单位。
- 场景可以要求某个 Variant 的定制切片，服务于剧情演出。
- 两种来源要统一转译；个人原始数值到阶级的规则之后设计。
- Chara 在这一目标模型中只作为统计归属，不决定 Variant 的资格与能力。

### 本文建议、尚未裁定的默认方案

- 切片是 Variant 的构筑预设，具有自己的 ID 与修订号；不因剧情定制而创建另一条玩家持有记录。
- 首期切片完全固定所需构筑输入，不隐式继承玩家培养；部分继承作为后续显式模式。
- 持有要求与构筑数值来源分开声明；允许“必须持有，但用固定切片”，也允许内容授权的借用角色。
- 原始数值先统一，再转译阶级，最后由玩法适配器生成实际战斗参数与候选来源。
- 首次入队冻结构筑。场景需要换切片时，通过明确的场景边界操作产生新构筑修订，不在每次预览或抽牌时自动重读。

### 明确暂缓

- 本文不新增运行时 API、Registry 表、Schema、PlayerState 字段或存档格式。
- 不在本文确定属性清单、数值范围、成长公式、阶级名称和阈值。
- 不决定自由选队 UI、队伍人数、同 Variant 多实例是否允许、剧情奖励规则。
- 不将现有培养 Effect、Chara Tag 或 Map Action Tag 自动视为 Variant 的基础属性或能力。
- 不顺带重构 Operation、Chara 表现或其他业务；相关旧依赖只列为后续影响范围。

## 当前事实与待核对问题

| 问题 | 已核实依据 | 对方案/验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| Variant 如何关联 Chara | `src/data-services/contracts/character-variant.ts`：`CharacterVariantDef.proto` | 新接口以 variantId 为源身份；proto 仅作为可信内容中导出的统计归属 | 已核实 |
| 玩家当前持有和培养在哪 | `src/arona-clicker/types/state.ts`：`roster[variantId]`；`src/arona-clicker/types/character.ts`：`VariantProgress`；`services/character/roster-system.ts`：`getOwned()` | owned 来源读取当前有效状态；重复获得不是另一份可独立培养实体 | 已核实 |
| 目前是否已有通用基础属性表 | `character-variant.ts`、`character-progression-def.ts`、`types/character.ts` | 没有专用原始战斗属性及阶级合同；不可借现有等级字段虚构转译规则 | 已核实 |
| 当前培养能否直接给玩法 B 使用 | `runtime/runtime-game-instance.ts`：`resolveMapPartyAdmission()`；`contracts/map/map-run.ts`：`MapRunPartyMember` | 当前仅解析和保存身份，尚无统一培养转译层 | 已核实 |
| MapRun 是否已支持 Variant 为主体 | `services/map/map-run-service.ts`：`isPartySnapshot()`、`start()`；`data-services/contracts/gameplay-map.ts`：`partyCharacterIds`、`eligibleCharacterIds` | 当前固定 Chara 队伍及资格需另行改造，不能仅加一层接口就宣称支持 | 已核实 |
| 当前状态生命周期 | `types/state.ts`、`data-services/contracts/character-persist.ts`；[[ai/archive/docs-829/03-data-structures/player-state]] | owned 读取当前有效 Init/global 状态；历史记忆不能代替当前持有 | 已核实 |
| 是否已有剧情切片合同 | 本轮已读的 Variant、MapRun 及准入合同未提供本文定义的带修订切片 | 本文所列切片结构为新增建议，不以局部调查推断所有内容系统都无相近概念 | 已核实局部边界 |
| 新增个人属性的定义/状态归属 | 尚待设计基础属性与成长模型 | 会改变 NormalizedVariantInput 的具体字段，必须在实现前补齐 | 待裁定 |

## 1. 身份、版本与状态所有权

| 名称 | 唯一职责 | 建议归属 |
| --- | --- | --- |
| `variantId` | 指明独立 Variant 内容身份 | Registry 内容 |
| `sliceId + revision` | 指明该 Variant 的某个剧情构筑预设及准确修订 | 带版本的场景/数据包内容 |
| 玩家当前培养记录 | 指明这个玩家当前持有及成长到哪里 | 现有有效 PlayerState，不复制到切片表 |
| `actorId` | 指明本次出场实例；不是 variantId 或 Chara ID | Run owner 创建；局内唯一 |
| 转译规则引用 | 指明原始输入合同、阶级映射及玩法适配所用规则版本 | 内容/规则定义 |
| 构筑快照 | 指明这次出场实际使用了什么 | Run owner 保存 |
| 局内状态 | 当前 HP、资源、临时状态、手牌等 | Run owner；与入场构筑分开 |

同一 Variant 可有多个切片。同一切片的平衡调整增加 revision；不同剧情用途应有不同 sliceId。修订号、培养等级、阶级等级与本局 actorId 四者不得混用。

当前每个 variantId 只有一条玩家培养记录；本阶段不引入 ownedInstanceId。是否允许同 Variant 在同一队伍中出现两次，由后续队伍政策决定，actorId 结构不提前阻断表达。

Chara 统计归属从可信 Variant 定义读取，不能由请求伪造；不参与持有资格、属性继承、候选池过滤或同人去重。现有表现依赖如何退役另立范围。

## 2. 两种来源，统一入口

```text
owned：Variant 定义 + 当前有效的玩家持有/培养
                                                     ┐
                                                     ├→ 来源解析与准入
slice：Variant 定义 + 场景授权的 sliceId@revision      ┘
  → 统一的有效原始构筑输入
  → 原始数值到阶级的转译
  → 玩法 B 属性/能力/候选来源适配
  → 完整校验与只读预览
  → 开始/明确换构筑时原子冻结为 ActorBuildSnapshot
```

### owned 来源

- 请求显式指定 variantId，不再通过 Chara 自动挑一个已拥有 Variant。
- 准入要求该 Variant 定义存在，且当前有效 roster 中有它的持有记录。
- 从可信定义和有效玩家进度生成输入；历史曾拥有、可抽取、通讯录可见均不等于当前持有。
- 请求只能携带选择，例如已允许的装备选择；不接受 UI 上传的任意属性、培养值、持有布尔值作为权威。

### slice 来源

- 请求只引用场景允许的 sliceId 与准确 revision；切片定义绑定 variantId，不能由调用方另传一个不吻合的 Variant。
- 场景内容明确声明 `requiresOwned` 或 `sceneProvided`；前者查当前持有，后者只允许该场景提供的切片。
- 建议首期切片为完整构筑输入；其是否声明全部属性，或通过确定的基础定义补全，由输入 schema 指定，始终不隐式读取玩家成长。
- 不把切片写入 roster，不自动获得角色，不生成另一份碎片或培养记录。
- “序章版”和“负伤版”为两个预设身份；同一预设第 2 修订只表达其内容更新。

### 两条路径共同遵守

来源的差异在正规化之前结束；数值转译与玩法适配不得再次按来源散落分支。输出保留来源用于说明、存档与奖励策略，但不以来源暗中改变计算公式。

## 3. 统一接口草图

以下是需求级 TypeScript 草图，不是已存在或可直接编译的项目 API。ID、原始属性、阶级和候选字段的精确类型待定义；不得将占位名称实现为任意对象或任意代码执行入口。

```ts
type VariantSourceRef =
  | { kind: 'owned'; variantId: VariantId }
  | { kind: 'slice'; sliceId: SliceId; revision: number };

interface VariantTranslationRequest {
  slotId: PartySlotId;
  source: VariantSourceRef;
}

interface VariantTranslationContext {
  // 由可信场景 owner 解析，不能相信 UI 自行声明的授权。
  entry: VersionedEntryRef;
  rules: VersionedTranslationRulesRef;
  admissionPolicy: ResolvedVariantAdmissionPolicy;
}

interface VariantTranslationPort {
  preview(
    requests: readonly VariantTranslationRequest[],
    context: VariantTranslationContext,
  ): VariantTranslationPreview;
}

type VariantTranslationPreview =
  | {
      status: 'ready';
      previewToken: TranslationPreviewToken;
      members: readonly TranslatedVariantBuild[];
    }
  | {
      status: 'blocked';
      issues: readonly VariantTranslationIssue[];
    };
```

需求约束：

- 以队伍批次预览，逐成员报错，同时验证重复、槽位、人数等全队约束；失败不产出可提交 token，不留下部分队伍。
- Context 来自当前入口已解析内容；外部调用边界只暴露必要的入口引用和选择。上下文结构不等于向 UI 开放政策、规则或状态写入。
- 原始来源读取、Normalizer、阶级转译、玩法适配可拆为内部纯函数；对外提供统一领域入口。
- 确认入队复用 Run 的权威命令，由 Run owner 调用同一解析核心并核验 token；不让翻译接口自己创建 Run、写 roster 或发放奖励。
- token 绑定入口/规则/切片/Variant 内容依据、有效 Init 及本次读取的持有/培养/选择输入。无关玩家状态变化无需使其失效；相关输入变化必须返回 `stale-preview` 并重新预览，不静默采用另一份构筑。
- 预览不写状态、不消耗随机数、不分配正式 actorId。正式 actorId 在成功创建 Run 或明确换构筑的提交中分配/绑定。

## 4. 输入和输出必须承载的内容

### 4.1 正规化输入 `NormalizedVariantInput`

| 信息 | 要求 |
| --- | --- |
| 来源 | 准确 variantId、owned 或切片来源；切片包含 sliceId/revision |
| 原始能力 | 统一单位和范围的有效原始属性；定义值、成长、装备等贡献可追溯 |
| 构筑事实 | 有效技能/装备/特性/解锁等后续转译真正需要的有限字段 |
| 分类 | Variant 自身声明/规则明确导出的标签与能力；不自动继承 Chara Tag |
| 依据 | Variant 内容修订依据、输入 schema、切片修订与输入摘要 |

属性与能力必须由规则声明允许的键和类型，不使用无校验的 `Record<string, unknown>` 作为永久合同。缺失值按 schema 明确补全或拒绝；不默认为 0，不从玩家或其他 Variant 猜值。unsupported 的培养轨道必须报出或在规则中明确声明不消费，不能假装已生效。

### 4.2 转译输出 `TranslatedVariantBuild`

| 信息 | 要求 |
| --- | --- |
| 身份与来源 | slotId、variantId、source；统计归属从定义导出 |
| 有效输入 | 后续重放/校验所必需的正规化输入快照 |
| 阶级结果 | 每个被消费维度的阶级及转译规则版本 |
| 玩法构筑 | 初始/最大属性、能力、初始资源规则、候选来源及有限权重修正等所需结果 |
| 表现引用 | Variant 或切片明确声明的名称/头像等表现依据；不把表现选择当成能力来源 |
| 解释 | 每个结果的来源、贡献和命中阈值，可供预览展示与诊断 |
| 版本依据 | 输入 schema、Normalizer、阶级规则、玩法适配与依赖内容的版本/摘要 |

原始输入、阶级与最终玩法构筑分别保留职责。例如“机动力 78 → B 阶 → 本玩法敏捷 6”只用于表达层次，不裁定具体属性、阈值和数值。

统一输入先到阶级、再到玩法参数，供未来替换阶级阈值或接入其他玩法。最终构筑中如有不经阶级的量，必须由规则显式声明，不能隐式绕过转译。

## 5. 与牌池和 Tag 的接合要求

- Variant 构筑可以提供有效能力、标签、候选来源及权重修正，但 Action Tag 仍属于行动定义；三个概念分别校验。
- 角色构筑来源与 Map 场景来源在玩法适配处合并；Map 仍可增加场景特有行动或限制。
- 当前 Action/Pool ID 是 Map-local。通用 Variant 定义不能直接引用一个未限定 Map 的局部 actionId/poolId；需要明确的全局 Profile/能力键到 Map-local 内容绑定，或明确限定 Map 的绑定表。具体方案待裁定。
- 合并后的行动资格基于 Variant/本次构筑，实际使用者绑定 actorId；不继续借 Chara ID 代指所有差分。
- 最终候选仍需经过费用、目标、当下资源等运行时过滤。构筑快照冻结长期能力，不冻结本轮所有行动合法性。
- 基础权重、来源叠加和后续 Tendency 是不同步骤，映射规则必须说明避免重复加成；不得把阶级转换成重复的物理卡副本。

## 6. 冻结、场景切换、保存与回写

### 冻结与变化

- 创建 Run 时固定本次使用的来源、输入和输出；owned 在途培养改变只影响下一次构筑。
- `ActorBuildSnapshot` 在提交后绑定 actorId。当前 HP、状态、手牌等另存，不回写基础构筑。
- 如剧情中途要求换为另一个切片，必须在允许的场景边界显式提交：指定新来源、重新转译，并规定 HP 比例/绝对值、资源、临时状态、旧 CardRef 等怎样处理。
- 本阶段只要求可以表达明确换构筑边界，不默认实现换构筑功能。其状态承接政策未裁定前不能施工。

### Save / Resume

- 保存足以恢复同一构筑的有效输入、输出及内容/规则版本依据，不能仅存 variantId 后从当前 roster 重算。
- 恢复验证 snapshot 结构、来源与内容依据、转译结果一致性，并与 Run 身份绑定；输入摘要用于一致性，不代替来源授权或完整校验。
- 再次打开时不得自动换到最新切片修订或当前玩家培养。必需的旧规则/内容不可用时明确拒绝该 Run 恢复，不能静默降级。
- 内容发布如何保留多修订由实现 Task 裁定；本草案要求准确引用与不静默漂移，不承诺永久保存所有历史内容。
- 后续存档结构调整遵守项目清档策略，不在本设计中承诺旧存档迁移。

### 持久回写

- 转译、预览和局内战斗都不修改玩家 Variant 的培养或持有。
- 结局奖励单独声明目标 Variant、资格与幂等结算；经 StateMutationService 写入。sceneProvided 切片不会自动授予持有或培养。
- Chara 统计由有效 Variant 关联聚合；剧情借用是否计入哪个行为统计另行裁定，不能把出场自动计成获得。

## 7. 失败与诊断

建议统一返回机器可识别的 issue code、slot/source/字段路径和可展示原因，至少覆盖：

- `variant-not-found`、`variant-not-owned`。
- `slice-not-found`、`slice-revision-unavailable`、`source-not-allowed`。
- `input-incomplete`、`input-out-of-range`、`unsupported-progression`。
- `rules-unavailable`、`unbound-action-source`。
- `party-policy-violation`、`stale-preview`。
- `snapshot-invalid`、`content-version-mismatch`（恢复路径）。

缺失输入、版本不匹配、来源越权、映射缺失均应拒绝，不补一个隐藏的默认攻击或临时猜测构筑。

## 8. 行为验收需求

以下为未来实现的行为/回归测试需求；本轮仅设计文档，未新增或执行这些行为测试。

| 场景 | 预期 |
| --- | --- |
| 当前持有 Variant A | 读取 A 的当前有效培养，预览与提交产生同一构筑 |
| 只持有同 Chara 的 Variant B | 不能冒充拥有 A；A 的 owned 请求拒绝 |
| 仅在历史记忆中曾拥有 A | 当前未持有时 owned 请求拒绝 |
| 场景提供未拥有的 A 切片 | 仅在场景授权允许时准入；不创建 roster 记录 |
| 切片要求持有 A | 未持有拒绝；已持有使用切片构筑，不混入玩家培养 |
| 同一个 A 的两个不同剧情预设 | 分别解析；各自修订准确，输出来源可辨 |
| 相同正规化能力与同一规则 | owned 与 slice 的数值转译结果一致；来源信息可不同 |
| 修改 Chara Tag/稀有度/学校 | 不暗中改变 Variant 资格、属性与候选；统计归属仍正确 |
| 同一 Chara 下两个不同 Variant | 按各自数据解析，不能被原型主键覆盖或错误合并 |
| 重复预览 | 无状态/随机流/actorId 分配副作用 |
| 预览后相关培养或切片依据改变 | 提交拒绝 stale-preview，不混用新旧输入 |
| 一个成员解析失败 | 整个入队提交失败，不留下部分队伍 |
| 入队后培养改变并存档恢复 | 保持入场构筑，不读当前培养重算 |
| 切片新增 revision | 在途使用原快照；新进入显式使用其入口指定版本 |
| 规则/内容依赖缺失或快照伪造 | 明确拒绝，不自动改用最新规则 |
| 构筑中的通用能力未绑定到本 Map | 预览失败并定位 unbound-action-source |
| 后续场景换切片 | 只有状态承接政策已明确才可提交；无半途 HP/手牌残留 |
| 剧情切片结束 | 无隐式持有、培养、碎片回写；奖励走单独策略 |

## 裁定记录

| 待裁定问题 | 本轮建议 | 本项目决定 | 依据/待验证项 |
| --- | --- | --- | --- |
| 主体使用 Chara 还是 Variant | Variant | 用户明确采用 Variant；Chara 只统计 | 本轮对话；当前旧 Chara 依赖另行改造 |
| 两种来源是否统一转译 | 来源解析后统一正规化/转译/玩法适配 | 用户明确要求统一需求接口；具体分层为建议 | owned、场景切片需求 |
| 切片是否独立持有记录 | 切片是带修订的构筑预设 | 待裁定 | 不应把演出配置混入 roster |
| 首期切片是否混合玩家培养 | 首期固定；显式继承后续另设模式 | 待裁定 | 剧情确定性与规则可解释性 |
| 持有要求与来源是否拆开 | 拆开，场景控制是否借用 | 待裁定 | 同时覆盖借用和持有后统一数值 |
| 原始数值/阶级/适配输出字段 | 规则分层，字段后续设计 | 待裁定 | 属性单位、成长、装备、阈值尚未确定 |
| actorId 与 Variant 构筑身份 | 局内使用 actorId，variantId 为源身份 | 待裁定 | 当前 MapRun 以 Chara 为主的索引需改造 |
| 通用构筑如何绑定 Map-local 候选 | 采用显式适配绑定；具体内容合同后裁定 | 待裁定 | 当前 Action/Pool 只在 Map 内有意义 |
| 队伍人数/重复 Variant/场景换构筑 | 作为显式政策；本轮不默认放开 | 待裁定 | 决定后续队伍与状态承接验收 |

## Draft → Task 准入

- [x] 明确两种 Variant 来源、Chara 的目标统计边界与当前实现差异。
- [x] 核对当前持有、培养、MapRun 入队与 Map-local 行动的直接事实。
- [x] 列出统一接口责任、来源校验、版本冻结与行为验收需求。
- [ ] 裁定切片持有政策、固定/继承模式、actorId 与队伍政策。
- [ ] 确定首片原始属性 schema、阶级规则及玩法输出；不必一次完成所有成长轨道。
- [ ] 裁定 Variant 通用构筑到 Map-local 候选的绑定合同。
- [ ] 划定 MapRun、存档与旧 Chara 依赖改造边界，形成严格行为测试与审查计划。
- [ ] 建立实施 Task；当前没有运行时实现，也不代表整个 Variant 体系已重构。

## 下一步

先裁定“固定切片 + 场景显式持有政策 + 统一正规化”的首片来源语义，再选最少一项原始属性和对应阶级/玩法参数，验证 owned 与 slice 到同一结果的纵向样例。之后建立实施 Task，不因接口草图存在就提前生成空壳服务或存档字段。

## 相关路由

- [[ai/guide/goal-workflow]]
- [[ai/guide/context-packs/character]]
- [[ai/archive/docs-829/03-data-structures/player-state]]
- [[ai/guide/conventions/architecture-discipline]]
- [[ai/archive/docs-829/04-mechanisms/arona-clicker/gameplay-b-cards]]
- [[ai/archive/docs-829/06-wiki/30-arona-clicker-domain/card-systems-and-cultivation-bridge]]
