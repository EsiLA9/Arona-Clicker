# Draft：Story Trigger 独立目录与作用域挂载

状态：draft — 🟡 方案草案，尚未开工

## 目标

将由 PassiveStory / StoryEntry 发起的区域、资源、剧情完成等后续联动，从 Init 自有 `triggers` 中拆出，改为独立存放的 `TriggerDef`，由 StoryEntry 仅持有 Trigger ID 索引。

本方案要解决：

- Trigger 的声明主体应保持在产生该行为的 StoryEntry，而不是被动归属 Init；
- TriggerDef 的静态数据与运行时监听实例分离；
- 只有当前有效作用域需要的 Trigger 才进入运行时事件桶；
- 超级图鉴可以追溯「StoryEntry → TriggerDef → 条件 / 效果」的来源链；
- 不因反向引用数量增长而把详情字段或 DOM 变成巨型列表。

## 设计边界

- 本草案只处理 StoryEntry 关联 Trigger 的声明、解析、挂载和查询，不重写 TriggerSystem 的事件判断语义。
- `StoryDef` 继续只负责剧情正文；由 StoryEntry 顶层 `triggerEffects` 声明延迟联动，不把区域后续规则塞入 StoryDef 或 Talklet。
- `TriggerDef` 仍使用现有 `on + condition + effects + once` DSL；不新增面向单个角色的特殊事件类型。
- 全局 Trigger 与作用域 Trigger 必须保持明确区别：全局 Trigger 可以继续在数据包加载时挂载，StoryEntry Trigger 不得默认全局生效。
- 不做高频事件因果记录，不新增玩家历史账本；`triggersCompleted` 继续只记录一次性 Trigger 的完成事实。
- 不引入 Manager 语义；已移除的 Spot Manager 不得通过新索引或 Codex 重新出现。

## 当前事实与代码落点

### 当前 Trigger 运行方式

- `TriggerSystem` 统一订阅支持的事件类型，再按事件类型分桶，只检查已挂载且属于该事件桶的 Trigger；并不是每个 Trigger 创建一个 EventBus 监听器。
- `Datapack.triggerDefs` 当前由 `RuntimeGameInstance.init()` 直接调用 `triggerSystem.load()`，加载后立即作为全局 Trigger 生效。
- `InitDef.triggers` 当前由 `InitService` / `init-mount.ts` 按 `init:<initId>` 分组挂载，离开 Init 时卸载。
- `TriggerSystem` 已支持 `mount`、`unmount`、`mountGroup` 生命周期、once 完成记录和事件桶。

### 当前案例

`base:trigger:hoshino_rooftop_story` 目前声明在 `base:init:schale_office` 的 `triggers` 中，但语义上是：

```text
base:passivestory:hoshino_conv_2
  → 完成 base:story:hoshino_rooftop_hint
  → 进入 base:area:schale_rooftop
  → 触发 base:activestory:hoshino_rooftop_meet
```

相关代码：

- `src/engine/types/trigger.ts`
- `src/engine/effect/trigger-system.ts`
- `src/arona-clicker/services/init-mount.ts`
- `src/data-services/contracts/story-entry.ts`
- `src/arona-clicker/content/inits.ts`
- `src/arona-clicker/content/story-conversation-walls.ts`

## 目标数据布局

### Entry 顶层声明，Binding 运行时派生

不把 Binding 做成数据包实体。数据包只声明 StoryEntry 顶层的延迟事件效果，游戏引擎在加载 Registry 后派生内部 Binding 和 MountedTrigger。

```text
StoryEntryDef 顶层声明
  → StoryEntryEffectCompiler
  → Derived StoryTriggerBinding（内存）
  → MountedTrigger（运行时）
```

建议扩展 `StoryEntryBase`：

```ts
interface StoryEntryTriggerEffect {
  on: TriggerEventDef;
  condition?: Condition | ConditionGroup;
  effects: Effect[];
  once?: boolean;
}

interface StoryEntryBase {
  triggerEffects?: StoryEntryTriggerEffect[];
}
```

示意：

```json
{
  "id": "base:passivestory:hoshino_conv_2",
  "storyId": "base:story:hoshino_rooftop_hint",
  "owner": "Hoshino",
  "availableInits": ["base:init:schale_office"],
  "triggerEffects": [
    {
      "on": { "kind": "area", "areaId": "base:area:schale_rooftop" },
      "condition": {
        "type": "AND",
        "conditions": [
          { "target": "hasReadStory", "key": "base:story:hoshino_rooftop_hint", "comparator": "==", "value": 1 }
        ]
      },
      "effects": [
        { "op": "triggerStory", "target": "base:activestory:hoshino_rooftop_meet", "value": 0 }
      ],
      "once": true
    }
  ]
}
```

这不是 Talklet 内的效果。它是 StoryEntry 自身的声明数据，便于引擎和超级图鉴直接读取；DSL 只负责构建同一份 JSON 形状。

