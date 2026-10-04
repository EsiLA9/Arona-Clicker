// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import type { AchievementViewItem } from '../../src/arona-clicker/read-model/achievement-view';
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
    ['datapack', '数据包管理', '导入 ZIP'],
    ['saves', '存读档', '保存当前进度'],
    ['records', '图鉴与统计', '打开完整图鉴'],
  ] as const)('渲染 %s 工作区并保留三栏结构', (service, title, action) => {
    const html = renderAppShell(createUIContext(game), {
      ...baseState(),
      service,
      datapackWorkspace: service === 'datapack' ? {
        section: 'all', mode: 'classic', selectedPackId: null, draftEnabledIds: [], draftOrder: [], validation: null, lastResult: null,
      } : undefined,
    });
    expect(html).toContain('data-workspace-frame="service-');
    expect(html).toContain('data-responsive="two-column"');
    expect(html).toContain(`>${title}<`);
    expect(html).toContain(action);
    if (service !== 'datapack') expect(html).toContain('service-navigation');
    expect(html).toContain('service-inspector');
    if (service !== 'datapack') {
      expect(html).toContain('panel service-column service-navigation');
      expect(html).toContain('panel service-column service-main');
    } else {
      expect(html).toContain('class="datapack-workspace__sections"');
      expect(html).toContain('class="datapack-workspace__catalog"');
      expect(html).toContain('data-datapack-mode="classic"');
    }
    expect(html).toContain('panel service-column service-inspector');
    expect(html).toContain(service === 'datapack' ? 'data-composition="left-center"' : 'data-composition="columns"');
    expect(html).toContain(service === 'datapack' ? 'data-theme-host-id="leftPanel.service.datapack.workspace"' : `data-theme-host-id="leftPanel.service.${service}.navigation"`);
    if (service !== 'datapack') expect(html).toContain(`data-theme-host-id="centerPanel.service.${service}.main"`);
    expect(html).toContain(`data-theme-host-id="rightPanel.service.${service}.inspector"`);
    if (service !== 'datapack') expect(html).toContain(`data-theme-scope="center.${service}.main"`);
  });

  it('数据包管理场景只生成一个 workspace，左侧合并导航和主体，右侧保留详情区', () => {
    const html = renderAppShell(createUIContext(game), {
      ...baseState(), service: 'datapack',
      datapackWorkspace: { section: 'all', mode: 'classic', selectedPackId: null, draftEnabledIds: [], draftOrder: [], validation: null, lastResult: null },
    });
    const frames = html.match(/data-workspace-frame="[^"]+"/g) ?? [];
    expect(frames).toEqual(['data-workspace-frame="service-datapack"']);
    expect(html).toContain('class="datapack-workspace__sections"');
    expect(html).toContain('class="datapack-workspace__catalog"');
    expect(html).toContain('data-theme-host-id="rightPanel.service.datapack.inspector"');
    expect(html).not.toContain('data-theme-host-id="centerPanel.service.datapack.main"');
  });

  it('Records 按投影顺序分组展示已发现成就、状态与简单进度', () => {
    const achievements: AchievementViewItem[] = [
      { id: 'achievement-current-1', initId: 'base:init:office', areaId: 'base:area:office', title: 'Credit', clue: 'Produce credit', rewardDescription: 'A note', completed: false, progress: { current: 3, target: 5, comparator: '>=' } },
      { id: 'achievement-current-2', initId: 'base:init:office', areaId: 'base:area:office', title: 'Combined', clue: 'Two steps', rewardDescription: 'A mark', completed: true },
      { id: 'achievement-other-area', initId: 'base:init:office', areaId: 'base:area:archive', title: 'Archive', clue: 'Visit archive', rewardDescription: 'A memory', completed: false },
      { id: 'achievement-old-init', initId: 'base:init:legacy', areaId: 'base:area:legacy', title: 'Legacy', clue: 'Return later', rewardDescription: 'A token', completed: true, progress: { current: 2, target: 3, comparator: '>' } },
    ];
    vi.spyOn(game, 'getAchievementView').mockReturnValue(achievements);

    const html = renderAppShell(createUIContext(game), { ...baseState(), service: 'records' });

    expect(html.match(/data-achievement-group/g)).toHaveLength(3);
    const itemOrder = [
      'achievement-current-1', 'achievement-current-2', 'achievement-other-area', 'achievement-old-init',
    ].map(id => html.indexOf(`data-achievement-id="${id}"`));
    expect(itemOrder.every(index => index >= 0)).toBe(true);
    expect(itemOrder).toEqual([...itemOrder].sort((a, b) => a - b));
    expect(html).toContain('data-achievement-progress-current>3<');
    expect(html).toContain('data-achievement-progress-comparison>≥<');
    expect(html).toContain('data-achievement-progress-target>5<');
    expect(html).toContain('data-achievement-status>已完成</span>');
    expect(html).toContain('data-achievement-status>未完成</span>');
    expect(html).not.toContain('data-achievement-progress-current>Two steps');
    expect(html).not.toContain('achievement-unvisited');
  });

  it('Records 转义作者文案、显示名和 ID 属性，并为无已发现项显示空状态', () => {
    const achievement: AchievementViewItem = {
      id: 'achievement" data-extra="<unsafe>',
      initId: 'init" data-extra="<unsafe>',
      areaId: 'area" data-extra="<unsafe>',
      title: '<img src=x onerror="run()">',
      clue: 'A & B < C',
      rewardDescription: "Reward's <detail>",
      completed: false,
    };
    vi.spyOn(game, 'getAchievementView').mockReturnValue([achievement]);
    const context = createUIContext(game);
    const unsafeIds = new Set([achievement.initId, achievement.areaId]);
    context.nameOf = (_type, id) => unsafeIds.has(id) ? '<script>name()</script>' : id;
    context.formatNumber = value => String(value);

    const html = renderAppShell(context, { ...baseState(), service: 'records' });
    expect(html).toContain('data-achievement-id="achievement&quot; data-extra=&quot;&lt;unsafe&gt;"');
    expect(html).toContain('&lt;img src=x onerror=&quot;run()&quot;&gt;');
    expect(html).toContain('A &amp; B &lt; C');
    expect(html).toContain('Reward&#39;s &lt;detail&gt;');
    expect(html).toContain('&lt;script&gt;name()&lt;/script&gt;');
    expect(html).not.toContain('<script>name()');
    expect(html).not.toContain('<img src=x onerror=');

    vi.spyOn(game, 'getAchievementView').mockReturnValue([]);
    const emptyHtml = renderAppShell(createUIContext(game), { ...baseState(), service: 'records' });
    expect(emptyHtml).toContain('data-achievement-empty-state');
    expect(emptyHtml).toContain('data-achievement-empty>目前没有已发现的区域成就');
    expect(emptyHtml).not.toContain('data-achievement-id=');
  });

  it('经典包管理使用启用/未启用双列表与可应用草案', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(),
      service: 'datapack',
      datapackWorkspace: {
        section: 'all',
        mode: 'classic',
        selectedPackId: null,
        draftEnabledIds: [],
        draftOrder: [],
        validation: null,
        lastResult: null,
      },
    });
    expect(html).toContain('data-datapack-mode="classic"');
    expect(html).toContain('data-datapack-mode="development"');
    expect(html).toContain('普通态');
    expect(html).toContain('data-pack-list="disabled"');
    expect(html).toContain('data-pack-list="enabled"');
    expect(html).toContain('data-pack-dragger');
    expect(html).not.toContain('data-pack-validate');
    expect(html).toContain('id="import-datapack"');
    expect(html).toContain('data-pack-apply');
    expect(html).toContain('class="service-card pack-draft-actions"');
    expect(html).not.toContain('启用与顺序草案未应用');
    expect(html).not.toContain('Runtime 来源已同步');
    expect(html).not.toContain('pack-workflow-guide');
    expect(html).not.toContain('当前编辑目标');
    expect(html).not.toContain('运行时数据包编辑');
    expect(html).not.toContain('打开编辑器');
    expect(html).not.toContain('模式 / 下次 Runtime 来源');
    expect(html).toContain('填写不同的 Version');
    expect(html).not.toContain('data-pack-create-empty-editing');
    expect(html).toContain('drag');
    expect(html).not.toContain('data-pack-selection-pane=');
  });

  it('ModName 重名的未启用记录逐条呈现，右侧显示冲突组与版本化编辑态操作', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const examplePack = {
      manifest: { modName: 'shared', name: 'Shared', version: '1.0.0', dependencies: [] },
      datapack: { ...baseDatapack, modName: 'shared', name: 'Shared', version: '1.0.0', spots: [] },
      images: [], jsonFileCount: 1, ignoredCount: 0,
    };
    runtime.registerParsedPack(examplePack, 'shared-a');
    runtime.registerParsedPack({ ...examplePack, manifest: { ...examplePack.manifest, version: '2.0.0' }, datapack: { ...examplePack.datapack, version: '2.0.0' } }, 'shared-b');
    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(),
      service: 'datapack',
      datapackWorkspace: {
        section: 'all', mode: 'classic', selectedPackId: 'shared-a', draftEnabledIds: [], draftOrder: ['base@1.0.0', 'shared-a', 'shared-b'], validation: null, lastResult: null,
      },
    });
    expect(html.match(/data-pack-id="shared-[ab]"/g)).toHaveLength(2);
    expect(html).toContain('data-pack-create-editing="shared-a"');
    expect(html).toContain('ModName 记录');
    expect(html).toContain('shared · v2.0.0');
  });

  it('经典拖动列表不重复显示由左右列位置表达的启用状态', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const source = runtime.getPackCatalog().entries.find(entry => entry.modName === 'base')!;
    runtime.createEditingPack(source.id, '2.0.0');
    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(),
      service: 'datapack',
      datapackWorkspace: {
        section: 'all', mode: 'classic', selectedPackId: null,
        draftEnabledIds: ['base@1.0.0'], draftOrder: runtime.getPackCatalog().entries.map(entry => entry.id),
        validation: null, lastResult: null,
      },
    });
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelectorAll('.pack-entry--draggable .pack-state')).toHaveLength(0);
    expect(container.querySelector('[data-pack-list="disabled"]')).toBeTruthy();
    expect(container.querySelector('[data-pack-list="enabled"]')).toBeTruthy();
  });

  it('编辑态转换控制位于右侧详情，复制时要求新 Version', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const source = runtime.getPackCatalog().entries.find(entry => entry.modName === 'base' && entry.editingMode === 'normal')!;
    const created = runtime.createEditingPack(source.id, '2.0.0');
    if (!created.ok || !created.packRecordId) throw new Error(created.message);
    const target = runtime.getPackCatalog().entries.find(entry => entry.id === created.packRecordId)!;
    expect(target.version).toBe('2.0.0');

    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(),
      service: 'datapack',
      datapackWorkspace: {
        section: 'all', mode: 'classic', selectedPackId: target.id, draftEnabledIds: ['base@1.0.0'], draftOrder: ['base@1.0.0', target.id], validation: null, lastResult: null,
      },
    });
    expect(html).toContain('data-pack-convert-normal="editing:base@2.0.0"');
    expect(html).toContain('data-pack-open-editing="editing:base@2.0.0"');
    expect(html).toContain('版本</dt><dd>2.0.0</dd>');
  });

  it('开发目录模式展示固定来源路径，启用状态在右侧可管理', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const pack = {
      id: 'development:demo@1.0@finished/', packRecordId: 'development:demo@1.0@finished/',
      sourcePath: 'demo@1.0@finished/',
      manifest: { modName: 'demo', name: 'Demo', version: '1.0', dependencies: [] },
      datapack: { ...baseDatapack, modName: 'demo', name: 'Demo', version: '1.0', spots: [] },
      images: [], sourceKind: 'folder' as const, importedAt: 1, editingMode: 'normal' as const,
    };
    runtime.reconcileDevelopmentPacks([pack]);
    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(), service: 'datapack',
      datapackWorkspace: {
        section: 'all', mode: 'development', selectedPackId: pack.id,
        draftEnabledIds: ['base@1.0.0', pack.id], draftOrder: ['base@1.0.0', pack.id], validation: null, lastResult: null,
      },
    });
    expect(html).toContain('class="pack-source-list"');
    expect(html).not.toContain('data-pack-list="disabled"');
    expect(html).not.toContain('data-pack-list="enabled"');
    expect(html).toContain('data-pack-id="development:demo@1.0@finished/"');
    expect(html).toContain('data-pack-create-editing="development:demo@1.0@finished/"');
    expect(html).toContain('data-pack-enabled-toggle="development:demo@1.0@finished/"');
    expect(html).toContain('开发目录');
    expect(html).toContain('demo@1.0@finished/');

    const classic = renderAppShell(createUIContext(runtime), {
      ...baseState(), service: 'datapack',
      datapackWorkspace: { section: 'all', mode: 'classic', selectedPackId: null, draftEnabledIds: ['base@1.0.0', pack.id], draftOrder: ['base@1.0.0', pack.id], validation: null, lastResult: null },
    });
    expect(classic).toContain('data-pack-id="development:demo@1.0@finished/"');
    expect(classic).toContain('data-pack-list="enabled"');
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
