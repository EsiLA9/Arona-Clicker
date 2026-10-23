import type {
  MapRunActiveWorkspaceView,
  MapRunFailureWorkspaceView,
  MapRunSuccessWorkspaceView,
  MapRunWorkspaceView,
  MapWorkspacePreparedActionView,
  MapWorkspaceActionView,
  MapEncounterStatusView,
} from '../../../arona-clicker/contracts/runtime/runtime';
import type {
  MapRunEncounterDraftToken,
  MapRunEncounterSourceTarget,
  MapRunEncounterSourceOption,
} from '../../../arona-clicker/contracts/map/map-run';
import type { UIContext } from '../../runtime/context';
import { renderPanelHeaderRegion } from '../shared/tabs';
import { renderWorkspaceFrame } from '../shared/workspace-frame';
import { renderFlowEntries } from '../../flow/flow-render';
import { FLOW_HOST_KEY_ATTRIBUTE, FLOW_STREAM_KEY_ATTRIBUTE, type FlowEntry, type FlowMapLocations } from '../../flow/flow-entry';
import { MapFlowModel, mapCardEffectModifierPreviewLabel } from '../../flow/map-flow-model';
import { mapObjectKey, mapUnitKey } from '../../workspace/map-relation-presentation';
import {
  mapCardAttachmentAttributes,
  mapCardBindingAttributes,
  mapCardHostAttributes,
  mapCardInstanceKey,
  type MapCardDOMPlacement,
  type MapCardEntry,
  type MapCardUsage,
} from '../../cards/card-host';
import { renderMapActionCardButton, renderMapActionCardContent, stableMapActionCardAngle } from '../../cards/action-card';
import type { MapRunCardInstance, MapRunCardRef } from '../../../arona-clicker/contracts/map/map-cards';
import '../../css/map-workspace.css';

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
      const modifierPreview = prepared.cardEffectModifierPreviews?.find(row => mapObjectKey(row.targetCardRef) === key);
      const semanticKey = `target-card:${prepared.characterId}:${ref.id}`;
      return `<button type="button" class="mini-action map-workspace__target-choice map-workspace__card-target-choice" data-map-card-target="${escape(ctx, relation?.key ?? '')}"${mapCardAttributes(ctx, view, card, 'offer', `target:${prepared.characterId}:${key}`, ['target'], { objectKey: key, optionId: semanticKey })}${focusKey(ctx, semanticKey)}${regionKey(ctx, semanticKey)} aria-pressed="${selected}">
        <strong>${escape(ctx, label)}</strong><small>${card?.prepared ? '本轮准备牌' : '备选牌'}${selected ? ' · 已选目标' : ''}</small>${modifierPreview
          ? `<small>${escape(ctx, mapCardEffectModifierPreviewLabel(modifierPreview, value => ctx.formatNumber(value)))}</small>` : ''}
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
        ${renderActionCosts(ctx, prepared.naturalAction)}${renderDeclaredEffects(ctx, prepared.naturalAction)}
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

type DeclaredMapEffect = NonNullable<MapWorkspaceActionView['declaredEffects']>[number];
type DeclaredMapCondition = DeclaredMapEffect['branches'][number]['condition'];

function signedDelta(ctx: UIContext, delta: number): string {
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : '−'}${ctx.formatNumber(Math.abs(delta))}`;
}

function describeDeclaredCondition(ctx: UIContext, condition: DeclaredMapCondition): string {
  if (condition.kind === 'all' || condition.kind === 'any') {
    const children = condition.conditions.map(child => describeDeclaredCondition(ctx, child)).join('；');
    return `${condition.kind === 'all' ? '全部满足' : '任一满足'}（${children}）`;
  }
  if (condition.kind === 'not') return `不满足（${describeDeclaredCondition(ctx, condition.condition)}）`;
  if (condition.kind === 'hpAtLeast' || condition.kind === 'hpAtMost') {
    const target = condition.target === 'source' ? '来源角色' : '受用角色';
    return `${target} HP ${condition.kind === 'hpAtLeast' ? '≥' : '≤'} ${ctx.formatNumber(condition.value)}`;
  }
  if (condition.kind === 'hpRatioAtLeast' || condition.kind === 'hpRatioAtMost') {
    const target = condition.target === 'source' ? '来源角色' : '受用角色';
    return `${target} HP 比例 ${condition.kind === 'hpRatioAtLeast' ? '≥' : '≤'} ${condition.numerator}/${condition.denominator}`;
  }
  if (condition.kind === 'counter') {
    const comparison = { eq: '=', lt: '<', lte: '≤', gt: '>', gte: '≥' }[condition.comparison];
    return `Counter ${condition.counterId} ${comparison} ${ctx.formatNumber(condition.value)}`;
  }
  if (condition.kind === 'flag') return `Flag ${condition.flagId} 为${condition.value ? '是' : '否'}`;
  return '复合条件';
}

