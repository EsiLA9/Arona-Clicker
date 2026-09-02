import type { StateMutationPort } from '../../engine/contracts/mutation';
import type { CharacterAcquireVia } from '../types/character';
import type { Effect, ExtraPath, ExtraValue, Character } from '../../engine/types';

/** AronaClicker 对 Effect DSL 的完整状态写入能力。 */
export interface EffectMutationPort extends StateMutationPort {
  setResource(resource: string, value: number): number;
  setSpotLevel(spotId: string, level: number): void;
  addSpotLevel(spotId: string, delta: number): number;
  setManager(spotId: string, character: Character): void;
  addEnhancement(enhancementId: string): boolean;
  addItem(itemId: string, count: number, maxStack?: number): number;
  unlockInit(initId: string): boolean;
  setFlag(flag: string, value: string): void;
  setExtra(path: ExtraPath, value: ExtraValue): void;
  addExtra(path: ExtraPath, delta: number): void;
  removeExtra(path: ExtraPath): void;
  acquireCharacter(variantId: string, via: CharacterAcquireVia): { duplicate: boolean; shards: number; bonusResources: Record<string, number> };
  addAffectionExp(variantId: string, delta: number): { ok: boolean; newLevel: number; newExp: number };
  applyEffect(effect: Effect): void;
}
