# Task 0309：MapRun 行前与续行准备页

状态：complete — P1–P3、Schema 同步、定向回归与桌面浏览器验收均完成；读档恢复和 Map 内容变更边界已补充验收／审查。

## 目标与范围

本文回答：如何在 Gameplay B MapRun 的首次进入和离开后重返之间增加一个轻量前序页面，提供提示、队伍状态与明确的开始／继续操作。

来源：用户于 2026-10-21 要求“为 MapRun 设置一个进入前—离开重返的前序页面，用于提供简单提示、队伍状态或未来的可选队伍结构；先调查，思考玩法和信息后编写 Task”。以下具体交互为主协调方依据现有代码提出的 V1 实施方案；不是现有功能描述。

V1 交付：设施 Map 入口先打开准备页；无进行中 Run 时显示行前信息，有同地图 Run 时显示续行信息。进入地图现场后可返回该页，再选择继续或返回日常游戏。页面本身不创建、重建或推进 Run。

本 Task 仅针对现有 `GameplayMapDef / MapRun`，不针对区域导航地图，不修改 AreaHero 的概览／Story 职责，也不增加世界线 Lobby。区域导航独立见 [[docs/plan-work/archive/task-0310-area-map-navigation-service-v1]]；两者不共用地图实体或局内状态。

## 玩法与信息判断

准备页解决三件事：玩家知道即将进入什么；知道当前队伍与资源状况；明确是在开启新一局还是接续已有进度。它不是第二个地图现场，不展示全部敌人、未来地点和完整操作牌库。

- **首次进入**：展示简短地图介绍／提示、固定队员的准入情况、初始 HP 与关键初始资源。点击“开始地图”才创建 Run。看完返回不消耗资源、不生成 Run ID、不触发起点内容或抽牌。
- **离开后重返**：展示真实当前地点／活动、队伍当前 HP 与剩余局内资源，主按钮为“继续地图”。继续仅打开相同 runId 的现场，不重做队伍准入、不补满 HP、不重置抽牌和草稿。
- **未来编队**：此处是合理的未来编队承载位置，但 V1 队伍依旧由 Map 定义固定。只在 DTO／组件职责上隔离队伍区域；不增加不可用的“选择队伍”按钮、空槽、战力或尚无规则的职业搭配建议。
- **退出不是读档／回档**：离开现场保留 Owner 中的 Run；存档仍走原有保存机制。页面不能宣称“已保存到磁盘”，也不把退出当作撤销本轮已结算行为。
- **状态可读但不代操作**：受伤或资源不足可以提示，不能让准备页自动治疗、补给、抽牌、完成活动或代选战斗行动。已有队员 HP 为 0 的展示沿真实 Run；不额外发明满员／满血才能继续的规则。

## 当前事实与代码落点（2026-10-21）

