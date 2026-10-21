import type { StoryView } from '../../arona-clicker/contracts/results';
import { UIContext } from '../context';
import { renderAvatarSvg } from '../avatar-renderer';
import { renderPresentationHostBackground } from '../presentation-service';
import type { FlowContent, FlowMarks, FlowRepeatPolicy } from '../flow/flow-entry';
import { FLOW_ENTRY_KEY_ATTRIBUTE, FLOW_MARK_NAME, chatEntryToFlowContent, chatInstanceKey } from '../flow/flow-entry';
import { isReservedCardMark, mapCardAttachmentAttributes, mapCardHostAttributes } from '../cards/card-host';
import { renderAttachedCardFace } from '../cards/card-face';
import { renderMapActionCardButton, stableMapActionCardAngle } from '../cards/action-card';

export const storyErrorText: Record<string, string> = {
  AlreadyActive: '已有剧情流程进行中',
  AlreadyCompleted: '该剧情已经完成',
  AreaDeliveryUnavailable: '这条区域故事已无法接取，请返回区域列表后重试',
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
  kind: 'talk' | 'narration' | 'system' | 'reward' | 'typing';
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
  /** 连发分组中强制完整显示头像与名称（Talklet.showAvatar 的透传，缺省跟随分组规则）。 */
  showAvatar?: boolean;
  /** 聊天流发送图片：直连 URL 或 `mod:type(pic):id` 三段式图片索引（渲染在气泡内 text 上方）。 */
  image?: string;
  /** 已送达剧情页的同步标识，随历史保存；用于读档去重，不按台词文本合并消息。 */
  storyPageKey?: string;
  /** 共享投递策略的逻辑身份；普通 Chat 不写入，保留现有数字 ID 与 storyPageKey 语义。 */
  contentId?: string;
  /** 共享投递策略；普通 Chat 不写入（缺省追加）。 */
  repeatPolicy?: FlowRepeatPolicy;
  timestamp: number;
}

