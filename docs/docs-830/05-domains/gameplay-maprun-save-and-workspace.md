# MapRun：保存、物品提交与工作区

本文回答当前 Run 如何保存、读取和显示，以及遭遇道具如何与玩家背包协调。地图运行入口见 [[gameplay-maprun-overview]]，回合草稿见 [[gameplay-maprun-encounters]]。

## 保存与恢复

`createSaveSnapshot()` 为正在进行的 Run 生成脱离 owner 的快照，包含地图 ID、作者维护的 `resumeVersion` 和 Run 状态；没有活动 Run 时返回空。局内队伍、位置、资源、Facts、当前 Encounter 草稿和相关随机状态属于快照的一部分。运行时的精简失败结果不是一个活动 Run 存档。

恢复时 `restoreSaveSnapshot()` 先验证结构，要求 owner 为空，再通过当前 Registry 解析地图并核对地图 ID、`resumeVersion`、角色身份与 Run 内容。地图不可用、版本改变或快照与当前内容不符都会拒绝该局恢复并返回原因，不把不完整的 Run 安装进 owner；上层仍可恢复基础 PlayerState。某些回执携带执行起始快照和轨迹，恢复校验会验证与当前内容的关系；具体支持的回执版本和校验范围以 `map-effect-receipt-validator.ts` 与 `map-run-service.ts` 为准，不能把它当作任意历史格式都可重放。

作者修改可能影响活动 Run 的行动、目标、费用、事实、路线条件、初始 HP 或资源等规则时，应提高地图的 `resumeVersion`。仅把版本号改回去并不能证明旧快照有效。

## Item 跨 owner 提交

Encounter Item 的草稿可保存，但草稿和预览不会扣除物品。提交时 `GameInstance.commitMapEncounterRound()` 先让 MapRun owner 规划本轮，再检查该 Item 当前仍是可用消耗品、使用条件满足且玩家背包有数量；两个 owner 的准备结果都仍有效时，才连续安装 Run 和物品扣除结果并发布物品事件。绕过协调器直接由 `MapRunService` 提交含 Item 的回合会被拒绝。

`tests/engine/gameplay-b-map-source-transactions.test.ts` 有一个完整例子：保存时背包仍有 1 件、草稿被保留；加载后提交消耗 1 件，随后重试同一请求不再次扣物品、更新统计或发布事件。另一个例子在提交前让 `useCondition` 失效，Run、玩家状态和统计都保持不变。若有效提交使队伍失败，已经提交的物品消耗仍然保留；恢复旧存档是另一个显式操作。

## 工作区如何与运行态协作

Map 工作区按 `runId` 取得 owner 的只读视图，显示节点、边、遭遇、行动与结算信息。位置选择意图保留来源节点和目标身份；Controller 在提交移动前再次读取当前视图，确认当前路由、Run、来源、目标、活动完成状态和边条件，再调用 `moveMap`。任何环节已变化时返回反馈并刷新候选；画面中的选择本身不是权威移动。

遭遇内选卡、目标、Ability 或 Item 产生针对当前草稿的命令；回合预览和投影帮助玩家判断，最终提交仍由 owner 核对当前版本。Map 工作区在位置不变且 Encounter 仍活动时可刷新局部区域，否则刷新工作区；信息流和界面选择是展示层状态，不拥有局内 HP、事实或物品栏。

## 恢复失败怎么排查

先确认数据包启用状态与当前地图是否存在，再比较存档和内容的 `resumeVersion`。版本一致仍失败时检查固定队伍身份、当前位置/活动、草稿、随机状态和最近回执是否符合当前地图；不要直接修改保存数据来绕过校验。`tests/engine/gameplay-b-map-save-resume.test.ts` 覆盖恢复和拒绝，`tests/engine/gameplay-b-map-ag1-restore.test.ts` 覆盖 AG-1 相关恢复；界面交互入口见 `tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts`。

源码：`src/arona-clicker/services/map/map-run-service.ts`、`map-effect-receipt-validator.ts`，`src/arona-clicker/runtime/runtime-game-instance.ts` 的 `commitMapEncounterRound()`，`src/ui/controller/controller.ts` 的 `commitMapLocationFromFlow()`，`src/ui/components/map/map-workspace.ts`。
