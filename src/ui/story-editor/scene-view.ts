import type { StoryDef } from '../../data-services/contracts/story';
import { readableOnColor } from '../../engine/core/color';
import { SYSTEM_DEFAULT_PRIMARY } from '../../engine/core/theme-defaults';
import { themeTreeFromThemeDef, themeTreeToInlineStyle } from '../presentation/theme-tree';
import type { UIContext } from '../runtime/context';
import type { ThemeDef } from '../../engine/types/theme';

export function storyEditorSceneTarget(ctx: UIContext, scene: StoryDef['startContext'] | undefined): { name: string; theme?: ThemeDef } | undefined {
  const area = scene?.type === 'area' ? ctx.game.registry.areas.get(scene.areaId) : undefined;
  const variant = scene?.type === 'chara' ? ctx.game.registry.characterVariants.get(scene.characterId) : undefined;
  if (area) return { name: area.name, theme: area.theme };
  if (variant) return { name: variant.displayName || variant.name, theme: variant.theme ?? (variant.colorGroupId ? { colorGroupId: variant.colorGroupId } : undefined) };
}

export function renderStoryEditorScene(ctx: UIContext, scene: StoryDef['startContext'] | undefined, start = false): string {
  const isChara = scene?.type === 'chara';
  const id = scene ? scene.type === 'area' ? scene.areaId : scene.characterId : '';
  const area = !isChara && id ? ctx.game.registry.areas.get(id) : undefined;
  const variant = isChara && id ? ctx.game.registry.characterVariants.get(id) : undefined;
  const target = storyEditorSceneTarget(ctx, scene);
  const name = target?.name;
  const theme = target?.theme;
  let style = '';
  if (area) {
    style = themeTreeToInlineStyle(themeTreeFromThemeDef(theme, key => ctx.game.registry.colorGroups.get(key)));
  } else if (variant) {
    const primary = ctx.game.colorSystem.themeFromThemeDef(theme).primary ?? SYSTEM_DEFAULT_PRIMARY;
    style = `--hero-gradient:${primary};--ink-on-panel-light:${readableOnColor(primary)}`;
  } else {
    style = '--hero-gradient:var(--panel-light);--ink-on-panel-light:var(--ink-on-panel)';
  }
  const label = name ? `${start ? '起始于' : '前往'}${name}${isChara ? '的通讯录' : ''}`
    : id ? `未找到${isChara ? '角色' : '区域'}：${id}`
      : start && !scene ? '尚未配置起始场景' : `尚未选择${isChara ? '通讯录' : '区域'}`;
  const tag = start ? 'button' : 'div';
  return `<${tag} class="area-hero story-editor-scene-card"${start ? ' type="button" data-editor-key="start-context" data-editor-action="info" data-editor-start-context' : ''}${target ? ' title="双击应用此场景的编辑器主题"' : ''} style="${ctx.escapeHtml(style)}"><h2>${ctx.escapeHtml(label)}</h2></${tag}>`;
}
