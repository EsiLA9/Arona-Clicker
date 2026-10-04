import type { Datapack } from '../../data-services/contracts/datapack';
import bundledDatapack from './base-pack/content.json';

/** Compatibility fixture for callers that need the published product datapack. */
export const defaultDatapack = bundledDatapack as unknown as Datapack;
