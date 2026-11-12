import { baseDatapack } from '../../../src/data/test-datapack';
import type { ActiveStoryEntry } from '../../../src/data-services/contracts/story-entry';
import type { StoryDef } from '../../../src/data-services/contracts/story';

const followUpTargetStory: StoryDef = {
  id: 'test:story:followup-target', name: 'FollowUp target', startContext: { type: 'area', areaId: 'base:area:schale_rooftop' },
  stages: { s: { advance: 'input' } }, nodes: [{ id: 'arrival', type: 'talklet', stageId: 's', content: { kind: 'narration', text: 'FollowUp target' } }],
};
const followUpTargetEntry: ActiveStoryEntry = {
  id: 'test:activestory:followup-target', storyId: followUpTargetStory.id, availableInits: ['base:init:schale_office'],
  triggerCondition: { type: 'AND', conditions: [] }, replayable: true, activation: { kind: 'active' as const } };

/** Explicit legacy author fixtures keep independent FollowUp / tail / ordinary-card coverage after base content migrates. */
export const legacyStoryDatapack = {
  ...baseDatapack,
  activeStories: [...baseDatapack.activeStories.filter(entry => entry.id !== 'base:activestory:hoshino_rooftop_meet').map(entry => entry.id === 'base:activestory:bond_hoshino_1' ? { ...entry, availableInits: [] } : entry), followUpTargetEntry],
  passiveStories: baseDatapack.passiveStories.map(entry => {
    if (entry.id === 'base:passivestory:hoshino_conv_2') return {
      ...entry,
      block: { type: 'AND' as const, conditions: [{ target: 'area' as const, key: 'base:area:schale_rooftop', comparator: '==' as const, value: 1 }] },
      followUps: [{ id: 'rooftop-meet', waitFor: { kind: 'next-enter-area' as const, areaId: 'base:area:schale_rooftop' }, outcome: { kind: 'start-story-entry' as const, storyEntryId: followUpTargetEntry.id } }],
    };
    if (entry.id === 'base:passivestory:affinity_hoshino_bond_tail') {
      const { kizuna: _k, ...rest } = entry;
      return { ...rest, availableInits: [], owner: entry.owner!, activation: {kind:'affection' as const,when:{kind:'after-story' as const,storyId:'base:story:bond_hoshino_1'}} };
    }
    if (entry.id === 'base:passivestory:hoshino_bond_invite') {
      const { kizuna: _k, ...rest } = entry;
      return rest;
    }
    return entry;
  }),
  stories: [...baseDatapack.stories.filter(story => story.id !== 'base:story:hoshino_rooftop_meet').map(story => {
    if (story.id === 'base:story:hoshino_rooftop_hint') return { ...story, nodes: story.nodes.filter(x => x.id !== 'rooftop-continue') };
    if (story.id === 'base:story:affinity_hoshino_bond_tail') return { ...story, nodes: [
      { id: 'p1-body', type: 'talklet' as const, stageId: 'p1', content: { kind: 'narration' as const, text: '——阿比多斯 · 堤防 · 归途——' } },
      { id: 'p2-body', type: 'talklet' as const, stageId: 'p2', content: { kind: 'talk' as const, text: '……剧情就到这里。剩下的，我们边走边说吧，队长。', speaker: '星野' } },
      { id: 'p3-body', type: 'talklet' as const, stageId: 'p3', content: { kind: 'narration' as const, text: '——羁绊剧情 · 午后的堤防 完——' } },
    ] };
    if (story.id === 'base:story:bond_hoshino_1') return { ...story, nodes: story.nodes.filter(x => !['departure', 'go-embankment', 'back-to-contact', 'contact-return'].includes(x.id)) };
    if (story.id === 'base:story:hoshino_bond_invite') return { ...story, nodes: story.nodes.filter(x => x.id !== 'evening-return').map(x => x.id === 'p3-entry'
      ? { ...x, type: 'click' as const, stageId: 'p3', interaction: { kind: 'entryCard' as const, card: { request: { entryId: 'base:activestory:bond_hoshino_evening', entryType: 'active' as const, owner: 'Hoshino', intent: 'card' as const } } } } : x) };
    return story;
  }), followUpTargetStory],
};
