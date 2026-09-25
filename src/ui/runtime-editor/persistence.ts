// ============================================================
// ui/runtime-editor/persistence.ts — Runtime Editor 编辑态长效保存
// ============================================================

import { LocalStorageAdapter, type StorageAdapter } from '../../data-services/persistence/storage-adapter';
import {
  snapshotRuntimeEditor,
  type RuntimeDatapackEditorState,
  type RuntimeEditorDraftSnapshot,
  type RuntimeEditorDefinitionDraft,
  type RuntimeEditorContentKind,
  type RuntimeEditorFilter,
} from './state';

export const RUNTIME_EDITOR_DRAFT_STORAGE_KEY = 'acprogram_runtime_editor_draft';
export const RUNTIME_EDITOR_DRAFT_SCHEMA_VERSION = 1;
export const RUNTIME_EDITOR_DRAFT_DEBOUNCE_MS = 180;

export interface RuntimeEditorDraftEnvelope {
  schemaVersion: typeof RUNTIME_EDITOR_DRAFT_SCHEMA_VERSION;
  savedAt: number;
  sourceId: string;
  payload: RuntimeEditorDraftSnapshot;
}

export type RuntimeEditorDraftLoadResult =
  | { status: 'empty' }
  | { status: 'restored'; snapshot: RuntimeEditorDraftSnapshot; savedAt: number }
  | { status: 'invalid'; reason: string };

export interface RuntimeEditorPersistenceResult {
  ok: boolean;
  message?: string;
}

const CONTENT_KINDS: readonly RuntimeEditorContentKind[] = ['inits', 'areas', 'spots', 'enhancements'];
const FILTERS: readonly RuntimeEditorFilter[] = ['all', 'pending', 'applied', 'removed'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDefinition(value: unknown): value is RuntimeEditorDefinitionDraft {
  return isRecord(value) && typeof value.idName === 'string';
}

function isSnapshot(value: unknown): value is RuntimeEditorDraftSnapshot {
  if (!isRecord(value)) return false;
  const arrays = [value.spots, value.inits, value.areas, value.enhancements];
  const suspended = [value.suspendedSpotIds, value.suspendedInitIds, value.suspendedAreaIds, value.suspendedEnhancementIds];
  return typeof value.enabled === 'boolean'
    && typeof value.draftSourceId === 'string'
    && typeof value.modName === 'string'
    && typeof value.displayName === 'string'
    && typeof value.version === 'string'
    && typeof value.author === 'string'
    && typeof value.description === 'string'
    && (typeof value.selectedAreaId === 'string' || value.selectedAreaId === null)
    && arrays.every(items => Array.isArray(items) && items.every(isDefinition))
    && (typeof value.selectedSpotId === 'string' || value.selectedSpotId === null)
    && typeof value.selectedContentKind === 'string'
    && CONTENT_KINDS.includes(value.selectedContentKind as RuntimeEditorContentKind)
    && (typeof value.selectedDefinitionId === 'string' || value.selectedDefinitionId === null)
    && suspended.every(items => Array.isArray(items) && items.every(item => typeof item === 'string'))
    && typeof value.browserFilter === 'string'
    && FILTERS.includes(value.browserFilter as RuntimeEditorFilter)
    && (typeof value.activeSection === 'string' || value.activeSection === null)
    && (value.formDraft === null || isRecord(value.formDraft));
}

function decodeEnvelope(raw: string): RuntimeEditorDraftEnvelope | null {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== RUNTIME_EDITOR_DRAFT_SCHEMA_VERSION) return null;
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return null;
  if (typeof value.sourceId !== 'string' || !isSnapshot(value.payload)) return null;
  return value as unknown as RuntimeEditorDraftEnvelope;
}

export class RuntimeEditorDraftPersistence {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingEditor: RuntimeDatapackEditorState | null = null;

  constructor(
    private readonly storage: StorageAdapter = new LocalStorageAdapter(),
    private readonly onError?: (message: string) => void,
  ) {}

  schedule(editor: RuntimeDatapackEditorState): void {
    this.pendingEditor = editor;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      const pending = this.pendingEditor;
      this.pendingEditor = null;
      if (pending) this.flush(pending);
    }, RUNTIME_EDITOR_DRAFT_DEBOUNCE_MS);
  }

  flush(editor: RuntimeDatapackEditorState | null = this.pendingEditor): RuntimeEditorPersistenceResult {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pendingEditor = null;
    if (!editor) return { ok: true };
    try {
      const payload = snapshotRuntimeEditor(editor);
      const envelope: RuntimeEditorDraftEnvelope = {
        schemaVersion: RUNTIME_EDITOR_DRAFT_SCHEMA_VERSION,
        savedAt: Date.now(),
        sourceId: editor.draftSourceId,
        payload,
      };
      this.storage.set(RUNTIME_EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(envelope));
      return { ok: true };
    } catch (error) {
      const message = `编辑态草稿保存失败，当前编辑仍保留在内存中：${error instanceof Error ? error.message : String(error)}`;
      this.onError?.(message);
      return { ok: false, message };
    }
  }

  load(): RuntimeEditorDraftLoadResult {
    let raw: string | null;
    try {
      raw = this.storage.get(RUNTIME_EDITOR_DRAFT_STORAGE_KEY);
    } catch (error) {
      return { status: 'invalid', reason: error instanceof Error ? error.message : String(error) };
    }
    if (raw === null) return { status: 'empty' };
    try {
      const envelope = decodeEnvelope(raw);
      if (!envelope) {
        this.removeStoredDraft();
        return { status: 'invalid', reason: '编辑态草稿版本或结构不受支持。' };
      }
      return { status: 'restored', snapshot: envelope.payload, savedAt: envelope.savedAt };
    } catch (error) {
      this.removeStoredDraft();
      return { status: 'invalid', reason: `编辑态草稿解析失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pendingEditor = null;
    this.removeStoredDraft();
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pendingEditor = null;
  }

  private removeStoredDraft(): void {
    try {
      this.storage.remove(RUNTIME_EDITOR_DRAFT_STORAGE_KEY);
    } catch (error) {
      this.onError?.(`编辑态草稿清理失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

