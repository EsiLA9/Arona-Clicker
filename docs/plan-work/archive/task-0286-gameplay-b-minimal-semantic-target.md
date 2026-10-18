# Task：玩法 B 最小语义闭环裁定

状态：completed — 探索裁定见 [[report-0286-gameplay-b-minimal-semantic-ruling]]；推荐默认值供下一轮预期地图讨论使用，不是施工规格。

## 1. 设计目标

先说明玩家在玩什么，再决定数据怎样表达、Runtime 怎样实现。本 Task 不以现有 Operation 体系作为目标，也不建立一套更漂亮的新框架；它只确定玩法 B 最小体验及其必要语义关系，为之后单独讨论预期地图提供共同基准。

### 最小闭环

```text
                         MAP
                          │
                         移动
                          ↓
                         NODE
                          │
                         进入
                          ↓
                     ENCOUNTER
                          │
              ┌───────────┴───────────┐
              ↓                       ↓
         Character                  Player
              │                 Cost / Ability / Item
         Tendency                         │
              ↓                           │
        Draw Action ←──────── Intervention
              │
              ↓
            Effect
              ↓
          State change
              │
             End?
           ┌──┴──┐
          No     Yes
          │       │
          └───────┘
                  ↓
                 MAP
```

### 最小语义关系

```text
Map：包含 Nodes 和 Edges
Node：地图位置，可关联至多一个当前 Encounter
Encounter：参与者、当前可用行为、局内状态、结束条件
Character：Tendency 影响从当前可用行为中抽到什么
Action：行为、目标、Cost 和 Effect
Player：可等待、切换或干预；Ability / Item 的具体规则暂不规定
```

以上是**需要能表达的玩法关系，不是新增同名 Schema、Runtime 类型或类的要求**。

### 硬原则

- **Map 与 Encounter 分开。** 遭遇结束后回到地图；“地点完成后强制选下一 Route”不等于自由地图移动。
- **普通 Encounter 不需要 Scene / Phase。** 第一阶段 Node 至多关联一个当前 Encounter；多 Encounter、多阶段和任务编排暂不进入核心。
- **Battle 是基准，Rest / Shop 是变体。** 先尝试用参与者、可用行为、状态和结束时机的不同组合表达，不因名字不同就建三套核心 Engine。
- **Tendency 与自动规划分开。** Tendency 决定更容易抽到什么；无人干预时怎样自动选行动是另一个问题。
- **不为了统一而统一。** 玩家 Ability、Item、角色行动可保留不同持有、抽取、时机和生命周期；共享可见语义才考虑合并，共享结算不要求共用数据结构。
- **复杂 Runtime 可以留在内部。** 原子结算、预览、随机数和存档不必变成作者必须理解的玩法名词。
- **现有数据和兼容不约束目标。** 若旧结构不合适，可在后续施工时决定迁移或放弃；不得为兼容旧结构而扩大最小模型。
- **不得为了实现目标再造复杂抽象。** 每个进入第一阶段核心的新概念，都必须直接对应玩家体验、内容表达或 Runtime 正确性需求。

## 2. 背景内容：当前实现事实

以下只列事实，不把它们当作目标要求或设计建议。

