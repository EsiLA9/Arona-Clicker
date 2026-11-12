# MapRun 遭遇：手牌、目标与回合提交

本文解释一局地图中的 Encounter 如何从候选行动形成手牌、玩家如何调整行动，以及一次提交为何会过期。地图与节点生命周期见 [[gameplay-maprun-overview]]。

## 从候选到手牌

地图中的 Action 是定义；Encounter 为参与角色和敌人提供候选来源及权重，也可引用地图内的候选池。`drawGameplayBHands()` 结合参与者、当前可用目标、HP 和资源等输入过滤候选，再按权重与 Hand 随机状态抽取。每个角色的手牌上限为 3；倒地角色保留在手牌顺序中，但手牌为空。敌方手牌也来自它们的候选来源。允许某角色使用某 Action，不等于该 Action 已进入本 Encounter 的候选池或一定会抽中。

AG-1 候选池可受 MapRun Facts 门控：进入 Encounter 时记录候选来源快照，同一 Encounter 中事实变化不会追溯改变这份门控输入；下一次 Encounter 才会取得新快照。与路线边读取当前事实的区别见 [[gameplay-maprun-effects-and-facts]]。

## 从自然准备到草稿

界面先展示基于当前手牌的自然准备行动；没有可用行动时会呈现 Wait。玩家可在手牌中进行 Swap，也可对符合条件的行动发出消耗 PlayerCost 的 PlayerCommand。候选的目标类型决定需要选择角色、敌人、卡牌或无目标；部分 AG-1 Action 还可声明额外目标。Ability 与 Item 也有独立草稿。选择草稿不是执行效果，选择道具也不会立即扣背包。

`previewActions()` 和 `previewEncounterCommit()` 返回脱离 Run 的只读候选或回合结算预览。后者使用与提交相同的规划逻辑，成功时提供结算、成本和执行细节，不能规划时返回 `canCommit: false` 和诊断。预览不会安装效果，也不会推进实际随机状态；行动、目标、余额或草稿变化后，应重新读取当前预览。

## 一次回合提交

`MapRunEncounterCommitCommand` 包含 `runId`、`requestId`、`expectedCommitVersion` 和草稿标识 `draft`。草稿标识包含当前节点、回合、`draftVersion`，活动节点还包含活动 ID。服务先验证这些身份与版本，再规划完整回合；规划失败或版本过期时不安装候选状态。成功后推进提交版本并保存回执；需要继续的遭遇会进入后续回合。

同一 `requestId` 的同一请求可作为最近一次提交的重试；将同一 ID 用于不同输入会被拒绝。这是对可识别重试的保护，不表示所有历史请求都有无限期去重记录。涉及背包 Item 的提交必须经 `GameInstance` 的跨 owner 协调，见 [[gameplay-maprun-save-and-workspace]]。

```text
候选定义 + 当前状态 → 抽手牌 → 自然准备 / 玩家草稿
  → 目标选择 → 只读回合预览 → 版本与草稿复核 → 提交一整轮
```

## 示例：合格行动不一定进入手牌

`tests/engine/gameplay-b/gameplay-b-map-run.test.ts` 的 `HAND_MAP` 为多名角色声明可用 Action：`eligible-not-candidate` 允许 Shiroko 使用，但并未放入她在该 Encounter 的候选列表，因此不能仅凭角色资格推断它会出现在手牌中。另有两个费用高于当前 Actor 或 Team 余额的候选，权重虽设为 1000，也不能因此跳过费用合法性检查。排查缺卡时依次看 Action 资格、参与者候选/池、目标和费用，再看抽取结果及随机状态。

AG-1 和兼容执行合同对来源排序、资源费用的处理有区别；具体效果和局内状态见 [[gameplay-maprun-effects-and-facts]]。

源码：`src/arona-clicker/services/map/gameplay-b-hand-resolver.ts`、`gameplay-b-action-preview-resolver.ts`、`gameplay-b-target-selection.ts`、`map-run-service.ts` 的 `previewEncounterCommit()`、`prepareEncounterRoundCommit()`；命令类型在 `src/arona-clicker/contracts/map/map-run.ts`。测试：`tests/engine/gameplay-b/gameplay-b-map-cards.test.ts`、`tests/engine/gameplay-b/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b/gameplay-b-map-ag1-commit.test.ts`。
