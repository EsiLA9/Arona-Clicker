# Talklet-主题 Lite 方案

状态：设计草案（2026-09-09）

> 本文是 `talklet-presentation-upgrade-draft.md` 的最小落地版本。它只定义 Talklet 临时主题覆盖所需的运行时语义，不确认 DSL 语法、字段嵌套方式或编辑器表现。

## 1. 目标

让 Talklet 能以最少配置临时改变界面主题，并在指定时期结束后自动恢复。Lite 不负责完整的布局编排、立绘舞台、一次性特效或交互锁，只提供主题覆盖的生命周期管理。

核心模型只有四项：

```text
生效 ID + 主题 + 生效时期 + 作用元件范围
```

## 2. 最小配置语义

### 2.0 运行时 Owner

作者侧仍只需要提供下面四项配置，但运行时必须为每条配置补充一个隐式 Owner：

```text
Owner + 生效 ID + 主题 + 生效时期 + 作用元件范围
```

Owner 是一次 `StoryEntry` 执行上下文的唯一运行时身份，而不是 `StoryDef`。`goto`、`insert`、`insert return` 只改变同一执行上下文中的流转，不改变 Owner，也不会自动清理临时主题。

因此，生效 ID 的唯一性限定在 Owner 内：不同 StoryEntry execution 可以同时拥有同名生效 ID，定向撤回只作用于当前 Owner 下的对应 ID。

### 2.1 生效 ID

生效 ID 是临时主题配置的稳定身份，用于：

- 更新同一组临时主题配置；
- 定向撤回该配置；
- 在 StoryEntry execution disposal 时统一收纳和清理；
- 避免重复播放时生成无法管理的匿名覆盖层。

对同一个 Owner 下的生效 ID 重复设定时，后一次设定完整重写前一次配置。它不是新增一层，也不与旧配置合并；如果需要部分保留，调用方必须在新配置中再次声明。重写会重新初始化全部运行时生命周期：秒数重新计时、步骤数恢复、Area 绑定重新解析。

### 2.2 主题

主题是已有主题系统可解析的主题引用或主题配置身份。Lite 只关心“使用哪一个主题”，不在这里重新定义主题内部的颜色、背景、Host 状态或 token 结构。

主题解析仍应遵守现有主题层级和只读 UI 约束；临时主题不得写入玩家持久化主题，也不得直接修改 Area 的持久化主题槽。

### 2.3 生效时期

Lite 支持四种生效时期：

| 生效时期 | 作用方式 | 自动结束条件 |
| --- | --- | --- |
| `fulltime` | 在所属 StoryEntry execution Owner 内作为持续背景层生效 | 生效 ID 被撤回、Owner 全部撤回或 execution disposal |
| `areatime` | 仅在指定 Area 的目标范围内持续生效 | 生效 ID 被撤回、离开指定 Area 或 execution disposal；离开后不自动恢复 |
| `seconds` | 从本次设定开始计时 | 达到指定秒数后自动撤回 |
| `step` | 按后续实际完成的 Talklet 计数 | 从设定后的下一次 Talklet completion 开始递减，达到指定数量后自动撤回 |

`step` 统计的是 Talklet 数量，而不是屏幕上可见的消息数量。设置主题的 Talklet 不消耗自己的 `step`；隐藏的配置 Talklet、仅用于推进演出逻辑的 Talklet 同样计入步数，以减少剧情逻辑中的额外条件判断。被 `goto` 跳过的 Talklet 不计数；`goto`、`insert` 和 `insert return` 不重置计数；Skip 不模拟剩余 Talklet，而是直接清理当前 StoryEntry execution Owner 的临时主题。

`seconds` 使用统一的运行时时钟计算经过时间。运行时应以到期时刻为依据，而不是把单个 `setTimeout` 作为唯一真相。

### 2.4 作用元件范围

作用元件范围表示主题覆盖哪些稳定的表现元件。它应引用语义化的 Presentation Host、主题节点或已登记的 UI 元件范围，不应依赖 CSS selector、DOM 路径或具体像素布局。

Lite 第一阶段可支持的范围原则：

- 全局背景或全屏表现层；
- 指定 Area 的背景层；
- 指定 Presentation Host；
- 对话、立绘舞台等已登记的语义元件。

如果范围为空，运行时应拒绝该配置或使用明确的默认范围，不能静默扩散为全局主题覆盖。

## 3. 生命周期规则

临时主题配置属于运行时表现状态，不进入玩家存档的持久化主题配置。

主题清理绑定的是 StoryEntry execution disposal，而不是只有“正常完成”这一种结束事件。正常完成、Skip、被替换、异常中断、Jump limit exceeded、目标不存在、强制 clear 以及需要终止该执行上下文的 Area 切换，都必须最终进入统一的 disposal 清理路径。

