// ============================================================
// ui/components/contacts.ts — 通讯录 / 角色培养面板 / 角色聊天流 / 招募补给
//
// 全部只读渲染：数据来自 rosterSystem/colorSystem/availabilityService/registry，
// 写操作经 data-* 属性委托给 controller（走 StateMutationService）。
// ============================================================

import { UIContext } from '../context';
import { renderChatHistory, renderCurrentStory, ChatEntry } from './story';
import { renderSendButton } from './center-panel';
import { CharacterVariantDef } from '../../engine/types';
import { getAtPath, isStr } from '../../engine/extra';

const RARITY_LABEL: Record<string, string> = {
  super_rare: '★★★',
  rare: '★★',
  common: '★',
};

/** 左栏：通讯录 tab。 */
export function renderContactsTab(ctx: UIContext, selected: string | null): string {
  const { game } = ctx;
  const groups = game.rosterSystem.contactGroups(game.state);
  const codex = game.rosterSystem.codex(game.state);
  const unowned = codex.filter(e => !e.entry);

  const groupHtml = groups.length
    ? groups.map(g => `
      <div class="contact-group">
        <h4 class="contact-school">${ctx.escapeHtml(g.school)}</h4>
        ${g.entries.map(({ variant }) => renderContactRow(ctx, variant, selected)).join('')}
      </div>`).join('')
    : '<p class="empty">还没有获得任何学生。</p>';

  const placeholderHtml = unowned.length
    ? `
      <div class="contact-group">
        <h4 class="contact-school">未获得</h4>
        ${unowned.map(({ variant }) => `
          <div class="nav-item contact-row is-locked">
            <span class="contact-avatar placeholder">?</span>
            <span class="contact-name">???</span>
            <small>${RARITY_LABEL[variant.rarity] ?? ''}</small>
          </div>`).join('')}
      </div>`
    : '';

  // 主题切换：已解锁色彩 swatch
  const ownedColors = game.colorSystem.ownedColors(game.state);
  const activeColor = game.state.activeColor;
  const themeRow = ownedColors.length
    ? `
      <div class="contact-themes">
        <h4 class="contact-school">主题色彩</h4>
        <div class="theme-swatches">
          <button class="theme-swatch default ${!activeColor ? 'active' : ''}" data-activate-color="" title="默认主题">默认</button>
          ${ownedColors.map(c => `
            <button class="theme-swatch ${activeColor === c.id ? 'active' : ''}"
              data-activate-color="${c.id}" title="${ctx.escapeHtml(c.name)}"
              style="--swatch:${c.theme['primary'] ?? '#888'}">${ctx.escapeHtml(c.name)}</button>`).join('')}
        </div>
      </div>`
    : '';

  return `
    <div class="contacts-pane">
      <button class="primary-button contact-gacha" data-open-gacha>招募补给</button>
      ${groupHtml}
      ${placeholderHtml}
      ${themeRow}
    </div>`;
}

function renderContactRow(ctx: UIContext, variant: CharacterVariantDef, selected: string | null): string {
  const entry = ctx.game.rosterSystem.getOwned(ctx.game.state, variant.id)!;
  const active = selected === variant.id;
  return `
    <button class="nav-item contact-row ${active ? 'active' : ''}" data-select-variant="${ctx.escapeHtml(variant.id)}">
      <span class="contact-avatar">${ctx.escapeHtml(variant.name.slice(0, 1))}</span>
      <span class="contact-name">${ctx.escapeHtml(variant.displayName)}</span>
      <small>Lv.${entry.level} · ${RARITY_LABEL[variant.rarity] ?? ''}</small>
    </button>`;
}

/**
 * 中栏对话空间：学生各自的聊天流（复用一般聊天的 ChatEntry/Story 机制）。
 * 顶部栏：左上 App 式返回键 + 学生名 + 羁绊剧情入口（手动点击进入的 StoryEntry）。
 */
