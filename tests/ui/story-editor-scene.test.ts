// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/runtime/context';
import { createStoryEditorState, newStory } from '../../src/ui/story-editor/model';
import { createStoryEditorFlowColumn } from '../../src/ui/story-editor/view';
import { renderStoryEditorScene } from '../../src/ui/story-editor/scene-view';
import { readableOnColor } from '../../src/engine/core/color';

describe('Story editor scene cards', () => {
  let game: GameInstance;
  const render = (html: string): HTMLElement => {
    const root = document.createElement('div'); root.innerHTML = html; return root;
  };
  beforeEach(() => { game = new GameInstance(); game.init([baseDatapack]); });
  afterEach(() => { vi.restoreAllMocks(); game.stop(); });

  it('uses the destination Area theme for both the initial placeholder and real movement without changing the scene', () => {
    const area = [...game.registry.areas.values()][0];
    const areaGet = game.registry.areas.get.bind(game.registry.areas);
    vi.spyOn(game.registry.areas, 'get').mockImplementation(id => id === area.id ? { ...area, name: '区域 <测试>', theme: { tokens: { primary: '#c54277', bg: '#171717', bgAlt: '#252525' } } } : areaGet(id));
    const state = createStoryEditorState();
    const draft = newStory(state);
    draft.document.startContext = { type: 'area', areaId: area.id };
    draft.document.nodes = [{ id: 'move', type: 'moveToArea', areaId: area.id }];
    const documentBefore = structuredClone(draft.document);
    const areaBefore = game.state.currentAreaId;
    const themeBefore = structuredClone(game.colorSystem.runtimeTheme());
    const root = render(createStoryEditorFlowColumn(createUIContext(game), state).content);
    const start = root.querySelector<HTMLElement>('[data-editor-start-context]')!;
    const move = root.querySelector<HTMLElement>('[data-editor-node="move"] .area-hero')!;
    expect(start.textContent).toBe('起始于区域 <测试>');
    expect(move.textContent).toBe('前往区域 <测试>');
    expect(start.getAttribute('style')).toBe(move.getAttribute('style'));
    expect(move.style.getPropertyValue('--hero-gradient')).toContain('linear-gradient');
    expect(move.style.getPropertyValue('--hero-gradient')).toContain('#c54277');
    expect(move.style.getPropertyValue('--ac-bg')).toBe('#171717');
    expect(root.querySelectorAll('[data-editor-node]')).toHaveLength(1);
    expect(start.closest('[data-editor-node]')).toBeNull();
    expect(start.hasAttribute('draggable')).toBe(false);
    expect(start.nextElementSibling?.hasAttribute('data-story-insertion-before')).toBe(true);
    expect(draft.document).toEqual(documentBefore);
    expect(game.state.currentAreaId).toBe(areaBefore);
    expect(game.colorSystem.runtimeTheme()).toEqual(themeBefore);
  });

  it.each(['#121212', '#ffffff'])('uses the character primary slot and readable text on a solid %s card', color => {
    const variant = [...game.registry.characterVariants.values()][0];
    const groupId = 'test:colorgroup:scene';
    const groupGet = game.registry.colorGroups.get.bind(game.registry.colorGroups);
    vi.spyOn(game.registry.colorGroups, 'get').mockImplementation(id => id === groupId ? { id: groupId, name: '测试', compositionType: 'solid', slots: [{ role: 'secondary', color: '#ff0000' }, { role: 'primary', color }] } : groupGet(id));
    const variantGet = game.registry.characterVariants.get.bind(game.registry.characterVariants);
    vi.spyOn(game.registry.characterVariants, 'get').mockImplementation(id => id === variant.id ? { ...variant, displayName: '测试角色', theme: undefined, colorGroupId: groupId } : variantGet(id));
    const card = render(renderStoryEditorScene(createUIContext(game), { type: 'chara', characterId: variant.id })).firstElementChild as HTMLElement;
    expect(card.textContent).toBe('前往测试角色的通讯录');
    expect(card.style.getPropertyValue('--hero-gradient')).toBe(color);
    expect(card.style.getPropertyValue('--ink-on-panel-light')).toBe(readableOnColor(color));
  });

  it('keeps unconfigured and missing scenes visible, including an empty Story initial placeholder', () => {
    const ctx = createUIContext(game);
    expect(render(renderStoryEditorScene(ctx, undefined, true)).textContent).toBe('尚未配置起始场景');
    expect(render(renderStoryEditorScene(ctx, { type: 'area', areaId: '' })).textContent).toBe('尚未选择区域');
    expect(render(renderStoryEditorScene(ctx, { type: 'chara', characterId: 'missing:variant:scene' })).textContent).toContain('missing:variant:scene');
    const state = createStoryEditorState(); newStory(state);
    const root = render(createStoryEditorFlowColumn(ctx, state).content);
    expect(root.querySelector('[data-editor-start-context]')).not.toBeNull();
    expect(root.querySelector('[data-editor-node]')).toBeNull();
    expect(root.querySelectorAll('[data-story-insertion-end]')).toHaveLength(1);
  });
});
