import { StoryView } from '../../engine/types';
import { UIContext } from '../context';

export const storyErrorText: Record<string, string> = {
  AlreadyActive: '已有剧情流程进行中',
  AlreadyCompleted: '该剧情已经完成',
  ChoiceConditionNotMet: '当前选择条件未满足',
  ChoiceRequired: '请先选择一个回应',
  ConditionNotMet: '剧情条件未满足',
  Cooldown: '剧情仍在冷却中',
  InvalidChoice: '选择无效',
  NoActiveStory: '当前没有进行中的剧情',
  NoAvailableStory: '当前没有可触发的被动剧情',
  NotFound: '找不到剧情数据',
  WrongStoryType: '剧情类型不匹配',
};

/** 聊天流中的一个条目（由 controller 累积，含历史）。 */
export interface ChatEntry {
  id: number;
  kind: 'talk' | 'system';
  speaker?: string;
  text: string;
  storyType?: 'active' | 'passive';
  /** 是否为玩家（老师）发出的回复。 */
  isPlayer?: boolean;
  timestamp: number;
}

/** 渲染累积的聊天历史（气泡流）。 */
export function renderChatHistory(entries: ChatEntry[], ctx: UIContext): string {
  if (entries.length === 0) {
    return '<div class="chat-empty">还没有对话记录。点击下方按钮开始一次聊天。</div>';
  }
  return entries.map(entry => {
    if (entry.kind === 'system') {
      return `<div class="chat-bubble chat-system"><span class="chat-kind">SYSTEM</span><p>${ctx.escapeHtml(entry.text)}</p></div>`;
    }
    const who = entry.isPlayer
      ? '<span class="chat-kind">回复</span>'
      : entry.storyType === 'passive'
        ? '<span class="chat-kind">PASSIVE</span>'
        : '<span class="chat-kind">ACTIVE</span>';
    const cls = entry.isPlayer ? ' chat-player' : '';
    return `
      <div class="chat-bubble chat-talk${cls}">
        ${who}
        <strong>${ctx.escapeHtml(entry.speaker ?? 'SYSTEM')}</strong>
        <p>${ctx.escapeHtml(entry.text)}</p>
      </div>`;
  }).join('');
}

/** 渲染当前进行中的剧情：当前 Talk + 选项。 */
export function renderCurrentStory(ctx: UIContext, story: StoryView): string {
  const choices = story.page.choices ?? [];
  const nextLabel = story.pageIndex === story.totalPages - 1 ? '完成记录' : '继续';
  const choiceRows = choices.map((choice, index) => {
    const available = story.availableChoiceIndexes.includes(index);
    return `
      <button class="story-choice" data-story-choice="${index}" ${available ? '' : 'disabled'}>
        <span class="choice-index">0${index + 1}</span>
        <span>${ctx.escapeHtml(choice.text)}</span>
        ${available ? '<span class="choice-arrow">↗</span>' : '<small>LOCKED</small>'}
      </button>`;
  }).join('');

  return `
    <div class="chat-current">
      <div class="chat-dialogue">
        <span class="chat-kind">${story.type === 'passive' ? 'PASSIVE' : 'ACTIVE'}</span>
        <strong>${ctx.escapeHtml(story.page.speaker ?? 'SYSTEM')}</strong>
        <p>${ctx.escapeHtml(story.page.text)}</p>
      </div>
      ${choices.length > 0
        ? `<div class="story-choice-list">${choiceRows}</div>`
        : `<button class="story-continue" data-story-continue>${nextLabel} <span>↗</span></button>`}
    </div>`;
}
