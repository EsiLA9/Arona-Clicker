# 16 — 运行时内嵌数据包创作（Runtime-Hosted Datapack Authoring）

> **状态**：🔵 草案，待评审。本文只做行为策划与裁定点收集，不改变任何机制事实源，也不直接施工。
> **目标一句话**：把数据包编写工具从「独立的第二个 app」搬进**真实游戏运行时**，让「改数据 → 看效果 → 看逻辑」在同一个进程、同一套 UI、同一份 Registry 里闭环。
> **关联**：[[docs/plan-work/active/adr-0004-datapack-management]]（多包与命名空间权威）、[[docs/plan-work/active/roadmap-0001-datapack-management]]（切片状态）、[[docs/docs-828/05-conventions/schema-sync]]（Schema 同步协议）、[[docs/docs-828/07-audit/sync-burden]]（双载体问题）。

---

## §0 为什么必须放在运行时里

现有 `tools/datapack-editor/` 是一个 schema 驱动的独立编辑器，但它**不创建任何游戏运行时**：编辑的是 `datapack/AronaClickerCore/*.json` 的一份静态快照，看不到这条数据在游戏里长什么样、跑出什么结果。

因此「图形化易用」的瓶颈不是表单好不好用，而是**反馈回路断了**。放在运行时里的价值只有三条，策划全部围绕它们取舍：

1. **所见即所得**：改一个 Spot 的数值，右侧游戏面板立刻是新的；改一个主题，界面立刻变。
2. **逻辑可解释**：能展开「这个产出为什么是这个数」「这个条件为什么没通过」「这个实体为什么没解锁」。
3. **实体可拾取**：在游戏画面上点一个按钮/卡片/条目，直接跳到它对应的数据包定义。

---

## §1 现状盘点（策划所依据的事实）

| 面 | 现状 | 位置 |
| --- | --- | --- |
| 运行时装配 | `createAppRuntime()` → `AronaClickerRuntime` → `GameInstance`；全部子系统在 `wireGameInstance` 中 new 出来，装配函数可通过 `GameInstanceOptions.wiring` 整体替换 | `src/app/runtime-bootstrap.ts`、`src/arona-clicker/runtime.ts`、`runtime-game-instance.ts`、`runtime-wiring.ts` |
| Tick | 唯一驱动点是 `SessionService` 的定时器；只有 `start()/stop()`，**没有暂停、单步、倍速**；单帧能力 `GameCommands.tick()` 已存在 | `src/engine/runtime/session-service.ts`、`src/arona-clicker/runtime-commands.ts` |
| Lobby / Init | `activeInit === undefined` 即 Lobby；`init(datapacks, { enterDefaultInit })` 支持「只加载 Registry 不进世界线」；`reload()` 保留 Lobby 也保留当前 Init | `src/arona-clicker/services/init-service.ts`、`src/arona-clicker/types/state.ts` |
| 只读面 | `GameReadModel`（只读查询端口）与 `GameCommands`（写白名单）已分离；UI 组件层已遵守，controller 层仍持有具体运行时 | `src/arona-clicker/contracts/runtime.ts`、`src/ui/context.ts` |
| UI 骨架 | Host/Service/Workspace/Region 四层抽象 + 注册机制齐备；`datapack` 已注册为服务；路由是内存状态（`PanelState.service` / `WorkspaceState`），无 URL 路由 | `src/ui/ui-host-registry.ts`、`service-definitions.ts`、`components/app-shell.ts`、`update/ui-update-dispatcher.ts` |
| 数据包契约 | 顶层 `Datapack` 契约 + `Registry` 合并与校验 + `validateDatapack`（三段式 id / 悬空引用） | `src/data-services/contracts/datapack.ts`、`src/data-services/registry/` |
| 包管理 | `PackManager` 已实现包库、启用集、启停排序、modName 冲突拒绝、全量干跑校验后 `reload` 应用 | `src/data-services/datapack/pack-manager.ts` |
| 正式内容 | `defaultDatapack` 是**手写 TS 组合根**，由 `src/arona-clicker/content/` 下若干兄弟模块 + `def-factory` 构造 | `src/arona-clicker/content/default-datapack.ts` |
| JSON 分片 | `datapack/AronaClickerCore/*.json` 是**独立编辑器**的默认数据源，与 TS 内容层是两套载体（已知双源问题） | `datapack/AronaClickerCore/`、`tools/datapack-editor/ui/io.ts` |
| 现有编辑器 | schema 驱动三栏（类型 → 列表 → 详情），带撤销/重做、校验、导入导出；Schema 来自 `gen:schema` 生成的协议 + `editor-extras.ts` 手写兜底 | `tools/datapack-editor/` |
| 导入导出（游戏内） | 只有 zip 导入 + 日志导出，**没有数据包导出/写回能力** | `src/ui/import-export.ts` |
| 存档 | `PlayerState` 序列化在 `SaveSystem`；用户自定主题（`UserThemeDraft`、表现图层）目前落在存档里 | `src/arona-clicker/types/state.ts`、`src/arona-clicker/types/user-theme.ts`、`src/data-services/persistence/storage.ts` |

