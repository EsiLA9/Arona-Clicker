# 06-adr/planning — 好感度系统规划（数值 / 聊天好感 / 羁绊尾巴）

- **状态**：规划（未实现，2026-08-28 代码核对确认无任何落地代码）
- **来源**：docs-824 的 03g / 04i / 04j 三篇规划文档合并迁移
- **依赖顺序**：好感数值（§1）→ 聊天好感触发（§2）→ 羁绊尾巴（§3），逐层叠加

> 三节共同构成「蔚蓝档案式好感回环」：聊天读消息 → 奖励好感小值 → 好感等级解锁更多聊天/羁绊剧情 → 剧情完成回聊天收尾。落地时任一节可独立开工，但 §2/§3 依赖 §1 的 `addAffectionExp` 写入口。

---

## §1 好感数值系统（数据设计）

### 玩法需求（验收口径）

1. 每一级好感要求一个**隐藏好感小值**（内部累积值，不作可见货币；UI 呈现为等级+进度）。
2. 1-100 级小值为**设定的值阶梯**；超过 100 级暂时**等值**（每级固定需求）。
3. 角色初始好感 **1 级**。
4. 培养 **5 星前默认最高好感 20 级**（星级锁）。

### 数据结构

**RosterEntry 扩展**（`src/engine/types/character.ts`）：

| 新字段 | 语义 |
| --- | --- |
| `affectionLevel?: number` | 好感等级（初始 1；运行时 `??= 1`） |
| `affectionExp?: number` | 当前级内积累的小值（`??= 0`） |

- 好感值**内嵌 RosterEntry**，随 `characterPersistConfig.roster` 归属层自动进出存档与 per-Init 快照——**无需改快照/存档任何一处**（快照机制见 [[docs-828/01-architecture/state-layers]]）。
- RosterEntry 为运行时对象，不进 datapack schema（无需 gen:schema）。

**AffectionConfigDef**（Datapack 顶层新表，`Datapack.affectionConfig?`）：

| 字段 | 语义 |
| --- | --- |
| `expCurve: number[]` | 阶梯区升级需求：`expCurve[i]` = 第 (i+1)→(i+2) 级所需小值；长度 = 阶梯覆盖等级数（默认 100） |
| `expBeyond: number` | 等值区需求：超出 `expCurve` 覆盖后每级固定需求 |
| `maxLevel: number` | 等级硬上限（含等值区）；默认取 `expCurve.length` |
| `defaultLevelCapByStar: number[]` | 星级锁默认表（索引 = 星级）：默认 `[20,20,20,20,20,100]`（5 星前一律 20 级） |

**星级锁 per-variant 覆盖**：`CharacterVariantDef.affectionLevelCapByStar?: number[]`（索引 = 星级，覆盖默认表；可做渐进式如 `[1,5,10,15,20,100]`）。

### 推进规则

```text
有效上限 cap = min(星级锁(stars), maxLevel)
addAffectionExp(variantId, delta):
 ├─ 未拥有 / delta <= 0 → 拒绝（no-entry / invalid-amount，与 addExp 一致）
 ├─ affectionExp += delta
 ├─ while affectionExp >= 升级需求(等级) && 等级 < cap:
 │    ├─ affectionExp -= 需求; 等级 += 1
 └─ 达 cap 后小值截断（不保留溢出，解锁上限后重新积累）
```

- 需求查询：阶梯区取 `expCurve[等级-1]`；等值区取 `expBeyond`。
- **星级突破后只升不降**：当前等级高于新 cap 时保持不变，仅阻止继续积累。
- 突破后 UI 刷新由现有 `cultivated(kind:'star')` 事件驱动（onAny 兜底）。

### 引擎接线点

| 文件 | 职责 |
| --- | --- |
| `types/character.ts` | RosterEntry 两字段；AffectionConfigDef；CharacterVariantDef.affectionLevelCapByStar |
| `types/datapack.ts` | `Datapack.affectionConfig?` 表挂载 |
| `registry/registry.ts` | 解析 affectionConfig + 引擎默认值（配置型，恒 global 语义） |
| `system/state-mutation-service.ts` | `addAffectionExp`（写入口）；`acquireCharacter` 建 entry 时初始化 1/0 |
| `system/roster-system.ts` | 只读 `affectionLevelOf / affectionExpOf / affectionLevelCapOf`（含星级锁） |
| `types/expression.ts` | `ConditionTarget` 加 `affectionLevel`（key=VariantId，缺失→0）；`EffectOp` 加 `addAffectionExp` |
| `system/effect-ops.ts` + `condition-system.ts` | 两个新分发分支（注册表化，见 [[docs-828/02-modules/effect-trigger]]） |
| `types/events.ts` | `affectionChanged { variantId, delta, newLevel, newExp }`（登记进 `EVENT_CATALOG`） |

### 默认阶梯（引擎内置，数据包可覆盖）

