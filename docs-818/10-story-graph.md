# 10 — Story 跳转链 / 条件奖励 / 重阅读 / 分歧守卫

本文档描述 Story 图结构（goto / insert 跳转）、Entry 条件奖励、重阅读入口与分歧点准入守卫。
相关实现：[[src/engine/game/story-service.ts]]、[[src/engine/types/entities.ts]]。

---

## 1. 概念回顾

| 概念 | 说明 |
|------|------|
| Talklet | 剧情最小单元，无 id，包含一次演出 + 效果 + 可选跳转 |
| Story | Talklet 组合，有 id，表述一次流畅的演出；支持跨 Story 跳转 |
| StoryEntry | 玩家触发 Story 的入口，含触发条件 / 类型 / 奖励 / 重阅读 / 守卫等元数据 |

对外故事 id 恒为 **Entry.id**（`startActiveStory` / `hasReadStory` / `storyTriggered` 事件均引用它）。
演出进行中 `currentStoryEntryId` 保持不变；`currentStoryDefId` 记录当前实际播放的 Story.id（跳转链中可变）。

### 判定流程总览（演出 → 分支 → 奖励）

一次 Entry 演出 = **启动判定 → 逐页推进判定（演出 + 分支）→ 链完结奖励判定**：

1. **启动判定（演出入口）**：`startStory`（active / passive）校验 `type`、`availableInits`、
   `triggerCondition`、是否 `AlreadyCompleted`；`replayStory` 仅校验 `replayable` 并进入重阅读模式。
2. **逐页推进判定（演出 + 分支）**：`advanceStory` 每页先做**交互门控**（click / clickWork 未完成
   确认 → `ClickRequired`；choice 页 text 未确认 → 选项不渲染），再解析**分支目标**——选项级优先于
   Talklet 级 `jumpToStory`（goto / insert）；重阅读模式下跳转前受 `branchGuards` 准入守卫约束
   （拒绝 = `BranchGuardDenied`，页面不推进、效果不应用）。
3. **链完结判定（奖励）**：insert 栈空 + 当前 Story 无跳转 = Entry 链完结 → 按 `completionStrategy` 评估：
   - `simple`（缺省）：passive 的 `completionReward.first / repeat`（按 `storyLog` 区分首/复）；
   - `conditional`：按声明顺序评估 `conditionalRewards`，首个满足生效；
   - **重阅读（`isReplay`）跳过奖励评估与 storyLog 写入**（防刷，见 §3 / §4）。

---

## 2. 跳转链（goto / insert）

Talklet 与 StoryChoice 均可声明跳转：

```typescript
interface Talklet {
  // ...
  jumpToStory?: StoryId;   // 离开本页后跳转
  jumpMode?: 'goto' | 'insert';  // 缺省 'goto'
}
interface StoryChoice {
  // ...
  jumpToStory?: StoryId;   // 选择本选项后跳转（效果执行完毕后）
  jumpMode?: 'goto' | 'insert';
}
```

### goto（完全转移）

- 演出流转移到目标 Story，从 index 0 播放；**不返回**。
- 目标 Story 完结（无跳转）即 **Entry 链完结** → 评估完结奖励。
- 用于：把超长 Story 拆分为多个短 Story 串联演出，不影响上层 Entry 的元数据。

```
Entry (story:mission)
  └ Story: intro ──选项──▶ Story: assault ──Talklet──▶ Story: end ──完结──▶ 奖励
```

### insert（插入子剧情）

- 暂停当前 Story，播放目标 Story；**播完后返回当前 Story 的下一页**（原 pageIndex + 1）。
- 返回点保存在 `insertStack`（可嵌套，深度上限 32）。
- 若返回点超界（末页 insert），该 Story 视为已播完，继续弹栈或完结。
- 用于：主 Story 中插入一段子剧情（回忆 / 插曲 / 支线小任务）后无缝继续。

```
Story: main ──t1 insert──▶ Story: sub ──完结──▶ 返回 main t2 继续
```

### 深度限制

`MAX_JUMP_DEPTH = 32`：goto + insert 累计跳转次数，超出即 `JumpLimitExceeded` 并强制终止演出
（防御内容作者误写循环跳转，如 A→B→A→B）。

### 点击门控（click / clickWork + 离开本 Story）

**时序约定**：click / clickWork 页在**离开本 Story 之前**必须先经 `clickSend()` 完成点击确认。
"离开本 Story"包括三种路径，缺一不可：

