import { createUIContext } from '../runtime/context';
import { getSpotReveal } from '../components/tooltip/tooltip';
import type { UIController } from './controller';

const boundControllers = new WeakSet<UIController>();

/** Stable root delegation survives Spot card acquisition and subsequent card refreshes. */
export function bindVariantTrainingActions(ctrl: UIController): void {
  if (boundControllers.has(ctrl)) return;
  boundControllers.add(ctrl);
  ctrl.root.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-open-variant-training]');
    if (!button || !ctrl.root.contains(button)) return;
    event.preventDefault();
    const spotId = button.dataset.openVariantTraining ?? '';
    const functionalityId = button.dataset.variantTrainingFunctionality ?? '';
    const entry = validateEntry(ctrl, spotId, functionalityId);
    if ('reason' in entry) {
      ctrl.toast.show(entry.reason, 'error');
      return;
    }
    try {
      const run = ctrl.commands.enterVariantTraining(spotId, functionalityId);
      ctrl.panelState.mapEntrySource = undefined;
      ctrl.enterWorkspaceRoute({ kind: 'map', runId: run.runId });
      ctrl.render();
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : '演练场暂时无法进入，请检查入口和队伍准入。';
      ctrl.toast.show(message, 'error');
    }
  });
}

type ValidEntry = { readonly spotId: string; readonly functionalityId: string };
type EntryValidation = ValidEntry | { readonly reason: string };

function validateEntry(ctrl: UIController, spotId: string, functionalityId: string): EntryValidation {
  const spot = ctrl.game.world.spots.get(spotId);
  if (!spot) return { reason: '这个演练场入口已经不可用。' };
  if (spot.areaId !== ctrl.game.getView().currentAreaId) return { reason: '请先回到演练场所在区域。' };
  if (!getSpotReveal(createUIContext(ctrl.game), spot).utilityKnown) return { reason: '演练场功能尚未解锁。' };
  const functionality = ctrl.game.spotFunctionalitySystem.functionalitiesOf(spot, ctrl.game.state)
    .find(fn => fn.id === functionalityId && fn.kind === 'variantTrainingEntry');
  if (!functionality) return { reason: '演练场功能当前不可用，请检查设施状态。' };
  if (functionality.condition && !ctrl.game.conditionSystem.evaluateGroup(functionality.condition, ctrl.game.state)) {
    return { reason: '演练场条件尚未满足。' };
  }
  return { spotId, functionalityId };
}
