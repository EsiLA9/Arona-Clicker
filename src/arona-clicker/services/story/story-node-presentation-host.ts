import type { StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { EntityPresentationDef, EntityPresentationKey } from '../../../data-services/contracts/entity-presentation';
import type {
  StoryAction,
  StoryEntryRequest,
  StoryOverlayCommand,
  StoryPresentationCommand,
} from '../../../data-services/contracts/story-node-actions';
import type { Registry } from '../../../data-services/registry/registry';
import type { StoryContent, StoryPresentation } from '../../../data-services/contracts/story-node';
import type { EngineTalklet } from '../../../engine/contracts/talklet';
import type { ChatTextEffectValue, ChatTextFont, ChatTextKind } from '../../../engine/contracts/chat-presentation';
import type { BackgroundLayerDef, ThemeNodeName } from '../../../engine/types/theme';
import type {
  StoryPresentationCardRequest,
  StoryPresentationOverlaySnapshot,
  StoryPresentationSnapshot,
  StoryEphemeralThemeSnapshot,
  StoryEntityPresentationSnapshot,
} from '../../../engine/contracts/story-presentation-snapshot';
import type { EventBus } from '../../../engine/core/event-bus';
import type { ColorSystem } from '../progression/color-system';
import type { EntityPresentationService } from '../presentation/entity-presentation-service';
import type { StoryNodeActionOutcome, StoryNodePlaybackHost, StoryNodeSource } from '../../contracts/runtime/story-node-playback';
import type { StoryRunEndReason } from '../../../engine/types/events';

export type StoryNodePresentationRegistry = Pick<Registry,
  'areas' | 'characterVariants' | 'colorGroups' | 'enhancements' | 'inits' | 'spots' | 'storyEntries' | 'stories'>;

export interface StoryNodePresentationHostOptions {
  readonly registry: StoryNodePresentationRegistry;
  readonly eventBus: Pick<EventBus, 'emit'>;
  readonly colorSystem: Pick<ColorSystem, 'setStoryNodeTheme' | 'clearStoryNodeTheme' | 'activateStoryNodeThemeOwner'>;
  readonly entityPresentation: Pick<EntityPresentationService, 'setRuntimeOverride' | 'clearRuntimeOverride' | 'clearRuntimeOverrides'>;
  readonly getTitle: (source: StoryNodeSource) => string | undefined;
}

/** Structural lifecycle port for the playback coordinator and action adapter. */
export interface StoryNodePresentationPort extends Pick<StoryNodePlaybackHost, 'preflight' | 'execute'> {
  close(source: StoryNodeSource, reason: StoryRunEndReason): void;
  activate(owner: string | null): void;
  save(source: StoryNodeSource): StoryPresentationSnapshot;
  validateSnapshot(source: StoryNodeSource, snapshot: StoryPresentationSnapshot): void;
  restore(source: StoryNodeSource, snapshot: StoryPresentationSnapshot): void;
}

interface RunPresentationState {
  ephemeralTheme?: StoryEphemeralThemeSnapshot;
  readonly entities: Map<string, StoryEntityPresentationSnapshot>;
  readonly overlays: Map<string, StoryPresentationOverlaySnapshot>;
}

const rejected = (error: string): StoryNodeActionOutcome => ({ status: 'rejected', error });
const applied = (): StoryNodeActionOutcome => ({ status: 'applied' });
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);

function entryForCard(registry: StoryNodePresentationRegistry, request: StoryEntryRequest):
  | { readonly entry: StoryEntryDef; readonly storyId: string }
  | { readonly error: string } {
  if (request.intent !== 'card' || request.entryType !== 'active') return { error: 'CardEntryMustBeActive' };
  if (!nonEmpty(request.entryId)) return { error: 'EmptyEntryId' };
  if (request.owner !== null && !nonEmpty(request.owner)) return { error: 'EmptyEntryOwner' };
  const entry = registry.storyEntries.get(request.entryId);
  if (!entry) return { error: 'EntryNotFound' };
  if (entry.type !== 'active') return { error: 'EntryTypeMismatch' };
  const story = registry.stories.get(entry.storyId);
  if (!story?.nodes.length) return { error: 'EntryStoryEmpty' };
  return { entry, storyId: story.id };
}

