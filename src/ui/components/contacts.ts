// ============================================================
// ui/components/contacts.ts — 通讯录 / 角色培养面板 / 角色聊天流 / 招募补给
//
// 全部只读渲染：数据来自 rosterSystem/colorSystem/availabilityService/registry，
// 写操作经 data-* 属性委托给 controller（走 StateMutationService）。
// ============================================================

import { UIContext } from '../context';
import { renderChatHistory, renderCurrentStory, renderChatTexts, ChatEntry, ChatTextEntry } from './story';
import { renderSendButton } from './center-panel';
import { renderPanelHeaderRegion } from './tabs';
import { renderBackground } from '../background-service';
import { renderPresentationRegion } from '../presentation-service';
import { renderOpeningBanner, renderStoryGate } from './story-gate';
import type { CharacterVariantDef } from '../../arona-clicker/types/character';
import type { GearSlotView } from '../../arona-clicker/contracts/gear-query';
import type { Effect } from '../../engine/types';
import { renderAvatarSvg } from '../avatar-renderer';
import { entityKeyOf, renderEntityThemeOptions } from './entity-theme-options';
import { buildConditionView, renderConditionTree } from '../condition-presentation';

/** 未读消息计数接口：后续接入未读系统时由调用方提供。 */
export type UnreadResolver = (variantId: string) => number;

const RARITY_LABEL: Record<string, string> = {
  super_rare: '★★★',
  rare: '★★',
  common: '★',
};

/** 装备槽类别中文标签。 */
const GEAR_KIND_LABEL: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  special: '特殊',
};

/** 装备动作被拒原因的中文提示（controller 复用同一文案表）。 */
export const GEAR_REASON_TEXT: Record<string, string> = {
  'insufficient-material': '材料不足',
  'invalid-material': '材料无效',
  'max-level': '本阶已满级',
  'max-tier': '已达最高阶',
  'not-max-level': '未满级',
  'not-equipped': '未装配',
  'already-equipped': '已装配',
  'no-slot': '该角色无此槽位',
  'no-tier': '缺少层级定义',
  'no-entry': '尚未拥有该学生',
  unknown: '暂不可用',
};

/** 左栏：通讯录 tab。
 * @param studentChats 各学生对话空间聊天流，用于列表项消息预览
 * @param getUnread    未读消息计数接口（预留，后续接入未读系统时传入）
 */