### TriggerDef 独立存放

Trigger 继续进入数据包的独立 `triggerDefs` 表：

```ts
{
  id: 'base:trigger:hoshino_rooftop_story',
  on: { kind: 'area', areaId: 'base:area:schale_rooftop' },
  condition: and(cond('hasReadStory', 'base:story:hoshino_rooftop_hint', '==', 1)),
  effects: [{
    op: 'triggerStory',
    target: 'base:activestory:hoshino_rooftop_meet',
    value: 0,
  }],
  once: true,
}
```

`completionReward` / `enterEffects` 等已有 Entry 顶层效果仍表达即时效果；`triggerEffects` 专门表达「等待事件后再执行」的效果。不能仅通过遍历普通 `effects` 推断等待事件，因为普通 Effect 没有 `on` 事件来源。

## 运行时方案

### 静态注册与运行时挂载分离

新增或扩展一个 Trigger 目录 / 查询入口，使数据包加载阶段只完成：

```text
Datapack.triggerDefs → TriggerCatalog / Registry
```

而不是立即将所有 Story 专属 Trigger 放进运行时事件桶。

运行时由 `StoryTriggerMountService` 完成：

```text
当前 Init
  → 找到可用 StoryEntry
  → 读取 Entry 顶层 triggerEffects
  → 编译为派生 TriggerDef
  → 按 StoryEntry 作用域 mount
```

建议挂载组命名为：

```text
story-entry:<entryId>
```

例如：

```text
story-entry:base:passivestory:hoshino_conv_2
```

### 生命周期

- 进入 Init：挂载当前 Init 可用的 StoryEntry Trigger；
- 离开 Init：卸载对应 StoryEntry 作用域；
- 读档：先恢复 PlayerState，再按当前 Init 重建挂载；
- 数据包热更新：只重建受影响的 Trigger 目录和对应作用域；
- StoryEntry 尚未完成时也可以挂载 Trigger，由 `condition` 阻止过早触发；
- 不能只在 Story 完成后才挂载，否则可能错过已发生的区域事件；
- `once` 仍由 TriggerSystem 维护，并继续使用 `triggersCompleted`。

### 全局 Trigger 的兼容边界

现有全局 `triggerDefs` 不能全部改成延迟挂载。应明确区分：

| 类型 | 来源 | 挂载时机 |
| --- | --- | --- |
| 全局 Trigger | 独立 `triggerDefs`，无 StoryEntry 归属 | 数据包加载后直接挂载 |
| Init Trigger | `InitDef.triggers` | 当前 Init 进入时挂载 |
| StoryEntry Trigger | StoryEntry 顶层 `triggerEffects` | 当前 Init 中发现该 Entry 可用时编译并挂载 |

如需让独立 `triggerDefs` 同时承载三类规则，必须在注册阶段保留作用域信息，不能依靠运行时猜测。

## 事件与性能边界

- EventBus 仍由 TriggerSystem 统一订阅事件类型，不为每个 Trigger 创建单独监听器。
- 未挂载的 StoryEntry Trigger 不进入事件桶，不参与事件匹配和条件求值。
- 已挂载 Trigger 按事件类型分桶，`areaEntered` 只检查区域事件桶，不扫描全部 Trigger。
- 同一 StoryEntry 的结构化 `triggerEffects` 在编译时按稳定派生 ID 去重。
- 同一 Trigger ID 不允许在同一作用域重复挂载；冲突应进入诊断，不静默追加副本。
- 不为每次事件创建 Trigger 对象；挂载对象使用稳定的 `MountedTrigger` 与作用域索引。

## 超级图鉴投影

超级图鉴应显示：

```text
来源：星野对话空间
关系：持有 Trigger
目标：base:trigger:hoshino_rooftop_story
状态：已挂载 / 未挂载 / 缺失
```

打开 Trigger 后再显示：

```text
监听：进入夏莱天台
条件：已完成故事「星野的天台邀约」
效果：触发剧情「天台的相遇」
```

来源关系应区分：

- `PassiveStoryEntry → triggerEffects → Derived TriggerDef`：已声明来源；
- `TriggerDef → StoryDef / ActiveStoryEntry / Area`：规则引用；
- `TriggerDef → 当前运行时`：当前是否挂载。

不把完整 Trigger 内容复制到 StoryEntry 详情，也不把所有反向引用平铺到当前实体概览。

### 反向引用数量上限

- 详情概览只显示有限数量的来源 StoryEntry；
- 同一来源实体的重复 Trigger 关系合并计数；
- 超出部分使用局部展开，不预先生成全部内容；
- 完整路径和重复引用继续放入关系页签；
- 默认语义摘要不超过现有的局部展示预算。

## DOM 刷新约束

此方案不允许因为 Trigger 挂载或查询结果变化而重建整个 Codex 或 Runtime Editor。

