import { Resource } from '../types/ids';
import type { ResourceDisplayDef } from '../../data-services/contracts/common';

export const baseResourceDisplays: ResourceDisplayDef[] = [
  { resourceId: Resource.Credit, label: '信用点', order: 0 },
  { resourceId: Resource.Pyroxene, label: '青辉石', detailLabel: '青辉石', showWhen: 'hasAmount', order: 10 },
];
