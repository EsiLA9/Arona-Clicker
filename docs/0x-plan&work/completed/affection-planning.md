# 06-adr/planning — 好感度系统设计（数值 / 台阶推送 / 羁绊尾巴 / 输入中提示）

- **状态**：已实现（2026-08-29 落地；同日修订：聊天消息成分按用户裁定移除、§4 页级打字提示与按钮门控/想回复阶段落地并移除空间级大省略号，见各节修订记录）
- **事件更名注记（2026-09-11）**：好感入账事件 `affectionChanged` 已由伞事件 `characterProgressChanged(domain:'affection')` 取代；`RosterEntry` 更名 `VariantProgress`（见 [[docs/0x-plan&work/active/adr-0008-character-progression-boundaries]]）。本文其余机制描述不变。
- **来源**：docs-824 的 03g / 04i / 04j 三篇规划文档合并迁移
- **依赖顺序**：好感数值（§1）→ 台阶推送（§2）→ 羁绊尾巴（§3），逐层叠加
- **实现落定**（与原规划的差异，均为与用户对齐后的裁定）：
  - **轴 A（ChatMessageDef 静态消息）整体移除**（2026-08-29 用户裁定：该成分本就不该实现）：`ChatMessageDef` 表、`chatMessages` 数据、消息推送/已读/奖励结算全部删除；既有 `chatRead` / `markChatRead` / `chatReadChanged` 基础设施保留（当前无写入方）。
  - **未读迁移到对话空间**：未读 = 该角色**就绪队列条数**（`StoryService.readyStepCount`）；通讯录徽标与对话空间头部「N 条未读」同源；打开空间且队列非空时**立即推送**队列顶——"正在输入…→ 送达"节奏由页级打字提示承担（§4，2026-08-29 修订：原空间级大省略号已移除）。
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

- 好感值**内嵌 RosterEntry**，随 `characterPersistConfig.roster` 归属层自动进出存档与 per-Init 快照——**无需改快照/存档任何一处**（快照机制见 [[docs/docs-828/01-architecture/state-layers]]）。
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
| `src/data-services/contracts/datapack.ts` | `Datapack.affectionConfig?` 表挂载 |
| `registry/registry.ts` | 解析 affectionConfig + 引擎默认值（配置型，恒 global 语义） |
| `system/state-mutation-service.ts` | `addAffectionExp`（写入口）；`acquireCharacter` 建 entry 时初始化 1/0 |
| `system/roster-system.ts` | 只读 `affectionLevelOf / affectionExpOf / affectionLevelCapOf`（含星级锁） |
| `types/expression.ts` | `ConditionTarget` 加 `affectionLevel`（key=VariantId，缺失→0）；`EffectOp` 加 `addAffectionExp` |
| `system/effect-ops.ts` + `condition-system.ts` | 两个新分发分支（注册表化，见 [[docs/docs-828/02-modules/effect-trigger]]） |
| `src/arona-clicker/contracts/event-catalog.ts` | `affectionChanged { variantId, delta, newLevel, newExp }`（登记进 `EVENT_CATALOG`） |

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

> 实现归属更新（2026-09-02）：当前 `PassiveStoryEntry` 契约位于 `src/data-services/contracts/story-entry.ts`，被动池与剧情流程位于 `src/arona-clicker/services/`；下方早期设计表中的旧路径仅保留作为方案演进记录。

### 玩法需求（验收口径）

1. 存在**好感台阶式剧情**：好感达标后**即刻进入就绪队列**，该角色对话空间在合适条件下**按需求值序列自动推送**一条**未经历过**的台阶剧情（渐进式剧情披露）。
2. **未读个数**在通讯录与对话空间 UI 协同显示；未读 = 就绪队列条数。
3. 打开有未读的对话空间时**立即推送**内容；"正在输入…→ 送达"节奏由 §4 页级打字提示承担（2026-08-29 修订：原空间级输入中省略号已移除）。

### 轴 A（ChatMessageDef 静态消息）——已移除

原规划的消息轴（`ChatMessageDef` 扩展 `repeatable / affectionRequired / affectionExpReward`、可用消息过滤、未读气泡、`markChatRead` 内结算奖励）于 **2026-08-29 按用户裁定整体移除**：该成分本就不在用户意图内，消息的"满足条件后推送、点击读取、点击给效果"模式一并废弃。保留的既有基础设施：`chatRead` / `markChatRead` / `chatReadChanged`（当前无写入方，供未来读追踪复用）。本节以下仅描述存活的**轴 B（台阶剧情）**。

