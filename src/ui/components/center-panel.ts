import { UIContext } from '../context';
import { renderTabs, TabDef } from './tabs';
import { renderChatHistory, renderCurrentStory, renderChatTexts, ChatEntry, ChatTextEntry } from './story';
import { renderConversationView } from './contacts';
import { renderOpeningBanner, renderStoryGate } from './story-gate';
import type { SendState } from '../../arona-clicker/contracts/results';
import type { ActiveBanner, SendGatePhase, StoryGateState } from './app-shell';
import { renderBackground } from '../background-service';
import { renderPresentationRegion } from '../presentation-service';

const CENTER_TABS: TabDef[] = [
  { id: 'chat', label: '聊天' },
  { id: 'log', label: '日志' },
];

/** 对话空间参数：打开时中栏整体替换为学生对话视图（无 tab）。 */
export interface ConversationView {
  variantId: string;
  entries: ChatEntry[];
  chatTexts: ChatTextEntry[];
}

export function renderCenterPanel(
  ctx: UIContext,
  activeTab: string,
  chatEntries: ChatEntry[],
  chatTexts: ChatTextEntry[],
  sendState: SendState,
  conversation?: ConversationView,
  sendGate?: SendGatePhase | null,
  storyGate?: StoryGateState | null,
  openingBanner?: ActiveBanner | null,
): string {
  if (conversation) {
    return renderConversationView(ctx, conversation.variantId, conversation.entries, conversation.chatTexts, sendState, sendGate ?? null, storyGate ?? null, openingBanner ?? null);
  }
  // 通讯录临时页：由左栏"通讯录"触发，等待详细设计
  if (activeTab === 'contacts-draft') {
    return `
      <section class="ui-cluster ui-cluster--center-panel panel center-panel presentation-host-target" data-theme-scope="center.contacts" data-theme-host-id="centerPanel.contacts" data-theme-state="default" data-theme-text-mode="${ctx.textColorModeForHost('centerPanel.contacts')}">
        ${renderBackground(ctx.backgroundForHost('centerPanel.contacts'), 'console-panel-background')}
        ${renderPresentationRegion(ctx.presentation, 'centerPanel')}
        ${renderTabs(ctx, 'center', CENTER_TABS, 'chat')}
        <div class="ui-cluster ui-cluster--center-contacts-draft panel-body">
          <div class="chat-empty">
            <p>📒 通讯录临时页</p>
            <p style="margin-top: 8px; color: var(--muted);">此页面等待后续设计制作。</p>
          </div>
        </div>
      </section>`;
  }
  // 档案临时页：由故事 Tab"档案"入口触发，等待记录内容设计
  if (activeTab === 'archive-draft') {
    return `
      <section class="ui-cluster ui-cluster--center-panel panel center-panel presentation-host-target" data-theme-scope="center.archive" data-theme-host-id="centerPanel.archive" data-theme-state="default" data-theme-text-mode="${ctx.textColorModeForHost('centerPanel.archive')}">
        ${renderBackground(ctx.backgroundForHost('centerPanel.archive'), 'console-panel-background')}
        ${renderPresentationRegion(ctx.presentation, 'centerPanel')}
        ${renderTabs(ctx, 'center', CENTER_TABS, 'chat')}
        <div class="ui-cluster ui-cluster--center-archive-draft panel-body">
          <div class="chat-empty">
            <p>🗄️ 档案临时页</p>
            <p style="margin-top: 8px; color: var(--muted);">此页面等待后续设计制作。</p>
          </div>
        </div>
      </section>`;
  }
  const body = activeTab === 'log'
    ? renderLogTab(ctx)
    : renderChatTab(ctx, chatEntries, chatTexts, sendState, sendGate ?? null, storyGate ?? null, openingBanner ?? null);
  return `
    <section class="ui-cluster ui-cluster--center-panel panel center-panel presentation-host-target" data-theme-scope="center.${activeTab}" data-theme-host-id="centerPanel.${activeTab}" data-theme-state="default" data-theme-text-mode="${ctx.textColorModeForHost(`centerPanel.${activeTab}`)}">
      ${renderBackground(ctx.backgroundForHost(`centerPanel.${activeTab}`), 'console-panel-background')}
      ${renderPresentationRegion(ctx.presentation, 'centerPanel')}
      ${renderTabs(ctx, 'center', CENTER_TABS, activeTab)}
      <div class="ui-cluster ui-cluster--center-${activeTab} panel-body">
        ${body}
      </div>
    </section>`;
}