function declaredRecipientName(ctx: UIContext, recipient: Extract<DeclaredMapEffect, { kind: 'hp' | 'damage' | 'heal' | 'resource' | 'revive' }>['recipient']): string {
  if (!recipient) return '受用角色';
  if (recipient.kind === 'team') return recipient.side === 'party' ? '我方共用' : '敌方共用';
  return recipient.kind === 'partyCharacter'
    ? ctx.nameOf('character', recipient.id)
    : `敌方 ${ctx.nameOf('enemy', recipient.id) || recipient.id}`;
}

function describeDeclaredEffect(ctx: UIContext, effect: DeclaredMapEffect): string {
  if (effect.kind === 'damage' || effect.kind === 'heal') {
    const set = effect.set;
    const recipient = set
      ? `${set.side === 'party' ? '我方' : '敌方'}${(set.filter ?? 'living') === 'living' ? '存活单位' : '全体单位'}`
        + (set.order && set.order !== 'definition' ? `（按 HP 比例${set.order === 'hpRatioAscending' ? '升序' : '降序'}）` : '')
        + (set.limit === undefined ? '' : `，最多 ${ctx.formatNumber(set.limit)} 名`)
      : effect.recipient ? declaredRecipientName(ctx, effect.recipient) : '受用角色';
    const amount = typeof effect.amount === 'number' ? ctx.formatNumber(effect.amount) : '按公式计算';
    const repeat = effect.repeat === undefined ? ''
      : `，每个目标 ${typeof effect.repeat === 'number' ? ctx.formatNumber(effect.repeat) : '按公式确定'} 次`;
    return effect.kind === 'damage'
      ? `${recipient} 受到 ${amount} 点伤害${repeat}`
      : `${recipient} 恢复 ${amount} 点 HP${repeat}`;
  }
  if (effect.kind === 'hp') {
    const recipient = effect.recipient
      ? declaredRecipientName(ctx, effect.recipient)
      : effect.target === 'source' ? '来源角色' : '受用角色';
    return `${recipient} HP ${signedDelta(ctx, effect.delta)}`;
  }
  if (effect.kind === 'revive') {
    const recipient = effect.recipient ? declaredRecipientName(ctx, effect.recipient) : '受用角色';
    return `${recipient} 倒地时复苏至最多 ${ctx.formatNumber(effect.amount)} HP`;
  }
  if (effect.kind === 'resource') {
    const recipient = effect.recipient
      ? declaredRecipientName(ctx, effect.recipient)
      : effect.account === 'sourceActor' ? '来源角色' : effect.account === 'sourceTeam' ? '共用' : '受用角色';
    return `${recipient} ${ctx.nameOf('resource', effect.resourceId)} ${signedDelta(ctx, effect.delta)}`;
  }
  if (effect.kind === 'counter') return `Counter ${effect.counterId} ${signedDelta(ctx, effect.delta)}`;
  if (effect.kind === 'flag') return `Flag ${effect.flagId} 设为${effect.value ? '是' : '否'}`;
  if (effect.kind === 'cardCost') return `受用卡牌 sCost ${signedDelta(ctx, effect.amount)}`;
  return '';
}

/** Render declaration-only facts; branch conditions are described, never evaluated here. */
function renderDeclaredEffects(ctx: UIContext, action: Pick<MapWorkspaceActionView, 'declaredEffects'> | null): string {
  const effects = action?.declaredEffects ?? [];
  if (effects.length === 0) return '';
  const rows = effects.map(effect => {
    const conditions = effect.branches.map(branch =>
      `${branch.branch === 'then' ? '满足' : '不满足'}“${describeDeclaredCondition(ctx, branch.condition)}”`,
    ).join('，且');
    const conditionText = conditions ? `条件为${conditions}时，` : '';
    return `<span role="listitem">声明：${escape(ctx, `${conditionText}${describeDeclaredEffect(ctx, effect)}`)}</span>`;
  });
  return `<small class="map-workspace__action-cost" role="list" aria-label="声明效果">${rows.join('<br>')}</small>`;
}

