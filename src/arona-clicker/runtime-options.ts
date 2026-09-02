import type { DevLogOptions } from '../engine/core/dev-log';
import type { SaveData } from './contracts/save-data';
import type { SaveBuildContext } from './contracts/save-codec';
import type { GameInstanceMutable, WiringHooks } from './runtime-wiring';

export type GameInstanceWiring = (
  game: GameInstanceMutable,
  hooks: WiringHooks,
  options?: { devLog?: DevLogOptions },
) => void;

export interface GameInstanceOptions {
  devLog?: DevLogOptions;
  saveCodec?: (ctx: SaveBuildContext) => SaveData;
  wiring?: GameInstanceWiring;
}
