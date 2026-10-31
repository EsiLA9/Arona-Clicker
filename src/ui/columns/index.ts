import type { UIContext } from '../runtime/context';
import type { WorkspaceColumnSpec } from '../components/shared/workspace-frame';
import type { ColumnActions } from '../workspace/column-actions';
import type { SemanticColumnSpec } from './semantic-column';
import { renderPanelActionsRegion } from '../components/shared/tabs';
import { renderResourceStrip } from '../components/shared/header';
import { renderProductionNodes } from '../components/shared/production';
import { renderEnhancements } from '../components/inventory/enhancements';
import { renderAreaNavigationContent, renderAreaNavItem, type AreaNavigationState } from './area-navigation';
import { renderStoryNavigation } from './story-navigation';
import { renderChatContent, renderLogContent } from './chat-content';
import { renderInventoryEffectsContent } from './inventory-effects';
import { createChatColumn, createContactsColumn, createCharacterColumn } from './content-columns';

export { renderAreaNavigationContent, renderAreaNavItem, renderStoryNavigation };
export type { AreaNavigationState } from './area-navigation';
export type { SemanticColumnSpec } from './semantic-column';
export { renderChatContent, renderSendButton, renderLogContent } from './chat-content';
export { createChatColumn, createContactsColumn, createCharacterColumn };
export type { ChatColumnBinding, ContactsColumnBinding, CharacterColumnBinding } from './content-columns';

export interface SemanticColumnOptions {
  key?: string;
  width?: string;
  workspaceOwner?: string;
  heading?: string;
  actions?: ColumnActions;
  appearance?: Partial<Omit<WorkspaceColumnSpec, 'content' | 'bind'>>;
}
function gamePanelAppearance(panel: 'left' | 'center' | 'right', options: SemanticColumnOptions): Partial<WorkspaceColumnSpec> {
  const classes = {
    left: 'left-panel ui-cluster--left-panel',
    center: 'center-panel ui-cluster--center-panel',
    right: 'right-panel ui-cluster--right-panel',
  }[panel];
  return {
    slot: panel,
    className: classes,
    workspaceOwner: options.workspaceOwner,
    width: options.width,
    ...options.appearance,
  };
}

/** Complete, reusable Area rail content; Workspace chooses navigation actions and placement. */
export function createAreaNavigationColumn(ctx: UIContext, state: AreaNavigationState, options: SemanticColumnOptions & { allowAreaMapEntry?: boolean } = {}): SemanticColumnSpec {
  const hostId = options.appearance?.hostId ?? 'leftPanel.area';
  const active = [
    { id: 'navigation:area', label: '区域', active: true },
    { id: 'navigation:contacts', label: '通讯录', navigation: 'contacts' },
    { id: 'navigation:story', label: '故事', navigation: 'story' },
  ];
  const refreshOptions = { ...options, appearance: options.appearance ? { ...options.appearance } : undefined, actions: options.actions ? { ...options.actions } : undefined };
  const refreshState: AreaNavigationState = {
    conversationVariantId: state.conversationVariantId,
    storyGate: state.storyGate,
    storyReplay: state.storyReplay,
    workspace: state.workspace,
    workspaceNavigation: state.workspaceNavigation,
    areaMapSession: state.areaMapSession,
  };
  return {
    key: options.key ?? 'area-navigation', definitionId: 'area-navigation', bindingKey: ctx.view.currentAreaId ?? '',
    hostId, themeScope: options.appearance?.themeScope ?? 'left.area', surface: 'panel', scroll: 'none',
    ...gamePanelAppearance('left', options),
    actions: options.actions,
    header: options.heading ?? renderPanelActionsRegion(ctx, 'left', active),
    semanticRefresh: nextCtx => createAreaNavigationColumn(nextCtx, refreshState, refreshOptions),
    content: `<div class="panel-body ui-cluster ui-cluster--left-area">${renderAreaNavigationContent(ctx, state, options.allowAreaMapEntry)}</div>`,
  };
}