| 已核实事实 | 当前源码／测试依据 | 对施工的影响 |
| --- | --- | --- |
| Map 入口由 Spot functionality 声明，已有自定义按钮文案 | `src/ui/components/map/map-entry.ts` 的 renderMapEntryFunctions；`src/data-services/contracts/world.ts` 的 mapEntry/mapEntryLabel | 复用现有设施入口，保留作者文案；按钮改为打开准备页，不再当场开始 Run |
| 入口区分同图继续、其他图有局、功能条件不足 | 同组件读取 mapRun.getSnapshot，检查 inProgress/mapId 和 fn.condition | 准备页保留单一活动 Run 限制；不能静默替换另一局，需处理入口打开后的状态变化 |
| 点击时重核设施属于当前 Area、效用已知与功能有效 | `src/ui/controller/controller-actions-operation.ts` 的 mapFunctionAvailable、handleMapClick | 不能只凭准备页打开时许可；开始／继续前要重核 source Spot／functionality／Map |
| 当前开始动作直接 startMap 后进入 map 路由；继续动作仅切路由 | handleMapClick 的 data-map-entry-start / data-map-entry-continue-run 分支 | 将入口动作与最终开始／继续命令拆开；继续不应新增 resume 写命令 |
| 固定队伍由 Map 声明 | `src/data-services/contracts/gameplay-map.ts` 的 partyCharacterIds、initialPartyHp、initialPlayerCost、initialActorResources、initialTeamResources | 首次预览用 Map 初始值；不能从角色长期培养数据推断战斗 HP／战力 |
| 准入在 GameInstance 内，当前是私有方法 | `src/arona-clicker/runtime/runtime-game-instance.ts` 的 startMap、admitMapParty | 需提供窄只读准入投影，和实际开始复用同一求解，避免 UI 复制逻辑 |
| 准入要求 Character 解锁且有持有的 Registry Variant；同角色多差分按 roster key 排序择首个 | admitMapParty 使用 characterSystem.getUnlocked、rosterSystem.getOwned/getVariant | V1 展示实际自动匹配差分；不将它描述为玩家已选编队，不能为通过准入自动发角色 |
| MapRun 私有 Owner 独立于 UI | `src/arona-clicker/services/map/map-run-service.ts` 的 MapRunService；GameInstance.#mapRunOwner；`src/arona-clicker/contracts/map/map-run.ts` 的 MapRun | 只读页面不持有可写 Run；party、partyHp、currentNodeId、资源、草稿／随机流继续由 Owner 管理 |
| start 会建立 Run、进入起点内容并可能初始化 Encounter／抽牌，也可能起点直接终局 | MapRunService.start 中 openNodeContent、runId 分配与 finishSuccess | 不能调用 start 生成预览再撤销；开始后按真实返回／Workspace View 判断现场还是终局 |
| 返回游戏只退出 Workspace，Run 保留 | `src/ui/controller/controller.ts` 的 returnFromMapWorkspace、disposeMapFlow；`map-workspace.ts` 的 data-map-back | 增加返回准备页路径；离开现场只清理 UI 临时交互，不清 Run |
| 旧继续路径保持 runId 和整个快照 | `tests/ui/gameplay-b-map-vertical-slice.test.ts` 的返回／continue 用例 | 更新为经准备页返回现场，并继续断言快照不变，不能删除原行为保证 |
| 重开沿相同准入队伍创建新 Run，失败恢复旧 slot | MapRunService.restart；GameCommands.restartMap | 续行、重开必须不同；重开才重置 HP／资源／进度并产生新 runId，不重新自动换队 |
| 放弃清除活动 Run，已写长期状态不会回滚 | MapRunService.abandon；controller-actions-operation.ts 的 openMapAbandonConfirmation 与 openMapRestartConfirmation 文案 | 沿用真实命令和危险操作确认，取消无副作用，不额外添加自动放弃逻辑 |
| 活动 Run 可随主 SaveData 保存，恢复校验 resumeVersion 与快照内容 | MapRunService.createSaveSnapshot/restoreSaveSnapshot；`src/arona-clicker/contracts/runtime/save-data.ts`；GameInstance.load | 不增加准备页存档字段；读档成功后的继续页消费恢复 Run，拒绝恢复不能伪造续局 |
| 终局会清活动 slot，保留有限结果，失败结果不进入存档 | map-run.ts 的 MapRunSuccessResult/MapRunFailureResult 与 MapRunSaveSnapshot；getMapWorkspaceView | 准备页不能把“没有活动 slot”解释成某次通关或失败；V1 不做完整局次历史 |
| Workspace 返回位置是单层 | `src/ui/workspace/workspace-router.ts` 的 WorkspaceNavigationState、enter/replaceWorkspaceNavigation；Controller 的 enter/replaceWorkspaceRoute | 游戏→准备页只保存一次来源；准备页↔现场用 replace，不能覆盖最初返回点 |
| 路由镜像对 route-only 页有显式例外 | resolveCurrentWorkspaceRoute 当前保留 map/area 路由；legacy 不携带它们的内部状态 | 新 route 必须接入解析、key、Surface 与刷新分支，不只在 union 添加一个名字 |
| 离开 map route 会清临时 MapFlow | UIController.enterWorkspaceRoute、disposeMapFlow；现有 Map Workspace 的增量协调 | 准备页不承诺保留完整临时聊天历史；必须保留的是领域 Run，旧悬浮／拖拽／选择不污染准备页 |

调查时工作树存在并行 Story／Hero 改动及其他 Task。执行前重核实际文件与依赖，不回滚其他工作；本 Task 不把未验收改动升格为稳定合同。

## 推荐页面与操作结构

