import { StoryView } from '../../engine/types';
import { UIContext } from '../context';

export const storyErrorText: Record<string, string> = {
  AlreadyActive: '已有剧情流程进行中',
  AlreadyCompleted: '该剧情已经完成',
  BranchGuardDenied: '分歧点准入条件未满足',
  ChoiceConditionNotMet: '当前选择条件未满足',
  ChoiceRequired: '请先选择一个回应',
  ClickRequired: '请先完成本页点击再继续',
  ConditionNotMet: '剧情条件未满足',
  InvalidChoice: '选择无效',
  JumpLimitExceeded: '跳转链过深，演出已终止',
  NoActiveStory: '当前没有进行中的剧情',
  NoAvailableStory: '当前没有可触发的被动剧情',
  NotFound: '找不到剧情数据',
  NotReplayable: '该剧情不可重阅读',
  WrongStoryType: '剧情类型不匹配',
};

/** 聊天流中的一个条目（由 controller 累积，含历史）。 */
export interface ChatEntry {
  id: number;
  kind: 'talk' | 'narration' | 'system' | 'reward';
  speaker?: string;
  text: string;
  storyType?: 'active' | 'passive';
  /** 是否为玩家（老师）发出的回复。 */
  isPlayer?: boolean;
  /** 旁白对齐（center/left/right），仅 kind === 'narration' 生效。 */
  align?: 'center' | 'left' | 'right';
  /** 可选头像 URL，缺省渲染首字母圆形占位。 */
  avatar?: string;
  /** talk 气泡显示侧（缺省：isPlayer ? right : left）。 */
  side?: 'left' | 'right';
  /** 是否渲染圆形头像（缺省 false = 渲染）。 */
  noAvatar?: boolean;
  timestamp: number;
}

/** 圆形头像：有图渲染 <img>（加载失败回退首字母占位），无图渲染首字母圆形占位。 */
function renderAvatar(ctx: UIContext, avatar: string | undefined, speaker: string | undefined): string {
  const initial = ctx.escapeHtml((speaker?.trim() || '?').charAt(0).toUpperCase());
  const fallback = `<span class="chat-avatar-fallback">${initial}</span>`;
  if (!avatar) {
    return `<span class="chat-avatar">${fallback}</span>`;
  }
  return `<span class="chat-avatar"><img src="${ctx.escapeHtml(avatar)}" alt="${initial}" loading="lazy" onerror="this.remove()">${fallback}</span>`;
}

/** 对话气泡：左侧圆形头像（NPC）/ 右侧（玩家），对侧上部名字 + 下部小箭头气泡。 */
function renderTalk(ctx: UIContext, entry: ChatEntry): string {
  const name = ctx.escapeHtml(entry.speaker ?? 'SYSTEM');
  const isRight = (entry.side ?? (entry.isPlayer ? 'right' : 'left')) === 'right';
  // 仅玩家回复保留"回复"标签（当前注释禁用，见同步流）；NPC 不再显示 PASSIVE/ACTIVE
  const badge = /* entry.isPlayer ? '<span class="chat-kind">回复</span>' : */ '';
  const bubble = `
    <div class="chat-bubble chat-bubble-${isRight ? 'player' : 'npc'}">
      <p>${ctx.escapeHtml(entry.text)}</p>
    </div>`;
  const main = `<div class="chat-talk-main"><div class="chat-name">${badge}${name}</div>${bubble}</div>`;
  const avatar = entry.noAvatar ? '' : renderAvatar(ctx, entry.avatar, entry.speaker);
  return `<div class="chat-talk chat-talk-${isRight ? 'player' : 'npc'}">${avatar}${main}</div>`;
}

/** 场间旁白：横跨聊天流宽度，支持 center/left/right 对齐。 */
function renderNarration(ctx: UIContext, entry: ChatEntry): string {
  const align = entry.align ?? 'center';
  return `<div class="chat-narration chat-narration-${align}"><span class="chat-narration-text">${ctx.escapeHtml(entry.text)}</span></div>`;
}

/** 回复选择卡片：header 竖条装饰 + 白底居中选项列表（LOCKED 态保留）。 */
function renderReplyCard(
  ctx: UIContext,
  choices: NonNullable<StoryView['page']['choices']>,
  availableIndexes: number[],
): string {
  const rows = choices
    .map((choice, index) => {
      const available = availableIndexes.includes(index);
      return `
      <button class="reply-choice" data-story-choice="${index}" ${available ? '' : 'disabled'}>
        <span class="reply-choice-text">${ctx.escapeHtml(choice.text)}</span>
        ${available ? '<span class="reply-choice-arrow">↗</span>' : '<small class="reply-choice-locked">LOCKED</small>'}
      </button>`;
    })
    .join('');
  return `
    <div class="reply-card">
      <div class="reply-card-header"><span class="reply-card-bar"></span><span class="reply-card-title">回复</span></div>
      <div class="reply-card-choices">${rows}</div>
    </div>`;
}

/** 渲染累积的聊天历史（气泡流）。 */
export function renderChatHistory(entries: ChatEntry[], ctx: UIContext): string {
  if (entries.length === 0) {
    return '<div class="chat-empty">还没有对话记录。点击下方按钮开始一次聊天。</div>';
  }
  return entries
    .map(entry => {
      if (entry.kind === 'narration') return renderNarration(ctx, entry);
      if (entry.kind === 'system') {
        return `<div class="chat-bubble chat-system"><span class="chat-kind">SYSTEM</span><p>${ctx.escapeHtml(entry.text)}</p></div>`;
      }
      if (entry.kind === 'reward') {
        // 简洁风格：居中圆角小条，无「REWARD」小字符（奖励/移动通知同款）
        return `<div class="chat-reward"><p>${ctx.escapeHtml(entry.text)}</p></div>`;
      }
      return renderTalk(ctx, entry);
    })
    .join('');
}

/**
 * 渲染当前剧情页的回复选择卡片。
 * 页体（旁白/对话）由聊天流呈现，推进交互统一由底部 send-button 承担。
 */
export function renderCurrentStory(ctx: UIContext, story: StoryView): string {
  const choices = story.page.choices ?? [];
  if (choices.length === 0) return '';
  return `<div class="chat-current">${renderReplyCard(ctx, choices, story.availableChoiceIndexes)}</div>`;
}
