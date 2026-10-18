import type {
  MapRunActiveWorkspaceView,
  MapRunFailureWorkspaceView,
  MapRunSuccessWorkspaceView,
  MapRunWorkspaceView,
} from '../../arona-clicker/contracts/runtime';
import type {
  MapRunEncounterDraftToken,
  MapRunEncounterSourceTarget,
  MapRunEncounterSourceOption,
} from '../../arona-clicker/contracts/map-run';
import type { UIContext } from '../context';
import { renderPanelHeaderRegion } from './tabs';
import { renderWorkspaceFrame } from './workspace-frame';
import { renderFlowEntries } from '../flow/flow-render';
import { FLOW_HOST_KEY_ATTRIBUTE, FLOW_STREAM_KEY_ATTRIBUTE, type FlowEntry } from '../flow/flow-entry';
import { MapFlowModel, mapNodeProgressLabel } from '../flow/map-flow-model';
import '../css/map-workspace.css';

function escape(ctx: UIContext, value: string): string {
  return ctx.escapeHtml(value);
}

function regionKey(ctx: UIContext, value: string): string {
  return ` data-map-region-key="${escape(ctx, value)}"`;
}

function focusKey(ctx: UIContext, value: string): string {
  return ` data-map-focus-key="${escape(ctx, value)}"`;
}

function titleContent(ctx: UIContext, title: string, subtitle?: string): string {
  return `<div class="map-workspace__column-heading" role="heading" aria-level="2"${regionKey(ctx, `header:${title}`)}>
    <strong title="${escape(ctx, title)}">${escape(ctx, title)}</strong>${subtitle ? `<small>${escape(ctx, subtitle)}</small>` : ''}
  </div>`;
}

function workspaceFrame(
  ctx: UIContext,
  headers: { left: string; center: string; right: string },
  content: { left: string; center: string; right: string },
): string {
  return renderWorkspaceFrame(ctx, {
    id: 'map',
    layout: { composition: 'columns', responsive: 'default' },
    left: {
      slot: 'left', role: 'party', workspaceOwner: 'map', hostId: 'leftPanel.map.party',
      themeScope: 'left.map.party', surface: 'panel', header: renderPanelHeaderRegion(ctx, 'left', headers.left),
      content: content.left, scroll: 'none',
    },
    center: {
      slot: 'center', role: 'information-flow', workspaceOwner: 'map', hostId: 'centerPanel.map.flow',
      themeScope: 'center.map.flow', surface: 'panel', header: renderPanelHeaderRegion(ctx, 'center', headers.center),
      content: content.center, scroll: 'none',
    },
    right: {
      slot: 'right', role: 'opponents-background', workspaceOwner: 'map', hostId: 'rightPanel.map.context',
      themeScope: 'right.map.context', surface: 'panel', header: renderPanelHeaderRegion(ctx, 'right', headers.right),
      content: content.right, scroll: 'none',
    },
  });
}

function draftAttributes(ctx: UIContext, runId: string, draft: MapRunEncounterDraftToken): string {
  return ` data-map-run-id="${escape(ctx, runId)}" data-map-draft-node-id="${escape(ctx, draft.nodeId)}" data-map-draft-round="${draft.round}" data-map-draft-version="${draft.draftVersion}"${draft.activityId === undefined ? '' : ` data-map-draft-activity-id="${escape(ctx, draft.activityId)}"`}`;
}

function resourceName(ctx: UIContext, resourceId: string): string {
  return escape(ctx, ctx.nameOf('resource', resourceId));
}

function renderActionCosts(
  ctx: UIContext,
  action: NonNullable<MapRunActiveWorkspaceView['actionPreview']>['preparedActions'][number]['preparedAction'],
): string {
  if (!action || action.costs.length === 0) return '';
  return `<small class="map-workspace__action-cost">${action.costs.map(cost =>
    `${cost.scope === 'team' ? '共用' : '个人'} −${ctx.formatNumber(cost.amount)} ${resourceName(ctx, cost.resourceId)}`,
  ).join(' · ')}</small>`;
}

function renderActionHpEffects(action: { readonly hpEffects: readonly { readonly amount: number }[] } | null): string {
  if (!action?.hpEffects.length) return '';
  return `<small class="map-workspace__action-cost">HP ${action.hpEffects.map(effect => `${effect.amount > 0 ? '+' : ''}${effect.amount}`).join(' / ')}</small>`;
}


/** 中部 Flow Host：唯一滚动 owner；条目由共享 renderer 输出，本身不承载业务格式。 */
function renderFlowHost(
  ctx: UIContext,
  runId: string,
  entries: readonly FlowEntry[],
  options: { readonly emptyText?: string; readonly label?: string } = {},
): string {
  const streamKey = escape(ctx, `map:${runId}`);
  const emptyText = escape(ctx, options.emptyText ?? '当前地点暂不可读取。');
  return `<div class="map-workspace__feed" data-map-region-key="talk-feed" data-scroll-owner="content-region" ${FLOW_HOST_KEY_ATTRIBUTE}="${streamKey}" ${FLOW_STREAM_KEY_ATTRIBUTE}="${streamKey}" role="log" aria-label="${escape(ctx, options.label ?? '当前行动信息')}">
    ${entries.length ? renderFlowEntries(ctx, entries) : `<p class="map-workspace__empty" role="status">${emptyText}</p>`}
  </div>`;
}

/**
 * 取当前 Run 的条目：Controller 提供真正的流实例（含查询与会话观察）；
 * 其他调用方（测试、独立渲染）退回 detached View 基线。
 */
function flowEntriesFor(ctx: UIContext, runId: string, view: MapRunWorkspaceView): readonly FlowEntry[] {
  return ctx.mapFlow?.entriesFor(runId, view, ctx) ?? new MapFlowModel(runId, ctx).sync(view);
}

