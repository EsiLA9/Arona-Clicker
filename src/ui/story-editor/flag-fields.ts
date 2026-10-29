import type { StoryLocalFlagAction } from '../../data-services/contracts/story-node-actions';
import type { StoryFlagValue } from '../../engine/contracts/story-run-flags';
import type { StoryDraftNode } from './model';
import { isStoryFlagValue } from '../../data-services/validation/story-run-flags';

export interface LocalFlagInput { type: 'string' | 'number' | 'boolean' | 'null' | 'structured'; text: string; value?: StoryFlagValue }
export type LocalFlagInputs = Record<string, LocalFlagInput>;
export function localFlagInput(node: StoryDraftNode, inputs?: LocalFlagInputs): LocalFlagInput | undefined {
  if (inputs && Object.prototype.hasOwnProperty.call(inputs, node.id)) return inputs[node.id];
  const action = node.type === 'operation' ? node.action : undefined;
  if (action?.kind !== 'localFlag' || action.op !== 'set') return undefined;
  const value = action.value;
  if (value === null) return { type: 'null', text: '' };
  if (typeof value === 'string') return { type: 'string', text: value };
  if (typeof value === 'number') return { type: 'number', text: String(value) };
  if (typeof value === 'boolean') return { type: 'boolean', text: String(value) };
  if (isStoryFlagValue(value)) return { type: 'structured', text: '', value };
  return undefined;
}
export function parseLocalFlagInput(input: LocalFlagInput): { ok: true; value: StoryFlagValue } | { ok: false } {
  if (input.type === 'structured') return isStoryFlagValue(input.value) ? { ok: true, value: input.value } : { ok: false };
  if (input.type === 'string') return { ok: true, value: input.text };
  if (input.type === 'null') return { ok: true, value: null };
  if (input.type === 'boolean') return input.text === 'true' || input.text === 'false' ? { ok: true, value: input.text === 'true' } : { ok: false };
  // Number('') and hexadecimal are not author numeric input.
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input.text)) return { ok: false };
  const value = Number(input.text);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
}
export function localFlagAction(op: 'set' | 'remove', name: string, input?: LocalFlagInput): StoryLocalFlagAction {
  if (op === 'remove') return { kind: 'localFlag', op, name };
  const parsed = parseLocalFlagInput(input ?? { type: 'string', text: '' });
  return { kind: 'localFlag', op, name, value: parsed.ok ? parsed.value : '' };
}
