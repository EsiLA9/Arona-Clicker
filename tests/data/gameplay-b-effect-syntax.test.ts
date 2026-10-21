import { describe, expect, it } from 'vitest';
import { validateGameplayEncounterEffectSyntax, validateGameplayMapEffectProgram } from '../../src/data-services/validation/gameplay-map-effect-syntax';

const flag = (flagId = 'seen') => ({ op: 'flagSet', flagId, value: true });
const when = (then: unknown[], condition: unknown = { kind: 'flag', flagId: 'seen', value: true }, otherwise?: unknown[]) => ({
  op: 'when', condition, then, ...(otherwise === undefined ? {} : { else: otherwise }),
});
const issueAt = (result: ReturnType<typeof validateGameplayMapEffectProgram>, path: string) => result.issues.some(issue => issue.path === path);

describe('Gameplay B effect syntax', () => {
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

  it('strictly rejects unknown operations, fields, resource conditions, and non-boolean values', () => {
    const unknownOp = validateGameplayMapEffectProgram({ resolve: [{ op: 'eval', source: 'anything' }] });
    expect(issueAt(unknownOp, 'effectProgram.resolve[0].op')).toBe(true);
    const extra = validateGameplayMapEffectProgram({ prepare: [{ op: 'discountSCost', amount: 1, expression: '1' }] });
    expect(issueAt(extra, 'effectProgram.prepare[0].expression')).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [when([], { kind: 'resourceAtLeast', resourceId: 'ammo', amount: 1 })] }).issues.some(i => i.code === 'unknown-op')).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [when([flag()], undefined, [ { op: 'unknown' } ])] }).issues.some(i => i.path === 'effectProgram.resolve[0].else[0].op')).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'resourceChange', account: ['sourceTeam'], resourceId: 'ammo', delta: 1 }] }).issues.some(i => i.path.endsWith('.account'))).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [when([flag()], { kind: 'counter', counterId: 'x', comparison: ['gte'], value: 1 })] }).issues.some(i => i.path.endsWith('.comparison'))).toBe(true);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: '   ', delta: 1 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram({ resolve: [{ op: 'flagSet', flagId: 'seen', value: 1 }] }).ok).toBe(false);
    expect(validateGameplayMapEffectProgram(new Date(0)).ok).toBe(false);
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
});
