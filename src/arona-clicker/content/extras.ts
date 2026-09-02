import { extra } from '../../engine/extra/index';
import type { ExtraValue } from '../../engine/types';

export const baseExtras: Record<string, ExtraValue> = {
  'meta/author': extra.str('AronaClicker Team'),
  'meta/version': extra.str('1.0.0'),
  'balance/start-credit': extra.int(0),
};
