// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';
import { createUIContext } from '../../src/ui/context';
import { UIController } from '../../src/ui/controller';
import { createAreaMapSession, reconcileAreaMap } from '../../src/ui/workspace/area-map-session';
import { renderAreaMapWorkspace } from '../../src/ui/components/area-map-workspace';
import { reconcileAreaMapDOM } from '../../src/ui/workspace/area-map-dom';

test('selection, projection changes and missing detail repair preserve frame/viewport/node/scroll identities', () => {
  const game = new GameInstance();
  game.init([{ ...mergeFragments([]), areaMaps: [{ id: 'demo:area-map:a', name: 'A', nodes: [
    { id: 'a', name: 'A', position: { x: 0, y: 0 } }, { id: 'b', name: 'B', position: { x: 100, y: 0 } },
  ], edges: [{ fromNodeId: 'a', toNodeId: 'b' }] }] }]);
  const root = document.createElement('div'); document.body.append(root);
  const ctrl = new UIController(game, root);
  const overlays = { dismissBeforeRootMutation: vi.fn(), retainIfAnchored: vi.fn() };
  try {
    const ctx = createUIContext(game), session = createAreaMapSession('s', '', '', game.areaMap.getView('demo:area-map:a')!, 0);
    root.innerHTML = renderAreaMapWorkspace(ctx, session, ctrl.panelState);
    const selectors = ['[data-workspace-frame]', '[data-area-map-viewport]', '[data-area-map-world]', '[data-area-map-detail-scroll]', '[data-area-map-node="a"]'];
    const original = selectors.map(selector => root.querySelector(selector));
    const scroll = original[3] as HTMLElement; scroll.scrollTop = 55;
    session.selectedNodeId = 'a';
    reconcileAreaMapDOM(root, ctx, ctrl.panelState, session, overlays, true);
    expect(root.querySelector('[data-area-map-detail]')?.textContent).toContain('A');
    const map = game.registry.areaMaps.get('demo:area-map:a')!;
    map.nodes[0].name = 'Updated'; map.nodes.splice(1); map.edges = [];
    reconcileAreaMap(session, game.areaMap);
    reconcileAreaMapDOM(root, ctx, ctrl.panelState, session, overlays, true);
    expect(root.querySelectorAll('[data-area-map-node]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-area-map-edge]')).toHaveLength(0);
    expect(root.querySelector('[data-area-map-node="a"]')?.textContent).toContain('Updated');
    expect(selectors.map(selector => root.querySelector(selector))).toEqual(original);
    expect(scroll.scrollTop).toBe(55);
    root.querySelector('[data-area-map-detail]')!.remove();
    reconcileAreaMapDOM(root, ctx, ctrl.panelState, session, overlays, true);
    expect(root.querySelector('[data-area-map-detail-scroll]')).toBe(scroll);
    expect(root.querySelector('[data-area-map-detail]')).not.toBeNull();
    expect(overlays.dismissBeforeRootMutation).toHaveBeenCalled();
  } finally { ctrl.destroy(); game.dispose(); root.remove(); }
});