function presentationTarget(registry: StoryNodePresentationRegistry, key: EntityPresentationKey):
  EntityPresentationDef | undefined {
  const separator = key.indexOf(':');
  if (separator <= 0 || separator === key.length - 1) return undefined;
  const id = key.slice(separator + 1);
  let definition: { presentation?: EntityPresentationDef } | undefined;
  switch (key.slice(0, separator)) {
    case 'init': definition = registry.inits.get(id); break;
    case 'area': definition = registry.areas.get(id); break;
    case 'spot': definition = registry.spots.get(id); break;
    case 'enhancement': definition = registry.enhancements.get(id); break;
    case 'variant': definition = registry.characterVariants.get(id); break;
    default: return undefined;
  }
  return definition?.presentation;
}

function overlayError(registry: StoryNodePresentationRegistry, command: StoryOverlayCommand): string | undefined {
  if (command.command === 'clearId') return nonEmpty(command.id) ? undefined : 'EmptyOverlayId';
  if (command.command !== 'show') return undefined;
  if (!nonEmpty(command.id)) return 'EmptyOverlayId';
  if (command.content.kind !== 'entryCard') return undefined;
  const resolved = entryForCard(registry, command.content.card.request);
  return 'error' in resolved ? resolved.error : undefined;
}

function presentationError(
  registry: StoryNodePresentationRegistry,
  source: StoryNodeSource,
  command: StoryPresentationCommand,
  getTitle: (source: StoryNodeSource) => string | undefined,
): string | undefined {
  switch (command.command) {
    case 'theme': {
      const { value } = command;
      if (!source.runId || !nonEmpty(source.runId)) return 'StoryRunIdRequired';
      if (value.colorGroupId !== undefined && !registry.colorGroups.has(value.colorGroupId)) return 'ThemeColorGroupNotFound';
      if (value.scope === 'area') {
        if (!value.entityKey.startsWith('area:') || !registry.areas.has(value.entityKey.slice('area:'.length))) return 'ThemeAreaNotFound';
        return undefined;
      }
      if (value.scope === 'student') {
        if (!value.entityKey.startsWith('variant:') || !registry.characterVariants.has(value.entityKey.slice('variant:'.length))) return 'ThemeVariantNotFound';
        return undefined;
      }
      if (value.scope !== undefined && value.scope !== 'ephemeral') return 'ThemeScopeUnsupported';
      return undefined;
    }
    case 'setEntityPresentation': {
      if (!nonEmpty(command.owner)) return 'EmptyPresentationOwner';
      if (command.lifetime === 'story' && (!source.runId || !nonEmpty(source.runId))) return 'StoryRunIdRequired';
      const target = presentationTarget(registry, command.target);
      if (!target) return 'PresentationTargetNotFound';
      return target.additions?.some(option => option.id === command.optionId) ? undefined : 'PresentationOptionNotFound';
    }
    case 'clearEntityPresentation':
      if (!nonEmpty(command.owner)) return 'EmptyPresentationOwner';
      return presentationTarget(registry, command.target) ? undefined : 'PresentationTargetNotFound';
    case 'openingTitle': {
      if (nonEmpty(command.title ?? '')) return undefined;
      try {
        return nonEmpty(getTitle(source) ?? '') ? undefined : 'OpeningTitleDefaultSourceMissing';
      } catch {
        return 'OpeningTitleDefaultSourceMissing';
      }
    }
  }
}

