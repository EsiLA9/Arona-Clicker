import type { DevLogOptions } from '../engine/core/dev-log';
import type { SaveData } from './contracts/save-data';
import type { SaveBuildContext } from './contracts/save-codec';
import type { OperationContentResolver } from './contracts/operation-content-resolver';
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
  wiring?: GameInstanceWiring;
}
