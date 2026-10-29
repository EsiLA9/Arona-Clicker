# Gameplay B MapRun：地图与一局的生命周期

本文回答：地图定义如何变成一局玩法、玩家何时可以移动，以及一局结束后留下什么。这里的 MapRun 是 Gameplay B 的局内地图；世界区域导航和 Operation Run 有各自的状态与命令，不能把它们的规则套用到本页。

## 定义、入场与运行态

`GameplayMapDef` 是数据包中的静态定义：地图使用完整的 `map` 实体 ID，节点、边、行动和候选池 ID 则在地图内使用。定义包括起点、出口、有向边、固定角色、初始 HP、PlayerCost、可选资源与 Facts，以及节点内容。`entryInfo` 提供入场说明，不改变规则。`resumeVersion` 是作者维护的兼容版本，不是 Run 的提交次数。

产品 Runtime 装配 `gameplayBMapDatapack`，游戏中的 Spot 地图功能可以提供入场；实际可用内容取决于启用的数据包。`MapRunService.start()` 解析当前定义，验证版本、起点、初始费用和完整的已准入队伍快照，再创建局内状态。一个 owner 同时只允许一局 `inProgress` Run；运行中的角色身份以入场快照为准，而不是每次操作都重新从玩家名册抽取。

```text
启用的地图定义 + 已准入队伍 → start → 起点及节点内容
  → 沿有向边移动 → 完成 Encounter / 顺序活动 → 出口
  → success 结果；或队伍失败 → failure 结果
```

`MapRun` 保存本局队伍、HP、Actor/Team 资源、PlayerCost、当前位置、已访问和已完成记录、Facts 以及当前活动；`activeEncounter` 另外保存当前遭遇的局部信息。它是局内状态，不等同长期 PlayerState：例如遭遇道具可以消耗玩家背包，跨状态提交见 [[gameplay-maprun-save-and-workspace]]。

## 节点、路线和活动

边有方向。`move(runId, targetNodeId)` 要求当前 Run 存在、没有正在进行的 Encounter 或节点活动，且当前位置有通向目标的边；若边声明条件，还要用**当前**局内资源或 Facts 复核。路线门禁是只读判断，不会消耗门禁资源。成功移动后才更新当前位置和访问记录，打开目标节点内容。

一个节点可以声明单个 `encounter`，或者声明固定顺序的 `activities`，二者互斥。活动可以是 Encounter 或 Shop；无敌人且声明有限 `rounds` 的 Encounter 可作为 Rest。活动次序由内容定义，不由玩家选择。已完成的节点再访不会重新打开已完成的遭遇。节点首次进入可声明 `partySetup`，此时为该阶段重设 HP、PlayerCost、资源等，并清除上一阶段的 Encounter 回执；未声明时沿用地图的起始定义作为相关基准。不要把节点坐标或画面邻近当作可以移动的依据。

Shop 的商品列表由定义提供，不自动刷新；购买可消耗并改变局内 Team 资源，也可按上限治疗指定队员，但不能复活倒地角色。`purchaseShopOffer()` 校验活动、商品、费用和 Shop 草稿版本，候选扣费与效果一起安装；离开 Shop 才推进该节点的下一个活动。Shop 使用自己的购买回执与草稿版本，不能套用 Encounter 回合提交命令；它也不同于直接操作玩家库存的普通商店。

地图出口也可以有活动：到达出口且没有活动阻挡时才完成。`restart()` 用当前地图及已准入队伍重建一局；重建失败时保留原局。`abandon()` 丢弃活动 Run，不产生一个完成结果。成功后 owner 清除活动 Run，只留下用于展示的精简成功结果；队伍失败也有运行时失败结果。保存与恢复见 [[gameplay-maprun-save-and-workspace]]。

## 示例：A → B → C

`tests/engine/gameplay-b-map-run.test.ts` 的 `ROUTE_MAP` 设定起点 A、手动完成的 Encounter 节点 B、出口 C，只声明 A → B 与 B → C：

1. 在 A 直接请求 C，会因没有 A → C 边被拒绝，Run 不变。
2. 移动到 B 会打开 Encounter。此时请求 C 被拒绝，仍停在 B。
3. 对定义了手动完成动作的 Encounter 执行完成，当前位置仍是 B；之后移动到 C 才成功。
4. 成功后活动快照与活动 Run 的保存快照均为空，精简结果提供地图和出口名称。

这个例子验证有向边与活动阻挡，不能推论所有 Encounter 都可手动完成；是否允许取决于各自定义。

## 排查与深入阅读

先检查当前包是否启用、地图 ID 和队伍是否通过准入；移动失败再检查活动、边的方向和当前门禁。地图节点会话与遭遇手牌见 [[gameplay-maprun-encounters]]；效果、状态和 Facts 见 [[gameplay-maprun-effects-and-facts]]。

源码：`src/data-services/contracts/gameplay-map.ts`、`src/arona-clicker/services/map/map-run-service.ts` 的 `start()`、`move()`、`restart()`、`abandon()`；`src/arona-clicker/runtime/runtime-game-instance.ts`。测试：`tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-runtime-integration.test.ts`。