### 轴 B：好感台阶剧情（就绪队列 · 渐进式剧情披露）

> 台阶剧情走演出轴而非消息轴：免费获得 Talklet 多页/选项/Effects/Story 跳转与 `storyReadLogs` 记录，并与 §3 羁绊尾巴天然衔接；代价是每条都是一次完整剧情启动/结算，不适合海量一句话碎聊（那是轴 A 的位置）。

#### 需求 → 现有机制映射（已逐条核对引擎代码）

| 需求 | 机制 | 锚点 |
| --- | --- | --- |
| 只在该角色聊天流抽取 | `PassiveStoryEntry.owner = VariantId`（聊天空间壁垒） | `src/arona-clicker/services/passive-pool-system.ts` `pick` 的 ownerOk 剪枝 |
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

- **进入即推（立即）**：玩家进入该角色对话空间时，若队列非空且该沙盒无进行中演出，**立即自动推送**队列顶（复用 `startStory` 管线，owner 壁垒内）；"正在输入"节奏由推送剧情的首个 talk 页打字提示承担（§4，非右侧 talk 页默认 0.9s）。
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
| `src/data-services/contracts/story-entry.ts` | `PassiveStoryEntry.affectionRequired?: number` / `pushAfterStory?: string` 新字段 |
| `story-flow.ts` | `readyStepIds` / `pickAffectionStep` / `triggerAffectionPush` / `triggerTailPush` |
| `src/ui/controller-actions-contacts.ts` | `data-select-variant` 打开对话空间 → 输入中提示 + 延时推送 |
| `src/ui/controller-events.ts` | `storyCompleted` → 尾巴即时推送（§3） |
| `src/arona-clicker/content/` | 正式台阶数据（builder 增 `affectionRequired`）；`src/data/base/` 仅用于测试/示例 |
| —（依赖） | §1 的 `affectionLevel` target 与 `addAffectionExp` op 先行 |

边界：`storyId` 与 `entry.id` 同值沿用现有惯例；台阶不声明进 `PassivePoolDef`（队列路径直接扫描 registry，池声明对台阶无意义）。

#### 轴 B 测试清单

- 达标即刻入队：需求满足前后推送可用性翻转；冷却内 / `triggerCondition` 不过则不入队
- 顺序：多条同时达标按需求值升序逐条放出；修改需求值即改变顺序
- readyStepCount：队列条数（未拥有 → 0；播出中不计；消费后递减）
- 推送时机：进入空间立即自动推一条（节奏由首条 talk 页打字提示承担）；完成后不自动连播、点击必中下一条；再次进入恢复自动推送
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

1. 剧情侧 **kizuna 卡片**（`Talklet.kizuna` 既有机制，`data-kizuna → storyGate 确认浮层 → startCardStory`，2026-08-29 起入口带确认）触发羁绊剧情演出。
2. 剧情完成后，其**羁绊尾巴**经就绪队列**强制优先推送**到该角色对话空间（正在观看时立即追加；不在则留在队列顶，打开空间立即推送送达）。
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
[入口] 剧情页 Talklet.kizuna 卡片（既有机制）→ data-kizuna → storyGate 确认浮层 → 确认 → startCardStory
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
- **未推送不丢**：即时推送失败（游标占用 / 不在空间）只影响时机——尾巴留在队列顶，由打开空间（立即推送）/ 点击发送送达。

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
| `src/arona-clicker/content/bond-content.ts` | `base:bond:hoshino_1` 的尾巴条目示范 |

### 测试清单（已覆盖于 `tests/engine/affection-system.test.ts`）

- 关联剧情完结后尾巴即入队；未完结不入队、定向推送返回 NoAvailableStory
- `triggerTailPush` 定向开播尾巴；播过后出队、再推被拒
- 尾巴强制优先于好感台阶（队列顶先尾巴，其后按需求值）
- 尾巴退出随机抽取；owner 不匹配不触发；游标占用返回 AlreadyActive

### 入口确认浮层与开幕标题横幅（2026-08-29 落地）

**入口确认浮层（storyGate）**：点击剧情入口不再直接启动，先在中心聊天窗格上叠加确认浮层（标题栏 + 角色名 + 剧情标题 + 进入/取消），风格对齐蔚蓝档案「好感故事」弹窗，功能优先。

