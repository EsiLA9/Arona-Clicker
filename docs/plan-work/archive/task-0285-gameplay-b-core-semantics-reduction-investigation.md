# Task：玩法 B 核心语义缩减调查与定性

**状态：completed — 只读调查与定性完成；结果见 [[report-0285-gameplay-b-core-semantics-reduction]]。**

## 一、任务目的

对 AronaClicker 当前玩法 B 的实际实现进行一次**面向原始玩法设想的结构性调查**，确认当前实现是否已经在“能够表达玩法 B”之外，引入了过多的任务编排、场景、行动、角色策略、卡组、目标与结算层级。

本 Task 的目标**不是继续扩展当前玩法 B，也不是简单整理现有代码**，而是回答一个更基础的问题：

> **如果从最初设想的玩法 B 出发，而不是从当前已经实现的 Operation 体系出发，AC 到底需要哪些最小的一等概念？当前实现中的哪些结构必须保留，哪些应该降级为内部实现，哪些应该合并，哪些应该暂缓，哪些确实属于过度设计？**

调查必须以**最初玩法 B 的实际游玩体验**作为第一原则，而不能以当前代码结构作为设计前提。

最终需要形成一个可以指导后续施工的明确结论：

```text
原始玩法 B
    ↓
最小语义模型
    ↓
当前实现逐项映射
    ↓
保留 / 隐藏 / 合并 / 后置 / 删除
    ↓
后续施工边界
```

本 Task 本身以**调查、确认、定性和提出施工边界**为完成标准，不要求在本 Task 内完成大规模代码重构。

---

# 二、原始玩法 B 的基准定义

后续所有判断必须首先以以下玩法体验作为基准，而不是以当前 Operation 设计作为基准。

## 2.1 玩家实际体验

玩法 B 的基本循环是：

```text
玩家位于一张简单地图
        ↓
在地图节点之间自由移动
        ↓
进入一个地点
        ↓
地点触发一个事件 / 场景
        ↓
当前持有的角色参与事件
        ↓
角色不是由玩家直接从 N 个动作中选择一个
        ↓
角色根据自己的倾向
从当前场景允许的行为中抽取行为卡
        ↓
玩家观察当前行为
        ↓
玩家可以等待、切换、手动干预
        ↓
必要时消耗自己的 Cost
        ↓
要求角色执行特定行为
或使用玩家自己的技能
        ↓
也可以使用玩家持有的道具
        ↓
行为产生 Effect
        ↓
事件状态发生改变
        ↓
继续行动 / 事件结束
        ↓
回到地图
        ↓
继续移动
```

核心不是传统的：

```text
选择角色
→
选择一个菜单项
→
立即执行
```

而是：

```text
角色倾向
    ↓
行为候选
    ↓
抽取行为卡
    ↓
玩家观察与干预
    ↓
行为执行
```

因此：

> **“角色倾向 + 行为卡 + 玩家即时干预”是玩法 B 的核心机制，而不是附加功能。**

---

# 三、原始玩法 B 的场景范围

最初版本只要求支持以下基本场景类型。

## 3.1 经典战斗

```text
友方角色 + 玩家
        vs
      敌人

       ↓

不断产生角色行为卡
       ↓
玩家使用 / 切换 / 干预
       ↓
Effect
       ↓
直到战斗结束
```

---

## 3.2 休息

```text
友方角色 + 玩家

       ↓

按照场景抽取若干轮行为卡
       ↓
执行行为
       ↓
经过规定轮数
       ↓
事件结束
```

休息与战斗不应天然需要两套完全不同的运行机制。

它们主要区别在于：

```text
参与者不同
+
可用行为不同
+
结束条件不同
```

---

## 3.3 购物 / 交换

包括：

```text
真实购买

资源
 ↓
商品
```

以及：

```text
奖励选择

奖励池
 ↓
A / B / C
 ↓
玩家选择
```

第一阶段不要求把购物、奖励、交换分别发展成完整的经济系统。

---

## 3.4 高级行为

例如：

```text
加入队伍
离开队伍
更换角色
使用特殊物品
```

这些行为可以改变玩家状态，但不应因为存在这些行为，就额外建立一套复杂的“高级行为编排系统”。

---

## 3.5 路径分歧

地图可以是：

```text
A ── B ── C
 \
  └─ D ── E
```

玩家在节点之间移动。

