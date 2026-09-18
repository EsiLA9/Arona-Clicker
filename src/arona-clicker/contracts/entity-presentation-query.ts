import type { EntityPresentationKey } from '../../data-services/contracts/entity-presentation';
import type { ThemeDef } from '../../engine/types/theme';
import type { PlayerState } from '../types/state';

export interface EntityPresentationResolution {
  readonly key: EntityPresentationKey;
  readonly name: string;
  readonly description: string;
  readonly theme: ThemeDef | null;
  readonly swatch?: string;
  readonly source: 'default' | 'addition' | 'legacy' | 'runtime';
  readonly optionId?: string;
  readonly fallbackReason?: 'unknown-option' | 'unavailable-option';
}

export interface EntityPresentationOptionView {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly active: boolean;
  readonly value?: Pick<EntityPresentationResolution, 'name' | 'description' | 'theme' | 'swatch'>;
}

export interface EntityPresentationResolveOptions {
  readonly selectedOptionId?: string | null;
  readonly equippedEquipmentId?: string | null;
}

export interface EntityPresentationQueryPort {
  resolve(state: Readonly<PlayerState>, key: EntityPresentationKey, options?: EntityPresentationResolveOptions): EntityPresentationResolution | undefined;
  options(state: Readonly<PlayerState>, key: EntityPresentationKey, options?: EntityPresentationResolveOptions): EntityPresentationOptionView[];
}
