import { describe, expect, test } from 'vitest';
import { interpretGameplayBQuickTestCommand } from '../../src/ui/development/gameplay-b-quick-test-console';

describe('Gameplay B local quick-test command', () => {
  test('interprets the Chinese sample command and de-duplicates aliases', () => {
    expect(interpretGameplayBQuickTestCommand('获得角色 星野，Serika 白子 星野')).toEqual({
      ok: true,
      variantIds: ['Hoshino', 'Serika', 'Shiroko'],
    });
  });

  test('accepts the explicit English command form', () => {
    expect(interpretGameplayBQuickTestCommand('grant characters: Hoshino Serika Shiroko')).toEqual({
      ok: true,
      variantIds: ['Hoshino', 'Serika', 'Shiroko'],
    });
  });

  test('rejects empty lists, unknown students, and non-allowlisted commands', () => {
    expect(interpretGameplayBQuickTestCommand('获得角色')).toMatchObject({ ok: false });
    expect(interpretGameplayBQuickTestCommand('获得角色 白老师')).toMatchObject({ ok: false });
    expect(interpretGameplayBQuickTestCommand('window.game.mutations.acquireCharacter()')).toMatchObject({ ok: false });
  });
});
