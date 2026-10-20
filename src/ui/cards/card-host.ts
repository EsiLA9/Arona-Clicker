// ============================================================
// ui/cards/card-host.ts — 共用卡牌宿主绑定
// 只生成 / 读取视觉实例身份、静态 DOM 宿主 / 插槽关系与入口标记；领域引用、合法性、费用和
// 命令仍由 MapRun Owner 与 Controller 持有。不是新的领域 zone。
// ============================================================

/** Stable visual instance marker; never a domain identity. */
export const MAP_CARD_INSTANCE_ATTRIBUTE = 'data-map-instance-key';
/** Stable DOM container identity that may host one or more attached cards. */
export const MAP_CARD_HOST_ATTRIBUTE = 'data-map-card-host-id';
/** Static reference from an attached card to its containing host. */
export const MAP_CARD_HOST_REF_ATTRIBUTE = 'data-map-card-host-ref';
/** Stable slot of one attached card inside its host. */
export const MAP_CARD_SLOT_ATTRIBUTE = 'data-map-card-slot';
/** How this visual copy participates: live object, replacement offer, or history. */
export const MAP_CARD_USAGE_ATTRIBUTE = 'data-map-card-usage';
/** Space-separated entry set; each entry must be provided by this host instance. */
export const MAP_CARD_ENTRY_ATTRIBUTE = 'data-map-card-entry';
/** Existing legal option behind a replacement offer; never a current source. */
export const MAP_CARD_OPTION_ATTRIBUTE = 'data-map-card-option';

export type MapCardUsage = 'live' | 'replacement' | 'history' | 'offer';

/** Entries are capabilities, separate from DOM placement, Hover state, and source-target relations. */
export type MapCardEntry = 'inspect' | 'editTarget' | 'replace' | 'target' | 'selectLocation';

/** Map node identity used by location cards; distinct from Encounter targets and cards. */
export interface MapLocationRef {
  readonly kind: 'mapNode';
  readonly runId: string;
  readonly mapId: string;
  readonly nodeId: string;
}

/** Stable visual object key for all copies of one MapRun node. */
export function mapLocationObjectKey(ref: MapLocationRef): string {
  return JSON.stringify([ref.kind, ref.runId, ref.mapId, ref.nodeId]);
}

export interface MapCardBinding {
  /** Host + stable slot + object key (when the object is real). */
  readonly instanceKey: string;
  readonly usage: MapCardUsage;
  readonly objectKey?: string;
  /** Only when this copy truly corresponds to the current source relation. */
  readonly relationKey?: string;
  readonly entries?: readonly MapCardEntry[];
  readonly optionId?: string;
}

/** Static DOM placement only; it does not describe Hover or a source-target relation. */
export interface MapCardDOMPlacement {
  readonly hostId: string;
  readonly slotId: string;
}

/** Optional static layout settings owned by a card host. */
export interface MapCardHostLayout {
  readonly alignment?: 'left' | 'center' | 'right';
  readonly gapPx?: number;
}

/** Build a stable instance key; the same domain object may have many. */
export function mapCardInstanceKey(host: string, slot: string, objectKey?: string): string {
  return [host, slot, objectKey ?? ''].join('::');
}

/** Attribute-only binding output. Callers keep their existing element / styling. */
export function mapCardBindingAttributes(
  escape: (value: string) => string,
  binding: MapCardBinding,
): string {
  const entries = [...new Set(binding.entries ?? [])];
  return [
    ` ${MAP_CARD_INSTANCE_ATTRIBUTE}="${escape(binding.instanceKey)}"`,
    ` ${MAP_CARD_USAGE_ATTRIBUTE}="${binding.usage}"`,
    ...(binding.objectKey ? [` data-map-object-key="${escape(binding.objectKey)}"`] : []),
    ...(binding.relationKey ? [` data-map-relation-key="${escape(binding.relationKey)}"`] : []),
    ...(entries.length ? [` ${MAP_CARD_ENTRY_ATTRIBUTE}="${escape(entries.join(' '))}"`] : []),
    ...(binding.optionId ? [` ${MAP_CARD_OPTION_ATTRIBUTE}="${escape(binding.optionId)}"`] : []),
  ].join('');
}

/** Mark a DOM container as a stable host for attached card instances. */
export function mapCardHostAttributes(
  escape: (value: string) => string,
  hostId: string,
  layout?: MapCardHostLayout,
): string {
  const requestedAlignment = layout?.alignment;
  const alignment = requestedAlignment === 'center' || requestedAlignment === 'right' || requestedAlignment === 'left'
    ? requestedAlignment : 'left';
  const gapPx = layout?.gapPx;
  const safeGapPx = Number.isFinite(gapPx) ? Math.min(64, Math.max(0, gapPx!)) : null;
  const layoutAttributes = layout
    ? ` data-map-card-host-align="${escape(alignment)}"`
      + (safeGapPx !== null ? ` data-map-card-host-gap="${safeGapPx}" style="--map-card-host-gap:${safeGapPx}px"` : '')
    : '';
  return ` ${MAP_CARD_HOST_ATTRIBUTE}="${escape(hostId)}"${layoutAttributes}`;
}

/** Mark the static host and slot that contain this card instance. */
export function mapCardPlacementAttributes(
  escape: (value: string) => string,
  placement: MapCardDOMPlacement,
): string {
  return ` ${MAP_CARD_HOST_REF_ATTRIBUTE}="${escape(placement.hostId)}"`
    + ` ${MAP_CARD_SLOT_ATTRIBUTE}="${escape(placement.slotId)}"`;
}

/** Attach the card binding and its static host placement to any caller-owned DOM element. */
export function mapCardAttachmentAttributes(
  escape: (value: string) => string,
  binding: MapCardBinding,
  placement: MapCardDOMPlacement,
): string {
  return mapCardBindingAttributes(escape, binding) + mapCardPlacementAttributes(escape, placement);
}

/** Read one entry from a bound visual instance. */
export function mapCardHasEntry(node: HTMLElement | null, entry: MapCardEntry): boolean {
  const entries = node?.dataset.mapCardEntry;
  return entries ? entries.split(/\s+/).includes(entry) : false;
}

/** Nearest bound card instance; callers still decide whether the entry is legal. */
export function mapCardInstanceAt(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>(`[${MAP_CARD_INSTANCE_ATTRIBUTE}]`)
    : null;
}

/**
 * Mark names a typed card renderer owns. Generic Flow marks must not mint
 * domain bindings or host permissions through the shared attribute whitelist.
 */
export const RESERVED_CARD_MARK_NAMES: ReadonlySet<string> = new Set([
  MAP_CARD_HOST_ATTRIBUTE,
  MAP_CARD_HOST_REF_ATTRIBUTE,
  MAP_CARD_SLOT_ATTRIBUTE,
  'data-map-object-key',
  'data-map-relation-key',
  'data-map-instance-key',
  'data-map-card-usage',
  'data-map-card-entry',
  'data-map-card-option',
  'data-map-card-target',
  'data-map-target-edit',
]);

export function isReservedCardMark(name: string): boolean {
  return RESERVED_CARD_MARK_NAMES.has(name.toLowerCase());
}
