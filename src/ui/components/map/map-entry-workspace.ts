import type { MapEntryPartyMemberView, MapEntryView } from '../../../arona-clicker/contracts/map/map-entry';
import type { UIContext } from '../../runtime/context';
import { renderLeftPanel } from '../shared/rail';
import type { PanelState } from '../shared/app-shell';
import { renderWorkspaceFrame } from '../shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../shared/workspace-titlebar';
import { getSpotReveal } from '../tooltip/tooltip';
import '../../css/map-entry-workspace.css';

function escape(ctx: UIContext, value: string): string {
  return ctx.escapeHtml(value);
}

function resourceLabel(ctx: UIContext, resourceId: string): string {
  return escape(ctx, ctx.nameOf('resource', resourceId));
}

function memberStatus(member: MapEntryPartyMemberView): string {
  if (member.admission === 'character-locked') return '尚未解锁';
  if (member.admission === 'variant-unavailable') return '没有可用差分';
  return '准入正常';
}

function renderMember(ctx: UIContext, member: MapEntryPartyMemberView, mode: MapEntryView['mode']): string {
  const avatar = member.avatarRef
    ? `<img class="map-entry-workspace__avatar" src="${escape(ctx, member.avatarRef)}" alt="" loading="lazy">`
    : `<span class="map-entry-workspace__avatar map-entry-workspace__avatar--fallback" aria-hidden="true">${escape(ctx, member.displayName.slice(0, 1))}</span>`;
  const hp = member.currentHp !== undefined && member.maxHp !== undefined
    ? `${ctx.formatNumber(member.currentHp)} / ${ctx.formatNumber(member.maxHp)}`
    : member.initialHp !== undefined && member.maxHp !== undefined
      ? `${ctx.formatNumber(member.initialHp)} / ${ctx.formatNumber(member.maxHp)}`
      : null;
  const hpLabel = hp
    ? `<span class="map-entry-workspace__member-hp" aria-label="${mode === 'resume' ? '当前生命' : '初始生命'}">生命 ${escape(ctx, hp)}</span>`
    : '';
  const status = mode === 'resume' ? ''
    : `<small class="map-entry-workspace__member-status" data-admission="${member.admission}">${escape(ctx, memberStatus(member))}</small>`;
  return `<article class="map-entry-workspace__member" data-map-party-member="${escape(ctx, member.characterId)}" data-map-entry-party-member="${escape(ctx, member.characterId)}" data-map-region-key="party:${escape(ctx, member.characterId)}">
    ${avatar}<div class="map-entry-workspace__member-copy"><strong>${escape(ctx, member.displayName)}</strong>${status}${hpLabel}</div>
  </article>`;
}

function renderResources(ctx: UIContext, view: MapEntryView): string {
  const playerCost = view.playerCost === null ? ''
    : `<div class="map-entry-workspace__resource-row" data-map-region-key="resource:player-cost"><span>行动点</span><strong>${ctx.formatNumber(view.playerCost)}</strong></div>`;
  const actorResources = view.actorResources.map(row => `<div class="map-entry-workspace__resource-row" data-map-region-key="resource:actor:${escape(ctx, row.characterId)}:${escape(ctx, row.resourceId)}"><span>${escape(ctx, ctx.nameOf('character', row.characterId))} · ${resourceLabel(ctx, row.resourceId)}</span><strong>${ctx.formatNumber(row.value)}</strong></div>`).join('');
  const teamResources = view.teamResources.map(row => `<div class="map-entry-workspace__resource-row" data-map-region-key="resource:team:${escape(ctx, row.resourceId)}"><span>${resourceLabel(ctx, row.resourceId)}</span><strong>${ctx.formatNumber(row.value)}</strong></div>`).join('');
  const empty = !playerCost && !actorResources && !teamResources
    ? '<p class="map-entry-workspace__empty">暂无已声明的局内资源。</p>'
    : '';
  return `<section class="map-entry-workspace__resources" data-map-region-key="resources" aria-label="局内资源">
    <h2>局内资源</h2>${playerCost}${actorResources}${teamResources}${empty}
  </section>`;
}

