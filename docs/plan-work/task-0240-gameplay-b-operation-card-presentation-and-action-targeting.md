# Task 0240：Gameplay B Operation 行动牌呈现与目标语义收敛

状态：in progress — U0 候选隔离、U1 学生牌与战术牌面、U2 Hover/focus 目标线已实施；试玩启动回归已修复，定向测试与类型检查通过；浏览器验收尚未执行。

## 目标

修正 AC 移植版 Gameplay B Operation 中重复的角色行为文案、选中行动牌的位置与牌面信息层级；隔离战斗候选牌与后续 SceneAction；并让首幕目标型行动的牌面明确表达角色行动所指向的旋转木马。保留现有 OperationView / Runtime 写入边界、行动结算和单名学生干预规则。

## 分类

| 项 | 类别 | 当前判断 |
| --- | --- | --- |
| 1. 人物卡内重复行为文案 | UI 文案 / 信息密度 | `renderStudent()` 将角色 presentation description 放在姓名下；当前计划牌已再次表达行动。移除该复述，保留身份、HP、资源与行动信息。 |
| 2. 选中行动牌右侧悬浮 | UI 布局 / 牌与角色归属 | 牌由 shared fixed layer 按人物卡外缘定位。新需求希望选中牌可占用人物卡右侧内部区域；这改变 Task 0236 的既有“人物卡外侧独立牌层”展示契约，但无需改变牌的数据 owner 或 Runtime。 |
| 3. 类型描述、标题字号与牌高 | UI 牌面层级 / 尺寸 | 当前牌有 `.operation-card-type`、9px 两行标题，以及固定 112×62 尺寸和裁切；动态牌高还须同步定位器和替代牌面板的几何计算。 |
| 4. 首幕多出的三张禁用战术牌 | 内容候选污染 / UI 暴露 | 源码已确认三张来自后续场景行动 ID 被追加进每位学生战术候选；地点只将其标为未启用，投影仍保留并显示为禁用替代牌。应分离 SceneAction 与战斗候选。 |
| 5. 三种角色行动如何指向唯一目标 | 目标呈现 / 玩法规则 | 当前首幕三张指定行动已有唯一合法目标 carousel，现由牌面 Hover/focus 线索显示实际目标；不抽象通用角色→目标映射规则。两个无目标备选仍无目标。 |
| 6. 目标关系线不随 Hover 重现 | UI 交互 / 临时表现状态 | 已为当前战术行动牌增加 Hover/focus 关系线；拖拽越过阈值后拖拽预览优先。关系线仍为临时 UI 表现，不写入 Run。 |

## 设计边界

- 本 Task 包含：学生卡文案；人物卡与选中行动牌的布局；行动牌标签、标题和高度；战斗候选与 SceneAction 候选隔离；首幕唯一目标显示和规则边界核验。
- 明确非目标：改变 Operation Run / SaveData / PlayerState 归属；改变三张首幕行动效果、费用、行动优先级或干预槽数量；重做 SceneAction 批次和玩家 SceneCard；把所有 Operation 面板统一改成卡片。
- 保留共享牌层和稳定 Actor 锚点作为优先实现方向，除非布局调查证明必须调整 DOM 归属；不得因视觉内嵌而让 UI 直接依赖 Runtime 规则对象。
- 本轮按 Task Owner 的“先处理这些内容”授权落地以下局部方案；不新增通用角色→目标规则。牌种范围限制在战术行动牌，保留场景牌、玩家 SceneCard 与 Intent 的类型信息。