function storyContentTalklet(content: StoryContent, presentation?: StoryPresentation): EngineTalklet {
  return {
    kind: content.kind,
    text: content.text,
    ...(content.kind === 'talk' && content.speaker !== undefined ? { speaker: content.speaker } : {}),
    ...(content.kind === 'talk' && content.image !== undefined ? { image: content.image } : {}),
    ...(presentation?.side === undefined ? {} : { side: presentation.side }),
    ...(presentation?.align === undefined ? {} : { align: presentation.align }),
    ...(presentation?.avatar === undefined ? {} : { avatar: presentation.avatar }),
    ...(presentation?.avatarMode === 'hide' ? { noAvatar: true } : {}),
    ...(presentation?.avatarMode === 'show' ? { showAvatar: true } : {}),
  };
}

function sourceEventFields(source: StoryNodeSource): { owner: string | null; runId?: string } {
  return { owner: source.owner, ...(source.runId === undefined ? {} : { runId: source.runId }) };
}

function emptyRunPresentation(): RunPresentationState {
  return { entities: new Map(), overlays: new Map() };
}

function entitySnapshotKey(target: string, owner: string): string {
  return JSON.stringify([target, owner]);
}

function cloneEphemeralTheme(value: StoryEphemeralThemeSnapshot): StoryEphemeralThemeSnapshot {
  return {
    ...value,
    scope: 'ephemeral',
    ...(value.palette === undefined ? {} : { palette: [...value.palette] }),
    ...(value.tokens === undefined ? {} : { tokens: { ...value.tokens } }),
    ...(value.nodes === undefined ? {} : { nodes: { ...value.nodes } }),
    ...(value.background === undefined ? {} : { background: value.background.map(layer => ({ ...layer })) }),
  };
}

function cloneOverlaySnapshot(value: StoryPresentationOverlaySnapshot): StoryPresentationOverlaySnapshot {
  const talklet = value.value.talklet;
  const kizuna = talklet?.kizuna;
  return {
    id: value.id,
    value: {
      ...value.value,
      ...(value.value.style === undefined ? {} : { style: { ...value.value.style } }),
      ...(talklet === undefined ? {} : {
        talklet: {
          ...talklet,
          ...(kizuna && typeof kizuna === 'object' ? { kizuna: { ...kizuna } } : {}),
        },
      }),
    },
    ...(value.cardRequest === undefined ? {} : { cardRequest: { ...value.cardRequest } }),
  };
}

function cardRequestIsValid(request: StoryPresentationCardRequest): boolean {
  return request.intent === 'card' && request.entryType === 'active'
    && nonEmpty(request.entryId) && (request.owner === null || nonEmpty(request.owner));
}

const SNAPSHOT_KEYS = new Set(['ephemeralTheme', 'entities', 'overlays']);
const THEME_KEYS = new Set(['colorGroupId', 'palette', 'tokens', 'nodes', 'background', 'scope']);
const BACKGROUND_KEYS = new Set(['id', 'kind', 'value', 'opacity', 'position', 'size', 'repeat', 'blendMode', 'attachment', 'scale', 'rotation', 'enabled']);
const CHAT_VALUE_KEYS = new Set(['text', 'talklet', 'x', 'y', 'align', 'kind', 'style', 'title', 'buttonText', 'targetStoryId']);
const TALKLET_KEYS = new Set(['kind', 'text', 'speaker', 'avatar', 'image', 'align', 'side', 'noAvatar', 'showAvatar', 'kizuna']);
const KIZUNA_KEYS = new Set(['storyId', 'title', 'buttonText', 'align']);
const CHAT_STYLE_KEYS = new Set(['font', 'fontSize', 'color', 'background', 'backgroundColor']);
const CARD_REQUEST_KEYS = new Set(['entryId', 'entryType', 'owner', 'intent']);
const ENTITY_KEYS = new Set(['target', 'optionId', 'owner', 'lifetime']);
const OVERLAY_KEYS = new Set(['id', 'value', 'cardRequest']);
const themeNodeNames = new Set<ThemeNodeName>([
  'primary', 'primaryStrong', 'bg', 'bgAlt', 'panel', 'panelLight', 'text', 'muted', 'line',
  'active', 'highlight', 'success', 'warning', 'danger', 'accent', 'playerBubble', 'npcBubble',
]);
const chatKinds = new Set<ChatTextKind>(['default', 'kizuna', 'title', 'badge', 'note']);
const chatFonts = new Set<ChatTextFont>(['default', 'serif', 'sans', 'mono', 'handwritten']);
const talkletKinds = new Set(['talk', 'narration', 'click']);
const alignments = new Set(['left', 'center', 'right']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every(key => allowed.has(key));
}