路径可以存在条件：

```text
A
├── B   [拥有钥匙]
└── D   [默认]
```

因此最小地图模型只需要能够表达：

```text
Node
+
Edge
+
Edge Condition（如果需要）
```

不应为了路径分歧额外产生完整的任务分支系统。

---

# 四、原始玩法 B 的最小概念模型

调查时必须首先尝试证明以下模型是否足够，而不是从当前模型反推。

候选最小模型：

```text
Map
├── Node[]
└── Edge[]

Event
├── type
├── actors[]
├── availableActions[]
├── state
└── endCondition

Character
├── tendencies
└── availableActions / action references

Action / Card
├── actor / source
├── tags
├── cost
├── condition
└── effects[]

Player
├── party
├── cost
├── items
├── resources
└── player abilities

Effect
Condition
```

从玩家视角可以进一步压缩为：

```text
地图
 ↓
地点
 ↓
事件
 ↓
角色
 ↓
行为卡
 ↓
Effect
 ↓
状态改变
```

而：

```text
Condition
Cost
Item
Player Ability
```

是围绕这个循环提供条件和干预的机制。

**以上模型只是调查基准，不是预先宣布必须采用的最终代码结构。**

如果当前代码能够证明某个额外概念确实具有不可替代的语义，则应保留该概念，并说明原因。

---

# 五、本 Task 最重要的调查原则

## 5.1 不要从当前实现倒推“玩法 B 应该是什么”

禁止使用如下推理：

```text
当前有 Operation
 ↓
Operation 里面需要 Location
 ↓
所以玩法 B 需要 Location
```

必须反过来：

```text
原始玩法体验需要什么？
 ↓
这个需求是否无法由更简单的概念表达？
 ↓
如果无法
 ↓
才确认该概念需要存在
```

---

## 5.2 区分“玩法复杂度”和“Runtime 工程复杂度”

必须严格区分：

### 玩家真正需要理解的复杂度

例如：

```text
地图
地点
事件
行为卡
Cost
道具
路径
```

和：

### Runtime 为保证正确性而需要的复杂度

例如：

```text
EventRun
Preview
Plan
Commit
Resolution
Save / Resume
原子状态替换
版本校验
随机数状态
```

后者即使比较复杂，也**不应仅仅因为代码复杂就被删除**。

本 Task 重点调查的是：

> **语义模型是否过度复杂，而不是 Runtime 是否可以写得更短。**

例如：

```text
UI
 ↓
Preview
 ↓
Commit
 ↓
Atomic Resolution
```

即使内部保留，也不代表玩法 B 有四层玩家概念。

---

# 六、重点调查当前实现中的复杂结构

需要逐项调查当前代码、Datapack、Runtime、UI 与测试，确认下列结构分别解决什么问题。

## 6.1 Event / Operation

调查：

```text
Event
Operation
EventRun
OperationView
```

之间目前的真实关系。

回答：

1. 当前的 Event 是否实际上已经成为“一整个任务 / 关卡容器”？
2. 原始玩法 B 中的“一个事件”是否需要包含多个地点？
3. 一个事件是否可以自然地退化成：
   ```text
   当前地点
   +
   当前事件
   +
   临时 Event State
   ```
4. 当前 Operation 是否在承担超出“一个遭遇事件”的职责？
5. 如果将“地图节点”作为地点，“Event”作为节点上的当前遭遇，哪些 Operation 能力就不再需要暴露给作者？

必须给出实际代码证据，不得仅凭名称判断。

---

# 七、重点调查 Location / Scene / SceneAction

当前实现中可能存在类似：

```text
Operation
 ↓
Location
 ↓
Scene
 ↓
SceneAction
 ↓
Action
```

需要确认这是否已经成为主要复杂度来源。

重点回答：

### 7.1 Location 是否只是 Node 的另一种表现？

如果：

```text
Location = 玩家当前所在地点
```

那么是否可以直接：

```text
Map Node = Location
```

而不再同时维护两套语义？

---

### 7.2 Scene 是否真的是一等玩法概念？

调查：

```text
一个简单战斗
一个简单休息
一次购物
一次奖励
一次路径选择
```

是否真的需要显式创建 Scene。

特别调查当前已经存在的：

```text
没有显式 scenes 时投影 implicit main scene
```

机制。

确认：

