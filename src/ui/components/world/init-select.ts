// ============================================================
// ui/components/init-select.ts — Init（世界线）选择投影
// 只负责：只读摘要、节点呈现字段、右侧工作台详情。
// 图上位置、连线与选中态由 components/selector-graph.ts 组合；
// 业务动作仍由 controller-panels 绑定到 GameCommands。
// ============================================================

import type { RevealStage } from '../../../engine/contracts/reveal';
import type { ResourceAmount } from '../../../data-services/contracts/common';
import { compareWorldTilt, normalizeWorldTilt, tryNormalizeWorldTilt } from '../../../engine/stats/world-tilt';
import { UIContext } from '../../runtime/context';
import { getInitReveal } from '../tooltip/tooltip';
import { projectSelectorTheme, selectorThemeStyle, type SelectorNodeState } from '../../presentation/selector-theme';

export interface InitSummary {
  id: string;
  name: string;
  description: string;
  areaCount: number;
  spotCount: number;
  /** 揭示阶段：invisible → presence → … → purchaseable → owned。 */
  stage: RevealStage;
  nameKnown: boolean;
  conditionKnown: boolean;
  utilityKnown: boolean;
  unlocked: boolean;
  /** 当前活动世界线（activeInit）；与 unlocked 不同。 */
  active: boolean;
  purchaseCost: ResourceAmount[];
  /** 规范化「首.尾15」世界倾斜数值。 */
  worldTilt: string;
  /** 选择页排序使用的规范值；非法原文使用官方世界作为稳定回退键。 */
  worldTiltSortKey: string;
  /** 原始 worldTilt 是否符合规范数值格式。 */
  worldTiltValid: boolean;
  /** 伪装展示字符串：存在时代替数值展示。 */
  worldTiltAlias?: string;
  /** 条目局部主题树，图上节点与工作台共用。 */
  themeStyle: string;
}

/** Init 选择界面模式：new = 新建世界线（开始新的世界线）；restart = 重选世界线（回到世界线）。 */
export type InitSelectMode = 'new' | 'restart';

function summarize(ctx: UIContext): InitSummary[] {
  const activeInitId = ctx.view.activeInit || ctx.game.state.activeInit;
  return [...ctx.world.inits.values()].map(init => {
    const areas = ctx.world.areasOfInit(init.id);
    const spotCount = areas.reduce(
      (sum, areaId) => sum + ctx.world.spotsOfArea(areaId).length,
      0,
    );
    const reveal = getInitReveal(ctx, init);
    const rawWorldTilt = typeof init.worldTilt === 'string' ? init.worldTilt.trim() : '';
    const normalizedWorldTilt = tryNormalizeWorldTilt(init.worldTilt);
    const worldTiltValid = normalizedWorldTilt !== undefined;
    return {
      id: init.id,
      name: init.name,
      description: init.description,
      areaCount: areas.length,
      spotCount,
      stage: reveal.stage,
      nameKnown: reveal.nameKnown,
      conditionKnown: reveal.conditionKnown,
      utilityKnown: reveal.utilityKnown,
      unlocked: ctx.view.unlockedInits.includes(init.id),
      active: activeInitId === init.id,
      purchaseCost: init.purchaseCost ?? [],
      worldTilt: worldTiltValid ? normalizedWorldTilt : rawWorldTilt || normalizeWorldTilt(undefined),
      worldTiltSortKey: normalizedWorldTilt ?? normalizeWorldTilt(undefined),
      worldTiltValid,
      worldTiltAlias: init.worldTiltAlias,
      themeStyle: selectorThemeStyle(projectSelectorTheme(ctx, 'init', init.id)),
    };
  });
}

/** 将 ResourceAmount 数组格式化为可读文本。 */
function formatCost(ctx: UIContext, cost: ResourceAmount[]): string {
  return cost.map(c => `${c.amount} ${ctx.nameOf('resource', c.resourceId)}`).join('、');
}

/** 倾斜值展示：有伪装字符串用伪装串，名称未揭示前不泄露。 */
export function initTiltText(init: InitSummary): string {
  if (init.stage === 'presence' || !init.nameKnown) return '???';
  return init.worldTiltAlias ?? init.worldTilt;
}

/** 节点标题：未揭示名称前只显示占位符。 */
export function initDisplayName(init: InitSummary): string {
  return init.nameKnown || init.unlocked ? init.name : '???';
}

export function initNodeState(init: InitSummary): SelectorNodeState {
  if (init.unlocked) return init.active ? 'active' : 'owned';
  if (init.stage === 'purchaseable') return 'buyable';
  if (init.stage === 'presence' || init.stage === 'invisible') return 'fog';
  return 'locked';
}

export function initStateLabel(init: InitSummary): string {
  if (init.unlocked) return init.active ? 'ACTIVE · 当前世界线' : 'OWNED · 已解锁';
  if (init.stage === 'purchaseable') return 'BUYABLE · 可购买';
  if (init.stage === 'presence') return 'FOG · 迷雾笼罩';
  return 'LOCKED · 未解锁';
}

/** 节点副标题：只披露当前揭示阶段允许的倾斜值。 */
export function initNodeMeta(init: InitSummary): string {
  return `TILT ${initTiltText(init)}`;
}

