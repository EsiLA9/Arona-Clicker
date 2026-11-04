# Task 0353：Story 编辑器与引擎的剩余编写缺口

状态：调查完成，施工已转入 [[ai/plan/task-0354-story-editor-authoring-api]]。下表是 2026-11-04、`d39b72d` 时的调查快照；当前实现与验收以 0354 为准。

## 目标与范围

让游戏内 `src/ui/story-editor/` 能表达引擎已有的 Story 作者能力，并形成可投放、可验证、可重载的内容。这里记录尚未支持或只支持一部分的内容；“原值保留”不算可编辑。

这是 [[ai/plan/task-0343-story-authoring-full-coverage]] 与 [[ai/plan/task-0348-story-talklet-click-authoring-coverage]] 的当前缺口摘要，不重新引入已经补齐的待办。独立 Datapack Editor 不在本任务范围。下表为后续施工候选，具体实现按分组验收推进。

## 当前缺口

| 项目 | 当前支持程度与影响 | 后续需要 |
| --- | --- | --- |
| Click 内的局部标记动作 | **编辑不完整。** Button result、Choice option result、sharedActions 都可选择 `localFlag`，但 `actionEditor()` 仅为 Operation 调用根 action 专用表单；Click 内没有名称、操作和值字段。Choice 拖放自动生成标记不等于支持手工编辑这些动作 | 让同一动作在所有合法位置都可编辑；输入缓存按稳定动作行隔离，增删换序不串值 |
| 数值表达式 | **只读保留。** `numericValueEditor()` 只编辑标量，`StoryNumericValue` 的 `ValueExpression` 对象不能新建或修改；影响资源、等级、物品、好感、Extra 增量等数值 | 支持字面量与表达式的创建、修改、切换及校验；保留未知 / 错误输入供修正 |
| 局部 flags 的复合 JSON | **只读保留。** 根 Operation 支持文字、数字、布尔、null；合法对象 / 数组只能保留原值，或改成标量替换 | 补对象 / 数组的编辑能力，覆盖嵌套动作位置；不改变 flags 的键存在判断语义 |
| Extra 与持久 flag 的复杂值 | **部分支持。** `setFlag` / `setExtra` 只有文字、数字、布尔输入；表达式和 `ExtraValue` 树只读。`StoryDef.extra` 没有专用入口，已有合法内容随投影保留 | 补表达式与 Extra 树编辑；区分 `StoryDef.extra` 元数据、持久 `setFlag` 与本次 Entry 的 `localFlag` |
| 主题的详细覆盖 | **只读保留。** theme 已可编辑 scope、entityKey、colorGroupId；`palette/tokens/nodes/background` 仅在原值存在时显示，只能保留或移除 | 能新增与修改这些覆盖，按实际主题合同验证；不把已有色组选择重复建设 |
| StoryEntry 与羁绊关联 | **无专用入口。** 可插入 `kizunaCard`，但不能配置其所在 Entry 的 `kizuna.entryId/areaId/returnFlags`。Entry 的类型、owner、Init 范围、触发 / 揭示、好感门槛、奖励、冷却 / 阻塞、travelToStartContext、reactions、followUps、pushAfterStory 等也不在 Story 正文编辑器中 | 增加受限的 Entry 配置入口，优先打通“父正文 → 直接 / Area 赴约子故事 → flags 回传”；遵守引擎一层子调用与独占关联检查 |
| 投放与目录组织 | **无专用入口。** 只能引用已经存在的 Entry；不能在此编写 PassivePool 的 children、权重、条件与冷却，也不能维护剧情导航目录。通用运行内容策略目前仅覆盖 Init / Area / Spot / Enhancement，不能视为已有 StoryEntry / pool 编辑 | 在正文之外提供关联的投放配置，能从已编辑 Story 找到实际触发入口与归类 |
| 文档身份 | **只读。** Story 名称与起始场景可改，`StoryDef.id` 只显示；新建使用生成的 local ID，没有“指定身份 / 另存为新身份”的入口 | 先明确新建 / 另存的身份入口；不直接重命名已发布 ID 并隐式改外部引用 |
| 执行验证与包保存 | **流程未闭合。** 中栏只预览静态条目；Operation 为摘要，不执行条件、旅行或父子回调。“保存草稿”与“保存到运行内容”已有，但不会写回目标包，也不会替作者创建 Entry；运行内容重载后不由该保存动作保留 | 提供明确的试播 / 验证入口与目标包写入流程；区分草稿、当前运行生效和可重新载入的内容 |

