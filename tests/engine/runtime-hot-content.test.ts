import { describe, expect, test, vi } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { defaultDatapack } from '../../src/arona-clicker/content';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import type { RuntimeSpotInput } from '../../src/arona-clicker/contracts/runtime-content';

class CountingRuntime extends AronaClickerRuntime {
  reloadCount = 0;

  override reloadPreservingState(datapacks: Datapack[]): void {
    this.reloadCount += 1;
    super.reloadPreservingState(datapacks);
  }
}

const input = (name = 'Desk'): RuntimeSpotInput => ({
  idName: 'desk',
  areaId: 'base:area:schale_main',
  name,
  description: 'Temporary desk',
  purchaseOptions: [{ id: 'purchase', costs: [{ type: 'resource', resourceId: 'base:resource:credit', amount: 1 }] }],
});

describe('AronaClickerRuntime Spot 热 CRUD', () => {
  test('RuntimeDefinitionEditor 只翻译编辑意图并使用 Coordinator 当前上下文', () => {
    const game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    expect(game.spot.content!.setModMetadata({ modName: 'draft-mod', displayName: 'Draft Mod', version: '1.0.0', author: '', description: '' }).ok).toBe(true);

    const editor = game.runtimeDefinitionEditor;
    const created = editor.createSpot(input());
    expect(created).toMatchObject({ ok: true, operation: 'create', revision: 1 });

    const replaced = editor.replaceSpot('desk', input('Renamed'));
    expect(replaced).toMatchObject({ ok: true, operation: 'replace', revision: 2 });
    expect(game.registry.spots.get('draft-mod:spot:desk')?.name).toBe('Renamed');
  });

  test('SpotService.content create/replace/suspend/resume/delete 全程不走整包重载', () => {
    const game = new CountingRuntime();
    game.init([defaultDatapack]);
    const buildAll = vi.spyOn(game.gameNumSystem, 'buildAll');
    const visibilityRebuild = vi.spyOn(game.visibilityEngine, 'rebuild');
    const content = game.spot.content;
    expect(content).toBeDefined();
    if (!content) return;

    expect(content.setModMetadata({ modName: 'draft-mod', displayName: 'Draft Mod', version: '1.0.0', author: '', description: '' }).ok).toBe(true);
    let result = content.create('draft-mod', input(), content.getState().revision);
    expect(result.ok).toBe(true);
    expect(game.reloadCount).toBe(0);
    expect(game.registry.spots.get('draft-mod:spot:desk')?.name).toBe('Desk');
    expect(game.getRuntimeMod()?.spots).toHaveLength(1);

    result = content.replace('draft-mod', 'desk', input('Renamed'), content.getState().revision);
    expect(result.ok).toBe(true);
    expect(game.registry.spots.get('draft-mod:spot:desk')?.name).toBe('Renamed');

    result = content.suspend('draft-mod', 'desk', content.getState().revision);
    expect(result).toMatchObject({ ok: true, operation: 'suspend', transition: { before: 'resolved', after: 'suspended' } });
    expect(game.registry.spots.has('draft-mod:spot:desk')).toBe(false);
    expect(game.registry.spotIncludingSuspended('draft-mod:spot:desk')?.name).toBe('Renamed');

    result = content.resume('draft-mod', 'desk', content.getState().revision);
    expect(result).toMatchObject({ ok: true, operation: 'resume', transition: { before: 'suspended', after: 'resolved' } });
    expect(game.registry.spots.get('draft-mod:spot:desk')?.name).toBe('Renamed');

    result = content.delete('draft-mod', 'desk', 'retain', content.getState().revision);
    expect(result.ok).toBe(true);
    expect(game.registry.spots.has('draft-mod:spot:desk')).toBe(false);
    expect(game.getRuntimeMod()).not.toBeNull();
    expect(game.registry.spots.has('base:spot:credit_printer')).toBe(true);
    expect(game.reloadCount).toBe(0);
    expect(buildAll).not.toHaveBeenCalled();
    expect(visibilityRebuild).not.toHaveBeenCalled();
  });

  test('失败的 revision 不改变既有热内容', () => {
    const game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    const content = game.spot.content!;
    expect(content.create('draft-mod', input(), 0).ok).toBe(true);
    const stale = content.replace('draft-mod', 'desk', input('Stale'), 0);

    expect(stale.ok).toBe(false);
    expect(stale.diagnostics[0]?.code).toBe('stale-revision');
    expect(game.registry.spots.get('draft-mod:spot:desk')?.name).toBe('Desk');
  });

  test('首次非法 create 不会先建立空的 Runtime Mod 状态', () => {
    const game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    const content = game.spot.content!;
    const invalid = content.create('draft-mod', { ...input(), name: '' }, 0);

    expect(invalid.ok).toBe(false);
    expect(game.getRuntimeMod()).toBeNull();
    expect(content.getState().modName).toBeNull();
    expect(content.getState().revision).toBe(0);
  });

  test('delete + purge 只清理目标 Spot 的当前状态、快照和 Tag 覆盖', () => {
    const game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    const content = game.spot.content!;
    expect(content.create('draft-mod', input(), 0).ok).toBe(true);

    const spotId = 'draft-mod:spot:desk';
    const state = game.state as unknown as PlayerState;
    state.spotLevels[spotId] = 3;
    state.spotManagers[spotId] = 'Arona';
    state.spotTagOverrides = { [spotId]: { added: [['draft-mod:office']], removed: [] } };
    state.initSnapshots = {
      'base:init:schale_office': {
        spotLevels: { [spotId]: 2 },
        spotManagers: { [spotId]: 'Arona' },
      },
    } as unknown as PlayerState['initSnapshots'];

    const result = content.delete('draft-mod', 'desk', 'purge', content.getState().revision);

    expect(result.ok).toBe(true);
    expect(state.spotLevels[spotId]).toBeUndefined();
    expect(state.spotManagers[spotId]).toBeUndefined();
    expect(state.initSnapshots?.['base:init:schale_office']?.spotLevels[spotId]).toBeUndefined();
    expect(state.initSnapshots?.['base:init:schale_office']?.spotManagers[spotId]).toBeUndefined();
    expect(state.spotTagOverrides?.[spotId]).toBeUndefined();
  });

  test('热创建 Spot 不再从缺少 Affector functionality 的定义产生持续产出', () => {
    const game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    const content = game.spot.content!;
    expect(content.create('draft-mod', input(), 0).ok).toBe(true);

    const state = game.state as unknown as PlayerState;
    state.resources['base:resource:credit'] = 100;
    const before = game.gameNumSystem.evaluateResourceGain('base:resource:credit', state);
    const unlocked = game.spot.unlockSpot('draft-mod:spot:desk');
    const after = game.gameNumSystem.evaluateResourceGain('base:resource:credit', state);

    expect(unlocked).toMatchObject({ success: true, spotId: 'draft-mod:spot:desk' });
    expect(state.spotLevels['draft-mod:spot:desk']).toBe(1);
    expect(after - before).toBe(0);
    expect(state.resources['base:resource:credit']).toBe(99);
  });

  test('Runtime Editor 的一个 Spot 可原子应用多类持续资源 Affector，并按等级线性增长', () => {
    const game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    const content = game.spot.content!;
    const spotInput = {
      ...input('Multi Resource Desk'),
      functionalities: [
        { id: 'credit', kind: 'flow' as const, resource: 'base:resource:credit', amount: 2 },
        { id: 'pyroxene', kind: 'linearYield' as const, resource: 'base:resource:pyroxene', amountPerLevel: 3 },
      ],
    };
    expect(content.create('draft-mod', spotInput, 0)).toMatchObject({ ok: true, revision: 1 });

    const state = game.state as unknown as PlayerState;
    state.resources['base:resource:credit'] = 100;
    const unlocked = game.spot.unlockSpot('draft-mod:spot:desk');
    expect(unlocked).toMatchObject({ success: true, spotId: 'draft-mod:spot:desk' });
    expect(game.gameNumSystem.evaluateSpotYields('draft-mod:spot:desk', state)).toEqual({
      'base:resource:credit': 2,
      'base:resource:pyroxene': 3,
    });

    game.mutations.setSpotLevel('draft-mod:spot:desk', 3);
    expect(game.gameNumSystem.evaluateSpotYields('draft-mod:spot:desk', state)).toEqual({
      'base:resource:credit': 2,
      'base:resource:pyroxene': 9,
    });

    const changed = content.replace('draft-mod', 'desk', {
      ...spotInput,
      functionalities: spotInput.functionalities.map(row => row.id === 'credit' ? { ...row, amount: 5 } : row),
    }, content.getState().revision);
    expect(changed).toMatchObject({ ok: true, revision: 2 });
    expect(game.gameNumSystem.evaluateSpotYields('draft-mod:spot:desk', state)).toEqual({
      'base:resource:credit': 5,
      'base:resource:pyroxene': 9,
    });
    expect(game.affectorEngine.getActiveInstances().filter(instance => instance.mountEntityId === 'draft-mod:spot:desk')).toHaveLength(2);
  });
});
