import type { UIContext } from '../runtime/context';
import { renderHeader } from '../components/shared/header';
import { renderLeftPanel } from '../components/shared/rail';
import { renderCenterPanel } from '../components/shared/center-panel';
import { renderRightPanel } from '../components/shared/right-panels';
import { renderServiceWorkspace } from '../components/shared/service-workspace';
import { renderShopWorkspace } from '../components/inventory/shop';
import { renderCharacterWorkspace } from '../components/character/character-workspace';
import { renderContactsWorkspace } from '../components/character/contacts-workspace';
import { renderStoryWorkspace } from '../components/story/story-workspace';
import { renderOperationWorkspace } from '../components/operation/operation-workspace';
import { renderMapWorkspace } from '../components/map/map-workspace';
import { renderSettingsWorkspace } from '../components/settings/settings-workspace';
import { renderInventoryWorkspace } from '../components/inventory/inventory-workspace';
import { renderWorkspaceFrame } from '../components/shared/workspace-frame';
import { renderAreaWorkspace } from '../components/world/area-workspace';
import { renderAreaMapWorkspace } from '../components/map/area-map-workspace';
import { renderMapEntryWorkspace } from '../components/map/map-entry-workspace';
import type { PanelState } from '../components/shared/app-shell';
import type { WorkspaceRoute } from './workspace-router';

function studentVariantId(route: WorkspaceRoute, state: PanelState): string | null {
  if (route.kind === 'area-map') return null;
  if (route.kind === 'area') return null;
  if (route.kind === 'character') return state.workspace?.type === 'character' ? state.workspace.conversationVariantId : null;
  if (route.kind === 'contacts') return state.workspace?.type === 'contacts' ? state.workspace.conversationVariantId : null;
  if (route.kind === 'story') return state.workspace?.type === 'story' ? state.workspace.conversationOwner : null;
  return state.conversationVariantId;
}

function renderGameWorkspace(ctx: UIContext, state: PanelState): string {
  const conversation = state.conversationVariantId
    ? {
        variantId: state.conversationVariantId,
        entries: state.studentChats[state.conversationVariantId] ?? [],
        chatTexts: state.studentChatTexts[state.conversationVariantId] ?? [],
      }
    : undefined;
  return renderWorkspaceFrame(ctx, {
    id: 'game',
    left: { slot: 'left', workspaceOwner: 'game', hostId: 'leftPanel', themeScope: 'left.game', surface: 'none', className: 'game-workspace__left', content: renderLeftPanel(ctx, state), scroll: 'none' },
    center: { slot: 'center', workspaceOwner: 'game', hostId: 'centerPanel', themeScope: 'center.game', surface: 'none', className: 'game-workspace__center', content: renderCenterPanel(ctx, state.centerTab, state.chatEntries, state.chatTexts, ctx.game.story.getSendState(state.conversationVariantId ?? undefined), conversation, state.sendGate ?? null, state.storyGate ?? null, state.openingBanner ?? null), scroll: 'none' },
    right: { slot: 'right', workspaceOwner: 'game', hostId: 'rightPanel', themeScope: 'right.game', surface: 'none', className: 'game-workspace__right', content: renderRightPanel(ctx, state.rightTab, state.selectedVariantId), scroll: 'none' },
  });
}

function renderWorkspaceBody(ctx: UIContext, route: WorkspaceRoute, state: PanelState): { body: string; footerNote: string } {
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
      ${renderHeader(ctx, { studentVariantId: studentVariantId(route, state) })}
      ${rendered.body}
      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>${rendered.footerNote}</span></footer>
    </main>`;
}
