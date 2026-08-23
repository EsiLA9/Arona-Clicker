import { Character, ConditionGroup, Condition, SpotDef, EnhancementDef, AreaDef, InitDef, ItemDef, StoryEntryDef, RevealStage, RevealTrigger, RevealTarget, PassiveStoryEntry, PassivePoolDef } from '../../engine/types';
import { TagPath, matchesTag } from '../../engine/core/tag';
import { existenceCondition, existenceMet, unlockCondition } from '../../engine/visibility/reveal';
import { parseStatCall } from '../../engine/expression/stat-dsl';
import { describeAffectorPack } from '../../engine/effect/affector-text';
import { UIContext } from '../context';

/**
 * 信息可知系统（Info Reveal）——可知性/可达性层级的第二层：揭示。
 * 可见性（实体是否出现）已统一由 revealTriggers 的 existence 目标承担：
 * - Hidden      ：实体不存在于界面（existence 门槛不满足，由 visibilityEngine 快照过滤）
 * - Obfuscated  ：实体可见，但未满足揭示条件，具体数值以 ??? 遮挡
 * - Revealed    ：完整展示所有字段
 * 对应 AccessStage：hidden → obfuscated → revealed。
 */
export type RevealLevel = 'hidden' | 'obfuscated' | 'revealed';

/** 占位符，用于遮挡未揭示的数值。 */
const OBFUSCATED = '???';

/** revealTriggers 各揭示目标的中文标签。 */
const REVEAL_TARGET_LABEL: Record<RevealTarget, string> = {
  existence: '实体出现',
  name: '名称',
  condition: '解锁条件',
  utility: '效用',
  unlock: '自动解锁',
};

/**
 * 揭示 Trigger 表：列出实体自身全部 revealTriggers（目标 + 条件）。
 * - 目标标签常显（玩家可见"需要揭示哪些信息块"）；
 * - 条件文本仅在该 Trigger 条件已满足（或实体已 owned，allKnown）时展示，
 *   否则以 ??? 遮挡，尊重信息揭示阶梯；
 * - 带 已满足/未满足 标记。
 */
export function renderRevealTriggers(
  ctx: UIContext,
  triggers: RevealTrigger[] | undefined,
  allKnown = false,
): string {
  if (!triggers || triggers.length === 0) return '';
  const rows = triggers.map(t => {
    const label = REVEAL_TARGET_LABEL[t.reveal] ?? t.reveal;
    const met = allKnown || conditionMet(t.condition, ctx.game);
    const cond = t.condition ? describeCondition(t.condition, ctx.nameOf) : '无条件';
    const text = met ? ctx.escapeHtml(cond) : OBFUSCATED;
    const mark = met ? '已满足' : '未满足';
    return `
      <div class="info-row">
        <span>${label}</span>
        <span class="${met ? 'info-accent' : 'info-dim'}">${mark} · ${text}</span>
      </div>`;
  });
  return `
    <div class="info-divider"></div>
    <div class="info-sub">揭示 Trigger</div>
    ${rows.join('')}`;
}

/** 单一条件的达成判定（缺省条件 = 视为达成）。原子条件与条件组均可。 */
const conditionMet = (
  cond: Condition | ConditionGroup | undefined,
  game: { conditionSystem: { evaluateExpr: (g: Condition | ConditionGroup, s: never) => boolean }; state: unknown },
): boolean =>
  !cond || game.conditionSystem.evaluateExpr(cond, game.state as never);

/** 由揭示 Trigger 列表计算信息是否已知：无该目标的 Trigger 视为无揭示门槛（已知）；否则任一满足即揭示。 */
function resolveRevealTriggers(
  triggers: RevealTrigger[] | undefined,
  game: { conditionSystem: { evaluateExpr: (g: Condition | ConditionGroup, s: never) => boolean }; state: unknown },
): { nameKnown: boolean; conditionKnown: boolean; utilityKnown: boolean } {
  const met = (target: RevealTarget) => {
    const list = triggers?.filter(t => t.reveal === target) ?? [];
    if (!list.length) return true;
    return list.some(t => conditionMet(t.condition, game));
  };
  return {
    nameKnown: met('name'),
    conditionKnown: met('condition'),
    utilityKnown: met('utility'),
  };
}

/**
 * 统一揭示求值：适用于 Spot / Enhancement / Init / Area / Story 等实体。
 * 从 L0 不可见到 L6 已拥有，逐级收窄信息；可达（可购买/进入/触发）即进入 L5。
 */
export interface RevealResult {
  stage: RevealStage;
  nameKnown: boolean;
  conditionKnown: boolean;
  utilityKnown: boolean;
}

export interface RevealInput {
  owned: boolean;
  triggers?: RevealTrigger[];
  /** 可达性判定（在阶梯解析后调用）：可购买/进入/触发。 */
  isAccessible: (info: { nameKnown: boolean; conditionKnown: boolean; utilityKnown: boolean }) => boolean;
}

