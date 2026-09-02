import type { RevealStage } from '../../engine/contracts/reveal';
import type { ResourceAmount } from '../../data-services/contracts/common';
import { compareWorldTilt, normalizeWorldTilt } from '../../engine/stats/world-tilt';
import { UIContext } from '../context';
import { getInitReveal } from './tooltip';

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
  purchaseCost: ResourceAmount[];
  /** 规范化「首.尾15」世界倾斜数值。 */
  worldTilt: string;
  /** 伪装展示字符串：存在时代替数值展示。 */
  worldTiltAlias?: string;
}

/** Init 选择界面模式：new = 新建世界线（开始新的世界线）；restart = 重选世界线（回到世界线）。 */
export type InitSelectMode = 'new' | 'restart';

function summarize(ctx: UIContext): InitSummary[] {
  return [...ctx.world.inits.values()].map(init => {
    const areas = ctx.world.areasOfInit(init.id);
    const spotCount = areas.reduce(
      (sum, areaId) => sum + ctx.world.spotsOfArea(areaId).length,
      0,
    );
    const reveal = getInitReveal(ctx, init);
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
      purchaseCost: init.purchaseCost ?? [],
      worldTilt: normalizeWorldTilt(init.worldTilt),
      worldTiltAlias: init.worldTiltAlias,
    };
  });
}

/** 将 ResourceAmount 数组格式化为可读文本。 */
function formatCost(ctx: UIContext, cost: ResourceAmount[]): string {
  return cost.map(c => `${c.amount} ${ctx.nameOf('resource', c.resourceId)}`).join('、');
}

/** 倾斜值展示：有伪装字符串用伪装串，名称未揭示前不泄露。 */
function tiltText(init: InitSummary): string {
  if (init.stage === 'presence' || !init.nameKnown) return '???';
  return init.worldTiltAlias ?? init.worldTilt;
}

function rowStatus(init: InitSummary): string {
  if (init.unlocked) return 'OWNED · 已解锁';
  if (init.stage === 'purchaseable') return 'BUYABLE · 可购买';
  if (init.stage === 'presence') return 'FOG · 迷雾笼罩';
  return 'LOCKED · 未解锁';
}

function rowHtml(init: InitSummary): string {
  const classes = ['init-row'];
  if (!init.unlocked && init.stage !== 'purchaseable') classes.push('is-locked');
  const name = init.nameKnown || init.unlocked ? init.name : '???';
  return `
    <button class="${classes.join(' ')}" data-init-select="${init.id}" data-tooltip="init:${init.id}">
      <span class="init-row-main">
        <strong>${name}</strong>
        <small>${rowStatus(init)}</small>
      </span>
      <span class="init-row-tilt">${tiltText(init)}</span>
    </button>`;
}

function detailHtml(ctx: UIContext, init: InitSummary, restarting: boolean): string {
  const isFree = init.purchaseCost.length === 0;
  const priceText = init.conditionKnown
    ? (isFree ? '免费' : formatCost(ctx, init.purchaseCost))
    : '???';

  let name = '???';
  let desc = '这条世界线尚被迷雾笼罩……';
  if (init.unlocked || init.utilityKnown) {
    name = init.name;
    desc = init.description;
  } else if (init.nameKnown) {
    name = init.name;
    desc = '这条世界线的详情尚待揭示……';
  }

  const metaBits: string[] = [];
  if (init.nameKnown || init.unlocked) {
    metaBits.push(`${init.areaCount} AREA`, `${init.spotCount} SPOT`);
    if (!isFree && !init.unlocked) metaBits.push(`COST ${priceText}`);
  }

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
    return `<span class="orb-lock">${label}</span>`;
  })();

  return `
    <div class="init-orb-copy">
      <span class="eyebrow">WORLD LINE / TILT</span>
      <span class="orb-big">TILT ${ctx.escapeHtml(tiltText(init))}</span>
      <h2>${ctx.escapeHtml(name)}</h2>
      <p>${ctx.escapeHtml(desc)}</p>
      ${metaBits.length ? `<div class="orb-meta">${metaBits.map(b => `<span>${ctx.escapeHtml(b)}</span>`).join('')}</div>` : ''}
      <div class="orb-actions">${action}</div>
      ${restarting ? '<p class="orb-note">当前世界线进度已保存，切换后仍可随时返回。</p>' : ''}
    </div>`;
}

/** 按 TILT 降序排列的可见世界线（invisible 不入列）。 */
export function visibleInitsByTilt(ctx: UIContext): InitSummary[] {
  return summarize(ctx)
    .sort((a, b) => compareWorldTilt(b.worldTilt, a.worldTilt))
    .filter(init => init.stage !== 'invisible');
}

/** 左侧详情（坐在圆盘弧上的文案块），供整页渲染与轮盘切换局部刷新共用。 */
export function renderInitDetail(
  ctx: UIContext,
  mode: InitSelectMode = 'new',
  selectedId: string | null = null,
): string {
  const list = visibleInitsByTilt(ctx);
  const selected = list.find(init => init.id === selectedId) ?? list[0];
  if (!selected) return '<div class="init-orb-copy"><p>暂无可选的世界线。</p></div>';
  return detailHtml(ctx, selected, mode === 'restart');
}

/** 单张轮盘卡片，供解锁等状态变化后的局部替换（避免整页重渲染）。 */
export function renderInitRow(ctx: UIContext, initId: string): string | null {
  const init = visibleInitsByTilt(ctx).find(summary => summary.id === initId);
  return init ? rowHtml(init) : null;
}
