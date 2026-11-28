import { jsonArchiveEntry, validateArchivePlan, type ArchivePlan, type ArchiveEntry } from '../archive/archive-writer';
import { DATAPACK_SINGLETON_FIELDS, isListField } from './fragment-parser';
import {
  hasProjectFragmentFields, normalizeProjectPath, orderKeyCounts, PROJECT_LAYOUT_PATH,
  projectEntityKey, projectOrderFingerprint, projectRecord,
  type DefinitionRecord, type ProjectDiagnostic, type ProjectLayout, type ProjectOrderPosition, type ProjectRead,
} from './project-source';

export type Grouping = 'type' | 'init' | 'character' | 'series' | 'custom';
export interface LayoutRule { path: string; table?: string; source?: string; key?: string }
type LayoutOperation =
  | { kind: 'split'; by: 'table' | 'entity' }
  | { kind: 'merge'; files?: readonly string[]; occurrences?: readonly string[]; target?: string; compatible?: boolean }
  | { kind: 'group'; by: Grouping; rules?: readonly LayoutRule[] };

export type LayoutRequest = LayoutOperation & {
  overrides?: Readonly<Record<string, string>>;
};

export interface LayoutPlacement {
  occurrenceId: string;
  table: string;
  ordinal: number;
  source: DefinitionRecord['source'];
  path: string;
  documentPointer: string;
  reason: string;
}

export interface LayoutPlan {
  project: string;
  archive?: ArchivePlan;
  placements: LayoutPlacement[];
  retained: string[];
  diagnostics: ProjectDiagnostic[];
  omitted: string[];
  requiresLayoutReader: boolean;
}

const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