采用完整 `map-entry` Workspace，沿现有桌面三栏与主题，不用长确认弹窗承载队伍／提示：

```text
WorkspaceFrame(map-entry，保留全局顶栏)
├─ 左：正常游戏的区域栏（Switch / AreaHero / 当前及临近 Area）
├─ 中：地图名称 + 简介／少量提示 + 当前进度摘要 + 开始／继续主操作
└─ 右：固定队伍只读列表（身份／准入或当前 HP）+ 局内资源摘要
```

返回日常游戏为明确次操作；不要把“返回游戏”“返回准备页”“放弃地图”混用。既有作者入口按钮文案 mapEntryLabel 保留，但准备页主按钮使用明确的“开始地图／继续地图”，避免自定义文案掩盖新建与续行的差别。

### 信息优先级与来源

| 内容 | 新一局 | 续行 | 来源与限制 |
| --- | --- | --- | --- |
| 地图名称／简短介绍 | 显示 | 显示 | Map 名称及可选 entryInfo；不把起点台词或任意 Node 描述当作地图介绍 |
| 提示 | 1–3 条短提示为推荐显示量 | 相同规则提示，优先续行含义 | 作者纯文本，缺省省略；系统提示只说明真实开始／退出／重开语义，不虚构奖励或难度 |
| 位置／进度 | “尚未开始” | 当前 Node 标题，实际活动类型／序号、Encounter 轮次（存在才显示） | 只读 Run／当前投影；不伪造整图完成百分比或预计时长，不展示未来节点／敌人列表 |
| 队伍身份 | 定义顺序的 Character、自动匹配 Variant、头像与准入原因 | 已冻结 party 的 Character／Variant | 继续时不再次择差分；缺失展示资源降级占位，不静默换人 |
| HP | initialHp / maxHp | partyHp / 对应真实 cap | 初始值不一定是满 HP；非 Encounter 地点也要有 cap，不能只能从当前 Encounter 查上限 |
| 局内资源 | initialPlayerCost 及明确声明的 Actor／Team 初始资源 | 当前 PlayerCost、各队员和 Team 余额 | 命名优先现有格式化；区分局内资源与长期背包。内容多时折叠详情，不放全量战斗牌库 |
| 入口不可用原因 | 缺队员、未解锁、功能条件、已有其他 Run、前台忙等 | 当前 Run／入口／前台准入原因 | 精确且玩家可理解，不能只给 MapRunError 原始英文 diagnostics |

右栏只显示队伍结构与本局状态，不加入尚无战斗依据的角色等级、羁绊加成、总战力或“推荐阵容”。普通局内资源不因其与长期资源同名就合并显示。

### 页面状态与主操作

| 状态 | 主操作 | 不可发生的隐式行为 |
| --- | --- | --- |
| 无活动 Run，入口／固定队伍合格 | 开始地图 | 打开页面、刷新、切详情不得预先 start |
| 无活动 Run，队伍或入口不合格 | 禁用开始并显示具体原因，可返回 | 不自动补员、付费、跳过功能条件 |
| 同 Map 活动 Run | 继续地图，携带预期 runId | 不调用 start/restart/restore，不修复或重置草稿 |
| 其他 Map 活动 Run（竞态到达此页） | 禁用开始，说明已有其他地图进行中 | 不自动放弃旧 Run、不暗中切到另一个 Map |
| 来源设施／地图已失效 | 显示不可用，可返回 | 不以旧 DOM 身份提交，不把失效内容当新一局 |
| 正在提交 | 相应动作禁用 | 双击或旧事件不得创建第二局、重复重开／放弃 |

推荐在续行页提供低强调的“重新开始”“放弃当前地图”，沿既有确认机制复用实现；主操作始终是继续。重开确认后由 restartMap 创建新 Run 并进入现场；放弃确认后清 Run、留在本地图的新一局准备状态，再次开始仍需显式点击。取消保持原状态与焦点。

现场既有重开／放弃入口本轮保留；其既有终局与退出语义不扩大重写。新准备页加入这些操作时，共享命令／确认逻辑须显式支持两种来源，不能伪装成 onMapRoute 已成立。

## 路由、会话与生命周期

推荐新增 `{ kind:'map-entry'; mapId:string }`，页面模式由当前查询推导，不把 ready/resume 等业务状态固化在 route 或另存一份 Run。

