import { describe, expect, it } from 'vitest';
import type { ConditionGroup } from '../../src/engine/types/expression';
import type { StoryNodeDocument, StoryTalkletNode, StoryClickNode } from '../../src/data-services/contracts/story-node';
import type { StoryAction } from '../../src/data-services/contracts/story-node-actions';
import type { StoryNodePlaybackHost, StoryNodePlaybackView, StoryNodeDocuments } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import { StoryNodePlayer } from '../../src/arona-clicker/services/story/story-node-player';

const ROOT = 'test:story:root';
const source = { entryId: 'test:activestory:source', owner: 'variant:source' } as const;
const talk = (id: string, stageId: string): StoryTalkletNode => ({
  id, type: 'talklet', stageId, content: { kind: 'talk', text: id },
});
const button = (id: string, stageId: string, press?: { base: number; rand?: number }, actions: readonly StoryAction[] = []): StoryClickNode => ({
  id, type: 'click', stageId,
  interaction: { kind: 'button', text: id, ...(press ? { press } : {}), ...(actions.length ? { result: { actions } } : {}) },
});
const documentOf = (id: string, nodes: StoryNodeDocument['nodes'], stages: StoryNodeDocument['stages']): StoryNodeDocument => ({ id, name: id, nodes, stages });
const documents = (...items: StoryNodeDocument[]): StoryNodeDocuments => new Map(items.map(item => [item.id, item]));
const addResource = (resourceId: string, amount: number): StoryAction => ({ kind: 'state', effects: [{ op: 'addResource', resourceId, amount }] });

interface HostState {
  resources: Record<string, number>;
  flags: Record<string, string>;
  preflighted: StoryAction[];
  applied: StoryAction[];
  visitedChecks: string[][];
  randomCalls: number;
  allowChoice: boolean;
}
function makeHost(options: {
  randomValues?: number[];
  rejectPreflight?: (action: StoryAction) => boolean;
  rejectExecute?: (action: StoryAction) => boolean;
  duringExecute?: () => void;
} = {}): { host: StoryNodePlaybackHost; state: HostState } {
  const state: HostState = { resources: {}, flags: {}, preflighted: [], applied: [], visitedChecks: [], randomCalls: 0, allowChoice: true };
  const host: StoryNodePlaybackHost = {
    evaluate: (condition: ConditionGroup, visited) => {
      state.visitedChecks.push([...visited]);
      const first = condition.conditions[0];
      return !!first && 'target' in first && first.target === 'visitedStoryInChain'
        && state.allowChoice && visited.includes(first.key);
    },
    random: () => {
      const index = state.randomCalls++;
      return options.randomValues?.[index] ?? 0;
    },
    preflight: action => {
      state.preflighted.push(action);
      return options.rejectPreflight?.(action) ? 'preflight rejected' : undefined;
    },
    execute: action => {
      if (options.rejectExecute?.(action)) return { status: 'rejected', error: 'late execution failure' };
      state.applied.push(action);
      options.duringExecute?.();
      if (action.kind === 'state') for (const effect of action.effects) {
        if (effect.op === 'addResource') state.resources[effect.resourceId] = (state.resources[effect.resourceId] ?? 0) + Number(effect.amount);
        if (effect.op === 'setResource') state.resources[effect.resourceId] = Number(effect.amount);
        if (effect.op === 'setFlag') state.flags[effect.flagId] = String(effect.value);
      }
      return { status: 'applied' };
    },
  };
  return { host, state };
}
const delivery = (view: StoryNodePlaybackView) => {
  if (view.status !== 'delivery') throw new Error(`expected delivery, got ${view.status}`);
  return view;
};
const input = (view: StoryNodePlaybackView) => {
  if (view.status !== 'input') throw new Error(`expected input, got ${view.status}`);
  return view;
};

