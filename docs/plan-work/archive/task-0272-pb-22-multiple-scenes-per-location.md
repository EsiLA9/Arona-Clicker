# Task 0272 / PB-22：一个 Location 内连续运行多个 Scene

状态：completed — 独立 Registry Event 已在一个复合 Location 中依次运行“调查设备 → 处理警报”；独立地点目标满足后通过唯一出口按既有规则自动转场，Run / Map 保留来源地点成功与两幕进度。
> Goal Owner 统一裁定（2026-10-08）：PB-22 的施工默认规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；它覆盖本 Task 裁定前的待定措辞。实现遵循其线性顺序、同 Location 激活、skip / failure 与重访边界。

## 目标

为一个新 Operation Location 添加两个可顺序完成的局部 Scene：第一幕调查设备并给出维修线索；第二幕出现警报设备与守卫，开始现场处置。第一幕完成后玩家仍位于同一 Location；地点目标与完整 Scene 序列共同决定地点成功和出口可用性，单一合法出口遵循既有 Runtime 自动转场。转场后的 Run / Map 仍能分别看到来源 Location 的成功状态和两段 Scene 进度。

## Responsibility、依赖与边界

- 唯一责任：G03 Scene / Operation Runtime 拥有 Scene 当前身份、完成和同 Location 内的前进规则；Location / Event 继续拥有地图、Route Gate 与结局；UI 只消费 View / 命令。
- 依赖：G03 Task 0263–0268，PB-19–21 完成迁移基线；后续 PB-23 / PB-24 只在第二幕扩目标与选择，不改变本 Task 的场景顺序 owner。
- 包含：一个 Location、两段 Scene、一个调查结果和下一幕开放门槛、地点进度投影及同一 Operation 入口可点击样例。
- 非目标：用 UI / Event ID 推断场景推进；替换已有中央舞台设备井战斗；创建 SceneManager、Location 子地图、新存档 owner 或历史存档迁移；本 Task 不实现 group target、M/N 或商店。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对 Task 的影响 |
| --- | --- | --- |
| `OperationLocationDef.scenes` 提供 Location-local 有序 Scene；EventRun 的 Location progress 保存顺序完成前缀与各 Scene 批次计数，View 从内容和进度推导当前 Scene。 | `src/data-services/contracts/operation.ts`；`src/arona-clicker/contracts/operation.ts`；`operation-runtime-service.ts`；`operation-view-projector.ts` | PB-22 复用 G03 的已实现 owner / checkpoint；Scene A 成功结算后 Runtime 在同一 Location 激活 Scene B。 |
| `interactionSceneId` 用于 Action / CardPool 的内容候选上下文，非新 Scene Runtime ID；一个 Location 可以有多个 SceneAction，但它们在同一个当前批次 / 费用 / Scope。 | `operation-card-candidate-resolver.ts`；Strategy Park 电玩馆 / 迷宫 / 控制室内容 | 不能把多个旧行动或旧 scene-category 字符串误认为连续多个 Scene。 |
| Strategy Park 已有一个名为“中央舞台设备井”的 `boss` Location，属三场战斗之一且 4 Beat。Operation feed 静态列 Carousel 与 Park 两个入口。 | `gameplay-b-strategy-park-ids.ts`、`gameplay-b-strategy-park.ts`、`src/ui/components/center-panel.ts` | PB-22 Owner 裁定使用独立 Registry 测试 Event，保持 Strategy Park 13-location 主线与 Boss 不变；样例从通用 Registry Event 列表启动。 |
| Operation checkpoint 保存在现有 SaveData 的有界 `operationRun`，不另建存档层；内容不兼容由 `resumeVersion` 表达，不写迁移。 | `src/arona-clicker/contracts/operation-save.ts`、`operation-runtime-service.ts`、`tests/engine/gameplay-b-save-resume.test.ts` | Scene 序列状态如需持久化，应扩展现 owner / checkpoint 和 Save/Resume 回归，遵守清档 / resumeVersion 边界。 |