```text
正常游戏设施入口
  → 准备页（无 Run） → 显式开始 → MapRun 现场
  → 准备页（同 Map 活动 Run） → 显式继续 → 相同 MapRun 现场

活动现场的“返回准备页” → 续行准备页 → 继续现场 / 返回日常游戏
准备页直接返回 → 原日常游戏位置（不影响活动 Run）
```

- 第一次从游戏入口进入准备页，记录原 WorkspaceLocation 与来源 `{ spotId, functionalityId, mapId }`，并按需保存原信息流阅读位置／入口焦点；准备页和现场共享同一个短 UI 入口会话。
- 准备页→现场、现场→准备页均 replace 路由，保留最初游戏 returnTo。不得 game→entry→map 连续 enter 导致返回 entry 后失去 game 来源；不为这一个流程把全项目单层返回改成通用栈。
- 活动现场原“返回游戏”改为清晰的“返回准备页”；准备页再提供“返回游戏”。非活动的成功／失败结果页保留其已核实的终局展示及返回日常游戏路径，不误转为可继续状态。start 返回即终局也走真实结果页。
- 从准备页放弃后仍可关闭回原游戏位置；现场旧放弃操作的返回行为可以保留，避免为整合新页面修改无关结算流程。
- 续行点击时只核对 Run 身份／状态、内容可读性、设施入口和前台准入，再切到 `{kind:'map',runId}`；不重新采用当前 roster 的另一个 Variant。开始按钮打开期间若出现同图 Run，重绘为续行页，拒绝旧“开始”事件而不是替用户转为继续。
- 现场返回准备页时调用 Map UI 清理入口，销毁浮层、Hover／拖拽、待处理 region 请求、MapFlow 临时选择；领域 Hand／目标草稿／费用余额／随机游标／活动进度不动。仅 replaceWorkspaceRoute 当前不会自动执行 enterWorkspaceRoute 的 MapFlow 清理分支，须显式接入。
- 现场离开后临时 Flow 记录是否保留沿现有实现，不在本 Task 新建完整历史存档；重返从权威 Run 投影恢复真实内容，不能以伪造聊天记录补出过去。
- 游戏 Area／Init 改变、来源 Spot 功能删除／隐藏、读档、Runtime 重建或 Controller 销毁时重新核对会话；失效时安全回正常游戏，不自动 abandon 仍有效的 Run。读档后没有 UI 来源时，沿现有有效设施入口再次打开准备页，不自动创建 Run 或跳现场。
- 单纯恢复被拒绝时，本地当前只将原因写 DevLog。V1 不伪造“继续”或历史失败状态；读取不到活动 Run 则显示无可续行进度，实际诊断沿既有日志，结构化恢复提示若另加须明确瞬态 owner，不新增存档协议。

## 推荐数据与 API

### 内容侧：最小可选入口说明

现有 GameplayMapDef 有 name，没有 Map 级专门简介／提示字段。推荐增加可选、纯展示的：

```ts
entryInfo?: {
  description?: string;
  tips?: readonly string[];
};
```

缺省兼容旧 Map，不从 Node 文本推导说明；不允许 HTML、脚本、effects 或 handler。字段不参与玩法运算，纯说明变更不单独要求提高 resumeVersion；动作／队伍／HP／资源规则变更仍遵守现有恢复版本合同。同步源契约、校验与 Schema，禁止手改生成文件。

### 领域侧：只读准备投影

推荐在现有 MapRunQuery 增加 `getEntryView(mapId)`（方法名可按本地命名风格调整），返回 detached 的 `MapEntryView`，由 AronaClicker 组合 Registry Map、固定队伍准入与 MapRun Owner 状态；组件不直接访问 Owner。

