# Operation 内容创作：从定义到入场

本文用独立 Datapack Editor 的现有测试内容，解释 Operation 定义怎样互相引用，以及为什么字段可编辑并不代表一场作战一定能开始。运行时流程见 [[operation-runtime-and-admission]]、[[operation-action-planning]]；编辑器字段来源见 [[editor-schema-to-form]]。

## 六类定义各做什么

| 表 | 作者声明的内容 | 关联入口 |
| --- | --- | --- |
| `operationEvents` | 一场 Operation 的位置集合、起点、参与者、事实、轨道和版本 | `locationIds`、`initialLocationId`、参与者 profile、卡池 |
| `operationLocations` | 每个地点的场景、目标和路线 | Scene 引用 Action；Route 指向 Event 允许的地点 |
| `operationActions` | 可被参与者或场景使用的行动、目标和效果 | 被地点、Scene、角色 profile 或卡池引用 |
| `studentOperationProfiles` | 学生参与时的候选行动及相关配置 | Character、Action、Strategy Profile 与 Card Pool |
| `operationStrategyProfiles` | 参与者行动的策略偏向 | 由学生 profile 引用 |
| `operationCardPools` | 可进入卡池的行动与权重 | 被 Event 或学生 profile 引用 |

这些表在 `tools/datapack-editor/validate/operation-authoring.test.ts` 的 `makePack()` 中同时出现。表单提供引用选择和跳转，但定义之间能否组成可加载内容仍需验证；游戏入场时还要检查实际角色与当前内容。

## 例子：选择行动并走向出口

测试 Event `sceneauthoring:event:demo` 指定两个 Location：`choose` 为起点，`exit` 为后续地点。起点 Scene 声明两个本地 SceneAction（`inspect-a` 和 `inspect-b`），分别引用全局 Action `inspect` 和 `assist`；`sceneActionChoice` 要求从这两个本地 ID 中恰选一个。场景还提供一个买水选项，引用 `buy-water` Action 和 Event 中声明的 `water-purchased` Fact。完成目标后，路线指向 `exit`，并声明所需的 `route-key`。

这里有两种 ID：`sceneauthoring:action:inspect` 标识 Action 定义，`inspect-a` 仅在 Scene 内标识这次行动选择。把候选选择写成不存在的本地 ID，或者把行动引用写成不存在的 Action ID，编辑器校验会在相应字段路径报错；`chooseExactly` 超出候选数量也会报错。测试还覆盖 Route 指向一个虽然存在、但不在该 Event 的 Location 集合中的目标，说明“有此定义”并不等于“可用于本 Event”。

```text
Event 选定起点与参与者
  → Location / Scene 引用 Action、Fact 和 Route
  → EditorModel 编辑与校验 → 导出数据包
  → Registry 内容校验 → Operation Entry 按当前角色和内容准入
  → Run 快照与行动提交
```

箭头是内容和运行流程，不表示每次编辑都会自动装入游戏。测试的 Character 对象是供编辑器引用检查的精简夹具，不应直接当作完整产品角色定义复制。

## 排查和核对

1. 检查 Event 的 `locationIds` 和起点，再核对 Scene 的本地 ID 与全局 Action ID。
2. 检查 Route 目标属于该 Event，Fact 和卡池已声明；按编辑器报出的路径定位嵌套字段。
3. 保存并校验包后，检查 Registry 最终内容与入场角色/Profile；编辑器校验通过不保证该玩家满足准入条件。
4. Run 已开始后排查行动或路线，转到 [[operation-action-planning]]，不要把编辑器草稿当作本局快照。

源码：`src/data-services/contracts/operation.ts`、`src/data-services/registry/operation-content-validation.ts`、`src/arona-clicker/services/operation/operation-participant-admission.ts`。测试：`tools/datapack-editor/validate/operation-authoring.test.ts`、`tests/engine/operation/operation-participant-admission.test.ts`。
