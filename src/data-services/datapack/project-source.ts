import { normalizeArchivePath } from '../archive/archive-writer';
import type { Datapack } from '../contracts/datapack';
import { ZIP_PREFIX } from '../contracts/pic';
import { DATAPACK_SINGLETON_FIELDS, isListField, mergeFragments, parseFragmentValue, type DatapackFragment } from './fragment-parser';
import { parsePackManifest, type PackManifest } from './manifest';
import { isPackImagePath, mergePackFragments } from './pack-parser';
import type { PackSource } from './source';

import { PROJECT_LAYOUT_PATH } from './source';

export { PROJECT_LAYOUT_PATH } from './source';
const MANIFEST_PATH = 'datapack.json';
const fragmentFields = ['name', 'version', 'extras', ...DATAPACK_SINGLETON_FIELDS];

export interface SourcePoint {
  packageRef?: string;
  path: string;
  documentPointer?: string;
}

export interface ProjectDiagnostic extends SourcePoint {
  message: string;
}

export interface SourceFile {
  path: string;
  writable: false;
  role: 'manifest' | 'definition' | 'layout' | 'asset' | 'other';
  bytes?: Uint8Array;
  raw?: Record<string, unknown>;
}

export interface DefinitionRecord {
  occurrenceId: string;
  table: string;
  value: unknown;
  source: SourcePoint;
  ordinal: number;
}

export interface ProjectLayout {
  standalone?: true;
  definitionFiles?: string[];
  order?: Record<string, ProjectOrderPosition[]>;
}

export interface ProjectOrderPosition {
  path: string;
  index: number;
  key?: string;
  fingerprint?: string;
}

interface ProjectReadBase {
  project: string;
  packageRef: string;
  files: SourceFile[];
  definitions: DefinitionRecord[];
  diagnostics: ProjectDiagnostic[];
  manifest?: PackManifest;
}

export type ProjectRead = ProjectReadBase & (
  | { status: 'complete'; datapack: Datapack }
  | { status: 'incomplete' }
);

let nextProject = 0;

export function projectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function projectEntityKey(value: unknown): string | undefined {
  const record = projectRecord(value);
  const key = record?.id ?? record?.resourceId;
  return typeof key === 'string' && key ? key : undefined;
}

export function hasProjectFragmentFields(raw: Record<string, unknown>): boolean {
  return Object.keys(raw).some(field => isListField(field) || fragmentFields.includes(field));
}

