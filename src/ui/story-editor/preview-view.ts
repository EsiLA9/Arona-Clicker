import type {
  StoryPreviewCheck, StoryPreviewDecision, StoryPreviewRequirement,
} from '../../arona-clicker/contracts/runtime/story-authoring';
import { renderWorkspaceTitlebar } from '../components/shared/workspace-titlebar';
import type { WorkspaceFrameSpec, WorkspaceColumnSpec } from '../components/shared/workspace-frame';
import {
  renderChatEntry, renderChatTexts, renderCurrentStory, renderStoryClickAppearance, renderStoryNodePlacement, type ChatTextEntry,
} from '../components/story/story';
import { BANNER_ANIMATION_MS, renderOpeningBanner } from '../components/story/story-gate';
import { buildBackgroundView, renderBackground } from '../presentation/background-service';
import { describeConditionLeaf } from '../presentation/condition-presentation';
import type { UIContext } from '../runtime/context';
import type { StoryEditorState } from './model';
import { renderStoryIdentityInline } from '../components/story/story-identity';

const decisionLabels: Record<StoryPreviewDecision, string> = {
  actual: '按真实结果', pass: '本次视为满足', fail: '本次视为不满足',
};
const checkLabels: Record<StoryPreviewCheck['kind'], string> = {
  entry: '入口资格', choice: '选项出现条件', transfer: '重读分支守卫',
};

function resultLabel(met: boolean | null): string {
  if (met === null) return '未取得结果';
  return met ? '满足' : '未满足';
}

function requirementLabel(ctx: UIContext, state: StoryEditorState, requirement: StoryPreviewRequirement): string {
  if (requirement.kind === 'group') {
    if (!requirement.children.length && requirement.met !== null) return requirement.operator === 'AND' ? '恒成立' : '恒不成立';
    return requirement.operator === 'AND' ? '全部满足' : '任一满足';
  }
  if (requirement.kind === 'requirement') return requirement.text;
  const condition = requirement.condition;
  const label = describeConditionLeaf(condition, {
    style: 'ui', formatNumber: ctx.formatNumber,
    nameOf: (kind, id) => (kind === 'story' ? state.drafts.find(draft => draft.document.id === id)?.document.name : undefined) || ctx.nameOf(kind, id),
  });
  if (condition.target === 'flag') return `存档${label}`;
  if (condition.target === 'area') {
    const expected = ctx.nameOf('area', condition.key);
    return `位于「${expected}」的判断值 ${condition.comparator} ${condition.value}（求值 Area：${requirement.areaId ? ctx.nameOf('area', requirement.areaId) : '无'}）`;
  }
  if (condition.target === 'alwaysTrue') return `恒真目标（1） ${condition.comparator} ${condition.value}`;
  return label;
}

function renderRequirement(ctx: UIContext, state: StoryEditorState, requirement: StoryPreviewRequirement): string {
  const children = requirement.kind === 'group' && requirement.children.length
    ? `<ul>${requirement.children.map(child => renderRequirement(ctx, state, child)).join('')}</ul>` : '';
  return `<li><div><span>${ctx.escapeHtml(requirementLabel(ctx, state, requirement))}</span><strong data-preview-met="${requirement.met}">${resultLabel(requirement.met)}</strong></div>${children}</li>`;
}

function renderCheckItem(ctx: UIContext, state: StoryEditorState, item: StoryPreviewCheck['items'][number], adopted?: boolean): string {
  const first = item.requirement.kind === 'group' && item.requirement.children.length === 1 ? item.requirement.children[0] : item.requirement;
  const name = requirementLabel(ctx, state, first);
  const summary = first.kind === 'group' && first.children.length
    ? `${name} · ${first.children.slice(0, 2).map(child => requirementLabel(ctx, state, child)).join('、')}${first.children.length > 2 ? `等 ${first.children.length} 项` : ''}`
    : name;
  return `<div class="story-preview-requirement">
    <div class="story-preview-requirement__summary" tabindex="0"><span>${ctx.escapeHtml(summary)}</span><strong data-preview-met="${item.requirement.met}">真实${resultLabel(item.requirement.met)}</strong></div>
    <div class="story-preview-requirement__hover" role="tooltip"><ul>${renderRequirement(ctx, state, item.requirement)}</ul></div>
    ${adopted === undefined ? '' : `<span class="story-editor-hint">采用结果 · ${resultLabel(adopted)}</span>`}
  </div>`;
}

