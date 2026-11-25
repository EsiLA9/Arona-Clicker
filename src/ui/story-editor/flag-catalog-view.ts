import type { UIContext } from '../runtime/context';
import type { StoryEditorState } from './model';
import { buildStoryRelations } from './relations-model';
import { buildStoryFlagCatalog, storyFlagNames, type StoryFlagUse } from './flag-catalog';
import { storyEditorTargetColor } from './target-view';
import { renderStoryIdentityInline, resolveStoryIdentity } from '../components/story/story-identity';

export function currentStoryFlagCatalog(ctx: UIContext, state: StoryEditorState) {
  return state.target ? buildStoryFlagCatalog(state, buildStoryRelations(state, ctx.game.registry.stories, ctx.game.registry.storyEntries), state.target) : { uses: [], boundaries: [], missing: [] };
}

export function currentRelatedFlagCatalog(ctx: UIContext, state: StoryEditorState) {
  return state.target ? buildStoryFlagCatalog(state,buildStoryRelations(state,ctx.game.registry.stories,ctx.game.registry.storyEntries),state.target,true) : {uses:[],boundaries:[],missing:[]};
}

export function renderStoryFlagCatalog(ctx: UIContext, state: StoryEditorState): string {
  if (!state.target) return '';
  const isStory = state.target.kind === 'story';
  const relations = buildStoryRelations(state, ctx.game.registry.stories, ctx.game.registry.storyEntries);
  const catalog = buildStoryFlagCatalog(state, relations, state.target, true), e = ctx.escapeHtml;
  const title = (target: NonNullable<StoryEditorState['target']>) => resolveStoryIdentity(target, relations.stories, relations.entries)?.title ?? target.id;
  const groups = new Map<string, StoryFlagUse[]>();
  for (const use of catalog.uses) {
    const key = JSON.stringify([use.scope, use.kind, use.name]);
    groups.set(key, [...(groups.get(key) ?? []), use]);
  }
  const flags = [...groups].map(([key,uses]) => {
    const first = uses[0], available = uses.some(use => use.available);
    const bindable = first.kind === 'local' && uses.some(use => use.available && (use.usage === 'write' || use.usage === 'return'));
    const hint = first.kind === 'global' ? '全局标记不能作为节点的局部执行条件。' : !available ? '其他 Entry 的私有标记，不能绑定到当前 Story。' : !bindable ? '尚无可用的提供方或回传声明。' : '将本 Story 的节点拖到此处，设置需要此局部标记。';
    const drop = isStory ? ` data-story-drop-target="story-flag-table" data-story-flag-name="${e(first.name)}" data-story-flag-scope="${e(first.scope)}" data-story-flag-kind="${first.kind}" aria-disabled="${(state.storageBlocked || Boolean(state.readOnlyReason)) || !bindable}"` : '';
    const sources = (items: StoryFlagUse[]) => items.map(use => `<button type="button" class="story-editor-flag-source" data-editor-key="${e(JSON.stringify([use.source.kind,use.source.id,use.path,use.usage]))}" data-editor-${use.source.kind === 'story' ? 'story' : 'entry'}-target="${e(use.source.id)}"${use.nodeId ? ` data-story-flag-node="${e(use.nodeId)}"` : ''} title="${e(`${use.source.id}${use.nodeId ? ` · ${use.nodeId}` : ''}\n${use.path}`)}">${renderStoryIdentityInline(ctx, use.source.kind, title(use.source), use.nodeId ?? use.source.id)}${use.usage === 'return' ? '<span class="story-editor-flag-detail">回传声明</span>' : ''}</button>`).join('');
    const group = (role: string, label: string, items: StoryFlagUse[]) => items.length ? `<section class="story-editor-flag-sources" data-editor-key="${role}" data-story-flag-role="${role}"><strong>${label}</strong>${sources(items)}</section>` : '';
    const removed = uses.filter(use => use.usage === 'remove');
    const scope = `<section class="story-editor-flag-scope" data-editor-key="scope"><strong>作用域 · ${first.kind === 'global' ? '全局' : first.scope.startsWith('entry:') ? 'Entry' : 'Story'}</strong>${first.kind === 'local' ? `<code>${e(first.scope.slice(first.scope.indexOf(':') + 1))}</code>${available ? '' : '<span class="story-editor-flag-detail">其他 Entry 内部</span>'}` : ''}</section>`;
    return `<details class="story-editor-flag-item" data-editor-key="flag:${e(key)}"${drop}><summary style="--story-editor-choice-flag-color:${storyEditorTargetColor(first.name)}" title="${e(isStory ? `${first.name}\n${hint}` : first.name)}">${first.kind === 'local' ? '局部' : '全局'} · ${e(first.name)}</summary><div class="story-editor-flag-details">${scope}${group('providers','提供方',uses.filter(use => use.usage === 'write' || use.usage === 'return'))}${group('readers','需求方',uses.filter(use => use.usage === 'read'))}${group('removers','移除操作',removed)}</div></details>`;
  }).join('');
  const boundaries = catalog.boundaries.map(boundary => `<div data-editor-key="flag-import:${e(boundary.key)}">${renderStoryIdentityInline(ctx, boundary.call.to.kind, title(boundary.call.to), boundary.call.to.id)}<span> · ${e(boundary.call.label)} · ${boundary.missing ? '目标不存在' : boundary.included === undefined ? '尚未获取' : boundary.included ? '已纳入 flag 信息' : '未纳入 flag 信息'}</span><button type="button" class="mini-action" data-story-flag-import="${e(boundary.key)}"${(state.storageBlocked || Boolean(state.readOnlyReason)) || boundary.missing ? ' disabled' : ''}>${boundary.included === undefined ? '获取 Entry flag 信息' : '更改获取选择'}</button></div>`).join('');
  return `<section class="story-editor-flag-catalog" data-editor-key="flag-catalog"><h3 title="包含潜在分支，不能保证到达节点时标记已经存在。获取信息不会更改回传白名单。">Flag 表</h3>${flags || '<p class="story-editor-empty">暂无涉及的 flag。</p>'}${boundaries}${catalog.missing.map(target => `<p class="story-editor-error">${e(target.id)}：无法获取 flag，目标不存在。</p>`).join('')}</section>`;
}

export function renderStoryFlagSuggestions(ctx: UIContext, state: StoryEditorState): string {
  const catalog = currentStoryFlagCatalog(ctx, state);
  return (['local', 'global'] as const).map(kind => `<datalist id="story-editor-${kind}-flags">${storyFlagNames(catalog, kind).map(name => `<option value="${ctx.escapeHtml(name)}"></option>`).join('')}</datalist>`).join('');
}
