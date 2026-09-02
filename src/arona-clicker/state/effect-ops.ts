import type { Effect, ExtraValue, ValueExpression } from '../../engine/types';
import type { ChatTextEffectValue } from '../../engine/contracts/chat-presentation';
import type { ThemeEffectValue } from '../../engine/types/expression';
import { assertValidExtra, extraFromJson } from '../../engine/extra/index';
import type { EffectMutationPort } from '../contracts/effect-mutation';

export function applyEffects(this: EffectMutationPort, effects: Effect[]): void {
  for (const effect of effects) this.applyEffect(effect);
}

export function applyEffect(this: EffectMutationPort, effect: Effect): void {
  switch (effect.op) {
    case 'setResource': this.setResource(effect.target, Number(effect.value)); break;
    case 'addResource': this.changeResource(effect.target, Number(effect.value)); break;
    case 'setSpotLevel': this.setSpotLevel(effect.target, Number(effect.value)); break;
    case 'addSpotLevel': this.addSpotLevel(effect.target, Number(effect.value)); break;
    case 'setManager': this.setManager(effect.target, effect.value as import('../types/ids').Character); break;
    case 'addEnhancement': this.addEnhancement(String(effect.value)); break;
    case 'addItem': this.addItem(effect.target, Number(effect.value)); break;
    case 'unlockInit': this.unlockInit(String(effect.value)); break;
    case 'setFlag': this.setFlag(effect.target, String(effect.value)); break;
    case 'setExtra': this.setExtra(effect.target, toExtraValue(effect.value)); break;
    case 'addExtra': this.addExtra(effect.target, Number(effect.value)); break;
    case 'removeExtra': this.removeExtra(effect.target); break;
    case 'loot':
    case 'triggerStory':
      break;
    case 'grantCharacter': this.acquireCharacter(effect.target, 'story'); break;
    case 'addAffectionExp': this.addAffectionExp(effect.target, Number(effect.value)); break;
    case 'setTheme':
    case 'clearAllChatFlow':
    case 'showChatText':
    case 'clearIdChatFlow':
    case 'clearAllChatText':
    case 'showOpeningTitle':
      break;
  }
}

function toExtraValue(raw: number | string | boolean | ValueExpression | ExtraValue | ThemeEffectValue | ChatTextEffectValue): ExtraValue {
  if (typeof raw === 'object' && raw !== null && 't' in raw) {
    const node = raw as ExtraValue;
    assertValidExtra(node);
    return node;
  }
  return extraFromJson(raw);
}