function isStringRecord(value: unknown, keys?: ReadonlySet<string>): value is Record<string, string> {
  if (!isRecord(value) || (keys && !hasOnlyKeys(value, keys))) return false;
  return Object.entries(value).every(([key, item]) => nonEmpty(key) && typeof item === 'string');
}

function backgroundLayerIsValid(value: unknown): value is BackgroundLayerDef {
  if (!isRecord(value) || !hasOnlyKeys(value, BACKGROUND_KEYS)) return false;
  if (!['empty', 'solid', 'gradient', 'image'].includes(String(value.kind)) || typeof value.value !== 'string') return false;
  if (value.id !== undefined && typeof value.id !== 'string') return false;
  for (const key of ['position', 'size', 'repeat', 'blendMode'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  }
  if (value.attachment !== undefined && !['scroll', 'fixed', 'local'].includes(String(value.attachment))) return false;
  for (const key of ['opacity', 'scale', 'rotation'] as const) {
    if (value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) return false;
  }
  return value.enabled === undefined || typeof value.enabled === 'boolean';
}

function ephemeralThemeIsValid(
  value: unknown,
  registry: StoryNodePresentationRegistry,
): value is StoryEphemeralThemeSnapshot {
  if (!isRecord(value) || !hasOnlyKeys(value, THEME_KEYS) || value.scope !== 'ephemeral' || 'entityKey' in value) return false;
  if (value.colorGroupId !== undefined
    && (typeof value.colorGroupId !== 'string' || !nonEmpty(value.colorGroupId) || !registry.colorGroups.has(value.colorGroupId))) return false;
  if (value.palette !== undefined && (!Array.isArray(value.palette) || value.palette.length > 6
    || !value.palette.every(color => typeof color === 'string'))) return false;
  if (value.tokens !== undefined && !isStringRecord(value.tokens)) return false;
  if (value.nodes !== undefined && !isStringRecord(value.nodes, themeNodeNames)) return false;
  if (value.background !== undefined && (!Array.isArray(value.background)
    || !value.background.every(backgroundLayerIsValid))) return false;
  return true;
}

function styleIsValid(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, CHAT_STYLE_KEYS)) return false;
  if (value.font !== undefined && (typeof value.font !== 'string' || !chatFonts.has(value.font as ChatTextFont))) return false;
  if (value.fontSize !== undefined && typeof value.fontSize !== 'string') return false;
  if (value.color !== undefined && typeof value.color !== 'string') return false;
  if (value.background !== undefined && typeof value.background !== 'boolean') return false;
  return value.backgroundColor === undefined || typeof value.backgroundColor === 'string';
}

