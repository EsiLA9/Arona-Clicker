# 06-adr/planning — 好感度系统设计（数值 / 台阶推送 / 羁绊尾巴 / 输入中提示）

- **状态**：已实现（2026-08-29 落地；同日修订：聊天消息成分按用户裁定移除，见下）
- **来源**：docs-824 的 03g / 04i / 04j 三篇规划文档合并迁移
- **依赖顺序**：好感数值（§1）→ 台阶推送（§2）→ 羁绊尾巴（§3），逐层叠加
- **实现落定**（与原规划的差异，均为与用户对齐后的裁定）：
  - **轴 A（ChatMessageDef 静态消息）整体移除**（2026-08-29 用户裁定：该成分本就不该实现）：`ChatMessageDef` 表、`chatMessages` 数据、消息推送/已读/奖励结算全部删除；既有 `chatRead` / `markChatRead` / `chatReadChanged` 基础设施保留（当前无写入方）。
  - **未读迁移到对话空间**：未读 = 该角色**就绪队列条数**（`StoryService.readyStepCount`）；通讯录徽标与对话空间头部「N 条未读」同源；打开空间且队列非空时先展示**输入中省略号**（约 900ms）再推送队列顶——还原现实聊天的"正在输入…→ 送达"节奏。
  - **§3 尾巴改挂靠推送服务**（原消息承载随轴 A 移除）：`PassiveStoryEntry.pushAfterStory` 挂靠演出本体 id，关联剧情完结后**强制优先推送**进 owner 对话空间；羁绊入口走剧情侧 `Talklet.kizuna` 既有机制。
  - §1：`affectionChanged` 每次成功入账都发（附 `leveledUp` 标记，UI 仅跨级时提示）。
  - §2 轴 B：就绪队列 + `triggerAffectionPush`（进入对话空间经输入中提示自动推送 / `clickSend` idle 必中）。

> 三节共同构成「蔚蓝档案式好感回环」：好感达标 → 台阶/尾巴剧情经就绪队列推送到对话空间 → 完结奖励 `addAffectionExp` → 更高好感解锁后续内容。§2/§3 依赖 §1 的 `addAffectionExp` 写入口。

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

阶梯采用**蔚蓝档案原版羁绊表**（参考数据：仓库根目录 `bondDict.ts`，`bond2exDict[L] = [本级需求, 累计值]`；累计列为推导值，不入引擎）：

```text
expCurve = bond2exDict 的「本级需求」列，共 100 项
           （1→2 级需 15；10→11 级需 90；99→100 级需 7365）
maxLevel = 100（原版封顶；expBeyond 仅数据包自定义 >100 级扩展时使用，内置配置下不生效）
defaultLevelCapByStar = [20,20,20,20,20,100]
```

### 边界规则

- 未拥有角色 / 未知差分：拒绝（与 `addExp` 同风格）；`delta <= 0` 拒绝。
- 旧档缺字段：`??=` 兜底，**不写迁移代码**（纪律 #7）。
- `affectionConfig` 缺省：用引擎默认配置，不报错。

### 测试清单（`tests/engine/affection-system.test.ts`）

- 阶梯边界：整级 / 跨级 / 越级一次到位；cap 截断
- 默认阶梯与 bondDict 参考表一致（抽查 1 / 10 / 50 / 100 级需求值）
- 星级锁：5 星前锁 20；突破解锁；超 cap 不降级
- `save → load` 往返保留 affectionLevel/affectionExp
- 剧情 choice `addAffectionExp` 生效；`acquireCharacter` 初始化
- `affectionLevel` 条件达标前后变化

---

## §2 台阶推送与未读计数（交互设计）

### 玩法需求（验收口径）

1. 存在**好感台阶式剧情**：好感达标后**即刻进入就绪队列**，该角色对话空间在合适条件下**按需求值序列自动推送**一条**未经历过**的台阶剧情（渐进式剧情披露）。
2. **未读个数**在通讯录与对话空间 UI 协同显示；未读 = 就绪队列条数。
3. 打开有未读的对话空间时，先展示**输入中省略号**再推送内容（现实聊天节奏）。

### 轴 A（ChatMessageDef 静态消息）——已移除

原规划的消息轴（`ChatMessageDef` 扩展 `repeatable / affectionRequired / affectionExpReward`、可用消息过滤、未读气泡、`markChatRead` 内结算奖励）于 **2026-08-29 按用户裁定整体移除**：该成分本就不在用户意图内，消息的"满足条件后推送、点击读取、点击给效果"模式一并废弃。保留的既有基础设施：`chatRead` / `markChatRead` / `chatReadChanged`（当前无写入方，供未来读追踪复用）。本节以下仅描述存活的**轴 B（台阶剧情）**。

