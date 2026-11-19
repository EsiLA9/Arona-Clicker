# ACProgram 引擎性能报告 · 2026-11-12

默认数据包下，`GameInstance.tick()` 的中位耗时为 **0.0118 ms**，P99 为 **0.0459 ms**。离线补算在同一线程逐帧执行，8 小时有持续产出时中位耗时为 **407 ms**。额外激活 128 个固定产出据点后，8 小时补算升到 **2.09 秒**。当前最明显的等待出现在进入会话时。

## 实时 Tick 与离线补算

默认样本使用产品随附的 Base Datapack 1.0.3，在夏莱世界线从初始状态开始。包内有 26 个 Spot、15 个 Area 和 6 条世界线。初始状态拥有 4 个 Spot、7 个活跃 Affector，首帧产出 12 信用点。第二个真实内容样本通过状态写入口激活当前世界线下的 12 个据点，首帧产出 89 信用点。压力样本在同一个 Area 加入 32、128 或 512 个一级据点，每个新增据点只有一条信用点 flow。依赖型样本每次先把共享输入资源在 1、2 间切换，再执行 Tick。

| 单帧场景 | P50（ms） | P95（ms） | P99（ms） |
| --- | ---: | ---: | ---: |
| 默认内容 · `TickSystem.tick()`，使用实际运行时接线 | 0.0114 | 0.0160 | 0.0463 |
| 默认内容 · `GameInstance.tick()` | 0.0118 | 0.0158 | 0.0459 |
| 默认内容 · 当前世界线 12 个已拥有据点 | 0.0164 | 0.0212 | 0.0581 |
| 新增 32 个固定产出据点 | 0.0237 | 0.0313 | 0.0774 |
| 新增 128 个固定产出据点 | 0.0621 | 0.1020 | 0.1764 |
| 新增 512 个固定产出据点 | 0.2973 | 0.5017 | 0.6534 |
| 新增 32 个依赖型据点 · 写入加 Tick | 0.0273 | 0.0377 | 0.0865 |
| 新增 128 个依赖型据点 · 写入加 Tick | 0.0786 | 0.1501 | 0.2372 |
| 新增 512 个依赖型据点 · 写入加 Tick | 0.3424 | 0.5349 | 0.6904 |

