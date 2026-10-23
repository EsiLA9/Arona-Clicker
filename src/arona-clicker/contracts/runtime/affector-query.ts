import type { AffectorPackDef, AffectorPackRef } from '../../../engine/types/index';

export interface AffectorQueryPort {
  getPack(ref: AffectorPackRef): AffectorPackDef | undefined;
  /** 当前 Active Affector 授权的图谱及其挂载来源；未实现时视为没有授权。 */
  getActiveGraphCapabilitySources?(): ReadonlyMap<string, readonly {
    nodeId: string;
    instanceId: string;
    packId: string;
    mountEntityId: string;
  }[]>;
  /** @deprecated 使用 getActiveGraphCapabilitySources 保留授权来源。 */
  getActiveGraphCapabilities?(): ReadonlySet<string>;
}
