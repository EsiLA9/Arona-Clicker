# 调查报告：跨 Init 封存、全局进度与 Affector

## 现行行为与差异

| 范围 | 引擎现状 | 对应玩法边界 |
| --- | --- | --- |
| Init 快照 | `PER_INIT_FIELD_SPECS` 捕获本地资源、库存、经营等级与派驻、已访区域、已取得地图、帧数、普通 Trigger 完成、剧情进度及游标、本地强化和本地商店购买记录。退出会停 Session、撤销 Init Trigger 和 Reveal／Milestone watches、清事件队列、推进 runtime generation、释放 Affector。恢复时 `enterInit()` 会选默认 Area，因而覆写已存的 `currentAreaId`；无默认 Area 则清空。还会执行一般入场流程。见 `state/per-init-fields.ts`、`services/world/init-service.ts`、`services/world/init-mount.ts`。 | 本地数据封存和大部分退场清理已有基础。恢复需区分真实入场事件与快照回放，并恢复仍合法的位置。 |
| 局内活动 | `initEntered` 重建 MapRun 和训练相关运行态，进新 Init 时前一个 MapRun 消失。软退出到大厅期间 MapRun 仍可查询；Operation 在大厅和新 Init 均仍活跃，可继续提交并写入整份存档。整存档读写在 `SaveData.mapRun/operationRun` 有 checkpoint，Init 快照没有对应字段。见 `runtime/runtime-game-instance.ts`、`runtime/runtime-save-codec.ts`、`services/operation/operation-entry-service.ts`。 | 切换入口应同时处理两个 owner。每个 checkpoint 都必须有唯一来源 Init，恢复时走已有定义和版本校验。 |
| 角色与据点 | Registry 默认名册、碎片、抽卡保底、装备全局；`chatRead` 默认本地。基础包阿比多斯联络点位于夏莱，`SpotDef.global` 保留其等级和派驻并绕过当前 Init 的 Spot 写入检查。顶层 Trigger 招募学生，旧测试明确锁定了跨线与硬重启仍持有的行为。`characterMemory` 另存曾拥有差分、等级／星级／好感／装备上限及行为累计，`protoStats` 也有全局累计。见 `registry/registry.ts`、`state/snapshot.ts`、`runtime/runtime-wiring.ts`、`state/character-memory.ts`。 | 角色、设施与养成本地化后，保留历史查询及收集展示。联络点的存在、购买和实际名册写入归夏莱。 |
| 跨线残留 | `spotTagOverrides` 按 Spot ID 留在整个存档，Mod 禁用时另有 tag residue；硬重启也保留。`tagEffects/entityEffects` 混合带 Affector 来源的区记录和可直接登记的记录；前者会随实例撤销并重建，后者可跨线影响同标签目标。`passiveCooldowns`、`studentBlocks` 未进快照，使用会按 Init 恢复或重置的帧数与角色/条目 ID。`enhancementAttachments` 在当前源码只见类型与删除，生效和归属判定使用定义的 `attachment`。`globalShopPurchaseRecords` 是显式全局购买事实，默认商品仍是按 Init、Shop 记账。见 `types/state.ts`、`state/tag-residue.ts`、`state/state-mutation-service.ts`、`services/story/story-entry-selection.ts`、`services/economy/shop-service.ts`。 | 标签改动、永久经营加成、闲聊冷却和阻断归来源 Init。全局限购记录须有明确声明。玩家主题、表现偏好等保存级设置可以独立于玩法归属。 |
| 全局余额 | 当前唯一 Global ID 为青辉石。Mutation（在线、离线、Shop 与 Spot 交易）选 `globalResources`，快照按 `resources` 整表捕获。支付与强化购买调用的 `InitService.getResourceAmount` 将两桶相加，Shop 校验按桶，ReadModel 合并时由全局桶覆盖；Engine 的 `res`、`resource` 条件和 Stats 的余额镜像只读本地桶。Milestone 的事件来源推导也特判排除 Global 资源。见 `types/ids.ts`、`state/state-mutation-service.ts`、`read-model/game-view-builder.ts`、`services/world/milestone-domain.ts`、`src/engine/expression/{value-system,condition-system}.ts`。 | 使用同一个资源归属判定读写余额，并把读取能力注入 Engine。只从活动来源写钱包一次；统计保留来源 Init。 |
| 统计与奖励 | `StatsService.recordResourceChange` 把正向变化累计为 Produced，含普通奖励，向当前 Init 及全局归因；`InitProducedAmount` 跨本线多次游玩累加。`CurrentRun` 在每次进 Init／回线时重新开始，整存档读档恢复该次统计。两者都表达不了跨软切线保留、硬重开后比较的单轮最高产量。`informationRevealProgress`、`milestoneProgress.completed` 是保存级事实。Milestone Adapter 能按关联 Area 归属与已访限制监听并登记完成；其 `completeMilestone` 仅登记事实。`Trigger.once` 完成记录按 Init；顶层 Trigger 常驻，条件引用其他 Init 的统计并不会限制发奖落点。见 `src/engine/stats/stats.ts`、`src/engine/expression/stat-dsl.ts`、`services/world/milestone-{adapter,domain}.ts`、`content/triggers.ts`。 | 成就/历史与领取是两个事实。来源 Init 决定本地奖励的落点；跨线领取须有稳定的保存级奖励键，原子发放 Global 钱包。需要单轮新高的节点再选择指标，先明确生产是否包含奖励。 |
| 星图持有和宿主 | `globalEnhancementEntries` 按定义 `attachment.kind === 'global'` 过滤持有。`purchaseEnhancement` 买到后增加持有并触发挂载；`reconcileMounts` 按物品 ID、强化 ID、Spot ID 重挂。Area/Init attachment 的强化仍按强化 ID 挂载，无法解析到实体的 flow 落 GameNum 根节点；探针的 Area `+2` flow 和明确写在 Area 的 `+1` flat 属于不同层。星图导航和主题服务权限目前也由 Active Affector 导出。见 `state/snapshot.ts`、`services/progression/enhancement-service.ts`、`src/engine/effect/affector-engine.ts`、`src/engine/expression/game-num-build.ts`。 | 星图购买、服务／导航能力和经营实例各有生命周期。经营实例以持有来源和当前线的实际 Init／Area／Spot 为键。Area 经营效果随该线活动持续，可跨同线区域移动。 |
| 目标、来源与计算规模 | tag 修饰写全存档 tag key，实体通配枚举 Registry 全表；指定实体可命中外线。GameNum 为每种资源预建各 Init／Area／Spot 子树；Spot flat/flow 有等级门，Area／Init flat 无活动 Init 门。`syncAllSpotFunctionalities` 扫所有 Spot，额外功能按标签和持有计算，缺少 Init/Area 附着检查。直接出现在 Affector 条目里的 `effects/perTickEffects` 默认写当前状态，宿主字段不决定写入目的地。 | 先按来源和宿主筛选，再与 target 交集。inactive 定义可留 Registry 和预览界面，活动产出索引无需物化外线树、监听或专属资源。 |
| 重挂、热改和离线 | 同 ID `registerPack` 替换会更新依赖及贡献，当场抑制激活奖励，之后真实条件假→真仍可发放。整存档加载 `reconcileMounts(true)` 抑制重挂激活；切线重进 `reconcileMounts()` 会重复发放。Spot 等级等同步事件也能触发挂载，修复需覆盖整个恢复窗口。World 热删当前 Init 时 `returnToInitSelection` 清定位后仍重对账，未走标准封存路径。离线只提交到活动状态，`resumeInit` 重置时钟；若活动树已含外线贡献，批量结算会把它一起入账。见 `runtime/runtime-save.ts`、`services/world/init-service.ts`、`runtime/runtime-game-instance.ts`、`src/engine/effect/affector-engine.ts`。 | 恢复和热更新重建派生数据，真实获得/条件翻转才产生合法激活事件。跨线一次性奖励以保存级回执防重。`gain × N` 可复用，只需保证参与结算的来源属于活动线。 |