1. **goto / insert 跳转**（页面自身声明 `jumpToStory`）
2. **insert 子剧情播完 → 弹栈返回**调用方（子剧情**末页**为 click 页时）
3. **goto 目标播完 → 链完结**（目标 Story **末页**为 click 页时）

未完成点击时 `advanceStory()` 返回 `ClickRequired`（既不跳转、不弹栈返回、不完结，也不做分支守卫判断），
保证"完成该 Talklet 的 click 之后才发生跳转 / 返回 / 完结"。

- 点击流程：多击任务填满（`done === total`）后按钮切换"完成"态，**再点一次**确认 →
  确认态标记 `done = total + 1`（内部），`advanceStory` 放行。
- `getSendState()` 对确认态 clamp 进度到 `total`（UI 显示填满 + "完成"按钮）。
- 普通 click 页（推进后仍在 Story 内，如长 Story 中段的 clickWork 页）保持原行为：
  `advanceStory` 可直接推进（兼容既有调用方与测试）。

```typescript
// story-service.ts（advanceStory 内）
const clickWorkDef = page.clickWork ?? (page.kind === 'click' ? { base: 1 } : undefined);
const willLeaveStory = !!jumpTarget || this.currentStoryPageIndex + 1 >= story.talklets.length;
if (willLeaveStory && choices.length === 0 && clickWorkDef
    && (!this.talkletClickWork || this.talkletClickWork.done <= this.talkletClickWork.total)) {
  return { success: false, storyId: story.id, error: 'ClickRequired' };
}
```

### choice 页 text 默认阻塞

**时序约定**：进入带 choices 的 Talklet 时，选项**默认被本页 text 阻塞**——玩家先看到文本
（聊天流）+ 底部"继续"按钮，点击确认后才渲染选项卡片。

- `getSendState()` 对 choice 页返回 `{ mode: 'choice', confirmed }`：
  - `confirmed = false`（刚进入 / 读档恢复）：UI 渲染文本 + "继续"按钮，不显示选项。
  - `confirmed = true`（点击确认后）：UI 渲染选项卡片（`[data-story-choice]` 驱动选择）。
- `clickSend()` 对未确认的 choice 页：标记确认后返回 `{ type: 'choice' }`（不推进剧情），
  已确认后再次点击同样保持 choice（不推进）。
- `advanceStory(choiceIndex)` 为程序化接口，不受 text 阻塞限制（脚本 / 测试直接选选项）。
- 确认状态为页面级瞬时状态：离开该页（推进 / 跳转 / 弹栈返回 / 读档）时重置为 `false`，
  不随存档持久化。

### 跳转链运行时状态（随存档持久化）

| StoryCursor 字段 | 说明 |
|------------------|------|
| `currentStoryId` | 当前 Entry.id（对外故事 id，链中不变） |
| `currentStoryDefId` | 当前实际播放的 Story.id |
| `insertStack` | insert 返回点栈 `{ storyId, pageIndex }[]` |
| `visitedStoryIds` | 本链已访问 Story.id（去重，含初始 Story） |
| `isReplay` | 是否重阅读模式 |

---

## 3. 条件奖励（conditionalRewards）

Entry 支持两种完结奖励策略（`completionStrategy`，缺省 `simple`）：

```typescript
interface StoryEntryBase {
  completionStrategy?: 'simple' | 'conditional';
  conditionalRewards?: ConditionalReward[];
}
interface ConditionalReward {
  condition: ConditionGroup;
  effects: Effect[];
}
```

- **simple**（缺省，兼容旧行为）：passive 闲聊的 `completionReward.first / repeat`。
- **conditional**：链完结时按声明顺序评估 `conditionalRewards`，**首个满足的生效**。

### 评估时机的可用上下文

链完结时（insert 栈空 + 当前 Story 无跳转）统一评估。此时以下状态全部就绪：

| 上下文 | 条件写法 |
|--------|----------|
| 跳转链中设置的 flag | `flag` 条件（如 `route == 1`） |
| 经过的 Story（含初始） | `visitedStoryInChain <storyId> == 1`（新条件目标） |
| 资源 / 物品 / 强化 | `resource` / `hasEnh` 等既有条件 |
| 统计 / Extra | `stat` / `extra` 条件 |

### 设计场景示例

1. **分歧结局奖励**：突击路线 +50 青辉石，谈判路线 +15（按 `visitedStoryInChain` 区分）。
2. **隐藏评价**：链中 `setExtra` 累计的计数器达标 → 高额奖励。
3. **保底**：最后一条写 `and()`（恒真）作为兜底包，保证任何结局都有奖励。

### 重阅读不发奖励

