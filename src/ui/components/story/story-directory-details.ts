import type { UIContext } from '../../runtime/context';
import type { ThemeDesignDef } from '../../../data-services/contracts/color';
import { readableOnColor } from '../../../engine/core/color';
import { themeTreeFromThemeDef } from '../../presentation/theme-tree';

export function renderStoryDescription(ctx: UIContext, description?: string, summary = false): string {
  const text = description?.trim();
  return text ? `<span class="story-directory-description${summary ? ' story-directory-summary' : ''}">${ctx.escapeHtml(text)}</span>` : '';
}

export function renderStoryDirectoryDetails(ctx: UIContext, details: {
  title: string;
  description?: string;
  coverPicId?: string;
  theme?: ThemeDesignDef;
  read?: number;
  completed?: number;
}): string {
  const cover = details.coverPicId ? ctx.game.pics.urlOf(details.coverPicId) : undefined;
  const tree = details.theme && themeTreeFromThemeDef(details.theme.theme, id => ctx.game.registry.colorGroups.get(id));
  const style = tree && [
    ['--story-directory-bg', tree['--theme-node-panel']],
    ['--story-directory-ink', readableOnColor(tree['--theme-node-panel'], tree)],
    ['--story-directory-accent', tree['--ac-primary']],
  ].filter(([, value]) => value && !/[;{}]|url\s*\(/i.test(value)).map(([name, value]) => `${name}:${value}`).join(';');
  return `<section class="story-directory-overview"${style ? ` data-story-directory-theme="${ctx.escapeHtml(details.theme!.id)}" style="${ctx.escapeHtml(style)}"` : ''}>
    ${cover ? `<img class="story-directory-cover" src="${ctx.escapeHtml(cover)}" alt="">` : ''}
    <h2>${ctx.escapeHtml(details.title)}</h2>
    ${renderStoryDescription(ctx, details.description)}
    ${details.read === undefined ? '' : `<small>已读 ${details.read} · 已完成 ${details.completed ?? 0}</small>`}
  </section>`;
}