function talkletIsValid(value: unknown): value is EngineTalklet {
  if (!isRecord(value) || !hasOnlyKeys(value, TALKLET_KEYS) || typeof value.text !== 'string') return false;
  if (value.kind !== undefined && (typeof value.kind !== 'string' || !talkletKinds.has(value.kind))) return false;
  for (const key of ['speaker', 'avatar', 'image'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  }
  if (value.align !== undefined && !alignments.has(String(value.align))) return false;
  if (value.side !== undefined && !['left', 'right'].includes(String(value.side))) return false;
  if (value.noAvatar !== undefined && typeof value.noAvatar !== 'boolean') return false;
  if (value.showAvatar !== undefined && typeof value.showAvatar !== 'boolean') return false;
  if (value.kizuna !== undefined) {
    if (!isRecord(value.kizuna) || !hasOnlyKeys(value.kizuna, KIZUNA_KEYS)
      || typeof value.kizuna.storyId !== 'string' || !nonEmpty(value.kizuna.storyId)) return false;
    if (value.kizuna.title !== undefined && typeof value.kizuna.title !== 'string') return false;
    if (value.kizuna.buttonText !== undefined && typeof value.kizuna.buttonText !== 'string') return false;
    if (value.kizuna.align !== undefined && !['left', 'right'].includes(String(value.kizuna.align))) return false;
  }
  return true;
}

function chatTextValueIsValid(value: unknown): value is ChatTextEffectValue {
  if (!isRecord(value) || !hasOnlyKeys(value, CHAT_VALUE_KEYS)) return false;
  if (value.text !== undefined && typeof value.text !== 'string') return false;
  if (value.talklet !== undefined && !talkletIsValid(value.talklet)) return false;
  if (value.x !== undefined && (typeof value.x !== 'number' || !Number.isFinite(value.x) || value.x < 0 || value.x > 1)) return false;
  if (value.y !== undefined && (typeof value.y !== 'number' || !Number.isFinite(value.y) || value.y < 0 || value.y > 1)) return false;
  if (value.align !== undefined && !alignments.has(String(value.align))) return false;
  if (value.kind !== undefined && (typeof value.kind !== 'string' || !chatKinds.has(value.kind as ChatTextKind))) return false;
  if (value.style !== undefined && !styleIsValid(value.style)) return false;
  for (const key of ['title', 'buttonText', 'targetStoryId'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  }
  return value.text !== undefined || value.talklet !== undefined;
}

function cardRequestFromSnapshot(value: unknown): StoryPresentationCardRequest | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !hasOnlyKeys(value, CARD_REQUEST_KEYS)
    || typeof value.entryId !== 'string' || typeof value.entryType !== 'string'
    || !(value.owner === null || typeof value.owner === 'string') || typeof value.intent !== 'string') return null;
  return value as unknown as StoryPresentationCardRequest;
}

function snapshotError(
  source: StoryNodeSource,
  snapshot: unknown,
  registry: StoryNodePresentationRegistry,
): string | undefined {
  if (!source.runId || !nonEmpty(source.runId)) return 'StoryRunIdRequired';
  if (!(source.owner === null || nonEmpty(source.owner))) return 'StoryOwnerInvalid';
  if (!isRecord(snapshot) || !hasOnlyKeys(snapshot, SNAPSHOT_KEYS)
    || !Array.isArray(snapshot.entities) || !Array.isArray(snapshot.overlays)) return 'Shape';

  if (snapshot.ephemeralTheme !== undefined && !ephemeralThemeIsValid(snapshot.ephemeralTheme, registry)) return 'Theme';

  const entities = new Set<string>();
  for (const candidate of snapshot.entities) {
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, ENTITY_KEYS)
      || typeof candidate.target !== 'string' || typeof candidate.optionId !== 'string'
      || typeof candidate.owner !== 'string' || candidate.lifetime !== 'story') return 'Entity';
    const key = entitySnapshotKey(candidate.target, candidate.owner);
    if (entities.has(key)) return 'DuplicateEntity';
    entities.add(key);
    const action: StoryAction = { kind: 'presentation', command: {
      command: 'setEntityPresentation', target: candidate.target as EntityPresentationKey,
      optionId: candidate.optionId, owner: candidate.owner, lifetime: 'story',
    } };
    const error = presentationError(registry, source, action.command, () => undefined);
    if (error) return error;
  }

  const overlays = new Set<string>();
  for (const candidate of snapshot.overlays) {
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, OVERLAY_KEYS)
      || typeof candidate.id !== 'string' || !nonEmpty(candidate.id) || !chatTextValueIsValid(candidate.value)) return 'Overlay';
    if (overlays.has(candidate.id)) return 'DuplicateOverlay';
    overlays.add(candidate.id);
    const cardRequest = cardRequestFromSnapshot(candidate.cardRequest);
    if (cardRequest === null) return 'CardRequest';
    if (cardRequest) {
      if (!cardRequestIsValid(cardRequest) || candidate.value.kind !== 'kizuna') return 'CardRequest';
      const resolved = entryForCard(registry, cardRequest);
      if ('error' in resolved) return resolved.error;
      const talklet = candidate.value.talklet as EngineTalklet | undefined;
      const kizuna = talklet && 'kizuna' in talklet ? talklet.kizuna as Record<string, unknown> | undefined : undefined;
      if (candidate.value.targetStoryId !== resolved.storyId || kizuna?.storyId !== resolved.storyId) return 'CardRequestTargetMismatch';
    } else if (candidate.value.kind === 'kizuna'
      || (candidate.value.talklet && 'kizuna' in candidate.value.talklet)) return 'CardRequestMissing';
  }
  return undefined;
}

