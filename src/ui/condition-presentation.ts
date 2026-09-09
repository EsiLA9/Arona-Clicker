import type { Comparator, Condition, ConditionGroup } from '../engine/types';
import { parseStatCall } from '../engine/expression/stat-dsl';

export type ConditionViewNode = ConditionLeafViewNode | ConditionGroupViewNode;

export interface ConditionLeafViewNode {
  kind: 'leaf';
  text: string;
  met?: boolean;
}

export interface ConditionGroupViewNode {
  kind: 'group';
  mode: 'AND' | 'OR';
  children: ConditionViewNode[];
  met?: boolean;
}

export interface ConditionPresentationOptions {
  nameOf?: (type: string, id: string) => string;
  formatNumber?: (value: number) => string;
  evaluate?: (condition: Condition | ConditionGroup) => boolean;
  style?: 'plain' | 'ui';
}

const COMPARATOR_TEXT: Record<Comparator, string> = {
  '==': '＝', '!=': '≠', '>=': '≥', '<=': '≤', '>': '>', '<': '<',
};

const STAT_TEXT: Record<string, string> = {
  $GlobalProducedAmount: '全局累计产出 {key}', $CurrentRunProducedAmount: '本次游玩累计产出 {key}', $InitProducedAmount: '在 {init} 累计产出 {key}',
  $GlobalConsumedAmount: '全局累计消耗 {key}', $CurrentRunConsumedAmount: '本次游玩累计消耗 {key}', $InitConsumedAmount: '在 {init} 累计消耗 {key}',
  $GlobalCollectedAmount: '全局累计获得 {key}', $CurrentRunCollectedAmount: '本次游玩累计获得 {key}', $InitCollectedAmount: '在 {init} 累计获得 {key}',
  $GlobalUsedAmount: '全局累计使用 {key}', $CurrentRunUsedAmount: '本次游玩累计使用 {key}', $InitUsedAmount: '在 {init} 累计使用 {key}',
  $GlobalUnlockedSpots: '全局已解锁设施数', $CurrentRunUnlockedSpots: '本次游玩已解锁设施数', $InitUnlockedSpots: '在 {init} 已解锁设施数',
  $GlobalUpgradedSpots: '全局升级设施数', $CurrentRunUpgradedSpots: '本次游玩升级设施数', $InitUpgradedSpots: '在 {init} 已升级设施数',
  $GlobalUnlockedEnhancements: '全局已解锁强化数', $CurrentRunUnlockedEnhancements: '本次游玩已解锁强化数', $InitUnlockedEnhancements: '在 {init} 已解锁强化数',
  $GlobalCompletedStories: '全局已完成剧情数', $CurrentRunCompletedStories: '本次游玩已完成剧情数', $InitCompletedStories: '在 {init} 已完成剧情数',
  $GlobalUnlockedInits: '全局已解锁世界线数', $CurrentRunUnlockedInits: '本次游玩已解锁世界线数', $InitUnlockedInits: '在 {init} 已解锁世界线数',
  $GlobalFramesActive: '全局运行帧数', $CurrentRunFramesActive: '本次游玩运行帧数', $InitFramesActive: '在 {init} 运行帧数', $InitFramesInInit: '在 {init} 停留帧数',
};

function statText(dsl: string, nameOf: NonNullable<ConditionPresentationOptions['nameOf']>): string {
  const parsed = parseStatCall(dsl);
  const template = parsed && STAT_TEXT[parsed.fn];
  if (!parsed || !template) return dsl;
  const key = parsed.key === undefined ? '' : nameOf(parsed.def.metric === 'itemsCollected' || parsed.def.metric === 'itemsUsed' ? 'item' : 'resource', parsed.key);
  return template.replace('{key}', key).replace('{init}', parsed.initId ? nameOf('init', parsed.initId) : '');
}

