// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { renderAppShell, type PanelState } from '../../src/ui/components/app-shell';
import { createRuntimeDatapackEditorState } from '../../src/ui/runtime-editor/state';

const baseState = (): PanelState => ({
  service: 'game',
  leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
  chatEntries: [], chatTexts: [], selectedVariantId: null,
  conversationVariantId: null, studentChats: {}, studentChatTexts: {}, storyNavPath: [],
});

describe('服务工作区', () => {
  let game: GameInstance;

  it('数据包金色活动态使用已注册主题颜色并覆盖 hover', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/css/modal.css'), 'utf8');
    expect(css).not.toContain('var(--gold)');
    expect(css).toContain('.pack-slot-select.is-create-target:hover');
    expect(css).toContain('.pack-slot-select.is-editing-target:hover');
    expect(css).toContain('var(--theme-node-accent, var(--theme-node-active, var(--cyan)))');
    expect(css).toContain('var(--theme-node-warning, var(--orange))');
  });

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  it.each([
    ['datapack', '数据包管理', '导入数据包'],
    ['saves', '存读档', '保存当前进度'],
    ['records', '图鉴与统计', '打开完整图鉴'],
  ] as const)('渲染 %s 工作区并保留三栏结构', (service, title, action) => {
    const html = renderAppShell(createUIContext(game), {
      ...baseState(),
      service,
      datapackWorkspace: service === 'datapack' ? {
        section: 'all', selectedPackId: null, draftEnabledIds: [], draftOrder: [], validation: null, lastResult: null,
      } : undefined,
    });
    expect(html).toContain('data-workspace-frame="service-');
    expect(html).toContain('data-responsive="two-column"');
    expect(html).toContain(`>${title}<`);
    expect(html).toContain(action);
    expect(html).toContain('service-navigation');
    expect(html).toContain('service-inspector');
    expect(html).toContain('panel service-column service-navigation');
    expect(html).toContain('panel service-column service-main');
    expect(html).toContain('panel service-column service-inspector');
    expect(html).toContain(`data-theme-host-id="leftPanel.service.${service}.navigation"`);
    expect(html).toContain(`data-theme-host-id="centerPanel.service.${service}.main"`);
    expect(html).toContain(`data-theme-host-id="rightPanel.service.${service}.inspector"`);
    expect(html).toContain(`data-theme-scope="center.${service}.main"`);
  });

  it('数据包工作区显示分类语义、正式状态与草案操作', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(),
      service: 'datapack',
      datapackWorkspace: {
        section: 'all',
        selectedPackId: null,
        draftEnabledIds: [],
        draftOrder: [],
        validation: null,
        lastResult: null,
      },
    });
    expect(html).toContain('data-datapack-section="enabled"');
    expect(html).toContain('普通态');
    expect(html).toContain('data-pack-selection-pane=');
    expect(html).toContain('data-pack-validate');
    expect(html).toContain('data-pack-apply');
    expect(html).not.toContain('pack-workflow-guide');
    expect(html).not.toContain('当前编辑目标');
    expect(html).not.toContain('运行时数据包编辑');
    expect(html).not.toContain('打开编辑器');
    expect(html).not.toContain('模式 / 下次 Runtime 来源');
    expect(html).toContain('aria-label="选择数据包状态"');
    expect(html).toContain('class="pack-fixed-state"');
    expect(html).toContain('data-pack-create-empty-editing');
    expect(html).toContain('创建新编辑态数据包');
    expect(html).not.toContain('普通态已加入启用集');
    expect(html).not.toContain('编辑态可编辑');
    expect(html.indexOf('data-pack-selection-pane=')).toBeLessThan(html.indexOf('class="pack-fixed-state"'));
    expect(html).toContain('启用集与加载顺序');
    expect(html.indexOf('service-pack-list')).toBeLessThan(html.indexOf('pack-draft-actions'));
  });

  it('前台 UI 只保留 Pane 状态选择，不重复渲染编辑目标卡片', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const source = runtime.getPackCatalog().entries.find(entry => entry.editingMode === 'normal');
    if (!source) throw new Error('测试需要一个普通态数据包作为编辑态副本来源。');
    const created = runtime.createEditingPack(source.packRecordId ?? source.id);
    if (!created.ok || !created.packRecordId) throw new Error(created.message);
    const target = runtime.getPackCatalog().entries.find(entry => entry.packRecordId === created.packRecordId);
    if (!target) throw new Error('编辑态副本创建后无法读取目标数据包。');
    const editor = createRuntimeDatapackEditorState(null, 'runtime-editor', created.packRecordId);
    editor.modName = target.modName;
    editor.displayName = target.name;
    editor.version = target.version;
    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(),
      service: 'datapack',
      datapackWorkspace: {
        section: 'all', selectedPackId: target.id, draftEnabledIds: [], draftOrder: [], validation: null, lastResult: null,
      },
      runtimeDatapackEditor: editor,
    });
    const paneKey = `${target.modName}@${target.version}`;
    expect(html.match(new RegExp(`data-pack-pane="${paneKey}"`, 'g'))).toHaveLength(1);
    expect(html.match(new RegExp(`data-pack-selection-pane="${paneKey}"`, 'g'))).toHaveLength(2);
    expect(html).not.toContain('pack-pane-slots');
    expect(html).toContain('aria-label="选择数据包状态"');
    expect(html).not.toContain('class="pack-pane-current-editor"');
    expect(html).not.toContain('class="pack-editor-target"');
    expect(html).not.toContain('is-editing-target');
    expect(html).not.toContain('class="runtime-editor-toggle"');
    expect(html).not.toContain('data-pack-open-editing');
    expect(html).not.toContain('打开编辑器');
  });

  it('已 Apply 的槽位不再显示待 Apply', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const source = runtime.getPackCatalog().entries.find(entry => entry.editingMode === 'normal');
    if (!source) throw new Error('测试需要一个普通态数据包作为编辑态副本来源。');
    const created = runtime.createEditingPack(source.packRecordId ?? source.id);
    if (!created.ok || !created.packRecordId) throw new Error(created.message);
    const pane = runtime.getPackCatalog().panes.find(item => item.editing?.packRecordId === created.packRecordId);
    if (!pane) throw new Error('编辑态副本创建后无法生成 Pane。');
    runtime.setPackSelection(pane.paneKey, 'editing');
    expect(runtime.applyPackSelection().ok).toBe(true);

    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(),
      service: 'datapack',
      datapackWorkspace: {
        section: 'all', selectedPackId: null, draftEnabledIds: [], draftOrder: [], validation: null, lastResult: null,
      },
    });
    expect(html).toContain('aria-label="编辑态 · 当前 Runtime"');
    expect(html).toContain('>编辑态</button>');
    expect(html).not.toContain('>编辑态 ·');
  });

  it('正常游戏模式仍渲染原有三栏', () => {
    const html = renderAppShell(createUIContext(game), baseState());
    expect(html).toContain('data-workspace-frame="game"');
    expect(html).not.toContain('data-workspace-frame="service-');
  });

  it('角色工作区接管通讯录、故事和成长三栏，并暴露稳定 Host', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    const html = renderAppShell(createUIContext(game), {
      ...baseState(),
      workspace: {
        type: 'character',
        variantId: 'Hoshino',
        conversationVariantId: 'Hoshino',
        returnContext: { leftTab: 'contacts', centerTab: 'chat', rightTab: 'character', selectedVariantId: null, conversationVariantId: null },
      },
      selectedVariantId: 'Hoshino',
      conversationVariantId: 'Hoshino',
    });
    expect(html).toContain('data-workspace-frame="character"');
    expect(html).toContain('data-theme-host-id="leftPanel.character.contacts"');
    expect(html).toContain('data-theme-host-id="centerPanel.character.story"');
    expect(html).toContain('data-theme-host-id="rightPanel.character.progression"');
    expect(html).toContain('data-workspace-role="progression"');
    expect(html).toContain('角色成长');
  });

  it('设置与服务列使用单一 Panel surface，body 承担内容区 padding', () => {
    const html = renderAppShell(createUIContext(game), { ...baseState(), service: 'settings' });
    expect(html).toContain('panel service-column service-navigation settings-navigation');
    expect(html).toContain('panel service-column service-main settings-main');
    expect(html).toContain('panel service-column service-inspector settings-inspector');
  });
});
