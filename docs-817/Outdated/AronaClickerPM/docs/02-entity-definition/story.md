# Story（故事载体）

## 概念

Story 是单纯的演出载体，**不感知任何游戏外部状态**。它只负责存储：
- 顺序执行的 Talklet 序列
- Talklet 可附带标号（0/1/2/3...），控制哪些 Talklet 在本次演出中出现
- ContextFlag 定义：Talklet 执行过程中可设置的语境旗，贯穿整个语境生命周期

Story 不定义任何奖励、不关心游戏资源、不做外部副作用的承诺。外部的触发条件、语境退出时的统一行为等由 StoryEntry（ActiveStoryEntry / PassiveStoryEntry）负责。

## 语境（Context）

当玩家通过 ActiveStoryEntry 或 PassiveStoryEntry 进入 Story 时，引擎创建一个**语境（Context）**：

- 语境以 ActiveStoryEntry / PassiveStoryEntry 为入口，贯穿整个演出过程
- 语境只在以下两种情况结束：
  1. Story 被阅读到末尾（Talklet 序列结束）
  2. Story 内的 Talklet 通过 StoryAction 触发 `exit_context` 或 `end_story`
- 语境结束时，引擎将累积的**标号集**和**ContextFlag集**传递给语境定义的行为集（ContextBehavior）统一评估
- 语境存活期间，Talklet 可设置 ContextFlag，影响后续 Talklet 的演出和语境结束时的行为分配

## Talklet 类型

```
Talklet:
  - id: string
  - label: number            # 标号（0=主线必演，非0需要StoryInstance持有该标号才演）
  - type: "left_dialogue" | "right_dialogue" | "center_desc"
        | "classic_text" | "bottom_button" | "logic_judgment" | "logic_choice"

  # 通用字段
  - autoAdvanceSeconds?: number   # 自动推进的秒数（null=等待玩家操作）
  - onPlay?: StoryAction          # 演出该Talklet时触发的行为

  # 类型特有字段：

  # left_dialogue: 左对话（带头像+名称）
  | { speaker: string, avatar: string, text: string }

  # right_dialogue: 右对话（带名称，无头像）
  | { speaker: string, text: string }

  # center_desc: 中间描写（无头像无名称）
  | { text: string }

  # classic_text: 左起经典文本框（小说式）
  | { text: string }

  # bottom_button: 下部按钮设定（若整个Story无此类型，聊天按钮默认无文本）
  | { buttonText: string, action: StoryAction }

  # logic_judgment: 逻辑判断 → 行为器（条件满足时触发行为，不满足则无事发生）
  | { condition: Condition, onTrue: StoryAction }

  # logic_choice: 逻辑选择 → 行为器（类似选择框，条件满足才提供该选项）
  | { choices: TalkletChoice[] }
```

## StoryAction（流程控制）

StoryAction 负责语境内的流程控制和状态修改。

```
StoryAction:
  - type: "add_label" | "remove_label" | "set_context_flag"
        | "exit_context" | "jump_story" | "end_story"
  - data?: {
      label?: number                    # add_label/remove_label 的标号
      flagKey?: string                  # set_context_flag 的目标 key
      flagValue?: any                   # set_context_flag 的目标 value（number/string/boolean）
      storyId?: string                  # jump_story 的目标Story FullKey
      targetLabel?: number              # jump_story 是否从目标Story的指定标号开始
    }
  - funcList?: FuncList                 # 附带的状态修改（→ [Value & Condition](../01-foundation/value-condition.md) FuncList）
```

### 类型说明

| type | 作用 | 语境是否结束 |
|---|---|---|
| `add_label` | 向当前语境累积标号 | 否 |
| `remove_label` | 从当前语境移除标号（通常用于"已使用"） | 否 |
| `set_context_flag` | 设置一个 ContextFlag 的值 | 否 |
| `exit_context` | 显式跳出当前语境 | **是** |
| `jump_story` | 跳转到另一段 Story（语境持续存活） | 否 |
| `end_story` | 结束当前 Story（语境内单 Story 时 ≡ exit_context） | 视情况 |

