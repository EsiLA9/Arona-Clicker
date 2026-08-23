---
name: talklet-split-fix
overview: 修复自动展开剧情第一页（narration）不渲染的根因，并将 Talklet 彻底分离为「顶部演示（聊天流）」与「底部点击（推进按钮）」两部分：聊天历史由统一的页面同步器从 view.currentStory 读取，所有剧情入口一致收敛。
todos:
  - id: sync-current-story
    content: controller.ts 新增 syncCurrentStoryToChat 指纹同步，render 开头调用，appendStoryPages 精简为仅 finished 消息并更新 4 个调用点
    status: completed
  - id: streamline-render-current
    content: story.ts 精简 renderCurrentStory 仅渲染选项卡片，删除页体与 data-story-continue 分支
    status: completed
    dependencies:
      - sync-current-story
  - id: verify
    content: 运行 npm test 与 npx tsc --noEmit，启动 dev:game 手动验证开场 narration 与按钮分离效果
    status: completed
    dependencies:
      - sync-current-story
      - streamline-render-current
---

## 需求概述

对 Talklet 演出进行彻底分离：**顶部演示区（chat-stream 聊天流）**只承载演出内容（旁白 / NPC 气泡 / 玩家气泡 / 选项卡片），**底部点击区（send-button）**只承载推进交互（有预设回复文案时显示该文案、否则「点击」，无剧情时「继续聊天」，有选项时按钮让位）。

## 核心问题：narration 未渲染

`base:story:schale_welcome` 开场 `{ kind: 'narration', align: 'left', text: '—— 夏莱办公室 · 清晨 ——' }` 在 UI 中完全没有出现，根因有三层：

1. **自动展开丢结果**：`enterInit` 自动调用 `storyService.startStory(init.startStoryId, 'active')` 但丢弃返回值，首条 Talklet 从未交给 UI。
2. **聊天历史缺入口**：`controller.ts` 的 `appendStoryPages()` 仅在 4 个手动交互 handler 中调用（start-story / trigger-passive / data-send / data-story-choice），自动展开、读档恢复、Init 切换的当前页永远进不了聊天流。
3. **演出区条件过严**：`center-panel.ts` 仅当 `sendState.mode === 'choice'` 才渲染当前页，advance 模式（narration 无选项）下当前页既不在演出区也不在历史区，导致空白。

## 目标行为

- 进入世界线自动展开剧情时，开场旁白立即以全宽 narration（left/center/right 对齐）出现在聊天流顶部。
- 每次推进后新页实时贴底入流；选项页在页体下方渲染选项卡片；剧情结束时追加「剧情记录完成。」系统消息。
- 底部按钮：advance 且无 sendText → 「点击」；有 sendText → 显示该文案（点击后以「老师」右侧气泡入流）；idle → 「继续聊天」；choice → 按钮隐藏、选项卡片在顶部流。

## 技术栈

- 现有项目技术栈不变：TypeScript + 原生 DOM 字符串渲染（无前端框架），vitest 测试、tsc 类型检查。
- 全部改动集中在 UI 层 `src/ui/`，引擎逻辑零改动。

## 根因定位（已核实）

- `src/engine/game-instance.ts` ~538 行：`enterInit` 自动展开 `startStoryId`，返回值被丢弃。
- `src/ui/controller.ts` 330-346 行：`appendStoryPages()` 是剧情页唯一 push 来源，仅在 4 个手动 handler 调用；318-327 行 `pushChat()` 维护 `chatEntries` 与 `CHAT_MAX=200` 上限；157-169 行 `render()` 重建 DOM。
- `src/ui/components/center-panel.ts` 36 行：`current` 仅在 `mode==='choice'` 时渲染；37 行 launcher 仅无 story 时渲染。
- `src/ui/components/story.ts` 104-131 行：`renderCurrentStory` 渲染「页体 + reply 区（选项卡片或 `data-story-continue` 按钮）」，其中 `data-story-continue` 从未绑定事件（已核实无任何引用）。

## 实现方案：以「当前页同步」为核心的分离

### 1. `src/ui/controller.ts` — 当前页自动入流（核心修复）