function renderUnitFace(
  ctx: UIContext,
  options: {
    readonly name: string;
    readonly type: string;
    readonly currentHp: number;
    readonly shield?: number;
    readonly scost?: number;
    readonly maxHp?: number;
    readonly avatarUrl?: string;
    readonly regionKey?: string;
    readonly objectKey?: string;
    readonly relationAttributes?: string;
    readonly statusOwnerKey?: string;
    readonly statuses?: readonly MapEncounterStatusView[];
  },
): string {
  const maxHp = options.maxHp ?? 0;
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, options.currentHp / maxHp * 100)) : 0;
  const initial = escape(ctx, options.name.trim().charAt(0) || '?');
  const avatar = options.avatarUrl
    ? `<img src="${escape(ctx, options.avatarUrl)}" alt="" loading="lazy">`
    : initial;
  const statuses = options.statuses ?? [];
  const shield = options.shield ?? 0;
  const statusHost = options.statusOwnerKey === undefined || options.statuses === undefined ? ''
    : regionKey(ctx, `unit-statuses:${options.statusOwnerKey}`);
  const statusRows = statuses.map(status => {
    const reduction = status.damageReductionPerStack === undefined ? ''
      : ` · 减伤 ${ctx.formatNumber(status.damageReductionPerStack)}/层（共 ${ctx.formatNumber(status.damageReductionPerStack * status.stacks)}）`;
    return `<span class="map-workspace__unit-status"${regionKey(ctx, `status:${status.key}`)} role="listitem">${escape(ctx, `${status.name} · ${ctx.formatNumber(status.stacks)}层${reduction} · 剩余${ctx.formatNumber(status.remainingRounds)}轮`)}</span>`;
  }).join('');
  return `<section class="map-workspace__unit-face"${options.regionKey ? regionKey(ctx, options.regionKey) : ''}${options.objectKey ? ` data-map-object-key="${escape(ctx, options.objectKey)}" tabindex="0"` : ''}${options.relationAttributes ?? ''} aria-label="${escape(ctx, options.name)} 单位卡">
    <header class="map-workspace__unit-header">
      <span class="map-workspace__unit-avatar" aria-hidden="true">${avatar}</span>
      <strong>${escape(ctx, options.name)}</strong>
      <span class="map-workspace__unit-type">${escape(ctx, options.type)}</span>
    </header>
    <div class="map-workspace__unit-vitals">
      <div class="map-workspace__unit-stat map-workspace__unit-stat--hp"><span>HP</span><strong>${ctx.formatNumber(options.currentHp)} / ${maxHp > 0 ? ctx.formatNumber(maxHp) : '—'}</strong><i${maxHp > 0 ? ` role="meter" aria-label="生命值" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${options.currentHp}"` : ' aria-hidden="true"'}><b style="--map-unit-fill:${hpPercent}%"></b></i></div>
      ${shield > 0 ? `<div class="map-workspace__unit-stat map-workspace__unit-stat--shield" aria-label="Shield ${ctx.formatNumber(shield)}"><span>Shield</span><strong>${ctx.formatNumber(shield)}</strong></div>` : ''}
      <div class="map-workspace__unit-stat map-workspace__unit-stat--scost"><span>sCost</span><strong aria-label="${options.scost === undefined ? 'sCost 尚未由当前 MapRun 视图提供' : `sCost ${options.scost}`}">${options.scost === undefined ? '—' : ctx.formatNumber(options.scost)}</strong><i aria-hidden="true"><b></b></i></div>
    </div>
    <div class="map-workspace__unit-buffs"${statusHost} role="list" aria-label="状态">${statusRows}</div>
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

