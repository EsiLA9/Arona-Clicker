import type { UIContext } from '../runtime/context';
import type { StoryEditorState } from './model';
import { buildStoryRelations } from './relations-model';
import { buildStoryFlagCatalog, storyFlagNames, type StoryFlagUse } from './flag-catalog';

export function currentStoryFlagCatalog(ctx: UIContext, state: StoryEditorState) {
  return state.target ? buildStoryFlagCatalog(state, buildStoryRelations(state, ctx.game.registry.stories, ctx.game.registry.storyEntries), state.target) : { uses: [], boundaries: [], missing: [] };
}

export function currentRelatedFlagCatalog(ctx: UIContext, state: StoryEditorState) {
  return state.target ? buildStoryFlagCatalog(state,buildStoryRelations(state,ctx.game.registry.stories,ctx.game.registry.storyEntries),state.target,true) : {uses:[],boundaries:[],missing:[]};
}

export function renderStoryFlagCatalog(ctx: UIContext, state: StoryEditorState): string {
  if (!state.target) return '';
  const catalog = currentRelatedFlagCatalog(ctx, state), e = ctx.escapeHtml;
  const groups = new Map<string, StoryFlagUse[]>();
  for (const use of catalog.uses) {
    const key = JSON.stringify([use.scope, use.kind, use.name]);
    groups.set(key, [...(groups.get(key) ?? []), use]);
  }
  const labels = { read: '读取', write: '写入', remove: '移除', return: '回传声明' };
  const flags = [...groups].map(([key,uses]) => {
    const first = uses[0], available = uses.some(use => use.available);
    const bindable = first.kind === 'local' && uses.some(use => use.available && (use.usage === 'write' || use.usage === 'return'));
    const hint = first.kind === 'global' ? '全局标记不能作为节点的局部执行条件。' : !available ? '其他 Entry 的私有标记，不能绑定到当前 Story。' : !bindable ? '尚无可用的提供方或回传声明。' : '将本 Story 的节点拖到此处，设置需要此局部标记。';
    const drop = state.target?.kind === 'story' ? ` data-story-drop-target="story-flag-table" data-story-flag-name="${e(first.name)}" data-story-flag-scope="${e(first.scope)}" data-story-flag-kind="${first.kind}" aria-disabled="${state.storageBlocked || !bindable}"` : '';
    return `<section class="story-editor-flag-item" data-editor-key="flag:${e(key)}"${drop}><strong>${first.kind === 'local' ? '局部' : '全局'} · ${e(first.name)}</strong>${first.kind === 'local' ? `<small>作用域：${e(first.scope)}${available ? '' : ' · 其他 Entry 内部'}</small>` : ''}${state.target?.kind === 'story' ? `<small class="story-editor-hint">${hint}</small>` : ''}${uses.map(use => `<button type="button" class="mini-action" data-editor-${use.source.kind === 'story' ? 'story' : 'entry'}-target="${e(use.source.id)}"${use.nodeId ? ` data-story-flag-node="${e(use.nodeId)}"` : ''} title="${e(use.path)}">${labels[use.usage]} · ${e(use.source.id)}${use.nodeId ? ` / ${e(use.nodeId)}` : ''}</button>`).join('')}</section>`;
  }).join('');
  const boundaries = catalog.boundaries.map(boundary => `<div data-editor-key="flag-import:${e(boundary.key)}"><span>${e(boundary.call.to.id)} · ${e(boundary.call.label)} · ${boundary.missing ? '目标不存在' : boundary.included === undefined ? '尚未获取' : boundary.included ? '已纳入 flag 信息' : '未纳入 flag 信息'}</span><button type="button" class="mini-action" data-story-flag-import="${e(boundary.key)}"${state.storageBlocked || boundary.missing ? ' disabled' : ''}>${boundary.included === undefined ? '获取 Entry flag 信息' : '更改获取选择'}</button></div>`).join('');
  return `<section class="story-editor-flag-catalog" data-editor-key="flag-catalog"><h3>Flag 表</h3><p class="story-editor-hint">包含潜在分支，不能保证到达节点时标记已经存在。获取信息不会更改回传白名单。</p>${flags || '<p class="story-editor-empty">暂无涉及的 flag。</p>'}${boundaries}${catalog.missing.map(target => `<p class="story-editor-error">${e(target.id)}：无法获取 flag，目标不存在。</p>`).join('')}</section>`;
}

export function renderStoryFlagSuggestions(ctx: UIContext, state: StoryEditorState): string {
  const catalog = currentStoryFlagCatalog(ctx, state);
  return (['local', 'global'] as const).map(kind => `<datalist id="story-editor-${kind}-flags">${storyFlagNames(catalog, kind).map(name => `<option value="${ctx.escapeHtml(name)}"></option>`).join('')}</datalist>`).join('');
}
