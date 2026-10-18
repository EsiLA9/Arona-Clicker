# 玩法 B 最小闭环裁定稿

对应 Task：[[task-0286-gameplay-b-minimal-semantic-target]]  
状态：探索完成；本文给出供下一轮预期地图讨论使用的推荐默认值，不是施工规格。

## 核心循环

```text
Map → Node → Encounter
                 ↓
Character Tendency → Draw Action
                 ↓
Player observes → waits or intervenes
                 ↓
Action → Effect → Encounter State
                 ↓
              End → Map
```

最小闭环以 Battle 为基准：角色按倾向抽到当前可用行为，玩家观察并决定是否干预；行动改变遭遇状态，遭遇结束后回到地图。

## 四项行为规则建议

### 1. 在地图节点间移动

**推荐默认：**玩家在 Map 上选择当前可达的 Node；连接 Node 的 Edge 可附带通行条件。移动不要求先“完成”当前 Node 的 Encounter。具体地图形状、移动范围是否只限相邻点、区域结构和坐标留待下一轮地图设计。

### 2. 进入节点遭遇

**推荐默认：**进入带有可触发 Encounter 的 Node 时，开始该遭遇；没有遭遇的 Node 只展示地点内容并允许继续移动。第一阶段一个 Node 至多有一个当前 Encounter。具体进入动画和玩家是否需要再按一次“进入”，留待地图 UI 讨论。

### 3. 遭遇结束后回图

**推荐默认：**Encounter 满足自己的结束条件后，提交其结果并返回 Map，玩家仍处在刚完成遭遇的 Node；随后由玩家选择下一步移动。Encounter 不自动接管相邻 Node，也不要求选择一条“任务后续 Route”。失败、撤退和可重复遭遇的细则留待之后按玩法需要决定。

### 4. 角色抽卡与玩家干预

**推荐默认：**每个交互周期，每名当前可行动的友方角色按 Tendency 从本次 Encounter 允许的行为中抽到一个当前行为。玩家先看到这些行为；不干预就让当前行为结算。玩家可以等待观察，也可以消耗 Player Cost 改变一名角色本周期的行为，再结算本周期行动并进入下一周期。

这一定义只固定最小节奏：**倾向影响抽取，玩家可以不干预，也可以付费改变当前行为。**每次具体抽几张、行动是否同时结算、Player Cost 数值和其他 Ability / Item 的触发方式，都不在本次裁定范围内。Ability 与 Item 保留各自持有和使用语义；不要求它们变成与角色行为卡完全相同的数据对象。

## 最小例子验证

| 情境 | 用同一循环如何表达 | 本次结论 |
| --- | --- | --- |
| **Battle（基准）** | Node 触发遭遇；友方角色按倾向抽行为；玩家可接受或付 Player Cost 改变一个行为；Action 造成 Effect；胜负条件满足后回 Map | 定义核心循环的验收例子 |
| **Rest** | 休息地点触发遭遇；角色抽到休息、闲聊等行为并改变 HP、资源或事实；达到回合/状态条件后回 Map | 不需要单独的 Rest Engine；规则差异体现在行动和结束条件 |
| **Shop** | 购买地点展示可选商品；玩家选择 offer、支付资源并获得效果；离开后回 Map | 可作为 Encounter/Node 上的一组选择与 Effect，不据此预设完整经济系统 |
| **Branch** | Map 上 A 连接 B/C；玩家选择可达 Edge 移动到目标 Node | 路径选择属于地图移动，不包装为 Encounter |

Battle 是首要验证；Rest / Shop 是变体；Branch 是地图关系验证。它们不需要成为四套并列的核心 Engine。

## 当前概念定性

| 当前概念 | 推荐归属 | 理由 |
| --- | --- | --- |
| Map / Node / Edge | **Core** | 表达玩家位置、地图节点与移动关系；当前 Operation Route 图不等同于自由移动 Map |
| Encounter | **Core** | 一次局部交互的参与者、状态、行为和结束边界 |
| Character Tendency / Action Draw / Player Intervention | **Core** | 玩法 B 的独特体验；Player Cost 是干预手段 |
| Action / Effect / Condition | **Core** | 说明行为如何合法执行、改变什么、何时结束；保持受限、可读 |
| EventRun、准备计划、Preview、Commit、Resolution、Save / RNG | **Internal** | Runtime 正确性和续局机制，不必成为作者主词汇 |
| Operation Event / Location | **Replace / Internal transition** | 当前 Event 包含一整条多地点任务，Location 承载完成后 Route 推进；不能直接当作目标 Encounter / 自由 Node |
| Scene / SceneAction | **Advanced / Deferred** | 基础 Encounter 不要求显式阶段；多阶段或特殊选项以后再引入 |
| Profile / CardPool / StrategyProfile | **Advanced / Internal** | Tendency 和候选抽取是核心；这些独立配置对象不必成为第一层概念 |
| Player Scene Deck、Combination、复杂 Team、PurchaseOffer | **Advanced / Deferred** | 不阻挡最小闭环，不要求现在合并或删除 |
| Ability / Item 的具体模型、地图重复遭遇和复杂条件 | **Deferred** | 当前 Task 只需确认它们不被强行合并进角色行为卡 |

分类对象是玩法与作者语义，不要求逐个建立相同代码类型，也不据此授权删旧数据。

## 留给下一轮地图设计

下一轮与上层 Chat 讨论具体预期地图时，再决定节点数量、形状和区域、移动限制、遭遇的进入提示、节点重访方式以及地图状态如何呈现。当前只确认：**移动属于 Map；局部遭遇结束后回到 Map；玩家继续选择移动。**

本次没有决定 Schema、API、Runtime Owner、兼容策略或迁移步骤；真正施工需在地图目标和体验获得认可后另立 Task。