export function renderChatTab(
  ctx: UIContext,
  chatEntries: ChatEntry[],
  chatTexts: ChatTextEntry[],
  sendState: SendState,
  sendGate: SendGatePhase | null,
  storyGate: StoryGateState | null,
  openingBanner: ActiveBanner | null,
): string {
  const { game, view } = ctx;
  const story = view.currentStory;
  const activeStory = [...game.registry.activeStories.values()][0];
  const activeCompleted = activeStory ? view.storyLog.some(item => item.storyId === activeStory.storyId) : false;

  const history = renderChatHistory(chatEntries, ctx);
  // choice 页：仅已确认文本（confirmed）后才渲染选项卡片；未确认时 text 已在聊天流中，
  // 底部按钮为"继续"（点击确认，见 renderSendButton）
  // kizuna 页：羁绊卡片在流内渲染，底部按钮变灰
  const current = story && (
    (sendState.mode === 'choice' && sendState.confirmed) ||
    sendState.mode === 'kizuna'
  ) ? renderCurrentStory(ctx, story) : '';
  const launcher = story ? '' : renderChatLauncher(ctx, activeStory?.id ?? '', activeCompleted);
  const send = renderSendButton(sendState, sendGate);

  // 聊天流与回复按钮分离：流是独立滚动区，按钮固定在聊天区底部外侧，
  // 这样回复气泡能贴底出现在聊天框最底部，不被按钮挤占。
  // 演出专用文本渲染在 .chat-pane 层（.chat-stream 之上），不随滚动位移，保持界面定位。
  // 开幕横幅 / 入口确认浮层同层叠加（横幅在下、浮层在上）。
  return `
    <div class="chat-pane">
      <div class="chat-stream">
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
 * - gate（§4）：对方打字 / 自己"想回复"阶段——只渲染节奏点，不透露回复文案；
 *   按钮仍可点击（由点击处理器转为节奏加速），但点击不推进。
 * - advance：单次点击推进剧情（无 sendText 时按钮显示"点击"）
 * - idle：无进行中剧情，点击触发被动闲聊
 * - choice：有选项，按钮让位
 */
export function renderSendButton(sendState: SendState, gate: SendGatePhase | null = null): string {
  if (gate) {
    // send-ghost：隐藏箭头行框占位，节奏点态与一般点击态等高（§4）
    return `
      <button class="send-button thinking" data-send aria-label="正在输入">
        <span class="send-bubble">
          <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="send-ghost" aria-hidden="true">↗</span>
        </span>
      </button>`;
  }
  if (sendState.mode === 'choice') {
    // choice 页 text 阻塞：未确认时显示"继续"按钮（点击确认后选项卡片出现），
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

  // mode === 'advance'：无预设回复文案（旁白/普通对话）时按钮仅作推进 → "点击"
  const label = sendState.text && sendState.text.trim() ? sendState.text : '点击';

  // 多击任务（clickWork）：进度条从左往右填充，填满（done === total）后按钮切换为"完成"态，
  // 再点一次才结束该 click 页（推进剧情）
  if (sendState.clickWork) {
    const { done, total } = sendState.clickWork;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const filled = total > 1 && done >= total;
    const workLabel = filled ? '完成' : label;
    return `
      <button class="send-button send-player work${filled ? ' done' : ''}" data-send>
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
    <button class="send-button send-player" data-send>
      <span class="send-bubble">
        <span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="send-text">${label}</span>
        <span class="send-arrow">↗</span>
      </span>
    </button>`;
}

export function renderLogTab(ctx: UIContext): string {
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