function renderSourceAdditionalTargetPicker(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  option: MapRunEncounterSourceOption,
  source: 'ability' | 'item',
  itemId: string | null,
  selectedTarget: MapRunEncounterSourceTarget | null,
): string {
  if (!option.additionalTargetKind || !view.sourcePreview) return '';
  const preview = view.sourcePreview;
  const draft = draftAttributes(ctx, view.run.runId, { nodeId: preview.nodeId, round: preview.round, draftVersion: preview.draftVersion });
  const targetButtons = option.additionalTargetKind === 'partyCharacter'
    ? (option.legalAdditionalTargetCharacterIds ?? []).map(characterId => {
        const selected = selectedTarget?.kind === 'partyCharacter' && selectedTarget.characterId === characterId;
        const command = source === 'ability' ? 'data-map-ability-target-additional' : 'data-map-item-target-additional';
        const itemAttribute = source === 'item' ? ` data-item-id="${escape(ctx, itemId ?? '')}"` : '';
        const key = `${source}-additional-target:${source === 'item' ? itemId : option.actionId}:${characterId}`;
        return `<button type="button" class="mini-action map-workspace__target-choice" ${command}${focusKey(ctx, key)} data-action-id="${escape(ctx, option.actionId)}" data-target-character-id="${escape(ctx, characterId)}"${itemAttribute}${draft} aria-pressed="${selected}">${escape(ctx, ctx.nameOf('character', characterId))}</button>`;
      }).join('')
    : (option.legalAdditionalTargetEnemyIds ?? []).map(enemyId => {
        const selected = selectedTarget?.kind === 'enemy' && selectedTarget.enemyId === enemyId;
        const command = source === 'ability' ? 'data-map-ability-target-additional' : 'data-map-item-target-additional';
        const itemAttribute = source === 'item' ? ` data-item-id="${escape(ctx, itemId ?? '')}"` : '';
        const key = `${source}-additional-target:${source === 'item' ? itemId : option.actionId}:${enemyId}`;
        return `<button type="button" class="mini-action map-workspace__target-choice" ${command}${focusKey(ctx, key)} data-action-id="${escape(ctx, option.actionId)}" data-target-enemy-id="${escape(ctx, enemyId)}"${itemAttribute}${draft} aria-pressed="${selected}">敌方 ${escape(ctx, enemyId)}</button>`;
      }).join('');
  const clearCommand = source === 'ability'
    ? 'data-map-ability-target-additional-clear' : 'data-map-item-target-additional-clear';
  const clearKey = `${source}-additional-target-clear:${source === 'item' ? itemId : option.actionId}`;
  const label = source === 'ability' ? 'Ability' : 'Item';
  return `<div class="map-workspace__source-targets map-workspace__source-additional-targets"${regionKey(ctx, `${source}-additional-targets:${source === 'item' ? itemId : option.actionId}`)} role="group" aria-label="${label} ${escape(ctx, option.name)} 的额外目标"><span>${option.additionalTargetSelectionRequired ? '选择额外目标' : '额外目标'}：${sourceTargetLabel(ctx, selectedTarget)}</span><div>${targetButtons || '<small>当前没有合法的额外目标。</small>'}</div>${selectedTarget ? `<button type="button" class="mini-action map-workspace__target-clear" ${clearCommand}${focusKey(ctx, clearKey)}${source === 'item' ? ` data-item-id="${escape(ctx, itemId ?? '')}"` : ''}${draft}>清除额外目标</button>` : ''}</div>`;
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
        const downed = (view.run.partyHp.find(row => row.characterId === characterId)?.currentHp ?? 0) <= 0;
        return `<button type="button" class="mini-action map-workspace__target-choice" ${command}${focusKey(ctx, key)} data-action-id="${escape(ctx, option.actionId)}" data-target-character-id="${escape(ctx, characterId)}"${itemAttribute}${draft} aria-pressed="${selected}">${escape(ctx, ctx.nameOf('character', characterId))}${downed ? '（倒地）' : ''}</button>`;
      }).join('')
    : option.legalTargetEnemyIds.map(enemyId => {
        const selected = selectedTarget?.kind === 'enemy' && selectedTarget.enemyId === enemyId;
        const command = source === 'ability' ? 'data-map-ability-target' : 'data-map-item-target';
        const itemAttribute = source === 'item' ? ` data-item-id="${escape(ctx, itemId ?? '')}"` : '';
        const key = `${source}-target:${option.actionId}:${enemyId}`;
        return `<button type="button" class="mini-action map-workspace__target-choice" ${command}${focusKey(ctx, key)} data-action-id="${escape(ctx, option.actionId)}" data-target-enemy-id="${escape(ctx, enemyId)}"${itemAttribute}${draft} aria-pressed="${selected}">敌方 ${escape(ctx, enemyId)}</button>`;
      }).join('');
  const selectedAdditionalTarget = source === 'ability'
    ? preview.selectedAbilityAdditionalTarget : preview.selectedItemAdditionalTarget;
  return `<div class="map-workspace__source-targets"${regionKey(ctx, `${source}-targets:${option.actionId}`)} role="group" aria-label="${source === 'ability' ? 'Ability' : 'Item'} ${escape(ctx, option.name)} 的目标"><span>目标：${sourceTargetLabel(ctx, selectedTarget)}</span><div>${targetButtons || '<small>当前没有合法目标。</small>'}</div></div>${renderSourceAdditionalTargetPicker(ctx, view, option, source, itemId, selectedAdditionalTarget)}`;
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
            <small>Ability · 1 PlayerCost · ${option.canPayPlayerCost ? '费用充足' : 'PlayerCost 不足'}</small>${renderDeclaredEffects(ctx, option)}
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
            <small>库存 ${option.inventoryCount} · 条件${option.useConditionSatisfied ? '满足' : '未满足'} · ${option.canUse ? '可使用' : '暂不可用'}</small>${renderDeclaredEffects(ctx, option)}
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

