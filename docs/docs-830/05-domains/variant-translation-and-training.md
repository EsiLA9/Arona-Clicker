# Variant 转译与训练

本文解释如何将角色输入转为 Gameplay B 构筑，以及两个训练入口如何使用构筑。长期等级、星级、装备和好感见 [[character-growth]]；地图 Run 的一般入口与状态边界见 [[gameplay-maprun-overview]]。

## 从角色到可用于场景的构筑

`VariantTranslationService` 接受场景入口、固定模式和成员列表，从受信任内容解析该入口允许的角色来源与规则，生成脱离玩家状态的构筑快照。当前转译模式是 `GameplayB`。服务不创建 Run，也不持有游戏随机数，不写入角色拥有、培养或其他玩家进度；消费者决定如何使用确认后的构筑。

```text
入口与成员来源 → preview：核对内容、身份、队伍策略并计算构筑
  → token 和可读预览 → confirm：重算并比对 → 冻结快照
  → 场景消费快照，创建或恢复相应运行状态
```

请求只选择已授权来源，不能由调用方提供任意属性或覆盖内容策略。入口和规则通过受信任的内容解析器取得，引用带 ID 和 revision；入口限制成员数量、可用来源以及是否允许重复 Variant。请求的槽位 ID 必须唯一。

| 来源 | 检查和输入 | 与长期进度的关系 |
| --- | --- | --- |
| `owned` | 精确的 Variant 必须由入口允许、已注册且当前拥有；读取对应 Profile 和当前等级、星级、好感 | 将相关培养值作为输入生成本次构筑，不会修改它们。 |
| `slice` | 引用入口授权的特定 slice 及 revision；按入口策略可能仍要求拥有精确 Variant | 输入来自已授权场景内容，不携带玩家培养进度。 |

两个 Variant 可以属于同一角色原型；重复策略检查的是 Variant 身份，不应把“角色原型相同”直接等同于“同一个 Variant”。最终快照记录成员来源、输入、构筑、入口/规则引用、Init 和内容依据，供后续验证。

## 预览、确认与恢复

`preview()` 通过检查时返回 `ready`、构筑成员和一个仅在该服务实例内有效的 token；未通过时返回 `blocked` 与问题。token 是服务内查找句柄，不是可独立验证的构筑数据。缓存最多保留 32 个预览，超出后最早的句柄被淘汰。

`confirm(token)` 先取出并消费该句柄，再依据当前状态和内容重新计算；如果输入、授权、规则或输出与预览不同，就返回过期，需要重新预览。相同 token 不能重复使用，也不能交给另一个服务实例。Init 改变或 PlayerState 对象被替换会清除预览；同一对象内的无关状态变化不必导致失败，相关培养或内容变化会在重算时被发现。

例如 `tests/engine/variant-translation-service.test.ts` 的测试先预览拥有角色，再提高该角色等级：旧 token 确认被拒绝；另一个案例只改变无关资源，确认仍成功。检查的重点是构筑输入是否仍一致，而不是把所有状态变化都视为过期。

`restore()` 接受已确认的快照，检查结构、入口和规则 revision，重新依据冻结输入计算并比较内容依据与结果。它不要求拥有角色后的培养进度仍与保存时相同；这使场景能够恢复当时的冻结构筑。内容版本不匹配、被篡改的输入或输出、错误结构会被拒绝。恢复构筑不等于恢复一局 Run，后者还需对应运行所有者的校验。

## 两种训练入口

| | 独立训练测试 | 正式 Spot 训练场景 |
| --- | --- | --- |
| 所有者 | `VariantTrainingService` 创建自己的 `MapRunService` | `GameInstance.enterVariantTraining()` 使用主 MapRun 所有者。 |
| 入场 | 选择训练来源，预览并确认 token 后建立测试局 | 在当前世界线和区域的有效 Spot 请求 `variantTrainingEntry`；当前场景要求拥有精确的 `Hoshino` Variant。 |
| 与普通地图的关系 | 内存中的独立测试，不替换普通 MapRun，不写 PlayerState | 与普通地图共享主 Run；已有其他活动地图时拒绝进入，同一训练场景已有 Run 时返回当前 Run。 |
| 恢复 | 显式测试点保存构筑及战斗快照；先完整校验再替换测试 owner | 正式存档将训练绑定与活动 MapRun 快照一起保存和校验。 |

两条路径都使用真实地图玩法，但用途和存档边界不同。独立训练仅在有效战斗节点生成测试点；读取时验证模板、构筑与战斗绑定、当前 Init、队伍和 Run，拒绝的测试点不会覆盖正在进行的测试。世界线切换会清理测试状态。

正式入口还检查 Spot 属于当前世界线和区域、功能可用，以及未拥有 Spot 时相应存在与功能揭示条件。不能绕过这些检查，单凭训练地图 ID 开始此场景。成功后构建固定的三个来源：玩家拥有的构筑、`normal` slice、`enhanced` slice，依次进入 `battle-owned`、`battle-normal`、`battle-enhanced` 三个遭遇，最后到达出口。它们是**同一个主 MapRun 中的三个遭遇**，各阶段使用相应冻结构筑；运行中的重启沿用构筑，放弃后重新入场才重新准备。

## 排查与核对

1. 无法预览时，确认入口是否配置了受信任内容、来源及 revision 是否获授权、拥有来源的精确 Variant 是否已拥有，以及队伍限制是否满足。
2. 确认返回过期时，重新预览，并检查角色培养、内容、Init 或 PlayerState 是否变化；不要跨实例使用或重复使用 token。
3. 正式训练无法进入时，先查当前 Spot/功能、所需 Variant 和是否已有另一张活动地图；不要把测试服务的入口当成正式 Spot 的入口。
4. 恢复失败时，分别检查构筑快照、内容版本、训练绑定与 Run 快照。构筑恢复成功不单独证明战斗快照合法。

源码：`src/arona-clicker/services/character/variant-translation-service.ts`、`variant-translation-rules.ts`、`variant-training-service.ts`、`variant-training-scenario.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`。测试：`tests/engine/variant-translation-service.test.ts`、`variant-training-service.test.ts`、`variant-training-main-runtime.test.ts`、`variant-training-scenario.test.ts`、`tests/ui/variant-training-spot-entry.test.ts`。
