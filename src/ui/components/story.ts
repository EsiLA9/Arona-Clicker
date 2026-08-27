import { StoryView } from '../../engine/types';
import { UIContext } from '../context';
import { renderAvatarSvg } from '../../engine/system/avatar-renderer';

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
  /** 聊天流发送图片：直连 URL 或 `mod:type(pic):id` 三段式图片索引（渲染在气泡内 text 上方）。 */
  image?: string;
  timestamp: number;
}

/** 演出专用文本条目（showChatText）：以聊天窗格百分比坐标定位，带临时 id 供 clearIdChatFlow 擦除。 */
export interface ChatTextEntry {
  id: string;
  /** 直接文本内容（无 talklet 时使用）。 */
  text?: string;
  /** 嵌入的标准 Talklet（复用其 speaker/avatar/kind/side/kizuna 渲染，优先于 text）。 */
  talklet?: import('../../engine/types').Talklet;
  /** 锚点横坐标（0..1，0=左，1=右）。 */
  x: number;
  /** 锚点纵坐标（0..1，0=下，1=上）。 */
  y: number;
  /** 相对锚点的对齐方式。 */
  align: 'left' | 'center' | 'right';
  /** 视觉格式类别（无 talklet 时生效）。 */
  kind?: import('../../engine/types/expression').ChatTextKind;
  /** 样式覆写：字型 / 强制文字颜色 / 背景开关 / 强制背景色。 */
  style?: import('../../engine/types/expression').ChatTextStyle;
  /** 标题（kind='kizuna' 使用）。 */
  title?: string;
  /** 按钮文案（kind='kizuna' 使用）。 */
  buttonText?: string;
  /** 交互目标剧情入口 id（kind='kizuna' 使用）。 */
  targetStoryId?: string;
  timestamp: number;
}

/**
 * 圆形头像：优先级 = talklet 图片 > 说话人 ColorGroup 抽象头像 > 首字母圆形占位。
 * 图片加载失败回退首字母占位。
 */
function renderAvatar(ctx: UIContext, avatar: string | undefined, speaker: string | undefined): string {
  const initial = ctx.escapeHtml((speaker?.trim() || '?').charAt(0).toUpperCase());
  const fallback = `<span class="chat-avatar-fallback">${initial}</span>`;
  // avatar 可为直连 URL 或 `mod:type(pic):id` 三段式图片索引；解析失败回退首字母占位
  const src = avatar ? ctx.game.getPicUrl(avatar) : undefined;
  if (src) {
    return `<span class="chat-avatar"><img src="${ctx.escapeHtml(src)}" alt="${initial}" loading="lazy" onerror="this.remove()">${fallback}</span>`;
  }
  // 说话人匹配角色差分（displayName / name / id）→ 装备的 ColorGroup > 差分声明的 colorGroupId
  const speakerId = speaker?.trim();
  if (speakerId) {
    const variant = [...ctx.game.registry.characterVariants.values()].find(
      v => v.displayName === speakerId || v.name === speakerId || v.id === speakerId,
    );
    if (variant) {
      const equip = ctx.game.rosterSystem.getOwned(ctx.game.state, variant.id)?.equippedEquipment;
      const group = equip
        ? ctx.game.colorEquipmentSystem.groupOf(equip)
        : (variant.colorGroupId ? ctx.game.registry.colorGroups.get(variant.colorGroupId) : undefined);
      const colors = equip
        ? ctx.game.colorEquipmentSystem.avatarColors(equip)
        : (variant.colorGroupId ? ctx.game.colorEquipmentSystem.avatarColorsForGroup(variant.colorGroupId) : []);
      if (group && colors.length) {
        return `<span class="chat-avatar">${renderAvatarSvg(group.compositionType, colors, 40)}</span>`;
      }
    }
  }
  return `<span class="chat-avatar">${fallback}</span>`;
}

