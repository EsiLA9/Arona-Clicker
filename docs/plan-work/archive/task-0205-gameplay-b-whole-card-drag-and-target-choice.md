# Task 0205 — 玩法 B 整卡拖拽与目标选择

状态：done — U1–U3 完成；代码、测试与浏览器验收收据见下文

## 目标

让玩家能从己方准备行动卡的整张可见卡面开始拖拽；拖动超过点击阈值后显示合法目标选择态，并按单目标 / 多目标规则提交或确认。拖拽、选择和取消均不得推进战斗回合。保持玩法 B 是独立原型。

## 设计边界

### 可拖动卡牌

- 仅当前待结算的己方行动卡可改目标，且 Runtime 提供的 `PlayerTargetEditOption.editable` 必须为 `true`。
- 独立、可改目标的免费技能卡按同一规则可拖动；绑定了行动或效果、敌方意图、场所卡及目标组固定的卡不可拖，并显示现有只读 / 固定原因。
- “整卡可拖”指整张**可见卡面**都能起拖。重叠层中被遮住的底层像素不能同时属于上层和下层卡；版式必须为各张可拖卡保留足够且互不混淆的可见命中区域。特殊技能卡仍按现有设计位于右侧高层。

### 交互与选择态

1. 按下可编辑卡先记录来源；移动超过阈值后才起拖。未达到阈值的普通点击继续打开普通卡重选架。
2. 起拖后显示一个 ghost、高亮合法目标并显示指向当前候选对象的关系线。仅移动 / 高亮不写 Runtime。
3. 单目标卡落在合法目标上后立即原子提交，随后移除 ghost 与候选选择态并更新卡面、关系线和回合预览。
4. 多目标卡落在合法目标上后进入目标组选择；落点作为首个候选，面板展示已选数、固定槽和所需数量。只有目标数合法并确认后提交；确认前不写 Runtime。
5. 非法目标、空白处或画布外落点取消本次拖拽、清除候选态并显示简短提示；原准备行动不变。
6. Escape、取消控件、`pointercancel`、捕获丢失、窗口失焦及当前批次销毁均清理临时选择态。选择进行中主 Click 禁用；无自动超时，不因时间经过而隐藏选项。
7. 目标确认 / 取消、无效落点或战斗批次结束后，临时选项退出渲染；卡片 hover、聚焦查看连线不等于开始选择。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| View 已有 pointer 阈值、单一 ghost、候选高亮、落点解析以及取消 / 捕获丢失清理；当前拖拽源限定为 `option.editable`。 | `prototypes/gameplay-b/src/view.ts`：`beginDrag`、`endDrag`、`pointerdown`、`pointercancel`、`lostpointercapture` | 沿用现有事件委托和 Runtime 接口，重点明确整卡命中、可见卡排布及状态收敛。 |
| 当前普通卡 click 打开重选卡组选架；多目标落点进入已存在的目标选择面板，含固定目标和确认控件。 | `prototypes/gameplay-b/src/view.ts`：`openChooser`、`beginTargetSelection`、`renderEditPanel` | click 与 drag 的边界需保持可预测；多目标流程复用现有 UI。 |
| Runtime 暴露 `targetEditOptions` 和原子目标编辑 API；普通 / 免费技能目标变化后会重算 recipe plan。 | `prototypes/gameplay-b/src/runtime.ts`：`getTargetEditOptions`、`editPlayerAction`、`editFreeSkillTargets` | 本 Task 不另造目标规则或绕过 Runtime 校验。 |
| 战斗卡按独立可见槽位排布；只有 `editable=true` 的己方卡可拖，拖拽时禁用文本选择和原生文本拖放。 | `prototypes/gameplay-b/src/view.ts`：`preparedCardPosition`、`showPreparedBatch`；`prototypes/gameplay-b/src/style.css`：`.is-target-draggable` | 普通卡与免费技能保持各自可见命中面，特殊技能仍位于右侧较高层。 |

## 施工切片

### 0205-U1：整张可见卡面的拖拽起点

