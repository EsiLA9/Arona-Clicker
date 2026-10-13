import { describe, expect, it } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { PackManager, type StoredPack } from '../../src/data-services/datapack/pack-manager';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { createGameCommands } from '../../src/arona-clicker/runtime-commands';
import { ThemeContentEditorService } from '../../src/arona-clicker/services/theme-content-editor-service';

function editingPack(): StoredPack {
  const datapack: Datapack = {
    modName: 'theme-pack',
    name: 'Theme Pack',
    version: '1.0.0',
    inits: [],
    areas: [{
      id: 'theme-pack:area:office', initId: 'theme-pack:init:main', name: 'Office', description: '', defaultSpots: [],
      theme: { colorGroupId: 'theme-pack:colorgroup:azure' },
      presentation: {
        default: { name: 'Office', description: '', theme: { colorGroupId: 'theme-pack:colorgroup:azure' } },
        additions: [{ id: 'night', label: 'Night', override: { theme: { colorGroupId: 'theme-pack:colorgroup:azure' } } }],
      },
    }],
    spots: [], enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], characters: [], funcletDefs: [],
    colorGroups: [{
      id: 'theme-pack:colorgroup:azure',
      name: 'Azure',
      compositionType: 'solid',
      slots: [{ role: 'primary', color: '#3b9eff' }],
    }],
    themeDesigns: [{ id: 'theme-pack:themedesign:office', name: 'Office', theme: { colorGroupId: 'theme-pack:colorgroup:azure' } }],
  };
  return {
    id: 'theme-pack@1.0.0',
    manifest: { modName: 'theme-pack', name: 'Theme Pack', version: '1.0.0', dependencies: [] },
    datapack,
    images: [],
    sourceKind: 'zip',
    importedAt: 1,
    editingMode: 'normal',
  };
}

function setup() {
  const manager = new PackManager();
  manager.importPack(editingPack());
  const target = manager.createEditingPack('theme-pack@1.0.0').pack;
  const game = new GameInstance();
  game.init([]);
  let persisted = 0;
  const service = new ThemeContentEditorService({
    getPackManager: () => manager,
    colorSystem: game.colorSystem,
    persistPackManagerSnapshot: () => { persisted += 1; },
  });
  return { manager, target, game, service, persistedCount: () => persisted };
}

