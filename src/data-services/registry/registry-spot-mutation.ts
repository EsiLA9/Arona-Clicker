import type { SpotDef } from '../contracts/world';

export type RegistrySpotMutation =
  | {
      operation: 'create';
      ownerModName: string;
      spot: SpotDef;
    }
  | {
      operation: 'replace';
      ownerModName: string;
      spot: SpotDef;
    }
  | {
      operation: 'delete';
      ownerModName: string;
      spotId: string;
    }
  | {
      operation: 'suspend';
      ownerModName: string;
      spotId: string;
    }
  | {
      operation: 'resume';
      ownerModName: string;
      spotId: string;
    };

export interface RegistrySpotMutationReceipt {
  readonly operation: RegistrySpotMutation['operation'];
  readonly ownerModName: string;
  readonly spotId: string;
  readonly previousSpot: SpotDef | undefined;
  readonly currentSpot: SpotDef | undefined;
  rollback(): void;
}