export function renderContactsTab(
  ctx: UIContext,
  selected: string | null,
  studentChats: Record<string, ChatEntry[]> = {},
  getUnread?: UnreadResolver,
): string {
  const { game } = ctx;
  const groups = game.rosterSystem.contactGroups(game.state);
  const codex = game.rosterSystem.codex(game.state);
  const unowned = codex.filter(e => !e.entry);

  const groupHtml = groups.length
    ? groups.map(g => `
      <div class="contact-group">
        <h4 class="contact-school">${ctx.escapeHtml(g.school)}</h4>
        ${g.entries.map(({ variant }) => renderContactRow(ctx, variant, selected, studentChats[variant.id] ?? [], getUnread?.(variant.id) ?? 0)).join('')}
      </div>`).join('')
    : '';

  const emptyHtml = groups.length === 0 && unowned.length === 0
    ? `
      <div class="contacts-empty">
        <div class="contacts-empty-icon">✉</div>
        <p class="contacts-empty-title">还没有获得任何学生</p>
        <p class="contacts-empty-hint">名单空空如也，去 Spot 招募来扩充你的联系人吧。</p>
      </div>`
    : '';

  const placeholderHtml = unowned.length
    ? `
      <div class="contact-group">
        <h4 class="contact-school">未获得</h4>
        ${unowned.map(({ variant }) => renderLockedRow(ctx, variant)).join('')}
      </div>`
    : '';

  // 主题切换：已解锁色彩组 swatch
  const ownedGroups = game.colorSystem.ownedGroups(game.state);
  const activeTheme = game.state.activeTheme ?? { kind: 'system' as const };
  const customId = game.state.userTheme?.customThemeId;
  const customTheme = customId ? game.state.customThemes?.[customId] : undefined;
  const customSwatch = customTheme
    ? game.colorSystem.themeSwatchColor(customTheme)
      ?? (customTheme.baseThemeRef?.kind === 'color-group' && customTheme.baseThemeRef.id
        ? game.colorSystem.themeSwatchColor({ colorGroupId: customTheme.baseThemeRef.id })
        : undefined)
      ?? '#888'
    : undefined;
  const themeRow = ownedGroups.length || customTheme
    ? `
      <div class="contact-themes">
        <h4 class="contact-school">主题色彩组</h4>
        <div class="theme-swatches">
        <button class="theme-swatch default ${activeTheme.kind === 'system' ? 'active' : ''}" data-activate-group="" aria-pressed="${activeTheme.kind === 'system'}" title="系统默认主题">系统默认</button>
          ${ownedGroups.map(g => `
            <button class="theme-swatch ${activeTheme.kind === 'color-group' && activeTheme.id === g.id ? 'active' : ''}"
              data-activate-group="${g.id}" aria-pressed="${activeTheme.kind === 'color-group' && activeTheme.id === g.id}" title="${ctx.escapeHtml(g.name)}"
              style="--swatch:${game.colorSystem.themeSwatchColor({ colorGroupId: g.id }) ?? '#888'}">${ctx.escapeHtml(g.name)}</button>`).join('')}
          ${customTheme ? `<button class="theme-swatch custom ${activeTheme.kind === 'custom' && activeTheme.id === customId ? 'active' : ''}" data-activate-custom-theme="${ctx.escapeHtml(customId!)}" aria-pressed="${activeTheme.kind === 'custom' && activeTheme.id === customId}" title="应用用户自定义主题" style="--swatch:${customSwatch}">自定义 · ${ctx.escapeHtml(customTheme.name)}</button>` : ''}
        </div>
      </div>`
    : '';
  const userTheme = `<div class="contact-themes user-theme-access"><h4 class="contact-school">用户自定义主题</h4><button class="theme-editor-entry ${game.userThemeService.capability().active ? 'is-available' : 'is-locked'}" data-open-user-theme>${game.userThemeService.capability().active ? (customTheme ? '编辑用户自定义' : '创建用户自定义') : '需要主题编辑权限'}<span>↗</span></button></div>`;

  return `
    <div class="contacts-pane">
      ${emptyHtml}
      ${groupHtml}
      ${placeholderHtml}
      ${themeRow}
      ${userTheme}
    </div>`;
}

/** 未获得学生的锁定行（IM 式占位：头像 ? / 名 ??? / 预览提示）。 */
function renderLockedRow(ctx: UIContext, variant: CharacterVariantDef): string {
  return `
    <div class="nav-item contact-row is-locked">
      <span class="contact-avatar-wrap">
        <span class="contact-avatar placeholder">?</span>
      </span>
      <span class="contact-info">
        <span class="contact-line1"><span class="contact-name">???</span></span>
        <span class="contact-line2">尚未加入对话</span>
      </span>
    </div>`;
}