- 最小内容：mapId/name/entryInfo、`mode: fresh | resume | blocked | unavailable`、可公开的原因、`partyMode:'fixed'`、有序成员（Character/Variant/显示资料/准入、HP cap）、PlayerCost／Actor／Team 资源、当前地点／活动摘要、匹配时的 runId。
- fresh 的准入预览应从私有 admitMapParty 提取共享求解；保留当前排序择差分与错误语义，startMap 在提交时仍用相同逻辑重验。不得调用 start 或临时安装 Owner 来生成预览。
- resume 的成员与当前值来自已有 Run；HP cap 应经 Owner 当前绑定定义或等价窄查询投影到所有地点，不用遇敌时才有的 currentEncounter 充当唯一来源，也不从新的 Map 初始状态覆盖旧 Run。
- 显示资料优先复用 Character／Roster／Avatar 只读入口；缺资料时允许占位与诊断。对新的 Map 内容、原 Run 冻结定义与当前内容版本不一致，要沿现有恢复／内容有效性规则处理，不能用 UI 猜测修复。
- 入口可用性（来源 Spot／功能／条件／当前 Area）和前台状态由 Controller 的共享 adapter 组合，勿将整个 UI PanelState 注入 MapRunService。UI 保存的 source binding 不是游戏状态。
- V1 不修改 `startMap(mapId)` 为任意选人接口。未来编队需独立裁定候选、人数、差分、冻结时机、HP／资源／行动兼容与恢复校验；本 Task 只保留队伍区域的清楚职责，不预建编队服务、空槽和选队存档。

## 门控、提交与更新边界

准备页打开、开始和继续均遵守与现有 Hero／其他外部交互一致的安全前台限制：核对当前全局与可见学生流、isBlockingInteraction、未完成回复选择／故事确认、Spot 操作确认及转换中状态。正常 Tick／资源生产不阻塞。已有共享 gate 则复用，没有则做窄 adapter；不暂停长期生产或更改 Story Runtime 语义。

开始／继续按钮提交前重读 source 与当前 Run；旧 runId、Map／设施／功能不匹配、前台变忙均拒绝并局部刷新反馈。准备页的提交锁跨同步嵌套事件和路由收敛，旧按钮不能连续开启两局。Runtime 仍守住单活动 Run 与队伍准入；续行只读路由动作不需要新增领域 resume 命令。

结构建议复用 renderWorkspaceFrame、renderLeftPanel、renderPanelHeaderRegion／renderWorkspaceTitlebar。最终草图需列明新增 wrapper：中栏说明滚动区、主操作区、右栏队伍滚动区、资源区（预计 4 个内容宿主），以及每个成员的语义 key、实际 hostId／workspaceOwner／scroll owner；Titlebar leave action union 需要窄扩展，不手写复制标题外框。

- 初次进入／离开准备页和现场为真实 route/owner 变化，可以 Workspace structure 更新。
- 准备页内的准入变化、提示展开、反馈、资源／队伍资料更新只补受影响区域／成员；保留 Frame、左栏、标题、主操作与滚动宿主。普通 Tick 不调用全页 render，也不把页面改回普通设施右栏。
- 动作标签改变须有 mode/runId 语义重核，焦点保持在有效主操作或反馈，不因同图 Run 出现丢失焦点。
- 替换范围前关闭范围内 popover，保留范围外锚点；出现场释放卡牌 Hover／关系编辑状态、指针捕获与旧 Surface 请求。目标局部区缺失只恢复对应列，route/根失效才做 Workspace 恢复。

## 文件影响与实施阶段

下表是调查定位及建议落点，不是单次修改白名单；开工按 [[docs/ai/PROJECT-CONSTITUTION]] 拆正式 Unit，明确 Read Set／Allowed Files、独立验证及 Receipt。新增文件名均为建议，先检查是否已由并行工作提供。

