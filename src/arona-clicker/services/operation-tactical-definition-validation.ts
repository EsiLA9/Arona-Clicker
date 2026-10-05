import type { OperationActionDef } from '../contracts/operation-action';
import type { OperationStudentSkillRuleDef } from '../contracts/operation-skill';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

function rejectUnsupportedFields(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(path + ' contains unsupported field: ' + key);
}

function collectIds(value: unknown, path: string, issues: string[], itemLabel = 'ID'): Set<string> {
  const result = new Set<string>();
  if (!Array.isArray(value)) {
    issues.push(path + ' must be an array of ' + itemLabel + 's');
    return result;
  }
  value.forEach((id, index) => {
    if (!isNonEmptyId(id)) issues.push(path + '[' + index + '] must be a non-empty ' + itemLabel);
    else if (result.has(id)) issues.push(path + ' contains duplicate ' + itemLabel + ': ' + id);
    else result.add(id);
  });
  return result;
}

function validateOperationActionEffect(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(path + ' must be an effect object');
    return;
  }
  switch (value.kind) {
    case 'actorHpDelta':
      rejectUnsupportedFields(value, ['kind', 'recipient', 'amount'], path, issues);
      if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) issues.push(path + '.amount must be a finite number');
      if (value.recipient !== 'actor' && value.recipient !== 'target') issues.push(path + '.recipient must be actor or target');
      break;
    case 'actorResourceDelta':
      rejectUnsupportedFields(value, ['kind', 'recipient', 'resourceId', 'amount'], path, issues);
      if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) issues.push(path + '.amount must be a finite number');
      if (value.recipient !== 'actor' && value.recipient !== 'target') issues.push(path + '.recipient must be actor or target');
      if (!isNonEmptyId(value.resourceId)) issues.push(path + '.resourceId must be a non-empty ID');
      break;
    case 'teamResourceDelta':
      rejectUnsupportedFields(value, ['kind', 'recipient', 'resourceId', 'amount'], path, issues);
      if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) issues.push(path + '.amount must be a finite number');
      if (value.recipient !== 'actorTeam' && value.recipient !== 'targetTeam') issues.push(path + '.recipient must be actorTeam or targetTeam');
      if (!isNonEmptyId(value.resourceId)) issues.push(path + '.resourceId must be a non-empty ID');
      break;
    case 'eventTrackDelta':
      rejectUnsupportedFields(value, ['kind', 'trackId', 'amount'], path, issues);
      if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) issues.push(path + '.amount must be a finite number');
      if (!isNonEmptyId(value.trackId)) issues.push(path + '.trackId must be a non-empty ID');
      break;
    case 'eventFact':
      rejectUnsupportedFields(value, ['kind', 'factId', 'op'], path, issues);
      if (!isNonEmptyId(value.factId)) issues.push(path + '.factId must be a non-empty ID');
      if (value.op !== 'reveal' && value.op !== 'forget') issues.push(path + '.op must be reveal or forget');
      break;
    case 'heldItem':
      rejectUnsupportedFields(value, ['kind', 'itemId', 'op'], path, issues);
      if (!isNonEmptyId(value.itemId)) issues.push(path + '.itemId must be a non-empty ID');
      if (value.op !== 'grant' && value.op !== 'remove') issues.push(path + '.op must be grant or remove');
      break;
    default:
      issues.push(path + '.kind is not a supported Operation Action effect');
  }
}

export function validateOperationActionEffects(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push(path + ' must be an array');
    return;
  }
  value.forEach((effect, index) => validateOperationActionEffect(effect, path + '[' + index + ']', issues));
}

