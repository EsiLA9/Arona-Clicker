import { UIContext } from '../context';
import { getSpotReveal, describeCondition } from './tooltip';
import { cardAccent, accentPalette } from '../color-scheme';
import { themeTreeFromThemeDef, themeTreeFromGroup, themeTreeToInlineStyle } from '../theme-tree';
import { TagPath } from '../../engine/core/tag';

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
import { existenceCondition, unlockCondition } from '../../engine/visibility/reveal';

export function renderProductionNodes(ctx: UIContext): string {
  const { game, view } = ctx;
  const registry = game.registry;
  // 只展示当前 Area 下的 Spot；移动 Area 后设施列表随之切换。
  const currentAreaId = view.currentAreaId;
  const areaSpotIds = currentAreaId ? new Set(game.registry.spotsOfArea(currentAreaId)) : new Set<string>();
  const spotCards = [...game.registry.spots.values()]
    .filter(spot => areaSpotIds.has(spot.id))
    .map(spot => {
      const reveal = getSpotReveal(ctx, spot);
      if (reveal.stage === 'invisible') return '';
      const owned = reveal.stage === 'owned';
      const purchaseable = reveal.stage === 'purchaseable';
      const level = view.spotLevels[spot.id] ?? 0;
      const visible = view.visibility.spots[spot.id] ?? false;
      // 最终产出值：GameNum 懒求值（base + 倍率 + 挂载的功能 Affector），随状态实时变化
      const finalYield = reveal.utilityKnown
        ? game.gameNumSystem.evaluateSpotYield(spot.id, game.state)
        : 0;
      const yieldText = reveal.utilityKnown
        ? `产出 ${ctx.formatNumber(finalYield)} / tick`
        : '产出 ???';
      const title = reveal.nameKnown ? spot.name : '???';
      const effectiveTags = game.registry.effectiveSpotTags(spot.id, game.state.spotTagOverrides);
      const tags = reveal.utilityKnown
        ? (effectiveTags.map(tag => registry.tagName(tag)).join(' / ') || 'SPOT')
        : '未解锁设施';
      const desc = reveal.utilityKnown
        ? `<p>${ctx.escapeHtml(spot.description)}</p>`
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
      const action = owned
        ? '升级'
        : purchaseable
          ? '获取'
          : '未解锁';
      const accentStyle = cardAccent(spotColorScheme(effectiveTags));
      // 设施自有主题：声明 theme 或 colorGroupId 时，构建其 ThemeTree 并作用域化落到卡片
      // （绕过全局参考树，直接 fill styles），使 Spot 卡片自带主题色而不影响整页。
      let spotStyleAttr = accentStyle;
      if (spot.theme || spot.colorGroupId) {
        const getGroup = (id: string) => ctx.game.registry.colorGroups.get(id);
        const tree = spot.theme
          ? themeTreeFromThemeDef(spot.theme, getGroup)
          : (() => {
              const group = spot.colorGroupId ? ctx.game.registry.colorGroups.get(spot.colorGroupId) : undefined;
              return group ? themeTreeFromGroup(group) : undefined;
            })();
        if (tree) {
          const primary = tree['--ac-primary'] ?? '#3b9eff';
          spotStyleAttr = `style="${themeTreeToInlineStyle(tree)};${accentPalette(primary)}"`;
        }
      }
      return `
        <article class="mini-card hover-wrap ${visible ? '' : 'is-muted'}" ${spotStyleAttr} data-tooltip="spot:${spot.id}">
          <div class="mini-card-title-row">
            <h3 class="mini-card-title">${ctx.escapeHtml(title)}</h3>
            <strong class="mini-status">${owned ? `Lv.${level}` : purchaseable ? '可获取' : '未解锁'}</strong>
          </div>
          ${desc}
          <div class="mini-card-foot">
            ${reveal.utilityKnown
              ? `<span class="mini-yield" data-spot-yield="${spot.id}">${yieldText}</span>`
              : '<span class="mini-yield">产出 ???</span>'}
            <div class="mini-actions">
              <button class="mini-action" data-upgrade="${spot.id}" ${purchaseable || owned ? '' : 'disabled'}>${action}</button>
              ${restartInit
                ? `<button class="mini-action" data-restart-init="${spot.id}" title="结束当前游戏并重新选择世界线">结束游戏</button>`
                : ''}
              ${hardResetInit
                ? `<button class="mini-action" data-hard-reset-init="${spot.id}" title="彻底重置当前世界线（下次进入为崭新）">彻底重置</button>`
                : ''}
              ${gacha
                ? `<button class="mini-action" data-open-spot-gacha="${spot.id}" title="在该设施招募角色">招募</button>`
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