```text
DOM budget:
- 新增 wrapper / 节点：0；复用学生卡、shared prepared-card layer 与既有 relation SVG。
- 稳定节点：学生身份卡、当前/替代战术牌、目标 Actor 和 Operation workspace frame。
- behavior：Hover/focus 更新关系 SVG path 与临时引用；布局器更新当前牌定位和 owner 保留高度。
- region：Runtime 命令改变候选或 Run 后只更新既有 operation region。
- structure：只在 Workspace route / owner 变化时重建；本次交互不触发 full render。

Interaction preservation:
- 保持学生列表滚动容器自身的滚动行为。
- Hover/focus 线不移动焦点；失焦、PointerCancel 与拖拽结束清除对应临时连线。
- 替代行动展开仍使用已有 behavior 状态和 card identity。
- 目标 Drop 成功后沿用原有单次 Operation region 更新，非法目标不写 Run。
```

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 学生姓名下的行为文案取自 `ACTORS[actor.id].description`，由 `renderStudent()` 输出；星野的原句来自 Gameplay B presentation。 | `src/ui/components/operation-workspace.ts:renderStudent`；`src/arona-clicker/content/operation-samples/gameplay-b-presentation.ts` | 删除这段重复的行为描述，不删除角色身份和战斗状态字段。 |
| 当前战术牌位于 shared fixed `.operation-prepared-card-layer`，`layoutPreparedCardsForHost()` 按 owner 矩形定位于外侧，牌尺寸回退为 112×62；CSS 同时固定高度并裁切。 | `src/ui/controller-actions-operation.ts:layoutPreparedCardsForHost`；`src/ui/css/operation-workspace.css:.operation-card-face` | 选中牌内侧布局和动态高度必须同步更新定位、替代牌面板尺寸与窄视口碰撞行为。 |
| 战术牌渲染 `.operation-card-type` 和 `.operation-card-title`；场景牌、玩家 SceneCard、意图牌也复用部分牌面样式。 | `src/ui/components/operation-workspace.ts:renderAction`、`renderSceneActionOption`、`renderIntentCard`；operation-workspace.css | “移除类型描述”的牌种范围需裁定，避免无意改变其他牌的信息结构。 |
| `carousel-scene-action-slice.ts` 把 `Object.values(IDS.actions)` 的三个 SceneAction ID 追加进三名学生的 `candidateActionIds` / `actionPriorityIds`。首地点 `enabledActionIds` 不含它们。 | `src/arona-clicker/content/operation-samples/carousel-scene-action-slice.ts` | 这是额外卡片的直接来源；不应通过 UI 隐藏来掩盖候选数据污染。 |
| `candidateOptions()` 遍历 profile 候选全量生成 View option；对地点未启用项添加 `action-not-enabled`，而不是过滤掉。操作界面把非当前行动作为替代牌生成。 | `src/arona-clicker/services/operation-view-projector.ts:candidateOptions`；`src/ui/components/operation-workspace.ts:renderAction` / `renderPreparedCardLayer` | 从战斗候选数据源移除 SceneAction ID；保留其 SceneAction 定义及地点场景投影。收紧 UI 回归断言，确保不再出现这三项。 |
| `brace`、`signal`、`shield` 的 Action target 均限制到 carousel Actor；投影通过合法候选设置默认目标。`emergencyStop`、`crowdGuide` 是不同的无目标行动。 | `src/arona-clicker/content/operation-samples/carousel-safety-slice.ts`；`operation-view-projector.ts:candidateOptions`；`src/arona-clicker/services/operation-target-selection.ts` | 首幕三张目标行动的实际合法目标唯一，按 View 默认值可显示旋转木马；是否推广为通用“角色逻辑索引”机制仍待裁定。 |
| Task 0236 将替代牌设为人物卡外侧独立牌层；当前行动牌层序和裁切仍有 Edge 验收未完成记录。 | `docs/plan-work/task-0236-gameplay-b-typed-action-cards-and-target-layers.md` | 本 Task 是新的布局需求，实施时保留独立牌对象、合法目标交互和刷新连续性，并在常规/窄视口重新验收。 |
| 关系线由 `drawCardRelation()` 绘制；本次增加 `renderCardRelationPreview()`，从当前 View 投影的已选/默认合法目标恢复 Hover/focus 预览；活动拖拽覆盖它。线仍不属于 OperationView / Run，离开、失焦或拖拽终止会清理。 | `src/ui/controller-actions-operation.ts:drawCardRelation`、`currentActionRelationTarget`、`renderCardRelationPreview`、`bindCardTargetGestures`；`src/ui/components/operation-workspace.ts` 的 `[data-operation-drag-relation]` SVG | 单次强制改目标的写命令不再是显示线索的唯一触发；当前牌悬停/聚焦直接显示目标关系，拖拽则继续作动态预览。 |

## 文本-潜在解决方案

本轮实施选择如下；需要扩大到其他牌种或建立通用玩法规则时另行裁定：