/** Validates the closed ActionDef payload; catalog references belong to the content validator. */
export function validateOperationActionDef(value: unknown): readonly string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return ['action definition must be an object'];
  rejectUnsupportedFields(value, [
    'id', 'allowedParticipantKinds', 'requiredCapabilityIds', 'reasonIds', 'tagIds', 'cost', 'target', 'effects',
  ], 'action', issues);
  if (!isNonEmptyId(value.id)) issues.push('id must be a non-empty Action ID');

  const allowedKinds = collectIds(value.allowedParticipantKinds, 'allowedParticipantKinds', issues);
  if (allowedKinds.size === 0) issues.push('allowedParticipantKinds must contain at least one participant kind');
  for (const kind of allowedKinds) {
    if (!['student', 'opponent', 'environment'].includes(kind)) {
      issues.push('allowedParticipantKinds contains an unsupported participant kind: ' + kind);
    }
  }
  collectIds(value.requiredCapabilityIds, 'requiredCapabilityIds', issues);
  collectIds(value.reasonIds, 'reasonIds', issues);
  collectIds(value.tagIds, 'tagIds', issues);

  if (value.cost !== undefined) {
    if (!isRecord(value.cost)) {
      issues.push('cost must be an object');
    } else {
      rejectUnsupportedFields(value.cost, ['scope', 'resourceId', 'amount'], 'cost', issues);
      if (value.cost.scope !== 'actor' && value.cost.scope !== 'team') issues.push('cost.scope must be actor or team');
      if (!isNonEmptyId(value.cost.resourceId)) issues.push('cost.resourceId must be a non-empty ID');
      if (typeof value.cost.amount !== 'number' || !Number.isFinite(value.cost.amount) || value.cost.amount <= 0) {
        issues.push('cost.amount must be a positive finite number');
      }
    }
  }

  if (!isRecord(value.target)) {
    issues.push('target must be an object');
  } else if (value.target.kind === 'none') {
    rejectUnsupportedFields(value.target, ['kind'], 'target', issues);
    if (value.target.relation !== undefined) issues.push('target.relation must be omitted when target.kind is none');
  } else if (value.target.kind === 'actor') {
    rejectUnsupportedFields(value.target, ['kind', 'relation', 'allowedActorIds', 'allowedActorTypes'], 'target', issues);
    if (!['self', 'sameTeam', 'otherTeam', 'any'].includes(String(value.target.relation))) {
      issues.push('target.relation must be self, sameTeam, otherTeam, or any');
    }
    if (value.target.allowedActorIds !== undefined) {
      collectIds(value.target.allowedActorIds, 'target.allowedActorIds', issues);
      if (Array.isArray(value.target.allowedActorIds) && value.target.allowedActorIds.length === 0) {
        issues.push('target.allowedActorIds must contain at least one Actor ID when declared');
      }
    }
    if (value.target.allowedActorTypes !== undefined) {
      collectIds(value.target.allowedActorTypes, 'target.allowedActorTypes', issues, 'Actor type');
      if (Array.isArray(value.target.allowedActorTypes) && value.target.allowedActorTypes.length === 0) {
        issues.push('target.allowedActorTypes must contain at least one Actor type when declared');
      }
    }
  } else {
    issues.push('target.kind must be none or actor');
  }

  validateOperationActionEffects(value.effects, 'effects', issues);
  return issues;
}

/** Validates the finite Skill rule payload; action/event references belong to the content validator. */
export function validateOperationStudentSkillRuleDef(value: unknown): readonly string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return ['student skill rule must be an object'];
  rejectUnsupportedFields(value, ['id', 'triggerActionIds', 'chanceBps', 'effects'], 'student skill rule', issues);
  if (!isNonEmptyId(value.id)) issues.push('id must be a non-empty Student Skill Rule ID');
  collectIds(value.triggerActionIds, 'triggerActionIds', issues);
  if (Array.isArray(value.triggerActionIds) && value.triggerActionIds.length === 0) {
    issues.push('triggerActionIds must contain at least one Action ID');
  }
  if (!Number.isSafeInteger(value.chanceBps) || Number(value.chanceBps) < 0 || Number(value.chanceBps) > 10000) {
    issues.push('chanceBps must be a safe integer in [0, 10000]');
  }
  validateOperationActionEffects(value.effects, 'effects', issues);
  return issues;
}

export function isOperationActionDef(value: unknown): value is OperationActionDef {
  return isRecord(value) && isNonEmptyId(value.id);
}

export function isOperationStudentSkillRuleDef(value: unknown): value is OperationStudentSkillRuleDef {
  return isRecord(value) && isNonEmptyId(value.id);
}
