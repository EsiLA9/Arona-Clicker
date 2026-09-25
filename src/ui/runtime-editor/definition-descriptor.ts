import type {
  AuthoringExtension,
  ContentApplyStrategy,
  ContentAuthoringPolicy,
  FieldConsumer,
  FieldInvalidation,
  WritableFieldKind,
} from '../../data-services/authoring/content-policy-types';

export type DefinitionEditorCapabilityLevel = 'R0' | 'R1' | 'D1' | 'A1';

export type DefinitionEditorSource = 'policy';

export type DefinitionEditorCapabilityBlocker =
  | 'unsupported-fields'
  | 'unknown-fields'
  | 'missing-materialization'
  | 'missing-invalidation-trigger'
  | 'apply-strategy-not-ready';

export type DefinitionEditorMaterializationStatus = 'ready' | 'incomplete' | 'missing';

export interface EditorSectionDescriptor {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly fieldKeys: readonly string[];
  readonly extensionKeys: readonly string[];
}

export interface EditorFieldDescriptor {
  readonly key: string;
  readonly definitionKey: string;
  readonly label: string;
  readonly kind: WritableFieldKind;
  readonly required: boolean;
  readonly refType?: string;
  readonly sectionId: string;
  readonly initialValue?: unknown;
}

export interface EditorExtensionDescriptor {
  readonly inputKey: string;
  readonly definitionKey: string;
  readonly sectionId: string;
  readonly editorId: string | null;
  readonly required: boolean;
  readonly preserveEmpty: boolean;
  readonly hasInitialValue: boolean;
}

export type UnsupportedFieldSource = 'policy-hint' | 'observed-definition' | 'caller';

export interface UnsupportedFieldDescriptor {
  readonly key: string;
  readonly path: string;
  readonly source: UnsupportedFieldSource;
  readonly reason: string;
  readonly message: string;
  /** The descriptor never authorizes dropping this information. */
  readonly retained: true;
}

export interface DefinitionEditorMaterializationDescriptor {
  readonly field: string;
  readonly inputKey: string;
  readonly definitionKey: string;
  readonly consumers: readonly FieldConsumer[];
  readonly invalidate: FieldInvalidation;
  readonly trigger?: string;
  readonly status: DefinitionEditorMaterializationStatus;
  readonly reason?: 'missing-materialization' | 'missing-invalidation-trigger';
}

export interface DefinitionEditorCapabilitySummary {
  readonly R0: true;
  readonly R1: true;
  readonly D1: true;
  readonly A1: boolean;
  readonly browse: true;
  readonly inspect: true;
  readonly draft: true;
  readonly apply: boolean;
  readonly level: DefinitionEditorCapabilityLevel;
  readonly maxLevel: DefinitionEditorCapabilityLevel;
  readonly opaqueSafe: boolean;
  readonly runtimeReady: boolean;
  readonly applyStrategy: ContentApplyStrategy;
  readonly draftScope: 'full' | 'new-or-complete';
  readonly blockers: readonly DefinitionEditorCapabilityBlocker[];
}

export interface UnsupportedFieldInput {
  readonly key?: string;
  readonly path: string;
  readonly reason?: string;
  readonly message?: string;
}

export interface DefinitionEditorDescriptorOptions {
  /** A Registry Def or Draft-like object used only to identify present unknown keys. */
  readonly observedDefinition?: Readonly<Record<string, unknown>>;
  /** Equivalent to observedDefinition when the caller already has only key names. */
  readonly observedFieldKeys?: readonly string[];
  /** Additional round-trip or decoder diagnostics supplied by the caller. */
  readonly unsupported?: readonly UnsupportedFieldInput[];
}

export interface DefinitionEditorDescriptor {
  readonly key: ContentAuthoringPolicy['key'];
  readonly label: string;
  readonly idType: string;
  readonly inputPrefix: string;
  readonly source: DefinitionEditorSource;
  readonly applyStrategy: ContentApplyStrategy;
  readonly opaqueSafe: boolean;
  readonly runtimeReady: boolean;
  readonly capabilities: DefinitionEditorCapabilitySummary;
  readonly sections: readonly EditorSectionDescriptor[];
  readonly writableFields: readonly EditorFieldDescriptor[];
  /** Alias retained for consumers using the task-0120 draft contract name. */
  readonly fields: readonly EditorFieldDescriptor[];
  readonly extensions: readonly EditorExtensionDescriptor[];
  readonly unsupported: readonly UnsupportedFieldDescriptor[];
  readonly unknownFields: readonly UnsupportedFieldDescriptor[];
  readonly materialization: readonly DefinitionEditorMaterializationDescriptor[];
  readonly unsupportedFieldHint?: string;
}

interface MaterializationTarget {
  readonly inputKey: string;
  readonly definitionKey: string;
}

const RESERVED_DEFINITION_KEYS = new Set(['id', 'metadata']);