```text
expCurve[i] = 20 + 10*i   （1→2 级需 20；100→101 级需 1010）
expBeyond   = 1010        （与阶梯尾值一致）
maxLevel    = 100
defaultLevelCapByStar = [20,20,20,20,20,100]
```

### 边界规则

- 未拥有角色 / 未知差分：拒绝（与 `addExp` 同风格）；`delta <= 0` 拒绝。
- 旧档缺字段：`??=` 兜底，**不写迁移代码**（纪律 #7）。
- `affectionConfig` 缺省：用引擎默认配置，不报错。

### 测试清单（`tests/engine/affection-system.test.ts`）

- 阶梯边界：整级 / 跨级 / 越级一次到位；cap 截断
- 星级锁：5 星前锁 20；突破解锁；超 cap 不降级
- `save → load` 往返保留 affectionLevel/affectionExp
- 剧情 choice `addAffectionExp` 生效；`acquireCharacter` 初始化
- `affectionLevel` 条件达标前后变化

---

## §2 聊天好感触发与未读计数（交互设计）

### 玩法需求（验收口径）

1. 存在**对好感等级有需求**的聊天消息：好感未达标不可见/不可触发。
2. 触发模式：**单次**（读完即止）与**可反复**（条件满足可再次触发）。
3. 这类聊天驱动好感成长（读完奖励好感小值）。
4. **未读消息个数**在通讯录与对话空间 UI 协同显示。

聊天消息为**单对 chara**：`ChatMessageDef.owner: VariantId`（现状已有，见 [[docs-828/03-data-structures/character-entities]]），聊天空间按角色打开，消息与好感奖励均按 owner 归属。

### 数据结构（ChatMessageDef 扩展）

现状字段（已核对）：`id / owner / order / content / unlock?`。规划新增：

| 新字段 | 语义 |
| --- | --- |
| `repeatable?: boolean` | 可反复触发（默认 false = 单次已读即止） |
| `affectionRequired?: number` | 好感等级门槛（与 `unlock` AND；缺省 0 = 无要求）——好感维度的声明式快捷方式 |
| `affectionExpReward?: number` | 读完奖励的好感小值（按 owner 归属结算；缺省 0） |

### 可用消息与已读规则

```text
可用消息(variantId) = chatMessages.filter(m =>
    m.owner === variantId
 && 满足(m.affectionRequired, 该角色好感等级)
 && evaluateGroup(m.unlock)        // 缺省视为满足
 && (m.repeatable ? 冷却外 : 未读)
)
```

- **单次**：已读走现成 `PlayerState.chatRead`（`Record<ChatMessageId, true>`），已读即消失。
- **可反复**：已读不消耗；冷却**沿用被动闲聊模式**——新增 `chatCooldowns?: Record<ChatMessageId, number>`（value = 上次读完的 totalFrames，归属层随 chatRead），按 `totalFrames - 上次帧 < cooldown` 剪枝。第一迭代可不做冷却字段，退化为「条件满足即可重触发」。
- **读完时机**：内容完整展示后由 UI 调用现成 `markChatRead(variantId, messageId)`；引擎在该写入口内结算 `affectionExpReward`（按 owner 加小值，触发 `affectionChanged`）。

### 未读计数

```text
unreadChatCount(state, variantId) = 可用消息(variantId).length
```

只读查询挂 `RosterSystem`（或独立 chat 查询服务），UI 不直改状态（纪律 #4）。未拥有角色 → 0。

### UI 协同（`src/ui/components/contacts.ts`）

| 位置 | 呈现 |
| --- | --- |
| 通讯录角色行 | 行尾未读气泡（如 `（3）`），0 条不显示 |
| 对话空间头部 | 学生名旁「N 条未读」小字 |
| 聊天流内 | 未读消息以现有 chat 条目样式插入，读完走 markChatRead |

### 接线点与边界

| 文件 | 职责 |
| --- | --- |
| `types/character.ts` | ChatMessageDef 三个新字段（+ 可选 chatCooldowns） |
| `types/state.ts` | `chatCooldowns?`（如做，需同步 per-init specs 与快照——**优先级低，第一迭代不做**） |
| `system/state-mutation-service.ts` | markChatRead 内结算奖励 |
| `system/roster-system.ts` | `unreadChatCount` + 可用消息过滤 |
| `src/ui/components/contacts.ts` | 未读气泡 + 头部提示 |
| schema | 新字段 TSDoc 标注后 `npm run gen:schema`（流程见 [[docs-828/05-conventions/schema-sync]]） |

边界：未拥有角色未读数 0 不渲染气泡；缺省 0 兜底；旧档 `??=`；奖励结算走 `addAffectionExp`。

### 测试清单