## 最小 Read Set

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/05-conventions/testing.md`。
- `src/data-services/contracts/operation.ts`、`src/arona-clicker/contracts/operation.ts`、`operation-save.ts`、`operation-view.ts`。
- `src/arona-clicker/services/operation-runtime-service.ts` 中 Run 创建 / progress / route / save-resume owner、`operation-view-projector.ts`、Route evaluator；新 Scene 的当前方案字段只读其直接调用点。
- `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`gameplay-b-strategy-park-map.ts`、`src/ui/components/center-panel.ts` 与 Operation workspace 目标文件。
- `tests/engine/operation-runtime-service.test.ts`、`gameplay-b-save-resume.test.ts`、`gameplay-b-strategy-park-virtual-play.test.ts`、`tests/ui/gameplay-b-strategy-park-map.test.ts` 与 Operation Controller 测试。

## 施工切片

### P0：同一 Location 内 Scene 切换合同（completed）

- Owner 已裁定由 `OperationLocationDef.scenes[]` 声明唯一线性顺序；只有成功提交且满足当前 Scene 的 `completion` 才记录完成。空 skip 沿用既有批次规则，失败 / 被拒绝的提交不前进。
- EventRun `locationProgress.completedSceneIds` 与现有 checkpoint 保存进度；同 Run 重访保留已完成前缀，新 EventRun 才重置。无需新 owner、SaveData 顶层键、循环、分支或迁移层。
- 样例采用独立小型测试 Event，保留 Strategy Park 13 地点与现有 Boss；通用 Registry Operation 入口已能发现此 Event，不新增 Event-ID 卡片。

### P1：调查 → 警报内容切片（completed）

- `atomic-scene-demo` Event 在一个 Location 内声明调查和警报两幕；调查提交揭示维修线索后，View 显示前幕 completed、后幕 active，且不产生 Route history。
- 调查完成后地点仍为 inProgress、警报 Scene active、出口 Route unavailable；警报成功后独立地点目标和 Scene 序列门槛一起标记来源地点 success。唯一出口使用既有 exact-one 自动转场；来源地点 / 两个 completed Scene ID 与 Route ID 留在 Run / Map 历史中。通用工作区通过内容声明和 Runtime 投影呈现，不由 UI 根据 Event / Location ID 推进。

## 回归证据与 Operation 工作区验收