export function renderConversationView(
  ctx: UIContext,
  variantId: string,
  entries: ChatEntry[],
  sendState: import('../../engine/types').SendState,
): string {
  const { game } = ctx;
  const variant = game.rosterSystem.getVariant(variantId);
  if (!variant || !game.rosterSystem.isOwned(game.state, variantId)) {
    return '<div class="char-chat-empty"><p>该学生尚未加入通讯录。</p></div>';
  }

  // 羁绊剧情：activeStories 中 extra.owner = 差分 id 的入口（需玩家手动点击进入）
  const bondStories = bondStoriesOf(game, variantId);
  const bondButtons = bondStories.map(entry => `
    <button class="bond-story-button" data-start-story="${ctx.escapeHtml(entry.id)}"
      title="${ctx.escapeHtml(entry.storyId)}">羁绊剧情</button>`).join('');

  const story = ctx.game.getView().currentStory;
  // 羁绊剧情演出中：当前页照常渲染进流（choice 确认后显示选项卡片）
  const current = story && sendState.mode === 'choice' && sendState.confirmed
    ? renderCurrentStory(ctx, story)
    : '';

  return `
    <section class="panel center-panel conversation-panel">
      <div class="conversation-pane" data-conversation="${ctx.escapeHtml(variantId)}">
        <div class="conversation-header">
          <button class="conversation-back" data-conversation-back aria-label="返回一般聊天" title="返回一般聊天">‹</button>
          <div class="conversation-title">
            <b>${ctx.escapeHtml(variant.displayName)}</b>
            <small>对话空间</small>
          </div>
          <div class="conversation-bonds">${bondButtons}</div>
        </div>
        <div class="chat-pane">
          <div class="chat-stream conversation-stream">
            ${renderChatHistory(entries, ctx)}
            ${current}
          </div>
          ${renderSendButton(sendState)}
        </div>
      </div>
    </section>`;
}

/** 某差分的羁绊剧情入口列表（ActiveStoryEntry.extra.owner 声明归属）。 */
export function bondStoriesOf(
  game: { registry: { activeStories: ReadonlyMap<string, { id: string; storyId: string; extra?: import('../../engine/types').ExtraCompound }> } },
  variantId: string,
): { id: string; storyId: string }[] {
  const out: { id: string; storyId: string }[] = [];
  for (const entry of game.registry.activeStories.values()) {
    if (!entry.extra) continue;
    const owner = getAtPath(entry.extra, 'owner');
    if (owner !== undefined && isStr(owner) && owner.v === variantId) {
      out.push({ id: entry.id, storyId: entry.storyId });
    }
  }
  return out;
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

  const equipped = entry.equippedColors.map(id => {
    const def = game.colorSystem.getDef(id);
    return `
      <span class="color-chip equipped" style="--swatch:${def?.theme['primary'] ?? '#888'}">
        ${ctx.escapeHtml(def?.name ?? id)}
        <button class="chip-x" data-unequip-color="${ctx.escapeHtml(id)}">×</button>
      </span>`;
  }).join('');

  const equippable = game.colorSystem.ownedColors(game.state)
    .filter(c => !entry.equippedColors.includes(c.id))
    .map(c => `
      <button class="color-chip" style="--swatch:${c.theme['primary'] ?? '#888'}"
        data-equip-color="${ctx.escapeHtml(c.id)}" title="装备到色彩槽">+ ${ctx.escapeHtml(c.name)}</button>`)
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
      <h4>色彩槽</h4>
      <div class="color-slots">${equipped || '<small class="empty">未装备色彩</small>'}</div>
      ${equippable ? `<div class="color-equippable">${equippable}</div>` : ''}
    </div>`;
}

/** 弹窗体：招募补给（卡池列表 + 可及成员 + 抽取按钮）。 */
export function renderGachaBody(ctx: UIContext): string {
  const { game } = ctx;
  const pools = [...game.registry.gachaPools.values()];
  if (!pools.length) return '<p class="empty">当前没有开放卡池。</p>';
  return pools.map(pool => {
    const closed = game.availabilityService.isPoolClosed(pool, game.state);
    const drawable = game.availabilityService.drawableOf(pool, game.state);
    const counters = game.gachaService.countersOf(pool.id);
    const members = drawable.map(id => {
      const v = game.registry.characterVariants.get(id);
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