1. **选中牌布局**：继续用 shared fixed layer 和 Actor owner 锚点；选中的当前战术牌落在角色卡右下方新增的保留区，信息行留在卡片上方。替代牌仍在展开层，owner 宽度不足时才回退到卡外锚点。
2. **牌面字段**：仅从当前与替代战术牌（含无规则自动计划卡）移除 `.operation-card-type`；战术标题收至 8px，说明允许自然换行，战术牌高度自动增长。场景牌、玩家 SceneCard、Intent 保持原类型标签与样式。
3. **唯一目标索引**：不新增通用规则。现有 OperationView 的 selected/default target 继续作为来源；三张首幕目标行动均只允许旋转木马，因此选中牌 Hover/focus 连向其实际当前目标或合法默认目标，无目标行动不生成连线。
4. **候选过滤位置**：从 carousel scene-action sample 的学生 Profile 战术候选中移除三个 SceneAction ID；保留 SceneAction 内容表与后续地点流程。没有改通用 projector 对其它事件地点锁定候选的行为。
5. **目标关系线**：当前战术牌 Hover 或键盘 focus 显示 selected target（缺省时取合法默认目标）；离开 / 失焦后隐藏。拖拽超过阈值后拖拽目标线优先跟随指针下的合法 Actor，drop/cancel 后清理。关系线仅为 UI 临时表现，不写 Run / SaveData。

## 施工切片

### U0：候选来源隔离与目标显示确认

从战术候选 Profile 移除 SceneAction 注入，保留后续地点场景行动；不新增 target 合同，仅复用现有合法唯一目标和 OperationView 默认目标。

### U1：学生信息卡与战术牌面布局

移除姓名下重复行为复述；让选中战术牌显示在角色卡右下保留区；移除战术牌类型文字、缩小标题并使用自然高度，同步替代牌定位与面板尺寸。保留稳定 Actor 关联、状态反馈和独立牌语义。

### U2：交互连续性与视口验收

验证选中牌展开/收起、替代牌定位、合法目标拖放和键盘路径；证明 hover / focus / 选择遵守 behavior/region 刷新等级，人物状态与无关节点保持连续；在常规和窄窗口检查遮挡、裁切、溢出及动态高度。

## 验收与验证

- [ ] 学生身份卡不再重复展示角色行为总结，仍显示姓名、头像、HP、资源及必要的当前状态。
- [ ] 选中的战术牌落在其人物卡右下保留区，仍能读出角色归属；不遮挡姓名、HP、资源或其他角色的可操作区域。
- [ ] 当前和替代战术牌不再显示类型文字；标题更小、说明自然换行、牌高不被固定值裁切；动态高度同步反映到替代牌定位面板。
- [ ] 首地点战斗候选中不再出现 `scene-investigate-control`、`scene-guide-queue`、`scene-team-first-aid` 三张 SceneAction 禁用牌；后续场景仍可使用对应 SceneAction。
- [ ] `brace`、`signal`、`shield` 当前牌 Hover/focus 关系线指向旋转木马；无目标备选不画线。
- [ ] 拖拽线超过阈值后才显示，随合法目标移动；非法位置不显示错误目标线，pointerup/cancel 后清除临时状态；普通 Hover/focus/拖拽不触发整页 render。
- [ ] `OperationView` / Runtime / 存档写入边界、费用及 Beat Commit 规则无非预期变化；鼠标与键盘交互、焦点/滚动连续性符合 UI 项目覆盖协议。
- [ ] 对应 UI / Engine 定向回归、类型检查及必要的浏览器常规/窄视口验收按最终 Unit 计划执行并记录；重要规则改动需测试证明候选和目标行为。

## 当前核验（2026-10-05）

