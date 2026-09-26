import { describe, expect, test } from 'vitest';
import { FragmentParseError, mergeFragments, parseFragment } from '../../src/data-services/datapack/fragment-parser';

describe('Datapack fragment parser', () => {
  test('解析分片并合并列表与 extras', () => {
    const first = parseFragment('a.json', '{"name":"Demo","spots":[{"id":"a"}],"extras":{"theme":{"bg":"red"}}}');
    const second = parseFragment('b.json', '{"spots":[{"id":"b"}],"version":"1.0.0"}');
    const datapack = mergeFragments([first, second]);
    expect(datapack.name).toBe('Demo');
    expect(datapack.version).toBe('1.0.0');
    expect(datapack.spots.map(spot => spot.id)).toEqual(['a', 'b']);
    expect(datapack.extras).toEqual({ theme: { bg: 'red' } });
  });

  test('解析并保留 Datapack 单例字段', () => {
    const fragment = parseFragment('singletons.json', JSON.stringify({
      gearConfig: { expItems: [], upgradeCosts: [] },
      characterPersistConfig: { globalFields: [], perInitFields: [] },
      affectionConfig: { steps: [] },
    }));
    const datapack = mergeFragments([fragment]);
    expect(datapack.gearConfig).toEqual({ expItems: [], upgradeCosts: [] });
    expect(datapack.characterPersistConfig).toEqual({ globalFields: [], perInitFields: [] });
    expect(datapack.affectionConfig).toEqual({ steps: [] });
  });

  test('解析并合并 Milestone 定义列表', () => {
    const first = parseFragment('milestones-a.json', JSON.stringify({
      milestones: [{
        id: 'base:milestone:credit_1000',
        condition: { target: 'resource', key: 'credit', comparator: '>=', value: 1000 },
      }],
    }));
    const second = parseFragment('milestones-b.json', JSON.stringify({
      milestones: [{
        id: 'base:milestone:story_1',
        condition: { type: 'AND', conditions: [{ target: 'alwaysTrue', key: '', comparator: '==', value: 1 }] },
      }],
    }));

    const datapack = mergeFragments([first, second]);

    expect(datapack.milestones).toEqual([
      { id: 'base:milestone:credit_1000', condition: { target: 'resource', key: 'credit', comparator: '>=', value: 1000 } },
      { id: 'base:milestone:story_1', condition: { type: 'AND', conditions: [{ target: 'alwaysTrue', key: '', comparator: '==', value: 1 }] } },
    ]);
  });

  test('解析并合并 Listener 与 Achievement 声明列表', () => {
    const first = parseFragment('achievement-listener.json', JSON.stringify({
      milestones: [{ id: 'demo:milestone:first_visit', condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } }],
      milestoneListeners: [{
        id: 'demo:milestone-listener:first_visit', milestoneId: 'demo:milestone:first_visit',
        areaId: 'demo:area:roof', then: [{ op: 'addResource', target: 'credit', value: 10 }],
      }],
    }));
    const second = parseFragment('achievement.json', JSON.stringify({
      achievements: [{
        id: 'demo:achievement:first_visit', listenerId: 'demo:milestone-listener:first_visit',
        title: '初次到访', clue: '前往天台', rewardDescription: '获得 10 信用点',
      }],
    }));

    const datapack = mergeFragments([first, second]);

    expect(datapack.milestones).toEqual(first.lists.milestones);
    expect(datapack.milestoneListeners).toEqual(first.lists.milestoneListeners);
    expect(datapack.achievements).toEqual(second.lists.achievements);
  });

  test('错误包含分片路径', () => {
    expect(() => parseFragment('broken.json', '{')).toThrow(FragmentParseError);
    expect(() => parseFragment('broken.json', '{')).toThrow('[broken.json]');
  });
});