- 允许从符合资格的行动卡任意可见卡面区域起拖，并保留 click 重选卡组行为。
- 起拖后只创建一个 ghost；pointer move 只更新 ghost、合法目标提示与关系线，不重建整页或写 Runtime。
- 调整卡片排布 / 覆盖关系，保证卡面来源可区分，特殊技能卡依旧在右侧高层。
- 定向测试覆盖拖动阈值、不可编辑卡无拖拽态以及稳定来源引用；浏览器覆盖触发特殊技能后的叠卡场景。

### 0205-U2：目标选择与提交边界

- 单目标合法落点直接提交；多目标落点进入暂存选择，按确切数量、固定槽和候选规则确认。
- 非法落点不改 Runtime、不扣 sCost、不改配方或 Click 数；目标确认后同步卡面、目标关系与回合预览。
- 补充纯逻辑定向测试；不复制或放宽 `player-card-edit.ts` 已有目标合法性规则。

### 0205-U3：选择态退出与整轮验收

- 为非法落点、Escape、显式取消、`pointercancel`、`lostpointercapture`、blur、批次销毁及结算离场定义统一清理收敛点。
- 选择态激活时禁用主 Click；任何退出路径回收 ghost、目标高亮和临时选项，焦点回到来源卡或主操作。
- 浏览器验证普通点击重选、单目标改选、技能叠卡命中、无效落点、Escape / 显式取消及战斗 Click 后批次清理。当前 12 节点没有可变多目标玩家行动；不添加路线内容，固定槽、数量与确认门槛由纯逻辑定向测试覆盖。

## 测试与验收

- [x] 浏览器中从可编辑卡片标题文字起拖成功；单目标落点更新预览和连线，普通 click 打开卡组选择架。
- [x] 卡面分层无歧义：独立槽位避免行动卡 / 特殊技能卡互相遮挡；只读卡没有拖拽态；编辑卡禁用文字选择与原生拖字。
- [x] 单目标有效落点即时提交；多目标有效落点仅暂存，纯逻辑测试覆盖固定槽、初始落点、数量上限与确认门槛。当前路线没有可变多目标行动，因此不新增路线内容。
- [x] 非法落点清理 ghost / 候选高亮并提示，保持 pending 目标；Escape 与显式关闭退出选择，主 Click 在选择期间禁用。
- [x] 拖拽改目标不推进 `clickCount`；只有后续唯一主 Click 才结算准备状态。
- [x] 玩法 B 定向 / 全量 Vitest、原型类型检查、独立构建、根类型检查、`npm run check:docs` 与 `git diff --check` 通过。
- [x] 本 Task 只改玩法 B 卡片视图与样式 / 定向测试；不改地图规则、AC Runtime、正式 UI 或内容规则。

## Must Read / Read Set

- `prototypes/gameplay-b/src/view.ts`：当前事件委托、pointer 状态、ghost、目标面板、稳定批次与卡片定位。
- `prototypes/gameplay-b/src/style.css`：prepared card 堆叠、目标高亮、编辑控件与 ghost 层级。
- `prototypes/gameplay-b/src/runtime.ts`：`PlayerTargetEditOption`、目标编辑入口与主 Click 禁用联动。
- `prototypes/gameplay-b/src/battle/player-card-edit.ts`：合法目标组、固定目标、数量和确认校验。
- `prototypes/gameplay-b/tests/player-card-edit.test.ts`、`prototypes/gameplay-b/tests/battle-cards.test.ts`：候选组及卡片投影回归覆盖。
- `docs/plan-work/archive/task-0201-gameplay-b-player-card-targeting-and-reselection.md`：现有交互基线与多目标既定边界。