/** 演出专用文本条目（showChatText）：以聊天窗格百分比坐标定位，带临时 id 供 clearIdChatFlow 擦除。 */
export interface ChatTextEntry {
  id: string;
  /** 直接文本内容（无 talklet 时使用）。 */
  text?: string;
  /** 嵌入的标准 Talklet（复用其 speaker/avatar/kind/side/kizuna 渲染，优先于 text）。 */
  talklet?: import('../../data-services/contracts/story').Talklet;
  /** 锚点横坐标（0..1，0=左，1=右）。 */
  x: number;
  /** 锚点纵坐标（0..1，0=下，1=上）。 */
  y: number;
  /** 相对锚点的对齐方式。 */
  align: 'left' | 'center' | 'right';
  /** 视觉格式类别（无 talklet 时生效）。 */
  kind?: import('../../engine/contracts/chat-presentation').ChatTextKind;
  /** 样式覆写：字型 / 强制文字颜色 / 背景开关 / 强制背景色。 */
  style?: import('../../engine/contracts/chat-presentation').ChatTextStyle;
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
  const src = avatar ? ctx.game.pics.urlOf(avatar) : undefined;
  if (src) {
    return `<span class="chat-avatar"><img src="${ctx.escapeHtml(src)}" alt="${initial}" loading="lazy" onerror="this.remove()">${fallback}</span>`;
  }
  // 说话人匹配角色差分（displayName / name / id）→ 装备的 ColorGroup > 差分声明的 colorGroupId
  const speakerId = speaker?.trim();
  if (speakerId) {
    const variant = ctx.game.rosterSystem.getAllVariants().find(
      v => v.displayName === speakerId || v.name === speakerId || v.id === speakerId,
    );
    if (variant) {
      const equip = ctx.game.rosterSystem.getOwned(ctx.game.state, variant.id)?.colorEquipment;
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

/** 单条目渲染选项：实例键写入条目根元素，不新增包裹节点。 */
export interface RenderChatEntryOptions {
  /** 条落实例键：共享滚动与 DOM 协调据此定位条目。 */
  readonly instanceKey?: string;
  /** 同人连发分组接续：隐藏头像与名称。 */
  readonly hideIdentity?: boolean;
  /** 内联样式覆写（演出覆盖层复用气泡外观时使用）。 */
  readonly inlineStyle?: string;
}

/** 条目根元素的实例键属性；无键时不输出该属性（演出覆盖层等非流内用法）。 */
function entryKeyAttribute(ctx: UIContext, instanceKey: string | undefined): string {
  return instanceKey ? ` ${FLOW_ENTRY_KEY_ATTRIBUTE}="${ctx.escapeHtml(instanceKey)}"` : '';
}

/** 受控语义标记：只渲染白名单内的属性名，值统一转义。 */
function markAttributes(ctx: UIContext, marks: FlowMarks | undefined): string {
  if (!marks) return '';
  const parts: string[] = [];
  for (const [name, value] of Object.entries(marks)) {
    if (!FLOW_MARK_NAME.test(name)) continue;
    // Typed card renderers own these; generic marks must not mint bindings or entries.
    if (isReservedCardMark(name)) continue;
    if (value === true) parts.push(` ${name}`);
    else if (value !== '') parts.push(` ${name}="${ctx.escapeHtml(value)}"`);
  }
  return parts.join('');
}

/** 条目根元素的全部标记：实例键 + 调用方语义标记。 */
function entryAttributes(ctx: UIContext, entry: FlowContent, instanceKey: string | undefined): string {
  return `${entryKeyAttribute(ctx, instanceKey)}${markAttributes(ctx, entry.marks)}`;
}

/**
 * 气泡正文：普通条目保持单段 `<p>`；带标题／附加行时改为受控多行结构
 * （标题等级与行内文本都由渲染器转义，不开放 HTML 插槽）。
 */
function renderBubbleContent(ctx: UIContext, entry: FlowContent): string {
  const hasLines = (entry.lines?.length ?? 0) > 0;
  if (!entry.heading && !hasLines && !entry.actions?.length) {
    return `<p class="presentation-host-content">${ctx.escapeHtml(entry.text)}</p>`;
  }
  const heading = entry.heading
    ? `<h${entry.heading}${markAttributes(ctx, entry.headingMarks)}>${ctx.escapeHtml(entry.text)}</h${entry.heading}>`
    : entry.text ? `<p>${ctx.escapeHtml(entry.text)}</p>` : '';
  const lines = entry.lines?.map(line => `<p>${ctx.escapeHtml(line)}</p>`).join('') ?? '';
  const actions = entry.actions?.length
    ? `<div class="flow-actions">${entry.actions.map(action => `<button type="button" class="mini-action flow-action"${markAttributes(ctx, action.marks)}${action.disabled ? ' disabled' : ''}><span>${ctx.escapeHtml(action.label)}</span>${action.detail ? `<small>${ctx.escapeHtml(action.detail)}</small>` : ''}</button>`).join('')}</div>`
    : '';
  return `<div class="presentation-host-content">${heading}${lines}${actions}</div>`;
}

/** 对话气泡：左侧圆形头像（NPC）/ 右侧（玩家），对侧上部名字 + 下部小箭头气泡。
 *  hideIdentity（§4 连发分组）：同人连发中非首条不渲染头像与名称，以不可见头像占位保持气泡缩进对齐。 */
export function renderTalk(ctx: UIContext, entry: FlowContent, options: RenderChatEntryOptions = {}): string {
  const { instanceKey, hideIdentity = false, inlineStyle } = options;
  const name = ctx.escapeHtml(entry.speaker ?? 'SYSTEM');
  const isRight = (entry.side ?? (entry.isPlayer ? 'right' : 'left')) === 'right';
  // 仅玩家回复保留"回复"标签（当前注释禁用，见同步流）；NPC 不再显示 PASSIVE/ACTIVE
  const badge = /* entry.isPlayer ? '<span class="chat-kind">回复</span>' : */ '';
  const styleAttr = inlineStyle ? ` style="${inlineStyle}"` : '';
  // 聊天流发送图片：pic ref / 直连 URL 经 getPicUrl 解析；解析失败则整图不渲染
  const image = entry.image ? renderChatImage(ctx, entry.image) : '';
  const bubble = `
    <div class="chat-bubble presentation-host-target chat-bubble-${isRight ? 'player' : 'npc'}${hideIdentity ? ' chat-bubble-continued' : ''}" data-theme-host-id="bubble" data-theme-text-mode="${ctx.textColorModeForHost?.('bubble') ?? 'auto'}"${styleAttr}>
      ${renderPresentationHostBackground(ctx, 'bubble')}
      ${image}
      ${renderBubbleContent(ctx, entry)}
      ${renderMapLocations(ctx, entry, options)}
    </div>`;
  const nameLine = hideIdentity ? '' : `<div class="chat-name">${badge}${name}</div>`;
  const main = `<div class="chat-talk-main">${nameLine}${bubble}</div>`;
  const avatar = entry.noAvatar
    ? ''
    : hideIdentity
      ? '<span class="chat-avatar chat-avatar-ghost" aria-hidden="true"></span>'
      : renderAvatar(ctx, entry.avatar, entry.speaker);
  return `<div class="chat-talk chat-talk-${isRight ? 'player' : 'npc'}"${entryAttributes(ctx, entry, instanceKey)}>${avatar}${main}</div>`;
}

/** 聊天气泡内嵌图片：pic ref / 直连 URL 经 getPicUrl 解析；解析失败返回空串（不渲染）。 */
function renderChatImage(ctx: UIContext, ref: string): string {
  const src = ctx.game.pics.urlOf(ref);
  if (!src) return '';
  return `<img class="chat-image" src="${ctx.escapeHtml(src)}" alt="" loading="lazy">`;
}

/** 场间旁白：横跨聊天流宽度，支持 center/left/right 对齐。 */
function renderNarration(ctx: UIContext, entry: FlowContent, options: RenderChatEntryOptions = {}): string {
  const align = entry.align ?? 'center';
  return `<div class="chat-narration chat-narration-${align}"${entryAttributes(ctx, entry, options.instanceKey)}><span class="chat-narration-text">${ctx.escapeHtml(entry.text)}</span></div>`;
}

/** 回复选择卡片：header 竖条装饰 + 白底居中选项列表（LOCKED 态保留）。 */
function renderReplyCard(
  ctx: UIContext,
  choices: NonNullable<StoryView['page']['choices']>,
  availableIndexes: number[],
  align: NonNullable<StoryView['page']['align']>,
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
    <div class="reply-card reply-card--${align}">
      <div class="reply-card-header"><span class="reply-card-bar"></span><span class="reply-card-title">回复</span></div>
      <div class="reply-card-choices">${rows}</div>
    </div>`;
}

/** "正在输入"气泡：复用 talk 气泡骨架（头像/名字/侧向），正文为 send-dots 节奏点（§4 页级打字提示）。
 *  hideIdentity（连发分组接续）：不渲染头像与名称，仅显示气泡内节奏点。 */
function renderTyping(ctx: UIContext, entry: FlowContent, options: RenderChatEntryOptions = {}): string {
  const { instanceKey, hideIdentity = false } = options;
  const name = ctx.escapeHtml(entry.speaker ?? 'SYSTEM');
  const isRight = (entry.side ?? (entry.isPlayer ? 'right' : 'left')) === 'right';
  const bubble = `<div class="chat-bubble presentation-host-target chat-bubble-${isRight ? 'player' : 'npc'}${hideIdentity ? ' chat-bubble-continued' : ''}" data-theme-host-id="bubble" data-theme-text-mode="${ctx.textColorModeForHost?.('bubble') ?? 'auto'}">${renderPresentationHostBackground(ctx, 'bubble')}<span class="send-dots presentation-host-content" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
  const nameLine = hideIdentity ? '' : `<div class="chat-name">${name}</div>`;
  const main = `<div class="chat-talk-main">${nameLine}${bubble}</div>`;
  const avatar = entry.noAvatar
    ? ''
    : hideIdentity
      ? '<span class="chat-avatar chat-avatar-ghost" aria-hidden="true"></span>'
      : renderAvatar(ctx, entry.avatar, entry.speaker);
  return `<div class="chat-talk chat-talk-${isRight ? 'player' : 'npc'}"${entryAttributes(ctx, entry, instanceKey)}>${avatar}${main}</div>`;
}

/** 连发分组判定（§4）：相邻两条均为简单 chat（talk/typing）且同人同侧——
 *  speaker / avatar / 气泡侧 / 玩家身份 / noAvatar 形态全部一致。其余条目（旁白、
 *  系统行、奖励行、他人回复等）一律打断分组。 */
function sameChainGroup(a: ChatEntry | undefined, b: ChatEntry): boolean {
  if (!a || (a.kind !== 'talk' && a.kind !== 'typing')) return false;
  if (b.kind !== 'talk' && b.kind !== 'typing') return false;
  const sideOf = (e: ChatEntry) => e.side ?? (e.isPlayer ? 'right' : 'left');
  return (a.speaker ?? '') === (b.speaker ?? '')
    && (a.avatar ?? '') === (b.avatar ?? '')
    && sideOf(a) === sideOf(b)
    && !!a.isPlayer === !!b.isPlayer
    && !!a.noAvatar === !!b.noAvatar;
}

/** Gameplay B 地图 Talklet：轻量包装下按路线顺序展示地点胶囊。 */
function renderMapTalklet(ctx: UIContext, entry: FlowContent, options: RenderChatEntryOptions = {}): string {
  const overview = entry.mapOverview;
  if (!overview?.nodes.length) {
    return renderNarration(ctx, {
      ...entry,
      kind: 'narration',
      text: '当前地图地点信息暂不可读取。',
      align: 'center',
    }, options);
  }

  const nodes = overview.nodes.map((node, index) => `<li class="map-talklet__node" data-map-node-state="${node.state}"${node.state === 'current' ? ' aria-current="location"' : ''}>
    <span class="map-talklet__index" aria-hidden="true">${index + 1}</span>
    <strong>${ctx.escapeHtml(node.title)}</strong>
    <small>${ctx.escapeHtml(node.stateLabel)}</small>
  </li>`).join('');
  const mapName = ctx.escapeHtml(overview.mapName);
  return `<section class="map-talklet"${entryAttributes(ctx, entry, options.instanceKey)} role="group" aria-label="地图地点：${mapName}">
    <header class="map-talklet__header"><span>地图</span><strong>${mapName}</strong></header>
    <ol class="map-talklet__route" aria-label="地图地点顺序">${nodes}</ol>
  </section>`;
}

/** Flow 附着卡牌：复用真实卡牌绑定，只读查看并可作为合法目标。 */
function renderMapCards(ctx: UIContext, entry: FlowContent, options: RenderChatEntryOptions = {}): string {
  const cards = entry.mapCards ?? [];
  const hostId = options.instanceKey ?? `flow-map-cards:${cards.map(card => card.objectKey).join('|')}`;
  const faces = cards.map(card => renderAttachedCardFace(value => ctx.escapeHtml(value), {
    face: {
      title: card.actionName,
      subtitle: card.ownerName,
      description: card.description,
      meta: card.scost === undefined ? undefined : `sCost ${ctx.formatNumber(card.scost)}`,
      stateLabel: card.stateLabel,
      tabIndex: 0,
    },
    binding: {
      instanceKey: card.instanceKey,
      usage: 'live',
      objectKey: card.objectKey,
      ...(card.relationKey ? { relationKey: card.relationKey } : {}),
      entries: card.entries,
    },
    placement: { hostId, slotId: `card:${card.objectKey}` },
  })).join('');
  return `<section class="flow-map-cards"${entryAttributes(ctx, entry, options.instanceKey)} role="group" aria-label="关联卡牌">
    <header class="flow-map-cards__header"><span>卡牌</span><strong>关联卡牌</strong></header>
    <div class="flow-map-cards__list"${mapCardHostAttributes(value => ctx.escapeHtml(value), hostId)}>${faces}</div>
  </section>`;
}

/** Current MapRun node choices: distinct from Encounter cards and read-only map overview. */
function renderMapLocations(ctx: UIContext, entry: FlowContent, options: RenderChatEntryOptions = {}): string {
  const choices = entry.mapLocations;
  if (!choices?.locations.length) return '';
  const hostId = options.instanceKey
    ?? `flow-map-locations:${choices.runId}:${choices.mapId}:${choices.fromNodeId}`;
  const faces = choices.locations.map(location => {
    const attributes = mapCardAttachmentAttributes(value => ctx.escapeHtml(value), {
      instanceKey: location.instanceKey,
      usage: 'live',
      objectKey: location.objectKey,
      entries: location.selectable ? ['selectLocation'] : [],
    }, { hostId, slotId: `location:${location.ref.nodeId}` })
      + ` data-map-location-node-id="${ctx.escapeHtml(location.ref.nodeId)}"`
      + ` data-map-location-selectable="${location.selectable}"`
      + ` aria-pressed="false" aria-disabled="${!location.selectable}"`
      + ` aria-label="${ctx.escapeHtml(`${location.title}。${location.unavailableReason ?? location.stateLabel}`)}"`
      + ` style="--map-card-angle:${stableMapActionCardAngle(location.instanceKey)}"`;
    return renderMapActionCardButton(value => ctx.escapeHtml(value), {
      className: 'flow-map-location-card',
      attributes,
      title: location.title,
      subtitle: location.stateLabel,
      description: location.description,
      disabled: !location.selectable,
    });
  }).join('');
  return `<div class="flow-map-locations__landing"${mapCardHostAttributes(value => ctx.escapeHtml(value), hostId, choices.hostLayout)}
      data-map-location-choices data-map-run-id="${ctx.escapeHtml(choices.runId)}"
      data-map-map-id="${ctx.escapeHtml(choices.mapId)}" data-map-from-node="${ctx.escapeHtml(choices.fromNodeId)}"
      role="group" aria-label="可达地点">${faces}</div>`;
}

/** 普通 Chat、Story 与 Gameplay B Map 共用这一处条目种类分派。 */
export function renderChatEntry(
  ctx: UIContext,
  entry: FlowContent,
  options: RenderChatEntryOptions = {},
): string {
  if (entry.mapCards?.length) return renderMapCards(ctx, entry, options);
  if (entry.kind === 'map') return renderMapTalklet(ctx, entry, options);
  if (entry.kind === 'narration') return renderNarration(ctx, entry, options);
  if (entry.kind === 'typing') return renderTyping(ctx, entry, options);
  const attributes = entryAttributes(ctx, entry, options.instanceKey);
  if (entry.kind === 'system') {
    return `<div class="chat-bubble chat-system"${attributes}><span class="chat-kind">SYSTEM</span><p>${ctx.escapeHtml(entry.text)}</p></div>`;
  }
  if (entry.kind === 'reward') {
    // 简洁风格：居中圆角小条，无「REWARD」小字符（奖励/移动通知同款）
    return `<div class="chat-reward"${attributes}><p>${ctx.escapeHtml(entry.text)}</p></div>`;
  }
  return renderTalk(ctx, entry, options);
}

/** 渲染累积的聊天历史（气泡流）。同人连发分组：仅组内首条渲染头像/名称，后续只出现气泡。 */
export function renderChatHistory(entries: ChatEntry[], ctx: UIContext): string {
  if (entries.length === 0) {
    return '<div class="chat-empty">还没有对话记录。点击下方按钮开始一次聊天。</div>';
  }
  let prev: ChatEntry | undefined;
  return entries
    .map(entry => {
      // showAvatar 强制完整显示；否则仅当上一条同属同人连发时隐藏头像/名称
      const hideIdentity = !entry.showAvatar && sameChainGroup(prev, entry);
      prev = entry;
      return renderChatEntry(ctx, chatEntryToFlowContent(entry), {
        instanceKey: chatInstanceKey(entry.id),
        hideIdentity,
      });
    })
    .join('');
}

/**
 * 渲染当前剧情页的回复选择卡片。
 * 页体（旁白/对话）由聊天流呈现，推进交互统一由底部 send-button 承担。
 */
export function renderCurrentStory(ctx: UIContext, story: StoryView): string {
  const choices = story.page.choices ?? [];
  if (choices.length > 0) return `<div class="chat-current">${renderReplyCard(ctx, choices, story.availableChoiceIndexes, story.page.align ?? 'right')}</div>`;
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
function chatTextFontStack(font: import('../../engine/contracts/chat-presentation').ChatTextFont): string {
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
function renderOverlayTalklet(ctx: UIContext, tl: import('../../data-services/contracts/story').Talklet, targetStoryId?: string, inline?: string): string {
  const styleAttr = inline ? ` style="${inline}"` : '';
  if (tl.kizuna || targetStoryId) {
    const kizuna = tl.kizuna ?? { storyId: targetStoryId ?? '' };
    return renderKizunaCard(ctx, { storyId: kizuna.storyId, title: kizuna.title, buttonText: kizuna.buttonText });
  }
  if (tl.kind === 'narration') {
    return `<div class="chat-narration chat-narration-${tl.align ?? 'center'}"><span class="chat-narration-text"${styleAttr}>${ctx.escapeHtml(tl.text)}</span></div>`;
  }
  return renderTalk(ctx, {
    kind: 'talk',
    speaker: tl.speaker,
    text: tl.text,
    avatar: tl.avatar,
    image: tl.image,
    side: tl.side,
    noAvatar: tl.noAvatar,
  }, { inlineStyle: inline });
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
