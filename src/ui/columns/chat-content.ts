import type { UIContext } from '../runtime/context';
import { renderChatHistory, renderCurrentStory, renderChatTexts, type ChatEntry, type ChatTextEntry } from '../components/story/story';
import { FLOW_HOST_KEY_ATTRIBUTE, FLOW_STREAM_KEY_ATTRIBUTE } from '../flow/flow-entry';
import { renderOpeningBanner, renderStoryGate } from '../components/story/story-gate';
import type { SendState } from '../../arona-clicker/contracts/runtime/results';
import type { ActiveBanner, SendGatePhase, StoryGateState } from '../components/shared/app-shell';

/** 渲染一个聊天业务流的正文；容器位置和主题由装配方决定。 */
export function renderChatContent(
  ctx: UIContext,
  chatEntries: ChatEntry[],
  chatTexts: ChatTextEntry[],
  sendState: SendState,
  sendGate: SendGatePhase | null,
  storyGate: StoryGateState | null,
  openingBanner: ActiveBanner | null,
  readOnly = false,
  replayId?: string,
): string {
  const { game, view } = ctx;
  readOnly ||= !!replayId && game.story.getReplayPlaybackView(replayId)?.phase === 'idle';
  const story = replayId ? game.story.getReplayStoryView(replayId) : view.currentStory;
  const activeStory = [...game.registry.activeStories.values()][0];
  const activeCompleted = activeStory ? view.storyLog.some(item => item.storyId === activeStory.storyId) : false;

  const history = renderChatHistory(chatEntries, ctx);
  // choice 页：仅已确认文本（confirmed）后才渲染选项卡片；未确认时 text 已在聊天流中，
  // 底部按钮为“继续”（点击确认，见 renderSendButton）
  // kizuna 页：羁绊卡片在流内渲染，底部按钮变灰
  const current = !readOnly && story && (
    (sendState.mode === 'choice' && sendState.confirmed) ||
    sendState.mode === 'kizuna'
  ) ? renderCurrentStory(ctx, story) : '';
  const launcher = story || readOnly ? '' : renderChatLauncher(ctx, activeStory?.id ?? '', activeCompleted);
  const send = readOnly ? '' : renderSendButton(sendState, sendGate);

  // 聊天流与推进按钮分离：流是独立滚动区，按钮固定在聊天区底部外侧。
  // 演出专用文本渲染在 .chat-pane 层（.chat-stream 之上），不随滚动位移，保持界面定位。
  // 开幕横幅 / 入口确认浮层同层叠加（横幅在下、浮层在上）。
  return `
    <div class="chat-pane" data-chat-owner=""${replayId ? ` data-story-replay-id="${ctx.escapeHtml(replayId)}"` : ''}>
      <div class="chat-stream" ${FLOW_HOST_KEY_ATTRIBUTE}="chat:global" ${FLOW_STREAM_KEY_ATTRIBUTE}="chat:global" role="log" aria-label="聊天信息">
        ${history}
        ${current}
        ${launcher}
      </div>
      ${renderChatTexts(ctx, chatTexts)}
      ${openingBanner ? renderOpeningBanner(ctx, openingBanner) : ''}
      ${storyGate ? renderStoryGate(ctx, storyGate) : ''}
      ${send}
    </div>`;
}

function renderChatLauncher(ctx: UIContext, activeStoryId: string, activeCompleted: boolean): string {
  // InitStory 会在进入世界线时自动展开，无需手动启动。
  const hint = activeStoryId
    ? activeCompleted
      ? '世界线主线已完成，点击下方按钮可继续闲聊。'
      : '主线剧情正在展开……'
    : '世界线还没有主线剧情，点击下方按钮开始闲聊。';
  return `
    <div class="chat-launcher">
      <strong>${hint}</strong>
      <p>台词会自动继续；出现操作按钮或选项时，请按提示操作。</p>
    </div>`;
}

/**
 * 底部推进按钮——承载 Talklet / Click 的剧情推进输入。
 * - gate（§4）：对方打字 / 等待按钮操作阶段——只渲染节奏点；
 *   按钮仍可点击（由点击处理器转为节奏加速），但点击不推进。
 * - advance：单次点击推进剧情（无 sendText 时按钮显示“点击”）
 * - idle：无进行中剧情，点击触发被动闲聊
 * - choice：有选项，按钮让位
 */
