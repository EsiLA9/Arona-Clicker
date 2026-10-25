import type { DevLogOptions } from '../../engine/core/dev-log';
import type { SaveData } from '../contracts/runtime/save-data';
import type { SaveBuildContext } from '../contracts/runtime/save-codec';
import type { OperationContentResolver } from '../contracts/operation/operation-content-resolver';
import type { VariantTranslationContentResolver } from '../contracts/character/variant-translation';
import type { GameInstanceMutable, WiringHooks } from './runtime-wiring';

export type GameInstanceWiring = (
  game: GameInstanceMutable,
  hooks: WiringHooks,
  options?: { devLog?: DevLogOptions },
) => void;

export interface GameInstanceOptions {
  devLog?: DevLogOptions;
  saveCodec?: (ctx: SaveBuildContext) => SaveData;
  /** Trusted Operation definitions and Profile candidates; omitted means no Operation is startable. */
  operationContentResolver?: OperationContentResolver;
  /** Trusted Variant translation entries, rules, profiles, and slices; omitted means translation is unavailable. */
  variantTranslationContentResolver?: VariantTranslationContentResolver;
  wiring?: GameInstanceWiring;
}