> 如果大量普通事件最终都只有一个隐式 main Scene，那么 Scene 是否应该从“作者必须理解的一等概念”降级为 Runtime 内部能力？

---

### 7.3 SceneAction 是否只是 Action 的场景引用？

调查：

```text
SceneAction
```

到底是否拥有独立的玩家语义、生命周期和状态。

如果它只是：

```text
“当前场景允许使用 Action X”
```

则评估能否退化为：

```text
availableActions: [ActionRef]
```

而不是让作者维护新的 SceneAction 对象。

---

# 八、重点调查 Character / Profile / CardPool / Strategy

这是第二个重点。

调查当前类似：

```text
Character
 ↓
StudentOperationProfile
 ↓
Action
 ↓
CardPool
 ↓
StrategyProfile
 ↓
Priority / Policy
 ↓
Hand
```

的真实职责。

必须回答：

### 8.1 角色行为卡的最小机制是什么？

验证是否可以：

```text
当前场景允许的 Action
        ×
角色 Tendencies
        ↓
Weighted Draw
        ↓
当前行为卡
```

完成原始体验。

---

### 8.2 StrategyProfile 是否属于玩法核心？

重点确认：

> 角色是否需要真正“自主规划最优行动”？

还是原始玩法只需要：

```text
角色倾向
 ↓
抽取行为
 ↓
玩家决定何时使用 / 切换
```

如果 StrategyProfile 主要服务于自动 AI、优先级规划、自动战斗或未来高级行为，则必须明确将其标记为：

```text
advanced / deferred
```

而不能因为当前代码已经存在，就继续视为玩法 B 的基础能力。

---

### 8.3 CardPool 是否必须是一等对象？

比较：

```text
Character
 └── CardPool
      └── Action[]
```

和：

```text
Character
 └── availableActions[]
      +
      tendencies
```

确认哪一种已经足够。

只有当 CardPool 拥有独立生命周期、构筑、修改、共享、继承等实际玩法语义时，才保留其一等地位。

---

# 九、重点调查 Player Deck 与 Character Hand

必须区分：

```text
角色行为卡
```

与：

```text
玩家持有的实体卡 / Player-side Card
```

二者不应因为都叫 Card 就强制合并。

候选模型：

```text
                  Action Definition
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
       Character Behavior       Player Card
              │                     │
         倾向抽取                  玩家持有
              │                     │
         临时行为                玩家主动使用
```

调查：

1. 两者是否拥有不同的生命周期？
2. Character Card 是否需要真实的 deck / discard / duplicate / ownership 语义？
3. Player Card 是否确实需要实体牌组？
4. 哪些当前 CardPool / PlayerSceneDeck 逻辑只是为了支撑当前架构，而非原始玩法必要？
5. 是否可以共享 Action 定义，但保持两种使用来源不同？

---

# 十、重点调查 Objective / Outcome / Track / Fact / Gate

调查当前是否存在类似：

```text
Objective
Outcome
Track
Fact
Route Gate
Scene completion
Location completion
Event completion
```

等多层完成与条件体系。

目标不是全部删除，而是确认是否可以统一到：

```text
Condition
```

及其使用位置：

```text
Action.condition
Event.endWhen
Edge.when
```

例如：

```text
敌人全部死亡
→ Event.endWhen

拥有钥匙
→ Edge.when

角色存活
→ Action.when
```

如果 Objective / Outcome 等拥有真实独立语义，应保留并解释。

如果只是不同位置的 Condition 包装，则应建议后续收敛。

---

# 十一、重点调查 Purchase / Reward / Party / Branch

逐项验证是否真的需要独立系统。

## Purchase

是否可以：

```text
Action
 ↓
Cost / Resource mutation
 ↓
Item / Resource
```

表达基本购物。

---

## Reward

是否可以：

```text
Event
 ↓
Choice
 ↓
Effect
```

表达：

```text
获得 A
或
获得 B
或
获得 C
```

---

## Party Change

是否可以：

```text
Effect
 ↓
addCharacter
removeCharacter
swapCharacter
```

表达。

---

## Branch

是否可以：

```text
Map
 ↓
Edge[]
 ↓
Condition
```

表达。

要求调查后明确：

> 哪些场景类型是真正不同的玩法，哪些只是 Effect、Condition 或不同 Event End Condition 的组合。

---

# 十二、必须调查当前 Runtime，而不是只调查 Datapack