上表中的 `state/`、`services/`、`runtime/`、`content/` 和 `types/` 位于 `src/arona-clicker/`，Registry 位于 `src/data-services/`。

## 可复现结果

探针使用工作区当前版本及随包 Datapack，原线 A 为夏莱、B 为阿比多斯。基线和奖励错线使用正式内容。星图探针给两线的 Area 与 Spot 同一个 `office` 标签，增加一个 GlobalEnhancement、一个 AreaEnhancement 和一个仅 A 的 Tick Trigger。该探针移除基础包顶层 Trigger 与 Milestone 来观察独立贡献。

| 操作 | 实际结果 |
| --- | --- |
| 在 A 买星图，激活指向 B 的 Area flat | B 未进入、没有本地持有，B 的 `areaExtra` 仍有 +13，A 的资源树也纳入该项。未限定资源的 Area flat 同时命中青辉石树。当前 Area／Init 区节点没有传入资源键，另试带 `resource: credit` 的 Area flat 时实测为 0，落地时须验证资源限定。 |
| A 的主厅 → 同线图书馆 → 存档读档 | Area 强化仍挂载，主厅指定加成 +1 保留；其另一条 +2 flow 走根节点。移动后即时总产出 55，读档仍为 55，钱包仍为 3。 |
| 同 ID 热替换 → 条件变化 → B → A | 热替换把倍率从 2 改为 3 并替换 flag 依赖，替换当下无发奖，设置新 flag 后 +3。B 的 Spot 由 4 变为 12、能取得星图的根 flow +7 和 Area +13。离线结算后钱包 139。回 A 时恢复先前的 flag，重挂将钱包增至 142，保存过的图书馆位置回到主厅。 |
| A → B → A → 大厅的监听 | EventBus 的 Tick／flagChanged 底层订阅均为 1／4。探针的 A 专属 Trigger 依次存在、撤销、恢复、撤销；Trigger 定义数 22→7→20→0，其余差额来自随状态派生的剧情监听。默认包顶层 Trigger 在大厅仍注册。 |
| B 存档后以 10 帧启动 | 信用点增加 320、青辉石增加 130，与进入批量计算时的 32／13 每帧一致；A 快照余额未动。该例证明批量写入边界已有基础，B 中的未限定 Area 加成仍进入了结算。 |
| 青辉石入账、消费、切线 | 合法注入 100 后，购买「全能基建」扣到 50，并且读档、切线仍为 50。`res` 读 0、`resource >= 1` 为假，`InitProducedAmount(A, 青辉石)` 记为 100，统计余额镜像为 0。仿旧测试把 100 只填本地桶，购买同样通过，全局余额变成 -50。 |
| 基础包招募、标签和硬重开 | 在夏莱领星野后，切到 B 仍有实体、联络点等级和 `variantsEverOwned`，A 的 Spot tag override、直接 tag 乘区、闲聊冷却都还在。硬重开保留钱包 50、历史、全局联络点及直接乘区。活动 Init 中调用 `startNewGame` 则钱包与角色历史归零。 |
| 在 B 累计 80 信用点后，先到 A 再 Tick | A 取得阿比多斯战术包 +1；回 B 的 `CurrentRunProducedAmount` 已归 0，`InitProducedAmount` 仍为 80，B 再 Tick 也取得战术包 +1。 |
| 软退出后在大厅调用 `startNewGame(A)` | 本地快照与角色历史被清空，钱包 65 仍保留。 |
| MapRun／Operation 同时存在时退出 | 退到大厅仍能查询两个 Run；进 B 后 MapRun 被重建清除，Operation 保留同一 Run ID，仍可提交一拍和保存到 B 的整存档。 |
| 仅增加 inactive Init 的设施定义 | 活动信用点产出始终 12，活动实例数始终 7。默认 2 种资源、666 节点；外线加 512 个同资源 Spot 后 9,370 节点；外线加 32 个独立资源 Spot 后 34 种资源、18,874 节点。 |

