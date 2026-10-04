import type { BackgroundView } from './background-service';
import { renderBackground } from './background-service';

/** body 直系背景宿主；不随 #app 的页面重建而消失。 */
export const OUTER_BACKGROUND_ID = 'ui-background-layer';

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character] ?? character));
}

export function renderOuterBackground(view: BackgroundView): string {
  const html = renderBackground(view, 'console-background', undefined, OUTER_BACKGROUND_ID);
  const scopedVars = Object.entries(view.themeVars ?? {})
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
  if (!scopedVars) return html;
  return html.replace(' aria-hidden="true">', ` style="${escapeHtmlAttribute(scopedVars)}" aria-hidden="true">`);
}

/** 将运行时背景挂载到 body 直系层，避免 body 自身承担主题背景服务。 */
export function syncOuterBackground(view: BackgroundView, doc: Document = document): void {
  const body = doc.body;
  if (!body) return;

  // 旧版本曾把全局背景放在 #app 内；页面重建前先清掉，避免双层背景叠加。
  doc.querySelectorAll<HTMLElement>('#app > .console-background').forEach(element => element.remove());

  const current = [...body.children].find(element => element.classList.contains('console-background')) as HTMLElement | undefined;
  const html = renderOuterBackground(view);
  if (current) {
    current.outerHTML = html;
    return;
  }

  const template = doc.createElement('template');
  template.innerHTML = html.trim();
  const background = template.content.firstElementChild;
  if (background) body.insertBefore(background, body.firstChild);
}
