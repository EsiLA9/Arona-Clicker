// ============================================================
// ui/components/tooltip-detail-codex.ts — 收集图鉴提示（被动闲聊池/条目）
// 从 tooltip.ts 拆出：renderPoolDetail / renderPassiveEntryDetail / summarizeEffects
// ============================================================

import type { PassiveStoryEntry } from '../../../data-services/contracts/story-entry';
import type { PassivePoolDef } from '../../../data-services/contracts/passive-pool';
import { UIContext } from '../../runtime/context';
import { describeCondition } from './tooltip-enhancement';

/** 被动闲聊池详情（收集图鉴悬停用）。 */
export function renderPoolDetail(ctx: UIContext, pool: PassivePoolDef): string {
  const directEntries = pool.children
    .map(child => ctx.game.registry.passiveStories.get(child.id))
    .filter((entry): entry is PassiveStoryEntry => !!entry);
  const subPoolIds = pool.children.filter(child => ctx.game.registry.passivePools.has(child.id));
  const totalWeight = pool.children.reduce((sum, child) => sum + (child.weight ?? 1), 0);
  const tags = (pool.tags ?? []).map(t => t.join('/')).join('、') || '无';
  const gateText = pool.condition ? describeCondition(pool.condition, ctx.nameOf) : '无条件';

  const childRows = [
    ...directEntries.map(entry => {
      const count = (ctx.game.state.storyLog ?? []).filter(s => s.storyId === entry.storyId).length;
      const done = count > 0;
      return `<div class="info-row"><span>${ctx.escapeHtml(ctx.nameOf('story', entry.storyId))}</span><span class="${done ? 'info-accent' : 'info-dim'}">${done ? `已收集 ×${count}` : '未收集'} · w${(entry.activation.kind === 'random' ? entry.activation.weight : 0)}</span></div>`;
    }),
    ...subPoolIds.map(child => `<div class="info-row"><span>子池</span><span>${ctx.escapeHtml(ctx.nameOf('pool', child.id))}</span></div>`),
  ].join('');

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">POOL</span><strong>${ctx.escapeHtml(pool.name ?? pool.id)}</strong></div>
      <div class="info-row"><span>gate 条件</span><span>${ctx.escapeHtml(gateText)}</span></div>
      <div class="info-row"><span>权重合计</span><span>${totalWeight}（子节点 ${pool.children.length}：条目 ${directEntries.length} / 子池 ${subPoolIds.length}）</span></div>
      <div class="info-row"><span>标签</span><span>${ctx.escapeHtml(tags)}</span></div>
      <div class="info-divider"></div>
      ${childRows}
    </div>`;
}

/** 被动闲聊条目详情（收集图鉴悬停用）。 */
export function renderPassiveEntryDetail(ctx: UIContext, entry: PassiveStoryEntry): string {
  const logs = (ctx.game.state.storyLog ?? []).filter(s => s.storyId === entry.storyId);
  const done = logs.length > 0;
  const inits = entry.availableInits.length === 0
    ? '全部世界线'
    : entry.availableInits.map(i => ctx.nameOf('init', i)).join('、');
  const reward = entry.completionReward;
  const rewardText = reward
    ? [
        reward.first ? `首次 ${summarizeEffects(ctx, reward.first)}` : '',
        reward.repeat ? `重复 ${summarizeEffects(ctx, reward.repeat)}` : '',
      ].filter(Boolean).join(' · ') || '无'
    : '无';
  const tags = (entry.tags ?? []).map(t => t.join('/')).join('、') || '无';

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">PASSIVE</span><strong>${ctx.escapeHtml(ctx.nameOf('story', entry.storyId))}</strong></div>
      <div class="info-sub">${done ? '已收集' : '未收集'}</div>
      <div class="info-row"><span>完成次数</span><span>${logs.length}</span></div>
      ${entry.activation.kind === 'random' ? `<div class="info-row"><span>基础权重</span><span>${entry.activation.weight}（${entry.activation.repeatable ? '可重复触发' : '单次触发'}）</span></div>` : `<div class="info-row"><span>角色阶段</span><span>${entry.activation.when.kind === 'level' ? `好感等级 ${entry.activation.when.level}` : ctx.escapeHtml(ctx.nameOf('story', entry.activation.when.storyId))+' 完成后'}</span></div>`}
      <div class="info-row"><span>可用世界线</span><span>${ctx.escapeHtml(inits)}</span></div>
      <div class="info-row"><span>标签</span><span>${ctx.escapeHtml(tags)}</span></div>
      <div class="info-divider"></div>
      <div class="info-row"><span>完结奖励</span><span>${ctx.escapeHtml(rewardText)}</span></div>
    </div>`;
}

/** 奖励效果摘要（仅展示 addResource 类；其余以数量计）。 */
function summarizeEffects(ctx: UIContext, effects: { op: string; target?: string; value?: unknown }[]): string {
  return effects
    .map(effect => {
      if (effect.op === 'addResource' && effect.target) {
        return `${ctx.nameOf('resource', effect.target)} +${effect.value}`;
      }
      return `${effect.op}`;
    })
    .join('、');
}