function modeMessage(ctx: UIContext, view: MapEntryView): string {
  if (view.reason === 'other-map-active') {
    return `已有「${escape(ctx, view.blockedByMapName ?? '其他地图')}」正在进行，暂时不能开始另一张地图。`;
  }
  if (view.reason === 'party-ineligible') return '固定队伍尚未满足准入条件。';
  if (view.mode === 'resume') return '当前进度会沿用原队伍与局内状态。';
  if (view.mode === 'fresh') return '地图尚未开始；点击“开始地图”后才会创建本局进度。';
  if (view.reason === 'map-not-found') return '地图内容当前不可用，请返回游戏并从有效设施重新进入。';
  return '当前地图进度暂不可读取，请返回游戏后重试。';
}

function mapEntryAvailabilityReason(ctx: UIContext, state: PanelState, mapId: string): string | null {
  if (state.mapEntrySubmitting) return '地图正在开始，请稍候。';
  if (ctx.game.story.isBlockingInteraction()) return '请先完成当前剧情或对话。';
  if (state.sendGate || state.storyGate || state.openingBanner) return '请先完成当前对话。';
  const source = state.mapEntrySource;
  if (!source || source.mapId !== mapId) return '地图入口已失效，请返回游戏后从设施重新进入。';
  const spot = ctx.game.world.spots.get(source.spotId);
  if (!spot || spot.areaId !== ctx.game.getView().currentAreaId || !getSpotReveal(ctx, spot).utilityKnown) {
    return '来源设施已不可用，请返回游戏后从当前设施重新进入。';
  }
  const functionality = ctx.game.spotFunctionalitySystem.functionalitiesOf(spot, ctx.game.state)
    .find(fn => fn.id === source.functionalityId && fn.kind === 'mapEntry' && fn.mapId === mapId);
  if (!functionality) return '地图入口已变化，请返回游戏后重新打开准备页。';
  if (functionality.condition && !ctx.game.conditionSystem.evaluateGroup(functionality.condition, ctx.game.state)) {
    return '设施功能条件已变化，当前不能出发。';
  }
  return null;
}

function renderProgress(ctx: UIContext, view: MapEntryView): string {
  const progress = view.progress;
  if (!progress) return '<p class="map-entry-workspace__progress" data-map-region-key="progress">尚未开始</p>';
  const activity = progress.activity
    ? `<span>${progress.activity.position} / ${progress.activity.total} · ${progress.activity.kind === 'battle' ? '战斗' : progress.activity.kind === 'rest' ? '休整' : progress.activity.kind === 'shop' ? '商店' : '活动'}</span>`
    : '';
  const round = progress.round === undefined ? '' : `<span>${progress.round} 轮</span>`;
  return `<div class="map-entry-workspace__progress" data-map-region-key="progress">
    <strong>${escape(ctx, progress.currentNodeTitle)}</strong><div>${activity}${round}</div>
  </div>`;
}

function renderPrimaryAction(ctx: UIContext, view: MapEntryView, availabilityReason: string | null): string {
  const runId = view.progress?.runId;
  if (view.mode === 'fresh' && !availabilityReason) {
    return `<button type="button" class="story-trigger map-entry-workspace__primary" data-map-entry-start="${escape(ctx, view.mapId)}" data-map-focus-key="entry-primary" data-map-entry-focus-key="primary">开始地图</button>`;
  }
  if (view.mode === 'resume' && runId && !availabilityReason) {
    return `<button type="button" class="story-trigger map-entry-workspace__primary" data-map-entry-continue-run="${escape(ctx, runId)}" data-map-focus-key="entry-primary" data-map-entry-focus-key="primary">继续地图</button>
      <details class="map-entry-workspace__management" data-map-region-key="management">
        <summary>地图管理</summary>
        <div role="group" aria-label="地图管理操作">
          <button type="button" class="mini-action" data-map-restart="${escape(ctx, runId)}" data-map-focus-key="map-restart">重新开始</button>
          <button type="button" class="mini-action map-workspace__hero-action--danger" data-map-abandon="${escape(ctx, runId)}" data-map-focus-key="map-abandon">放弃当前地图</button>
        </div>
      </details>`;
  }
  const label = availabilityReason ? '入口暂不可用'
    : view.reason === 'other-map-active' ? '已有地图进行中'
      : view.reason === 'party-ineligible' ? '队伍暂不可出发' : '地图暂不可用';
  return `<button type="button" class="story-trigger map-entry-workspace__primary" disabled data-map-focus-key="entry-primary" data-map-entry-focus-key="primary">${label}</button>`;
}

