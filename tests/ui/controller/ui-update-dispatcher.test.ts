import { describe, expect, it } from 'vitest';
import { UISurfaceRuntime } from '../../../src/ui/update/ui-surface';
import { UIUpdateDispatcher } from '../../../src/ui/update/ui-update-dispatcher';
import type { PanelState } from '../../../src/ui/components/shared/app-shell';
import type { UIUpdate, UIUpdateApplyResult } from '../../../src/ui/update/ui-update-types';

function panelState(): PanelState {
  return {
    service: 'game',
    leftTab: 'area',
    centerTab: 'chat',
    rightTab: 'spot',
    chatEntries: [],
    chatTexts: [],
    selectedVariantId: null,
    conversationVariantId: null,
    studentChats: {},
    studentChatTexts: {},
    storyNavPath: [],
  };
}

describe('UI Surface token and update dispatcher', () => {
  it('releases pending work and rejects future updates after disposal', async () => {
    const applied: UIUpdate[] = [];
    const dispatcher = new UIUpdateDispatcher({
      getCurrentSurfaceToken: () => ({ key: 'game', generation: 0 }),
      isSurfaceCurrent: () => true,
      apply: update => { applied.push(update); return 'applied'; },
    });
    dispatcher.request({ type: 'structure', scope: 'app' });
    dispatcher.dispose();
    dispatcher.request({ type: 'structure', scope: 'workspace' });
    expect(dispatcher.applyNow({ type: 'structure', scope: 'app' })).toBe('not-found');
    await Promise.resolve();
    dispatcher.flushNow();
    expect(applied).toEqual([]);
  });

  it('invalidates map and map-entry surfaces when their business instance changes', () => {
    const state = panelState();
    state.workspaceNavigation = { current: { kind: 'map', runId: 'first' } };
    const runtime = new UISurfaceRuntime(state);
    runtime.markMounted();
    const first = runtime.current();
    state.workspaceNavigation.current = { kind: 'map', runId: 'second' };
    runtime.sync(state);
    expect(runtime.isCurrent(first)).toBe(false);
    expect(runtime.current().key).toBe('map:second');
    state.workspaceNavigation.current = { kind: 'map-entry', mapId: 'entry-first' };
    runtime.sync(state); runtime.markMounted();
    const entry = runtime.current();
    state.workspaceNavigation.current = { kind: 'map-entry', mapId: 'entry-second' };
    runtime.sync(state);
    expect(runtime.isCurrent(entry)).toBe(false);
    expect(runtime.current().key).toBe('map-entry:entry-second');
  });
  it('uses workspace identity plus generation to reject stale DOM updates', () => {
    const state = panelState();
    const runtime = new UISurfaceRuntime(state);
    const gameToken = runtime.current();
    runtime.markMounted();
    expect(runtime.isCurrent(gameToken)).toBe(true);

    state.workspace = {
      type: 'shop',
      spotId: 'spot-a',
      shopId: 'shop-a',
      session: {} as never,
      feed: [],
      returnContext: { leftTab: 'area', centerTab: 'chat', rightTab: 'spot', selectedVariantId: null, conversationVariantId: null },
      themeId: 'theme-a',
    };
    runtime.sync(state);
    expect(runtime.current()).toEqual({ key: 'shop:spot-a:shop-a', generation: 1 });
    expect(runtime.isCurrent(gameToken)).toBe(false);
    runtime.markMounted();
    expect(runtime.isCurrent(runtime.current())).toBe(true);
  });

  it('increments generation when the same surface is mounted again', () => {
    const runtime = new UISurfaceRuntime(panelState());
    runtime.markMounted();
    const firstMount = runtime.current();

    runtime.markMounted();

    expect(runtime.current()).toEqual({ key: 'game', generation: 1 });
    expect(runtime.isCurrent(firstMount)).toBe(false);
    expect(runtime.isCurrent(runtime.current())).toBe(true);
  });

  it('coalesces duplicates, applies narrow updates before behavior, and drops stale requests', () => {
    const applied: string[] = [];
    const dropped: UIUpdate[] = [];
    let token = { key: 'shop:spot-a:shop-a', generation: 1 };
    const sink = {
      getCurrentSurfaceToken: () => token,
      isSurfaceCurrent: (candidate: typeof token) => candidate.key === token.key && candidate.generation === token.generation,
      apply: (update: UIUpdate): UIUpdateApplyResult => {
        applied.push(update.type === 'behavior' ? `behavior:${update.key}` : update.type);
        return 'applied';
      },
      onDrop: (update: UIUpdate) => dropped.push(update),
    };
    const dispatcher = new UIUpdateDispatcher(sink);
    dispatcher.request({ type: 'behavior', behavior: 'resource.value', key: 'credit', hostId: 'centerPanel.shop.catalog', reason: 'a' });
    dispatcher.request({ type: 'behavior', behavior: 'resource.value', key: 'credit', hostId: 'centerPanel.shop.catalog', reason: 'b' });
    dispatcher.request({ type: 'region', hostId: 'centerPanel.shop.catalog', reason: 'region' });
    dispatcher.request({ type: 'behavior', behavior: 'resource.value', key: 'frame', hostId: 'rightPanel.shop.settlement', reason: 'other-region' });
    dispatcher.flushNow();
    expect(applied).toEqual(['region', 'behavior:frame']);

    const stale = { ...token };
    token = { key: 'game', generation: 2 };
    dispatcher.applyNow({ type: 'behavior', behavior: 'resource.value', key: 'credit', token: stale, reason: 'old' });
    expect(dropped).toHaveLength(1);
  });

  it('lets structure updates dominate queued regions and behaviors', () => {
    const applied: string[] = [];
    const token = { key: 'game', generation: 0 };
    const dispatcher = new UIUpdateDispatcher({
      getCurrentSurfaceToken: () => token,
      isSurfaceCurrent: candidate => candidate.key === token.key && candidate.generation === token.generation,
      apply: update => {
        applied.push(update.type === 'structure' ? `structure:${update.scope}` : update.type);
        return 'applied';
      },
    });
    dispatcher.request({ type: 'behavior', behavior: 'spot.yield', key: '*', reason: 'tick' });
    dispatcher.request({ type: 'region', hostId: 'leftPanel', reason: 'reveal' });
    dispatcher.request({ type: 'structure', scope: 'workspace', reason: 'workspace-change' });
    dispatcher.flushNow();
    expect(applied).toEqual(['structure:workspace']);
  });

  it('keeps element updates narrower than regions and coalesces the same target', () => {
    const applied: string[] = [];
    const token = { key: 'game', generation: 0 };
    const dispatcher = new UIUpdateDispatcher({
      getCurrentSurfaceToken: () => token,
      isSurfaceCurrent: candidate => candidate.key === token.key && candidate.generation === token.generation,
      apply: update => {
        if (update.type === 'element') applied.push(`element:${update.target}:${update.key}`);
        else applied.push(update.type);
        return 'applied';
      },
    });
    dispatcher.request({ type: 'element', target: 'spot.card', key: 'spot-a', hostId: 'rightPanel.spot', reason: 'a' });
    dispatcher.request({ type: 'element', target: 'spot.card', key: 'spot-a', hostId: 'rightPanel.spot', reason: 'b' });
    dispatcher.request({ type: 'element', target: 'spot.card', key: 'spot-b', hostId: 'rightPanel.spot', reason: 'c' });
    dispatcher.request({ type: 'region', hostId: 'rightPanel.spot', reason: 'region' });
    dispatcher.flushNow();
    expect(applied).toEqual(['region']);
  });

  it('keeps element updates isolated by column instance when reducing regions', () => {
    const applied: string[] = [];
    const token = { key: 'game', generation: 0 };
    const columns = new Map([
      ['game/facilities-a', { instanceId: 'game/facilities-a', generation: 1 }],
      ['game/facilities-b', { instanceId: 'game/facilities-b', generation: 2 }],
    ]);
    const dispatcher = new UIUpdateDispatcher({
      getCurrentSurfaceToken: () => token,
      isSurfaceCurrent: candidate => candidate.key === token.key && candidate.generation === token.generation,
      isColumnCurrent: candidate => columns.get(candidate.instanceId)?.generation === candidate.generation,
      apply: update => {
        if (update.type === 'region') applied.push(`region:${update.instanceId}`);
        else if (update.type === 'element') applied.push(`element:${update.instanceId}:${update.key}`);
        return 'applied';
      },
    });

    dispatcher.request({
      type: 'element', target: 'spot.card', key: 'spot-a', hostId: 'rightPanel.spot',
      instanceId: 'game/facilities-a', columnToken: columns.get('game/facilities-a'), reason: 'a-element',
    });
    dispatcher.request({
      type: 'element', target: 'spot.card', key: 'spot-a', hostId: 'rightPanel.spot',
      instanceId: 'game/facilities-b', columnToken: columns.get('game/facilities-b'), reason: 'b-element',
    });
    dispatcher.request({
      type: 'region', hostId: 'game/facilities-a', instanceId: 'game/facilities-a',
      columnToken: columns.get('game/facilities-a'), reason: 'a-region',
    });

    dispatcher.flushNow();

    expect(applied).toEqual(['region:game/facilities-a', 'element:game/facilities-b:spot-a']);
  });

  it('drops queued and immediate element updates for a stale column mount', () => {
    const applied: UIUpdate[] = [];
    const dropped: Array<{ update: UIUpdate; reason: string }> = [];
    const surface = { key: 'game', generation: 0 };
    let currentColumn = { instanceId: 'game/facilities', generation: 2 };
    const dispatcher = new UIUpdateDispatcher({
      getCurrentSurfaceToken: () => surface,
      isSurfaceCurrent: candidate => candidate.key === surface.key && candidate.generation === surface.generation,
      isColumnCurrent: candidate => candidate.instanceId === currentColumn.instanceId && candidate.generation === currentColumn.generation,
      apply: update => { applied.push(update); return 'applied'; },
      onDrop: (update, reason) => dropped.push({ update, reason }),
    });
    const staleColumn = { instanceId: 'game/facilities', generation: 1 };

    dispatcher.request({ type: 'element', target: 'spot.card', key: 'spot-a', instanceId: staleColumn.instanceId, columnToken: staleColumn });
    dispatcher.flushNow();
    expect(dispatcher.applyNow({ type: 'element', target: 'spot.card', key: 'spot-a', instanceId: staleColumn.instanceId, columnToken: staleColumn })).toBe('not-found');

    expect(applied).toHaveLength(0);
    expect(dropped).toHaveLength(2);
    expect(dropped.map(item => item.reason)).toEqual(['stale-column', 'stale-column']);
  });
});
