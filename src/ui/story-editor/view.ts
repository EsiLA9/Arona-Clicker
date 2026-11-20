import { storyEntryType } from '../../data-services/contracts/story-entry';
import { projectStoryContent, storyNodeDisplay } from '../../data-services/authoring/story-content-display';
import { renderStoryClickAppearance } from '../components/story/story';
import { renderStoryAuthoringEntryRelations, renderStoryAuthoringTools, renderStoryEntryFields } from './authoring-view';
import { renderStoryTransfer } from './transfer-view';
import { renderStoryEditorTarget, storyEditorTargetColor } from './target-view';
import { renderStoryEditorScene } from './scene-view';
import { renderStoryRelations } from './relations-view';
import { createStoryPreviewFrame } from './preview-view';
import { renderStoryFlagCatalog } from './flag-catalog-view';
import type { UIContext } from '../runtime/context';
import { renderChatEntry, renderStoryClickPreview } from '../components/story/story';
import { renderWorkspaceFrame, type WorkspaceColumnSpec, type WorkspaceFrameSpec } from '../components/shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../components/shared/workspace-titlebar';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import { storyEntries, storyEditorTargetKey } from './model';
import { renderTabs } from '../components/shared/tabs';
import { renderAvatarSvg } from '../presentation/avatar-renderer';
import { choiceOptionFlagBindings, composer, currentDraft, currentNode, senderChangeAllowed, senderForNode, storyList, type StoryDraft, type StoryDraftNode, type StoryEditorState, type StorySender } from './model';
import { hasStoryNodeOverlay, renderStoryPerformanceEditing, renderStoryNodeProperties } from './property-fields';
import type { StoryAction, StoryStateAction, StoryNumericValue } from '../../data-services/contracts/story-node-actions';

export function storySenders(ctx: UIContext): StorySender[] {
  return [{ id: 'narrator', label: '旁白' }, { id: 'teacher', label: '老师', speaker: '老师' },
    ...[...ctx.game.registry.characters.values()].map(character => ({ id: `character:${character.id}`, label: character.displayName, speaker: character.displayName }))];
}
const button = (action: string, text: string, disabled = false, danger = false): string =>
  `<button type="button" class="mini-action${danger ? ' mini-action--danger' : ''}" data-editor-action="${action}"${disabled ? ' disabled' : ''}>${text}</button>`;
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

function operationSummary(ctx: UIContext, action: StoryAction | undefined): string {
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
    case 'entryRequest': {
      const request = action.request;
      if (!request) return '请求剧情入口';
      const entry = referenceLabel(registry.storyEntries.values(), request.entryId, item => item.id,
        item => item.openingTitle || registry.stories.get(item.storyId)?.name);
      return `请求${request.entryType === 'active' ? '主动' : '被动'}剧情：${entry}`;
    }
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
  return `<div class="chat-current story-editor-operation-preview">${renderChatEntry(ctx, { kind: 'system', text: operationSummary(ctx, action) })}</div>`;
}

