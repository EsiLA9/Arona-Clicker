import type { EditorModel } from '../../model/editor-model';
import type { PresentationDef } from '../../../../src/engine/types/theme';
import { buildPresentationView, renderPresentationRegion } from '../../../../src/ui/presentation-service';

export function renderPresentationPreview(container: HTMLElement, model: EditorModel, presentation: PresentationDef | undefined): void {
  container.replaceChildren();
  if (!presentation) return;
  const pics = {
    urlOf: (ref: string | undefined) => {
      if (!ref) return undefined;
      const row = model.rowsOf('pics').find(item => item.id === ref);
      return typeof row?.src === 'string' ? row.src : undefined;
    },
    defOf: (ref: string) => {
      const row = model.rowsOf('pics').find(item => item.id === ref);
      return row ? row as never : undefined;
    },
  };
  const view = buildPresentationView(presentation, pics);
  container.className = 'presentation-preview';
  container.innerHTML = `<div class="presentation-preview-title">表现预览（中部信息栏）</div><div class="presentation-preview-stage">${renderPresentationRegion(view, 'centerPanel')}</div>`;
}