/** Executes the new overlay and presentation commands with precise run ownership. */
export class StoryNodePresentationHost implements StoryNodePresentationPort {
  private readonly closedRuns = new Set<string>();
  private readonly runPresentations = new Map<string, RunPresentationState>();

  constructor(private readonly options: StoryNodePresentationHostOptions) {}

  preflight(action: StoryAction, source: StoryNodeSource): string | undefined {
    if (source.runId !== undefined && !nonEmpty(source.runId)) return 'StoryRunIdInvalid';
    if (source.runId && this.closedRuns.has(source.runId)) return 'StoryRunAlreadyEnded';
    if (action.kind === 'overlay') return overlayError(this.options.registry, action.command);
    if (action.kind === 'presentation') return presentationError(this.options.registry, source, action.command, this.options.getTitle);
    return undefined;
  }

  execute(action: StoryAction, source: StoryNodeSource): StoryNodeActionOutcome {
    const error = this.preflight(action, source);
    if (error) return rejected(error);
    if (action.kind !== 'overlay' && action.kind !== 'presentation') return rejected('PresentationActionUnsupported');
    try {
      if (action.kind === 'overlay') return this.executeOverlay(action.command, source);
      return this.executePresentation(action.command, source);
    } catch (error) {
      return rejected(`ActionExecutionFailed:${errorText(error)}`);
    }
  }

  close(source: StoryNodeSource, reason: StoryRunEndReason): void {
    const runId = source.runId;
    if (!runId || !nonEmpty(runId) || this.closedRuns.has(runId)) return;
    this.closedRuns.add(runId);
    this.runPresentations.delete(runId);
    this.options.colorSystem.clearStoryNodeTheme(runId);
    this.options.entityPresentation.clearRuntimeOverrides({ runId, lifetime: 'story' });
    this.options.eventBus.emit({ type: 'storyRunEnded', owner: source.owner, runId, reason });
  }

  activate(owner: string | null): void {
    this.options.colorSystem.activateStoryNodeThemeOwner(owner);
  }

  save(source: StoryNodeSource): StoryPresentationSnapshot {
    const state = source.runId ? this.runPresentations.get(source.runId) : undefined;
    return {
      ...(state?.ephemeralTheme === undefined ? {} : { ephemeralTheme: cloneEphemeralTheme(state.ephemeralTheme) }),
      entities: [...(state?.entities.values() ?? [])].map(entity => ({ ...entity })),
      overlays: [...(state?.overlays.values() ?? [])].map(cloneOverlaySnapshot),
    };
  }

  validateSnapshot(source: StoryNodeSource, snapshot: StoryPresentationSnapshot): void {
    const error = snapshotError(source, snapshot, this.options.registry);
    if (error) throw new Error(`StoryPresentationSnapshotInvalid:${error}`);
  }

