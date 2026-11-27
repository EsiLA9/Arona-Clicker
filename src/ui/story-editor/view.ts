import { renderEditorDirectoryTools } from '../workspace/editor-directory';
import { renderEditorDirectoryScroll } from '../workspace/editor-directory-scroll';
import { editorLayout } from '../workspace/editor-workspace';
import type { BrowseInstanceSnapshot } from '../workspace/browse-instance-manager';
import type { StoryBrowseInstanceState } from './workspace-session';
import type { EditorBrowseInstanceState } from '../workspace/editor-browse-instances';
import { createEditorWorkspaceColumn } from '../workspace/editor-workspace-frame';
import { storyDocumentActions, type StoryDocumentActions } from './document-actions';
import { storyEntryType } from '../../data-services/contracts/story-entry';
import { projectStoryContent, storyNodeDisplay } from '../../data-services/authoring/story-content-display';
import { renderStoryClickAppearance } from '../components/story/story';
import { renderPublicDescriptionField, renderStoryAuthoringEntryRelations, renderStoryAuthoringTools, renderStoryEntryFields, renderStoryPreviewEntrySelect } from './authoring-view';
import { renderStoryTransfer } from './transfer-view';
import { renderStoryCardOverview, renderStoryEditorTarget, storyEditorTargetColor } from './target-view';
import { renderStoryEditorScene } from './scene-view';
import { renderStoryRelations } from './relations-view';
import { createStoryPreviewFrame } from './preview-view';
import { storyExplorerSourceValue, storySourceContext, type StoryExplorerProjection, type StoryExplorerState } from './pack-source';
import { renderSidebarTree, sidebarInitIds, sidebarSearch } from './sidebar-tree';
import type { EditorExplorerStateSnapshot } from '../workspace/editor-explorer-service';
import { renderStoryFlagCatalog } from './flag-catalog-view';
import type { UIContext } from '../runtime/context';
import { renderChatEntry, renderStoryClickPreview } from '../components/story/story';
import { type WorkspaceColumnSpec, workspaceColumns } from '../components/shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../components/shared/workspace-titlebar';
import { renderEditorTool, renderEditorToolGroup } from '../workspace/editor-workspace';
import { storyEditingMods } from './identity';
import type { EditorWorkbenchBusinessChrome } from '../workspace/editor-workbench';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import { currentAuthoringDraft, storyEntries, storyEditorTargetKey } from './model';
import { renderTabs } from '../components/shared/tabs';
import { renderAvatarSvg } from '../presentation/avatar-renderer';
import { composer, currentDraft, currentNode, senderChangeAllowed, senderForNode, type StoryDraft, type StoryDraftNode, type StoryEditorState, type StorySender } from './model';
import { hasStoryNodeOverlay, renderStoryPerformanceEditing, renderStoryNodeProperties } from './property-fields';
import type { StoryAction, StoryStateAction, StoryNumericValue } from '../../data-services/contracts/story-node-actions';

export function storySenders(ctx: UIContext): StorySender[] {
  return [{ id: 'narrator', label: '旁白' }, { id: 'teacher', label: '老师', speaker: '老师' },
    ...[...ctx.game.registry.characters.values()].map(character => ({ id: `character:${character.id}`, label: character.displayName, speaker: character.displayName }))];
}
const button = (action: string, text: string, disabled = false, danger = false, escapedReason?: string): string =>
  `<button type="button" class="mini-action${danger ? ' mini-action--danger' : ''}" data-editor-action="${action}"${disabled ? ' disabled' : ''}${escapedReason ? ` title="${escapedReason}"` : ''}>${text}</button>`;
const empty = (text: string): string => `<p class="story-editor-empty" data-editor-key="empty">${text}</p>`;
function senderAvatar(ctx: UIContext, sender: StorySender): string {
  const fallback = ctx.escapeHtml((sender.label.trim() || '?').slice(0, 1));
  if (sender.id.startsWith('character:')) {
    const id = sender.id.slice('character:'.length);
    const variants = ctx.game.rosterSystem.getAllVariants().filter(variant => variant.proto === id);
    const variant = variants.find(item => item.isDefault) ?? variants[0];
    const group = variant?.colorGroupId ? ctx.game.registry.colorGroups.get(variant.colorGroupId) : undefined;
    const colors = variant?.colorGroupId ? ctx.game.colorEquipmentSystem.avatarColorsForGroup(variant.colorGroupId) : [];
    if (group && colors.length) return `<span class="story-editor-sender-avatar" aria-hidden="true">${renderAvatarSvg(group.compositionType, colors, 36)}</span>`;
    const avatarUrl = variant?.avatar ? ctx.game.pics.urlOf(variant.avatar) : undefined;
    if (avatarUrl) return `<span class="story-editor-sender-avatar" aria-hidden="true"><img src="${ctx.escapeHtml(avatarUrl)}" alt="" loading="lazy" onerror="this.nextElementSibling.hidden=false;this.remove()"><span hidden>${fallback}</span></span>`;
  }
  return `<span class="story-editor-sender-avatar" aria-hidden="true"><span>${fallback}</span></span>`;
}
function senderOptions(ctx: UIContext, state: StoryEditorState, inspector = false): string {
  const senders = storySenders(ctx);
  const node = currentNode(state);
  const talklet = inspector && node?.type === 'talklet' ? node : null;
  const value = talklet ? senderForNode(talklet, senders) : composer(state).sender;
  const original = value === 'original' && talklet
    ? `<option value="original" data-editor-key="original" selected>${ctx.escapeHtml(talklet.content.kind === 'talk' ? talklet.content.speaker ?? '未命名发出方' : '旁白')}（原值）</option>` : '';
  return original + senders.map(sender => `<option data-editor-key="${ctx.escapeHtml(sender.id)}" value="${ctx.escapeHtml(sender.id)}"${sender.id === value ? ' selected' : ''}${talklet && !senderChangeAllowed(talklet, sender) ? ' disabled' : ''}>${ctx.escapeHtml(sender.label)}</option>`).join('');
}

function referenceLabel<T>(items: Iterable<T>, id: string | undefined, identify: (item: T) => string, label: (item: T) => string | undefined): string {
  if (!id) return '未指定';
  const item = [...items].find(candidate => identify(candidate) === id);
  return item ? label(item) || id : id;
}

function amountLabel(ctx: UIContext, amount: StoryNumericValue | undefined): string {
  return typeof amount === 'number' ? ctx.formatNumber(amount) : amount === undefined ? '未填写数值' : '计算数值';
}

