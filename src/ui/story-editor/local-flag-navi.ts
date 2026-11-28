import type { ModalManager } from '../interaction/modal';
import type { UIContext } from '../runtime/context';
import type { StoryEditorTarget } from './model';
import type { StoryFlagCatalog, StoryFlagUse } from './flag-catalog';

export function renderLocalFlagNaviButton(disabled: boolean, includeInternal = false): string {
  return `<button type="button" class="mini-action" data-local-flag-navi${includeInternal ? ' data-local-flag-internal' : ''} aria-label="选择局部标记" title="打开局部标记 Navi"${disabled ? ' disabled' : ''}>选择…</button>`;
}

/** The shared modal owns dismissal; search only filters mounted rows, selection never navigates. */
export function openLocalFlagNavi(modal: ModalManager, ctx: UIContext, catalog: StoryFlagCatalog, options: {
  current: string;
  includeInternal: boolean;
  select(name: string, scope: string): void;
  navigate(target: StoryEditorTarget, nodeId?: string): void;
  close(): void;
}): void {
  const groups = new Map<string, StoryFlagUse[]>();
  for (const use of catalog.uses) {
    if (use.kind !== 'local') continue;
    const key = JSON.stringify([use.scope,use.name]);
    groups.set(key,[...(groups.get(key) ?? []),use]);
  }
  const rows = [...groups.values()].sort((a,b)=>a[0].name.localeCompare(b[0].name));
  const sources: StoryFlagUse[] = [];
  const e = ctx.escapeHtml, labels = {read:'读取',write:'写入',remove:'移除',return:'回传声明'};
  const body = rows.map((uses,index)=>{
    const first = uses[0], available = options.includeInternal || uses.some(use=>use.available);
    const search = [first.name,first.scope,...uses.flatMap(use=>[use.source.id,use.nodeId ?? '',labels[use.usage]])].join(' ').toLocaleLowerCase();
    return `<section class="story-editor-flag-navi-row" data-flag-navi-search="${e(search)}"><button type="button" class="story-editor-list-item" data-modal-action="flag-navi-select:${index}"${available?'':' disabled'}${first.name===options.current?' aria-current="true"':''}><strong>${e(first.name)}</strong><small>${e(first.scope)} · ${[...new Set(uses.map(use=>labels[use.usage]))].join(' / ')}</small>${available?'':'<small>其他 Entry 内部标记，未声明向当前作用域回传</small>'}</button><div class="story-editor-actions">${uses.map(use=>{
      const source = sources.push(use)-1;
      return `<button type="button" class="mini-action" data-modal-action="flag-navi-source:${source}" title="${e(use.path)}">查看来源：${e(use.source.id)}${use.nodeId?` / ${e(use.nodeId)}`:''}</button>`;
    }).join('')}</div></section>`;
  }).join('');
  modal.open({appearance:'editor',title:'局部标记 Navi',panelClass:'story-editor-flag-navi',width:640,
    body:`<label>搜索局部标记<input type="search" data-flag-navi-query placeholder="标记名、Story / Entry ID 或节点 ID" autocomplete="off"></label><p class="story-editor-hint">选择标记填回原字段；查看来源会进入对应文档。仍可关闭后自由输入名称。</p><div data-flag-navi-list>${body}</div><p class="story-editor-empty" data-flag-navi-empty${rows.length?' hidden':''}>没有匹配的局部标记。</p>`,
    footer:'<button type="button" class="mini-action modal-close">取消</button>',onClose:options.close,
    onAction:action=>{
      const [kind,raw] = action.split(':'); const index = Number(raw);
      if (!Number.isInteger(index) || index < 0) return;
      if (kind==='flag-navi-select') {
        const uses = rows[index];
        if (uses && (options.includeInternal || uses.some(use=>use.available))) options.select(uses[0].name,uses[0].scope);
      } else if (kind==='flag-navi-source' && sources[index]) options.navigate(sources[index].source,sources[index].nodeId);
    }});
  const panel = document.querySelector<HTMLElement>('.story-editor-flag-navi')!;
  const input = panel.querySelector<HTMLInputElement>('[data-flag-navi-query]')!;
  input.addEventListener('input',()=>{
    const query = input.value.trim().toLocaleLowerCase(); let visible = 0;
    for (const row of panel.querySelectorAll<HTMLElement>('[data-flag-navi-search]')) {
      row.hidden = !row.dataset.flagNaviSearch!.includes(query); if (!row.hidden) visible++;
    }
    panel.querySelector<HTMLElement>('[data-flag-navi-empty]')!.hidden = visible > 0;
  });
  input.focus();
}