  restore(source: StoryNodeSource, snapshot: StoryPresentationSnapshot): void {
    this.validateSnapshot(source, snapshot);
    const runId = source.runId;
    if (!runId || !nonEmpty(runId)) throw new Error('StoryRunIdRequired');
    if (this.closedRuns.has(runId)) throw new Error('StoryRunAlreadyEnded');

    const state = emptyRunPresentation();
    if (snapshot.ephemeralTheme !== undefined) {
      if (!this.options.colorSystem.setStoryNodeTheme(runId, source.owner, cloneEphemeralTheme(snapshot.ephemeralTheme))) {
        throw new Error('StoryPresentationSnapshotThemeRejected');
      }
      state.ephemeralTheme = cloneEphemeralTheme(snapshot.ephemeralTheme);
    }

    for (const entity of snapshot.entities) {
      if (!this.options.entityPresentation.setRuntimeOverride(
        entity.target as EntityPresentationKey, entity.optionId, entity.owner, 'story', runId,
      )) throw new Error('StoryPresentationSnapshotEntityRejected');
      state.entities.set(entitySnapshotKey(entity.target, entity.owner), { ...entity });
    }

    for (const overlay of snapshot.overlays) {
      const cloned = cloneOverlaySnapshot(overlay);
      this.emitOverlay(source, cloned);
      state.overlays.set(cloned.id, cloned);
    }
    this.runPresentations.set(runId, state);
  }

  private executeOverlay(command: StoryOverlayCommand, source: StoryNodeSource): StoryNodeActionOutcome {
    const fields = sourceEventFields(source);
    switch (command.command) {
      case 'clearId':
        this.options.eventBus.emit({ type: 'chatTextCleared', id: command.id, ...fields });
        if (source.runId) this.runPresentations.get(source.runId)?.overlays.delete(command.id);
        return applied();
      case 'clearAllTexts':
        this.options.eventBus.emit({ type: 'chatTextClearedAll', ...fields });
        if (source.runId) this.runPresentations.get(source.runId)?.overlays.clear();
        return applied();
      case 'clearFlow':
        this.options.eventBus.emit({ type: 'chatFlowCleared', ...fields });
        if (source.runId) this.runPresentations.get(source.runId)?.overlays.clear();
        return applied();
      case 'show': {
        const { content } = command;
        const valueLocation = {
          ...(command.x === undefined ? {} : { x: command.x }),
          ...(command.y === undefined ? {} : { y: command.y }),
          ...(command.align === undefined ? {} : { align: command.align }),
        };
        if (content.kind === 'text') {
          const overlay: StoryPresentationOverlaySnapshot = { id: command.id, value: {
            text: content.text,
            ...(content.template === undefined ? {} : { kind: content.template }),
            ...(content.style === undefined ? {} : { style: content.style }),
            ...valueLocation,
          } };
          this.emitOverlay(source, overlay);
          this.rememberOverlay(source, overlay);
          return applied();
        }
        if (content.kind === 'message') {
          const overlay: StoryPresentationOverlaySnapshot = { id: command.id, value: {
            talklet: storyContentTalklet(content.content, content.presentation),
            ...(content.style === undefined ? {} : { style: content.style }),
            ...valueLocation,
          } };
          this.emitOverlay(source, overlay);
          this.rememberOverlay(source, overlay);
          return applied();
        }
        const resolved = entryForCard(this.options.registry, content.card.request);
        if ('error' in resolved) return rejected(resolved.error);
        const cardTalklet: EngineTalklet = {
          kind: 'click',
          text: content.card.buttonText ?? '',
          kizuna: {
            storyId: resolved.storyId,
            ...(content.card.title === undefined ? {} : { title: content.card.title }),
            ...(content.card.buttonText === undefined ? {} : { buttonText: content.card.buttonText }),
            ...(content.card.align === undefined ? {} : { align: content.card.align }),
          },
        };
        const cardRequest: StoryPresentationCardRequest = { ...content.card.request };
        const overlay: StoryPresentationOverlaySnapshot = { id: command.id, value: {
          kind: 'kizuna', talklet: cardTalklet,
          ...(content.card.title === undefined ? {} : { title: content.card.title }),
          ...(content.card.buttonText === undefined ? {} : { buttonText: content.card.buttonText }),
          targetStoryId: resolved.storyId,
          ...valueLocation,
        }, cardRequest };
        this.emitOverlay(source, overlay);
        this.rememberOverlay(source, overlay);
        return applied();
      }
    }
  }