### 轴 B：好感台阶剧情（就绪队列 · 渐进式剧情披露）

> 台阶剧情走演出轴而非消息轴：免费获得 Talklet 多页/选项/Effects/Story 跳转与 `storyReadLogs` 记录，并与 §3 羁绊尾巴天然衔接；代价是每条都是一次完整剧情启动/结算，不适合海量一句话碎聊（那是轴 A 的位置）。

#### 需求 → 现有机制映射（已逐条核对引擎代码）

| 需求 | 机制 | 锚点 |
| --- | --- | --- |
| 只在该角色聊天流抽取 | `PassiveStoryEntry.owner = VariantId`（聊天空间壁垒） | `src/engine/system/passive-pool-system.ts` `pick` 的 ownerOk 剪枝 |
| 好感达标才入队 | 新字段 `PassiveStoryEntry.affectionRequired?`（定义于 `src/engine/types/content.ts`） | 队列谓词直接比对 `affectionLevel`；§1 的 `ConditionTarget` 仅作条件表达兜底 |
| 未见过的 | `repeatable: false` | `src/engine/game/story-flow.ts` `triggerPassiveStory` eligible 谓词已排除 `hasCompletedStory`，「没见过」零成本 |
| 合适的条件 | `triggerCondition` + `cooldownFrames` （entry 级，队列路径不经过池） | `state.passiveCooldowns` 剪枝 | 
| 按需求值序列推送 | 就绪队列按 `affectionRequired` 升序取最低（见下） | 新增有序队列查询，不走池加权随机 |
| 推送时机 | 进入对话空间自动推送；队列空时点击发送回落闲聊 | 复用 `startStory`；推送入口新增 |

#### 就绪队列（需求值自动排序，2026-08-29 与用户对齐）

> 术语备注：规划沟通中提到的「PassiveTalkEntry」在引擎中不存在——台阶剧情的投递载体就是现有 `PassiveStoryEntry`（被动条目管线）。

达标（`affectionLevel >= affectionRequired`）的未经历台阶**即刻进入该角色的就绪队列**（§3 的尾巴条目同样入队且**强制优先**）；台阶推送按需求值升序取最低者，顺序完全由需求值决定，改数值即改顺序，**无需手工串链**（纪律 #3）。同一时刻至多推送一条；完成后下一条回到就绪。

```text
就绪队列(variantId) = passiveStories.filter(e =>
    e.owner === variantId
 && (e.affectionRequired 达标                     // 台阶
     || e.pushAfterStory 已完结)                  // 尾巴（§3，强制优先）
 && !hasCompletedStory(e.storyId)      // 未经历过（repeatable 条目不入队列）
 && e.id != 当前沙盒进行中的 entry        // 播出中不计（内容已送达即不再未读）
 && cooldownFrames 未满
 && triggerCondition 通过（如声明）
)
推送 = 尾巴（声明序）在前 → 台阶按 affectionRequired 升序（并列按声明顺序）
```

#### 推送时机与闲聊回落

- **输入中省略号 + 进入即推**：玩家进入该角色对话空间时，若队列非空且该沙盒无进行中演出，先展示动态省略号（`.chat-typing`，约 900ms）再**自动推送**队列顶（复用 `startStory` 管线，owner 壁垒内）——现实聊天的"正在输入…→ 送达"节奏；期间点发送或返回键取消定时（点发送即立即推送）。
- **完成后续接**：一条推送完成后若队列仍非空，**不自动连播**；此时点击发送**必中队列顶**（点击抽取候选退化为队列），退出后再次进入空间才恢复输入中提示 + 自动推送。
- **闲聊回落**：队列为空时，点击发送按现状加权随机抽日常闲聊（保留现状作为兜底）。
- **边界（第一迭代硬约束）**：推送只发生在对应聊天空间内，**不得影响外部**——全局闲聊、其他角色空间、空间外场景均无感知、无弹窗。

#### 未读计数（对话空间语义）

```text
readyStepCount(variantId) = 就绪队列条数（尾巴 + 台阶）
```

