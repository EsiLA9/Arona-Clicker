# 03-data-structures/declarative-dsl — 声明式 DSL 枚举目录

> 本文集中编目引擎与产品数据里的所有**枚举式 / tagged-union** 设计（判别字段 `type` / `kind` / `source` / `t` / `op` / `target` / `category` 等），供数据作者与改引擎者一屏查全。机制类型权威在 `src/engine/types/`，数据包契约在 `src/data-services/contracts/`，产品实体在 `src/arona-clicker/types/`；改可生成 Schema 的字段/枚举后必须 `npm run gen:schema`（见 [[docs/docs-828/05-conventions/schema-sync]]）。
> 运行时事件 `GameEvent` 的枚举目录见 [[docs/docs-828/04-mechanisms/trigger-effect]]「GameEvent 事件目录」；GameNum 数值树节点 kind 见 [[docs/docs-828/04-mechanisms/production]]。本文不重复。

## 1. 数值与表达式（ValueSystem）

`ValueSource`（`types/expression.ts`）—— `Value.params` 的取值来源：

| source          | params            | 语义                              |
| --------------- | ----------------- | ------------------------------- |
| `const`         | `value`           | 常量                              |
| `res`           | `res`             | 读某资源当前值                         |
| `spotLevel`     | `spot`            | 读某 Spot 等级                      |
| `areaSpotCount` | `area`            | 读某区域内已拥有 Spot 数量                |
| `managerCount`  | —                 | 读已指派 Manager 数                  |
| `funclet`       | `funclet` + 各形参   | 调用 Funclet（见 §2）                |
| `data`          | `path`（ExtraPath） | 读 Extra 三层合并视图，数值语义同 `toNumber` |

`ValueExpression`（`types/expression.ts`）—— 纯函数式算术树，`ValueSystem.evaluate` 递归求值（GameNum 的 `expr` 节点内嵌此类型）：

| type | 字段 | 语义 |
| --- | --- | --- |
| `const` | `value` | 常量 |
| `value` | `value: Value` | 叶子：按 `ValueSource` 取值 |
| `add` `sub` `mul` `div` `min` `max` `pow` | `left` `right` | 二元运算 |
| `floor` `ceil` `round` | `expr` | 一元取整 |
| `clamp` | `expr` `min` `max` | 区间夹取 |

> 注意分工：`ValueExpression` 是**数据包声明语言**（含 div/min/max/pow/clamp/floor/ceil/round）；GameNum 数值树是**运行时结算树**，通用算术一律经 `expr` 节点下沉到 `ValueExpression`。

## 2. Funclet（可复用数值片段）

`FuncletDef`（`types/expression.ts`）：`{ id, description, params: {name, type:'number'|'string'}[], calc: ValueExpression, extra? }`；`FuncletCall`：`{ funcletId, args }`。经 `ValueSource='funclet'` 在任意表达式中调用。

> ⚠️ **已知缺陷（未修，独立任务）**：`expression/value-system.ts:79` 把 `def.calc`（`ValueExpression`）强转成 `Value` 塞进 `{type:'value', value: calc}`，`evaluate` 递归到 value 节点读 `.source`（undefined）落 `default → 0`——**funclet 的 `calc` 运行时恒返回 0**。正确应为直接 `evaluate(def.calc, state)`。

## 3. 条件（ConditionSystem）

```
Comparator：== != >= <= > <。
Condition：{ target: ConditionTarget, key, comparator, value }；
ConditionGroup：{ type: 'AND' | 'OR', conditions: (Condition|ConditionGroup)[] }（可嵌套）。

ConditionTarget（16 种）—— key 与 actual 语义：
```