export function renderSendButton(sendState: SendState, gate: SendGatePhase | null = null): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const token = 'token' in sendState && sendState.token
    ? ` data-story-token="${escape(String(sendState.token))}"` : '';
  // Operation 的结果由 Runtime 依次呈现并自动续接，不提供玩家确认入口。
  if (sendState.mode === 'advance' && sendState.checkpoint === 'operation') {
    return `
        <button class="send-button operation-checkpoint operation-checkpoint--playing" disabled aria-label="正在逐项呈现效果">
          <span class="send-bubble">
            <span class="send-operation-mark" aria-hidden="true">Ⅱ</span>
            <span class="send-text">正在逐项呈现效果</span>
            <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          </span>
        </button>`;
  }
  if (gate) {
    if (gate === 'pause') return `<button class="send-button thinking" disabled aria-label="正在播放演出"><span class="send-bubble"><span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="send-ghost" aria-hidden="true">↗</span></span></button>`;
    // send-ghost：隐藏箭头行框占位，节奏点态与一般点击态等高（§4）
    return `
      <button class="send-button thinking" data-send${token} aria-label="正在输入">
        <span class="send-bubble">
          <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="send-ghost" aria-hidden="true">↗</span>
        </span>
      </button>`;
  }
  if (sendState.mode === 'choice') {
    // choice 页 text 阻塞：未确认时显示“继续”按钮（点击确认后选项卡片出现），
    // 已确认后按钮变灰不可点（选项卡片在流中，由 [data-story-choice] 驱动）
    if (!sendState.confirmed) {
      return `
      <button class="send-button send-player" data-send>
        <span class="send-bubble">
          <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="send-text">继续</span>
          <span class="send-arrow">↗</span>
        </span>
      </button>`;
    }
    return `
      <button class="send-button disabled" disabled>
        <span class="send-bubble disabled">
          <span class="send-text">请选择选项</span>
        </span>
      </button>`;
  }

  if (sendState.mode === 'kizuna') {
    // 羁绊卡片已在流内由 renderCurrentStory 渲染（yuzu-kizuna 结构），
    // 底部按钮变灰不可点，提示玩家点击流中的卡片
    return `
      <button class="send-button disabled" disabled>
        <span class="send-bubble disabled">
          <span class="send-text">请点击羁绊卡片</span>
        </span>
      </button>`;
  }

  if (sendState.mode === 'idle') {
    const hint = sendState.reason === 'noAvailable' ? '（暂无可用闲聊）' : '';
    return `
      <button class="send-button idle" data-send>
        <span class="send-bubble">继续聊天 <span class="send-arrow">↗</span> ${hint}</span>
      </button>`;
  }

  // mode === 'advance'：无预设按钮文案（旁白/普通对话）时按钮仅作推进 → “点击”
  const label = sendState.text && sendState.text.trim() ? escape(sendState.text) : '点击';

  // 多击任务（clickWork）：进度条从左往右填充，填满（done === total）后按钮切换为“完成”态，
  // 再点一次才结束该 click 页（推进剧情）
  if (sendState.clickWork) {
    const { done, total } = sendState.clickWork;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const filled = total > 1 && done >= total;
    const workLabel = filled ? '完成' : label;
    return `
      <button class="send-button send-player work${filled ? ' done' : ''}" data-send${token}>
        <span class="send-bubble">
          <span class="send-progress" style="--pct: ${pct}%"></span>
          <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="send-text">${workLabel}</span>
          <span class="send-work-count">${done}/${total}</span>
          <span class="send-ghost" aria-hidden="true">↗</span>
        </span>
      </button>`;
  }

  return `
    <button class="send-button send-player" data-send${token}>
      <span class="send-bubble">
        <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="send-text">${label}</span>
        <span class="send-arrow">↗</span>
      </span>
    </button>`;
}

/** 渲染日志正文与操作按钮；由调用方把 data-action 绑定到当前日志栏实例。 */
export function renderLogContent(ctx: UIContext): string {
  const { game } = ctx;
  const entries = game.getDevLogs().slice(0, 60).map(entry => `
    <li class="log-entry log-${entry.level}">
      <div class="log-meta"><span>${ctx.formatTime(entry.timestamp)}</span><b>${ctx.escapeHtml(entry.source)}</b>${entry.frame === undefined ? '' : `<i>F${entry.frame}</i>`}</div>
      <p>${ctx.escapeHtml(entry.message)}</p>
      ${entry.details ? `<small>${entry.details}</small>` : ''}
    </li>`).join('');
  return `
    <section class="log-panel">
      <div class="panel-heading"><div><span class="eyebrow">ACTIVITY LOG</span><strong class="log-count">${game.getDevLogs().length} EVENTS</strong></div><div class="log-actions"><button data-action="dump-enh-debug" class="icon-button" aria-label="Enhancement条件诊断" title="Enhancement条件诊断（Ctrl+Shift+D）">◇</button><button data-action="export-log" class="icon-button" aria-label="导出日志" title="导出日志">⇓</button><button data-action="clear-log" class="icon-button" aria-label="清空日志" title="清空日志">×</button></div></div>
      <ol class="log-list">${entries || '<li class="empty-log">等待运行时事件...</li>'}</ol>
    </section>`;
}