export function resolveReveal(ctx: UIContext, input: RevealInput): RevealResult {
  if (input.owned) return { stage: 'owned', nameKnown: true, conditionKnown: true, utilityKnown: true };
  // L0 存在性：由 revealTriggers 的 existence 目标判定（原 visibilityCondition 的职责）
  if (!existenceMet(input.triggers, cond => conditionMet(cond, ctx.game))) {
    return { stage: 'invisible', nameKnown: false, conditionKnown: false, utilityKnown: false };
  }
  const info = resolveRevealTriggers(input.triggers, ctx.game);
  if (input.isAccessible(info)) {
    return { stage: 'purchaseable', nameKnown: true, conditionKnown: true, utilityKnown: true };
  }
  if (info.nameKnown && info.conditionKnown && info.utilityKnown) return { stage: 'utility', ...info };
  if (info.nameKnown && info.conditionKnown) return { stage: 'known', ...info };
  if (info.nameKnown || info.conditionKnown) return { stage: 'partial', ...info };
  return { stage: 'presence', ...info };
}

/** Enhancement 揭示：解锁条件满足即可购买（L5）。 */
export function getEnhancementReveal(ctx: UIContext, enh: EnhancementDef): RevealResult {
  const { view } = ctx;
  return resolveReveal(ctx, {
    owned: view.unlockedEnhancements.includes(enh.id),
    triggers: enh.revealTriggers,
    isAccessible: () => conditionMet(unlockCondition(enh.revealTriggers), ctx.game),
  });
}

/** Spot 揭示：可购买须先揭示信息（无阶梯时兼容：可见即可购）。 */
export function getSpotReveal(ctx: UIContext, spot: SpotDef): RevealResult {
  const { view } = ctx;
  return resolveReveal(ctx, {
    owned: (view.spotLevels[spot.id] ?? 0) > 0,
    triggers: spot.revealTriggers,
    isAccessible: info => !spot.revealTriggers?.length || (info.nameKnown && info.utilityKnown),
  });
}

/** Init 揭示：已解锁视为已拥有。 */
export function getInitReveal(ctx: UIContext, init: InitDef): RevealResult {
  const { view } = ctx;
  const unlocked = view.unlockedInits.includes(init.id);
  return resolveReveal(ctx, {
    owned: unlocked,
    triggers: init.revealTriggers,
    /** 可购买判定：已解锁或免费，或当前资源足够支付购买费用。 */
    isAccessible: () => {
      if (unlocked) return true;
      const cost = init.purchaseCost;
      if (!cost || cost.length === 0) return true;
      return cost.every(c => (view.resources[c.resourceId] ?? 0) >= c.amount);
    },
  });
}

/** Area 揭示：已访问视为已拥有。 */
export function getAreaReveal(ctx: UIContext, area: AreaDef): RevealResult {
  const { view } = ctx;
  const visited = (view.visitedAreas ?? []).includes(area.id);
  return resolveReveal(ctx, {
    owned: visited,
    triggers: area.revealTriggers,
    isAccessible: () => visited,
  });
}

/** Story 揭示：入口已完成视为已拥有；可触发（条件满足、未完成且知晓名称）视为可达。 */
export function getStoryReveal(ctx: UIContext, entry: StoryEntryDef): RevealResult {
  const { view } = ctx;
  // 完成判定统一按 Story.id 记（storyLog / completedStoryIdsThisRun）
  const completed = view.storyLog.some(s => s.storyId === entry.storyId);
  return resolveReveal(ctx, {
    owned: completed,
    triggers: entry.revealTriggers,
    isAccessible: info =>
      !completed && conditionMet(entry.triggerCondition, ctx.game) && info.nameKnown,
  });
}

/** 统计函数 DSL 的函数名 → 正式文体模板（{init}=世界线名，{key}=资源/物品名）。 */
const STAT_TEXT: Record<string, string> = {
  // 产出 / 消耗（key = 资源）
  $GlobalProducedAmount: '全局累计产出 {key}',
  $CurrentRunProducedAmount: '本次游玩累计产出 {key}',
  $InitProducedAmount: '在 {init} 累计产出 {key}',
  $GlobalConsumedAmount: '全局累计消耗 {key}',
  $CurrentRunConsumedAmount: '本次游玩累计消耗 {key}',
  $InitConsumedAmount: '在 {init} 累计消耗 {key}',
  // 获得 / 使用（key = 物品）
  $GlobalCollectedAmount: '全局累计获得 {key}',
  $CurrentRunCollectedAmount: '本次游玩累计获得 {key}',
  $InitCollectedAmount: '在 {init} 累计获得 {key}',
  $GlobalUsedAmount: '全局累计使用 {key}',
  $CurrentRunUsedAmount: '本次游玩累计使用 {key}',
  $InitUsedAmount: '在 {init} 累计使用 {key}',
  // 计数类（无 key）
  $GlobalUnlockedSpots: '全局已解锁设施数',
  $CurrentRunUnlockedSpots: '本次游玩已解锁设施数',
  $InitUnlockedSpots: '在 {init} 已解锁设施数',
  $GlobalUpgradedSpots: '全局升级设施数',
  $CurrentRunUpgradedSpots: '本次游玩升级设施数',
  $InitUpgradedSpots: '在 {init} 升级设施数',
  $GlobalUnlockedEnhancements: '全局已解锁强化数',
  $CurrentRunUnlockedEnhancements: '本次游玩已解锁强化数',
  $InitUnlockedEnhancements: '在 {init} 已解锁强化数',
  $GlobalCompletedStories: '全局已完成剧情数',
  $CurrentRunCompletedStories: '本次游玩已完成剧情数',
  $InitCompletedStories: '在 {init} 已完成剧情数',
  $GlobalUnlockedInits: '全局已解锁世界线数',
  $CurrentRunUnlockedInits: '本次游玩已解锁世界线数',
  $InitUnlockedInits: '在 {init} 已解锁世界线数',
  $GlobalFramesActive: '全局运行帧数',
  $CurrentRunFramesActive: '本次游玩运行帧数',
  $InitFramesActive: '在 {init} 运行帧数',
  $InitFramesInInit: '在 {init} 停留帧数',
};

