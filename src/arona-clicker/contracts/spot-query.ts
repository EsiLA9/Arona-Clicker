import type { PaymentOptionView } from '../services/payment-service';

export type SpotPaymentAction = 'unlock' | 'upgrade';

export interface SpotQueryPort {
  getEffectiveMaxLevel(spotId: string): number | undefined;
  getPaymentOptions(spotId: string, action: SpotPaymentAction): readonly PaymentOptionView[];
}