describe('ThemeContentEditorService', () => {
  it('由产品 Runtime 和 GameCommands 暴露一般主题编辑服务', () => {
    const runtime = new AronaClickerRuntime();
    expect(createGameCommands(runtime).themeContentEditor).toBe(runtime.themeContentEditor);
  });

  it('一般 ThemeDesign 编辑态使用共享 Preview，并保存回指定 editing Pack', () => {
    const { manager, target, game, service, persistedCount } = setup();
    (game.state as any).currentAreaId = 'base:area:schale_main';
    game.colorSystem.syncSelectedThemeFromState(game.state);
    const original = game.colorSystem.runtimeTheme();
    const opened = service.beginEdit({ packRecordId: target.id, kind: 'theme-design', contentId: 'theme-pack:themedesign:office', replacesSourceId: 'area:base:area:schale_main' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const draft = {
      ...opened.value.draft,
      theme: {
        ...('theme' in opened.value.draft ? opened.value.draft.theme : {}),
        tokens: { primary: '#3868a8', bg: '#e9f1fb', bgAlt: '#cbdcf3' },
        background: [{ id: 'office-overlay', kind: 'solid' as const, value: 'rgba(255, 255, 255, 0.3)' }],
      },
    };
    const preview = service.preview(opened.value.sessionId, draft);
    expect(preview.ok).toBe(true);
    expect(game.colorSystem.runtimeTheme().tokens.bg).toBe('#e9f1fb');
    expect(game.colorSystem.runtimeTheme().background.map(layer => layer.id)).toEqual(['system-color-background', 'office-overlay']);

    const saved = service.save(opened.value.sessionId, draft);
    expect(saved.ok).toBe(true);
    expect(manager.getPack(target.id)?.datapack.themeDesigns?.[0].theme.tokens?.bg).toBe('#e9f1fb');
    expect(persistedCount()).toBe(1);
    expect(game.colorSystem.runtimeTheme().tokens.bg).toBe(original.tokens.bg);
    expect(game.colorSystem.runtimeTheme().background.map(layer => layer.id)).toEqual(original.background.map(layer => layer.id));
  });

  it('ColorGroup 使用相同编辑会话并拒绝保存至普通态数据包', () => {
    const { manager, target, game, service } = setup();
    const opened = service.beginEdit({ packRecordId: target.id, kind: 'color-group', contentId: 'theme-pack:colorgroup:azure' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.source).toMatchObject({ kind: 'color-group', packRecordId: target.id, editable: true });
    const draft = {
      ...opened.value.draft,
      slots: [{ role: 'primary' as const, color: '#1864ab' }],
      systemColorLayerIgnored: true,
    };
    expect(service.preview(opened.value.sessionId, draft)).toMatchObject({ ok: true });
    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe('#1864ab');
    expect(service.save(opened.value.sessionId, draft)).toMatchObject({ ok: true });
    expect(manager.getPack(target.id)?.datapack.colorGroups?.[0]).toMatchObject({
      slots: [{ role: 'primary', color: '#1864ab' }],
      systemColorLayerIgnored: true,
    });

    const normal = service.beginEdit({ packRecordId: 'theme-pack@1.0.0', kind: 'theme-design', contentId: 'theme-pack:themedesign:office' });
    expect(normal).toMatchObject({ ok: false, code: 'target-must-be-editing' });
    expect(manager.getPack(target.id)?.datapack.colorGroups?.[0].slots[0].color).toBe('#1864ab');
  });

  it('直接 ThemeDef 与实体表现附加项的主题按 owner 路径预览并写回', () => {
    const { manager, target, game, service } = setup();
    const direct = service.beginEdit({
      packRecordId: target.id,
      kind: 'theme-def',
      contentId: 'theme-pack:area:office',
      owner: { table: 'areas', path: { kind: 'field' } },
    });
    expect(direct.ok).toBe(true);
    if (!direct.ok) return;
    const directDraft = { ...direct.value.draft, tokens: { primary: '#2877bd', bg: '#e8f3ff', bgAlt: '#bdd7f1' } };
    expect(service.preview(direct.value.sessionId, directDraft)).toMatchObject({ ok: true });
    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe('#2877bd');
    expect(service.save(direct.value.sessionId, directDraft)).toMatchObject({ ok: true });
    expect(manager.getPack(target.id)?.datapack.areas[0].theme?.tokens?.primary).toBe('#2877bd');

    const nested = service.beginEdit({
      packRecordId: target.id,
      kind: 'theme-def',
      contentId: 'theme-pack:area:office',
      owner: { table: 'areas', path: { kind: 'presentation-addition', optionId: 'night' } },
    });
    expect(nested.ok).toBe(true);
    if (!nested.ok) return;
    const nestedDraft = { ...nested.value.draft, tokens: { primary: '#8b5cf6' } };
    expect(service.preview(nested.value.sessionId, nestedDraft)).toMatchObject({ ok: true });
    expect(service.save(nested.value.sessionId, nestedDraft)).toMatchObject({ ok: true });
    const savedArea = manager.getPack(target.id)?.datapack.areas[0];
    expect(savedArea?.presentation?.additions?.[0].override.theme?.tokens?.primary).toBe('#8b5cf6');
    expect(savedArea?.presentation?.default.theme?.tokens).toBeUndefined();
  });

  it('检测同编辑包的并发内容变化且不覆盖新版本', () => {
    const { manager, target, service } = setup();
    const opened = service.beginEdit({ packRecordId: target.id, kind: 'theme-design', contentId: 'theme-pack:themedesign:office' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const latest = manager.getPack(target.id)!;
    manager.savePack({
      ...latest,
      datapack: { ...latest.datapack, name: 'changed elsewhere' },
      contentDigest: undefined,
    });

    const saved = service.save(opened.value.sessionId, opened.value.draft);
    expect(saved).toMatchObject({ ok: false, code: 'content-conflict' });
    expect(manager.getPack(target.id)?.datapack.name).toBe('changed elsewhere');
  });
});
