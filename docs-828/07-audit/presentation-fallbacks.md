# 07-audit/presentation-fallbacks — 表现层回退链与 UI 防御密度

> 本文回答：**主题 / 头像 / 横幅等纯表现层为何走多层回退、UI 时序防御为何超配、怎么收敛。** 本文是 2026-08-30 审查快照，代码路径和落地状态需以当前源码复核。
> 与多 Datapack 前提的关系：第三方包内容缺图 / 缺主题是常态，「缺省占位」类回退应**保留**；要收敛的是**层数**与**防御密度**。用户已裁定项（如 typing/thinking 双旋钮）不列入。

## 问题清单

| # | 现象 | 位置 | 严重度 |
| --- | --- | --- | --- |
| 1 | 主题解析多链叠加（resolveTheme 三级 + 实体槽四级 + 层序自定义 + ephemeral 恒最高） | 见下 | 高 |
| 2 | CharaProfile 四层优先级（含「兜底 proto」层） | 见下 | 中 |
| 3 | 开幕横幅 6 跳中继 + CSS 负延迟续播补丁 | 见下 | 中（刚落地，观察） |
| 4 | pendingRewardChats 四重落账 | 见下 | 中 |
| 5 | 刷新双轨（每帧轻量 + 揭示指纹重建） | 见下 | 低 |

### 1. 主题解析多链叠加

- **位置**：`02-modules/color.md:14`（同一行两条链：`resolveTheme` 三级 + `entityThemeOverride` 四级）；`04-mechanisms/color-derivation.md:14,34-39,75`（层序自定义、四来源、再一条三级链）；`03-data-structures/player-state.md:39`；`declarative-dsl.md:172`（ephemeral 恒最高）。
- **原因**：「当前用什么配色」一个问题被拆成两条独立回退链，再叠玩家自定义层序与临时层恒最高——5 层以上优先级机制，需两篇文档共同描述。
- **方案组**：
  - **A（推荐）**：单解析器——一个纯函数 `resolveEffectiveTheme(entity) → tokens` 内部固定一条链（ephemeral > custom > design > equipment > 声明默认 > 派生 > 默认），`themeLayerOrder` 只影响场景层排序；文档收敛为 color-derivation 一处。
  - B：代码不动，仅文档收敛——把两条链的分工合并成一页对照表。

### 2. CharaProfile 四层优先级

- **位置**：`02-modules/pics.md:18`（兜底 proto → 声明表 active → 玩家 charaCustom → 调用点覆写）；`:25`（charaProfiles 表加载期强校验）。
- **原因**：四层中「兜底 proto」层为声明表缺项服务——而加载期已强校验，缺项本可在装载期禁止；多层解析为已校验数据再上保险。
- **方案组**：
  - **A（推荐）**：加载期校验「每个 character 必有 active profile」，删「兜底 proto」层（四层 → 三层）。
  - B：保留四层，schema 标注层序。缺图回退首字母占位**保留**（多包前提下的合理回退）。

### 3. 开幕横幅链路（2026-08-29 落地，列为观察项）

- **位置**：[[0x-plan&work/completed/affection-planning]] §3（三级标题回退、事件中继、CSS 负 `animation-delay` 断点续播）；`02-modules/ui.md`。
- **原因**：一条 3 秒横幅穿越 EffectEngine → 请求事件 → Reactor → Service → UI 订阅共 6 跳；负延迟续播是对「每 0.4-0.9s 全量 render 重建 DOM」的补丁——用防御性补丁修补自身架构选择的副作用。
- **方案组（长期，短期不动）**：
  - A：render 改增量更新（只重建变化节点）——续播补丁与 #5 的指纹重建一并消失。
  - B：维持全量 render，保留现状。

### 4. pendingRewardChats 四重落账

- **位置**：`02-modules/ui.md:58`（延迟 0.8s 落账 + 落账前校验演出彻底结束 + 未结束顺延重试 + 存档前立即落账防丢）。
- **原因**：「奖励提示别打断演出」一个时序偏好搭了四层保险；根因是「流空闲」没有统一信号，各处自建时序判定。
- **方案组**：
  - **A（推荐）**：定义统一的「流空闲」事件（游标清空后发一次），落账降为单订阅。
  - B：保留（当前行为正确，重构成本 > 收益）。

### 5. 刷新双轨

- **位置**：`02-modules/ui.md:56`、`03-data-structures/stats-views.md:31`（每帧 `refreshLight` 轻量数字；揭示指纹变化 → 重建 DOM）。
- **原因**：「何时重画」同时存在事件驱动（指纹比对）与每帧轮询两套方案并存。
- **方案组**：A 同 #3-A（增量 render 后轮询可删）。B 保留（轻量刷新成本可忽略，实现简单）。
