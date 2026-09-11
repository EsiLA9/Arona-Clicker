// ============================================================
// ui/components/story-gate.ts — 剧情入口确认浮层 + 开幕标题横幅
// 两者均为 .chat-pane 内的覆盖元素（renderChatTexts 同层）。
// 浮层结构仿蔚蓝档案「好感故事」弹窗：标题栏 / 圆形头像 + 好感心形角标 /
//   角色名 / 深蓝标题横带 / 首次奖励 chips / 大进入按钮。
// 样式钩子集中在 css/story-overlays.css：组件级 CSS 变量
// （--story-gate-* / --story-banner-*）即 theme-tree 预留覆写点。
// ============================================================

import { UIContext } from '../context';
import type { ActiveBanner, StoryGateState } from './app-shell';
import { renderAvatarSvg } from '../avatar-renderer';

/** 横幅动画总时长（毫秒）：单一事实源——CSS 的 story-banner-life 与 ChatStream 的清除计时均以此为准，改时长只改这里 + CSS。 */
export const BANNER_ANIMATION_MS = 3000;

/** 剧情展示标题：entry.openingTitle ?? StoryDef.name ?? storyId。 */
export function storyDisplayTitle(ctx: UIContext, entryId: string): string {
  const entry = ctx.game.registry.storyEntries.get(entryId);
  return entry?.openingTitle ?? ctx.game.registry.stories.get(entry?.storyId ?? entryId)?.name ?? entryId;
}

/** 首次完成奖励摘要行（entry.completionReward.first；无声明返回空）。 */
function rewardLines(ctx: UIContext, entryId: string): string[] {
  const entry = ctx.game.registry.storyEntries.get(entryId);
  const effects = entry?.type === 'active' ? entry.completionReward?.first ?? [] : [];
  return effects.map(effect => {
    switch (effect.op) {
      case 'addResource': return `${ctx.nameOf('resource', effect.target)} ×${effect.value}`;
      case 'addItem': return `${ctx.nameOf('item', effect.target)} ×${effect.value}`;
      case 'addAffectionExp': return `好感 +${effect.value}`;
      case 'grantCharacter': return `获得学生 ${ctx.nameOf('character', String(effect.value))}`;
      default: return '';
    }
  }).filter(Boolean);
}

/** 圆形头像（VariantId 直查，优先级同通讯录行）：装备 ColorGroup > 差分 colorGroupId > 差分头像图；都无则 null。 */
function variantAvatar(ctx: UIContext, variantId: string, size = 96): string | null {
  const variant = ctx.game.rosterSystem.getVariant(variantId);
  if (!variant) return null;
  const equip = ctx.game.rosterSystem.getOwned(ctx.game.state, variantId)?.colorEquipment;
  const group = equip
    ? ctx.game.colorEquipmentSystem.groupOf(equip)
    : (variant.colorGroupId ? ctx.game.registry.colorGroups.get(variant.colorGroupId) : undefined);
  const colors = equip
    ? ctx.game.colorEquipmentSystem.avatarColors(equip)
    : (variant.colorGroupId ? ctx.game.colorEquipmentSystem.avatarColorsForGroup(variant.colorGroupId) : []);
  if (group && colors.length) return renderAvatarSvg(group.compositionType, colors, size);
  const avatarUrl = variant.avatar ? ctx.game.pics.urlOf(variant.avatar) : undefined;
  if (!avatarUrl) return null;
  return `<img src="${ctx.escapeHtml(avatarUrl)}" alt="${ctx.escapeHtml(variant.displayName)}" loading="lazy">`;
}

