import type { PlayerState } from '../../types/state';
import {
  VariantTranslationMode,
  type VariantTranslationContentResolver,
  type VariantTranslationRequest,
  type VariantTranslationSnapshot,
  type VariantTranslationSource,
  type VariantTranslationMemberRequest,
  type TranslatedVariantMember,
  type VariantTranslationRef,
  type VariantTranslationBlocked,
  type VariantTranslationIssueCode,
  type VariantTranslationPreview,
  type VariantTranslationConfirmation,
  type VariantTranslationRestore,
  type VariantTranslationPort,
} from '../../contracts/character/variant-translation';
import {
  canonical, immutable, exact, validRef, validateTranslationEntry, validateTranslationRules,
  normalizeOwned, normalizeSlice, translateGameplayB,
} from './variant-translation-rules';

interface Dependencies {
  readonly content?: VariantTranslationContentResolver;
  readonly getState: () => PlayerState;
  readonly getVariant: (id: string) => { readonly id: string; readonly proto: string } | undefined;
}

class TranslationFailure extends Error {
  constructor(readonly code: VariantTranslationIssueCode, readonly path: string, message: string) {
    super(message);
  }
}

function requireValue(condition: unknown, code: VariantTranslationIssueCode, path: string, message: string): asserts condition {
  if (!condition) throw new TranslationFailure(code, path, message);
}

function checked<T>(code: VariantTranslationIssueCode, path: string, work: () => T): T {
  try { return work(); } catch (error) {
    if (error instanceof TranslationFailure) throw error;
    throw new TranslationFailure(code, path, error instanceof Error ? error.message : 'Invalid translation data');
  }
}

function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function sameRef(left: VariantTranslationRef, right: VariantTranslationRef): boolean {
  return left.id === right.id && left.revision === right.revision;
}

function refOf(value: VariantTranslationRef): VariantTranslationRef {
  return { id: value.id, revision: value.revision };
}

function blocked(error: unknown, fallback: VariantTranslationIssueCode): VariantTranslationBlocked {
  const failure = error instanceof TranslationFailure ? error
    : new TranslationFailure(fallback, '', error instanceof Error ? error.message : 'Invalid translation data');
  return immutable({ status: 'blocked', issues: [{ code: failure.code, path: failure.path, message: failure.message }] });
}

function readSource(value: unknown): VariantTranslationSource {
  checked('invalid-request', 'source', () => {
    requireValue(value !== null && typeof value === 'object', 'invalid-request', 'source', 'Source must be an object');
  });
  const source = value as Record<string, unknown>;
  if (source.kind === 'owned') {
    exact(source, ['kind', 'variantId']);
    requireValue(id(source.variantId), 'invalid-request', 'source.variantId', 'Variant ID is required');
    return { kind: 'owned', variantId: source.variantId };
  }
  exact(source, ['kind', 'slice']);
  requireValue(source.kind === 'slice', 'invalid-request', 'source.kind', 'Unknown Variant source');
  validRef(source.slice);
  return { kind: 'slice', slice: refOf(source.slice) };
}

function readRequest(value: unknown): VariantTranslationRequest {
  return checked('invalid-request', '', () => {
    exact(value, ['entryId', 'mode', 'members']);
    requireValue(value.mode === VariantTranslationMode.GameplayB, 'unsupported-mode', 'mode', 'Unsupported fixed translation mode');
    requireValue(id(value.entryId), 'invalid-request', 'entryId', 'Entry ID is required');
    requireValue(Array.isArray(value.members) && value.members.length > 0 && value.members.length <= 64,
      'invalid-request', 'members', 'A translation request must contain 1–64 members');
    const slots = new Set<string>();
    const members = value.members.map((member: unknown): VariantTranslationMemberRequest => {
      exact(member, ['slotId', 'source']);
      requireValue(id(member.slotId) && !slots.has(member.slotId), 'party-policy-violation', 'members.slotId', 'Slot IDs must be unique');
      slots.add(member.slotId);
      return { slotId: member.slotId, source: readSource(member.source) };
    });
    return { entryId: value.entryId, mode: value.mode, members };
  });
}

let nextServiceId = 0;

/**
 * Variant → fixed scene mode → detached build. No Run, progression writes, or game RNG ownership.
 * Content is a trusted constructor dependency; external requests only select authorized sources.
 */
export class VariantTranslationService implements VariantTranslationPort {
  private readonly previews = new Map<string, { request: VariantTranslationRequest; snapshot: VariantTranslationSnapshot }>();
  private readonly serviceId = ++nextServiceId;
  private sequence = 0;
  private lastState: PlayerState | undefined;
  private lastInit: string | undefined;