function renderContactRow(
  ctx: UIContext,
  variant: CharacterVariantDef,
  selected: string | null,
  chats: ChatEntry[] = [],
  unread = 0,
): string {
  const entry = ctx.game.rosterSystem.getOwned(ctx.game.state, variant.id)!;
  const active = selected === variant.id;
  const glyph = variant.name.slice(0, 1);
  // 头像优先级：装备的 ColorGroup > 差分声明的 colorGroupId > 图片/URL > 首字母占位
  const equipmentId = entry.colorEquipment;
  const equippedColors = equipmentId ? ctx.game.colorEquipmentSystem.avatarColors(equipmentId) : undefined;
  const equippedGroup = equipmentId ? ctx.game.colorEquipmentSystem.groupOf(equipmentId) : undefined;
  const declaredGroup = variant.colorGroupId ? ctx.game.registry.colorGroups.get(variant.colorGroupId) : undefined;
  const group = equippedGroup ?? declaredGroup;
  const palette = equippedColors ?? (variant.colorGroupId ? ctx.game.colorEquipmentSystem.avatarColorsForGroup(variant.colorGroupId) : undefined);
  let avatar: string;
  if (group && palette?.length) {
    avatar = renderAvatarSvg(group.compositionType, palette, 40);
  } else {
    // avatar 可为直连 URL 或 `mod:type(pic):id` 三段式图片索引；解析失败回退首字母占位
    const avatarUrl = variant.avatar ? ctx.game.pics.urlOf(variant.avatar) : undefined;
    avatar = avatarUrl
      ? `<img class="contact-avatar" src="${ctx.escapeHtml(avatarUrl)}" alt="${ctx.escapeHtml(variant.displayName)}">`
      : `<span class="contact-avatar">${ctx.escapeHtml(glyph)}</span>`;
  }
  const unreadBadge = unread > 0
    ? `<span class="contact-unread" title="未读消息">${unread > 99 ? '99+' : unread}</span>`
    : '';
  const preview = lastPreview(chats, true);

  return `
    <button class="nav-item contact-row ${active ? 'active' : ''}${unread > 0 ? ' has-unread' : ''}" data-select-variant="${ctx.escapeHtml(variant.id)}">
      <span class="contact-avatar-wrap">${avatar}${unreadBadge}</span>
      <span class="contact-info">
        <span class="contact-line1">
          <span class="contact-name">${ctx.escapeHtml(variant.displayName)}</span>
          <span class="contact-meta">Lv.${entry.level} · ${RARITY_LABEL[variant.rarity] ?? ''}</span>
        </span>
        <span class="contact-line2">${ctx.escapeHtml(preview)}</span>
      </span>
    </button>`;
}

/** 取聊天流最后一条可读文本作为列表预览（"收发人"感）。 */
function lastPreview(chats: ChatEntry[], owned: boolean): string {
  if (!owned) return '尚未加入对话';
  for (let i = chats.length - 1; i >= 0; i--) {
    const e = chats[i];
    if (e.kind === 'talk' || e.kind === 'narration') {
      const text = e.text ?? '';
      const prefix = e.kind === 'talk' && e.isPlayer ? '我：' : '';
      const out = `${prefix}${text}`.trim();
      if (out) return out;
    }
  }
  return '暂无消息';
}

/**
 * 中栏对话空间：学生各自的聊天流（复用一般聊天的 ChatEntry/Story 机制）。
 * 顶部栏：左上 App 式返回键 + 学生名 + 未读小字（就绪队列条数）。
 */
export function renderConversationView(
  ctx: UIContext,
  variantId: string,
  entries: ChatEntry[],
  chatTexts: ChatTextEntry[],
  sendState: import('../../arona-clicker/contracts/results').SendState,
  sendGate: import('./app-shell').SendGatePhase | null = null,
  storyGate: import('./app-shell').StoryGateState | null = null,
  openingBanner: import('./app-shell').ActiveBanner | null = null,
): string {
  const { game } = ctx;
  const variant = game.rosterSystem.getVariant(variantId);
  if (!variant || !game.rosterSystem.isOwned(game.state, variantId)) {
    return '<div class="char-chat-empty"><p>该学生尚未加入通讯录。</p></div>';
  }

  const unreadCount = game.story.readyStepCount(variantId);
  const header = `
    <div class="conversation-heading">
      <button class="conversation-back" data-conversation-back aria-label="返回一般聊天" title="返回一般聊天">‹</button>
      <div class="conversation-title">
        <b>${ctx.escapeHtml(variant.displayName)}</b>
        <small>对话空间${unreadCount > 0 ? ` · ${unreadCount} 条未读` : ''}</small>
      </div>
    </div>`;

  return `
    <section class="ui-cluster ui-cluster--center-conversation panel center-panel conversation-panel" data-game-panel="center" data-theme-scope="center.conversation">
      ${renderBackground(ctx.background, 'console-panel-background')}
      ${renderPresentationRegion(ctx.presentation, 'centerPanel')}
      ${renderPanelHeaderRegion(ctx, 'center', header)}
      <div class="conversation-pane panel-body" data-conversation="${ctx.escapeHtml(variantId)}">
        ${renderConversationFlow(ctx, variantId, entries, chatTexts, sendState, sendGate, storyGate, openingBanner)}
      </div>
    </section>`;
}

