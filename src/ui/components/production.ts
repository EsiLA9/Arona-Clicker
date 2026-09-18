import { UIContext } from '../context';
import { getSpotReveal, describeCondition, getSpotYieldBreakdown } from './tooltip';
import { cardAccent, accentPalette } from '../color-scheme';
import { themeTreeFromThemeDef, themeTreeFromGroup, themeTreeToInlineStyle } from '../theme-tree';
import { TagPath } from '../../engine/core/tag';
import { renderPresentationHostBackground } from '../presentation-service';
import { SYSTEM_DEFAULT_PRIMARY } from '../../engine/core/theme-defaults';
import type { RuntimeModDraft } from '../../arona-clicker/contracts';
import { resolveEntityPresentation, renderEntityPresentationOptions } from './entity-presentation';

/**
 * 设施标签 → 语义颜色角色（硬编码映射，不读数据包 extra）。
 * 按标签叶节点匹配，首个命中生效；无命中回退主色。
 */
const SPOT_TAG_SCHEME: Record<string, string> = {
  defense: 'danger',
  combat:  'danger',
  field:   'npc',
  tactical: 'success',
  intel:   'success',
  tech:    'purple',
};

/** 从 Spot 标签推导语义颜色角色（无匹配 → primary 默认蓝）。 */
function spotColorScheme(tags: TagPath[] | undefined): string {
  for (const path of tags ?? []) {
    const leaf = path[path.length - 1];
    const scheme = SPOT_TAG_SCHEME[leaf];
    if (scheme) return scheme;
  }
  return 'primary';
}

function formatSpotYields(ctx: UIContext, spot: Parameters<typeof getSpotYieldBreakdown>[1]): string {
  const outputs = getSpotYieldBreakdown(ctx, spot).outputs;
  return outputs.length > 0
    ? outputs.map(output => `${ctx.formatNumber(output.amount)} ${ctx.escapeHtml(ctx.nameOf('resource', output.resource))}/t`).join(' · ')
    : '无持续产出';
}
import { existenceCondition, unlockCondition } from '../../engine/visibility/reveal';