/** 入口确认浮层：标题栏（X / 遮罩空白 / 取消均可关闭）+ 头像 + 名字 + 标题横带 + 奖励 + 进入。 */
export function renderStoryGate(ctx: UIContext, gate: StoryGateState): string {
  const title = ctx.escapeHtml(storyDisplayTitle(ctx, gate.storyId));
  const label = gate.owner ? '羁绊剧情' : '剧情';
  // 确认文案三态：重读入口 = 重看（isReplay 受 branchGuards 约束）；
  // 已完结剧情卡片 = 正常重开（goto、分支自由探索）；未完结 = 进入
  // 完结态按演出本体 id 判定（storyLog / hasCompletedStory 均记 Story.id）
  const gateEntry = ctx.game.registry.storyEntries.get(gate.storyId);
  const completed = ctx.game.story.hasCompletedStory(gateEntry?.storyId ?? gate.storyId);
  const confirmText = gate.mode === 'replay' ? '重新观看' : completed ? '重新开始' : '进入';

  const variant = gate.owner ? ctx.game.rosterSystem.getVariant(gate.owner) : undefined;
  const owned = gate.owner ? ctx.game.rosterSystem.getOwned(ctx.game.state, gate.owner) : undefined;
  const avatarSvg = gate.owner ? variantAvatar(ctx, gate.owner) : null;
  const ownerName = variant?.displayName ?? gate.owner ?? '';
  const avatarBlock = gate.owner ? `
        <div class="story-gate-avatar">
          ${avatarSvg ?? `<span class="story-gate-avatar-fallback">${ctx.escapeHtml(ownerName.charAt(0))}</span>`}
          ${owned ? `<span class="story-gate-heart" title="好感等级 Lv.${owned.level}">
            <svg viewBox="0 0 64 64" width="36" height="32" aria-hidden="true"><path d="M58.5 8.2a18.7 18.7 0 00-26.5 0 18.7 18.7 0 00-26.5 0 18.7 18.7 0 000 26.5L32 61.3l26.5-26.6a18.7 18.7 0 000-26.5z" fill="#FF9EB4"></path></svg>
            <b>${owned.level}</b>
          </span>` : ''}
        </div>
        <div class="story-gate-owner">${ctx.escapeHtml(ownerName)}</div>` : '';

  const rewards = rewardLines(ctx, gate.storyId);
  const rewardBlock = rewards.length ? `
        <div class="story-gate-rewards">
          ${rewards.map(r => `<span class="story-gate-reward">${ctx.escapeHtml(r)}</span>`).join('')}
        </div>` : '';

  return `
    <div class="story-gate-overlay" data-story-gate data-story-gate-cancel>
      <div class="story-gate-card">
        <div class="story-gate-head">
          <span class="story-gate-label">${label}</span>
          <button class="story-gate-close" data-story-gate-cancel aria-label="关闭" title="关闭">×</button>
        </div>
        <div class="story-gate-body">
          ${avatarBlock}
          <div class="story-gate-band"><span>${title}</span></div>
          ${rewardBlock}
          <button class="story-gate-confirm" data-story-gate-confirm>${confirmText}</button>
          <button class="story-gate-cancel" data-story-gate-cancel>取消</button>
        </div>
      </div>
    </div>`;
}

/**
 * 开幕标题横幅：聊天流中央横幅状背景 + 标题文本（模糊出现→清晰→淡出，纯 CSS 动画）。
 * 聊天流全量 render 会重建本元素并重置动画（打字门控/连发推进约每 0.4-0.9s 一次），
 * 这里按 startedAt 换算负 animation-delay 断点续播，保证动画只播一次、连续不闪动。
 */
export function renderOpeningBanner(ctx: UIContext, banner: ActiveBanner): string {
  const elapsed = Math.min(Math.max(Date.now() - banner.startedAt, 0), BANNER_ANIMATION_MS);
  const delayAttr = elapsed > 0 ? ` style="animation-delay: -${Math.round(elapsed)}ms"` : '';
  return `
    <div class="story-opening-banner" data-story-banner${delayAttr}>
      <span class="story-opening-banner-text">${ctx.escapeHtml(banner.title)}</span>
    </div>`;
}