---

## §2 三大工作线

```
W1 运行时主机模式      实时游戏  ──▶  可驱动运行时（编辑态 / 预览态 / 游玩态）
W2 图形化数据包编写    tools 编辑器能力 ──▶ 游戏内 datapack 服务工作区（+ 拾取、+ 实时校验）
W3 数据转换            Registry / 存档 / TS 内容层  ⇄  可编辑数据包分片
```

三条线的**依赖关系**：W2 依赖 W1 提供「不自动跑的受控运行时」，W3 是 W2 的数据来源与出口。**W1 必须先落地一个最小可用版本**，否则 W2 的预览无从谈起。

---

## §3 工作线 W1：从「实时游戏」到「编辑器 + 逻辑展示工具」

### 3.1 核心裁定：运行时不再是「一直在跑的游戏」，而是「可被驱动的主机」

| 模式 | 语义 | Tick 行为 | 可写 PlayerState |
| --- | --- | --- | --- |
| **Author（编辑态）** | 只加载 Registry，不进世界线 | 不跑 | 否 |
| **Preview（预览态）** | 进入指定 Init 的**沙盒会话**，用于观察改动效果 | 受控：暂停 / 单步 / 连续 / 倍速 | 是（但落在沙盒，不污染正式存档） |
| **Play（游玩态）** | 与今天完全一致 | 自动 | 是 |

- 编辑态等价于今天的 **Lobby 加强版**：`init(datapacks, { enterDefaultInit: false })` 已具备所需形态，只需让 UI 能稳定停在这个状态并打开编辑器。
- 预览态与游玩态**必须是两个隔离的运行时实例或隔离的存档域**（见 §6 裁定 C）。

### 3.2 W1 行为清单

| 编号 | 行为 | 说明 |
| --- | --- | --- |
| W1-1 | 模式切换 | 顶栏或设置入口在 Author / Preview / Play 间切换，切换时按 ADR-0009 的固定转换顺序执行（stop → 快照 → 清运行时 → 恢复/播种 → 重建 → 激活） |
| W1-2 | Tick 控制条 | 暂停 / 单帧 / 连续 / 倍速 / 跳 N 帧；现有 `GameCommands.tick()` 可直接承接单帧 |
| W1-3 | 预览快照 | 保存「预览初始点」（指定 Init + 可选播种操作序列 + 已跑帧数），一键回到该点，保证改前改后可对比 |
| W1-4 | 改动应用 | 数据包草稿变更 → 经 `PackManager` 全量干跑校验 → `reload` → 从预览快照重放到同一帧 |
| W1-5 | 事件流 | 展示本帧产生的事件、Trigger 命中、Effect 应用结果（复用现有 devLog 数据，做成可筛选时间线） |
| W1-6 | 状态检视 | 检视当前生效的 Affector、可见性阶梯与未解锁原因、统计账本（只读投影，不新增状态） |

> **待核实**：是否存在统一的随机源与种子设定。若不存在，「回到同一帧」只能保证确定性逻辑一致，抽卡/随机会漂移，需要裁定是否接受或补种子能力。

---

## §4 工作线 W2：图形化数据包编写

### 4.1 核心裁定：Schema 驱动表单直接复用，新增的是「运行时侧能力」

现有 `tools/datapack-editor/` 的表单、校验、撤销/重做是**可迁移资产**，不应重写。真正缺的、也只有运行时能给的是下面四类能力。

### 4.2 W2 行为清单