function renderPrompt(ctx: UIContext, state: StoryEditorState, pending: StoryPreviewCheck): string {
  const preview = state.preview!;
  const e = ctx.escapeHtml;
  const collapsed = preview.collapsedCheck === pending.id;
  return `<div class="story-preview-checkpoint" data-editor-key="checkpoint:${e(pending.id)}">
    <section class="story-preview-prompt" role="dialog" aria-label="${checkLabels[pending.kind]}" data-preview-check="${e(pending.id)}"${collapsed ? ' hidden' : ''}>
      <header><div><strong>${checkLabels[pending.kind]}</strong>${pending.nodeId ? `<small>${e(pending.nodeId)}</small>` : ''}</div><button type="button" class="mini-action" data-preview-toggle="collapse">收起</button></header>
      <div class="story-preview-prompt__items">${pending.items.map(item => `<div class="story-preview-condition-row" data-editor-key="preview-choice:${e(item.id)}">
        <strong>${e(item.label)}</strong>
        ${renderCheckItem(ctx, state, item)}
        <select aria-label="${e(`${item.label}的本次结果`)}" data-preview-decision="${e(item.id)}">${Object.entries(decisionLabels).map(([id, label]) =>
          `<option value="${id}"${(preview.selections?.[item.id] ?? 'actual') === id ? ' selected' : ''}>${label}</option>`).join('')}</select>
      </div>`).join('')}</div>
      <footer><button type="button" class="mini-action" data-preview-confirm>确认并继续</button></footer>
    </section>
    <button type="button" class="mini-action" data-preview-toggle${collapsed ? '' : ' hidden'}>查看待定条件</button>
  </div>`;
}

const routeLabels = { start: '起始', child: '进入子 Entry', goto: '转移', insert: '插入片段', return: '返回' };
const phaseLabels = {
  idle: '播放结束', typing: '正在输入', thinking: '正在思考', operation: '正在呈现效果', banner: '开幕标题',
  continue: '等待继续', input: '等待输入', finishing: '正在收尾', failed: '播放失败',
};

