import { describe, expect, it } from 'vitest';
import type {
  StoryClickNode,
  StoryClickPress,
  StoryChoiceOption,
  StoryNode,
  StoryNodeDocument,
  StoryOperationNode,
  StoryTalkletNode,
  StoryTransferNode,
} from '../../src/data-services/contracts/story-node';
import { validateStoryNodeStructure } from '../../src/data-services/validation/story-node-structure';

const talk = (
  id: string,
  stageId: string,
  pacing?: StoryTalkletNode['pacing'],
  presentation?: StoryTalkletNode['presentation'],
): StoryTalkletNode => ({
  id, type: 'talklet', stageId, content: { kind: 'talk', text: id },
  ...(pacing ? { pacing } : {}), ...(presentation ? { presentation } : {}),
});

const button = (id: string, stageId: string, press?: StoryClickPress): StoryClickNode => ({
  id, type: 'click', stageId,
  interaction: { kind: 'button', text: id, ...(press ? { press } : {}) },
});

const choice = (id: string, stageId: string, options: readonly StoryChoiceOption[]): StoryClickNode => ({
  id, type: 'click', stageId, interaction: { kind: 'choice', options },
});

const operation = (id: string): StoryOperationNode => ({
  id, type: 'operation', action: { kind: 'overlay', command: { command: 'clearFlow' } },
});

const transfer = (id: string): StoryTransferNode => ({
  id, type: 'transfer', transfer: { mode: 'goto', storyId: 'base:story:target' },
});

const documentOf = (nodes: readonly StoryNode[], stages: StoryNodeDocument['stages']): StoryNodeDocument => ({
  id: 'base:story:structure-test', name: '结构校验样例', nodes, stages,
});

const expectIssue = (document: StoryNodeDocument, path: string, code: string) => {
  const result = validateStoryNodeStructure(document);
  expect(result.issues).toContainEqual(expect.objectContaining({ path, code }));
  return result;
};