| 模块 | 现有文件／建议扩展 |
| --- | --- |
| 内容说明／协议 | `src/data-services/contracts/gameplay-map.ts`；`src/data-services/registry/registry-validate.ts`；`scripts/gen-engine-schema.mjs`；Schema 同步测试，按需维护 editor-extras 元数据；正式示例 `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts` |
| 准备查询／固定队伍 | `src/arona-clicker/runtime/runtime-game-instance.ts` 的 admitMapParty/startMap/_mapRunQuery；`src/arona-clicker/contracts/runtime/runtime.ts`；建议将新 DTO 放 contracts 下 map-entry.ts，共享准入／投影放 read-model 或 services 对应文件，避免继续堆叠大门面 |
| Owner 边界 | `src/arona-clicker/services/map/map-run-service.ts`；`contracts/map-run.ts`；只在需要得到绑定定义的 HP cap 等窄查询时扩展，不改变 Run 结构与战斗结算 |
| 路由／UI 状态 | `src/ui/workspace/workspace-router.ts`、`workspace-renderer.ts`、`src/ui/controller/controller.ts`，按需要在 `components/app-shell.ts` 或专用 UI session 文件持有 source binding |
| 页面／控制 | `src/ui/components/map/map-entry.ts` 继续承担 Spot 按钮；另建 map-entry-workspace 组件及作用域样式；`controller-actions-operation.ts` 接入口／现场返回／确认；`components/map-workspace.ts` 调整活动现场返回动作 |
| 更新／表现／清理 | `src/ui/update/` 命中的 dispatcher／surface，`ui-host-registry.ts` 及真实宿主注册处，`components/workspace-titlebar.ts`、`flow/map-flow-model.ts` 与 Controller 清理入口；按实际消费方局部接入 |
| 测试与文档 | `tests/ui/gameplay-b-map-vertical-slice.test.ts`、`gameplay-b-map-workspace.test.ts`、`workspace-router.test.ts`、`workspace-lifecycle.test.ts`；`tests/engine/gameplay-b-map-runtime-integration.test.ts`、`gameplay-b-map-run.test.ts`；新增准备页用例，更新受影响现行文档与 ui-style 条目 |

### P0：事实复核与行为合同冻结

- 核对并行门控／Hero／Story 变动、当前 MapRun 存档和入口来源，完成最终结构／更新草图与 Unit 拆分。
- 冻结 fresh/resume/blocked、活动返回准备页、结果页返回、初始与当前队伍信息来源及共享准入方案。
- 先构造关键行为测试：打开零写入、继续同快照、离开不恢复 HP／随机流、入口失效与双击、单层 returnTo 不丢。

### P1：入口说明与只读队伍／续局投影

- 加可选 entryInfo 和旧包兼容校验；抽取共享固定队伍准入；实现 fresh/resume/blocked/unavailable detached View。
- 独立完成：不调用 start 就能显示准确准入和初始值；不在 Encounter 中也可显示续局 HP/cap；预览和实际 start 的准入一致，不会发角色或产生 Run。

### P2：准备页与设施入口、现场返回

- 接独立 Workspace、三栏与开始／继续／返回，保留作者入口文案，明确记录 game 来源；replace 保留 returnTo，补 route-only 解析和 Surface 生命周期。
- 独立完成：game→entry→map→entry→game 正常；同地图继续始终同 runId，同局草稿／Hand／随机／HP／资源均保持；受限状态反馈真实，普通交互不整页重建。

### P3：管理操作、失效／存档回归与交付

- 新准备页的重开／放弃复用确认与既有命令；覆盖取消、旧 runId、终局、读档／重建、来源设施失效及前台抢占。
- 定向自动化、类型／架构／Schema 同步、桌面浏览器验收；更新机制与风格记录，回填 Receipt 和实际未完成项。

## 验收与测试方案

- [ ] 点击设施入口只显示准备页，离开／刷新／展开说明不调用 start/restart/move/commit；Run ID、起点活动和随机流均不提前产生。
- [ ] fresh 展示定义队伍顺序、实际可匹配差分、逐项准入原因、initialHp/maxHp 与初始局内资源；缺角色不自动补发，旧 Map 无 entryInfo 也可显示。
- [ ] 开始显式调用一次 startMap；页面打开后准入变化会被重验；起点直接 success 仍显示真实结果，不伪装成可继续活动 Run。
- [ ] 活动现场返回准备页不结束 Run；继续前后整个 Run 快照（含 runId、party、partyHp、资源、Node／activity／round、Hand、override／targets／Ability／Item draft、commitVersion、随机状态）保持不变。
- [ ] 续行身份用已冻结 Variant，不因当前 roster 排序／新增差分重新换人；不能把全局养成属性或初始 HP 当作当前值。
- [ ] 页面只显示当前进度，不展示全图敌人／未来地点剧透；不是 Encounter 时依旧显示正确 HP 上限，不虚构战力、完成百分比或新奖励。
- [ ] game→entry→map→entry→game、关闭后再次从设施进入、读档恢复后从设施重入均正确；原游戏页签、对话选择、必要阅读位置与入口焦点恢复，无 entry/map 死循环。
- [ ] 另一地图活动 Run 阻止新开；旧“开始”事件遇到新 Run、旧“继续”事件遇到 Run 结束／重开、来源 Spot／functionality／Map 失效时不替换／误续局，可安全返回。
- [ ] 重开确认后新 runId、相同准入队伍、定义初始 HP／资源／进度；取消或重开失败保留旧 Run。放弃确认才清 Run，长期状态不回滚，不自动开始下一局。
- [ ] 终局结果和无活动 Run 区分；恢复拒绝不出现假继续，不修改存档协议或假称离开已写磁盘。
- [ ] 前台忙碌无法绕过；普通 Tick／生产继续；双击／旧事件最多提交一次；后台刷新不把准备页替换成普通聊天／设施面板。
- [ ] Frame／标题／滚动 owner／有效焦点与范围外浮层在局部交互中保持；出现场的关系 Hover／拖拽／MapFlow 临时态被清理，领域 Run 不动。
- [ ] 不出现可点击选队／空槽／战力或新的编队存档；未来编队只有清楚的组件／DTO 扩展点。