| target                | key                   | actual 语义                                     |
| --------------------- | --------------------- | --------------------------------------------- |
| `resource`            | 资源 id                 | 资源当前值                                         |
| `spotLevel`           | SpotId                | 设施等级                                          |
| `manager`             | SpotId                | 是否指派 Manager                                  |
| `flag`                | flag 名                | 0/1                                           |
| `hasEnh`              | EnhancementId         | 是否拥有强化                                        |
| `hasTag`              | tag                   | 是否存在拥有该 tag 的已拥有 Spot（0/1）                    |
| `countTags`           | tag                   | 拥有该 tag 的已拥有 Spot 数量（层级含 child）               |
| `tagCount`            | `<kind>:<tagDisplay>` | 按 tag 聚合的收集数（TagStatService，如 `spots:office`） |
| `stat`                | `$FunctionName 参数…`   | 统计 DSL 求值                                     |
| `hasReadStory`        | StoryId               | 是否跨 Run 完成过（0/1）                              |
| `hasReadStoryInRun`   | StoryId               | 当前 Run 是否完成过（0/1）                             |
| `visitedStoryInChain` | StoryId               | 当前 Entry 跳转链是否经过（0/1）                         |
| `extra`               | ExtraPath             | Extra 合并视图 `toNumber`（缺失→0）                   |
| `protoStat`           | 原型角色 id               | `protoStats[key].acquiredTotal`（缺失→0）         |
| `affectionLevel`      | 差分角色 id               | 当前角色好感等级（未拥有/缺失→0）                    |
| `area`                | AreaId                | 当前所在 Area 是否为该 Area（0/1）                      |

## 4. 效果（EffectOp）

`Effect`：`{ op: EffectOp, target, value, owner?, notice? }`。`value` 可为 数值/字符串/布尔/`ValueExpression`/`ExtraValue`(setExtra)/`ThemeEffectValue`(setTheme)/`ChatTextEffectValue`(showChatText)。

`EffectOp`（25 种 = 状态层 14 + 转发类 9 + 声明类 2，见 [[docs/docs-828/02-modules/effect-trigger]]）：

| op | target | 归属 |
| --- | --- | --- |
| `setResource` `addResource` | 资源 id | StateMutationService |
| `setSpotLevel` `addSpotLevel` | SpotId | StateMutationService |
| `setManager` | SpotId | StateMutationService |
| `addEnhancement` | EnhancementId | StateMutationService |
| `addItem` | ItemId | StateMutationService |
| `unlockInit` | InitId | StateMutationService |
| `setFlag` | flag 名 | StateMutationService |
| `setExtra` `addExtra` `removeExtra` | ExtraPath | StateMutationService |
| `grantCharacter` | VariantId（重复转碎片） | StateMutationService |
| `loot` | DropTableId | → LootSystem（⚠️ 当前 no-op 预留） |
| `triggerStory` | StoryId（`owner` 决定沙盒游标） | → StoryService（发请求事件） |
| `travelToArea` | AreaId（`notice` 控制展示条目） | → 移动（发请求事件） |
| `setTheme` | —（`value: ThemeEffectValue`） | → ColorSystem（发请求事件） |
| `setSpotMaxLevel` `removeSpotMaxLevel` | SpotId | Affector 声明类，`getSpotMaxLevelOverrides` 动态读取，不经执行 |
| `clearAllChatFlow` | VariantId（空=当前流） | → ChatFlowService |
| `showChatText` | 临时 id（`value: ChatTextEffectValue`） | → ChatFlowService |
| `clearIdChatFlow` | 临时 id | → ChatFlowService |
| `clearAllChatText` | — | → ChatFlowService（Story 完结默认执行一次） |
| `showOpeningTitle` | —（`value: string` 横幅标题，可空回退） | → ChatFlowService（发 `openingTitleShown`；首页声明随剧情开始立即呼出，非首页于离开该页时呼出，机制见 planning §3） |

`ThemeEffectValue.scope`：`ephemeral`（临时演出，默认）/ `area`（场景）/ `student`（学生）；`area`/`student` 需 `entityKey`（`area:<id>` / `variant:<id>`）。

## 5. 触发与持续效果

`TriggerEventDef.kind`（`types/trigger.ts:63-74`，**9 种**）—— Trigger「何时检查」，均可带可选过滤 id；kind 全集与 `TriggerSystem.ON_KIND_TO_EVENT` 双向锁合、且登记于 `EVENT_CATALOG`（[[docs/0x-plan&work/completed/adr-0001-architecture-consolidation]] T4）：