- 新增字段 `private lastStoryFingerprint: string | null = null`。
- 新增私有方法 `syncCurrentStoryToChat()`：读取 `this.game.getView().currentStory`；为 null 时重置指纹并返回；否则以 `` `${story.storyId}:${story.pageIndex}` `` 为指纹，与 `lastStoryFingerprint` 相同则直接返回（防重复入流），不同则 `pushChat` 当前页（kind/speaker/text/storyType=story.type/align/avatar）并更新指纹。
- `render()` 开头（captureChatScroll 之前）调用 `syncCurrentStoryToChat()`，使每次 DOM 重建前当前页先入流。
- 精简 `appendStoryPages(result)`：删除页 push 与 `storyType` 参数，仅保留 `finished` 时 push `{ kind: 'system', text: '剧情记录完成。' }`；4 个调用点同步去掉 storyType 实参；`data-send` 的「老师」回复气泡 push 保留（在 render 的 sync 之前执行，保证顺序 = 玩家气泡 → 新页）。

**时序自洽性**（逐路径验证）：

- 自动展开：`enterInit` 启动剧情 → 首次 `render()` 的 sync 把开场旁白入流。
- 手动推进（send/choice）：交互 handler push 玩家回复或处理 finished → `render()` 的 sync 把新页入流。
- 读档 / resumeInit / 切 Init：恢复游标或重新自动展开后，首次 render 的 sync 把当前页入流。
- 剧情完成：`advanceStory` 结束后 `currentStory` 为 null → sync 重置指纹，最后一页已在上一轮入流，「剧情记录完成。」由 appendStoryPages 追加。
- 重复渲染（tick 事件 / tab 切换）：指纹相同，不重复 push，聊天流不膨胀。

### 2. `src/ui/components/story.ts` — 演出与交互解耦

- `renderCurrentStory(ctx, story)` 精简为：仅当 `page.choices?.length > 0` 时渲染 `renderReplyCard`（包在 `.chat-current` 内），无选项时返回空字符串；**删除页体渲染与 `data-story-continue` 按钮分支**（推进统一由底部 send-button 承担）。
- `renderNarration` / `renderTalk` / `renderChatHistory` / `renderReplyCard` 保持不变（本身已正确，被聊天历史复用）。

### 3. `src/ui/components/center-panel.ts` — 渲染条件确认

- `current` 保持 `story && sendState.mode === 'choice'`（演出区仅承载选项卡片）；`launcher` 保持无 story 时显示。此文件仅需更新注释，无逻辑改动。

### 4. 样式

- `.story-continue` CSS 可保留（与 `.story-actions button` 共用选择器，删分支后无元素匹配，不影响其他样式）或一并清理，二选一，倾向保留以降低改动面。

## 性能与可靠性

- 每次 `render()` 增加一次 `getView()` 调用 + 常量级字符串比较，开销可忽略；指纹去重保证聊天流不会因高频事件重复累积。
- 不动引擎（单一写入口 / 事件驱动 / 数据包声明式纪律不受影响）；不新增 UI 测试（聊天历史行为无既有测试覆盖，验证走 vitest + tsc + 手动 dev:game）。

## 目录结构

```
src/ui/
├── controller.ts            # [MODIFY] 新增 lastStoryFingerprint 字段与 syncCurrentStoryToChat()；render() 开头调用；
│                            #   appendStoryPages 精简为仅 finished system 消息；4 个调用点去 storyType 参数
└── components/
    ├── story.ts             # [MODIFY] renderCurrentStory 精简为仅渲染选项卡片，删除页体与 data-story-continue 分支
    └── center-panel.ts      # [MODIFY] 仅更新注释（渲染条件不变：current=choice 才渲染卡片）
```

## 关键代码结构

`syncCurrentStoryToChat` 是核心逻辑，签名与行为如下（实现要点）：

```ts
/** 每次 render 前把当前 Talklet 同步进聊天流（以 storyId:pageIndex 指纹去重）。 */
private syncCurrentStoryToChat(): void {
  const story = this.game.getView().currentStory;
  if (!story) { this.lastStoryFingerprint = null; return; }
  const fp = `${story.storyId}:${story.pageIndex}`;
  if (fp === this.lastStoryFingerprint) return;
  this.lastStoryFingerprint = fp;
  this.pushChat({
    kind: story.page.kind ?? 'talk',
    speaker: story.page.speaker,
    text: story.page.text,
    storyType: story.type,
    align: story.page.align,
    avatar: story.page.avatar,
  });
}
```