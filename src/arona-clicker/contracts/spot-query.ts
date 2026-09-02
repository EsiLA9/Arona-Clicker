export interface SpotQueryPort {
  getEffectiveMaxLevel(spotId: string): number | undefined;
}
