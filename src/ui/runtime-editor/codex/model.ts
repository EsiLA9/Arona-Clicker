/**
 * RuntimeEditor 超级图鉴壳层的最小只读投影。
 *
 * 这些类型刻意不引用 Registry、Datapack 或 PlayerState。集成层只需把当前
 * Runtime 的有效内容投影成此形状，壳层即可独立渲染和维护选择状态。
 */

export type CodexPane = 'mods' | 'entries' | 'detail';
export type CodexInspectorTab = 'overview' | 'relations' | 'raw';

export interface CodexModView {
  readonly id: string;
  readonly label: string;
  readonly version?: string;
  readonly entryCount?: number;
  readonly statusLabel?: string;
  readonly badges?: readonly string[];
}

export interface CodexKindView {
  /** 对应最终 RuntimeContentBrowserView 的 definitionKind。 */
  readonly definitionKind: string;
  readonly label: string;
  readonly groupLabel?: string;
  readonly entryCount?: number;
}

export interface CodexEntryView {
  /** 与 definitionKind 共同构成 Def 身份。 */
  readonly definitionKind: string;
  /** 与 definitionKind 共同构成 Def 身份；集成层应传入完整 ID。 */
  readonly fullId: string;
  readonly modId: string;
  readonly label: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
  readonly statusLabel?: string;
  readonly badges?: readonly string[];
  /** 可选的预计算搜索投影，用于覆盖字段路径或其他只读摘要。 */
  readonly searchText?: string;
}

export interface RuntimeContentBrowserShellView {
  readonly loadedMods: readonly CodexModView[];
  readonly kinds: readonly CodexKindView[];
  readonly entries: readonly CodexEntryView[];
}

export interface CodexShellState {
  readonly query: string;
  readonly selectedModId: string | null;
  readonly selectedKind: string | null;
  readonly selectedEntryKey: string | null;
  readonly mobilePane: CodexPane;
  readonly kindFilterOpen: boolean;
  readonly backStack: readonly string[];
  readonly forwardStack: readonly string[];
}

export function codexEntryKey(entry: Pick<CodexEntryView, 'definitionKind' | 'fullId'>): string {
  return `${encodeURIComponent(entry.definitionKind)}:${encodeURIComponent(entry.fullId)}`;
}
