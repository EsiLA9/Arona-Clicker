import { resolveDefinition } from './definition-resolution';
import type {
  DefinitionRef,
  DefinitionResolution,
  DefinitionSourceLayer,
} from './definition-types';

export type ReferencePolicy = 'symbolic' | 'optional' | 'required';

type DefinitionReferencePolicy = Exclude<ReferencePolicy, 'symbolic'>;

export interface SymbolicReferenceResolution<TReference = unknown> {
  policy: 'symbolic';
  status: 'not-applicable';
  reference: TReference;
}

export type DefinitionPolicyResolution<
  T,
  TPolicy extends DefinitionReferencePolicy = DefinitionReferencePolicy,
> = {
  policy: TPolicy;
} & DefinitionResolution<T>;

export type DefinitionReferenceResolution<T, TReference = unknown> =
  | SymbolicReferenceResolution<TReference>
  | DefinitionPolicyResolution<T>;

export function resolveDefinitionReference<TReference, T>(
  layers: readonly DefinitionSourceLayer<T>[],
  reference: TReference,
  policy: 'symbolic',
): SymbolicReferenceResolution<TReference>;
export function resolveDefinitionReference<
  T,
  TPolicy extends DefinitionReferencePolicy,
>(
  layers: readonly DefinitionSourceLayer<T>[],
  reference: DefinitionRef,
  policy: TPolicy,
): DefinitionPolicyResolution<T, TPolicy>;
export function resolveDefinitionReference<T>(
  layers: readonly DefinitionSourceLayer<T>[],
  reference: unknown,
  policy: ReferencePolicy,
): DefinitionReferenceResolution<T> {
  if (policy === 'symbolic') {
    return {
      policy,
      status: 'not-applicable',
      reference,
    };
  }

  const resolution = resolveDefinition(layers, (reference as DefinitionRef).key);
  return {
    policy,
    ...resolution,
  };
}

export function resolveRequired<T>(
  layers: readonly DefinitionSourceLayer<T>[],
  reference: DefinitionRef,
): DefinitionPolicyResolution<T, 'required'> {
  return resolveDefinitionReference(layers, reference, 'required');
}

export function resolveOptional<T>(
  layers: readonly DefinitionSourceLayer<T>[],
  reference: DefinitionRef,
): DefinitionPolicyResolution<T, 'optional'> {
  return resolveDefinitionReference(layers, reference, 'optional');
}