type MapWorkspaceCommitPreview = NonNullable<NonNullable<MapRunActiveWorkspaceView['actionPreview']>['commitPreview']>;
type MapWorkspacePreviewTrace = NonNullable<MapWorkspaceCommitPreview['effectTrace']>[number];
type MapWorkspaceExecutionSequenceRow = NonNullable<MapWorkspaceCommitPreview['executionSequence']>[number];
function previewTraceSourceLabel(ctx: UIContext, trace: MapWorkspacePreviewTrace): string {
  const source = trace.source;
  const action = ctx.nameOf('action', trace.actionId);
  if (!source) return action;
  if (source.kind === 'partyCharacter') return `${ctx.nameOf('character', source.id)} · ${action}`;
  if (source.kind === 'enemy') return `敌方 ${ctx.nameOf('enemy', source.id) || source.id} · ${action}`;
  if (source.kind === 'ability') return `Ability · ${action}`;
  return `Item ${ctx.nameOf('item', source.itemId)} · ${action}`;
}

function previewRecipient(ctx: UIContext, identity: NonNullable<MapWorkspacePreviewTrace['identity']>): string {
  if (identity.kind === 'team') return identity.side === 'party' ? '我方共用' : '敌方共用';
  if (identity.kind === 'encounterLocal') return '遭遇局部状态';
  return identity.kind === 'partyCharacter'
    ? ctx.nameOf('character', identity.id)
    : `敌方 ${ctx.nameOf('enemy', identity.id) || identity.id}`;
}

function executionSourceLabel(ctx: UIContext, row: MapWorkspaceExecutionSequenceRow): string {
  if (row.sourceKind === 'partyAction' && row.owner?.kind === 'partyCharacter') {
    const owner = ctx.nameOf('character', row.owner.id);
    return row.cardRef === null ? `${owner} · 指令` : owner;
  }
  if (row.sourceKind === 'enemyAction' && row.owner?.kind === 'enemy') return `敌方 ${ctx.nameOf('enemy', row.owner.id) || row.owner.id}`;
  if (row.sourceKind === 'ability') return 'Ability';
  return `Item ${ctx.nameOf('item', row.sourceId ?? row.actionId)}`;
}

function sameMapCardRef(left: MapRunCardRef, right: MapRunCardRef): boolean {
  return left.kind === right.kind && left.id === right.id
    && left.scope.runId === right.scope.runId && left.scope.mapId === right.scope.mapId
    && left.scope.nodeId === right.scope.nodeId && left.scope.activityId === right.scope.activityId
    && left.scope.round === right.scope.round;
}

function executionTargetLabel(ctx: UIContext, view: MapRunActiveWorkspaceView, row: MapWorkspaceExecutionSequenceRow): string {
  if (row.target.kind === 'partyCharacter') return ctx.nameOf('character', row.target.characterId);
  if (row.target.kind === 'enemy') return `敌方 ${ctx.nameOf('enemy', row.target.enemyId) || row.target.enemyId}`;
  if (row.target.kind === 'card') {
    const targetCardRef = row.target.cardRef;
    const card = targetCardRef ? view.cards.find(candidate => sameMapCardRef(candidate.ref, targetCardRef)) : undefined;
    return card?.actionId ? `卡牌目标：${ctx.nameOf('action', card.actionId)}` : '卡牌目标';
  }
  return '无单位目标';
}

function executionSkipLabel(reason: NonNullable<MapWorkspaceExecutionSequenceRow['skipReason']>): string {
  switch (reason) {
    case 'defeated': return '来源开始时已倒下，跳过';
    case 'noLegalTarget': return '没有合法目标，跳过';
    case 'unaffordable': return '费用不足，跳过';
    case 'roundEnded': return '本轮已终结，跳过';
  }
}