- **覆盖入口**（用户裁定：卡片 + 故事栏全部条目）：`data-kizuna`（mode 'card'）/ `data-start-story`（mode 'active'）/ `data-replay-story`（mode 'replay'）。前两者点击时保留切 tab / 切对话空间行为，让浮层落在目标聊天窗格上。
- **状态驱动**：`PanelState.storyGate = { storyId, owner, mode } | null`，随全量 render 重建保持稳定；`data-story-gate-confirm` 按 mode 分派 `startCardStory` / `startActiveStory` / `replayStory`（原启动逻辑迁入）；`data-story-gate-cancel`（X / 取消按钮 / 遮罩空白，`event.target` 判定使卡片内冒泡不关闭）清状态。换流（`data-select-variant` / `data-conversation-back`）清 storyGate。
- **展示标题**：`StoryEntryBase.openingTitle`（声明字段，`@label 开幕标题`）优先，回退 `StoryDef.name`。

**开幕标题横幅**：聊天流中央横幅状背景 + 标题文本，展示/淡出期间**阻断该流的剧情推进点击**（发送/选项/卡片/闲聊抽取，发送按钮呈阻断态），结束后自动淡出移除。**默认不显示，由 Talklet 呼出**（用户裁定）：

```ts
// 呼出开关：挂在 Talklet.effects 上。首页声明 → 随剧情开始（含重读）立即呼出，
// 推进离开首页时跳过防重复；非首页声明 → 离开该页时呼出（幕间标题）。
narrate('——阿比多斯 · 堤防 · 午后——', 'center')
  .effects({ op: 'showOpeningTitle', target: '', value: '星野 · 午后的堤防' })
```

- **数据**：`StoryEntryBase.openingTitle?: string`（浮层展示标题 + 横幅回退标题）+ `EffectOp 'showOpeningTitle'`（`value` = 横幅标题字符串，覆盖式优先；空/缺省回退 `entry.openingTitle ?? StoryDef.name`）。
- **管线**：首页声明路径 = `beginStory` 直接发 `openingTitleShown { title? }`（emit `story-flow`）；非首页/演出效果路径 = `EffectEngine.runtimeEmit` → `chatFlowEffectRequested` → `RuntimeEffectReactor` → `ChatFlowService.showOpeningTitle(title?)`（emit `chat-flow-service`）→ UI `controller-events` 订阅 → `ChatStream.showBanner(streamKey, title)`（记录 startedAt，展示期满清除并触发重渲染）→ render 时经 `PanelState.openingBanner` 在 `.chat-pane` 渲染 `.story-opening-banner`。
- **连续播放（不闪动）**：聊天流打字门控/连发推进约每 0.4-0.9s 触发全量 render，重建横幅元素会重置 CSS 动画；渲染时按 `startedAt` 换算负 `animation-delay` 断点续播（超时长钳制到终值，forwards 定格），动画全程只播一次。
- **已完结卡片 = 正常重开（goto 语义，用户裁定）**：上游 Story 可被 PassiveStoryEntry 式重复抽取，本身即宣告「该事件可多次经历、分支探索」。卡片确认对已完结剧情由 `startCardStory` 的 `force` 直接重开（清游标 + 跳过 AlreadyCompleted），浮层文案「重新开始」；isReplay 保持 false——分支自由探索（choice 覆写同一 flag）、`branchGuards` 不约束卡片路径（仅约束故事栏重读）、重复完结奖励走 repeat 评估一般不发放、storyLog 追加记录经历次数。被 goto 丢弃的宿主被动剧情：闲聊可再抽；台阶/尾巴未完结仍留就绪队列，之后重新推送。`replayStory`（重看、受限）仅保留给故事栏重读入口。
- **主题预留接口**：两族组件（`.story-gate-*` / `.story-opening-banner`）样式全部消费主题令牌，组件级 CSS 变量（`--story-gate-*` / `--story-banner-*`，见 `css/story-overlays.css`）即 theme-tree 后续美化的覆写点，不改 DOM/类名即可重肤。

**测试清单**：`tests/ui/story-gate.test.ts`（三入口拦截 / 确认 / 取消 / 遮罩判定 / 横幅 3s 消失）+ `tests/ui/components/story-gate.test.ts`（标题解析 / 转义 / data 钩子）+ `tests/engine/chat-flow-service.test.ts`（showOpeningTitle → 事件链）。

