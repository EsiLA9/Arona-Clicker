import { FolderPackSource, parsePack, parsePackFromZipBuffer, type PackEntry, type StoredPack } from '../../data-services/index';

const DEVELOPMENT_ROOT = '../../datapack-dev/';
const DEVELOPMENT_ASSETS = import.meta.glob<string>('../../datapack-dev/**/*', {
  eager: true,
  query: '?url',
  import: 'default',
});

export interface DevelopmentPackIssue {
  readonly sourcePath: string;
  readonly message: string;
}

export interface DevelopmentPackDiscovery {
  readonly packs: readonly StoredPack[];
  readonly issues: readonly DevelopmentPackIssue[];
}

export interface DevelopmentPackDiscoveryProgress {
  readonly completed: number;
  readonly total: number;
  readonly currentPackage: string | null;
  readonly stage?: 'reading' | 'parsing';
  readonly currentFile?: string;
  readonly filesRead?: number;
  readonly fileCount?: number;
}

export type DevelopmentPackProgressReporter = (progress: DevelopmentPackDiscoveryProgress) => void;

export type DevelopmentAssetReader = (url: string) => Promise<Uint8Array>;

export function parseDevelopmentPackFolderName(name: string): {
  modName: string;
  version: string;
  editingMode: 'editing' | 'normal';
} | null {
  const match = /^([a-z0-9-]+)@(.+)@(editing|finished)$/.exec(name);
  if (!match) return null;
  return { modName: match[1], version: match[2], editingMode: match[3] === 'editing' ? 'editing' : 'normal' };
}

function relativeDevelopmentPath(assetPath: string): string | null {
  const normalized = assetPath.replace(/\\/g, '/');
  const prefix = DEVELOPMENT_ROOT.replace(/\\/g, '/');
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : null;
}

function toStoredPack(
  sourcePath: string,
  parsed: Awaited<ReturnType<typeof parsePack>>,
  sourceKind: 'folder' | 'zip',
  editingMode: 'editing' | 'normal',
): StoredPack {
  const id = `development:${sourcePath}`;
  return {
    id,
    packRecordId: id,
    sourcePath,
    manifest: parsed.manifest,
    datapack: parsed.datapack,
    images: parsed.images,
    sourceKind,
    importedAt: Date.now(),
    editingMode,
  };
}

export async function discoverDevelopmentDatapacks(
  assets: Readonly<Record<string, string>>,
  readAsset: DevelopmentAssetReader = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`读取开发数据包文件失败：HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  },
  onProgress?: DevelopmentPackProgressReporter,
): Promise<DevelopmentPackDiscovery> {
  const byPath = new Map<string, string>();
  for (const [assetPath, url] of Object.entries(assets)) {
    const relativePath = relativeDevelopmentPath(assetPath);
    if (relativePath) byPath.set(relativePath, url);
  }

  const packs: StoredPack[] = [];
  const issues: DevelopmentPackIssue[] = [];
  const archivePaths = [...byPath.keys()]
    .filter(path => !path.includes('/') && path.toLowerCase().endsWith('.zip'))
    .sort((left, right) => left.localeCompare(right));
  const directories = new Set([...byPath.keys()]
    .filter(path => path.includes('/'))
    .map(path => path.slice(0, path.indexOf('/')))
    .filter(name => parseDevelopmentPackFolderName(name) !== null));
  const topLevelDirectories = new Set([...byPath.keys()]
    .filter(path => path.includes('/'))
    .map(path => path.slice(0, path.indexOf('/'))));
  for (const directory of topLevelDirectories) {
    if (parseDevelopmentPackFolderName(directory) === null && byPath.has(`${directory}/datapack.json`)) {
      issues.push({ sourcePath: `${directory}/`, message: '展开包目录名必须为 <modName>@<version>@editing 或 <modName>@<version>@finished。' });
    }
  }

  const workItems = [
    ...archivePaths.map(sourcePath => ({ sourcePath, kind: 'zip' as const })),
    ...[...directories].sort((left, right) => left.localeCompare(right))
      .map(sourcePath => ({ sourcePath: `${sourcePath}/`, kind: 'folder' as const })),
  ];
  let completed = 0;
  if (workItems.length === 0) onProgress?.({ completed, total: 0, currentPackage: null });

  for (const item of workItems) {
    const report = (detail: Partial<DevelopmentPackDiscoveryProgress> = {}): void =>
      onProgress?.({ completed, total: workItems.length, currentPackage: item.sourcePath, ...detail });
    report();
    try {
      if (item.kind === 'zip') {
        report({ stage: 'reading', currentFile: item.sourcePath });
        const bytes = await readAsset(byPath.get(item.sourcePath)!);
        report({ stage: 'parsing', currentFile: item.sourcePath });
        const parsed = await parsePackFromZipBuffer(bytes);
        packs.push(toStoredPack(item.sourcePath, parsed, 'zip', 'normal'));
      } else {
        const directory = item.sourcePath.slice(0, -1);
        const identity = parseDevelopmentPackFolderName(directory)!;
        const files = [...byPath.entries()].filter(([path]) => path.startsWith(item.sourcePath));
        let filesRead = 0;
        const entries: PackEntry[] = files
          .map(([path, url]) => ({
            path: path.slice(item.sourcePath.length),
            read: async () => {
              report({ stage: 'reading', currentFile: path, filesRead, fileCount: files.length });
              const bytes = await readAsset(url);
              filesRead += 1;
              report({ stage: 'parsing', currentFile: path, filesRead, fileCount: files.length });
              return bytes;
            },
          }));
        const parsed = await parsePack(new FolderPackSource(entries));
        if (parsed.manifest.modName !== identity.modName || parsed.manifest.version !== identity.version) {
          throw new Error(`目录身份 ${identity.modName}@${identity.version} 与 manifest ${parsed.manifest.modName}@${parsed.manifest.version} 不一致。`);
        }
        packs.push(toStoredPack(item.sourcePath, parsed, 'folder', identity.editingMode));
      }
    } catch (error) {
      issues.push({ sourcePath: item.sourcePath, message: error instanceof Error ? error.message : String(error) });
    }
    completed += 1;
  }
  onProgress?.({ completed, total: workItems.length, currentPackage: null });

  issues.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  return { packs, issues };
}

export function discoverBundledDevelopmentDatapacks(
  onProgress?: DevelopmentPackProgressReporter,
): Promise<DevelopmentPackDiscovery> {
  return discoverDevelopmentDatapacks(DEVELOPMENT_ASSETS, undefined, onProgress);
}