/** 按 TILT 降序排列的可见世界线（invisible 不入列）。 */
export function visibleInitsByTilt(ctx: UIContext): InitSummary[] {
  return summarize(ctx)
    .sort((a, b) => {
      if (a.worldTiltValid !== b.worldTiltValid) return a.worldTiltValid ? -1 : 1;
      return compareWorldTilt(b.worldTiltSortKey, a.worldTiltSortKey);
    })
    .filter(init => init.stage !== 'invisible');
}

function detailHtml(ctx: UIContext, init: InitSummary, restarting: boolean): string {
  const isFree = init.purchaseCost.length === 0;
  const priceText = init.conditionKnown
    ? (isFree ? '免费' : formatCost(ctx, init.purchaseCost))
    : '???';

  let desc = '这条世界线尚被迷雾笼罩……';
  if (init.unlocked || init.utilityKnown) {
    desc = init.description;
  } else if (init.nameKnown) {
    desc = '这条世界线的详情尚待揭示……';
  }

  const metaBits: string[] = [];
  if (init.nameKnown || init.unlocked) {
    metaBits.push(`${init.areaCount} AREA`, `${init.spotCount} SPOT`);
    if (!isFree && !init.unlocked) metaBits.push(`COST ${priceText}`);
  }
  if (init.active) metaBits.push('ACTIVE WORLD LINE');

  const action = (() => {
    if (init.unlocked) {
      return `<button class="primary-button" data-init="${init.id}">${restarting ? '回到世界线' : '开始新的世界线'} <span>↗</span></button>`;
    }
    if (init.stage === 'purchaseable') {
      return `<button class="primary-button" data-init-purchase="${init.id}">购买解锁 · ${ctx.escapeHtml(priceText)} <span>↗</span></button>`;
    }
    const label = init.stage === 'presence'
      ? '条件未满足'
      : isFree
        ? '条件未满足'
        : `需要 ${ctx.escapeHtml(priceText)}`;
    return `<span class="selector-detail-lock">${label}</span>`;
  })();

  return `
    <div class="selector-detail" data-selector-detail data-selector-theme-key="init:${init.id}" style="${ctx.escapeHtml(init.themeStyle)}">
      <span class="eyebrow">WORLD LINE / TILT</span>
      <span class="selector-detail-figure">TILT ${ctx.escapeHtml(initTiltText(init))}</span>
      <p>${ctx.escapeHtml(desc)}</p>
      ${metaBits.length ? `<div class="selector-detail-meta">${metaBits.map(b => `<span>${ctx.escapeHtml(b)}</span>`).join('')}</div>` : ''}
      <div class="selector-detail-actions">${action}</div>
      ${restarting ? '<p class="selector-detail-note">当前世界线进度已保存，切换后仍可随时返回。</p>' : ''}
    </div>`;
}

/** 右侧工作台的世界线详情，供整页渲染与节点刷新共用。 */
export function renderInitDetail(
  ctx: UIContext,
  mode: InitSelectMode = 'new',
  selectedId: string | null = null,
): string {
  const list = visibleInitsByTilt(ctx);
  const selected = list.find(init => init.id === selectedId) ?? list[0];
  if (!selected) return '<div class="selector-detail selector-detail-empty"><p>暂无可选的世界线。</p></div>';
  return detailHtml(ctx, selected, mode === 'restart');
}

/** 进入前的只读中转页；预览快照不恢复世界线，确认按钮仍由 Controller 发命令。 */
export function renderInitOverview(ctx: UIContext, initId: string): string {
  const init = summarize(ctx).find(candidate => candidate.id === initId && candidate.unlocked);
  if (!init) return '';
  const progress = init.active ? ctx.view : ctx.game.state.initSnapshots?.[initId];
  const areaIds = ctx.world.areasOfInit(initId);
  const spotIds = areaIds.flatMap(id => ctx.world.spotsOfArea(id));
  const visited = areaIds.filter(id => progress?.visitedAreas.includes(id)).length;
  const built = spotIds.filter(id => (progress?.spotLevels[id] ?? 0) > 0).length;
  const area = progress?.currentAreaId ? ctx.world.areas.get(progress.currentAreaId) : undefined;
  return `
    <header class="selector-init-overview-head">
      <span class="eyebrow">世界线概览</span>
      <h1 tabindex="-1" data-selector-init-overview-title>${ctx.escapeHtml(init.name)}</h1>
      <span class="selector-workbench-badge is-${initNodeState(init)}">${init.active ? '当前世界线' : '已解锁'}</span>
    </header>
    <div class="selector-init-overview-content">
      <p id="selector-init-description">${ctx.escapeHtml(init.description)}</p>
      <span class="selector-detail-figure">TILT ${ctx.escapeHtml(initTiltText(init))}</span>
      <dl class="selector-init-progress">
        <div><dt>当前区域</dt><dd>${ctx.escapeHtml(area?.name ?? '尚未进入')}</dd></div>
        <div><dt>已探索区域</dt><dd>${visited} / ${init.areaCount}</dd></div>
        <div><dt>已建设施</dt><dd>${built} / ${init.spotCount}</dd></div>
      </dl>
    </div>
    <div class="selector-init-overview-actions">
      <button type="button" class="primary-button" data-init="${ctx.escapeHtml(init.id)}" data-init-confirm>进入世界线 <span>↗</span></button>
      <button type="button" class="toolbar-button" data-selector-init-overview-back>返回星图</button>
    </div>`;
}