---

## §4 Talklet 输入中提示（页级打字省略号，2026-08-29 落地）

### 玩法需求（验收口径，2026-08-29 与用户对齐；同日二次修订：门控与思考阶段）

1. **默认开启**：所有**非右侧**（NPC 侧）`kind:'talk'` 的 Talklet 页，内容进入聊天流**之前**，先以同说话人 / 头像 / 气泡侧渲染动态省略号气泡（"正在输入…"，表述该侧 chat 正在生成/回复内容），持续默认 **0.9s** 后自动替换为本页内容——现实聊天的"对方在打字 → 消息送达"节奏。气泡内节奏点**复用底部按钮的 `send-dots` 结构与动画**，点色跟随 theme-tree 的气泡文本色（`--ink-on-npc-bubble` / `--ink-on-player-bubble`）。
2. **数据可覆盖**：`Talklet.typing?: number`（单位**秒**，支持小数）——缺省 = 默认 0.9s；显式 `0` = 关闭；自定义值夹取上限 **10s**（防数据笔误冻结聊天流）。
3. **打字期按钮门控**：聊天流的省略时间未结束前，底部回复按钮**不显示回复文案**（无法提前看到要返回的消息内容）且**不可推进**；作为补偿，期间点击底部按钮每次将剩余时间**加速约 0.1s**。
4. **按钮"想回复"阶段**：消息送达后，底部按钮同样先"想回复"——只渲染节奏点（无文案），持续 `Talklet.thinking` 声明时长后**按钮文字出现**（sendText / "继续" / "点击"），之后照常推进（含经典按动次数 clickWork）。思考阶段点击同样每次加速约 0.1s。`thinking?: number`（秒）缺省 0.9s、`0` 关闭、上限 10s；资格谓词与 typing 相同。
5. **链式连发（三次修订）**：左侧 talk 页若**无任何按钮要求**（无 sendText 回复文案、无选项、无 clickWork 按动），送达后跳过"想回复"阶段，经**停顿拍**（默认 0.4s，门控阶段 `pause`）自动推进下一页——"省略号-发出-停顿-省略号-发出"接连不断，直到需要玩家接话的页（sendText 回复 / 选项 / 按动次数 / 右侧回话 / 旁白 / click / 羁绊）为止。停顿拍与打字/思考同属门控：按钮只显示节奏点、不可推进、点击加速 0.1s/次。
6. **连发分组渲染（四次修订）**：聊天流中同人同侧相邻的简单 chat（talk/typing 条目，speaker / avatar / 气泡侧 / 玩家身份 / noAvatar 形态全同）为一组，**仅组内首条渲染头像与名称**，后续条目只出现气泡（**同时隐藏气泡小三角**，`.chat-bubble-continued`），并以同尺寸不可见头像占位（`.chat-avatar-ghost`）保持与首条气泡的缩进对齐；旁白 / 系统行 / 奖励行 / 他人回复等条目打断分组。`Talklet.showAvatar?: boolean`（builder `showAvatar()`）强制该页完整显示头像与名称（保留三角）。分组在渲染期由相邻条目推导（不入档、无状态）。
7. **忽略范围**：右侧气泡（`side:'right'`，玩家/对话方侧）、narration、click、kizuna 页、`pushAbsorbed` 过渡页不产生打字/思考门控，也终止连发链；choice 页正文参与打字，选项卡片在门控结束前不可达（"继续"确认按钮被门控）。
8. **纯 UI 节奏服务**：不写 PlayerState（门控阶段仅作 render 期快照）、不进存档契约（纪律 #4；持久化聊天历史过滤 typing 条目）。

### 修订记录（2026-08-29）

