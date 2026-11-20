import { describe, expect, it } from 'vitest';
import { projectStoryDefinition } from '../../../src/data-services/authoring/story-definition-projection';

const baseStory = (overrides: Record<string, unknown> = {}) => ({ startContext: { type: 'area', areaId: 'base:area:schale_main' },
  id: 'base:story:projection-test', name: '投影测试',
  stages: { body: { advance: 'auto' } },
  nodes: [{ id: 'line', type: 'talklet', stageId: 'body', content: { kind: 'talk', text: '正文', speaker: '', image: 'images/a.png' }, presentation: { avatarMode: 'hide', avatar: 'face-a' }, pacing: { typing: 0 } }],
  ...overrides,
});

describe('Story definition projection', () => {
  it('preserves optional authorship grouping and validates it as an Init reference', () => {
    const initId = 'base:init:schale';
    const grouped = baseStory({ initId });
    expect(projectStoryDefinition(grouped, { inits: new Map([[initId, {}]]) })).toEqual({ ok: true, story: grouped });
    expect(projectStoryDefinition(baseStory())).toEqual({ ok: true, story: baseStory() });
    for (const result of [
      projectStoryDefinition(grouped, { inits: new Map() }),
      projectStoryDefinition(baseStory({ initId: 'base:area:schale' })),
    ]) {
      expect(result).toMatchObject({ ok: false, issues: [{ path: 'initId' }] });
    }
  });
  it('rebuilds the document without losing legal values, flags, dynamic dictionaries, or deep trees', () => {
    const expression: unknown = { type: 'const', value: 1 };
    const nested: unknown = Array.from({ length: 40 }, () => 0).reduce<unknown>(child => ({ type: 'floor', expr: child }), expression);
    const source = baseStory({
      extra: { t: 'dict', v: { 'custom-key': { t: 'bool', v: false }, zero: { t: 'int', v: 0 }, empty: { t: 'str', v: '' } } },
      nodes: [
        { id: 'op', type: 'operation', requiresFlag: 'branch-ready', action: { kind: 'localFlag', op: 'set', name: 'seen', value: { nested: [null, false, 0, ''] } } },
        { id: 'theme', type: 'operation', action: { kind: 'presentation', command: { command: 'theme', value: { scope: 'ephemeral', tokens: { '--custom-token': '#abc' }, background: [{ kind: 'image', value: 'pic:scene', enabled: false }] } } } },
        { id: 'click', type: 'click', stageId: 'input', interaction: { kind: 'choice', options: [{ id: 'yes', text: '', showWhen: { type: 'AND', conditions: [{ type: 'OR', conditions: [] }, { target: 'alwaysTrue', key: '', comparator: '==', value: 0 }] }, requiresFlag: 'ready', marks: ['answered'] }] } },
      ],
      stages: { input: { advance: 'input' } },
    });

    const projected = projectStoryDefinition(source);
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.story).toEqual(source);
    expect(projected.story).not.toBe(source);
    expect(projected.story.nodes).not.toBe(source.nodes);
  });

  it.each([
    ['unknown top-level field', baseStory({ uiState: { open: true } }), '$.uiState'],
    ['mixed content branch', baseStory({ nodes: [{ id: 'line', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: '旁白', speaker: 'leak' } }] }), 'nodes[0].content'],
    ['mixed interaction branch', baseStory({ stages: { body: { advance: 'input' } }, nodes: [{ id: 'click', type: 'click', stageId: 'body', interaction: { kind: 'button', text: '下一步', options: [] } }] }), 'nodes[0].interaction.options'],
    ['unknown action field', baseStory({ nodes: [{ id: 'op', type: 'operation', action: { kind: 'travel', areaId: 'base:area:a', request: {} } }] }), 'nodes[0].action.request'],
    ['unknown overlay command field', baseStory({ nodes: [{ id: 'op', type: 'operation', action: { kind: 'overlay', command: { command: 'clearFlow', id: 'stale' } } }] }), 'nodes[0].action.command.id'],
    ['non-finite value', baseStory({ nodes: [{ id: 'op', type: 'operation', action: { kind: 'state', effects: [{ op: 'setResource', resourceId: 'credits', amount: Number.NaN }] } }] }), 'nodes[0].action.effects[0].amount'],
    ['leaf instead of a ConditionGroup', baseStory({ stages: { input: { advance: 'input' } }, nodes: [{ id: 'pick', type: 'click', stageId: 'input', interaction: { kind: 'choice', options: [{ id: 'yes', text: '是', showWhen: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } }] } }] }), 'nodes[0].interaction.options[0].showWhen'],
    ['legacy shared actions', baseStory({ stages: { input: { advance: 'input' } }, nodes: [{ id: 'pick', type: 'click', stageId: 'input', interaction: { kind: 'choice', sharedActions: [], options: [{ id: 'yes', text: '是' }] } }] }), 'nodes[0].interaction.sharedActions'],
    ['legacy option condition', baseStory({ stages: { input: { advance: 'input' } }, nodes: [{ id: 'pick', type: 'click', stageId: 'input', interaction: { kind: 'choice', options: [{ id: 'yes', text: '是', condition: { type: 'AND', conditions: [] } }] } }] }), 'nodes[0].interaction.options[0].condition'],
    ['legacy option result', baseStory({ stages: { input: { advance: 'input' } }, nodes: [{ id: 'pick', type: 'click', stageId: 'input', interaction: { kind: 'choice', options: [{ id: 'yes', text: '是', result: { actions: [] } }] } }] }), 'nodes[0].interaction.options[0].result'],
    ['non-array Choice marks', baseStory({ stages: { input: { advance: 'input' } }, nodes: [{ id: 'pick', type: 'click', stageId: 'input', interaction: { kind: 'choice', options: [{ id: 'yes', text: '是', marks: 'route' }] } }] }), 'nodes[0].interaction.options[0].marks'],
  ])('rejects %s with a precise path', (_label, source, path) => {
    const result = projectStoryDefinition(source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(issue => issue.path === path)).toBe(true);
  });

  it('drops completely empty state-action placeholders but still rejects incomplete or unknown actions', () => {
    const validEffect = { op: 'addResource', resourceId: 'credits', amount: 10 };
    const source = baseStory({ stages: {}, nodes: [{ id: 'op', type: 'operation', action: { kind: 'state', effects: [{}, validEffect, {}] } }] });
    const empty = projectStoryDefinition(source);
    expect(empty).toEqual({ ok: true, story: baseStory({ stages: {}, nodes: [{ id: 'op', type: 'operation', action: { kind: 'state', effects: [validEffect] } }] }) });
    expect((source as unknown as { nodes: Array<{ action: { effects: unknown[] } }> }).nodes[0].action.effects).toHaveLength(3);

    const incomplete = projectStoryDefinition(baseStory({ nodes: [{ id: 'op', type: 'operation', action: { kind: 'state', effects: [{ amount: 10 }] } }] }));
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) expect(incomplete.issues).toContainEqual({ path: 'nodes[0].action.effects[0].op', message: '请选择状态动作' });

    const unknown = projectStoryDefinition(baseStory({ nodes: [{ id: 'op', type: 'operation', action: { kind: 'state', effects: [{ op: 'notAStoryAction' }] } }] }));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.issues).toContainEqual({ path: 'nodes[0].action.effects[0].op', message: '未知 Story 状态动作：notAStoryAction' });
  });

  it('drops empty Operation and Transfer nodes plus empty optional action defaults', () => {
    const effect = { op: 'addResource', resourceId: 'credits', amount: 10 };
    const source = baseStory({ stages: { input: { advance: 'input' } }, nodes: [
      { id: 'blank-operation', type: 'operation' },
      { id: 'empty-state-operation', type: 'operation', action: { kind: 'state', effects: [{}] } },
      { id: 'blank-transfer', type: 'transfer', transfer: {} },
      { id: 'op', type: 'operation', action: { kind: 'state', effects: [effect] } },
      { id: 'click', type: 'click', stageId: 'input', interaction: { kind: 'button', text: '继续', press: {} } },
  { id: "click-effect-1", type: 'operation', action: {} },
  { id: "click-transfer", type: 'transfer', transfer: {} },
    ] });

    const projected = projectStoryDefinition(source);
    expect(projected).toEqual({ ok: true, story: baseStory({ stages: { input: { advance: 'input' } }, nodes: [
      { id: 'op', type: 'operation', action: { kind: 'state', effects: [effect] } },
      { id: 'click', type: 'click', stageId: 'input', interaction: { kind: 'button', text: '继续' } },
    ] }) });
    expect((source as unknown as { nodes: unknown[] }).nodes).toHaveLength(7);
  });

  it('keeps blank execution nodes with authored guards invalid instead of discarding their data', () => {
    const operation = projectStoryDefinition(baseStory({ stages: {}, nodes: [{ id: 'guarded', type: 'operation', requiresFlag: 'ready' }] }));
    expect(operation.ok).toBe(false);
    if (!operation.ok) expect(operation.issues.some(issue => issue.path === 'nodes[0].action')).toBe(true);

    const transfer = projectStoryDefinition(baseStory({ stages: {}, nodes: [{ id: 'partial', type: 'transfer', transfer: { mode: 'goto' } }] }));
    expect(transfer.ok).toBe(false);
    if (!transfer.ok) expect(transfer.issues.some(issue => issue.path === 'nodes[0].transfer.storyId')).toBe(true);
  });

  it('validates directory references only when a catalog is supplied', () => {
    const source = baseStory({ stages: {}, nodes: [{ id: 'jump', type: 'transfer', transfer: { mode: 'goto', storyId: 'base:story:missing' } }] });
    expect(projectStoryDefinition(source).ok).toBe(true);
    const result = projectStoryDefinition(source, { stories: new Map() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: 'nodes[0].transfer.storyId', message: '引用不存在：base:story:missing' });
  });

  it('checks static references inside expression and condition trees against supplied catalogs', () => {
    const source = baseStory({
      stages: { input: { advance: 'input' } },
      nodes: [
        { id: 'op', type: 'operation', action: { kind: 'state', effects: [{ op: 'setResource', resourceId: 'credits', amount: { type: 'value', value: { type: 'value', source: 'spotLevel', params: { spot: 'base:spot:missing' } } } }] } },
        { id: 'pick', type: 'click', stageId: 'input', interaction: { kind: 'choice', options: [{ id: 'yes', text: '是', showWhen: { type: 'AND', conditions: [{ target: 'hasReadStory', key: 'base:story:missing', comparator: '==', value: 0 }] } }] } },
      ],
    });
    const result = projectStoryDefinition(source, { resources: new Map([['credits', {}]]), spots: new Map(), stories: new Map() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(issue => issue.path.endsWith('.params.spot'))).toBe(true);
      expect(result.issues.some(issue => issue.path.endsWith('.showWhen.conditions[0].key'))).toBe(true);
    }
  });

  it('projects map grants and allows Story information grants only for existing explicit rules', () => {
    const map = {
      id: 'guide',
      reveal: { existence: { mode: 'explicit' }, name: { mode: 'condition', condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } } },
      nodes: [{ id: 'hidden', reveal: { utility: { mode: 'explicit' } } }],
    };
    const refs = {
      areas: new Map([['base:area:schale_main', {}], ['area:guide', { reveal: { name: { mode: 'explicit' } } }]]),
      areaMaps: new Map([['map:guide', map]]),
    };
    const actions = baseStory({ stages: {}, nodes: [{ id: 'grant', type: 'operation', action: { kind: 'state', effects: [
      { op: 'acquireAreaMap', mapId: 'map:guide' },
      { op: 'revealInformation', target: { entityKind: 'area', entityId: 'area:guide', target: 'name' } },
      { op: 'revealInformation', target: { entityKind: 'areaMapNode', mapId: 'map:guide', nodeId: 'hidden', target: 'utility' } },
    ] } }] });
    expect(projectStoryDefinition(actions, refs).ok).toBe(true);

    const publicTarget = baseStory({ stages: {}, nodes: [{ id: 'grant', type: 'operation', action: { kind: 'state', effects: [
      { op: 'revealInformation', target: { entityKind: 'areaMap', entityId: 'map:guide', target: 'name' } },
    ] } }] });
    const invalid = projectStoryDefinition(publicTarget, refs);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues.some(issue => issue.message.includes('explicit'))).toBe(true);
  });

  it('accepts the active/card request variant outside the entryCard interaction', () => {
    const source = baseStory({ stages: {}, nodes: [{ id: 'request', type: 'operation', action: {
      kind: 'entryRequest', request: { entryId: 'base:activestory:invite', entryType: 'active', owner: null, intent: 'card' },
    } }] });
    expect(projectStoryDefinition(source)).toEqual({ ok: true, story: source });
  });

  it('returns an issue for cyclic or over-depth Extra values without throwing', () => {
    const cyclic: { t: string; v: Record<string, unknown> } = { t: 'dict', v: {} };
    cyclic.v.self = cyclic;
    const cycleResult = projectStoryDefinition(baseStory({ extra: cyclic }));
    expect(cycleResult.ok).toBe(false);
    if (!cycleResult.ok) expect(cycleResult.issues.some(issue => /循环引用/.test(issue.message))).toBe(true);

    let deep: unknown = { t: 'int', v: 1 };
    for (let i = 0; i < 35; i += 1) deep = { t: 'list', v: [deep] };
    const depthResult = projectStoryDefinition(baseStory({ extra: { t: 'dict', v: { deep } } }));
    expect(depthResult.ok).toBe(false);
    if (!depthResult.ok) expect(depthResult.issues.some(issue => /嵌套超过上限/.test(issue.message))).toBe(true);
  });

  it('does not silently drop symbol or non-enumerable dictionary keys', () => {
    const symbolTokens = { custom: '#fff', [Symbol('hidden')]: '#000' };
    const hiddenToken = { custom: '#fff' };
    Object.defineProperty(hiddenToken, 'hidden', { value: '#000', enumerable: false });
    for (const tokens of [symbolTokens, hiddenToken]) {
      const source = baseStory({ stages: {}, nodes: [{ id: 'theme', type: 'operation', action: { kind: 'presentation', command: { command: 'theme', value: { tokens } } } }] });
      expect(projectStoryDefinition(source).ok).toBe(false);
    }
  });
});
