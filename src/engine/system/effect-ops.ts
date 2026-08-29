// ============================================================
// engine/system/effect-ops.ts — Effect 分支执行
// 从 state-mutation-service.ts 拆出：applyEffects / applyEffect / toExtraValue
// ============================================================

import { Effect, ExtraValue, ValueExpression } from '../types';
import { ChatTextEffectValue, ThemeEffectValue } from '../types/expression';
import { assertValidExtra, extraFromJson } from '../extra/index';
import type { StateMutationService } from './state-mutation-service';

/** 依次执行一批效果（对剧情/掉落/招募等批量效果结算入口）。 */
export function applyEffects(this: StateMutationService, effects: Effect[]): void {
  for (const effect of effects) this.applyEffect(effect);
}

/** 执行单个 Effect（按 op 分发到对应写入口）。 */
export function applyEffect(this: StateMutationService, effect: Effect): void {
  switch (effect.op) {
    case 'setResource':
      this.setResource(effect.target, Number(effect.value));
      break;
    case 'addResource':
      this.changeResource(effect.target, Number(effect.value));
      break;
    case 'setSpotLevel':
      this.setSpotLevel(effect.target, Number(effect.value));
      break;
    case 'addSpotLevel':
      this.addSpotLevel(effect.target, Number(effect.value));
      break;
    case 'setManager':
      this.setManager(effect.target, effect.value as import('../types').Character);
      break;
    case 'addEnhancement':
      this.addEnhancement(String(effect.value));
      break;
    case 'addItem':
      this.addItem(effect.target, Number(effect.value));
      break;
    case 'unlockInit':
      this.unlockInit(String(effect.value));
      break;
    case 'setFlag':
      this.setFlag(effect.target, String(effect.value));
      break;
    case 'setExtra':
      this.setExtra(effect.target, toExtraValue(effect.value));
      break;
    case 'addExtra':
      this.addExtra(effect.target, Number(effect.value));
      break;
    case 'removeExtra':
      this.removeExtra(effect.target);
      break;
    case 'loot':
    case 'triggerStory':
      // 这些操作需要上层系统（Loot/Story）处理，不在状态层产生伪事件。
      break;
    case 'grantCharacter':
      // 获得角色差分（重复自动转碎片）；未知差分由 acquireCharacter 抛错
      this.acquireCharacter(effect.target, 'story');
      break;
    case 'addAffectionExp':
      // 好感小值入账（未拥有/非法量拒绝）；未知差分由 addAffectionExp 抛错
      this.addAffectionExp(effect.target, Number(effect.value));
      break;
    case 'setTheme':
    case 'clearAllChatFlow':
    case 'showChatText':
    case 'clearIdChatFlow':
    case 'clearAllChatText':
      // 临时演出主题 / 聊天流演出服务：非持久 UI 效果，由 effect-engine 转发运行时层处理，状态层不落数据。
      break;
  }
}

/** 把 Effect.value 归一为 ExtraValue：字面量 → extraFromJson；已结构化 ExtraValue 校验后透传。 */
function toExtraValue(raw: number | string | boolean | ValueExpression | ExtraValue | ThemeEffectValue | ChatTextEffectValue): ExtraValue {
  // setTheme 的 value 走运行时层（effect-engine 已过滤），此处忽略以防误入
  if (typeof raw === 'object' && raw !== null && 't' in raw) {
    const node = raw as ExtraValue;
    assertValidExtra(node);
    return node;
  }
  return extraFromJson(raw);
}
