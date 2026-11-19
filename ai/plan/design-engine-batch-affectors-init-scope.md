# 引擎设计调查：离线批结算、Affector 惰性贡献与 Init 隔离

2026-11-12 · 基于 [[ai/plan/report-engine-performance-2026-11-12|引擎性能报告]] 与 Base Datapack 1.0.3 的补充验证。第 1、2 项已实施，第 3 项保留为设计议题。

## 1. 离线按恢复时的产出率一次性结算

把离线规则定义成 **用存档恢复后、离线入账前的状态，计算每种资源的一帧正产出，然后乘以离线帧数 N**。所有资源先求值再入账，避免先写入 A 后，读取 A 的 B 用到结算后的余额。沿用现有离线帧数向下取整、超过 5 帧才补算、最多 28,800 帧。离线中途出现的产出提升无需追补。对于产出率随余额下降的定义，冻结在较高起点也可能比逐帧模拟多发，属于固定起点口径的另一面。 [离线会话](../../src/engine/runtime/session-service.ts#L79) · [GameNum 求值](../../src/engine/expression/game-num.ts#L267)

实施入口可拆成三步。

1. **SessionService 负责算 N，调用宿主的离线结算入口。** 一秒定时器仍调用在线 Tick。没有正产出时，建议沿用当前“执行首帧后退出”的计数口径，帧计数记 1。没有活动 Init 时，跳过 Init 离线结算。
2. **TickSystem 负责准备资源批次，宿主经状态写入口提交。** 先检查乘积及最终余额是否有限，然后一起提交资源和产出统计，最后通知受影响资源。这样某条 `resourceChanged` 引发的后续 Effect 会看到完整入账状态。同步更新 `totalFrames` 和既有各层帧统计，沿用现有统计字段的记账口径。结算与通知分别确认完成，重入或通知失败后的重试不能重复发放同一份收益。 [单帧结算](../../src/engine/system/tick-system.ts#L39) · [资源记账](../../src/arona-clicker/state/state-mutation-service.ts#L294) · [帧统计](../../src/engine/stats/stats.ts#L209)
3. **离线只累计 GameNum 产出。** 不模拟中途的 Tick Trigger、`perTickEffects`、随机发奖和剧情时钟。资源变更驱动的揭示与 Affector 可以按入账后的状态响应一次，统计依赖和阻断条件可在恢复时集中复核。依赖 Tick 的累计里程碑可在下一次正常 Tick 领取。周期事件仍按在线帧号匹配，离线期间漏过的周期和瞬时阈值不补。对会扣资源或更新其他状态的 `perTickEffects`，这也意味着离线不执行，应作为产品语义写明。 [在线 Tick 编排](../../src/arona-clicker/runtime/runtime-game-instance.ts#L1930) · [周期事件匹配](../../src/engine/effect/trigger-system.ts#L331)

**原型验证。** 用实际 GameNum 和资源 Mutation 一次性计算并入账 28,800 帧，默认内容耗时中位数 **1.56 ms**，新增 128 个活跃固定产出据点后为 **1.91 ms**，各 13 次有效样本。默认样本到账 345,600 信用点，累计产出统计等量增加。信用点里程碑在下一次正常 Tick 执行。原型保留普通资源变更事件，计时仅涵盖产出求值和入账，尚未实现正式的批次提交、帧计数和恢复收尾。性能基线中的对应整段会话分别为 407 ms 和 2,094 ms。

正式验收至少覆盖同一快照的多资源依赖、零产出、离线 8 小时上限、存档恢复只入账一次、计数与产出统计、入账后的揭示，以及在线 Tick 与离线结算的行为差异。

## 2. Affector 激活后存贡献，由依赖事件使缓存失效

现有 Affector 已有 `Latent / Active / Removed`、`ConditionDepIndex`、活跃实例、flow 桶和贡献记录。主要剩余成本是 `applyActiveEffects()` 每帧遍历所有活跃实例及条目，活动集变化后 GameNum 又重同步全部活跃来源。适合沿现有入口收窄工作量。 [激活与挂卸](../../src/engine/effect/affector-engine.ts#L182) · [每帧扫描](../../src/engine/effect/affector-engine.ts#L579) · [现行贡献同步](../../src/engine/expression/game-num-tag.ts#L146)

| 声明 | 激活时保存或提交 | 后续何时处理 |
| --- | --- | --- |
| 立即发奖或状态动作 `effects` | 沿现有 Effect 执行入口提交业务状态 | 保留现有实例进入 Active 时触发的语义。永久一次发放使用已有 `Trigger.once`，明确其记账归属 |
| 持续贡献 `flows / zoneModifiers` | 按来源登记常量或带依赖的表达式 | 依赖变动时标脏，下次查询时求值。固定值跨帧复用 |
| 每帧逻辑 `perTickEffects` | 将已激活且有每帧操作的条目登记到专用集合 | Tick 只遍历该集合，另复核确实需要轮询的条件 |
| 声明式能力或上限 | 登记由哪条来源提供能力、覆盖值或连接 | 由消费者按需读，挂卸时更新受影响的索引 |

**永久状态与运行时贡献分别处理。** 如果设计意图是“达成条件即永久获得”，先落已有的解锁或玩家状态，之后以该状态驱动持续贡献。普通条件型 Affector 在条件转假时移除贡献，下次转真仍可激活。存档恢复、Init 重建和热编辑应能重建派生索引，重建自身不应当被当作一次新的发奖事件。当前 `Trigger.once` 的完成记录随 Init 快照保存，真正跨 Init 的永久发奖要使用具有全局生命周期的业务状态。 [激活沿](../../src/engine/effect/affector-engine.ts#L249) · [一次性记录](../../src/engine/effect/trigger-system.ts#L233) · [快照字段](../../src/arona-clicker/state/per-init-fields.ts#L114)

**热插拔沿用稳定来源身份。** 以宿主、Pack、entry 找到来源。条件变化、卸载或同 ID 替换时，先准备新依赖和贡献，再批量撤旧加新。依赖索引、每帧集合与 GameNum 贡献应一起生效，然后再通知读者。同 ID 改了条件但有效 entry 集未变时，也要刷新依赖与贡献；现有挂载路径复用实例，而条件依赖登记只在新建时发生。普通数值编辑沿用现有授权状态，热替换不重放既有发奖。旧贡献按来源精确撤销，已到账的奖励由业务规则决定是否另行冲销。 [现有 Spot 热替换](../../src/engine/effect/affector-engine.ts#L511) · [变更通知](../../src/engine/effect/affector-engine.ts#L340)

最小落地顺序是先让 Tick 只扫明确的每帧条目，并修正固定 flow 的同资源失效。接着用现有 `affectorRuntimeChanged.instanceIds` 定向更新来源，保留读档和整体重载的全量重建入口。统计依赖仅在对应写入口能准确通知时改成事件驱动。对已完成构建的 flow 索引，空桶可直接返回零，保留索引尚未就绪时的兼容路径。验收覆盖条件反复翻转、同 ID 更换条件或产出资源、卸载后立即查询、重建时不重复发奖。 [Affector 变更到 GameNum](../../src/engine/expression/game-num.ts#L148) · [flow 桶查找](../../src/engine/expression/game-num-eval.ts#L258)

## 3. 跨 Init 隔离先做执行、派生数据和玩家视图

现有 Init 切换会保存快照、卸载 Init Trigger 和故事监听，并按当前玩家状态重新对账 Affector。信息揭示查询也会核对活动 Init。与此同时，初始化仍把所有启用包的定义合并到 Registry，包顶层 `triggerDefs` 全局挂载，GameNum 按所有 Init、Area、Spot 和资源建树。两种成本和泄露途径均可复现。 [切换清理](../../src/arona-clicker/services/world/init-service.ts#L577) · [Init Trigger 分组](../../src/arona-clicker/services/world/init-mount.ts#L16) · [定义加载](../../src/arona-clicker/runtime/runtime-game-instance.ts#L1840) · [生产树构建](../../src/engine/expression/game-num-build.ts#L81)

- **行为越界。** 在阿比多斯增加 80 信用点，未执行 Tick 就回到夏莱。夏莱下一帧触发了 `base:trigger:abydos_first_milestone`，战术工具包进入夏莱库存。该规则挂在包顶层，读的是阿比多斯历史产出，发奖落在当前 Init。应将 Init 私有规则放入已有的 Init Trigger 分组，先覆盖这条回归路径。跨 Init 成就可继续读取历史摘要，奖励归属需明确。 [阿比多斯里程碑定义](../../src/arona-clicker/content/triggers.ts#L18) · [完成记录作用域](../../src/arona-clicker/state/per-init-fields.ts#L114)
- **派生数据占用。** 在夏莱活跃时向千禧年添加未持有的据点，夏莱产出仍为每帧 12 信用点，活跃 Affector 仍为 7，生产树的节点与构建耗时已经上升。

| 其他 Init 新增内容 | 注册产出资源数 | GameNum 节点数 | `buildAll()` P50 |
| --- | ---: | ---: | ---: |
| 无 | 2 | 666 | 0.56 ms |
| 128 个据点，共用信用点 | 2 | 2,842 | 3.14 ms |
| 512 个据点，共用信用点 | 2 | 9,370 | 18.44 ms |
| 32 个据点，各有独立产出资源 | 34 | 18,874 | 68.69 ms |

节点数是派生规模的实测，实际堆内存仍需单独测量。最后一组将资源数和每棵树的 Spot 子树数量同时放大。每个资源都为所有 Spot 建子树，切生产树时资源清单也必须一起收窄。 [资源发现](../../src/engine/expression/game-num-build.ts#L52) · [Affector 资源发现](../../src/engine/effect/affector-engine.ts#L648)

| 层面 | 适合的隔离边界 |
| --- | --- |
| 规则执行 | 仅挂载当前 Init 和声明为全局的规则。当前 Init 快照恢复后再建立其订阅，切换时撤销旧订阅及旧一代延迟动作。 |
| 派生计算 | GameNum、Affector 贡献、局部可见性索引只编译当前 Init 和跨 Init 共享的内容。先复用 Registry 的所有者关系建立限定范围的输入。全局 Spot 如果挂在另一条世界线，保留其现有乘区语义或明确改动规则，不能靠删掉整棵旧 Init 分支来决定。 |
| 玩家视图 | 大厅只投影已获准展示的 Init 摘要，实际玩法查询按活动 Init、全局归属及揭示权限返回内容。编辑器可以使用完整定义目录；玩家读模型与玩法命令仍要各自校验范围。 |
| 包体与保密 | 本地启用包仍可用于全量引用校验和编辑。当前 Base 内容已随客户端交付，玩家可以读取包数据。如果包体或启动解析成为瓶颈，可再按 Init 拆载荷、按进入时加载。如果要求客户端也读不到未解锁内容，需要由服务端在授权后交付对应载荷。 |

跨 Init 引用优先复用现有全局状态、已解锁摘要、累计统计和按需查询的定义引用。这样既能表达跨世界线条件，又能避免为了读一项历史数据启动另一条世界线的反应器。第一轮可以用“只增加非活动 Init 内容，当前 Init 的运行节点和订阅数保持稳定”作为验收条件，同时验证往返切换、全局 Spot 与 Enhancement、存档恢复、跨包引用和热修改。 [当前信息揭示范围](../../src/arona-clicker/services/world/information-reveal-domain.ts#L92) · [产品包入口](../../src/arona-clicker/content/default-datapack.ts#L2) · [Runtime 内容目录](../../src/data-services/registry/runtime-content-browser.ts#L595)

## 验证材料

原型脚本为 `.test-artifacts/engine-perf/design-probe.ts`，输出为同目录下的 `design-probe.jsonl`。原型在 Windows、Node 26.7.0 环境执行，静音控制台调试日志，包含产出、统计、里程碑和跨 Init 行为断言。

正式实现复测使用 `.test-artifacts/engine-perf/implemented-batch.ts`，数据见同目录的 `implemented-batch.jsonl`。计时范围与原性能报告相同，离线计时从 `game.start()` 开始。每组预热 1,500 帧后取 12 次有效样本，核对 28,800 帧及资源入账。在线样本预热 2,400 帧，计时 12,400 帧。

| 场景 | 原实现 P50 | 批结算与惰性贡献 P50 |
| --- | ---: | ---: |
| 默认内容，8 小时离线结算 | 407.4 ms | 0.092 ms |
| 新增 128 个固定产出据点，8 小时离线结算 | 2,094.1 ms | 0.058 ms |
| 新增 512 个固定产出据点，在线单帧 | 0.2973 ms | 0.0087 ms |

复测环境为同一台 Windows 主机与 Node 26.7.0，保留默认 DevLog，静音控制台调试输出。离线结算只推进冻结产出与相关统计，旧实现的逐帧副作用属于不同的玩法口径。浏览器启动、存档 I/O 和冷启动解析另行计时。
