import type { PackCatalogEntry, PackCatalogReadModel } from '../../../arona-clicker/contracts/runtime/runtime';
import type { ModalManager } from '../../interaction/modal';
import type { UIContext } from '../../runtime/context';

export function isActiveEditingPack(query: Partial<PackCatalogReadModel>, id: string, modName: string): boolean {
  if (query.getRunningStoryPackId?.(modName) !== id) return false;
  const record = query.getPackRecord?.(id);
  return record?.editingMode === 'editing' && record.manifest.modName === modName;
}

export function openActiveEditingPackPicker(modal: ModalManager, options: {
  catalog: Partial<PackCatalogReadModel>;
  escapeHtml: UIContext['escapeHtml'];
  trigger: HTMLElement;
  accept?: (pack: PackCatalogEntry) => boolean;
  onSelect: (id: string) => void;
  onClose?: () => void;
}) {
  const { catalog, escapeHtml: e, trigger } = options;
  const choices = (catalog.getPackCatalog?.().entries ?? []).filter(pack => pack.editingMode === 'editing'
    && isActiveEditingPack(catalog, pack.packRecordId ?? pack.id, pack.modName) && (options.accept?.(pack) ?? true));
  const panel = modal.open({
    appearance: 'editor',
    title: '选择当前活跃的编辑态数据包',
    width: 480,
    body: `<div class="active-editing-pack-options">${choices.length
      ? choices.map((pack, index) => `<button type="button" class="mini-action" data-modal-action="pack:${index}">${e(pack.name)} · ${e(pack.version)} · ${e(pack.modName)}</button>`).join('')
      : '<p>没有符合条件的编辑态包。请在数据包管理中应用后重试。</p>'}<p role="status" data-pack-picker-status></p></div>`,
    footer: '<button type="button" class="mini-action modal-close">取消</button>',
    onClose: () => {
      options.onClose?.();
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    },
    onAction: action => {
      if (!action.startsWith('pack:')) return;
      const pack = choices[Number(action.slice('pack:'.length))];
      if (!pack) return;
      const id = pack.packRecordId ?? pack.id;
      if (!isActiveEditingPack(catalog, id, pack.modName) || !(options.accept?.(pack) ?? true)) {
        panel.querySelector('[data-pack-picker-status]')!.textContent = '该包已不在当前活跃的编辑态中。';
        return;
      }
      modal.close();
      options.onSelect(id);
    },
  });
  panel.tabIndex = -1;
  panel.focus({ preventScroll: true });
  return panel;
}
