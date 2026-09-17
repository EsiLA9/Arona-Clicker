// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { createUIContext } from '../../src/ui/context';
import { bindRuntimeDatapackEditorActions } from '../../src/ui/runtime-editor/actions';
import { createRuntimeDatapackEditorState, setRuntimeEditorSpot } from '../../src/ui/runtime-editor/state';
import { renderRuntimeSpotForm } from '../../src/ui/runtime-editor/view';
import { clearSubDialogs } from '../../src/ui/runtime-editor/subdialog';

const AREA = 'base:area:main';

describe('Runtime Editor 支付方案嵌套编辑', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    controller = new UIController(game, document.querySelector('#app')!);
  });

  afterEach(() => {
    clearSubDialogs();
    game.stop();
    localStorage.clear();
  });

  test('支付方案子弹窗可添加费用项并回写到父级集合', () => {
    const editor = createRuntimeDatapackEditorState(AREA);
    editor.modName = 'draft-mod';
    editor.displayName = 'Draft Mod';
    editor.activeSection = 'payments';
    setRuntimeEditorSpot(editor, {
      idName: 'printer',
      areaId: AREA,
      name: 'Printer',
      description: '',
      purchaseOptions: [{
        id: 'credit',
        label: '信用点',
        costs: [{ type: 'resource', resourceId: 'base:resource:credit', amount: 10 }],
      }],
    });

    controller.modal.open({
      title: 'Runtime Editor',
      body: renderRuntimeSpotForm(createUIContext(game), { runtimeDatapackEditor: editor } as any),
      footer: '<button class="modal-close">关闭</button>',
    });
    bindRuntimeDatapackEditorActions(controller, document.querySelector('.app-modal')!);

    document.querySelector<HTMLButtonElement>('[data-runtime-collection="payment-options"] [data-runtime-collection-edit]')!.click();
    const optionDialog = document.querySelector<HTMLElement>('.runtime-subdialog')!;
    expect(optionDialog.querySelector('[data-runtime-collection="payment-costs"]')).not.toBeNull();

    optionDialog.querySelector<HTMLButtonElement>('[data-runtime-collection="payment-costs"] [data-runtime-collection-add]')!.click();
    expect(optionDialog.querySelectorAll('[data-runtime-collection="payment-costs"] [data-runtime-collection-row]')).toHaveLength(2);
    optionDialog.querySelector<HTMLButtonElement>('[data-subdialog-save]')!.click();

    const row = document.querySelector<HTMLElement>('[data-runtime-collection="payment-options"] [data-runtime-collection-row]')!;
    const saved = JSON.parse(row.querySelector<HTMLInputElement>('[data-runtime-collection-value]')!.value);
    expect(saved.costs).toHaveLength(2);
    expect(saved.costs[1]).toMatchObject({ type: 'resource', amount: 1 });
  });

  test('编辑费用项后恢复支付方案弹窗，再保存支付方案回到 Spot 编辑器', () => {
    const editor = createRuntimeDatapackEditorState(AREA);
    editor.modName = 'draft-mod';
    editor.displayName = 'Draft Mod';
    editor.activeSection = 'payments';
    setRuntimeEditorSpot(editor, {
      idName: 'printer',
      areaId: AREA,
      name: 'Printer',
      description: '',
      purchaseOptions: [{
        id: 'credit',
        label: '信用点',
        costs: [{ type: 'resource', resourceId: 'base:resource:credit', amount: 10 }],
      }],
    });

    controller.modal.open({
      title: 'Runtime Editor',
      body: renderRuntimeSpotForm(createUIContext(game), { runtimeDatapackEditor: editor } as any),
      footer: '<button class="modal-close">关闭</button>',
    });
    bindRuntimeDatapackEditorActions(controller, document.querySelector('.app-modal')!);

    document.querySelector<HTMLButtonElement>('[data-runtime-collection="payment-options"] [data-runtime-collection-edit]')!.click();
    let optionDialog = document.querySelector<HTMLElement>('.runtime-subdialog')!;
    optionDialog.querySelector<HTMLButtonElement>('[data-runtime-collection="payment-costs"] [data-runtime-collection-edit]')!.click();

    const costDialog = document.querySelector<HTMLElement>('.runtime-subdialog')!;
    expect(costDialog).not.toBe(optionDialog);
    costDialog.querySelector<HTMLButtonElement>('[data-runtime-subdialog-close]')!.click();
    expect(document.querySelector('.runtime-subdialog')).toBe(optionDialog);
    expect(document.querySelector('.app-modal.is-open')).not.toBeNull();

    optionDialog.querySelector<HTMLButtonElement>('[data-runtime-collection="payment-costs"] [data-runtime-collection-edit]')!.click();
    const escapedCostDialog = document.querySelector<HTMLElement>('.runtime-subdialog')!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.runtime-subdialog')).toBe(optionDialog);
    expect(document.querySelector('.app-modal.is-open')).not.toBeNull();

    optionDialog.querySelector<HTMLButtonElement>('[data-runtime-collection="payment-costs"] [data-runtime-collection-edit]')!.click();
    const editedCostDialog = document.querySelector<HTMLElement>('.runtime-subdialog')!;
    expect(editedCostDialog).not.toBe(escapedCostDialog);
    editedCostDialog.querySelector<HTMLInputElement>('[data-runtime-item-field="amount"]')!.value = '25';
    editedCostDialog.querySelector<HTMLButtonElement>('[data-subdialog-save]')!.click();

    optionDialog = document.querySelector<HTMLElement>('.runtime-subdialog')!;
    expect(optionDialog.querySelector('[data-runtime-collection="payment-costs"]')).not.toBeNull();
    const restoredCost = JSON.parse(optionDialog.querySelector<HTMLInputElement>('[data-runtime-collection="payment-costs"] [data-runtime-collection-value]')!.value);
    expect(restoredCost.amount).toBe(25);
    expect(document.querySelector('.app-modal.is-open')).not.toBeNull();

    optionDialog.querySelector<HTMLButtonElement>('[data-subdialog-save]')!.click();
    expect(document.querySelector('.runtime-subdialog')).toBeNull();
    expect(document.querySelector('.app-modal.is-open')).not.toBeNull();
    const row = document.querySelector<HTMLElement>('[data-runtime-collection="payment-options"] [data-runtime-collection-row]')!;
    const saved = JSON.parse(row.querySelector<HTMLInputElement>('[data-runtime-collection-value]')!.value);
    expect(saved.costs[0].amount).toBe(25);
  });

  test('Spot 应用失败时保留 Spot 编辑态并显示错误', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const spotController = new UIController(runtime, root);
    const runtimeArea = 'base:area:schale_main';
    const editor = createRuntimeDatapackEditorState(runtimeArea);
    editor.modName = 'draft-mod';
    editor.displayName = 'Draft Mod';
    editor.activeSection = 'overview';
    setRuntimeEditorSpot(editor, {
      idName: 'printer',
      areaId: runtimeArea,
      name: 'Printer',
      description: '',
      purchaseOptions: [{ id: 'free', costs: [] }],
      unsupportedPaymentOptionPaths: ['purchaseOptions[0]'],
    });
    spotController.panelState.runtimeDatapackEditor = editor;
    spotController.modal.open({
      title: '编辑 Spot',
      body: renderRuntimeSpotForm(createUIContext(runtime), { runtimeDatapackEditor: editor } as any),
      footer: '<button class="modal-close">关闭</button>',
    });
    bindRuntimeDatapackEditorActions(spotController, document.querySelector('.app-modal')!);

    document.querySelector<HTMLButtonElement>('[data-runtime-editor-apply]')!.click();

    expect(editor.error).toContain('无法无损回写');
    expect(document.querySelector('.app-modal .runtime-editor-shell')).not.toBeNull();
    expect(document.querySelector('.app-modal [data-runtime-editor-mod-field]')).toBeNull();
    expect(document.querySelector('.app-modal')?.textContent).toContain('无法无损回写');
    expect(runtime.registry.spots.has('draft-mod:spot:printer')).toBe(false);

    spotController.modal.close();
    spotController.destroy();
    runtime.stop();
  });
});
