import { describe, expect, test } from 'vitest';
import { getForegroundInteractionStatus } from '../../src/ui/workspace/foreground-interaction';
import type { GameReadModel } from '../../src/arona-clicker/contracts';
import type { PanelState } from '../../src/ui/components/shared/app-shell';

const state = { conversationVariantId: 'student', storyGate: null };
function game(options: { interaction?: string | null; movement?: boolean; choices?: boolean } = {}) {
  return { story: {
    isBlockingInteraction: (owner: string | null) => options.interaction !== undefined && owner === options.interaction,
    isBlockingMovement: () => !!options.movement,
    getCurrentStoryView: () => options.choices ? { page: { choices: [{}] } } : null,
  } } as unknown as Pick<GameReadModel, 'story'>;
}
describe('shared foreground admission', () => {
  test('safe passive browsing allows leaveArea false, but travel is rejected', () => {
    expect(getForegroundInteractionStatus(game({ movement: true }), state, 'openAreaMap').allowed).toBe(true);
    expect(getForegroundInteractionStatus(game({ movement: true }), state, 'attemptAreaTravel').allowed).toBe(false);
  });
  test.each([null, 'student'])('checks protected global/current owner %s', owner => {
    expect(getForegroundInteractionStatus(game({ interaction: owner }), state, 'openAreaMap').allowed).toBe(false);
    expect(getForegroundInteractionStatus(game({ interaction: owner }), state, 'openAreaOverview').allowed).toBe(false);
  });
  test('pending choices, Story confirmation, payment confirmation and submission block', () => {
    expect(getForegroundInteractionStatus(game({ choices: true }), state, 'openAreaMap')).toMatchObject({ allowed: false, reason: 'ChoicePending' });
    expect(getForegroundInteractionStatus(game(), { ...state, storyGate: {} as NonNullable<PanelState['storyGate']> }, 'openAreaMap').allowed).toBe(false);
    for (const busy of [{ confirmation: true }, { submitting: true }, { transitioning: true }]) {
      expect(getForegroundInteractionStatus(game(), state, 'openAreaMap', busy).allowed).toBe(false);
    }
    expect(getForegroundInteractionStatus(game(), state, 'openAreaMap').allowed).toBe(true);
  });
});
