import type { CharacterCultivationView } from '../../../arona-clicker/contracts/character/roster-query';
import type { UIContext } from '../../runtime/context';

const BREAKTHROUGH_REASON: Record<string, string> = {
  'no-curve': '暂未开放星级突破',
  'at-max': '已达星级上限',
  'insufficient-shards': '本角色碎片不足',
};

function fields(view: CharacterCultivationView, acquired: number): Record<string, string> {
  return {
    level: `Lv.${view.level} / ${view.levelCap}`,
    exp: view.canTrain && view.expToNext !== null ? `${Math.floor(view.exp)} / ${view.expToNext}` : '已达当前等级上限',
    affection: `Lv.${view.affectionLevel} / ${view.affectionLevelCap}`,
    affectionExp: view.canInteract && view.affectionExpToNext !== null
      ? `${Math.floor(view.affectionExp)} / ${view.affectionExpToNext}` : '已达当前好感上限',
    stars: '★'.repeat(view.stars) || '—',
    shards: String(view.shards),
    acquired: `${acquired} 次`,
    breakthrough: view.starCost !== null
      ? `突破需要本角色碎片 ${view.shards} / ${view.starCost}${view.canBreakthrough ? '' : '（不足）'}`
      : BREAKTHROUGH_REASON[view.breakthroughReason ?? ''] ?? '暂不可突破',
  };
}

/** Read-only rendering; commands remain in the contacts controller. */
export function renderCharacterCultivation(ctx: UIContext, variantId: string): string {
  const view = ctx.game.rosterSystem.cultivationOf(ctx.game.state, variantId);
  if (!view) return '';
  const values = fields(view, ctx.game.rosterSystem.acquiredCountOf(ctx.game.state, variantId));
  const value = (key: string) => `<dd data-cultivation-field="${key}">${ctx.escapeHtml(values[key])}</dd>`;
  const id = ctx.escapeHtml(variantId);
  return `<section class="character-cultivation" data-character-cultivation="${id}" aria-label="简易培养">
    <h4>简易培养</h4>
    <dl class="char-stats">
      <dt>等级</dt>${value('level')}<dt>升级经验</dt>${value('exp')}
      <dt>好感</dt>${value('affection')}<dt>好感经验</dt>${value('affectionExp')}
      <dt>星级</dt>${value('stars')}<dt>碎片</dt>${value('shards')}<dt>累计获得</dt>${value('acquired')}
    </dl>
    <div class="char-actions">
      <button class="primary-button" data-add-exp="${id}" ${view.canTrain ? '' : 'disabled'}>训练 +1000经验</button>
      <button class="primary-button" data-add-affection="${id}" ${view.canInteract ? '' : 'disabled'}>交流 +15好感</button>
      <button class="primary-button" data-breakthrough="${id}" ${view.canBreakthrough ? '' : 'disabled'}>星级突破</button>
    </div>
    <small data-cultivation-field="breakthrough">${ctx.escapeHtml(values.breakthrough)}</small>
    <small>训练与交流可重复进行，暂不消耗材料；突破消耗本角色碎片。</small>
    <p class="character-cultivation__feedback" data-cultivation-feedback role="status" aria-live="polite"></p>
  </section>`;
}

/** Patch only numeric/status consumers. Buttons, scroll owners and overlay anchors stay mounted. */
export function patchCharacterCultivation(host: HTMLElement, view: CharacterCultivationView, acquired: number): void {
  const values = fields(view, acquired);
  host.querySelectorAll<HTMLElement>('[data-cultivation-field]').forEach(element => {
    element.textContent = values[element.dataset.cultivationField!] ?? '';
  });
  const train = host.querySelector<HTMLButtonElement>('[data-add-exp]');
  const interact = host.querySelector<HTMLButtonElement>('[data-add-affection]');
  const breakthrough = host.querySelector<HTMLButtonElement>('[data-breakthrough]');
  if (train) train.disabled = !view.canTrain;
  if (interact) interact.disabled = !view.canInteract;
  if (breakthrough) breakthrough.disabled = !view.canBreakthrough;
}
