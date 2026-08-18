import { RevealStage, ResourceAmount } from '../../engine/types';
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
}

function summarize(ctx: UIContext): InitSummary[] {
  return [...ctx.game.registry.inits.values()].map(init => {
    const areas = ctx.game.registry.areasOfInit(init.id);
    const spotCount = areas.reduce(
      (sum, areaId) => sum + ctx.game.registry.spotsOfArea(areaId).length,
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
    };
  });
}

/** 将 ResourceAmount 数组格式化为可读文本。 */
function formatCost(ctx: UIContext, cost: ResourceAmount[]): string {
  return cost.map(c => `${c.amount} ${ctx.nameOf('resource', c.resourceId)}`).join('、');
}

function formatRevealValue(known: boolean, fallback: string): string {
  return known ? fallback : '???';
}

export function renderInitSelect(ctx: UIContext): string {
  const summaries = summarize(ctx);
  const canRestart = !!ctx.view.activeInit;

  const cards = summaries.map((init, index) => {
    const { stage } = init;
    const isFree = init.purchaseCost.length === 0;

    // L0 完全不可见 → 不渲染
    if (stage === 'invisible') return '';

    // L1 presence → 占位黑盒
    if (stage === 'presence') {
      return `
        <div class="init-card init-card--locked hover-wrap" data-tooltip="init:${init.id}">
          <div class="init-card-top">
            <span class="init-index">0${index + 1}</span>
            <span class="init-count">???</span>
          </div>
          <div class="init-card-copy">
            <h2>???</h2>
            <p>这条世界线尚被迷雾笼罩……</p>
          </div>
          <span class="init-enter init-enter--locked">条件未满足</span>
        </div>`;
    }

    // L6 已解锁 → 可进入
    if (init.unlocked) {
      return `
        <button class="init-card hover-wrap" data-tooltip="init:${init.id}" data-init="${init.id}">
          <div class="init-card-top">
            <span class="init-index">0${index + 1}</span>
            <span class="init-count">${init.areaCount} AREA · ${init.spotCount} SPOT</span>
          </div>
          <div class="init-card-copy">
            <h2>${ctx.escapeHtml(init.name)}</h2>
            <p>${ctx.escapeHtml(init.description)}</p>
          </div>
          <span class="init-enter">${canRestart ? '回到世界线' : '开始新的世界线'} <span>↗</span></span>
        </button>`;
    }

    // 未解锁
    const displayName = init.nameKnown ? init.name : '???';
    const displayArea = formatRevealValue(init.utilityKnown, `${init.areaCount} AREA · ${init.spotCount} SPOT`);
    const displayDesc = init.utilityKnown
      ? init.description
      : init.nameKnown
        ? '这条世界线的详情尚待揭示……'
        : '这条世界线若隐若现……';
    const priceText = init.conditionKnown
      ? (isFree ? '免费' : formatCost(ctx, init.purchaseCost))
      : '???';

    // L5 可购买
    if (stage === 'purchaseable') {
      return `
        <button class="init-card init-card--buyable hover-wrap" data-tooltip="init:${init.id}" data-init-purchase="${init.id}">
          <div class="init-card-top">
            <span class="init-index">0${index + 1}</span>
            <span class="init-count">${displayArea}</span>
          </div>
          <div class="init-card-copy">
            <h2>${ctx.escapeHtml(displayName)}</h2>
            <p>${ctx.escapeHtml(displayDesc)}</p>
          </div>
          <span class="init-enter init-enter--buy">
            购买解锁 <span class="init-price">${ctx.escapeHtml(priceText)}</span>
            <span>↗</span>
          </span>
        </button>`;
    }

    // L2 partial / L3 known / L4 utility — 可部分揭示但不可购买
    return `
      <div class="init-card init-card--locked hover-wrap" data-tooltip="init:${init.id}">
        <div class="init-card-top">
          <span class="init-index">0${index + 1}</span>
          <span class="init-count">${displayArea}</span>
        </div>
        <div class="init-card-copy">
          <h2>${ctx.escapeHtml(displayName)}</h2>
          <p>${ctx.escapeHtml(displayDesc)}</p>
        </div>
        <span class="init-enter init-enter--locked">
          ${isFree ? '条件未满足' : `需要 ${ctx.escapeHtml(priceText)}`}
        </span>
      </div>`;
  }).join('');

  const activeInitHint = ctx.view.activeInit
    ? `<p>当前世界线进度已保存。切换世界线后仍可随时返回。</p>`
    : `<p>什亭之匣准备就绪。每一条世界线都有独立的经营起点与待书写的日常，进度互不干扰。</p>`;

  return `
    <main class="console-shell init-select-shell">
      <header class="topbar">
        <div class="brand-lockup">
          <span class="signal-dot"></span>
          <div><span class="eyebrow">SCHale / SYSTEM 01</span><h1>AronaClicker</h1></div>
        </div>
        <div class="status-line"><span>${canRestart ? 'RESTART' : 'NEW GAME'}</span><span class="live">● AWAITING INPUT</span></div>
      </header>

      <section class="init-select-hero">
        <span class="eyebrow">SELECT WORLD LINE / INIT</span>
        <h2>选择一条世界线</h2>
        ${activeInitHint}
      </section>

      <section class="init-card-grid">
        ${cards}
      </section>

      ${ctx.saveExists && !canRestart ? `
        <section class="init-continue panel">
          <div><span class="eyebrow">EXISTING SAVE</span><strong>检测到本地存档</strong><p>回到上一次的进度继续经营。</p></div>
          <button id="load-game-init" class="primary-button">读取存档 <span>↗</span></button>
        </section>` : ''}

      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>TS-HTML ENGINE · NO NETWORK</span></footer>
    </main>`;
}
