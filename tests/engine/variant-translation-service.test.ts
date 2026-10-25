import { describe, expect, test } from 'vitest';
import {
  VariantTranslationMode,
  type GameplayBVariantTranslationRules,
  type VariantTranslationContentResolver,
  type VariantTranslationEntry,
  type VariantTranslationProfile,
  type VariantTranslationRequest,
  type VariantTranslationSlice,
  type VariantTranslationRef,
} from '../../src/arona-clicker/contracts/character/variant-translation';
import { VariantTranslationService } from '../../src/arona-clicker/services/character/variant-translation-service';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import type { VariantProgress } from '../../src/arona-clicker/types/character';

const refs = {
  entry: { id: 'entry:test', revision: 1 },
  rules: { id: 'rules:test', revision: 1 },
  profileA: { id: 'profile:a', revision: 1 },
  profileB: { id: 'profile:b', revision: 1 },
  sceneSlice: { id: 'slice:scene', revision: 1 },
  requiredSlice: { id: 'slice:required', revision: 1 },
} satisfies Record<string, VariantTranslationRef>;

const rawFacts = {
  capabilityIds: ['capability:guard'],
  tags: [],
  candidateSourceIds: ['candidate:guard'],
};

function makeRules(): GameplayBVariantTranslationRules {
  return {
    ...refs.rules,
    mode: VariantTranslationMode.GameplayB,
    dimensions: [{
      id: 'power', min: 0, max: 100,
      grades: [
        { id: 'low', minInclusive: 0 },
        { id: 'high', minInclusive: 10 },
      ],
    }],
    parameters: {
      maxHp: { attributeId: 'power', values: [{ gradeId: 'low', value: 100 }, { gradeId: 'high', value: 200 }] },
      baseAgility: { attributeId: 'power', values: [{ gradeId: 'low', value: 5 }, { gradeId: 'high', value: 8 }] },
      maxAgility: { attributeId: 'power', values: [{ gradeId: 'low', value: 7 }, { gradeId: 'high', value: 12 }] },
    },
  };
}

function makeProfile(ref: VariantTranslationRef, variantId: string, base = 10): VariantTranslationProfile {
  return {
    ...ref,
    variantId,
    ...rawFacts,
    attributes: [{ id: 'power', base, perLevel: 2, perStar: 3, perAffectionLevel: 1 }],
  };
}

function makeSlice(ref: VariantTranslationRef, variantId = 'variant:a', power = 23): VariantTranslationSlice {
  return {
    ...ref,
    variantId,
    ...rawFacts,
    attributes: [{ id: 'power', value: power }],
  };
}

function makeEntry(): VariantTranslationEntry {
  return {
    ...refs.entry,
    mode: VariantTranslationMode.GameplayB,
    rules: refs.rules,
    minPartySize: 1,
    maxPartySize: 3,
    allowDuplicateVariants: false,
    owned: [
      { variantId: 'variant:a', profile: refs.profileA },
      { variantId: 'variant:b', profile: refs.profileB },
    ],
    slices: [
      { slice: refs.sceneSlice, ownership: 'scene-provided' },
      { slice: refs.requiredSlice, ownership: 'required' },
    ],
  };
}

function ownedProgress(variantId: string, overrides: Partial<VariantProgress> = {}): VariantProgress {
  return {
    variantId,
    acquiredVia: 'gacha',
    acquiredCount: 1,
    level: 3,
    exp: 0,
    stars: 2,
    affectionLevel: 4,
    affectionExp: 0,
    colorEquipment: null,
    ...overrides,
  };
}