`TickSystem.tick()` 仍通过同一套状态写入口同步派发事件，表中两条默认路径的差值受测量波动影响。512 个依赖型据点样本的单次最大值为 5.27 ms。自动会话的调度间隔为一秒，表格测量同步计算部分。 [TickSystem](../../src/engine/system/tick-system.ts#L39) · [GameInstance](../../src/arona-clicker/runtime/runtime-game-instance.ts#L1930) · [EventBus](../../src/engine/core/event-bus.ts#L49)

| 离线场景 | 实际推进帧数 | P50（ms） | 最大（ms） |
| --- | ---: | ---: | ---: |
| 默认内容 · 30 分钟 | 1,800 | 27.7 | 40.7 |
| 默认内容 · 8 小时 | 28,800 | 407.4 | 474.4 |
| 新增 128 个固定产出据点 · 8 小时 | 28,800 | 2,094.1 | 2,307.1 |
| 默认内容 · 8 小时，所有初始据点等级置零 | 1 | 0.053 | 0.188 |

以恢复存档使用的 `SessionService.setLastTick()` 设置时间基准，测量 `game.start()` 的同步耗时。补算会逐帧走正常结算与事件响应，首帧产出为空时退出。读档 I/O 和数据解码在计时范围之外。 [离线循环](../../src/engine/runtime/session-service.ts#L79) · [恢复时间基准](../../src/arona-clicker/runtime/runtime-save.ts#L81)

## GameNum 缓存、重建与 CPU 热点

| 新增固定产出据点 | 命中缓存的信用点查询 P50（μs） | `buildAll()` P50（ms） | `buildAll()` P95（ms） |
| ---: | ---: | ---: | ---: |
| 32 | 0.012 | 1.23 | 1.50 |
| 128 | 0.014 | 3.47 | 4.21 |
| 512 | 0.013 | 24.92 | 29.90 |

**固定产出在入账后也会失效。** 在默认与三组固定产出场景中，信用点 gain 和 flow 的资源依赖集合均为空。先查询使根节点变干净，再单独调用 `changeResource(credit, 1)`，四组根节点均由干净变为脏。原因是 `onResourceChanged()` 会按产出资源直接标脏该资源的全部 flow 节点，再沿父链接传播。另一次调用计数确认，这四组各有一次单帧空 flow 桶回退，来自 `evaluateAffectorFlowsNode()`。回退会复制活跃实例列表并逐项检查作用域。 [资源变化失效](../../src/engine/expression/game-num.ts#L158) · [标脏传播](../../src/engine/expression/game-num-tag.ts#L252) · [flow 求值](../../src/engine/expression/game-num-eval.ts#L258)

**CPU 热点随负载变化。** 默认 Tick 中，`InformationRevealAdapter.handleAction()` 的含子调用样本占 38.4%。该路径在资源事件唤醒后重新读取观察规则并比较序列化后的描述。512 个依赖型据点样本中，`evaluateResourceGain()` 占 52.8%，`markDirty()` 占 21.3%，`flowBucketKey()` 占 10.1%。这几项存在调用包含关系，比例用于定位热点。 [揭示动作](../../src/arona-clicker/services/world/information-reveal-adapter.ts#L183) · [规则查询](../../src/arona-clicker/services/world/information-reveal-domain.ts#L161) · [flow 桶键](../../src/engine/expression/game-num-eval.ts#L285)

## Trigger、Effect 与可见性

| 隔离场景 | P50（μs/次） | P95（μs/次） |
| --- | ---: | ---: |
| Trigger · 空桶 | 0.033 | 0.044 |
| Trigger · 同类 32 条 | 3.72 | 5.22 |
| Trigger · 同类 128 条 | 13.33 | 14.68 |
| Trigger · 同类 512 条 | 60.86 | 79.36 |
| Trigger · 同类 2,048 条 | 286.35 | 305.67 |
| Trigger · 异类 2,048 条 | 0.031 | 0.031 |
| 可见性 · 2,048 个据点，0 个受影响 | 0.083 | 0.316 |
| 可见性 · 2,048 个据点，1 个受影响 | 0.377 | 0.841 |
| 可见性 · 2,048 个据点，512 个受影响 | 120.86 | 128.62 |
| 可见性 · 2,048 个据点全部受影响 | 531.23 | 552.82 |
| 可见性 · 2,048 个据点全量重算 | 342.46 | 392.86 |

- **Trigger** 按事件类型分桶。同类场景中只有一条资源规则命中。它执行一次 `addResource`，再发出一条同类型、无匹配规则的资源事件。一次计时包含两轮候选扫描。2,048 条规则的 CPU 采样中，`processType()` 自身占 55.3%，构造候选快照的回调占 30.5%。二者集中在逐条复制和检查候选。异类规则使用 Tick 事件，测量仍发送资源事件。 [分桶与候选快照](../../src/engine/effect/trigger-system.ts#L272) · [资源写入](../../src/arona-clicker/state/state-mutation-service.ts#L294)
- **Visibility** 每个据点有一条资源门槛。增量计时含派发资源变更、标脏和读取快照，只有命中同一资源依赖的据点重算。一个门槛命中时成本很低。2,048 个门槛一起命中时，增量路径的中位耗时为全量重算的约 1.55 倍。 [依赖索引](../../src/engine/visibility/visibility-index.ts#L52) · [增量与全量求值](../../src/engine/visibility/visibility-engine.ts#L48)

## 后续性能工作的依据

1. **离线补算**直接影响进会话的等待。评估分段执行时，用相同存档比对资源、统计、事件顺序和一次性 Trigger 的结果。上线前用实际浏览器复测主线程占用。
2. **GameNum** 优先验证固定 flow 是否可以保留缓存，以及已构建索引中的空桶能否直接返回零。回归重点是读取资源表达式的 flow、Affector 挂卸和存档恢复。
3. **Trigger 和可见性**的高负载结果适用于大型 Mod 的容量评估。扩展样本时分别改变同类规则数和单次资源事件影响的门槛数。

## 测量环境与复跑

- Windows x64 10.0.26200、Intel Core i7-14650HX、Node 26.7.0、V8 14.6.202.34。使用 `fabdaf57` 的工作区。测量时工作区另有剧情编辑相关改动，测量没有改动引擎、运行时接线和 Base Datapack。
- 单帧各预热 2,400 帧并采 12,400 次。离线每组新建会话 13 次，丢弃首次后取 12 次。其余微基准各预热 3 批并采 31 批，先算每批平均每次耗时，再取百分位。CPU 采样是独立运行，实际每组约 1.75–1.82 秒。单次耗时受 JIT、GC 和系统调度影响。
- 保留运行时默认 `DevLog`，静音运行时全局 `console.debug`，避免 Node 控制台格式化与输出混入引擎计时。浏览器中的控制台成本、DOM 帧耗时、长时间内存、真实玩家存档与低配设备仍待测量。 [日志接线](../../src/arona-clicker/runtime/runtime-wiring.ts#L411)
- 行为校验通过 35 个测试文件、404 项测试。命令为 `npm test -- tests/engine/core tests/engine/world/visibility-hot-spot.test.ts tests/engine/world/reveal.test.ts`。

本地测量脚本、原始样本、CPU 采样和诊断计数存于 `.test-artifacts/engine-perf/`。从仓库根目录运行以下命令可生成 `results.json` 和三份 `.cpuprofile`。运行时避免同时执行测试或构建。

```powershell
node_modules/.bin/esbuild.cmd .test-artifacts/engine-perf/benchmark.ts --bundle --platform=node --format=esm --packages=external --loader:.png=dataurl --loader:.svg=dataurl --sourcemap --outfile=.test-artifacts/engine-perf/benchmark.mjs
node .test-artifacts/engine-perf/benchmark.mjs --profile
node --enable-source-maps .test-artifacts/engine-perf/benchmark.mjs --diagnose
```
