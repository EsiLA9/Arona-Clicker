# Task-0055：运行时单 Mod 数据包编辑态 MVP

状态：active

- **状态**：🟢 临时 ModSpot 创建/编辑/删除已实施，正式 PackManager 持久化仍待后续
- **目标**：以当前已加载的 Datapack 为只读背景，在“设置 → 数据包管理”中开启编辑态，创建一个不与已加载包重名的 Mod，维护 Mod 元信息，并在任意已有 Area 下创建/编辑一个命名的空 Spot。
- **范围**：编辑态开关、单一编辑会话、Mod 元信息、临时 Spot 的创建/编辑/删除与运行时载入。
- **不在本任务**：正式热插拔、效果撤出/载入、悬置引用、复杂功能项、导出 ZIP、保存到 PackManager、修改已有 Datapack 实体。

## 设计约束

1. 当前 Registry 是背景，只读；编辑草稿不写入正式 Registry、PlayerState 或 PackManager。
2. 一个编辑会话只允许一个新 Mod；`modName` 不得与 `registry.loadedModNames` 重名。
3. Spot 使用三段式 ID：`<modName>:spot:<idName>`；创建后 ID 不变。
4. 空 Spot 无功能项、无 Shop、无 Gacha、无 Affector、无 Trigger、无 Reveal 门槛，不自动成为 Area 的 `defaultSpots`。
5. 第一版编辑字段：Mod 名称/版本/作者/简介；Spot 名称/描述/基础花费/花费资源/基础产出/产出资源/容量。
6. 退出编辑态默认保留草稿；显式放弃才清除草稿。

## 施工切片

### P0：状态与路由 ✅

- 在 `PanelState` 增加编辑态会话模型。
- 在设置页“数据包管理”入口增加编辑态开关。
- 开启后显示编辑会话区域，关闭前提示未保存草稿。

### P1：Mod 元信息 ✅

- 新建 Mod 表单与命名校验。
- 拒绝已加载 Mod 重名、非法命名和空名称。
- 展示当前编辑中的 Mod 元信息。

### P2：空 Spot 编辑 ✅

- Area 选择器读取当前 Registry 的 Area。
- 创建一个空 Spot 并自动生成命名空间 ID。
- 编辑最小字段并支持删除当前草稿 Spot。

### P3：临时 Overlay 载入 ✅

- 将单一 Mod + Spot 草稿编译为内存 Datapack。
- 先与当前启用 Datapack 一起经临时 Registry 校验，再重载 Registry 与运行时索引。
- 重载前保存并恢复 PlayerState，保持当前 Init / Area / 已有进度。
- 应用成功后 Spot 出现在正式 Registry 与当前 Area 的游戏侧列表；不写入 PackManager。

### P5：临时 Spot 生命周期 ✅

- 创建 Spot 时先校验 Mod/Spot ID、Area 引用和 Registry 内容碰撞，校验通过后直接载入当前游戏。
- 已载入的临时 Spot 从 Area 游戏侧卡片进入同一套编辑器，保存后原子替换 Overlay 内容。
- 支持从 Area 游戏侧卡片删除临时 Spot；删除只移除临时 Overlay，不触碰背景 Datapack。
- 创建、编辑、删除成功后关闭浮窗并回到游戏侧，不返回数据包编辑页。

### P4：测试与验收 ✅

- 补充渲染/交互测试。
- 类型检查、专项测试、全量测试。
- 手工确认开启/关闭编辑态不改变游戏 Registry 与 PlayerState。

## 当前实现记录

- 编辑态开关位于“设置 → 数据包管理”的“全部数据包”区域。
- 当前草稿保存在 `PanelState`，属于会话级 UI 状态；关闭编辑态即放弃草稿。
- 已支持一个 Mod 元信息和一个临时 Spot；Spot 创建后直接进入临时 Overlay。
- 临时 Overlay 不写入 PackManager，下一次正式启用集应用会被替换；这是当前会话级载入语义。
- 已支持从游戏侧 Spot 卡片编辑和删除临时 Spot，操作失败保持原运行时内容。
- 删除临时 Spot 时必须明确选择“保留 PlayerData”或“删除并清理 PlayerData”；清理范围包含当前状态、各 Init 快照中的等级/管理人及 Spot 标签覆盖。
- 已通过 `npx tsc --noEmit`、专项 UI 测试（6 tests）与全量测试（146 files / 1389 tests）。

## 验收标准

- 设置页的“数据包管理”中可以开启编辑态。
- 可以创建合法的新 Mod，且与已加载包重名时被拒绝。
- 可以在任意已有 Area 创建一个命名空 Spot。
- Spot 编辑字段可以保存到当前草稿并在重新渲染后保持。
- 创建提交通过校验后，Spot 直接出现在正式 Registry 与所属 Area 索引，并保留当前 PlayerState。
- 游戏侧 Spot 卡片可以打开同一套编辑器更新临时 Spot，或删除临时 Spot；背景 Datapack 内容不受影响。
- 删除确认弹窗提供两种 PlayerData 策略：保留时可用同 ID Spot 恢复，清理时对应状态记录同步移除。
- 放弃编辑后草稿清空，重新开启时没有残留。

## 待补充需求：临时 Mod Spot 运行时生命周期

### R1：创建即载入

- 用户完成 Spot 字段编辑后，先执行 ID、Area 引用、modName、同类实体/引用完整性和 Registry 合并校验。
- 校验通过后直接把 Spot 加入当前运行时 Overlay 并刷新游戏，不再以“是否加入游戏”作为二次确认。
- 校验失败必须保持原运行时状态，并明确指出碰撞、悬空引用或非法字段等原因。
- “直接生效”仅针对当前运行时会话，不等同于写入 PackManager 或导出正式 Datapack。

### R2：临时 Spot 编辑与删除

- 已载入的临时 Mod Spot 可从 Area/Spot 游戏侧入口重新打开同一套编辑器。
- 编辑修改先在 Overlay 中完成校验，通过后原子替换旧 Spot，并刷新 Area 索引、Visibility、GameNum、Affector/功能索引和 UI。
- 删除前核验玩家状态、功能项/效果、引用和挂载关系；当前无引用或可安全撤出的 Spot 可直接从临时 Overlay 删除并刷新。
- 删除不得误删背景 Datapack 内容；删除失败必须保持原运行时状态。
- 若存在目标引用或挂载，后续接入“效果撤出与载入”和“悬置/不安全指向目标”策略。

### R3：验收口径

- 创建成功后无需再次确认，Spot 即在当前 Area 展示并进入运行时 Registry。
- 编辑成功后 Spot 的 ID、Area 索引和字段立即保持一致并生效。
- 删除成功后 Area 列表、Registry、运行时索引和 UI 均同步消失。
- 碰撞或非法引用校验失败时，不改变旧运行时状态。

## 后续衔接

本任务下一阶段扩展效果撤出/载入、悬置引用、正式 PackManager 持久化与导出。
