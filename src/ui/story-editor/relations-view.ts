import type { UIContext } from '../runtime/context';
import type { StoryEditorState, StoryEditorTarget } from './model';
import { buildStoryRelations, potentialStoryCalls, type StoryCall } from './relations-model';

export function renderStoryRelations(ctx: UIContext, state: StoryEditorState): string {
  const target = state.target;
  if (!target) return '';
  const e = ctx.escapeHtml;
  const relations = buildStoryRelations(state, ctx.game.registry.stories, ctx.game.registry.storyEntries);
  const same = (other: StoryEditorTarget) => other.kind === target.kind && other.id === target.id;
  const name = (ref: StoryEditorTarget): string => ref.kind === 'story' ? relations.stories.get(ref.id)?.name || ref.id
    : relations.entries.get(ref.id)?.openingTitle || relations.stories.get(relations.entries.get(ref.id)?.storyId ?? '')?.name || ref.id;
  const list = (rows: readonly StoryCall[], incoming = false): string => `<div class="story-editor-list">${rows.map(call => {
    const ref = incoming ? call.from : call.to;
    const available = ref.kind === 'story' ? relations.stories.has(ref.id) : relations.entries.has(ref.id);
    const via = !incoming && !same(call.from) ? `来自 ${name(call.from)} · ` : '';
    return `<button type="button" class="story-editor-list-item" data-editor-key="relation:${e(JSON.stringify([call.from,call.to,call.path]))}" data-editor-${ref.kind === 'story' ? 'story' : 'entry'}-target="${e(ref.id)}" title="${e(call.path)}"${available ? '' : ' disabled'}><strong>${ref.kind === 'story' ? 'Story' : 'Entry'} · ${e(name(ref))}</strong><small>${e(ref.id)}${available ? '' : '（目标不存在）'}</small><small>${e(via + call.label)}</small></button>`;
  }).join('') || '<p class="story-editor-empty">暂无调用关系。</p>'}</div>`;
  const outgoing = target.kind === 'entry' ? potentialStoryCalls(relations, target) : relations.calls.filter(call => same(call.from));
  return `<section class="story-editor-relations" data-editor-key="relations:${e(target.kind)}:${e(target.id)}"><h3>${target.kind === 'entry' ? '潜在调用集' : '调用表'}</h3>${target.kind === 'entry' ? '<p class="story-editor-hint">包含起始 Story 与各分支可能到达的 Story / Entry，不表示实际执行顺序。</p>' : ''}${list(outgoing)}<h3>被调用表</h3>${list(relations.calls.filter(call => same(call.to)), true)}</section>`;
}
