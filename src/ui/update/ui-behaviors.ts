import type { UIController } from '../controller';
import type { UIBehaviorId } from './ui-update-types';
import type { UISurfaceToken } from './ui-surface';

export interface UIBehaviorContext {
  controller: UIController;
  root: HTMLElement;
  token: UISurfaceToken;
  key: string;
}

type UIBehaviorHandler = (context: UIBehaviorContext) => boolean;

function matchingNodes(root: HTMLElement, attribute: string, key: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[${attribute}]`)].filter(node => {
    if (key === '*') return true;
    const datasetKey = attribute === 'data-resource'
      ? node.dataset.resource
      : attribute === 'data-gain'
        ? node.dataset.gain
        : node.dataset.spotYield;
    return datasetKey === key;
  });
}

function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString('en-US');
}

export class UIBehaviorRegistry {
  private readonly handlers = new Map<UIBehaviorId, UIBehaviorHandler>();

  register(id: UIBehaviorId, handler: UIBehaviorHandler): void {
    this.handlers.set(id, handler);
  }

  apply(id: UIBehaviorId, context: UIBehaviorContext): boolean {
    return this.handlers.get(id)?.(context) ?? false;
  }
}

export function createDefaultUIBehaviorRegistry(): UIBehaviorRegistry {
  const registry = new UIBehaviorRegistry();
  registry.register('resource.value', ({ controller, root, key }) => {
    const view = controller.game.getView();
    let changed = false;
    for (const node of matchingNodes(root, 'data-resource', key)) {
      const value = key === 'frame' ? view.totalFrames : view.resources[key] ?? 0;
      node.textContent = formatNumber(value);
      changed = true;
    }
    return changed;
  });
  registry.register('resource.gain', ({ controller, root, key }) => {
    let changed = false;
    for (const node of matchingNodes(root, 'data-gain', key)) {
      const resource = node.dataset.gain;
      if (!resource) continue;
      const value = controller.game.gameNumSystem.evaluateResourceGain(resource, controller.game.state);
      node.textContent = `+${formatNumber(value)}/t`;
      changed = true;
    }
    return changed;
  });
  registry.register('spot.yield', ({ controller, root, key }) => {
    let changed = false;
    for (const node of matchingNodes(root, 'data-spot-yield', key)) {
      const spotId = node.dataset.spotYield;
      if (!spotId) continue;
      const value = controller.game.gameNumSystem.evaluateSpotYield(spotId, controller.game.state);
      node.textContent = `产出 ${formatNumber(value)} / tick`;
      changed = true;
    }
    return changed;
  });
  return registry;
}