| 编号 | 行为 | 说明 |
| --- | --- | --- |
| W2-1 | 实体浏览器 | 按表 → 实体列表（可按 mod / 名称 / id 过滤）→ 详情表单；承接现有三栏布局 |
| W2-2 | 字段编辑 | 按 Schema 渲染；简单字段自动映射，复杂结构（Effect / Condition / Funclet / Story 节点）走专用编辑器 |
| W2-3 | 引用导航 | 字段中的 id 引用可点击跳转、显示目标是否存在、列出「谁引用了我」 |
| W2-4 | 实时校验 | 增量校验（三段式 id、悬空引用、引用类型错配）并在列表/字段上就地标记，错误可点击定位 |
| W2-5 | 结构操作 | 新增/复制/删除实体、数组项上下移动、record 键重命名（含引用改写提示） |
| W2-6 | 撤销/重做 | 以「编辑会话」为作用域，跨字段、跨实体 |
| W2-7 | **运行时拾取** | 在预览/游玩画面上 hover 或点击元素 → 反查背后实体 id → 打开编辑条目（本方案最大差异化能力） |
| W2-8 | 图片资产管理 | 引用 PicDef 的字段提供资源选择与预览，跨包 `mod:path` 正确显示 |
| W2-9 | 视觉化编辑 | 条件树、效果序列、剧情分支用图形化节点编辑（承接 task-0035 条件展示树的方案） |
| W2-10 | 变更集视图 | 以「相对已启用包」的 diff 视角展示本次编辑（新增/修改/删除），作为保存与导出的单位 |

### 4.3 前置缺口（必须在 W2 前补齐）

1. **Schema 覆盖度**：复杂类型仍有若干类靠 `editor-extras.ts` 手写兜底甚至标记为手工类型；每次触碰某表按 schema-sync 注解化推进，目标「简单字段零兜底」。
2. **enum/引用候选**：下拉候选必须来自**当前运行时 Registry**（而非静态词表），否则跨包引用无法选到。
3. **id 命名空间化收尾**：Character / Variant 仍是裸名（ADR-0004 S1c），未完成前这两张表无法严格校验与图形化引用。

---

## §5 工作线 W3：游戏时数据 ⇄ 数据包数据

「转换」在本项目中实际存在**三个不同方向**，必须先裁定范围，否则会做成三个半成品。

| 编号 | 方向 | 内容 | 建议 |
| --- | --- | --- | --- |
| **T1** | 内容数据化 | 把 `src/arona-clicker/content/` 的手写 TS 内容，变成可编辑的数据包数据（消除 TS 与 JSON 双载体） | 高价值但高风险，**单独立项**，见 §5.1 |
| **T2** | 运行态导出 | 把运行时 Registry 中**当前生效**的组合结果，导出为分片 JSON / zip 数据包（含跨包合并后的解算结果） | **优先做**，它是编辑器的天然输入与输出 |
| **T3** | 存档资产导出 | 把游戏过程中产生的内容（用户自定主题、表现图层等）从存档导出为数据包分片 | 视需求，可作为 T2 的同一机制的特例 |

### 5.1 T1 的裁定点：单一真源选谁

- 现状：正式跑的是 TS 内容层；独立编辑器读的是 `datapack/*.json`；两者已长期并行（[[docs/docs-828/07-audit/sync-burden]] §4 记录了双载体问题）。
- **推荐裁定**：`datapack/` 重新定位为「可分发样例包」，**不再是正式内容的真源**；正式内容继续以内容层为准，导出为数据包的能力（T2）负责生成可分发产物。
- **替代方案**（更激进）：反向把 JSON 定为唯一真源、内容层改为加载器。这条会牵动全部 def-factory 与测试夹具，风险高，除非决心彻底数据驱动，否则不做。
- **无论选哪条，都必须先裁定**，因为它决定编辑器打开的是「内容层」还是「磁盘 JSON」。

### 5.2 T2 行为清单

| 编号 | 行为 | 说明 |
| --- | --- | --- |
| W3-1 | 导出分片 | 按表/按 mod 导出为若干 JSON 分片，目录结构与现有分片约定一致 |
| W3-2 | 导出 zip | 生成 manifest + 分片 + 图片资产的可导入包（复用现有打包思路） |
| W3-3 | 写回 | 编辑结果写回来源包（zip 走下载替换；文件夹来源走 File System Access API，需先落地 ADR-0004 S2 的 folder source） |
| W3-4 | 导入 | 已有 zip 导入，补齐文件夹与单文件导入 |
| W3-5 | 冲突与覆盖语义 | 导出时遇到跨包同名、继承展开值、派生值（如自动生成的默认差分）应如何处理：原样导出 / 展开为显式值 / 跳过，需要按表裁定 |
| W3-6 | 存档侧转数据包 | 用户自定主题等存档资产导出为 `ThemeDef` / 表现定义分片（T3） |

