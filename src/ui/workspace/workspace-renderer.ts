import type { UIContext } from '../runtime/context';
import { renderHeader } from '../components/shared/header';
import {
  createAreaNavigationColumn,
  createChatColumn,
  createLogColumn,
  createFacilitiesColumn,
  createCharacterColumn,
  createEnhancementsColumn,
  createInventoryEffectsColumn,
  renderGameColumnActions,
} from '../columns';
import { renderConversationColumnHeader } from '../components/character/contacts';
import { renderPresentationRegion } from '../presentation/presentation-service';
import { renderServiceWorkspace } from '../components/shared/service-workspace';
import { renderShopWorkspace } from '../components/inventory/shop';
import { renderCharacterWorkspace } from '../components/character/character-workspace';
import { renderContactsWorkspace } from '../components/character/contacts-workspace';
import { renderStoryWorkspace } from '../components/story/story-workspace';
import { renderOperationWorkspace } from '../components/operation/operation-workspace';
import { renderMapWorkspace } from '../components/map/map-workspace';
import { renderSettingsWorkspace } from '../components/settings/settings-workspace';
import { renderInventoryWorkspace } from '../components/inventory/inventory-workspace';
import { renderWorkspaceFrame, type WorkspaceFrameSpec } from '../components/shared/workspace-frame';
import { renderAreaWorkspace } from '../components/world/area-workspace';
import { renderAreaMapWorkspace } from '../components/map/area-map-workspace';
import { renderMapEntryWorkspace } from '../components/map/map-entry-workspace';
import type { PanelState } from '../components/shared/app-shell';
import type { WorkspaceRoute } from './workspace-router';
import { renderStoryEditorWorkspace } from '../story-editor/view';

function studentVariantId(route: WorkspaceRoute, state: PanelState): string | null {
  if (route.kind === 'area-map') return null;
  if (route.kind === 'area') return null;
  if (route.kind === 'character') return state.workspace?.type === 'character' ? state.workspace.conversationVariantId : null;
  if (route.kind === 'contacts') return state.workspace?.type === 'contacts' ? state.workspace.conversationVariantId : null;
  if (route.kind === 'story') return state.workspace?.type === 'story' ? state.workspace.conversationOwner : null;
  return state.conversationVariantId;
}

export function createGameWorkspaceFrame(ctx: UIContext, state: PanelState): WorkspaceFrameSpec {
  const variantId = state.conversationVariantId;
  const replay = state.storyReplay?.owner === variantId && state.storyReplay.replayId ? state.storyReplay : undefined;
  const conversation = variantId ? {
    owner: variantId,
    entries: replay ? replay.entries : state.studentChats[variantId] ?? [],
    chatTexts: replay ? replay.chatTexts : state.studentChatTexts[variantId] ?? [],
  } : undefined;
  const activityHeading = renderPresentationRegion(ctx.presentation, 'centerPanel') + (conversation
    ? renderConversationColumnHeader(ctx, variantId!)
    : renderGameColumnActions(ctx, 'activity', state.centerTab, [{ id: 'chat', label: '聊天' }, { id: 'log', label: '日志' }]));
  const activity = !conversation && state.centerTab === 'log'
    ? createLogColumn(ctx, { key: 'activity', width: 'var(--workspace-center-width)', workspaceOwner: 'game', heading: activityHeading, appearance: { slot: 'center', className: 'center-panel ui-cluster--center-panel' } })
    : createChatColumn(ctx, {
        key: 'activity', heading: activityHeading,
        owner: conversation?.owner ?? null,
        entries: replay?.entries ?? conversation?.entries ?? state.chatEntries,
        chatTexts: replay?.chatTexts ?? conversation?.chatTexts ?? state.chatTexts,
        sendState: replay ? ctx.game.story.getReplaySendState(replay.replayId!) : ctx.game.story.getSendState(variantId ?? undefined),
        sendGate: state.sendGate ?? null,
        storyGate: state.storyGate ?? null,
        openingBanner: state.openingBanner ?? null,
        replayId: replay?.replayId,
        appearance: { width: 'var(--workspace-center-width)', workspaceOwner: 'game', slot: 'center', className: `center-panel ui-cluster--center-panel${conversation ? ' conversation-panel' : ''}`, hostId: conversation ? 'centerPanel.conversation' : 'centerPanel.chat', themeScope: conversation ? 'center.conversation' : 'center.chat', surface: 'panel', scroll: 'none' },
      });
  const toolHeading = renderGameColumnActions(ctx, 'tools', state.rightTab, [
    { id: 'spot', label: '设施' }, { id: 'character', label: '学生' }, { id: 'enh', label: '强化' }, { id: 'other', label: '其他' },
  ]);
  const toolOptions = { key: 'tools', width: 'var(--workspace-right-width)', workspaceOwner: 'game', heading: toolHeading, appearance: { width: 'var(--workspace-right-width)', workspaceOwner: 'game', slot: 'right' as const, className: 'right-panel ui-cluster--right-panel', surface: 'panel' as const, scroll: 'none' as const } };
  const tools = state.rightTab === 'character'
    ? createCharacterColumn(ctx, { key: 'tools', heading: toolHeading, appearance: toolOptions.appearance, variantId: state.selectedVariantId })
    : state.rightTab === 'enh'
      ? createEnhancementsColumn(ctx, { ...toolOptions, showResources: true })
      : state.rightTab === 'other'
        ? createInventoryEffectsColumn(ctx, { ...toolOptions, appearance: { ...toolOptions.appearance, scroll: 'content' } })
        : createFacilitiesColumn(ctx, { ...toolOptions, showResources: true });
  return {
    id: 'game',
    panelAliases: { left: ['area-navigation'], center: ['activity'], right: ['tools'] },
    columns: [
      { ...createAreaNavigationColumn(ctx, state, { key: 'area-navigation', width: 'var(--workspace-left-width)', workspaceOwner: 'game' }), slot: 'left' },
      activity,
      tools,
    ],
  };
}

