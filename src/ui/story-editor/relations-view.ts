import { renderEditorReviewSection } from '../workspace/editor-review';
import type { UIContext } from '../runtime/context';
import type { StoryEditorState, StoryEditorTarget } from './model';
import { buildStoryRelations, potentialStoryCalls, storyTransferContext, type StoryCall } from './relations-model';
import { renderStoryEditorTarget } from './target-view';
import { storyEntryType } from '../../data-services/contracts/story-entry';

export function renderStoryRelations(ctx: UIContext, state: StoryEditorState): string {
  const target = state.target;
  if (!target) return '';
  const e = ctx.escapeHtml;
  const relations = buildStoryRelations(state, ctx.game.registry.stories, ctx.game.registry.storyEntries);
  const same = (other: StoryEditorTarget) => other.kind === target.kind && other.id === target.id;
  const name = (ref: StoryEditorTarget): string => ref.kind === 'story' ? relations.stories.get(ref.id)?.name || ref.id
    : relations.entries.get(ref.id)?.openingTitle || relations.stories.get(relations.entries.get(ref.id)?.storyId ?? '')?.name || ref.id;
  const row = (ref: StoryEditorTarget, key: string, detail: string, path?: string) => {
    const entry = ref.kind === 'entry' ? relations.entries.get(ref.id) : undefined;
    const document = ref.kind === 'story' ? relations.stories.get(ref.id) : entry;
    return renderStoryEditorTarget(ctx, ref.kind, ref.id, name(ref), Boolean(document), {
      relation: { key, detail, path }, gradient: document?.cardGradient, entryType: storyEntryType(entry),
    });
  };
  const list = (rows: readonly StoryCall[], incoming = false): string => rows.length ? `<div class="story-editor-list">${rows.map(call => {
    const ref = incoming ? call.from : call.to;
    const via = !incoming && !same(call.from) ? `来自 ${name(call.from)} · ` : '';
    return row(ref, `relation:${JSON.stringify([call.from, call.to, call.path])}`, via + call.label, call.path);
  }).join('')}</div>` : '';
  const packEntries = target.kind === 'story' ? storyTransferContext(relations, target.id).entries
    .sort((a, b) => Number(b.storyId === target.id) - Number(a.storyId === target.id)) : [];
  const storyPack = target.kind === 'story' ? `<details class="story-editor-story-pack" data-editor-key="story-pack">
    <summary>剧情包 · ${packEntries.length} 个入口</summary>
    <div class="story-editor-list">${packEntries.map(entry => {
      const ref = { kind: 'entry', id: entry.id } as const;
      const detail = entry.storyId === target.id ? '直接起始' : `经剧情转移 · 起始于 ${name({ kind: 'story', id: entry.storyId })}`;
      return row(ref, `story-pack-entry:${entry.id}`, detail);
    }).join('') || '<p class="story-editor-empty">没有可到达该 Story 的入口。</p>'}</div>
  </details>` : '';
  const outgoing = target.kind === 'entry' ? potentialStoryCalls(relations, target) : relations.calls.filter(call => same(call.from));
  const activation=target.kind==='entry'?relations.entries.get(target.id)?.activation:undefined;
  const prerequisite=activation?.kind==='affection'&&activation.when.kind==='after-story'?activation.when.storyId:undefined;
  const dependency = prerequisite ? `<h3>激活所需的前置故事</h3>${row({ kind: 'story', id: prerequisite },
    'activation-prerequisite', '完成后可触发；不属于本 Entry 的调用链或局部标记作用域。')}` : '';
  const hint = target.kind === 'entry' ? '<p class="story-editor-hint">包含起始 Story 与各分支可能到达的 Story / Entry，不表示实际执行顺序。</p>' : '';
  const calls = list(outgoing);
  return `<section class="story-editor-relations" data-editor-key="relations:${e(target.kind)}:${e(target.id)}">
    ${renderEditorReviewSection(ctx, 'outgoing', target.kind === 'entry' ? '潜在调用集' : '调用表', hint + (calls || '<p class="editor-review-empty">暂无调用关系。</p>'), '暂无调用关系。')}
    ${renderEditorReviewSection(ctx, 'incoming', '被调用表', list(relations.calls.filter(call => same(call.to)), true), '暂无调用关系。')}
    ${dependency}${storyPack}</section>`;
}
