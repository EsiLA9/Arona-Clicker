---
kind: error_handling
name: 基于联合类型 Result 的错误处理体系
category: error_handling
scope:
    - '**'
source_files:
    - src/engine/types/results.ts
    - src/ui/components/errors.ts
    - src/ui/components/story.ts
    - src/ui/components/toast.ts
    - src/ui/controller-actions-story.ts
    - src/engine/game/story-flow.ts
    - src/engine/game/story-service.ts
---

## 1. 总体方案

该仓库采用 **无异常、纯函数式返回** 的错误处理方式：所有可能失败的业务操作（剧情启动/推进、区域移动、强化购买、物品使用、据点解锁/升级等）均返回一个 **discriminated union（联合类型）**，形如 `{ success: true; ... } | { success: false; error: 'SomeError' }`。错误码是字符串字面量联合类型，UI 层通过独立的 `Record<ErrorCode, string>` 映射表将错误码翻译为用户可读的中文文案。

核心设计原则：
- 引擎层不抛异常、不调用 `throw`，也不使用 `try/catch`；所有失败路径显式返回 `success: false` 的结果对象。
- 错误码集中定义在 `src/engine/types/results.ts`，作为跨模块契约。
- UI 层只消费结果对象，不做业务判断；错误展示统一通过 `ToastService`（`toast.ts`）或聊天流中的 system/reward 条目呈现。
- 调试日志通过 `devLog.record(...)` 记录失败原因，与用户可见文案解耦。

## 2. 关键文件与位置

| 文件 | 职责 |
|---|---|
| `src/engine/types/results.ts` | 定义全部业务操作的错误码联合类型与 Result 联合类型（`StoryError`、`TravelError`、`EnhancementPurchaseError`、`UseItemResult`、`SpotUnlockResult`、`SpotUpgradeResult`、`SendResult`、`StoryStartResult`、`StoryAdvanceResult` 等） |
| `src/ui/components/errors.ts` | 错误码 → 中文文案映射表（`enhPurchaseErrorText`、`travelErrorText`、`itemUseErrorText`、`spotUpgradeFeedback`） |
| `src/ui/components/story.ts` | 剧情错误码 → 中文文案映射表（`storyErrorText`） |
| `src/ui/components/toast.ts` | 全局 Toast 通知服务（`ToastService.show(text, 'success'|'error'|'info')`），用于非剧情类操作反馈 |
| `src/ui/controller-actions-story.ts` | 剧情操作入口：调用引擎后统一通过 `logStoryFailure` 记录失败并渲染 |
| `src/engine/game/story-flow.ts` | 剧情启动/推进主流程：所有校验分支返回 `StoryStartResult` / `StoryAdvanceResult` |
| `src/engine/game/story-service.ts` | 剧情服务编排层，对外暴露 `startActiveStory` / `replayStory` / `clickSend` 等门面 |

## 3. 架构与约定

### 3.1 错误码定义（engine 层契约）

所有错误码均为字符串字面量联合类型，集中在 `results.ts`：

- `StoryError`: `'NotFound' | 'AlreadyActive' | 'NoActiveStory' | 'ConditionNotMet' | 'WrongStoryType' | 'AlreadyCompleted' | 'NoAvailableStory' | 'ChoiceRequired' | 'InvalidChoice' | 'ChoiceConditionNotMet' | 'ClickRequired' | 'BranchGuardDenied' | 'JumpLimitExceeded' | 'NotReplayable'`
- `TravelError`: `'NotFound' | 'NotInThisInit' | 'NotAdjacent' | 'AlreadyThere' | 'Locked' | 'StoryBlocked'`
- `EnhancementPurchaseError`: `'NotFound' | 'NotVisible' | 'ConditionNotMet' | 'InsufficientResource' | 'AlreadyOwned'`
- `UseItemResult.error`: `'NotFound' | 'NotOwned' | 'NotUsable' | 'ConditionNotMet'`
- `SpotUnlockResult.error` / `SpotUpgradeResult.error`: 对应领域子集

