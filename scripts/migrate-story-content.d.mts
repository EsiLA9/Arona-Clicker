export type StoryMigrationEntryType = 'active' | 'passive';

export interface StoryMigrationOptions {
  readonly entryTypes?: Readonly<Record<string, StoryMigrationEntryType>>;
  readonly entryOwners?: Readonly<Record<string, string | null>>;
  readonly ownerForEntry?: (entryId: string) => string | null | undefined;
}

export interface StoryMigrationIssue {
  readonly fileName: string;
  readonly storyId: string;
  readonly code: string;
  readonly message: string;
  readonly line: number;
  readonly column: number;
}

export interface StoryMigrationResult {
  readonly text: string;
  readonly converted: number;
  readonly skipped: number;
  readonly issues: readonly StoryMigrationIssue[];
}

/** Convert static legacy Story source to literal StoryNode `nodes` and `stages` declarations. */
export function convertSourceText(
  sourceText: string,
  fileName?: string,
  options?: StoryMigrationOptions,
): StoryMigrationResult;