export function createStoryPreviewFrame(ctx: UIContext, state: StoryEditorState): WorkspaceFrameSpec {
  const advanced = state.workspace?.preferences.mode === 'advanced';
  const preview = state.preview!;
  const { playback, story, projection, decisions, send } = preview;
  const pending = decisions.pending;
  const e = ctx.escapeHtml;
  const route = decisions.route;
  const current = route.at(-1);
  const sceneName = projection?.scene.type === 'area' ? ctx.game.registry.areas.get(projection.scene.id)?.name ?? projection.scene.id
    : projection ? ctx.game.registry.characterVariants.get(projection.scene.id)?.displayName ?? projection.scene.id : '';
  const markup = (entry: NonNullable<typeof playback>['entries'][number]) => renderChatEntry(ctx, {
    ...entry, kind: entry.kind === 'travel' ? 'reward' : entry.kind,
  });
  const canPlay = playback?.phase === 'input';
  const currentInput = canPlay && story && (!pending || pending.kind === 'entry') ? renderCurrentStory(ctx, story, { authoring: true }) : '';
  const positionedInput = story?.performance?.layout?.mode === 'positioned';
  const playableFooter = !pending && playback?.token && send.mode !== 'choice' && send.mode !== 'kizuna' && !(canPlay && positionedInput);
  const label = canPlay && send.mode === 'advance' ? send.text || '继续'
    : playback?.phase === 'continue' ? '继续' : '加速';
  const press = send.mode === 'advance' ? send.clickWork : undefined;
  const controls = playableFooter ? renderStoryClickAppearance(
    `<button type="button" class="send-button send-player" data-authoring-action="advance" data-preview-token="${e(playback.token!)}"><span class="send-bubble"><span class="send-text">${e(label)}${press ? `（${press.done}/${press.total}）` : ''}</span><span class="send-arrow">↗</span></span></button>`,
    canPlay ? story?.performance : undefined,
  ) : '';
  const overlays = projection ? renderChatTexts(ctx, projection.presentation.overlays.map(({id, value}) => ({
    id, text: value.text, talklet: value.talklet, x: value.x ?? 0, y: value.y ?? 1, align: value.align ?? 'left',
    kind: value.kind, style: value.style, title: value.title, buttonText: value.buttonText, targetStoryId: value.targetStoryId, timestamp: 0,
  } satisfies ChatTextEntry)), { preview: true }) : '';
  const themeCss = Object.entries(projection?.theme.tokens ?? {})
    .filter(([key, value]) => /^[a-z][a-z0-9-]*$/i.test(key) && !/[;{}]|url\(/i.test(value))
    .map(([key, value]) => `--${key}:${value}`).join(';');
  const visual = `<div class="story-editor-preview-stage" data-editor-key="preview-stage" style="${e(themeCss)}">
    ${projection ? renderBackground(buildBackgroundView(projection.theme.background, ctx.game.pics, projection.theme.tokens), 'story-editor-preview-background') : ''}
    <div class="chat-pane story-preview-chat" data-editor-key="preview-chat">
      <div class="chat-stream" data-preview-stream data-editor-key="preview-stream" role="log" aria-label="试播正文">
        ${playback?.entries.filter(entry => entry.performance?.layout?.mode !== 'positioned').map(entry => `<div data-editor-key="preview-output:${e(entry.id)}">${markup(entry)}</div>`).join('') ?? ''}
        ${playback?.typing ? renderChatEntry(ctx, { ...playback.typing, kind: 'typing' }) : ''}
        ${positionedInput ? '' : `<div data-editor-key="preview-input" ${pending ? 'inert' : ''}>${currentInput}</div>`}
      </div>
      ${playback?.entries.filter(entry => entry.performance?.layout?.mode === 'positioned').map(entry => renderStoryNodePlacement(ctx, markup(entry), entry.performance!, entry.id)).join('') ?? ''}
      ${positionedInput && currentInput ? `<div class="story-preview-positioned-input" ${pending ? 'inert' : ''}>${currentInput}</div>` : ''}
      ${overlays}
      ${playback?.banner ? renderOpeningBanner(ctx, { title: playback.banner.title, startedAt: Date.now() - Math.max(0, BANNER_ANIMATION_MS - playback.banner.remainingMs) }) : ''}
      ${pending ? renderPrompt(ctx, state, pending) : ''}
    </div>
  </div>`;
  const column = (slot: 'left' | 'center' | 'right', title: string, content: string): WorkspaceColumnSpec => ({
    key: `story-editor-preview-${slot}`, slot, workspaceOwner: 'story-editor', themeScope: `${slot}.story-editor`,
    hostId: `${slot}Panel.story-editor-preview`, width: slot === 'left' ? '300px' : `var(--workspace-${slot}-width)`,
    surface: 'panel', scroll: slot === 'center' ? 'none' : 'auto', className: `story-preview-column story-preview-${slot}`,
    header: renderWorkspaceTitlebar(ctx, slot, title, slot === 'left' && !advanced ? 'data-column-back' : undefined), content,
  });
  const notice = preview.error || decisions.message || playback?.error;
  const history = decisions.history;
  return { id: 'story-editor', updates: 'external', columns: [
    {
      ...column('left', '试播路线', `<div class="story-preview-side"><div class="story-preview-entry">${renderStoryIdentityInline(ctx, decisions.directStory ? 'story' : 'entry', decisions.entryTitle, decisions.directStory ? route[0]?.storyId : decisions.entryId)}${decisions.directStory ? '<small>直接试播正文</small>' : ''}</div>
        <ol class="story-preview-route">${route.map((item, index) => `<li data-editor-key="route:${index}"${item === current ? ' aria-current="step"' : ''}><small>${routeLabels[item.kind]}</small>${renderStoryIdentityInline(ctx, 'story', item.title, item.storyId)}</li>`).join('')}</ol></div>`),
      footer: advanced ? undefined : '<div class="story-editor-actions story-editor-actions--tools story-preview-route-actions" role="group" aria-label="试播操作"><button type="button" class="mini-action" data-authoring-action="restart-preview">从头试播</button><button type="button" class="mini-action" data-authoring-action="close-preview">关闭试播</button></div>',
    },
    { ...column('center', sceneName || '试播正文', visual), footer: `<div class="story-preview-footer"><p role="status">${e(notice || (pending ? '等待条件决定' : playback ? phaseLabels[playback.phase] : '等待开播'))}</p>${controls}</div>` },
    column('right', '条件记录', `<div class="story-preview-side">
      ${pending ? `<button type="button" class="mini-action" data-preview-toggle>待决定 · ${checkLabels[pending.kind]}</button>` : ''}
      ${history.map(check => `<details class="story-preview-record" data-editor-key="record:${e(check.id)}">
        <summary><strong>${checkLabels[check.kind]}</strong><span>${e(check.items.map(item => item.label).join('、'))}</span>
        <span>${check.items.length === 1
          ? `真实${resultLabel(check.items[0].requirement.met)} · 采用结果 ${resultLabel(check.adopted[check.items[0].id])}`
          : `真实 ${check.items.filter(item => item.requirement.met).length}/${check.items.length} 满足 · 采用 ${check.items.filter(item => check.adopted[item.id]).length}/${check.items.length} 满足`}</span></summary>
        ${check.items.map(item => `<div class="story-preview-record-item"><strong>${e(item.label)}</strong>${renderCheckItem(ctx, state, item, check.adopted[item.id])}</div>`).join('')}
      </details>`).join('') || (pending ? '' : '<p class="story-editor-empty">尚无条件判断</p>')}
    </div>`),
  ] };
}
