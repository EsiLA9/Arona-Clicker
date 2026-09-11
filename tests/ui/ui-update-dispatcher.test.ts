import { describe, expect, it } from 'vitest';
import { UISurfaceRuntime } from '../../src/ui/update/ui-surface';
import { UIUpdateDispatcher } from '../../src/ui/update/ui-update-dispatcher';
import type { PanelState } from '../../src/ui/components/app-shell';
import type { UIUpdate, UIUpdateApplyResult } from '../../src/ui/update/ui-update-types';

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
});