验证按 [[docs/docs-829/05-conventions/testing]]：先新增／调整真实点击与领域回归，不只断言静态 HTML；更新原 vertical-slice 直接进入／返回断言，不弱化其“继续无写入”保证。按阶段运行实际命中的 `npx vitest run <测试路径>`、`npx tsc --noEmit`、`npm run check:architecture`；契约变动运行 `npm run gen:schema` 及 `tools/datapack-editor/schema/engine-schema.sync.test.ts` 对应测试。桌面浏览器验收至少覆盖首次开始、受伤后离开／重返、缺员、前台忙、重开／放弃取消与确认、终局和读档；无需移动端。

## 非目标、风险与收尾

不做玩家选队、多人多队、角色换装／培养、出战费用／恢复补给、跨地图多 Run、完整回放日志、新存档／自动保存语义、新结算页或 Area 导航地图施工。不迁移现有战斗状态归属，不把准备页当成新的业务暂停机制。

主要风险及最小策略：预览提前 start → 只读投影；继续被误作 restart → 独立动作与快照断言；准入两套规则 → 共享求解；队伍初始／当前值混淆 → fresh/resume 数据分离；返回覆盖 game 来源 → 同会话 replace；无 Encounter 缺 cap → Owner 窄投影；离开后重置草稿／随机流 → UI 清理与领域状态分离；“返回=已存档”误导 → 沿既有保存语义；Map 入口与 Area-Map 混用 → 独立 route／术语。

## 本轮核验（2026-10-21）与待续

- 已实际读取上述入口、命令、准入、Owner start/restart/abandon/checkpoint、三栏现场、路由和返回相关源码，并查看 vertical-slice 与 Runtime 集成测试断言；只生成 Task 和索引，未施工代码、未生成 Schema、未跑游戏测试或浏览器验收。
- 创建前后均已运行 `npm run check:docs`：同样 8 处既有 docs-829 文档指向已移除 Operation 示例／测试路径而失败，本 Task 与索引没有新增报告项；未扩大修复这些路径。索引 `git diff --check` 通过，尚未跟踪的新 Task 独立尾随空白检查通过。
- GALHCG 已通过 graph_project 核对 `acprogram`；MapRun 图内搜索未命中后，转 path 在 src/arona-clicker 定位 map-run 契约与服务，并核对当前文件；未凭零命中认定没有实现。本 Task 的 graph_health changed 返回 unreferenced_path（无直接 Evidence／maps_to），索引返回 content_changed，按 owner_offset 0、5 读完共 9 个 owner，末页 complete=true。上述均为只读诊断；未刷新、改图或写 freshness。
- 当时状态：待续 P0 开工复核及正式 Unit 拆分、P1—P3 实施和全部功能验收；后续已在下方施工进度中完成。

## 施工进度（2026-10-21）

首次调查之后已按独立 Unit 开始施工，方案冻结仍以本文为准。完成的 Unit 与 Receipt 位于 `docs/plan-work/task-0309-units/`：

