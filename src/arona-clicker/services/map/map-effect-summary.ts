import type {
  NormalizedGameplayMapActionEffects,
  NormalizedGameplayMapEffectCondition,
  NormalizedGameplayMapEffectInstruction,
  NormalizedGameplayMapEffectLoopInstruction,
} from '../../../data-services/normalization/gameplay-map-effect-program';
import type { GameplayMapEffectConditionDef } from '../../../data-services/contracts/gameplay-map-effects';
import type { MapRunCardRef } from '../../contracts/map/map-cards';
import type {
  MapDeclaredEffectBranch,
  MapDeclaredEffectSummary,
  MapRelationScope,
  MapTargetRef,
  MapUnitRef,
} from '../../contracts/map/map-relations';

export interface MapEffectSummaryContext {
  readonly scope: MapRelationScope;
  readonly source: MapUnitRef | null;
  readonly primary: MapTargetRef | null;
}

function cloneCondition(condition: NormalizedGameplayMapEffectCondition): GameplayMapEffectConditionDef {
  if (condition.kind === 'not') {
    return Object.freeze({ kind: 'not', condition: cloneCondition(condition.condition) });
  }
  if (condition.kind === 'all' || condition.kind === 'any') {
    return Object.freeze({ kind: condition.kind, conditions: Object.freeze(condition.conditions.map(cloneCondition)) });
  }
  if (condition.kind === 'hpAtLeast' || condition.kind === 'hpAtMost') {
    return Object.freeze({ kind: condition.kind, target: condition.target, value: condition.value });
  }
  if (condition.kind === 'hpRatioAtLeast' || condition.kind === 'hpRatioAtMost') {
    return Object.freeze({ kind: condition.kind, target: condition.target,
      numerator: condition.numerator, denominator: condition.denominator });
  }
  if (condition.kind === 'counter') {
    return Object.freeze({ kind: 'counter', counterId: condition.counterId,
      comparison: condition.comparison, value: condition.value });
  }
  if (condition.kind === 'flag') {
    return Object.freeze({ kind: 'flag', flagId: condition.flagId, value: condition.value });
  }
  if (condition.kind === 'mapRunCounter') {
    return Object.freeze({ kind: 'mapRunCounter', counterId: condition.counterId,
      comparison: condition.comparison, value: condition.value });
  }
  if (condition.kind === 'mapRunFlag') {
    return Object.freeze({ kind: 'mapRunFlag', flagId: condition.flagId, value: condition.value });
  }
  if (condition.kind === 'resourceAtLeast') {
    return Object.freeze({ kind: 'resourceAtLeast', account: condition.account, resourceId: condition.resourceId, value: condition.value });
  }
  throw new Error(`Unsupported effect condition: ${String((condition as { kind?: unknown }).kind)}`);
}

function asUnit(target: MapTargetRef | null): MapUnitRef | null {
  return target && target.kind !== 'card' ? target : null;
}

function summaryBase(path: string, branches: readonly MapDeclaredEffectBranch[]) {
  return {
    declaration: 'declared' as const,
    certainty: branches.length === 0 ? 'unconditional' as const : 'conditional' as const,
    path,
    branches: Object.freeze([...branches]),
  };
}

