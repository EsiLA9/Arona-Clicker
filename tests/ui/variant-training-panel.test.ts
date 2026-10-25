// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { VariantTrainingPort, VariantTrainingView } from '../../src/arona-clicker/contracts/character/variant-training';
import { VariantTranslationMode, type VariantTranslationPreview } from '../../src/arona-clicker/contracts/character/variant-translation';
import { mountVariantTrainingPanel } from '../../src/ui/development/variant-training-panel';
import { mountGameplayBQuickTestConsole } from '../../src/ui/development/gameplay-b-quick-test-console';

function createPort(owned = true) {
  let view: VariantTrainingView = {
    phase: 'preparation', variantId: 'Hoshino', displayName: '小鸟游星野', owned,
    sources: [
      { id: 'owned', label: '当前持有' },
      { id: 'normal', label: '普通切片' },
      { id: 'enhanced', label: '强化切片' },
    ], translation: null, round: 1, commitVersion: 0, partyHp: null, partyMaxHp: null,
    enemyHp: null, enemyMaxHp: 6, outcome: null, lastRound: null,
  };
  const calls = { previews: [] as string[], starts: [] as string[], commits: [] as number[], saves: 0, loads: 0 };
  let rejectPreview = false;
  let lastSource = 'normal';
  const member = {
    slotId: 'party', variantId: 'Hoshino', statisticsCharacterId: 'Hoshino',
    source: { kind: 'slice' as const, slice: { id: 'variant-training:slice:normal', revision: 1 } },
    profile: { id: 'variant-training:profile:hoshino', revision: 1 },
    input: { attributes: [{ id: 'readiness', value: 12 }], capabilityIds: [], tags: [], candidateSourceIds: [] },
    build: {
      mode: VariantTranslationMode.GameplayB, grades: [{ attributeId: 'readiness', rawValue: 12, gradeId: 'normal' }],
      parameters: { maxHp: 10, baseAgility: 2, maxAgility: 8 }, capabilityIds: [], tags: [], candidateSourceIds: [],
    },
  };
  const preview: VariantTranslationPreview = { status: 'ready', token: 'token-1', members: [member] };
  const port: VariantTrainingPort = {
    getView: () => view,
    preview: (source) => {
      calls.previews.push(source);
      lastSource = source;
      if (rejectPreview) throw new Error('预览故障');
      return source === 'owned' && !owned
        ? { status: 'blocked', issues: [{ code: 'variant-not-owned', path: 'members[0]', message: '当前未持有该角色，可先选择普通或强化切片' }] }
        : { ...preview, token: `token-${calls.previews.length}`, members: [{
          ...member,
          source: source === 'owned'
            ? { kind: 'owned' as const, variantId: 'Hoshino' }
            : { kind: 'slice' as const, slice: { id: `variant-training:slice:${source}`, revision: source === 'enhanced' ? 2 : 1 } },
        }] };
    },
    start: token => {
      calls.starts.push(token);
      const selectedMember = {
        ...member,
        source: lastSource === 'owned'
          ? { kind: 'owned' as const, variantId: 'Hoshino' }
          : { kind: 'slice' as const, slice: { id: `variant-training:slice:${lastSource}`, revision: lastSource === 'enhanced' ? 2 : 1 } },
      };
      view = { ...view, phase: 'battle', translation: { schemaVersion: 1, mode: VariantTranslationMode.GameplayB, entry: { id: 'entry', revision: 1 }, rules: { id: 'rules', revision: 1 }, activeInit: 'init', contentEvidence: 'evidence', members: [selectedMember] }, round: 1, commitVersion: 0, partyHp: 10, partyMaxHp: 10, enemyHp: 6 };
      return view;
    },
    commitRound: version => {
      calls.commits.push(version);
      const commits = calls.commits.length;
      view = {
        ...view,
        phase: commits >= 3 ? 'result' : 'battle', round: commits + 1, commitVersion: version + 1,
        partyHp: commits >= 2 ? 0 : 8, enemyHp: commits >= 3 ? 0 : 4,
        outcome: commits >= 3 ? 'success' : null,
        lastRound: { round: commits, order: [{ side: 'enemy', agility: 4, skipped: false }, { side: 'party', agility: 2, skipped: commits === 2 }] },
      };
      return view;
    },
    save: () => { calls.saves += 1; return { schemaVersion: 1, templateVersion: 1, binding: 'binding', translation: view.translation!, mapRun: {} as never }; },
    load: checkpoint => {
      calls.loads += 1;
      if (!checkpoint || typeof checkpoint !== 'object') throw new Error('检查点无效');
      const saved = checkpoint as { translation: NonNullable<VariantTrainingView['translation']> };
      view = { ...view, phase: 'battle', translation: saved.translation, partyHp: 8, enemyHp: 4, round: 2, commitVersion: 1, outcome: null };
      return view;
    },
  };
  return { port, calls, setRejectPreview: (value: boolean) => { rejectPreview = value; }, setView: (next: VariantTrainingView) => { view = next; }, getView: () => view };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('Variant training panel', () => {
  test('keeps controls mounted through preview, battle, rounds, result and checkpoint restore', () => {
    const { port, calls, getView } = createPort();
    const host = document.createElement('dialog');
    document.body.append(host);
    mountVariantTrainingPanel(host, port);
    const select = host.querySelector<HTMLSelectElement>('[data-training-source]')!;
    const previewButton = host.querySelector<HTMLButtonElement>('[data-training-preview]')!;
    const startButton = host.querySelector<HTMLButtonElement>('[data-training-start]')!;
    const commitButton = host.querySelector<HTMLButtonElement>('[data-training-commit]')!;
    const originalSelect = select;
    const originalButton = previewButton;

    select.value = 'normal';
    previewButton.click();
    expect(calls.previews).toEqual(['normal']);
    expect(host.querySelector('[data-training-preview-content]')?.textContent).toContain('来源：普通切片（切片版本 r1）');
    expect(host.querySelector('[data-training-preview-content]')?.textContent).toContain('原始值：战备值 12');
    expect(host.querySelector('[data-training-preview-content]')?.textContent).toContain('→普通');
    expect(host.querySelector('[data-training-preview-content]')?.textContent).toContain('HP 10，敏捷 2/8');
    expect(startButton.disabled).toBe(false);
    startButton.click();
    expect(calls.starts).toEqual(['token-1']);
    expect(host.querySelector('[data-training-battle-content]')?.textContent).toContain('HP 10/10');
    commitButton.click();
    expect(calls.commits).toEqual([0]);
    expect(host.querySelector('[data-training-battle-content]')?.textContent).toContain('训练靶 敏捷4');

    host.querySelector<HTMLButtonElement>('[data-training-save]')!.click();
    expect(calls.saves).toBe(1);
    expect(host.querySelector('[data-training-checkpoint-status]')?.textContent).toContain('当前页面内存');
    commitButton.click();
    expect(host.querySelector('[data-training-battle-content]')?.textContent).toContain('未行动');
    commitButton.click();
    expect(calls.commits).toEqual([0, 1, 2]);
    expect(getView().phase).toBe('result');
    expect(host.querySelector('[data-training-result-content]')?.textContent).toContain('成功');
    expect(host.querySelector('[data-training-result-content]')?.textContent).toContain('HP 10');
    expect(select.disabled).toBe(false);
    expect(previewButton.disabled).toBe(false);
    expect(startButton.textContent).toBe('重新开始演练');
    select.value = 'enhanced';
    select.dispatchEvent(new Event('change'));
    previewButton.click();
    expect(host.querySelector('[data-training-preview-content]')?.textContent).toContain('强化切片（切片版本 r2）');
    startButton.click();
    expect(calls.starts).toEqual(['token-1', 'token-2']);
    expect(getView().phase).toBe('battle');
    host.querySelector<HTMLButtonElement>('[data-training-load]')!.click();
    expect(calls.loads).toBe(1);
    expect(host.querySelector('[data-training-battle-region]')?.hasAttribute('hidden')).toBe(false);
    expect(host.querySelector('[data-training-battle-content]')?.textContent).toContain('回合 2');
    expect(host.querySelector('[data-training-battle-content]')?.textContent).toContain('普通切片（切片版本 r1）');
    expect(select.value).toBe('enhanced');
    expect(host.querySelector('[data-training-source]')).toBe(originalSelect);
    expect(host.querySelector('[data-training-preview]')).toBe(originalButton);
  });

  test('surfaces unowned, blocked and thrown preview errors as text', () => {
    const fixture = createPort(false);
    const host = document.createElement('div');
    document.body.append(host);
    mountVariantTrainingPanel(host, fixture.port);
    const source = host.querySelector<HTMLSelectElement>('[data-training-source]')!;
    const previewButton = host.querySelector<HTMLButtonElement>('[data-training-preview]')!;
    const startButton = host.querySelector<HTMLButtonElement>('[data-training-start]')!;
    previewButton.click();
    expect(startButton.disabled).toBe(false);
    fixture.setRejectPreview(true);
    previewButton.click();
    expect(host.querySelector('[data-training-preview-content]')?.textContent).toBe('预览故障');
    expect(host.querySelector('[data-training-preview-content]')?.querySelector('script')).toBeNull();
    expect(startButton.disabled).toBe(true);
    startButton.click();
    expect(fixture.calls.starts).toEqual([]);

    fixture.setRejectPreview(false);
    source.value = 'owned';
    source.dispatchEvent(new Event('change'));
    previewButton.click();
    expect(host.querySelector('[data-training-message]')?.textContent).toContain('未持有');
    expect(host.querySelector('[data-training-preview-content]')?.textContent).toContain('未持有');
    expect(startButton.disabled).toBe(true);
  });

  test('refreshes only panel state and keeps the office entry explicit', () => {
    const fixture = createPort(false);
    const host = document.createElement('div');
    document.body.append(host);
    const enter = vi.fn(() => {
      fixture.setView({ ...fixture.getView(), phase: 'preparation', translation: null, partyHp: null, enemyHp: null, outcome: null });
      return true;
    });
    const refresh = mountVariantTrainingPanel(host, fixture.port, enter);
    const select = host.querySelector('[data-training-source]');
    const preview = host.querySelector<HTMLButtonElement>('[data-training-preview]')!;
    expect(host.querySelector('[data-training-summary]')?.textContent).toContain('当前未持有');
    fixture.setView({ ...fixture.getView(), owned: true });
    preview.click();
    expect(host.querySelector('[data-training-summary]')?.textContent).toContain('当前已持有');
    host.querySelector<HTMLButtonElement>('[data-training-start]')!.click();
    expect(host.querySelector('[data-training-battle-region]')?.hasAttribute('hidden')).toBe(false);
    host.querySelector<HTMLButtonElement>('[data-training-office]')!.click();
    expect(enter).toHaveBeenCalledOnce();
    expect(host.querySelector('[data-training-battle-region]')?.hasAttribute('hidden')).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-training-start]')?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-training-preview]')?.disabled).toBe(false);
    expect(host.querySelector('[data-training-source]')).toBe(select);
    expect(host.querySelector('[data-training-summary]')?.textContent).toContain('当前已持有');
  });

  test('refreshes the panel when the existing console closes and opens again', () => {
    const fixture = createPort();
    const getView = vi.spyOn(fixture.port, 'getView');
    const game = {
      state: { activeInit: 'base:init:schale_office' },
      mutations: {},
      registry: {
        loadedModNames: new Set<string>(), maps: new Map(), characterVariants: new Map(),
        resourceDisplays: new Map(), spotDisplays: new Map(),
        resourceDisplayOwnerOf: () => undefined, spotOwnerOf: () => undefined, characterVariantOwnerOf: () => undefined,
      },
      mapRun: { getSnapshot: () => null },
      variantTraining: fixture.port,
    } as unknown as Parameters<typeof mountGameplayBQuickTestConsole>[0];
    mountGameplayBQuickTestConsole(game);
    const dialog = document.querySelector<HTMLDialogElement>('[data-gameplay-b-test-console]')!;
    const toggle = document.querySelector<HTMLButtonElement>('.gameplay-b-test-console-toggle')!;
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
    const source = dialog.querySelector('[data-training-source]');

    toggle.click();
    expect(getView).toHaveBeenCalledTimes(2);
    dialog.querySelector<HTMLButtonElement>('[data-test-console-close]')!.click();
    toggle.click();
    expect(getView).toHaveBeenCalledTimes(3);
    expect(dialog.querySelector('[data-training-source]')).toBe(source);
  });
});