/**
 * 将统计函数 DSL（如 `$GlobalProducedAmount base:resource:credit`）转义为正式文体，
 * 供 hover 条件描述展示。无法解析（未知函数 / 缺参）时原样返回。
 */
export function describeStatDsl(dsl: string, nameOf: (type: string, id: string) => string): string {
  const q = parseStatCall(dsl);
  if (!q) return dsl;
  const template = STAT_TEXT[q.fn];
  if (!template) return dsl;
  const key = q.key !== undefined
    ? nameOf(q.def.metric === 'itemsCollected' || q.def.metric === 'itemsUsed' ? 'item' : 'resource', q.key)
    : '';
  const init = q.initId ? nameOf('init', q.initId) : '';
  return template.replace('{key}', key).replace('{init}', init);
}

/** 单条原子条件转文本（仅覆盖原型中使用的常见形式）。 */
function describeConditionItem(c: Condition, nameOf: (type: string, id: string) => string): string {
  const valueLabel = c.value.toString();
  switch (c.target) {
    case 'resource': return `${nameOf('resource', c.key)} ${c.comparator} ${valueLabel}`;
    case 'spotLevel': return `${nameOf('spot', c.key)} 等级 ${c.comparator} ${valueLabel}`;
    case 'manager': return `${nameOf('spot', c.key)} 已分配 Manager`;
    case 'flag': return `标记 ${c.key}`;
    case 'hasEnh': return `已拥有 ${nameOf('enh', c.key)}`;
    case 'hasTag': return `拥有 "${c.key}" 标签`;
    case 'countTags': return `"${c.key}" 标签数 ${c.comparator} ${valueLabel}`;
    case 'stat': {
      const statText = describeStatDsl(c.key, nameOf);
      return `${statText} ${c.comparator} ${valueLabel}`;
    }
    case 'hasReadStory': return `已完成故事 ${nameOf('story', c.key)}`;
    case 'hasReadStoryInRun': return `本次游玩已完成 ${nameOf('story', c.key)}`;
    default: return `${c.target} ${c.key} ${c.comparator} ${valueLabel}`;
  }
}

/** 条件文本描述：单条原子条件或条件组（仅覆盖原型中使用的常见形式）。 */
export function describeCondition(
  cond: Condition | ConditionGroup | undefined,
  nameOf: (type: string, id: string) => string = (_, id) => id,
): string {
  if (!cond) return '无条件';
  if (!('conditions' in cond) || !('type' in cond)) {
    return describeConditionItem(cond as Condition, nameOf);
  }
  const group = cond as ConditionGroup;
  if (!group.conditions.length) return '无条件';
  const parts = group.conditions.map(condition => {
    if ('type' in condition && 'conditions' in condition) {
      return `(${describeCondition(condition as ConditionGroup, nameOf)})`;
    }
    return describeConditionItem(condition as Condition, nameOf);
  });
  return parts.join(group.type === 'AND' ? ' 且 ' : ' 或 ');
}

/** 计算某 Spot 适用的 Enhancement 产出倍率（按 tag 过滤，组内累乘）。作用域全局。 */
export function getEnhancementMultiplier(ctx: UIContext, spot: SpotDef): number {
  const spotTags = spot.tags ?? [];
  return ctx.view.unlockedEnhancements.reduce((multiplier, enhId) => {
    const enh = ctx.game.registry.enhancements.get(enhId);
    if (!enh?.productionMultiplier) return multiplier;
    if (enh.productionTags && enh.productionTags.length > 0
      && !enh.productionTags.some(query => spotTags.some(declared => matchesTag(declared, query)))) {
      return multiplier;
    }
    return multiplier * enh.productionMultiplier;
  }, 1);
}

interface YieldBreakdown {
  base: number;
  managerBonus: number;
  tagMultiplier: number;
  enhMultiplier: number;
  total: number;
}

/** 与 TickSystem 一致的产出分解，供 hover 展示（manager 加成已冻结，恒 0/1）。 */
export function getSpotYieldBreakdown(ctx: UIContext, spot: SpotDef): YieldBreakdown {
  const base = ctx.game.valueSystem.evaluate(spot.baseYield, ctx.game.state as never);
  const enhMultiplier = getEnhancementMultiplier(ctx, spot);
  return {
    base,
    managerBonus: 0,
    tagMultiplier: 1,
    enhMultiplier,
    total: base * enhMultiplier,
  };
}

