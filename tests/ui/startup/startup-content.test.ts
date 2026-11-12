import { describe, expect, it } from 'vitest';
import type { Datapack } from '../../../src/data-services/contracts/datapack';
import { describeStartupContent } from '../../../src/ui/startup/startup-content';

describe('启动内容摘要', () => {
  it('按传入顺序列出包身份，累加实际声明数并跳过缺省内容', () => {
    const pack = (modName: string): Datapack => ({
      modName, name: `${modName} 内容`, version: '1.2', inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [],
      funcletDefs: [], characters: [],
    });
    const base = pack('base');
    base.stories = [{ startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'base:story:one', name: '正文', nodes: [], stages: {} }];
    const extra = pack('extra');
    extra.stories = [...base.stories];
    const summary = describeStartupContent([base, extra]);
    expect(summary).toBe('启用 2 个数据包（按应用顺序）：\nbase 内容 · base @ 1.2\nextra 内容 · extra @ 1.2\n本批内容声明：剧情 2');
    expect(describeStartupContent([])).toContain('无上述内容');
  });
});