function sourceTargetLabel(ctx: UIContext, target: MapRunEncounterSourceTarget | null): string {
  if (!target) return '待选择目标';
  return target.kind === 'partyCharacter'
    ? escape(ctx, ctx.nameOf('character', target.characterId))
    : `敌方 ${escape(ctx, target.enemyId)}`;
}

function renderSourceTargetPicker(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  option: MapRunEncounterSourceOption,
  source: 'ability' | 'item',
  itemId: string | null,
  isSelected: boolean,
  selectedTarget: MapRunEncounterSourceTarget | null,
): string {
  if (!isSelected || !view.sourcePreview) return '';
  const preview = view.sourcePreview;
  const draft = draftAttributes(ctx, view.run.runId, { nodeId: preview.nodeId, round: preview.round, draftVersion: preview.draftVersion });
  const targetButtons = option.targetKind === 'partyCharacter'
    ? option.legalTargetCharacterIds.map(characterId => {
        const selected = selectedTarget?.kind === 'partyCharacter' && selectedTarget.characterId === characterId;
        const command = source === 'ability' ? 'data-map-ability-target' : 'data-map-item-target';
        const itemAttribute = source === 'item' ? ` data-item-id="${escape(ctx, itemId ?? '')}"` : '';
        const key = `${source}-target:${option.actionId}:${characterId}`;
        return `<button type="button" class="mini-action map-workspace__target-choice" ${command}${focusKey(ctx, key)} data-action-id="${escape(ctx, option.actionId)}" data-target-character-id="${escape(ctx, characterId)}"${itemAttribute}${draft} aria-pressed="${selected}">${escape(ctx, ctx.nameOf('character', characterId))}</button>`;
      }).join('')
    : option.legalTargetEnemyIds.map(enemyId => {
        const selected = selectedTarget?.kind === 'enemy' && selectedTarget.enemyId === enemyId;
        const command = source === 'ability' ? 'data-map-ability-target' : 'data-map-item-target';
        const itemAttribute = source === 'item' ? ` data-item-id="${escape(ctx, itemId ?? '')}"` : '';
        const key = `${source}-target:${option.actionId}:${enemyId}`;
        return `<button type="button" class="mini-action map-workspace__target-choice" ${command}${focusKey(ctx, key)} data-action-id="${escape(ctx, option.actionId)}" data-target-enemy-id="${escape(ctx, enemyId)}"${itemAttribute}${draft} aria-pressed="${selected}">敌方 ${escape(ctx, enemyId)}</button>`;
      }).join('');
  return `<div class="map-workspace__source-targets"${regionKey(ctx, `${source}-targets:${option.actionId}`)} role="group" aria-label="${source === 'ability' ? 'Ability' : 'Item'} ${escape(ctx, option.name)} 的目标"><span>目标：${sourceTargetLabel(ctx, selectedTarget)}</span><div>${targetButtons || '<small>当前没有合法目标。</small>'}</div></div>`;
}

function renderEncounterSources(ctx: UIContext, view: MapRunActiveWorkspaceView): string {
  const preview = view.sourcePreview;
  if (!preview || (preview.abilityOptions.length === 0 && preview.itemOptions.length === 0)) return '';
  const attributes = draftAttributes(ctx, view.run.runId, { nodeId: preview.nodeId, round: preview.round, draftVersion: preview.draftVersion });
  const abilities = preview.abilityOptions.length
    ? `<section class="map-workspace__source-group"${regionKey(ctx, 'ability-options')} aria-label="Ability draft"><h3>Ability</h3>${preview.abilityOptions.map(option => {
        const selected = option.selected;
        return `<article class="map-workspace__source-option"${regionKey(ctx, `ability:${option.actionId}`)}>
          <button type="button" class="mini-action map-workspace__source-choice${selected ? ' is-selected' : ''}" data-map-ability-draft${focusKey(ctx, `ability:${option.actionId}`)} data-action-id="${escape(ctx, option.actionId)}"${attributes} aria-pressed="${selected}"${!option.canPayPlayerCost ? ' disabled' : ''}>
            <strong>${escape(ctx, option.name)}</strong>${option.description ? `<small>${escape(ctx, option.description)}</small>` : ''}
            <small>Ability · 1 PlayerCost · ${option.canPayPlayerCost ? '费用充足' : 'PlayerCost 不足'}</small>${renderActionHpEffects(option)}
          </button>
          ${renderSourceTargetPicker(ctx, view, option, 'ability', null, selected, preview.selectedAbilityTarget)}
        </article>`;
      }).join('')}<button type="button" class="mini-action map-workspace__source-clear" data-map-ability-clear${focusKey(ctx, 'ability-clear')}${attributes}${preview.selectedAbilityActionId === null ? ' disabled' : ''}>清除 Ability</button></section>`
    : '';
  const items = preview.itemOptions.length
    ? `<section class="map-workspace__source-group"${regionKey(ctx, 'item-options')} aria-label="Item draft"><h3>Item</h3>${preview.itemOptions.map(option => {
        const selected = option.selected;
        return `<article class="map-workspace__source-option"${regionKey(ctx, `item:${option.itemId}`)}>
          <button type="button" class="mini-action map-workspace__source-choice${selected ? ' is-selected' : ''}" data-map-item-draft${focusKey(ctx, `item:${option.itemId}`)} data-item-id="${escape(ctx, option.itemId)}" data-action-id="${escape(ctx, option.actionId)}"${attributes} aria-pressed="${selected}"${!option.canUse ? ' disabled' : ''}>
            <strong>${escape(ctx, option.itemName)}</strong>${option.itemDescription ? `<small>${escape(ctx, option.itemDescription)}</small>` : ''}
            <small>库存 ${option.inventoryCount} · 条件${option.useConditionSatisfied ? '满足' : '未满足'} · ${option.canUse ? '可使用' : '暂不可用'}</small>${renderActionHpEffects(option)}
          </button>
          ${renderSourceTargetPicker(ctx, view, option, 'item', option.itemId, selected, preview.selectedItemTarget)}
        </article>`;
      }).join('')}<button type="button" class="mini-action map-workspace__source-clear" data-map-item-clear${focusKey(ctx, 'item-clear')}${attributes}${preview.selectedItemId === null ? ' disabled' : ''}>清除 Item</button></section>`
    : '';
  return `<div class="map-workspace__sources" data-map-region-key="source-options" aria-label="Ability 与 Item 选择">${abilities}${items}</div>`;
}

