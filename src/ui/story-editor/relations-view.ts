import type { UIContext } from '../runtime/context';
import type { StoryEditorState, StoryEditorTarget } from './model';
import { buildStoryRelations, potentialStoryCalls, storyTransferContext, type StoryCall } from './relations-model';

export function renderStoryRelations(ctx: UIContext, state: StoryEditorState): string {
  const target = state.target;
  if (!target) return '';
  const e = ctx.escapeHtml;
  const relations = buildStoryRelations(state, ctx.game.registry.stories, ctx.game.registry.storyEntries);
  const same = (other: StoryEditorTarget) => other.kind === target.kind && other.id === target.id;
  const name = (ref: StoryEditorTarget): string => ref.kind === 'story' ? relations.stories.get(ref.id)?.name || ref.id
    : relations.entries.get(ref.id)?.openingTitle || relations.stories.get(relations.entries.get(ref.id)?.storyId ?? '')?.name || ref.id;
  const row = (ref: StoryEditorTarget, key: string, detail: string, title: string) => {
    const available = ref.kind === 'story' ? relations.stories.has(ref.id) : relations.entries.has(ref.id);
    return `<button type="button" class="story-editor-list-item story-editor-relation-item" data-editor-key="${e(key)}" data-editor-${ref.kind}-target="${e(ref.id)}" title="${e(title)}"${available ? '' : ' disabled'}><strong>${ref.kind === 'story' ? 'Story' : 'Entry'} · ${e(name(ref))}</strong><code>${e(ref.id)}</code><span class="story-editor-relation-detail">${e(detail)}${available ? '' : ' · 目标不存在'}</span></button>`;
  };
  const list = (rows: readonly StoryCall[], incoming = false): string => `<div class="story-editor-list">${rows.map(call => {
    const ref = incoming ? call.from : call.to;
    const via = !incoming && !same(call.from) ? `来自 ${name(call.from)} · ` : '';
    return row(ref, `relation:${JSON.stringify([call.from, call.to, call.path])}`, via + call.label, call.path);
  }).join('') || '<p class="story-editor-empty">暂无调用关系。</p>'}</div>`;
  const packEntries = target.kind === 'story' ? storyTransferContext(relations, target.id).entries
    .sort((a, b) => Number(b.storyId === target.id) - Number(a.storyId === target.id)) : [];
  const storyPack = target.kind === 'story' ? `<details class="story-editor-story-pack" data-editor-key="story-pack">
    <summary>剧情包 · ${packEntries.length} 个入口</summary>
    <div class="story-editor-list">${packEntries.map(entry => {
      const ref = { kind: 'entry', id: entry.id } as const;
      const detail = entry.storyId === target.id ? '直接起始' : `经剧情转移 · 起始于 ${name({ kind: 'story', id: entry.storyId })}`;
      return row(ref, `story-pack-entry:${entry.id}`, detail, entry.id);
    }).join('') || '<p class="story-editor-empty">没有可到达该 Story 的入口。</p>'}</div>
  </details>` : '';
  const outgoing = target.kind === 'entry' ? potentialStoryCalls(relations, target) : relations.calls.filter(call => same(call.from));
  const activation=target.kind==='entry'?relations.entries.get(target.id)?.activation:undefined;
  const prerequisite=activation?.kind==='affection'&&activation.when.kind==='after-story'?activation.when.storyId:undefined;
  const dependency=prerequisite?`<h3>激活所需的前置故事</h3><button type="button" class="story-editor-list-item story-editor-relation-item" data-editor-key="activation-prerequisite" data-editor-story-target="${e(prerequisite)}"${relations.stories.has(prerequisite)?'':' disabled'}><strong>${e(name({kind:'story',id:prerequisite}))}</strong><code>${e(prerequisite)}</code><span class="story-editor-relation-detail">完成后可触发；不属于本 Entry 的调用链或局部标记作用域。</span></button>`:'';
  return `<section class="story-editor-relations" data-editor-key="relations:${e(target.kind)}:${e(target.id)}"><h3>${target.kind === 'entry' ? '潜在调用集' : '调用表'}</h3>${target.kind === 'entry' ? '<p class="story-editor-hint">包含起始 Story 与各分支可能到达的 Story / Entry，不表示实际执行顺序。</p>' : ''}${list(outgoing)}<h3>被调用表</h3>${list(relations.calls.filter(call => same(call.to)), true)}${dependency}${storyPack}</section>`;
}
