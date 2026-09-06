import { UI_HOST_REGISTRY, type UIHostDefinition, type UIHostKind, type UIHostLevel } from './ui-host-registry';
import './service-definitions';

export type PresentationTargetLevel = UIHostLevel;
export interface PresentationTargetDef extends UIHostDefinition { readonly kind: UIHostKind; }

/** 兼容旧调用方；动态目标应通过 getPresentationTargets 读取。 */
export const PRESENTATION_TARGETS: readonly PresentationTargetDef[] = UI_HOST_REGISTRY.all();

export function getPresentationTargets(): readonly PresentationTargetDef[] {
  return UI_HOST_REGISTRY.all();
}

export function presentationTargetForLegacyRegion(region: string): PresentationTargetDef | undefined {
  return UI_HOST_REGISTRY.all().find(target => target.legacyRegion === region);
}