- 现有证据：`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 验证旧事件路线 / Route gate；`tests/engine/operation-runtime-service.test.ts` 覆盖 Location lifecycle / Route；`tests/engine/gameplay-b-save-resume.test.ts` 覆盖当前 checkpoint；`tests/ui/gameplay-b-strategy-park-map.test.ts` 覆盖 Park feed / map 进度。
- [x] 从通用 Operation Registry 入口点击独立测试 Event；提交调查后 UI 仍标记同一 Location，前一 Scene 显示完成、后一 Scene 激活，Location 未完成且出口不可用；继续提交警报后地点成功，并由唯一出口自动转场。
- [x] Runtime 行为验证空 skip 与拒绝的批次不推进、A→B 顺序进度、Location / Route 独立，以及 A 完成后的 checkpoint 恢复继续 B；Run 内回访保留进度由 `operation-runtime-service.test.ts` 已有回归覆盖。
- [x] Registry UI Controller 点击测试覆盖 Event 启动、两名学生各自完成两幕、地点状态和 Route history；真实浏览器验收见下方收尾记录。

## 裁定前问题与最终决定

- G03 / Owner 已确定 Scene identity 与 progress 归属：EventRun 是唯一 owner，进度在现有 Location progress / checkpoint 中。
- 复合样例使用独立小型测试 Event；不更改 Strategy Park 的 13-location 主线或 Boss。其启动使用现有 Registry 列表，不增加硬编码入口。
- 顺序只支持 Location 内线性列表；空 skip 沿用现有批次语义且不推进，失败提交不前进；同 Run 重访保留进度，新 Run 重置。不支持任意分支、递归或循环。

## 实施收尾与证据（2026-10-08）

- 内容：`src/arona-clicker/content/operation-samples/atomic-scene-demo.ts` 声明独立 Event、一个复合 Location、有序 Scene A/B、各自完成条件、独立 Location objective 和最小出口 Location；两名学生均可选择 SceneAction，Event checkpoint `resumeVersion` 更新为 2。`gameplay-b-datapack.ts` 将两个学生 Profile 与第二个 Action 注册进同一 bundle。
- 行为测试：`tests/engine/gameplay-b-multiscene-location.test.ts` 验证初始顺序、空 skip 不推进、actorless 遥控牌单独结算不会揭示维修线索或激活 B、被拒绝提交保持原 Run、两名学生完成 A/B、A 完成后 checkpoint 恢复继续 B，以及地点目标 / Scene 序列门槛 / Route 转场的独立性。B 后断言来源地点 success、两个 completed Scene ID、唯一 Route ID 和 Map 完成节点均保留。
- UI 测试：`tests/ui/gameplay-b-operation-entry-registry.test.ts` 从通用 Registry Event 卡启动并通过 Controller 选择 / 提交两幕，核对 A 后地点 ID 不变、Location 未完成、Route unavailable；B 后核对来源地点 success、Route ID / 起终点与 Map 完成状态。
- 浏览器验收（本地 IAB，2026-10-08）：从“夏莱办公室”点击通用“原子场景演示”入口。先单独结算“遥控停机”，显示现场状态 3→0，但调查仍进行中、警报待开始；再由星野与芹香各自选择并提交“检查故障设备”，仍在“行动现场”，调查完成、警报进行中、地点进行中，唯一出口按钮 disabled。之后两人各自选择“解除警报”并提交；工作区显示两名学生的 B 结算及第 4 项“路线转场”，从“行动现场”到出口“行动现场”。这是既有 Runtime 的 exact-one 自动转场规则。Engine / UI 断言确认 Run / Map 保存来源 Location success、`investigate-equipment` 与 `handle-alarm` 两个 completed Scene ID，以及 `leave-equipment-site` Route ID。
- 当前机制说明见 `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` 的“Location 内有序 Scene”与 PB-22 样例记录。

## GALHCG 影响闭环

- 只读发现：`project_id=acprogram`；`lookup("SceneAction")` / `lookup("Scene Card")` 零命中后用 source/path 搜索、合同及 Runtime 代码确认；Operation Run Lifecycle / Route Outcome 用于定位 save / progress / route owner。
- 写后对账：`resolve_project` 确认 `project_id=acprogram` 与工作区根路径一致；定向 `refresh` 覆盖本次 12 个有效变更路径及旧/新 Task 位置，旧根目录条目已移除。逐路径 `review_changes` 完整覆盖 12/12；Runtime 机制页按两个 owner 页读取完整 9/9 owners，所有本次受影响 Evidence 均为 `stale=0`。已复用 `concept:operation-sample-content` / `concept:ui-operation-workspace` 映射样例源码与 Engine / UI 测试，并将 Task、Draft、G04、GoalSet 总览、Owner ruling 和 PB-23/24 引用映射到 `concept:goal-workflow`；归档 Task 现指向新 File ID，旧路径边已不存在。`plan_map_updates` 完整，6 nodes / 15 edges / 27 Evidence references；`update_map(dry_run=true)` `valid=true` 后提交。`search(mode="map")` 可找到两个 Concept；`map_inventory` 对 Operation sample 文件和 `docs/plan-work` goal workflow 文件均完整分页且相关路径已 mapped / 有 Evidence；`traverse` 对样例→Engine 测试关系完整，Goal workflow 文档范围续读完成。此为本次受影响路径闭环，不是全图质量审计；本次未改 Runtime 合同或通用 UI。

## 剩余工作

- 本 Task 只交付多 Scene / 单 Location 的闭环基础；前后排群体目标、M/N、临时商店和 Editor 作者入口由 0273–0275 / G05 完成。

## 相关路由

[[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/03-data-structures/player-state]] · [[docs/docs-829/05-conventions/schema-sync]] · [[task-0263-pb-13-scene-identity-lifecycle]] · [[task-0268-pb-18-scene-completion-location-exit]]
