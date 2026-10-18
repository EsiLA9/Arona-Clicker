import type { UIContext } from '../context';
import type { SpotFunctionalityView } from '../../engine/contracts/spot-functionality-query';
import { renderPresentationHostBackground } from '../presentation-service';

/** Renders Datapack-declared Map Entry buttons for a normal Spot card. */
export function renderMapEntryFunctions(
  ctx: UIContext,
  spotId: string,
  functionalities: readonly SpotFunctionalityView[],
): string {
  const entries = functionalities.filter(fn => fn.kind === 'mapEntry' && fn.mapId);
  if (entries.length === 0) return '';
  const current = ctx.game.mapRun.getSnapshot();

  return entries.map(fn => {
    const mapId = fn.mapId!;
    const continuing = current?.status === 'inProgress' && current.mapId === mapId;
    const anotherRun = current?.status === 'inProgress' && current.mapId !== mapId;
    const conditionMet = !fn.condition || ctx.game.conditionSystem.evaluateGroup(fn.condition, ctx.game.state);
    const enabled = conditionMet && !anotherRun;
    const reason = !conditionMet ? '设施功能条件未满足。'
      : anotherRun ? '请先继续当前进行中的地图。' : '由此进入 Datapack 提供的地图。';
    const state = enabled ? 'inactive' : 'disabled';
    const binding = `data-map-entry-spot="${ctx.escapeHtml(spotId)}" data-map-entry-functionality="${ctx.escapeHtml(fn.id)}" data-map-entry-map-id="${ctx.escapeHtml(mapId)}"`;
    const action = continuing
      ? `data-map-entry-continue-run="${ctx.escapeHtml(current.runId)}"`
      : `data-map-entry-start="${ctx.escapeHtml(mapId)}"`;
    const authoredLabel = fn.mapEntryLabel?.trim() ?? '';
    const label = authoredLabel && enabled
      ? authoredLabel
      : continuing ? '继续地图' : anotherRun ? '当前有地图进行中' : '开始地图';
    return `<div class="spot-map-function" data-map-entry="${ctx.escapeHtml(fn.id)}">
      <button type="button" class="mini-action presentation-host-target" data-theme-host-id="card.action" data-theme-state="${state}" data-theme-text-mode="${ctx.textColorModeForHost('card.action', state)}" data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost('card.action')}" ${binding} ${action} title="${ctx.escapeHtml(reason)}"${enabled ? '' : ' disabled'}>${renderPresentationHostBackground(ctx, 'card.action', 'presentation-host-background', state)}<span class="presentation-host-content">${label}</span></button>
      ${enabled ? '' : `<small class="mini-note map-entry-reason">${ctx.escapeHtml(reason)}</small>`}
    </div>`;
  }).join('');
}