function harness(options: {
  owned?: string[];
  level?: number;
  activeInit?: string;
  missingVariants?: string[];
} = {}) {
  let state = createDefaultState();
  state.activeInit = options.activeInit ?? 'init:current';
  state.roster = Object.fromEntries((options.owned ?? ['variant:a']).map(id => [
    id,
    ownedProgress(id, { level: options.level ?? 3 }),
  ])) as PlayerState['roster'];
  const entries = new Map<string, VariantTranslationEntry>([['entry:test', makeEntry()]]);
  const ruleData = new Map<string, GameplayBVariantTranslationRules>([['rules:test@1', makeRules()]]);
  const profiles = new Map<string, VariantTranslationProfile>([
    ['profile:a@1', makeProfile(refs.profileA, 'variant:a')],
    ['profile:b@1', makeProfile(refs.profileB, 'variant:b')],
  ]);
  const slices = new Map<string, VariantTranslationSlice>([
    ['slice:scene@1', makeSlice(refs.sceneSlice)],
    ['slice:required@1', makeSlice(refs.requiredSlice)],
  ]);
  const content: VariantTranslationContentResolver = {
    resolveEntry: id => entries.get(id),
    resolveRules: ref => ruleData.get(`${ref.id}@${ref.revision}`),
    resolveProfile: ref => profiles.get(`${ref.id}@${ref.revision}`),
    resolveSlice: ref => slices.get(`${ref.id}@${ref.revision}`),
  };
  const service = new VariantTranslationService({
    content,
    getState: () => state,
    getVariant: (id: string) => !options.missingVariants?.includes(id) && (id === 'variant:a' || id === 'variant:b')
      ? { id, proto: 'chara:same' }
      : undefined,
  });
  const request = (source: VariantTranslationRequest['members'][number]['source'] = {
    kind: 'owned', variantId: 'variant:a',
  }): VariantTranslationRequest => ({
    entryId: refs.entry.id,
    mode: VariantTranslationMode.GameplayB,
    members: [{ slotId: 'slot:front', source }],
  });
  return {
    get state() { return state; },
    replaceState(next: PlayerState) { state = next; },
    entries, ruleData, profiles, slices, content, service, request,
  };
}

function issueCodes(result: unknown): string[] {
  const issues = (result as { issues?: readonly { code: string }[] }).issues;
  return (issues ?? []).map(issue => issue.code);
}

function snapshotJSON(snapshot: unknown): any {
  return JSON.parse(JSON.stringify(snapshot));
}