/** 生成 Area 的详情信息面板 HTML（按信息揭示阶梯遮挡）。 */
export function renderAreaDetail(ctx: UIContext, area: AreaDef): string {
  const { game, view } = ctx;
  const reveal = getAreaReveal(ctx, area);
  const known = reveal.utilityKnown;
  const isCurrent = view.currentAreaId === area.id;
  const visible = view.visibility.areas[area.id] ?? false;
  const isLocked = !visible;
  const name = reveal.nameKnown ? area.name : OBFUSCATED;
  const desc = known ? area.description : '';
  const init = game.registry.inits.get(area.initId);
  const spotIds = game.registry.spotsOfArea(area.id);
  const spotRows = spotIds.map(spotId => {
    const spot = game.registry.spots.get(spotId);
    if (!spot) return '';
    const level = view.spotLevels[spotId] ?? 0;
    const owned = level > 0;
    const yieldInfo = getSpotYieldBreakdown(ctx, spot);
    const resource = ctx.nameOf('resource', spot.baseYieldResource);
    return `
      <div class="info-spot">
        <span class="info-spot-name">${ctx.escapeHtml(spot.name)}</span>
        <span class="${owned ? 'info-accent' : 'info-dim'}">${owned ? `Lv.${level} · ${ctx.formatNumber(yieldInfo.total)} ${resource}/t` : '未获取'}</span>
      </div>`;
  }).join('');
  const adjacentRows = (area.adjacentAreaIds ?? [])
    .map(adjId => game.registry.areas.get(adjId))
    .filter((adj): adj is AreaDef => !!adj)
    .map(adj => {
      const adjReveal = getAreaReveal(ctx, adj);
      return `<span class="info-tag">${ctx.escapeHtml(adjReveal.nameKnown ? adj.name : OBFUSCATED)}</span>`;
    })
    .join('');
  const spotSummary = spotRows || '<div class="info-dim">尚无设施</div>';

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">AREA</span><strong>${ctx.escapeHtml(name)}</strong>${isCurrent ? '<span class="info-current">CURRENT</span>' : isLocked ? '<span class="info-lock">LOCKED</span>' : ''}</div>
      ${desc ? `<p class="info-desc">${ctx.escapeHtml(desc)}</p>` : ''}
      <div class="info-divider"></div>
      ${known ? `<div class="info-row"><span>所属世界线</span><span>${ctx.escapeHtml(ctx.nameOf('init', area.initId))}</span></div>` : ''}
      ${isLocked
        ? `<div class="info-row"><span>状态</span><span class="info-dim">尚未开放</span></div>
           <div class="info-row"><span>解锁条件</span><span>${ctx.escapeHtml(describeCondition(existenceCondition(area.revealTriggers), ctx.nameOf))}</span></div>`
        : known
          ? `<div class="info-row"><span>运营设施</span><span>${spotIds.length} 处 · ${spotIds.filter(id => (view.spotLevels[id] ?? 0) > 0).length} 已启用</span></div>
             <div class="info-sub">设施明细</div>
             <div class="info-spot-list">${spotSummary}</div>`
          : ''}
      <div class="info-divider"></div>
      <div class="info-row"><span>相邻区域</span></div>
      <div class="info-tags">${adjacentRows || '<span class="info-dim">无相邻区域</span>'}</div>
      ${renderRevealTriggers(ctx, area.revealTriggers, reveal.stage === 'owned')}
    </div>`;
}

/** 生成 Spot 的详情信息面板 HTML。 */
export function renderSpotDetail(ctx: UIContext, spot: SpotDef, level: number): string {
  const { game, view } = ctx;
  const reveal = getSpotReveal(ctx, spot);
  const owned = reveal.stage === 'owned';
  const known = reveal.utilityKnown;   // 效用已揭示才展示运行数值
  const show = (k: boolean, text: string): string => (k ? text : OBFUSCATED);
  const yieldInfo = getSpotYieldBreakdown(ctx, spot);
  const resource = ctx.nameOf('resource', spot.baseYieldResource);
  const manager = view.spotManagers[spot.id] ?? Character.None;
  const managerName = ctx.nameOf('character', manager);

  // 下一级升级信息（通用升级：指数花费；否则 levelUpgrades 逐级）
  const nextLevel = level + 1;
  const maxLevel = game.getEffectiveMaxLevel(spot.id);
  const capped = maxLevel !== undefined && nextLevel > maxLevel;

  const upgradeCostText: string | null = capped
    ? null
    : (() => {
        // 优先用 levelUpgrades 的显式 cost
        const nextUpgrade = (spot.levelUpgrades ?? []).find(u => u.level === nextLevel);
        if (nextUpgrade?.cost !== undefined) {
          return ctx.formatNumber(game.valueSystem.evaluate(nextUpgrade.cost, game.state as never));
        }
        // 通用公式
        if (spot.upgradeCostBase !== undefined) {
          return ctx.formatNumber(Math.floor(spot.upgradeCostBase * Math.pow(spot.upgradeCostGrowth ?? 1, nextLevel - 1)));
        }
        // 无下一级定义
        if (nextUpgrade) return null;
        return null;
      })();

  const nextUpgradeDef = (spot.levelUpgrades ?? []).find(u => u.level === nextLevel);
  const upgradeRow = !known
    ? `<div class="info-row"><span>升级</span><span>${OBFUSCATED}</span></div>`
    : upgradeCostText !== null
      ? `<div class="info-row"><span>升级 Lv.${nextLevel}</span><span>${upgradeCostText} ${ctx.nameOf('resource', spot.baseCostResource)}${nextUpgradeDef?.condition ? ' · 需条件' : ''}</span></div>`
      : `<div class="info-row"><span>升级</span><span class="info-dim">${capped ? `已达上限 Lv.${maxLevel}` : '已达当前上限'}</span></div>`;

  const managerBonusRow = !known || manager === Character.None
    ? ''
    : `<div class="info-row"><span>Manager 加成</span><span>+${ctx.formatNumber(yieldInfo.managerBonus)} · ×${yieldInfo.tagMultiplier.toFixed(2)}</span></div>`;

  // Spot 功能（内源 + 外源）：线性产出 / 交互型功能；未揭示时遮挡。
  const funcRows = !known
    ? ''
    : game.spotFunctionalitySystem.functionalitiesOf(spot, game.state as never).map(fn => {
      if (fn.kind === 'linearYield') {
        const perLevel = `每级 +${ctx.formatNumber(fn.amountPerLevel ?? 0)} ${ctx.nameOf('resource', fn.resource ?? '')}`;
        const active = fn.condition && !game.conditionSystem.evaluateGroup(fn.condition, game.state as never)
          ? '（未生效）'
          : '';
        const cond = fn.condition
          ? ` · 条件：${ctx.escapeHtml(describeCondition(fn.condition, ctx.nameOf))}`
          : '';
        return `<div class="info-row"><span>功能</span><span>${ctx.escapeHtml(perLevel)}${cond}${active}</span></div>`;
      }
      if (fn.kind === 'restartInit') {
        return `<div class="info-row"><span>功能</span><span class="info-accent">结束当前游戏 · 重选世界线</span></div>`;
      }
      if (fn.kind === 'hardResetInit') {
        return `<div class="info-row"><span>功能</span><span class="info-warn">彻底重置当前世界线 · 下次进入为崭新</span></div>`;
      }
      return '';
    }).join('');

  const name = reveal.nameKnown ? spot.name : OBFUSCATED;
  const desc = known
    ? `<p class="info-desc">${ctx.escapeHtml(spot.description)}</p>`
    : '';
  const condText = reveal.conditionKnown
    ? describeCondition(unlockCondition(spot.revealTriggers) ?? existenceCondition(spot.revealTriggers), ctx.nameOf)
    : OBFUSCATED;

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">SPOT</span><strong>${ctx.escapeHtml(name)}</strong></div>
      ${desc}
      <div class="info-divider"></div>
      ${owned ? '' : `<div class="info-row"><span>获取条件</span><span>${ctx.escapeHtml(condText)}</span></div>`}
      <div class="info-row"><span>当前等级</span><span class="info-accent">${show(known, `Lv.${level}`)}</span></div>
      <div class="info-row"><span>基础产出</span><span>${show(known, `${ctx.formatNumber(yieldInfo.base)} ${resource} / tick`)}</span></div>
      ${managerBonusRow}
      <div class="info-row"><span>强化倍率</span><span>${show(known, `×${yieldInfo.enhMultiplier.toFixed(2)}${yieldInfo.enhMultiplier === 1 ? '（未获得）' : ''}`)}</span></div>
      <div class="info-row"><span>实际入账</span><span class="info-accent">${show(known, `${ctx.formatNumber(yieldInfo.total)} ${resource} / tick`)}</span></div>
      ${funcRows}
      <div class="info-row"><span>容量上限</span><span>${show(known, spot.baseCapacity > 0 ? ctx.formatNumber(spot.baseCapacity) : '无限制')}</span></div>
      ${upgradeRow}
      ${maxLevel !== undefined ? `<div class="info-row"><span>等级上限</span><span class="info-dim">Lv.${maxLevel}</span></div>` : ''}
      <div class="info-row"><span>Manager</span><span>${ctx.escapeHtml(managerName)}</span></div>
      <div class="info-divider"></div>
      <div class="info-tags">${known ? (spot.tags ?? []).map(tag => {
        const name = ctx.game.registry.tagName(tag);
        const desc = ctx.game.registry.tagDescription(tag);
        const tip = desc ? ` title="${ctx.escapeHtml(desc)}"` : '';
        return `<span class="info-tag"${tip}>${ctx.escapeHtml(name)}</span>`;
      }).join('') : ''}</div>
      ${renderRevealTriggers(ctx, spot.revealTriggers, owned)}
    </div>`;
}

