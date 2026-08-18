import { UIContext } from '../context';

export function renderHeader(ctx: UIContext): string {
  const { view, game } = ctx;
  return `
    <header class="topbar">
      <div class="brand-lockup">
        <span class="signal-dot"></span>
        <div><span class="eyebrow">SCHale / SYSTEM 01</span><h1>AronaClicker</h1></div>
      </div>
      <div class="topbar-right">
        <div class="status-line"><span>WORLDLINE ${view.activeInit ? ctx.nameOf('init', view.activeInit) : '未进入'}</span><span class="live">● LIVE</span></div>
        <div class="save-actions">
          <button id="import-datapack" class="toolbar-button" title="从压缩包加载 Mod 数据包（遍历其中所有 .json 构造 Def）">导入 Mod <span>⇪</span></button>
          <button id="new-game" class="toolbar-button" title="放弃当前进度，选择新的世界线">新游戏 <span>↗</span></button>
          <button id="save-game" class="toolbar-button" title="保存当前进度">保存 <span>↓</span></button>
          <button id="load-game" class="toolbar-button" title="读取本地存档" ${ctx.saveExists ? '' : 'disabled'}>读取 <span>↗</span></button>
          <button id="help-modal" class="toolbar-button" title="关于">?</button>
        </div>
      </div>
    </header>`;
}

export function renderResourceStrip(ctx: UIContext): string {
  const { view, game } = ctx;
  const gainOf = (resourceId: string) =>
    ctx.formatNumber(game.gameNumSystem.evaluateResourceGain(resourceId, game.state as never));
  // 资源条由数据包声明的 resourceDisplays 驱动：
  // 数据包编辑者可自定义显示哪些货币、标签、可选策略（hasAmount）与排序，UI 不再硬编码。
  const items = [...game.registry.resourceDisplays.values()]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(def => {
      const amount = view.resources[def.resourceId] ?? 0;
      if (def.showWhen === 'hasAmount' && amount <= 0) return '';
      return `<span class="res-item hover-wrap" data-tooltip="resource:${def.resourceId}"><span class="eyebrow">${ctx.escapeHtml(def.label)}</span><strong data-resource="${def.resourceId}">${ctx.formatNumber(amount)}</strong><small data-gain="${def.resourceId}">+${gainOf(def.resourceId)}/t</small></span>`;
    })
    .join('');
  return `
    <section class="resource-bar">
      ${items}
      <span class="res-item"><span class="eyebrow">帧</span><strong data-resource="frame">${ctx.formatNumber(view.totalFrames)}</strong></span>
      <button id="tick-now" class="primary-button">推进 <span>↗</span></button>
    </section>`;
}
