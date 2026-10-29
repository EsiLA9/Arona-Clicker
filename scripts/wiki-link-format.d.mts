export interface WikiIndex {
  projectRoot: string;
  vaultRoot: string;
  vaultPrefix: string;
  names: Map<string, string[]>;
  wikiFiles: Set<string>;
}

export function findVaultRoot(projectRoot: string): string;
export function markdownFiles(root: string, options?: { skipArchives?: boolean }): string[];
export function buildWikiIndex(projectRoot: string, vaultRoot?: string): WikiIndex;
export function projectWikiPath(name: string, index: WikiIndex): string | null;
export function mapProse(text: string, transform: (text: string) => string): string;
export function formatWikiLinks(text: string, index: WikiIndex): { text: string; changes: number; issues: string[] };
export function activeMarkdownFiles(projectRoot: string): string[];
