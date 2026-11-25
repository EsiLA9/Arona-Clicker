import type { UIContext } from '../runtime/context';
import type { StoryEditorState } from './model';
import { buildStoryRelations } from './relations-model';
import { buildStoryFlagCatalog, storyFlagNames, type StoryFlagUse } from './flag-catalog';
import { renderStoryEditorTarget, storyEditorTargetColor } from './target-view';
import { renderStoryIdentityInline, resolveStoryIdentity } from '../components/story/story-identity';

export function currentStoryFlagCatalog(ctx: UIContext, state: StoryEditorState) {
  return state.target ? buildStoryFlagCatalog(state, buildStoryRelations(state, ctx.game.registry.stories, ctx.game.registry.storyEntries), state.target) : { uses: [], boundaries: [], missing: [] };
}

export function currentRelatedFlagCatalog(ctx: UIContext, state: StoryEditorState) {
  return state.target ? buildStoryFlagCatalog(state,buildStoryRelations(state,ctx.game.registry.stories,ctx.game.registry.storyEntries),state.target,true) : {uses:[],boundaries:[],missing:[]};
}

function flagRole(uses: readonly StoryFlagUse[]): string {
  const provides = uses.some(use => use.usage === 'write' || use.usage === 'return');
  const depends = uses.some(use => use.usage === 'read');
  return provides && depends ? '双向' : provides ? '提供' : depends ? '依赖' : '';
}

export function renderStoryFlagCatalog(ctx: UIContext, state: StoryEditorState): string {
  if (!state.target) return '';
  const isStory = state.target.kind === 'story';
  const target = state.target;
  const relations = buildStoryRelations(state, ctx.game.registry.stories, ctx.game.registry.storyEntries);
  const catalog = buildStoryFlagCatalog(state, relations, state.target, true), e = ctx.escapeHtml;
  const title = (target: NonNullable<StoryEditorState['target']>) => resolveStoryIdentity(target, relations.stories, relations.entries)?.title ?? target.id;
  const groups = new Map<string, StoryFlagUse[]>();
  const own = (use: StoryFlagUse) => use.source.kind === target.kind && use.source.id === target.id;
  const editable = isStory && !state.storageBlocked && !state.readOnlyReason;
  for (const use of catalog.uses) {
    if (isStory && use.source.kind === 'entry') continue;
    const key = JSON.stringify([use.scope, use.kind, use.name]);
    const group = groups.get(key);
    if (group) group.push(use);
    else groups.set(key, [use]);
  }
  const flags = [...groups].sort(([, a], [, b]) => Number(b.some(own)) - Number(a.some(own))).map(([key,uses]) => {
    const first = uses[0], available = uses.some(use => use.available);
    const bindable = first.kind === 'local' && uses.some(use => use.available && (use.usage === 'write' || use.usage === 'return'));
    const hint = first.kind === 'global' ? '全局标记不能作为节点的局部执行条件。' : !available ? '其他 Entry 内部的局部标记，不能绑定到当前 Story。' : !bindable ? '尚无可用的提供方或回传声明。' : '将本 Story 的节点拖到此处，设置需要此局部标记。';
    const internal = uses.filter(own);
    const roles = [['本篇', flagRole(internal)], ['其他', flagRole(uses.filter(use => !own(use)))]]
      .filter(([, role]) => role).map(([source, role]) => `<span>${source} <b>${role}</b></span>`).join('');
    const sources = new Map<string, StoryFlagUse[]>();
    for (const use of uses) {
      const sourceKey = JSON.stringify([use.source.kind, use.source.id]);
      const group = sources.get(sourceKey);
      if (group) group.push(use);
      else sources.set(sourceKey, [use]);
    }
    const cards = [...sources].sort(([, a], [, b]) => Number(own(b[0])) - Number(own(a[0]))).map(([sourceKey, refs]) => {
      const source = refs[0].source;
      const identity = resolveStoryIdentity(source, relations.stories, relations.entries);
      const node = refs.find(ref => ref.nodeId)?.nodeId;
      const detail = flagRole(refs) || '清除';
      return `<div data-editor-key="${e(sourceKey)}"${node ? ` data-story-flag-node="${e(node)}"` : ''}>${renderStoryEditorTarget(ctx, source.kind, source.id, identity?.title ?? source.id, Boolean(identity), {
        gradient: identity?.gradient,
        relation: { key: sourceKey, detail, showType: false },
      })}</div>`;
    }).join('');
    const scopeTitle = first.kind === 'global' ? '全局标记' : `局部标记 · ${first.scope.slice(first.scope.indexOf(':') + 1)}`;
    const canRename = editable && internal.length > 0;
    return `<div class="story-editor-flag-row${canRename ? ' has-rename' : ''}" style="--story-editor-choice-flag-color:${storyEditorTargetColor(first.name)}" data-editor-key="flag:${e(JSON.stringify([target.kind, target.id, key]))}">
      <details class="story-editor-flag-item" data-editor-key="details" data-story-flag-name="${e(first.name)}" data-story-flag-scope="${e(first.scope)}" data-story-flag-kind="${first.kind}"${isStory ? ` data-story-drop-target="story-flag-table" data-story-flag-bindable="${editable && bindable}"` : ''}>
        <summary title="${e([first.name, scopeTitle, isStory ? hint : ''].filter(Boolean).join('\n'))}">
          <code>${e(first.name)}</code><span class="story-editor-flag-roles">${roles}</span><span class="story-editor-flag-arrow" aria-hidden="true"></span>
        </summary>
        <div class="story-editor-flag-details">${cards}</div>
      </details>
      ${canRename ? '<div class="story-editor-flag-rename-slot" data-editor-key="rename" data-story-flag-rename-slot><button type="button" class="story-editor-flag-rename" data-story-flag-rename>重命名</button></div>' : ''}
    </div>`;
  }).join('');
  const boundaries = catalog.boundaries.map(boundary => `<div data-editor-key="flag-import:${e(boundary.key)}">${renderStoryIdentityInline(ctx, boundary.call.to.kind, title(boundary.call.to), boundary.call.to.id)}<span> · ${e(boundary.call.label)} · ${boundary.missing ? '目标不存在' : boundary.included === undefined ? '尚未获取' : boundary.included ? '已纳入 flag 信息' : '未纳入 flag 信息'}</span><button type="button" class="mini-action" data-story-flag-import="${e(boundary.key)}"${(state.storageBlocked || Boolean(state.readOnlyReason)) || boundary.missing ? ' disabled' : ''}>${boundary.included === undefined ? '获取 Entry flag 信息' : '更改获取选择'}</button></div>`).join('');
  return `<section class="story-editor-flag-catalog" data-editor-key="flag-catalog"><h3 title="包含潜在分支，不能保证到达节点时标记已经存在。获取信息不会更改回传白名单。">Flag 表</h3>${flags || '<p class="story-editor-empty">暂无涉及的 flag。</p>'}${boundaries}${catalog.missing.map(target => `<p class="story-editor-error">${e(target.id)}：无法获取 flag，目标不存在。</p>`).join('')}</section>`;
}

export function renderStoryFlagSuggestions(ctx: UIContext, state: StoryEditorState): string {
  const catalog = currentStoryFlagCatalog(ctx, state);
  return (['local', 'global'] as const).map(kind => `<datalist id="story-editor-${kind}-flags">${storyFlagNames(catalog, kind).map(name => `<option value="${ctx.escapeHtml(name)}"></option>`).join('')}</datalist>`).join('');
}