- **移除空间级大省略号**（§2 原实现）：打开对话空间不再先展示独立省略号块 + 900ms 延迟，改为**立即推送**队列顶；"正在输入"节奏整体移交本节页级提示。`PanelState.typingVariantId` / `ctrl.typingTimer` / `scheduleTypingPush` 延迟 / `renderConversationView` 的独立省略号块随之删除。
- **单位从毫秒改秒**：`typing` 以秒声明（支持小数如 0.9）。
- **原开放点落定**：非右侧 talk 页全局默认打字（原开放点 2，用户裁定默认开启）；absorbed 逐页 typing 维持第二迭代（原开放点 1）；narration 维持不允许（原开放点 3）。
- **二次修订（实际效果驱动）**：①打字气泡改用 `send-dots` 渲染结构，点色跟随 theme-tree 气泡文本色；②typing 从"纯装饰"改为**按钮门控**——打字期间按钮无文案、不可推进、点击加速 0.1s/次；③新增按钮**"想回复"阶段**（`Talklet.thinking` 独立字段，用户裁定不与 typing 共用旋钮），消息送达后按钮先思考再出文字，之后走经典按动次数（clickWork）。
- **三次修订（链式连发 + 停顿拍）**：无按钮要求的左侧页送达后自动推进下一页，节奏为"省略号-发出-停顿-省略号-发出"（停顿拍 0.4s，门控阶段 `pause`，同样可点击加速）；实现为 ChatStream 送达后节奏决策（`chainEligible` → pause 门控 → `scheduleAutoAdvance` 指纹守卫）+ `controller.onAutoAdvance` 对该流执行一次 `clickSend` 单页推进（引擎 clickSend 每次恰好推进一页，absorbed 恒为空）。
- **四次修订（连发分组渲染）**：同人同侧相邻简单 chat 仅首条显示头像/名称，后续只出现气泡（ghost 头像占位保持缩进）；`Talklet.showAvatar` 强制完整显示。分组为渲染期推导，无状态、不入档。

### 数据声明（Talklet 新字段，无引擎状态）

```ts
// Talklet（types/content.ts）
/**
 * @label 输入中提示（秒）
 * 页级"正在输入"节奏：本页 talk 内容进聊天流前，先渲染同 speaker/avatar/side
 * 的动态省略号气泡（send-dots 结构），持续该时长后替换为本页内容。
 * 打字期间底部按钮门控（无文案 / 不可推进 / 点击加速 0.1s）。
 * 缺省 = 非右侧 talk 页默认 0.9s；显式 0 = 关闭；自定义值夹取上限 10s。
 * 仅 talk 生效（narration/click/kizuna 页与右侧气泡忽略）；纯 UI 节奏，不入存档。
 */
typing?: number;
/**
 * @label 想回复（秒）
 * 底部回复按钮的"想回复"节奏：本页内容送达后、按钮文案出现前，按钮仅渲染节奏点
 * （不可推进，点击可加速），持续该时长后文字出现，之后照常推进（含 clickWork）。
 * 缺省 = 非右侧 talk 页默认 0.9s；显式 0 = 关闭；上限 10s；资格与 typing 相同。
 */
thinking?: number;
```

### 实现设计（UI 侧，落在 ChatStream 门控状态机）

- `ChatEntry.kind` 增 `'typing'`：渲染复用 renderTalk 的气泡骨架（头像/名字/侧向），正文为 `send-dots` 三点（blink 动画与底部按钮同源；点色经 `.chat-bubble-* .send-dots i` 覆写为 theme-tree 气泡文本色）。
- `ChatStream`：
  - 指纹按**流**记账（`Map<streamKey, fingerprint>`，streamKey = 对话空间 variantId ?? 全局）——切换流不误判推进、返回原流不重复落页。
  - 门控按**流**记账（`Map<streamKey, GateState>`，`endsAt` + 计时器，阶段 `typing / pause / thinking`）：typing 期压入 typing 条目；到期 **deliver**（打字条目原位替换为内容，保序）并做节奏决策——`chainEligible`（左侧 talk 且无 sendText/选项/clickWork）→ pause 停顿拍 → 到期连发推进下一页；否则 → thinking 门控 → 到期解除（按钮文字出现）。各阶段流转经 `onChange` 触发重渲染。
  - 连发推进经 `scheduleAutoAdvance`（0ms 计时器 + 指纹守卫防竞态）交还 `controller.onAutoAdvance(streamKey)`：view 存在守卫 → `clickSend(owner)` 单页推进 → 定向 `pushAbsorbedTo` → render。`typing:0` 的合格页内容直接落流后同样走停顿拍连发。
  - `activeGate(panelState)` 返回当前活跃流门控阶段；`accelerateActiveGate` 把剩余时间 −0.1s（`endsAt` 前移 + 重排计时器，归零立即完成该阶段），对三阶段一律生效。
  - 防御路径：同流指纹变化（外部剧情变动）→ typing 期内容立即落流 / 门控与连发解除；跨流切换不干扰他流门控。
  - `clearAll`（chatFlowCleared）解除该流门控与连发；`reset()`（读档/软重启）全量解除；`withHistories` 持久化过滤 `kind === 'typing'`（瞬态条目不入档）。
