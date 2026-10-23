import { describe, expect, it } from 'vitest';
import { validateGameplayEncounterEffectSyntax, validateGameplayMapEffectProgram, validateGameplayMapStatusSyntax } from '../../src/data-services/validation/gameplay-map-effect-syntax';
import { validateGameplayMapEffectContext } from '../../src/data-services/validation/gameplay-map-effect-context';

const flag = (flagId = 'seen') => ({ op: 'flagSet', flagId, value: true });
const when = (then: unknown[], condition: unknown = { kind: 'flag', flagId: 'seen', value: true }, otherwise?: unknown[]) => ({
  op: 'when', condition, then, ...(otherwise === undefined ? {} : { else: otherwise }),
});
const issueAt = (result: ReturnType<typeof validateGameplayMapEffectProgram>, path: string) => result.issues.some(issue => issue.path === path);

describe('Gameplay B effect syntax', () => {
  it('accepts only the closed cardEffectModifier author shape', () => {
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: -2 },
    ] })).toMatchObject({ ok: true, requiresAg1: true });
    for (const delta of [0, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']) {
      expect(validateGameplayMapEffectProgram({ resolve: [
        { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta },
      ] }).ok).toBe(false);
    }
    for (const change of [
      { path: 'resolve[1].amount' }, { operation: 'multiply' }, { hidden: true },
    ]) {
      expect(validateGameplayMapEffectProgram({ resolve: [
        { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 1, ...change },
      ] }).ok).toBe(false);
    }
  });

  it('accepts only closed AG-1 healApplied triggers with positive primaryActor resource rewards', () => {
    const trigger = {
      id: 'heal-reward', event: 'healApplied', minimumActualAmount: 2,
      effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
    };
    expect(validateGameplayMapEffectProgram({
      resolve: [{ op: 'heal', target: 'primary', amount: 2 }], triggers: [trigger],
    })).toMatchObject({ ok: true, requiresAg1: true, counts: { staticNodes: 2 } });
    expect(validateGameplayMapEffectProgram({
      resolve: [{ op: 'damage', target: 'primary', amount: 2 }],
      triggers: [{ ...trigger, event: 'damageApplied' }],
    })).toMatchObject({ ok: true, requiresAg1: true, counts: { staticNodes: 2 } });
    for (const invalid of [
      { ...trigger, event: 'reviveApplied' },
      { ...trigger, hidden: true },
      { ...trigger, minimumActualAmount: 0 },
      { ...trigger, minimumActualAmount: -1 },
      { ...trigger, minimumActualAmount: 1.5 },
      { ...trigger, minimumActualAmount: Number.MAX_SAFE_INTEGER + 1 },
      { ...trigger, minimumActualAmount: '2' },
      { ...trigger, minimumActualAmount: null },
      { ...trigger, effect: { ...trigger.effect, account: 'sourceActor' } },
      { ...trigger, effect: { ...trigger.effect, op: 'counterAdd' } },
      { ...trigger, effect: { ...trigger.effect, delta: 0 } },
      { ...trigger, effect: { ...trigger.effect, delta: -1 } },
      { ...trigger, effect: { ...trigger.effect, delta: 1.5 } },
      { ...trigger, effect: { ...trigger.effect, resourceId: '  ' } },
      { ...trigger, effect: { ...trigger.effect, extra: true } },
    ]) {
      expect(validateGameplayMapEffectProgram({
        resolve: [{ op: 'heal', target: 'primary', amount: 2 }], triggers: [invalid],
      }).ok).toBe(false);
    }
    expect(validateGameplayMapEffectProgram({ triggers: [trigger, trigger] }).issues.some(issue => issue.code === 'duplicate')).toBe(true);
    expect(validateGameplayMapEffectProgram({ triggers: [trigger], unknown: true }).ok).toBe(false);
  });

  it('accepts the finite E1 program, rationals, locals, and condition completion', () => {
    const program = validateGameplayMapEffectProgram({
      prepare: [{ op: 'discountSCost', amount: 2 }],
      resolve: [
        { op: 'hpChange', target: 'primary', delta: -3 },
        when([{ op: 'counterAdd', counterId: 'trust', delta: 1 }], {
          kind: 'all', conditions: [
            { kind: 'hpRatioAtMost', target: 'source', numerator: 1, denominator: 2 },
            { kind: 'not', condition: { kind: 'flag', flagId: 'seen', value: true } },
          ],
        }),
      ],
    });
    expect(program).toMatchObject({ ok: true, counts: { staticNodes: 8, prepareLeaves: 1 } });
    expect(validateGameplayEncounterEffectSyntax({
      locals: { counters: [{ id: 'trust', initial: 0, min: -1, max: 3 }], flags: [{ id: 'seen', initial: false }] },
      completion: { kind: 'condition', label: 'Reach trust 3', condition: { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 3 } },
    })).toMatchObject({ ok: true, counts: { locals: 2 } });
    expect(validateGameplayEncounterEffectSyntax({ completion: { kind: 'manual', label: 'Done' } }).ok).toBe(true);
  });

  it('accepts E1 primary and bounded E2 TargetSet / Value damage-heal forms', () => {
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'damage', target: 'primary', amount: 3 },
      { op: 'heal', target: 'primary', amount: 2 },
    ] }).ok).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'damage', target: { set: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 4 } },
        amount: { kind: 'max', left: { kind: 'literal', value: 1 }, right: { kind: 'missingHp', unit: 'target' } },
        repeat: { kind: 'min', left: { kind: 'counter', counterId: 'hits' }, right: { kind: 'literal', value: 8 } } },
    ] }).ok).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'heal', target: { set: { side: 'party', order: 'random', limit: 3 } }, amount: 1 },
    ] }).requiresAg1).toBe(true);

    for (const op of ['damage', 'heal']) {
      const invalidAmounts: unknown[] = [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1];
      for (const amount of invalidAmounts) {
        const effect = validateGameplayMapEffectProgram({ resolve: [{ op, target: 'primary', ...(amount === undefined ? {} : { amount }) }] });
        expect(issueAt(effect, 'effectProgram.resolve[0].amount')).toBe(true);
      }
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [{ op, amount: 1 }] }), 'effectProgram.resolve[0].target')).toBe(true);
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [{ op, target: 'source', amount: 1 }] }), 'effectProgram.resolve[0].target')).toBe(true);
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [{ op, target: 'primary', amount: 1, delta: 1 }] }), 'effectProgram.resolve[0].delta')).toBe(true);
    }
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'damage', target: { set: { side: 'enemy', limit: 33 } }, amount: 1 }] }).ok).toBe(false);
    expect(issueAt(validateGameplayMapEffectProgram({ resolve: [{ op: 'damage', target: { set: { side: 'enemy', order: 'random' } }, amount: 1 }] }), 'effectProgram.resolve[0].target.set.limit')).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'damage', target: { set: { side: 'enemy', order: 'random', limit: 0 } }, amount: 1 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'damage', target: { set: { side: 'enemy', order: 'random', limit: 33 } }, amount: 1 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'damage', target: { set: { side: 'enemy', sort: 'random' } }, amount: 1 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'heal', target: 'primary', amount: 1, repeat: 9 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'heal', target: 'primary', amount: { kind: 'literal', value: 2.5 } }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'revive', target: 'primary', amount: 1 }] }))
      .toMatchObject({ ok: true, requiresAg1: true });
  });

  it('accepts only a positive literal AG-1 revive on primary and rejects loop use', () => {
    for (const target of ['source', 'loopTarget', 'team', { set: { side: 'party' } }]) {
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [{ op: 'revive', target, amount: 1 }] }),
        'effectProgram.resolve[0].target')).toBe(true);
    }
    for (const amount of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, { kind: 'literal', value: 3 }]) {
      const result = validateGameplayMapEffectProgram({ resolve: [{ op: 'revive', target: 'primary',
        ...(amount === undefined ? {} : { amount }) }] });
      expect(issueAt(result, 'effectProgram.resolve[0].amount')).toBe(true);
    }
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'forTargets', targetSet: { side: 'party' },
      body: [{ op: 'revive', target: 'primary', amount: 1 }] }] }).ok).toBe(false);
  });

  it('accepts frozen Prepared Tag count conditions and rejects invalid query shapes', () => {
    const condition = { kind: 'preparedTagCount', side: 'party', tag: 'gameplay-b:action/explosive', comparison: 'gte', value: 2 };
    expect(validateGameplayMapEffectProgram({ resolve: [when([
      { op: 'damage', target: 'primary', amount: 1 },
    ], condition)] }).ok).toBe(true);
    for (const invalid of [
      { ...condition, side: 'enemy' },
      { ...condition, tag: 'action/explosive' },
      { ...condition, comparison: 'between' },
      { ...condition, value: -1 },
      { ...condition, value: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      expect(validateGameplayMapEffectProgram({ resolve: [when([], invalid)] }).ok).toBe(false);
    }
  });

  it('strictly rejects unknown operations, fields, resource conditions, and non-boolean values', () => {
    const unknownOp = validateGameplayMapEffectProgram({ resolve: [{ op: 'eval', source: 'anything' }] });
    expect(issueAt(unknownOp, 'effectProgram.resolve[0].op')).toBe(true);
    const extra = validateGameplayMapEffectProgram({ prepare: [{ op: 'discountSCost', amount: 1, expression: '1' }] });
    expect(issueAt(extra, 'effectProgram.prepare[0].expression')).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [when([], { kind: 'resourceAtLeast', account: 'sourceTeam', resourceId: 'ammo', value: 1 })] }).ok).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [when([], { kind: 'resourceAtLeast', account: 'sourceTeam', resourceId: 'ammo', value: -1 })] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [when([], { kind: 'resourceAtLeast', account: 'sourceTeam', resourceId: 'ammo', value: 1, unexpected: true })] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [when([flag()], undefined, [ { op: 'unknown' } ])] }).issues.some(i => i.path === 'effectProgram.resolve[0].else[0].op')).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'resourceChange', account: ['sourceTeam'], resourceId: 'ammo', delta: 1 }] }).issues.some(i => i.path.endsWith('.account'))).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'resourceChange', account: 'sourceTeam', resourceId: 'ammo', delta: { kind: 'literal', value: -1 },
    }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [when([flag()], { kind: 'counter', counterId: 'x', comparison: ['gte'], value: 1 })] }).issues.some(i => i.path.endsWith('.comparison'))).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: '   ', delta: 1 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'flagSet', flagId: 'seen', value: 1 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram(new Date(0)).ok).toBe(false);
  });

  it('accepts bounded forTargets and MapRun Fact AST while enforcing loopTarget lexical scope', () => {
    const program = validateGameplayMapEffectProgram({ resolve: [{
      op: 'forTargets', targetSet: { side: 'enemy', filter: 'living', order: 'definition' }, body: [
        { op: 'when', condition: { kind: 'all', conditions: [
          { kind: 'mapRunCounter', counterId: 'steps', comparison: 'gte', value: 1 },
          { kind: 'resourceAtLeast', account: 'loopTargetActor', resourceId: 'focus', value: 1 },
        ] }, then: [
          { op: 'hpChange', target: 'loopTarget', delta: -1 },
          { op: 'heal', target: 'primary', amount: { kind: 'resourceBalance', account: 'sourceTeam', resourceId: 'signal' } },
          { op: 'mapRunCounterAdd', counterId: 'steps', delta: 1 },
          { op: 'mapRunFlagSet', flagId: 'open', value: true },
        ] },
        { op: 'forTargets', targetSet: { side: 'party', order: 'random', limit: 1 }, body: [
          { op: 'when', condition: { kind: 'hpAtLeast', target: 'loopTarget', value: 1 }, then: [] },
        ] },
      ],
    }] });
    expect(program.ok).toBe(true);
    expect(program.requiresAg1).toBe(true);

    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'hpChange', target: 'loopTarget', delta: 1 },
    ] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'heal', target: 'primary', amount: { kind: 'resourceBalance', account: 'loopTargetActor', resourceId: 'focus' } },
    ] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'forTargets', targetSet: { side: 'enemy' }, body: [], unknown: true },
    ] }).ok).toBe(false);
  });

  it('accepts additionalActor writes and restricts loopTargetActor writes to loop bodies', () => {
    const additional = validateGameplayMapEffectProgram({ resolve: [
      { op: 'resourceChange', account: 'additionalActor', resourceId: 'focus', delta: 1 },
    ] });
    expect(additional.ok).toBe(true);
    expect(additional.requiresAg1).toBe(true);

    const loopWrite = validateGameplayMapEffectProgram({ resolve: [{
      op: 'forTargets', targetSet: { side: 'party' }, body: [
        { op: 'resourceChange', account: 'loopTargetActor', resourceId: 'focus', delta: -1 },
      ],
    }] });
    expect(loopWrite.ok).toBe(true);
    expect(loopWrite.requiresAg1).toBe(true);

    const outsideLoop = validateGameplayMapEffectProgram({ resolve: [
      { op: 'resourceChange', account: 'loopTargetActor', resourceId: 'focus', delta: -1 },
    ] });
    expect(outsideLoop.ok).toBe(false);
    expect(outsideLoop.issues.some(issue => issue.path.endsWith('.account'))).toBe(true);
  });

  it('accepts exactly 64 static nodes and rejects the 65th with its field path and limit', () => {
    const atLimit = validateGameplayMapEffectProgram({ resolve: Array.from({ length: 64 }, (_, i) => flag(`f${i}`)) });
    expect(atLimit).toMatchObject({ ok: true, counts: { staticNodes: 64 } });
    const over = validateGameplayMapEffectProgram({ resolve: Array.from({ length: 65 }, (_, i) => flag(`f${i}`)) });
    expect(over.issues).toContainEqual(expect.objectContaining({ path: 'effectProgram.resolve[64]', code: 'limit', limit: 64 }));
  });

  it('counts both when branches and all condition nodes toward the static budget', () => {
    const result = validateGameplayMapEffectProgram({ resolve: [when([flag('a')], {
      kind: 'any', conditions: [{ kind: 'flag', flagId: 'x', value: true }, { kind: 'flag', flagId: 'y', value: false }],
    }), { op: 'hpChange', target: 'primary', delta: 1 }] });
    expect(result.counts.staticNodes).toBe(6);
    const bothBranches = validateGameplayMapEffectProgram({ resolve: [when(
      Array.from({ length: 30 }, (_, i) => flag(`t${i}`)), { kind: 'flag', flagId: 'x', value: false },
      Array.from({ length: 30 }, (_, i) => flag(`e${i}`)),
    )] });
    expect(bothBranches).toMatchObject({ ok: true, counts: { staticNodes: 62 } });
  });

  it('enforces resolve and condition depth 4/5 before traversing hostile deep trees', () => {
    let statements: unknown[] = [flag()];
    for (let i = 0; i < 3; i++) statements = [when(statements)];
    expect(validateGameplayMapEffectProgram({ resolve: statements }).ok).toBe(true);
    statements = [when(statements)];
    expect(validateGameplayMapEffectProgram({ resolve: statements }).issues.some(i => i.limit === 4)).toBe(true);

    let condition: unknown = { kind: 'flag', flagId: 'f', value: true };
    for (let i = 0; i < 3; i++) condition = { kind: 'not', condition };
    expect(validateGameplayMapEffectProgram({ resolve: [when([flag()], condition)] }).ok).toBe(true);
    condition = { kind: 'not', condition };
    expect(validateGameplayMapEffectProgram({ resolve: [when([flag()], condition)] }).issues.some(i => i.limit === 4)).toBe(true);

    let hostile: unknown = flag();
    for (let i = 0; i < 2000; i++) hostile = when([hostile]);
    expect(validateGameplayMapEffectProgram({ resolve: [hostile] }).ok).toBe(false);
  });

  it('enforces prepare, locals, safe-integer, nonzero-delta, and rational bounds', () => {
    expect(validateGameplayMapEffectProgram({ prepare: Array.from({ length: 8 }, () => ({ op: 'discountSCost', amount: 1 })) }).ok).toBe(true);
    expect(validateGameplayMapEffectProgram({ prepare: Array.from({ length: 9 }, () => ({ op: 'discountSCost', amount: 1 })) }).issues).toContainEqual(expect.objectContaining({ limit: 8 }));
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'counterAdd', counterId: 'x', delta: Number.MAX_SAFE_INTEGER + 1 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'hpChange', target: 'source', delta: 0 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [when([flag()], { kind: 'hpRatioAtMost', target: 'source', numerator: 2, denominator: 1 })] }).ok).toBe(false);

    const locals = (count: number) => ({ locals: { counters: Array.from({ length: count }, (_, i) => ({ id: `c${i}`, initial: 0, min: 0, max: 1 })) } });
    expect(validateGameplayEncounterEffectSyntax(locals(64)).ok).toBe(true);
    expect(validateGameplayEncounterEffectSyntax(locals(65)).issues).toContainEqual(expect.objectContaining({ limit: 64 }));
    expect(validateGameplayEncounterEffectSyntax({ locals: { counters: [{ id: 'same', initial: 0, min: 0, max: 1 }], flags: [{ id: 'same', initial: false }] } }).issues.some(i => i.code === 'duplicate')).toBe(true);
    expect(validateGameplayEncounterEffectSyntax({ locals: { counters: [{ id: 'x', initial: 2, min: 0, max: 1 }] } }).ok).toBe(false);
    expect(validateGameplayEncounterEffectSyntax({ completion: { kind: 'condition', condition: { kind: 'flag', flagId: 'x', value: true } } }).ok).toBe(false);
  });

  it('accepts closed burn/regen definitions and statusApply/statusRemove statements', () => {
    expect(validateGameplayMapStatusSyntax([
      { id: 'burn', name: 'Burn', category: 'harmful', kind: 'burn', hpPerStack: 2, maxStacks: 3 },
      { id: 'regen', name: 'Regen', description: 'Restores HP', category: 'beneficial', kind: 'regen', hpPerStack: 1, maxStacks: 2 },
    ])).toMatchObject({ ok: true });
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 3 },
      { op: 'statusRemove', target: 'source', statusId: 'burn' },
    ] })).toMatchObject({ ok: true, counts: { staticNodes: 2 } });
    expect(validateGameplayMapStatusSyntax([
      { id: 'burn', name: '', kind: 'poison', hpPerStack: 0, maxStacks: 1, script: [] },
      { id: 'burn', name: 'Duplicate', kind: 'burn', hpPerStack: 1, maxStacks: 1 },
    ])).toMatchObject({ ok: false });
    expect(validateGameplayMapStatusSyntax(Array.from({ length: 65 }, (_, index) => ({
      id: `status-${index}`, name: 'Status', kind: 'burn', hpPerStack: 1, maxStacks: 1,
    }))).issues).toContainEqual(expect.objectContaining({ limit: 64 }));
    expect(validateGameplayMapStatusSyntax([
      { id: 'too-many-stacks', name: 'Status', kind: 'burn', hpPerStack: 1, maxStacks: 100 },
    ]).issues).toContainEqual(expect.objectContaining({ limit: 99 }));
    expect(validateGameplayMapStatusSyntax([
      { id: 'bad-category', name: 'Status', category: 'neutral', kind: 'burn', hpPerStack: 1, maxStacks: 1 },
    ]).issues).toContainEqual(expect.objectContaining({ path: expect.stringContaining('.category') }));
    for (const field of ['stacks', 'durationRounds'] as const) {
      expect(validateGameplayMapEffectProgram({ resolve: [{
        op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 1, [field]: 0,
      }] }).ok).toBe(false);
    }
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'statusApply', target: 'team', statusId: 'burn', stacks: 1, durationRounds: 1,
    }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 1, hidden: true,
    }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 100, durationRounds: 1,
    }] }).issues).toContainEqual(expect.objectContaining({ limit: 99 }));
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 100,
    }] }).issues).toContainEqual(expect.objectContaining({ limit: 99 }));
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'statusRemove', target: 'loopTarget', statusId: 'burn',
    }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'forTargets', targetSet: { side: 'enemy' }, body: [
        { op: 'statusRemove', target: 'loopTarget', statusId: 'burn' },
      ],
    }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'statusRemove', target: 'primary', statusId: 'burn', hidden: true,
    }] }).ok).toBe(false);
  });

  it('validates the closed positive resource reward on each natural-expiry Status kind', () => {
    const onExpire = { resourceId: 'focus', delta: 1 };
    expect(validateGameplayMapStatusSyntax([
      { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 2, onExpire },
      { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 2, onExpire },
      { id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial', damageReductionPerStack: 1, maxStacks: 2, onExpire },
      { id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 2, onExpire },
    ])).toMatchObject({ ok: true });
    for (const delta of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
      expect(validateGameplayMapStatusSyntax([{
        id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 2,
        onExpire: { resourceId: 'focus', delta },
      }]).issues.some(issue => issue.path.endsWith('.onExpire.delta'))).toBe(true);
    }
    for (const reward of [
      { resourceId: '', delta: 1 }, { resourceId: '  ', delta: 1 }, { resourceId: 'focus', delta: 1, extra: true },
    ]) {
      expect(validateGameplayMapStatusSyntax([{
        id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 2, onExpire: reward,
      }]).ok).toBe(false);
    }
    expect(validateGameplayMapStatusSyntax([{
      id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 2, onExpire: { resourceId: 'focus' },
    }]).issues.some(issue => issue.path.endsWith('.onExpire.delta'))).toBe(true);
    expect(validateGameplayMapStatusSyntax([{
      id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 2, hpPerStack: 1,
    }]).issues.some(issue => issue.path.endsWith('.hpPerStack'))).toBe(true);
    expect(validateGameplayMapStatusSyntax([{
      id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 2, damageReductionPerStack: 1,
    }]).issues.some(issue => issue.path.endsWith('.damageReductionPerStack'))).toBe(true);
    expect(validateGameplayMapStatusSyntax([{
      id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'harmful', maxStacks: 2,
    }]).issues.some(issue => issue.path.endsWith('.category'))).toBe(true);
    expect(validateGameplayMapStatusSyntax([{
      id: 'ward', name: 'Ward', kind: 'damageProtection', maxStacks: 2,
    }]).issues.some(issue => issue.path.endsWith('.category'))).toBe(true);
  });

  it('validates the closed positive holder reward for actual damage', () => {
    const onDamageTaken = { resourceId: 'focus', delta: 1 };
    expect(validateGameplayMapStatusSyntax([
      { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 2, onDamageTaken },
      { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 2, onDamageTaken },
      { id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial', damageReductionPerStack: 1, maxStacks: 2, onDamageTaken },
      { id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 2, onDamageTaken },
    ])).toMatchObject({ ok: true });
    for (const delta of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
      expect(validateGameplayMapStatusSyntax([{ id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 1,
        onDamageTaken: { resourceId: 'focus', delta } }]).issues.some(issue => issue.path.endsWith('.onDamageTaken.delta'))).toBe(true);
    }
    expect(validateGameplayMapStatusSyntax([{ id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 1,
      onDamageTaken: { resourceId: 'focus', delta: 1, extra: true } }]).ok).toBe(false);
  });

  it('accepts the optional Encounter or MapRun Status lifetime and rejects unknown values', () => {
    const base = { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 2 };
    expect(validateGameplayMapStatusSyntax([base])).toMatchObject({ ok: true });
    expect(validateGameplayMapStatusSyntax([{ ...base, lifetime: 'encounter' }])).toMatchObject({ ok: true });
    expect(validateGameplayMapStatusSyntax([{ ...base, lifetime: 'mapRun' }])).toMatchObject({ ok: true });
    expect(validateGameplayMapStatusSyntax([{ ...base, lifetime: 'campaign' }]).issues)
      .toContainEqual(expect.objectContaining({ path: 'statuses[0].lifetime' }));
  });

  it('accepts only closed AG-1 statusConsume statements with a fixed positive stack count', () => {
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'statusConsume', target: 'source', statusId: 'burn', stacks: 1 },
      { op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 99 },
    ] })).toMatchObject({ ok: true, requiresAg1: true, counts: { staticNodes: 2 } });
    for (const stacks of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2', { kind: 'literal', value: 2 }]) {
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [
        { op: 'statusConsume', target: 'primary', statusId: 'burn', stacks },
      ] }), 'effectProgram.resolve[0].stacks')).toBe(true);
    }
    for (const target of ['team', 'loopTarget', { set: { side: 'party' } }, { cardRef: 'selected' }, { additionalTarget: true }]) {
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [
        { op: 'statusConsume', target, statusId: 'burn', stacks: 1 },
      ] }), 'effectProgram.resolve[0].target')).toBe(true);
    }
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 1, hidden: true,
    }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'forTargets', targetSet: { side: 'party' }, body: [
      { op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 1 },
    ] }] })).toMatchObject({ ok: true, requiresAg1: true });
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'forTargets', targetSet: { side: 'party' }, body: [
      { op: 'statusConsume', target: 'loopTarget', statusId: 'burn', stacks: 1 },
    ] }] }).ok).toBe(false);
  });

  it('accepts only closed AG-1 statusRemoveCategory statements for a unit holder', () => {
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'statusRemoveCategory', target: 'source', category: 'harmful' },
      { op: 'statusRemoveCategory', target: 'primary', category: 'beneficial' },
    ] })).toMatchObject({ ok: true, requiresAg1: true, counts: { staticNodes: 2 } });
    for (const target of ['team', 'loopTarget', { set: { side: 'party' } }, { cardRef: 'selected' }, { additionalTarget: true }]) {
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [
        { op: 'statusRemoveCategory', target, category: 'harmful' },
      ] }), 'effectProgram.resolve[0].target')).toBe(true);
    }
    expect(issueAt(validateGameplayMapEffectProgram({ resolve: [
      { op: 'statusRemoveCategory', target: 'primary', category: 'neutral' },
    ] }), 'effectProgram.resolve[0].category')).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [{
      op: 'statusRemoveCategory', target: 'primary', category: 'harmful', extra: true,
    }] }).ok).toBe(false);
  });

  it('accepts only the closed AG-1 shieldAdd shape with a positive safe amount', () => {
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'shieldAdd', target: 'source', amount: 3 },
      { op: 'shieldAdd', target: 'primary', amount: { kind: 'max', left: { kind: 'literal', value: 1 }, right: { kind: 'missingHp', unit: 'primary' } } },
    ] })).toMatchObject({ ok: true, requiresAg1: true, counts: { staticNodes: 2 } });

    for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '3']) {
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [
        { op: 'shieldAdd', target: 'primary', amount },
      ] }), 'effectProgram.resolve[0].amount')).toBe(true);
    }
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'shieldAdd', target: 'primary', amount: { kind: 'literal', value: 0 } },
    ] }).ok).toBe(false);
    for (const target of ['team', { set: { side: 'party' } }, { cardRef: 'selected' }, { additionalTarget: true }]) {
      expect(issueAt(validateGameplayMapEffectProgram({ resolve: [
        { op: 'shieldAdd', target, amount: 1 },
      ] }), 'effectProgram.resolve[0].target')).toBe(true);
    }
    for (const extra of [{ hidden: true }, { repeat: 2 }, { target: 'source', amount: 1, cardRef: 'selected' }]) {
      expect(validateGameplayMapEffectProgram({ resolve: [
        { op: 'shieldAdd', target: 'source', amount: 1, ...extra },
      ] }).ok).toBe(false);
    }
    expect(validateGameplayMapEffectProgram({ resolve: [
      { op: 'shieldAdd', target: 'primary', amount: { kind: 'hp', unit: 'loopTarget' } },
    ] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'forTargets', targetSet: { side: 'party' }, body: [
      { op: 'shieldAdd', target: 'primary', amount: { kind: 'hp', unit: 'loopTarget' } },
    ] }] })).toMatchObject({ ok: true, requiresAg1: true });
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'forTargets', targetSet: { side: 'party' }, body: [
      { op: 'shieldAdd', target: 'loopTarget', amount: 1 },
    ] }] }).ok).toBe(false);
  });

  it('binds statusRemove to a declared Map Status and rejects actorless source use', () => {
    const action = (target: unknown, eligibleCharacterIds: string[]) => ({
      id: 'remove-status', name: 'Remove Status', eligibleCharacterIds, target,
      effectProgram: { resolve: [{ op: 'statusRemove', target: 'source', statusId: 'burn' }] },
    });
    const map = (removeAction: unknown, statusId = 'burn') => ({
      id: 'test:status-remove', partyCharacterIds: ['shiroko'], statuses: [
        { id: statusId, name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3 },
      ], actions: [removeAction], nodes: [{ id: 'node', encounter: {
        title: 'Status removal', enemies: [{ id: 'raider', initialHp: 3, maxHp: 3 }],
        participants: [{ characterId: 'shiroko', actions: [{ actionId: 'remove-status', tendencyWeight: 1 }] }],
      } }],
    });
    expect(validateGameplayMapEffectContext(map(action({ kind: 'enemy' }, ['shiroko'])))).toEqual([]);
    expect(validateGameplayMapEffectContext(map(action({ kind: 'enemy' }, ['shiroko']), 'other')))
      .toContainEqual(expect.objectContaining({ message: 'status "burn" is not declared by this Map' }));

    const actorless = {
      id: 'remove-status', name: 'Remove Status', eligibleCharacterIds: [], target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'statusRemove', target: 'source', statusId: 'burn' }] },
    };
    const actorlessMap = map(actorless);
    Object.assign(actorlessMap.nodes[0].encounter, { abilityActionIds: ['remove-status'], participants: [] });
    expect(validateGameplayMapEffectContext(actorlessMap).map(issue => issue.message).join(' '))
      .toMatch(/actorless Ability \/ Item cannot reference source HP/);
  });
});
