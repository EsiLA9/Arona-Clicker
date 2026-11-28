import book from '../../story-editor/book.svg?raw';
import clapperboard from '../../story-editor/clapperboard.svg?raw';

export type EditorEntryIconType = 'active' | 'passive';
export type EditorWorldIconType = 'init' | 'area' | 'spot';

function svgBody(asset: string): string {
  return asset.slice(asset.indexOf('>') + 1, asset.lastIndexOf('</svg>'));
}

const entryLetters: Record<EditorEntryIconType, string> = {
  active: 'm15.9 20.9 2.3-5.4 2.3 5.4m-3.9-1.7h3.2',
  passive: 'M16.4 20.9v-5.4h2a1.5 1.5 0 0 1 0 3h-2',
};

const artwork = new Map<string, string>([
  ['story', svgBody(book)],
  ['entry', svgBody(clapperboard)],
  ['init', '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>'],
  ['area', '<path d="m2.5 19 6.7-10 3.1 4.2L16 6l5.5 13zM7.3 12l1.9 1.5 2-1.8M14.2 9.5l1.8 1.7 1.8-1.7"/>'],
  ['spot', '<path d="m2.5 11.5 9.5-8 9.5 8M5 10v10h14V10m-9 10v-6h4v6"/>'],
]);

export function renderEditorEntityIcon(kind: string | undefined, entryType?: EditorEntryIconType, withChevron = false): string {
  const body = kind && artwork.get(kind);
  if (!body) return '';
  const badge = kind === 'entry' && entryType
    ? `<g class="editor-entity-icon__badge" data-entry-type="${entryType}"><rect x="13.4" y="13" width="9.6" height="10.2" rx="2.3"/><path d="${entryLetters[entryType]}"/></g>`
    : '';
  const chevron = withChevron
    ? '<g class="editor-entity-icon__chevron"><path class="editor-entity-icon__outline" d="m10 6.5 5.5 5.5-5.5 5.5"/><path d="m10 6.5 5.5 5.5-5.5 5.5"/></g>'
    : '';
  return `<svg class="editor-entity-icon${withChevron ? ' editor-entity-icon--toggle' : ''}" data-entity-icon="${kind}" viewBox="0 0 24 24" aria-hidden="true"><g class="editor-entity-icon__art" fill-rule="evenodd">${body}</g>${badge}${chevron}</svg>`;
}