function renderShopDock(ctx: UIContext, view: MapRunActiveWorkspaceView): string {
  const shop = view.shop;
  if (!shop) return '';
  const draftAttributes = ` data-map-shop-node-id="${escape(ctx, shop.nodeId)}" data-map-shop-activity-id="${escape(ctx, shop.activityId)}" data-map-shop-draft-version="${shop.draftVersion}" data-map-run-id="${escape(ctx, view.run.runId)}"`;
  const offers = shop.offers.map(offer => {
    const costs = offer.costs.length
      ? offer.costs.map(cost => `${resourceName(ctx, cost.resourceId)} −${ctx.formatNumber(cost.amount)}`).join(' · ')
      : '免费';
    const effects = offer.effects.map(effect =>
      `${resourceName(ctx, effect.resourceId)} ${effect.amount > 0 ? '+' : ''}${ctx.formatNumber(effect.amount)}`,
    ).join(' · ');
    const heal = offer.heal
      ? `${escape(ctx, ctx.nameOf('character', offer.heal.characterId))} HP +${ctx.formatNumber(offer.heal.amount)}`
      : '';
    return `<li class="map-workspace__shop-offer"${regionKey(ctx, `shop-offer:${offer.offerId}`)}>
      <button type="button" class="mini-action map-workspace__shop-buy" data-map-shop-offer data-offer-id="${escape(ctx, offer.offerId)}"${focusKey(ctx, `shop:${offer.offerId}`)}${draftAttributes}${offer.canPurchase ? '' : ' disabled'}>
        <strong>${escape(ctx, offer.name)}</strong>
        ${offer.description ? `<small>${escape(ctx, offer.description)}</small>` : ''}
        <small>${escape(ctx, costs)}${effects ? ` → ${escape(ctx, effects)}` : ''}${heal ? ` · ${heal}` : ''}</small>
        <span>${offer.canPurchase ? '购买' : '资源不足'}</span>
      </button>
    </li>`;
  }).join('');
  return `<section class="map-workspace__action-dock map-workspace__shop" data-map-region-key="shop-dock" aria-label="${escape(ctx, shop.title)}">
    <div class="map-workspace__dock-resources">${renderTeamResources(ctx, view)}</div>
    <div class="map-workspace__feed-shop"${regionKey(ctx, 'shop-heading')}>
      <h2>${escape(ctx, shop.title)}</h2>
      ${shop.description ? `<p>${escape(ctx, shop.description)}</p>` : ''}
      <p class="map-workspace__dock-note">最近购买会作为信息流条目出现；离开商店后只保留当前来源可读的内容。</p>
    </div>
    <div class="map-workspace__options-scroll" data-map-region-key="shop-options" data-scroll-owner="content-region" aria-label="商店商品">
      ${offers ? `<ul class="map-workspace__shop-list">${offers}</ul>` : '<p class="map-workspace__dock-note">商店当前没有商品。</p>'}
    </div>
    <footer class="map-workspace__commit-dock" data-map-region-key="shop-exit-dock">
      <p role="status" aria-live="polite">购买会立即结算；离开后进入本地点下一项活动。</p>
      <button type="button" class="mini-action map-workspace__shop-leave" data-map-shop-leave${focusKey(ctx, 'shop-leave')}${draftAttributes}>离开商店</button>
    </footer>
  </section>`;
}

function renderTeamResources(ctx: UIContext, view: MapRunActiveWorkspaceView): string {
  const balances = view.run.teamResources.length
    ? view.run.teamResources.map(balance => `${resourceName(ctx, balance.resourceId)} ${ctx.formatNumber(balance.value)}`).join(' · ')
    : '—';
  return `<div class="map-workspace__resources" data-map-region-key="shared-resources" aria-label="共享资源余额">
    <p><span>PlayerCost</span><strong>${ctx.formatNumber(view.run.playerCost)}</strong></p>
    <p><span>共用资源</span><strong>${balances}</strong></p>
  </div>`;
}

function renderCommitDiagnostic(ctx: UIContext, diagnostics: readonly string[]): string {
  if (diagnostics.some(message => message.includes('target selection'))) return '请为所有需要目标的行动选择对象后再提交。';
  if (diagnostics.some(message => message.includes('combined PlayerCost costs'))) return '本轮总 PlayerCost 不足，请清除 Ability 或 PlayerCommand。';
  const resourceMatch = diagnostics[0]?.match(/resource cost "([^"]+)"/);
  if (resourceMatch) return `全队行动需要更多${resourceName(ctx, resourceMatch[1])}，请调整行动。`;
  if (diagnostics.some(message => message.includes('PlayerCommand costs'))) return 'PlayerCost 不足以支付本轮指令，请清除或更换指令。';
  if (diagnostics.some(message => message.includes('invalid balance') || message.includes('without a MapRun balance'))) return '本轮费用或效果无法形成有效资源余额，请调整行动。';
  return '本轮行动暂不能提交，请调整行动后重试。';
}

