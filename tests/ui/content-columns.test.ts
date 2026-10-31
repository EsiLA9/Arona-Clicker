// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { bindStoryActions } from '../../src/ui/controller/controller-actions-story';
import { createUIContext } from '../../src/ui/runtime/context';
import type { UIContext } from '../../src/ui/runtime/context';
import { createAreaNavigationColumn, createChatColumn, createContactsColumn, createCharacterColumn, createEnhancementsColumn, createFacilitiesColumn, createLogColumn } from '../../src/ui/columns';
import { createContactsWorkspaceFrame } from '../../src/ui/components/character/contacts-workspace';
import { WorkspaceColumns } from '../../src/ui/workspace/workspace-columns';
import { workspaceColumns } from '../../src/ui/components/shared/workspace-frame';
import { renderWorkspaceFrame } from '../../src/ui/components/shared/workspace-frame';
import { ScrollManager } from '../../src/ui/interaction/scroll';

describe('content column composition', () => {
  let game: GameInstance;
  let ctrl: UIController;
  let root: HTMLElement;
  let runtime: WorkspaceColumns;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    game = new GameInstance(); game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    game.mutations.acquireCharacter('Hoshino', 'story');
    ctrl = new UIController(game, root); ctrl.started = true;
    runtime = new WorkspaceColumns();
  });
  afterEach(() => { runtime.dispose(); ctrl.destroy(); game.stop(); });

  it('embeds two real chat columns with scoped callbacks and preserves the original theme on reorder', () => {
    const ctx = createUIContext(game);
    const sendA = vi.fn(), sendB = vi.fn();
    const a = createChatColumn(ctx, { key: 'global', owner: null, entries: [], sendState: { mode: 'idle', reason: 'noStory' }, actions: { '[data-send]': sendA } });
    const b = createChatColumn(ctx, { key: 'student', owner: 'Hoshino', entries: [], sendState: { mode: 'idle', reason: 'noStory' }, actions: { '[data-send]': sendB } });
    runtime.mount(root, ctx, { id: 'editor', columns: [a, b] });
    const global = root.querySelector<HTMLElement>('[data-column-key="global"]')!;
    const student = root.querySelector<HTMLElement>('[data-column-key="student"]')!;
    student.querySelector<HTMLButtonElement>('[data-send]')!.click();
    expect(sendB).toHaveBeenCalledTimes(1); expect(sendA).not.toHaveBeenCalled();
    runtime.mount(root, ctx, { id: 'editor', columns: [b, a] });
    expect(root.firstElementChild?.firstElementChild).toBe(student);
    expect(root.querySelector('[data-column-key="global"]')).toBe(global);
    expect(student.dataset.themeHostId).toBe('centerPanel.chat');
    global.querySelector<HTMLButtonElement>('[data-send]')!.click();
    expect(sendA).toHaveBeenCalledTimes(1);
    const updatedSend = vi.fn();
    runtime.mount(root, ctx, { id: 'editor', columns: [b, { ...a, actions: { '[data-send]': updatedSend } }] });
    expect(root.querySelector('[data-column-key="global"]')).toBe(global);
    global.querySelector<HTMLButtonElement>('[data-send]')!.click();
    expect(updatedSend).toHaveBeenCalledTimes(1);
    expect(sendA).toHaveBeenCalledTimes(1);
  });

  it('routes native idle starts to the clicked owner even when the controller selects a different stream', () => {
    game.story.clearAllCurrentStories();
    const ctx = createUIContext(game);
    const command = vi.spyOn(ctrl.commands, 'clickSend').mockReturnValue({ type: 'idle', started: false });
    vi.spyOn(ctrl, 'refreshChatPanel').mockImplementation(() => {});
    runtime.mount(root, ctx, { id: 'mixed', columns: [
      createChatColumn(ctx, { key: 'a', owner: null, entries: [], sendState: { mode: 'idle', reason: 'noStory' } }),
      createChatColumn(ctx, { key: 'b', owner: 'Hoshino', entries: [], sendState: { mode: 'idle', reason: 'noStory' } }),
    ] });
    bindStoryActions(ctrl, root);
    ctrl.panelState.conversationVariantId = 'unrelated';
    root.querySelector<HTMLButtonElement>('[data-column-key="b"] [data-send]')!.click();
    expect(command).toHaveBeenLastCalledWith('Hoshino');
    root.querySelector<HTMLButtonElement>('[data-column-key="a"] [data-send]')!.click();
    expect(command).toHaveBeenLastCalledWith(undefined);
    expect(ctrl.panelState.conversationVariantId).toBe('unrelated');
  });

  it('reuses contacts and character columns outside their original workspace and overrides only the calling navigation', () => {
    ctrl.openContactsWorkspace('Hoshino');
    const ctx = createUIContext(game);
    const frame = createContactsWorkspaceFrame(ctx, ctrl.panelState.workspace as never, ctrl.panelState);
    const original = workspaceColumns(frame)[2];
    const leave = vi.fn();
    runtime.mountColumn(root, ctx, 'details/student', original, { onBack: leave });
    expect(root.querySelector('.char-panel')).not.toBeNull();
    const select = vi.fn();
    runtime.mount(root, ctx, { id: 'different', onBack: leave, columns: [
      createCharacterColumn(ctx, { variantId: 'Hoshino', title: '角色详情' }),
      createContactsColumn(ctx, { selectedVariantId: null, chats: {}, onSelect: select }),
    ] });
    root.querySelector<HTMLButtonElement>('[data-select-variant="Hoshino"]')!.click();
    expect(select).toHaveBeenCalledWith('Hoshino');
    expect(ctrl.panelState.workspace?.type).toBe('contacts');
    const back = root.querySelector<HTMLButtonElement>('[data-column-back]')!;
    expect(back.hidden).toBe(false);
    back.click();
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('keeps two displays of the same stream at independent reading positions', () => {
    const ctx = createUIContext(game);
    runtime.mount(root, ctx, { id: 'readers', columns: ['a', 'b'].map(key => createChatColumn(ctx, { key, owner: null, entries: [], sendState: { mode: 'idle', reason: 'noStory' } })) });
    const hosts = [...root.querySelectorAll<HTMLElement>('.chat-stream')];
    for (const host of hosts) { Object.defineProperty(host, 'scrollHeight', { value: 1000 }); Object.defineProperty(host, 'clientHeight', { value: 200 }); }
    hosts[0].scrollTop = 100; hosts[1].scrollTop = 300;
    const scroll = new ScrollManager(); scroll.captureChat(root);
    hosts[0].scrollTop = 0; hosts[1].scrollTop = 0;
    scroll.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 0 });
    expect(hosts.map(host => host.scrollTop)).toEqual([100, 300]);
    scroll.reset();
  });

  it('restores a visible embedded chat stream when the Game activity tab is Log', () => {
    const ctx = createUIContext(game);
    runtime.mount(root, ctx, { id: 'embedded-chat', columns: [createChatColumn(ctx, { owner: null, entries: [], sendState: { mode: 'idle', reason: 'noStory' } })] });
    const stream = root.querySelector<HTMLElement>('.chat-stream')!;
    Object.defineProperty(stream, 'scrollHeight', { value: 1000 });
    Object.defineProperty(stream, 'clientHeight', { value: 200 });
    stream.scrollTop = 133;
    const scroll = new ScrollManager();
    scroll.captureChat(root);
    stream.scrollTop = 0;
    scroll.restoreChat(root, { centerTab: 'log', conversationVariantId: null, activeStreamLength: 0 });
    expect(stream.scrollTop).toBe(133);
    scroll.reset();
  });

  it('restores every workspace scroll owner by explicit key after a column replacement', () => {
    const scroll = new ScrollManager();
    const column = () => `<section data-column-instance="scroll-snapshot/column">
      <div class="workspace-column__body"><div data-scroll-owner="content-region" data-scroll-key="resources">resources</div>
        <div data-scroll-owner="content-region" data-map-region-key="context-scroll">context</div></div>
    </section>`;
    root.innerHTML = column();
    const body = root.querySelector<HTMLElement>('.workspace-column__body')!;
    const resources = root.querySelector<HTMLElement>('[data-scroll-key="resources"]')!;
    const context = root.querySelector<HTMLElement>('[data-map-region-key="context-scroll"]')!;
    body.scrollTop = 17; resources.scrollTop = 83; context.scrollTop = 141;
    scroll.captureWorkspace(root);

    root.innerHTML = `<section data-column-instance="scroll-snapshot/column"><div class="workspace-column__body">
      <div data-scroll-owner="content-region" data-map-region-key="context-scroll">context</div>
      <div data-scroll-owner="content-region" data-scroll-key="resources">resources</div>
    </div></section>`;
    scroll.restoreWorkspace(root);
    expect(root.querySelector<HTMLElement>('.workspace-column__body')?.scrollTop).toBe(17);
    expect(root.querySelector<HTMLElement>('[data-scroll-key="resources"]')?.scrollTop).toBe(83);
    expect(root.querySelector<HTMLElement>('[data-map-region-key="context-scroll"]')?.scrollTop).toBe(141);
    scroll.reset();
  });

  it('area navigation exposes its heading and runs explicitly supplied workspace actions', () => {
    const ctx = createUIContext(game);
    const selectContacts = vi.fn();
    const internals = ctrl as unknown as { collectColumns(ctx: UIContext): void; columnFrames: Map<string, object> };
    internals.collectColumns(ctx);
    renderWorkspaceFrame(ctx, { id: 'embedded-area-navigation', columns: [createAreaNavigationColumn(ctx, ctrl.panelState, {
      heading: '<h2>Area tools</h2><button data-workspace-navigation="contacts">Contacts</button>',
      actions: { '[data-workspace-navigation="contacts"]': selectContacts },
    })] });
    ctrl.columns.mount(root, ctx, internals.columnFrames.get('embedded-area-navigation') as never);
    expect(root.querySelector('.workspace-column__header h2')?.textContent).toBe('Area tools');
    root.querySelector<HTMLButtonElement>('[data-workspace-navigation="contacts"]')!.click();
    expect(selectContacts).toHaveBeenCalledTimes(1);
  });

  it.each(['other-tool-tab', 'another-workspace'] as const)('updates visible facilities independently of the original selection: %s', scenario => {
    if (scenario === 'other-tool-tab') ctrl.panelState.rightTab = 'other';
    else { ctrl.enterWorkspaceRoute({ kind: 'area', areaId: game.getView().currentAreaId! }); ctrl.render(); }
    const ctx = createUIContext(game);
    const host = document.createElement('div'); document.body.append(host);
    ctrl.columns.mount(host, ctx, { id: 'embedded-facilities', columns: [createFacilitiesColumn(ctx, { key: 'preview', heading: '<h2>Preview heading</h2>', workspaceOwner: 'outside-game' })] });
    const instance = ctrl.columns.node('embedded-facilities/preview')!;
    const spotId = instance.querySelector<HTMLElement>('[data-ui-spot-card]')!.dataset.uiSpotCard!;
    expect(instance.querySelector('.workspace-column__header')?.textContent).toBe('Preview heading');
    const apply = vi.spyOn(ctrl, 'applyUIElement').mockReturnValue('applied');

    ctrl.panelState.rightTab = 'other';
    ctrl.refreshRuntimeSpotContent('embedded-runtime-refresh');
    expect(apply).toHaveBeenCalledWith('spot.card', spotId, 'embedded-runtime-refresh', 'rightPanel.spot', 'embedded-facilities/preview');

    ctrl.panelState.service = 'records';
    expect(ctrl.refreshEntityPresentation(`spot:${spotId}`, 'embedded-entity-refresh')).toBe(true);
    expect(apply).toHaveBeenCalledWith('spot.card', spotId, 'embedded-entity-refresh', 'rightPanel.spot', 'embedded-facilities/preview');
  });

  it('keeps connected external semantic columns registered across a full Controller render', () => {
    const ctx = createUIContext(game);
    const hostAction = vi.fn();
    const host = document.createElement('div'); document.body.append(host);
    ctrl.columns.mount(host, ctx, { id: 'persistent-external', columns: [createFacilitiesColumn(ctx, {
      key: 'preview', heading: '<button data-host-action>Host action</button>',
      actions: { '[data-host-action]': hostAction },
    })] });
    const id = 'persistent-external/preview';
    const before = ctrl.columns.node(id)!;

    ctrl.render();

    expect(ctrl.columns.node(id)).toBe(before);
    expect(before.isConnected).toBe(true);
    expect(ctrl.refreshCurrentSpotCards('after-app-render')).toBe(true);
    ctrl.columns.node(id)!.querySelector<HTMLButtonElement>('[data-host-action]')!.click();
    expect(hostAction).toHaveBeenCalledTimes(1);
  });

  it('routes public column refreshes to external semantic mounts without touching their siblings', () => {
    ctrl.render();
    const ctx = createUIContext(game);
    const host = document.createElement('div'); document.body.append(host);
    const hostAction = vi.fn();
    ctrl.columns.mount(host, ctx, { id: 'public-external-refresh', columns: [
      createFacilitiesColumn(ctx, {
        key: 'primary', showResources: true,
        heading: '<h2>External</h2><button data-host-action>Host</button>',
        actions: { '[data-host-action]': hostAction },
      }),
      createFacilitiesColumn(ctx, { key: 'sibling', showResources: true }),
    ] });
    const id = 'public-external-refresh/primary';
    const siblingId = 'public-external-refresh/sibling';
    const oldRoot = ctrl.columns.node(id)!;
    const oldSpec = ctrl.columns.spec(id)!;
    const oldToken = ctrl.columns.token(id)!;
    const sibling = ctrl.columns.node(siblingId)!;
    const siblingCredit = sibling.querySelector<HTMLElement>('[data-resource="base:resource:credit"]')!.textContent;
    const currentCredit = game.getView().resources['base:resource:credit'] ?? 0;

    game.mutations.changeResource('base:resource:credit', 321);
    const expectedCredit = String(currentCredit + 321);
    ctrl.requestColumnRefresh(id);
    ctrl.flushUIUpdates();

    const updated = ctrl.columns.node(id)!;
    expect(updated).not.toBe(oldRoot);
    expect(updated.querySelector<HTMLElement>('[data-resource="base:resource:credit"]')?.textContent).toBe(expectedCredit);
    expect(ctrl.columns.node(siblingId)).toBe(sibling);
    expect(sibling.querySelector<HTMLElement>('[data-resource="base:resource:credit"]')?.textContent).toBe(siblingCredit);
    expect(ctrl.columns.update(id, oldSpec, oldToken, createUIContext(game))).toBe(false);
    updated.querySelector<HTMLButtonElement>('[data-host-action]')!.click();
    expect(hostAction).toHaveBeenCalledTimes(1);
  });

  it('refreshes visible enhancement columns outside the selected Game tab and service route', () => {
    const ctx = createUIContext(game);
    const host = document.createElement('div'); document.body.append(host);
    ctrl.columns.mount(host, ctx, { id: 'embedded-enhancements', columns: [createEnhancementsColumn(ctx, { key: 'preview' })] });
    const instance = ctrl.columns.node('embedded-enhancements/preview')!;
    const enhancementId = instance.querySelector<HTMLElement>('[data-ui-enhancement-card]')!.dataset.uiEnhancementCard!;
    ctrl.panelState.rightTab = 'other';
    ctrl.panelState.service = 'records';
    const apply = vi.spyOn(ctrl, 'applyUIElement').mockReturnValue('applied');

    expect(ctrl.refreshCurrentEnhancementCards('embedded-enhancement-refresh')).toBe(true);
    expect(apply).toHaveBeenCalledWith('enhancement.card', enhancementId, 'embedded-enhancement-refresh', 'rightPanel.enh', 'embedded-enhancements/preview');
    expect(ctrl.refreshEntityPresentation(`enhancement:${enhancementId}`, 'embedded-enhancement-entity')).toBe(true);
    expect(apply).toHaveBeenCalledWith('enhancement.card', enhancementId, 'embedded-enhancement-entity', 'rightPanel.enh', 'embedded-enhancements/preview');
  });

  it('revealed content refresh visits every visible semantic kind regardless of the selected Game tab', () => {
    const internals = ctrl as unknown as { lastRevealCheck: number; revealFingerprint: string };
    internals.lastRevealCheck = 0;
    internals.revealFingerprint = 'force-a-distinct-reveal-snapshot';
    ctrl.panelState.rightTab = 'other';
    const area = vi.spyOn(ctrl, 'refreshCurrentAreaNav').mockReturnValue(true);
    const facilities = vi.spyOn(ctrl, 'refreshCurrentSpotCards').mockReturnValue(true);
    const enhancements = vi.spyOn(ctrl, 'refreshCurrentEnhancementCards').mockReturnValue(true);

    ctrl.refreshRevealIfChanged();

    expect(area).toHaveBeenCalledWith('reveal-changed');
    expect(facilities).toHaveBeenCalledWith('reveal-changed');
    expect(enhancements).toHaveBeenCalledWith('reveal-changed');
  });

  it('rebinds live facilities after travel and invalidates the previous column token', () => {
    const ctx = createUIContext(game);
    const host = document.createElement('div'); document.body.append(host);
    const hostAction = vi.fn();
    ctrl.columns.mount(host, ctx, { id: 'travelling-facilities', columns: [createFacilitiesColumn(ctx, {
      key: 'preview', heading: '<h2>Travel preview</h2><button data-host-action>Host</button>', actions: { '[data-host-action]': hostAction },
    })] });
    const id = 'travelling-facilities/preview';
    const oldRoot = ctrl.columns.node(id)!;
    const oldSpec = ctrl.columns.spec(id)!;
    const oldToken = ctrl.columns.token(id)!;
    game.story.clearAllCurrentStories();
    const travel = game.travelToArea('base:area:schale_library');
    expect(travel.success).toBe(true);
    const destination = travel.areaId;

    expect(ctrl.refreshCurrentSpotCards('travel-rebind')).toBe(true);
    const rebound = ctrl.columns.node(id)!;
    expect(rebound).not.toBe(oldRoot);
    expect(rebound.dataset.columnBinding).toBe(destination);
    expect(rebound.querySelector('.workspace-column__header')?.textContent).toBe('Travel previewHost');
    rebound.querySelector<HTMLButtonElement>('[data-host-action]')!.click();
    expect(hostAction).toHaveBeenCalledTimes(1);
    expect(ctrl.columns.update(id, oldSpec, oldToken, createUIContext(game))).toBe(false);
  });

  it('preserves a host log action through Controller collection adapters', () => {
    const ctx = createUIContext(game);
    const hostClear = vi.fn();
    const internals = ctrl as unknown as { collectColumns(ctx: UIContext): void; columnFrames: Map<string, object> };
    internals.collectColumns(ctx);
    renderWorkspaceFrame(ctx, { id: 'custom-log', columns: [createLogColumn(ctx, { actions: { '[data-action="clear-log"]': hostClear } })] });
    const frame = internals.columnFrames.get('custom-log') as never;
    const host = document.createElement('div'); document.body.append(host);
    ctrl.columns.mount(host, ctx, frame);
    host.querySelector<HTMLButtonElement>('[data-action="clear-log"]')!.click();
    expect(hostClear).toHaveBeenCalledTimes(1);
  });

  it('refreshes matching facilities in each display instance and scopes duplicate log actions', () => {
    ctrl.render();
    ctrl.panelState.rightTab = 'other';
    ctrl.refreshPanels(['right']);
    const ctx = createUIContext(game);
    const host = document.createElement('div');
    document.body.append(host);
    const facilityA = createFacilitiesColumn(ctx, { key: 'facilities-a', workspaceOwner: 'preview-a' });
    const facilityB = createFacilitiesColumn(ctx, { key: 'facilities-b', workspaceOwner: 'preview-b' });
    ctrl.columns.mount(host, ctx, { id: 'facility-previews', columns: [facilityA, facilityB] });
    const a = ctrl.columns.node('facility-previews/facilities-a')!;
    const b = ctrl.columns.node('facility-previews/facilities-b')!;
    const expectedCards = a.querySelectorAll('[data-ui-spot-card]').length;
    expect(expectedCards).toBeGreaterThan(0);
    expect(b.querySelectorAll('[data-ui-spot-card]')).toHaveLength(expectedCards);
    const before = ctrl.getRefreshStats().elementRefreshes;
    expect(ctrl.refreshCurrentSpotCards('dual-facility-update')).toBe(true);
    expect(ctrl.getRefreshStats().elementRefreshes - before).toBe(expectedCards * 2);
    expect(ctrl.columns.node('facility-previews/facilities-a')).toBe(a);
    expect(ctrl.columns.node('facility-previews/facilities-b')).toBe(b);

    const clearA = vi.fn(), clearB = vi.fn();
    const logA = createLogColumn(ctx, { key: 'log-a', actions: { '[data-action="clear-log"]': clearA } });
    const logB = createLogColumn(ctx, { key: 'log-b', actions: { '[data-action="clear-log"]': clearB } });
    ctrl.columns.mount(host, ctx, { id: 'dual-logs', columns: [logA, logB] });
    game.devLog.record('测试日志', { source: 'test' });
    ctrl.refreshLogPanel(true);
    const eventCount = `${game.getDevLogs().length} EVENTS`;
    expect(ctrl.columns.node('dual-logs/log-a')?.querySelector('.log-count')?.textContent).toContain(eventCount);
    expect(ctrl.columns.node('dual-logs/log-b')?.querySelector('.log-count')?.textContent).toContain(eventCount);
    expect(host.querySelectorAll('#clear-log, #export-log, #dump-enh-debug')).toHaveLength(0);
    ctrl.columns.node('dual-logs/log-a')!.querySelector<HTMLButtonElement>('[data-action="clear-log"]')!.click();
    ctrl.columns.node('dual-logs/log-b')!.querySelector<HTMLButtonElement>('[data-action="clear-log"]')!.click();
    expect(clearA).toHaveBeenCalledTimes(1);
    expect(clearB).toHaveBeenCalledTimes(1);
  });

  it('keeps moved siblings mounted during controller updates and recovers a missing column without replacing the app', () => {
    ctrl.openContactsWorkspace('Hoshino'); ctrl.render();
    const ctx = createUIContext(game);
    const spec = createContactsWorkspaceFrame(ctx, ctrl.panelState.workspace as never, ctrl.panelState);
    const columns = workspaceColumns(spec);
    const frame = root.querySelector<HTMLElement>('[data-workspace-frame]')!;
    ctrl.columns.mount(frame.parentElement!, ctx, { ...spec, columns: [columns[2], columns[0], columns[1]] });
    const navigation = ctrl.columns.node('contacts/navigation');
    const before = ctrl.getRefreshStats();
    ctrl.refreshPanels(['right']);
    expect(ctrl.columns.node('contacts/navigation')).toBe(navigation);
    expect(frame.firstElementChild?.getAttribute('data-column-key')).toBe('inspector');
    ctrl.columns.node('contacts/inspector')!.remove();
    ctrl.refreshPanels(['right']);
    expect(ctrl.columns.node('contacts/inspector')?.isConnected).toBe(true);
    expect(root.querySelector('[data-workspace-frame]')).toBe(frame);
    expect(ctrl.getRefreshStats().fullRenders).toBe(before.fullRenders);
    root.querySelector<HTMLElement>('.contacts-workspace__list')!.scrollTop = 133;
    ctrl.refreshPanels(['left']);
    expect(root.querySelector<HTMLElement>('.contacts-workspace__list')!.scrollTop).toBe(133);
  });
});
