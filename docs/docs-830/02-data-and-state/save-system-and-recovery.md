# docs-830/02-data-and-state/save-system-and-recovery — 存档介质与游戏恢复

本文回答：浏览器存储、游戏存档、Init 快照和包管理器快照各自保存什么，读取时如何重建 Runtime。

## 两类持久化数据

| 数据 | 责任对象 | 保存内容 |
| --- | --- | --- |
| 游戏进度 | `SaveSystem` + `GameInstance.save()` / `load()` | PlayerState、Story cursors、统计、时间戳，以及可恢复的 Map / Operation Run |
| 包库选择 | `PackSnapshotStore` | 已安装包、启用 ID、顺序和选择槽；可用 JSON/LocalStorage 或 IndexedDB 后端 |

`SaveSystem` 基于 `StorageAdapter` 将 JSON 字符串保存到 LocalStorage，使用固定 key，读取与导入时检查统一 `GAME_SAVE_VERSION='3.1.0'`；它负责介质读写与格式门槛，不负责编排游戏领域状态。旧版本拒绝读取和导入，保留原存储，不补默认值或执行迁移。`GameInstance.save()` 生成产品级 SaveData，游戏 UI 的 Controller 可补入非 Story 聊天历史，并通过 `controller-save.ts` 保存与读取。另有 `src/main.ts` 入口在内容包加载后读档，并在页面关闭前停会话、保存进度；它不应与 `/game` 使用的 `src/ui/main.ts` 入口混为一谈。包管理器快照使用另一组 `PackSnapshotStore` 接口，游戏进度与包启用配置分开保存。

## 游戏 SaveData 与恢复顺序

`GameInstance.save()` 先按当前 Registry/State 重算派生可见性，再由 `buildSaveData()` 组装版本 `3.1.0`、时间戳、PlayerState、visibility、Story playback、持久统计和标签残留；存在可保存的局内 Map/Operation 时附带对应 Run 快照。区域地图收录事实随当前 Init 快照保存，已知信息随完整 Save 保留。版本常量统一定义于 `src/engine/contracts/save-version.ts`。

UI 的显式保存由 `controller-save.ts` 调用 `SaveSystem.save(ctrl.withHistories(ctrl.commands.save()))`；`withHistories()` 限制非 Story 历史长度，并剔除 typing 与带 storyOutputId 的 Runtime 投影条目。Story 正文和实际效果通知由 Story output 快照保存；UI 的商店、地图等本地通知单独保存在 chatHistories。读档后两者合并显示，避免重复保存正文。新存档进入 Init 选择页时，Controller 会先写入一份 Lobby 存档，防止用户在作出 Init 选择前关闭页面而丢失初始状态。

读取存档要求相同版本且包含 Story playback cursor。`restoreFromSave()` 先清理信息揭示监听、事件队列、Init Trigger/Affector 挂载和活动 Story，再恢复 PlayerState 并重新接线状态服务；之后重算可见性、恢复统计与 Story cursors、设置离线 Tick 时间戳，并重挂 Affector 和信息揭示监听。该函数不负责停止 `SessionService`。Map/Operation Run 再分别尝试恢复；其快照拒绝时保留基础游戏进度，并记录可重新开始该局的诊断。

```text
Registry / 内容已装载 → 读取并校验 SaveData → 恢复 PlayerState
  → 重建统计 / 规则 / 可见性 / Story 游标 → 尝试恢复局内 Run
```

Init 快照是第三种不同范围：`InitSavepoint` 根据 `PER_INIT_FIELD_SPECS` 在 `PlayerState.initSnapshots` 中保存或恢复当前 Init 的字段；它不替代完整 SaveData。加入新状态字段时还须按字段归属同步快照规范。

Entry 播放局部键值表保存在对应 StoryNode 等待点的 `run.localFlags`，因此随完整存档和已有 storyCursors 的 Init 暂停恢复路径走，不新增 PlayerState.flags 字段或另一份 Init 字段规范。恢复先验证所有 owner 的表和值，再替换游戏状态与会话，不重放写入/移除动作。旧活动快照缺少此字段时拒绝恢复，按项目清档策略重新开始，不补空表迁移；空会话仍为 run:null。局部语义见 [[story-and-effects]]。

Story 集合使用 `story-playback-v2`，Player 等待点使用 `story-nodes-v2`。每个 owner 还保存当前有限表现步骤、步骤游标、剩余等待、正文送达/抑制状态、稳定输出记录与序号，以及 finishing 的结算结果和待交接请求。恢复从权威步骤位置继续，不依赖 UI 聊天历史计数，不重新执行已提交 Operation、Click 结果或完结奖励。恢复换发 runId 和输入 token，保留逻辑 historyId 与输出 ID；旧界面和旧计时回调不能作用于恢复后的会话。

活动会话持有启动时复制的 Story 文档；快照记录根 Story 及所有声明 goto/insert 分支的规范化内容指纹。恢复前用当前 Registry 重建同一引用闭包并比对指纹；相同 ID 的正文、动作或转移已变化也拒绝恢复，不把旧等待点接到新内容上。输出 ID/序号、队列位置、JSON 载荷、有限步骤与后继请求均在替换当前游戏状态前校验。清空或裁剪过的历史允许缺少已提交正文，不因此补发。Story 的命令和计时事务内不允许捕获半提交快照；重入保存返回 Busy。

## 例子：能读取存档，但局内进度无法续接

`GameInstance.load()` 先检查版本和 Story playback，并恢复基础状态；随后分别尝试恢复 Map 和 Operation。若某个 Run 返回 `rejected`，运行时记录警告，提示该局可重新开始。也就是说，“基础存档已恢复”和“某个局内 Run 可续接”是不同的检查结果；排查时应同时查看对应 Run 的恢复诊断，而不是仅确认存档 JSON 存在。

若 `SaveSystem.load()` 发现版本不匹配，它返回 `null`；`GameInstance.load()` 对缺少必要 Story playback 的数据则抛出格式错误。这是不同层次的检查：前者检查存储内容的版本门槛，后者要求 Runtime 恢复所需的结构。Init 切换过程中哪些字段进入快照，见 [[init-state-snapshots]]。

源码入口：`src/engine/contracts/save-version.ts`、`src/data-services/persistence/storage.ts`、`storage-adapter.ts`、`datapack/pack-storage.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`runtime-save-codec.ts`、`runtime-save.ts`、`src/arona-clicker/services/story/story-playback-snapshot.ts`、`src/arona-clicker/state/init-savepoint.ts`、`per-init-fields.ts`、`src/ui/controller/controller-save.ts`、`src/ui/controller/controller-core.ts`。测试见 `tests/data/persistence/storage-save-version.test.ts`、`storage-adapter.test.ts`、`pack-storage.test.ts`、`tests/engine/character/character-persist.test.ts`、`story-node-save.integration.test.ts`、`gameplay-b-map-save-resume.test.ts`、`tests/ui/controller/controller-init-select.test.ts`。

继续阅读：[[state-and-events]]、[[session-and-tick]]。