function renderOverride(ctx: UIContext, view: MapRunActiveWorkspaceView): string {
  const preview = view.actionPreview;
  if (!preview) return '';
  const entries = preview.overrides.map(override => {
    const action = preview.preparedActions.find(row => row.characterId === override.characterId)?.preparedAction;
    const label = `${escape(ctx, ctx.nameOf('character', override.characterId))}${action ? ` · ${escape(ctx, action.name)}` : ''} · ${override.kind === 'swap' ? '免费 Swap' : 'PlayerCommand · 1 PlayerCost'}`;
    return `<li class="map-workspace__override-entry" data-map-override-character="${escape(ctx, override.characterId)}"${regionKey(ctx, `override:${override.characterId}`)}>
      <span>${label}</span>
      <button type="button" class="mini-action map-workspace__clear-override" data-map-clear-override data-character-id="${escape(ctx, override.characterId)}"${focusKey(ctx, `clear-override:${override.characterId}`)}${draftAttributes(ctx, view.run.runId, preview.draft)}>恢复默认</button>
    </li>`;
  }).join('');
  return `<section class="map-workspace__override" data-map-region-key="shared-override" aria-label="本轮行动修订">
    <div><strong>行动修订</strong><span>${preview.overrides.length ? `已修订 ${preview.overrides.length} 名角色` : '本轮无修订；点选手牌可随时改回默认。'}</span></div>
    ${entries ? `<ul class="map-workspace__override-list">${entries}</ul>` : ''}
  </section>`;
}

function renderActionDock(ctx: UIContext, view: MapRunActiveWorkspaceView): string {
  if (view.shop) return renderShopDock(ctx, view);
  const preview = view.actionPreview;
  const encounter = view.currentEncounter;
  const completion = encounter?.completion?.kind === 'manual'
    ? `<button type="button" class="mini-action map-workspace__complete" data-map-complete-encounter${focusKey(ctx, `complete:${encounter.nodeId}`)} data-map-run-id="${escape(ctx, view.run.runId)}">${escape(ctx, encounter.completion.label)}</button>`
    : '';
  const completionNote = encounter && !completion
    ? encounter.enemies.length > 0
      ? '<p class="map-workspace__dock-note">击败所有 Enemy 后战斗会自动结束。</p>'
      : '<p class="map-workspace__dock-note">当前遭遇没有可手动提交的完成操作。</p>'
    : '';
  if (!preview) {
    return `<section class="map-workspace__action-dock" data-map-region-key="action-dock" aria-label="当前行动操作">
      ${renderTeamResources(ctx, view)}
      ${completion}
      ${completionNote}
      <p class="map-workspace__dock-note" role="status">${encounter ? '行动预览暂不可用，请返回地图后重新进入遭遇。' : '当前没有活动遭遇。'}</p>
    </section>`;
  }

  const commitStatus = preview.commitPreview.canCommit
    ? `本轮可提交 · 预计消耗 ${ctx.formatNumber(preview.commitPreview.playerCostRequired ?? 0)} PlayerCost`
    : renderCommitDiagnostic(ctx, preview.commitPreview.diagnostics);
  const commitButton = `<button type="button" class="mini-action map-workspace__commit" data-map-commit${focusKey(ctx, 'commit')} data-map-expected-commit-version="${view.run.commitVersion}"${draftAttributes(ctx, view.run.runId, preview.draft)}${preview.commitPreview.canCommit ? '' : ' disabled'}>提交本轮</button>`;
  return `<section class="map-workspace__action-dock" data-map-region-key="action-dock" aria-label="第 ${preview.round} 轮行动操作">
    <div class="map-workspace__dock-resources">${renderTeamResources(ctx, view)}</div>
    <div class="map-workspace__options-scroll" data-map-region-key="action-options" data-scroll-owner="content-region" aria-label="Ability 与 Item 候选">
      ${renderEncounterSources(ctx, view) || '<p class="map-workspace__dock-note">当前没有可用 Ability 或 Item。</p>'}
    </div>
    ${renderOverride(ctx, view)}
    ${completion}${completionNote}
    <footer class="map-workspace__commit-dock" data-map-region-key="commit-dock">
      <p role="status" aria-live="polite" data-map-commit-status>${escape(ctx, commitStatus)}</p>${commitButton}
    </footer>
  </section>`;
}

function renderActivityProgress(ctx: UIContext, view: MapRunActiveWorkspaceView): string {
  if (view.activities.length === 0) return '';
  const rows = view.activities.map(activity => {
    const state = activity.active ? 'active' : activity.completed ? 'completed' : 'pending';
    const kindLabel = activity.kind === 'battle' ? '战斗'
      : activity.kind === 'rest' ? '休整'
        : activity.kind === 'shop' ? '商店' : '活动';
    return `<li class="map-workspace__activity" data-map-activity-id="${escape(ctx, activity.activityId)}" data-map-activity-state="${state}"${regionKey(ctx, `activity:${activity.activityId}`)}>
      <strong>${activity.index + 1}. ${escape(ctx, activity.title)}</strong>
      <small>${kindLabel}${activity.completed ? ' · 已完成' : activity.active ? ' · 进行中' : ' · 待执行'}</small>
    </li>`;
  }).join('');
  return `<section class="map-workspace__context-section" data-map-region-key="activity-progress" aria-label="本地点固定活动顺序">
    <h2>本地点活动 ${view.activities.filter(activity => activity.completed).length} / ${view.activities.length}</h2>
    <ol class="map-workspace__activity-list">${rows}</ol>
  </section>`;
}

