// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID, loadDefaultDatapack } from '../../src/app/runtime-bootstrap';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { SpotDef } from '../../src/data-services/contracts/world';
import { UIController } from '../../src/ui/controller';

const PARTY = ['shiroko', 'serika'] as const;
const DAMAGE_ACTION_LABEL = /普通射击|瞄准射击/;

function findAreaPath(game: GameInstance, targetAreaId: string): string[] | null {
  const start = game.getView().currentAreaId;
  if (!start) return null;
  if (start === targetAreaId) return [start];
  const queue: string[][] = [[start]];
  const visited = new Set([start]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1]!;
    for (const next of game.availableAreaIds(current)) {
      if (visited.has(next) || game.world.areas.get(next)?.initId !== game.getView().activeInit) continue;
      const candidate = [...path, next];
      if (next === targetAreaId) return candidate;
      visited.add(next);
      queue.push(candidate);
    }
  }
  return null;
}

function acquireMapParty(game: GameInstance, characterIds: readonly string[]): void {
  for (const characterId of characterIds) {
    const variant = game.rosterSystem.getAllVariants()
      .filter(candidate => candidate.proto === characterId)
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!variant) throw new Error(`No registered Variant for Map party Character "${characterId}"`);
    if (!game.state.roster?.[variant.id]) game.mutations.acquireCharacter(variant.id, 'story');
  }
}

function finishGlobalStory(game: GameInstance): void {
  let guard = 0;
  while (game.getView().currentStory && guard++ < 80) {
    const result = game.story.advanceStory();
    if (!result.success && 'error' in result && result.error === 'ChoiceRequired') game.story.advanceStory(0);
    else if (!result.success) break;
  }
}