/** 对话气泡：左侧圆形头像（NPC）/ 右侧（玩家），对侧上部名字 + 下部小箭头气泡。 */
function renderTalk(ctx: UIContext, entry: ChatEntry, inlineStyle?: string): string {
  const name = ctx.escapeHtml(entry.speaker ?? 'SYSTEM');
  const isRight = (entry.side ?? (entry.isPlayer ? 'right' : 'left')) === 'right';
  // 仅玩家回复保留"回复"标签（当前注释禁用，见同步流）；NPC 不再显示 PASSIVE/ACTIVE
  const badge = /* entry.isPlayer ? '<span class="chat-kind">回复</span>' : */ '';
  const styleAttr = inlineStyle ? ` style="${inlineStyle}"` : '';
  // 聊天流发送图片：pic ref / 直连 URL 经 getPicUrl 解析；解析失败则整图不渲染
  const image = entry.image ? renderChatImage(ctx, entry.image) : '';
  const bubble = `
    <div class="chat-bubble chat-bubble-${isRight ? 'player' : 'npc'}"${styleAttr}>
      ${image}
      <p>${ctx.escapeHtml(entry.text)}</p>
    </div>`;
  const main = `<div class="chat-talk-main"><div class="chat-name">${badge}${name}</div>${bubble}</div>`;
  const avatar = entry.noAvatar ? '' : renderAvatar(ctx, entry.avatar, entry.speaker);
  return `<div class="chat-talk chat-talk-${isRight ? 'player' : 'npc'}">${avatar}${main}</div>`;
}

/** 聊天气泡内嵌图片：pic ref / 直连 URL 经 getPicUrl 解析；解析失败返回空串（不渲染）。 */
function renderChatImage(ctx: UIContext, ref: string): string {
  const src = ctx.game.getPicUrl(ref);
  if (!src) return '';
  return `<img class="chat-image" src="${ctx.escapeHtml(src)}" alt="" loading="lazy">`;
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
  if (choices.length > 0) return `<div class="chat-current">${renderReplyCard(ctx, choices, story.availableChoiceIndexes)}</div>`;
  // 羁绊剧情：渲染 yuzu-kizuna 卡片在流内，点击启动目标 ActiveStoryEntry
  if (story.page.kizuna) {
    return `<div class="chat-current">${renderKizunaCard(ctx, story.page.kizuna)}</div>`;
  }
  return '';
}

/** 渲染演出专用文本覆盖层（showChatText）：以聊天窗格百分比坐标定位（0,0=左下，1,1=右上）。 */
export function renderChatTexts(ctx: UIContext, entries: ChatTextEntry[]): string {
  if (entries.length === 0) return '';
  return entries
    .map(entry => {
      const pctX = Math.round(Math.min(1, Math.max(0, entry.x)) * 100);
      const pctY = Math.round(Math.min(1, Math.max(0, entry.y)) * 100);
      const alignCls = entry.align === 'right' ? 'align-right' : entry.align === 'center' ? 'align-center' : 'align-left';
      const inline = overlayInlineStyle(entry.style);
      const body = entry.talklet
        ? renderOverlayTalklet(ctx, entry.talklet, entry.targetStoryId, inline)
        : renderOverlayText(ctx, entry, inline);
      return `
      <div class="chat-text-overlay ${alignCls}" data-chat-text="${ctx.escapeHtml(entry.id)}" style="left: ${pctX}%; bottom: ${pctY}%;">
        ${body}
      </div>`;
    })
    .join('');
}