只读查询挂 `StoryService`（`readyStepIds` / `readyStepCount`），UI 不直改状态（纪律 #4）。未拥有角色 → 0。UI 协同：通讯录角色行未读徽标（沿用既有 `getUnread` 预留接口，数据源改接本查询）+ 对话空间头部「N 条未读」小字。

数据形态（`src/data/base/` 现有 builder 增一个字段）：

```ts
passiveStory('base:affinity:hoshino_2', 'base:affinity:hoshino_2')
  .owner('Hoshino').repeatable(false).cooldownFrames(3600)
  .affectionRequired(3)                     // 新字段：入队门槛 = 好感 3 级
  .when(/* 可选额外门，缺省无 */)
  .rewardFirst({ op: 'addAffectionExp', target: 'Hoshino', value: 5 })
  .build();
```

- **奖励回环**：台阶完结奖励走 `completionReward.first` 或末页 effects 结算 `addAffectionExp`——无新写入口。
- **跨世界线语义**：`hasCompletedStory` 为跨 Run 全局条件，队列消费进度跨世界线保留；若需台阶随世界线重置，改用随 init 层的 `flag`（完成奖励 `setFlag` + 台阶 `triggerCondition` 加 flag 门）。
- **引擎改动**：队列查询（`readyStepIds` / `pickAffectionStep`，`story-flow.ts`）+ `PassiveStoryEntry.affectionRequired` 新字段（TSDoc 标注 + `gen:schema`）。

#### 轴 B 接线点与边界

| 文件 | 职责 |
| --- | --- |
| `src/engine/types/content.ts` | `PassiveStoryEntry.affectionRequired?: number` / `pushAfterStory?: string` 新字段 |
| `story-flow.ts` | `readyStepIds` / `pickAffectionStep` / `triggerAffectionPush` / `triggerTailPush` |
| `src/ui/controller-actions-contacts.ts` | `data-select-variant` 打开对话空间 → 输入中提示 + 延时推送 |
| `src/ui/controller-events.ts` | `storyCompleted` → 尾巴即时推送（§3） |
| `src/data/base/` | 台阶数据（builder 增 `affectionRequired`） |
| —（依赖） | §1 的 `affectionLevel` target 与 `addAffectionExp` op 先行 |

边界：`storyId` 与 `entry.id` 同值沿用现有惯例；台阶不声明进 `PassivePoolDef`（队列路径直接扫描 registry，池声明对台阶无意义）。

#### 轴 B 测试清单

- 达标即刻入队：需求满足前后推送可用性翻转；冷却内 / `triggerCondition` 不过则不入队
- 顺序：多条同时达标按需求值升序逐条放出；修改需求值即改变顺序
- readyStepCount：队列条数（未拥有 → 0；播出中不计；消费后递减）
- 推送时机：进入空间经输入中提示自动推一条；完成后不自动连播、点击必中下一条；再次进入恢复自动推送
- 回落：队列空时点击发送按现状抽日常闲聊
- 壁垒与边界：其他角色对话空间 / 全局闲聊（owner 为空）均抽不到；推送不影响全局游标与外部场景
- 台阶完结 → `addAffectionExp` 入账 → 跨级升级 → `affectionChanged`

### 升级提示与 UI 负空间（第一迭代收敛，2026-08-29 与用户对齐）

- **好感升级提示**：`affectionChanged` 跨级时，向该角色对话空间聊天流插入一条 `kind:'reward'` 的简单提示行（复用现成 `ChatEntry` reward 样式 `.chat-reward`，如「与 XX 的羁绊提升至 Lv.N」）。**不做** toast/飘字/动画播报。
- **负空间**：通讯录/对话空间当前**无禁做项**——列表行好感徽标、列表管理功能（排序/搜索/置顶）均未被排除，作为后续可选增强，不进第一迭代承诺范围。
- 好感等级 + 进度 UI 放右栏角色培养面板（`renderCharacterPanel`）；对话空间头部仅显示未读数（就绪队列条数），不显示好感进度。

---

## §3 羁绊剧情小尾巴（挂靠推送服务）

### 玩法需求（验收口径）

1. 剧情侧 **kizuna 卡片**（`Talklet.kizuna` 既有机制，`data-kizuna → startCardStory`）触发羁绊剧情演出。
2. 剧情完成后，其**羁绊尾巴**经就绪队列**强制优先推送**到该角色对话空间（正在观看时立即追加；不在则留在队列顶，经输入中提示送达）。
3. 尾巴本身是一条完整 PassiveStory 演出：免费获得 Talklet 多页/选项/Effects 与 `storyReadLogs` 记录，播过即出队（单次）。