/** Boots the default Datapack, enters the default Init, and opens the Map entry Spot. */
async function bootToSpot(mapId: string, finishStory = true): Promise<{
  game: GameInstance;
  controller: UIController;
  root: HTMLElement;
  spot: SpotDef;
  functionalityId: string;
  entryButton: HTMLButtonElement;
}> {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>('#app')!;
  const game = createAppRuntime();
  games.push(game);
  await loadDefaultDatapack(game);
  const controller = new UIController(game, root);
  controllers.push(controller);
  controller.mount();

  root.querySelector<SVGElement>(`[data-init-select="${DEFAULT_INIT_ID}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  let startInit = root.querySelector<HTMLButtonElement>(`[data-init="${DEFAULT_INIT_ID}"]`);
  if (!startInit) {
    root.querySelector<HTMLButtonElement>(`[data-init-purchase="${DEFAULT_INIT_ID}"]`)!.click();
    startInit = root.querySelector<HTMLButtonElement>(`[data-init="${DEFAULT_INIT_ID}"]`);
  }
  startInit!.click();
  root.querySelector<HTMLButtonElement>('[data-init-confirm]')!.click();
  await Promise.resolve();
  if (finishStory) {
    finishGlobalStory(game);
    controller.render();
  }

  const entry = [...game.world.spots.values()]
    .flatMap(spot => (spot.functionalities ?? [])
      .filter(fn => fn.kind === 'mapEntry' && fn.mapId === mapId)
      .map(fn => ({ spot, functionalityId: fn.id })))
    .find(candidate => candidate.spot.areaId !== undefined);
  if (!entry) throw new Error(`Map "${mapId}" has no Spot entry`);
  const { spot, functionalityId } = entry;

  const path = findAreaPath(game, spot.areaId);
  if (!path) throw new Error(`Area "${spot.areaId}" is unreachable`);
  for (const areaId of path.slice(1)) {
    root.querySelector<HTMLButtonElement>(`[data-ui-area-nav="reachable:${areaId}"]`)!.click();
  }
  if ((game.state.spotLevels[spot.id] ?? 0) === 0) {
    root.querySelector<HTMLButtonElement>(`[data-ui-spot-card="${spot.id}"] [data-upgrade="${spot.id}"]`)!.click();
  }
  const map = game.registry.maps.get(mapId)!;
  acquireMapParty(game, map.partyCharacterIds);
  const entryButton = root.querySelector<HTMLButtonElement>(
    `[data-map-entry-spot="${spot.id}"][data-map-entry-functionality="${functionalityId}"][data-map-entry-open="${mapId}"]`,
  )!;
  return { game, controller, root, spot, functionalityId, entryButton };
}

async function bootMap(mapId: string): Promise<{
  game: GameInstance;
  controller: UIController;
  root: HTMLElement;
  spot: SpotDef;
  functionalityId: string;
  entryLabel: string;
}> {
  const booted = await bootToSpot(mapId);
  const entryLabel = booted.entryButton.textContent?.trim() ?? '';
  booted.entryButton.click();
  if (booted.game.mapRun.getSnapshot()) throw new Error('Opening Map preparation must not create a Run.');
  const start = booted.root.querySelector<HTMLButtonElement>(`[data-map-entry-start="${mapId}"]`);
  if (!start) throw new Error(`Map preparation did not render a start action for "${mapId}"`);
  start.click();
  finishGlobalStory(booted.game);
  booted.controller.render();
  return { ...booted, entryLabel };
}

function clickMove(root: HTMLElement, nodeId: string): void {
  const location = root.querySelector<HTMLElement>(`[data-map-location-node-id="${nodeId}"]`);
  const submit = root.querySelector<HTMLButtonElement>('[data-map-location-submit]');
  if (location && submit) {
    location.click();
    if (submit.disabled) throw new Error(`Map Workspace did not allow location "${nodeId}"`);
    submit.click();
    return;
  }
  const button = root.querySelector<HTMLButtonElement>(`[data-map-move-to="${nodeId}"]`);
  if (!button) throw new Error(`no move button for "${nodeId}"`);
  if (button.disabled) throw new Error(`move button for "${nodeId}" is disabled`);
  button.click();
}

/** Swaps each character to a damaging Hand Action through the rendered buttons. */
function chooseDamagingActions(root: HTMLElement): void {
  for (const characterId of PARTY) {
    const member = root.querySelector<HTMLElement>(`[data-map-party-member="${characterId}"]`);
    if (!member) continue;
    const prepared = member.querySelector<HTMLElement>(`[data-map-region-key="prepared:${characterId}"] strong`)?.textContent ?? '';
    if (DAMAGE_ACTION_LABEL.test(prepared)) continue;
    const hand = [...member.querySelectorAll<HTMLButtonElement>('[data-map-action-swap]')];
    hand.find(button => DAMAGE_ACTION_LABEL.test(button.textContent ?? ''))?.click();
  }
}

/** Selects every pending party target on the rendered Target pickers. */
function selectPartyTargets(root: HTMLElement): void {
  for (const characterId of PARTY) {
    const picker = root.querySelector<HTMLElement>(`[data-map-region-key="targets:${characterId}"]`);
    if (!picker) continue;
    picker.querySelector<HTMLButtonElement>(`[data-map-target][data-target-character-id="${characterId}"]`)?.click();
  }
}

/** Prefers the zero-cost Rest Action so shared-supply costs never block a purchase. */
function chooseRestActions(root: HTMLElement): void {
  for (const characterId of PARTY) {
    const member = root.querySelector<HTMLElement>(`[data-map-party-member="${characterId}"]`);
    if (!member) continue;
    const prepared = member.querySelector<HTMLElement>(`[data-map-region-key="prepared:${characterId}"] strong`)?.textContent ?? '';
    if (prepared.includes('调整呼吸')) continue;
    [...member.querySelectorAll<HTMLButtonElement>('[data-map-action-swap]')]
      .find(button => (button.textContent ?? '').includes('调整呼吸'))?.click();
  }
}

function commitRound(root: HTMLElement): void {
  selectPartyTargets(root);
  const commit = root.querySelector<HTMLButtonElement>('[data-map-commit]');
  if (!commit) throw new Error('no Encounter Commit button is rendered');
  if (commit.disabled) throw new Error('the Encounter Commit button is disabled');
  commit.click();
}

function playBattleRounds(game: GameInstance, root: HTMLElement): void {
  const startActivity = game.mapRun.getSnapshot()?.activeActivity?.activityId ?? null;
  for (let round = 0; round < 10; round += 1) {
    const run = game.mapRun.getSnapshot();
    if (!run || run.activeEncounter === null || run.status !== 'inProgress') return;
    if ((run.activeActivity?.activityId ?? null) !== startActivity) return;
    chooseDamagingActions(root);
    commitRound(root);
  }
  throw new Error('the battle did not finish within 10 rounds');
}

const games: GameInstance[] = [];
const controllers: UIController[] = [];

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  for (const game of games.splice(0)) if (game.running) game.stop();
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('Gameplay B basic map UI', () => {
  test('renders every Map entry with its authored "进入…" label', async () => {
    const { root } = await bootToSpot('gameplay-b:map:linear-battle');
    const labels = [...root.querySelectorAll<HTMLButtonElement>('[data-map-entry-open]')]
      .map(button => button.textContent?.trim() ?? '');
    expect(labels).toEqual(expect.arrayContaining([
      '进入现场调查路线',
      '进入极简战斗演练',
      '进入废弃走廊战斗',
      '进入废弃活动室',
      '进入分叉调查路线',
      '进入连续调查与员工通道',
    ]));
    expect(labels).not.toContain('开始地图');
  });

  test('opens the preparation page without creating a Run', async () => {
    const { game, root, entryButton, spot } = await bootToSpot('gameplay-b:map:linear-battle');
    expect(game.mapRun.getSnapshot()).toBeNull();
    entryButton.click();
    expect(root.querySelector('[data-map-entry-workspace]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-frame="map-entry"]')).not.toBeNull();
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(root.querySelector(`[data-map-entry-start="gameplay-b:map:linear-battle"]`)).not.toBeNull();
    const map = game.registry.maps.get('gameplay-b:map:linear-battle')!;
    expect(root.querySelector('.map-entry-workspace__overview h1')?.textContent).toBe(map.name);
    expect(root.querySelector('.map-entry-workspace__overview > p')?.textContent).toBe(map.entryInfo?.description);
    expect([...root.querySelectorAll('.map-entry-workspace__tips li')].map(item => item.textContent))
      .toEqual(map.entryInfo?.tips);
  });

  test('blocks the facility entry while the opening Story is active', async () => {
    const { game, controller, root, entryButton } = await bootToSpot('gameplay-b:map:linear-battle', false);
    expect(game.story.isBlockingInteraction()).toBe(true);
    expect(entryButton.disabled).toBe(true);
    entryButton.click();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(root.querySelector('[data-map-entry-workspace]')).toBeNull();
    expect(game.mapRun.getSnapshot()).toBeNull();
  });

  test('returns to the original game route when the source Area changes without abandoning its Run', async () => {
    const mapId = 'gameplay-b:map:linear-battle';
    const { game, controller, root, spot, entryButton } = await bootToSpot(mapId);
    entryButton.click();
    root.querySelector<HTMLButtonElement>(`[data-map-entry-start="${mapId}"]`)!.click();
    const started = game.mapRun.getSnapshot()!;
    root.querySelector<HTMLButtonElement>('[data-map-back-to-entry]')!.click();
    expect(game.mapRun.getSnapshot()).toEqual(started);

    const nextAreaId = game.availableAreaIds(spot.areaId).find(areaId => areaId !== spot.areaId);
    expect(nextAreaId).toBeDefined();
    controller.commands.travelToArea(nextAreaId!);
    controller.render();

    expect(game.getView().currentAreaId).toBe(nextAreaId);
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(root.querySelector('[data-map-entry-workspace]')).toBeNull();
    expect(game.mapRun.getSnapshot()).toEqual(started);
  });

  test('returns to the original game route when the source functionality disappears', async () => {
    const mapId = 'gameplay-b:map:linear-battle';
    const { game, controller, root, spot, entryButton } = await bootToSpot(mapId);
    entryButton.click();
    root.querySelector<HTMLButtonElement>(`[data-map-entry-start="${mapId}"]`)!.click();
    root.querySelector<HTMLButtonElement>('[data-map-back-to-entry]')!.click();
    const activeRun = game.mapRun.getSnapshot()!;
    const originalFunctionalities = game.spotFunctionalitySystem.functionalitiesOf.bind(game.spotFunctionalitySystem);
    vi.spyOn(game.spotFunctionalitySystem, 'functionalitiesOf').mockImplementation((candidate, state) =>
      candidate.id === spot.id ? [] : originalFunctionalities(candidate, state));

    controller.render();

    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(root.querySelector('[data-map-entry-workspace]')).toBeNull();
    expect(game.mapRun.getSnapshot()).toEqual(activeRun);
  });

  test('returns the live Run to preparation, confirms restart and abandon without implicit starts', async () => {
    const mapId = 'gameplay-b:map:linear-battle';
    const { game, controller, root } = await bootMap(mapId);
    const firstRun = game.mapRun.getSnapshot()!;
    root.querySelector<HTMLButtonElement>('[data-map-back-to-entry]')!.click();
    expect(game.mapRun.getSnapshot()).toEqual(firstRun);
    expect(root.querySelector('[data-map-entry-mode="resume"]')).not.toBeNull();

    root.querySelector<HTMLElement>('[data-map-region-key="management"] summary')!.click();
    root.querySelector<HTMLButtonElement>('[data-map-restart]')!.click();
    expect(game.mapRun.getSnapshot()).toEqual(firstRun);
    document.querySelector<HTMLButtonElement>('.modal-close')!.click();
    expect(game.mapRun.getSnapshot()).toEqual(firstRun);
    expect(root.querySelector('[data-map-focus-key="map-restart"]')).toBe(document.activeElement);

    root.querySelector<HTMLButtonElement>('[data-map-restart]')!.click();
    document.querySelector<HTMLButtonElement>('[data-modal-action="restart-map-run"]')!.click();
    const restarted = game.mapRun.getSnapshot()!;
    expect(restarted.runId).not.toBe(firstRun.runId);
    expect(restarted.currentNodeId).toBe(game.registry.maps.get(mapId)!.startNodeId);
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'map', runId: restarted.runId });

    root.querySelector<HTMLButtonElement>('[data-map-back-to-entry]')!.click();
    const beforeAbandon = game.mapRun.getSnapshot()!;
    root.querySelector<HTMLElement>('[data-map-region-key="management"] summary')!.click();
    root.querySelector<HTMLButtonElement>('[data-map-abandon]')!.click();
    expect(game.mapRun.getSnapshot()).toEqual(beforeAbandon);
    document.querySelector<HTMLButtonElement>('.modal-close')!.click();
    expect(game.mapRun.getSnapshot()).toEqual(beforeAbandon);

    root.querySelector<HTMLButtonElement>('[data-map-abandon]')!.click();
    document.querySelector<HTMLButtonElement>('[data-modal-action="abandon-map-run"]')!.click();
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'map-entry', mapId });
    expect(root.querySelector('[data-map-entry-mode="fresh"]')).not.toBeNull();
    expect(root.querySelector(`[data-map-entry-start="${mapId}"]`)).not.toBeNull();
  });

  test('P0 plays the bundled linear battle and reaches the exit through the Workspace', async () => {
    const mapId = 'gameplay-b:map:linear-battle';
    const { game, root, entryLabel } = await bootMap(mapId);
    expect(entryLabel).toBe('进入废弃走廊战斗');
    const runId = game.mapRun.getSnapshot()!.runId;

    clickMove(root, 'b');
    expect(game.mapRun.getSnapshot()!.activeEncounter?.nodeId).toBe('b');
    expect(root.querySelector('[data-map-activity-state]')).toBeNull();
    expect(root.querySelector('[data-map-move-choices]')).toBeNull();

    const beforeEncounterRound = game.mapRun.getSnapshot()!;
    chooseDamagingActions(root);
    commitRound(root);
    const injuredRun = game.mapRun.getSnapshot()!;
    expect(injuredRun.partyHp).not.toEqual(beforeEncounterRound.partyHp);
    root.querySelector<HTMLButtonElement>('[data-map-back-to-entry]')!.click();
    expect(game.mapRun.getEntryView(mapId).mode).toBe('resume');
    expect(game.mapRun.getEntryView(mapId).party.map(member => ({
      characterId: member.characterId, currentHp: member.currentHp, maxHp: member.maxHp,
    }))).toEqual(injuredRun.partyHp.map(member => ({
      characterId: member.characterId,
      currentHp: member.currentHp,
      maxHp: game.registry.maps.get(mapId)!.initialPartyHp.find(hp => hp.characterId === member.characterId)!.maxHp,
    })));
    root.querySelector<HTMLButtonElement>(`[data-map-entry-continue-run="${runId}"]`)!.click();
    expect(game.mapRun.getSnapshot()).toEqual(injuredRun);

    playBattleRounds(game, root);
    const cleared = game.mapRun.getSnapshot()!;
    expect(cleared.activeEncounter).toBeNull();
    expect(cleared.status).toBe('inProgress');
    expect(cleared.currentNodeId).toBe('b');
    expect(root.querySelector('[data-map-run-result]')).toBeNull();

    clickMove(root, 'c');
    expect(game.mapRun.getWorkspaceView(runId)).toMatchObject({ kind: 'success', result: { mapId, runId } });
    expect(root.querySelector('[data-map-run-result="success"]')).not.toBeNull();
  });

  test('P1 renders fixed-order activities and completes Battle → Rest → Shop before the exit', async () => {
    const mapId = 'gameplay-b:map:activity-hall';
    const { game, root } = await bootMap(mapId);
    const runId = game.mapRun.getSnapshot()!.runId;

    clickMove(root, 'b');
    const activityStates = () => [...root.querySelectorAll('[data-map-activity-state]')]
      .map(element => element.getAttribute('data-map-activity-state'));
    expect(activityStates()).toEqual(['active', 'pending', 'pending']);
    expect(root.querySelector('[data-map-move-choices]')).toBeNull();

    playBattleRounds(game, root);
    expect(activityStates()).toEqual(['completed', 'active', 'pending']);
    expect(root.querySelector('[data-map-move-choices]')).toBeNull();
    expect(root.querySelector('[data-map-rest-rounds]')?.textContent).toContain('1 / 2');

    chooseRestActions(root);
    commitRound(root);
    expect(root.querySelector('[data-map-rest-rounds]')?.textContent).toContain('2 / 2');
    chooseRestActions(root);
    commitRound(root);

    expect(activityStates()).toEqual(['completed', 'completed', 'active']);
    expect(root.querySelector('[data-map-move-choices]')).toBeNull();
    expect(root.querySelector('[data-map-shop-offer]')).not.toBeNull();
    const purchase = root.querySelector<HTMLButtonElement>('[data-map-shop-offer][data-offer-id="spare-parts"]');
    expect(purchase).not.toBeNull();
    expect(purchase!.disabled).toBe(false);
    purchase!.click();
    expect(game.mapRun.getSnapshot()!.teamResources.find(row => row.resourceId === 'clues')!.value).toBe(2);

    const leave = root.querySelector<HTMLButtonElement>('[data-map-shop-leave]');
    expect(leave).not.toBeNull();
    leave!.click();
    expect(root.querySelector('[data-map-shop-offer]')).toBeNull();
    expect(activityStates()).toEqual(['completed', 'completed', 'completed']);
    expect(root.querySelector('[data-flow-host-key] [data-map-location-node-id="c"][data-map-location-selectable="true"]')).not.toBeNull();

    clickMove(root, 'c');
    expect(game.mapRun.getWorkspaceView(runId)).toMatchObject({ kind: 'success' });
    expect(root.querySelector('[data-map-run-result="success"]')).not.toBeNull();
  });

  test('P3 mirrors the Runtime Edge condition in the move buttons', async () => {
    const mapId = 'gameplay-b:map:continuous-conditional';
    const { game, root } = await bootMap(mapId);
    const runId = game.mapRun.getSnapshot()!.runId;

    clickMove(root, 'b');
    playBattleRounds(game, root);
    clickMove(root, 'c');
    expect(root.querySelector('[data-map-rest-rounds]')?.textContent).toContain('1 / 2');
    chooseRestActions(root);
    commitRound(root);
    chooseRestActions(root);
    commitRound(root);

    const shortcut = root.querySelector<HTMLButtonElement>('[data-map-location-node-id="f"]');
    expect(shortcut).not.toBeNull();
    expect(shortcut!.disabled).toBe(true);
    expect(shortcut!.getAttribute('aria-label')).toContain('需要 pass ≥ 1');
    const defaultRoute = root.querySelector<HTMLButtonElement>('[data-map-location-node-id="d"]');
    expect(defaultRoute).not.toBeNull();
    expect(defaultRoute!.disabled).toBe(false);
    expect(() => game.moveMap(runId, 'f')).toThrow(/unsatisfied MapRun condition/);

    clickMove(root, 'd');
    expect(game.mapRun.getSnapshot()!.currentNodeId).toBe('d');
    expect(game.mapRun.getSnapshot()!.activeActivity?.kind).toBe('shop');
  });
});
