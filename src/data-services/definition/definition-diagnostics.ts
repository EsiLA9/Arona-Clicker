import type {
  DefinitionKey,
  DefinitionResolution,
  DefinitionResolutionStatus,
} from './definition-types';
import type { ReferencePolicy } from './definition-reference-resolution';

export type DefinitionDiagnosticCode =
  | 'DEF_REF_SUSPENDED'
  | 'DEF_REF_MISSING_OPTIONAL'
  | 'DEF_REF_MISSING_REQUIRED';

export interface DefinitionDiagnostic {
  code: DefinitionDiagnosticCode;
  severity: 'info' | 'warning' | 'error';
  source: DefinitionKey;
  reference?: DefinitionKey;
  path?: string;
  resolutionStatus?: Exclude<DefinitionResolutionStatus, 'resolved'>;
  policy?: ReferencePolicy;
  message: string;
}

export interface DefinitionReferenceDiagnosticInput<T> {
  source: DefinitionKey;
  reference: DefinitionKey;
  path?: string;
  policy: ReferencePolicy;
  resolution: DefinitionResolution<T>;
}

function diagnosticForResolution<T>(
  input: DefinitionReferenceDiagnosticInput<T>,
): DefinitionDiagnostic | undefined {
  if (input.resolution.status === 'resolved' || input.policy === 'symbolic') {
    return undefined;
  }

  const status = input.resolution.status;
  const required = input.policy === 'required';
  const code = status === 'suspended'
    ? 'DEF_REF_SUSPENDED'
    : required
      ? 'DEF_REF_MISSING_REQUIRED'
      : 'DEF_REF_MISSING_OPTIONAL';
  const severity = required ? 'error' : 'warning';
  const message = status === 'suspended'
    ? 'Definition reference ' + input.reference.table + ':' + input.reference.id + ' is suspended'
    : 'Definition reference ' + input.reference.table + ':' + input.reference.id + ' is missing';

  return {
    code,
    severity,
    source: input.source,
    reference: input.reference,
    path: input.path,
    resolutionStatus: status,
    policy: input.policy,
    message,
  };
}

export function collectDefinitionDiagnostics<T>(
  inputs: readonly DefinitionReferenceDiagnosticInput<T>[],
): readonly DefinitionDiagnostic[] {
  return inputs.flatMap((input) => {
    const diagnostic = diagnosticForResolution(input);
    return diagnostic ? [diagnostic] : [];
  });
}