| 行为 | 允许刷新范围 |
| --- | --- |
| 切换自身 / 其他实体添加 | 仅语义摘要内容容器 |
| 展开一个 StoryEntry 来源 | 仅该来源组 |
| 展开 Trigger 详情 | 仅当前详情面板 |
| 挂载状态变化 | 仅当前 Trigger 状态标记或局部关系组 |
| 点击 Trigger / Story / Area | 切换当前 Codex 条目，不重建外层 Shell |
| 其他游戏事件 | 静态 Codex 不刷新，除非当前实体定义或挂载状态确实变化 |

## 施工切片

### P0：契约与来源模型

- 确定 `triggerEffects` 是否放在 `StoryEntryBase`，还是先限制在 `PassiveStoryEntry`；
- 确定派生 Trigger ID 的稳定算法与结构变更行为；
- 确定 `TriggerCatalog` 的归属位置和跨包 ID 校验方式；
- 定义全局、Init、StoryEntry 三种挂载作用域；
- 明确非法事件、非法效果、重复派生 ID 和跨包引用的诊断结果。

### P1：静态目录与挂载适配

- 增加 TriggerDef 按 ID 查询能力；
- 增加 StoryEntry 顶层效果的 Trigger 编译与按来源查询能力；
- 将静态注册与运行时 mount 拆开；
- 新增 StoryEntry Trigger 挂载服务；
- 接入 Init 进入、切换、读档和运行时内容重建；
- 保持现有全局 Trigger 与 Init Trigger 行为不变。

### P2：迁移天台案例

- 从 `base:init:schale_office.triggers` 移出 `base:trigger:hoshino_rooftop_story`；
- 将天台规则迁移到 `base:passivestory:hoshino_conv_2.triggerEffects`；
- 保持“完成邀约后进入天台才触发相遇”的行为；
- 验证未完成邀约、完成邀约后移动、一次性完成和读档恢复。

### P3：超级图鉴与静态反查

- 增加 StoryEntry → triggerEffects → Derived TriggerDef 的声明关系；
- 增加 TriggerDef → 条件 / 效果目标的规则关系；
- 显示当前挂载状态，不显示高频执行历史；
- 按来源实体聚合，限制默认数量，并使用局部展开。

## 测试与验收

- TriggerCatalog 能按 ID 解析独立 Trigger；
- 非法 `triggerEffects` 出现诊断，不导致运行时崩溃；
- 外部包可以通过扩展 / 合并规则追加 Entry 顶层效果，不需要扫描 Talklet；
- 当前 Init 只挂载其可用 StoryEntry 的 Trigger；
- 离开 Init 后对应 StoryEntry Trigger 不再响应事件；
- 未完成 `base:story:hoshino_rooftop_hint` 时进入天台不会触发相遇剧情；
- 完成邀约后再进入天台会触发 `base:activestory:hoshino_rooftop_meet`；
- once Trigger 不重复执行，读档后完成状态保留；
- 全局 Trigger 和 Init Trigger 回归测试不改变；
- Codex 能显示声明来源、Trigger 定义和目标实体；
- 反向引用超过预算时只显示聚合结果；
- 局部展开不重建 Codex Shell、顶部标题或无关页签；
- `npx tsc --noEmit`、`npm test`、`npm run check:architecture`、`npm run check:docs` 通过。

## 未决裁定

- `triggerEffects` 是否需要单独的内容策略与 Runtime Editor 类型；
- 独立 `triggerDefs` 是否继续只用于全局 / 可复用规则；
- 派生 Trigger 是否需要可见的稳定 ID，还是只保留来源路径；
- Story 完成后当前已经处于目标区域时，是否需要额外执行一次受控的状态复检；
- Runtime Editor 是否允许编辑 StoryEntry 的 Trigger ID 索引，还是第一阶段只读展示。

## 当前核验（2026-09-20）

- 已核对 `TriggerSystem` 的事件分桶、挂载 / 卸载和 once 持久化行为。
- 已核对 `Datapack.triggerDefs` 当前在加载时直接挂载的行为。
- 已核对 Init Trigger 当前由 `init-mount.ts` 按当前 Init 分组挂载。
- 已根据多数据包 JSON / DSL 与“Binding 由引擎派生”的要求，将独立关系表方案调整为 Entry 顶层 `triggerEffects` → 运行时派生 Binding 方案。
- 尚未修改代码，尚未执行本草案对应的迁移测试。

## 剩余工作

- 完成 P0 的归属和契约裁定；
- 另立实施任务后再修改 `PassiveStoryEntry`、Trigger 目录和挂载服务；
- 不在本草案阶段直接迁移现有天台 Trigger。

## 相关路由

- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/03-data-structures/declarative-dsl]]
- [[task-0133-runtime-editor-codex-reference-trace-and-unified-rendering]]
- [[task-0135-runtime-editor-semantic-summary-readable-projection]]
