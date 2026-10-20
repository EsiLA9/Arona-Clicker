import type {
  MapRunActiveWorkspaceView,
  MapRunFailureWorkspaceView,
  MapRunSuccessWorkspaceView,
  MapRunWorkspaceView,
  MapWorkspacePreparedActionView,
  MapWorkspaceActionView,
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
import { FLOW_HOST_KEY_ATTRIBUTE, FLOW_STREAM_KEY_ATTRIBUTE, type FlowEntry, type FlowMapLocations } from '../flow/flow-entry';
import { MapFlowModel } from '../flow/map-flow-model';
import { mapObjectKey, mapUnitKey } from '../workspace/map-relation-presentation';
import {
  mapCardAttachmentAttributes,
  mapCardBindingAttributes,
  mapCardHostAttributes,
  mapCardInstanceKey,
  type MapCardDOMPlacement,
  type MapCardEntry,
  type MapCardUsage,
} from '../cards/card-host';
import { renderMapActionCardButton, renderMapActionCardContent, stableMapActionCardAngle } from '../cards/action-card';
import type { MapRunCardInstance } from '../../arona-clicker/contracts/map-cards';
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

function relationKey(ctx: UIContext, view: MapRunActiveWorkspaceView, kind: string, id: string): string {
  const relation = view.relations.find(row => row.source.kind === kind && row.source.id === id);
  return relation ? ` data-map-relation-key="${escape(ctx, relation.key)}"` : '';
}

function unitKey(view: MapRunActiveWorkspaceView, kind: 'partyCharacter' | 'enemy', id: string): string | undefined {
  const scope = view.relations[0]?.scope;
  return scope ? mapUnitKey(scope, kind, id) : undefined;
}

function findCard(view: MapRunActiveWorkspaceView, ownerId: string, actionId: string): MapRunCardInstance | undefined {
  return view.cards?.find(row => row.owner.kind === 'partyCharacter' && row.owner.id === ownerId && row.actionId === actionId);
}

function findEnemyCard(view: MapRunActiveWorkspaceView, enemyId: string, actionId: string): MapRunCardInstance | undefined {
  return view.cards?.find(row => row.owner.kind === 'enemy' && row.owner.id === enemyId
    && row.zone === 'hand' && row.actionId === actionId);
}

/**
 * One visual copy of a real card or an existing replacement offer.
 * The same object may appear many times; only the instance key differs.
 */
function mapCardAttributes(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  card: MapRunCardInstance | undefined,
  usage: MapCardUsage,
  slot: string,
  entries: readonly MapCardEntry[],
  options: { readonly relationKey?: string; readonly optionId?: string; readonly objectKey?: string } = {},
  placement?: MapCardDOMPlacement,
): string {
  const objectKey = options.objectKey ?? (card ? mapObjectKey(card.ref) : undefined);
  const binding = {
    instanceKey: mapCardInstanceKey(`map:${view.run.runId}`, slot, objectKey),
    usage,
    ...(objectKey ? { objectKey } : {}),
    ...(options.relationKey ? { relationKey: options.relationKey } : {}),
    entries,
    ...(options.optionId ? { optionId: options.optionId } : {}),
  };
  const escapeValue = (value: string) => escape(ctx, value);
  return placement
    ? mapCardAttachmentAttributes(escapeValue, binding, placement)
    : mapCardBindingAttributes(escapeValue, binding);
}

function renderCardTargets(ctx: UIContext, view: MapRunActiveWorkspaceView, prepared: MapWorkspacePreparedActionView): string {
  const candidates = prepared.legalTargetCards ?? [];
  if (!candidates.length) return '<small class="map-workspace__target-label">当前没有合法卡牌目标</small>';
  const relation = view.relations.find(row => row.source.kind === 'preparedAction' && row.source.id === prepared.characterId);
  const actions = view.actionPreview!.preparedActions.flatMap(row => [...row.hand, ...(row.preparedAction ? [row.preparedAction] : [])]);
  return `<div class="map-workspace__target-picker"${regionKey(ctx, `targets:${prepared.characterId}`)} role="group" aria-label="卡牌目标">
    <span>${prepared.targetSelectionRequired ? '选择受用卡牌' : '受用卡牌'}</span><div>${candidates.map(ref => {
      const key = mapObjectKey(ref);
      const card = view.cards.find(row => mapObjectKey(row.ref) === key);
      const action = actions.find(row => row.actionId === card?.actionId);
      const owner = card?.owner.kind === 'partyCharacter' ? ctx.nameOf('character', card.owner.id) : '卡牌';
      const label = `${owner} · ${action?.name ?? '当前卡牌'}`;
      const selected = prepared.targetCard ? mapObjectKey(prepared.targetCard) === key : false;
      const semanticKey = `target-card:${prepared.characterId}:${ref.id}`;
      return `<button type="button" class="mini-action map-workspace__target-choice map-workspace__card-target-choice" data-map-card-target="${escape(ctx, relation?.key ?? '')}"${mapCardAttributes(ctx, view, card, 'offer', `target:${prepared.characterId}:${key}`, ['target'], { objectKey: key, optionId: semanticKey })}${focusKey(ctx, semanticKey)}${regionKey(ctx, semanticKey)} aria-pressed="${selected}">
        <strong>${escape(ctx, label)}</strong><small>${card?.prepared ? '本轮准备牌' : '备选牌'}${selected ? ' · 已选目标' : ''}</small>
      </button>`;
    }).join('')}</div>
  </div>`;
}

function enemyPreparedTargetLabel(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  prepared: NonNullable<MapRunActiveWorkspaceView['actionPreview']>['preparedEnemyActions'][number],
): string {
  if (prepared.skipReason === 'noLegalTarget') return '无法执行：没有合法目标';
  if (!prepared.naturalAction) return '本轮待机';
  if (prepared.targetKind === 'none') return '无目标';
  if (prepared.targetKind === 'self') return '目标：自身';
  if (prepared.targetKind === 'partyCharacter') {
    return prepared.targetCharacterId
      ? `目标角色：${ctx.nameOf('character', prepared.targetCharacterId)}` : '目标角色：待确定';
  }
  if (prepared.targetKind === 'enemy') {
    return prepared.targetEnemyId ? `友方目标：${ctx.nameOf('enemy', prepared.targetEnemyId) || prepared.targetEnemyId}` : '友方目标：待确定';
  }
  if (prepared.targetKind === 'card') {
    if (!prepared.targetCard) return '无法执行：没有合法卡牌目标';
    const card = view.cards.find(row => mapObjectKey(row.ref) === mapObjectKey(prepared.targetCard!));
    const action = view.actionPreview?.preparedActions.flatMap(row => [...row.hand, ...(row.preparedAction ? [row.preparedAction] : [])])
      .concat(view.actionPreview.preparedEnemyActions.flatMap(row => [...row.hand, ...(row.naturalAction ? [row.naturalAction] : [])]))
      .find(row => row.actionId === card?.actionId);
    const owner = card?.owner.kind === 'partyCharacter'
      ? ctx.nameOf('character', card.owner.id)
      : card?.owner.kind === 'enemy' ? `敌方 ${ctx.nameOf('enemy', card.owner.id) || card.owner.id}` : '卡牌';
    return `卡牌目标：${owner} · ${action?.name ?? '当前卡牌'}`;
  }
  return '目标：待确定';
}

function renderEnemyHandStack(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  enemyId: string,
  enemyName: string,
): string {
  const preview = view.actionPreview;
  const prepared = preview?.preparedEnemyActions.find(row => row.enemyId === enemyId);
  if (!preview || !prepared) return '';
  const hostId = `enemy-hand:${view.run.runId}:${enemyId}`;
  const sourceRelation = view.relations.find(row => row.source.kind === 'enemy' && row.source.id === enemyId);
  const cards = prepared.hand.map((action, index) => {
    const card = findEnemyCard(view, enemyId, action.actionId);
    const current = action.actionId === prepared.naturalAction?.actionId;
    const relationAttributes = current && sourceRelation ? { relationKey: sourceRelation.key } : {};
    const slotId = `hand:${index}:${action.actionId}`;
    const cardAttributes = mapCardAttributes(ctx, view, card, 'live', `enemy:${enemyId}:${slotId}`, ['inspect'],
      relationAttributes, { hostId, slotId });
    const angle = stableMapActionCardAngle(`${view.run.runId}:${preview.nodeId}:${preview.round}:${enemyId}:enemy:${action.actionId}`);
    const actionName = escape(ctx, action.name);
    const subtitle = current ? '敌方自然行动' : '敌方备选行动';
    return `<div role="group" tabindex="0" class="map-workspace__action-card map-workspace__unit-action-card map-workspace__enemy-action-card${current ? ' is-current' : ''}" ${cardAttributes}${focusKey(ctx, `enemy-card:${enemyId}:${action.actionId}`)} aria-label="${actionName} · ${subtitle} · 只读" style="--map-card-angle:${angle};--map-card-right:${index * 10}px;--map-card-z:${current ? 40 : index + 1}">${renderMapActionCardContent(value => escape(ctx, value), { title: action.name, subtitle })}</div>`;
  }).join('');
  return cards ? `<div class="map-workspace__unit-card-stack map-workspace__enemy-action-stack"${regionKey(ctx, `enemy-hand:${enemyId}`)}${mapCardHostAttributes(value => escape(ctx, value), hostId, { alignment: 'right' })} aria-label="${escape(ctx, enemyName)} 的只读手牌">${cards}</div>` : '';
}

function renderEnemyActionDetails(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  enemyId: string,
): string {
  const prepared = view.actionPreview?.preparedEnemyActions.find(row => row.enemyId === enemyId);
  if (!prepared) return `<small class="map-workspace__enemy-action-details"${regionKey(ctx, `enemy-action:${enemyId}`)}>行动状态暂不可用</small>`;
  const actionDetails = prepared.naturalAction
    ? `<div class="map-workspace__enemy-action-details"${regionKey(ctx, `enemy-action:${enemyId}`)}>
        <small>${escape(ctx, prepared.naturalAction.name)} · ${escape(ctx, enemyPreparedTargetLabel(ctx, view, prepared))}</small>
        ${prepared.naturalAction.description ? `<small>${escape(ctx, prepared.naturalAction.description)}</small>` : ''}
        ${renderActionCosts(ctx, prepared.naturalAction)}${renderActionHpEffects(prepared.naturalAction)}${renderCardEffects(ctx, prepared.naturalAction)}
      </div>`
    : `<small class="map-workspace__enemy-action-details"${regionKey(ctx, `enemy-action:${enemyId}`)}>${escape(ctx, enemyPreparedTargetLabel(ctx, view, prepared))}</small>`;
  return actionDetails;
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
      themeScope: 'center.map.flow', surface: 'panel', header: headers.center ? renderPanelHeaderRegion(ctx, 'center', headers.center) : '',
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

function renderCardEffects(ctx: UIContext, action: MapWorkspaceActionView): string {
  return (action.cardEffects ?? []).map(effect => `<small class="map-workspace__action-cost">受用卡牌本轮 sCost 减免 ${ctx.formatNumber(effect.amount)}，最低为 0</small>`).join('');
}

function renderUnitFace(
  ctx: UIContext,
  options: {
    readonly name: string;
    readonly type: string;
    readonly currentHp: number;
    readonly scost?: number;
    readonly maxHp?: number;
    readonly avatarUrl?: string;
    readonly regionKey?: string;
    readonly objectKey?: string;
    readonly relationAttributes?: string;
  },
): string {
  const maxHp = options.maxHp ?? 0;
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, options.currentHp / maxHp * 100)) : 0;
  const initial = escape(ctx, options.name.trim().charAt(0) || '?');
  const avatar = options.avatarUrl
    ? `<img src="${escape(ctx, options.avatarUrl)}" alt="" loading="lazy">`
    : initial;
  return `<section class="map-workspace__unit-face"${options.regionKey ? regionKey(ctx, options.regionKey) : ''}${options.objectKey ? ` data-map-object-key="${escape(ctx, options.objectKey)}" tabindex="0"` : ''}${options.relationAttributes ?? ''} aria-label="${escape(ctx, options.name)} 单位卡">
    <header class="map-workspace__unit-header">
      <span class="map-workspace__unit-avatar" aria-hidden="true">${avatar}</span>
      <strong>${escape(ctx, options.name)}</strong>
      <span class="map-workspace__unit-type">${escape(ctx, options.type)}</span>
    </header>
    <div class="map-workspace__unit-vitals">
      <div class="map-workspace__unit-stat map-workspace__unit-stat--hp"><span>HP</span><strong>${ctx.formatNumber(options.currentHp)} / ${maxHp > 0 ? ctx.formatNumber(maxHp) : '—'}</strong><i${maxHp > 0 ? ` role="meter" aria-label="生命值" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${options.currentHp}"` : ' aria-hidden="true"'}><b style="--map-unit-fill:${hpPercent}%"></b></i></div>
      <div class="map-workspace__unit-stat map-workspace__unit-stat--scost"><span>sCost</span><strong aria-label="${options.scost === undefined ? 'sCost 尚未由当前 MapRun 视图提供' : `sCost ${options.scost}`}">${options.scost === undefined ? '—' : ctx.formatNumber(options.scost)}</strong><i aria-hidden="true"><b></b></i></div>
    </div>
    <div class="map-workspace__unit-buffs" aria-label="Buff"></div>
  </section>`;
}

function characterAvatarUrl(
  ctx: UIContext,
  variantId: Parameters<UIContext['game']['rosterSystem']['getVariant']>[0] | undefined,
): string | undefined {
  if (!variantId) return undefined;
  const avatar = ctx.game.rosterSystem.getVariant(variantId)?.avatar;
  return avatar ? ctx.game.pics.urlOf(avatar) : undefined;
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
          <button type="button" class="mini-action map-workspace__source-choice${selected ? ' is-selected' : ''}" data-map-ability-draft${focusKey(ctx, `ability:${option.actionId}`)}${relationKey(ctx, view, 'ability', option.actionId)} data-action-id="${escape(ctx, option.actionId)}"${attributes} aria-pressed="${selected}"${!option.canPayPlayerCost ? ' disabled' : ''}>
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
          <button type="button" class="mini-action map-workspace__source-choice${selected ? ' is-selected' : ''}" data-map-item-draft${focusKey(ctx, `item:${option.itemId}`)}${relationKey(ctx, view, 'item', option.itemId)} data-item-id="${escape(ctx, option.itemId)}" data-action-id="${escape(ctx, option.actionId)}"${attributes} aria-pressed="${selected}"${!option.canUse ? ' disabled' : ''}>
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

type MapCommitDockAction =
  | { readonly kind: 'commit'; readonly view: MapRunActiveWorkspaceView; readonly preview: NonNullable<MapRunActiveWorkspaceView['actionPreview']> }
  | { readonly kind: 'complete'; readonly runId: string; readonly nodeId: string; readonly label: string }
  | { readonly kind: 'move'; readonly runId: string; readonly fromNodeId: string }
  | { readonly kind: 'back'; readonly runId: string }
  | { readonly kind: 'disabled' };

function renderCommitDock(
  ctx: UIContext,
  options: {
    readonly playerCost: number | null;
    readonly status: string;
    readonly action: MapCommitDockAction;
  },
): string {
  const { action } = options;
  const disabled = action.kind === 'disabled' || action.kind === 'move';
  const label = action.kind === 'back' ? '返回游戏'
    : action.kind === 'complete' ? action.label : '提交本轮';
  const moveLabel = action.kind === 'move' ? '选择目的地点' : label;
  const actionAttributes = action.kind === 'commit'
    ? ` data-map-commit${focusKey(ctx, 'commit')} data-map-expected-commit-version="${action.view.run.commitVersion}"${draftAttributes(ctx, action.view.run.runId, action.preview.draft)}`
    : action.kind === 'complete'
      ? ` data-map-complete-encounter${focusKey(ctx, `complete:${action.nodeId}`)} data-map-run-id="${escape(ctx, action.runId)}"`
      : action.kind === 'move'
        ? ` data-map-location-submit${focusKey(ctx, `location-submit:${action.fromNodeId}`)} data-map-run-id="${escape(ctx, action.runId)}" data-map-from-node="${escape(ctx, action.fromNodeId)}"`
      : action.kind === 'back'
        ? ` data-map-back="${escape(ctx, action.runId)}"${focusKey(ctx, 'back-game')}`
        : '';
  const playerCost = options.playerCost === null ? '—' : ctx.formatNumber(options.playerCost);
  return `<footer class="map-workspace__commit-dock" data-map-region-key="commit-dock">
    <div class="map-workspace__commit-balance" aria-label="当前剩余 PlayerCost">
      <div><span>PlayerCost</span><strong>${playerCost}</strong></div>
      <p role="status" aria-live="polite" data-map-commit-status>${escape(ctx, options.status)}</p>
    </div>
    <button type="button" class="send-button send-player map-workspace__commit${disabled ? ' disabled' : ''}"${actionAttributes}${disabled ? ' disabled' : ''} aria-label="${escape(ctx, moveLabel)}">
      <span class="send-bubble${disabled ? ' disabled' : ''}"><span class="send-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="send-text">${escape(ctx, moveLabel)}</span><span class="send-arrow" aria-hidden="true">↗</span></span>
    </button>
  </footer>`;
}

function renderActionDock(ctx: UIContext, view: MapRunActiveWorkspaceView, locationChoices?: FlowMapLocations): string {
  if (view.shop) return renderShopDock(ctx, view);
  const preview = view.actionPreview;
  const encounter = view.currentEncounter;
  const canCommit = preview?.commitPreview.canCommit === true;
  const canComplete = !canCommit && encounter?.completion?.kind === 'manual';
  const canMove = !canCommit && !canComplete && !!locationChoices;
  const status = canMove
    ? '请在上方选择目的地点。'
    : canCommit
    ? `本轮可提交 · 预计消耗 ${ctx.formatNumber(preview?.commitPreview.playerCostRequired ?? 0)} PlayerCost`
    : canComplete
      ? '当前遭遇已满足手动完成条件。'
      : preview
        ? renderCommitDiagnostic(ctx, preview.commitPreview.diagnostics)
        : encounter ? '行动预览暂不可用，请返回地图后重新进入遭遇。' : '当前没有可提交的遭遇行动。';
  const action: MapCommitDockAction = canCommit && preview
    ? { kind: 'commit', view, preview }
    : canComplete && encounter
      ? { kind: 'complete', runId: view.run.runId, nodeId: encounter.nodeId, label: encounter.completion?.label ?? '完成遭遇' }
      : canMove && locationChoices
        ? { kind: 'move', runId: locationChoices.runId, fromNodeId: locationChoices.fromNodeId }
      : { kind: 'disabled' };
  const sources = renderEncounterSources(ctx, view);
  return `<section class="map-workspace__action-dock" data-map-region-key="action-dock" aria-label="${preview ? `第 ${preview.round} 轮行动操作` : '当前遭遇操作'}">
    <p class="map-workspace__dock-note" data-map-relation-status role="status" aria-live="polite"></p>
    ${sources ? `<div class="map-workspace__options-scroll" data-map-region-key="action-options" data-scroll-owner="content-region">${sources}</div>` : ''}
    ${renderCommitDock(ctx, { playerCost: view.run.playerCost, status, action })}
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

function renderEnemyRegion(ctx: UIContext, runId: string, view: MapRunActiveWorkspaceView | null): string {
  const encounter = view?.currentEncounter ?? null;
  const nodeId = encounter?.nodeId ?? '';
  const enemies = encounter?.enemies ?? [];
  const content = enemies.length
    ? `<section class="map-workspace__enemy-group" data-map-region-key="enemy-list" aria-label="活动敌方">
        <ul class="map-workspace__enemy-list">${enemies.map(enemy => {
          const enemyName = ctx.nameOf('enemy', enemy.enemyId) || `敌方 ${enemy.enemyId}`;
          const prepared = view?.actionPreview?.preparedEnemyActions.find(row => row.enemyId === enemy.enemyId);
          const enemyCards = view ? renderEnemyHandStack(ctx, view, enemy.enemyId, enemyName) : '';
          return `<li${regionKey(ctx, `enemy:${enemy.enemyId}`)} data-map-enemy-hp="${escape(ctx, enemy.enemyId)}">
            <article class="map-workspace__unit map-workspace__unit--enemy">
              <div class="map-workspace__unit-slot${prepared?.hand.length ? ' has-cards' : ''}">
                ${renderUnitFace(ctx, { name: enemyName, type: '敌方', currentHp: enemy.currentHp, maxHp: enemy.maxHp, regionKey: `enemy-face:${enemy.enemyId}`, objectKey: view ? unitKey(view, 'enemy', enemy.enemyId) : undefined })}
                ${enemyCards}
              </div>
              ${view ? renderEnemyActionDetails(ctx, view, enemy.enemyId) : `<small class="map-workspace__enemy-action-details"${regionKey(ctx, `enemy-action:${enemy.enemyId}`)}>行动状态暂不可用</small>`}
            </article>
          </li>`;
        }).join('')}</ul>
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
  const characterName = ctx.nameOf('character', prepared.characterId);
  const actorName = escape(ctx, characterName);
  const partyMember = view.run.party.find(member => member.characterId === prepared.characterId);
  const runHp = view.run.partyHp.find(row => row.characterId === prepared.characterId);
  const encounterHp = view.currentEncounter?.partyHp.find(row => row.characterId === prepared.characterId);
  const currentHp = encounterHp?.currentHp ?? runHp?.currentHp ?? 0;
  const maxHp = encounterHp?.maxHp;
  const actorResources = view.run.actorResources.filter(row => row.characterId === prepared.characterId)
    .map(row => `${resourceName(ctx, row.resourceId)} ${ctx.formatNumber(row.value)}`).join(' · ');
  const attributes = draftAttributes(ctx, view.run.runId, preview.draft);
  const preparedAction = prepared.preparedAction;
  const naturalActionId = prepared.naturalAction?.actionId ?? null;
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
    : prepared.targetKind === 'card' ? renderCardTargets(ctx, view, prepared)
    : prepared.targetKind === 'self' ? '<small class="map-workspace__target-label">目标：自身</small>'
      : prepared.targetKind === 'none' ? '<small class="map-workspace__target-label">无目标</small>'
        : '<small class="map-workspace__target-label">无行动目标</small>';
  const commandOverride = preview.overrides.find(override => override.characterId === prepared.characterId) ?? null;
  const commandOptions = preview.playerCommandOptions.filter(option => option.characterId === prepared.characterId);
  const handCandidates = prepared.hand.map(action => ({
    kind: 'swap' as const,
    action,
    selected: prepared.overrideKind !== 'playerCommand' && preparedAction?.actionId === action.actionId,
    disabled: false,
    reason: '',
  }));
  const commandCandidates = commandOptions.map(option => ({
    kind: 'playerCommand' as const,
    action: option.action,
    selected: commandOverride?.kind === 'playerCommand' && commandOverride.actionId === option.action.actionId,
    disabled: !option.canPayPlayerCost || !option.canPayActionCosts,
    reason: [!option.canPayPlayerCost ? '需要 1 PlayerCost' : '', !option.canPayActionCosts ? '行动资源不足' : ''].filter(Boolean).join(' · '),
  }));
  const candidates = [...handCandidates, ...commandCandidates];
  const replacementCandidates = candidates.filter(candidate => !candidate.selected);
  const pickerId = `map-hand-picker-${view.run.runId}-${prepared.characterId}`;
  const pickerMarkup = replacementCandidates.length > 0
    ? `<div class="map-workspace__hand-picker" id="${escape(ctx, pickerId)}" popover="manual" data-map-hand-picker data-map-run-id="${escape(ctx, view.run.runId)}" data-character-id="${escape(ctx, prepared.characterId)}" aria-label="${actorName} 的合法替换候选">
        <header><strong>替换准备行动</strong><small>选择后只更新草稿</small></header>
        <div class="map-workspace__hand-picker-list">${replacementCandidates.map(candidate => {
          const key = `unit-card:${prepared.characterId}:${candidate.kind}:${candidate.action.actionId}`;
          const isNatural = candidate.kind === 'swap' && candidate.action.actionId === naturalActionId;
          const actionStatus = isNatural ? '恢复默认'
            : candidate.kind === 'playerCommand' ? 'PlayerCommand · 1 PlayerCost' : '免费换用';
          const command = candidate.kind === 'swap' ? 'data-map-action-swap' : 'data-map-player-command';
          const card = findCard(view, prepared.characterId, candidate.action.actionId);
          return `<button type="button" class="map-workspace__hand-picker-card" ${command}${mapCardAttributes(ctx, view, card, 'replacement', `picker:${prepared.characterId}:${candidate.kind}:${candidate.action.actionId}`, ['inspect'], { optionId: `${candidate.kind}:${candidate.action.actionId}` })}${focusKey(ctx, key)}${regionKey(ctx, key)} data-character-id="${escape(ctx, prepared.characterId)}" data-action-id="${escape(ctx, candidate.action.actionId)}"${attributes} aria-pressed="false"${candidate.disabled ? ' disabled' : ''}>
            <strong>${escape(ctx, candidate.action.name)}</strong><small>${escape(ctx, actionStatus)}${candidate.kind === 'playerCommand' && candidate.reason ? ` · ${escape(ctx, candidate.reason)}` : ''}</small>
            ${candidate.action.description ? `<span>${escape(ctx, candidate.action.description)}</span>` : ''}${renderActionCosts(ctx, candidate.action)}${renderActionHpEffects(candidate.action)}${renderCardEffects(ctx, candidate.action)}
          </button>`;
        }).join('')}</div>
      </div>`
    : '';
  const currentKind = prepared.overrideKind === 'playerCommand' ? 'playerCommand' : 'swap';
  const currentCardKey = preparedAction
    ? `unit-card:${prepared.characterId}:${currentKind}:${preparedAction.actionId}`
    : `unit-card:${prepared.characterId}:wait`;
  const currentCardStyle = preparedAction
    ? `--map-card-angle:${stableMapActionCardAngle(`${view.run.runId}:${preview.nodeId}:${preview.round}:${prepared.characterId}:${currentKind}:${preparedAction.actionId}`)}`
    : '';
  const currentCardLabel = prepared.overrideKind === 'playerCommand' ? '当前生效的玩家指令'
    : preparedAction?.actionId === naturalActionId ? '当前生效的自然行为' : '当前生效的准备行为';
  const relation = view.relations.find(row => row.source.kind === 'preparedAction' && row.source.id === prepared.characterId);
  const currentCard = preparedAction ? findCard(view, prepared.characterId, preparedAction.actionId) : undefined;
  const stackHostId = `unit-card-stack:${view.run.runId}:${prepared.characterId}`;
  const cardEntries: MapCardEntry[] = ['inspect', 'target'];
  if (relation?.canSelectTarget) cardEntries.push('editTarget');
  if (replacementCandidates.length > 0) cardEntries.push('replace');
  const sourceAttributes = preparedAction
    ? mapCardAttributes(ctx, view, currentCard, 'live',
      `current:${prepared.characterId}:${currentKind}:${preparedAction.actionId}`, cardEntries,
      relation ? { relationKey: relation.key } : {},
      { hostId: stackHostId, slotId: currentCardKey })
    : '';
  const pinControl = relation ? `<button type="button" class="mini-action" data-map-relation-pin="${escape(ctx, relation.key)}"${focusKey(ctx, `relation-pin:${prepared.characterId}`)} aria-pressed="false">固定作用关系</button>` : '';
  const targetControl = relation?.canSelectTarget ? `<button type="button" class="mini-action" data-map-target-edit="${escape(ctx, relation.key)}" data-map-card-entry="editTarget"${focusKey(ctx, `target-edit:${prepared.characterId}`)} aria-pressed="false">修改目标</button>` : '';
  const activeCard = preparedAction
    ? replacementCandidates.length > 0
      ? renderMapActionCardButton(value => escape(ctx, value), {
        className: `map-workspace__unit-action-card is-current${currentKind === 'playerCommand' ? ' is-command' : ''}`,
        attributes: `${sourceAttributes} data-map-hand-stack-toggle data-map-run-id="${escape(ctx, view.run.runId)}" data-character-id="${escape(ctx, prepared.characterId)}" data-action-id="${escape(ctx, preparedAction.actionId)}" data-action-kind="${currentKind}" data-picker-id="${escape(ctx, pickerId)}"${focusKey(ctx, currentCardKey)} aria-controls="${escape(ctx, pickerId)}" aria-expanded="false" aria-label="${escape(ctx, `${preparedAction.name} · ${currentCardLabel}，点击更换`)}" aria-pressed="true" style="${currentCardStyle}"`,
        title: preparedAction.name,
        subtitle: currentCardLabel,
      })
      : `<div tabindex="0"${sourceAttributes} class="map-workspace__action-card map-workspace__unit-action-card is-current${currentKind === 'playerCommand' ? ' is-command' : ''}" aria-label="${escape(ctx, currentCardLabel)}" style="${currentCardStyle}">${renderMapActionCardContent(value => escape(ctx, value), { title: preparedAction.name, subtitle: currentCardLabel })}</div>`
    : `<div class="map-workspace__action-card map-workspace__unit-action-card is-wait">${renderMapActionCardContent(value => escape(ctx, value), { title: 'Wait', subtitle: '本轮待机' })}</div>`;
  const stackMarkup = `<div class="map-workspace__unit-card-stack"${mapCardHostAttributes(value => escape(ctx, value), stackHostId)} data-map-region-key="unit-card-stack:${escape(ctx, prepared.characterId)}" role="group" aria-label="${actorName} 当前生效的准备行为">
    ${activeCard}${pickerMarkup}
  </div>`;
  const avatarUrl = characterAvatarUrl(ctx, partyMember?.variantId);
  const face = renderUnitFace(ctx, {
    name: characterName,
    type: '学生',
    scost: view.run.actorResources.find(row => row.characterId === prepared.characterId && row.resourceId === 'sCost')?.value,
    currentHp,
    maxHp,
    avatarUrl,
    regionKey: `party-face:${prepared.characterId}`,
    objectKey: unitKey(view, 'partyCharacter', prepared.characterId),
  });
  const actionDetail = preparedAction
    ? `<div class="map-workspace__unit-support"${regionKey(ctx, `prepared:${prepared.characterId}`)}>${preparedAction.description ? `<small>${escape(ctx, preparedAction.description)}</small>` : ''}${renderActionCosts(ctx, preparedAction)}${renderActionHpEffects(preparedAction)}${renderCardEffects(ctx, preparedAction)}${target}</div>`
    : `<div class="map-workspace__unit-support"${regionKey(ctx, `prepared:${prepared.characterId}`)}><small>本角色本轮没有可行动作。</small>${target}</div>`;

  return `<article class="map-workspace__party-member" data-map-party-member="${escape(ctx, prepared.characterId)}"${regionKey(ctx, `party-member:${prepared.characterId}`)} aria-labelledby="map-party-${escape(ctx, prepared.characterId)}">
    <div class="map-workspace__unit-slot${preparedAction ? ' has-cards' : ''}" id="map-party-${escape(ctx, prepared.characterId)}">
      ${face}${stackMarkup}<span class="map-workspace__card-anchor" aria-hidden="true"></span>
    </div>
    ${actionDetail}${pinControl}${targetControl}
    ${actorResources ? `<p class="map-workspace__party-stats"${regionKey(ctx, `party-resources:${prepared.characterId}`)}>资源 ${actorResources}</p>` : ''}
  </article>`;
}

function renderPassivePartyMember(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  characterId: string,
): string {
  const hp = view.run.partyHp.find(row => row.characterId === characterId);
  const encounterHp = view.currentEncounter?.partyHp.find(row => row.characterId === characterId);
  const partyMember = view.run.party.find(member => member.characterId === characterId);
  const characterName = ctx.nameOf('character', characterId);
  const balances = view.run.actorResources.filter(row => row.characterId === characterId)
    .map(row => `${resourceName(ctx, row.resourceId)} ${ctx.formatNumber(row.value)}`).join(' · ');
  const face = renderUnitFace(ctx, {
    name: characterName,
    type: '学生',
    currentHp: encounterHp?.currentHp ?? hp?.currentHp ?? 0,
    maxHp: encounterHp?.maxHp,
    avatarUrl: characterAvatarUrl(ctx, partyMember?.variantId),
    regionKey: `party-face:${characterId}`,
    objectKey: unitKey(view, 'partyCharacter', characterId),
  });
  return `<article class="map-workspace__party-member map-workspace__party-member--passive" data-map-party-member="${escape(ctx, characterId)}"${regionKey(ctx, `party-member:${characterId}`)}>
    <div class="map-workspace__unit-slot">${face}</div>
    ${balances ? `<p class="map-workspace__party-stats"${regionKey(ctx, `party-resources:${characterId}`)}>资源 ${balances}</p>` : ''}
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
  const members = view.partyHp.map(member => {
    const characterName = ctx.nameOf('character', member.characterId);
    const face = renderUnitFace(ctx, {
      name: characterName,
      type: '学生',
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      regionKey: `party-face:${member.characterId}`,
    });
    return `<article class="map-workspace__party-member map-workspace__party-member--passive" data-map-party-member="${escape(ctx, member.characterId)}"${regionKey(ctx, `party-member:${member.characterId}`)}><div class="map-workspace__unit-slot">${face}</div></article>`;
  }).join('');
  return `<div class="map-workspace__party-scroll" data-map-region-key="party-scroll" data-scroll-owner="content-region" aria-label="我方队伍">${members}</div>`;
}

function renderActiveRight(ctx: UIContext, runId: string, view: MapRunActiveWorkspaceView): string {
  return `<div class="map-workspace__context-scroll" data-map-region-key="context-scroll" data-scroll-owner="content-region" aria-label="敌方与背景">
    ${renderEnemyRegion(ctx, runId, view)}
    ${renderActivityProgress(ctx, view)}
  </div>`;
}

function renderActiveCenter(ctx: UIContext, runId: string, view: MapRunActiveWorkspaceView, entries: readonly FlowEntry[]): string {
  const node = view.map.nodes.find(candidate => candidate.id === view.run.currentNodeId);
  const activity = view.activities.find(candidate => candidate.active)
    ?? view.activities.find(candidate => !candidate.completed)
    ?? view.activities[view.activities.length - 1];
  const activityKind = activity?.kind === 'battle' ? '战斗'
    : activity?.kind === 'rest' ? '休整'
      : activity?.kind === 'shop' ? '商店'
        : activity ? '活动' : '';
  const encounter = view.currentEncounter;
  const progressLabel = activity
    ? `${activity.index + 1}/${activity.total} ${activityKind}`
    : encounter?.round !== undefined
      ? encounter.rounds !== undefined
        ? `${encounter.round}/${encounter.rounds} 休整`
        : `${encounter.round} 轮${encounter.enemies.length > 0 ? '战斗' : '活动'}`
      : '';
  const progress = progressLabel
    ? `<span class="map-workspace__hero-progress" aria-label="当前轮次或活动进度">${escape(ctx, progressLabel)}</span>`
    : '';
  const safeRunId = escape(ctx, runId);
  const locationChoices = [...entries].reverse().find(entry => entry.mapLocations)?.mapLocations;
  const hero = `<section class="map-workspace__hero area-hero" data-map-region-key="map-hero" aria-label="当前地点">
    <div class="map-workspace__hero-heading">
      <div class="map-workspace__hero-copy">
        <h1>${escape(ctx, node?.title ?? view.map.name)}</h1>
        ${node?.description ? `<p>${escape(ctx, node.description)}</p>` : ''}
      </div>
      <button type="button" class="mini-action map-workspace__hero-action map-workspace__hero-action--back" data-map-back="${safeRunId}" data-map-focus-key="back-game" aria-label="返回游戏">返回游戏</button>
    </div>
    <div class="map-workspace__hero-footer">
      ${progress}
      <div class="map-workspace__hero-actions" role="group" aria-label="当前地图操作">
        <button type="button" class="mini-action map-workspace__hero-action" data-map-show-map data-map-run-id="${safeRunId}" aria-label="查看地图地点">地图</button>
        <button type="button" class="mini-action map-workspace__hero-action" data-map-restart="${safeRunId}" data-map-run-id="${safeRunId}" data-map-focus-key="map-restart" aria-label="重新开始整张地图">重新游戏</button>
        <button type="button" class="mini-action map-workspace__hero-action map-workspace__hero-action--danger" data-map-abandon="${safeRunId}" data-map-run-id="${safeRunId}" data-map-focus-key="map-abandon" aria-label="放弃当前整张地图游戏">放弃游戏</button>
      </div>
    </div>
  </section>`;
  return `<div class="map-workspace__center-pane" data-map-region-key="center-pane">
    ${hero}${renderFlowHost(ctx, runId, entries)}${renderActionDock(ctx, view, locationChoices)}
  </div>`;
}

function renderUnavailable(ctx: UIContext, runId: string): string {
  const safeRunId = escape(ctx, runId);
  const left = `<div class="map-workspace__party-scroll" data-map-region-key="party-scroll" data-scroll-owner="content-region"><p class="map-workspace__empty" role="status">当前地图的队伍信息暂不可读取。</p></div>`;
  const center = `<div class="map-workspace__center-pane" data-map-region-key="center-pane">
    <div class="map-workspace__feed" data-map-region-key="talk-feed" data-scroll-owner="content-region" role="status"><section class="map-workspace__feed-entry"${regionKey(ctx, 'feed-unavailable')}><h1>当前地图进度暂不可用</h1><p>请返回游戏页面后查看可继续的地图入口。</p></section></div>
    <section class="map-workspace__action-dock" data-map-region-key="action-dock" aria-label="当前遭遇操作">
      ${renderCommitDock(ctx, { playerCost: null, status: '当前地图不可读取，暂时无法继续。', action: { kind: 'disabled' } })}
    </section>
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
    <section class="map-workspace__action-dock" data-map-region-key="action-dock" aria-label="路线结果操作">
      ${renderCommitDock(ctx, { playerCost: null, status: '地图路线已完成。', action: { kind: 'back', runId } })}
    </section>
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
  const left = renderFailureParty(ctx, view);
  const center = `<div class="map-workspace__center-pane" data-map-region-key="center-pane">
    ${renderFlowHost(ctx, runId, entries, { label: '探索失败结果', emptyText: '探索失败结果暂不可读取。' })}
    <section class="map-workspace__action-dock" data-map-region-key="action-dock" aria-label="路线结果操作">
      ${renderCommitDock(ctx, { playerCost: null, status: '本次地图探索已结束。', action: { kind: 'back', runId } })}
    </section>
  </div>`;
  const right = `<div class="map-workspace__context-scroll" data-map-region-key="context-scroll" data-scroll-owner="content-region">
    <div class="map-workspace__encounter-region" data-map-encounter-region data-map-run-id="${escape(ctx, runId)}" data-map-encounter-node-id="${escape(ctx, view.result.failedNodeId)}"${regionKey(ctx, 'enemy-region')} data-map-encounter-state="failure"><p class="map-workspace__empty">队伍已无法继续战斗。</p></div>
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
  const left = renderParty(ctx, view);
  const center = renderActiveCenter(ctx, runId, view, entries);
  const right = renderActiveRight(ctx, runId, view);
  const frame = workspaceFrame(ctx, {
    left: titleContent(ctx, '我方'),
    center: '',
    right: titleContent(ctx, '敌方 / 背景'),
  }, { left, center, right });
  return `<div class="map-workspace__region${view.currentEncounter ? ' map-workspace__region--encounter' : ''}" data-map-workspace-region data-map-run-id="${safeRunId}" data-map-name="${mapName}">${frame}</div>`;
}