describe('Story node structure', () => {
  it('accepts sequential input stages and reuses option IDs across separate choices', () => {
    const result = validateStoryNodeStructure(documentOf([
      talk('prompt', 'intro'),
      choice('first-choice', 'choose-first', [{ id: 'yes', text: '继续' }]),
      choice('second-choice', 'choose-second', [{ id: 'yes', text: '再确认一次' }]),
    ], {
      intro: { advance: 'auto' },
      'choose-first': { advance: 'input' },
      'choose-second': { advance: 'input' },
    }));
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it('requires own stage declarations and reports unused declarations', () => {
    const stages = Object.assign(
      Object.create({ inherited: { advance: 'auto' } }),
      { orphan: { advance: 'auto' } },
    ) as StoryNodeDocument['stages'];
    const document = documentOf([talk('line', 'inherited')], stages);
    const result = validateStoryNodeStructure(document);
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'nodes[0].stageId', code: 'missing-stage' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'stages.orphan', code: 'unused-stage' }));
  });

  it.each([
    ['Operation', operation('op')],
    ['Transfer', transfer('jump')],
  ] as const)('treats %s as a stage boundary', (_label, boundary) => {
    const result = validateStoryNodeStructure(documentOf([
      talk('before', 'same'), boundary, talk('after', 'same'),
    ], { same: { advance: 'auto' } }));
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'nodes[2].stageId', code: 'non-contiguous-stage' }));
  });

  it('checks auto and input stage membership and order', () => {
    const autoWithClick = expectIssue(documentOf([button('click', 'auto')], { auto: { advance: 'auto' } }),
      'nodes[0].stageId', 'stage-shape');
    expect(autoWithClick.issues).toContainEqual(expect.objectContaining({ path: 'stages.auto.advance', code: 'stage-shape' }));

    expectIssue(documentOf([talk('only-line', 'input')], { input: { advance: 'input' } }),
      'stages.input.advance', 'stage-shape');
    expectIssue(documentOf([talk('line', 'input'), button('confirm', 'input'), talk('too-late', 'input')],
      { input: { advance: 'input' } }), 'nodes[1].stageId', 'stage-shape');
    expectIssue(documentOf([button('first', 'input'), button('second', 'input')],
      { input: { advance: 'input' } }), 'nodes[1].stageId', 'stage-shape');
  });

  it('rejects invalid and duplicate node IDs, and only duplicate option IDs within one choice', () => {
    const ids = validateStoryNodeStructure(documentOf([
      talk('bad id', 'auto'), talk('bad id', 'auto'),
    ], { auto: { advance: 'auto' } }));
    expect(ids.issues).toContainEqual(expect.objectContaining({ path: 'nodes[0].id', code: 'invalid-id' }));
    expect(ids.issues).toContainEqual(expect.objectContaining({ path: 'nodes[1].id', code: 'duplicate-id' }));

    expectIssue(documentOf([
      choice('pick', 'input', [{ id: 'same', text: '甲' }, { id: 'same', text: '乙' }]),
    ], { input: { advance: 'input' } }), 'nodes[0].interaction.options[1].id', 'duplicate-id');
  });

  it('requires choices to have an option and validates click work without overflowing', () => {
    expectIssue(documentOf([choice('pick', 'input', [])], { input: { advance: 'input' } }),
      'nodes[0].interaction.options', 'interaction-shape');

    const invalidPresses: Array<{ press: StoryClickPress; path: string }> = [
      { press: { base: 0 }, path: 'nodes[0].interaction.press.base' },
      { press: { base: 1, rand: -1 }, path: 'nodes[0].interaction.press.rand' },
      { press: { base: Number.MAX_SAFE_INTEGER, rand: 2 }, path: 'nodes[0].interaction.press' },
    ];
    for (const { press, path } of invalidPresses) {
      expectIssue(documentOf([button('press', 'input', press)], { input: { advance: 'input' } }), path, 'range');
    }
    expect(validateStoryNodeStructure(documentOf([button('press', 'input', { base: 3, rand: 2 })],
      { input: { advance: 'input' } })).ok).toBe(true);
  });

  it('requires finite non-negative pacing values', () => {
    const result = validateStoryNodeStructure(documentOf([
      talk('line', 'auto', { typing: -1, thinking: Number.POSITIVE_INFINITY }),
    ], { auto: { advance: 'auto' } }));
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'nodes[0].pacing.typing', code: 'range' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'nodes[0].pacing.thinking', code: 'range' }));
    expect(validateStoryNodeStructure(documentOf([talk('line', 'auto', { typing: 0.5, thinking: 0 })],
      { auto: { advance: 'auto' } })).ok).toBe(true);
  });

  it('limits explicit pacing to non-right Talk and still checks its numeric range', () => {
    const narration: StoryTalkletNode = {
      id: 'narration', type: 'talklet', stageId: 'auto',
      content: { kind: 'narration', text: '旁白' }, pacing: { typing: -1 },
    };
    const right = talk('right', 'auto', { thinking: Number.POSITIVE_INFINITY }, { side: 'right' });
    const left = talk('left', 'auto', { typing: 0.5 }, { side: 'left' });
    const result = validateStoryNodeStructure(documentOf([narration, right, left], { auto: { advance: 'auto' } }));
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'nodes[0].pacing', code: 'pacing-scope' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'nodes[1].pacing', code: 'pacing-scope' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'nodes[0].pacing.typing', code: 'range' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'nodes[1].pacing.thinking', code: 'range' }));
    expect(result.issues.some(issue => issue.path === 'nodes[2].pacing')).toBe(false);
  });

  it('allows missing or empty pacing outside eligible Talk content', () => {
    const narration: StoryTalkletNode = {
      id: 'narration', type: 'talklet', stageId: 'auto', content: { kind: 'narration', text: '旁白' },
    };
    const right = talk('right', 'auto', undefined, { side: 'right' });
    const rightEmpty = talk('right-empty', 'auto', {}, { side: 'right' });
    expect(validateStoryNodeStructure(documentOf([narration, right, rightEmpty], { auto: { advance: 'auto' } })))
      .toEqual({ ok: true, issues: [] });
  });

  it('does not modify valid or invalid input documents', () => {
    const invalid = documentOf([
      talk('line', 'auto'), button('press', 'input', { base: 0 }),
    ], { auto: { advance: 'auto' }, input: { advance: 'input' } });
    const invalidBefore = structuredClone(invalid);
    expect(validateStoryNodeStructure(invalid).ok).toBe(false);
    expect(invalid).toEqual(invalidBefore);

    const valid = documentOf([
      talk('line', 'auto', { typing: 0.5 }, { side: 'left' }), button('confirm', 'input'),
    ], { auto: { advance: 'auto' }, input: { advance: 'input' } });
    const validBefore = structuredClone(valid);
    expect(validateStoryNodeStructure(valid).ok).toBe(true);
    expect(valid).toEqual(validBefore);
  });
});