  constructor(private readonly deps: Dependencies) {}

  /** Called by Runtime lifecycle boundaries, also when relevant state identity/Init changes. */
  invalidatePreviews(): void { this.previews.clear(); }

  private syncScope(): void {
    const state = this.deps.getState();
    if (this.lastState !== state || this.lastInit !== state.activeInit) this.invalidatePreviews();
    this.lastState = state;
    this.lastInit = state.activeInit;
  }

  preview(request: VariantTranslationRequest): VariantTranslationPreview {
    try {
      this.syncScope();
      const normalizedRequest = readRequest(request);
      const snapshot = this.prepare(normalizedRequest);
      // Opaque service-local handles are lookup keys, never self-authenticating build payloads.
      const token = `variant-preview-${this.serviceId}-${++this.sequence}`;
      if (this.previews.size >= 32) this.previews.delete(this.previews.keys().next().value!);
      this.previews.set(token, { request: immutable(normalizedRequest), snapshot });
      return immutable({ status: 'ready', token, members: snapshot.members });
    } catch (error) { return blocked(error, 'input-invalid'); }
  }

  confirm(token: string): VariantTranslationConfirmation {
    try {
      this.syncScope();
      const pending = this.previews.get(token);
      this.previews.delete(token);
      requireValue(pending, 'stale-preview', 'token', 'Preview is missing, expired, or already consumed');
      let snapshot: VariantTranslationSnapshot;
      try {
        snapshot = this.prepare(pending.request);
        requireValue(canonical(snapshot) === canonical(pending.snapshot), 'stale-preview', 'token', 'Translation inputs changed; preview again');
      } catch {
        throw new TranslationFailure('stale-preview', 'token', 'Translation inputs or authorization changed; preview again');
      }
      return immutable({ status: 'confirmed', snapshot });
    } catch (error) { return blocked(error, 'stale-preview'); }
  }

  restore(value: unknown): VariantTranslationRestore {
    try {
      const snapshot = checked('snapshot-invalid', '', () => {
        exact(value, ['schemaVersion', 'mode', 'entry', 'rules', 'activeInit', 'contentEvidence', 'members']);
        requireValue(value.schemaVersion === 1 && value.mode === VariantTranslationMode.GameplayB,
          'snapshot-invalid', 'schemaVersion', 'Unsupported snapshot schema or mode');
        validRef(value.entry);
        validRef(value.rules);
        requireValue(id(value.activeInit) && typeof value.contentEvidence === 'string', 'snapshot-invalid', '', 'Snapshot provenance is invalid');
        requireValue(Array.isArray(value.members) && value.members.length > 0 && value.members.length <= 64,
          'snapshot-invalid', 'members', 'Snapshot members are invalid');
        for (const member of value.members) {
          exact(member, ['slotId', 'variantId', 'statisticsCharacterId', 'source', 'input', 'build'], ['profile', 'progression']);
          requireValue(id(member.slotId) && id(member.variantId) && id(member.statisticsCharacterId),
            'snapshot-invalid', 'members', 'Snapshot identity is invalid');
          const source = readSource(member.source);
          if (source.kind === 'owned') {
            validRef(member.profile);
            exact(member.progression, ['level', 'stars', 'affectionLevel']);
          } else {
            requireValue(!Object.prototype.hasOwnProperty.call(member, 'profile') && !Object.prototype.hasOwnProperty.call(member, 'progression'),
              'snapshot-invalid', 'members', 'Slices cannot carry player progression');
          }
        }
        return immutable(value) as unknown as VariantTranslationSnapshot;
      });
      const request = readRequest({
        entryId: snapshot.entry.id, mode: snapshot.mode,
        members: snapshot.members.map(member => ({ slotId: member.slotId, source: member.source })),
      });
      const restored = this.prepare(request, snapshot);
      requireValue(restored.contentEvidence === snapshot.contentEvidence,
        'content-version-mismatch', 'contentEvidence', 'Referenced translation content has changed');
      requireValue(canonical(restored) === canonical(snapshot), 'snapshot-invalid', '', 'Frozen translation input or output does not match its definitions');
      return immutable({ status: 'restored', snapshot: restored });
    } catch (error) { return blocked(error, 'snapshot-invalid'); }
  }