| kind | 过滤字段 | 对应事件 |
| --- | --- | --- |
| `tick` | `every?` | tick |
| `resource` | `resource?` | resourceChanged |
| `spotLevel` | `spotId?` | spotLevelChanged |
| `item` | `itemId?` | itemCollected |
| `story` | `storyId?` | storyCompleted |
| `init` | `initId?` | initEntered |
| `area` | `areaId?` | areaEntered |
| `character` | `variantId?`（缺省=任意） | 角色差分获得（含重复获得） |
| `cultivated` | `variantId?` / `cultivation?: 'exp'\|'star'` | 培养变更（映射伞事件 `characterProgressChanged`，domain 限 level/star） |

`TriggerDef`：`{ id?, on: TriggerEventDef, condition?, effects[], once?=true, extra? }`（缺省 id = 匿名，按分组+结构派生 `anon:` 前缀确定性 id）。

`AffectorState`：`Latent`（挂载未激活）→ `Active`（激活沿执行 `effects`）→ `Removed`（卸载）。

## 6. Extra 数据树（类 NBT）

`ExtraValue.t`（6 种）：`int` / `float` / `str` / `bool` / `list`（`ExtraValue[]`，允许异构）/ `dict`（`Record<string, ExtraValue>`，即 NBT Compound）。`ExtraCompound` = `dict` 别名（Def 的 `extra` 字段用）。`ExtraPath` = `/` 分隔字符串（如 `meta/rank`、`inv/0/name`；段不得为空，dict key 禁含 `/`）。三层合并视图见 [[docs/docs-828/02-modules/extra]]。

## 7. 世界实体功能

`SpotFunctionalityDef.kind`（4 种）：

| kind | 语义 |
| --- | --- |
| `linearYield` | 升级提供线性额外产出（`resource` + `amountPerLevel`），结算时按等级生效（类比 Affector flow） |
| `restartInit` | 软重启（保留快照 + 统计），UI 操作入口 |
| `hardResetInit` | 硬重置（删快照，下次进入该 Init 崭新，保留统计），UI 操作入口 |
| `gacha` | 招募功能入口（可带 `gachaPools` 专有卡池） |

`InitPurchaseError`：`NotFound` / `AlreadyUnlocked` / `InsufficientResource`。

## 8. 揭示与可达性阶梯

`RevealStage`（7 级，L0→L6）：`invisible` → `presence` → `partial` → `known` → `utility` → `purchaseable` → `owned`。

`RevealTarget`（5 种）：`existence`（实体是否出现）/ `name` / `condition` / `utility` / `unlock`（实际解锁，engine 直接消费；其余仅信息揭示）。

`AccessStage`（5 阶段，自上而下收窄）：`hidden`（可见性层）→ `obfuscated`（遮挡 ???）→ `revealed`（完整展示）→ `accessible`（可进入/解锁/使用）→ `active`（运行时持续生效）。

两者是不同概念，勿混淆（见 [[docs/docs-828/02-modules/visibility]]）。

## 9. 内容实体枚举

**Talklet**（`src/data-services/contracts/story-entry.ts`）：
- `kind`：`talk`（对话气泡，默认）/ `narration`（横跨宽度旁白）/ `click`（纯底部按钮交互页）；
- `align`（仅 narration）：`center`（默认）/ `left` / `right`；
- `side`（仅 talk）：`left`（默认）/ `right`；
- `jumpMode`（配 `jumpToStory`）：`goto`（默认，完全转移不返回）/ `insert`（插入子剧情后返回）。

**ItemDef**：`rarity` = `common`/`rare`/`epic`/`legendary`；`type` = `consumable`/`material`/`key`。

**EnhancementAttachment.kind**（仅 UI 展示）：`area` / `init` / `global`。

