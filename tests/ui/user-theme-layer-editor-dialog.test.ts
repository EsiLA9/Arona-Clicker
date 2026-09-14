// @vitest-environment happy-dom
// ============================================================
// user-theme-layer-editor-dialog.test.ts — 图层编辑 Dialog 与 Manager 行为
// 覆盖 Task0051：Dialog 标题/取消/保存绑定、Manager 打开后的目标信息、
// global 目标入口与宿主专属控件隔离。
// 这些断言必须是行为级（点击后看结果），字符串断言不能替代。
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { createUIContext } from '../../src/ui/context';
import { describeThemeLayer, renderLayerEditorForm, renderLayerManagerList } from '../../src/ui/components/user-theme-layer-manager';

const OFFICE = 'base:init:schale_office';
const USER_THEME = 'base:enhancement:user-theme-editor';

describe('用户主题图层编辑器：Dialog 与 Manager 行为', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('confirm', () => true);
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    controller = new UIController(game, document.querySelector('#app')!);
    controller.mount();
    controller.startNewGame(OFFICE);
    game.enhancements.purchaseEnhancement(USER_THEME);
  });

  afterEach(() => {
    game.stop();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  const overlay = (): HTMLElement => document.querySelector<HTMLElement>('.editor-overlay-root')!;
  const shell = (): HTMLElement => overlay().querySelector<HTMLElement>('[data-theme-layer-manager-shell]')!;
  const dialog = (): HTMLElement => overlay().querySelector<HTMLElement>('[data-theme-layer-editor-dialog]')!;
  const listText = (): string => shell().querySelector<HTMLElement>('[data-theme-layer-manager-list]')?.textContent ?? '';
  const dialogTitle = (): string => dialog().querySelector<HTMLElement>('[data-theme-layer-dialog-title]')?.textContent ?? '';

  function addTarget(id: string, level: 'global' | 'cluster' | 'region' | 'control'): void {
    document.querySelector<HTMLButtonElement>('[data-user-theme-target-add]')!.click();
    document.querySelector<HTMLButtonElement>(`[data-user-theme-target-level="${level}"]`)!.click();
    const option = [...document.querySelectorAll<HTMLButtonElement>('[data-user-theme-target-option]')]
      .find(button => button.dataset.userThemeTargetOption === id);
    expect(option).toBeTruthy();
    option!.click();
  }

  function addGlobalTarget(): void {
    addTarget('global', 'global');
  }

  function openManager(): void {
    const button = document.querySelector<HTMLButtonElement>('[data-theme-layer-manager-target-kind="global"]');
    expect(button).not.toBeNull();
    button!.click();
  }

  /** 新增按钮立即建立图层；需要命名/改参数时再打开它的编辑弹窗。 */
  function addLayerRow(): HTMLElement {
    shell().querySelector<HTMLButtonElement>('[data-theme-layer-add]')!.click();
    return shell().querySelector<HTMLElement>('[data-theme-layer-manager-list] [data-theme-layer-row]')!;
  }

  function openCreateDialog(id: string): void {
    addLayerRow().querySelector<HTMLButtonElement>('[data-theme-layer-edit]')!.click();
    const field = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="id"]')!;
    field.value = id;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('overlay 是 body 级并列节点，Manager 与 Dialog 不在 Inspector 内', () => {
    controller.openUserThemeEditor();
    const root = overlay();
    expect(root.parentElement).toBe(document.body);
    expect(root.querySelector(':scope > [data-theme-layer-manager-shell]')).not.toBeNull();
    expect(root.querySelector(':scope > [data-theme-layer-editor-dialog]')).not.toBeNull();
    expect(document.querySelector('.user-theme-inspector [data-theme-layer-manager-shell]')).toBeNull();
    expect(document.querySelector('.user-theme-inspector [data-theme-layer-editor-dialog]')).toBeNull();
  });

  it('Manager 打开后按当前目标渲染，不再是未选择空态', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    expect(listText()).toContain('选择一个表现目标');

    openManager();

    expect(shell().hidden).toBe(false);
    expect(shell().querySelector<HTMLElement>('[data-theme-layer-manager-title]')?.textContent).toBe('全局外部背景');
    expect(listText()).not.toContain('选择一个表现目标');
  });

  it('新增按钮立即建立普通图层，不打开编辑弹窗', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    const rowsBefore = shell().querySelectorAll('[data-theme-layer-row]').length;

    const row = addLayerRow();

    expect(dialog().hidden).toBe(true);
    expect(shell().querySelectorAll('[data-theme-layer-row]').length).toBe(rowsBefore + 1);
    expect(row.dataset.themeLayerId).toBeTruthy();
    expect(row.querySelector('[data-theme-layer-edit]')).not.toBeNull();
    expect(shell().querySelector<HTMLElement>('[data-theme-layer-manager-source]')?.textContent).toContain('本地覆盖');
  });

  it('Dialog 打开后标题为编辑，取消关闭且不写入改名', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    const row = addLayerRow();
    const rowsBefore = shell().querySelectorAll('[data-theme-layer-row]').length;

    row.querySelector<HTMLButtonElement>('[data-theme-layer-edit]')!.click();
    expect(dialog().hidden).toBe(false);
    expect(dialogTitle()).toBe('编辑图层');
    expect(dialog().querySelector<HTMLElement>('[data-theme-layer-editor-form]')!.children.length).toBeGreaterThan(0);

    const field = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="id"]')!;
    field.value = 'cancelled-layer';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-cancel]')!.click();

    expect(dialog().hidden).toBe(true);
    expect(shell().querySelectorAll('[data-theme-layer-row]').length).toBe(rowsBefore);
    expect(shell().innerHTML).not.toContain('cancelled-layer');
  });

  it('Dialog 保存把新层写入当前目标并刷新 Manager 列表', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();

    openCreateDialog('saved-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    expect(dialog().hidden).toBe(true);
    expect(shell().innerHTML).toContain('saved-layer');
    expect(shell().querySelector('[data-theme-layer-id="saved-layer"]')).not.toBeNull();
  });

  it('点击已有层的编辑按钮带出该层数据且标题为编辑', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('editable-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    shell().querySelector<HTMLButtonElement>('[data-theme-layer-id="editable-layer"] [data-theme-layer-edit]')!.click();

    expect(dialogTitle()).toBe('编辑图层');
    expect(dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="id"]')!.value).toBe('editable-layer');
  });

  it('global 目标提供管理入口，且不渲染宿主专属控件', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();

    const card = document.querySelector<HTMLElement>('[data-user-theme-host-card="global"]')!;
    expect(card).not.toBeNull();
    expect(card.querySelector('[data-theme-layer-manager-target-kind="global"]')).not.toBeNull();
    expect(card.querySelector('[data-user-theme-host-state]')).toBeNull();
    expect(card.querySelector('[data-user-theme-host-shape]')).toBeNull();
    expect(card.querySelector('[data-user-theme-host-text-color]')).toBeNull();
    expect(card.querySelector('[data-user-theme-host-decoration-toggle]')).toBeNull();
  });

  it('主题编辑器重建 Inspector 后，新的管理入口仍可点击', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    const firstButton = document.querySelector<HTMLButtonElement>('[data-theme-layer-manager-target-kind="global"]')!;

    addTarget('header.button', 'control');

    const secondButton = document.querySelector<HTMLButtonElement>('[data-theme-layer-manager-target-kind="global"]')!;
    expect(secondButton).not.toBe(firstButton);

    secondButton.click();

    expect(shell().hidden).toBe(false);
    expect(shell().querySelector<HTMLElement>('[data-theme-layer-manager-title]')?.textContent).toBe('全局外部背景');
  });

  it('图层行常显名称、色块与全部按钮，不需要展开二级菜单', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('visible-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    const row = shell().querySelector<HTMLElement>('[data-theme-layer-id="visible-layer"]')!;

    expect(row.tagName).toBe('DIV');
    expect(row.querySelector('summary')).toBeNull();
    expect(row.querySelector('.theme-layer-row-name')?.textContent).toBe('visible-layer');
    expect(row.querySelector('.theme-layer-row-desc')?.textContent).toContain('纯色');
    expect(row.querySelector<HTMLElement>('.theme-layer-swatch')?.getAttribute('style')).toContain('#6b8cff');
    for (const action of ['edit', 'toggle', 'remove']) {
      expect(row.querySelector(`[data-theme-layer-${action}]`)).not.toBeNull();
    }
    expect(row.querySelectorAll('[data-theme-layer-move]').length).toBe(2);
  });

  it('图片层用 emoji 标识，渐变层用渐变方块', () => {
    const ctx = createUIContext(game, { layers: [] });
    const base = { opacity: 1, position: 'center' as const, size: 'cover' as const, repeat: 'no-repeat' as const, blendMode: 'normal' as const, attachment: 'fixed' as const };
    const draft = {
      version: 1 as const,
      presentation: {
        hosts: [{
          id: 'global',
          layers: [
            { ...base, id: 'image-layer', kind: 'image' as const, value: 'pic-1' },
            { ...base, id: 'gradient-layer', kind: 'gradient' as const, value: 'linear-gradient(135deg, #6b8cff, #dbeafe)' },
          ],
          layerOrder: ['image-layer', 'gradient-layer'],
        }],
      },
    };

    const html = renderLayerManagerList(ctx, draft, { kind: 'global' }, true);

    expect(html).toContain('🖼️');
    expect(html).toContain('linear-gradient(135deg, #6b8cff, #dbeafe)');
  });

  it('默认 CSS 变量图层也能生成可渲染的小方块值', () => {
    expect(describeThemeLayer({ kind: 'solid', value: 'var(--theme-node-primary)' })).toMatchObject({ color: 'var(--theme-node-primary)' });
    expect(describeThemeLayer({ kind: 'gradient', value: 'linear-gradient(135deg, var(--bg), var(--bg-alt))' })).toMatchObject({ gradient: 'linear-gradient(135deg, var(--bg), var(--bg-alt))' });
  });

  it('预设渐变表单保留原始 A/B 与停靠位，不回退默认颜色', () => {
    const html = renderLayerEditorForm(createUIContext(game, { layers: [] }), {
      kind: 'gradient',
      value: 'linear-gradient(135deg, #eff6ff 0%, #93c5fd 100%)',
    }, true);
    expect(html).toContain('value="linear-gradient(135deg, #eff6ff 0%, #93c5fd 100%)"');
    expect(html).toContain('value="#eff6ff"');
    expect(html).toContain('value="#93c5fd"');
    expect(html).toContain('data-theme-layer-dialog-field="gradientStopPosition"');
  });

  it('径向渐变表单使用形状/中心参数，并保留 transparent 结束色', () => {
    const html = renderLayerEditorForm(createUIContext(game, { layers: [] }), {
      kind: 'gradient',
      value: 'radial-gradient(circle at 78% 18%, #ffffff 0%, transparent 46%)',
    }, true);
    expect(html).toContain('data-theme-layer-dialog-field="gradientShape"');
    expect(html).toContain('data-theme-layer-dialog-field="gradientCenterX" value="78%"');
    expect(html).toContain('data-theme-layer-dialog-field="gradientCenterY" value="18%"');
    expect(html).toMatch(/data-theme-layer-dialog-field="gradientEnd"[^>]*value="transparent"/);
    expect(html).not.toContain('data-theme-layer-dialog-field="gradientAngle"');
  });

  it('预设纯色表单保留原始 CSS 值，并同时提供颜色拾取器', () => {
    const html = renderLayerEditorForm(createUIContext(game, { layers: [] }), { kind: 'solid', value: 'rgb(59, 130, 246)' }, true);
    expect(html).toContain('data-theme-layer-dialog-field="value" value="rgb(59, 130, 246)"');
    expect(html).toContain('data-theme-layer-dialog-field="color"');
  });

  it('拖动标题栏会移动浮层位置，且不受定位方式限制', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();

    const panel = shell();
    const handle = panel.querySelector<HTMLElement>('[data-theme-layer-manager-header]')!;
    handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
    handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 120, clientY: 140, bubbles: true }));
    handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 120, clientY: 140, bubbles: true }));

    expect(panel.style.left).toBe('110px');
    expect(panel.style.top).toBe('130px');
    expect(panel.style.transform).toBe('none');
  });

  it('保存图层不会触发放弃确认', () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('no-confirm-layer');
    confirmMock.mockClear();

    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    expect(confirmMock).not.toHaveBeenCalled();
    expect(dialog().hidden).toBe(true);
    expect(shell().innerHTML).toContain('no-confirm-layer');
  });

  it('删除单个图层不会丢失其余图层内容', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    const before = [...shell().querySelectorAll<HTMLElement>('[data-theme-layer-row]')].map(row => row.dataset.themeLayerId!);
    expect(before.filter(id => id !== 'system-color-background').length).toBeGreaterThan(0);

    openCreateDialog('extra-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();
    shell().querySelector<HTMLButtonElement>('[data-theme-layer-id="extra-layer"] [data-theme-layer-remove]')!.click();

    const after = [...shell().querySelectorAll<HTMLElement>('[data-theme-layer-row]')].map(row => row.dataset.themeLayerId!);
    expect(after).not.toContain('extra-layer');
    expect(after).toContain('system-color-background');
    expect([...after].sort()).toEqual([...before].sort());
  });

  it('删除目标最后一层后清除本地覆盖并回到回退视图', () => {
    controller.openUserThemeEditor();
    addTarget('header.button', 'control');
    document.querySelector<HTMLButtonElement>('[data-theme-layer-manager-target-kind="host"]')!.click();
    openCreateDialog('only-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    const source = (): string => shell().querySelector<HTMLElement>('[data-theme-layer-manager-source]')?.textContent ?? '';
    const localIds = (): string[] => [...shell().querySelectorAll<HTMLElement>('[data-theme-layer-row]')].map(row => row.dataset.themeLayerId!);
    const removeRow = (id: string): void => { shell().querySelector<HTMLButtonElement>(`[data-theme-layer-id="${id}"] [data-theme-layer-remove]`)!.click(); };

    expect(source()).toContain('本地覆盖');
    for (const id of localIds()) if (id !== 'only-layer') removeRow(id);
    expect(localIds()).toEqual(['only-layer']);
    expect(source()).toContain('本地覆盖');

    removeRow('only-layer');

    expect(shell().querySelector('[data-theme-layer-id="only-layer"]')).toBeNull();
    expect(source()).toContain('回退');
    expect(localIds().length).toBeGreaterThan(0);
  });

  it('上移/下移改变图层顺序', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('lower-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();
    openCreateDialog('upper-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    const displayIds = () => [...shell().querySelectorAll<HTMLElement>('[data-theme-layer-row]')].map(row => row.dataset.themeLayerId!);
    expect(displayIds()[0]).toBe('upper-layer');

    shell().querySelector<HTMLButtonElement>('[data-theme-layer-id="upper-layer"] [data-direction="down"]')!.click();

    expect(displayIds().indexOf('upper-layer')).toBe(1);
  });

  it('清除本地覆盖后回到回退视图', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('temp-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    shell().querySelector<HTMLButtonElement>('[data-theme-layer-revert]')!.click();

    expect(shell().querySelector('[data-theme-layer-id="temp-layer"]')).toBeNull();
    expect(shell().querySelector<HTMLElement>('[data-theme-layer-manager-source]')?.textContent).toContain('回退');
  });

  it('回退视图中的系统颜色层排在展示列表末尾', () => {
    const ctx = createUIContext(game, { layers: [] });
    const base = { opacity: 1, position: 'center' as const, size: 'cover' as const, repeat: 'no-repeat' as const, blendMode: 'normal' as const, attachment: 'fixed' as const };
    const resolved = [
      { ...base, id: 'bg-bottom', kind: 'solid' as const, value: '#111111' },
      { ...base, id: 'bg-top', kind: 'solid' as const, value: '#222222' },
    ];

    const html = renderLayerManagerList(ctx, { version: 1 }, { kind: 'global' }, true, resolved);

    expect(html.indexOf('theme-layer-row-name">bg-top<')).toBeLessThan(html.indexOf('theme-layer-row-name">bg-bottom<'));
    expect(html.indexOf('theme-layer-row-name">bg-bottom<')).toBeLessThan(html.indexOf('系统颜色层'));
  });

  it('删除图层后复用行的隐藏状态与模板保持一致', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('alpha-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();
    openCreateDialog('beta-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    shell().querySelector<HTMLButtonElement>('[data-theme-layer-id="alpha-layer"] [data-theme-layer-toggle]')!.click();
    expect(shell().querySelector<HTMLElement>('[data-theme-layer-id="alpha-layer"]')!.className).toContain('is-hidden');

    shell().querySelector<HTMLButtonElement>('[data-theme-layer-id="beta-layer"] [data-theme-layer-remove]')!.click();

    const alphaRow = shell().querySelector<HTMLElement>('[data-theme-layer-id="alpha-layer"]')!;
    expect(alphaRow.className).toContain('is-hidden');
    expect(alphaRow.querySelector<HTMLElement>('[data-theme-layer-toggle]')?.dataset.themeLayerNextEnabled).toBe('1');
  });

  it('新建图层会先固化当前继承层，不丢失已有内容', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    expect(shell().querySelectorAll('[data-theme-layer-row]').length).toBeGreaterThan(0);

    openCreateDialog('preserve-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    const ids = [...shell().querySelectorAll<HTMLElement>('[data-theme-layer-row]')].map(row => row.dataset.themeLayerId);
    expect(ids).toContain('preserve-layer');
    expect(ids).toContain('system-color-background');
    expect(ids.filter(id => id !== 'preserve-layer' && id !== 'system-color-background').length).toBeGreaterThan(0);
  });

  it('Dialog 输入即时预览，取消后不写入会话内容', async () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('preview-layer');

    const colorField = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="color"]')!;
    colorField.value = '#ff0000';
    colorField.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 30));

    const previewedLayers = () => game.colorSystem.runtimeTheme().presentation?.hosts?.find(host => host.id === 'global')?.layers ?? [];
    expect(previewedLayers().some(layer => layer.value === '#ff0000')).toBe(true);

    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-cancel]')!.click();

    expect(previewedLayers().some(layer => layer.value === '#ff0000')).toBe(false);
  });

  const setDialogKind = (value: string): void => {
    const select = dialog().querySelector<HTMLSelectElement>('[data-theme-layer-dialog-field="kind"]')!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const dialogValue = (): string => dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="value"]')!.value;
  const stopRows = (): HTMLElement[] => [...dialog().querySelectorAll<HTMLElement>('[data-theme-layer-gradient-stop]')];

  it('弹窗按分区渲染，开放式参数用预设枚举而不是裸 CSS 输入', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('sectioned-layer');

    const sections = [...dialog().querySelectorAll<HTMLElement>('[data-theme-layer-form-section]')]
      .map(node => node.dataset.themeLayerFormSection);
    expect(sections).toEqual(['basic', 'value', 'geometry', 'render']);

    const position = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="position"]')!;
    expect(position.getAttribute('list')).toBe('theme-layer-dialog-position');
    const optionValues = (id: string): string[] =>
      [...dialog().querySelectorAll<HTMLOptionElement>(`#${id} option`)].map(option => option.value);
    expect(optionValues('theme-layer-dialog-position')).toContain('center');
    expect(optionValues('theme-layer-dialog-position')).toContain('top left');
    expect(optionValues('theme-layer-dialog-size')).toContain('cover');

    const repeat = dialog().querySelector<HTMLSelectElement>('[data-theme-layer-dialog-field="repeat"]')!;
    expect([...repeat.options].map(option => option.value)).toContain('space');

    expect(dialog().querySelector<HTMLDetailsElement>('.theme-layer-advanced')!.hasAttribute('open')).toBe(false);
  });

  it('渐变面板提供类型枚举与每色标颜色拾取器，可增删色标', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('gradient-edit-layer');
    setDialogKind('gradient');

    const type = dialog().querySelector<HTMLSelectElement>('[data-theme-layer-dialog-field="gradientType"]')!;
    expect([...type.options].map(option => option.value)).toEqual(['linear', 'radial', 'repeating-linear', 'repeating-radial']);

    expect(stopRows().length).toBe(2);
    expect(stopRows()[0].querySelector('[data-theme-layer-stop-pick]')).not.toBeNull();
    expect(stopRows()[0].querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="gradientStart"]')!.value).toBe('#6b8cff');
    expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #dbeafe)');

    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-stop-add]')!.click();
    expect(stopRows().length).toBe(3);
    expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #dbeafe, #dbeafe)');

    stopRows()[1].querySelector<HTMLButtonElement>('[data-theme-layer-stop-remove]')!.click();
    expect(stopRows().length).toBe(2);
    expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #dbeafe)');
  });

  it('渐变方向使用关键词或角度枚举，不会拼成非法值', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('direction-layer');
    setDialogKind('gradient');

    const directionOptions = [...dialog().querySelectorAll<HTMLOptionElement>('#theme-layer-dialog-direction option')]
      .map(option => option.value);
    expect(directionOptions).toContain('to bottom');
    expect(directionOptions).toContain('135deg');

    const direction = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="gradientAngle"]')!;
    direction.value = 'to bottom';
    direction.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dialogValue()).toBe('linear-gradient(to bottom, #6b8cff, #dbeafe)');

    direction.value = '90';
    direction.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dialogValue()).toBe('linear-gradient(90deg, #6b8cff, #dbeafe)');
  });

  it('径向渐变面板改用形状/尺寸/中心枚举，不出现角度字段', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('radial-panel-layer');
    setDialogKind('gradient');

    const type = dialog().querySelector<HTMLSelectElement>('[data-theme-layer-dialog-field="gradientType"]')!;
    type.value = 'radial';
    type.dispatchEvent(new Event('change', { bubbles: true }));

    expect(dialog().querySelector('[data-theme-layer-dialog-field="gradientAngle"]')).toBeNull();
    const shape = dialog().querySelector<HTMLSelectElement>('[data-theme-layer-dialog-field="gradientShape"]')!;
    expect([...shape.options].map(option => option.value)).toEqual(['circle', 'ellipse']);
    const size = dialog().querySelector<HTMLSelectElement>('[data-theme-layer-dialog-field="gradientSize"]')!;
    expect([...size.options].map(option => option.value)).toContain('farthest-side');
    expect(dialogValue()).toBe('radial-gradient(circle at 50% 50%, #6b8cff, #dbeafe)');
  });

  it('切换表现类型会重置为该类型的合法默认值', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('reset-layer');

    setDialogKind('image');
    expect(dialog().querySelector<HTMLSelectElement>('[data-theme-layer-dialog-field="value"]')?.tagName).toBe('SELECT');

    setDialogKind('solid');
    expect(dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="color"]')).not.toBeNull();
    expect(dialogValue()).toBe('#6b8cff');
  });

  it('色标颜色清空时保留原值并标记非法，不会写回空色标', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('stop-guard-layer');
    setDialogKind('gradient');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-stop-add]')!.click();

    const middle = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="gradientStopColor"]')!;
    const before = dialogValue();
    expect(before).toBe('linear-gradient(135deg, #6b8cff, #dbeafe, #dbeafe)');

    middle.value = '';
    middle.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dialogValue()).toBe(before);
    expect(middle.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    middle.value = 'not-a-color';
    middle.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dialogValue()).toBe(before);

    middle.value = '#123456';
    middle.dispatchEvent(new Event('input', { bubbles: true }));
    expect(middle.hasAttribute('data-theme-layer-field-invalid')).toBe(false);
    expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #123456, #dbeafe)');
  });

  it('原始 CSS 值不接受空内容，保存后图层仍有视觉值', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('raw-guard-layer');

    const raw = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="value"]')!;
    expect(raw.value).toBe('#6b8cff');

    raw.value = '';
    raw.dispatchEvent(new Event('input', { bubbles: true }));
    expect(raw.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    raw.value = 'transparent';
    raw.dispatchEvent(new Event('input', { bubbles: true }));
    expect(raw.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    raw.value = 'var(--theme-node-primary)';
    raw.dispatchEvent(new Event('input', { bubbles: true }));
    expect(raw.hasAttribute('data-theme-layer-field-invalid')).toBe(false);

    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    const row = shell().querySelector<HTMLElement>('[data-theme-layer-id="raw-guard-layer"]')!;
    expect(row.querySelector('.theme-layer-row-desc')?.textContent).toContain('var(--theme-node-primary)');
  });

  it('数值字段非法输入被拒绝，保存前不会把原值改成 0 或默认值', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    const layerId = addLayerRow().dataset.themeLayerId!;
    const openEditor = (): void => { shell().querySelector<HTMLButtonElement>(`[data-theme-layer-id="${layerId}"] [data-theme-layer-edit]`)!.click(); };
    openEditor();

    const numberField = (key: string): HTMLInputElement =>
      dialog().querySelector<HTMLInputElement>(`[data-theme-layer-dialog-field="${key}"]`)!;
    for (const key of ['opacity', 'scale', 'rotation']) {
      const input = numberField(key);
      input.value = 'abc';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(input.getAttribute('data-theme-layer-field-invalid')).toBe('1');
    }

    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-cancel]')!.click();
    openEditor();

    expect(numberField('opacity').value).toBe('1');
    expect(numberField('scale').value).toBe('1');
    expect(numberField('rotation').value).toBe('0');
  });

  it('定位与尺寸沿用渲染端规则校验，非法值不生效', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('position-guard-layer');

    const position = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="position"]')!;
    expect(position.value).toBe('center');
    position.value = 'center; background:red';
    position.dispatchEvent(new Event('input', { bubbles: true }));
    expect(position.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    position.value = '78% 18%';
    position.dispatchEvent(new Event('input', { bubbles: true }));
    expect(position.hasAttribute('data-theme-layer-field-invalid')).toBe(false);

    const size = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="size"]')!;
    size.value = '';
    size.dispatchEvent(new Event('input', { bubbles: true }));
    expect(size.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    size.value = 'auto 92%';
    size.dispatchEvent(new Event('input', { bubbles: true }));
    expect(size.hasAttribute('data-theme-layer-field-invalid')).toBe(false);
  });

  it('图层 ID 非法或重名时提示并保留原值，不再静默改名', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    const firstId = addLayerRow().dataset.themeLayerId!;
    const second = addLayerRow();
    const secondId = second.dataset.themeLayerId!;
    second.querySelector<HTMLButtonElement>('[data-theme-layer-edit]')!.click();

    const field = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="id"]')!;
    field.value = '图层 1';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    field.value = firstId;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    field.value = 'system-color-background';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    field.value = 'renamed-layer';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field.hasAttribute('data-theme-layer-field-invalid')).toBe(false);

    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    expect(shell().querySelector('[data-theme-layer-id="renamed-layer"]')).not.toBeNull();
    expect(shell().querySelector(`[data-theme-layer-id="${secondId}"]`)).toBeNull();
  });

  it('色标位置：普通值即时更新、非法值保留原值并标红、留空回到自动分布', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('stop-position-layer');
    setDialogKind('gradient');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-stop-add]')!.click();

    const positionAt = (index: number): HTMLInputElement =>
      dialog().querySelectorAll<HTMLInputElement>('[data-theme-layer-dialog-field="gradientStopPosition"]')[index]!;
    const setPosition = (index: number, value: string): void => {
      const input = positionAt(index);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const expectAccepted = (index: number, accepted: boolean): void =>
      expect(positionAt(index).hasAttribute('data-theme-layer-field-invalid')).toBe(!accepted);

    expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #dbeafe, #dbeafe)');

    setPosition(1, '50%');
    expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #dbeafe 50%, #dbeafe)');
    expectAccepted(1, true);

    for (const bad of ['abc', '50', '50 %', '10vw']) {
      setPosition(1, bad);
      expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #dbeafe 50%, #dbeafe)');
      expectAccepted(1, false);
    }

    setPosition(1, '150%');
    expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #dbeafe 150%, #dbeafe)');
    expectAccepted(1, true);

    setPosition(1, '');
    expect(dialogValue()).toBe('linear-gradient(135deg, #6b8cff, #dbeafe, #dbeafe)');
    expectAccepted(1, true);

    setPosition(2, '100%');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();
    shell().querySelector<HTMLButtonElement>('[data-theme-layer-id="stop-position-layer"] [data-theme-layer-edit]')!.click();

    const fieldValues = (key: string): string[] =>
      [...dialog().querySelectorAll<HTMLInputElement>(`[data-theme-layer-dialog-field="${key}"]`)].map(input => input.value);
    expect(dialog().querySelectorAll('[data-theme-layer-gradient-stop]').length).toBe(3);
    expect(fieldValues('gradientStart')).toEqual(['#6b8cff']);
    expect(fieldValues('gradientStopColor')).toEqual(['#dbeafe']);
    expect(fieldValues('gradientEnd')).toEqual(['#dbeafe']);
    expect(fieldValues('gradientStopPosition')).toEqual(['', '', '100%']);
  });

  it('非标准存储值在下拉里如实回显，不伪装成默认项', () => {
    const html = renderLayerEditorForm(createUIContext(game, { layers: [] }), {
      kind: 'solid', value: '#6b8cff', repeat: 'inherit', blendMode: 'plus-lighter', attachment: 'viewport' as never,
    }, true);

    expect(html).toContain('value="inherit" selected');
    expect(html).toContain('inherit（当前值不可用）');
    expect(html).toContain('plus-lighter（当前值不可用）');
    expect(html).toContain('viewport（当前值不可用）');
  });

  it('图片资源缺失时下拉保留并标注当前引用', () => {
    const html = renderLayerEditorForm(createUIContext(game, { layers: [] }), { kind: 'image', value: 'base:pic:missing' }, true);

    expect(html).toContain('value="base:pic:missing" selected');
    expect(html).toContain('base:pic:missing（资源不存在）');
  });

  it('枚举字段只接受白名单值，非白名单不写入并标红', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    openCreateDialog('enum-guard-layer');

    const repeat = dialog().querySelector<HTMLSelectElement>('[data-theme-layer-dialog-field="repeat"]')!;
    const injected = document.createElement('option');
    injected.value = 'inherit';
    repeat.appendChild(injected);

    repeat.value = 'inherit';
    repeat.dispatchEvent(new Event('change', { bubbles: true }));
    expect(repeat.getAttribute('data-theme-layer-field-invalid')).toBe('1');

    repeat.value = 'space';
    repeat.dispatchEvent(new Event('change', { bubbles: true }));
    expect(repeat.hasAttribute('data-theme-layer-field-invalid')).toBe(false);
  });

  it('数值越界在提交时写回夹紧后的值，面板与保存值一致', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    const layerId = addLayerRow().dataset.themeLayerId!;
    shell().querySelector<HTMLButtonElement>(`[data-theme-layer-id="${layerId}"] [data-theme-layer-edit]`)!.click();

    const opacity = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="opacity"]')!;
    opacity.value = '5';
    opacity.dispatchEvent(new Event('change', { bubbles: true }));
    expect(opacity.value).toBe('1');
    expect(opacity.hasAttribute('data-theme-layer-field-invalid')).toBe(false);

    const scale = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="scale"]')!;
    scale.value = '0.001';
    scale.dispatchEvent(new Event('change', { bubbles: true }));
    expect(scale.value).toBe('0.05');

    const rotation = dialog().querySelector<HTMLInputElement>('[data-theme-layer-dialog-field="rotation"]')!;
    rotation.value = '-900';
    rotation.dispatchEvent(new Event('change', { bubbles: true }));
    expect(rotation.value).toBe('-360');
  });
});