/** 生成资源（Resource）的详情信息面板 HTML：当前值 + 按需统计。 */
export function renderResourceDetail(ctx: UIContext, resourceId: string): string {
  const { game, view } = ctx;
  const value = view.resources[resourceId] ?? 0;
  const initId = view.activeInit;
  const stat = (dsl: string) => game.statsService.evaluate(dsl) ?? 0;
  const perTick = game.gameNumSystem.evaluateResourceGain(resourceId, game.state as never) ?? 0;
  const produced = stat(`$GlobalProducedAmount ${resourceId}`);
  const consumed = stat(`$GlobalConsumedAmount ${resourceId}`);
  const runProduced = stat(`$CurrentRunProducedAmount ${resourceId}`);
  const initProduced = initId ? stat(`$InitProducedAmount ${initId} ${resourceId}`) : null;

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">RESOURCE</span><strong>${ctx.escapeHtml(ctx.nameOf('resource', resourceId))}</strong></div>
      <div class="info-divider"></div>
      <div class="info-row"><span>当前持有</span><span class="info-accent">${ctx.formatNumber(value)}</span></div>
      <div class="info-row"><span>每 Tick 获取</span><span class="info-accent">+${ctx.formatNumber(perTick)}</span></div>
      <div class="info-row"><span>累计产出</span><span>${ctx.formatNumber(produced)}</span></div>
      <div class="info-row"><span>累计消耗</span><span>${ctx.formatNumber(consumed)}</span></div>
      <div class="info-row"><span>本次游玩产出</span><span>${ctx.formatNumber(runProduced)}</span></div>
      ${initId !== null && initProduced !== null
        ? `<div class="info-row"><span>${ctx.escapeHtml(ctx.nameOf('init', initId))} 产出</span><span>${ctx.formatNumber(initProduced)}</span></div>`
        : ''}
    </div>`;
}

/** 生成 Enhancement 的详情信息面板 HTML。 */
export function renderEnhancementDetail(ctx: UIContext, enh: EnhancementDef): string {
  const reveal = getEnhancementReveal(ctx, enh);
  const owned = reveal.stage === 'owned';
  const purchaseable = reveal.stage === 'purchaseable';
  const priceText = enh.price?.length
    ? enh.price.map(cost => `${ctx.formatNumber(cost.amount)} ${ctx.nameOf('resource', cost.resourceId)}`).join(' · ')
    : '无花费';

  // 按信息揭示阶梯遮挡：名称/解锁条件/效用 各自可见才展示，否则 ???。
  const name = reveal.nameKnown ? enh.name : OBFUSCATED;
  const desc = reveal.utilityKnown
    ? `<p class="info-desc">${ctx.escapeHtml(enh.description)}</p>`
    : '';
  const condText = reveal.conditionKnown ? describeCondition(unlockCondition(enh.revealTriggers), ctx.nameOf) : OBFUSCATED;
  const priceRow = purchaseable || reveal.utilityKnown
    ? `<div class="info-row"><span>购买花费</span><span>${ctx.escapeHtml(priceText)}</span></div>`
    : '';
  const multRow = reveal.utilityKnown && enh.productionMultiplier
    ? `<div class="info-row"><span>产出倍率</span><span class="info-accent">×${enh.productionMultiplier.toFixed(2)}</span></div>`
    : '';
  const scopeRow = reveal.utilityKnown && enh.productionTags && enh.productionTags.length
    ? `<div class="info-row"><span>作用范围</span><span>${ctx.escapeHtml(enh.productionTags.map(t => ctx.game.registry.tagName(t)).join(' / '))} 类 Spot</span></div>`
    : '';

  const status = owned ? '已激活' : purchaseable ? '可购买' : '未解锁';
  // 挂载的 Affector Pack：通用展示文本（条件 + 效果逐条转译）
  const affectorSection = reveal.utilityKnown && enh.affectorPackIds?.length
    ? (() => {
        const lines = enh.affectorPackIds.flatMap(pid => {
          const pack = ctx.game.affectorEngine.getPack(pid);
          if (!pack) return [];
          return describeAffectorPack(pack, ctx.nameOf, {
            describeCondition: cond => describeCondition(cond, ctx.nameOf),
          });
        });
        if (lines.length === 0) return '';
        return `<div class="info-divider"></div><div class="info-sub">挂载效果（持有即持续生效）</div>${lines
          .map(line => `<div class="info-row"><span>${ctx.escapeHtml(line)}</span></div>`)
          .join('')}`;
      })()
    : '';
  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">ENHANCEMENT</span><strong>${ctx.escapeHtml(name)}</strong></div>
      ${desc}
      <div class="info-divider"></div>
      <div class="info-row"><span>状态</span><span class="${owned || purchaseable ? 'info-accent' : 'info-dim'}">${status}</span></div>
      <div class="info-row"><span>解锁条件</span><span>${ctx.escapeHtml(condText)}</span></div>
      ${priceRow}
      ${multRow}
      ${scopeRow}
      ${owned && enh.maxStacks ? `<div class="info-row"><span>最大叠加</span><span>${String(enh.maxStacks)}</span></div>` : ''}
      ${affectorSection}
      ${owned && enh.effects.length ? `<div class="info-row"><span>附带效果</span><span>${enh.effects.length} 项</span></div>` : ''}
      ${renderRevealTriggers(ctx, enh.revealTriggers, owned)}
    </div>`;
}