> 2026-08-29 修订：原「消息承载尾巴」方案（`ChatMessageDef.kizunaStoryId / kizunaTail` + `pendingKizunaTail` 运行时状态机）随 §2 轴 A 一并按用户裁定移除，尾巴改挂靠 `PassiveStoryEntry` 推送服务。

### 数据形态（无新写入口，一个声明字段）

```ts
// PassiveStoryEntry 扩展（types/content.ts）
/**
 * 羁绊尾巴挂靠（§3）：引用演出本体 StoryDef id（与 hasCompletedStory/storyCompleted
 * 同语义）。该剧情完结后本 entry 强制优先推送进 owner 的对话空间；声明后退出随机
 * 抽取，队列优先级高于好感台阶。
 */
pushAfterStory?: string;
```

```ts
// src/data/base/ 示例：base:bond:hoshino_1 完结后收尾
passiveStory('base:affinity:hoshino_bond_tail', 'base:affinity:hoshino_bond_tail')
  .owner('Hoshino').repeatable(false)
  .pushAfterStory('base:bond:hoshino_1')
  .build();
```

### 流程状态机

```text
[入口] 剧情页 Talklet.kizuna 卡片（既有机制）→ data-kizuna → startCardStory
   ▼
[剧情] 关联 Story 演出（owner 壁垒内）
   ▼
[完成] storyCompleted（payload.storyId = 演出本体 id）
   │ 玩家正在该角色对话空间？ ── 是 → triggerTailPush 立即开始尾巴
   │                          └─ 否 → 尾巴留队列顶（readyStepCount 计未读）
   ▼
[尾巴] 尾巴 Story 经常规管线播出（Talklet 渲染与前置剧情同款式）
```

- **强制优先**：就绪队列排序中尾巴（声明序）恒在好感台阶之前；`pickAffectionStep` / `clickSend idle` 消费顺序一致。
- **即时推送（UI 侧）**：`controller-events` 订阅 `storyCompleted`，匹配「`pushAfterStory === event.storyId` ∧ 尾巴 owner = 当前对话空间 ∧ 完结剧情 owner 一致（或全局）∧ 尾巴未播过」→ `StoryService.triggerTailPush`（skipConditions，完结本身即入口判定）。
- **未推送不丢**：即时推送失败（游标占用 / 不在空间）只影响时机——尾巴留在队列顶，由打开空间（输入中提示后）/ 点击发送送达。

### 边界规则

- 完结剧情 owner 与尾巴 owner 不匹配（其他角色沙盒 / 全局游标主线）**不触发**即时推送。
- 尾巴未播过判定走 `hasCompletedStory(tail.storyId)`：播过即出队，重复完结不重推。
- 尾巴是普通 PassiveStory 演出：占用该沙盒游标，可被 active 打断 / `interruptible` 语义照旧；不新增抑制规则。

### 引擎接线点

| 文件 | 职责 |
| --- | --- |
| `types/content.ts` | `PassiveStoryEntry.pushAfterStory?: string` |
| `game/story-flow.ts` | `triggerTailPush`（定向推送）+ 队列谓词尾巴分支 + 随机抽取排除 |
| `game/story-service.ts` | `triggerTailPush` / `readyStepCount` 门面 |
| `src/ui/controller-events.ts` | `storyCompleted` → 空间内即时推送 |
| `src/data/base/character-rework.ts` | `base:bond:hoshino_1` 的尾巴条目示范 |

### 测试清单（已覆盖于 `tests/engine/affection-system.test.ts`）

- 关联剧情完结后尾巴即入队；未完结不入队、定向推送返回 NoAvailableStory
- `triggerTailPush` 定向开播尾巴；播过后出队、再推被拒
- 尾巴强制优先于好感台阶（队列顶先尾巴，其后按需求值）
- 尾巴退出随机抽取；owner 不匹配不触发；游标占用返回 AlreadyActive

---

## §4 Talklet 输入中提示（预出现省略号，未实现 — 2026-08-29 策划）

### 玩法需求（验收口径）

1. 任意 `kind:'talk'` 的 Talklet 可声明 `typing?: number`（毫秒）：本页内容进入聊天流**之前**，先以同说话人 / 头像 / 气泡侧渲染一个动态省略号气泡（"正在输入…"），持续声明时长后**自动替换为本页内容**——现实聊天的"对方在打字 → 消息送达"节奏。
2. 玩家加速（快速点发送）**不丢内容**：typing 未结束就推进时，取消提示并**立即补落该页内容**——typing 只是节奏装饰，不是交互闸门。
3. 纯 UI 节奏服务：不写 PlayerState、不进存档契约（纪律 #4；持久化聊天历史中过滤 typing 条目）。