  private runState(source: StoryNodeSource, create: boolean): RunPresentationState | undefined {
    const runId = source.runId;
    if (!runId || !nonEmpty(runId)) return undefined;
    const current = this.runPresentations.get(runId);
    if (current || !create) return current;
    const created = emptyRunPresentation();
    this.runPresentations.set(runId, created);
    return created;
  }

  private rememberOverlay(source: StoryNodeSource, overlay: StoryPresentationOverlaySnapshot): void {
    this.runState(source, true)?.overlays.set(overlay.id, cloneOverlaySnapshot(overlay));
  }

  private emitOverlay(source: StoryNodeSource, overlay: StoryPresentationOverlaySnapshot): void {
    this.options.eventBus.emit({
      type: 'chatTextShown', id: overlay.id, ...overlay.value,
      ...(overlay.cardRequest === undefined ? {} : { cardRequest: { ...overlay.cardRequest } }),
      ...sourceEventFields(source),
    });
  }

  private executePresentation(command: StoryPresentationCommand, source: StoryNodeSource): StoryNodeActionOutcome {
    switch (command.command) {
      case 'theme': {
        const runId = source.runId!;
        if (!this.options.colorSystem.setStoryNodeTheme(runId, source.owner, command.value)) return rejected('ThemeApplicationFailed');
        if (command.value.scope !== 'area' && command.value.scope !== 'student') {
          const saved = { ...command.value, scope: 'ephemeral' } as StoryEphemeralThemeSnapshot;
          const state = this.runState(source, true)!;
          state.ephemeralTheme = cloneEphemeralTheme(saved);
        }
        return applied();
      }
      case 'setEntityPresentation': {
        const set = this.options.entityPresentation.setRuntimeOverride(
          command.target,
          command.optionId,
          command.owner,
          command.lifetime ?? 'manual',
          command.lifetime === 'story' ? source.runId : undefined,
        );
        if (!set) return rejected('PresentationOverrideRejected');
        if (command.lifetime === 'story') {
          const entity: StoryEntityPresentationSnapshot = {
            target: command.target, optionId: command.optionId, owner: command.owner, lifetime: 'story',
          };
          this.runState(source, true)?.entities.set(entitySnapshotKey(entity.target, entity.owner), entity);
        }
        return applied();
      }
      case 'clearEntityPresentation': {
        if (!this.options.entityPresentation.clearRuntimeOverride(command.target, command.owner, source.runId)) {
          return rejected('PresentationOverrideNotFound');
        }
        if (source.runId) this.runPresentations.get(source.runId)?.entities.delete(entitySnapshotKey(command.target, command.owner));
        return applied();
      }
      case 'openingTitle': {
        let title = nonEmpty(command.title ?? '') ? command.title : this.options.getTitle(source);
        if (!nonEmpty(title ?? '')) return rejected('OpeningTitleDefaultSourceMissing');
        this.options.eventBus.emit({ type: 'openingTitleShown', title, ...sourceEventFields(source) });
        return applied();
      }
    }
  }
}

export function createStoryNodePresentationHost(options: StoryNodePresentationHostOptions): StoryNodePresentationHost {
  return new StoryNodePresentationHost(options);
}