export function planProjectLayout(read: ProjectRead, request: LayoutRequest): LayoutPlan {
  const plan: LayoutPlan = {
    project: read.project, placements: [], retained: [], diagnostics: [], omitted: [], requiresLayoutReader: false,
  };
  if (read.status === 'incomplete') {
    plan.diagnostics.push(...read.diagnostics);
    return plan;
  }
  const documents = new Map<string, Record<string, unknown>>();
  const entries: ArchiveEntry[] = [];
  const selectedFiles = new Set(request.kind === 'merge' ? request.files : undefined);
  const selectedRows = new Set(request.kind === 'merge' ? request.occurrences : undefined);
  const full = request.kind === 'merge' && request.files === undefined && request.occurrences === undefined;
  const target = request.kind === 'merge' ? request.target ?? 'content.json' : 'content/metadata.json';
  const taken = new Map<string, string>();
  const positions = new Map<string, (ProjectOrderPosition & { row: DefinitionRecord })[]>();
  const sourceRows = new Map<string, DefinitionRecord[]>();
  const lookup = new Map<string, DefinitionRecord | undefined>();
  const unchanged = new Map<string, Record<string, unknown>>();
  const metadataOrigins = new Map<string, string>();
  for (const row of read.definitions) {
    if (!isListField(row.table)) continue;
    const key = projectEntityKey(row.value);
    if (key !== undefined) {
      const identity = JSON.stringify([row.table, key]);
      lookup.set(identity, lookup.has(identity) ? undefined : row);
    }
    const data = row.table === 'storyDirectories' ? projectRecord(row.value) : undefined;
    if (typeof data?.initId === 'string' && typeof data.hierarchyString === 'string') {
      const pathIdentity = JSON.stringify(['storyDirectories', data.initId, data.hierarchyString]);
      lookup.set(pathIdentity, lookup.has(pathIdentity) ? undefined : row);
    }
    const path = row.source.path;
    if (!sourceRows.has(path)) sourceRows.set(path, []);
    sourceRows.get(path)!.push(row);
  }
  function problem(path: string, message: string): void { plan.diagnostics.push({ path, message }); }
  function define(path: string): Record<string, unknown> {
    if (!documents.has(path)) documents.set(path, Object.create(null) as Record<string, unknown>);
    return documents.get(path)!;
  }
  function metadata(path: string, key: string, value: unknown, source: string): void {
    const doc = define(path);
    const originKey = (field: string) => JSON.stringify([path, field]);
    if (key === 'extras' && projectRecord(value) && (doc.extras === undefined || projectRecord(doc.extras))) {
      const extras = (doc.extras ??= Object.create(null)) as Record<string, unknown>;
      for (const [name, item] of Object.entries(value as Record<string, unknown>)) {
        const field = `extras/${name}`;
        if (hasOwn(extras, name)) problem(source, `extras.${name} 与 ${metadataOrigins.get(originKey(field))} 重复。`);
        else {
          extras[name] = item;
          metadataOrigins.set(originKey(field), source);
        }
      }
      return;
    }
    if (hasOwn(doc, key) && !(isListField(key) && Array.isArray(value) && !value.length && Array.isArray(doc[key]))
      && !(['name', 'version', 'modName'].includes(key) && doc[key] === value)) {
      problem(source, `${key} 与 ${metadataOrigins.get(originKey(key)) ?? path} 无法无损合一。`);
    } else if (!hasOwn(doc, key)) {
      doc[key] = value;
      metadataOrigins.set(originKey(key), source);
    }
  }
  function place(row: DefinitionRecord, path: string, reason: string): void {
    const doc = define(path);
    const records = (doc[row.table] ??= []) as unknown[];
    const index = records.push(row.value) - 1;
    notePosition(row, path, index);
    plan.placements.push({
      occurrenceId: row.occurrenceId, table: row.table, ordinal: row.ordinal,
      source: row.source, path, documentPointer: `/${row.table}/${index}`, reason,
    });
  }
  function notePosition(row: DefinitionRecord, path: string, index: number): void {
    if (!positions.has(row.table)) positions.set(row.table, []);
    positions.get(row.table)!.push({ path, index, row, key: projectEntityKey(row.value) });
  }
  try {
    if (request.kind === 'merge' && !full && !selectedFiles.size && !selectedRows.size) throw new Error('请选择需要合一的文件或实体。');
    if (request.kind === 'merge' && request.compatible && (!full || !read.manifest)) {
      throw new Error('旧版发行输出需要完整合一与有效包清单。');
    }
    for (const path of selectedFiles) {
      if (!read.files.some(file => file.role === 'definition' && file.path === path)) problem(path, '选中的定义文件不存在。');
    }
    for (const id of selectedRows) {
      if (!read.definitions.some(row => row.occurrenceId === id && isListField(row.table))) problem('.', `选中的声明不可单独移动：${id}`);
    }
    const rowsToPlace: { row: DefinitionRecord; path: string; reason: string }[] = [];
    for (const file of read.files) {
      if (file.role === 'layout') continue;
      const raw = file.raw;
      if (file.role !== 'definition' || !raw) {
        if (request.kind === 'merge' && request.compatible && file.role === 'other' && /\.json$/i.test(file.path)) {
          plan.omitted.push(file.path);
        } else {
          entries.push({ path: file.path, content: file.bytes! });
          plan.retained.push(file.path);
        }
        continue;
      }
      const rows = sourceRows.get(file.path) ?? [];
      const remainingPath = !read.manifest && file.path === 'datapack.json' ? 'content/source-metadata.json' : file.path;
      const fileSelected = full || selectedFiles.has(file.path);
      if (request.kind === 'merge' && !fileSelected && target !== remainingPath
        && !rows.some(row => selectedRows.has(row.occurrenceId))) {
        entries.push({ path: file.path, content: file.bytes! });
        plan.retained.push(file.path);
        unchanged.set(file.path, raw);
        for (const row of rows) {
          const pointer = row.source.documentPointer!;
          const index = Number(pointer.slice(pointer.lastIndexOf('/') + 1));
          notePosition(row, file.path, index);
        }
        continue;
      }
      for (const [field, value] of Object.entries(raw)) {
        if (isListField(field) && Array.isArray(value) && value.length) continue;
        if (request.kind === 'merge' && fileSelected) metadata(target, field, value, file.path);
        else if (request.kind !== 'merge' && ['name', 'version', 'modName'].includes(field)) metadata(target, field, value, file.path);
        else metadata(remainingPath, field, value, file.path);
      }
      for (const row of rows) {
        if (request.kind === 'merge') {
          const selected = fileSelected || selectedRows.has(row.occurrenceId);
          rowsToPlace.push({ row, path: selected ? target : remainingPath, reason: selected ? '合一' : '保留未选声明' });
        } else {
          const assigned = request.kind === 'split'
            ? { path: request.by === 'entity'
                ? `content/${row.table}/${filename(projectEntityKey(row.value) ?? 'definition')}-${row.ordinal + 1}.json`
                : `content/${row.table}.json`, reason: request.by === 'entity' ? '按实体拆分' : '按表拆分' }
            : groupPlacement(row, request, lookup);
          const override = request.overrides?.[row.occurrenceId] ?? request.overrides?.[file.path];
          rowsToPlace.push({ row, path: override ?? assigned.path, reason: override === undefined ? assigned.reason : '手工指定' });
        }
      }
    }
    rowsToPlace.sort((left, right) => left.row.ordinal - right.row.ordinal);
    for (const item of rowsToPlace) place(item.row, item.path, item.reason);
    for (const [path, doc] of documents) {
      if (!/\.json$/i.test(path)) problem(path, '定义文件必须使用 .json。');
      entries.push(jsonArchiveEntry(path, doc));
    }
    const originalDocuments = read.files.flatMap(file => file.role === 'definition' && file.raw ? [file.raw] : []);
    const outputDocuments = [...unchanged, ...documents].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([, doc]) => doc);
    const outputMetadata = effectiveMetadata(outputDocuments);
    for (const [key, value] of effectiveMetadata(originalDocuments)) {
      if (JSON.stringify(value) !== JSON.stringify(outputMetadata.get(key))) {
        problem('.', `当前布局会改变 ${key} 的覆盖结果。请保留相关分片组合或先处理冲突。`);
      }
    }
    for (const entry of entries) {
      const path = normalizeProjectPath(entry.path);
      if (path.toLowerCase() === 'datapack.json' && !(read.manifest && plan.retained.includes(path))) {
        problem(path, '根 datapack.json 保留给包清单。');
      }
      const folded = path.toLowerCase();
      if (taken.has(folded)) problem(path, `目标路径与 ${taken.get(folded)} 冲突。`);
      taken.set(folded, path);
    }
    for (const path of taken.keys()) {
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) {
        if (taken.has(parts.slice(0, i).join('/'))) problem(taken.get(path)!, '目标的上级路径已经是文件。');
      }
    }
    const layout: ProjectLayout = {};
    if (!read.manifest) layout.standalone = true;
    for (const [table, tablePositions] of positions) {
      const physical = [...tablePositions].sort((a, b) => a.path.localeCompare(b.path, 'en') || a.index - b.index);
      if (!physical.some((position, index) => position.row.ordinal !== index) || canReorder(table, physical)) continue;
      const counts = orderKeyCounts(tablePositions.map(position => position.key));
      (layout.order ??= Object.create(null))[table] = tablePositions
        .sort((a, b) => a.row.ordinal - b.row.ordinal)
        .map(({ path, index, key, row }) => key !== undefined && counts.get(key) === 1
          ? { path, index, key }
          : { path, index, key, fingerprint: projectOrderFingerprint(row.value) });
    }
    const extensionFragments = [...unchanged, ...documents]
      .filter(([, doc]) => !hasProjectFragmentFields(doc)).map(([path]) => path);
    if (extensionFragments.length) layout.definitionFiles = extensionFragments;
    const retainedAuthorJson = read.files.some(file => file.role === 'other' && /\.json$/i.test(file.path)
      && !plan.omitted.includes(file.path));
    plan.requiresLayoutReader = Boolean(layout.order || layout.standalone || layout.definitionFiles || retainedAuthorJson);
    if (plan.requiresLayoutReader) entries.push(jsonArchiveEntry(PROJECT_LAYOUT_PATH, layout));
    if (!plan.diagnostics.length) plan.archive = { entries: validateArchivePlan({ entries }) };
  } catch (error) { problem('.', error instanceof Error ? error.message : String(error)); }
  return plan;
}