function executionResultLabel(ctx: UIContext, row: MapWorkspaceExecutionSequenceRow): string {
  const details: string[] = [];
  if (row.skipReason) details.push(executionSkipLabel(row.skipReason));
  if (row.playerCostSpent > 0) details.push(`PlayerCost −${ctx.formatNumber(row.playerCostSpent)}`);
  if (row.sourceKind === 'item') details.push(row.itemConsumed ? '消耗道具' : '未消耗道具');
  if (!row.skipReason) for (const change of row.resourceChanges) {
    const enemyId = change.enemyId;
    const owner = change.scope === 'actor'
      ? change.characterId ? `${ctx.nameOf('character', change.characterId)} `
        : `敌方 ${enemyId ? ctx.nameOf('enemy', enemyId) || enemyId : '单位'} `
      : change.teamSide === 'enemy' ? '敌方共用 ' : '队伍 ';
    const delta = change.delta > 0 ? `+${ctx.formatNumber(change.delta)}` : ctx.formatNumber(change.delta);
    details.push(`${owner}${ctx.nameOf('resource', change.resourceId)} ${delta}`);
  }
  if (!row.skipReason) for (const change of row.hpChanges) {
    const owner = change.scope === 'party' ? ctx.nameOf('character', change.characterId)
      : `敌方 ${ctx.nameOf('enemy', change.enemyId) || change.enemyId}`;
    const delta = change.delta > 0 ? `+${ctx.formatNumber(change.delta)}` : ctx.formatNumber(change.delta);
    details.push(`${owner} HP ${delta}`);
  }
  return details.length ? details.join(' · ') : '没有 HP 或资源变化';
}

function previewExecutionSequence(ctx: UIContext, view: MapRunActiveWorkspaceView, sequence: readonly MapWorkspaceExecutionSequenceRow[]): string {
  if (sequence.length === 0) return '<span role="listitem">本轮没有已选执行来源。</span>';
  return sequence.map(row => {
    const status = executionResultLabel(ctx, row);
    return `<span role="listitem">执行 ${ctx.formatNumber(row.executionIndex + 1)}：${escape(ctx, executionSourceLabel(ctx, row))} · ${escape(ctx, row.actionName)} → ${escape(ctx, executionTargetLabel(ctx, view, row))} · ${escape(ctx, status)}</span>`;
  }).join('<br>');
}