**StoryEntryBase.completionStrategy**：`simple`（默认，用 `completionReward.first/repeat`）/ `conditional`（用 `conditionalRewards` 按序首个满足）。`StoryEntryDef.type`：`active`（主/支/羁绊入口）/ `passive`（随机闲聊）。

**ResourceDisplayDef.showWhen**：`always`（默认常显）/ `hasAmount`（仅持有量 > 0 显示）。

## 10. 角色 / 色彩 / 抽卡枚举

**资源与角色基础**（`types/ids.ts`）：
- `Resource`：`Credit` = `base:resource:credit`、`Pyroxene` = `base:resource:pyroxene`（青辉石为唯一跨世界线全局资源）；
- `CharacterRarity`：`common` / `rare` / `super_rare`；
- `CharacterSchool`（11）：夏莱 / 阿比多斯 / 千禧年 / 崔妮蒂 / 盖赫纳 / SRT / 阿里乌斯 / 百鬼夜行 / 山海经 / 红冬 / 瓦尔基里。

**角色 / 色彩 / 抽卡**（`types/character.ts`）：
- `CharacterAcquireVia`：`gacha` / `story` / `event`；
- `GachaMode`（代码注册表，非数据包可插拔）：`ba-classic`（BA 经典：稀有度权重 roll + UP + 天井）；
- `CompositionType`（ColorGroup 头像构成）：`solid` / `gradient` / `duotone` / `pie` / `radial`；
- `ColorGroupRole`（色位角色）：`primary` / `secondary` / `accent` / `highlight` / `shadow` / `edge`；
- `EntityThemeSlot.kind`（实体主题来源）：`default` / `equipment` / `design` / `custom`；
- `ThemeOrderScope`（参与优先级排序的主题层，低→高）：`player` / `init` / `area` / `student`（user/preview 独立插层，ephemeral 临时层不参与排序、恒最高）；
- `ColorEquipmentDef.category`（UI 稀有度展示）：`common` / `rare` / `epic`；
- `CharacterPersistScope`（三层归属声明各字段）：`global`（跨世界线保留）/ `init`（随世界线重置）。

## 11. 演出文本枚举

`ChatTextKind`（`showChatText.kind`，无 talklet 时生效）：`default` / `kizuna` / `title` / `badge` / `note`。
`ChatTextFont`（`showChatText.style.font`）：`default` / `serif` / `sans` / `mono` / `handwritten`。

## 附：运行时操作返回码（非声明式）

`src/arona-clicker/contracts/results.ts` 里的判别联合（供门面/服务返回值消费，数据作者不直接书写）：
- `UseItemResult.error`：`NotFound` / `NotOwned` / `NotUsable` / `ConditionNotMet`；
- `TravelError`：`NotFound` / `NotInThisInit` / `NotAdjacent` / `AlreadyThere` / `Locked` / `StoryBlocked`；
- `EnhancementPurchaseError`：`NotFound` / `NotVisible` / `ConditionNotMet` / `InsufficientResource` / `AlreadyOwned`；
- `SpotUnlockResult.error`：`NotFound` / `NotVisible` / `InsufficientResource` / `AlreadyOwned` / `MaxLevel`；
- `SpotUpgradeResult.error`：`NotFound` / `NotOwned` / `InsufficientResource` / `MaxLevel` / `ConditionNotMet`；
- `StoryError`（14）：`NotFound` / `AlreadyActive` / `NoActiveStory` / `ConditionNotMet` / `WrongStoryType` / `AlreadyCompleted` / `NoAvailableStory` / `ChoiceRequired` / `InvalidChoice` / `ChoiceConditionNotMet` / `ClickRequired` / `BranchGuardDenied` / `JumpLimitExceeded` / `NotReplayable`；
- `SendState.mode`：`advance` / `idle`（`reason: noStory|noAvailable`）/ `choice` / `kizuna`；
- `SendResult.type`：`completed` / `working` / `choice` / `idle`。

## 相关文档

[[docs/docs-828/04-mechanisms/trigger-effect]] · [[docs/docs-828/05-conventions/schema-sync]]