/** 角色 Workspace 中栏正文：复用普通聊天流的 panel-body，不再嵌套第二层顶栏。 */
export function renderConversationBody(
  ctx: UIContext,
  variantId: string,
  entries: ChatEntry[],
  chatTexts: ChatTextEntry[],
  sendState: import('../../arona-clicker/contracts/results').SendState,
  sendGate: import('./app-shell').SendGatePhase | null = null,
  storyGate: import('./app-shell').StoryGateState | null = null,
  openingBanner: import('./app-shell').ActiveBanner | null = null,
): string {
  const { game } = ctx;
  const variant = game.rosterSystem.getVariant(variantId);
  if (!variant || !game.rosterSystem.isOwned(game.state, variantId)) {
    return '<div class="char-chat-empty"><p>该学生尚未加入通讯录。</p></div>';
  }

  return `
    <div class="ui-cluster ui-cluster--center-chat panel-body character-workspace__conversation" data-conversation="${ctx.escapeHtml(variantId)}">
      ${renderConversationFlow(ctx, variantId, entries, chatTexts, sendState, sendGate, storyGate, openingBanner, true)}
    </div>`;
}

function renderConversationFlow(
  ctx: UIContext,
  variantId: string,
  entries: ChatEntry[],
  chatTexts: ChatTextEntry[],
  sendState: import('../../arona-clicker/contracts/results').SendState,
  sendGate: import('./app-shell').SendGatePhase | null,
  storyGate: import('./app-shell').StoryGateState | null,
  openingBanner: import('./app-shell').ActiveBanner | null,
  embedded = false,
): string {
  // 聊天沙盒：读取该角色对话空间自己游标上的当前剧情（与全局/其他角色并行互不干扰）
  const story = ctx.game.getStoryView(variantId);
  // 剧情演出中：choice 确认后渲染选项卡片；kizuna 页渲染羁绊卡片（均在流内）
  const current = story && (
    (sendState.mode === 'choice' && sendState.confirmed) ||
    sendState.mode === 'kizuna'
  ) ? renderCurrentStory(ctx, story) : '';

  // 对话空间阻断态（壁垒重启）：某 PassiveStoryEntry 播完后要求满足条件才能继续闲聊。
  // 仅在没有进行中演出时锁定抽取（演出中仍走 send 推进）。
  const blockState = ctx.game.state.studentBlocks?.[variantId];
  const blockEntry = blockState ? ctx.game.registry.passiveStories.get(blockState.entryId) : undefined;
  const blocked = !story && !!(blockEntry && blockEntry.block)
    && !ctx.game.conditionSystem.evaluateGroup(blockEntry.block, ctx.game.state);

  // 底部固定回复按钮：始终存在；门控/阻塞时不可推进（门控态由点击处理器转为节奏加速）
  const footer = blocked
    ? `
      <button class="send-button disabled" disabled>
        <span class="send-bubble disabled">
          <span class="send-text">🔒 对话空间已锁定</span>
        </span>
      </button>
      <div class="blocked-condition">满足条件后继续：${renderConditionTree(buildConditionView(blockEntry!.block!, {
        nameOf: ctx.nameOf, formatNumber: ctx.formatNumber, style: 'ui',
        evaluate: condition => ctx.game.conditionSystem.evaluateExpr(condition, ctx.game.state),
      }), ctx.escapeHtml)}</div>`
    : renderSendButton(sendState, sendGate);

  return `
    <div class="chat-pane">
      <div class="chat-stream conversation-stream">
        ${renderChatHistory(entries, ctx)}
        ${current}
      </div>
      ${renderChatTexts(ctx, chatTexts)}
      ${openingBanner ? renderOpeningBanner(ctx, openingBanner) : ''}
      ${storyGate ? renderStoryGate(ctx, storyGate) : ''}
      ${embedded ? footer : `<div class="conversation-footer">${footer}</div>`}
    </div>`;
}

