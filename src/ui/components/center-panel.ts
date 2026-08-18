import { UIContext } from '../context';
import { renderTabs, TabDef } from './tabs';
import { renderChatHistory, renderCurrentStory, ChatEntry } from './story';
import { SendState } from '../../engine/types';

const CENTER_TABS: TabDef[] = [
  { id: 'chat', label: '聊天' },
  { id: 'log', label: '日志' },
];

export function renderCenterPanel(
  ctx: UIContext,
  activeTab: string,
  chatEntries: ChatEntry[],
  sendState: SendState,
): string {
  const body = activeTab === 'log' ? renderLogTab(ctx) : renderChatTab(ctx, chatEntries, sendState);
  return `
    <section class="panel center-panel">
      ${renderTabs(ctx, 'center', CENTER_TABS, activeTab)}
      <div class="panel-body">${body}</div>
    </section>`;
}

function renderChatTab(
  ctx: UIContext,
  chatEntries: ChatEntry[],
  sendState: SendState,
): string {
  const { game, view } = ctx;
  const story = view.currentStory;
  const activeStory = [...game.registry.stories.values()].find(item => item.type === 'active');
  const activeCompleted = activeStory ? view.storyLog.some(item => item.storyId === activeStory.id) : false;

  const history = renderChatHistory(chatEntries, ctx);
  const current = story && sendState.mode === 'choice' ? renderCurrentStory(ctx, story) : '';
  const launcher = story ? '' : renderChatLauncher(ctx, activeStory?.id ?? '', activeCompleted);
  const send = renderSendButton(sendState);

  // 聊天流与回复按钮分离：流是独立滚动区，按钮固定在聊天区底部外侧，
  // 这样回复气泡能贴底出现在聊天框最底部，不被按钮挤占。
  return `
    <div class="chat-pane">
      <div class="chat-stream">
        ${history}
        ${current}
        ${launcher}
      </div>
      ${send}
    </div>`;
}

function renderChatLauncher(ctx: UIContext, activeStoryId: string, activeCompleted: boolean): string {
  // InitStory 会在进入世界线时自动展开，无需手动启动。
  const hint = activeStoryId
    ? activeCompleted
      ? '世界线主线已完成，点击下方回复可继续闲聊。'
      : '主线剧情正在展开……'
    : '世界线还没有主线剧情，点击下方回复开始闲聊。';
  return `
    <div class="chat-launcher">
      <strong>${hint}</strong>
      <p>偶尔会出现选项，其余时间点击最下方的回复按钮推进对话。</p>
    </div>`;
}

/**
 * 底部"回复按钮"——本质是承载推进的 Talklet 的演出形态。
 * - advance：单次点击推进剧情
 * - idle：无进行中剧情，点击触发被动闲聊
 * - choice：有选项，按钮让位
 */
function renderSendButton(sendState: SendState): string {
  if (sendState.mode === 'choice') return '';

  if (sendState.mode === 'idle') {
    const hint = sendState.reason === 'noAvailable' ? '（暂无可用闲聊）' : '';
    return `
      <button class="send-button idle" data-send>
        <span class="send-bubble">继续聊天 <span class="send-arrow">↗</span> ${hint}</span>
      </button>`;
  }

  // mode === 'advance'：单次点击回复
  const label = sendState.text && sendState.text.trim() ? sendState.text : '点击回复';

  // 多击任务（clickWork）：进度条从左往右填充，完成才推进
  if (sendState.clickWork) {
    const { done, total } = sendState.clickWork;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return `
      <button class="send-button work" data-send>
        <span class="send-bubble">
          <span class="send-progress" style="--pct: ${pct}%"></span>
          <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="send-text">${label}</span>
          <span class="send-work-count">${done}/${total}</span>
        </span>
      </button>`;
  }

  return `
    <button class="send-button" data-send>
      <span class="send-bubble">
        <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="send-text">${label}</span>
      </span>
    </button>`;
}

function renderLogTab(ctx: UIContext): string {
  const { game } = ctx;
  const entries = game.getDevLogs().slice(0, 60).map(entry => `
    <li class="log-entry log-${entry.level}">
      <div class="log-meta"><span>${ctx.formatTime(entry.timestamp)}</span><b>${ctx.escapeHtml(entry.source)}</b>${entry.frame === undefined ? '' : `<i>F${entry.frame}</i>`}</div>
      <p>${ctx.escapeHtml(entry.message)}</p>
      ${entry.details ? `<small>${entry.details}</small>` : ''}
    </li>`).join('');
  return `
    <section class="log-panel">
      <div class="panel-heading"><div><span class="eyebrow">ACTIVITY LOG</span><strong class="log-count">${game.getDevLogs().length} EVENTS</strong></div><div class="log-actions"><button id="dump-enh-debug" class="icon-button" aria-label="Enhancement条件诊断" title="Enhancement条件诊断（Ctrl+Shift+D）">◇</button><button id="export-log" class="icon-button" aria-label="导出日志" title="导出日志">⇓</button><button id="clear-log" class="icon-button" aria-label="清空日志" title="清空日志">×</button></div></div>
      <ol class="log-list">${entries || '<li class="empty-log">等待运行时事件...</li>'}</ol>
    </section>`;
}
