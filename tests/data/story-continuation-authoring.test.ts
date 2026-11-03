import { describe, expect, it } from 'vitest';
import { projectStoryDefinition } from '../../src/data-services/authoring/story-definition-projection';
import type { StoryDef } from '../../src/data-services/contracts/story';

const story: StoryDef = {
  id: 'test:story:continuation', name: 'Continuation', startContext: { type: 'chara', characterId: 'Hoshino' }, stages: { s: { advance: 'input' } },
  nodes: [
    { id: 'child', type: 'click', stageId: 's', interaction: { kind: 'kizunaCard' } },
    { id: 'wait', type: 'click', stageId: 's', interaction: { kind: 'areaContinue', areaId: 'test:area:meeting' } },
    { id: 'area', type: 'moveToArea', areaId: 'test:area:meeting' },
    { id: 'chara', type: 'moveToCharaspace', characterId: 'Hoshino' },
  ],
};
describe('continuation author boundary', () => {
  it('round-trips new gates, source context and scene movement without hidden control fields', () => {
    const projected = projectStoryDefinition(story);
    expect(projected).toEqual({ ok: true, story });
    expect(projectStoryDefinition({ ...story, nodes: [{ ...story.nodes[0], interaction: { kind: 'kizunaCard', entryId: 'arbitrary' } }] }).ok).toBe(false);
  });
  it('validates Area references for gates and scene moves', () => {
    const projected = projectStoryDefinition(story, { areas: new Map(), characterVariants: new Map([['Hoshino', {}]]) });
    expect(projected.ok).toBe(false);
    if (!projected.ok) expect(projected.issues.map(x => x.path)).toEqual(expect.arrayContaining(['nodes[1].interaction.areaId', 'nodes[2].areaId']));
  });
});
