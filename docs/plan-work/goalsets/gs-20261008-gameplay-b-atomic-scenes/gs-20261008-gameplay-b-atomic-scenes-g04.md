# G04：真实玩法迁移与复合场景证明

状态：completed — PB-19～PB-24 均完成各自内容 / 回归 / Operation 工作区验收并已归档。

## 对最终目标的贡献

用真实的旋转木马与 Strategy Park 内容验证 G03 建立的 Scene 原语，并在一个新 Operation Location 中连续运行“调查设备 → 处置警报”两段玩法。场景组合目标、站位、群体、M 选 N 与临时购买能力，但由同一套 Scene / Action / Plan / Preview / Resolution 机制承载；作者可从 Operation 工作区实际体验这个内容样例。

本阶段的“作者体验”是将内容装配进 Runtime 已注册的可选 Gameplay B bundle，并从 Operation 工作区游玩，不代表独立 Datapack Editor 已支持这些字段。当前 Carousel 正式样例是 `gameplay-b@1.0.0`，Strategy Park 样例是单独的 `gameplay-b-strategy-park@1.0.0`；若沿用 Park feed 增加复合 Location，应在该 Park bundle 中验收。当前 Editor 表入口尚无 Operation 表，编辑器交付留给 G05 / PB-25。

## 完成定义

- [x] 旋转木马正式 bundle 与 Strategy Park 原有 13 个 Location（其中 3 个战斗点）以隐式 Scene identity 在 Operation 工作区等价运行；既有角色策略、战斗节奏、路线、Cost、事实、凭证和效果均保持。PB-19～PB-21 已完成，证据见归档 Task。
- [x] 独立小型 Registry Event 在一个复合 Location 中依次运行设备调查 Scene → 警报处置 Scene；调查完成后同地点激活警报且出口不可用；地点目标与完整 Scene 序列满足后地点成功，唯一出口按既有规则自动转场，Run / Map 保留来源成功和两幕进度。Engine / UI 点击证据见 PB-22 Task。
- [x] 警报 Scene 展示关系与站位共同筛选的合法目标；可用单体目标和群体目标；站位变化后候选重新计算。PB-23 在独立小型 Event 与 Runtime View 中完成并通过 Engine / UI / 浏览器验收。
- [x] 同一 SceneAction 批次从 4 个候选恰选 2 项，fixed 不计数；另一个 Scene 的两项不同价格 Purchase Offer 能共用 PlayerCost 同批原子购买。撤销与 Preview 不产生扣费 / 效果；marker 持久性、重复购买限制与保存恢复通过 Engine / UI 回归。
- [x] 复合 Scene、群体 / 站位目标、M/N 与 Purchase 样例均可从通用 Operation Event 入口启动；Operation UI 不按样例 ID 增加玩法规则特判。

## 依赖与边界

- 前置 Goal：G03 原子场景骨架以及 G02 的选择、目标、费用预览与确认基线；G01 的战斗阶段、旧文案与站位展示缺陷须在对应验收路径通过后复核。
- 迁移顺序：PB-19 → PB-20 → PB-21 → PB-22 → PB-23 → PB-24；后项复用前项的迁移和样例，不重复建立卡牌、执行者、目标、Cost 或 SceneCard 系统。
- Task 0245–0248 的已完成成果按当前源码和测试复用；它们是已有能力的历史记录，不是本阶段实现事实的唯一来源。
- Task 0250 已由主任务冻结归档；最多作为最后已知的导航候选，所有实现事实回到源码与测试核实。
- 本阶段不实现独立 Datapack Editor 编辑入口（G05 / PB-25），不做全仓旧代码清理（G05 / PB-26），不新增万能 SceneManager、并行卡牌系统、独立商店服务、独立货币或存档迁移层。

## 会改变方案的未知项

- PB-19～PB-21 的 Scene identity、隐式 `main`、存档 / Resolution 与 Location-local Route 语义已由 G03 和 Owner 统一裁定闭合；旧 `interactionSceneId` / `activityId` 继续作为行动上下文，不提升为 Scene identity。
- PB-22 按 Owner 裁定使用独立小型测试 Event，复合 Location 内声明有序 Scene，并有最小出口 Location；调查完成后在同一 Location 推进警报处置，不做 Route 转场。地点目标与完整 Scene 序列完成后沿唯一既有 Route 自动转场。保持 13-location Strategy Park 主线不变，并提供可点击入口验收。
- PB-23 的 Position 属于 Action target 合法性；`select` / `all-eligible` 与 Relation / Type / ID / Position 过滤取交集，不使用空数组表示全体。
- PB-24 按 Owner 裁定为同一批次从 M 个候选 Offer 中恰好选 N 个；固定项不计 N。临时购买复用 PlayerCost 与 Action Effect，并受每 Run 一次的默认约束。

