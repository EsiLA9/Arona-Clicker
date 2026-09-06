import type { ModalManager } from '../modal';
import type { PackCatalogCommands, PackCatalogReadModel } from '../../arona-clicker/contracts';

type PackCatalogHost = PackCatalogReadModel & PackCatalogCommands;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

export function renderPackCatalog(host: PackCatalogReadModel): string {
  const catalog = host.getPackCatalog();
  if (catalog.entries.length === 0) return '<p>尚未导入数据包。</p>';
  const hints = new Map(catalog.dependencies.map(hint => [`${hint.packId}:${hint.dependency}`, hint.status]));
  return `<div class="pack-catalog">${catalog.entries.map((pack, index) => {
    const dependencyText = pack.dependencies.length === 0
      ? '无依赖'
      : pack.dependencies.map(dependency => {
        const status = hints.get(`${pack.id}:${dependency}`) ?? 'missing';
        return `<span class="pack-dependency ${status}">${escapeHtml(dependency)} · ${status === 'enabled' ? '已启用' : status === 'available' ? '可用' : '缺失'}</span>`;
      }).join('');
    return `<article class="pack-entry" data-pack-id="${escapeHtml(pack.id)}">
      <div class="pack-entry-main"><strong>${escapeHtml(pack.name)}</strong><span>${escapeHtml(pack.modName)} · v${escapeHtml(pack.version)}</span></div>
      <div class="pack-entry-meta">${pack.author ? `作者：${escapeHtml(pack.author)} · ` : ''}${pack.sourceKind === 'builtin' ? '内置数据包' : pack.sourceKind} · ${dependencyText}</div>
      <div class="pack-entry-actions">
        <button class="toolbar-button" data-pack-toggle="${escapeHtml(pack.id)}">${pack.enabled ? '停用' : '启用'}</button>
        <button class="toolbar-button" data-pack-up="${escapeHtml(pack.id)}" ${index === 0 ? 'disabled' : ''}>上移</button>
        <button class="toolbar-button" data-pack-down="${escapeHtml(pack.id)}" ${index === catalog.entries.length - 1 ? 'disabled' : ''}>下移</button>
      </div>
    </article>`;
  }).join('')}</div>`;
}

export function openPackManagerModal(modal: ModalManager, host: PackCatalogHost, onChanged: () => void): void {
  const render = () => {
    modal.open({
      title: '数据包库',
      body: renderPackCatalog(host),
      width: 680,
      footer: '<button class="primary-button modal-close">关闭</button>',
      onClose: onChanged,
    });
    const catalog = host.getPackCatalog();
    document.querySelectorAll<HTMLButtonElement>('[data-pack-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        try { host.setPackEnabled(button.dataset.packToggle!, !catalog.entries.find(entry => entry.id === button.dataset.packToggle!)?.enabled); render(); }
        catch (error) { modal.open({ title: '数据包库', body: `<p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`, footer: '<button class="primary-button modal-close">关闭</button>' }); }
      });
    });
    const move = (id: string, delta: number) => {
      const ids = catalog.entries.map(entry => entry.id);
      const index = ids.indexOf(id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      host.reorderPacks(ids);
      render();
    };
    document.querySelectorAll<HTMLButtonElement>('[data-pack-up]').forEach(button => button.addEventListener('click', () => move(button.dataset.packUp!, -1)));
    document.querySelectorAll<HTMLButtonElement>('[data-pack-down]').forEach(button => button.addEventListener('click', () => move(button.dataset.packDown!, 1)));
  };
  render();
}