- 单次消息：已读后不计未读、不再展示
- 可反复消息：奖励后仍计未读（冷却外），冷却内不计
- `affectionRequired` 未达标不可见不计数；达标后立即可见
- `markChatRead` → 奖励入账 → 跨级升级 → `affectionChanged`
- 未拥有角色未读数为 0

---

## §3 羁绊剧情小尾巴（聊天-剧情回环）

### 玩法需求（验收口径）

1. 聊天中触发**羁绊剧情入口**（kizuna 卡片）→ 进入剧情演出。
2. 剧情完成后**回到该角色对话空间**，自动追加**尾巴内容**（收尾段聊天）。
3. 尾巴聊完 → 该次小聊天才标记彻底结束（已读/结算）。
4. 未完成剧情前中断 → 该次聊天未结束，可重新从卡片进入。

现状锚点：kizuna 入口卡片（`Talklet.kizuna` / `showChatText kind='kizuna'`，见 [[docs-828/03-data-structures/declarative-dsl]]）、角色沙盒剧情游标（`startCardStory`，owner=VariantId）、`storyCompleted` 事件。

### 消息分段模型

一条含羁绊的聊天消息 = **前置段**（现有 content）+ **kizuna 卡片**（现有机制）+ **尾巴段**（新增）：

```ts
// ChatMessageDef 扩展（叠加 §2 三字段之上）
/**
 * 羁绊收尾段：关联 kizuna 卡片的消息在剧情完成后于对话空间追加展示的 Talklet 序列。
 * 缺省 = 无尾巴（剧情完成即结束）。@label 羁绊尾巴
 */
kizunaTail?: Talklet[];
```

- 尾巴复用标准 Talklet 渲染（speaker / avatar / kind / side），与前置段同款式。
- 配了 `kizunaTail` 的消息，其 kizuna 卡片的 `targetStoryId` 即该消息的关联剧情。

### 流程状态机（运行时）

```text
[展示] 聊天消息（前置段 + kizuna 卡片）
   │ 玩家点击卡片
   ▼
[剧情] startCardStory(storyId, owner=variantId)
   │    记 pendingKizunaTail = { chatMessageId, variantId }   ← 运行时状态
   ▼
[完成] storyCompleted（该沙盒游标 owner 匹配）
   │ ChatFlowService 检查 pendingKizunaTail
   ▼
[尾巴] 对话空间追加展示 kizunaTail Talklet 序列
   │ 尾巴展示完（玩家点完最后一条）
   ▼
[结束] markChatRead + affectionExpReward 结算（复用 §2 规则）
        清除 pendingKizunaTail
```

- **pendingKizunaTail** = `{ chatMessageId, variantId }`，第一迭代为**纯运行时状态（不持久化）**：剧情完成前退出应用则 pending 丢失——消息保持未读、卡片可重新点击，流程重走（可接受，因剧情奖励在 `storyCompleted` 才结算，无奖励丢失）。
- 单次消息：尾巴结束才 markChatRead（而非前置段展示时）——保证中断后可重来。
- 可反复消息：尾巴结束进冷却（若启用 `chatCooldowns`）。

### 边界规则

- `owner` 不匹配的 `storyCompleted`（其他角色沙盒 / 全局游标主线）**不触发**尾巴。
- 无 `kizunaTail` 的 kizuna 消息：现状行为不变（剧情完成即结束）。
- 尾巴展示期间：该对话空间不抽取新的被动闲聊、不展示其他可用消息（避免穿插打断回环）。
- 尾巴走消息流插入，演出层走覆盖层，二者不冲突。
- pending 存在时切到其他角色对话空间：pending 保留（按 variantId 区分），回到对应空间继续。

### 引擎接线点

| 文件 | 职责 |
| --- | --- |
| `types/character.ts` | `ChatMessageDef.kizunaTail?: Talklet[]` |
| `system/chat-flow-service.ts` | pendingKizunaTail 持有；订阅 `storyCompleted` 匹配 owner → 发尾巴渲染事件（复用 `chatTextShown` 族） |
| `game/story-service.ts` | 确认 `storyCompleted` 负载含 owner/variantId（缺则补） |
| `src/ui/components/contacts.ts` | 对话空间渲染尾巴段；尾巴「点完」回调 → markChatRead + 清 pending |
| `src/ui/controller*.ts` | kizuna 卡片点击已有 `data-kizuna → startCardStory`，接线 pending 登记 |

### 测试清单

- 完成剧情 → 尾巴段出现在该角色对话空间；结束 → 已读 + 奖励结算 + pending 清除
- 剧情未完成退出（重开 GameInstance）→ 消息仍未读、卡片可重新触发
- owner 不匹配的 storyCompleted 不触发尾巴
- 无 kizunaTail 的消息行为回归不变
- 尾巴展示期间被动闲聊被抑制

---

## 相关文档

[[docs-828/03-data-structures/character-entities]] · [[docs-828/04-algorithms/roster]] · [[docs-828/05-conventions/architecture-discipline]]