export function renderEditorNode(ctx: UIContext, state: StoryEditorState, node: StoryDraftNode): string {
  const draft = currentDraft(state)!;
  let body: string;
  let entryTarget = '';
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
    const targetId = click.interaction?.kind === 'entryCard' ? click.interaction.card?.request?.entryId ?? ''
      : click.interaction?.kind === 'kizunaCard' ? legacyTargets.length === 1 ? legacyTargets[0] : '' : undefined;
    if (targetId !== undefined) {
      const entry = storyEntries(state, ctx.game.registry.storyEntries).get(targetId);
      const label = entry ? entryName(ctx, state, entry) : targetId || '未配置 Entry';
      entryTarget = renderStoryEditorTarget(ctx, 'entry', targetId, label, Boolean(entry));
    }
    body = renderStoryClickPreview(ctx, click.interaction, {
      ...(click.interaction?.kind === 'choice' ? {
      choiceOptionAddon: (option, index) => renderChoiceOptionFlagCard(ctx, state, draft, node.id, index, option.id),
      } : {}),
    });
    body=renderStoryClickAppearance(body,storyNodeDisplay(node));
  } else {
    if (node.type === 'operation') body = renderOperationPreview(ctx, node.action);
    else if (node.type === 'transfer') {
      body = renderStoryTransfer(ctx, state, node.transfer);
    } else {
      body = renderStoryEditorScene(ctx, node.type === 'moveToArea'
        ? { type: 'area', areaId: node.areaId ?? '' }
        : { type: 'chara', characterId: node.characterId ?? '' });
    }
  }
  const flagRecord = node.requiresFlag ? `<code class="story-editor-flag-reader-record" data-story-drop-target="story-flag-reader" data-story-flag-name="${ctx.escapeHtml(node.requiresFlag)}" style="--story-editor-choice-flag-color:${storyEditorTargetColor(node.requiresFlag)}" title="拖动节点到此记录上，以使用局部标记「${ctx.escapeHtml(node.requiresFlag)}」" aria-label="局部标记 ${ctx.escapeHtml(node.requiresFlag)}；可将其他节点拖到此处">${ctx.escapeHtml(node.requiresFlag)}</code>` : '';
  const editing = state.performanceEditing?.[draft.draftId]?.includes(node.id) ?? false;
  const performanceToggle = hasStoryNodeOverlay(node) ? `<button type="button" class="mini-action story-editor-performance-toggle${editing ? ' is-active' : ''}" data-story-performance-toggle="${ctx.escapeHtml(node.id)}" data-editor-key="performance-toggle:${ctx.escapeHtml(node.id)}" aria-pressed="${editing}" title="${editing ? '结束此节点的演出编辑' : '在聊天窗格中编辑演出位置'}"${state.storageBlocked ? ' disabled' : ''}>${editing ? '结束演出' : '演出'}</button>` : '';
  return `<div class="story-editor-node${state.selectedNodeId === node.id ? ' is-selected' : ''}" data-editor-key="node:${ctx.escapeHtml(node.id)}" data-editor-node="${ctx.escapeHtml(node.id)}" data-story-drop-target="story-node" role="button" tabindex="0" draggable="${state.storageBlocked ? 'false' : 'true'}" aria-label="选择或拖动 ${ctx.escapeHtml(node.type)} 节点" aria-pressed="${state.selectedNodeId === node.id}"><div class="story-editor-node-content${flagRecord ? ' has-flag' : ''}${entryTarget ? ' has-target-card' : ''}">${flagRecord}${body}${entryTarget}${performanceToggle}</div></div>`;
}
function renderChoiceOptionFlagCard(ctx: UIContext, state: StoryEditorState, draft: StoryDraft, choiceNodeId: string, optionIndex: number, optionId: string): string {
  const bindings = choiceOptionFlagBindings(draft, choiceNodeId, optionIndex, optionId);
  const groups = bindings.flatMap(binding => binding.nodeIds.map(nodeId => {
    const label = `移除此节点的标记条件；若多个选项共用标记「${binding.flagName}」，此节点将不再受这些选项控制`;
    return `<span class="story-editor-choice-flag-binding" style="--story-editor-choice-flag-color:${storyEditorTargetColor(binding.flagName)}" title="${ctx.escapeHtml(binding.flagName)} → ${ctx.escapeHtml(nodeId)}">${ctx.escapeHtml(binding.flagName)}<button type="button" class="story-editor-choice-flag-unbind" data-story-choice-flag-unbind="true" data-story-choice-node="${ctx.escapeHtml(choiceNodeId)}" data-story-option-index="${optionIndex}" data-story-option-id="${ctx.escapeHtml(optionId)}" data-story-flag-name="${ctx.escapeHtml(binding.flagName)}" data-story-node-id="${ctx.escapeHtml(nodeId)}" aria-label="${ctx.escapeHtml(label)}" title="${ctx.escapeHtml(label)}"${state.storageBlocked ? ' disabled' : ''}>×</button></span>`;
  })).join('');
  return `<div class="story-editor-choice-flag-card${bindings.length ? ' has-bindings' : ''}" data-story-drop-target="choice-flag" data-story-choice-node="${ctx.escapeHtml(choiceNodeId)}" data-story-option-index="${optionIndex}" data-story-option-id="${ctx.escapeHtml(optionId)}" aria-label="${bindings.length ? `局部标记绑定 ${bindings.length} 项` : '拖动节点到此处添加局部标记绑定'}"${state.storageBlocked ? ' aria-disabled="true"' : ''}>
    ${groups || '<strong>局部标记</strong><span class="story-editor-choice-flag-empty">拖入节点</span>'}
  </div>`;
}
function renderInsertionPoint(ctx: UIContext, state: StoryEditorState, beforeNodeId: string | null): string {
  const key = beforeNodeId === null ? 'insertion:end' : `insertion:before:${beforeNodeId}`;
  const active = state.insertionBeforeNodeId === beforeNodeId;
  const anchor = beforeNodeId === null ? `data-story-insertion-end="true"` : `data-story-insertion-before="${ctx.escapeHtml(beforeNodeId)}"`;
  const label = beforeNodeId === null ? '在 Story 末尾插入' : '在此节点之前插入';
  return `<button type="button" class="story-editor-insertion-point${active ? ' is-active' : ''}" data-editor-key="${ctx.escapeHtml(key)}" data-story-drop-target="insertion-point" ${anchor} aria-label="${label}" title="${label}"${state.storageBlocked ? ' disabled' : ''}><span aria-hidden="true"></span></button>`;
}
function renderStoryInspector(ctx: UIContext, state: StoryEditorState, draft: StoryDraft): string {
  const e = ctx.escapeHtml;
  const startContext = draft.document.startContext;
  const readOnly = state.storageBlocked ? ' readonly' : '';
  const tabs = renderTabs(ctx, 'right', [
    { id: 'overview', label: '概述', action: 'story-editor-inspector-tab:overview' },
    { id: 'relations', label: '关系', action: 'story-editor-inspector-tab:relations' },
    { id: 'flags', label: 'Flag表', action: 'story-editor-inspector-tab:flags' },
    { id: 'tools', label: '其他工具包', action: 'story-editor-inspector-tab:tools' },
  ], state.storyInspectorTab, 'Story 属性');
  const panel = (tab: StoryEditorState['storyInspectorTab'], content: string): string =>
    `<section class="story-editor-inspector-page" data-editor-key="story-inspector-panel:${tab}" data-story-inspector-panel="${tab}" role="tabpanel"${state.storyInspectorTab === tab ? '' : ' hidden'}>${content}</section>`;
  const overview = `<div class="story-editor-fields" data-editor-key="document:${e(draft.draftId)}">
    <label>名称<input data-editor-key="name" data-editor-field="name" value="${e(draft.document.name)}"${readOnly}></label>
    <label>所属世界线<select data-editor-key="story-init" data-editor-field="story-init"${state.storageBlocked ? ' disabled' : ''}>
      <option value=""${draft.document.initId ? '' : ' selected'}>其他</option>
      ${draft.document.initId && !ctx.game.registry.inits.has(draft.document.initId) ? `<option value="${e(draft.document.initId)}" selected>${e(draft.document.initId)}（未载入）</option>` : ''}
      ${[...ctx.game.registry.inits.values()].map(init => `<option value="${e(init.id)}"${init.id === draft.document.initId ? ' selected' : ''}>${e(init.name || init.id)}</option>`).join('')}
    </select></label>
    <label>起始对话空间<select data-editor-field="story-context-type"${state.storageBlocked ? ' disabled' : ''}><option value="area"${startContext?.type !== 'chara' ? ' selected' : ''}>Area / 通用聊天</option><option value="chara"${startContext?.type === 'chara' ? ' selected' : ''}>Chara / 通讯录</option></select></label>
    ${startContext?.type === 'chara'
      ? `<label>起始角色<select data-story-reference="variant" data-editor-key="story-context-character" data-editor-field="story-context-character"${state.storageBlocked ? ' disabled' : ''}><option value="">选择角色</option>${[...ctx.game.registry.characterVariants.values()].map(item => `<option value="${e(item.id)}"${startContext.characterId === item.id ? ' selected' : ''}>${e(item.displayName)} · ${e(item.id)}</option>`).join('')}</select></label>`
      : `<label>起始区域<select data-story-reference="area" data-editor-key="story-context-area" data-editor-field="story-context-area"${state.storageBlocked ? ' disabled' : ''}><option value="">选择 Area</option>${[...ctx.game.registry.areas.values()].map(item => `<option value="${e(item.id)}"${startContext?.type === 'area' && startContext.areaId === item.id ? ' selected' : ''}>${e(item.name)} · ${e(item.id)}</option>`).join('')}</select></label>`}
    <div class="story-editor-identity-field" role="group" aria-label="Story ID"><span>Story ID</span><div class="story-editor-readonly"><code>${e(draft.document.id)}</code><button type="button" class="mini-action" data-editor-action="rename-id"${state.storageBlocked?' disabled':''}>更改 ID</button></div></div>
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
  return { key, definitionId: key, bindingKey: storyEditorTargetKey(state), slot: panel,
    width: panel === 'left' ? '300px' : `var(--workspace-${panel}-width)`, workspaceOwner: 'story-editor', hostId: `${panel}Panel.${key}`,
    themeScope: `${panel}.story-editor`, surface: 'panel', scroll: panel === 'left' ? 'content' : 'auto', className: `story-editor-column story-editor-${panel}`,
    header: renderWorkspaceTitlebar(ctx, panel, title, panel === 'left' ? 'data-column-back' : undefined), content: '' };
}
function entryName(ctx: UIContext, state: StoryEditorState, entry: StoryEntryDef): string {
  return entry.openingTitle || state.drafts.find(draft => draft.document.id === entry.storyId)?.document.name
    || ctx.game.registry.stories.get(entry.storyId)?.name || entry.id;
}
export function createStoryEditorListColumn(ctx: UIContext, state: StoryEditorState): WorkspaceColumnSpec {
  const requestedInit = state.storyInitFilter ?? '';
  const initFilter = requestedInit === 'other' || ctx.game.registry.inits.has(requestedInit) ? requestedInit : '';
  const list = storyList(state, ctx.game.registry.stories)
    .filter(item => !initFilter || (initFilter === 'other' ? !item.initId : item.initId === initFilter));
  const draft = currentDraft(state);
  const entrySearch = state.entrySearch.trim().toLocaleLowerCase();
  const entries = [...storyEntries(state, ctx.game.registry.storyEntries).values()]
    .filter(entry => !entrySearch || `${entryName(ctx, state, entry)}\n${entry.id}`.toLocaleLowerCase().includes(entrySearch));
  const senders = storySenders(ctx);
  const senderSearch = state.senderSearch.trim().toLocaleLowerCase();
  const visibleSenders = senders.filter(sender => !senderSearch || `${sender.label}\n${sender.id}`.toLocaleLowerCase().includes(senderSearch));
  const selectedSender = composer(state).sender;
  const switchTabs = renderTabs(ctx, 'left', [
    { id: 'stories', label: 'Story', action: 'story-editor-sidebar:stories' },
    { id: 'entries', label: 'Entry', action: 'story-editor-sidebar:entries' },
    { id: 'senders', label: '发出方', action: 'story-editor-sidebar:senders' },
  ], state.sidebarMode);
  return { ...baseColumn(ctx, state, 'story-editor-list', 'left', 'Story'), content: `<div class="story-editor-list-content">
    <section class="story-editor-sidebar-pane story-editor-list-content" data-editor-key="sidebar-stories" role="tabpanel"${state.sidebarMode === 'stories' ? '' : ' hidden'}>
      <label class="story-editor-search">搜索 Story<input type="search" data-editor-key="search" data-editor-search value="${ctx.escapeHtml(state.search)}" placeholder="名称或 ID"></label>
      <label class="story-editor-search">按世界线筛选<select data-editor-key="story-init-filter" data-editor-story-init-filter>
        <option value=""${initFilter ? '' : ' selected'}>全部</option><option value="other"${initFilter === 'other' ? ' selected' : ''}>其他</option>
        ${[...ctx.game.registry.inits.values()].map(init => `<option value="${ctx.escapeHtml(init.id)}"${init.id === initFilter ? ' selected' : ''}>${ctx.escapeHtml(init.name || init.id)}</option>`).join('')}
      </select></label>
      <div class="story-editor-actions">${button('new', '新建', state.storageBlocked)}${button('rename', '重命名', !draft || state.storageBlocked)}${button('delete-draft', '删除草稿', state.storageBlocked || !draft || !draft.persisted && !draft.dirty, true)}</div>
      <div class="story-editor-list" data-scroll-owner="content-region" data-scroll-key="stories" data-editor-key="story-list">${list.map(item => `<button type="button" class="story-editor-list-item${item.storyId === draft?.document.id ? ' is-selected' : ''}" data-editor-key="story:${ctx.escapeHtml(item.key)}" data-editor-story="${ctx.escapeHtml(item.key)}" aria-pressed="${item.storyId === draft?.document.id}"><strong>${ctx.escapeHtml(item.name || '未命名 Story')}</strong><small>${ctx.escapeHtml(item.storyId)}</small><small>${ctx.escapeHtml(item.initId ? ctx.game.registry.inits.get(item.initId)?.name || item.initId : '其他')}</small>${item.draft && (item.draft.dirty || item.draft.persisted) ? '<span class="story-editor-draft-label">草稿</span>' : ''}</button>`).join('') || empty('没有匹配的 Story。')}</div>
    </section>
    <section class="story-editor-sidebar-pane story-editor-list-content" data-editor-key="sidebar-entries" role="tabpanel"${state.sidebarMode === 'entries' ? '' : ' hidden'}>
      <label class="story-editor-search">搜索 Entry<input type="search" data-editor-key="entry-search" data-editor-entry-search value="${ctx.escapeHtml(state.entrySearch)}" placeholder="名称或 ID"></label>
      <div class="story-editor-list" data-scroll-owner="content-region" data-scroll-key="entries" data-editor-key="entry-list">${entries.map(entry => {
        const selected = state.target?.kind === 'entry' && state.target.id === entry.id;
        return `<button type="button" class="story-editor-list-item${selected ? ' is-selected' : ''}" data-editor-key="entry:${ctx.escapeHtml(entry.id)}" data-editor-entry="${ctx.escapeHtml(entry.id)}" aria-pressed="${selected}"><strong>${ctx.escapeHtml(entryName(ctx, state, entry))}</strong><small>${ctx.escapeHtml(entry.id)}</small><span class="story-editor-draft-label">${entry.activation.kind === 'active' ? '主动接取' : entry.activation.kind === 'random' ? '随机抽取' : '好感／角色阶段'}</span></button>`;
      }).join('') || empty('没有匹配的 Entry。')}</div>
    </section>
    <section class="story-editor-sidebar-pane story-editor-senders-content" data-editor-key="sidebar-senders" role="tabpanel"${state.sidebarMode === 'senders' ? '' : ' hidden'}>
      <label class="story-editor-search">搜索发出方<input type="search" data-editor-key="sender-search" data-editor-sender-search value="${ctx.escapeHtml(state.senderSearch)}" placeholder="名称或 ID"></label>
      ${draft ? '' : empty('先选择或新建一个 Story。')}
      <div class="story-editor-sender-list" data-scroll-owner="content-region" data-scroll-key="senders" data-editor-key="sender-list">${visibleSenders.map(sender => `<button type="button" class="story-editor-list-item story-editor-sender-item${sender.id === selectedSender ? ' is-selected' : ''}" data-editor-key="sender:${ctx.escapeHtml(sender.id)}" data-editor-sender="${ctx.escapeHtml(sender.id)}" aria-pressed="${sender.id === selectedSender}"${!draft || state.storageBlocked ? ' disabled' : ''}>${senderAvatar(ctx, sender)}<strong>${ctx.escapeHtml(sender.label)}</strong></button>`).join('') || empty('没有匹配的发出方。')}</div>
    </section>
  </div>`, header: renderWorkspaceTitlebar(ctx, 'left', 'Story 编辑器', 'data-column-back', switchTabs) };
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
  const positionDisabled = state.storageBlocked ? ' disabled' : '';
  const positionTools = positioned && node && draft && state.performanceEditing?.[draft.draftId]?.includes(node.id)
    ? `<div class="story-editor-position-tools" data-editor-key="position-tools" role="group" aria-label="演出定位">
    <div role="group" aria-label="纵向基准">${[['top','上'],['center','中'],['bottom','下']].map(([value,label]) => `<button type="button" class="mini-action" data-story-position-y="${value}" aria-pressed="${positioned.anchor?.y === value}"${positionDisabled}>${label}</button>`).join('')}</div>
    <div role="group" aria-label="横向基准">${[['left','左'],['center','中'],['right','右']].map(([value,label]) => `<button type="button" class="mini-action" data-story-position-x="${value}" aria-pressed="${positioned.anchor?.x === value}"${positionDisabled}>${label}</button>`).join('')}</div>
    <div role="group" aria-label="坐标单位">${[['px','px'],['percent','%']].map(([value,label]) => `<button type="button" class="mini-action" data-story-position-unit="${value}" aria-pressed="${(positioned.unit ?? 'percent') === value}"${positionDisabled}>${label}</button>`).join('')}</div>
  </div>` : '';
  const input = composer(state);
  const senders = storySenders(ctx);
  const selectedSender = senders.find(sender => sender.id === input.sender) ?? senders[0];
  const editable = Boolean(draft) && !state.storageBlocked;
  const canSend = editable && Boolean(input.text.trim());
  const nodes = draft?.document.nodes ?? [];
  const flow = !draft ? empty('从左栏选择或新建 Story。') : nodes.length
    ? `${renderInsertionPoint(ctx, state, nodes[0].id)}${nodes.map((node, index) => `${renderEditorNode(ctx, state, node)}${renderInsertionPoint(ctx, state, nodes[index + 1]?.id ?? null)}`).join('')}`
    : `<p class="story-editor-empty">从下方发送第一条正文，或添加一个节点。</p>${renderInsertionPoint(ctx, state, null)}`;
  return { ...baseColumn(ctx, state, 'story-editor-flow', 'center', draft?.document.name || '编辑'),
    header: editorHistoryHeader(ctx, state, draft?.document.name || '编辑'),
    bodyOverlay: renderStoryPerformanceEditing(ctx,state) + positionTools,
    content: `<div class="story-editor-flow" data-editor-key="flow">${draft ? renderStoryEditorScene(ctx, draft.document.startContext, true) : ''}${flow}</div>`,
  footer: `<div class="story-editor-composer" data-editor-key="composer"><div class="story-editor-actions story-editor-actions--tools" role="group" aria-label="正文操作">${button('info', '正文信息', !draft)}<button type="button" class="mini-action" data-authoring-action="preview" data-editor-key="quick-preview"${draft ? '' : ' disabled'}>试播</button>${button('save', '保存草稿', !editable)}${button('save-to-runtime', '保存到运行内容', !editable)}${button('restore-source', '还原来源版本', !editable, true)}<span data-editor-status>${draft?.dirty ? '未保存' : draft?.persisted ? '已保存' : draft ? '已注册' : ''}</span></div>
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
      <div class="story-editor-actions story-editor-actions--tools" role="group" aria-label="添加节点">${button('click', '添加交互', !editable)}${button('operation', '添加动作', !editable)}${button('transfer', '添加剧情转移', !editable)}${button('moveToArea', '添加区域移动', !editable)}${button('moveToCharaspace', '添加角色空间移动', !editable)}</div></div>` };
}
export function createStoryEditorInspectorColumn(ctx: UIContext, state: StoryEditorState): WorkspaceColumnSpec {
  return { ...baseColumn(ctx, state, 'story-editor-inspector', 'right', '属性'),
    header: renderWorkspaceTitlebar(ctx, 'right', '属性', state.inspectorView !== 'story' && currentNode(state) ? 'data-column-back' : undefined),
    content: `<div data-editor-key="inspector">${inspector(ctx, state)}</div>` };
}
export function createStoryEditorFrame(ctx: UIContext, state: StoryEditorState): WorkspaceFrameSpec {
  if (state.preview) return createStoryPreviewFrame(ctx, state);
  const columns = [createStoryEditorListColumn(ctx, state)];
  if(state.target?.kind!=='entry')state.entryPoolContext=undefined;
  if (state.target?.kind === 'entry') {
    const entry = storyEntries(state, ctx.game.registry.storyEntries).get(state.target.id);
    const name = entry ? entryName(ctx, state, entry) : state.target.id;
    const tabs = entry ? renderTabs(ctx, 'center', [
      { id: 'basic', label: '基本信息', action: 'story-editor-entry-tab:basic' },
      { id: 'rewards', label: '奖励信息', action: 'story-editor-entry-tab:rewards' },
      { id: 'gates', label: '详细门控', action: 'story-editor-entry-tab:gates' },
    ], state.entryEditorTab ?? 'basic', 'Entry 编辑页') : '';
    const center = baseColumn(ctx, state, 'story-editor-flow', 'center', name);
    columns.push({ ...center, className: `${center.className} story-editor-entry-column`,
      header: editorHistoryHeader(ctx, state, name) + (tabs ? `<div class="story-editor-entry-tabs" data-editor-key="entry-tabs">${tabs}</div>` : ''),
      bodyOverlay: '',
      content: `<div data-editor-key="entry-page" data-editor-entry-page="${ctx.escapeHtml(state.target.id)}">${entry ? renderStoryEntryFields(ctx,state) : empty('该 Entry 已不存在。')}</div>`,
      footer: entry ? `<div class="story-editor-actions story-editor-actions--tools" role="group" aria-label="入口操作"><button type="button" class="mini-action" data-authoring-action="preview">试播</button><button type="button" class="mini-action" data-editor-action="save"${state.storageBlocked ? ' disabled' : ''}>保存草稿</button><button type="button" class="mini-action" data-authoring-action="check"${state.storageBlocked ? ' disabled' : ''}>检查内容</button><button type="button" class="mini-action" data-authoring-action="apply"${state.storageBlocked ? ' disabled' : ''}>应用正文与关联内容</button></div><p class="story-editor-hint" role="status"${state.notice ? '' : ' hidden'}>${ctx.escapeHtml(state.notice ?? '')}</p><p class="story-editor-error" role="status"${state.error ? '' : ' hidden'}>${ctx.escapeHtml(state.error ?? '')}</p>` : '' },
    { ...baseColumn(ctx, state, 'story-editor-inspector', 'right', 'Entry 属性'),
      content: `<div data-editor-key="entry-inspector" data-editor-entry-page="${ctx.escapeHtml(state.target.id)}">${renderStoryRelations(ctx,state)}${renderStoryFlagCatalog(ctx,state)}</div>` });
  } else columns.push(createStoryEditorFlowColumn(ctx, state), createStoryEditorInspectorColumn(ctx, state));
  return { id: 'story-editor', updates: 'external', columns };
}
export function renderStoryEditorWorkspace(ctx: UIContext, state: StoryEditorState): string {
  return renderWorkspaceFrame(ctx, createStoryEditorFrame(ctx, state));
}
