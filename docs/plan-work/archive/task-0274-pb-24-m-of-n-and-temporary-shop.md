# Task 0274 / PB-24：Scene Offer 的 M 选 N 与临时购买

状态：completed — exact M-of-N、Run-local Purchase marker、共享 PlayerCost 原子购买、独立双 Scene 样例与 UI 候选呈现均已完成；Engine / UI / 浏览器、Schema、文档和 GALHCG 证据闭环通过。
> Goal Owner 统一裁定（2026-10-08）：本 Task 当前有效施工合同如下；它覆盖本文件中施工前基线的未决问句。跨阶段权威记录见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]。
> - 同一 SceneAction 批次中的 Global 选择集合声明 M 个唯一 SceneAction 候选，玩家必须恰好选择 N 项；固定项自动纳入且不计入 N。M/N 仅约束候选 SceneAction，不混入 PlayerSceneCard 或购买 Offer。
> - 少选 / 多选不得 Preview 或 Commit；只有独立 `skip: true` 表示显式跳过，并遵循旧的空批次规则。Skip 本身不满足 Scene 完成条件，也不构成成功。
> - Purchase Offer 使用现有共享 PlayerCost 与一个既有 targetless Operation Action 的 Event-only Effects；一项 Offer 每个 EventRun 最多购买一次。以 Event 已声明且初始未记录的 Fact 作为 purchase marker，并与奖励 HeldItem 分开；Preview 与 Commit 都重验 marker。Marker 属于 EventRun `knownFactIds` 并随 checkpoint 持久化，不因移除奖励物、存档恢复或重置 Location-local 进度而清除。
> - Purchase marker 仅由 Purchase Offer 写入。Action、StudentSkillRule、CombinationRule 等其它 Effect 来源不能 reveal / forget 预留 marker。一个 Scene 可在同一原子批次组合行动、卡牌和购买，但样例将 exact M/N 与采购放在同一 Location 的两个有序 Scene：先选择，后采购。
> - 不新建 ShopService、货币或通用库存系统。Scene completion、Location objective / result 与 Route progression 保持分层，必须按定义完成全部有序 Scene 才可完成 Location。

## 目标

在同一复合 Location 内声明 M 个候选并让玩家恰好选择 N 个；后续另一个 Scene 显示至少两个不同价格的一次性购买 Offer。玩家可改选 / 撤销、查看共享 PlayerCost 与人类可读的购买效果预览，再以各自的 Scene Resolution 原子扣费、应用 Action 效果并记录 Scene 进度；购买 Scene 可将多项 Offer 放入同一个批次结算。

## Responsibility、依赖与边界

- 唯一责任：G03 ActionOffer / ScenePlan / Preview / Resolution 机制表达候选集合、选择基数、可支付预览与购买效果；Operation Runtime 仍持有共享 PlayerCost / EventRun 并原子结算；Datapack 内容声明候选与费用。
- 依赖：G03 Task 0265–0267；PB-22 0272 的复合 Location；PB-23 0273 后复用同一警报场景样例。需要保留 0245–0248 的 Performer、Action、费用 / SceneCard 和撤销成果。
- 包含：作者可声明 M 候选、min / max 选取规则、当前 PlayerCost 预算下的 Offer 可用性 / 费用预览，以及同一 Scene 结算的一次性买入效果。
- 非目标：另造 `OperationCardDef`、新抽牌 / 弃牌系统、Scene 子系统、ShopService、独立 RunResource / Currency；不把 Spot / Init 商店直接接入 EventRun；不做 Datapack Editor 表单（G05 / PB-25）。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对 Task 的影响 |
| --- | --- | --- |
| `selectionPolicy` 只有 `required | fixed`：required 为可选项，fixed 自动纳入且不可取消；它没有 M / N 或最小 / 最大计数。 | `src/data-services/contracts/operation.ts` 中 `OperationSceneActionDef` / `OperationPlayerSceneCardDef`；`operation-view.ts`；Operation Runtime 当前机制页 | 新选取数量不能复用字段名后默默改变语义，须由人类裁定的新选择规则承载。 |
| 现批次 Global 允许至多一个可选 SceneAction；Individual 按每名学生至多一个行动；玩家 SceneCard 可从当前 hand 提交零到多张；PlayerSceneDeck 有有限实例 / hand / discard 和 draw / hand size 规则。 | `operation-resolution-planner.ts: planSceneBatch`；`operation.ts: OperationPlayerSceneDeckDef`；`operation-player-scene-deck.ts`；`operation-scene-actions.test.ts`、`operation-player-scene-deck.test.ts` | 现有多牌提交 / 批次局部基数并不等于“展示 M 个 candidate Offers，作者设定 N 选”。PB-24 复用牌的行为 / 手牌状态，不能重新造物理牌堆。 |
| shared PlayerCost 是 EventRun state；SceneAction / SceneCard PlayerCost 与 Action actor / team execution cost 已在同一 batch preview / commit 内校验 / 原子支付；Action effect 可发 Operation held item。 | `operation.ts: playerRouteState / OperationActionEffectDef`；`operation-scene-action.ts`；`operation-runtime-service.ts`；`operation-resolution-planner.ts` | 购买可评估现有共享余额与 Action effect，但购买数 / 库存等仍需新规则及同批原子语义。 |
| Operation 内容目前没有 Shop / stock / purchase offer 字段或 Runtime Shop 调用；全局 ShopDef / ShopService 属 Spot 商店内容域。 | `src/data-services/contracts/operation.ts`；`src/data-services/contracts/shop.ts`；Operation Runtime / content resolver | 不得把普通 Spot Shop 当作 EventRun 临时商店已实现，也不应将其跨域接入而不裁定状态 owner。 |
| 独立 Editor `TableKey` / `TABLE_META` 当前没有 Operation 表入口，即使生成 Schema 和 Registry 知道 Operation 表。 | `tools/datapack-editor/schema/types.ts`、`editor-extras.ts`、`engine-schema.sync.test.ts`；Registry 源 | 该 Task 的创作 / 体验入口是已注册 bundle + Operation Workspace；Editor UI 仍留 G05。 |

