import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../../src/arona-clicker/content/default-datapack';

describe('内置 Story Choice 内容迁移', () => {
  const stories = defaultDatapack.stories;
  const choices = stories.flatMap(story => story.nodes.flatMap(node =>
    node.type === 'click' && node.interaction.kind === 'choice'
      ? [{ story, node, choice: node.interaction }]
      : [],
  ));

  test('每个内置选项用 marks 声明分支标记且每个标记都有消费者', () => {
    expect(choices).toHaveLength(9);
    for (const { choice } of choices) {
      const marksByOption = choice.options.map(option => option.marks ?? []);
      const allMarks = marksByOption.flat();

      expect('sharedActions' in choice).toBe(false);
      expect(choice.options.every(option => !('condition' in option) && !('result' in option))).toBe(true);
      expect(marksByOption.every(marks => marks.length > 0)).toBe(true);
      expect(new Set(allMarks).size).toBe(allMarks.length);

      for (const mark of allMarks) {
        const hasNodeConsumer = stories.some(story => story.nodes.some(node => node.requiresFlag === mark));
        const hasReturnConsumer = stories.some(story => story.nodes.some(node =>
          node.type === 'click'
          && node.interaction.kind === 'entryCard'
          && node.interaction.card.continuation?.returnFlags?.includes(mark),
        ));
        expect(hasNodeConsumer || hasReturnConsumer).toBe(true);
      }
    }
  });

  test('星野初次羁绊选项保留分支与回访标记', () => {
    const choice = choices.find(({ story, node }) => story.id === 'base:story:bond_hoshino_1' && node.id === 'p4-choice')?.choice;
    expect(choice?.options.map(option => option.marks)).toEqual([
      ['bond-hoshino-p4-option1', 'hoshino-remembers'],
      ['bond-hoshino-p4-option2', 'hoshino-new-memories'],
    ]);
  });

  test('七个原持久分支 flag 的两种值都由对应局部标记门控的 Operation 写入', () => {
    const expected = [
      ['base:story:abydos_welcome', 'abydos_choice', ['abydos-welcome-p5-option1', 'committee'], ['abydos-welcome-p5-option2', 'pool']],
      ['base:story:millennium_welcome', 'millennium_choice', ['millennium-welcome-p4-option1', 'yuuka'], ['millennium-welcome-p4-option2', 'game']],
      ['base:story:millennium_game_crisis_intro', 'game_crisis_route', ['millennium-game-crisis-p4-option1', 'debug'], ['millennium-game-crisis-p4-option2', 'bribe']],
      ['base:story:schale_welcome', 'welcome_choice', ['schale-welcome-p6-option1', 'office'], ['schale-welcome-p6-option2', 'production']],
      ['base:story:schale_theme_lite_test', 'theme_test_route', ['schale-theme-lite-p7-option1', 'insert'], ['schale-theme-lite-p7-option2', 'goto']],
      ['base:story:bond_hoshino_1', 'bond_hoshino_choice', ['bond-hoshino-p4-option1', 'committee'], ['bond-hoshino-p4-option2', 'forget']],
      ['base:story:bond_hoshino_evening', 'bond_evening_choice', ['bond-hoshino-evening-p3-option1', 'memory'], ['bond-hoshino-evening-p3-option2', 'new']],
    ] as const;

    for (const [storyId, flagId, ...routes] of expected) {
      const story = stories.find(item => item.id === storyId);
      for (const [route, value] of routes) {
        expect(story?.nodes.some(node => node.type === 'operation'
          && node.requiresFlag === route
          && node.action.kind === 'state'
          && node.action.effects.some(effect => effect.op === 'setFlag' && effect.flagId === flagId && effect.value === value))).toBe(true);
      }
    }
  });

  test('四个原选项转移改由各自标记控制的顶层 Transfer 执行', () => {
    const expected = [
      ['base:story:millennium_game_crisis_intro', 'p4-option1-transfer', 'millennium-game-crisis-p4-option1', 'goto', 'base:story:millennium_game_crisis_debug'],
      ['base:story:millennium_game_crisis_intro', 'p4-option2-transfer', 'millennium-game-crisis-p4-option2', 'goto', 'base:story:millennium_game_crisis_bribe'],
      ['base:story:schale_theme_lite_test', 'p7-option1-transfer', 'schale-theme-lite-p7-option1', 'insert', 'base:story:schale_theme_lite_insert'],
      ['base:story:schale_theme_lite_test', 'p7-option2-transfer', 'schale-theme-lite-p7-option2', 'goto', 'base:story:schale_theme_lite_finish'],
    ] as const;

    for (const [storyId, nodeId, guard, mode, target] of expected) {
      const story = stories.find(item => item.id === storyId);
      expect(story?.nodes.some(node => node.type === 'transfer'
        && node.id === nodeId
        && node.requiresFlag === guard
        && node.transfer.mode === mode
        && node.transfer.storyId === target)).toBe(true);
    }
  });
});