describe('VariantTranslationService', () => {
  test('reads the exact owned Variant and never substitutes a sibling or historical memory', () => {
    const siblingOnly = harness({ owned: ['variant:b'] });
    expect(siblingOnly.service.preview(siblingOnly.request())).toMatchObject({ status: 'blocked' });
    expect(issueCodes(siblingOnly.service.preview(siblingOnly.request()))).toContain('variant-not-owned');

    const historicalOnly = harness({ owned: [] });
    historicalOnly.state.characterMemory = {
      ['chara:same' as never]: {
        variants: { 'variant:a': { maxLevel: 90, maxStars: 5, maxAffection: 20 } },
        affectionTotalEver: 100,
        variantsEverOwned: ['variant:a'],
        lifetime: { expGained: 1000, cultivateSpent: 500, affectionGained: 100 },
      },
    };
    expect(issueCodes(historicalOnly.service.preview(historicalOnly.request()))).toContain('variant-not-owned');
  });

  test('enforces slice entry authorization and required ownership by exact Variant', () => {
    const h = harness({ owned: ['variant:b'] });
    const sceneRequest = h.request({ kind: 'slice', slice: refs.sceneSlice });
    expect(h.service.preview(sceneRequest)).toMatchObject({ status: 'ready' });

    const required = h.request({ kind: 'slice', slice: refs.requiredSlice });
    expect(issueCodes(h.service.preview(required))).toContain('variant-not-owned');

    const tamperedEntry = { ...makeEntry(), slices: [{ slice: refs.requiredSlice, ownership: 'scene-provided' as const }] };
    h.entries.set(refs.entry.id, tamperedEntry);
    expect(issueCodes(h.service.preview(h.request({ kind: 'slice', slice: { id: 'slice:other', revision: 1 } }))))
      .toContain('source-not-allowed');
  });

  test('allows two distinct Variants from the same Chara and applies duplicate policy to Variant identity', () => {
    const h = harness({ owned: ['variant:a', 'variant:b'] });
    const twoOwned: VariantTranslationRequest = {
      ...h.request(),
      members: [
        { slotId: 'slot:front', source: { kind: 'owned', variantId: 'variant:a' } },
        { slotId: 'slot:back', source: { kind: 'owned', variantId: 'variant:b' } },
      ],
    };
    const distinct = h.service.preview(twoOwned);
    expect(distinct.status).toBe('ready');
    if (distinct.status === 'ready') {
      expect(distinct.members.map(member => member.statisticsCharacterId)).toEqual(['chara:same', 'chara:same']);
      expect(distinct.members.map(member => member.variantId)).toEqual(['variant:a', 'variant:b']);
    }

    const duplicateOwnedAndSlice: VariantTranslationRequest = {
      ...h.request(),
      members: [
        { slotId: 'slot:front', source: { kind: 'owned', variantId: 'variant:a' } },
        { slotId: 'slot:back', source: { kind: 'slice', slice: refs.sceneSlice } },
      ],
    };
    expect(issueCodes(h.service.preview(duplicateOwnedAndSlice))).toContain('party-policy-violation');

    h.entries.set(refs.entry.id, { ...makeEntry(), allowDuplicateVariants: true });
    expect(h.service.preview(duplicateOwnedAndSlice)).toMatchObject({ status: 'ready' });
  });

  test('rejects owned and slice translation when the registered Variant lookup is missing', () => {
    const h = harness({ missingVariants: ['variant:a'] });
    expect(issueCodes(h.service.preview(h.request()))).toContain('variant-not-found');
    expect(issueCodes(h.service.preview(h.request({ kind: 'slice', slice: refs.sceneSlice }))))
      .toContain('variant-not-found');
  });

  test('owned cultivation and a scene slice with the same raw values produce the same fixed build', () => {
    const h = harness();
    const ownedPreview = h.service.preview(h.request());
    const slicePreview = h.service.preview(h.request({ kind: 'slice', slice: refs.sceneSlice }));
    expect(ownedPreview.status).toBe('ready');
    expect(slicePreview.status).toBe('ready');
    if (ownedPreview.status !== 'ready' || slicePreview.status !== 'ready') return;

    expect(ownedPreview.members[0].input).toEqual(slicePreview.members[0].input);
    expect(ownedPreview.members[0].build).toEqual(slicePreview.members[0].build);
    expect(ownedPreview.members[0]).toMatchObject({
      input: { attributes: [{ id: 'power', value: 23 }] },
      build: {
        mode: VariantTranslationMode.GameplayB,
        grades: [{ attributeId: 'power', rawValue: 23, gradeId: 'high' }],
        parameters: { maxHp: 200, baseAgility: 8, maxAgility: 12 },
      },
    });
  });

  test('rejects an unsupported mode and unknown caller-supplied policy or data fields', () => {
    const h = harness();
    const unknownMode = { ...h.request(), mode: 'gameplay-c' } as unknown as VariantTranslationRequest;
    expect(h.service.preview(unknownMode)).toMatchObject({ status: 'blocked' });

    const injectedRootPolicy = { ...h.request(), requiresOwned: false } as VariantTranslationRequest;
    expect(h.service.preview(injectedRootPolicy)).toMatchObject({ status: 'blocked' });

    const injectedSourceValue = h.request({
      kind: 'slice', slice: refs.sceneSlice, attributes: [{ id: 'power', value: 999 }],
    } as VariantTranslationRequest['members'][number]['source']);
    expect(h.service.preview(injectedSourceValue)).toMatchObject({ status: 'blocked' });
  });

  test('a bad batch is blocked as a whole and does not prevent a later valid preview', () => {
    const h = harness();
    const mixed: VariantTranslationRequest = {
      ...h.request(),
      members: [
      { slotId: 'slot:front', source: { kind: 'owned', variantId: 'variant:a' } },
      { slotId: 'slot:back', source: { kind: 'owned', variantId: 'variant:missing' } },
      ],
    };
    const blocked = h.service.preview(mixed);
    expect(blocked).toMatchObject({ status: 'blocked' });
    expect(blocked).not.toHaveProperty('token');

    const later = h.service.preview(h.request());
    expect(later.status).toBe('ready');
  });

  test('invalidates on relevant cultivation or content changes but tolerates unrelated state changes', () => {
    const cultivation = harness();
    const preview = cultivation.service.preview(cultivation.request());
    expect(preview.status).toBe('ready');
    if (preview.status !== 'ready') return;
    cultivation.state.roster!['variant:a'].level += 1;
    expect(cultivation.service.confirm(preview.token)).toMatchObject({ status: 'blocked' });

    const unrelated = harness();
    const stillValid = unrelated.service.preview(unrelated.request());
    expect(stillValid.status).toBe('ready');
    if (stillValid.status !== 'ready') return;
    unrelated.state.resources.credit = 42;
    expect(unrelated.service.confirm(stillValid.token)).toMatchObject({ status: 'confirmed' });

    const changedContent = harness();
    const oldToken = changedContent.service.preview(changedContent.request());
    expect(oldToken.status).toBe('ready');
    if (oldToken.status !== 'ready') return;
    changedContent.profiles.set('profile:a@1', makeProfile(refs.profileA, 'variant:a', 11));
    expect(changedContent.service.confirm(oldToken.token)).toMatchObject({ status: 'blocked' });
  });

  test('rejects tokens from another instance, replay, and explicitly invalidated previews', () => {
    const first = harness();
    const second = harness();
    const preview = first.service.preview(first.request());
    expect(preview.status).toBe('ready');
    if (preview.status !== 'ready') return;

    expect(second.service.confirm(preview.token)).toMatchObject({ status: 'blocked' });
    expect(first.service.confirm(preview.token)).toMatchObject({ status: 'confirmed' });
    expect(first.service.confirm(preview.token)).toMatchObject({ status: 'blocked' });

    const invalidated = first.service.preview(first.request());
    expect(invalidated.status).toBe('ready');
    if (invalidated.status !== 'ready') return;
    first.service.invalidatePreviews();
    expect(first.service.confirm(invalidated.token)).toMatchObject({ status: 'blocked' });
  });

  test('evicts the oldest token at the 32-preview cache boundary and keeps the newest usable', () => {
    const h = harness();
    const previews = Array.from({ length: 33 }, () => h.service.preview(h.request()));
    expect(previews.every(preview => preview.status === 'ready')).toBe(true);
    const oldest = previews[0];
    const newest = previews[32];
    if (oldest.status !== 'ready' || newest.status !== 'ready') return;

    expect(h.service.confirm(oldest.token)).toMatchObject({ status: 'blocked' });
    expect(h.service.confirm(newest.token)).toMatchObject({ status: 'confirmed' });
  });

  test('invalidates outstanding previews when Init or the PlayerState object changes', () => {
    const initChange = harness();
    const initPreview = initChange.service.preview(initChange.request());
    expect(initPreview.status).toBe('ready');
    if (initPreview.status !== 'ready') return;
    initChange.state.activeInit = 'init:next';
    expect(initChange.service.confirm(initPreview.token)).toMatchObject({ status: 'blocked' });

    const stateReplacement = harness();
    const oldPreview = stateReplacement.service.preview(stateReplacement.request());
    expect(oldPreview.status).toBe('ready');
    if (oldPreview.status !== 'ready') return;
    const replacement = createDefaultState();
    replacement.activeInit = stateReplacement.state.activeInit;
    replacement.roster = { ...stateReplacement.state.roster };
    stateReplacement.replaceState(replacement);
    expect(stateReplacement.service.confirm(oldPreview.token)).toMatchObject({ status: 'blocked' });
  });

  test('keeps private request and output data detached from caller-owned references', () => {
    const h = harness();
    const request = h.request();
    const ready = h.service.preview(request);
    expect(ready.status).toBe('ready');
    if (ready.status !== 'ready') return;

    (request.members[0] as any).source = { kind: 'owned', variantId: 'variant:b' };
    (request.members[0] as any).slotId = 'slot:changed';
    const returned = ready.members[0] as any;
    try { returned.input.attributes[0].value = 999; } catch { /* immutable results may throw */ }
    try { returned.build.parameters.maxHp = 999; } catch { /* immutable results may throw */ }

    const confirmed = h.service.confirm(ready.token);
    expect(confirmed.status).toBe('confirmed');
    if (confirmed.status !== 'confirmed') return;
    expect(confirmed.snapshot.members[0]).toMatchObject({
      slotId: 'slot:front', variantId: 'variant:a',
      input: { attributes: [{ id: 'power', value: 23 }] },
      build: { parameters: { maxHp: 200 } },
    });
  });

  test('restores a JSON snapshot from its frozen owned inputs after ownership and cultivation change', () => {
    const h = harness();
    const ready = h.service.preview(h.request());
    expect(ready.status).toBe('ready');
    if (ready.status !== 'ready') return;
    const confirmed = h.service.confirm(ready.token);
    expect(confirmed.status).toBe('confirmed');
    if (confirmed.status !== 'confirmed') return;
    const frozen = snapshotJSON(confirmed.snapshot);

    delete h.state.roster!['variant:a'];
    h.state.roster!['variant:b'] = ownedProgress('variant:b', { level: 80, stars: 5, affectionLevel: 20 });
    const beforeRestore = JSON.stringify(h.state);
    const restored = h.service.restore(JSON.parse(JSON.stringify(frozen)));
    expect(restored.status).toBe('restored');
    if (restored.status !== 'restored') return;
    expect(restored.snapshot.members[0].progression).toEqual({ level: 3, stars: 2, affectionLevel: 4 });
    expect(restored.snapshot.members[0].input.attributes).toEqual([{ id: 'power', value: 23 }]);
    expect(restored.snapshot.members[0].build.parameters).toEqual({ maxHp: 200, baseAgility: 8, maxAgility: 12 });
    expect(JSON.stringify(h.state)).toBe(beforeRestore);
  });

  test('restores a confirmed required-owned slice after its Variant is no longer owned', () => {
    const h = harness();
    const ready = h.service.preview(h.request({ kind: 'slice', slice: refs.requiredSlice }));
    expect(ready.status).toBe('ready');
    if (ready.status !== 'ready') return;
    const confirmed = h.service.confirm(ready.token);
    expect(confirmed.status).toBe('confirmed');
    if (confirmed.status !== 'confirmed') return;

    delete h.state.roster!['variant:a'];
    expect(h.service.restore(snapshotJSON(confirmed.snapshot))).toMatchObject({ status: 'restored' });
  });

  test('rejects edited snapshot inputs, outputs, versions, schema versions, and unknown fields', () => {
    const h = harness();
    const ready = h.service.preview(h.request());
    if (ready.status !== 'ready') throw new Error('fixture must translate');
    const confirmed = h.service.confirm(ready.token);
    if (confirmed.status !== 'confirmed') throw new Error('fixture must confirm');
    const original = snapshotJSON(confirmed.snapshot);
    const cases = [
      ['input value', (copy: any) => { copy.members[0].input.attributes[0].value = 24; }],
      ['translated output', (copy: any) => { copy.members[0].build.parameters.maxHp = 999; }],
      ['entry revision', (copy: any) => { copy.entry.revision += 1; }],
      ['missing rules revision', (copy: any) => { delete copy.rules.revision; }],
      ['missing profile revision', (copy: any) => { delete copy.members[0].profile.revision; }],
      ['content evidence', (copy: any) => { copy.contentEvidence = 'forged'; }],
      ['missing schema version', (copy: any) => { delete copy.schemaVersion; }],
      ['unknown top-level field', (copy: any) => { copy.injected = true; }],
      ['unknown member field', (copy: any) => { copy.members[0].actorId = 'combat:forged'; }],
      ['unknown input field', (copy: any) => { copy.members[0].input.extra = 'forged'; }],
      ['own __proto__ field', (copy: any) => {
        Object.defineProperty(copy.members[0].build, '__proto__', {
          value: { injected: true }, enumerable: true, configurable: true,
        });
      }],
    ] as const;
    for (const [label, tamper] of cases) {
      const candidate = snapshotJSON(original);
      tamper(candidate);
      expect(h.service.restore(candidate), label).toMatchObject({ status: 'blocked' });
    }
  });

  test('rejects resolver content returned at a different revision', () => {
    const h = harness();
    h.ruleData.set('rules:test@1', { ...makeRules(), revision: 2 });
    expect(h.service.preview(h.request())).toMatchObject({ status: 'blocked' });

    const wrongProfileRevision = harness();
    wrongProfileRevision.profiles.delete('profile:a@1');
    wrongProfileRevision.profiles.set('profile:a@2', makeProfile({ ...refs.profileA, revision: 2 }, 'variant:a'));
    expect(issueCodes(wrongProfileRevision.service.preview(wrongProfileRevision.request())))
      .toContain('content-version-mismatch');

    const wrongSliceRevision = harness();
    wrongSliceRevision.slices.delete('slice:scene@1');
    wrongSliceRevision.slices.set('slice:scene@2', makeSlice({ ...refs.sceneSlice, revision: 2 }));
    expect(issueCodes(wrongSliceRevision.service.preview(
      wrongSliceRevision.request({ kind: 'slice', slice: refs.sceneSlice }),
    ))).toContain('content-version-mismatch');
  });

  test('preview, confirm, and restore never write roster, progression, ownership, or unrelated PlayerState', () => {
    const h = harness();
    const before = JSON.stringify(h.state);
    const ready = h.service.preview(h.request());
    expect(ready.status).toBe('ready');
    if (ready.status !== 'ready') return;
    const confirmed = h.service.confirm(ready.token);
    expect(confirmed.status).toBe('confirmed');
    if (confirmed.status !== 'confirmed') return;
    h.service.restore(snapshotJSON(confirmed.snapshot));
    expect(JSON.stringify(h.state)).toBe(before);
  });
});