重阅读模式（`isReplay`）下链完结仅完成演出（供 UI 收尾），**不评估奖励、不写入 storyLog**，
防止玩家通过反复重阅读刷条件奖励。

---

## 4. 重阅读入口（replayStory）

```typescript
replayStory(storyId: string): StoryStartResult  // GameInstance 门面
```

- 仅 `entry.replayable = true` 的 Entry 可用，否则返回 `NotReplayable`。
- 与 `startStory` 的区别：
  - 不受 `triggerCondition` / `availableInits` / `AlreadyCompleted` 限制（重阅读是回顾历史）。
  - 进入 `isReplay` 模式：完整重播链（可选分支），阅读日志继续累积。
- 与正常演出一致：推进 / 选项 / clickWork / 跳转全部可用（逐页阻塞推进，不再向后吸收纯展示页）。

---

## 5. 分歧点准入守卫（branchGuards）

```typescript
interface BranchGuard {
  storyId: StoryId;   // 受保护的分支目标 Story.id
  prerequisites: { storyId: StoryId; talkletIndex: number }[];  // talkletIndex = -1 表示整条 Story 全读
  denialMessage: string;
}
```

- **触发时机**：重阅读模式下，`advanceStory` 解析出跳转目标（选项级或 Talklet 级）后、应用效果之前。
  若该页为 click / clickWork 页，则**先完成点击确认**（`ClickRequired` 门控）才进入守卫判断。
- 若目标 Story 命中某个 guard 且 `prerequisites` 未全部满足（`storyReadLogs` 中缺记录），
  返回 `BranchGuardDenied` + `denialMessage`，**页面不推进、效果不应用**（无副作用）。
- 玩家可改选其他分支（守卫拒绝不是死路）。

### 语义与设计意图

- 玩家首次走分支 B1，`storyReadLogs` 中只有 B1 的记录。
- 重阅读时想进入未读分支 B2 → 被拒（"没有真阅读后续 Story 时拒绝进入该分歧点"）。
- 玩家在任何一次演出中真正走完 B2 后，`storyReadLogs` 累积 B2 记录 → 后续重阅读放行。

### 守卫拒绝后的 UI 提示

`StoryAdvanceResult` 失败分支携带 `denialMessage`，UI 可直接展示为剧情提示气泡。

---

## 6. 存档兼容

新游标字段均为可选（`currentStoryDefId` / `insertStack` / `visitedStoryIds` / `isReplay`），
旧存档加载时缺省回退：
- `currentStoryDefId` 缺失 → 回退 Entry.storyId（无跳转的旧演出，等价行为）。
- 其余缺失 → 空栈 / 空列表 / false。

---

## 7. 测试覆盖

`[[tests/engine/story-jump.test.ts]]`（20 用例）：
1. Talklet 级 goto 串联（Entry.id 不变 / storyDefId 切换 / 链完结记录）
2. 选项级 goto 拓扑分歧
3. conditionalRewards 按 flag 评估
4. conditionalRewards 保底包（无命中时兜底）
5. visitedStoryInChain 条件奖励
6. insert 返回原地
7. 末页 insert 返回点超界收尾
8. click 页 + goto：未完成点击时 ClickRequired（不触发跳转）
9. clickWork 多击 + goto：填满后再确认一次才跳转
10. insert 子剧情末页 click：未点击不弹栈返回（不省略）
11. goto 目标末页 click：未点击不完结（不省略）
12. choice 页 text 默认阻塞：确认文本后选项才可见
13. millennium 演示全流程：click 阻塞逐句推进 + insert 子剧情 + choice text 阻塞
14. 循环跳转 → JumpLimitExceeded
15. 跳转链中存档 / 读档完整恢复
16. replayStory 基础 + NotReplayable
17. 分歧守卫拒绝 / 放行
18. 分歧守卫：先真读分支后重阅读放行
19. 重阅读不发奖励（防刷）
20. 重阅读走完链后阅读记录累积、再次通过守卫

辅助测试：
- `[[tests/engine/story-entry-split.test.ts]]`（6 用例）：三层拆分回归（Entry / Story / Talklet）、
  完成记录与阅读日志按 Story.id、旧档兼容。
- `[[tests/engine/game/story-helpers.test.ts]]`（6 用例）：`page-interaction`（isInteractivePage /
  shouldEchoReply / rollClickWorkTotal）与 `passive-picker`（eligiblePassiveStories / pickPassiveStory）纯函数。

演示数据：`[[src/data/base/stories.ts]]` 的 `base:story:millennium_game_crisis`（含 goto / insert / 条件奖励 / 守卫）。