  private prepare(request: VariantTranslationRequest, frozen?: VariantTranslationSnapshot): VariantTranslationSnapshot {
    const content = this.deps.content;
    requireValue(content, 'entry-unavailable', 'entryId', 'No trusted Variant translation content is configured');
    const entry = content.resolveEntry(request.entryId);
    requireValue(entry, 'entry-unavailable', 'entryId', 'Translation entry is unavailable');
    checked('rules-invalid', 'entry', () => validateTranslationEntry(entry));
    requireValue(entry.id === request.entryId, 'content-version-mismatch', 'entry', 'Resolver returned another entry');
    requireValue(entry.mode === request.mode, 'unsupported-mode', 'mode', 'Entry does not support this mode');
    if (frozen) {
      requireValue(sameRef(entry, frozen.entry) && sameRef(entry.rules, frozen.rules),
        'content-version-mismatch', 'entry', 'Snapshot entry or rules revision is unavailable');
    }
    const rules = content.resolveRules(entry.rules);
    requireValue(rules && sameRef(rules, entry.rules), 'content-version-mismatch', 'rules', 'Exact translation rules revision is unavailable');
    checked('rules-invalid', 'rules', () => validateTranslationRules(rules));
    requireValue(rules.mode === request.mode, 'unsupported-mode', 'mode', 'Rules do not support this mode');
    requireValue(request.members.length >= entry.minPartySize && request.members.length <= entry.maxPartySize,
      'party-policy-violation', 'members', 'Party size does not satisfy the entry policy');

    const state = frozen ? undefined : this.deps.getState();
    const seenVariants = new Set<string>();
    const evidence: unknown[] = [entry, rules];
    const members = request.members.map((member, index): TranslatedVariantMember => {
      const path = `members[${index}]`;
      const previous = frozen?.members[index];
      let variantId: string;
      let profile: VariantTranslationRef | undefined;
      let progression: TranslatedVariantMember['progression'];
      let input: TranslatedVariantMember['input'];
      if (member.source.kind === 'owned') {
        variantId = member.source.variantId;
        const binding = entry.owned.find(row => row.variantId === variantId);
        requireValue(binding, 'source-not-allowed', path, 'Owned Variant is not allowed by this entry');
        const definition = content.resolveProfile(binding.profile);
        requireValue(definition && sameRef(definition, binding.profile) && definition.variantId === variantId,
          'content-version-mismatch', path, 'Exact Variant profile is unavailable or bound to another Variant');
        profile = refOf(definition);
        if (previous) {
          requireValue(previous.profile && sameRef(previous.profile, profile) && previous.progression,
            'snapshot-invalid', path, 'Owned snapshot lacks its frozen profile or progress');
          progression = previous.progression;
        } else {
          const owned = state?.roster?.[variantId];
          requireValue(owned && owned.variantId === variantId, 'variant-not-owned', path, 'Variant is not currently owned');
          progression = { level: owned.level, stars: owned.stars, affectionLevel: owned.affectionLevel };
        }
        input = checked('input-invalid', path, () => normalizeOwned(definition, progression, rules));
        evidence.push(definition);
      } else {
        const requested = member.source.slice;
        const authorization = entry.slices.find(row => sameRef(row.slice, requested));
        requireValue(authorization, 'source-not-allowed', path, 'Slice revision is not provided by this entry');
        const definition = content.resolveSlice(requested);
        requireValue(definition && sameRef(definition, requested), 'content-version-mismatch', path, 'Exact slice revision is unavailable');
        variantId = definition.variantId;
        if (!frozen && authorization.ownership === 'required') {
          const owned = state?.roster?.[variantId];
          requireValue(owned && owned.variantId === variantId, 'variant-not-owned', path, 'Slice requires its exact Variant to be owned');
        }
        input = checked('input-invalid', path, () => normalizeSlice(definition, rules));
        evidence.push(definition);
      }
      const variant = this.deps.getVariant(variantId);
      requireValue(variant && variant.id === variantId && id(variant.proto), 'variant-not-found', path, 'Registered Variant is unavailable');
      requireValue(entry.allowDuplicateVariants || !seenVariants.has(variantId),
        'party-policy-violation', path, 'Duplicate Variant is not allowed by this entry');
      seenVariants.add(variantId);
      evidence.push({ id: variant.id, proto: variant.proto });
      const build = checked('input-invalid', path, () => translateGameplayB(input, rules));
      return {
        slotId: member.slotId, variantId, statisticsCharacterId: variant.proto,
        source: member.source, ...(profile ? { profile, progression } : {}), input, build,
      };
    });
    const activeInit = frozen?.activeInit ?? state?.activeInit;
    requireValue(id(activeInit), 'input-invalid', 'activeInit', 'Current Init identity is unavailable');
    return immutable({
      schemaVersion: 1, mode: VariantTranslationMode.GameplayB,
      entry: refOf(entry), rules: refOf(rules), activeInit,
      contentEvidence: canonical(evidence), members,
    });
  }
}