/**
 * Derive a stable, UI-agnostic contract from one existing authoring policy.
 * The function copies policy metadata into new arrays and never calls a policy
 * validator, encoder, mutator, Registry, or runtime service.
 */
export function deriveDefinitionEditorDescriptor(
  policy: ContentAuthoringPolicy,
  options: DefinitionEditorDescriptorOptions = {},
): DefinitionEditorDescriptor {
  const sectionDefs = policy.sections?.length
    ? policy.sections
    : [{ id: 'default', label: '内容' }];
  const firstSectionId = sectionDefs[0].id;

  const sectionIdFor = (section?: string): string => {
    if (section && sectionDefs.some(item => item.id === section)) return section;
    return firstSectionId;
  };

  const writableFields = policy.fields.map(field => ({
    key: field.key,
    definitionKey: field.kind === 'entityName' ? 'id' : field.key,
    label: field.label,
    kind: field.kind,
    required: field.required !== false,
    ...(field.refType ? { refType: field.refType } : {}),
    sectionId: sectionIdFor(field.section),
    ...(field.initialValue !== undefined ? { initialValue: field.initialValue } : {}),
  }));

  const extensions = (policy.extensions ?? []).map(extension => ({
    inputKey: extension.inputKey,
    definitionKey: extension.definitionKey,
    sectionId: sectionIdFor(extension.section),
    editorId: extension.editor ?? null,
    required: extension.required === true,
    preserveEmpty: extension.preserveEmpty === true,
    hasInitialValue: extension.initialValue !== undefined,
  }));

  const sections = sectionDefs.map((section, order) => ({
    id: section.id,
    label: section.label,
    order,
    fieldKeys: writableFields.filter(field => field.sectionId === section.id).map(field => field.key),
    extensionKeys: extensions.filter(extension => extension.sectionId === section.id).map(extension => extension.inputKey),
  }));

  const targets: MaterializationTarget[] = [
    ...writableFields.map(field => ({ inputKey: field.key, definitionKey: field.definitionKey })),
    ...extensions.map(extension => ({ inputKey: extension.inputKey, definitionKey: extension.definitionKey })),
  ];
  const materialization = deriveMaterialization(policy, targets);
  const unsupported = deriveUnsupported(policy, options, targets);
  const unknownFields = unsupported.filter(item => item.source === 'observed-definition');
  const opaqueSafe = unsupported.length === 0;
  const runtimeReady = isRuntimeReady(policy, materialization);
  const blockers = deriveBlockers(policy, materialization, unsupported, runtimeReady);
  const apply = runtimeReady && opaqueSafe;
  const level: DefinitionEditorCapabilityLevel = apply ? 'A1' : 'D1';
  const draftScope = opaqueSafe ? 'full' : 'new-or-complete';
  const capabilities: DefinitionEditorCapabilitySummary = {
    R0: true,
    R1: true,
    D1: true,
    A1: apply,
    browse: true,
    inspect: true,
    draft: true,
    apply,
    level,
    maxLevel: level,
    opaqueSafe,
    runtimeReady,
    applyStrategy: policy.apply,
    draftScope,
    blockers,
  };

  return {
    key: policy.key,
    label: policy.label,
    idType: policy.idType,
    inputPrefix: policy.inputPrefix,
    source: 'policy',
    applyStrategy: policy.apply,
    opaqueSafe,
    runtimeReady,
    capabilities,
    sections,
    writableFields,
    fields: writableFields,
    extensions,
    unsupported,
    unknownFields,
    materialization,
    ...(policy.unsupportedFieldHint ? { unsupportedFieldHint: policy.unsupportedFieldHint } : {}),
  };
}

export function deriveDefinitionEditorDescriptors(
  policies: readonly ContentAuthoringPolicy[],
  optionsByKey: Readonly<Partial<Record<ContentAuthoringPolicy['key'], DefinitionEditorDescriptorOptions>>> = {},
): readonly DefinitionEditorDescriptor[] {
  return policies.map(policy => deriveDefinitionEditorDescriptor(policy, optionsByKey[policy.key]));
}

