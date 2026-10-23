import type { UIContext } from '../../runtime/context';
import type { SpotFunctionalityView } from '../../../engine/contracts/spot-functionality-query';
import { renderPresentationHostBackground } from '../../presentation/presentation-service';

/** 统一渲染关卡入口按钮；每个按钮目标唯一，内容和准入状态来自 Runtime 查询。 */
export function renderOperationSpotFunctions(ctx: UIContext, spotId: string, functionalities: readonly SpotFunctionalityView[]): string {
  const functions = functionalities.filter(fn => fn.kind === 'operationEntry' && fn.operationEventId);
  if (functions.length === 0) return '';
  const entries = ctx.game.operationEntry.getLaunchEntries();
  const current = ctx.game.operationEntry.getView();
  return functions.map(fn => {
    const entry = entries.find(candidate => candidate.eventId === fn.operationEventId);
    if (!entry) return '';
    const sameEvent = current?.eventId === entry.eventId ? current : null;
    const conditionMet = !fn.condition || ctx.game.conditionSystem.evaluateGroup(fn.condition, ctx.game.state);
    const anotherRun = current?.status === 'inProgress' && !sameEvent;
    const canStart = conditionMet && entry.admission.available && !anotherRun;
    const reason = !conditionMet ? '设施功能条件未满足。'
      : anotherRun ? '请先继续或完成当前行动。' : entry.admission.unavailableReason;
    const title = entry.title ?? entry.eventId;
    const binding = `data-operation-spot="${ctx.escapeHtml(spotId)}" data-operation-functionality="${ctx.escapeHtml(fn.id)}"`;
    const button = (label: string, action: string, enabled: boolean) => {
      const state = enabled ? 'inactive' : 'disabled';
      return `<button type="button" class="mini-action presentation-host-target" data-theme-host-id="card.action" data-theme-state="${state}" data-theme-text-mode="${ctx.textColorModeForHost('card.action', state)}" data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost('card.action')}" ${binding} ${action} title="${ctx.escapeHtml(reason ?? entry.description ?? title)}"${enabled ? '' : ' disabled'}>${renderPresentationHostBackground(ctx, 'card.action', 'presentation-host-background', state)}<span class="presentation-host-content">${ctx.escapeHtml(label)}</span></button>`;
    };
    const start = `data-operation-start="${ctx.escapeHtml(entry.eventId)}" data-operation-character-ids="${ctx.escapeHtml(JSON.stringify(entry.characterIds))}"`;
    const resume = sameEvent ? `data-operation-resume-run="${ctx.escapeHtml(sameEvent.runId)}" data-operation-event-id="${ctx.escapeHtml(entry.eventId)}"` : '';
    const actions = sameEvent?.status === 'inProgress'
      ? button(`继续${title}`, resume, conditionMet)
      : sameEvent
        ? button(`查看${title}结果`, resume, conditionMet) + button(`重新开始${title}`, start, canStart)
        : button(`开始${title}`, start, canStart);
    return `<div class="spot-operation-function" data-operation-entry="${ctx.escapeHtml(entry.eventId)}">${actions}${reason ? `<small class="mini-note operation-admission-reason">${ctx.escapeHtml(reason)}</small>` : ''}</div>`;
  }).join('');
}