### 与已实现的"空间级"提示的分工

| 层级 | 触发时机 | 载体 | 状态 |
| --- | --- | --- | --- |
| 空间级 | 队列非读、故事**尚未开始**（打开对话空间 → 推送队列顶） | `scheduleTypingPush` + `PanelState.typingVariantId` + `.chat-typing` | **已实现**（§2） |
| 页级（本节） | 故事已开始，**某条 talk 消息送达前** | `Talklet.typing` 声明 + `ChatStream` 指纹状态机 | 未实现 |

两者互补：推送瞬间空间级提示让位，进入故事后由页级接管逐条节奏。

### 数据声明（Talklet 新字段，无引擎状态）

```ts
// Talklet（types/content.ts）
/**
 * 预出现输入中提示（毫秒）：本页 talk 内容进流前，先渲染同 speaker/avatar/side
 * 的动态省略号气泡，持续该时长后替换为本页内容。0 / 缺省 = 关闭。
 * 仅 kind='talk' 生效；建议 600–1200ms，实现侧夹取上限（防数据笔误冻结聊天流）。
 */
typing?: number;
```

### 实现设计（UI 侧，落在 ChatStream 指纹状态机）

- `ChatEntry.kind` 增 `'typing'`：渲染复用 renderTalk 的气泡骨架（头像/名字/侧向），正文为 `.chat-typing` 三点动画（样式已存在）。
- `ChatStream.syncCurrentStory`：指纹变化 → 先 **cancelTyping**（移除旧气泡 + **补落旧页内容**，防快进丢内容；pending 载荷随计时器保存）→ 若本页 `typing > 0` 且 `kind === 'talk'`：压入 typing 条目（id = `typing:${fingerprint}`）、记账指纹防重复触发、起计时器 → 到期后校验指纹未变（剧情未被推进/清空）则移除气泡并落内容，否则仅移除气泡。
- `clearAll` / `reset()`（读档/软重启）取消计时并清 typing 条目；`withHistories` 持久化时过滤 `kind === 'typing'`（瞬态条目不入档）。
- choice 页：正文文本参与 typing；选项卡片本就等确认后才渲染（`sendState.confirmed`），不受影响；确认点击发生在 typing 期间时按补落规则立即落文本。
- narration / click / kizuna 页、`pushAbsorbed` 过渡页：**忽略** typing（回归不变）。

### 接线点

| 文件 | 职责 |
| --- | --- |
| `types/content.ts` | `Talklet.typing?: number` 字段（TSDoc @label） |
| `def-factory/talklet.ts` | `typing(ms)` builder 方法 |
| `src/ui/chat-stream.ts` | 指纹状态机 typing 分支：计时 / 取消 / 补落 / 瞬态条目管理 |
| `src/ui/components/story.ts` | `ChatEntry` 增 `'typing'` 分支渲染 |
| `tools/datapack-editor/schema/editor-extras.ts` | `storiesTable` 的 talklet 对象补 `typing` 字段（Talklet 为 HAND 类型，不走 gen:schema） |

### 测试清单（UI 侧，`tests/ui/`）

- 声明 typing 的页：进流顺序 = 省略号气泡 → 计时后移除气泡、落内容（同说话人样式）
- 计时内玩家推进：旧页内容立即补落、气泡移除，新页按自身声明处理
- 读档 / 软重启 / `clearAll`：计时取消、无残留 typing 条目；存档往返不含 typing 条目
- narration / click / kizuna / absorbed 页声明 typing：被忽略（回归不变）
- builder：`talklet.typing(ms)` 输出；时长夹取上限生效

### 开放点（实现前与用户对齐）

1. **absorbed 过渡页**是否第二迭代支持逐页 typing（需链式计时，第一迭代忽略）。
2. 是否提供"被动推送的首条消息默认打字"的全局默认（当前为纯声明式，数据不声明则无）。
3. **narration** 是否允许 typing（当前策划：不允许——旁白不是聊天气泡，无"对方"语义）。

---

## 相关文档

[[docs-828/03-data-structures/character-entities]] · [[docs-828/02-modules/story]] · [[docs-828/04-algorithms/roster]] · [[docs-828/05-conventions/architecture-discipline]]
