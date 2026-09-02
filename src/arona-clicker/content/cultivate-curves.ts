import { cultivateCurve } from './def-factory';
import type { CultivateCurveDef } from '../types/character';

/** AronaClicker 默认角色培养曲线。 */
export const baseCultivateCurves: CultivateCurveDef[] = [
  cultivateCurve('base:cultivatecurve:standard')
    .maxLevel(30)
    .expTable(...Array.from({ length: 34 }, (_, i) => 100 * (i + 1)))
    .starMax(5)
    .starCost(1, 3, 10, 30, 60)
    .levelCapPerStar(5)
    .build(),
];