function renderNodeProgress(ctx: UIContext, view: MapRunActiveWorkspaceView): string {
  return `<section class="map-workspace__context-section" data-map-region-key="map-progress" aria-label="地图地点进度">
    <h2>地图地点</h2><ol class="map-workspace__node-list">${view.map.nodes.map(node => {
      const current = node.id === view.run.currentNodeId;
      const completed = view.run.completedEncounterNodeIds.includes(node.id);
      const visited = view.run.visitedNodeIds.includes(node.id);
      const status = current ? 'current' : completed ? 'completed' : visited ? 'visited' : 'unvisited';
      return `<li class="map-workspace__node${current ? ' is-active' : ''}" data-map-node-id="${escape(ctx, node.id)}" data-map-status="${status}"${regionKey(ctx, `map-node:${node.id}`)}${view.map.exitNodeIds.includes(node.id) ? ' data-map-exit' : ''}${current ? ' aria-current="location"' : ''}>
        <strong>${escape(ctx, node.title)}</strong><small>${escape(ctx, mapNodeProgressLabel(view, node))}</small>
      </li>`;
    }).join('')}</ol>
  </section>`;
}

function renderEnemyRegion(ctx: UIContext, runId: string, view: MapRunActiveWorkspaceView | null): string {
  const encounter = view?.currentEncounter ?? null;
  const nodeId = encounter?.nodeId ?? '';
  const enemies = encounter?.enemies ?? [];
  const content = enemies.length
    ? `<section class="map-workspace__context-section" data-map-region-key="enemy-list" aria-label="活动敌方">
        <h2>活动敌方</h2><ul class="map-workspace__enemy-list">${enemies.map(enemy => `<li${regionKey(ctx, `enemy:${enemy.enemyId}`)} data-map-enemy-hp="${escape(ctx, enemy.enemyId)}">
          <strong>敌方 ${escape(ctx, enemy.enemyId)}</strong><span>${enemy.currentHp} / ${enemy.maxHp} HP</span>
          <button type="button" class="mini-action map-workspace__enemy-info" data-map-enemy-info data-enemy-id="${escape(ctx, enemy.enemyId)}" data-map-run-id="${escape(ctx, runId)}"${focusKey(ctx, `enemy-info:${enemy.enemyId}`)} aria-label="查看敌方 ${escape(ctx, enemy.enemyId)} 的当前情报">查看情报</button>
        </li>`).join('')}</ul>
      </section>`
    : encounter
      ? `<p class="map-workspace__dock-note" data-map-region-key="enemy-empty">当前遭遇没有敌方单位。</p>`
      : `<p class="map-workspace__dock-note" data-map-region-key="enemy-empty">当前没有活动敌人。</p>`;
  const state = encounter ? 'active' : view?.run.status === 'success' ? 'success' : 'none';
  return `<div class="map-workspace__encounter-region" data-map-encounter-region data-map-run-id="${escape(ctx, runId)}" data-map-encounter-node-id="${escape(ctx, nodeId)}"${regionKey(ctx, 'enemy-region')} data-map-encounter-state="${state}">${content}</div>`;
}

/** Keeps the legacy Encounter anchor available to existing controller integrations. */
export function renderMapEncounterRegion(
  ctx: UIContext,
  runId: string,
  view: MapRunWorkspaceView | null,
): string | null {
  if (!view || view.kind !== 'active' || view.run.runId !== runId) return null;
  return renderEnemyRegion(ctx, runId, view);
}

