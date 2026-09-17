// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { bindInventoryActions } from '../../src/ui/controller-actions-inventory';

const SPOT = 'base:spot:abydos_cafe';

describe('Spot 多支付方式弹窗', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    controller = new UIController(game, document.querySelector('#app')!);
    vi.spyOn(controller, 'refreshPanels').mockImplementation(() => undefined);
  });

  afterEach(() => {
    game.stop();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  test('多方案先弹窗，选择后把 paymentOptionId 传给解锁命令', () => {
    vi.spyOn(game.spot, 'getPaymentOptions').mockReturnValue([
      {
        id: 'credit',
        label: '信用点',
        conditionMet: true,
        affordable: true,
        status: 'available',
        costs: [{ type: 'resource', id: 'base:resource:credit', required: 10, owned: 10, missing: 0 }],
        resourceCosts: { 'base:resource:credit': 10 },
        itemCosts: {},
      },
      {
        id: 'token',
        label: '活动代币',
        conditionMet: true,
        affordable: true,
        status: 'available',
        costs: [{ type: 'item', id: 'base:item:ticket', required: 1, owned: 1, missing: 0 }],
        resourceCosts: {},
        itemCosts: { 'base:item:ticket': 1 },
      },
    ]);
    const unlock = vi.spyOn(controller.commands, 'unlockSpot').mockImplementation((spotId, paymentOptionId) => (
      paymentOptionId
        ? { success: true, spotId, newLevel: 1 }
        : { success: false, spotId, error: 'PaymentOptionRequired', paymentOptionIds: ['credit', 'token'] }
    ) as any);

    document.querySelector('#app')!.innerHTML = `<button data-upgrade="${SPOT}">购买</button>`;
    bindInventoryActions(controller);
    document.querySelector<HTMLButtonElement>('[data-upgrade]')!.click();

    expect(document.querySelector('.app-modal')).not.toBeNull();
    expect(document.querySelector('.app-modal')?.textContent).toContain('信用点');
    expect(document.querySelector('.app-modal')?.textContent).toContain('活动代币');
    expect(unlock).toHaveBeenCalledWith(SPOT, undefined);

    document.querySelector<HTMLButtonElement>('[data-spot-payment-option="token"]')!.click();

    expect(unlock).toHaveBeenLastCalledWith(SPOT, 'token');
    expect(document.querySelector('.app-modal')?.classList.contains('is-open')).toBe(false);
  });
});