/** 玩家界面的单原子条件文案；比较符与数字格式属于 UI 表现而非引擎契约。 */
export function describeConditionLeaf(condition: Condition, options: ConditionPresentationOptions = {}): string {
  const nameOf = options.nameOf ?? ((_: string, id: string) => id);
  const value = (options.formatNumber ?? String)(condition.value);
  const comparator = options.style === 'ui' ? (COMPARATOR_TEXT[condition.comparator] ?? condition.comparator) : condition.comparator;
  switch (condition.target) {
    case 'resource': return `${nameOf('resource', condition.key)} ${comparator} ${value}`;
    case 'spotLevel': return `${nameOf('spot', condition.key)} 等级 ${comparator} ${value}`;
    case 'manager': return `${nameOf('spot', condition.key)} 已分配 Manager`;
    case 'flag': return options.style === 'ui'
      ? `标记「${condition.key}」${comparator}${value}`
      : `标记 ${condition.key}`;
    case 'hasEnh': return `已拥有 ${nameOf('enh', condition.key)}`;
    case 'hasTag': return `拥有「${condition.key}」标签`;
    case 'countTags': return `「${condition.key}」标签数 ${comparator} ${value}`;
    case 'stat': return `${statText(condition.key, nameOf)} ${comparator} ${value}`;
    case 'hasReadStory': return `已完成故事 ${nameOf('story', condition.key)}`;
    case 'hasReadStoryInRun': return `本次游玩已完成 ${nameOf('story', condition.key)}`;
    default: return `${condition.target} ${condition.key} ${comparator} ${value}`;
  }
}

function isGroup(condition: Condition | ConditionGroup): condition is ConditionGroup {
  return 'conditions' in condition && 'type' in condition;
}

/** 仅压平直接同类子组；不改变原始 AST，也不猜测未来的组语义。 */
export function buildConditionView(condition: Condition | ConditionGroup | undefined, options: ConditionPresentationOptions = {}): ConditionViewNode | undefined {
  if (!condition) return undefined;
  if (!isGroup(condition)) return { kind: 'leaf', text: describeConditionLeaf(condition, options), met: options.evaluate?.(condition) };
  const children = condition.conditions.flatMap(child => {
    const node = buildConditionView(child, options)!;
    return node.kind === 'group' && node.mode === condition.type ? node.children : [node];
  });
  return { kind: 'group', mode: condition.type, children, met: options.evaluate?.(condition) };
}

export function renderConditionText(condition: Condition | ConditionGroup | undefined, options: ConditionPresentationOptions = {}): string {
  const view = buildConditionView(condition, options);
  if (!view) return '无条件';
  const render = (node: ConditionViewNode, nested = false): string => node.kind === 'leaf'
    ? node.text
    : node.children.length === 0 ? '无条件' : node.children.map(child => render(child, child.kind === 'group')).join(node.mode === 'AND' ? ' 且 ' : ' 或 ');
  return render(view);
}

export function renderConditionTree(node: ConditionViewNode | undefined, escapeHtml: (value: string) => string, known = true): string {
  if (!node) return '<span class="condition-empty">无条件</span>';
  if (!known) return '<span class="condition-obfuscated" aria-label="条件未知">???</span>';
  const state = node.met === undefined ? '' : node.met ? ' is-met' : ' is-unmet';
  const mark = node.met === undefined ? '' : `<span class="condition-mark" aria-label="${node.met ? '已满足' : '未满足'}">${node.met ? '•' : '◦'}</span>`;
  if (node.kind === 'leaf') return `<span class="condition-tree condition-leaf${state}">${mark}<span>${escapeHtml(node.text)}</span></span>`;
  if (node.children.length === 1) return renderConditionTree(node.children[0], escapeHtml, known);
  const title = node.mode === 'AND' ? '满足以下全部条件' : '满足以下任一条件';
  return `<section class="condition-tree condition-group${state}" role="group" aria-label="${title}">${mark}<div class="condition-group-head">${title}</div><div class="condition-group-body">${node.children.map(child => renderConditionTree(child, escapeHtml, known)).join('')}</div></section>`;
}