这一点非常重要。

不能因为当前 Datapack 有很多对象，就直接判定它复杂。

需要追踪至少一条完整运行链：

```text
进入地图节点
 ↓
触发事件
 ↓
生成 EventRun
 ↓
生成 View
 ↓
生成可用 Action
 ↓
角色抽取行为
 ↓
玩家切换行为
 ↓
玩家 Cost 干预
 ↓
使用 Item / Player Skill
 ↓
Effect
 ↓
Resolution
 ↓
Event End
 ↓
回到地图
```

对每一步标记：

```text
[核心玩法语义]
[Runtime 必要]
[当前架构附加]
[可以隐藏]
[可以合并]
[暂时没有必要]
```

---

# 十三、建立“复杂度来源矩阵”

最终必须形成类似以下表格，而不是只写一篇泛泛的架构评价：

| 当前概念 | 当前实际职责 | 原始玩法是否直接需要 | 是否有独立生命周期 | 更简单表达 | 结论 |
|---|---|---:|---:|---|---|
| Operation | 整体任务容器 | △ | ? | Event | 待确认 |
| Location | 事件内部地点 | △ | ? | Map Node | 待确认 |
| Scene | 地点内部阶段 | △ | ? | Event State / Phase | 待确认 |
| SceneAction | 场景行动包装 | △ | ? | ActionRef | 待确认 |
| Action | 行为定义 | **是** | 是 | 保留 | Keep |
| Character | 行为来源 | **是** | 是 | 保留 | Keep |
| Tendency | 行为抽取权重 | **是** | 是 | 保留 | Keep |
| CardPool | 行为集合 | △ | ? | Action[] | 待确认 |
| StrategyProfile | 自动行为策略 | △ | 是 | Tendency / 后置 | Investigate |
| Player Deck | 玩家实体卡组 | △ | 是 | 后置 | Investigate |
| Condition | 行为/结束/路线条件 | **是** | — | 保留 | Keep |
| Objective | 目标描述 | △ | ? | Condition | Investigate |
| Outcome | 事件结果 | △ | ? | End + Effect | Investigate |
| PurchaseOffer | 商品交换 | △ | ? | Action / Choice | Investigate |
| Team | 多角色协作 | △ | 是 | 后置 | Investigate |
| Combination | 组合技 | 否 | 是 | 后置 | Defer |
| Preview | 提交前验证 | 否 | 是 | Runtime | Keep internally |
| Commit | 原子提交 | 否 | 是 | Runtime | Keep internally |
| Save/Resume | 中断恢复 | 否 | 是 | Runtime | Keep internally |

**表格必须根据实际代码调查结果填写，不能预先假设结论。**

---

# 十四、建立“原始玩法 → 当前实现”的追踪图

至少提供一张这样的映射：

```text
【原始玩法】

地图
 │
 ├── 地点
 │     │
 │     └── 事件
 │           │
 │           ├── 角色
 │           │     └── 倾向
 │           │
 │           ├── 行为卡
 │           │
 │           ├── 玩家 Cost
 │           │
 │           ├── 玩家技能
 │           │
 │           └── 道具
 │
 └── 路径
       └── 条件


             ↓ 当前实现映射


Map
 ↓
Operation
 ↓
Location
 ↓
Scene
 ↓
SceneAction
 ↓
Action
 ↓
StudentOperationProfile
 ↓
CardPool
 ↓
Strategy
 ↓
Resolution
```

然后明确指出：

```text
哪些是必要的语义增加
哪些只是实现层展开
哪些属于过早扩展
```

---

# 十五、调查必须包含至少三个实际内容样例

不要只进行抽象架构讨论。

至少选择：

### 样例 A：最简单战斗

```text
一个地点
一个事件
一个友方角色
一个敌人
两三个行为卡
玩家进行一次 Cost 干预
战斗结束
```

追踪其当前完整数据与 Runtime 路径。

---

### 样例 B：最简单休息

```text
一个地点
一个角色
若干行为
经过数轮
事件结束
```

调查：

> 为了实现这样一个事件，当前到底需要创建多少层对象？

---

### 样例 C：最简单分支

```text
A
├── B
└── C
```

调查：

> 为了让玩家选择 B/C，当前到底需要多少 Operation / Scene / Objective / Outcome / Route 结构？

如果一个极小内容需要大量对象才能表达，这将成为缩减设计的重要证据。