- U1–U2：Map 入口说明契约、共享准入只读投影与 `getEntryView`。
- U3–U5：route-only 准备页会话、三栏展示、入口／开始／继续／返回操作。
- U6：续行页重开／放弃管理操作与确认路径复用。
- U7：专属 region 局部刷新、稳定节点身份、滚动／焦点保留与来源失效返回。
- U8：同步刷新机制与 UI 复用文档；仅记录已核对的源码事实，不代表浏览器视觉验收。
- U9：现有设施／MapRun UI 回归迁入准备页流程，新增只读投影、Story 阻断、same-run 续行与重开／放弃确认行为断言。
- U10：八个正式 Gameplay B Map 增加简介和短提示；不改变 Run 玩法与恢复版本。
- U11：真实 Area travel 离开入口所在区域后返回日常 Game 路由，并断言活动 Run 完整保留。
- U12：在用户于 2026-10-21 明确授权后运行 `npm run gen:schema`，同步 `GameplayMapDef.entryInfo`；并保留并行 AreaMap Schema 字段。
- U13：在本地桌面浏览器验收有效队伍 fresh、受伤续行、缺员／Story 门控、重开／放弃取消与确认、终局及刷新读档后的设施重入续行。

施工边界与未完成项：

- 用户于 2026-10-21 明确答复“允许受控生成 Schema”。U12 按此答复运行 `npm run gen:schema`，生成文件同时含 `entryInfo` 与并行 AreaMap 字段；只用生成器写入，没有手编辑 Schema。
- U9–U11 运行 Task 命中的 7 组定向回归，包含受伤后读取当前 HP/cap 并同 runId 续行、来源 Area 改变与 functionality 失效返回等行为，共 118 项全部通过；`npx tsc --noEmit` 与 `npm run check:architecture` 也通过。此前全项目类型检查的 Area Map 测试错误在当前工作树已不再出现。
- `npm run check:docs` 当前有 8 个范围外问题，均为旧 Operation 文档的失效源码路径；此前并行 Task 0310 的 14 条 Unit／Receipt 重名已清理，Task 0309 新增的 Receipt 重名也已修正。
- Schema 同步测试 11 项通过；`parseEngineSchema()` 与生成文件的 `defMap`、`defs`、`indexedTypes` 结构比较一致，`entryInfo`、AreaMap 与 Area navigation 字段都保留。
- 桌面浏览器使用当前源码与正式 Gameplay B 内容，在内存验收场景中验证了有效固定队伍的 fresh 页面、显式开始、战斗受伤（白子 HP 10→8）、返回准备页读取 HP/cap、继续同一战斗第 2 轮且 HP 不恢复；也验证重开取消保持当前进度、确认后回起点，以及完成战斗后显示终局并返回日常游戏。该验收场景不写入存档。
- 浏览器读档验收在隔离的 `127.0.0.1:5174` Origin 执行：保存战斗第 2 轮后刷新，启动时恢复活动 Run；从设施重新进入准备页仍显示白子 8/10、第 2 轮、原局内资源，继续后现场保持第 2 轮与原敌我状态。该存档与已有游戏 Origin 隔离。
- Map 内容边界审查确认：活动 Run 的动作、路线与快照由启动时绑定的 `ResolvedMap` 驱动，不依赖 Registry 后续替换；Checkpoint 保存 `mapId + resumeVersion`，读档遇到缺失 Map、版本不符或状态与当前定义不匹配会拒绝恢复并记录诊断，不创建假 Run。来源 Spot／functionality／Area 失效会安全回到 Game 且不清除活动 Run；未知 Map 的入口投影为 unavailable。
- 验收 MapRun 存档已通过“开始新游戏”移除；应用随后按既有选择页逻辑创建空白 Lobby 存档，仅留在隔离 Origin。临时页签与 5174 开发服务已关闭，不影响原游戏 Origin。
- 本轮只对直接影响路径做 GALHCG changed 只读复核，没有刷新、编辑图或写 freshness；新增组件及样式尚无直接 Evidence / `maps_to` 关联。

相关路由：[[docs/ai/context-packs/ui-presentation]]、[[docs/ai/context-packs/datapack-schema]]、[[docs/ai/context-packs/world-lifecycle]]、[[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/schema-sync]]、[[docs/docs-829/06-wiki/50-ui/workspace-routing]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]、[[ui-style/00-index]]。