function stateEffectSummary(ctx: UIContext, effect: StoryStateAction): string {
  const registry = ctx.game.registry;
  switch (effect.op) {
    case 'setResource':
    case 'addResource': {
      const resource = referenceLabel(registry.resourceDisplays.values(), effect.resourceId, item => item.resourceId, item => item.label);
      return `${effect.op === 'setResource' ? '设置' : '增加'}${resource} ${amountLabel(ctx, effect.amount)}`;
    }
    case 'setSpotLevel':
    case 'addSpotLevel': {
      const spot = referenceLabel(registry.spots.values(), effect.spotId, item => item.id, item => item.name);
      return `${effect.op === 'setSpotLevel' ? '设置' : '提升'}${spot}等级至 ${amountLabel(ctx, effect.amount)}`;
    }
    case 'setManager': {
      const spot = referenceLabel(registry.spots.values(), effect.spotId, item => item.id, item => item.name);
      const manager = referenceLabel(registry.characters.values(), effect.managerId, item => item.id, item => item.displayName);
      return `将${spot}经理设为${manager}`;
    }
    case 'addEnhancement':
      return `获得强化：${referenceLabel(registry.enhancements.values(), effect.enhancementId, item => item.id, item => item.name)}`;
    case 'addItem':
      return `获得${referenceLabel(registry.items.values(), effect.itemId, item => item.id, item => item.name)} ×${amountLabel(ctx, effect.amount)}`;
    case 'unlockInit':
      return `解锁世界线：${referenceLabel(registry.inits.values(), effect.initId, item => item.id, item => item.name)}`;
    case 'acquireAreaMap':
      return `收录地图：${referenceLabel(registry.areaMaps.values(), effect.mapId, item => item.id, item => item.name)}`;
    case 'revealInformation': {
      const target = effect.target;
      if (!target) return '告知世界信息（待选择目标）';
      const subject = target.entityKind === 'area'
        ? referenceLabel(registry.areas.values(), target.entityId, item => item.id, item => item.name)
        : target.entityKind === 'areaMap'
          ? referenceLabel(registry.areaMaps.values(), target.entityId, item => item.id, item => item.name)
          : `${registry.areaMaps.get(target.mapId)?.name ?? target.mapId} / ${registry.areaMaps.get(target.mapId)?.nodes.find(node => node.id === target.nodeId)?.name ?? target.nodeId}`;
      const face = { existence: '存在', name: '身份', utility: '用途', condition: '方法' }[target.target];
      return `告知${subject}的${face}`;
    }
    case 'setFlag':
      return `设置全局标记：${effect.flagId || '未指定'}`;
    case 'setExtra':
      return `设置 Extra：${effect.path || '未指定路径'}`;
    case 'addExtra':
      return `增加 Extra：${effect.path || '未指定路径'} ${amountLabel(ctx, effect.amount)}`;
    case 'removeExtra':
      return `移除 Extra：${effect.path || '未指定路径'}`;
    case 'grantCharacter':
      return `获得角色：${referenceLabel(registry.characterVariants.values(), effect.variantId, item => item.id, item => item.displayName)}`;
    case 'addAffectionExp':
      return `增加${referenceLabel(registry.characterVariants.values(), effect.variantId, item => item.id, item => item.displayName)}好感经验 ${amountLabel(ctx, effect.amount)}`;
    default:
      return '更新状态';
  }
}

function operationSummary(ctx: UIContext, action: Exclude<StoryAction, { kind: 'entryRequest' }> | undefined): string {
  if (!action) return '尚未配置行为';
  const registry = ctx.game.registry;
  switch (action.kind) {
    case 'clearNode': return `清除节点展示：${action.storyId} / ${action.nodeId}`;
    case 'localFlag':
      return action.op === 'set'
        ? `写入局部标记：${action.name || '未指定'} = ${action.value === undefined ? '未填写值' : typeof action.value === 'object' ? '复合值' : String(action.value)}`
        : `移除局部标记：${action.name || '未指定'}`;
    case 'state': {
      const effects = action.effects?.map(effect => stateEffectSummary(ctx, effect)) ?? [];
      if (!effects.length) return '未配置状态变更';
      const visible = effects.slice(0, 3).join(' · ');
      return `变更状态：${visible}${effects.length > 3 ? ` 等 ${effects.length} 项` : ''}`;
    }
    case 'travel':
      return `前往区域：${referenceLabel(registry.areas.values(), action.areaId, item => item.id, item => item.name)}`;
    case 'overlay': {
      const command = action.command;
      if (!command) return '执行覆盖层演出';
      if (command.command === 'clearId') return `清除覆盖层：${command.id || '未指定'}`;
      if (command.command === 'clearAllTexts') return '清除全部覆盖文本';
      if (command.command === 'clearFlow') return '清空当前聊天流';
      const content = command.content;
      if (!content) return '显示覆盖层内容';
      const label = content.kind === 'text' ? (content.text || '文本')
        : content.kind === 'message' ? (content.content.text || '消息')
          : (content.card.title || content.card.buttonText || '剧情入口卡');
      return `显示覆盖层：${label}`;
    }
    case 'presentation': {
      const command = action.command;
      if (!command) return '执行表现演出';
      if (command.command === 'openingTitle') return `显示开幕标题${command.title ? `：${command.title}` : ''}`;
      if (command.command === 'theme') return '切换剧情主题';
      return command.command === 'setEntityPresentation'
        ? `切换实体表现：${command.target} · ${command.optionId || '未指定表现'}`
        : `清除实体表现：${command.target}`;
    }
  }
}

function renderOperationPreview(ctx: UIContext, action: StoryAction | undefined): string {
  if (action?.kind === 'entryRequest') {
    const type = action.request?.entryType === 'active' ? '主动' : action.request?.entryType === 'passive' ? '被动' : '';
    return `<div class="story-editor-action-node"><span>请求${type}入口</span></div>`;
  }
  return `<div class="chat-current story-editor-operation-preview">${renderChatEntry(ctx, { kind: 'system', text: operationSummary(ctx, action) })}</div>`;
}