## 已支持与需要澄清的部分

- 六类顶层节点（含 `moveToArea/moveToCharaspace`）、Story 起始 Area / Chara、节点与选项 ID 更改均已有入口，不再列为缺失。`areaContinue` 已能选择地点；`kizunaCard` 缺的是 Entry 关联配置。
- Talklet 呈现四字段现已平铺并带标签 / 说明；允许默认的枚举已可切回默认。该项由 `d39b72d` 补齐。
- 条件编辑器已覆盖 AND / OR 与当前全部 17 个 ConditionTarget；欠缺的是条件键候选与用途说明，不是条件类型全集。覆盖层对齐、模板、基础字型、实体表现选项 / lifetime 等仍有未标明字段标题的下拉框，可延续“标题—控件—说明”布局。
- 状态动作 `setFlag` 下拉文案仍写“写局部标记”，实际写持久 flags；应修正文案，避免与 `localFlag` 混淆。
- token、游标、随机状态、表现队列等运行状态不是作者字段；`stages/stageId` 仅兼容元数据。禁止嵌套子故事等引擎限制也不属于编辑器缺口。

## 施工顺序与验收

1. 先修嵌套 localFlag 的实际编写断点、标记文案和字段标题；验证独立行输入、换序、保存恢复及运行分支。
2. 补 Entry 羁绊关联与最小投放闭环；能够仅用编辑器编写“通讯录邀约 → Area 子故事 → 原空间接续”，返回仅传白名单局部 flags，子结束保留最终场景并恢复合法 Click。
3. 再补表达式、JSON / Extra、主题详细覆盖与其余投放配置；每组都需可新增、修改、删除 / 恢复默认，并保留未开放数据。
4. 最后完成试播和目标包保存 / 重载；提交校验与 Runtime 使用同一合同，不用静态预览代替执行验收。

## 相关文件与调查结果

| 路径 / 入口 | 用途与状态 |
| --- | --- |
| `src/data-services/contracts/story-node.ts`、`story-node-actions.ts`、`story-entry.ts`、`passive-pool.ts` | 已核对作者合同；未修改 |
| `src/ui/story-editor/property-fields.ts` | 已核对 actionEditor、数值 / 复杂值 / 主题 / 条件 / Click 表单；未修改 |
| `src/ui/story-editor/flag-fields.ts`、`model.ts`、`property-model.ts` | 已核对根局部值缓存、草稿投影与编辑路径；未修改 |
| `src/ui/story-editor/view.ts`、`controller.ts`、`persistence.ts` | 已核对文档属性、静态预览、保存入口和草稿范围；未修改 |
| `src/data-services/authoring/story-definition-projection.ts`、`content-policies.ts` | 已核对合法复杂值与当前可写内容类型；未修改 |
| `src/arona-clicker/services/story/story-node-player.ts` | 已核对 localFlag 与 requiresFlag 的实际执行；未修改 |
| `tests/ui/story-editor-properties.test.ts`、`story-editor-properties-model.test.ts`、`story-editor-properties-acceptance.test.ts` | 后续回归入口；本轮仅查阅相关断言，未运行 |
| [[runtime-editor-and-project-checks]]、[[story-and-effects]] | 当前保存边界与受限子调用语义依据 |

- 本轮交付：本 Task 与活动索引；未修改编辑器或引擎，未运行游戏 / 浏览器 / 自动化游戏测试。
- 文档检查仍有原有 6 处缺失链接，本次未增加；差异空白检查通过。两份文档的地图只读核对均为未关联路径，不改图或刷新。
- 下一步：由 0354 记录施工与验收；不将本调查快照当作当前缺口清单。