---

## §6 必须裁定的架构边界

| 编号 | 裁定点 | 选项与建议 |
| --- | --- | --- |
| **C1** | 编辑草稿存在哪里 | **建议**：草稿属于「编辑会话状态」，不进 `PlayerState`、不进存档（与主题编辑器的 draft 语义一致）；持久化走包库快照/显式保存。这样不触碰「单一写入口」纪律——草稿不是玩家状态变更 |
| **C2** | 改动如何生效 | **建议**：一律走 `PackManager` 启用集 + 全量干跑校验 + `reload`（all-or-nothing），与多包管理现有语义统一。**不引入** Registry 热插拔（会牵动 Affector / GameNum / 可见性的增量失效，风险高） |
| **C3** | 预览会话与正式存档 | **建议**：预览态使用独立存档域或独立运行时实例；进入/退出有明确边界，退出默认不落盘。需要一次专门裁定「预览产生的 PlayerState 归属」 |
| **C4** | UI 只读纪律 | 编辑器需要写能力，但**写的是数据包草稿而非玩家状态**；建议在契约层新增显式端口（如 `AuthoringCommands`），与 `GameCommands` 分列，避免 controller 直接持有运行时 |
| **C5** | 编辑器落点 | **建议**：作为 `datapack` 服务的 Workspace 接入现有四层骨架（服务已注册），复用 `workspace-frame` 与增量更新调度；不新建平行体系 |
| **C6** | 与独立编辑器的关系 | **建议**：`tools/datapack-editor/` 定位为「无运行时的轻量编辑/生成产物验证工具」或逐步下线；避免两套 UI 长期并存造成双源。需要明确裁定，否则 W2 会被两边拉扯 |
| **C7** | 存档迁移 | 纪律禁止写迁移代码；预览/编辑导致的会话失效一律重建，不做兼容 |

---

## §7 建议切片（粗粒度，评审后再细化）

| 阶段 | 内容 | 验收口径 |
| --- | --- | --- |
| **P0 受控运行时** | W1-1/2/5：模式切换 + Tick 控制条 + 事件流最小版 | 能停在编辑态；能单帧；能看本帧事件；`npm test` 与 `tsc` 通过 |
| **P1 会话闭环** | W3-1/4 + W1-4：能导出当前生效数据包、能导入、能把编辑结果 reload 回运行时 | 导出→导入→reload 后 Registry 等价 |
| **P2 编辑器迁入** | W2-1/2/3/4/6：在游戏内 datapack 服务工作区提供表浏览、字段编辑、引用导航、实时校验、撤销重做 | 覆盖高频表的完整增删改；校验错误可定位 |
| **P3 差异化能力** | W2-7 拾取 + W1-3 预览快照 + W1-6 状态检视 | 点画面元素能定位到定义；改前改后能回到同帧对比 |
| **P4 资产与复杂编辑** | W2-8/9/10 + W3-2/3/6 | 图片资产、条件/效果图形化、变更集、zip 打包与写回 |
| **P5 真源收口** | T1（依 §5.1 裁定） | 双载体消除或明确不动 |

---

## §8 开放问题（需在评审时逐条回答）

1. §5.1 单一真源选 TS 内容层还是 JSON 分片？
2. 是否需要「预览态独立存档域」，还是允许预览直接写正式存档后由玩家手动放弃？
3. 随机性是否必须可复现（决定 W1-3 预览快照的保真度与是否补种子能力）？
4. `tools/datapack-editor/` 保留、重构为共享内核、还是迁入后下线？
5. 编辑器是否需要 URL 深链（当前无路由），还是内存状态足够？
6. 图片资产编辑（上传/裁剪）是否纳入本次范围，还是只做引用选择？
7. 编辑权限是否需要对玩家开放（面向玩家的 mod 创作）还是仅开发/作者模式？

---

## §9 与既有计划的关系

- 强依赖：ADR-0004 的 **S1c**（Character/Variant 命名空间）、**S2**（folder / file source，写回能力的前提）、**S5**（惰性存档，影响预览会话残留语义）。
- 复用：task-0035 条件展示树方案、task-0048 主题编辑器的信息架构经验、task-0045 UI 增量更新与 Workspace 隔离。
- 不重叠：本文不重新裁定多包管理语义，一律以 ADR-0004 为准。
