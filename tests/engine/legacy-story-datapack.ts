import { baseDatapack } from '../../src/data/test-datapack';

/** Explicit legacy author fixtures keep independent FollowUp / tail / ordinary-card coverage after base content migrates. */
export const legacyStoryDatapack = {
  ...baseDatapack,
  passiveStories: baseDatapack.passiveStories.map(entry => {
    if (entry.id === 'base:passivestory:hoshino_conv_2') return {
      ...entry,
      block: { type: 'AND' as const, conditions: [{ target: 'area' as const, key: 'base:area:schale_rooftop', comparator: '==' as const, value: 1 }] },
      followUps: [{ id: 'rooftop-meet', waitFor: { kind: 'next-enter-area' as const, areaId: 'base:area:schale_rooftop' }, outcome: { kind: 'start-story-entry' as const, storyEntryId: 'base:activestory:hoshino_rooftop_meet' } }],
    };
    if (entry.id === 'base:passivestory:affinity_hoshino_bond_tail') {
      const { kizuna: _k, affectionRequired: _a, ...rest } = entry;
      return { ...rest, pushAfterStory: 'base:story:bond_hoshino_1' };
    }
    if (entry.id === 'base:passivestory:hoshino_bond_invite') {
      const { kizuna: _k, ...rest } = entry;
      return rest;
    }
    return entry;
  }),
  stories: baseDatapack.stories.map(story => {
    if (story.id === 'base:story:hoshino_rooftop_hint') return { ...story, nodes: story.nodes.filter(x => !['rooftop-continue', 'rooftop-scene'].includes(x.id)) };
    if (story.id === 'base:story:affinity_hoshino_bond_tail') return { ...story, nodes: story.nodes.filter(x => !['bond-invitation', 'bond-card'].includes(x.id)) };
    if (story.id === 'base:story:hoshino_bond_invite') return { ...story, nodes: story.nodes.filter(x => x.id !== 'evening-return').map(x => x.id === 'p3-entry'
      ? { ...x, type: 'click' as const, stageId: 'p3', interaction: { kind: 'entryCard' as const, card: { request: { entryId: 'base:activestory:bond_hoshino_evening', entryType: 'active' as const, owner: 'Hoshino', intent: 'card' as const } } } } : x) };
    return story;
  }),
};