export function renderEditorNode(ctx: UIContext, state: StoryEditorState, node: StoryDraftNode): string {
  const draft = currentDraft(state)!;
  let body: string;
  let targetEntryId: string | undefined;
  if (node.type === 'talklet') {
    const talklet = node as Partial<Extract<StoryDraftNode, { type: 'talklet' }>>;
    const content = talklet.content;
    if (!content) {
      body = '<div class="story-editor-action-node"><span>Talklet</span><strong>未配置正文</strong></div>';
    } else {
      // Drafts may hold an incomplete payload; the preview must not invent data.
      body = renderChatEntry(ctx, { ...projectStoryContent({...content,text:content.text??''},(node.appearance?.presentation ?? node.presentation)), kind:content.kind,performance:storyNodeDisplay(node)      }, { instanceKey: `${draft.draftId}/${node.id}` });
    }
  } else if (node.type === 'click') {
    const click = node as Partial<Extract<StoryDraftNode, { type: 'click' }>>;
    const legacyTargets = [...new Set([...(draft.authoring?.activeStories ?? []), ...(draft.authoring?.passiveStories ?? [])].flatMap(entry => entry.kizuna ? [entry.kizuna.entryId] : []))];
    targetEntryId = click.interaction?.kind === 'entryCard' ? click.interaction.card?.request?.entryId ?? ''
      : click.interaction?.kind === 'kizunaCard' ? legacyTargets.length === 1 ? legacyTargets[0] : '' : undefined;
    const choice = click.interaction?.kind === 'choice' ? click.interaction : undefined;
    body = renderStoryClickPreview(ctx, click.interaction, choice ? {
      choiceOptionAddon: (option, index) => renderChoiceOptionFlags(ctx, state, node.id, index, option.id, choice.options?.[index]),
    } : {});
    body=renderStoryClickAppearance(body,storyNodeDisplay(node));
  } else {
    if (node.type === 'operation') {
      body = renderOperationPreview(ctx, node.action);
      if (node.action?.kind === 'entryRequest') targetEntryId = node.action.request?.entryId ?? '';
      if (node.action?.kind === 'overlay' && node.action.command?.command === 'show' && node.action.command.content?.kind === 'entryCard') {
        targetEntryId = node.action.command.content.card?.request?.entryId ?? '';
      }
    }
    else if (node.type === 'transfer') {
      body = renderStoryTransfer(ctx, state, node.transfer);
    } else {
      body = renderStoryEditorScene(ctx, node.type === 'moveToArea'
        ? { type: 'area', areaId: node.areaId ?? '' }
        : { type: 'chara', characterId: node.characterId ?? '' });
    }
  }
  const entry = targetEntryId === undefined ? undefined : storyEntries(state, ctx.game.registry.storyEntries).get(targetEntryId);
  const entryTarget = targetEntryId === undefined ? '' : renderStoryEditorTarget(ctx, 'entry', targetEntryId,
    entry ? entryName(ctx, state, entry) : '', Boolean(entry), { gradient: entry?.cardGradient });
  const flagRecord = node.requiresFlag ? renderFlowFlag(ctx, state, node.requiresFlag, 'read', 'story-editor-flag-reader-record') : '';
  const editing = state.performanceEditing?.[draft.draftId]?.includes(node.id) ?? false;
  const performanceToggle = hasStoryNodeOverlay(node) ? `<button type="button" class="mini-action story-editor-performance-toggle${editing ? ' is-active' : ''}" data-story-performance-toggle="${ctx.escapeHtml(node.id)}" data-editor-key="performance-toggle:${ctx.escapeHtml(node.id)}" aria-pressed="${editing}" title="${editing ? '结束此节点的演出编辑' : '在聊天窗格中编辑演出位置'}"${(state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}>${editing ? '结束演出' : '演出'}</button>` : '';
  return `<div class="story-editor-node${state.selectedNodeId === node.id ? ' is-selected' : ''}" data-editor-key="node:${ctx.escapeHtml(node.id)}" data-editor-node="${ctx.escapeHtml(node.id)}" data-story-drop-target="story-node" role="button" tabindex="0" draggable="${(state.storageBlocked || Boolean(state.readOnlyReason)) ? 'false' : 'true'}" aria-label="选择或拖动 ${ctx.escapeHtml(node.type)} 节点" aria-pressed="${state.selectedNodeId === node.id}"><div class="story-editor-node-content${flagRecord ? ' has-flag' : ''}${entryTarget ? ' has-target-card' : ''}">${flagRecord}${body}${entryTarget}${performanceToggle}</div></div>`;
}
function renderFlowFlag(ctx: UIContext, state: StoryEditorState, name: string, usage: 'read' | 'write', className = ''): string {
  const e = ctx.escapeHtml;
  return `<button type="button" class="story-editor-target-card story-editor-flow-flag ${className}" data-editor-key="flow-flag:${usage}:${e(name)}" data-story-flow-flag="${usage}" data-story-drop-target="story-flag-reader" data-story-flag-name="${e(name)}" draggable="${!(state.storageBlocked || state.readOnlyReason)}" style="--story-editor-choice-flag-color:${storyEditorTargetColor(name)}" title="${e(name)}"><strong>${e(name)}</strong></button>`;
}
function renderChoiceOptionFlags(ctx: UIContext, state: StoryEditorState, choiceNodeId: string, optionIndex: number, optionId: string,
  option?: { requiresFlag?: string; marks?: readonly string[] },
) {
  const e = ctx.escapeHtml;
  const attributes = `data-editor-key="choice-target:${e(JSON.stringify([choiceNodeId, optionId]))}" data-story-drop-target="choice-flag" data-story-choice-node="${e(choiceNodeId)}" data-story-option-index="${optionIndex}" data-story-option-id="${e(optionId)}"`;
  const names = new Set(Array.isArray(option?.marks) ? option.marks.filter(name => typeof name === 'string' && name.trim()) : []);
  const required = typeof option?.requiresFlag === 'string' && option.requiresFlag.trim() ? option.requiresFlag : '';
  names.delete(required);
  const before = required ? renderFlowFlag(ctx, state, required, 'read') : '';
  const content = names.size ? `<div class="story-editor-choice-flags">${[...names].map(name => renderFlowFlag(ctx, state, name, 'write')).join('')}</div>` : '';
  return { attributes, before, content };
}
function renderInsertionPoint(ctx: UIContext, state: StoryEditorState, beforeNodeId: string | null): string {
  const key = beforeNodeId === null ? 'insertion:end' : `insertion:before:${beforeNodeId}`;
  const active = state.insertionBeforeNodeId === beforeNodeId;
  const anchor = beforeNodeId === null ? `data-story-insertion-end="true"` : `data-story-insertion-before="${ctx.escapeHtml(beforeNodeId)}"`;
  const label = beforeNodeId === null ? '在 Story 末尾插入' : '在此节点之前插入';
  return `<button type="button" class="story-editor-insertion-point${active ? ' is-active' : ''}" data-editor-key="${ctx.escapeHtml(key)}" data-story-drop-target="insertion-point" ${anchor} aria-label="${label}" title="${label}"${(state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}><span aria-hidden="true"></span></button>`;
}
function renderStoryInspector(ctx: UIContext, state: StoryEditorState, draft: StoryDraft): string {
  const e = ctx.escapeHtml;
  const startContext = draft.document.startContext;
  const readOnly = (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' readonly' : '';
  const tabs = renderTabs(ctx, 'right', [
    { id: 'overview', label: '概述', action: 'story-editor-inspector-tab:overview' },
    { id: 'relations', label: '关系', action: 'story-editor-inspector-tab:relations' },
    { id: 'flags', label: 'Flag表', action: 'story-editor-inspector-tab:flags' },
    { id: 'tools', label: '其他工具包', action: 'story-editor-inspector-tab:tools' },
  ], state.storyInspectorTab, 'Story 属性');
  const panel = (tab: StoryEditorState['storyInspectorTab'], content: string): string =>
    `<section class="story-editor-inspector-page" data-editor-key="story-inspector-panel:${tab}" data-story-inspector-panel="${tab}" role="tabpanel"${state.storyInspectorTab === tab ? '' : ' hidden'}>${content}</section>`;
  const overview = `<div class="story-editor-fields" data-editor-key="document:${e(draft.draftId)}">
    ${renderStoryCardOverview(ctx, 'story', draft.document.id, draft.document.name, draft.document.cardGradient, !readOnly)}
    <label>名称<input data-editor-key="name" data-editor-field="name" value="${e(draft.document.name)}"${readOnly}></label>
    ${renderPublicDescriptionField(ctx, draft, '$document', ['publicDescription'], draft.document.publicDescription, readOnly,
      '同 Mod 的关联入口未填写简介时，可在入口可见且名称已揭示后使用这段简介。')}
    <label>所属世界线<select data-editor-key="story-init" data-editor-field="story-init"${(state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}>
      <option value=""${draft.document.initId ? '' : ' selected'}>其他</option>
      ${draft.document.initId && !ctx.game.registry.inits.has(draft.document.initId) ? `<option value="${e(draft.document.initId)}" selected>${e(draft.document.initId)}（未载入）</option>` : ''}
      ${[...ctx.game.registry.inits.values()].map(init => `<option value="${e(init.id)}"${init.id === draft.document.initId ? ' selected' : ''}>${e(init.name || init.id)}</option>`).join('')}
    </select></label>
    <label>起始对话空间<select data-editor-field="story-context-type"${(state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}><option value="area"${startContext?.type !== 'chara' ? ' selected' : ''}>Area / 通用聊天</option><option value="chara"${startContext?.type === 'chara' ? ' selected' : ''}>Chara / 通讯录</option></select></label>
    ${startContext?.type === 'chara'
      ? `<label>起始角色<select data-story-reference="variant" data-editor-key="story-context-character" data-editor-field="story-context-character"${(state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}><option value="">选择角色</option>${[...ctx.game.registry.characterVariants.values()].map(item => `<option value="${e(item.id)}"${startContext.characterId === item.id ? ' selected' : ''}>${e(item.displayName)} · ${e(item.id)}</option>`).join('')}</select></label>`
      : `<label>起始区域<select data-story-reference="area" data-editor-key="story-context-area" data-editor-field="story-context-area"${(state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}><option value="">选择 Area</option>${[...ctx.game.registry.areas.values()].map(item => `<option value="${e(item.id)}"${startContext?.type === 'area' && startContext.areaId === item.id ? ' selected' : ''}>${e(item.name)} · ${e(item.id)}</option>`).join('')}</select></label>`}
    <div class="story-editor-actions"><button type="button" class="mini-action" data-editor-directory="story">${draft.document.directoryId || draft.document.hierarchyString ? '定位正文目录' : state.readOnlyReason ? '查看正文目录' : '选择正文目录'}</button>${draft.document.hierarchyString ? `<span>${e(draft.document.hierarchyString)}</span>` : ''}</div>
    <div class="story-editor-identity-field" role="group" aria-label="Story ID"><span>Story ID</span><div class="story-editor-readonly"><code>${e(draft.document.id)}</code><button type="button" class="mini-action" data-editor-action="rename-id"${(state.storageBlocked || Boolean(state.readOnlyReason))?' disabled':''}>更改 ID</button></div></div>
    ${draft.sourceId && draft.sourceId !== draft.document.id ? `<div class="story-editor-identity-field" role="group" aria-label="原 Story ID"><span>原 Story ID</span><div class="story-editor-readonly"><code>${e(draft.sourceId)}</code></div></div>` : ''}
    <p class="story-editor-hint">草稿保存在本机；保存到运行内容会立即生效，仅当前运行有效。</p></div>`;
  return `<div class="story-editor-story-inspector" data-editor-key="story-inspector:${e(draft.draftId)}"><div data-story-inspector-tabs>${tabs}</div>
    ${panel('overview', overview)}
    ${panel('relations', `${renderStoryRelations(ctx,state)}${renderStoryAuthoringEntryRelations(ctx,state,draft)}`)}
    ${panel('flags', renderStoryFlagCatalog(ctx,state))}
    ${panel('tools', renderStoryAuthoringTools(ctx,state,draft))}
  </div>`;
}
function inspector(ctx: UIContext, state: StoryEditorState): string {
  const draft = currentDraft(state);
  if (!draft) return empty('新建或选择一个 Story 开始编辑。');
  const node = state.inspectorView !== 'story' ? currentNode(state) : undefined;
  const e = ctx.escapeHtml;
  if (!node) return renderStoryInspector(ctx,state,draft);
  const index = draft.document.nodes.findIndex(item => item.id === node.id);
  const properties = renderStoryNodeProperties(ctx, state, draft, node, index);
  return `<div data-editor-key="inspector:${e(node.id)}">${properties}</div>`;
}
function baseColumn(ctx: UIContext, state: StoryEditorState, key: string, panel: 'left' | 'center' | 'right', title: string): WorkspaceColumnSpec {
  const stableKey = panel === 'center' ? 'editor-content' : panel === 'right' ? 'editor-inspector' : 'editor-explorer';
  return createEditorWorkspaceColumn(ctx, { key: stableKey, slot: panel, bindingKey: panel === 'left' ? key : storyEditorTargetKey(state),
    workspaceOwner: 'story-editor', hostId: `${panel}Panel.${key}`, themeScope: `${panel}.story-editor`,
    className: `story-editor-column story-editor-${panel}`, title, leaveAction: panel === 'left' ? 'data-column-back' : undefined, content: '' });
}
function sourceStatus(ctx: UIContext, state: StoryEditorState): string {
  const source = currentAuthoringDraft(state)?.packSource?.label;
  const advanced = editorLayout.state.mode === 'advanced';
  if (!state.readOnlyReason) return source && !advanced ? `<p class="story-editor-hint" data-editor-key="source-status">${ctx.escapeHtml(source)}</p>` : '';
  const recovery = state.sourceSelection?.startsWith('draft:');
  if (advanced && !recovery) return '';
  return `<p class="story-editor-hint" data-editor-key="source-status" role="status">${source && !recovery ? `${ctx.escapeHtml(source)} · ` : ''}${ctx.escapeHtml(state.readOnlyReason)}</p>
    <div class="story-editor-actions story-editor-actions--tools">${recovery ? button('recover-source', '打开原编辑包') + button('copy-recovery', '另存正文') : ''}${button('open-pack-manager', '数据包管理')}</div>`;
}
function entryName(ctx: UIContext, state: StoryEditorState, entry: StoryEntryDef): string {
  return entry.openingTitle || state.drafts.find(draft => draft.document.id === entry.storyId)?.document.name
    || ctx.game.registry.stories.get(entry.storyId)?.name || entry.id;
}
export function storyEditorDocumentName(ctx: UIContext, state: StoryEditorState): string | undefined {
  if (state.target?.kind === 'entry') {
    const entry = storyEntries(state, ctx.game.registry.storyEntries).get(state.target.id);
    return entry ? entryName(ctx, state, entry) : state.target.id;
  }
  return currentDraft(state)?.document.name || state.target?.id;
}

function documentActions(ctx: UIContext, state: StoryEditorState, entryExists = false): StoryDocumentActions {
  return storyDocumentActions(state, { entryExists, hasEditingMod: Boolean(storyEditingMods(ctx.game).length) });
}

function editorDocumentCommands(ctx: UIContext, state: StoryEditorState, actions: StoryDocumentActions, entry = false) {
  const authoring = (action: string, label: string, reason?: string, key?: string) =>
    `<button type="button" class="mini-action" data-authoring-action="${action}"${key ? ` data-editor-key="${key}"` : ''}${reason ? ` disabled title="${ctx.escapeHtml(reason)}"` : ''}>${label}</button>`;
  const editor = (action: string, label: string, reason?: string, danger = false) =>
    button(action, label, Boolean(reason), danger, reason ? ctx.escapeHtml(reason) : undefined);
  return {
    preview: authoring('preview', '试播', actions.preview.disabledReason, 'quick-preview'),
    save: editor('save', '保存草稿', actions.save.disabledReason),
    info: entry ? '' : button('info', '正文信息', !currentAuthoringDraft(state)),
    check: entry ? authoring('check', '检查内容', actions.check.disabledReason) : '',
    pack: actions.pack.visible ? authoring('pack', '保存到编辑态包', actions.pack.disabledReason) : '',
    apply: entry ? authoring('apply', '应用正文与关联内容', actions.apply.disabledReason)
      : editor('save-to-runtime', '保存到运行内容', actions.apply.disabledReason),
    restore: entry ? '' : editor('restore-source', '还原来源版本', actions.restore.disabledReason, true),
  };
}

function editorInsertCommands(editable: boolean): string {
  return button('click', '添加交互', !editable) + button('operation', '添加动作', !editable)
    + button('transfer', '添加剧情转移', !editable) + button('moveToArea', '添加区域移动', !editable)
    + button('moveToCharaspace', '添加角色空间移动', !editable);
}

function storyRibbonTools(ctx: UIContext, state: StoryEditorState, draft: StoryDraft | undefined, actions: StoryDocumentActions): string {
  const tool = renderEditorTool.bind(null, ctx);
  const stack = (tools: string) => `<div class="editor-workspace__tool-stack">${tools}</div>`;
  if (state.preview) return renderEditorToolGroup('试播',
    tool('restart', '从头试播', 'restart-preview', { kind: 'authoring', large: true })
    + tool('stop', '关闭试播', 'close-preview', { kind: 'authoring', large: true }));
  if (state.directoryManagement) return renderEditorToolGroup('目录管理', tool('back', '返回编辑', 'directory-back', { kind: 'editor', large: true }));

  const entry = state.target?.kind === 'entry';
  const hasDocument = Boolean(state.target);
  const draftTools = actions.rename.visible ? stack(
    tool('edit', '重命名', 'rename', { kind: 'editor', reason: actions.rename.disabledReason })
    + tool('trash', '删除草稿', 'delete-draft', { kind: 'editor', reason: actions.delete.disabledReason })) : '';
  return renderEditorToolGroup('文档',
    (hasDocument ? tool('save', '保存草稿', 'save', { kind: 'editor', large: true, reason: actions.save.disabledReason }) : '')
    + stack(tool('open', '打开…', 'open') + tool('new', '新建 Story', 'new', { kind: 'editor', reason: actions.new.disabledReason })
      + (hasDocument ? tool('locate', '在目录中定位', 'locate') : '')))
    + (hasDocument ? renderEditorToolGroup('试播', tool('play', '试播', 'preview',
      { kind: 'authoring', key: 'quick-preview', large: true, reason: actions.preview.disabledReason })
      + (entry || !draft ? '' : renderStoryPreviewEntrySelect(ctx, state, draft))) : '')
    + renderEditorToolGroup('管理', tool('pack', '数据包管理', 'open-pack-manager', { kind: 'editor', large: true })
      + (hasDocument ? stack(tool('check', '检查内容', 'check', { kind: 'authoring', reason: actions.check.disabledReason })
        + (actions.pack.visible ? tool('save', '保存到编辑态包', 'pack', { kind: 'authoring', reason: actions.pack.disabledReason }) : '')
        + tool('apply', entry ? '应用正文与关联内容' : '保存到运行内容', entry ? 'apply' : 'save-to-runtime',
           { kind: entry ? 'authoring' : 'editor', reason: actions.apply.disabledReason })) + draftTools : ''));
}

export function storyEditorBusinessChrome(ctx: UIContext, state: StoryEditorState,
  instances: BrowseInstanceSnapshot<StoryBrowseInstanceState> | BrowseInstanceSnapshot<EditorBrowseInstanceState>): EditorWorkbenchBusinessChrome {
  ctx = storySourceContext(ctx, state);
  const e = ctx.escapeHtml;
  const draft = currentAuthoringDraft(state);
  const name = storyEditorDocumentName(ctx, state);
  const entry = state.target?.kind === 'entry';
  const hasEntry = entry && storyEntries(state, ctx.game.registry.storyEntries).has(state.target!.id);
  const temporaryView = Boolean(state.preview || state.directoryManagement);
  const title = state.preview ? '剧情试播' : state.directoryManagement?.title() ?? name ?? '故事编辑';
  const source = draft?.packSource?.label ?? (state.sourceSelection?.startsWith('pack:')
    ? state.sourceOptions?.find(option => option.value === state.sourceSelection)?.label : undefined) ?? '当前游戏';
  const access = state.storageBlocked ? '草稿存储不可用' : state.readOnlyReason ? '只读'
    : draft ? '可编辑' : '';
  const saved = draft?.dirty ? (state.readOnlyReason ? '草稿已保留' : '草稿未保存') : draft?.persisted ? '草稿已保存' : '';
  const message = state.error || state.notice || state.sourceWarning;
  const issues = !entry && !temporaryView ? draft?.editorIssues ?? [] : [];
  const canLocate = issues.some(issue => issue.nodeId);
  return {
    temporaryView, viewOverride: temporaryView ? 'three' : undefined, instancesVisible: Boolean(state.directoryManagement),
    canDuplicate: !temporaryView && Boolean(state.target
      && !(instances.instances.find(instance => instance.id === instances.activeBrowseInstanceId)?.state as StoryBrowseInstanceState | undefined)?.unavailable),
    commands: editorLayout.state.mode === 'advanced' ? storyRibbonTools(ctx, state, draft, documentActions(ctx, state, hasEntry)) : '',
    status: `<span title="${e(state.readOnlyReason ?? source)}">${e([source, access].filter(Boolean).join(' · '))}</span>
      <span title="${e(state.selectedNodeId ?? state.target?.id ?? title)}">${e([title, state.selectedNodeId].filter(Boolean).join(' / '))}</span>
      <div class="editor-workspace__feedback"><span title="${e(message ?? saved)}" role="status">${e([saved, message].filter(Boolean).join(' · '))}</span>
        ${canLocate ? `<button type="button" class="mini-action" data-editor-workspace-action="issue" title="定位首个节点问题">${issues.length} 处问题</button>`
        : issues.length ? `<span>${issues.length} 处问题</span>` : ''}</div>`,
  };
}

const emptyExplorerState: EditorExplorerStateSnapshot = { queries: {}, expandedPlacementKeys: [], searchExpandedPlacementKeys: [],
  expandedOverrides: {}, searchExpandedOverrides: {}, scrollTopByHost: {} };

export function createStoryEditorListColumn(ctx: UIContext, state: StoryEditorState, explorerState: StoryExplorerState,
  projection: StoryExplorerProjection, explorer: EditorExplorerStateSnapshot = emptyExplorerState, senderEnabled = false): WorkspaceColumnSpec {
  const e = ctx.escapeHtml;
  const directoryContext = storySourceContext(ctx, projection);
  const appliedDirectories = directoryContext.game.registry.storyDirectories;
  const documentContext = storySourceContext(ctx, state);
  const initIds = sidebarInitIds(directoryContext, projection);
  const initName = (id: string) => id === 'other' ? '其他' : directoryContext.game.registry.inits.get(id)?.name || id;
  const sourceSelection = storyExplorerSourceValue(projection.source);
  const requestedInit = explorerState.initFilter;
  const initFilter = requestedInit === 'other' || initIds.includes(requestedInit) ? requestedInit : '';
  const draft = currentDraft(state);
  const query = sidebarSearch(explorerState, explorer);
  const isSenderMode = explorerState.auxiliaryTool === 'senders' && senderEnabled && Boolean(draft);
  const filterSummary = [query.trim(), initFilter && initName(initFilter),
    explorerState.directoryMode === 'stories' ? 'Story' : explorerState.directoryMode === 'entries' ? 'Entry' : ''].filter(Boolean).join(' · ');
  const senders = storySenders(documentContext);
  const senderSearch = (explorer.queries.senders ?? '').trim().toLocaleLowerCase();
  const visibleSenders = senders.filter(sender => !senderSearch || `${sender.label}\n${sender.id}`.toLocaleLowerCase().includes(senderSearch));
  const selectedSender = composer(state).sender;
  const mode = isSenderMode ? 'senders' : 'directory';
  const alternate = isSenderMode ? 'directory' : 'senders';
  const modes = { directory: '故事目录', senders: '发出方' };
  const modeControls = `<div class="story-editor-sidebar-mode" role="group" aria-label="左栏视图">
    <button type="button" class="mini-action" data-sidebar-mode-cycle data-column-action="story-editor-sidebar:${alternate}" title="切换到${modes[alternate]}" aria-label="${modes[mode]}，切换到${modes[alternate]}">${modes[mode]}</button>
    <button type="button" class="mini-action" popovertarget="story-editor-sidebar-modes" aria-label="选择左栏视图" title="选择左栏视图"><span aria-hidden="true">▾</span></button>
    <div id="story-editor-sidebar-modes" class="story-editor-sidebar-modes" popover="auto" role="group" aria-label="选择左栏视图">
      ${Object.entries(modes).map(([id, label]) => `<button type="button" class="mini-action" data-column-action="story-editor-sidebar:${id}" aria-pressed="${mode === id}">${label}</button>`).join('')}
    </div>
  </div>`;
  return { ...baseColumn(ctx, state, 'story-editor-list', 'left', 'Story'), content: `<div class="story-editor-list-content story-editor-sidebar">
    ${projection.sourceOptions.length ? `<label class="story-editor-source-line">${editorLayout.state.mode === 'advanced' ? '搜索来源' : '内容来源'}<select data-editor-source data-editor-key="pack-source" title="${e(projection.sourceOptions.find(option => option.value === sourceSelection)?.label ?? '当前游戏')}">
      <option value=""${sourceSelection ? '' : ' selected'}>当前游戏</option>
      ${(['packs', 'drafts'] as const).map(group => {
        const options = projection.sourceOptions.filter(option => option.group === group);
        return options.length ? `<optgroup label="${group === 'packs' ? '已载入数据包' : '保留草稿'}">${options.map(option =>
          `<option value="${e(option.value)}"${option.value === sourceSelection ? ' selected' : ''}>${e(option.label)}</option>`).join('')}</optgroup>` : '';
      }).join('')}
    </select></label>
    ${projection.sourceWarning ? `<p class="story-editor-hint" role="status">${e(projection.sourceWarning)}</p>` : ''}` : ''}
    <section class="story-editor-sidebar-pane" data-editor-key="sidebar-stories" aria-label="故事目录"${isSenderMode ? ' hidden' : ''}>
      ${renderEditorDirectoryTools("目录工具", `
        <button type="button" class="mini-action" data-sidebar-action="filters" aria-expanded="${explorerState.filtersOpen}" aria-controls="story-editor-sidebar-filters">搜索与筛选 <span aria-hidden="true">${explorerState.filtersOpen ? '▾' : '▸'}</span></button>
        ${button('new', '新建', state.storageBlocked)}<button type="button" class="mini-action" data-editor-directory="browse">目录</button>
        ${draft && editorLayout.state.mode !== 'advanced' ? `<details class="story-editor-sidebar-ops" data-editor-key="sidebar-draft-actions"><summary class="mini-action" aria-label="草稿操作" title="草稿操作">⋯</summary>
          <div class="story-editor-actions">${button('rename', '重命名', state.storageBlocked || Boolean(state.readOnlyReason))}${button('delete-draft', '删除草稿', state.storageBlocked || Boolean(state.readOnlyReason) || !draft.persisted && !draft.dirty, true)}</div></details>` : ''}
      `, "sidebar-tools")}
      ${filterSummary ? `<div class="story-editor-sidebar-summary" data-editor-key="sidebar-summary"><span title="${e(filterSummary)}">${e(filterSummary)}</span><button type="button" class="mini-action" data-sidebar-action="clear">清除筛选</button></div>` : ''}
      <div class="story-editor-sidebar-filters" id="story-editor-sidebar-filters" data-editor-key="sidebar-filters"${explorerState.filtersOpen ? '' : ' hidden'}>
        <input type="search" aria-label="搜索名称或 ID" data-editor-key="sidebar-query" data-sidebar-search data-editor-explorer-query="${explorerState.directoryMode === 'entries' ? 'entries' : 'stories'}" ${explorerState.directoryMode === 'entries' ? 'data-editor-entry-search' : 'data-editor-search'} value="${e(query)}" placeholder="名称或 ID">
        <label>世界线<select data-editor-key="story-init-filter" data-editor-story-init-filter>
          <option value=""${initFilter ? '' : ' selected'}>全部</option><option value="other"${initFilter === 'other' ? ' selected' : ''}>其他</option>
          ${initIds.map(initId => `<option value="${e(initId)}"${initId === initFilter ? ' selected' : ''}>${e(initName(initId))}</option>`).join('')}
        </select></label>
        <div class="story-editor-actions" role="group" aria-label="内容类型">${(['all', 'stories', 'entries'] as const).map(kind =>
          `<button type="button" class="mini-action" data-column-action="story-editor-sidebar:${kind}" aria-pressed="${explorerState.directoryMode === kind}">${{ all: '全部', stories: 'Story', entries: 'Entry' }[kind]}</button>`).join('')}</div>
      </div>
      ${renderEditorDirectoryScroll(ctx, 'stories', 'story-list', 'story-editor-list', projection.available
        ? renderSidebarTree(directoryContext, state, explorerState, projection, initIds, initFilter, appliedDirectories, explorer)
        : `<p class="story-editor-hint" role="status">${e(projection.sourceWarning ?? '当前目录来源暂不可用。')}</p>`)}
    </section>
    <section class="story-editor-sidebar-pane story-editor-senders-content" data-editor-key="sidebar-senders" aria-label="发出方"${isSenderMode ? '' : ' hidden'}>
      <label class="story-editor-search">搜索发出方<input type="search" data-editor-key="sender-search" data-editor-sender-search data-editor-explorer-query="senders" value="${ctx.escapeHtml(explorer.queries.senders ?? '')}" placeholder="名称或 ID"></label>
      ${draft ? '' : empty('先选择或新建一个 Story。')}
      ${renderEditorDirectoryScroll(ctx, 'senders', 'sender-list', 'story-editor-sender-list', visibleSenders.map(sender => `<button type="button" class="story-editor-list-item story-editor-sender-item${sender.id === selectedSender ? ' is-selected' : ''}" data-editor-key="sender:${e(sender.id)}" data-editor-sender="${e(sender.id)}" aria-pressed="${sender.id === selectedSender}"${!draft || (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}>${senderAvatar(documentContext, sender)}<strong>${e(sender.label)}</strong></button>`).join('') || empty('没有匹配的发出方。'))}
    </section>
  </div>`, header: renderWorkspaceTitlebar(ctx, 'left', 'Story 编辑器', 'data-column-back', undefined, modeControls) };
}

export function createStoryEditorExplorerColumn(ctx: UIContext, state: StoryEditorState, explorerState: StoryExplorerState,
  projection: StoryExplorerProjection, explorer: EditorExplorerStateSnapshot = emptyExplorerState, senderEnabled = false): WorkspaceColumnSpec {
  const column = createStoryEditorListColumn(ctx, state, explorerState, projection, explorer, senderEnabled);
  return { ...column, key: 'editor-explorer', definitionId: 'editor-explorer', bindingKey: 'story-explorer' };
}
function editorHistoryHeader(ctx: UIContext, state: StoryEditorState, title: string): string {
  return renderWorkspaceTitlebar(ctx, 'center', title, undefined,
    `<div class="story-editor-history" role="group" aria-label="浏览历史"><button type="button" class="workspace-back" data-editor-action="history-back" aria-label="后退" title="后退"${state.visitIndex > 0 ? '' : ' disabled'}>←</button><button type="button" class="workspace-back" data-editor-action="history-forward" aria-label="前进" title="前进"${state.visitIndex >= 0 && state.visitIndex < state.visits.length - 1 ? '' : ' disabled'}>→</button></div>`);
}
export function createStoryEditorFlowColumn(ctx: UIContext, state: StoryEditorState): WorkspaceColumnSpec {
  const draft = currentDraft(state);
  const node = state.inspectorView === 'story' ? undefined : currentNode(state);
  const layout = node?.type === 'talklet' || node?.type === 'click' ? node.performance?.layout : undefined;
  const positioned = layout?.mode === 'positioned' ? layout : undefined;
  const positionDisabled = (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : '';
  const positionTools = positioned && node && draft && state.performanceEditing?.[draft.draftId]?.includes(node.id)
    ? `<div class="story-editor-position-tools" data-editor-key="position-tools" role="group" aria-label="演出定位">
    <div role="group" aria-label="纵向基准">${[['top','上'],['center','中'],['bottom','下']].map(([value,label]) => `<button type="button" class="mini-action" data-story-position-y="${value}" aria-pressed="${positioned.anchor?.y === value}"${positionDisabled}>${label}</button>`).join('')}</div>
    <div role="group" aria-label="横向基准">${[['left','左'],['center','中'],['right','右']].map(([value,label]) => `<button type="button" class="mini-action" data-story-position-x="${value}" aria-pressed="${positioned.anchor?.x === value}"${positionDisabled}>${label}</button>`).join('')}</div>
    <div role="group" aria-label="坐标单位">${[['px','px'],['percent','%']].map(([value,label]) => `<button type="button" class="mini-action" data-story-position-unit="${value}" aria-pressed="${(positioned.unit ?? 'percent') === value}"${positionDisabled}>${label}</button>`).join('')}</div>
  </div>` : '';
  const input = composer(state);
  const senders = storySenders(ctx);
  const selectedSender = senders.find(sender => sender.id === input.sender) ?? senders[0];
  const editable = Boolean(draft) && !(state.storageBlocked || Boolean(state.readOnlyReason));
  const advanced = editorLayout.state.mode === 'advanced';
  const commands = editorDocumentCommands(ctx, state, documentActions(ctx, state));
  const canSend = editable && Boolean(input.text.trim());
  const nodes = draft?.document.nodes ?? [];
  const flow = !draft ? empty('从左栏选择或新建 Story。') : nodes.length
    ? `${renderInsertionPoint(ctx, state, nodes[0].id)}${nodes.map((node, index) => `${renderEditorNode(ctx, state, node)}${renderInsertionPoint(ctx, state, nodes[index + 1]?.id ?? null)}`).join('')}`
    : `<p class="story-editor-empty">从下方发送第一条正文，或添加一个节点。</p>${renderInsertionPoint(ctx, state, null)}`;
  return { ...baseColumn(ctx, state, 'story-editor-flow', 'center', draft?.document.name || '编辑'),
    header: editorHistoryHeader(ctx, state, draft?.document.name || '编辑'),
    bodyOverlay: renderStoryPerformanceEditing(ctx,state) + positionTools,
    content: `<div class="story-editor-flow" data-editor-key="flow">${draft ? renderStoryEditorScene(ctx, draft.document.startContext, true) : ''}${flow}</div>`,
  footer: `<div class="story-editor-composer" data-editor-key="composer">${advanced ? '' : `<div class="story-editor-actions story-editor-actions--tools" role="group" aria-label="正文操作">${commands.info}${commands.preview}${commands.save}${commands.pack}${commands.apply}${commands.restore}<span data-editor-status>${draft?.dirty ? state.readOnlyReason ? '已保留' : '未保存' : draft?.persisted ? '已保存' : ''}</span></div>`}
      ${sourceStatus(ctx, state)}
      <p class="story-editor-hint" data-editor-key="save-notice" role="status"${state.notice ? '' : ' hidden'}>${ctx.escapeHtml(state.notice ?? '')}</p>
      <p class="story-editor-error" role="status"${state.error ? '' : ' hidden'}>${ctx.escapeHtml(state.error ?? '')}</p>
      <div class="story-editor-composer-talklet chat-talk chat-talk-npc" data-editor-key="composer-talklet">
        <button type="button" class="story-editor-composer-speaker" data-editor-key="composer-sender:${ctx.escapeHtml(selectedSender?.id ?? 'narrator')}" data-editor-action="choose-sender" aria-label="更改发出方，当前为${ctx.escapeHtml(selectedSender?.label ?? '旁白')}" title="更改发出方"${editable ? '' : ' disabled'}>${senderAvatar(ctx, selectedSender ?? { id: 'narrator', label: '旁白' })}</button>
        <div class="chat-talk-main"><div class="chat-name" data-editor-key="composer-speaker-name">${ctx.escapeHtml(selectedSender?.label ?? '旁白')}</div>
          <div class="chat-bubble chat-bubble-npc story-editor-composer-bubble"><textarea data-editor-key="composer-text" data-editor-composer-text aria-label="输入正文" rows="2" placeholder="输入正文…"${editable ? '' : ' disabled'}>${ctx.escapeHtml(input.text)}</textarea></div>
        </div>
        <button type="button" class="send-button send-player story-editor-composer-send${canSend ? '' : ' disabled'}" data-editor-action="send" aria-label="确认发送" title="确认发送"${canSend ? '' : ' disabled'}>
          <span class="send-bubble${canSend ? '' : ' disabled'}"><span class="send-text">确认发送</span><span class="send-arrow" aria-hidden="true">↗</span></span>
        </button>
      </div>
      <div class="story-editor-actions story-editor-actions--tools" role="group" aria-label="添加节点">${editorInsertCommands(editable)}</div></div>` };
}
export function createStoryEditorInspectorColumn(ctx: UIContext, state: StoryEditorState): WorkspaceColumnSpec {
  return { ...baseColumn(ctx, state, 'story-editor-inspector', 'right', '属性'),
    header: renderWorkspaceTitlebar(ctx, 'right', '属性', state.inspectorView !== 'story' && currentNode(state) ? 'data-column-back' : undefined),
    content: `<div data-editor-key="inspector">${inspector(ctx, state)}</div>` };
}
export function createStoryEditorBusinessColumns(ctx: UIContext, state: StoryEditorState): WorkspaceColumnSpec[] {
  if (state.preview) return [...workspaceColumns(createStoryPreviewFrame(storySourceContext(ctx, state), state))];
  const columns: WorkspaceColumnSpec[] = [];
  ctx = storySourceContext(ctx, state);
  const directory = state.directoryManagement;
  if (directory) {
    const { initId, directoryId } = directory.location();
    const bindingKey = JSON.stringify(['directory', initId, directoryId]);
    const title = directory.title();
    columns.push(
      { ...baseColumn(ctx, state, 'story-editor-flow', 'center', title), bindingKey,
        header: renderWorkspaceTitlebar(ctx, 'center', title, undefined,
          editorLayout.state.mode === 'advanced' ? undefined : '<button type="button" class="workspace-back" data-editor-action="directory-back" aria-label="返回编辑" title="返回编辑">←</button>')
          + `<div class="story-editor-entry-tabs" data-editor-key="directory-tabs">${directory.renderTabs()}</div>`,
        bodyOverlay: '',
        content: `<section aria-label="目录内容" data-editor-key="directory-content">${directory.renderContent()}</section>` },
      { ...baseColumn(ctx, state, 'story-editor-inspector', 'right', '层级与手动资料'), bindingKey,
        content: `<section aria-label="目录资料" data-editor-key="directory-details">${directory.renderDetails()}</section>`,
        footer: `<p class="story-editor-hint" role="status"${directory.status() ? '' : ' hidden'}>${ctx.escapeHtml(directory.status())}</p>` },
    );
    return columns;
  }
  if(state.target?.kind!=='entry')state.entryPoolContext=undefined;
  if (state.target?.kind === 'entry') {
    const entry = storyEntries(state, ctx.game.registry.storyEntries).get(state.target.id);
    const pendingRemoval = !entry && Boolean(currentAuthoringDraft(state)?.entryOnly);
    const name = entry ? entryName(ctx, state, entry) : state.target.id;
    const tabs = entry ? renderTabs(ctx, 'center', [
      { id: 'basic', label: '基本信息', action: 'story-editor-entry-tab:basic' },
      { id: 'rewards', label: '奖励信息', action: 'story-editor-entry-tab:rewards' },
      { id: 'gates', label: '详细门控', action: 'story-editor-entry-tab:gates' },
    ], state.entryEditorTab ?? 'basic', 'Entry 编辑页') : '';
    const center = baseColumn(ctx, state, 'story-editor-flow', 'center', name);
    const commands = editorDocumentCommands(ctx, state, documentActions(ctx, state, Boolean(entry)), true);
    columns.push({ ...center, className: `${center.className} story-editor-entry-column`,
      header: editorHistoryHeader(ctx, state, name) + (tabs ? `<div class="story-editor-entry-tabs" data-editor-key="entry-tabs">${tabs}</div>` : ''),
      bodyOverlay: '',
      content: `<div data-editor-key="entry-page" data-editor-entry-page="${ctx.escapeHtml(state.target.id)}">${entry && (state.entryEditorTab ?? 'basic') === 'basic'
        ? renderStoryCardOverview(ctx, 'entry', entry.id, name, entry.cardGradient, !state.storageBlocked && !state.readOnlyReason) : ''}${entry ? renderStoryEntryFields(ctx,state) : empty(pendingRemoval ? '已从草稿移除此入口。保存到编辑态包后更新该包。' : '该 Entry 已不存在。')}</div>`,
      footer: entry || pendingRemoval ? `${editorLayout.state.mode === 'advanced' ? '' : `<div class="story-editor-actions story-editor-actions--tools" role="group" aria-label="入口操作">${commands.preview}${commands.save}${commands.check}${commands.pack}${commands.apply}</div>`}${sourceStatus(ctx, state)}<p class="story-editor-hint" role="status"${state.notice ? '' : ' hidden'}>${ctx.escapeHtml(state.notice ?? '')}</p><p class="story-editor-error" role="status"${state.error ? '' : ' hidden'}>${ctx.escapeHtml(state.error ?? '')}</p>` : '' },
    { ...baseColumn(ctx, state, 'story-editor-inspector', 'right', 'Entry 属性'),
      content: `<div data-editor-key="entry-inspector" data-editor-entry-page="${ctx.escapeHtml(state.target.id)}">${renderStoryRelations(ctx,state)}${renderStoryFlagCatalog(ctx,state)}</div>` });
  } else columns.push(createStoryEditorFlowColumn(ctx, state), createStoryEditorInspectorColumn(ctx, state));
  return columns;
}