export function orderKeyCounts(positions: Iterable<string | undefined>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of positions) if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/** Detect edits to ambiguous rows within a layout copy, without assigning them an identity. */
export function projectOrderFingerprint(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, nested: unknown) => {
    const record = projectRecord(nested);
    return record ? Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]])) : nested;
  });
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < canonical.length; i++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(canonical.charCodeAt(i))) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function normalizeProjectPath(path: string): string {
  const normalized = normalizeArchivePath(path);
  if (normalized.split('/').some(part => /[<>:"|?*\x00-\x1f]|[. ]$/u.test(part)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error('路径包含不可移植的文件名。');
  }
  return normalized;
}

export async function readProject(source: PackSource): Promise<ProjectRead> {
  const project = `project-${++nextProject}`;
  const result: ProjectReadBase = { project, packageRef: project, files: [], definitions: [], diagnostics: [] };
  const fragments = new Map<string, DatapackFragment>();
  let layout: ProjectLayout | undefined;
  const seen = new Set<string>();
  const ordinals = new Map<string, number>();
  let standaloneModName: string | undefined;
  function report(path: string, error: unknown): void {
    result.diagnostics.push({ packageRef: result.packageRef, path, message: error instanceof Error ? error.message : String(error) });
  }
  let entries;
  try { entries = await source.list(); }
  catch (error) {
    report('.', error);
    return { ...result, status: 'incomplete' };
  }
  for (const entry of entries) {
    const role = entry.path === PROJECT_LAYOUT_PATH && source.kind !== 'file' ? 'layout'
      : entry.path === MANIFEST_PATH && source.kind !== 'file' ? 'manifest'
      : /\.json$/i.test(entry.path) || source.kind === 'file' ? 'definition'
      : isPackImagePath(entry.path) || /\.(mp3|ogg|wav|m4a|webm|mp4)$/i.test(entry.path) ? 'asset' : 'other';
    const file: SourceFile = { path: entry.path, role, writable: false };
    result.files.push(file);
    try {
      const normalized = normalizeProjectPath(entry.originalPath ?? entry.path);
      if (normalized !== entry.path || seen.has(normalized.toLowerCase())) throw new Error('文件路径越界或重复。');
      seen.add(normalized.toLowerCase());
      file.bytes = new Uint8Array(await entry.read());
      if (role === 'other' || role === 'asset') continue;
      const decoded: unknown = JSON.parse(new TextDecoder().decode(file.bytes));
      if (role === 'layout') {
        const info = projectRecord(decoded);
        if (!info || (info.standalone !== undefined && info.standalone !== true)
          || (info.definitionFiles !== undefined && (!Array.isArray(info.definitionFiles)
            || info.definitionFiles.some(path => typeof path !== 'string')))
          || (info.order !== undefined && !projectRecord(info.order))) throw new Error('布局附属文件格式无效。');
        layout = info as ProjectLayout;
        continue;
      }
      if (role === 'manifest') {
        result.manifest = parsePackManifest(decoded);
        continue;
      }
      const raw = projectRecord(decoded);
      if (!raw) throw new Error('Datapack 分片必须是 JSON 对象。');
      file.raw = raw;
      if (source.kind !== 'file' && !hasProjectFragmentFields(raw)) {
        file.role = 'other';
        continue;
      }
      for (const [table, values] of Object.entries(raw)) {
        const isList = isListField(table) && Array.isArray(values);
        const isSingleton = (DATAPACK_SINGLETON_FIELDS as readonly string[]).includes(table);
        if (!isList && !isSingleton) continue;
        const declarations = isList ? values : [values];
        declarations.forEach((value, index) => {
          const documentPointer = isList ? `/${table}/${index}` : `/${table}`;
          const ordinal = ordinals.get(table) ?? 0;
          ordinals.set(table, ordinal + 1);
          result.definitions.push({
            occurrenceId: JSON.stringify([entry.path, documentPointer]),
            table, value, ordinal, source: { packageRef: result.packageRef, path: entry.path, documentPointer },
          });
        });
      }
      fragments.set(entry.path, parseFragmentValue(entry.path, structuredClone(raw)));
      if (typeof raw.modName === 'string') standaloneModName ??= raw.modName;
    } catch (error) { report(entry.path, error); }
  }
  if (layout?.definitionFiles) {
    const byPath = new Map(result.files.map(file => [file.path, file]));
    const declared = new Set<string>();
    for (const path of layout.definitionFiles) {
      const file = byPath.get(path);
      if (declared.has(path) || !file?.raw || (file.role !== 'other' && file.role !== 'definition')) {
        report(PROJECT_LAYOUT_PATH, `定义分片记录重复或失效：${path}。`);
        continue;
      }
      declared.add(path);
      file.role = 'definition';
      if (!result.manifest && typeof file.raw.modName === 'string') standaloneModName ??= file.raw.modName;
    }
  }
  if (!result.manifest && source.kind !== 'file' && !layout?.standalone && !seen.has(MANIFEST_PATH)) {
    report(MANIFEST_PATH, '缺少根目录包清单。');
  }
  const readablePaths = new Set(result.files.filter(file => file.bytes).map(file => file.path));
  for (const row of result.definitions) {
    const src = row.table === 'pics' ? projectRecord(row.value)?.src : undefined;
    if (typeof src === 'string' && src.startsWith(ZIP_PREFIX) && !readablePaths.has(src.slice(ZIP_PREFIX.length))) {
      result.diagnostics.push({ ...row.source, message: `找不到包内资源 ${src}。` });
    }
  }
  if (!fragments.size && !result.diagnostics.length) report('.', '未找到 Datapack 定义分片。');
  if (result.diagnostics.length) return { ...result, status: 'incomplete' };
  try {
    const projection = [...fragments.values()];
    const datapack = result.manifest ? mergePackFragments(projection, result.manifest) : mergeFragments(projection);
    if (!result.manifest && standaloneModName !== undefined) datapack.modName = standaloneModName;
    applyProjectOrder(result.definitions, fragments, datapack, layout);
    return { ...result, status: 'complete', datapack };
  } catch (error) {
    report(error && typeof error === 'object' && 'path' in error && typeof error.path === 'string'
      ? error.path : PROJECT_LAYOUT_PATH, error);
    return { ...result, status: 'incomplete' };
  }
}

function applyProjectOrder(
  definitions: DefinitionRecord[], fragments: ReadonlyMap<string, DatapackFragment>,
  datapack: Datapack, layout?: ProjectLayout,
): void {
  if (!layout?.order) return;
  const projection = datapack as unknown as Record<string, unknown>;
  const byLocation = new Map(definitions.map(row => [row.occurrenceId, row]));
  const validated: { table: string; rows: DefinitionRecord[]; values: unknown[] }[] = [];
  for (const [table, positions] of Object.entries(layout.order)) {
    const declarations = definitions.filter(row => row.table === table);
    if (!isListField(table) || !Array.isArray(positions)
      || positions.length !== declarations.length) {
      throw new Error(`顺序记录没有覆盖 ${table} 的全部声明。`);
    }
    const counts = orderKeyCounts(declarations.map(row => projectEntityKey(row.value)));
    const used = new Set<string>();
    const rows: DefinitionRecord[] = [];
    const values = positions.map(position => {
      const location = JSON.stringify([position?.path, `/${table}/${position?.index}`]);
      const row = byLocation.get(location);
      if (!row || !Number.isInteger(position.index) || used.has(location)) {
        throw new Error(`顺序记录中的 ${table} 来源失效或重复。`);
      }
      const key = projectEntityKey(row.value);
      const needsFingerprint = key === undefined || counts.get(key) !== 1;
      if (position.key !== key || (needsFingerprint && position.fingerprint === undefined)
        || (position.fingerprint !== undefined && projectOrderFingerprint(row.value) !== position.fingerprint)) {
        throw new Error(`顺序记录失效：${position.path}#/${table}/${position.index} 无法确认原声明。请从原始输入重新导出布局。`);
      }
      used.add(location);
      rows.push(row);
      return fragments.get(position.path)!.lists[table]![position.index];
    });
    validated.push({ table, rows, values });
  }
  for (const { table, rows, values } of validated) {
    rows.forEach((row, ordinal) => { row.ordinal = ordinal; });
    projection[table] = values;
  }
}