全量存档与软／硬切线还存在一处 API 区分。`startNewGame` 在 `activeInit` 为空时会保留全局钱包、已解锁 Init 和全局强化，清除历史与快照。首次大厅预购依赖这一行为，软退出后的大厅也满足同一条件。`hardRestartInit` 删除当前 Init 快照并退出，`hardResetInit(id)` 只删除指定快照，后者本身不终止活动 Run。执行任务需要覆盖三个入口及热改退回大厅。

## 落地顺序与玩法待定项

1. 收口资源查询与存档归属，先修复全局钱包、角色/据点默认归属和明确的本地发奖。将全局历史、设置和显式商店限购留在保存级。用已有版本策略处理结构变动。
2. 收口 Init 生命周期，再接星图授权与经营宿主。退出时停写并封存 MapRun/Operation，恢复时按当前定义重建；在获得、进入、移动、保存恢复、热改和离线均验证实际宿主与目标。最后缩小 GameNum 树和功能扫描，观察节点数与监听。
3. 以一条固定测试奖励验证星图历史领取原子性。正式超级资源的产出速率、阈值、奖励量、价格及是否使用单轮新高仍由玩法设计决定。首批可直接核对现有每 Init 累计或明确完成事实。已有「主题编辑权限」及导航能力归入保存级授权。
4. 执行任务采用可续局 checkpoint 随 Init 封存的设计；缺少续局版本或定义失效时终止该局。这是 0371 的设计选择。热改规则变化及无效位置的恢复优先使用现有拒绝／降级契约。正式内容的全局混合节点按实际能力拆声明，历史展示与本地入队条件分别验收。

## 验证记录

- 首轮覆盖 World、Core、Progression、Character、Map 保存和 Operation 编辑器入口，76 个文件、730 项通过。扩展定向验证覆盖 Operation Runtime、Shop 和 Pack 热更，78 个文件、768 项通过。
- 扩展命令 `npm test -- tests/engine/world tests/engine/core tests/engine/progression tests/engine/character tests/engine/gameplay-b/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b/gameplay-b-event-runtime-integration.test.ts tests/engine/runtime-content/shop-service.test.ts tests/engine/runtime-content/arona-runtime-pack.test.ts`。
- 最小探针源码 `.test-artifacts/engine-perf/cross-init-0370.ts`，输出 `.test-artifacts/engine-perf/cross-init-0370.jsonl`。用项目 esbuild 将探针打包成 Node ESM 后运行，包含七行 JSON 结果。临时文件归入项目测试产物目录。
- 施工入口为 [[ai/plan/task-0371-cross-init-state-affector-implementation]]。