function renderCommitPreviewSummary(
  ctx: UIContext,
  view: MapRunActiveWorkspaceView,
  preview: MapWorkspaceCommitPreview,
): string {
  if (!preview.canCommit) return '';
  const isAg1 = preview.executionContractId === 'AG-1';
  const executionRows = isAg1
    ? preview.executionSequence === undefined
      ? '<span role="listitem">AG-1 执行序列暂不可用。</span>'
      : previewExecutionSequence(ctx, view, preview.executionSequence)
    : '';
  const rows = (preview.effectTrace ?? []).flatMap(trace => {
    const source = previewTraceSourceLabel(ctx, trace);
    const text = trace.op === 'targetSet' ? `${source} · 解析${trace.selection === 'set' ? '目标集合' : '主目标'}：${trace.identities.length} 名，重复 ${trace.repeatCount} 次`
      : trace.op === 'when' ? `${source} · 条件${trace.result ? '成立' : '不成立'}`
      : trace.op === 'counterAdd' ? `${source} · Counter ${trace.counterId} ${ctx.formatNumber(trace.before)} → ${ctx.formatNumber(trace.after)}（变化 ${signedDelta(ctx, trace.delta)}）`
        : trace.op === 'flagSet' ? `${source} · Flag ${trace.flagId} ${trace.before ? '是' : '否'} → ${trace.after ? '是' : '否'}`
          : trace.op === 'damage' || trace.op === 'heal' ? `${source} · ${trace.identity ? `${previewRecipient(ctx, trace.identity)} ` : '受用角色 '}${trace.op === 'damage' ? `受到 ${ctx.formatNumber(trace.amount)} 点伤害` : `恢复 ${ctx.formatNumber(trace.amount)} 点 HP`}（实际 HP 变化 ${signedDelta(ctx, trace.delta)}）`
            : trace.op === 'hpChange' ? `${source} · ${trace.identity ? `${previewRecipient(ctx, trace.identity)} ` : ''}HP ${signedDelta(ctx, trace.delta)}`
            : trace.op === 'resourceSettlement' ? `${source} · ${previewRecipient(ctx, trace.identity)} ${ctx.nameOf('resource', trace.resourceId)} ${signedDelta(ctx, trace.delta)}`
              : trace.op === 'discountSCost' ? `${source} · 受用卡牌 sCost 折扣 ${ctx.formatNumber(trace.amount)}`
                : '';
    return text ? [`<span role="listitem">预览：${escape(ctx, text)}</span>`] : [];
  });
  return executionRows || rows.length
    ? `<small class="map-workspace__action-cost${isAg1 ? ' map-workspace__execution-sequence' : ''}" role="list" aria-label="${isAg1 ? 'AG-1 执行顺序预览' : 'Owner 预览结果'}">${executionRows}${executionRows && rows.length ? '<br>' : ''}${rows.join('<br>')}</small>`
    : '';
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
  const previewSummary = action.kind === 'commit'
    ? renderCommitPreviewSummary(ctx, action.view, action.preview.commitPreview)
    : '';
  return `<footer class="map-workspace__commit-dock" data-map-region-key="commit-dock">
    <div class="map-workspace__commit-balance" aria-label="当前剩余 PlayerCost">
      <div><span>PlayerCost</span><strong>${playerCost}</strong></div>
      <p role="status" aria-live="polite" data-map-commit-status>${escape(ctx, options.status)}</p>
      ${previewSummary}
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
  const completion = view.currentEncounter?.completion;
  const conditionCompletion = completion?.kind === 'condition' ? completion : null;
  if (view.activities.length === 0 && !conditionCompletion) return '';
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
  const activities = view.activities.length
    ? `<h2>本地点活动 ${view.activities.filter(activity => activity.completed).length} / ${view.activities.length}</h2>
    <ol class="map-workspace__activity-list">${rows}</ol>`
    : '<h2>遭遇进度</h2>';
  const encounterProgress = conditionCompletion
    ? renderEncounterProgress(ctx, conditionCompletion)
    : '';
  const ariaLabel = view.activities.length > 0
    ? conditionCompletion ? '本地点活动与遭遇进度' : '本地点固定活动顺序'
    : '遭遇完成进度';
  return `<section class="map-workspace__context-section" data-map-region-key="activity-progress" aria-label="${ariaLabel}">
    ${activities}${encounterProgress}
  </section>`;
}

function renderEncounterProgress(
  ctx: UIContext,
  completion: Extract<NonNullable<MapRunActiveWorkspaceView['currentEncounter']>['completion'], { kind: 'condition' }>,
): string {
  const locals = completion.locals;
  const counters = locals ? Object.entries(locals.counters).map(([id, counter]) =>
    `<li class="map-workspace__activity"${regionKey(ctx, `encounter-local:counter:${id}`)} data-map-local-kind="counter" data-map-local-id="${escape(ctx, id)}">
      <strong>Counter ${escape(ctx, id)}</strong><small>当前值 ${ctx.formatNumber(counter.value)} · 范围 ${ctx.formatNumber(counter.min)}–${ctx.formatNumber(counter.max)}</small>
    </li>`
  ) : [];
  const flags = locals ? Object.entries(locals.flags).map(([id, value]) =>
    `<li class="map-workspace__activity"${regionKey(ctx, `encounter-local:flag:${id}`)} data-map-local-kind="flag" data-map-local-id="${escape(ctx, id)}">
      <strong>Flag ${escape(ctx, id)}</strong><small>当前值 ${value ? '是' : '否'}</small>
    </li>`
  ) : [];
  const entries = [...counters, ...flags].join('');
  const localList = entries
    ? `<ul class="map-workspace__activity-list" aria-label="当前遭遇局部状态">${entries}</ul>`
    : '';
  return `<p class="map-workspace__dock-note" data-map-region-key="encounter-progress">
    完成条件：${escape(ctx, completion.label)}<br>条件声明：${escape(ctx, describeDeclaredCondition(ctx, completion.condition))}
  </p>${localList}`;
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
                ${renderUnitFace(ctx, { name: enemyName, type: '敌方', currentHp: enemy.currentHp, maxHp: enemy.maxHp,
                  shield: enemy.shield,
                  regionKey: `enemy-face:${enemy.enemyId}`, objectKey: view ? unitKey(view, 'enemy', enemy.enemyId) : undefined,
                  statusOwnerKey: `enemy:${enemy.enemyId}`, statuses: enemy.statuses })}
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

function renderPreparedAdditionalTargetPicker(
  ctx: UIContext,
  prepared: NonNullable<MapRunActiveWorkspaceView['actionPreview']>['preparedActions'][number],
  actorName: string,
  attributes: string,
): string {
  if (!prepared.additionalTargetKind) return '';
  const isPartyTarget = prepared.additionalTargetKind === 'partyCharacter';
  const selectedId = isPartyTarget ? prepared.additionalTargetCharacterId : prepared.additionalTargetEnemyId;
  const ids = isPartyTarget
    ? prepared.legalAdditionalTargetCharacterIds ?? []
    : prepared.legalAdditionalTargetEnemyIds ?? [];
  const buttons = ids.map(id => {
    const selected = selectedId === id;
    const isEnemy = !isPartyTarget;
    const command = isEnemy ? 'data-map-target-enemy-additional' : 'data-map-target-additional';
    const focus = `additional-target:${prepared.characterId}:${id}`;
    const targetAttribute = isEnemy ? `data-target-enemy-id="${escape(ctx, id)}"` : `data-target-character-id="${escape(ctx, id)}"`;
    const label = isEnemy ? `敌方 ${escape(ctx, id)}` : escape(ctx, ctx.nameOf('character', id));
    return `<button type="button" class="mini-action map-workspace__target-choice" ${command}${focusKey(ctx, focus)}${regionKey(ctx, focus)} data-character-id="${escape(ctx, prepared.characterId)}" ${targetAttribute}${attributes} aria-pressed="${selected}">${label}</button>`;
  }).join('');
  const clear = selectedId === null || selectedId === undefined ? ''
    : `<button type="button" class="mini-action map-workspace__target-clear" data-map-target-additional-clear${focusKey(ctx, `additional-target-clear:${prepared.characterId}`)} data-character-id="${escape(ctx, prepared.characterId)}"${attributes}>清除额外目标</button>`;
  return `<div class="map-workspace__target-picker map-workspace__target-picker--additional"${regionKey(ctx, `additional-targets:${prepared.characterId}`)} role="group" aria-label="${actorName} 的额外目标"><span>${prepared.additionalTargetSelectionRequired ? '选择额外目标' : '额外目标'}</span><div>${buttons || '<small>当前没有合法的额外目标。</small>'}</div>${clear}</div>`;
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
          const downed = (view.run.partyHp.find(row => row.characterId === targetCharacterId)?.currentHp ?? 0) <= 0;
          return `<button type="button" class="mini-action map-workspace__target-choice" data-map-target${focusKey(ctx, key)}${regionKey(ctx, key)} data-character-id="${escape(ctx, prepared.characterId)}" data-target-character-id="${escape(ctx, targetCharacterId)}"${attributes} aria-pressed="${selected}">${escape(ctx, ctx.nameOf('character', targetCharacterId))}${downed ? '（倒地）' : ''}</button>`;
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
  const additionalTarget = renderPreparedAdditionalTargetPicker(ctx, prepared, actorName, attributes);
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
            ${candidate.action.description ? `<span>${escape(ctx, candidate.action.description)}</span>` : ''}${renderActionCosts(ctx, candidate.action)}${renderDeclaredEffects(ctx, candidate.action)}
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
    statusOwnerKey: `partyCharacter:${prepared.characterId}`,
    shield: encounterHp?.shield,
    statuses: encounterHp?.statuses,
  });
  const actionDetail = preparedAction
    ? `<div class="map-workspace__unit-support"${regionKey(ctx, `prepared:${prepared.characterId}`)}>${preparedAction.description ? `<small>${escape(ctx, preparedAction.description)}</small>` : ''}${renderActionCosts(ctx, preparedAction)}${renderDeclaredEffects(ctx, preparedAction)}${target}${additionalTarget}</div>`
    : `<div class="map-workspace__unit-support"${regionKey(ctx, `prepared:${prepared.characterId}`)}><small>本角色本轮没有可行动作。</small>${target}${additionalTarget}</div>`;

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
    statusOwnerKey: `partyCharacter:${characterId}`,
    shield: encounterHp?.shield,
    statuses: encounterHp?.statuses,
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
    ? `<span class="map-workspace__hero-progress hover-wrap" data-tooltip="map-scene-end:${escape(ctx, runId)}"${regionKey(ctx, `hero-progress:${view.run.currentNodeId}:${activity?.activityId ?? encounter?.activityId ?? 'encounter'}`)} aria-label="当前轮次或活动进度">${escape(ctx, progressLabel)}</span>`
    : '';
  const safeRunId = escape(ctx, runId);
  const locationChoices = [...entries].reverse().find(entry => entry.mapLocations)?.mapLocations;
  const hero = `<section class="map-workspace__hero area-hero" data-map-region-key="map-hero" aria-label="当前地点">
    <div class="map-workspace__hero-heading">
      <div class="map-workspace__hero-copy">
        <h1>${escape(ctx, node?.title ?? view.map.name)}</h1>
        ${node?.description ? `<p>${escape(ctx, node.description)}</p>` : ''}
      </div>
      <button type="button" class="mini-action map-workspace__hero-action map-workspace__hero-action--back" data-map-back-to-entry="${safeRunId}" data-map-focus-key="back-entry" aria-label="返回准备页">返回准备页</button>
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