/** A standalone facilities column; resource strip visibility belongs to the assembling Workspace. */
export function createFacilitiesColumn(ctx: UIContext, options: SemanticColumnOptions & { showResources?: boolean } = {}): SemanticColumnSpec {
  const hostId = options.appearance?.hostId ?? 'rightPanel.spot';
  const refreshOptions = { ...options, appearance: options.appearance ? { ...options.appearance } : undefined, actions: options.actions ? { ...options.actions } : undefined };
  return {
    key: options.key ?? 'facilities', definitionId: 'facilities', bindingKey: ctx.view.currentAreaId ?? '',
    hostId, themeScope: options.appearance?.themeScope ?? 'right.spot', surface: 'panel', scroll: 'none',
    ...gamePanelAppearance('right', options),
    actions: options.actions,
    header: options.heading,
    semanticRefresh: nextCtx => createFacilitiesColumn(nextCtx, refreshOptions),
    content: `${options.showResources ? renderResourceStrip(ctx) : ''}<div class="panel-body ui-cluster ui-cluster--right-spot">${renderProductionNodes(ctx)}</div>`,
  };
}

export function createEnhancementsColumn(ctx: UIContext, options: SemanticColumnOptions & { showResources?: boolean } = {}): SemanticColumnSpec {
  const hostId = options.appearance?.hostId ?? 'rightPanel.enh';
  const refreshOptions = { ...options, appearance: options.appearance ? { ...options.appearance } : undefined, actions: options.actions ? { ...options.actions } : undefined };
  return {
    key: options.key ?? 'enhancements', definitionId: 'enhancements', bindingKey: ctx.view.activeInit ?? '',
    hostId, themeScope: options.appearance?.themeScope ?? 'right.enh', surface: 'panel', scroll: 'none',
    ...gamePanelAppearance('right', options),
    actions: options.actions,
    header: options.heading,
    semanticRefresh: nextCtx => createEnhancementsColumn(nextCtx, refreshOptions),
    content: `${options.showResources ? renderResourceStrip(ctx) : ''}<div class="panel-body ui-cluster ui-cluster--right-enh">${renderEnhancements(ctx)}</div>`,
  };
}

export function createInventoryEffectsColumn(ctx: UIContext, options: SemanticColumnOptions = {}): WorkspaceColumnSpec {
  const hostId = options.appearance?.hostId ?? 'rightPanel.other';
  return {
    key: options.key ?? 'inventory-effects', definitionId: 'inventory-effects', bindingKey: 'player',
    hostId, themeScope: options.appearance?.themeScope ?? 'right.other', surface: 'panel', scroll: 'content',
    ...gamePanelAppearance('right', options),
    actions: options.actions,
    header: options.heading,
    content: `<div class="panel-body ui-cluster ui-cluster--right-other" data-scroll-owner="content-region">${renderInventoryEffectsContent(ctx)}</div>`,
  };
}

export function createLogColumn(ctx: UIContext, options: SemanticColumnOptions = {}): WorkspaceColumnSpec {
  const hostId = options.appearance?.hostId ?? 'centerPanel.log';
  return {
    key: options.key ?? 'log', definitionId: 'log', bindingKey: 'runtime-log',
    hostId, themeScope: options.appearance?.themeScope ?? 'center.log', surface: 'panel', scroll: 'content',
    ...gamePanelAppearance('center', options),
    actions: options.actions,
    header: options.heading,
    content: `<div class="panel-body ui-cluster ui-cluster--center-log" data-scroll-owner="content-region">${renderLogContent(ctx)}</div>`,
  };
}

export function renderGameColumnActions(ctx: UIContext, active: 'activity' | 'tools', current: string, tabs: readonly { id: string; label: string }[]): string {
  return renderPanelActionsRegion(ctx, active === 'activity' ? 'center' : 'right', tabs.map(tab => ({
    id: `${active}:${tab.id}`, label: tab.label, active: current === tab.id,
  })));
}