---

# 十六、必须同时检查“已经做得很好、不要误删”的部分

本 Task 不允许因为追求简单而把当前成熟的 Runtime 基础全部推倒。

重点确认以下机制是否应该继续保留：

```text
EventRun 状态隔离
Preview / Plan
Commit
原子 Resolution
Save / Resume
稳定 ID
随机数状态
状态版本 / 防旧提交
统一 Effect
统一 Condition
```

调查这些机制时需要区分：

```text
“作者是否需要知道它？”
```

和：

```text
“Runtime 是否需要它？”
```

例如：

```text
作者：
Event
 ↓
Action
 ↓
Effect

Runtime：
EventRun
 ↓
Preview
 ↓
Plan
 ↓
Commit
 ↓
Resolution
```

这是可以接受的。

因此本 Task 的目标不是：

> “把 Runtime 也强行变成三个类。”

而是：

> **让复杂 Runtime 支撑一个简单的玩法语义，而不是让玩法语义被 Runtime 的内部组织反向定义。**

---

# 十七、最终必须给出五类结论

调查完成后，每一个主要概念必须归入以下五类之一。

## A. Core

玩法 B 的核心语义，不能删除。

例如候选：

```text
Map
Node
Edge
Event
Character
Action
Tendency
Effect
Condition
Cost
```

---

## B. Internal Infrastructure

玩法运行所需要，但不应该成为作者 / 设计者必须理解的一等玩法概念。

例如候选：

```text
EventRun
Preview
Plan
Commit
Resolution
Save State
```

---

## C. Merge / Simplify

当前存在，但可以通过更少的一等概念表达。

例如候选：

```text
Location → Node
SceneAction → ActionRef
Objective → Condition
Outcome → EndCondition + Effect
```

但必须由调查确认。

---

## D. Advanced / Deferred

确实有价值，但不应该阻塞最初玩法 B。

例如候选：

```text
StrategyProfile
Auto AI
Combination
复杂 Team
Player Deck 构筑
多层 Scene
复杂 Purchase
```

如果调查发现这些是必要的，应明确为什么。

---

## E. Remove / Replace

如果某结构既不是核心语义，也不是 Runtime 必要，而且存在明显更简单的表达，则提出后续移除 / 替换建议。

---

# 十八、后续目标模型必须以“最小闭环”验证

调查最后需要尝试回答：

> **能否只用一个玩家角色、一个地点、一个事件、一张简单地图，实现完整的玩法 B 闭环？**

目标演示：

```text
              MAP
               │
          A ─── B ─── C
               │
               ↓
             EVENT
               │
          ┌────┴────┐
          ↓         ↓
      Character   Enemy
          │
      Tendency
          │
          ↓
     Draw Action
          │
          ↓
     [观察]
          │
      玩家干预
          │
       Cost -1
          │
          ↓
       [攻击]
          │
          ↓
        Effect
          │
          ↓
       Enemy HP 0
          │
          ↓
       Event End
          │
          ↓
          MAP
```

如果完成上述体验必须创建：

```text
Operation
Location
Scene
SceneAction
Objective
Outcome
StrategyProfile
CardPool
Team
Combination
...
```

则必须进一步说明为什么。

如果可以压缩成：

```text
Map
Node
Event
Character
Action
Effect
Condition
```

则应将其作为后续施工的主要简化方向。

---

# 十九、本 Task 明确禁止的行为

在调查阶段：

- **不要因为当前代码已经存在某个对象，就认定该对象必须保留。**
- **不要直接按照当前 Operation 架构继续添加功能。**
- **不要为了兼容所有未来玩法，提前保留所有抽象。**
- **不要在没有完成映射调查前进行大规模删除。**
- **不要把 Runtime 的工程复杂度误判为玩法复杂度。**
- **不要为了“统一”而强制把 Character Card、Player Card、Item、Skill 全部变成同一种对象。**
- **不要因为某种复杂结构理论上可以支持未来需求，就把它列入当前核心。**
- **不要先设计新的大框架，再寻找原始玩法需求来证明它合理。**

尤其禁止形成这样的结论：

```text
“这个结构未来可能有用，所以暂时保留。”
```

必须进一步回答：

```text
它服务哪个已经确定的玩法需求？
为什么更简单的模型不能完成？
```

如果回答不了，则至少应标记为：