## 正式文档入口

- Draft：[[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]]
- Task：[[archive/task-0269-pb-19-carousel-sample-migration]]、[[archive/task-0270-pb-20-strategy-park-battle-migration]]、[[archive/task-0271-pb-21-location-exploration-migration]]、[[archive/task-0272-pb-22-multiple-scenes-per-location]]、[[archive/task-0273-pb-23-group-and-position-targets]]、[[archive/task-0274-pb-24-m-of-n-and-temporary-shop]]

## PB-22 实施记录（2026-10-08）

- `atomic-scene-demo` 是独立小型 Registry Event，复合 Location 内依次执行 `investigate-equipment` 与 `handle-alarm`；独立地点目标同时受完整 Scene 序列门槛约束。B 完成后来源地点 success，由既有唯一出口自动转场；Run / Map 保留两个 completed Scene ID 和 Route ID。
- `tests/engine/gameplay-b-multiscene-location.test.ts` 覆盖 skip / 失败提交不推进、actorless card 不绕过调查线索、A→B、现有 checkpoint 恢复继续 B、A 后地点与 Route 未完成，以及 B 后来源 success / route / map 进度。既有 Runtime 测试覆盖同 Run 地点回访保留 Scene progress。
- `tests/ui/gameplay-b-operation-entry-registry.test.ts` 通过通用 Registry Event 入口启动并提交两幕，验证两名学生各自可选行动、A 后 Route 不可用、B 后 success 与 Route ID。2026-10-08 本地浏览器实操也完成两学生各自参与、遥控牌门槛、A/B 顺序和单出口自动转场；当前机制记录见 `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`。
- PB-23 的目标模式与 PB-24 的 exact M/N、双价格 Purchase Offer 已完成；实施细节见下方记录及对应归档 Task。

## PB-23 实施记录（2026-10-08）

- `OperationActionTargetDef` 现在可声明 `selectionMode` 与 `allowedPositionIds`。目标资格交集检查 relation / ID / type / 当前 Position / 当前存活状态；`select` 保留明确 Actor ID，`all-eligible` 由 Runtime 在 Scene batch 提交前动态展开；空组拒绝，目标变化不静默替换。战斗仍保持单目标。
- `atomic-scene-demo` 的 Scene B 现在有前排敌人甲、前排敌人乙、后排敌人丙；一次全体行动命中甲 / 乙，明确移动甲到后排后下一次全体行动只命中乙，最后手动指定乙解除警报。右侧对手卡片与候选摘要读取 View 当前 Position。
- 浏览器实操在 1280×720 本地 In-app Browser 完成：同地点 A→B、甲 / 乙群体结算、手选甲移动、View badge 从前排更新为后排、下一轮只命中乙、手选乙解除警报、Location success 与唯一出口自动转场。
- Engine 定向回归 6 files / 95 tests；UI 定向回归 Registry entry 1 test、Operation controller 28 tests。`npx tsc --noEmit`、`npm run gen:schema`、Schema Sync 8 tests、Docs 759 Markdown / 0 errors、`git diff --check` 均通过。归档 Task 0273 记录所有变更路径与验收细节。

## PB-24 实施记录（2026-10-08）

- `scene-offer-purchase-demo` 以通用聊天流 Operation Event 入口启动。Scene A 屏幕显示全部 4 个候选、恰选 2 的计数和不计入 N 的 fixed briefing；真实操作选择两个候选后同批扣费 2（11→9）并原地进入 Purchase Scene。
- Purchase Scene 屏幕展示 2 / 3 PlayerCost 的饮水 / 医疗包 Offer。真实操作同批选择两项，preview 9→4 后一次提交；接着移除饮水，两个 Offer 仍标记为本 Run 已购买；完成库存复核后地点进度达到目标并记录唯一 Route 转场。
- 首次浏览器验收发现 M/N 候选复用了旧 `hidden` 折叠逻辑，后三项无法屏幕操作。修复后 Controller test 断言 4 个候选完整可见，并重新真实点击完成整个流程。Run checkpoint 保存恢复、成功命令幂等、移除物品后 marker 仍锁及拒绝无部分副作用由 Engine regression 覆盖。
- PB-24 定向 Engine 6 文件 / 104 tests、Operation Controller UI 29 tests、Schema Sync 8 tests、TypeScript、Docs（759 Markdown / 0 errors）、Architecture 与 `git diff --check` 均通过；29 个直接变更路径及直接 owner freshness 完成 GALHCG 写后核验，stale 0。具体证据见 [[archive/task-0274-pb-24-m-of-n-and-temporary-shop]]。