function renderActivePartyMember(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  prepared: NonNullable<MapRunActiveWorkspaceView['actionPreview']>['preparedActions'][number],
): string {
  const preview = view.actionPreview!;
  const actorName = escape(ctx, ctx.nameOf('character', prepared.characterId));
  const runHp = view.run.partyHp.find(row => row.characterId === prepared.characterId);
  const encounterHp = view.currentEncounter?.partyHp.find(row => row.characterId === prepared.characterId);
  const actorResources = view.run.actorResources.filter(row => row.characterId === prepared.characterId)
    .map(row => `${resourceName(ctx, row.resourceId)} ${ctx.formatNumber(row.value)}`).join(' · ');
  const attributes = draftAttributes(ctx, view.run.runId, preview.draft);
  const preparedAction = prepared.preparedAction;
  const naturalActionId = prepared.naturalAction?.actionId ?? null;
  const hand = prepared.hand.length
    ? prepared.hand.map(action => {
        const selected = preparedAction?.actionId === action.actionId;
        const isNatural = action.actionId === naturalActionId;
        const key = `swap:${prepared.characterId}:${action.actionId}`;
        const status = selected
          ? isNatural ? '自然准备' : '当前准备'
          : isNatural ? '恢复默认' : '免费换用';
        return `<button type="button" class="mini-action map-workspace__hand-choice${selected ? ' is-selected' : ''}" data-map-action-swap${focusKey(ctx, key)}${regionKey(ctx, key)} data-character-id="${escape(ctx, prepared.characterId)}" data-action-id="${escape(ctx, action.actionId)}"${attributes} aria-pressed="${selected}">
          <strong>${escape(ctx, action.name)}</strong>${action.description ? `<small>${escape(ctx, action.description)}</small>` : ''}${renderActionCosts(ctx, action)}${renderActionHpEffects(action)}
          <span>${status}</span>
        </button>`;
      }).join('')
    : '<p class="map-workspace__empty" role="status">没有可行动候选 · Wait</p>';
  const target = prepared.targetKind === 'partyCharacter'
    ? `<div class="map-workspace__target-picker"${regionKey(ctx, `targets:${prepared.characterId}`)} role="group" aria-label="${actorName} 的行动目标">
        <span>${prepared.targetSelectionRequired ? '选择目标' : '目标'}</span><div>${prepared.legalTargetCharacterIds.map(targetCharacterId => {
          const selected = prepared.targetCharacterId === targetCharacterId;
          const key = `target:${prepared.characterId}:${targetCharacterId}`;
          return `<button type="button" class="mini-action map-workspace__target-choice" data-map-target${focusKey(ctx, key)}${regionKey(ctx, key)} data-character-id="${escape(ctx, prepared.characterId)}" data-target-character-id="${escape(ctx, targetCharacterId)}"${attributes} aria-pressed="${selected}">${escape(ctx, ctx.nameOf('character', targetCharacterId))}</button>`;
        }).join('')}</div>
        ${prepared.legalTargetCharacterIds.length > 1 ? `<button type="button" class="mini-action map-workspace__target-clear" data-map-target-clear${focusKey(ctx, `target-clear:${prepared.characterId}`)} data-character-id="${escape(ctx, prepared.characterId)}"${attributes}>清除目标</button>` : ''}
      </div>`
    : prepared.targetKind === 'enemy'
      ? `<div class="map-workspace__target-picker"${regionKey(ctx, `targets:${prepared.characterId}`)} role="group" aria-label="${actorName} 的 Enemy 目标">
        <span>${prepared.targetSelectionRequired ? '选择 Enemy 目标' : 'Enemy 目标'}</span><div>${prepared.legalTargetEnemyIds.map(enemyId => {
          const selected = prepared.targetEnemyId === enemyId;
          const key = `target-enemy:${prepared.characterId}:${enemyId}`;
          return `<button type="button" class="mini-action map-workspace__target-choice" data-map-target-enemy${focusKey(ctx, key)}${regionKey(ctx, key)} data-character-id="${escape(ctx, prepared.characterId)}" data-target-enemy-id="${escape(ctx, enemyId)}"${attributes} aria-pressed="${selected}">敌方 ${escape(ctx, enemyId)}</button>`;
        }).join('')}</div>
        ${prepared.legalTargetEnemyIds.length > 1 ? `<button type="button" class="mini-action map-workspace__target-clear" data-map-target-enemy-clear${focusKey(ctx, `target-enemy-clear:${prepared.characterId}`)} data-character-id="${escape(ctx, prepared.characterId)}"${attributes}>清除目标</button>` : ''}
      </div>`
    : prepared.targetKind === 'self' ? '<small class="map-workspace__target-label">目标：自身</small>'
      : prepared.targetKind === 'none' ? '<small class="map-workspace__target-label">无目标</small>'
        : '<small class="map-workspace__target-label">无行动目标</small>';
  const preparedSummary = preparedAction
    ? `<div class="map-workspace__prepared-summary"${regionKey(ctx, `prepared:${prepared.characterId}`)}><strong>${escape(ctx, preparedAction.name)}</strong>${preparedAction.description ? `<small>${escape(ctx, preparedAction.description)}</small>` : ''}${renderActionCosts(ctx, preparedAction)}${renderActionHpEffects(preparedAction)}${target}</div>`
    : `<div class="map-workspace__prepared-summary"${regionKey(ctx, `prepared:${prepared.characterId}`)}><strong>Wait</strong><small>本角色本轮没有可行动作。</small>${target}</div>`;
  const commandOverride = preview.overrides.find(override => override.characterId === prepared.characterId) ?? null;
  const commandOptions = preview.playerCommandOptions.filter(option => option.characterId === prepared.characterId);
  const commands = commandOptions.length
    ? `<div class="map-workspace__command-list"${regionKey(ctx, `commands:${prepared.characterId}`)}>${commandOptions.map(option => {
        const selected = commandOverride?.kind === 'playerCommand'
          && commandOverride.actionId === option.action.actionId;
        const disabled = !option.canPayPlayerCost || !option.canPayActionCosts;
        const reasons = [
          !option.canPayPlayerCost ? '需要 1 PlayerCost' : '',
          !option.canPayActionCosts ? '行动资源不足' : '',
        ].filter(Boolean).join(' · ');
        const key = `command:${prepared.characterId}:${option.action.actionId}`;
        return `<button type="button" class="mini-action map-workspace__command-choice${selected ? ' is-selected' : ''}" data-map-player-command${focusKey(ctx, key)}${regionKey(ctx, key)} data-character-id="${escape(ctx, prepared.characterId)}" data-action-id="${escape(ctx, option.action.actionId)}"${attributes} aria-pressed="${selected}"${disabled ? ' disabled' : ''}>
          <strong>${escape(ctx, option.action.name)}</strong>${option.action.description ? `<small>${escape(ctx, option.action.description)}</small>` : ''}
          <small>PlayerCommand · 1 PlayerCost${reasons ? ` · ${escape(ctx, reasons)}` : ''}</small>${renderActionCosts(ctx, option.action)}${renderActionHpEffects(option.action)}
        </button>`;
      }).join('')}</div>`
    : '<p class="map-workspace__empty">没有手牌外指令候选。</p>';

  return `<article class="map-workspace__party-member" data-map-party-member="${escape(ctx, prepared.characterId)}"${regionKey(ctx, `party-member:${prepared.characterId}`)} aria-labelledby="map-party-${escape(ctx, prepared.characterId)}">
    <h2 id="map-party-${escape(ctx, prepared.characterId)}">${actorName}</h2>
    ${runHp ? `<p class="map-workspace__party-stats"${regionKey(ctx, `party-hp:${prepared.characterId}`)}>HP ${runHp.currentHp}${encounterHp ? ` / ${encounterHp.maxHp}` : ''}</p>` : ''}
    ${actorResources ? `<p class="map-workspace__party-stats"${regionKey(ctx, `party-resources:${prepared.characterId}`)}>${actorResources}</p>` : ''}
    <section class="map-workspace__prepared" aria-label="当前准备行动"><span>Prepared</span>${preparedSummary}</section>
    <section class="map-workspace__hand"${regionKey(ctx, `hand:${prepared.characterId}`)} aria-label="${actorName} 的完整 Hand">
      <h3>Hand · ${prepared.hand.length}</h3><div class="map-workspace__hand-list"${regionKey(ctx, `hand-list:${prepared.characterId}`)}>${hand}</div>
    </section>
    <section class="map-workspace__commands" aria-label="手牌外指令候选"><h3>PlayerCommand 候选</h3>${commands}</section>
  </article>`;
}

