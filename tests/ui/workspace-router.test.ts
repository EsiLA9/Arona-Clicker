import { describe, expect, it } from 'vitest';
import {
  backWorkspaceNavigation,
  createWorkspaceNavigation,
  enterWorkspaceNavigation,
  isLegacyWorkspaceStateConsistent,
  normalizeWorkspaceRoute,
  replaceWorkspaceNavigation,
  routeForService,
  routeFromLegacyState,
  sameWorkspaceRoute,
  workspaceRouteKey,
  type WorkspaceLocation,
} from '../../src/ui/workspace/workspace-router';

const gameLocation: WorkspaceLocation = {
  route: { kind: 'game' },
  leftTab: 'area',
  centerTab: 'chat',
  rightTab: 'spot',
  selectedVariantId: null,
  conversationVariantId: null,
};

describe('WorkspaceRouter', () => {
  it('将服务入口和临时 Workspace 映射为互斥路由', () => {
    expect(routeForService('settings')).toEqual({ kind: 'service', page: 'settings' });
    expect(routeFromLegacyState({ service: 'settings', workspace: { type: 'contacts' } })).toEqual({
      kind: 'service',
      page: 'settings',
    });
    expect(routeFromLegacyState({ service: 'game', workspace: { type: 'contacts' } })).toEqual({ kind: 'contacts' });
    expect(routeFromLegacyState({ service: 'game', workspace: { type: 'shop', sessionId: 'spot:shop' } })).toEqual({
      kind: 'shop',
      sessionId: 'spot:shop',
    });
  });

  it('保留 Story 和 Character 的轻量定位标识，不携带业务状态', () => {
    expect(routeFromLegacyState({ workspace: { type: 'story', sessionId: 'Hoshino' } })).toEqual({
      kind: 'story',
      sessionId: 'Hoshino',
    });
    expect(routeFromLegacyState({ workspace: { type: 'character', variantId: 'Hoshino' } })).toEqual({
      kind: 'character',
      variantId: 'Hoshino',
    });
    expect(workspaceRouteKey({ kind: 'story', sessionId: 'Hoshino' })).toBe('story:Hoshino');
    expect(sameWorkspaceRoute({ kind: 'service', page: 'settings' }, { kind: 'service', page: 'settings' })).toBe(true);
    expect(sameWorkspaceRoute({ kind: 'service', page: 'settings' }, { kind: 'service', page: 'inventory' })).toBe(false);
  });

  it('识别 service 与 workspace 同时存在的非法组合', () => {
    expect(isLegacyWorkspaceStateConsistent({ service: 'settings', workspace: { type: 'contacts' } })).toBe(false);
    expect(isLegacyWorkspaceStateConsistent({ service: 'game', workspace: { type: 'contacts' } })).toBe(true);
    expect(isLegacyWorkspaceStateConsistent({ service: 'settings', workspace: null })).toBe(true);
  });

  it('进入新 Workspace 时只保留一个返回位置', () => {
    const shopLocation: WorkspaceLocation = { ...gameLocation, route: { kind: 'shop', sessionId: 'spot:shop' } };
    const initial = createWorkspaceNavigation();
    const shop = enterWorkspaceNavigation(initial, { kind: 'shop', sessionId: 'spot:shop' }, gameLocation);
    const story = enterWorkspaceNavigation(shop, { kind: 'story', sessionId: 'Hoshino' }, shopLocation);

    expect(story.current).toEqual({ kind: 'story', sessionId: 'Hoshino' });
    expect(story.returnTo).toEqual(shopLocation);
    expect(backWorkspaceNavigation(story)).toEqual({
      current: { kind: 'shop', sessionId: 'spot:shop' },
      returnTo: undefined,
    });
  });

  it('替换当前位置时不增加新的返回层', () => {
    const shop = enterWorkspaceNavigation(
      createWorkspaceNavigation(),
      { kind: 'shop', sessionId: 'spot:shop' },
      gameLocation,
    );
    const replaced = replaceWorkspaceNavigation(shop, { kind: 'shop', sessionId: 'spot:other' });

    expect(replaced.current).toEqual({ kind: 'shop', sessionId: 'spot:other' });
    expect(replaced.returnTo).toEqual(gameLocation);
  });

  it('无返回位置时回退到 Game，并能兼容旧字符串路由', () => {
    expect(backWorkspaceNavigation(createWorkspaceNavigation({ kind: 'contacts' }))).toEqual({ current: { kind: 'game' } });
    expect(normalizeWorkspaceRoute('contacts')).toEqual({ kind: 'contacts' });
    expect(normalizeWorkspaceRoute('service')).toEqual({ kind: 'game' });
  });
});
