import { entityKeyOf, type EntityThemeOption } from '../../engine/system/color-system';
import type { EntityThemeSlot } from '../../engine/types/character';
import type { UIContext } from '../context';

export { entityKeyOf };

/** EntityThemeOption → 主题槽（null = 回退声明默认）。 */
export function slotFromOption(opt: EntityThemeOption): EntityThemeSlot | null {
  if (opt.kind === 'default') return null;
  if (opt.kind === 'equipment') return { kind: 'equipment', equipmentId: opt.id };
  if (opt.kind === 'design') return { kind: 'design', designId: opt.id };
  return { kind: 'custom', customTheme: opt.theme };
}

/**
 * 渲染一组实体主题选项（radio 样式）。
 * 每个按钮的 data-entity-theme-select 载荷 = { entityKey, slot }（JSON，controller 解析）。
 * 未解锁的设计渲染为禁用态（locked）。
 */
export function renderEntityThemeOptions(
  ctx: UIContext,
  entityKey: string,
  options: EntityThemeOption[],
): string {
  return `
    <div class="entity-design-options">
      ${options.map(opt => {
        const payload = ctx.escapeHtml(JSON.stringify({ entityKey, slot: slotFromOption(opt) }));
        return `
        <button type="button" class="entity-design-option ${opt.active ? 'active' : ''} ${opt.owned ? '' : 'locked'}"
          data-entity-theme-select="${payload}"
          ${opt.owned ? '' : 'disabled'}
          style="${opt.swatch ? `--swatch:${opt.swatch}` : ''}"
          title="${opt.owned ? '' : '尚未解锁'}">
          <span class="entity-design-swatch"></span>
          <span class="entity-design-name">${ctx.escapeHtml(opt.name)}</span>
          ${opt.owned ? '' : '<span class="entity-design-lock">🔒</span>'}
        </button>`;
      }).join('')}
    </div>`;
}
