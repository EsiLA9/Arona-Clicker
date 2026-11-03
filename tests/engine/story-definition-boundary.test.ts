import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { baseDatapack } from '../../src/data/test-datapack';

describe('Story definition Registry boundary', () => {
  let game: GameInstance;
  beforeEach(() => { game = new GameInstance(); game.init([baseDatapack]); });
  afterEach(() => game.stop());

  it('round-trips every registered Story without dropping any current contract field', () => {
    const stories = [...game.registry.stories.values()].map(story => structuredClone(story));
    expect(stories).toHaveLength(baseDatapack.stories.length);
    for (const story of stories) {
      expect(game.saveStoryDefinition(story), story.id).toMatchObject({ ok: true, operation: 'replace' });
      expect(game.registry.stories.get(story.id), story.id).toEqual(story);
    }
  });

  it('rejects injected editor metadata, unknown nested keys, and mixed branches atomically', () => {
    const original = structuredClone([...game.registry.stories.values()][0]);
    const before = game.registry.stories.get(original.id);
    const size = game.registry.stories.size;
    const candidates = [
      { ...original, editorState: { activeBranch: 'talklet' } },
      { ...original, nodes: [{ id: 'op', type: 'operation', action: { kind: 'travel', areaId: 'base:area:schale_office', notice: false, request: { entryId: 'fake' } } }] },
      { ...original, nodes: [{ id: 'op', type: 'operation', action: { kind: 'overlay', command: { command: 'clearFlow', x: 0 } } }] },
      { ...original, nodes: [{ id: 'jump', type: 'transfer', transfer: { mode: 'goto', storyId: 'base:story:missing' } }] },
    ];
    for (const candidate of candidates) {
      expect(game.saveStoryDefinition(candidate as unknown as StoryDef).ok).toBe(false);
      expect(game.registry.stories.get(original.id)).toBe(before);
      expect(game.registry.stories.size).toBe(size);
    }
  });

  it('keeps requiresFlag and localFlag in the strict accepted document', () => {
    const candidate: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' },
      id: 'local:story:flag-boundary', name: '标记边界', stages: {},
      nodes: [{ id: 'mark', type: 'operation', requiresFlag: 'can-run', action: { kind: 'localFlag', op: 'set', name: 'seen', value: false } }],
    };
    expect(game.saveStoryDefinition(candidate)).toMatchObject({ ok: true, storyId: candidate.id, operation: 'create' });
    expect(game.registry.stories.get(candidate.id)).toEqual(candidate);
  });
});
