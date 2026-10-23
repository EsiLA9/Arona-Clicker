/** 新节点执行快照。没有旧页式游标的兼容解释。 */
export interface StoryNodeSnapshot {
  readonly format: 'story-nodes';
  readonly run: {
    readonly source: { readonly entryId: string; readonly rootStoryId: string; readonly owner: string | null; readonly runId?: string; readonly historyId?: string };
    readonly storyId: string;
    readonly nodeId: string;
    readonly waitSequence: number;
    readonly terminalStoryId: string;
    readonly transfers: number;
    readonly visited: readonly string[];
    /** nextNodeId为空表示返回到该文档末尾。 */
    readonly stack: readonly { readonly storyId: string; readonly nextNodeId: string | null }[];
    readonly pending: { readonly kind: 'delivery' | 'input'; readonly press?: { readonly total: number; readonly done: number } };
  } | null;
}