function deriveMaterialization(
  policy: ContentAuthoringPolicy,
  targets: readonly MaterializationTarget[],
): DefinitionEditorMaterializationDescriptor[] {
  const used = new Set<number>();
  const result: DefinitionEditorMaterializationDescriptor[] = targets.map(target => {
    const index = policy.materialization.findIndex((entry, entryIndex) => {
      if (used.has(entryIndex)) return false;
      return entry.field === target.inputKey || entry.field === target.definitionKey;
    });
    if (index < 0) {
      return {
        field: target.inputKey,
        inputKey: target.inputKey,
        definitionKey: target.definitionKey,
        consumers: [],
        invalidate: 'none' as const,
        status: 'missing' as const,
        reason: 'missing-materialization' as const,
      };
    }

    used.add(index);
    const entry = policy.materialization[index];
    const status: DefinitionEditorMaterializationStatus = entry.consumers.length === 0
      ? 'incomplete'
      : entry.invalidate !== 'none' && !entry.trigger
        ? 'incomplete'
        : 'ready';
    return {
      field: entry.field,
      inputKey: target.inputKey,
      definitionKey: target.definitionKey,
      consumers: [...entry.consumers],
      invalidate: entry.invalidate,
      ...(entry.trigger ? { trigger: entry.trigger } : {}),
      status,
      ...(status === 'incomplete'
        ? { reason: entry.consumers.length === 0 ? 'missing-materialization' as const : 'missing-invalidation-trigger' as const }
        : {}),
    };
  });

  for (let index = 0; index < policy.materialization.length; index += 1) {
    if (used.has(index)) continue;
    const entry = policy.materialization[index];
    result.push({
      field: entry.field,
      inputKey: entry.field,
      definitionKey: entry.field,
      consumers: [...entry.consumers],
      invalidate: entry.invalidate,
      ...(entry.trigger ? { trigger: entry.trigger } : {}),
      status: entry.consumers.length > 0 && (entry.invalidate === 'none' || Boolean(entry.trigger)) ? 'ready' : 'incomplete',
      ...(
        entry.consumers.length === 0
          ? { reason: 'missing-materialization' as const }
          : entry.invalidate !== 'none' && !entry.trigger
            ? { reason: 'missing-invalidation-trigger' as const }
            : {}
      ),
    });
  }

  return result;
}

function deriveUnsupported(
  policy: ContentAuthoringPolicy,
  options: DefinitionEditorDescriptorOptions,
  targets: readonly MaterializationTarget[],
): UnsupportedFieldDescriptor[] {
  const result: UnsupportedFieldDescriptor[] = [];
  if (policy.unsupportedFieldHint) {
    result.push({
      key: '__policy__',
      path: `${policy.inputPrefix}.unsupported`,
      source: 'policy-hint',
      reason: 'unsupported-fields',
      message: policy.unsupportedFieldHint,
      retained: true,
    });
  }

  const known = new Set<string>(RESERVED_DEFINITION_KEYS);
  for (const target of targets) {
    known.add(target.inputKey);
    known.add(target.definitionKey);
  }
  for (const key of observedKeys(options)) {
    if (known.has(key)) continue;
    result.push({
      key,
      path: `${policy.inputPrefix}.${key}`,
      source: 'observed-definition',
      reason: 'unknown-field',
      message: `未登记字段：${key}`,
      retained: true,
    });
  }

  for (const item of options.unsupported ?? []) {
    const key = item.key ?? item.path.split('.').pop() ?? item.path;
    result.push({
      key,
      path: item.path,
      source: 'caller',
      reason: item.reason ?? 'unsupported-fields',
      message: item.message ?? `不支持无损回写：${item.path}`,
      retained: true,
    });
  }

  return uniqueUnsupported(result);
}

function observedKeys(options: DefinitionEditorDescriptorOptions): readonly string[] {
  const fromDefinition = options.observedDefinition ? Object.keys(options.observedDefinition) : [];
  return [...fromDefinition, ...(options.observedFieldKeys ?? [])];
}

function uniqueUnsupported(items: readonly UnsupportedFieldDescriptor[]): UnsupportedFieldDescriptor[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const identity = `${item.source}:${item.path}:${item.reason}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function isRuntimeReady(
  policy: ContentAuthoringPolicy,
  materialization: readonly DefinitionEditorMaterializationDescriptor[],
): boolean {
  const strategyReady = policy.apply === 'reload' || typeof policy.mutate === 'function';
  return strategyReady && materialization.every(entry => entry.status === 'ready');
}

function deriveBlockers(
  policy: ContentAuthoringPolicy,
  materialization: readonly DefinitionEditorMaterializationDescriptor[],
  unsupported: readonly UnsupportedFieldDescriptor[],
  runtimeReady: boolean,
): DefinitionEditorCapabilityBlocker[] {
  const blockers: DefinitionEditorCapabilityBlocker[] = [];
  if (unsupported.some(item => item.source === 'policy-hint')) blockers.push('unsupported-fields');
  if (unsupported.some(item => item.source === 'observed-definition')) blockers.push('unknown-fields');
  if (materialization.some(item => item.reason === 'missing-materialization')) blockers.push('missing-materialization');
  if (materialization.some(item => item.reason === 'missing-invalidation-trigger')) blockers.push('missing-invalidation-trigger');
  if (!runtimeReady && !blockers.includes('missing-materialization') && !blockers.includes('missing-invalidation-trigger')) {
    blockers.push('apply-strategy-not-ready');
  }
  if (policy.unsupportedFieldHint && !blockers.includes('unsupported-fields')) blockers.push('unsupported-fields');
  return blockers;
}

export type { AuthoringExtension };
