import type { StoryFlagValue, StoryRunFlags } from '../../engine/contracts/story-run-flags';
import type { StoryLocalFlagAction } from '../contracts/story-node-actions';

export const validStoryFlagName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** JSON values only: no NaN, undefined, class instances, cycles, or lossy properties. */
export function isStoryFlagValue(value: unknown, visiting = new Set<object>()): value is StoryFlagValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || visiting.has(value) || !Array.isArray(value) && !record(value)) return false;
  visiting.add(value);
  const keys = Reflect.ownKeys(value);
  const valid = Array.isArray(value)
    ? keys.length === value.length + 1 && [...value].every(item => isStoryFlagValue(item, visiting))
    : keys.every(key => typeof key === 'string' && Object.prototype.propertyIsEnumerable.call(value, key)
      && isStoryFlagValue((value as Record<string, unknown>)[key], visiting));
  visiting.delete(value);
  return valid;
}

export function isStoryRunFlags(value: unknown): value is StoryRunFlags {
  return record(value) && Reflect.ownKeys(value).every(key => typeof key === 'string' && validStoryFlagName(key)
    && Object.prototype.propertyIsEnumerable.call(value, key) && isStoryFlagValue(value[key]));
}

/** Local actions are closed branches; remove never carries a stale set value. */
export function isStoryLocalFlagAction(value: unknown): value is StoryLocalFlagAction {
  if (!record(value) || value.kind !== 'localFlag' || !validStoryFlagName(value.name)) return false;
  if (value.op === 'remove') return Reflect.ownKeys(value).every(key => ['kind', 'op', 'name'].includes(String(key)));
  return value.op === 'set' && Object.prototype.hasOwnProperty.call(value, 'value') && isStoryFlagValue(value.value)
    && Reflect.ownKeys(value).every(key => ['kind', 'op', 'name', 'value'].includes(String(key)));
}
