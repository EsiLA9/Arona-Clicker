import { describe, expect, it } from 'vitest';
import { story, StoryBuilder } from '../../../src/arona-clicker/content/def-factory';
import { validateStoryNodeStructure } from '../../../src/data-services/validation/story-node-structure';
import type { StoryNode } from '../../../src/data-services/contracts/story-node';

describe('production StoryBuilder uses explicit node authoring', () => {
  it('builds a multi-body choice stage followed by separate work and confirmation', () => {
    const builder = story('story:test', 'Test');
    expect(builder).toBeInstanceOf(StoryBuilder);
    const document = builder.stages({ choose: { advance: 'input' }, work: { advance: 'input' }, confirm: { advance: 'input' } }).nodes([
      { id: 'first', type: 'talklet', stageId: 'choose', content: { kind: 'talk', text: '第一句' } },
      { id: 'second', type: 'talklet', stageId: 'choose', content: { kind: 'talk', text: '第二句' } },
      { id: 'choose', type: 'click', stageId: 'choose', interaction: { kind: 'choice', options: [{ id: 'yes', text: '继续' }] } },
      { id: 'work', type: 'click', stageId: 'work', interaction: { kind: 'button', text: '工作', press: { base: 3 } } },
      { id: 'confirm', type: 'click', stageId: 'confirm', interaction: { kind: 'button', text: '确认', reply: { kind: 'talk', text: '完成了。' } } },
    ]).build();
    expect(validateStoryNodeStructure(document).ok).toBe(true);
    expect(document).not.toHaveProperty('talklets');
  });
  it('does not retain a mutable caller node array and preserves author metadata', () => {
    const nodes: StoryNode[] = [{ id: 'line', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: '独白' } }];
    const document = story('story:test', 'Test').nodes(nodes).stages({ body: { advance: 'auto' } })
      .extra({ t: 'dict', v: { tier: { t: 'int', v: 1 } } }).build();
    nodes.length = 0;
    expect(document.nodes).toHaveLength(1);
    expect(document.extra).toEqual({ t: 'dict', v: { tier: { t: 'int', v: 1 } } });
    expect(validateStoryNodeStructure(document).ok).toBe(true);
  });
});