```text
deferred / unconfirmed
```

---

# 二十、最终交付物

本 Task 完成时，不要求提交大规模代码修改，而要求提交一份**玩法 B 缩减定性报告**，至少包含：

### 1. 当前实现结构图

```text
Current Architecture
```

### 2. 原始玩法 B 最小模型图

```text
Target Minimal Model
```

### 3. 二者逐项映射表

```text
Current → Target
```

### 4. 复杂度来源分析

明确指出：

```text
复杂度来自哪里
为什么产生
是否真的必要
```

### 5. Core / Internal / Merge / Deferred / Remove 分类

逐项列出。

### 6. 最小闭环验证

至少用：

```text
简单战斗
简单休息
简单分支
```

验证目标模型是否成立。

### 7. 后续施工建议

按照优先级给出：

```text
P0：
必须收敛的语义模型

P1：
可以在不破坏 Runtime 的情况下简化的结构

P2：
可以继续保留、但不暴露给作者的高级能力

Deferred：
暂时不要施工
```

---

# 二十一、最终验收标准

本 Task 只有在以下问题都得到明确回答后才算完成：

```text
[ ] 当前玩法 B 实际由哪些核心对象组成？
[ ] 当前 Operation 到底是 Event 还是整个关卡/任务容器？
[ ] Location 是否可以与 Map Node 合并？
[ ] Scene 是否是必要的一等语义？
[ ] SceneAction 是否只是 Action 的包装？
[ ] Character 行为是否可以由 Tendency + Action Draw 表达？
[ ] StrategyProfile 是否是核心玩法所需？
[ ] CardPool 是否必须独立存在？
[ ] Character Card 与 Player Card 的差异是什么？
[ ] Objective / Outcome 是否可以收敛到 Condition + Effect？
[ ] Purchase / Reward / Party / Branch 是否真的需要独立系统？
[ ] 哪些复杂度属于 Runtime 基础设施，不应该删除？
[ ] 哪些复杂度只是当前实现提前暴露给作者的？
[ ] 一个“地点 + 一个事件 + 一个角色 + 一张地图”能否完整跑通？
[ ] 如果不能，缺的究竟是哪一个不可替代的核心语义？
[ ] 后续应该缩减什么，而不是继续增加什么？
```

最终必须能够用一句话描述新的目标：

> **玩法 B 的复杂性应该来自“角色、行为卡、倾向、玩家干预、Effect 的组合”，而不是来自玩家必须理解一套庞大的 Operation / Location / Scene / Strategy / Objective 编排体系。**

---

## 二十二、设计结论的优先原则

如果调查结果存在冲突，按照以下优先级裁决：

```text
真实游玩体验
      ↓
原始玩法 B 核心机制
      ↓
最小可表达模型
      ↓
已有 AC 通用机制复用
      ↓
Runtime 正确性
      ↓
未来扩展性
```

**不要反过来。**

尤其不能因为：

```text
“未来可能需要”
```

而牺牲：

```text
“现在一个简单事件就应该很好做、很好理解、很好玩”
```

玩法 B 的第一阶段目标不是成为一个万能任务描述语言，而是先成为一个**非常小、非常明确、具有独特游玩体验的地图—事件—行为卡循环**。

---

## Task执行记录

- 最终交付：[[report-0285-gameplay-b-core-semantics-reduction]]，含当前结构图、原始最小模型、映射、三类样例、复杂度矩阵、五类定性及 P0/P1/P2/Deferred 建议。
- 范围：只读调查与文档交付；没有修改产品代码，没有执行大规模施工。
- 证据：当前 Operation contracts、Datapack resolver、Runtime / UI 主路径、Character Hand resolver、样例包和定向测试内容均已检查。
- 测试：检查了相关测试用例结构；未运行测试。本次是只读语义调查，没有运行行为变更。
- 文档验证：`npm run check:docs` 通过（errors: 0，826 篇 Markdown）；`git diff --check` 通过。
- GALHCG：已用项目 `acprogram` 只读搜索 `OperationRuntimeService` 并回到源码核实；Task / Report 路径复核均命中。不改语义图，不刷新索引。
- 剩余工作：Map Node 与 Encounter 是否拆分、自由移动/地点完成规则、战斗干预成本与玩家主动技能/物品合同，均需负责人裁定后另立实施 Task；不属于本调查 Task 的未完成验收。