- 初始阶段已委派只读调查角色牌文案/牌位与样式、禁用候选来源、首幕角色目标语义；本次实施另由子 Agent 清理候选并实现目标关系线。
- 已确认给定 `scene-investigate-control` 属于首幕后续地点定义的 SceneAction。当前 AC 样例将三项场景 Action ID 加入战斗候选，首地点未启用后由投影标成不可用；禁用替代牌因此来自内容候选污染，而非 UI 凭空创建。
- 已确认三张指定行动当前都只允许旋转木马为目标，并有合法默认目标；无目标的急停/人群引导是另两项候选，不能混为一谈。
- 已委派只读核查 Hover / 拖拽关系线。源码确认没有 Hover/focus 关系线处理器；只有拖拽超过阈值且命中合法 Actor 时才绘制，拖拽结束/取消时隐藏。关系线不是 Run/View 状态，强制修订目标后不会从已选目标自动重建；若报告中的“拖拽途中无连线”可复现，还需在浏览器检查 pointer 命中及遮挡。
- 已从 scene-action sample 的学生战术候选移除三项 SceneAction ID；后续场景定义保持原样。
- 已移除学生名下行为复述；战术牌与自动计划牌移除类型标签，战术牌标题缩小、说明自动换行，并按 DOM 渲染高度布局替代牌面板。选中战术牌在角色卡右下保留区显示。
- 已增加当前战术行动牌 Hover/focus 目标线；当前已选目标优先于合法默认目标，拖拽预览优先于 Hover/focus，退出 / 失焦 / 拖拽结束按对应路径清理临时线。
- 曾因从学生战术候选中移除 SceneAction 而导致游乐园试玩启动失败：内容校验、场景行动投影与结算规划错误地将 `profile.eligibleActionIds` 也用作后续 SceneAction / 玩家 SceneCard 的执行资格。修复后这些场景资格按学生身份、行动允许参与者类型和所需能力判断，战术候选仍单独受 `eligibleActionIds` 管理；补回归断言证明三项 SceneAction 不出现在战斗行动选项中，同时官方场景 sample 可完成战斗、两类场景行动、玩家卡与奖励流程。
- 更新牌面布局回归用例，改为断言选中牌在 owner 卡片内的右下区域，并覆盖宽度不足时的外侧定位回退。
- 定向验证通过：`gameplay-b-scene-action-sample.test.ts`、`operation-scene-actions.test.ts`、`gameplay-b-operation-controller.test.ts`、`gameplay-b-card-inspector.test.ts`；`npx tsc --noEmit` 与 `git diff --check` 通过。未进行浏览器验收；仍需完成 U2 检查以确认实际卡片尺寸、Hover 目标线命中、常规/窄视口遮挡和键盘连续性。

## GALHCG 影响闭环

- 发现路径：项目绑定 `acprogram`；查询 Gameplay B、OperationView 与 UI Workspace 候选后，回读 `carousel-scene-action-slice.ts`、`carousel-safety-slice.ts`、`operation-view-projector.ts`、`operation-workspace.ts`、布局控制器与 CSS。GALHCG 仅作导航，结论均由源码核实。
- 新文件已定向刷新并登记 File 节点；`concept:operation-event-run-runtime`、`concept:ui-workspace-renderer`、`concept:goal-workflow` 均以 documentation maps_to 本 Task。写后精确 review 为 unchanged、stale Evidence 0，owner 6/6 分页完整；File 搜索命中 1/1，反向 traversal 完整返回三条映射。
- `00-index.md` 中的 Task 登记、`module:planning-records`、项目 contains 与 `concept:goal-workflow` maps_to Evidence 已复核 unchanged、stale Evidence 0、owner 4/4 完整；本轮 Task 补充后重新预览并更新本 Task 的三条 documentation maps_to Evidence。
- 本次实现文件的既有语义 Evidence 已刷新：Operation Runtime 节点与样例映射；UI Workspace Renderer 节点及 Operation 组件/CSS 映射；UI Command to Runtime 节点及 controller 映射。最终 `review_changes` 将确认所有分页和 freshness；本次未改变测试文件。

## 剩余工作

- 本 Task 的通用角色→目标规则和非战术牌类型/布局不在本轮实现范围；若需要扩大范围，另行裁定后施工。
- Gameplay B 卡面目标与交互规则的其他改良不自动纳入本 Task。

## 相关路由

- [[task-0232]]、[[task-0234-gameplay-b-demo-card-surface]]、[[task-0236-gameplay-b-typed-action-cards-and-target-layers]]
- [[docs/ai/context-packs/ui-presentation]]、[[docs/ai/frontend-design-project-overlay]]
- [[docs/docs-829/03-data-structures/operation-view]]、[[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]