/** 右栏：角色培养面板。 */
export function renderCharacterPanel(ctx: UIContext, variantId: string | null): string {
  if (!variantId || !ctx.game.rosterSystem.isOwned(ctx.game.state, variantId)) {
    return '<div class="char-panel-empty"><p>未选择学生。</p></div>';
  }
  const { game } = ctx;
  const variant = game.rosterSystem.getVariant(variantId)!;
  const entry = game.rosterSystem.getOwned(game.state, variantId)!;
  const shards = game.rosterSystem.shardsOf(game.state, variantId);

  const gearView = game.gearSystem.viewOf(game.state, variantId);
  const gearHtml = gearView.length
    ? `<h4>装备</h4><div class="gear-slots">${gearView.map(slot => renderGearSlotCard(ctx, variantId, slot)).join('')}</div>`
    : '';

  const equippedId = entry.colorEquipment;
  const equippedDef = equippedId ? game.colorEquipmentSystem.getDef(equippedId) : undefined;
  const equippedHtml = equippedDef
    ? renderEquipmentCard(ctx, equippedId!, equippedDef)
    : '<small class="empty">未装备装备</small>';

  const equippable = game.colorEquipmentSystem.ownedEquipments(game.state)
    .filter(e => e.id !== equippedId)
    .map(e => renderEquipmentOption(ctx, e))
    .join('');

  return `
    <div class="char-panel">
      <h3>${ctx.escapeHtml(variant.displayName)}</h3>
      <small class="char-proto">${ctx.escapeHtml(variant.school)} · ${RARITY_LABEL[variant.rarity] ?? ''}</small>
      <dl class="char-stats">
        <dt>等级</dt><dd>Lv.${entry.level} <small>（exp ${Math.floor(entry.exp)}）</small></dd>
        <dt>星级</dt><dd>${'★'.repeat(entry.stars) || '—'}</dd>
        <dt>碎片</dt><dd>${shards}</dd>
        <dt>累计获得</dt><dd>${game.rosterSystem.acquiredCountOf(game.state, variantId)} 次</dd>
      </dl>
      <div class="char-actions">
        <button class="primary-button" data-add-exp="${ctx.escapeHtml(variantId)}">经验 +100</button>
        <button class="primary-button" data-breakthrough="${ctx.escapeHtml(variantId)}">星级突破</button>
      </div>
      ${gearHtml}
      <h4>色彩装备</h4>
      <div class="equipment-slots">${equippedHtml}</div>
      ${equippable ? `<div class="equipment-equippable">${equippable}</div>` : ''}
      ${(() => {
        const entityKey = entityKeyOf('variant', variantId);
        const themeOptions = game.colorSystem.entityThemeOptions(game.state, entityKey, {
          declaredTheme: variant.theme,
          equippedEquipmentId: entry.colorEquipment,
        });
        return themeOptions.length
          ? `<h4>配色设计</h4>${renderEntityThemeOptions(ctx, entityKey, themeOptions)}`
          : '';
      })()}
    </div>`;
}

/** 已装备卡片：头像 SVG 预览 + 名称 + 效用 + 卸下按钮。 */
function renderEquipmentCard(
  ctx: UIContext,
  equipmentId: string,
  def: import('../../data-services/contracts/color').ColorEquipmentDef,
): string {
  const group = ctx.game.colorEquipmentSystem.groupOf(equipmentId);
  const colors = ctx.game.colorEquipmentSystem.avatarColors(equipmentId);
  const avatar = group ? renderAvatarSvg(group.compositionType, colors, 56) : '';
  return `
    <div class="equipment-card equipped">
      <span class="equipment-avatar">${avatar}</span>
      <div class="equipment-info">
        <b>${ctx.escapeHtml(def.name)}</b>
        <small>${ctx.escapeHtml(describeEffects(def.effects))}</small>
      </div>
      <button class="chip-x" data-unequip-equipment title="卸下">×</button>
    </div>`;
}

