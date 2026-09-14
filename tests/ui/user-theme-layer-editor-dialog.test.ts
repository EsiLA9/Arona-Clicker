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

  function openCreateDialog(id: string): void {
    shell().querySelector<HTMLButtonElement>('[data-theme-layer-add]')!.click();
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

  it('Dialog 打开后标题随模式更新，取消关闭且不写入图层', () => {
    controller.openUserThemeEditor();
    addGlobalTarget();
    openManager();
    const rowsBefore = shell().querySelectorAll('[data-theme-layer-row]').length;

    openCreateDialog('cancelled-layer');
    expect(dialog().hidden).toBe(false);
    expect(dialogTitle()).toBe('新增图层');
    expect(dialog().querySelector<HTMLElement>('[data-theme-layer-editor-form]')!.children.length).toBeGreaterThan(0);

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

  it('删除目标唯一图层后清除本地覆盖', () => {
    controller.openUserThemeEditor();
    addTarget('header.button', 'control');
    document.querySelector<HTMLButtonElement>('[data-theme-layer-manager-target-kind="host"]')!.click();
    openCreateDialog('only-layer');
    dialog().querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')!.click();

    shell().querySelector<HTMLButtonElement>('[data-theme-layer-id="only-layer"] [data-theme-layer-remove]')!.click();

    expect(shell().querySelector('[data-theme-layer-id="only-layer"]')).toBeNull();
    expect(shell().querySelector<HTMLElement>('[data-theme-layer-manager-source]')?.textContent).toContain('回退');
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
});