## 最小 Read Set

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/05-conventions/testing.md`。
- `src/data-services/contracts/operation.ts` 的 Action / selection / PlayerSceneDeck / Actor / Event Run 相关类型；`src/arona-clicker/contracts/operation-scene-action.ts`、`operation-view.ts`、`operation-resolution.ts`。
- `src/arona-clicker/services/operation-player-scene-deck.ts`、`operation-resolution-planner.ts`、Scene batch Preview / Runtime commit / Definition validation、Operation View / UI offer selector。
- `tests/engine/operation-scene-actions.test.ts`、`operation-player-scene-deck.test.ts`、`operation-resolution-planner.test.ts`、`gameplay-b-save-resume.test.ts`、`tests/ui/operation-workspace-view.test.ts`、`gameplay-b-operation-controller.test.ts`。
- 如新增或改 Datapack 字段：[[docs/ai/context-packs/datapack-schema]]、[[docs/docs-829/05-conventions/schema-sync]]、`src/data-services/registry/operation-content-validation.ts` 和对应生成 / 校验测试；仅当任务正式纳入 PB-25 才扩到独立 Editor。

## 施工切片

### P0：裁定选择计数合同与候选来源

- V1 采用 Owner 已裁定的 exact-N：`sceneActionChoice` 只列同一 Global SceneAction batch 中的 M 项 required 候选，N 在 1…M；fixed 自动纳入且不计数。物理 PlayerSceneCard 与 PurchaseOffer 不参与此 M/N。
- Planner 对少选、多选、重复、invalid、stale 和费用不足做纯校验；普通空提交不能冒充 skip。专用 `skip: true` 按旧空批次规则消费批次机会，不自动满足 Scene completion。
- View / preview 投影候选集合、已选数量、可购买 Offer、共享 PlayerCost 和明确阻塞原因。

### P1：复用共享 PlayerCost 结算临时购买

- 每个 PurchaseOffer 指向至少含一个 Event Track / Fact / HeldItem reward 的既有 targetless Action，使用现有共享 PlayerCost；Action cost 与非 Event 效果非法。多 Offer 可与 SceneAction / SceneCard 在一个 Resolution 内原子结算。
- 一次购买通过唯一、Event 已声明且初始未记录的 `purchaseFactId` 标记；marker 与 HeldItem 分离并随 EventRun / checkpoint 保留，任何非 PurchaseOffer Effect 来源均不可改写 reserved marker。Preview 与 Commit 都重验 marker。
- 在同一 Location 的后续 Purchase Scene 展示两个不同价格的 Offer；购买选择 / 撤销只更新 UI 草稿和 Runtime preview，不扣钱；同批购买后 marker / reward / shared balance 应与一条 Resolution 一致。无需引入 stock reset 或通用 ShopService。

## 回归证据与 Operation 工作区验收

- 现有证据：`tests/engine/operation-scene-actions.test.ts` 覆盖 SceneAction / SceneCard preview、费用 / 目标与原子 commit；`operation-player-scene-deck.test.ts` 覆盖有限牌区 / 实例；`operation-resolution-planner.test.ts` 覆盖资源 / Effect 执行；`gameplay-b-save-resume.test.ts` 覆盖 checkpoint；UI Operation Controller / View 测试覆盖选牌、撤销与提交。
- [x] 从通用 Operation Event 入口启动独立 `scene-offer-purchase-demo`；Scene A 屏幕实际显示四个候选、恰选 2 的计数和 fixed 项，提交后原地切换到同 Location 的 Scene B；Purchase Scene 显示两档价格，库存复核完成后 Location 目标满足并沿唯一 Route 转场。
- [x] 两件不同价位物品在同批提交；屏幕预览余额 9→4，完成后 Run 状态余额 / 标记更新。UI Controller 行为测试覆盖撤销、改选与仅修改 Preview；Engine 回归覆盖 Run checkpoint 保存恢复、成功命令幂等重试、移除 HeldItem 后 marker 仍阻止复购。
- [x] Planner / Runtime / Registry 回归覆盖少选 / 多选 / fixed / skip、共享余额、重复 / stale Offer、marker 缺失 / 已知 / 重复、空奖励与不合规 Action；拒绝时快照不部分扣费、发奖或推进 Scene。
- [x] 屏幕真实操作复核确认 M/N 候选均可见并可勾选；发现旧替代牌折叠逻辑隐藏后三项后已修复，并加入 UI 回归断言，之后再次由真实浏览器完成两幕、双购买、物品移除、库存复核与 Route 流程。

## 施工前未解决裁定（历史基线，已由上方 Owner 裁定覆盖）

以下问题记录最初开工前缺少合同的状态，只用于解释为什么需要 Goal Owner 裁定。它们不再是当前待决项，不得据此暂停已授权施工；实现若发现与合同存在真实冲突，再按 Draft 所列升级条件报告。

- M 选 N 是“恰好 N”还是“最多 N”；是否允许少于 N、跳过、固定选择项、每个候选最多选一次；Scene 完成 / route progression 如何与可跳过规则配合。
- M 个候选属于 SceneAction / ActionOffer / PlayerSceneCard 其中哪一层；不同来源是否可混选、玩家手牌计不计入 M / N；不能把 `required` 重新解释为“必须选择”。
- “临时小商店”中的临时是当前 Scene 的短命 Offer、Run 内一次购买、有限库存，还是离开 Location 即重置；买入结果是 Event `heldItem`、Fact / Track 还是其它既有 Operation Effect；是否保存 / 加载 / 重入时保留 stock。
- 是否共用当前共享 PlayerCost 作为购物余额，以及多个 purchase Offers 和行动 PlayerCost 同时进入同一提交时的支付顺序 / 失败边界。Roadmap 偏向共用余额；正式字段和事务边界仍需裁定，禁止新建货币层或接入 Spot 商店后再倒推。

## 当前施工记录（2026-10-08）

- 数据合同增加 Scene-local exact M-of-N 与 PurchaseOffer；Planner / Runtime 将 selection、purchase、显式 skip、marker 与 shared PlayerCost 纳入 Preview / Commit / Resolution。
- View / UI 已投影固定项、选择计数、购买状态与人类可读奖励说明；Purchase marker 独立于 HeldItem。
- 真实浏览器发现候选组沿用普通替代牌的 `hidden` 属性，使四项中仅第一项可见。`renderSceneActionChoiceCard` 现显式显示整个候选集合，Controller UI 测试断言候选 ID 与全部可见；修复后浏览器可以实际选择四项中的任意两项。
- 验证关注边界：exact N、fixed 不计数、skip 不成功、同一 Run 重复购买锁、save/resume、移除奖励物后仍锁定、同命令幂等重放及 Scene A → Purchase Scene 顺序。
- 当前独立样例按验收要求拆为同一 Location 的两个显式 Scene；主线 Strategy Park 不为此改动。
- 浏览器从通用聊天流启动样例，选稳定闸门与检查无线电（2/4，11→9），同批选饮水与医疗包（2 / 3 Cost，9→4），移除饮水后两个 offer 仍显示本 Run 已购买，再完成库存复核（现场状态 10）并出现唯一 Route 转场记录。Save / Resume、同命令幂等与 marker 持久性由 Engine checkpoint / runtime tests 覆盖。
- PB-24 收尾时定向 Engine 6 文件 104/104、Operation Controller UI 29/29、`npx tsc --noEmit`、Schema Sync 8/8、`npm run check:docs`（759 Markdown / 0 errors）、`npm run check:architecture` 与 `git diff --check` 全部通过。`npm run gen:schema` 已运行且生成结果已纳入范围。

## GALHCG 影响闭环

- 只读发现：`project_id=acprogram`；`search(source, "selectionPolicy")` 返回范围 / 预算截断；改用 `OperationSceneActionDef` / `OperationPlayerSceneCardDef`、`planSceneBatch` 和精确测试阅读确认当前语义。Shop 相关查询只作为候选导航，回到 Operation / Shop contracts 确认边界。
- 变更审查：本规划 Task 未改变实现路径；如果后续加 Operation Datapack field / EventRun stock state，要对 Registry、Runtime、View、Schema / save、UI 和 tests 的直接变更按路径审查。
- 精确 29 条直接变更路径已由 `review_changes` 写后复核，所有路径 `unchanged`、stale Evidence 0；更新后的 63 个 node / edge owner 全部 `verify_freshness=fresh` 且完整。14 个节点保留并更新全部 Evidence、45 条现有关系更新、4 条 `maps_to` 新增；4 个写入批次均完整且 dry-run `valid=true`，共提交 95 条 owner Evidence 引用。只审核 PB-24 路径及直接 owner，未作全图质量审计。

## 剩余工作

- PB-24 无剩余工作。独立 Editor 作者入口与完整旧分支清理属于 G05 / PB-25 / PB-26。

## 相关路由

[[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/05-conventions/schema-sync]] · [[task-0265-pb-15-action-offer-projection]] · [[task-0266-pb-16-scene-plan-preview]] · [[task-0267-pb-17-scene-atomic-resolution]] · [[archive/task-0272-pb-22-multiple-scenes-per-location]] · [[archive/task-0273-pb-23-group-and-position-targets]]