export function renderProductionNodes(ctx: UIContext, spotId?: string): string {
  const { game, view } = ctx;
  const world = game.world;
  // 只展示当前 Area 下的 Spot；移动 Area 后设施列表随之切换。
  const currentAreaId = view.currentAreaId;
  const runtimeMod = (game as typeof game & { getRuntimeMod?: () => RuntimeModDraft | null }).getRuntimeMod?.();
  const areaSpotIds = currentAreaId ? new Set(world.spotsOfArea(currentAreaId)) : new Set<string>();
  const spotCards = [...world.spots.values()]
    .filter(spot => areaSpotIds.has(spot.id) && (!spotId || spot.id === spotId))
    .map(spot => {
      const reveal = getSpotReveal(ctx, spot);
      if (reveal.stage === 'invisible') return '';
      const owned = reveal.stage === 'owned';
      const purchaseable = reveal.stage === 'purchaseable';
      const hasPurchaseRoute = game.spot.getPaymentOptions(spot.id, 'unlock').length > 0;
      const level = view.spotLevels[spot.id] ?? 0;
      const visible = view.visibility.spots[spot.id] ?? false;
      const resolvedPresentation = resolveEntityPresentation(ctx, 'spot', spot.id);
      // 最终产出：GameNum 懒求值（按资源拆分），随状态实时变化
      const yieldText = reveal.utilityKnown
        ? `产出 ${formatSpotYields(ctx, spot)}`
        : '产出 ???';
      const title = reveal.nameKnown ? (resolvedPresentation?.name ?? spot.name) : '???';
      const effectiveTags = world.effectiveSpotTags(spot.id, game.state.spotTagOverrides);
      const tags = reveal.utilityKnown
        ? (effectiveTags.map(tag => world.tagNameForSpotTag?.(spot.id, tag) ?? world.tagName(tag)).join(' / ') || 'SPOT')
        : '未解锁设施';
      const desc = reveal.utilityKnown
        ? `<p>${ctx.escapeHtml(resolvedPresentation?.description ?? spot.description)}</p>`
        : '';
      const conditionNote = !owned && !purchaseable && reveal.conditionKnown
        ? `<small class="mini-note">条件：${ctx.escapeHtml(describeCondition(unlockCondition(spot.revealTriggers) ?? existenceCondition(spot.revealTriggers), ctx.nameOf))}</small>`
        : '';
      // 外源/内源交互功能：软重启（保留快照）/ 硬重置（删除快照）/ 招募
      const restartInit = reveal.utilityKnown
        && game.spotFunctionalitySystem.hasFunctionality(spot, game.state, 'restartInit');
      const hardResetInit = reveal.utilityKnown
        && game.spotFunctionalitySystem.hasFunctionality(spot, game.state, 'hardResetInit');
      const gacha = reveal.utilityKnown
        && game.spotFunctionalitySystem.hasFunctionality(spot, game.state, 'gacha');
      const shop = reveal.utilityKnown
        && game.spotFunctionalitySystem.hasFunctionality(spot, game.state, 'shop');
      const isRuntimeSpot = runtimeMod != null
        && runtimeMod.spots.some(runtimeSpot => `${runtimeMod!.modName}:spot:${runtimeSpot.idName}` === spot.id)
        && !(runtimeMod.suspendedSpotIds ?? []).includes(spot.id.split(':').pop() ?? '');
      const action = owned
        ? '升级'
        : purchaseable
          ? '获取'
          : hasPurchaseRoute ? '未解锁' : '无购买途径';
      const accentStyle = cardAccent(spotColorScheme(effectiveTags));
      // 设施自有主题：声明 theme 或 colorGroupId 时，构建其 ThemeTree 并作用域化落到卡片
      // （绕过全局参考树，直接 fill styles），使 Spot 卡片自带主题色而不影响整页。
      let spotStyleAttr = accentStyle;
      if (resolvedPresentation?.theme || spot.theme || spot.colorGroupId) {
        const getGroup = (id: string) => ctx.game.registry.colorGroups.get(id);
        const tree = resolvedPresentation?.theme || spot.theme
          ? themeTreeFromThemeDef(resolvedPresentation?.theme ?? spot.theme!, getGroup)
          : (() => {
              const group = spot.colorGroupId ? ctx.game.registry.colorGroups.get(spot.colorGroupId) : undefined;
              return group ? themeTreeFromGroup(group) : undefined;
            })();
        if (tree) {
          const primary = tree['--ac-primary'] ?? SYSTEM_DEFAULT_PRIMARY;
          spotStyleAttr = `style="${themeTreeToInlineStyle(tree)};${accentPalette(primary)}"`;
        }
      }
      return `
        <article class="mini-card hover-wrap presentation-host-target ${visible ? '' : 'is-muted'}" data-ui-spot-card="${spot.id}" data-theme-host-id="card" data-theme-text-mode="${ctx.textColorModeForHost?.('card') ?? 'auto'}" ${spotStyleAttr} data-tooltip="spot:${spot.id}">
          ${renderPresentationHostBackground(ctx, 'card')}
          <div class="mini-card-title-row">
            <h3 class="mini-card-title">${ctx.escapeHtml(title)}</h3>
            <strong class="mini-status">${owned ? `Lv.${level}` : purchaseable ? '可获取' : hasPurchaseRoute ? '未解锁' : '无购买途径'}</strong>
          </div>
          ${desc}
          ${reveal.utilityKnown ? renderEntityPresentationOptions(ctx, 'spot', spot.id) : ''}
          <div class="mini-card-foot">
            ${reveal.utilityKnown
              ? `<span class="mini-yield" data-spot-yield="${spot.id}">${yieldText}</span>`
              : '<span class="mini-yield">产出 ???</span>'}
            <div class="mini-actions">
              <button class="mini-action presentation-host-target" data-theme-host-id="card.action" data-theme-state="${purchaseable || owned ? 'inactive' : 'disabled'}" data-theme-text-mode="${ctx.textColorModeForHost?.('card.action', purchaseable || owned ? 'inactive' : 'disabled') ?? 'auto'}" data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost('card.action')}" data-upgrade="${spot.id}" ${purchaseable || owned ? '' : 'disabled'}>${renderPresentationHostBackground(ctx, 'card.action', 'presentation-host-background', purchaseable || owned ? 'inactive' : 'disabled')}<span class="presentation-host-content">${action}</span></button>
              ${restartInit
                ? `<button class="mini-action presentation-host-target" data-theme-host-id="card.action" data-theme-state="inactive" data-theme-text-mode="${ctx.textColorModeForHost?.('card.action', 'inactive') ?? 'auto'}" data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost('card.action')}" data-restart-init="${spot.id}" title="结束当前游戏并重新选择世界线">${renderPresentationHostBackground(ctx, 'card.action', 'presentation-host-background', 'inactive')}<span class="presentation-host-content">结束游戏</span></button>`
                : ''}
              ${hardResetInit
                ? `<button class="mini-action presentation-host-target" data-theme-host-id="card.action" data-theme-state="inactive" data-theme-text-mode="${ctx.textColorModeForHost?.('card.action', 'inactive') ?? 'auto'}" data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost('card.action')}" data-hard-reset-init="${spot.id}" title="彻底重置当前世界线（下次进入为崭新）">${renderPresentationHostBackground(ctx, 'card.action', 'presentation-host-background', 'inactive')}<span class="presentation-host-content">彻底重置</span></button>`
                : ''}
              ${gacha
                ? `<button class="mini-action presentation-host-target" data-theme-host-id="card.action" data-theme-state="inactive" data-theme-text-mode="${ctx.textColorModeForHost?.('card.action', 'inactive') ?? 'auto'}" data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost('card.action')}" data-open-spot-gacha="${spot.id}" title="在该设施招募角色">${renderPresentationHostBackground(ctx, 'card.action', 'presentation-host-background', 'inactive')}<span class="presentation-host-content">招募</span></button>`
                : ''}
              ${shop
                ? `<button class="mini-action presentation-host-target" data-theme-host-id="card.action" data-theme-state="inactive" data-theme-text-mode="${ctx.textColorModeForHost?.('card.action', 'inactive') ?? 'auto'}" data-theme-hover-text-mode="${ctx.hoverTextColorModeForHost('card.action')}" data-open-spot-shop="${spot.id}" title="打开商店">${renderPresentationHostBackground(ctx, 'card.action', 'presentation-host-background', 'inactive')}<span class="presentation-host-content">商店</span></button>`
                : ''}
              ${isRuntimeSpot
                ? `<button class="mini-action" data-runtime-spot-edit="${spot.id}">编辑</button><button class="mini-action" data-runtime-spot-delete="${spot.id}">删除</button>`
                : ''}
            </div>
          </div>
          ${conditionNote}
        </article>`;
    }).join('');

  const activeInArea = [...areaSpotIds].filter(spotId => (view.spotLevels[spotId] ?? 0) > 0).length;
  return `
    <div class="mini-panel-head"><span class="eyebrow">运营设施</span><span class="count">${activeInArea} ACTIVE</span></div>
    <div class="mini-card-grid">${spotCards || '<div class="empty">当前区域没有设施</div>'}</div>`;
}

/** 只生成一张已存在的 Spot 卡片；找不到或当前不可见时返回空串，交给 Panel fallback。 */
export function renderSpotCard(ctx: UIContext, spotId: string): string {
  if (!ctx.game.world.spots.has(spotId)) return '';
  const template = document.createElement('template');
  template.innerHTML = renderProductionNodes(ctx, spotId);
  return [...template.content.querySelectorAll<HTMLElement>('[data-ui-spot-card]')]
    .find(node => node.dataset.uiSpotCard === spotId)?.outerHTML ?? '';
}
