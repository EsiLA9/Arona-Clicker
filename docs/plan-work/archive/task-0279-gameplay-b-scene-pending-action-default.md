# Task：为未完成场景目标默认执行其固定推进行动

状态：completed — 已将 Atomic 调查行动接入既有 fixed SceneAction Runtime 计划，补齐显式 Skip 边界、UI 默认目标展示与回归验证。

## 目标

让决策链当前指向、且完成条件仍未满足的固定推进行动进入 Runtime 基础 SceneAction 计划。Atomic Scene 演示中的“检查故障设备”应在玩家不手动选择 Action、执行者或 Target 时，通过一次显式 Commit 执行并将默认 Target 解析到设备；完成条件满足后仍由现有 Scene 顺序推进。

## 设计边界

- 本 Task 包含：复用现有 `selectionPolicy: 'fixed'` SceneAction 合同；修正 Atomic 演示内容；确保显式 Skip 不执行固定 SceneAction / SceneCard；让 UI 展示自动纳入的行动与默认目标；补充 Engine / UI 回归。
- 只把决策链明确唯一、且直接推进当前 Scene completion 的行动声明为 fixed。其他可选 SceneAction、M-of-N 选择、购买与 PlayerSceneCard 继续保留玩家选择。
- 明确非目标：不增加 selection policy 枚举、通用 AI / 决策树求解器、Runtime owner、干预槽或自动多批次循环；不自动选择任意非战斗 SceneAction；不把 SceneCard 与 SceneAction 混成同一牌区。
- 玩家仍以一次显式 Commit 推进；空选择触发 fixed 默认计划不等于 Wait / Skip。Skip 必须继续是无效果的一批。
- 已裁定来源：用户追加裁定“检查故障设备等内容应该默认按照决策树指向目标的操作仍未完成”；当前 `fixed` 的执行者 / Target 归一由共用 Planner 负责，UI 不代替 Runtime 构造计划。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Atomic “检查故障设备” Action 将 `repair-clue-found` 设为已知事实；当前调查 Scene 恰以该事实为 completion。星野、芹香 Profile 均将该 Action 排在候选与优先级首位。 | `src/arona-clicker/content/operation-samples/atomic-scene-demo.ts`：62–72、132–148、162–178 | 这是当前 Scene 决策链唯一直接完成其未满足目标的行动，SceneAction 包装应使用已有 fixed policy。 |
| 施工前该 SceneAction 为 Individual / selected-student / required。Runtime 只对 fixed 项自动补执行者和目标；空选择因此不包含“检查故障设备”。施工后它已改为 fixed。 | 同上；`src/arona-clicker/services/operation-resolution-planner.ts`：934–979 | 目标默认化不能替代 Action 自动纳入；复用 fixed 合同，不新建默认选择机制。 |
| 引擎与 UI 测试此前都手动选择 Hoshino、Serika 的检查行动，UI 测试还明确要求先点击两张行动卡。 | `tests/engine/gameplay-b-multiscene-location.test.ts`：112–128；`tests/ui/gameplay-b-operation-entry-registry.test.ts`：149–169；`tests/ui/operation-workspace-view.test.ts`：363–388 | 改为覆盖空选择的直接 Runtime 提交，以及不点击 UI 行动卡的显式提交。 |
| 显式 `skip: true` 不允许携带可选选择；文档合同要求 Skip 不执行效果。但 Planner 当前在 Skip 请求上仍会合成 fixed SceneAction / SceneCard。 | `src/arona-clicker/services/operation-resolution-planner.ts`：871–879、942–978、1063–1085；`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`：96 | 自动 fixed 行动必须尊重 Skip；加入 guard 与回归，避免跳过时完成 Scene。 |
| 正式 `gameplayBCarouselDatapack` 包含 Carousel、Atomic Scene、Scene Offer/Purchase 三个 Event；Scene Offer/Purchase 有明示 M-of-N、购买选择。物理 SceneCard 独立于 SceneAction；Strategy Park 是额外测试/演示内容。 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`：74–100；`carousel-scene-action-slice.ts`：49–205；`scene-offer-purchase-demo.ts`：143–192、213–230；`gameplay-b-strategy-park.ts`：137–351 | 不扩大为全部场景行动默认选择；其他作者选择保持现状。完整内容盘点见本 Task 的验收证据。 |

## 施工切片

### P0：内容、Skip 与 UI 合同修正

- 将 Atomic 调查 Scene 的 `inspect-equipment` 标为 fixed；保留 Individual scope，让每名符合资格的存活学生按现有合同执行，Runtime 为目标型 Action 归一首个合法设备目标。
- Planner 在显式 `skip: true` 时不自动附加 fixed SceneAction 或 fixed PlayerSceneCard；未 Skip 时继续按既有合同自动纳入。
- Workspace 展示 fixed 行动及其当前合法默认目标；无需点击行动或目标，仍由 Runtime 纯预览与 Commit 校验。
- Engine 回归验证：`selections: []` 直接提交可发现维修线索并推进到警报 Scene；显式 Skip 不产生事实、目标效果或 Scene completion；失败提交不修改 Run。
- UI 回归验证：首次打开就显示默认行动和设备目标；不点击行动卡直接 Commit 后进入下一 Scene。保留 PlayerSceneCard 需要显式选择的行为。

## 测试与验收

- [x] Atomic “检查故障设备”在 Run 初始化时是当前 Scene 的 fixed 基础行动，Preview / Commit 空 selections 均解析到 Ride，不要求 UI 补 Action、执行者或 Target。
- [x] 一次有效 Commit 完成调查 Scene 并按既有顺序进入警报 Scene；Scene completion 不直接完成 Location。
- [x] 显式 Skip 保持 Run 的事实、Actor、费用、Scene completion 不变，只消耗既有批次计数；Wait / Skip 不自动胜利。
- [x] 失败提交前后 Run 完全相同；Atomic 玩家卡不因 fixed SceneAction 默认而自动纳入。
- [x] Carousel 双卡 Combat、其他 Required SceneAction、M-of-N、Purchase 与 PlayerSceneCard 合同未改变。
- [x] SceneAction / PlayerSceneCard 内容边界及 skip 语义同步到机制文档；文档结构、类型与定向测试通过。
- [x] 无浏览器验收；以 Engine / View / Controller 定向测试覆盖真实装配与提交流程。

## 当前核验（2026-10-09）

- 复测确认空 selections 的 Preview / Commit 为两名学生各生成一条检查行动，目标均为 Ride；Run 随后进入警报 Scene，Location 仍进行中。显式 Skip 的 Resolution selections 为空，维修事实未出现。
- 定向命令 `npx vitest run --silent --reporter=dot tests/engine/gameplay-b-multiscene-location.test.ts tests/engine/operation-scene-actions.test.ts tests/ui/gameplay-b-operation-entry-registry.test.ts tests/ui/operation-workspace-view.test.ts`：4 个文件、33 项通过。
- `npx tsc --noEmit` 通过；`npm run check:docs` 通过（778 份 Markdown、0 错误）；`git diff --check` 通过，仅报告既有 CRLF/LF 提示。未运行浏览器验收。
- GALHCG 项目身份核对为 `project_id=acprogram`，`workspace_path` 与 `root_path` 均为本项目绝对路径。Concept 搜索 `Operation Scene Action`、`Operation Runtime` 完整返回 0 项；源码搜索与只读内容盘点用于补齐事实。对 8 个实现、测试和机制文档路径的 28 条 Evidence 引用，以及索引文件的 4 条 Evidence 引用，均先 dry-run `valid=true` 后更新。新 Task 保留在归档，不作为实现 Evidence。

## GALHCG 影响闭环

- 发现路径：查询 Gameplay B SceneAction / Runtime Concept 未命中；使用只读子代理清点内容后，再以 `rg` 和具体定义、测试核实。子代理盘点确认正式三 Event bundle、Action/Card 清单与 Atomic 缺口，摘要见上表。
- 变更审查：对 8 个修改源码、测试与机制文档路径运行 `review_changes(path=...)`；逐一续读 `datapack-contracts.md` 的 7 个 owner 与 `operation-runtime.md` 的 13 个 owner，均为完整分页。归档后的索引文件复核也已完成，相关 owner 分页完整。
- 地图维护：共更新 7 个节点的 14 条 Evidence 与 18 条直接边 Evidence，全部先按 owner 分批 dry-run `valid=true` 再写入。新 Task 保留为归档追溯文档，不作为实现 Evidence。

## 剩余工作

- 本 Task 已完成，无剩余施工内容。
- 最终方向上仍可扩充场景内容，但不属于本 Task。

## 附件：当前场景与卡牌内容盘点

下表基于 `gameplay-b-datapack.ts` 的正式三 Event bundle 与额外 Strategy Park 样例逐项核对。Strategy Park 是测试/演示内容，不装入正式 Carousel bundle。`required` 表示玩家可选，不保证每批必须选择；`fixed` 在普通提交中自动纳入，显式 Skip 仍跳过它。

### 正式 Carousel / Atomic / Scene Offer-Purchase

| Event / Scene | SceneAction / Action | Scope / 执行者 / 选择 / Cost | Target / 用途 |
| --- | --- | --- | --- |
| Carousel · 通道（隐式 main） | `inspect-carousel-control` 检查控制台 / `scene-investigate-control` | Individual / selected-student / required / 1 | 无 Actor 目标；调查并发放员工证。 |
| Carousel · 通道（隐式 main） | `guide-queue` 引导游客 / `scene-guide-queue` | Individual / selected-student / required / 1 | 无 Actor 目标；降低秩序 Track。 |
| Carousel · 出口（隐式 main） | `whole-team-first-aid` 全队急救 / `scene-team-first-aid` | Global / optional-student / required / 2 | `sameTeam`；限定星野、芹香、白子。 |
| Carousel · 玩家 SceneCard | `team-first-aid` 团队急救包 / `scene-team-first-aid` | 2 张 / scene / optional-student / required / 每张 1 | 与 Character 战斗卡池分离；复用同一 Action Target。 |
| Atomic · 调查故障设备 | `inspect-equipment` 检查故障设备 / `atomic-scene-inspect` | Individual / selected-student / **fixed** / 0 | `otherTeam`，Ride 白名单；揭示 `repair-clue-found`，即该 Scene completion。普通空 Commit 为每名合格学生补行动与 Ride Target。 |
| Atomic · 处理现场警报 | `suppress-front-row` 压制敌方前排 / `atomic-scene-suppress-front-row` | Global / selected-student / required / 0 | enemy opponent + front；`all-eligible`。 |
| Atomic · 处理现场警报 | `disable-alarm` 选择一名敌人解除警报 / `atomic-scene-disable-alarm` | Global / selected-student / required / 0 | enemy opponent + front/back；select。 |
| Atomic · 处理现场警报 | `move-enemy-back` 把一名敌人逼退 / `atomic-scene-move-enemy-back` | Global / selected-student / required / 0 | enemy opponent + front；select。 |
| Atomic · 玩家 SceneCard | `remote-stop` 遥控停机 / `atomic-scene-remote-stop` | 1 张 / scene / none / required / 0 | 无 Actor 目标；降低危险度 Track。 |
| Scene Offer/Purchase · 现场行动选择 | `stabilize-gate` 稳定闸门 / `offer-demo-stabilize-gate` | Global / none / required / 1 | Track +1；4 选 2 候选。 |
| 同上 | `inspect-radio` 检查无线电 / `offer-demo-inspect-radio` | Global / none / required / 1 | Track +2；4 选 2 候选。 |
| 同上 | `secure-perimeter` 加固外围 / `offer-demo-secure-perimeter` | Global / none / required / 1 | Track +3；4 选 2 候选。 |
| 同上 | `record-stock-count` 核对现有库存 / `offer-demo-record-stock-count` | Global / none / required / 1 | Track +4；4 选 2 候选。 |
| 同上 | `daily-briefing` 固定现场简报 / `offer-demo-briefing` | Global / none / fixed / 0 | 固定纳入，不计入 4 选 2。 |
| Scene Offer/Purchase · 补给与库存 | `remove-spent-water` 移除已耗用饮水 / `offer-demo-remove-water-after-purchase` | Global / none / required / 0 | 移除物品并 Track +1。 |
| 同上 | `confirm-final-inventory` 完成库存复核 / `offer-demo-final-inventory-check` | Global / none / required / 0 | Track +2。 |
| 同上 · PurchaseOffer | `water` 购买应急饮水 | 费用 2 | 获得饮水、Track +1，以 `bought-water` 锁定单次购买。 |
| 同上 · PurchaseOffer | `medkit` 购买现场医疗包 | 费用 3 | 获得医疗包、Track +2，以 `bought-medkit` 锁定单次购买。 |

正式 Carousel bundle 没有其他 PlayerSceneCard；Scene Offer/Purchase 没有 `playerSceneDeck`。PurchaseOffer、SceneAction 与 PlayerSceneCard 维持独立合同。

### Strategy Park（额外演示，不装入正式 bundle）

通用 SceneAction 包装默认为 `selected-student` + `required`。表中均为单项批次，除明确写出外 target 为 none；费用为 PlayerCost。

| Location / Scene | SceneAction 标题 / Action ID | Scope / 执行者 / 选择 / Cost | Target |
| --- | --- | --- | --- |
| 西门临时执勤点 · brief-team | 领取巡查任务 / `brief-team` | Global / none / required / 0 | none |
| 林荫连廊 · follow-tracks | 追踪车轮印 / `follow-tracks` | Global / selected-student / required / 1 | none |
| 游园服务亭 · service-kiosk | 查询员工广播 / `call-staff-radio` | Global / selected-student / required / 1 | none |
| 代币电玩馆 · negotiation | 检查控制台 / `inspect-arcade-console` | Individual / selected-student / required / 0 | none |
| 同上 | 搜索维修抽屉 / `search-arcade-drawer` | Individual / selected-student / required / 1 | none |
| 急救补给站 · first-aid | 全队急救 / `first-aid-team` | Global / selected-student / required / 2 | `sameTeam`，无额外 Actor 限制。 |
| 镜面迷宫 · mirror-maze | 跟随地面标记 / `follow-tracks` | Individual / selected-student / required / 0 | none |
| 同上 | 搜索侧廊 / 寻找凭证 / `search-mirror-maze` | Individual / selected-student / required / 1 | none |
| 摩天轮检修廊 · ferris-maintenance | 检查检修面板 / `inspect-ferris-panel` | Individual / selected-student / required / 1 | none |
| 同上 | 搜索侧廊 / 寻找凭证 / `search-ferris-staff-entry` | Individual / selected-student / required / 0 | none；与迷宫处复用 SceneAction ID，但 Action ID 不同。 |
| 后台休息室 · backstage | 后台休整 / `backstage-rest` | Global / selected-student / required / 2 | `sameTeam`，无额外 Actor 限制。 |
| 东出口交接处 · handoff | 完成交接 / `handoff-at-east-gate` | Global / selected-student / required / 0 | none |
| 地下设备层控制室 · control-room | 协助控制室队员 / `reset-control-room-power` | Global / selected-student / required / 2 | `sameTeam`，无额外 Actor 限制。 |
| 同上 | 登记控制台记录 / `record-control-room-console` | Global / none / fixed / 0 | none |

Strategy Park 共 14 个 SceneAction 引用、13 个不同 SceneAction ID；“搜索侧廊 / 寻找凭证”在两个地点复用。该样例没有 `playerSceneDeck`。

## 相关路由

- `docs/docs-829/00-INDEX.md`
- `docs/ai/task-read-set-routing.md`
- `docs/ai/galhcg-project-map.md`
- `docs/docs-829/03-data-structures/datapack-contracts.md`
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`
- `docs/docs-829/05-conventions/schema-sync.md`
- `docs/docs-829/05-conventions/testing.md`