function renderGameWorkspace(ctx: UIContext, state: PanelState): string {
  return renderWorkspaceFrame(ctx, createGameWorkspaceFrame(ctx, state));
}

function renderWorkspaceBody(ctx: UIContext, route: WorkspaceRoute, state: PanelState): { body: string; footerNote: string } {
  if (route.kind === 'story-editor' && state.storyEditor) return { body: renderStoryEditorWorkspace(ctx, state.storyEditor), footerNote: 'Story 编辑器 · 本地草稿' };
  if (route.kind === 'area-map' && state.areaMapSession?.sessionId === route.sessionId) {
    return { body: renderAreaMapWorkspace(ctx, state.areaMapSession, state), footerNote: '区域地图' };
  }
  if (route.kind === 'area') return { body: renderAreaWorkspace(ctx, route.areaId, state), footerNote: '区域工作区 · 当前区域' };
  if (route.kind === 'map-entry') {
    const entryView = ctx.game.mapRun.getEntryView(route.mapId);
    return { body: renderMapEntryWorkspace(ctx, route.mapId, entryView, state), footerNote: '地图探索 · 行前准备' };
  }
  if (route.kind === 'service') {
    if (route.page === 'settings') return { body: renderSettingsWorkspace(ctx, state), footerNote: 'SETTINGS WORKSPACE · LOCAL SERVICES' };
    if (route.page === 'inventory') return { body: renderInventoryWorkspace(ctx, state), footerNote: 'INVENTORY WORKSPACE · LOCAL SORTING' };
    return { body: renderServiceWorkspace(ctx, route.page, state), footerNote: '服务工作区 · 只读视图' };
  }
  if (route.kind === 'shop' && state.workspace?.type === 'shop') return { body: renderShopWorkspace(ctx, state.workspace), footerNote: 'SPOT FUNCTION · SHOP WORKSPACE' };
  if (route.kind === 'character' && state.workspace?.type === 'character') return { body: renderCharacterWorkspace(ctx, state.workspace, state), footerNote: 'CHARACTER SERVICE · WORKSPACE' };
  if (route.kind === 'contacts' && state.workspace?.type === 'contacts') return { body: renderContactsWorkspace(ctx, state.workspace, state), footerNote: 'CONTACTS SERVICE · WORKSPACE' };
  if (route.kind === 'story' && state.workspace?.type === 'story') return { body: renderStoryWorkspace(ctx, state.workspace, state), footerNote: 'STORY SERVICE · WORKSPACE' };
  if (route.kind === 'operation') {
    const workspace = state.workspace?.type === 'operation' && state.workspace.runId === route.runId
      ? state.workspace
      : null;
    const operationView = workspace ? ctx.game.operationEntry.getView(route.runId) : null;
    return { body: renderOperationWorkspace(ctx, operationView), footerNote: '游乐园试玩 · 本地行动记录' };
  }
  if (route.kind === 'map') {
    const mapView = ctx.game.mapRun.getWorkspaceView(route.runId);
    return { body: renderMapWorkspace(ctx, route.runId, mapView), footerNote: '地图探索 · 当前进度' };
  }
  return { body: renderGameWorkspace(ctx, state), footerNote: 'TS-HTML ENGINE · NO NETWORK' };
}

export function renderWorkspace(ctx: UIContext, route: WorkspaceRoute, state: PanelState): string {
  const rendered = renderWorkspaceBody(ctx, route, state);
  return `
    <main class="console-shell">
      ${renderHeader(ctx, { studentVariantId: studentVariantId(route, state), editorTheme: route.kind === 'story-editor' ? state.storyEditor?.uiTheme : undefined })}
      <div class="workspace-page-content">${rendered.body}</div>
      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>${rendered.footerNote}</span></footer>
    </main>`;
}