运行时至少需要支持以下操作语义：

| 操作 | 语义 |
| --- | --- |
| 设定 | 新建配置，或按当前 Owner 下的生效 ID重写已有配置 |
| 定向撤回 | 只撤回当前 Owner 下的指定生效 ID |
| Owner 全部撤回 | 清空当前 StoryEntry execution Owner 创建的全部临时主题 |
| Story execution disposal | 清理该执行上下文 Owner 创建的全部临时主题 |
| Area 切换清理 | 清理不再适用于当前 Area 的 `areatime` 配置 |
| 自动到期 | 清理已结束的 `seconds` 或 `step` 配置 |

清理必须是幂等的：同一个配置被定向撤回、自动到期和 execution disposal 重复触发时，不应产生异常，也不应影响其他 Owner 或其他生效 ID。

## 4. 覆盖与恢复

Lite 只允许主题覆盖影响自己声明的作用元件范围。基础主题、Area 默认主题和 Talklet Lite 临时主题应按稳定层级解析：

```text
Base < Area < Talklet Theme Lite
```

同层发生冲突时，运行时使用显式递增的 revision 作为裁定依据；不得依赖 Map 插入顺序或其他隐式对象顺序。父级范围和子级范围应分别按目标元件解析，更具体的语义目标可以覆盖更泛的目标。

恢复时应重新解析：

```text
基础主题
  + Area 默认主题
  + 仍有效的 Lite 临时主题
  → 当前只读表现结果
```

撤回某个生效 ID 后，只移除它声明的影响，其他临时主题和 Area 默认主题保持不变。运行时不得保存“被覆盖前的主题值”用于恢复，只能移除该层后重新解析所有剩余层。

## 5. 运行时接口需求

具体接口名称和参数封装方式暂不裁定，但运行时至少需要具备以下能力：

- 设定或重写一个生效 ID；
- 按生效 ID 撤回；
- 全部撤回；
- 绑定 StoryEntry 所有者；
- 绑定指定 Area；
- 按秒数计时；
- 按 Talklet 步骤递减；
- 在配置变化后通知 UI 重新解析表现结果。

建议内部记录至少包含：Owner、生效 ID、主题引用、生效时期、剩余秒数或步骤数、作用元件范围、所属 StoryEntry、适用 Area、到期时刻和 revision。状态变化应通过 Story execution disposal、Talklet completion、Area change 和统一 runtime clock 驱动，Lite 不需要理解 `goto`、`insert` 或 Story 图结构。

## 6. 与完整演出系统的关系

Lite 是完整 Presentation 系统的兼容子集：

- Lite 的“主题”未来可以扩展为 Theme Patch；
- Lite 的“作用元件范围”未来可以映射到 Presentation Host/Region；
- Lite 的 `seconds` 与 `step` 生命周期未来可以复用 Presentation Scope；
- Lite 的 `fulltime` 与 `areatime` 可以作为持续表现层的预设生命周期；
- Lite 不提前承诺完整系统的 DSL 写法。

因此，Lite 运行时应优先建立稳定的 ID、owner、scope、清理和恢复语义，避免先为尚未确认的 DSL 创建过多数据结构。

## 7. 验收重点

- 同一 Owner 下的生效 ID 重复设定后只存在一份配置，且生命周期重新初始化；
- `fulltime` 在所属 StoryEntry execution Owner 内持续到定向撤回、Owner 全部撤回或 execution disposal；
- `areatime` 不影响其他 Area，并在离开绑定 Area 后销毁且不自动恢复；
- `seconds` 到期自动恢复被覆盖的主题；
- `step` 从设置后的下一次 Talklet completion 开始按实际完成数量递减，隐藏 Talklet 也计数；
- `goto`、`insert`、`insert return` 不改变 Owner、不重置 step/time；
- 被 Jump 跳过的 Talklet 不计数，Skip 直接触发 Owner disposal；
- 撤回一个生效 ID 不会清除其他 Owner 或其他临时主题；
- 临时主题不会写入玩家持久化主题或 Area 持久化主题槽；
- 正常完成、Skip、Jump、异常中断、StoryEntry execution disposal 和 Area 切换都能完成清理；
- 清理触发顺序不同，最终 Presentation 结果一致；
- 所有主题恢复结果仍通过只读 UI 表现接口消费。

## 8. 暂不确定事项

以下内容不在 Lite 版本中提前确定：

- DSL 具体语法；
- 主题内部字段结构；
- 多个生效 ID 同时作用时的最终优先级表达方式；
- 作用元件范围的完整枚举；
- 是否允许一个配置同时作用多个 Area；
- 是否把 `fulltime` 统一命名为全局持续层或其他更贴近玩法的名称。