function canReorder(table: string, positions: readonly { key?: string }[]): boolean {
  // Runtime consumers select cultivation curves by ID. Duplicate keys still use overlay order.
  return table === 'cultivateCurves' && positions.every(position => position.key !== undefined)
    && new Set(positions.map(position => position.key)).size === positions.length;
}

function effectiveMetadata(documents: readonly Record<string, unknown>[]): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const doc of documents) {
    for (const key of ['name', 'version', 'modName']) {
      if (!result.has(key) && typeof doc[key] === 'string') result.set(key, doc[key]);
    }
    for (const key of DATAPACK_SINGLETON_FIELDS) {
      if (doc[key] !== undefined) result.set(key, doc[key]);
    }
    for (const [key, value] of Object.entries(projectRecord(doc.extras) ?? {})) result.set(`extras/${key}`, value);
  }
  return result;
}

function filename(value: string): string {
  return (value.normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^\.+|[. ]+$/g, '').slice(0, 90) || 'other')
    .replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?=\.|$)/i, '_$&');
}

function groupPlacement(
  row: DefinitionRecord, request: Extract<LayoutOperation, { kind: 'group' }>, lookup: ReadonlyMap<string, DefinitionRecord | undefined>,
): { path: string; reason: string } {
  const match = (request.rules ?? []).find(rule => (rule.table || rule.source || rule.key)
    && (!rule.table || rule.table === row.table) && (!rule.source || rule.source === row.source.path)
    && (!rule.key || rule.key === projectEntityKey(row.value)));
  if (match) return { path: match.path, reason: '自定义规则' };
  const get = (table: string, key: unknown) => typeof key === 'string'
    ? projectRecord(lookup.get(JSON.stringify([table, key]))?.value) : undefined;
  const data = projectRecord(row.value);
  const story = row.table === 'stories' ? data : get('stories', data?.storyId);
  const directoryOf = (location: Record<string, unknown> | undefined) => {
    const identity = JSON.stringify(['storyDirectories', location?.initId, location?.hierarchyString]);
    return get('storyDirectories', location?.directoryId) ?? projectRecord(lookup.get(identity)?.value);
  };
  const directory = row.table === 'storyDirectories' ? data : directoryOf(story);
  const placements = Array.isArray(data?.directoryPlacements)
    ? data.directoryPlacements.map(projectRecord).filter(placement => placement !== undefined) : [];
  const inits = row.table === 'inits' ? [data?.id] : Array.isArray(data?.availableInits)
    ? [...new Set(data.availableInits)] : [data?.initId ?? get('areas', data?.areaId)?.initId ?? story?.initId];
  let group = 'unassigned';
  let reason = '待分组';
  if (request.by === 'type') return { path: `types/${row.table}.json`, reason: '数据类型' };
  if (request.by === 'custom') return { path: `unassigned/${row.table}.json`, reason };
  const owner = row.table === 'characters' ? data?.id : data?.characterId ?? data?.proto ?? data?.owner ?? directory?.characterId;
  const catalog = projectRecord(data?.catalog);
  const series = story?.hierarchyString ?? directory?.hierarchyString ?? story?.directoryId ?? catalog?.category;
  const candidates = request.by === 'init' ? inits : request.by === 'character'
    ? [...placements.map(placement => directoryOf(placement)?.characterId), owner]
    : [...placements.map(placement => placement.hierarchyString ?? directoryOf(placement)?.hierarchyString ?? placement.directoryId), series];
  const values = [...new Set(candidates.filter((candidate): candidate is string => typeof candidate === 'string' && candidate !== ''))];
  const value = values[0];
  if (values.length > 1) { group = 'shared'; reason = '多个归属'; }
  else if (typeof value === 'string' && value) {
    const segments = request.by === 'series' ? value.split('/') : [value];
    group = 'by-id/' + segments.map(segment => 'id-' +
      encodeURIComponent(segment).replace(/[.!*'()]/g, character => `%${character.charCodeAt(0).toString(16)}`)).join('/');
    reason = value;
  }
  return { path: `${request.by}/${group}/${row.table}.json`, reason };
}
