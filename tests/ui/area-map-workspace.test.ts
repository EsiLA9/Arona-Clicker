// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';
import { createUIContext } from '../../src/ui/runtime/context';
import { UIController } from '../../src/ui/controller/controller';
import { createAreaMapSession } from '../../src/ui/workspace/area-map-session';
import { renderAreaMapWorkspace } from '../../src/ui/components/map/area-map-workspace';

test('three columns retain real Area rail, render escaped public nodes and a separate travel action', () => {
  const game = new GameInstance();
  game.init([{ ...mergeFragments([]),
    inits: [{ id: 'demo:init:a', name: 'World', description: '', defaultAreas: ['demo:area:a'] }],
    areas: [{ id: 'demo:area:a', initId: 'demo:init:a', name: 'Real Area', description: '', defaultSpots: [], navigationMapId: 'demo:area-map:a' }],
    areaMaps: [{ id: 'demo:area-map:a', name: 'Map', nodes: [{ id: 'n', name: '<unsafe>', position: { x: 0, y: 0 }, action: { kind: 'attemptAreaTravel', areaId: 'demo:area:a' } }], edges: [] }],
  }]);
  const root = document.createElement('div'); document.body.append(root);
  const ctrl = new UIController(game, root);
  try {
    const session = createAreaMapSession('s', 'demo:init:a', 'demo:area:a', game.areaMap.getView('demo:area-map:a')!, 0);
    session.selectedNodeId = 'n';
    const before = JSON.stringify(game.state);
    root.innerHTML = renderAreaMapWorkspace(createUIContext(game), session, ctrl.panelState);
    expect(root.querySelector('[data-workspace-frame="area-map"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-workspace-owner="area-map"]').length).toBeGreaterThanOrEqual(3);
    expect(root.querySelector('[data-area-workspace-open]')?.textContent).toContain('Real Area');
    expect(root.querySelector('[data-area-map-node]')?.getAttribute('aria-label')).toBe('<unsafe>');
    expect(root.querySelector('unsafe')).toBeNull();
    expect(root.querySelector('[data-area-map-action="travel"]')?.hasAttribute('disabled')).toBe(true);
    expect(root.querySelector('[data-area-map-detail-scroll] [data-area-map-detail]')).not.toBeNull();
    expect(JSON.stringify(game.state)).toBe(before);
  } finally { ctrl.destroy(); game.dispose(); root.remove(); }
});
