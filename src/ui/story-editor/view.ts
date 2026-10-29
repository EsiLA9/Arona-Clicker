import type { UIContext } from '../runtime/context';
import { renderChatEntry } from '../components/story/story';
import { renderWorkspaceFrame, type WorkspaceColumnSpec, type WorkspaceFrameSpec } from '../components/shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../components/shared/workspace-titlebar';
import { composer, currentDraft, currentNode, senderChangeAllowed, senderForNode, storyList, type StoryDraftNode, type StoryEditorState, type StorySender } from './model';
import { localFlagInput } from './flag-fields';
import { renderStoryNodeProperties } from './property-fields';

export function storySenders(ctx: UIContext): StorySender[] {
  return [{ id: 'narrator', label: '旁白' }, { id: 'teacher', label: '老师', speaker: '老师' },
    ...[...ctx.game.registry.characters.values()].map(character => ({ id: `character:${character.id}`, label: character.displayName, speaker: character.displayName }))];
}
const button = (action: string, text: string, disabled = false, danger = false): string =>
  `<button type="button" class="mini-action${danger ? ' mini-action--danger' : ''}" data-editor-action="${action}"${disabled ? ' disabled' : ''}>${text}</button>`;
const empty = (text: string): string => `<p class="story-editor-empty" data-editor-key="empty">${text}</p>`;
function senderOptions(ctx: UIContext, state: StoryEditorState, inspector = false): string {
  const senders = storySenders(ctx);
  const node = currentNode(state);
  const talklet = inspector && node?.type === 'talklet' ? node : null;
  const value = talklet ? senderForNode(talklet, senders) : composer(state).sender;
  const original = value === 'original' && talklet
    ? `<option value="original" data-editor-key="original" selected>${ctx.escapeHtml(talklet.content.kind === 'talk' ? talklet.content.speaker ?? '未命名发出方' : '旁白')}（原值）</option>` : '';
  return original + senders.map(sender => `<option data-editor-key="${ctx.escapeHtml(sender.id)}" value="${ctx.escapeHtml(sender.id)}"${sender.id === value ? ' selected' : ''}${talklet && !senderChangeAllowed(talklet, sender) ? ' disabled' : ''}>${ctx.escapeHtml(sender.label)}</option>`).join('');
}
export function renderEditorNode(ctx: UIContext, state: StoryEditorState, node: StoryDraftNode): string {
  const draft = currentDraft(state)!;
  let body: string;
  if (node.type === 'talklet') {
    // Drafts may hold an incomplete payload; the preview must still render without inventing data.
    body = renderChatEntry(ctx, { kind: node.content.kind, text: node.content.text ?? '',
      ...(node.content.kind === 'talk' ? { speaker: node.content.speaker, image: node.content.image } : {}),
      side: node.presentation?.side, align: node.presentation?.align, avatar: node.presentation?.avatar,
      noAvatar: node.presentation?.avatarMode === 'hide', showAvatar: node.presentation?.avatarMode === 'show',
    }, { instanceKey: `${draft.draftId}/${node.id}` });
  } else if (node.type === 'click') {
    const interaction = node.interaction;
    const label = interaction.kind === 'button' ? interaction.text || '待填写按钮文案'
      : interaction.kind === 'choice' ? `选项 · ${(interaction.options ?? []).map(option => option.text ?? '').join(' / ') || '待添加'}` : interaction.card?.title || '剧情入口卡';
    body = `<div class="story-editor-action-node"><span>Click</span><strong>${ctx.escapeHtml(label)}</strong></div>`;
  } else {
    const configured = node.type === 'operation' ? Boolean(node.action) : Boolean(node.transfer);
    const action = node.type === 'operation' ? node.action : undefined;
    const label = action?.kind === 'localFlag' ? `${action.op === 'set' ? '写入' : '移除'}局部标记 · ${action.name || '待填写名称'}` : configured ? '已配置 · 暂未提供编辑' : '未配置';
    body = `<div class="story-editor-action-node"><span>${node.type === 'operation' ? 'Operation' : 'Transfer'}</span><strong>${ctx.escapeHtml(label)}</strong></div>`;
  }
  return `<div class="story-editor-node${state.selectedNodeId === node.id ? ' is-selected' : ''}" data-editor-key="node:${ctx.escapeHtml(node.id)}" data-editor-node="${ctx.escapeHtml(node.id)}" role="button" aria-label="选择节点" aria-pressed="${state.selectedNodeId === node.id}">${body}</div>`;
}
function flagOperationFields(ctx: UIContext, state: StoryEditorState, node: StoryDraftNode): string {
  if (node.type !== 'operation' || node.action && node.action.kind !== 'localFlag') return '';
  const action = node.action;
  const e = ctx.escapeHtml;
  const disabled = state.storageBlocked ? ' disabled' : '';
  const readOnly = state.storageBlocked ? ' readonly' : '';
  const input = localFlagInput(node, currentDraft(state)?.localFlagInputs);
  const type = input?.type ?? 'structured';
  return `<div data-editor-key="local-flag-fields">
    <label>局部标记操作<select data-editor-key="local-flag-op" data-editor-field="local-flag-op"${disabled}>
      ${action ? '' : '<option value="" selected>选择操作</option>'}<option value="set"${action?.op === 'set' ? ' selected' : ''}>写入 / 覆盖</option><option value="remove"${action?.op === 'remove' ? ' selected' : ''}>移除</option></select></label>
    ${action ? `<label>标记名称<input data-editor-key="local-flag-name" data-editor-field="local-flag-name" value="${e(action.name ?? '')}" placeholder="StoryName-flagid"${readOnly}></label>` : ''}
    ${action?.op === 'set' ? `<label>值类型<select data-editor-key="local-flag-type" data-editor-field="local-flag-type"${disabled}>${type === 'structured' ? '<option value="structured" selected disabled>复合值（保留原值）</option>' : ''}${[['string', '文字'], ['number', '数字'], ['boolean', '布尔'], ['null', '空值']].map(([value, label]) => `<option value="${value}"${type === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      ${type === 'structured' ? '<p class="story-editor-hint">已有复合值会保留；改选其他类型将替换该值。</p>' : type === 'null' ? '<p class="story-editor-hint">空值仍代表键存在。</p>' : type === 'boolean'
        ? `<label>值<select data-editor-key="local-flag-value-boolean" data-editor-field="local-flag-value"${disabled}><option value="false"${input?.text === 'false' ? ' selected' : ''}>false</option><option value="true"${input?.text === 'true' ? ' selected' : ''}>true</option></select></label>`
        : `<label>值<input data-editor-key="local-flag-value" data-editor-field="local-flag-value" value="${e(input?.text ?? '')}"${type === 'number' ? ' inputmode="decimal"' : ''}${readOnly}></label>`}` : ''}
    <p class="story-editor-hint">仅本次 Entry 有效；条件只检查键是否存在，不比较值。</p></div>`;
}
function inspector(ctx: UIContext, state: StoryEditorState): string {
  const draft = currentDraft(state);
  if (!draft) return empty('新建或选择一个 Story 开始编辑。');
  const node = currentNode(state);
  const e = ctx.escapeHtml;
  const readOnly = state.storageBlocked ? ' readonly' : '';
  if (!node) return `<div class="story-editor-fields" data-editor-key="document:${e(draft.draftId)}">
    <label>名称<input data-editor-key="name" data-editor-field="name" value="${e(draft.document.name)}"${readOnly}></label>
    <label>Story ID<code>${e(draft.document.id)}</code></label>
    <label>来源<span>${e(draft.sourceId ?? '本地新建')}</span></label>
    <p class="story-editor-hint">草稿保存在本机；保存到运行内容会立即生效，仅当前运行有效。</p></div>`;
  const index = draft.document.nodes.findIndex(item => item.id === node.id);
  const properties = renderStoryNodeProperties(ctx, state, draft, node, index);
  return `<div data-editor-key="inspector:${e(node.id)}">${flagOperationFields(ctx, state, node)}${properties}</div>`;
}
function baseColumn(ctx: UIContext, state: StoryEditorState, key: string, panel: 'left' | 'center' | 'right', title: string): WorkspaceColumnSpec {
  return { key, definitionId: key, bindingKey: currentDraft(state)?.draftId ?? '', slot: panel,
    width: `var(--workspace-${panel}-width)`, workspaceOwner: 'story-editor', hostId: `${panel}Panel.${key}`,
    themeScope: `${panel}.story-editor`, surface: 'panel', scroll: panel === 'left' ? 'content' : 'auto', className: `story-editor-column story-editor-${panel}`,
    header: renderWorkspaceTitlebar(ctx, panel, title, panel === 'left' ? 'data-column-back' : undefined), content: '' };
}
export function createStoryEditorListColumn(ctx: UIContext, state: StoryEditorState): WorkspaceColumnSpec {
  const list = storyList(state, ctx.game.registry.stories);
  const draft = currentDraft(state);
  return { ...baseColumn(ctx, state, 'story-editor-list', 'left', 'Story'), content: `<div class="story-editor-list-content">
    <label class="story-editor-search">搜索 Story<input type="search" data-editor-key="search" data-editor-search value="${ctx.escapeHtml(state.search)}" placeholder="名称或 ID"></label>
    <div class="story-editor-actions">${button('new', '新建', state.storageBlocked)}${button('rename', '重命名', !draft || state.storageBlocked)}${button('delete-draft', '删除草稿', state.storageBlocked || !draft || !draft.persisted && !draft.dirty, true)}</div>
    <div class="story-editor-list" data-scroll-owner="content-region" data-scroll-key="stories" data-editor-key="list">${list.map(item => `<button type="button" class="story-editor-list-item${item.key === state.currentId ? ' is-selected' : ''}" data-editor-key="story:${ctx.escapeHtml(item.key)}" data-editor-story="${ctx.escapeHtml(item.key)}" aria-pressed="${item.key === state.currentId}"><strong>${ctx.escapeHtml(item.name || '未命名 Story')}</strong><small>${ctx.escapeHtml(item.storyId)}</small>${item.draft && (item.draft.dirty || item.draft.persisted) ? '<span class="story-editor-draft-label">草稿</span>' : ''}</button>`).join('') || empty('没有匹配的 Story。')}</div></div>` };
}
export function createStoryEditorFlowColumn(ctx: UIContext, state: StoryEditorState): WorkspaceColumnSpec {
  const draft = currentDraft(state);
  const input = composer(state);
  const editable = Boolean(draft) && !state.storageBlocked;
  return { ...baseColumn(ctx, state, 'story-editor-flow', 'center', draft?.document.name || '编辑'),
    content: `<div class="story-editor-flow" data-editor-key="flow">${draft?.document.nodes.map(node => renderEditorNode(ctx, state, node)).join('') || empty(draft ? '从下方发送第一条正文，或添加一个节点。' : '从左栏选择或新建 Story。')}</div>`,
    footer: `<div class="story-editor-composer" data-editor-key="composer"><div class="story-editor-actions">${button('info', 'Story 信息', !draft)}${button('save', '保存草稿', !editable)}${button('save-to-runtime', '保存到运行内容', !editable)}<span data-editor-status>${draft?.dirty ? '未保存' : draft?.persisted ? '已保存' : draft ? '已注册' : ''}</span></div>
      <p class="story-editor-hint" data-editor-key="save-notice" role="status"${state.notice ? '' : ' hidden'}>${ctx.escapeHtml(state.notice ?? '')}</p>
      <p class="story-editor-error" role="status"${state.error ? '' : ' hidden'}>${ctx.escapeHtml(state.error ?? '')}</p>
      <label>发出方<select data-editor-key="composer-sender" data-editor-composer-sender${editable ? '' : ' disabled'}>${senderOptions(ctx, state)}</select></label>
      <div class="story-editor-send"><textarea data-editor-key="composer-text" data-editor-composer-text rows="3" placeholder="输入正文…"${editable ? '' : ' disabled'}>${ctx.escapeHtml(input.text)}</textarea>${button('send', '确认发送', !editable || !input.text.trim())}</div>
      <div class="story-editor-actions">${button('click', '＋ Click', !editable)}${button('operation', '＋ Operation', !editable)}${button('transfer', '＋ Transfer', !editable)}</div></div>` };
}
export function createStoryEditorInspectorColumn(ctx: UIContext, state: StoryEditorState): WorkspaceColumnSpec {
  return { ...baseColumn(ctx, state, 'story-editor-inspector', 'right', '属性'), content: `<div data-editor-key="inspector">${inspector(ctx, state)}</div>` };
}
export function createStoryEditorFrame(ctx: UIContext, state: StoryEditorState): WorkspaceFrameSpec {
  return { id: 'story-editor', updates: 'external', columns: [createStoryEditorListColumn(ctx, state), createStoryEditorFlowColumn(ctx, state), createStoryEditorInspectorColumn(ctx, state)] };
}
export function renderStoryEditorWorkspace(ctx: UIContext, state: StoryEditorState): string {
  return renderWorkspaceFrame(ctx, createStoryEditorFrame(ctx, state));
}
