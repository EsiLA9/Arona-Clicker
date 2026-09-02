/** 基础引擎一帧结算的输出。 */
export interface ProductionResult {
  spotId: string;
  resource: string;
  amount: number;
}

export interface TickResult {
  frame: number;
  productions: ProductionResult[];
}
