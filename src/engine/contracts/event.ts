/** EventBus 可承载的最小事件形状；领域事件只需提供 type 判别字段。 */
export interface EngineEventShape {
  readonly type: string;
}

export type EventOf<TEvent extends EngineEventShape, TType extends TEvent['type']> =
  Extract<TEvent, { type: TType }>;
