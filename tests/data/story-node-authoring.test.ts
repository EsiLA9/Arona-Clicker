import { describe, expect, it } from 'vitest';
import type { StoryContent, StoryNodeDocument } from '../../src/data-services/contracts/story-node';
import type { StoryAction, StoryEntryCard, StoryEntryRequest, StoryStateAction } from '../../src/data-services/contracts/story-node-actions';
import { validateStoryNodeStructure } from '../../src/data-services/validation/story-node-structure';
import { STORY_ACTION_PARAMETER_EXAMPLES, STORY_NODE_AUTHORING_EXAMPLES } from './story-node-authoring.fixtures';

describe('Story authoring primitive composition (declarations only)', () => {
  it.each(Object.entries(STORY_NODE_AUTHORING_EXAMPLES))('%s has explicit, coherent stages', (_name, document) => {
    expect(validateStoryNodeStructure(document)).toEqual({ ok: true, issues: [] });
  });

  it('distinguishes two input points from one choice and groups two lines explicitly', () => {
    const examples = STORY_NODE_AUTHORING_EXAMPLES;
    expect(examples.s01Sequential.nodes.map(node => node.stageId)).toEqual(['knock', 'enter']);
    expect(examples.s01Choice.nodes[0].interaction.options).toHaveLength(2);
    expect(examples.multiLineStage.nodes.map(node => node.stageId)).toEqual(['dialogue', 'dialogue', 'dialogue']);
    // A sidecar does not define order; changing record insertion order must not change nodes.
    const document: StoryNodeDocument = { ...examples.s01Sequential, stages: { enter: { advance: 'input' }, knock: { advance: 'input' } } };
    expect(validateStoryNodeStructure(document).ok).toBe(true);
    expect(document.nodes.map(node => node.id)).toEqual(['knock', 'enter']);
  });

  it('keeps foreign-owner requests, card invitation and travel notice as different data', () => {
    expect(STORY_NODE_AUTHORING_EXAMPLES.s06EntryRequests.nodes[0].action.request).toMatchObject({ entryType: 'passive', intent: 'system', owner: 'base:variant:arona' });
    expect(STORY_NODE_AUTHORING_EXAMPLES.s06EntryRequests.nodes[2].interaction.card.request).toMatchObject({ entryType: 'active', intent: 'card' });
    expect(STORY_NODE_AUTHORING_EXAMPLES.s07Travel.nodes[2].action.notice).toBe(true);
  });
  it('can place typed parameter examples into operation-only documents', () => {
    const document: StoryNodeDocument = { id: 'test:story:actions', name: '参数覆盖', stages: {},
      nodes: STORY_ACTION_PARAMETER_EXAMPLES.map((action, index) => ({ id: `action-${index}`, type: 'operation', action })),
    };
    expect(validateStoryNodeStructure(document).ok).toBe(true);
  });
});

// 由 npx tsc --noEmit 检查，不运行错误输入，也不将它们注册为正式内容。
function compileTimeContractRejections(): void {
  // @ts-expect-error 旁白没有已实现的图片语义。
  const narration: StoryContent = { kind: 'narration', text: '旁白', image: 'image.png' };
  // @ts-expect-error 卡片请求不能指向被动入口。
  const passiveCard: StoryEntryRequest = { entryId: 'x', entryType: 'passive', owner: null, intent: 'card' };
  // @ts-expect-error 普通启动请求不是卡片载荷。
  const wrongCard: StoryEntryCard = { request: { entryId: 'x', entryType: 'active', owner: null, intent: 'system' } };
  // @ts-expect-error 旅行提示属于travel，状态批次没有notice字段。
  const notice: StoryAction = { kind: 'state', effects: [], notice: true };
  // @ts-expect-error 不开放旧Effect的通用target/value外壳。
  const generic: StoryStateAction = { op: 'addResource', target: 'credit', value: 2 };
  // @ts-expect-error 未接执行的loot不是新Story动作。
  const loot: StoryStateAction = { op: 'loot' };
  // @ts-expect-error 实体主题必须指明实体槽，不能只写area scope。
  const missingThemeTarget: StoryAction = { kind: 'presentation', command: { command: 'theme', value: { scope: 'area' } } };
  // @ts-expect-error student scope不能引用area槽。
  const wrongThemeTarget: StoryAction = { kind: 'presentation', command: { command: 'theme', value: { scope: 'student', entityKey: 'area:office' } } };
  void [narration, passiveCard, wrongCard, notice, generic, loot, missingThemeTarget, wrongThemeTarget];
}
void compileTimeContractRejections;
