import type { StoryPresentationView, StoryOutputEntry } from '../../src/arona-clicker/contracts/runtime/story-presentation';
import type { GameReadModel } from '../../src/arona-clicker/contracts';
import type { PanelState } from '../../src/ui/components/shared/app-shell';

export const playbackPanel = (): PanelState => ({ chatEntries: [], chatTexts: [], studentChats: {}, studentChatTexts: {},
  conversationVariantId: null, selectedVariantId: null, storyNavPath: [], leftTab: 'area', centerTab: 'chat', rightTab: 'spot' });

export function output(sequence: number, text = `line-${sequence}`): StoryOutputEntry {
  return { id: `history:${sequence}`, sequence, timestamp: sequence, historyId: 'history', kind: 'talk', text };
}

export function presentation(overrides: Partial<StoryPresentationView> = {}): StoryPresentationView {
  return { owner: null, epoch: 0, revision: 0, entries: [], phase: 'continue', token: 'intent-1', runId: 'run-1', ...overrides };
}

export function playbackReader(read: (owner: string | null) => StoryPresentationView): Pick<GameReadModel, 'story'> {
  return { story: { getPlaybackView: (owner?: string | null) => read(owner ?? null) } } as Pick<GameReadModel, 'story'>;
}
