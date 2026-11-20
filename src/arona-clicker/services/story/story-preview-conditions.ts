import type {
  StoryAuthoringResult, StoryPreviewCheck, StoryPreviewCheckItem, StoryPreviewDecision,
  StoryPreviewDecisions, StoryPreviewRequirement,
} from '../../contracts/runtime/story-authoring';
import type { StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { Condition, ConditionGroup } from '../../../engine/types/expression';
import type { ConditionSystem } from '../../../engine/expression/condition-system';
import type { PlayerState } from '../../types/state';

export function hasPreviewCondition(condition: ConditionGroup): boolean {
  return condition.type !== 'AND' || condition.conditions.length > 0;
}

export function inspectPreviewCondition(
  expression: ConditionGroup, system: ConditionSystem, state: PlayerState,
): StoryPreviewCheckItem['requirement'] {
  const met = system.evaluateGroup(expression, state);
  return { kind: 'group', operator: expression.type, met,
    children: expression.conditions.map(node => inspectRequirement(node, system, state)) };
}

function inspectRequirement(node: Condition | ConditionGroup, system: ConditionSystem, state: PlayerState): StoryPreviewRequirement {
  if ('conditions' in node) {
    const children = node.conditions.map(child => inspectRequirement(child, system, state));
    const values = children.map(child => child.met);
    const decisive = node.type === 'OR';
    return { kind: 'group', operator: node.type, children,
      met: values.includes(decisive) ? decisive : values.includes(null) ? null : !decisive };
  }
  let met: boolean | null;
  // Diagnostic reads may include a leaf that the real evaluation short-circuited.
  try { met = system.evaluate(node, state); } catch { met = null; }
  return { kind: 'condition', condition: node, met, ...(node.target === 'area' ? { areaId: state.currentAreaId } : {}) };
}

export function previewEntryCheck(entry: StoryEntryDef, system: ConditionSystem, state: PlayerState, title: string): StoryPreviewCheckItem | undefined {
  const children: StoryPreviewRequirement[] = [];
  const initMet = !entry.availableInits.length || entry.availableInits.includes(state.activeInit);
  if (entry.availableInits.length) children.push({
    kind: 'requirement', met: initMet,
    text: `允许的 Init 为 ${entry.availableInits.join('、')}（当前 ${state.activeInit || '未进入 Init'}）`,
  });
  if (hasPreviewCondition(entry.triggerCondition)) {
    children.push(initMet ? inspectPreviewCondition(entry.triggerCondition, system, state)
      : inspectRequirement(entry.triggerCondition, system, state));
  }
  if (!children.length) return undefined;
  return {
    id: entry.id, label: title,
    requirement: { kind: 'group', operator: 'AND', met: children.every(child => child.met === true), children },
  };
}

type Adopted = Readonly<Record<string, boolean>>;
type RouteStep = StoryPreviewDecisions['route'][number];
let nextSession = 0;

/** Owned by one isolated authoring instance. Callbacks and decisions live only in memory. */
export class StoryPreviewConditions {
  private readonly session = ++nextSession;
  private sequence = 0;
  private waiting?: { check: StoryPreviewCheck; apply: (adopted: Adopted) => StoryAuthoringResult };
  private readonly history: StoryPreviewDecisions['history'][number][] = [];
  private readonly route: RouteStep[] = [];
  message?: string;

  constructor(private readonly entryId: string, private readonly entryTitle: string, private readonly storyName: (storyId: string) => string) {}

  get pending(): StoryPreviewCheck | undefined { return this.waiting?.check; }

  visit(kind: RouteStep['kind'], entryId: string, storyId: string): void {
    this.route.push({ kind, entryId, storyId, title: this.storyName(storyId) });
  }

  pause(check: Omit<StoryPreviewCheck, 'id'>, apply: (adopted: Adopted) => StoryAuthoringResult): void {
    if (this.waiting) throw new Error('试播已在等待另一项条件决定。');
    this.waiting = { check: { ...check, id: `preview-${this.session}:${++this.sequence}` }, apply };
  }

  decide(id: string, choices: Readonly<Record<string, StoryPreviewDecision>>): StoryAuthoringResult {
    const pending = this.waiting;
    if (!pending || pending.check.id !== id) return { ok: false, message: '该试播判断已失效。' };
    if (!choices || typeof choices !== 'object' || Array.isArray(choices)) return { ok: false, message: '试播决定格式无效。' };
    for (const [key, choice] of Object.entries(choices)) {
      if (!pending.check.items.some(item => item.id === key) || !['actual', 'pass', 'fail'].includes(choice)) {
        return { ok: false, message: '该试播决定包含无效条件。' };
      }
    }
    const adopted = Object.fromEntries(pending.check.items.map(item => {
      const choice = Object.prototype.hasOwnProperty.call(choices, item.id) ? choices[item.id] : 'actual';
      return [item.id, choice === 'actual' ? item.requirement.met : choice === 'pass'];
    }));
    this.waiting = undefined;
    this.history.push({ ...pending.check, adopted });
    let result: StoryAuthoringResult;
    try { result = pending.apply(adopted); }
    catch (error) { result = { ok: false, message: error instanceof Error ? error.message : String(error) }; }
    this.message = result.message || undefined;
    return result;
  }

  getView(): StoryPreviewDecisions {
    return structuredClone({ entryId: this.entryId, entryTitle: this.entryTitle,
      pending: this.pending, history: this.history, route: this.route, message: this.message });
  }

  close(): void {
    this.waiting = undefined;
    this.history.length = 0;
    this.route.length = 0;
    this.message = undefined;
  }
}