注：
- `exit_context` 和 `end_story` 都会触发 [ContextBehavior](story-entry.md) 评估
- `jump_story` 不结束语境，新的 StoryContext 继承 accumulatedFlags，但 accumulatedLabels 重置

## ContextFlagDef（语境旗定义）

数据包作者在 StoryDefinition 中声明该 Story 会用到的 ContextFlag。

```
ContextFlagDef:
  - key: string             # flag 标识符
  - defaultValue?: any      # 默认值（缺省 = null）
```

## TalkletChoice

```
TalkletChoice:
  - text: string
  - condition?: Condition           # → [Value & Condition](../01-foundation/value-condition.md)
  - isMajorBranch?: boolean         # 默认false
  - action: StoryAction
  - labelOnSelect?: number
```

## Story 定义

```
StoryDefinition:
  - id: string                   # FullKey: ModName/story/idName
  - name: string                 # 仅用于调试/编辑
  - flags?: ContextFlagDef[]     # ContextFlag 定义
  - talklets: Talklet[]
```

## Story 执行模型（语境生命周期）

```
StoryContext（运行时上下文，仅在语境存活期间存在）:
  - storyId: string
  - currentIndex: number               # 当前Talklet指针
  - accumulatedLabels: Set<number>     # 本次语境累积的标号
  - accumulatedFlags: Map<string, any> # 本次语境累积的 ContextFlag
  - isActive: boolean                  # 是否正在演出

语境生命周期：
  1. 玩家通过 ActiveStoryEntry / PassiveStoryEntry 进入
     → 引擎记录语境来源（ownerId）
     → 创建 StoryContext，accumulatedLabels / accumulatedFlags 初始化为空
     → isActive = true，开始演出

  2. 按 currentIndex 顺序遍历 Talklet:
     a. 若 talklet.label !== 0 且不在 context.accumulatedLabels 中 → 跳过
     b. 演出 Talklet（根据 type 渲染对应UI）
     c. 执行 onPlay StoryAction:
        - add_label / remove_label → 修改 accumulatedLabels
        - set_context_flag → 修改 accumulatedFlags
        - exit_context / end_story → 跳转到第4步（语境结束）
        - jump_story → 跳转到第3步（语境持续）
        - funcList → 修改 PlayerState
     d. 若 Talklet 是 logic_judgment，检查 condition → 满足则执行 StoryAction
     e. 若 Talklet 是 logic_choice，渲染可选选项（实时检查 condition）
     f. 若 Talklet 是 bottom_button，按钮文本变为 buttonText
     g. 若 currentIndex 到达末尾且无 StoryAction 干预 → 语境自然结束，跳转到第4步

  3. jump_story:
     → 终止当前 Story（保存 StoryContext）
     → 加载目标 StoryDefinition
     → 创建新的 StoryContext（accumulatedLabels 重置为空，accumulatedFlags 继承当前值）
     → isActive = true，回到第2步

  4. 语境结束（exit_context / end_story / 自然结束）:
     a. 将 accumulatedLabels + accumulatedFlags 作为输入
     b. 查找语境来源（ActiveStoryEntry / PassiveStoryEntry）的 ContextBehavior
     c. 评估 ContextBehavior.onContextEnd:
        - 执行 base FuncList（始终执行）
        - 遍历 branches，满足 condition 则叠加执行对应 effects
        - 若没有任何 branch 命中，执行 fallback FuncList
     d. StoryContext 销毁

  5. 语境后处理:
     → accumulatedLabels → 合并到 StoryInstance.accumulatedLabels
     → ContextFlag 随语境销毁（仅在运行中通过 PlaythroughRecord 存档，见 story-entry.md）
     → isActive = false
```

## Condition

Condition 不再在此处定义，统一使用 [Value & Condition 系统](value-condition.md) 中的 Condition 类型。

## 参见

- [StoryEntry](story-entry.md) — 包裹 Story 的 ActiveStoryEntry / PassiveStoryEntry（语境提供者）
- [Value & Condition](value-condition.md) — 统一数值与条件系统
- [Chat](chat.md) — Story 的 Talklet 在聊天框演出
- [Player](player.md) — StoryInstance 保存执行档案