/** 生成 Init（世界线）的详情信息面板 HTML。 */
export function renderInitDetail(ctx: UIContext, init: InitDef): string {
  const reveal = getInitReveal(ctx, init);
  const owned = reveal.stage === 'owned';
  const purchaseable = reveal.stage === 'purchaseable';
  const isActive = ctx.view.activeInit === init.id;

  const name = reveal.nameKnown ? init.name : OBFUSCATED;
  const desc = reveal.utilityKnown
    ? `<p class="info-desc">${ctx.escapeHtml(init.description)}</p>`
    : '';

  const areas = ctx.game.registry.areasOfInit(init.id);
  const spotCount = areas.reduce(
    (sum, areaId) => sum + ctx.game.registry.spotsOfArea(areaId).length,
    0,
  );

  // 默认区域列表
  const defaultAreaNames = reveal.utilityKnown && init.defaultAreas.length
    ? init.defaultAreas
        .map(aid => {
          const area = ctx.game.registry.areas.get(aid);
          return area ? ctx.escapeHtml(area.name) : aid;
        })
        .join('、')
    : '';

  // 购买费用
  const costText = (init.purchaseCost ?? []).length
    ? (init.purchaseCost ?? []).map(c => `${ctx.formatNumber(c.amount)} ${ctx.nameOf('resource', c.resourceId)}`).join(' · ')
    : '免费';

  const statusText = isActive
    ? '当前世界线'
    : owned
      ? '已解锁'
      : purchaseable
        ? '可购买'
        : '未解锁';

  const statusClass = isActive || owned || purchaseable ? 'info-accent' : 'info-dim';

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">INIT</span><strong>${ctx.escapeHtml(name)}</strong>${isActive ? '<span class="info-current">ACTIVE</span>' : ''}</div>
      ${desc}
      <div class="info-divider"></div>
      <div class="info-row"><span>状态</span><span class="${statusClass}">${statusText}</span></div>
      ${reveal.utilityKnown
        ? `<div class="info-row"><span>区域 / 设施</span><span>${areas.length} AREA · ${spotCount} SPOT</span></div>`
        : `<div class="info-row"><span>规模</span><span>${OBFUSCATED}</span></div>`}
      ${reveal.utilityKnown && defaultAreaNames
        ? `<div class="info-row"><span>默认区域</span><span>${defaultAreaNames}</span></div>`
        : ''}
      ${!owned
        ? `<div class="info-row"><span>解锁花费</span><span>${reveal.conditionKnown ? ctx.escapeHtml(costText) : OBFUSCATED}</span></div>`
        : ''}
      ${reveal.utilityKnown
        ? `<div class="info-divider"></div><div class="info-row"><span>进度</span><span>${owned ? '独立保存，随时可返回' : '尚未开始'}</span></div>`
        : ''}
      ${renderRevealTriggers(ctx, init.revealTriggers, owned)}
    </div>`;
}

/** 生成 Item（背包物品）的详情信息面板 HTML。 */
export function renderItemDetail(ctx: UIContext, item: ItemDef): string {
  const count = ctx.view.inventory[item.id] ?? 0;
  const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' }[item.rarity] ?? item.rarity;
  const typeLabel = { consumable: '消耗品', material: '材料', key: '关键道具' }[item.type] ?? item.type;

  const effectLines: string[] = [];
  if (item.useEffects?.length) {
    for (const ef of item.useEffects) {
      if (ef.op === 'addResource' || ef.op === 'setResource') {
        effectLines.push(`获得 ${ef.value ?? 0} ${ctx.nameOf('resource', ef.target)}`);
      } else if (ef.op === 'addItem') {
        effectLines.push(`获得 ${ef.target}`);
      } else if (ef.op === 'addEnhancement') {
        effectLines.push(`解锁强化 ${ef.target}`);
      } else {
        effectLines.push(ef.op);
      }
    }
  }
  const effectsText = effectLines.length
    ? `<div class="info-divider"></div><div class="info-row"><span>使用效果</span><span>${effectLines.map(l => ctx.escapeHtml(l)).join(' · ')}</span></div>`
    : '';

  const sellText = item.sellPrice
    ? `<div class="info-row"><span>售价</span><span>${ctx.formatNumber(item.sellPrice.amount)} ${ctx.nameOf('resource', item.sellPrice.resourceId)}</span></div>`
    : '';

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">ITEM</span><strong>${ctx.escapeHtml(item.name)}</strong><span class="info-rarity info-rarity-${item.rarity}">${rarityLabel}</span></div>
      <p class="info-desc">${ctx.escapeHtml(item.description)}</p>
      <div class="info-divider"></div>
      <div class="info-row"><span>类型</span><span>${typeLabel}</span></div>
      <div class="info-row"><span>持有</span><span class="info-accent">${count}</span></div>
      <div class="info-row"><span>最大堆叠</span><span>${item.maxStack}</span></div>
      ${sellText}
      ${effectsText}
      ${item.type === 'consumable'
        ? `<div class="info-divider"></div><div class="info-row"><span>操作</span><span>右键使用</span></div>`
        : ''}
      ${renderRevealTriggers(ctx, item.revealTriggers, true)}
    </div>`;
}