| 事实 | 来源 |
| --- | --- |
| 一个 Operation Event 定义多个 Location；一个 EventRun 会沿 Location / Route 持续运行 | `src/data-services/contracts/operation.ts`、`src/arona-clicker/services/operation-runtime-service.ts` |
| 当前 Route 需在地点完成后提交；没有独立的 Gameplay B 自由移动 Map Run | `tests/engine/gameplay-b-route-sample.test.ts`、`tests/ui/gameplay-b-strategy-park-map.test.ts` |
| Character Hand 是按条件和倾向抽出的 Action ID 列表，不是实体弃牌堆；Profile 优先级另行影响自动计划 | `src/arona-clicker/services/operation-card-candidate-resolver.ts`、`src/arona-clicker/services/operation-plan-preparation.ts` |
| Combat 可修订一名学生的行动/目标；当前 intervention 不扣 PlayerCost | `src/arona-clicker/contracts/operation-beat.ts`、`src/arona-clicker/services/operation-intervention-preview.ts` |
| PlayerSceneDeck 是 Scene 牌组；StudentSkillRule 是概率触发，不等于玩家主动 Ability / Item 使用 | `src/data-services/contracts/operation.ts`、`src/arona-clicker/contracts/operation.ts` |
| Scene 可省略并由隐式 `main` 承接；Preview / Commit / Resolution 与只读 View 分开 | `src/data-services/contracts/operation.ts`、`src/arona-clicker/contracts/operation-view.ts`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` |

完整实现调查见 [[report-0285-gameplay-b-core-semantics-reduction]]。本 Task 可彻底重想目标，不以这些数据结构或兼容性为前提。

## 3. Task 计划

本 Task 只裁定玩法行为与核心语义，不产出地图设计、Schema、API 或迁移计划。

### 必须讨论的四件事

1. **移动：**玩家如何从当前 Node 移动到另一个 Node？这里只确定玩法规则，不定地图形状、区域、坐标或 UI。
2. **进入：**玩家怎样进入 Node 上的 Encounter？
3. **结束与回图：**Encounter 何时结束？结束后怎样结算并回到 Map？
4. **抽卡与干预：**角色何时抽行为卡？玩家能等待、切换或干预什么？玩家不操作时发生什么？

每项用简短规则和玩家可观察的例子说明；需要地图设计才能确定的细节标为“暂不裁定”。

### 最小验证：Battle 优先

```text
Map → Node → Battle Encounter
→ 一名角色按 Tendency 抽行为
→ 玩家观察并等待/干预
→ Action 产生 Effect
→ Encounter 结束
→ 返回 Map
```

随后只用三个简例验证是否沿用同一核心循环，不要求一次设计所有内容：

- **Rest：**角色抽到休息/闲聊等行为，到达规定时机后结束回图。
- **Shop：**玩家选择 offer、支付资源并获得结果，离开后回图。
- **Branch：**Map Edge 决定可前往的 Node；路径本身不是 Encounter。

### 当前概念定性

对当前实现中的主要概念简要标注 Core / Internal / Advanced / Deferred / Replace，避免改名后继续沿用相同的复杂关系。

| 当前概念 | 定性起点 |
| --- | --- |
| Operation Event / Location | 现有整段任务与地点结构，不是目标模型的默认模板 |
| Scene / SceneAction | 基础闭环不需要；复杂阶段或特定入口以后另议 |
| Profile / CardPool / StrategyProfile | Tendency 与当前可用行为属于核心；这些独立对象是否存在不预设 |
| Character Hand | 抽取行为是核心；Action ID 列表只是现有表示 |
| Player Scene Deck / Combination / Team / PurchaseOffer | 不属于最小闭环的前置条件 |
| EventRun / Plan / Preview / Commit / Resolution / Save / RNG | 现有内部基础设施；可复杂，不要求进入玩家语义 |
| Condition / Effect | 支撑行动条件、结束判断和状态变化；不设计万能 DSL |

这些只是讨论起点；不得为了填满分类而新增概念。

### 本 Task 明确暂不裁定

- 具体地图形状、节点数量、区域、坐标、地图 UI 和预期地图内容；本 Task 完成后再与上层 Chat 单独讨论。
- Ability / Item 的具体数据结构、来源、冷却与生命周期。
- 多 Encounter、多 Phase、复杂 CardPool / StrategyProfile、自动 AI、Player Deck 构筑、Party mutation。
- 通用商店经济、奖励选择池、存档迁移，以及 `Encounter` / `Action` 是否对应独立代码类型。

本 Task 不因上述事项未定而扩张核心模型。

## 4. 交付与验收

交付一份简短裁定稿，包含一张核心循环图、四项行为规则、Battle 基准及三个变体、当前概念定性，以及明确的暂不裁定事项。结论应足以指导下一轮预期地图讨论，但不代替那轮讨论。

- [x] 能用一张图说明 Map → Node → Encounter → Draw → Intervention → Effect → Map。
- [x] Map / Node / Encounter 关系清楚，不把现有 Route 推进说成自由地图移动。
- [x] 角色 Tendency、行为抽取和玩家干预构成第一层玩法语义；作者不必先理解 Operation / Scene / CardPool。
- [x] Battle 是基准；Rest / Shop 是变体；Branch 由 Map Edge 表达，不需要并列核心 Engine。
- [x] 明确哪些问题留待预期地图讨论；没有代码、Schema、迁移或施工授权。

## 5. 非目标

- 不设计具体地图、节点排布或地图 UI；下一轮再与上层 Chat 讨论预期地图。
- 不提供新 Schema、类图、API、Runtime Owner 或实现分期。
- 不修改 Operation、不迁移/删除现有数据，也不建立兼容适配层。
- 不把当前模型换一批名字后当作目标模型。

## 相关文档

- [[report-0285-gameplay-b-core-semantics-reduction]]：当前实现调查。
- [[report-0286-gameplay-b-minimal-semantic-ruling]]：本 Task 的探索结论与下一轮讨论边界。
- [[draft-0284-gameplay-b-current-system-and-improvement-discussion]]：玩法 B 综合讨论底稿。
- [[docs/ai/goal-workflow]]：设计裁定和 Task 流程。

## 执行记录

- 2026-10-17：完成四项核心行为的推荐默认规则，并以 Battle 为基准、Rest / Shop / Branch 为变体验证最小闭环；概念定性与暂缓项见裁定稿。
- 结论是探索建议，供下一轮与上层 Chat 讨论预期地图时确认或调整；具体地图形状和内容仍未裁定。
- 未修改源码、Schema 或现有数据；未运行测试。文档静态检查与差异空白检查在本次收尾执行。
