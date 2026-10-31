/** Detached JSON data retained with the committed effect; never a live state reference. */
export type EffectReceiptValue = null | boolean | number | string | readonly EffectReceiptValue[] | { readonly [key: string]: EffectReceiptValue };

/** Actual result of one effect, recorded after its write and before synchronous notifications. */
export interface EffectReceipt {
  readonly effectIndex: number;
  readonly op: string;
  readonly target: string;
  readonly status: 'changed' | 'noop';
  readonly before?: EffectReceiptValue;
  readonly after?: EffectReceiptValue;
  readonly delta?: number;
  readonly details?: EffectReceiptValue;
}