/**
 * 统一弹层内容入口。
 * key 格式：`spot:<id>` | `enh:<id>` | `area:<id>` | `init:<id>`。
 * 返回带 .info-popover 的 HTML，供 body 级浮层注入。
 */
export function getTooltipContent(ctx: UIContext, key: string): string {
  // 实体 ID 为三段式（base:spot:credit_printer），只能按第一个冒号切分，保留完整 ID
  const sep = key.indexOf(':');
  if (sep === -1) return '';
  const kind = key.slice(0, sep);
  const id = key.slice(sep + 1);
  switch (kind) {
    case 'spot': {
      const spot = ctx.game.registry.spots.get(id);
      if (!spot) return '';
      const level = ctx.view.spotLevels[id] ?? 0;
      return renderSpotDetail(ctx, spot, level);
    }
    case 'enh': {
      const enh = ctx.game.registry.enhancements.get(id);
      return enh ? renderEnhancementDetail(ctx, enh) : '';
    }
    case 'area': {
      const area = ctx.game.registry.areas.get(id);
      return area ? renderAreaDetail(ctx, area) : '';
    }
    case 'init': {
      const init = ctx.game.registry.inits.get(id);
      return init ? renderInitDetail(ctx, init) : '';
    }
    case 'item': {
      const item = ctx.game.registry.items.get(id);
      return item ? renderItemDetail(ctx, item) : '';
    }
    case 'resource':
      return renderResourceDetail(ctx, id);
    case 'passive': {
      const entry = ctx.game.registry.passiveStories.get(id);
      return entry ? renderPassiveEntryDetail(ctx, entry) : '';
    }
    case 'pool': {
      const pool = ctx.game.registry.passivePools.get(id);
      return pool ? renderPoolDetail(ctx, pool) : '';
    }
    default:
      return '';
  }
}