每个操作返回的 Result 类型都遵循同一模式：成功分支含业务数据，失败分支含 `error` 字段（部分还带 `denialMessage` 等附加信息）。

### 3.2 引擎实现（无异常）

以 `story-flow.ts` 为例，所有校验分支直接 `return { success: false, storyId, error: '...' }`，没有任何 `throw`。例如：

```ts
if (!entry) return { success: false, storyId, error: 'NotFound' };
if (entry.type !== expectedType) return { success: false, storyId, error: 'WrongStoryType' };
```

这种风格贯穿整个 engine 目录，包括 `game/`、`system/`、`effect/`、`expression/` 等子模块。

### 3.3 UI 消费层（翻译 + 展示）

UI 控制器收到 Result 后：
1. 若 `success === false`，调用 `logStoryFailure` 写入 devLog（级别 `warning`，附带 `details: result.error`）。
2. 根据 `result.error` 查 `storyErrorText` 等映射表获取中文文案。
3. 通过 `ToastService.show('文案', 'error')` 弹出提示，或在聊天流中以 system/reward 条目形式显示。

`controller-actions-story.ts` 中统一的失败记录函数：

```ts
function logStoryFailure(ctrl: UIController, result: StoryStartResult | StoryAdvanceResult): void {
  if (result.success) return;
  ctrl.game.devLog.record(`剧情操作失败：${storyErrorText[result.error] ?? result.error}`, {
    source: 'story', level: 'warning', details: result.error,
  });
}
```

### 3.4 错误分类与展示策略

| 错误来源 | 错误码定义位置 | 文案映射位置 | 展示方式 |
|---|---|---|---|
| 剧情（启动/推进/重读） | `results.ts` 的 `StoryError` | `ui/components/story.ts` 的 `storyErrorText` | 聊天流 system 条目 + devLog |
| 区域移动 | `results.ts` 的 `TravelError` | `ui/components/errors.ts` 的 `travelErrorText` | toast 或聊天流 |
| 强化购买 | `results.ts` 的 `EnhancementPurchaseError` | `ui/components/errors.ts` 的 `enhPurchaseErrorText` | toast |
| 物品使用 | `results.ts` 的 `UseItemResult.error` | `ui/components/errors.ts` 的 `itemUseErrorText` | toast |
| 据点解锁/升级 | `results.ts` 的 `SpotUnlockResult.error` / `SpotUpgradeResult.error` | `ui/components/errors.ts` 的 `spotUpgradeFeedback` | toast |

## 4. 约束与约定

1. **禁止抛异常**：引擎层不使用 `throw`、`try/catch`、`Error()` 构造函数；所有失败必须通过 Result 联合类型返回。
2. **错误码集中管理**：新增业务错误时，先在 `results.ts` 扩展联合类型，再在对应 UI 组件的 `*ErrorText` 映射表中补充中文文案，否则 TypeScript 编译期会报错（未覆盖的 case）。
3. **UI 不持有业务逻辑**：控制器仅负责调用引擎、读取 `result.success` 和 `result.error`，不做二次判断。
4. **调试与用户文案分离**：`devLog.record` 记录原始错误码，用户可见文案来自映射表；两者可独立维护。
5. **Toast 限流**：`ToastService` 最多同时显示 4 条通知（`MAX_VISIBLE = 4`），超出则移除最旧的 toast，避免 UI 被淹没。
6. **剧情特殊语义**：`StoryAdvanceResult` 在 `BranchGuardDenied` 时额外携带 `denialMessage` 字段，供 UI 直接展示拒绝原因，无需查表。

## 5. 适用性说明

本仓库是一个前端游戏引擎 + UI 工程，错误处理完全基于 TypeScript 联合类型与返回值约定，没有后端中间件、HTTP 错误码或数据库异常的概念。因此该体系适用于本项目的客户端运行时错误传播与用户反馈场景。