export function renderMapEntryWorkspace(ctx: UIContext, mapId: string, view: MapEntryView, state: PanelState): string {
  const availabilityReason = mapEntryAvailabilityReason(ctx, state, mapId);
  const title = view.name ?? '地图准备';
  const description = view.entryInfo?.description
    ? `<p>${escape(ctx, view.entryInfo.description)}</p>`
    : '';
  const tips = view.entryInfo?.tips?.length
    ? `<ul class="map-entry-workspace__tips" aria-label="地图提示">${view.entryInfo.tips.map(tip => `<li>${escape(ctx, tip)}</li>`).join('')}</ul>`
    : '';
  const members = view.party.map(member => renderMember(ctx, member, view.mode)).join('');
  const partyEmpty = view.party.length === 0
    ? '<p class="map-entry-workspace__empty" role="status">队伍信息暂不可读取。</p>'
    : '';
  const center = renderWorkspaceTitlebar(ctx, 'center', '地图准备', 'data-map-entry-leave')
    + `<div class="map-entry-workspace__center-body">
      <div class="map-entry-workspace__overview-scroll" data-scroll-owner="content-region" data-map-region-key="overview-scroll" aria-label="地图说明与进度">
        <section class="map-entry-workspace__overview" data-map-region-key="overview"><h1>${escape(ctx, title)}</h1>${description}${tips}</section>
        <section class="map-entry-workspace__progress-section" data-map-region-key="progress-section" aria-label="当前进度"><h2>${view.mode === 'resume' ? '当前进度' : '出发前'}</h2>${renderProgress(ctx, view)}</section>
        <p class="map-entry-workspace__notice" role="status" data-map-region-key="notice">${escape(ctx, availabilityReason ?? modeMessage(ctx, view))}</p>
      </div>
      <div class="map-entry-workspace__actions" data-map-region-key="primary-action" role="group" aria-label="地图操作">
        ${renderPrimaryAction(ctx, view, availabilityReason)}
      </div>
    </div>`;
  const right = renderWorkspaceTitlebar(ctx, 'right', '固定队伍')
    + `<div class="map-entry-workspace__right-body">
      <div class="map-entry-workspace__party-scroll" data-scroll-owner="content-region" data-map-region-key="party-scroll" aria-label="固定队伍">${members}${partyEmpty}</div>
      ${renderResources(ctx, view)}
    </div>`;
  const frame = renderWorkspaceFrame(ctx, {
    id: 'map-entry',
    layout: { composition: 'columns', responsive: 'default' },
    left: {
      slot: 'left', role: 'navigation', workspaceOwner: 'map-entry', hostId: 'leftPanel.map-entry.navigation',
      themeScope: 'left.game', surface: 'none', className: 'map-entry-workspace__left',
      content: renderLeftPanel(ctx, state), scroll: 'none',
    },
    center: {
      slot: 'center', role: 'primary', workspaceOwner: 'map-entry', hostId: 'centerPanel.map-entry.main',
      themeScope: 'center.game', surface: 'panel', className: 'map-entry-workspace__center',
      content: center, scroll: 'none',
    },
    right: {
      slot: 'right', role: 'fixed-party', workspaceOwner: 'map-entry', hostId: 'rightPanel.map-entry.party',
      themeScope: 'right.game', surface: 'panel', className: 'map-entry-workspace__right',
      content: right, scroll: 'none',
    },
  });
  return `<div class="map-entry-workspace" data-map-entry-workspace data-map-id="${escape(ctx, mapId)}" data-map-entry-mode="${view.mode}" data-map-instance-key="${escape(ctx, mapId)}" data-map-region-key="entry-root">${frame}</div>`;
}