function renderPassivePartyMember(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  characterId: string,
): string {
  const hp = view.run.partyHp.find(row => row.characterId === characterId);
  const encounterHp = view.currentEncounter?.partyHp.find(row => row.characterId === characterId);
  const balances = view.run.actorResources.filter(row => row.characterId === characterId)
    .map(row => `${resourceName(ctx, row.resourceId)} ${ctx.formatNumber(row.value)}`).join(' · ');
  return `<article class="map-workspace__party-member map-workspace__party-member--passive" data-map-party-member="${escape(ctx, characterId)}"${regionKey(ctx, `party-member:${characterId}`)}>
    <h2>${escape(ctx, ctx.nameOf('character', characterId))}</h2>
    ${hp ? `<p class="map-workspace__party-stats"${regionKey(ctx, `party-hp:${characterId}`)}>HP ${hp.currentHp}${encounterHp ? ` / ${encounterHp.maxHp}` : ''}</p>` : ''}
    ${balances ? `<p class="map-workspace__party-stats"${regionKey(ctx, `party-resources:${characterId}`)}>${balances}</p>` : ''}
  </article>`;
}

function renderParty(ctx: UIContext, view: MapRunActiveWorkspaceView): string {
  const preview = view.actionPreview;
  const preparedByCharacter = new Map(preview?.preparedActions.map(row => [row.characterId, row]) ?? []);
  const members = view.run.party.map(member => {
    const prepared = preparedByCharacter.get(member.characterId);
    return prepared ? renderActivePartyMember(ctx, view, prepared) : renderPassivePartyMember(ctx, view, member.characterId);
  }).join('');
  return `<div class="map-workspace__party-scroll" data-map-region-key="party-scroll" data-scroll-owner="content-region" aria-label="我方队伍">
    ${members || '<p class="map-workspace__empty" role="status">当前没有可显示的队员。</p>'}
  </div>`;
}

function renderFailureParty(ctx: UIContext, view: MapRunFailureWorkspaceView): string {
  const members = view.partyHp.map(member => `<article class="map-workspace__party-member map-workspace__party-member--passive"${regionKey(ctx, `party-member:${member.characterId}`)}>
    <h2>${escape(ctx, ctx.nameOf('character', member.characterId))}</h2><p class="map-workspace__party-stats">HP ${member.currentHp} / ${member.maxHp}</p>
  </article>`).join('');
  return `<div class="map-workspace__party-scroll" data-map-region-key="party-scroll" data-scroll-owner="content-region" aria-label="我方队伍">${members}</div>`;
}

function renderActiveRight(ctx: UIContext, runId: string, view: MapRunActiveWorkspaceView): string {
  const currentNode = view.map.nodes.find(node => node.id === view.run.currentNodeId);
  return `<div class="map-workspace__context-scroll" data-map-region-key="context-scroll" data-scroll-owner="content-region" aria-label="敌方与背景">
    ${renderEnemyRegion(ctx, runId, view)}
    ${renderActivityProgress(ctx, view)}
    <section class="map-workspace__context-section" data-map-region-key="current-background" aria-label="当前地点背景">
      <h2>当前地点</h2>${currentNode ? `<strong>${escape(ctx, currentNode.title)}</strong>${currentNode.description ? `<p>${escape(ctx, currentNode.description)}</p>` : ''}` : '<p class="map-workspace__empty">当前地点暂不可读取。</p>'}
    </section>
    ${renderNodeProgress(ctx, view)}
  </div>`;
}

function renderActiveCenter(ctx: UIContext, runId: string, view: MapRunActiveWorkspaceView, entries: readonly FlowEntry[]): string {
  return `<div class="map-workspace__center-pane" data-map-region-key="center-pane">
    ${renderFlowHost(ctx, runId, entries)}${renderActionDock(ctx, view)}
  </div>`;
}

function renderUnavailable(ctx: UIContext, runId: string): string {
  const safeRunId = escape(ctx, runId);
  const left = `<div class="map-workspace__party-scroll" data-map-region-key="party-scroll" data-scroll-owner="content-region"><p class="map-workspace__empty" role="status">当前地图的队伍信息暂不可读取。</p></div>`;
  const center = `<div class="map-workspace__center-pane" data-map-region-key="center-pane">
    <div class="map-workspace__feed" data-map-region-key="talk-feed" data-scroll-owner="content-region" role="status"><section class="map-workspace__feed-entry"${regionKey(ctx, 'feed-unavailable')}><h1>当前地图进度暂不可用</h1><p>请返回游戏页面后查看可继续的地图入口。</p></section></div>
    <section class="map-workspace__action-dock" data-map-region-key="action-dock"><button type="button" class="mini-action map-workspace__back" data-map-back="${safeRunId}"${focusKey(ctx, 'back-game')}>返回游戏</button></section>
  </div>`;
  const right = `<div class="map-workspace__context-scroll" data-map-region-key="context-scroll" data-scroll-owner="content-region">
    <div class="map-workspace__encounter-region" data-map-encounter-region data-map-run-id="${safeRunId}" data-map-encounter-node-id=""${regionKey(ctx, 'enemy-region')}><p class="map-workspace__empty">当前敌方信息暂不可用。</p></div>
    <section class="map-workspace__context-section" data-map-region-key="current-background"><h2>背景</h2><p class="map-workspace__empty">当前地图不可读取。</p></section>
  </div>`;
  return `<div class="map-workspace__region" data-map-workspace-region data-map-run-id="${safeRunId}">${workspaceFrame(ctx, {
    left: titleContent(ctx, '我方'), center: titleContent(ctx, '暂不可读取'), right: titleContent(ctx, '敌方 / 背景'),
  }, { left, center, right })}</div>`;
}