describe('StoryNodePlayer', () => {
  it('delivers Talklets one at a time and uses fresh tickets for press work', () => {
    const root = documentOf(ROOT, [talk('one', 'dialogue'), talk('two', 'dialogue'), button('work', 'press', { base: 2, rand: 2 }, [addResource('credit', 5)])], {
      dialogue: { advance: 'auto' }, press: { advance: 'input' },
    });
    const { host, state } = makeHost({ randomValues: [0.75] });
    const player = new StoryNodePlayer(documents(root), host);
    const first = delivery(player.start(ROOT, source).view);
    expect(first.node.id).toBe('one');
    expect(delivery(player.getView())).toEqual(first);
    expect(state.randomCalls).toBe(0);
    const second = delivery(player.ackDelivery(first.token).view);
    expect(second.node.id).toBe('two');
    expect(player.ackDelivery(first.token).ok).toBe(false);
    const work = input(player.ackDelivery(second.token).view);
    expect(work.press).toEqual({ total: 3, done: 0 });
    expect(state.randomCalls).toBe(1);
    expect(player.getView()).toEqual(work);
    const one = input(player.submit(work.token).view);
    expect(one.press).toEqual({ total: 3, done: 1 });
    expect(player.submit(work.token).ok).toBe(false);
    const two = input(player.submit(one.token).view);
    expect(two.press).toEqual({ total: 3, done: 2 });
    const done = player.submit(two.token);
    expect(done.view.status).toBe('completed');
    expect(state.resources.credit).toBe(5);
    expect(state.applied).toHaveLength(1);
    expect(state.randomCalls).toBe(1);
  });

  it('rechecks choice conditions at submit and supplies this chain’s visited IDs', () => {
    const branchId = 'test:story:branch';
    const root = documentOf(ROOT, [{ id: 'jump', type: 'transfer', transfer: { mode: 'goto', storyId: branchId } }], {});
    const seen = (key: string): ConditionGroup => ({ type: 'AND', conditions: [{ target: 'visitedStoryInChain', key, comparator: '==', value: 1 }] });
    const branch = documentOf(branchId, [{ id: 'pick', type: 'click', stageId: 'pick', interaction: { kind: 'choice', options: [
      { id: 'yes', text: '是', condition: seen(ROOT), result: { actions: [addResource('credit', 9)] } },
      { id: 'no', text: '否', condition: seen('test:story:unvisited') },
    ] } }], { pick: { advance: 'input' } });
    const { host, state } = makeHost();
    const player = new StoryNodePlayer(documents(root, branch), host);
    const choice = input(player.start(ROOT, source).view);
    expect(choice.availableOptionIds).toEqual(['yes']);
    expect(state.visitedChecks.some(ids => ids.includes(ROOT))).toBe(true);
    state.allowChoice = false;
    const rejected = player.submit(choice.token, 'yes');
    expect(rejected.ok).toBe(false);
    expect(input(rejected.view).availableOptionIds).toEqual([]);
    expect(state.resources).toEqual({});
    expect(state.applied).toHaveLength(0);
  });

  it('preflights all branch actions and the transfer target before reply or effects', () => {
    const root = documentOf(ROOT, [{ id: 'pick', type: 'click', stageId: 'pick', interaction: { kind: 'choice',
      sharedActions: [addResource('credit', 1)], options: [{ id: 'go', text: '走', reply: { kind: 'talk', text: '出发' }, result: {
        actions: [addResource('credit', 2)], transfer: { mode: 'goto', storyId: 'test:story:missing' },
      } }],
    } }], { pick: { advance: 'input' } });
    const { host, state } = makeHost();
    const player = new StoryNodePlayer(documents(root), host);
    const waiting = input(player.start(ROOT, source).view);
    const result = player.submit(waiting.token, 'go');
    expect(result.ok).toBe(false);
    expect(result.view.status).toBe('input');
    expect(state.resources).toEqual({});
    expect(state.applied).toHaveLength(0);
    expect(result.events.some(event => event.type === 'reply')).toBe(false);
  });

  it('makes an unexpected execute rejection terminal and never retries prior actions', () => {
    const root = documentOf(ROOT, [{ id: 'pick', type: 'click', stageId: 'pick', interaction: { kind: 'choice', options: [{
      id: 'go', text: '执行', result: { actions: [addResource('credit', 1), addResource('late', 1)] },
    }] } }], { pick: { advance: 'input' } });
    const { host, state } = makeHost({ rejectExecute: action => action.kind === 'state' && action.effects.some(effect => effect.op === 'addResource' && effect.resourceId === 'late') });
    const player = new StoryNodePlayer(documents(root), host);
    const waiting = input(player.start(ROOT, source).view);
    const failed = player.submit(waiting.token, 'go');
    expect(failed.ok).toBe(false);
    expect(failed.view.status).toBe('failed');
    expect(state.resources.credit).toBe(1);
    expect(state.resources.late).toBeUndefined();
    expect(player.submit(waiting.token, 'go').ok).toBe(false);
    expect(state.resources.credit).toBe(1);
    expect(state.applied).toHaveLength(1);
  });

  it('preserves an insert return point through goto and completes with source identity', () => {
    const subId = 'test:story:inserted';
    const targetId = 'test:story:target';
    const root = documentOf(ROOT, [
      { id: 'pick', type: 'click', stageId: 'pick', interaction: { kind: 'choice', options: [{ id: 'yes', text: '是', reply: { kind: 'talk', text: '收到' }, result: { transfer: { mode: 'insert', storyId: subId } } }] } },
      talk('root-tail', 'tail'),
    ], { pick: { advance: 'input' }, tail: { advance: 'auto' } });
    const sub = documentOf(subId, [{ id: 'jump', type: 'transfer', transfer: { mode: 'goto', storyId: targetId } }], {});
    const target = documentOf(targetId, [talk('target-line', 'body')], { body: { advance: 'auto' } });
    const { host } = makeHost();
    const player = new StoryNodePlayer(documents(root, sub, target), host);
    const prompt = input(player.start(ROOT, source).view);
    const entered = player.submit(prompt.token, 'yes');
    const targetLine = delivery(entered.view);
    expect(targetLine.storyId).toBe(targetId);
    const replyIndex = entered.events.findIndex(event => event.type === 'reply');
    const targetViewIndex = entered.events.findIndex(event => event.type === 'view' && event.view.status === 'delivery' && event.view.storyId === targetId);
    expect(replyIndex).toBeGreaterThanOrEqual(0);
    expect(replyIndex).toBeLessThan(targetViewIndex);
    const returned = delivery(player.ackDelivery(targetLine.token).view);
    expect(returned.storyId).toBe(ROOT);
    expect(returned.node.id).toBe('root-tail');
    const completed = player.ackDelivery(returned.token).view;
    expect(completed.status).toBe('completed');
    if (completed.status === 'completed') expect(completed.completion).toMatchObject({ entryId: source.entryId, rootStoryId: ROOT, owner: source.owner, terminalStoryId: ROOT });
  });

  it('rejects nested commands but lets cancel stop the remaining old action loop', () => {
    const root = documentOf(ROOT, [{ id: 'press', type: 'click', stageId: 'press', interaction: { kind: 'button', text: '执行', result: {
      actions: [addResource('credit', 1), { kind: 'state', effects: [{ op: 'setFlag', flagId: 'later', value: true }] }],
    } } }], { press: { advance: 'input' } });
    let player!: StoryNodePlayer;
    let token = '';
    let nested: boolean[] = [];
    const { host, state } = makeHost({ duringExecute: () => {
      nested = [player.start(ROOT, source).ok, player.ackDelivery(token).ok, player.submit(token).ok];
      player.cancel();
    } });
    player = new StoryNodePlayer(documents(root), host);
    token = input(player.start(ROOT, source).view).token;
    player.submit(token);
    expect(nested).toEqual([false, false, false]);
    expect(player.getView().status).toBe('idle');
    expect(state.resources.credit).toBe(1);
    expect(state.flags.later).toBeUndefined();
    expect(state.applied).toHaveLength(1);
  });
});
