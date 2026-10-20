// ============================================================
// ui/cards/card-face.ts — 小卡面组合
// 只负责受控文本与已有宿主属性；卡形外框不强制共享，领域身份和
// 入口由调用方通过 card-host 绑定。不输出任意 HTML。
// ============================================================

import {
  mapCardAttachmentAttributes,
  type MapCardBinding,
  type MapCardDOMPlacement,
} from './card-host';

export interface CardFaceView {
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly meta?: string;
  readonly stateLabel?: string;
  /** Already-generated binding attributes from card-host. */
  readonly attributes?: string;
  readonly tabIndex?: number;
}

/** Existing card face and binding placed statically in a DOM host slot. */
export interface AttachedCardFaceView {
  readonly face: Omit<CardFaceView, 'attributes'>;
  readonly binding: MapCardBinding;
  readonly placement: MapCardDOMPlacement;
  /** Caller-generated semantic attributes such as role and aria labels. */
  readonly elementAttributes?: string;
}

/** Render one small card face; all text is escaped by the caller-provided port. */
export function renderCardFace(
  escape: (value: string) => string,
  view: CardFaceView,
): string {
  const heading = `<strong>${escape(view.title)}</strong>`;
  const subtitle = view.subtitle ? `<small class="map-card-face__owner">${escape(view.subtitle)}</small>` : '';
  const state = view.stateLabel ? `<span class="map-card-face__state">${escape(view.stateLabel)}</span>` : '';
  const description = view.description ? `<span class="map-card-face__description">${escape(view.description)}</span>` : '';
  const meta = view.meta ? `<small class="map-card-face__meta">${escape(view.meta)}</small>` : '';
  return `<article class="map-card-face"${view.attributes ?? ''}${view.tabIndex === undefined ? '' : ` tabindex="${view.tabIndex}"`}>
    <header>${heading}${subtitle}</header>
    ${description}${meta}${state}
  </article>`;
}

/** Compose one existing card face, its binding, and its static DOM placement. */
export function renderAttachedCardFace(
  escape: (value: string) => string,
  view: AttachedCardFaceView,
): string {
  const attributes = mapCardAttachmentAttributes(escape, view.binding, view.placement)
    + (view.elementAttributes ?? '');
  return renderCardFace(escape, { ...view.face, attributes });
}
