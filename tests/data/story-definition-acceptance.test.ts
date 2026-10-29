import { describe, expect, it } from 'vitest';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { StoryAction } from '../../src/data-services/contracts/story-node-actions';
import type { ConditionGroup } from '../../src/engine/types/expression';
import { projectStoryDefinition } from '../../src/data-services/authoring/story-definition-projection';
import { STORY_NODE_AUTHORING_EXAMPLES } from './story-node-authoring.fixtures';

const operation = (action: StoryAction): StoryDef => ({ id: 'test:story:acceptance', name: '验收', stages: {}, nodes: [{ id: 'op', type: 'operation', action }] });
const withClick = (interaction: unknown): unknown => ({ id: 'test:story:acceptance', name: '验收', stages: { input: { advance: 'input' } }, nodes: [{ id: 'click', type: 'click', stageId: 'input', interaction }] });

describe('0336 independent data acceptance', () => {
  it('round-trips the complete declared StoryNode example set through detached explicit construction', () => {
    for (const story of Object.values(STORY_NODE_AUTHORING_EXAMPLES)) {
      const before = structuredClone(story);
      const result = projectStoryDefinition(story);
      expect(result, story.id).toMatchObject({ ok: true });
      if (!result.ok) continue;
      expect(result.story).toEqual(story);
      expect(result.story).not.toBe(story);
      expect(result.story.nodes).not.toBe(story.nodes);
      expect(story).toEqual(before);
      expect(projectStoryDefinition(result.story)).toEqual(result);
    }
  });

  it.each([
    withClick({ kind: 'button', text: '继续', options: [] }),
    withClick({ kind: 'choice', options: [{ id: 'yes', text: '是', press: { base: 1 } }] }),
    operation({ kind: 'overlay', command: { command: 'clearFlow', id: 'stale' } } as unknown as StoryAction),
    operation({ kind: 'presentation', command: { command: 'clearEntityPresentation', target: 'area:test:area:one', owner: 'owner', optionId: 'stale' } } as unknown as StoryAction),
    operation({ kind: 'presentation', command: { command: 'theme', value: { scope: 'ephemeral', entityKey: 'area:test:area:one' } } } as unknown as StoryAction),
    operation({ kind: 'travel', areaId: 'test:area:one', editorState: { dormant: true } } as unknown as StoryAction),
    { ...operation({ kind: 'localFlag', op: 'set', name: 'ready', value: false }), editorState: {} },
  ])('rejects mixed branches and editor state rather than silently deleting them: %#', input => {
    const before = structuredClone(input);
    const result = projectStoryDefinition(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    expect(input).toEqual(before);
  });

  it('preserves legal empty/false/zero values and dynamic dictionary keys', () => {
    const story = operation({ kind: 'presentation', command: { command: 'theme', value: {
      colorGroupId: 'test:colorgroup:base', palette: ['#000000'], tokens: { editorState: 'var(--custom-token)', customToken: '' },
      nodes: { primary: '#fff' }, background: [{ kind: 'solid', value: '#000', opacity: 0, enabled: false }],
    } } });
    const input = { ...story, extra: { t: 'dict' as const, v: { editorState: { t: 'bool' as const, v: false }, empty: { t: 'str' as const, v: '' } } } };
    expect(projectStoryDefinition(input)).toEqual({ ok: true, story: input });
    expect(projectStoryDefinition(operation({ kind: 'travel', areaId: 'test:area:one', notice: false }))).toMatchObject({ ok: true, story: { nodes: [{ action: { notice: false } }] } });
    expect(projectStoryDefinition(withClick({ kind: 'entryCard', card: { request: { entryId: 'test:activestory:one', entryType: 'active', intent: 'card', owner: null }, title: '', buttonText: '' } }))).toMatchObject({ ok: true });
  });

  it('accepts valid source condition trees beyond UI limits without truncation', () => {
    let condition: ConditionGroup = { type: 'OR', conditions: [] };
    for (let depth = 0; depth < 8; depth++) condition = { type: 'AND', conditions: [condition] };
    const input = withClick({ kind: 'choice', options: [{ id: 'yes', text: '是', condition }] });
    expect(projectStoryDefinition(input)).toEqual({ ok: true, story: input });
  });

  it.each([
    { kind: 'state', effects: [{ op: 'addItem', itemId: 'test:item:one', amount: { type: 'const', value: NaN } }] },
    { kind: 'state', effects: [{ op: 'setExtra', path: 'test.counter', value: { t: 'int', v: 1.5 } }] },
    { kind: 'overlay', command: { command: 'show', id: 'hint', x: 1.1, content: { kind: 'text', text: '正文' } } },
    { kind: 'overlay', command: { command: 'show', id: 'hint', content: { kind: 'text', text: '正文', style: { font: 'invalid' } } } },
  ])('recursively rejects malformed active complex values: %#', action => {
    expect(projectStoryDefinition(operation(action as StoryAction)).ok).toBe(false);
  });
});