/** 把样式覆写转成内联 style 属性值（直接挂到展示元素上，确保最高优先级）。 */
function overlayInlineStyle(style: ChatTextEntry['style']): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.font) parts.push(`font-family:${chatTextFontStack(style.font)}`);
  if (style.fontSize) parts.push(`font-size:${style.fontSize}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.backgroundColor) parts.push(`background:${style.backgroundColor}`);
  if (style.background === false) {
    parts.push(`background:transparent`);
    parts.push(`border-color:transparent`);
    parts.push(`box-shadow:none`);
  }
  return parts.join(';');
}

/** 字型类别 → CSS font-family 栈。 */
function chatTextFontStack(font: import('../../engine/types/expression').ChatTextFont): string {
  const stacks: Record<string, string> = {
    serif: `'Georgia', 'Noto Serif SC', 'Songti SC', serif`,
    sans: `'Segoe UI', 'Noto Sans SC', 'PingFang SC', sans-serif`,
    mono: `'DM Mono', 'JetBrains Mono', 'Consolas', monospace`,
    handwritten: `'Comic Sans MS', 'KaiTi', '楷体', cursive`,
  };
  return stacks[font] ?? 'inherit';
}

/** 覆盖层直接文本：按 kind 选择视觉模板（default 简洁气泡 / title 大标题 / badge 标签 / note 弱化 / kizuna 羁绊卡片）。样式以内联属性直接挂在展示元素上。 */
function renderOverlayText(ctx: UIContext, entry: ChatTextEntry, inline: string): string {
  const text = ctx.escapeHtml(entry.text ?? '');
  const styleAttr = inline ? ` style="${inline}"` : '';
  switch (entry.kind) {
    case 'title':
      return `<div class="chat-text-title"${styleAttr}><span>${text}</span></div>`;
    case 'badge':
      return `<div class="chat-text-badge"${styleAttr}><span>${text}</span></div>`;
    case 'note':
      return `<div class="chat-text-note"${styleAttr}><span>${text}</span></div>`;
    case 'kizuna':
      return renderKizunaCard(ctx, {
        storyId: entry.targetStoryId ?? '',
        title: entry.title,
        buttonText: entry.buttonText,
      });
    default:
      return `<span class="chat-text-overlay-inner"${styleAttr}>${text}</span>`;
  }
}

/** 覆盖层嵌入标准 Talklet：复用 talk/narration/kizuna 渲染管线。样式以内联属性挂在气泡/旁白上。 */
function renderOverlayTalklet(ctx: UIContext, tl: import('../../engine/types').Talklet, targetStoryId?: string, inline?: string): string {
  const styleAttr = inline ? ` style="${inline}"` : '';
  if (tl.kizuna || targetStoryId) {
    const kizuna = tl.kizuna ?? { storyId: targetStoryId ?? '' };
    return renderKizunaCard(ctx, { storyId: kizuna.storyId, title: kizuna.title, buttonText: kizuna.buttonText });
  }
  if (tl.kind === 'narration') {
    return `<div class="chat-narration chat-narration-${tl.align ?? 'center'}"><span class="chat-narration-text"${styleAttr}>${ctx.escapeHtml(tl.text)}</span></div>`;
  }
  return renderTalk(ctx, {
    id: 0,
    kind: 'talk',
    speaker: tl.speaker,
    text: tl.text,
    avatar: tl.avatar,
    image: tl.image,
    side: tl.side,
    noAvatar: tl.noAvatar,
    timestamp: 0,
  }, inline);
}

/** 羁绊剧情卡片（yuzu-kizuna 结构，渲染在聊天流中）。 */
function renderKizunaCard(
  ctx: UIContext,
  kizuna: NonNullable<StoryView['page']['kizuna']>,
): string {
  const title = ctx.escapeHtml(kizuna.title ?? '羁绊事件');
  const buttonText = ctx.escapeHtml(kizuna.buttonText ?? '进入羁绊剧情');
  const alignCls = kizuna.align === 'right' ? ' align-right' : ' align-left';
  const entryId = ctx.escapeHtml(kizuna.storyId);
  return `
    <div class="kizuna-card${alignCls}" data-kizuna="${entryId}">
      <div class="yuzu-item yuzu-special-item">
        <div class="yuzu-kizuna-item">
          <div class="yuzu-kizuna-header">
            <span class="text">${title}</span>
          </div>
          <div class="yuzu-kizuna-heart">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" height="100%">
              <path d="M58.5 8.2a18.7 18.7 0 00-26.5 0 18.7 18.7 0 00-26.5 0 18.7 18.7 0 000 26.5L32 61.3l26.5-26.6a18.7 18.7 0 000-26.5z" fill="#FFD1DB"></path>
            </svg>
          </div>
          <div class="yuzu-kizuna-footer">
            <span class="text">${buttonText}</span>
          </div>
        </div>
      </div>
    </div>`;
}
