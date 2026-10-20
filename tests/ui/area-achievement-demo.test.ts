// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { mergeFragments, parseFragment } from '../../src/data-services/datapack/fragment-parser';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { bindEvents } from '../../src/ui/controller-events';

const PACK_DIR = 'datapack-dev/area-achievement-demo';
const MOD = 'area-achievement-demo';
const INIT = `${MOD}:init:archive-route`;
const SUPPLY = `${MOD}:area:supply-station`;
const ARCHIVE = `${MOD}:area:archive-room`;
const CREDIT_ACHIEVEMENT = `${MOD}:achievement:steady-credit`;
const ITEM_ACHIEVEMENT = `${MOD}:achievement:archive-fragments`;

function readPackFile(name: string): string {
  return readFileSync(resolve(process.cwd(), PACK_DIR, name), 'utf8');
}

function loadDemoPack(): Datapack {
  const manifest = JSON.parse(readPackFile('datapack.json')) as { modName: string };
  const fragments = ['00-world.json', '01-achievements.json'].map(name =>
    parseFragment(`${PACK_DIR}/${name}`, readPackFile(name)));
  return { ...mergeFragments(fragments), modName: manifest.modName };
}

describe('area achievement demo Records integration', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    game = new GameInstance();
    game.init([baseDatapack, loadDemoPack()], { enterDefaultInit: false });
    expect(game.inits.startNewGame(INIT)).toBe(true);
    controller = new UIController(game, document.querySelector('#app')!);
    controller.started = true;
    bindEvents(controller);
  });

  afterEach(() => {
    if (typeof controller !== 'undefined') controller.destroy();
    if (typeof game !== 'undefined' && game.running) game.stop();
  });

  it('renders real progress and completion while preserving Records achievement rows', async () => {
    controller.navigateToService('records');
    controller.render();

    let recordsRoot = controller.root.querySelector<HTMLElement>('[data-workspace-frame="service-records"]')!;
    const creditRow = recordsRoot.querySelector<HTMLElement>(`[data-achievement-id="${CREDIT_ACHIEVEMENT}"]`)!;
    const creditCurrent = creditRow.querySelector<HTMLElement>('[data-achievement-progress-current]')!;
    const creditStatus = creditRow.querySelector<HTMLElement>('[data-achievement-status]')!;
    expect(creditCurrent.textContent).toBe('0');
    expect(creditStatus.textContent).toBe('未完成');
    expect(recordsRoot.querySelector(`[data-achievement-id="${ITEM_ACHIEVEMENT}"]`)).toBeNull();

    game.tick();
    await Promise.resolve();
    expect(creditCurrent.textContent).toBe('1');
    expect(creditRow.querySelector('[data-achievement-status]')?.textContent).toBe('未完成');
    expect(recordsRoot.querySelector(`[data-achievement-id="${CREDIT_ACHIEVEMENT}"]`)).toBe(creditRow);

    for (let tick = 0; tick < 5; tick += 1) game.tick();
    await Promise.resolve();
    expect(creditCurrent.textContent).toBe('8');
    expect(creditRow.querySelector('[data-achievement-progress-target]')?.textContent).toBe('6');
    expect(creditStatus.textContent).toBe('已完成');
    expect(recordsRoot.querySelector(`[data-achievement-id="${CREDIT_ACHIEVEMENT}"]`)).toBe(creditRow);

    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    expect(game.getAchievementView().map(item => item.id)).toContain(ITEM_ACHIEVEMENT);
    expect(recordsRoot.querySelector(`[data-achievement-id="${ITEM_ACHIEVEMENT}"]`)).toBeNull();

    controller.navigateToService('game');
    controller.render();
    controller.navigateToService('records');
    controller.render();

    recordsRoot = controller.root.querySelector<HTMLElement>('[data-workspace-frame="service-records"]')!;
    const itemRow = recordsRoot.querySelector<HTMLElement>(`[data-achievement-id="${ITEM_ACHIEVEMENT}"]`)!;
    const itemCurrent = itemRow.querySelector<HTMLElement>('[data-achievement-progress-current]')!;
    const itemStatus = itemRow.querySelector<HTMLElement>('[data-achievement-status]')!;
    expect(itemCurrent.textContent).toBe('1');
    expect(itemRow.querySelector('[data-achievement-progress-target]')?.textContent).toBe('3');
    expect(itemStatus.textContent).toBe('未完成');

    expect(game.travelToArea(SUPPLY).success).toBe(true);
    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    await Promise.resolve();
    expect(itemCurrent.textContent).toBe('2');
    expect(itemStatus.textContent).toBe('未完成');
    expect(recordsRoot.querySelector(`[data-achievement-id="${ITEM_ACHIEVEMENT}"]`)).toBe(itemRow);

    expect(game.travelToArea(SUPPLY).success).toBe(true);
    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    await Promise.resolve();
    expect(itemCurrent.textContent).toBe('3');
    expect(itemStatus.textContent).toBe('已完成');
    expect(recordsRoot.querySelector(`[data-achievement-id="${ITEM_ACHIEVEMENT}"]`)).toBe(itemRow);
    expect(controller.root.querySelector('[data-workspace-frame="service-records"]')).toBe(recordsRoot);
  });
});
