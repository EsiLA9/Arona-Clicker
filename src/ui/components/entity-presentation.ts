import type { EntityPresentationKey } from '../../data-services/contracts/entity-presentation';
import type { EntityPresentationResolveOptions, EntityPresentationResolution } from '../../arona-clicker/contracts/entity-presentation-query';
import type { UIContext } from '../context';

export type EntityPresentationKind = 'init' | 'area' | 'spot' | 'enhancement' | 'variant';

export function resolveEntityPresentation(
  ctx: UIContext,
  kind: EntityPresentationKind,
  id: string,
  options?: EntityPresentationResolveOptions,
): EntityPresentationResolution | undefined {
  return ctx.entityPresentation?.resolve(ctx.game.state, `${kind}:${id}` as EntityPresentationKey, options);
}

/**
 * 渲染统一的实体表现选择器：名称、描述和主题作为一个 option 一起切换。
 * 不可用 option 只显示锁定占位，不读取其 value，避免选择 UI 越过揭示边界泄露内容。
 */
export function renderEntityPresentationOptions(
  ctx: UIContext,
  kind: EntityPresentationKind,
  id: string,
): string {
  const query = ctx.entityPresentation;
  if (!query) return '';
  const key = `${kind}:${id}` as EntityPresentationKey;
  const options = query.options(ctx.game.state, key);
  if (options.length === 0) return '';
  const current = query.resolve(ctx.game.state, key);
  if (!current) return '';
  const defaultValue = query.resolve(ctx.game.state, key, { selectedOptionId: null });
  const runtimeLocked = current.source === 'runtime';
  const encode = (optionId: string | null): string => ctx.escapeHtml(JSON.stringify({ entityKey: key, optionId }));
  const renderValue = (description: string | undefined): string => description
    ? `<small class="entity-presentation-description">${ctx.escapeHtml(description)}</small>`
    : '';
  const defaultActive = !runtimeLocked && current.optionId === undefined;
  const defaultButton = defaultValue
    ? `<button type="button" class="entity-presentation-option ${defaultActive ? 'active' : ''}${runtimeLocked ? ' blocked' : ''}"
        data-entity-presentation-select="${encode(null)}" ${runtimeLocked ? 'disabled' : ''}
        style="${defaultValue.swatch ? `--swatch:${defaultValue.swatch}` : ''}"
        aria-pressed="${defaultActive}" title="${runtimeLocked ? '当前由运行时演出覆盖' : '使用默认表现'}">
        <span class="entity-presentation-swatch"></span><span class="entity-presentation-label">默认</span>
        ${renderValue(defaultValue.description)}
      </button>`
    : '';
  const additionButtons = options.map(option => {
    const active = current.optionId === option.id;
    const label = option.available ? option.label : '???';
    const description = option.available ? option.value?.description : undefined;
    const disabled = !option.available || runtimeLocked;
    return `<button type="button" class="entity-presentation-option ${active ? 'active' : ''}${!option.available ? ' locked' : ''}${runtimeLocked ? ' blocked' : ''}"
        data-entity-presentation-select="${encode(option.id)}" ${disabled ? 'disabled' : ''}
        style="${option.value?.swatch ? `--swatch:${option.value.swatch}` : ''}"
        aria-pressed="${active}" title="${!option.available ? '尚未满足使用条件' : runtimeLocked ? '当前由运行时演出覆盖' : ''}">
        <span class="entity-presentation-swatch"></span><span class="entity-presentation-label">${ctx.escapeHtml(label)}</span>
        ${renderValue(description)}
      </button>`;
  }).join('');
  const runtimeNote = runtimeLocked
    ? '<small class="entity-presentation-runtime-note">当前表现由剧情或其他运行时效果暂时覆盖</small>'
    : '';
  return `<section class="entity-presentation-options" data-entity-presentation-key="${ctx.escapeHtml(key)}">
    <div class="entity-presentation-heading"><span>表现内容</span><small>名称 · 描述 · 主题</small></div>
    <div class="entity-presentation-option-list">${defaultButton}${additionButtons}</div>
    ${runtimeNote}
  </section>`;
}