/** 可装备列表项：头像 SVG + 名称。 */
function renderEquipmentOption(ctx: UIContext, def: import('../../data-services/contracts/color').ColorEquipmentDef): string {
  const group = ctx.game.colorEquipmentSystem.groupOf(def.id);
  const colors = ctx.game.colorEquipmentSystem.avatarColors(def.id);
  const avatar = group ? renderAvatarSvg(group.compositionType, colors, 40) : '';
  return `
    <button class="equipment-option" data-equip-equipment="${ctx.escapeHtml(def.id)}" title="装备">
      <span class="equipment-avatar">${avatar}</span>
      <span class="equipment-option-name">${ctx.escapeHtml(def.name)}</span>
    </button>`;
}

/**
 * 装备槽卡片（三态）：空槽显示装配消耗；已装配显示等级/经验与经验材料；
 * 满级显示升 tier 消耗。BA 本体无取下，故不渲染卸下按钮。
 */
function renderGearSlotCard(ctx: UIContext, variantId: string, slot: GearSlotView): string {
  const title = `${GEAR_KIND_LABEL[slot.kind] ?? slot.kind} · ${ctx.escapeHtml(slot.gearName)}`;
  const variantAttr = ctx.escapeHtml(variantId);
  if (!slot.equipped) {
    const cost = slot.equipCost.map(c => `${ctx.escapeHtml(c.itemName)} ${c.owned}/${c.amount}`).join(' · ');
    return `
    <div class="gear-slot">
      <div class="gear-slot-head"><b>${title}</b></div>
      <div class="gear-slot-empty">
        <small>未装配</small>
        <small>消耗：${cost || '—'}</small>
      </div>
      <button class="primary-button" data-gear-equip="${slot.slotIndex}" data-gear-variant="${variantAttr}" ${slot.canEquip ? '' : 'disabled'}>放入装备</button>
      ${!slot.canEquip && slot.reason ? `<small class="gear-reason">${GEAR_REASON_TEXT[slot.reason] ?? ''}</small>` : ''}
    </div>`;
  }
  const maxed = slot.level >= slot.levelCap;
  const pct = maxed
    ? 100
    : slot.expPerLevel > 0
      ? Math.min(100, Math.floor((slot.exp / slot.expPerLevel) * 100))
      : 0;
  const materials = slot.expMaterials
    .map(m => `<button class="gear-material" data-gear-feed="${slot.slotIndex}" data-gear-material="${ctx.escapeHtml(m.itemId)}" data-gear-variant="${variantAttr}" ${m.owned > 0 ? '' : 'disabled'} title="${ctx.escapeHtml(m.name)} +${m.exp} 经验">${ctx.escapeHtml(m.name)} ×${m.owned}</button>`)
    .join('');
  const upgradeCost = slot.upgradeCost.map(c => `${ctx.escapeHtml(c.itemName)} ${c.owned}/${c.amount}`).join(' · ');
  return `
    <div class="gear-slot is-equipped">
      <div class="gear-slot-head"><b>${title}</b><span class="gear-tier">T${slot.tier}</span></div>
      <div class="gear-slot-level"><span>Lv.${slot.level} / ${slot.levelCap}</span><small>exp ${slot.exp}/${slot.expPerLevel}</small></div>
      <div class="gear-exp-bar"><span style="width:${pct}%"></span></div>
      ${maxed
        ? `<button class="primary-button" data-gear-tierup="${slot.slotIndex}" data-gear-variant="${variantAttr}" ${slot.canUpgradeTier ? '' : 'disabled'}>升级装备</button>`
        : `<div class="gear-materials">${materials || '<small>无可用的装备经验材料</small>'}</div>`}
      ${maxed && !slot.canUpgradeTier
        ? `<small class="gear-reason">${slot.reason === 'max-tier' ? '已达最高阶' : `升级消耗：${upgradeCost || '—'}`}</small>`
        : ''}
    </div>`;
}

