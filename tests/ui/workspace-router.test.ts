import { describe, expect, it } from 'vitest';
import {
  backWorkspaceNavigation,
  createWorkspaceNavigation,
  enterWorkspaceNavigation,
  isLegacyWorkspaceStateConsistent,
  normalizeWorkspaceRoute,
  replaceWorkspaceNavigation,
  resolveCurrentWorkspaceRoute,
  routeForService,
  routeFromLegacyState,
  sameWorkspaceRoute,
  workspaceRouteKey,
  type WorkspaceLocation,
} from '../../src/ui/workspace/workspace-router';
import type { PanelState } from '../../src/ui/components/app-shell';
import { surfaceKeyOf, UISurfaceRuntime } from '../../src/ui/update/ui-surface';

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

  it('以 runId 唯一识别 Operation route，并令 PanelState 推导与 Navigation 一致', () => {
    const route = { kind: 'operation', runId: 'operation-run-17' } as const;
    const reference = { type: 'operation', runId: 'operation-run-17' } as const;
    const navigation = createWorkspaceNavigation(route);

    expect(routeFromLegacyState({ service: 'game', workspace: reference })).toEqual(route);
    expect(resolveCurrentWorkspaceRoute(navigation, { service: 'game', workspace: reference })).toEqual(route);
    expect(workspaceRouteKey(route)).toBe('operation:operation-run-17');
    expect(sameWorkspaceRoute(route, { kind: 'operation', runId: 'operation-run-17' })).toBe(true);
    expect(sameWorkspaceRoute(route, { kind: 'operation', runId: 'operation-run-18' })).toBe(false);
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

  it('返回 Operation 前保存的来源位置，不把返回位置重复加到 route history', () => {
    const operation = enterWorkspaceNavigation(
      createWorkspaceNavigation(),
      { kind: 'operation', runId: 'operation-run-17' },
      gameLocation,
    );

    expect(operation.returnTo).toEqual(gameLocation);
    expect(backWorkspaceNavigation(operation)).toEqual({ current: { kind: 'game' }, returnTo: undefined });
  });

  it('Operation Surface key 只随 runId 改变', () => {
    const createState = (runId: string): PanelState => ({
      service: 'game',
      workspaceNavigation: createWorkspaceNavigation({ kind: 'operation', runId }),
      workspace: { type: 'operation', runId, returnContext: gameLocation },
    } as PanelState);
    const initial = createState('operation-run-17');
    const surface = new UISurfaceRuntime(initial);
    const token = surface.current();
    const sameRun = surface.sync(createState('operation-run-17'));
    const nextRun = surface.sync(createState('operation-run-18'));

    expect(surfaceKeyOf(initial)).toBe('operation:operation-run-17');
    expect(sameRun).toEqual(token);
    expect(nextRun.key).toBe('operation:operation-run-18');
    expect(nextRun.generation).toBe(token.generation + 1);
  });

  it('无返回位置时回退到 Game，并能兼容旧字符串路由', () => {
    expect(backWorkspaceNavigation(createWorkspaceNavigation({ kind: 'contacts' }))).toEqual({ current: { kind: 'game' } });
    expect(normalizeWorkspaceRoute('contacts')).toEqual({ kind: 'contacts' });
    expect(normalizeWorkspaceRoute('service')).toEqual({ kind: 'game' });
  });
});
