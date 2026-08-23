// ============================================================
// engine/affector-text.ts — Affector 通用展示文本转换
//
// 把 AffectorPackDef / entry / Effect 全量转成人类可读文本：
// - describeEffect 对 EffectOp 做 exhaustive switch（新增 op 未处理时编译报错）；
// - describeValue 覆盖 ValueExpression 全部 source 与 ExtraValue 全部变体；
// - 纯函数、不依赖 DOM：UI（tooltip / 效果追踪面板）与测试共用同一实现。
//
// 名称解析通过 nameOf 回调注入（即 UIContext.nameOf / displayName），
// 引擎层不耦合具体显示名服务。
// ============================================================

import type { Effect, ValueExpression, Value, ExtraValue } from '../types';

export type NameResolver = (type: string, id: string) => string;

/** ValueExpression → 紧凑展示文本。 */
export function describeValueExpression(expr: ValueExpression, nameOf: NameResolver): string {
  if (expr.type === 'const') return String(expr.value);
  if (expr.type === 'mul') {
    return `${describeValueExpression(expr.left, nameOf)}×${describeValueExpression(expr.right, nameOf)}`;
  }
  return describeValue(expr.value, nameOf);
}

/** 单个 Value → 展示文本（覆盖全部 ValueSource）。 */
export function describeValue(val: Value, nameOf: NameResolver): string {
  const p = val.params ?? {};
  switch (val.source) {
    case 'const': return String(p.value ?? 0);
    case 'res': return nameOf('resource', String(p.resource ?? ''));
    case 'spotLevel': return `${nameOf('spot', String(p.spot ?? ''))}等级`;
    case 'spotCount': return `${nameOf('area', String(p.area ?? ''))}设施数`;
    case 'managerCount': return `${nameOf('init', String(p.init ?? ''))}经理数`;
    case 'funclet': return `函数 ${String(p.funclet ?? '')}(...)`;
    case 'data': return `数据 ${String(p.path ?? '')}`;
    default: return '?';
  }
}

/** ExtraValue → 紧凑展示文本（覆盖全部变体）。 */
export function describeExtraValue(value: ExtraValue): string {
  switch (value.t) {
    case 'int':
    case 'float':
    case 'str':
    case 'bool': return String(value.v);
    case 'list': return `[${value.v.map(describeExtraValue).join(', ')}]`;
    case 'dict': return `{${Object.entries(value.v).map(([k, v]) => `${k}: ${describeExtraValue(v)}`).join(', ')}}`;
    default: return '?';
  }
}

/** 效果值 → 文本（数字/字面量直出；表达式/结构化值走专用渲染）。 */
function describeEffectValue(effect: Effect, nameOf: NameResolver): string {
  const value = effect.value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 't' in value) return describeExtraValue(value as ExtraValue);
  return describeValueExpression(value as ValueExpression, nameOf);
}

/**
 * 单条效果 → 展示文本。
 * exhaustive：EffectOp 新增成员时此处编译报错，强制补全文案。
 */
export function describeEffect(effect: Effect, nameOf: NameResolver): string {
  const target = effect.target;
  const valueText = describeEffectValue(effect, nameOf);
  switch (effect.op) {
    case 'setResource': return `${nameOf('resource', target)} 设为 ${valueText}`;
    case 'addResource': return `每 Tick ${nameOf('resource', target)} +${valueText}`;
    case 'setSpotLevel': return `${nameOf('spot', target)} 等级设为 ${valueText}`;
    case 'addSpotLevel': return `${nameOf('spot', target)} 等级 +${valueText}`;
    case 'setManager': return `指派 ${nameOf('character', valueText)} 至 ${nameOf('spot', target)}`;
    case 'addEnhancement': return `获得强化「${nameOf('enh', valueText)}」`;
    case 'addItem': return `获得物品 ${nameOf('item', target)} ×${valueText}`;
    case 'loot': return `触发掉落表 ${target}`;
    case 'unlockInit': return `解锁世界线 ${nameOf('init', valueText)}`;
    case 'setFlag': return `标记 ${target} = ${valueText}`;
    case 'triggerStory': return `触发剧情 ${nameOf('story', valueText)}`;
    case 'travelToArea': return `移动至区域 ${nameOf('area', target)}`;
    case 'setSpotMaxLevel': return `${nameOf('spot', target)} 等级上限 → ${valueText}`;
    case 'removeSpotMaxLevel': return `解除 ${nameOf('spot', target)} 等级上限`;
    case 'setExtra': return `设置数据 ${target} = ${valueText}`;
    case 'addExtra': return `数据 ${target} +${valueText}`;
    case 'removeExtra': return `移除数据 ${target}`;
    case 'grantCharacter': return `获得学生「${valueText}」`;
    case 'setTheme': return `临时主题：${valueText}`;
    default: {
      // 穷尽性守卫：EffectOp 新增成员而未补文案时编译报错
      const never: never = effect.op;
      void never;
      return effect.op;
    }
  }
}

/** 条件 → 文本（由调用方注入，引擎层不复制条件文案逻辑）。 */
export interface DescribeOptions {
  /** 条件描述器（如 tooltip 的 describeCondition）。缺省 = 不展示条件前缀。 */
  describeCondition?: (condition: import('../types').ConditionGroup) => string;
}

/** Affector entry → 「【条件】效果1；效果2」。 */
export function describeAffectorEntry(
  entry: { condition?: import('../types').ConditionGroup; effects: Effect[] },
  nameOf: NameResolver,
  opts: DescribeOptions = {},
): string {
  const body = entry.effects.map(effect => describeEffect(effect, nameOf)).join('；') || '(无效果)';
  const gate = entry.condition && opts.describeCondition ? opts.describeCondition(entry.condition) : undefined;
  return gate ? `【${gate}】${body}` : body;
}

/** Affector pack → 每 entry 一行文本。 */
export function describeAffectorPack(
  pack: { entries: { id: string; condition?: import('../types').ConditionGroup; effects: Effect[] }[] },
  nameOf: NameResolver,
  opts: DescribeOptions = {},
): string[] {
  return pack.entries.map(entry => describeAffectorEntry(entry, nameOf, opts));
}