/** 效果的简短中文描述（仅覆盖常见 op，其余回退 op 名）。 */
function describeEffects(effects: Effect[]): string {
  if (!effects.length) return '无效用';
  return effects.map(e => {
    switch (e.op) {
      case 'addResource':
        return `+${e.value} ${String(e.target).split(':').pop() ?? ''}`;
      case 'setFlag':
        return `标记 ${String(e.target)}`;
      default:
        return e.op;
    }
  }).join(' / ');
}

/** 弹窗体：通用招募补给（全部开放卡池 + 可及成员 + 抽取按钮）。 */
export function renderGachaBody(ctx: UIContext): string {
  const { game } = ctx;
  const pools = [...game.registry.gachaPools.values()];
  return renderGachaPools(ctx, pools, '通用卡池');
}

/** Spot 招募弹窗体：Switch 切换「专有卡池 / 通用卡池」。 */
export function renderSpotGachaBody(ctx: UIContext, spotId: string): string {
  const { game } = ctx;
  const spot = game.world.spots.get(spotId);
  if (!spot) return '<p class="empty">未找到该设施。</p>';
  const ownIds = spot.gachaPools ?? [];
  const ownPools = ownIds
    .map(id => game.registry.gachaPools.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const allPools = [...game.registry.gachaPools.values()];
  return `
    <div class="switch-tabs" data-gacha-scope-switch>
      <button class="switch-tab ${ownPools.length ? 'active' : ''}" data-scope="own">专有卡池${ownPools.length ? `（${ownPools.length}）` : ''}</button>
      <button class="switch-tab ${ownPools.length ? '' : 'active'}" data-scope="global">通用卡池（${allPools.length}）</button>
    </div>
    <div class="gacha-scope" data-scope-panel="own" ${ownPools.length ? '' : 'hidden'}>
      ${ownPools.length
        ? renderGachaPools(ctx, ownPools, '专有卡池')
        : '<p class="empty">该设施没有专属卡池，请切换到通用卡池。</p>'}
    </div>
    <div class="gacha-scope" data-scope-panel="global" ${ownPools.length ? 'hidden' : ''}>
      ${renderGachaPools(ctx, allPools, '通用卡池')}
    </div>`;
}

/** 渲染一组卡池卡片（含可及成员与抽取按钮）。 */
function renderGachaPools(ctx: UIContext, pools: import('../../data-services/contracts/gacha-pool').GachaPoolDef[], scopeLabel: string): string {
  const { game } = ctx;
  if (!pools.length) return `<p class="empty">「${scopeLabel}」当前没有可用卡池。</p>`;
  return pools.map(pool => {
    const closed = game.availabilityService.isPoolClosed(pool, game.state);
    const drawable = game.availabilityService.drawableOf(pool, game.state);
    const counters = game.gachaService.countersOf(pool.id);
    const members = drawable.map(id => {
      const v = game.rosterSystem.getVariant(id);
      return v ? `<li>${ctx.escapeHtml(v.displayName)} <small>${RARITY_LABEL[v.rarity] ?? ''}</small></li>` : '';
    }).join('');
    const actions = closed
      ? '<small class="empty">池已关闭</small>'
      : `
        <button class="primary-button" data-gacha="${ctx.escapeHtml(pool.id)}" data-gacha-count="1">单抽（${pool.costPerPull}）</button>
        <button class="primary-button" data-gacha="${ctx.escapeHtml(pool.id)}" data-gacha-count="10">十连</button>`;
    return `
      <div class="gacha-pool ${closed ? 'closed' : ''}">
        <h4>${ctx.escapeHtml(pool.name)} <small>${pool.mode}</small></h4>
        <small>pity ${counters.pity}${pool.pity ? ` / ${pool.pity.guaranteedAt}` : ''} · 已抽 ${counters.pulls} 次</small>
        <ul class="gacha-members">${members}</ul>
        <div class="gacha-actions">${actions}</div>
      </div>`;
  }).join('');
}