## Allowed Files

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/src/battle/player-card-edit.ts`
- `prototypes/gameplay-b/tests/player-card-edit.test.ts`
- `prototypes/gameplay-b/tests/battle-cards.test.ts`

## 明确非目标

- 不改变合法候选目标、角色排位、CardTag recipe、sCost、卡组、技能触发率或敌方意图。
- 不改 Route / Battle Runtime 状态边界，不把普通输入变成结算，不添加实时计时或速度要求。
- 不修改 `index.html`、入口端口、AC Runtime、`src/ui/` 或主项目内容。

## 停止条件

遵循 `docs/ai/PROJECT-CONSTITUTION` §停止条件。若必须改 Allowed Files 外文件、改变既有目标合法性 / 架构边界、事实与本 Task 冲突，或必需验证无法执行，则暂停该 Unit 并报告证据和问题。

## Execution Receipt（2026-10-03）

### U1 — 整张卡面拖拽

- `view.ts` 为每张准备卡提供独立纵向可见槽位，预留对应角色卡的宽高；拖拽仍由 `PlayerTargetEditOption.editable` 决定。
- `style.css` 对可编辑卡面与其子节点关闭文本选择、原生文本拖放；指针越过 6px 才起拖，ghost 使用一次性卡面克隆。
- 卡牌关系 SVG 只在目标拖拽期间提升到卡层之上；关闭编辑或结束拖拽即移除提升状态。

### U2 — 目标提交边界

- 单目标合法落点沿用 Runtime 原子编辑入口直接提交；固定 / 多目标落点通过现有候选、固定槽、数量与确认规则暂存。
- 非法落点只显示提示，不改 Runtime、sCost、配方或 Click 数；重新选择普通卡组仍由普通 click 打开。
- `battle-cards.test.ts` 覆盖 6px 阈值、仅 editable 卡可起拖、独立可见卡槽、多目标初始落点、固定槽、数量上限及确认条件。

### U3 — 取消、回收与验收

- 统一清理涵盖 Escape、显式取消、`pointercancel`、捕获丢失、blur、批次销毁与结算更新；取消期间主 Click 禁用，离场时焦点回到主操作。
- 拖拽后用捕获阶段的一次性 click 抑制器吞掉浏览器合成 click；无 click 时下一个 pointerdown 清理残留抑制状态。普通 click 仍打开行动卡组。
- 浏览器在固定路线第 2 战斗回合验证：从“鼓舞”标题文字拖至“纺希”卡后，预览目标和曲线关系线更新，且没有文字选取或意外打开卡组；非法拖到空白区保留目标并显示提示；普通 click 打开卡组选架，Click 暂时禁用，Escape 退出后恢复；卡牌与特殊技能分槽显示。
- 当前 12 节点没有可变多目标玩家行动；多目标 UI 通过纯逻辑测试验证，未扩展地图或角色内容。

### 最终核验

- `prototypes/gameplay-b`：最终 `npm test` 16 个文件 / 147 项通过；定向 `battle-cards` 与 `player-card-edit` 15 项通过；`npm run typecheck`、`npm run build` 通过。
- 根项目：`npx tsc --noEmit` 通过；`npm run check:docs` 扫描 573 篇 Markdown、0 errors；`git diff --check` 通过（仅报告现存行尾转换提示）。
- 根 `npm test -- --reporter=dot`：1,876 项中 1,867 通过、9 失败，分布于 `tests/engine/gear-system.test.ts`、`tests/ui/controller-init-select.test.ts`、`tests/ui/runtime-editor-pack-export.test.ts`、`tests/ui/topbar-settings-workspace.test.ts`、`tests/ui/ui-host-registry.test.ts`。失败内容与玩法 B 拖拽无关；本 Task 的玩法 B 全量 Vitest 全数通过。
- 本 Task 对 `view.ts` 的施工仅限战斗卡拖拽 / 编辑区域，对 `style.css` 与 battle 卡片测试的改动限于卡槽、拖拽反馈和目标选择边界；未施工地图 Runtime / 路线内容或 AC Runtime。

## 剩余工作

- 无。狙击等攻击卡能否切换目标仍由现有 `editable` / 合法候选目标规则决定；更改这些目标规则不属于 Task 0205。

## 相关路由

- [[task-0201-gameplay-b-player-card-targeting-and-reselection]]
- [[task-0202-gameplay-b-overlapped-card-drag-hit-area]]
- [[docs/ai/PROJECT-CONSTITUTION]]