/** 被动闲聊池详情（收集图鉴悬停用）。 */
function renderPoolDetail(ctx: UIContext, pool: PassivePoolDef): string {
  const directEntries = pool.children
    .map(child => ctx.game.registry.passiveStories.get(child.id))
    .filter((entry): entry is PassiveStoryEntry => !!entry);
  const subPoolIds = pool.children.filter(child => ctx.game.registry.passivePools.has(child.id));
  const totalWeight = pool.children.reduce((sum, child) => sum + (child.weight ?? 1), 0);
  const tags = (pool.tags ?? []).map(t => t.join('/')).join('、') || '无';
  const gateText = pool.condition ? describeCondition(pool.condition, ctx.nameOf) : '无条件';

  const childRows = [
    ...directEntries.map(entry => {
      const count = (ctx.game.state.storyLog ?? []).filter(s => s.storyId === entry.storyId).length;
      const done = count > 0;
      return `<div class="info-row"><span>${ctx.escapeHtml(ctx.nameOf('story', entry.storyId))}</span><span class="${done ? 'info-accent' : 'info-dim'}">${done ? `已收集 ×${count}` : '未收集'} · w${entry.weight}</span></div>`;
    }),
    ...subPoolIds.map(child => `<div class="info-row"><span>子池</span><span>${ctx.escapeHtml(ctx.nameOf('pool', child.id))}</span></div>`),
  ].join('');

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">POOL</span><strong>${ctx.escapeHtml(pool.name ?? pool.id)}</strong></div>
      <div class="info-row"><span>gate 条件</span><span>${ctx.escapeHtml(gateText)}</span></div>
      <div class="info-row"><span>权重合计</span><span>${totalWeight}（子节点 ${pool.children.length}：条目 ${directEntries.length} / 子池 ${subPoolIds.length}）</span></div>
      <div class="info-row"><span>标签</span><span>${ctx.escapeHtml(tags)}</span></div>
      <div class="info-divider"></div>
      ${childRows}
    </div>`;
}

/** 被动闲聊条目详情（收集图鉴悬停用）。 */
function renderPassiveEntryDetail(ctx: UIContext, entry: PassiveStoryEntry): string {
  const logs = (ctx.game.state.storyLog ?? []).filter(s => s.storyId === entry.storyId);
  const done = logs.length > 0;
  const inits = entry.availableInits.length === 0
    ? '全部世界线'
    : entry.availableInits.map(i => ctx.nameOf('init', i)).join('、');
  const reward = entry.completionReward;
  const rewardText = reward
    ? [
        reward.first ? `首次 ${summarizeEffects(ctx, reward.first)}` : '',
        reward.repeat ? `重复 ${summarizeEffects(ctx, reward.repeat)}` : '',
      ].filter(Boolean).join(' · ') || '无'
    : '无';
  const tags = (entry.tags ?? []).map(t => t.join('/')).join('、') || '无';

  return `
    <div class="info-popover">
      <div class="info-head"><span class="info-kind">PASSIVE</span><strong>${ctx.escapeHtml(ctx.nameOf('story', entry.storyId))}</strong></div>
      <div class="info-sub">${done ? '已收集' : '未收集'}</div>
      <div class="info-row"><span>完成次数</span><span>${logs.length}</span></div>
      <div class="info-row"><span>权重</span><span>${entry.weight}（可${entry.repeatable ? '' : '不'}重复）</span></div>
      <div class="info-row"><span>可用世界线</span><span>${ctx.escapeHtml(inits)}</span></div>
      <div class="info-row"><span>标签</span><span>${ctx.escapeHtml(tags)}</span></div>
      <div class="info-divider"></div>
      <div class="info-row"><span>完结奖励</span><span>${ctx.escapeHtml(rewardText)}</span></div>
    </div>`;
}

/** 奖励效果摘要（仅展示 addResource 类；其余以数量计）。 */
function summarizeEffects(ctx: UIContext, effects: { op: string; target?: string; value?: unknown }[]): string {
  return effects
    .map(effect => {
      if (effect.op === 'addResource' && effect.target) {
        return `${ctx.nameOf('resource', effect.target)} +${effect.value}`;
      }
      return `${effect.op}`;
    })
    .join('、');
}