- **按钮门控渲染**：`PanelState.sendGate`（render 期由 `activeGate` 计算的快照）→ `renderSendButton(sendState, gate)` 门控分支只渲染 `send-dots`（无 `send-text`/箭头/进度，按钮仍可点）；点击处理器（`[data-send]`）检测到门控时**不调 `clickSend`**，仅 `accelerateActiveGate`。choice 页门控期"继续"确认不可达 → 选项卡片天然被挡在门外。

### 接线点

| 文件 | 职责 |
| --- | --- |
| `types/content.ts` | `Talklet.typing? / thinking?: number` 字段（TSDoc @label，单位秒） |
| `def-factory/talklet.ts` | `typing(seconds) / thinking(seconds)` builder 方法 |
| `src/ui/chat-stream.ts` | 门控状态机：按流指纹 + GateState（typing/thinking）/ deliver / 加速 / onChange |
| `src/ui/controller.ts` | 注入 `chat.onChange = render` 与 `chat.onAutoAdvance`（连发：view 守卫 + 单页 clickSend + 定向 absorbed）；render 期计算 `panelState.sendGate` |
| `src/ui/components/app-shell.ts` | `PanelState.sendGate` 快照传递 |
| `src/ui/components/center-panel.ts` | `renderSendButton(sendState, gate)` 门控分支（仅节奏点） |
| `src/ui/components/contacts.ts` | 对话空间底部按钮同门控 |
| `src/ui/controller-actions-story.ts` | `[data-send]` 门控期 → `accelerateActiveGate`（不推进） |
| `src/ui/components/story.ts` | `ChatEntry 'typing'` 分支渲染（send-dots 气泡）；连发分组：`sameChainGroup` 推导 + `hideIdentity` 渲染（ghost 头像占位） |
| `src/ui/css/chat.css` | `.chat-bubble-* .send-dots i` 点色 = theme-tree `--ink-on-*-bubble`；`.chat-avatar-ghost` 分组缩进占位 |
| `src/ui/controller-core.ts` | `withHistories` 过滤 typing 条目 |
| `tools/datapack-editor/schema/editor-extras.ts` | `storiesTable` 的 talklet 对象补 `typing / thinking` 字段（Talklet 为 HAND 类型，不走 gen:schema） |

### 测试清单（`tests/ui/chat-typing.test.ts`，已覆盖）

- 默认打字：非右侧 talk 页进流 = 省略号气泡 → 0.9s 后替换为内容（同说话人/侧向）
- 数据覆盖：`typing:0` 立即落内容；`typing:2` 按 2s；`typing:20` 夹取 10s
- 右侧气泡 / narration / click / kizuna / absorbed：无打字提示（回归不变）
- 门控链：typing → 送达 → thinking → 解除；`thinking:0` 关闭；`thinking:2` 独立时长；`typing:0` + thinking 缺省仍思考
- 链式连发：省略号-发出-停顿-省略号-发出（typing 0.9s + pause 0.4s 停顿拍）；sendText / 选项 / clickWork 页停下进入 thinking；`typing:0` 链；末页连发到剧情完结自然终止；外部推进 / 剧情清空取消待执行连发
- 点击加速：每击 −0.1s，9 击打完打字阶段进入思考、再 9 击解除
- 推进补落（防御路径）/ 完结补落 / clearAll / reset：内容恰好落一次、无残留
- 跨流切换：他流门控不受影响，到期内容落入原流；返回原流不重复落页
- 门控态按钮渲染：仅 send-dots、无 send-text 文案；打字气泡复用 send-dots 结构
- 连发分组：同人相邻仅首条显示头像/名称（后续 ghost 占位）；换人 / 旁白 / 玩家回复打断重排；typing 条目参与分组；`showAvatar` 强制完整显示
- 存档往返不含 typing 条目；builder 输出

---

## 相关文档

[[docs/docs-828/03-data-structures/character-entities]] · [[docs/docs-828/02-modules/story]] · [[docs/docs-828/04-mechanisms/roster]] · [[docs/docs-828/05-conventions/architecture-discipline]]