/** Describe normalized E1/E2 declarations without evaluating guards or changing Owner state. */
export function summarizeMapActionEffects(
  effects: NormalizedGameplayMapActionEffects,
  context: MapEffectSummaryContext,
): readonly MapDeclaredEffectSummary[] {
  const summaries: MapDeclaredEffectSummary[] = [];
  const team = Object.freeze({ kind: 'team' as const,
    side: context.source?.kind === 'enemy' ? 'enemy' as const : 'party' as const,
    scope: context.scope });

  for (const instruction of effects.prepare) {
    const recipient = context.primary?.kind === 'card' ? context.primary as MapRunCardRef : null;
    summaries.push(Object.freeze({
      ...summaryBase(instruction.originPath, []),
      kind: 'cardCost', resourceId: 'sCost', amount: -instruction.amount, recipient,
    }));
  }

  const walk = (
    instructions: readonly (NormalizedGameplayMapEffectInstruction | NormalizedGameplayMapEffectLoopInstruction)[],
    branches: readonly MapDeclaredEffectBranch[],
    inLoop = false,
  ): void => {
    for (const instruction of instructions) {
      if (instruction.op === 'forTargets') {
        walk(instruction.body, branches, true);
        continue;
      }
      if (inLoop && instruction.op === 'when') continue;
      if (inLoop && (instruction.op === 'damage' || instruction.op === 'heal'
        || instruction.op === 'hpChange' || instruction.op === 'statusApply')) continue;
      if (instruction.op === 'mapRunCounterAdd' || instruction.op === 'mapRunFlagSet') continue;
      if (instruction.op === 'when') {
        let condition: GameplayMapEffectConditionDef;
        try { condition = cloneCondition(instruction.condition as NormalizedGameplayMapEffectCondition); }
        catch { continue; }
        const thenBranch = Object.freeze({ whenPath: instruction.originPath, conditionPath: instruction.condition.originPath,
          branch: 'then' as const, condition });
        walk(instruction.then, [...branches, thenBranch], inLoop);
        if (instruction.else !== undefined) {
          const elseBranch = Object.freeze({ whenPath: instruction.originPath, conditionPath: instruction.condition.originPath,
            branch: 'else' as const, condition });
          walk(instruction.else, [...branches, elseBranch], inLoop);
        }
        continue;
      }

      const leaf = instruction as NormalizedGameplayMapEffectInstruction;
      const base = summaryBase(leaf.originPath, branches);
      if (leaf.op === 'damage' || leaf.op === 'heal') {
        const selector = typeof leaf.target === 'object' ? leaf.target.set : undefined;
        const recipient = selector ? null : asUnit(context.primary);
        summaries.push(Object.freeze({ ...base, kind: leaf.op, target: selector ? 'set' : 'primary',
          ...(selector ? { set: Object.freeze({ ...selector }) } : {}), amount: leaf.amount,
          ...(leaf.repeat === undefined ? {} : { repeat: leaf.repeat }), recipient }));
      } else if (leaf.op === 'hpChange') {
        const recipient = leaf.target === 'source' ? context.source : asUnit(context.primary);
        summaries.push(Object.freeze({ ...base, kind: 'hp', target: leaf.target, delta: leaf.delta, recipient }));
      } else if (leaf.op === 'revive') {
        summaries.push(Object.freeze({ ...base, kind: 'revive', target: 'primary', amount: leaf.amount,
          recipient: asUnit(context.primary) }));
      } else if (leaf.op === 'resourceChange') {
        // The summary contract has no target-bound recipient shape for these newer accounts yet.
        if (leaf.account === 'additionalActor' || leaf.account === 'loopTargetActor') continue;
        const recipient = leaf.account === 'sourceActor' ? context.source
          : leaf.account === 'primaryActor' ? asUnit(context.primary) : team;
        summaries.push(Object.freeze({
          ...base, kind: 'resource', account: leaf.account, resourceId: leaf.resourceId,
          delta: leaf.delta, recipient,
        }));
      } else if (leaf.op === 'counterAdd') {
        summaries.push(Object.freeze({ ...base, kind: 'counter', counterId: leaf.counterId, delta: leaf.delta, recipient: null }));
      } else if (leaf.op === 'statusApply') {
        const recipient = leaf.target === 'source' ? context.source : asUnit(context.primary);
        summaries.push(Object.freeze({
          ...base, kind: 'statusApply', target: leaf.target, statusId: leaf.statusId,
          stacks: leaf.stacks, durationRounds: leaf.durationRounds, recipient,
        }));
      } else if (leaf.op === 'flagSet') {
        summaries.push(Object.freeze({ ...base, kind: 'flag', flagId: leaf.flagId, value: leaf.value, recipient: null }));
      }
    }
  };

  walk(effects.resolve, []);
  return Object.freeze(summaries);
}