function renderSuccessResult(ctx: UIContext, runId: string, view: MapRunSuccessWorkspaceView, entries: readonly FlowEntry[]): string {
  const left = `<div class="map-workspace__party-scroll" data-map-region-key="party-scroll" data-scroll-owner="content-region"><p class="map-workspace__empty" role="status">本次地图路线已结束。</p></div>`;
  const center = `<div class="map-workspace__center-pane" data-map-region-key="center-pane">
    ${renderFlowHost(ctx, runId, entries, { label: '地图结果', emptyText: '地图结果暂不可读取。' })}
    <section class="map-workspace__action-dock" data-map-region-key="action-dock"><button type="button" class="mini-action map-workspace__back" data-map-back="${escape(ctx, runId)}"${focusKey(ctx, 'back-game')}>返回游戏</button></section>
  </div>`;
  const right = `<div class="map-workspace__context-scroll" data-map-region-key="context-scroll" data-scroll-owner="content-region">
    <div class="map-workspace__encounter-region" data-map-encounter-region data-map-run-id="${escape(ctx, runId)}" data-map-encounter-node-id=""${regionKey(ctx, 'enemy-region')} data-map-encounter-state="success"><p class="map-workspace__empty">当前没有活动敌人。</p></div>
    <section class="map-workspace__context-section" data-map-region-key="current-background"><h2>地图结果</h2><strong>${escape(ctx, view.result.exitNodeTitle)}</strong></section>
  </div>`;
  return `<div class="map-workspace__region" data-map-workspace-region data-map-run-id="${escape(ctx, runId)}">${workspaceFrame(ctx, {
    left: titleContent(ctx, '我方'), center: titleContent(ctx, view.result.mapName), right: titleContent(ctx, '敌方 / 背景'),
  }, { left, center, right })}</div>`;
}

function renderFailureResult(ctx: UIContext, runId: string, view: MapRunFailureWorkspaceView, entries: readonly FlowEntry[]): string {
  const nodeRows = view.map.nodes.map(node => `<li class="map-workspace__node${node.id === view.result.failedNodeId ? ' is-active' : ''}" data-map-node-id="${escape(ctx, node.id)}"${regionKey(ctx, `map-node:${node.id}`)}${node.id === view.result.failedNodeId ? ' aria-current="location"' : ''}><strong>${escape(ctx, node.title)}</strong>${node.id === view.result.failedNodeId ? '<small>遭遇失败</small>' : ''}</li>`).join('');
  const left = renderFailureParty(ctx, view);
  const center = `<div class="map-workspace__center-pane" data-map-region-key="center-pane">
    ${renderFlowHost(ctx, runId, entries, { label: '探索失败结果', emptyText: '探索失败结果暂不可读取。' })}
    <section class="map-workspace__action-dock" data-map-region-key="action-dock"><button type="button" class="mini-action map-workspace__back" data-map-back="${escape(ctx, runId)}"${focusKey(ctx, 'back-game')}>返回游戏</button></section>
  </div>`;
  const right = `<div class="map-workspace__context-scroll" data-map-region-key="context-scroll" data-scroll-owner="content-region">
    <div class="map-workspace__encounter-region" data-map-encounter-region data-map-run-id="${escape(ctx, runId)}" data-map-encounter-node-id="${escape(ctx, view.result.failedNodeId)}"${regionKey(ctx, 'enemy-region')} data-map-encounter-state="failure"><p class="map-workspace__empty">队伍已无法继续战斗。</p></div>
    <section class="map-workspace__context-section" data-map-region-key="map-progress" aria-label="地图地点"><h2>地图地点</h2><ol class="map-workspace__node-list">${nodeRows}</ol></section>
  </div>`;
  return `<div class="map-workspace__region map-workspace__region--failure" data-map-workspace-region data-map-run-id="${escape(ctx, runId)}">${workspaceFrame(ctx, {
    left: titleContent(ctx, '我方'), center: titleContent(ctx, view.map.name), right: titleContent(ctx, '敌方 / 背景'),
  }, { left, center, right })}</div>`;
}

/** Renders one detached MapRun projection; mutations remain delegated to Controller commands. */
export function renderMapWorkspace(ctx: UIContext, runId: string, view: MapRunWorkspaceView | null): string {
  if (!view) return renderUnavailable(ctx, runId);
  if (view.kind === 'success') {
    return view.result.runId === runId
      ? renderSuccessResult(ctx, runId, view, flowEntriesFor(ctx, runId, view))
      : renderUnavailable(ctx, runId);
  }
  if (view.kind === 'failure') {
    return view.result.runId === runId
      ? renderFailureResult(ctx, runId, view, flowEntriesFor(ctx, runId, view))
      : renderUnavailable(ctx, runId);
  }
  if (view.run.runId !== runId) return renderUnavailable(ctx, runId);
  const entries = flowEntriesFor(ctx, runId, view);

  const mapName = escape(ctx, view.map.name);
  const safeRunId = escape(ctx, runId);
  const back = `<button type="button" class="mini-action map-workspace__back" data-map-back="${safeRunId}"${focusKey(ctx, 'back-game')} aria-label="返回游戏">返回游戏</button>`;
  const centerTitle = `<div class="map-workspace__center-title">${titleContent(ctx, view.map.name)}${back}</div>`;
  const left = renderParty(ctx, view);
  const center = renderActiveCenter(ctx, runId, view, entries);
  const right = renderActiveRight(ctx, runId, view);
  const frame = workspaceFrame(ctx, {
    left: titleContent(ctx, '我方'),
    center: centerTitle,
    right: titleContent(ctx, '敌方 / 背景'),
  }, { left, center, right });
  return `<div class="map-workspace__region${view.currentEncounter ? ' map-workspace__region--encounter' : ''}" data-map-workspace-region data-map-run-id="${safeRunId}" data-map-name="${mapName}">${frame}</div>`;
}
